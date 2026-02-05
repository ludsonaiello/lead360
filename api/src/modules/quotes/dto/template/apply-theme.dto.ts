import { IsString, IsNumber, IsOptional, Matches, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApplyThemeDto {
  @ApiPropertyOptional({
    description: 'Primary color (hex)',
    example: '#2563eb',
    pattern: '^#[0-9A-Fa-f]{6}$'
  })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Primary color must be a valid hex color (e.g., #2563eb)' })
  @IsOptional()
  primaryColor?: string;

  @ApiPropertyOptional({
    description: 'Secondary color (hex)',
    example: '#64748b',
    pattern: '^#[0-9A-Fa-f]{6}$'
  })
  @IsString()
  @Matches(/^#[0-9A-Fa-f]{6}$/, { message: 'Secondary color must be a valid hex color' })
  @IsOptional()
  secondaryColor?: string;

  @ApiPropertyOptional({
    description: 'Font family',
    example: 'Inter, sans-serif'
  })
  @IsString()
  @IsOptional()
  fontFamily?: string;

  @ApiPropertyOptional({
    description: 'Font size in pixels (8-72)',
    example: 14,
    minimum: 8,
    maximum: 72
  })
  @IsNumber()
  @Min(8)
  @Max(72)
  @IsOptional()
  fontSize?: number;

  @ApiPropertyOptional({
    description: 'Line height (0.5-3)',
    example: 1.5,
    minimum: 0.5,
    maximum: 3
  })
  @IsNumber()
  @Min(0.5)
  @Max(3)
  @IsOptional()
  lineHeight?: number;
}
