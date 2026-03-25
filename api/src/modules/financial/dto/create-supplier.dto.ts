import {
  IsString,
  IsOptional,
  IsBoolean,
  IsArray,
  IsUUID,
  IsEmail,
  IsNumber,
  Length,
  MaxLength,
  Matches,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSupplierDto {
  @ApiProperty({
    description: 'Business name (unique per tenant)',
    example: 'ABC Building Supply',
    maxLength: 200,
  })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiPropertyOptional({
    description: 'Legal entity name if different from business name',
    example: 'ABC Building Supply LLC',
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  legal_name?: string;

  @ApiPropertyOptional({
    description: 'Supplier website URL',
    example: 'https://www.abcbuildingsupply.com',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  website?: string;

  @ApiPropertyOptional({
    description: 'Primary contact phone number',
    example: '5551234567',
    maxLength: 20,
  })
  @IsString()
  @IsOptional()
  @MaxLength(20)
  phone?: string;

  @ApiPropertyOptional({
    description: 'Primary contact email address',
    example: 'orders@abcsupply.com',
  })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({
    description: 'Primary contact person name',
    example: 'John Smith',
    maxLength: 150,
  })
  @IsString()
  @IsOptional()
  @MaxLength(150)
  contact_name?: string;

  @ApiPropertyOptional({
    description: 'Street address line 1',
    example: '123 Industrial Blvd',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  address_line1?: string;

  @ApiPropertyOptional({
    description: 'Address line 2 (suite, unit, etc.)',
    example: 'Building B',
    maxLength: 255,
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional({
    description: 'City',
    example: 'Houston',
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: '2-letter US state code',
    example: 'TX',
  })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'State must be a 2-letter uppercase code' })
  state?: string;

  @ApiPropertyOptional({
    description: 'ZIP code (5 or 9 digits)',
    example: '77001',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{5}(-\d{4})?$/, { message: 'Invalid ZIP code format' })
  zip_code?: string;

  @ApiPropertyOptional({
    description: 'ISO 2-letter country code',
    example: 'US',
    default: 'US',
  })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  country?: string;

  @ApiPropertyOptional({
    description: 'Latitude for map display (from Google Places or manual entry)',
    example: 29.7604,
  })
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({
    description: 'Longitude for map display (from Google Places or manual entry)',
    example: -95.3698,
  })
  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Google Place ID — when provided, triggers address auto-fill from Google Places API',
    example: 'ChIJAYWNSLS4QIYROwVl894CDco',
  })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  google_place_id?: string;

  @ApiPropertyOptional({
    description: 'Internal notes about this supplier',
    example: 'Preferred vendor for bulk lumber orders. Net 30 terms.',
  })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Mark as preferred supplier for UI highlighting',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_preferred?: boolean;

  @ApiPropertyOptional({
    description: 'Array of supplier_category UUIDs to assign to this supplier',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    type: [String],
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  category_ids?: string[];
}
