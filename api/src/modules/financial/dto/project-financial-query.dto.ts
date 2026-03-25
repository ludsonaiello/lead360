import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ─── Shared Date Range ───────────────────────────────────────────────

/**
 * Shared date range filter used by summary, timeline, and workforce endpoints.
 * Filters financial_entry.entry_date for cost endpoints.
 * Filters log_date/payment_date for workforce endpoint.
 */
export class ProjectDateFilterDto {
  @ApiPropertyOptional({
    description: 'Start date filter (inclusive). ISO 8601 date format.',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({
    description: 'End date filter (inclusive). ISO 8601 date format.',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  date_to?: string;
}

// ─── Task Breakdown Query ────────────────────────────────────────────

export enum TaskBreakdownSortBy {
  TOTAL_COST = 'total_cost',
  TASK_TITLE = 'task_title',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

/**
 * Query DTO for GET /projects/:projectId/financial/tasks
 */
export class ProjectTaskBreakdownQueryDto extends ProjectDateFilterDto {
  @ApiPropertyOptional({
    description: 'Sort field',
    enum: TaskBreakdownSortBy,
    default: TaskBreakdownSortBy.TOTAL_COST,
    example: 'total_cost',
  })
  @IsOptional()
  @IsEnum(TaskBreakdownSortBy)
  sort_by?: TaskBreakdownSortBy = TaskBreakdownSortBy.TOTAL_COST;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortOrder,
    default: SortOrder.DESC,
    example: 'desc',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder = SortOrder.DESC;
}

// ─── Receipts Query ──────────────────────────────────────────────────

export enum ReceiptOcrStatus {
  NOT_PROCESSED = 'not_processed',
  PROCESSING = 'processing',
  COMPLETE = 'complete',
  FAILED = 'failed',
}

/**
 * Query DTO for GET /projects/:projectId/financial/receipts
 */
export class ProjectReceiptsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by categorization status',
    example: true,
  })
  @IsOptional()
  @Transform(({ value }): boolean => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value as boolean;
  })
  @IsBoolean()
  is_categorized?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by OCR processing status',
    enum: ReceiptOcrStatus,
    example: 'complete',
  })
  @IsOptional()
  @IsEnum(ReceiptOcrStatus)
  ocr_status?: ReceiptOcrStatus;

  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Items per page (max 100)',
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
