import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  Length,
  Min,
  Max,
  Matches,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ServiceAreaType {
  CITY = 'city',
  ZIPCODE = 'zipcode',
  RADIUS = 'radius',
  STATE = 'state',
}

export class CreateServiceAreaDto {
  @ApiProperty({
    description: 'Service area type',
    enum: ServiceAreaType,
    example: ServiceAreaType.RADIUS,
  })
  @IsEnum(ServiceAreaType)
  area_type: ServiceAreaType;

  @ApiPropertyOptional({
    description: 'City name (required if type=city)',
    example: 'Los Angeles',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  @ValidateIf((o) => o.area_type === ServiceAreaType.CITY)
  city?: string;

  @ApiPropertyOptional({
    description: 'State code (required if type=city)',
    example: 'CA',
  })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  @Matches(/^[A-Z]{2}$/, { message: 'Must be a valid 2-letter state code' })
  @ValidateIf((o) => o.area_type === ServiceAreaType.CITY)
  state?: string;

  @ApiPropertyOptional({
    description: 'ZIP code (required if type=zipcode)',
    example: '90210',
  })
  @IsString()
  @IsOptional()
  @Matches(/^\d{5}(-\d{4})?$/, {
    message: 'ZIP code must be 5 digits or ZIP+4 format',
  })
  @ValidateIf((o) => o.area_type === ServiceAreaType.ZIPCODE)
  zipcode?: string;

  @ApiPropertyOptional({
    description: 'Center latitude (required if type=radius)',
    example: 34.0522,
  })
  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  @ValidateIf((o) => o.area_type === ServiceAreaType.RADIUS)
  center_lat?: number;

  @ApiPropertyOptional({
    description: 'Center longitude (required if type=radius)',
    example: -118.2437,
  })
  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  @ValidateIf((o) => o.area_type === ServiceAreaType.RADIUS)
  center_long?: number;

  @ApiPropertyOptional({
    description: 'Radius in miles (required if type=radius)',
    example: 25,
  })
  @IsNumber()
  @IsOptional()
  @Min(1)
  @Max(500)
  @ValidateIf((o) => o.area_type === ServiceAreaType.RADIUS)
  radius_miles?: number;
}
