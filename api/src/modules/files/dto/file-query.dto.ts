import { IsEnum, IsOptional, IsString, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FileCategory } from './upload-file.dto';

export class FileQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by file category',
    enum: FileCategory,
  })
  @IsEnum(FileCategory)
  @IsOptional()
  category?: FileCategory;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    example: 'quote',
  })
  @IsString()
  @IsOptional()
  entity_type?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity ID',
    example: 'uuid-of-entity',
  })
  @IsString()
  @IsOptional()
  entity_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by file type (image, pdf, document)',
    example: 'image',
  })
  @IsString()
  @IsOptional()
  file_type?: string;

  @ApiPropertyOptional({
    description: 'Start date filter (ISO 8601 format)',
    example: '2025-01-01',
  })
  @IsString()
  @IsOptional()
  start_date?: string;

  @ApiPropertyOptional({
    description: 'End date filter (ISO 8601 format)',
    example: '2025-12-31',
  })
  @IsString()
  @IsOptional()
  end_date?: string;

  @ApiPropertyOptional({
    description: 'Search by filename',
    example: 'contact@honeydo4you.com',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @Type(() => Number)
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;
}
