import { Test, TestingModule } from '@nestjs/testing';
import { TimelinesController } from './timelines.controller';
import { TimelinesService } from './timelines.service';

const mockService = {
  findAll: jest.fn().mockResolvedValue([]),
  findBySlug: jest.fn().mockResolvedValue({ slug: 'the-french-revolution' }),
  findEvents: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 50, totalPages: 0 }),
};

describe('TimelinesController', () => {
  let controller: TimelinesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TimelinesController],
      providers: [{ provide: TimelinesService, useValue: mockService }],
    }).compile();

    controller = module.get<TimelinesController>(TimelinesController);
    jest.clearAllMocks();
  });

  it('findAll calls service.findAll', async () => {
    await controller.findAll();
    expect(mockService.findAll).toHaveBeenCalledTimes(1);
  });

  it('findOne passes slug to service.findBySlug', async () => {
    await controller.findOne('the-french-revolution');
    expect(mockService.findBySlug).toHaveBeenCalledWith('the-french-revolution');
  });

  it('findEvents passes slug and query DTO to service.findEvents', async () => {
    const query = { yearStart: 1789, yearEnd: 1799, page: 1, limit: 50 };
    await controller.findEvents('the-french-revolution', query as any);
    expect(mockService.findEvents).toHaveBeenCalledWith('the-french-revolution', query);
  });
});
