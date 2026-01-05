import {
  IsString,
  IsEmail,
  IsOptional,
  Length,
  Matches,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsNotIn,
  ValidateIf,
  IsNumber,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SanitizePhone,
  SanitizeEIN,
  ToUpperCase,
  ToLowerCase,
  SanitizeDate,
} from '../../../common/validators/formatted-inputs';

export enum BusinessEntityType {
  SOLE_PROPRIETORSHIP = 'sole_proprietorship',
  LLC = 'llc',
  CORPORATION = 'corporation',
  S_CORPORATION = 's-corporation',
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
  @ToLowerCase()
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
  @ToUpperCase()
  @Matches(/^[A-Z]{2}$/, { message: 'Must be a valid 2-letter state code' })
  state_of_registration: string;

  @ApiPropertyOptional({
    description: 'Date of incorporation (accepts YYYY-MM-DD or ISO-8601)',
    example: '2020-01-15',
  })
  @SanitizeDate()
  @IsDateString()
  @IsOptional()
  date_of_incorporation?: string;

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

  @ApiPropertyOptional({
    description: 'State tax ID',
    example: 'ST-123456',
  })
  @IsOptional()
  @ValidateIf((o) => o.state_tax_id !== null && o.state_tax_id !== '')
  @IsString()
  @Length(1, 50)
  state_tax_id?: string;

  @ApiPropertyOptional({
    description: 'Sales tax permit number',
    example: 'STP-789012',
  })
  @IsOptional()
  @ValidateIf((o) => o.sales_tax_permit !== null && o.sales_tax_permit !== '')
  @IsString()
  @Length(1, 50)
  sales_tax_permit?: string;

  @ApiPropertyOptional({
    description: 'Country code (3-letter ISO code)',
    example: 'USA',
    default: 'USA',
  })
  @IsString()
  @IsOptional()
  @Length(3, 3)
  country?: string;

  // CONTACT INFORMATION
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

  @ApiPropertyOptional({
    description: 'Secondary phone (accepts any format, stores as 10 digits only)',
    example: '5559876543',
  })
  @IsString()
  @IsOptional()
  @SanitizePhone()
  @Matches(/^\d{10}$/, {
    message: 'Phone must be 10 digits',
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

  // FINANCIAL & PAYMENT INFORMATION
  @ApiPropertyOptional({
    description: 'Bank name',
    example: 'Wells Fargo',
  })
  @IsOptional()
  @ValidateIf((o) => o.bank_name !== null && o.bank_name !== '')
  @IsString()
  @Length(1, 100)
  bank_name?: string;

  @ApiPropertyOptional({
    description: 'Bank routing number (9 digits, accepts any format)',
    example: '123456789',
  })
  @IsString()
  @IsOptional()
  routing_number?: string;

  @ApiPropertyOptional({
    description: 'Bank account number (accepts any format)',
    example: '123456789012',
  })
  @IsString()
  @IsOptional()
  account_number?: string;

  @ApiPropertyOptional({
    description: 'Account type',
    example: 'checking',
    enum: ['checking', 'savings'],
  })
  @IsString()
  @IsOptional()
  account_type?: string;

  @ApiPropertyOptional({
    description: 'Venmo username',
    example: '@acmeroofing',
  })
  @IsOptional()
  @ValidateIf((o) => o.venmo_username !== null && o.venmo_username !== '')
  @IsString()
  @Length(1, 50)
  venmo_username?: string;

  @ApiPropertyOptional({
    description: 'Venmo QR code file ID',
    example: 'file_abc123',
  })
  @IsString()
  @IsOptional()
  venmo_qr_code_file_id?: string;

  // BRANDING
  @ApiPropertyOptional({
    description: 'Logo file ID',
    example: 'file_logo123',
  })
  @IsString()
  @IsOptional()
  logo_file_id?: string;

  @ApiPropertyOptional({
    description: 'Primary brand color (hex)',
    example: '#FF5733',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid hex color (#RRGGBB)' })
  primary_brand_color?: string;

  @ApiPropertyOptional({
    description: 'Secondary brand color (hex)',
    example: '#33FF57',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid hex color (#RRGGBB)' })
  secondary_brand_color?: string;

  @ApiPropertyOptional({
    description: 'Accent color (hex)',
    example: '#5733FF',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Must be a valid hex color (#RRGGBB)' })
  accent_color?: string;

  // INVOICE & QUOTE SETTINGS
  @ApiPropertyOptional({
    description: 'Invoice number prefix',
    example: 'INV',
    default: 'INV',
  })
  @IsOptional()
  @ValidateIf((o) => o.invoice_prefix !== null && o.invoice_prefix !== '')
  @IsString()
  @Length(1, 10)
  invoice_prefix?: string;

  @ApiPropertyOptional({
    description: 'Next invoice number',
    example: 1001,
    default: 1,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  next_invoice_number?: number;

  @ApiPropertyOptional({
    description: 'Quote number prefix',
    example: 'Q-',
    default: 'Q-',
  })
  @IsOptional()
  @ValidateIf((o) => o.quote_prefix !== null && o.quote_prefix !== '')
  @IsString()
  @Length(1, 10)
  quote_prefix?: string;

  @ApiPropertyOptional({
    description: 'Next quote number',
    example: 1001,
    default: 1,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  next_quote_number?: number;

  @ApiPropertyOptional({
    description: 'Default quote validity days',
    example: 30,
    default: 30,
  })
  @IsInt()
  @IsOptional()
  @Min(1)
  default_quote_validity_days?: number;

  @ApiPropertyOptional({
    description: 'Default quote terms',
    example: 'Payment due upon acceptance',
  })
  @IsString()
  @IsOptional()
  default_quote_terms?: string;

  @ApiPropertyOptional({
    description: 'Default quote footer text',
    example: 'Thank you for your business!',
  })
  @IsString()
  @IsOptional()
  default_quote_footer?: string;

  @ApiPropertyOptional({
    description: 'Default invoice footer text',
    example: 'Thank you for your business!',
  })
  @IsString()
  @IsOptional()
  default_invoice_footer?: string;

  @ApiPropertyOptional({
    description: 'Default payment instructions',
    example: 'Please make checks payable to ACME Roofing LLC',
  })
  @IsString()
  @IsOptional()
  default_payment_instructions?: string;

  // BUSINESS SETTINGS
  @ApiPropertyOptional({
    description: 'Sales tax rate (percentage)',
    example: 6.25,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(99.999)
  sales_tax_rate?: number;

  @ApiPropertyOptional({
    description: 'Array of service IDs to assign to tenant',
    example: ['uuid-1', 'uuid-2'],
    type: [String],
  })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  @ArrayMinSize(0)
  @ArrayMaxSize(50)
  services_offered?: string[];

  @ApiPropertyOptional({
    description: 'Default profit margin (percentage) for quotes',
    example: 15.0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(999.99)
  default_profit_margin?: number;

  @ApiPropertyOptional({
    description: 'Default overhead rate (percentage) for quotes',
    example: 12.5,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(999.99)
  default_overhead_rate?: number;

  @ApiPropertyOptional({
    description: 'Default contingency rate (percentage) for quotes',
    example: 5.0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(999.99)
  default_contingency_rate?: number;
}
