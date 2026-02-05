import { ApiProperty } from '@nestjs/swagger';

export class PaginationMetaDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
    type: Number,
  })
  page: number;

  @ApiProperty({
    description: 'Items per page',
    example: 50,
    type: Number,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 123,
    type: Number,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
    type: Number,
  })
  pages: number;
}

export class PaginatedResponseDto<T> {
  @ApiProperty({ description: 'Array of items', isArray: true })
  data: T[];

  @ApiProperty({ description: 'Pagination metadata', type: PaginationMetaDto })
  pagination: PaginationMetaDto;
}
