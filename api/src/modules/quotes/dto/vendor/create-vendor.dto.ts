import {
  IsString,
  IsEmail,
  IsBoolean,
  IsOptional,
  IsNumber,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVendorDto {
  @ApiProperty({ example: 'ABC Construction Inc' })
  @IsString()
  @Length(1, 200)
  name: string;

  @ApiProperty({ example: 'vendor@abcconstruction.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: '5551234567' })
  @IsString()
  @Matches(/^\d{10}$/, { message: 'Phone must be 10 digits' })
  phone: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @Length(1, 255)
  address_line1: string;

  @ApiPropertyOptional({ example: 'Suite 100' })
  @IsString()
  @IsOptional()
  @MaxLength(255)
  address_line2?: string;

  @ApiPropertyOptional({ example: 'Boston' })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  city?: string;

  @ApiPropertyOptional({ example: 'MA' })
  @IsString()
  @IsOptional()
  @Length(2, 2)
  state?: string;

  @ApiProperty({ example: '02101' })
  @IsString()
  @Matches(/^\d{5}(-\d{4})?$/, { message: 'Invalid ZIP code format' })
  zip_code: string;

  @ApiPropertyOptional({ example: 42.3601 })
  @IsNumber()
  @IsOptional()
  latitude?: number;

  @ApiPropertyOptional({ example: -71.0589 })
  @IsNumber()
  @IsOptional()
  longitude?: number;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsString()
  @IsOptional()
  signature_file_id?: string;

  @ApiPropertyOptional({ example: false })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;
}
