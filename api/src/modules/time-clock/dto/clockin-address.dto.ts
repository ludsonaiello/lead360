import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsUUID,
  MinLength,
  MaxLength,
  Min,
  Max,
  IsNumber,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class CreateClockinAddressDto {
  @ApiProperty({
    description: 'Human-readable label for this address',
    example: 'Main Office',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @ApiProperty({
    description: 'Street address line 1',
    example: '123 Main St',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address_line1: string;

  @ApiPropertyOptional({
    description: 'Street address line 2 (apt, suite, etc.)',
    example: 'Suite 200',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Austin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'US state abbreviation (2 characters)',
    example: 'TX',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiProperty({ description: 'ZIP code', example: '78701' })
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  zip_code: string;

  @ApiPropertyOptional({
    description:
      'Latitude override (skip geocoding if provided with longitude)',
  })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({
    description:
      'Longitude override (skip geocoding if provided with latitude)',
  })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({
    description: 'Geofence radius in meters (default: 100)',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;

  @ApiPropertyOptional({ description: 'Link to a project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;
}

export class UpdateClockinAddressDto {
  @ApiPropertyOptional({
    description: 'Human-readable label',
    example: 'Main Office',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label?: string;

  @ApiPropertyOptional({
    description: 'Street address line 1',
    example: '123 Main St',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  address_line1?: string;

  @ApiPropertyOptional({
    description: 'Street address line 2',
    example: 'Suite 200',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Austin' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    description: 'US state abbreviation',
    example: 'TX',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  state?: string;

  @ApiPropertyOptional({ description: 'ZIP code', example: '78701' })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  zip_code?: string;

  @ApiPropertyOptional({
    description: 'Geofence radius in meters',
    example: 150,
  })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;

  @ApiPropertyOptional({ description: 'Whether this address is active' })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Link to a project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;
}

export class ListClockinAddressesDto {
  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Items per page', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: 'Filter by active status' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Filter by project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({ description: 'Search by label (contains match)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}

export class ImportAddressFromQuoteDto {
  @ApiProperty({ description: 'Quote ID to import jobsite address from' })
  @IsUUID()
  quote_id: string;

  @ApiProperty({
    description: 'Human-readable label for the imported address',
    example: 'Quote #1042 Jobsite',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @ApiPropertyOptional({ description: 'Link to a project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Geofence radius in meters (default: 100)',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;
}

export class ImportAddressFromLeadDto {
  @ApiProperty({ description: 'Lead address ID to import from' })
  @IsUUID()
  lead_address_id: string;

  @ApiProperty({
    description: 'Human-readable label for the imported address',
    example: 'Lead - John Doe Residence',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  label: string;

  @ApiPropertyOptional({ description: 'Link to a project ID' })
  @IsOptional()
  @IsUUID()
  project_id?: string;

  @ApiPropertyOptional({
    description: 'Geofence radius in meters (default: 100)',
    example: 100,
  })
  @IsOptional()
  @IsInt()
  @Min(25)
  @Max(5000)
  radius_meters?: number;
}
