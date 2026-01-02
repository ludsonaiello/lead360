import {
  IsEmail,
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({
    description: 'User email address (will be normalized to lowercase)',
    example: 'john@example.com',
    maxLength: 255,
  })
  @IsEmail({}, { message: 'Invalid email format' })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  @MaxLength(255)
  email: string;

  @ApiProperty({
    description:
      'Password (min 8 chars, must contain uppercase, lowercase, and special character)',
    example: 'MySecure@Pass123',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(72, { message: 'Password must be at most 72 characters' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]).+$/,
    {
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, and one special character',
    },
  )
  password: string;

  @ApiProperty({
    description: 'User first name',
    example: 'John',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1, { message: 'First name is required' })
  @MaxLength(100, { message: 'First name must be at most 100 characters' })
  @Transform(({ value }) => value?.trim())
  first_name: string;

  @ApiProperty({
    description: 'User last name',
    example: 'Doe',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @MinLength(1, { message: 'Last name is required' })
  @MaxLength(100, { message: 'Last name must be at most 100 characters' })
  @Transform(({ value }) => value?.trim())
  last_name: string;

  @ApiPropertyOptional({
    description: 'User phone number in E.164 format',
    example: '+15551234567',
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Matches(/^\+?[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format',
  })
  phone?: string;

  @ApiProperty({
    description:
      'Tenant subdomain (3-63 chars, alphanumeric and hyphens, lowercase)',
    example: 'acme-roofing',
    minLength: 3,
    maxLength: 63,
  })
  @IsString()
  @MinLength(3, { message: 'Subdomain must be at least 3 characters' })
  @MaxLength(63, { message: 'Subdomain must be at most 63 characters' })
  @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]$/, {
    message:
      'Subdomain must be lowercase, alphanumeric with hyphens (not at start or end)',
  })
  @Transform(({ value }) => value?.toLowerCase()?.trim())
  tenant_subdomain: string;

  @ApiProperty({
    description: 'Company name for the tenant',
    example: 'Acme Roofing LLC',
    minLength: 2,
    maxLength: 200,
  })
  @IsString()
  @MinLength(2, { message: 'Company name must be at least 2 characters' })
  @MaxLength(200, { message: 'Company name must be at most 200 characters' })
  @Transform(({ value }) => value?.trim())
  company_name: string;
}
