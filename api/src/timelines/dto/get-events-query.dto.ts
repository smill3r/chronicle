import { IsOptional, IsNumber, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetEventsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  yearStart?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  yearEnd?: number;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}
