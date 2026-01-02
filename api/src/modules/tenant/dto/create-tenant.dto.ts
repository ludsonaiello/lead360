import {
  IsString,
  IsEmail,
  IsOptional,
  Length,
  Matches,
  IsEnum,
  IsInt,
  Min,
  IsDateString,
  IsNotIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum BusinessEntityType {
  SOLE_PROPRIETORSHIP = 'sole_proprietorship',
  LLC = 'llc',
  CORPORATION = 'corporation',
  PARTNERSHIP = 'partnership',
  DBA = 'dba',
}

const RESERVED_SUBDOMAINS = [
  'www',
  'app',
  'api',
  'admin',
  'mail',
  'ftp',
  'smtp',
  'pop',
  'imap',
];

export class CreateTenantDto {
  // SUBDOMAIN & COMPANY
  @ApiProperty({
    description: 'Unique subdomain for the tenant',
    example: 'acme-roofing',
    pattern: '^[a-z0-9]([a-z0-9-]*[a-z0-9])?$',
  })
  @IsString()
  @Length(3, 63)
  @Matches(/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/, {
    message:
      'Subdomain must be 3-63 characters, lowercase alphanumeric with hyphens, cannot start/end with hyphen',
  })
  @IsNotIn(RESERVED_SUBDOMAINS, {
    message: 'This subdomain is reserved and cannot be used',
  })
  @Transform(({ value }) => value?.toLowerCase())
  subdomain: string;

  @ApiProperty({
    description: 'Company name for display',
    example: 'ACME Roofing LLC',
  })
  @IsString()
  @Length(2, 200)
  company_name: string;

  // LEGAL & TAX
  @ApiProperty({
    description: 'Official legal business name',
    example: 'ACME Roofing LLC',
  })
  @IsString()
  @Length(2, 200)
  legal_business_name: string;

  @ApiPropertyOptional({
    description: 'Doing Business As (DBA) name',
    example: 'ACME Roofing Solutions',
  })
  @IsString()
  @IsOptional()
  @Length(2, 200)
  dba_name?: string;

  @ApiProperty({
    description: 'Business entity type',
    enum: BusinessEntityType,
    example: BusinessEntityType.LLC,
  })
  @IsEnum(BusinessEntityType)
  business_entity_type: BusinessEntityType;

  @ApiProperty({
    description: 'State of registration (2-letter code)',
    example: 'CA',
  })
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'Must be a valid 2-letter state code' })
  @Transform(({ value }) => value?.toUpperCase())
  state_of_registration: string;

  @ApiPropertyOptional({
    description: 'Date of incorporation',
    example: '2020-01-15',
  })
  @IsDateString()
  @IsOptional()
  date_of_incorporation?: string;

  @ApiProperty({
    description: 'Employer Identification Number (EIN) in format XX-XXXXXXX',
    example: '12-3456789',
  })
  @IsString()
  @Matches(/^\d{2}-\d{7}$/, {
    message: 'EIN must be in format XX-XXXXXXX (9 digits)',
  })
  @Transform(({ value }) => {
    // Auto-format if user enters 9 digits without hyphen
    if (/^\d{9}$/.test(value)) {
      return `${value.slice(0, 2)}-${value.slice(2)}`;
    }
    return value;
  })
  ein: string;

  @ApiPropertyOptional({
    description: 'State tax ID',
    example: 'ST-123456',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  state_tax_id?: string;

  @ApiPropertyOptional({
    description: 'Sales tax permit number',
    example: 'STP-789012',
  })
  @IsString()
  @IsOptional()
  @Length(1, 50)
  sales_tax_permit?: string;

  // CONTACT INFORMATION
  @ApiProperty({
    description: 'Primary contact phone (10 digits)',
    example: '5551234567',
  })
  @IsString()
  @Matches(/^\d{10}$/, {
    message: 'Phone must be 10 digits (no formatting)',
  })
  primary_contact_phone: string;

  @ApiPropertyOptional({
    description: 'Secondary phone (10 digits)',
    example: '5559876543',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{10}$/, {
    message: 'Phone must be 10 digits (no formatting)',
  })
  secondary_phone?: string;

  @ApiProperty({
    description: 'Primary contact email',
    example: 'contact@acmeroofing.com',
  })
  @IsEmail()
  primary_contact_email: string;

  @ApiPropertyOptional({
    description: 'Support email',
    example: 'support@acmeroofing.com',
  })
  @IsEmail()
  @IsOptional()
  support_email?: string;

  @ApiPropertyOptional({
    description: 'Billing email',
    example: 'billing@acmeroofing.com',
  })
  @IsEmail()
  @IsOptional()
  billing_email?: string;

  @ApiPropertyOptional({
    description: 'Website URL',
    example: 'https://acmeroofing.com',
  })
  @IsString()
  @IsOptional()
  @Matches(/^https?:\/\/.+/, { message: 'Must be a valid HTTP/HTTPS URL' })
  website_url?: string;

  @ApiPropertyOptional({
    description: 'Instagram URL',
    example: 'https://instagram.com/acmeroofing',
  })
  @IsString()
  @IsOptional()
  @Matches(/^https?:\/\/.+/, { message: 'Must be a valid HTTP/HTTPS URL' })
  instagram_url?: string;

  @ApiPropertyOptional({
    description: 'Facebook URL',
    example: 'https://facebook.com/acmeroofing',
  })
  @IsString()
  @IsOptional()
  @Matches(/^https?:\/\/.+/, { message: 'Must be a valid HTTP/HTTPS URL' })
  facebook_url?: string;

  @ApiPropertyOptional({
    description: 'TikTok URL',
    example: 'https://tiktok.com/@acmeroofing',
  })
  @IsString()
  @IsOptional()
  @Matches(/^https?:\/\/.+/, { message: 'Must be a valid HTTP/HTTPS URL' })
  tiktok_url?: string;

  @ApiPropertyOptional({
    description: 'YouTube URL',
    example: 'https://youtube.com/acmeroofing',
  })
  @IsString()
  @IsOptional()
  @Matches(/^https?:\/\/.+/, { message: 'Must be a valid HTTP/HTTPS URL' })
  youtube_url?: string;

  // OPERATIONAL
  @ApiPropertyOptional({
    description: 'Timezone',
    example: 'America/New_York',
    default: 'America/New_York',
  })
  @IsString()
  @IsOptional()
  timezone?: string;
}
