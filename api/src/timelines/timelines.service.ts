import { Injectable, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Model, FilterQuery, SortOrder } from 'mongoose';
import { Timeline, TimelineDocument } from './schemas/timeline.schema';
import { ChronicleEvent, EventDocument } from './schemas/event.schema';
import { GetEventsQueryDto } from './dto/get-events-query.dto';
import { PaginatedResult } from '../common/pagination.interface';

@Injectable()
export class TimelinesService {
  constructor(
    @InjectModel(Timeline.name) private timelineModel: Model<TimelineDocument>,
    @InjectModel(ChronicleEvent.name) private eventModel: Model<EventDocument>,
  ) {}

  findAll() {
    return this.timelineModel.find().sort({ title: 1 }).select('-__v').lean().exec();
  }

  async findBySlug(slug: string) {
    const timeline = await this.timelineModel
      .findOne({ slug })
      .select('-__v')
      .lean()
      .exec();
    if (!timeline) throw new NotFoundException(`Timeline "${slug}" not found`);
    return timeline;
  }

  async findEvents(
    slug: string,
    dto: GetEventsQueryDto,
  ): Promise<PaginatedResult<Record<string, unknown>>> {
    const timeline = await this.timelineModel
      .findOne({ slug })
      .select('title')
      .lean()
      .exec();
    if (!timeline) throw new NotFoundException(`Timeline "${slug}" not found`);

    const filter: FilterQuery<EventDocument> = { sourceArticle: timeline.title };

    if (dto.yearStart !== undefined || dto.yearEnd !== undefined) {
      filter.year = {};
      if (dto.yearStart !== undefined) filter.year.$gte = dto.yearStart;
      if (dto.yearEnd !== undefined) filter.year.$lte = dto.yearEnd;
    }

    if (dto.category) {
      const cats = dto.category.split(',').map((c) => c.trim()).filter(Boolean);
      if (cats.length > 0) filter.category = { $in: cats };
    }

    if (dto.q) filter.$text = { $search: dto.q };

    const page = dto.page ?? 1;
    const limit = dto.limit ?? 50;
    const skip = (page - 1) * limit;

    // $text search requires textScore as primary sort key
    const sort: { [key: string]: SortOrder | { $meta: string } } = dto.q
      ? { score: { $meta: 'textScore' }, year: 1 }
      : { year: 1 };

    const [total, data] = await Promise.all([
      this.eventModel.countDocuments(filter).exec(),
      this.eventModel
        .find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .select('-__v -scrapedAt -createdAt -updatedAt')
        .lean()
        .exec(),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async getEventSummary(slug: string, eventId: string) {
    // Validate eventId is a valid ObjectId before querying
    if (!Types.ObjectId.isValid(eventId)) {
      throw new NotFoundException(`Event "${eventId}" not found`);
    }

    const timeline = await this.timelineModel
      .findOne({ slug })
      .select('title')
      .lean()
      .exec();
    if (!timeline) throw new NotFoundException(`Timeline "${slug}" not found`);

    const event = await this.eventModel
      .findOne({ _id: eventId, sourceArticle: timeline.title })
      .select('wikiLink wikiSummary wikiThumbnail')
      .lean()
      .exec();
    if (!event) throw new NotFoundException(`Event "${eventId}" not found`);

    // Return cached summary if already fetched
    if (event.wikiSummary) {
      return {
        summary: event.wikiSummary,
        thumbnail: event.wikiThumbnail || null,
        wikiLink: event.wikiLink,
      };
    }

    // No wikiLink means we can't fetch a summary
    if (!event.wikiLink) {
      return { summary: null, thumbnail: null, wikiLink: '' };
    }

    // Fetch from Wikipedia REST API (lazy, first-time only)
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(event.wikiLink.replace(/ /g, '_'))}`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Chronicle/1.0 (portfolio project; smillerjess@gmail.com)' },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        return { summary: null, thumbnail: null, wikiLink: event.wikiLink };
      }

      const data = await res.json() as {
        extract?: string;
        thumbnail?: { source?: string };
      };

      const summary = data.extract ?? null;
      const thumbnail = data.thumbnail?.source ?? null;

      // Cache result on the event document (best-effort — don't fail if write fails)
      if (summary) {
        await this.eventModel.updateOne(
          { _id: eventId },
          { $set: { wikiSummary: summary, wikiThumbnail: thumbnail ?? '' } },
        ).exec();
      }

      return { summary, thumbnail, wikiLink: event.wikiLink };
    } catch {
      return { summary: null, thumbnail: null, wikiLink: event.wikiLink };
    }
  }
}
