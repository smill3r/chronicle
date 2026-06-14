import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TimelinesController } from './timelines.controller';
import { TimelinesService } from './timelines.service';
import { Timeline, TimelineSchema } from './schemas/timeline.schema';
import { ChronicleEvent, EventSchema } from './schemas/event.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Timeline.name, schema: TimelineSchema },
      { name: ChronicleEvent.name, schema: EventSchema },
    ]),
  ],
  controllers: [TimelinesController],
  providers: [TimelinesService],
})
export class TimelinesModule {}
