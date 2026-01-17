import {
  IsString,
  IsEmail,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  Length,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { SanitizePhone, SanitizeDate, ToArray } from '../../../common/validators/formatted-inputs';

// ============================================
// ENUMS
// ============================================

export enum LeadStatus {
  LEAD = 'lead',
  PROSPECT = 'prospect',
  CUSTOMER = 'customer',
  LOST = 'lost',
}

export enum LeadSource {
  WEBSITE = 'website',
  REFERRAL = 'referral',
  PHONE_CALL = 'phone_call',
  WALK_IN = 'walk_in',
  SOCIAL_MEDIA = 'social_media',
  EMAIL = 'email',
  WEBHOOK = 'webhook',
  OTHER = 'other',
}

export enum PreferredCommunication {
  EMAIL = 'email',
  PHONE = 'phone',
  SMS = 'sms',
}

export enum EmailType {
  PERSONAL = 'personal',
  WORK = 'work',
  OTHER = 'other',
}

export enum PhoneType {
  MOBILE = 'mobile',
  HOME = 'home',
  WORK = 'work',
  OTHER = 'other',
}

export enum AddressType {
  SERVICE = 'service',
  BILLING = 'billing',
  MAILING = 'mailing',
  OTHER = 'other',
}

export enum ServiceUrgency {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  EMERGENCY = 'emergency',
}

export enum ServiceRequestStatus {
  PENDING = 'pending',
  SCHEDULED = 'scheduled',
  VISIT_SCHEDULED = 'visit_scheduled',
  QUOTE_GENERATED = 'quote_generated',
  QUOTE_SENT = 'quote_sent',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

// ============================================
// EMAIL DTOs
// ============================================

export class CreateEmailDto {
  @ApiProperty({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Email type',
    enum: EmailType,
    default: EmailType.PERSONAL,
  })
  @IsEnum(EmailType)
  @IsOptional()
  email_type?: EmailType;

  @ApiPropertyOptional({
    description: 'Is this the primary email',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

export class UpdateEmailDto extends PartialType(CreateEmailDto) {}

// ============================================
// PHONE DTOs
// ============================================

export class CreatePhoneDto {
  @ApiProperty({
    description: 'Phone number (10 digits, any format accepted)',
    example: '(555) 123-4567',
  })
  @IsString()
  @SanitizePhone()
  @Matches(/^\d{10}$/, {
    message: 'Phone must be 10 digits',
  })
  phone: string;

  @ApiPropertyOptional({
    description: 'Phone type',
    enum: PhoneType,
    default: PhoneType.MOBILE,
  })
  @IsEnum(PhoneType)
  @IsOptional()
  phone_type?: PhoneType;

  @ApiPropertyOptional({
    description: 'Is this the primary phone',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

export class UpdatePhoneDto extends PartialType(CreatePhoneDto) {}

// ============================================
// ADDRESS DTOs
// ============================================

export class CreateAddressDto {
  @ApiProperty({
    description: 'Street address line 1',
    example: '123 Main St',
  })
  @IsString()
  @Length(1, 255)
  address_line1: string;

  @ApiPropertyOptional({
    description: 'Street address line 2 (suite, apt, etc.)',
    example: 'Suite 100',
  })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  address_line2?: string;

  @ApiPropertyOptional({
    description: 'City (will be auto-filled if not provided)',
    example: 'Boston',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  city?: string;

  @ApiPropertyOptional({
    description: 'State (2-letter code, will be auto-filled if not provided)',
    example: 'MA',
  })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'Must be a valid 2-letter state code' })
  state?: string;

  @ApiProperty({
    description: 'ZIP code (5 or 9 digits)',
    example: '02101',
  })
  @IsString()
  @Length(5, 10)
  zip_code: string;

  @ApiPropertyOptional({
    description: 'Country code (2-letter ISO)',
    example: 'US',
    default: 'US',
  })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({
    description: 'Latitude (if known, saves Google Maps API call)',
    example: 42.3601,
  })
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude (if known, saves Google Maps API call)',
    example: -71.0589,
  })
  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Address type',
    enum: AddressType,
    default: AddressType.SERVICE,
  })
  @IsEnum(AddressType)
  @IsOptional()
  address_type?: AddressType;

  @ApiPropertyOptional({
    description: 'Is this the primary address for this type',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

export class UpdateAddressDto extends PartialType(CreateAddressDto) {}

// ============================================
// SERVICE REQUEST DTOs
// ============================================

export class CreateServiceRequestDto {
  @ApiProperty({
    description: 'Specific service/job title requested by customer',
    example: 'Fix bathroom sink',
  })
  @IsString()
  @Length(1, 100)
  service_name: string;

  @ApiPropertyOptional({
    description: 'Service category/trade type',
    example: 'Plumbing',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  service_type?: string;

  @ApiProperty({
    description: 'Detailed description of service needed',
    example: 'Leak in roof, water damage visible in ceiling',
  })
  @IsString()
  @Length(1, 2000)
  service_description: string;

  @ApiPropertyOptional({
    description: 'Requested service date',
    example: '2026-02-15',
  })
  @SanitizeDate()
  @IsDateString()
  @IsOptional()
  requested_date?: string;

  @ApiPropertyOptional({
    description: 'Service urgency level',
    enum: ServiceUrgency,
    default: ServiceUrgency.MEDIUM,
  })
  @IsEnum(ServiceUrgency)
  @IsOptional()
  urgency?: ServiceUrgency;

  @ApiPropertyOptional({
    description: 'Estimated service value (in USD)',
    example: 1500.0,
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(9999999.99)
  estimated_value?: number;

  @ApiPropertyOptional({
    description: 'Additional notes about the service request',
    example: 'Customer prefers morning appointments',
  })
  @IsString()
  @IsOptional()
  @Length(1, 2000)
  notes?: string;
}

export class UpdateServiceRequestDto extends PartialType(
  CreateServiceRequestDto,
) {
  @ApiPropertyOptional({
    description: 'Service request status',
    enum: ServiceRequestStatus,
  })
  @IsEnum(ServiceRequestStatus)
  @IsOptional()
  status?: ServiceRequestStatus;
}

// ============================================
// NOTE DTOs
// ============================================

export class CreateNoteDto {
  @ApiProperty({
    description: 'Note text content',
    example: 'Customer called to ask about pricing',
  })
  @IsString()
  @Length(1, 5000)
  note_text: string;

  @ApiPropertyOptional({
    description: 'Pin this note to the top',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_pinned?: boolean;
}

export class UpdateNoteDto extends PartialType(CreateNoteDto) {}

// ============================================
// LEAD DTOs
// ============================================

export class CreateLeadDto {
  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @Length(1, 100)
  first_name: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  @Length(1, 100)
  last_name: string;

  @ApiPropertyOptional({
    description: 'Language spoken (2-letter ISO code)',
    example: 'EN',
    default: 'EN',
  })
  @IsString()
  @IsOptional()
  @Length(2, 10)
  language_spoken?: string;

  @ApiPropertyOptional({
    description: 'Customer accepts SMS messages',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  accept_sms?: boolean;

  @ApiPropertyOptional({
    description: 'Preferred communication method',
    enum: PreferredCommunication,
    default: PreferredCommunication.EMAIL,
  })
  @IsEnum(PreferredCommunication)
  @IsOptional()
  preferred_communication?: PreferredCommunication;

  @ApiProperty({
    description: 'Lead source',
    enum: LeadSource,
    example: LeadSource.WEBSITE,
  })
  @IsEnum(LeadSource)
  source: LeadSource;

  @ApiPropertyOptional({
    description: 'External source identifier (for deduplication)',
    example: 'webhook_12345',
  })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  external_source_id?: string;

  @ApiProperty({
    description: 'Email addresses (at least 1 email OR 1 phone required)',
    type: [CreateEmailDto],
    example: [{ email: 'john.doe@example.com', email_type: 'personal', is_primary: true }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEmailDto)
  emails: CreateEmailDto[];

  @ApiProperty({
    description: 'Phone numbers (at least 1 email OR 1 phone required)',
    type: [CreatePhoneDto],
    example: [{ phone: '5551234567', phone_type: 'mobile', is_primary: true }],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePhoneDto)
  phones: CreatePhoneDto[];

  @ApiProperty({
    description: 'Addresses (at least 1 required, Google Maps validated)',
    type: [CreateAddressDto],
    example: [
      {
        address_line1: '123 Main St',
        zip_code: '02101',
        city: 'Boston',
        state: 'MA',
        address_type: 'service',
        is_primary: true,
      },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddressDto)
  @ArrayMinSize(1, { message: 'At least one address is required' })
  addresses: CreateAddressDto[];

  @ApiPropertyOptional({
    description: 'Service request details (optional)',
    type: CreateServiceRequestDto,
  })
  @ValidateNested()
  @Type(() => CreateServiceRequestDto)
  @IsOptional()
  service_request?: CreateServiceRequestDto;
}

export class UpdateLeadDto {
  @ApiPropertyOptional({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  first_name?: string;

  @ApiPropertyOptional({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  last_name?: string;

  @ApiPropertyOptional({
    description: 'Language spoken (2-letter ISO code)',
    example: 'EN',
  })
  @IsString()
  @IsOptional()
  @Length(2, 10)
  language_spoken?: string;

  @ApiPropertyOptional({
    description: 'Customer accepts SMS messages',
  })
  @IsBoolean()
  @IsOptional()
  accept_sms?: boolean;

  @ApiPropertyOptional({
    description: 'Preferred communication method',
    enum: PreferredCommunication,
  })
  @IsEnum(PreferredCommunication)
  @IsOptional()
  preferred_communication?: PreferredCommunication;
}

export class UpdateStatusDto {
  @ApiProperty({
    description: 'New lead status',
    enum: LeadStatus,
    example: LeadStatus.PROSPECT,
  })
  @IsEnum(LeadStatus)
  status: LeadStatus;

  @ApiPropertyOptional({
    description: 'Reason for marking as lost (required if status is "lost")',
    example: 'Customer went with competitor',
  })
  @IsString()
  @IsOptional()
  @Length(1, 500)
  lost_reason?: string;
}

export class ListLeadsDto {
  @ApiPropertyOptional({
    description: 'Page number (1-indexed)',
    example: 1,
    default: 1,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page (max 100)',
    example: 50,
    default: 50,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Filter by status (comma-separated for multiple)',
    enum: LeadStatus,
    isArray: true,
    example: 'lead,prospect',
  })
  @ToArray()
  @IsEnum(LeadStatus, { each: true })
  @IsOptional()
  status?: LeadStatus[];

  @ApiPropertyOptional({
    description: 'Filter by source (comma-separated for multiple)',
    enum: LeadSource,
    isArray: true,
    example: 'website,referral',
  })
  @ToArray()
  @IsEnum(LeadSource, { each: true })
  @IsOptional()
  source?: LeadSource[];

  @ApiPropertyOptional({
    description: 'Search by name, email, or phone',
    example: 'john',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter leads created after this date (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @SanitizeDate()
  @IsDateString()
  @IsOptional()
  created_after?: string;

  @ApiPropertyOptional({
    description: 'Filter leads created before this date (YYYY-MM-DD)',
    example: '2026-01-31',
  })
  @SanitizeDate()
  @IsDateString()
  @IsOptional()
  created_before?: string;

  @ApiPropertyOptional({
    description: 'Sort field',
    enum: ['name', 'city', 'state', 'status', 'source', 'created_at'],
    example: 'created_at',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['name', 'city', 'state', 'status', 'source', 'created_at'])
  sort_by?: string;

  @ApiPropertyOptional({
    description: 'Sort order',
    enum: ['asc', 'desc'],
    example: 'desc',
    default: 'desc',
  })
  @IsString()
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort_order?: 'asc' | 'desc';

  @ApiPropertyOptional({
    description: 'Filter by email address',
    example: 'john@example.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;
}

// ============================================
// WEBHOOK DTOs
// ============================================

export class WebhookLeadDto {
  @ApiProperty({
    description: 'First name',
    example: 'John',
  })
  @IsString()
  @Length(1, 100)
  first_name: string;

  @ApiProperty({
    description: 'Last name',
    example: 'Doe',
  })
  @IsString()
  @Length(1, 100)
  last_name: string;

  @ApiPropertyOptional({
    description: 'Email address',
    example: 'john.doe@example.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Phone number (10 digits, any format accepted)',
    example: '(555) 123-4567',
  })
  @IsString()
  @IsOptional()
  @SanitizePhone()
  @Matches(/^\d{10}$/, {
    message: 'Phone must be 10 digits',
  })
  phone?: string;

  @ApiProperty({
    description: 'Street address',
    example: '123 Main St',
  })
  @IsString()
  @Length(1, 255)
  address_line1: string;

  @ApiPropertyOptional({
    description: 'Address line 2',
    example: 'Suite 100',
  })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  address_line2?: string;

  @ApiPropertyOptional({
    description: 'City (auto-filled if not provided)',
    example: 'Boston',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  city?: string;

  @ApiPropertyOptional({
    description: 'State (auto-filled if not provided)',
    example: 'MA',
  })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  state?: string;

  @ApiProperty({
    description: 'ZIP code',
    example: '02101',
  })
  @IsString()
  @Length(5, 10)
  zip_code: string;

  @ApiPropertyOptional({
    description: 'Service type requested',
    example: 'Roof Repair',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  service_type?: string;

  @ApiPropertyOptional({
    description: 'Service description',
    example: 'Leak in roof',
  })
  @IsString()
  @IsOptional()
  @Length(1, 2000)
  service_description?: string;

  @ApiPropertyOptional({
    description: 'External source identifier (for deduplication)',
    example: 'form_submission_12345',
  })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  external_source_id?: string;
}
