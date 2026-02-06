import { IsString, IsOptional, Matches, Length, IsUrl } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBrandingDto {
  @ApiPropertyOptional({
    description: 'Primary brand color (hex format)',
    example: '#007BFF',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Must be a valid hex color code (e.g., #007BFF)',
  })
  primary_brand_color?: string;

  @ApiPropertyOptional({
    description: 'Secondary brand color (hex format)',
    example: '#6C757D',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Must be a valid hex color code',
  })
  secondary_brand_color?: string;

  @ApiPropertyOptional({
    description: 'Accent color (hex format)',
    example: '#28A745',
  })
  @IsString()
  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/, {
    message: 'Must be a valid hex color code',
  })
  accent_color?: string;

  @ApiPropertyOptional({
    description: 'Logo file ID (reference to uploaded file)',
    example: 'file-uuid-123',
  })
  @IsString()
  @IsOptional()
  logo_file_id?: string;

  @ApiPropertyOptional({
    description: 'Company website URL',
    example: 'https://acmeroofing.com',
  })
  @IsUrl()
  @IsOptional()
  company_website?: string;

  @ApiPropertyOptional({
    description: 'Tagline or slogan',
    example: 'Quality roofing since 1995',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  tagline?: string;
}
