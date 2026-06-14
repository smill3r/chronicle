import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TimelinesModule } from './timelines/timelines.module';

@Module({
  imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/chronicle'),
    TimelinesModule,
  ],
})
export class AppModule {}
