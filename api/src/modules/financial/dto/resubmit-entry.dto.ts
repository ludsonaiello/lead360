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
 * Resubmit DTO — optional field updates applied before clearing rejection.
 * Same editable fields as UpdateFinancialEntryDto.
 */
export class ResubmitEntryDto {
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

  @ApiPropertyOptional({ description: 'Entry amount (must be > 0)' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: 'Amount must be greater than 0' })
  amount?: number;

  @ApiPropertyOptional({ description: 'Tax amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Tax amount must be 0 or greater' })
  tax_amount?: number;

  @ApiPropertyOptional({ description: 'Discount amount' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: 'Discount must be 0 or greater' })
  discount?: number;

  @ApiPropertyOptional({ description: 'Entry date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  entry_date?: string;

  @ApiPropertyOptional({ description: 'Entry time (HH:MM:SS)' })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  entry_time?: string;

  @ApiPropertyOptional({ description: 'Vendor name' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  vendor_name?: string;

  @ApiPropertyOptional({ description: 'Supplier ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  supplier_id?: string | null;

  @ApiPropertyOptional({
    description: 'Payment method',
    enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'],
  })
  @IsOptional()
  @IsEnum(['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'])
  payment_method?: string;

  @ApiPropertyOptional({ description: 'Payment method registry ID' })
  @IsOptional()
  @IsString()
  @IsUUID()
  payment_method_registry_id?: string | null;

  @ApiPropertyOptional({ description: 'User who made the purchase' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_user_id?: string | null;

  @ApiPropertyOptional({ description: 'Crew member who made the purchase' })
  @IsOptional()
  @IsString()
  @IsUUID()
  purchased_by_crew_member_id?: string | null;

  @ApiPropertyOptional({ description: 'Additional notes' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
