import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEmail,
  IsOptional,
  Length,
  MaxLength,
  Matches,
} from 'class-validator';

export class CustomerInfoDto {
  @ApiProperty({
    example: 'John',
    description: 'Customer first name',
  })
  @IsString()
  @Length(1, 100)
  first_name: string;

  @ApiProperty({
    example: 'Doe',
    description: 'Customer last name',
  })
  @IsString()
  @Length(1, 100)
  last_name: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Customer email address',
  })
  @IsEmail()
  @Length(1, 255)
  email: string;

  @ApiProperty({
    example: '(555) 123-4567',
    description: 'Customer phone number',
  })
  @IsString()
  @Matches(/^[\d\s\-\(\)\+\.]+$/, {
    message: 'Invalid phone number format',
  })
  @Length(1, 20)
  phone: string;

  @ApiPropertyOptional({
    example: 'ABC Construction Inc.',
    description: 'Company name (optional)',
  })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  company_name?: string;
}
