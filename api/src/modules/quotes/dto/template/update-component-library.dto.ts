import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsNumber,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateComponentLibraryDto {
  @ApiPropertyOptional({
    description: 'Component name',
    example: 'Updated Header',
  })
  @IsString()
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Component description',
    example: 'Updated description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Component structure',
    example: { layout: 'grid' },
  })
  @IsObject()
  @IsOptional()
  structure?: any;

  @ApiPropertyOptional({
    description: 'Default properties',
    example: { updated: true },
  })
  @IsObject()
  @IsOptional()
  default_props?: any;

  @ApiPropertyOptional({
    description: 'HTML template',
    example: '<div>Updated</div>',
  })
  @IsString()
  @IsOptional()
  html_template?: string;

  @ApiPropertyOptional({
    description: 'CSS template',
    example: 'div { color: blue; }',
  })
  @IsString()
  @IsOptional()
  css_template?: string;

  @ApiPropertyOptional({ description: 'Thumbnail URL', example: 'https://...' })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @ApiPropertyOptional({
    description: 'Usage notes',
    example: 'Updated usage notes',
  })
  @IsString()
  @IsOptional()
  usage_notes?: string;

  @ApiPropertyOptional({ description: 'Is active?', example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({ description: 'Sort order', example: 10 })
  @IsNumber()
  @IsOptional()
  sort_order?: number;
}
