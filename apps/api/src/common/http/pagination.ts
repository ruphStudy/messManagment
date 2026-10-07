import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import type { PaginationMeta } from '@mess/shared';

/** Standard query DTO for list endpoints. */
export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  get skip() {
    return (this.page - 1) * this.pageSize;
  }
}

/** Return from a controller to produce `{ data, meta }`. */
export class Paginated<T> {
  readonly meta: PaginationMeta;

  constructor(
    readonly items: T[],
    total: number,
    query: PaginationQueryDto,
  ) {
    this.meta = {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    };
  }
}
