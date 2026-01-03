import {
  IsEmail,
  IsString,
  IsOptional,
  IsObject,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SanitizePhone,
  SanitizeEIN,
  ToLowerCase,
  ToUpperCase,
} from '../../../common/validators/formatted-inputs';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address (will be normalized to lowercase)',
    example: 'john@example.com',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @ToLowerCase()
  @Transform(({ value }) => value?.trim())
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description:
      'Password (min 8 chars, must contain uppercase, lowercase, and special character)',
    example: 'MySecure@Pass123',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must be at most 72 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, and one special character',
    },
  )
  password: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(100, { message: 'First name must be at most 100 characters' })
  @Transform(({ value }) => value?.trim())
  first_name: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(100, { message: 'Last name must be at most 100 characters' })
  @Transform(({ value }) => value?.trim())
  last_name: string;

  @ApiPropertyOptional({
    description: 'User phone number (accepts any format, stores as 10 digits only)',
    example: '5551234567',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @SanitizePhone()
  @Matches(/^\d{10}$/, {
    message: 'Phone must be 10 digits',
  })
  phone?: string;

  @ApiProperty({
    description:
      'Tenant subdomain (3-63 chars, alphanumeric and hyphens, lowercase)',
    example: 'acme-roofing',
    minLength: 3,
    maxLength: 63,
  })
  @IsString()
  @MinLength(3, { message: 'Subdomain must be at least 3 characters' })
  @MaxLength(63, { message: 'Subdomain must be at most 63 characters' })
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, {
    message:
      'Subdomain must be lowercase, alphanumeric with hyphens (not at start or end)',
  })
  @ToLowerCase()
  @Transform(({ value }) => value?.trim())
  tenant_subdomain: string;

  @ApiProperty({
    description: 'Company name for the tenant',
    example: 'Acme Roofing LLC',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2, { message: 'Company name must be at least 2 characters' })
  @MaxLength(200, { message: 'Company name must be at most 200 characters' })
  @Transform(({ value }) => value?.trim())
  company_name: string;

  @ApiProperty({
    description: 'Legal business name (official registered name)',
    example: 'Acme Roofing LLC',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2, { message: 'Legal business name must be at least 2 characters' })
  @MaxLength(200, { message: 'Legal business name must be at most 200 characters' })
  @Transform(({ value }) => value?.trim())
  legal_business_name: string;

  @ApiProperty({
    description: 'Business entity type',
    example: 'llc',
    enum: ['sole_proprietorship', 'llc', 'corporation', 'partnership', 'dba', 'other'],
  })
  @IsString()
  business_entity_type: string;

  @ApiProperty({
    description: 'State of registration (2-letter code)',
    example: 'CA',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(2)
  @ToUpperCase()
  @Matches(/^[A-Z]{2}$/, { message: 'Must be a valid 2-letter state code' })
  state_of_registration: string;

  @ApiProperty({
    description: 'Employer Identification Number (accepts any format, stores as XX-XXXXXXX)',
    example: '12-3456789',
  })
  @IsString()
  @SanitizeEIN()
  @Matches(/^\d{2}-\d{7}$/, {
    message: 'EIN must be in format XX-XXXXXXX (9 digits)',
  })
  ein: string;

  @ApiProperty({
    description: 'Primary contact phone (accepts any format, stores as 10 digits only)',
    example: '5551234567',
  })
  @IsString()
  @SanitizePhone()
  @Matches(/^\d{10}$/, {
    message: 'Phone must be 10 digits',
  })
  primary_contact_phone: string;

  @ApiProperty({
    description: 'Primary contact email',
    example: 'contact@acmeroofing.com',
  })
  @IsEmail()
  primary_contact_email: string;

  @ApiPropertyOptional({
    description: 'Business hours for the tenant (optional - defaults to Mon-Fri 9-5 if not provided)',
    example: {
      monday_closed: false,
      monday_open1: '08:00',
      monday_close1: '17:00',
      tuesday_closed: false,
      tuesday_open1: '08:00',
      tuesday_close1: '17:00',
    },
  })
  @IsOptional()
  @IsObject()
  business_hours?: Record<string, any>;
}
