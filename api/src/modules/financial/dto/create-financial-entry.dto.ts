import {
  IsString,
  IsOptional,
  IsUUID,
  IsNumber,
  IsDateString,
  IsEnum,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateFinancialEntryDto {
  @ApiPropertyOptional({
    description: 'Project ID (optional — omit for business-level overhead expenses)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Task ID (optional — requires project_id)',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  task_id?: string;

  @ApiProperty({
    description: 'Financial category ID (must belong to same tenant)',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  @IsString()
  @IsUUID()
  category_id: string;

  @ApiProperty({
    description: 'Entry type',
    enum: ['expense', 'income'],
    example: 'expense',
  })
  @IsEnum(['expense', 'income'], { message: 'entry_type must be expense or income' })
  entry_type: string;

  @ApiProperty({
    description: 'Entry amount (must be greater than 0)',
    example: 450.00,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount: number;

  @ApiPropertyOptional({
    description: 'Tax amount (must be less than amount)',
    example: 35.50,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Tax amount must be 0 or greater' })
  tax_amount?: number;

  @ApiPropertyOptional({
    description: 'Discount amount applied to the entry',
    example: 5.00,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Discount must be 0 or greater' })
  discount?: number;

  @ApiProperty({
    description: 'Entry date in YYYY-MM-DD format',
    example: '2026-03-10',
  })
  @IsDateString()
  entry_date: string;

  @ApiPropertyOptional({
    description: 'Entry time in HH:MM:SS format',
    example: '14:30:00',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  entry_time?: string;

  @ApiPropertyOptional({
    description: 'Vendor name (free-text fallback when no supplier selected)',
    example: 'Home Depot',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({
    description: 'Supplier ID (must belong to same tenant and be active)',
    example: '550e8400-e29b-41d4-a716-446655440005',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  supplier_id?: string;

  @ApiPropertyOptional({
    description: 'Payment method enum (ignored if payment_method_registry_id provided)',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'Invalid payment method',
  })
  payment_method?: string;

  @ApiPropertyOptional({
    description: 'Payment method registry ID (auto-copies type into payment_method)',
    example: '550e8400-e29b-41d4-a716-446655440006',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  payment_method_registry_id?: string;

  @ApiPropertyOptional({
    description: 'User who made the purchase (mutually exclusive with purchased_by_crew_member_id)',
    example: '550e8400-e29b-41d4-a716-446655440007',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_user_id?: string;

  @ApiPropertyOptional({
    description: 'Crew member who made the purchase (mutually exclusive with purchased_by_user_id)',
    example: '550e8400-e29b-41d4-a716-446655440008',
  })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_crew_member_id?: string;

  @ApiPropertyOptional({
    description: 'Submission status (Owner/Admin/Manager/Bookkeeper only — Employee value is overridden to pending_review)',
    enum: ['pending_review', 'confirmed'],
    default: 'confirmed',
  })
  @IsOptional()
  @IsEnum(['pending_review', 'confirmed'], {
    message: 'submission_status must be pending_review or confirmed',
  })
  submission_status?: string;

  @ApiPropertyOptional({
    description: 'Additional notes',
    example: '2x4 studs for framing',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
