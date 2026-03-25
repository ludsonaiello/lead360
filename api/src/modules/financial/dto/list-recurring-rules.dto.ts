import { IsOptional, IsEnum, IsUUID, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { RecurringFrequency } from './create-recurring-rule.dto';

export enum RecurringRuleStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export enum RecurringRuleSortBy {
  NEXT_DUE_DATE = 'next_due_date',
  AMOUNT = 'amount',
  NAME = 'name',
  CREATED_AT = 'created_at',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

export class ListRecurringRulesDto {
  @ApiPropertyOptional({
    description: 'Filter by status',
    enum: RecurringRuleStatus,
    default: 'active',
  })
  @IsOptional()
  @IsEnum(RecurringRuleStatus)
  status?: RecurringRuleStatus;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by frequency',
    enum: RecurringFrequency,
  })
  @IsOptional()
  @IsEnum(RecurringFrequency)
  frequency?: RecurringFrequency;

  @ApiPropertyOptional({
    description: 'Page number',
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Sort by field',
    enum: RecurringRuleSortBy,
    default: 'next_due_date',
  })
  @IsOptional()
  @IsEnum(RecurringRuleSortBy)
  sort_by?: RecurringRuleSortBy;

  @ApiPropertyOptional({
    description: 'Sort direction',
    enum: SortOrder,
    default: 'asc',
  })
  @IsOptional()
  @IsEnum(SortOrder)
  sort_order?: SortOrder;
}
