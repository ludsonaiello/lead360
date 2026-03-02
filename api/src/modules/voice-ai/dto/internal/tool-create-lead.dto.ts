import { IsString, IsOptional, IsNotEmpty, IsEmail, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SanitizePhone } from '../../../../common/validators/formatted-inputs';

export class CreateLeadToolDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiProperty({
    example: '+15551234567',
    description: 'Phone number (any format accepted: E.164, 10-digit, 11-digit with country code, formatted with parentheses/dashes)',
  })
  @IsString()
  @IsNotEmpty()
  @SanitizePhone()
  @Matches(/^\d{10}$/, {
    message: 'Phone number must be valid (10 digits after sanitization)',
  })
  phone_number: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 'Boston' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'MA' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty({ example: '02101' })
  @IsString()
  @IsNotEmpty()
  zip_code: string;

  @ApiPropertyOptional({ example: 'Need lawn mowing service' })
  @IsString()
  @IsOptional()
  service_description?: string;

  @ApiPropertyOptional({ example: 'en', description: 'Language: en, es, pt' })
  @IsString()
  @IsOptional()
  language?: string;
}

export class CreateLeadToolResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  lead_id?: string;

  @ApiPropertyOptional()
  message?: string;

  @ApiPropertyOptional()
  error?: string;
}
