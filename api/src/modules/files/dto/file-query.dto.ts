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
