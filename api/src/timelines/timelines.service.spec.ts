import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { NotFoundException } from '@nestjs/common';
import { TimelinesService } from './timelines.service';
import { Timeline } from './schemas/timeline.schema';
import { ChronicleEvent } from './schemas/event.schema';

const mockTimeline = {
  _id: 'tl1',
  title: 'Timeline of the French Revolution',
  slug: 'the-french-revolution',
  eventCount: 106,
  yearStart: 1771,
  yearEnd: 1790,
  categories: ['Politics', 'War'],
  sourceUrl: 'https://en.wikipedia.org/wiki/Timeline_of_the_French_Revolution',
};

function makeMockModel(findOneResult: unknown, findResult: unknown[] = [], countResult = 0) {
  const lean = jest.fn().mockResolvedValue(findOneResult);
  const exec = jest.fn().mockResolvedValue(findOneResult);
  const select = jest.fn().mockReturnValue({ lean: () => ({ exec }) });

  const query = {
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnValue({ lean: () => ({ exec: jest.fn().mockResolvedValue(findResult) }) }),
    lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(findResult) }),
    exec: jest.fn().mockResolvedValue(findResult),
  };

  return {
    findOne: jest.fn().mockReturnValue({ select: () => ({ lean: () => ({ exec }) }) }),
    find: jest.fn().mockReturnValue(query),
    aggregate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
    countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(countResult) }),
    updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    _lean: lean,
    _select: select,
    _query: query,
  };
}

