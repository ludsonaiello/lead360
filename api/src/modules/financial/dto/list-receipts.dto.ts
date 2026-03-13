import {
  IsOptional,
  IsUUID,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

/**
 * DTO for querying receipts.
 * At least one of project_id or task_id is expected (validated in service).
 * Supports pagination and filtering by categorization status.
 */
export class ListReceiptsDto {
  @ApiPropertyOptional({
    description: 'Filter by project UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by task UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567891',
  })
  @IsOptional()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by categorization status (true = linked to entry)',
    example: false,
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  is_categorized?: boolean;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Results per page (max 100)',
    example: 20,
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
