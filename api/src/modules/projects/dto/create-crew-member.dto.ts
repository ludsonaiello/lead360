import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsNumber,
  IsEnum,
  IsInt,
  MaxLength,
  MinLength,
  Length,
  Min,
  Max,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum PaymentMethod {
  CASH = 'cash',
  CHECK = 'check',
  BANK_TRANSFER = 'bank_transfer',
  VENMO = 'venmo',
  ZELLE = 'zelle',
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  ACH = 'ACH',
}

export class CreateCrewMemberDto {
  @ApiProperty({ description: 'First name', example: 'John', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  first_name: string;

  @ApiProperty({ description: 'Last name', example: 'Doe', maxLength: 100 })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  last_name: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: 'Phone number', example: '9781234567' })
  @IsString()
  @MaxLength(20)
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({
    description: 'Street address line 1',
    example: '123 Main St',
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  address_line1?: string;

  @ApiPropertyOptional({
    description: 'Street address line 2',
    example: 'Apt 4B',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  address_line2?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Boston' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  address_city?: string;

  @ApiPropertyOptional({
    description: 'State (2 chars, uppercase)',
    example: 'MA',
  })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, {
    message: 'address_state must be exactly 2 uppercase letters',
  })
  @IsOptional()
  address_state?: string;

  @ApiPropertyOptional({ description: 'ZIP code', example: '02101' })
  @IsString()
  @MaxLength(10)
  @IsOptional()
  address_zip?: string;

  @ApiPropertyOptional({
    description: 'Date of birth (ISO date)',
    example: '1990-01-15',
  })
  @IsDateString()
  @IsOptional()
  date_of_birth?: string;

  @ApiPropertyOptional({
    description: 'SSN in plain text (XXX-XX-XXXX or XXXXXXXXX). Encrypted before storage.',
    example: '123-45-6789',
  })
  @IsString()
  @Matches(/^\d{3}-?\d{2}-?\d{4}$/, {
    message: 'ssn must be in format XXX-XX-XXXX or XXXXXXXXX',
  })
  @IsOptional()
  ssn?: string;

  @ApiPropertyOptional({
    description: 'ITIN in plain text (XXX-XX-XXXX or XXXXXXXXX). Encrypted before storage.',
    example: '900-70-1234',
  })
  @IsString()
  @Matches(/^\d{3}-?\d{2}-?\d{4}$/, {
    message: 'itin must be in format XXX-XX-XXXX or XXXXXXXXX',
  })
  @IsOptional()
  itin?: string;

  @ApiPropertyOptional({ description: 'Has drivers license', example: true })
  @IsBoolean()
  @IsOptional()
  has_drivers_license?: boolean;

  @ApiPropertyOptional({
    description: 'Drivers license number in plain text. Encrypted before storage.',
    example: 'S12345678',
  })
  @IsString()
  @IsOptional()
  drivers_license_number?: string;

  @ApiPropertyOptional({
    description: 'Default hourly rate (must be > 0)',
    example: 25.0,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @IsOptional()
  default_hourly_rate?: number;

  @ApiPropertyOptional({
    description: 'Weekly hours schedule (1-168)',
    example: 40,
  })
  @IsInt()
  @Min(1)
  @Max(168)
  @IsOptional()
  weekly_hours_schedule?: number;

  @ApiPropertyOptional({
    description: 'Whether overtime is enabled',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  overtime_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Overtime rate multiplier (must be > 1)',
    example: 1.5,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1.01)
  @IsOptional()
  overtime_rate_multiplier?: number;

  @ApiPropertyOptional({
    description: 'Default payment method',
    enum: PaymentMethod,
    example: PaymentMethod.BANK_TRANSFER,
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  default_payment_method?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'Bank of America',
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  bank_name?: string;

  @ApiPropertyOptional({
    description: 'Bank routing number in plain text. Encrypted before storage.',
    example: '021000021',
  })
  @IsString()
  @IsOptional()
  bank_routing_number?: string;

  @ApiPropertyOptional({
    description: 'Bank account number in plain text. Encrypted before storage.',
    example: '123456789012',
  })
  @IsString()
  @IsOptional()
  bank_account_number?: string;

  @ApiPropertyOptional({ description: 'Venmo handle', example: '@johndoe' })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  venmo_handle?: string;

  @ApiPropertyOptional({
    description: 'Zelle contact',
    example: 'john@email.com',
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  zelle_contact?: string;

  @ApiPropertyOptional({ description: 'Notes', example: 'Experienced framer' })
  @IsString()
  @IsOptional()
  notes?: string;
}
