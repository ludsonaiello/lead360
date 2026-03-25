import {
  IsOptional,
  IsString,
  IsUUID,
  IsDateString,
  IsEnum,
  IsBoolean,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ListFinancialEntriesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Filter by task ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiPropertyOptional({ description: 'Filter by category ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by category type',
    enum: ['labor', 'material', 'subcontractor', 'equipment', 'insurance', 'fuel', 'utilities', 'office', 'marketing', 'taxes', 'tools', 'other'],
  })
  @IsOptional()
  @IsEnum(['labor', 'material', 'subcontractor', 'equipment', 'insurance', 'fuel', 'utilities', 'office', 'marketing', 'taxes', 'tools', 'other'], {
    message: 'Invalid category_type',
  })
  category_type?: string;

  @ApiPropertyOptional({
    description: 'Filter by classification',
    enum: ['cost_of_goods_sold', 'operating_expense'],
  })
  @IsOptional()
  @IsEnum(['cost_of_goods_sold', 'operating_expense'], {
    message: 'Invalid classification',
  })
  classification?: string;

  @ApiPropertyOptional({
    description: 'Filter by entry type',
    enum: ['expense', 'income'],
  })
  @IsOptional()
  @IsEnum(['expense', 'income'], { message: 'Invalid entry_type' })
  entry_type?: string;

  @ApiPropertyOptional({ description: 'Filter by supplier ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({
    description: 'Filter by payment method',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'Invalid payment_method',
  })
  payment_method?: string;

  @ApiPropertyOptional({
    description: 'Filter by submission status',
    enum: ['pending_review', 'confirmed'],
  })
  @IsOptional()
  @IsEnum(['pending_review', 'confirmed'], { message: 'Invalid submission_status' })
  submission_status?: string;

  @ApiPropertyOptional({ description: 'Filter by purchasing user ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_user_id?: string;

  @ApiPropertyOptional({ description: 'Filter by purchasing crew member ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_crew_member_id?: string;

  @ApiPropertyOptional({ description: 'Filter entries from this date (inclusive, YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date_from?: string;

  @ApiPropertyOptional({ description: 'Filter entries to this date (inclusive, YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  date_to?: string;

  @ApiPropertyOptional({ description: 'Filter entries with/without receipt' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  has_receipt?: boolean;

  @ApiPropertyOptional({ description: 'Filter recurring instances' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_recurring_instance?: boolean;

  @ApiPropertyOptional({ description: 'Search in vendor_name and notes fields' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Page number', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['entry_date', 'amount', 'created_at'],
    default: 'entry_date',
  })
  @IsOptional()
  @IsEnum(['entry_date', 'amount', 'created_at'], { message: 'Invalid sort_by value' })
  sort_by?: string = 'entry_date';

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsEnum(['asc', 'desc'], { message: 'Invalid sort_order value' })
  sort_order?: string = 'desc';
}
