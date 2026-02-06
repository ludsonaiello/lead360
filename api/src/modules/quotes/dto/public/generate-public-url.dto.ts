import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  IsDateString,
} from 'class-validator';

export class GeneratePublicUrlDto {
  @ApiPropertyOptional({
    description: 'Password to protect the public URL (optional)',
    example: 'SecurePass123',
    minLength: 6,
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(100, { message: 'Password cannot exceed 100 characters' })
  password?: string;

  @ApiPropertyOptional({
    description: 'Hint for password recovery (optional)',
    example: 'Your street name',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Password hint cannot exceed 255 characters' })
  password_hint?: string;

  @ApiPropertyOptional({
    description:
      'Expiration date for the public URL (ISO 8601 format). If not provided, URL never expires.',
    example: '2026-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  expires_at?: string;
}

export class PublicUrlResponseDto {
  @ApiProperty({
    description: 'The generated public URL',
    example: 'https://tenant.lead360.app/public/quotes/abc123def456',
  })
  public_url: string;

  @ApiProperty({
    description: 'The unique access token',
    example: 'abc123def456',
  })
  access_token: string;

  @ApiProperty({
    description: 'Whether the URL is password protected',
    example: true,
  })
  has_password: boolean;

  @ApiPropertyOptional({
    description: 'Password hint (if provided)',
    example: 'Your street name',
  })
  password_hint?: string;

  @ApiPropertyOptional({
    description: 'Expiration date (ISO 8601 format)',
    example: '2026-12-31T23:59:59Z',
  })
  expires_at?: string;

  @ApiProperty({
    description: 'When the URL was created',
    example: '2026-01-23T10:00:00Z',
  })
  created_at: string;
}
