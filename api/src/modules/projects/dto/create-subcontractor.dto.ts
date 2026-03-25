import {
  IsString,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsEnum,
  MaxLength,
  MinLength,
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

export class CreateSubcontractorDto {
  @ApiProperty({
    description: 'Business name',
    example: 'ABC Electrical',
    maxLength: 200,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  business_name: string;

  @ApiPropertyOptional({
    description: 'Trade specialty',
    example: 'Electrical',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  trade_specialty?: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'info@abc-electrical.com',
  })
  @IsEmail()
  @MaxLength(255)
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Website URL',
    example: 'https://abc-electrical.com',
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  website?: string;

  @ApiPropertyOptional({
    description: 'Insurance provider name',
    example: 'State Farm',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  insurance_provider?: string;

  @ApiPropertyOptional({
    description: 'Insurance policy number',
    example: 'POL-12345',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  insurance_policy_number?: string;

  @ApiPropertyOptional({
    description: 'Insurance expiry date (ISO date)',
    example: '2027-06-15',
  })
  @IsDateString()
  @IsOptional()
  insurance_expiry_date?: string;

  @ApiPropertyOptional({
    description: 'Certificate of Insurance on file',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  coi_on_file?: boolean;

  @ApiPropertyOptional({
    description: 'Default payment method',
    enum: PaymentMethod,
    example: PaymentMethod.CHECK,
  })
  @IsEnum(PaymentMethod)
  @IsOptional()
  default_payment_method?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'Chase',
    maxLength: 200,
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  bank_name?: string;

  @ApiPropertyOptional({
    description:
      'Bank routing number in plain text. Encrypted before storage.',
    example: '021000021',
  })
  @IsString()
  @IsOptional()
  bank_routing_number?: string;

  @ApiPropertyOptional({
    description:
      'Bank account number in plain text. Encrypted before storage.',
    example: '123456789012',
  })
  @IsString()
  @IsOptional()
  bank_account_number?: string;

  @ApiPropertyOptional({
    description: 'Venmo handle',
    example: '@abc-electrical',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  venmo_handle?: string;

  @ApiPropertyOptional({
    description: 'Zelle contact (email or phone)',
    example: 'pay@abc-electrical.com',
    maxLength: 100,
  })
  @IsString()
  @MaxLength(100)
  @IsOptional()
  zelle_contact?: string;

  @ApiPropertyOptional({
    description: 'General notes',
    example: 'Reliable electrician, available weekends',
  })
  @IsString()
  @IsOptional()
  notes?: string;
}
