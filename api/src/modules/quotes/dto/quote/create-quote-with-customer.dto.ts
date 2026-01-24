import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  Length,
  Min,
  Max,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { JobsiteAddressDto } from './jobsite-address.dto';
import { CustomerInfoDto } from './customer-info.dto';

export class CreateQuoteWithCustomerDto {
  @ApiProperty({
    type: CustomerInfoDto,
    description: 'New customer information (will create lead)',
  })
  @ValidateNested()
  @Type(() => CustomerInfoDto)
  customer: CustomerInfoDto;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Vendor UUID',
  })
  @IsString()
  @IsUUID()
  vendor_id: string;

  @ApiProperty({
    example: 'Kitchen Remodel',
    description: 'Quote title',
  })
  @IsString()
  @Length(1, 200)
  title: string;

  @ApiProperty({
    type: JobsiteAddressDto,
    description: 'Jobsite address (will be validated via Google Maps)',
  })
  @ValidateNested()
  @Type(() => JobsiteAddressDto)
  jobsite_address: JobsiteAddressDto;

  @ApiPropertyOptional({
    example: 'PO-12345',
    description: 'Purchase order number (optional)',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  po_number?: string;

  @ApiPropertyOptional({
    example: 30,
    description: 'Number of days until quote expires (default from settings)',
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  expiration_days?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'Use default settings from QuoteSettingsService',
  })
  @IsBoolean()
  @IsOptional()
  use_default_settings?: boolean;

  @ApiPropertyOptional({
    example: 25.0,
    description: 'Custom profit percentage (overrides default)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_profit_percent?: number;

  @ApiPropertyOptional({
    example: 15.0,
    description: 'Custom overhead percentage (overrides default)',
  })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100)
  custom_overhead_percent?: number;

  @ApiPropertyOptional({
    example: 'Customer requested detailed breakdown',
    description: 'Private notes (internal use only)',
  })
  @IsString()
  @IsOptional()
  private_notes?: string;
}
