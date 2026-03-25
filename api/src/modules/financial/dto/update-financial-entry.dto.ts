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
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Update DTO for financial entries.
 *
 * NOT editable: project_id, task_id, submission_status, is_recurring_instance,
 * recurring_rule_id, created_by_user_id. Use approve/reject endpoints for status changes.
 */
export class UpdateFinancialEntryDto {
  @ApiPropertyOptional({ description: 'Financial category ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Entry type',
    enum: ['expense', 'income'],
  })
  @IsOptional()
  @IsEnum(['expense', 'income'], { message: 'entry_type must be expense or income' })
  entry_type?: string;

  @ApiPropertyOptional({
    description: 'Entry amount (must be > 0)',
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Tax amount must be 0 or greater' })
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Entry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  entry_date?: string;

  @ApiPropertyOptional({ description: 'Entry time (HH:MM:SS)' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  entry_time?: string;

  @ApiPropertyOptional({ description: 'Vendor name (max 200 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({ description: 'Supplier ID (set to null to unlink)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  supplier_id?: string | null;

  @ApiPropertyOptional({
    description: 'Payment method enum',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], {
    message: 'Invalid payment method',
  })
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Payment method registry ID (set to null to unlink)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  payment_method_registry_id?: string | null;

  @ApiPropertyOptional({ description: 'User who made the purchase (set to null to unlink)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_user_id?: string | null;

  @ApiPropertyOptional({ description: 'Crew member who made the purchase (set to null to unlink)' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_crew_member_id?: string | null;

  @ApiPropertyOptional({ description: 'Additional notes (max 2000 chars)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
