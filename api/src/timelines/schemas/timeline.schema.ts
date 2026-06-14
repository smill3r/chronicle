import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TimelineDocument = HydratedDocument<Timeline>;

@Schema({ collection: 'timelines', timestamps: true })
export class Timeline {
  @Prop({ required: true, unique: true })
  title!: string;

  @Prop({ required: true, unique: true })
  slug!: string;

  @Prop({ default: 0 })
  eventCount!: number;

  @Prop()
  yearStart!: number;

  @Prop()
  yearEnd!: number;

  @Prop({ type: [String], default: [] })
  categories!: string[];

  @Prop({ default: '' })
  sourceUrl!: string;
}

export const TimelineSchema = SchemaFactory.createForClass(Timeline);
