import {
  IsString,
  IsOptional,
  IsBoolean,
  Length,
  Matches,
  IsEnum,
  IsNumber,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  SanitizeZipCode,
  ToUpperCase,
} from '../../../common/validators/formatted-inputs';

export enum AddressType {
  LEGAL = 'legal',
  BILLING = 'billing',
  SERVICE = 'service',
  MAILING = 'mailing',
  OFFICE = 'office',
}

export class CreateAddressDto {
  @ApiProperty({
    description: 'Address type',
    enum: AddressType,
    example: AddressType.LEGAL,
  })
  @IsEnum(AddressType)
  address_type: AddressType;

  @ApiProperty({
    description: 'Address line 1',
    example: '123 Main Street',
  })
  @IsString()
  @Length(1, 255)
  line1: string;

  @ApiPropertyOptional({
    description: 'Address line 2 (apt, suite, etc.)',
    example: 'Suite 100',
  })
  @IsString()
  @IsOptional()
  @Length(1, 255)
  line2?: string;

  @ApiProperty({
    description: 'City',
    example: 'Boston',
  })
  @IsString()
  @Length(1, 100)
  city: string;

  @ApiProperty({
    description: 'State (2-letter code)',
    example: 'MA',
  })
  @IsString()
  @Length(2, 2)
  @ToUpperCase()
  @Matches(/^[A-Z]{2}$/, { message: 'Must be a valid 2-letter state code' })
  state: string;

  @ApiProperty({
    description: 'ZIP code (accepts any format, stores as XXXXX or XXXXX-XXXX)',
    example: '02101',
  })
  @IsString()
  @SanitizeZipCode()
  @Matches(/^\d{5}(-\d{4})?$/, {
    message: 'ZIP code must be 5 digits or ZIP+4 format',
  })
  zip_code: string;

  @ApiPropertyOptional({
    description: 'Country code (3-letter ISO code)',
    example: 'USA',
    default: 'USA',
  })
  @IsString()
  @IsOptional()
  @Length(3, 3)
  country?: string;

  @ApiPropertyOptional({
    description: 'Latitude',
    example: 42.3601,
  })
  @IsNumber()
  @IsOptional()
  lat?: number;

  @ApiPropertyOptional({
    description: 'Longitude',
    example: -71.0589,
  })
  @IsNumber()
  @IsOptional()
  long?: number;

  @ApiPropertyOptional({
    description: 'Is this a PO Box?',
    example: false,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_po_box?: boolean;

  @ApiPropertyOptional({
    description: 'Set as default address for this type',
    example: true,
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