describe('TimelinesService', () => {
  let service: TimelinesService;
  let timelineModel: ReturnType<typeof makeMockModel>;
  let eventModel: ReturnType<typeof makeMockModel>;

  beforeEach(async () => {
    timelineModel = makeMockModel(mockTimeline);
    eventModel = makeMockModel(null, [], 0);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimelinesService,
        { provide: getModelToken(Timeline.name), useValue: timelineModel },
        { provide: getModelToken(ChronicleEvent.name), useValue: eventModel },
      ],
    }).compile();

    service = module.get<TimelinesService>(TimelinesService);
  });

  describe('findBySlug', () => {
    it('throws NotFoundException when slug does not exist', async () => {
      timelineModel.findOne = jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(null) }) }),
      });
      await expect(service.findBySlug('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('returns timeline when found', async () => {
      timelineModel.findOne = jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(mockTimeline) }) }),
      });
      const result = await service.findBySlug('the-french-revolution');
      expect(result).toEqual(mockTimeline);
    });
  });

  describe('discover', () => {
    const sampled = {
      _id: '507f1f77bcf86cd799439011',
      year: 1789, yearDisplay: '1789', datePrecision: 'year',
      title: 'Storming of the Bastille', description: '',
      category: ['War'], location: ['Paris'], wikiLink: 'Storming of the Bastille',
      sourceArticle: 'Timeline of the French Revolution',
    };

    it('samples a random event with a wikiLink and returns it with slug + summary', async () => {
      eventModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([sampled]),
      });
      // getEventSummary's cached path: the event already has a summary
      eventModel.findOne = jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue({
          wikiLink: 'Storming of the Bastille', wikiSummary: 'cached blurb', wikiThumbnail: '',
        }) }) }),
      });

      const res = await service.discover();

      const pipeline = eventModel.aggregate.mock.calls[0][0];
      expect(pipeline).toEqual(expect.arrayContaining([{ $sample: { size: 1 } }]));
      expect(res.slug).toBe('the-french-revolution');
      expect(res.event.title).toBe('Storming of the Bastille');
      expect(res.summary).toBe('cached blurb');
    });

    it('throws when there are no events to sample', async () => {
      eventModel.aggregate = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });
      await expect(service.discover()).rejects.toThrow(NotFoundException);
    });
  });

  describe('findEvents — filter construction', () => {
    beforeEach(() => {
      // findOne for slug resolution always returns the mock timeline
      timelineModel.findOne = jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(mockTimeline) }) }),
      });
    });

    it('always filters by sourceArticle', async () => {
      await service.findEvents('the-french-revolution', {});
      const filter = eventModel.find.mock.calls[0][0];
      expect(filter.sourceArticle).toBe('Timeline of the French Revolution');
    });

    it('applies yearStart only', async () => {
      await service.findEvents('the-french-revolution', { yearStart: 1789 });
      const filter = eventModel.find.mock.calls[0][0];
      expect(filter.year.$gte).toBe(1789);
      expect(filter.year.$lte).toBeUndefined();
    });

    it('applies yearEnd only', async () => {
      await service.findEvents('the-french-revolution', { yearEnd: 1799 });
      const filter = eventModel.find.mock.calls[0][0];
      expect(filter.year.$lte).toBe(1799);
      expect(filter.year.$gte).toBeUndefined();
    });

    it('applies both yearStart and yearEnd', async () => {
      await service.findEvents('the-french-revolution', { yearStart: 1789, yearEnd: 1799 });
      const filter = eventModel.find.mock.calls[0][0];
      expect(filter.year.$gte).toBe(1789);
      expect(filter.year.$lte).toBe(1799);
    });

    it('applies single category filter', async () => {
      await service.findEvents('the-french-revolution', { category: 'War' });
      const filter = eventModel.find.mock.calls[0][0];
      expect(filter.category.$in).toEqual(['War']);
    });

    it('applies multiple comma-separated categories', async () => {
      await service.findEvents('the-french-revolution', { category: 'War,Politics' });
      const filter = eventModel.find.mock.calls[0][0];
      expect(filter.category.$in).toEqual(['War', 'Politics']);
    });

    it('does not set category filter when omitted', async () => {
      await service.findEvents('the-french-revolution', {});
      const filter = eventModel.find.mock.calls[0][0];
      expect(filter.category).toBeUndefined();
    });

    it('sets $text filter when q is provided', async () => {
      await service.findEvents('the-french-revolution', { q: 'Bastille' });
      const filter = eventModel.find.mock.calls[0][0];
      expect(filter.$text).toEqual({ $search: 'Bastille' });
    });

    it('sorts by textScore then year when q is provided', async () => {
      await service.findEvents('the-french-revolution', { q: 'Bastille' });
      const query = eventModel.find.mock.results[0].value;
      expect(query.sort).toHaveBeenCalledWith(
        expect.objectContaining({ score: { $meta: 'textScore' }, year: 1 }),
      );
    });

    it('sorts by year with _id tiebreaker when q is not provided', async () => {
      await service.findEvents('the-french-revolution', {});
      const query = eventModel.find.mock.results[0].value;
      expect(query.sort).toHaveBeenCalledWith({ year: 1, _id: 1 });
    });

    it('applies correct skip and limit for pagination', async () => {
      await service.findEvents('the-french-revolution', { page: 3, limit: 20 });
      const query = eventModel.find.mock.results[0].value;
      expect(query.skip).toHaveBeenCalledWith(40); // (3-1) * 20
      expect(query.limit).toHaveBeenCalledWith(20);
    });

    it('uses default page 1 and limit 50 when not provided', async () => {
      await service.findEvents('the-french-revolution', {});
      const query = eventModel.find.mock.results[0].value;
      expect(query.skip).toHaveBeenCalledWith(0);
      expect(query.limit).toHaveBeenCalledWith(50);
    });

  });

  describe('findEvents — throws when slug not found', () => {
    it('throws NotFoundException', async () => {
      timelineModel.findOne = jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(null) }) }),
      });
      await expect(service.findEvents('bad-slug', {})).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEventSummary', () => {
    const VALID_ID = '507f1f77bcf86cd799439011';
    const mockEvent = {
      _id: VALID_ID,
      title: 'Burning of the Library of Alexandria',
      wikiLink: 'Library of Alexandria',
      wikiSummary: '',
      wikiThumbnail: '',
    };

    beforeEach(() => {
      timelineModel.findOne = jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(mockTimeline) }) }),
      });
      // Default event model findOne returns mockEvent with empty summary
      eventModel.findOne = jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(mockEvent) }) }),
      });
      eventModel.updateOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('throws NotFoundException for invalid ObjectId', async () => {
      await expect(service.getEventSummary('the-french-revolution', 'not-an-id')).rejects.toThrow(NotFoundException);
    });

    it('returns cached summary without fetching Wikipedia', async () => {
      const cachedEvent = { ...mockEvent, wikiSummary: 'Cached text.', wikiThumbnail: 'http://thumb.jpg' };
      eventModel.findOne = jest.fn().mockReturnValue({
        select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(cachedEvent) }) }),
      });
      const fetchSpy = jest.spyOn(global, 'fetch');

      const result = await service.getEventSummary('the-french-revolution', VALID_ID);
      expect(result.summary).toBe('Cached text.');
      expect(result.thumbnail).toBe('http://thumb.jpg');
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('fetches Wikipedia by wikiLink, stores result, and returns summary on cache miss', async () => {
      const wikiResponse = {
        extract: 'The Library of Alexandria was one of the largest libraries.',
        thumbnail: { source: 'http://wiki-thumb.jpg' },
      };
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(wikiResponse),
      } as Response);

      const result = await service.getEventSummary('the-french-revolution', VALID_ID);
      expect(result.summary).toBe(wikiResponse.extract);
      expect(result.thumbnail).toBe('http://wiki-thumb.jpg');
      expect(eventModel.updateOne).toHaveBeenCalledWith(
        { _id: VALID_ID },
        { $set: { wikiSummary: wikiResponse.extract, wikiThumbnail: 'http://wiki-thumb.jpg' } },
      );
    });

    it('returns null summary when Wikipedia returns non-ok response', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
      } as Response);

      const result = await service.getEventSummary('the-french-revolution', VALID_ID);
      expect(result.summary).toBeNull();
      expect(eventModel.updateOne).not.toHaveBeenCalled();
    });

    it('returns null summary when fetch throws', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network error'));

      const result = await service.getEventSummary('the-french-revolution', VALID_ID);
      expect(result.summary).toBeNull();
    });

    describe('title-search fallback (no wikiLink)', () => {
      const noLinkEvent = {
        ...mockEvent,
        title: 'Battle of Manzikert',
        wikiLink: '',
      };

      beforeEach(() => {
        eventModel.findOne = jest.fn().mockReturnValue({
          select: () => ({ lean: () => ({ exec: jest.fn().mockResolvedValue(noLinkEvent) }) }),
        });
      });

      it('searches Wikipedia by title and returns summary when candidate matches', async () => {
        const searchResponse = ['Battle of Manzikert', ['Battle of Manzikert'], [], []];
        const wikiResponse = {
          extract: 'The Battle of Manzikert was fought in 1071.',
          thumbnail: { source: 'http://manzikert-thumb.jpg' },
        };
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(searchResponse) } as Response)
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(wikiResponse) } as Response);

        const result = await service.getEventSummary('byzantine-empire', VALID_ID);
        expect(result.summary).toBe(wikiResponse.extract);
        expect(result.thumbnail).toBe('http://manzikert-thumb.jpg');
        expect(result.wikiLink).toBe('Battle of Manzikert');
        // wikiLink is also cached so future calls skip the search
        expect(eventModel.updateOne).toHaveBeenCalledWith(
          { _id: VALID_ID },
          { $set: { wikiLink: 'Battle of Manzikert', wikiSummary: wikiResponse.extract, wikiThumbnail: 'http://manzikert-thumb.jpg' } },
        );
      });

      it('returns null when no search candidate title matches the event title', async () => {
        // e.g. "Battle of Manzikert" searched but Wikipedia only suggests an unrelated article
        const searchResponse = ['Battle of Manzikert', ['Byzantine–Seljuk Wars'], [], []];
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(searchResponse) } as Response);

        const result = await service.getEventSummary('byzantine-empire', VALID_ID);
        expect(result.summary).toBeNull();
        expect(eventModel.updateOne).not.toHaveBeenCalled();
      });

      it('returns null when the search API returns no candidates', async () => {
        const searchResponse = ['Battle of Manzikert', [], [], []];
        jest.spyOn(global, 'fetch')
          .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(searchResponse) } as Response);

        const result = await service.getEventSummary('byzantine-empire', VALID_ID);
        expect(result.summary).toBeNull();
      });

      it('returns null when the search API call fails', async () => {
        jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('network error'));

        const result = await service.getEventSummary('byzantine-empire', VALID_ID);
        expect(result.summary).toBeNull();
      });
    });
  });
});
