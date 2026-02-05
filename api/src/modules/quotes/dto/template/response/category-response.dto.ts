import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CategoryResponseDto {
  @ApiProperty({
    description: 'Category unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Category name',
    example: 'Modern',
    maxLength: 100,
  })
  name: string;

  @ApiPropertyOptional({
    description: 'Category description',
    example: 'Clean, contemporary templates for modern businesses',
    type: String,
    nullable: true,
  })
  description: string | null;

  @ApiPropertyOptional({
    description: 'Icon name (for UI display)',
    example: 'sparkles',
    maxLength: 50,
    type: String,
    nullable: true,
  })
  icon_name: string | null;

  @ApiProperty({
    description: 'Display sort order',
    example: 1,
    type: Number,
  })
  sort_order: number;

  @ApiProperty({
    description: 'Is this category active?',
    example: true,
    type: Boolean,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-02-04T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  created_at: string;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-02-04T10:00:00.000Z',
    type: String,
    format: 'date-time',
  })
  updated_at: string;
}
