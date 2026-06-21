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

  // "About this topic" enrichment, sourced from the root Wikidata entity + its
  // main Wikipedia article at import time.
  @Prop({ default: '' })
  tagline!: string; // Wikidata one-line description

  @Prop({ default: '' })
  description!: string; // Wikipedia lead paragraph

  @Prop({ default: '' })
  heroImage!: string; // main article image URL

  @Prop({ default: '' })
  wikiLink!: string; // main article title
}

export const TimelineSchema = SchemaFactory.createForClass(Timeline);
