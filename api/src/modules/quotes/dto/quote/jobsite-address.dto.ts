import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  Length,
  Matches,
} from 'class-validator';

export class JobsiteAddressDto {
  @ApiProperty({ example: '123 Main St', description: 'Address line 1' })
  @IsString()
  @Length(1, 255)
  address_line1: string;

  @ApiPropertyOptional({
    example: 'Suite 100',
    description: 'Address line 2 (optional)',
  })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  address_line2?: string;

  @ApiPropertyOptional({
    example: 'Boston',
    description: 'City (auto-filled if lat/lng provided)',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  city?: string;

  @ApiPropertyOptional({
    example: 'MA',
    description: 'State (auto-filled if lat/lng provided)',
  })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  state?: string;

  @ApiProperty({
    example: '02101',
    description: 'ZIP code (required)',
  })
  @IsString()
  @Matches(/^\d{5}(-\d{4})?$/, { message: 'Invalid ZIP code format' })
  zip_code: string;

  @ApiPropertyOptional({
    example: 42.3601,
    description: 'Latitude coordinate (auto-calculated if not provided)',
  })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({
    example: -71.0589,
    description: 'Longitude coordinate (auto-calculated if not provided)',
  })
  @IsNumber()
  @IsOptional()
  longitude?: number;
}
