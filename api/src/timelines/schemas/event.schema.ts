import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EventDocument = HydratedDocument<ChronicleEvent>;

@Schema({ collection: 'events', timestamps: true })
export class ChronicleEvent {
  @Prop({ required: true })
  year!: number;

  @Prop({ required: true })
  yearDisplay!: string;

  @Prop({
    enum: ['year', 'month', 'day', 'circa', 'range', 'unknown'],
    default: 'year',
  })
  datePrecision!: string;

  @Prop({ required: true })
  title!: string;

  @Prop({ default: '' })
  description!: string;

  @Prop({ type: [String], default: [] })
  category!: string[];

  @Prop({ type: [String], default: [] })
  location!: string[];

  @Prop({ default: '' })
  wikiLink!: string;

  @Prop({ default: '' })
  wikiSummary!: string;

  @Prop({ default: '' })
  wikiThumbnail!: string;

  @Prop({ required: true })
  sourceArticle!: string;

  @Prop({ required: true })
  sourceUrl!: string;

  @Prop({ type: Date, default: Date.now })
  scrapedAt!: Date;
}

export const EventSchema = SchemaFactory.createForClass(ChronicleEvent);
