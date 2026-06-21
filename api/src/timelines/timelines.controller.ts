import { Controller, Get, Param, Query } from '@nestjs/common';
import { TimelinesService } from './timelines.service';
import { GetEventsQueryDto } from './dto/get-events-query.dto';

@Controller('timelines')
export class TimelinesController {
  constructor(private readonly timelinesService: TimelinesService) {}

  @Get()
  findAll() {
    return this.timelinesService.findAll();
  }

  // Declared before ':slug' so the param route doesn't swallow it.
  @Get('discover/random')
  discover() {
    return this.timelinesService.discover();
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.timelinesService.findBySlug(slug);
  }

  @Get(':slug/events')
  findEvents(@Param('slug') slug: string, @Query() query: GetEventsQueryDto) {
    return this.timelinesService.findEvents(slug, query);
  }

  @Get(':slug/events/:eventId/summary')
  getEventSummary(
    @Param('slug') slug: string,
    @Param('eventId') eventId: string,
  ) {
    return this.timelinesService.getEventSummary(slug, eventId);
  }
}
