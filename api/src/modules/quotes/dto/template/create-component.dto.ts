import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  IsObject,
  MaxLength,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateComponentDto {
  @ApiProperty({ description: 'Component name', example: 'Modern Header' })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Component description',
    example: 'Clean header with logo and branding',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Component type',
    example: 'header',
    enum: [
      'header',
      'footer',
      'customer_info',
      'line_items',
      'totals',
      'terms',
      'signature',
      'payment_schedule',
      'warranty',
      'custom',
    ],
  })
  @IsString()
  @IsIn([
    'header',
    'footer',
    'customer_info',
    'line_items',
    'totals',
    'terms',
    'signature',
    'payment_schedule',
    'warranty',
    'custom',
  ])
  component_type: string;

  @ApiProperty({
    description: 'Component category',
    example: 'layout',
    enum: ['layout', 'content', 'pricing', 'branding', 'custom'],
  })
  @IsString()
  @IsIn(['layout', 'content', 'pricing', 'branding', 'custom'])
  category: string;

  @ApiPropertyOptional({
    description: 'Tags',
    example: ['header', 'modern', 'logo'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiProperty({
    description: 'Component structure definition (JSON)',
    example: { layout: 'flex', direction: 'row' },
  })
  @IsObject()
  structure: any;

  @ApiPropertyOptional({
    description: 'Default properties',
    example: { show_logo: true, logo_height: 60 },
  })
  @IsObject()
  @IsOptional()
  default_props?: any;

  @ApiProperty({
    description: 'Handlebars HTML template',
    example: '<div class="header">{{company_name}}</div>',
  })
  @IsString()
  html_template: string;

  @ApiPropertyOptional({
    description: 'CSS styles',
    example: '.header { padding: 20px; }',
  })
  @IsString()
  @IsOptional()
  css_template?: string;

  @ApiPropertyOptional({ description: 'Thumbnail URL', example: 'https://...' })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @ApiPropertyOptional({
    description: 'Usage notes/documentation',
    example: 'Best for modern professional quotes',
  })
  @IsString()
  @IsOptional()
  usage_notes?: string;

  @ApiPropertyOptional({
    description: 'Is this a global (platform-wide) component?',
    example: true,
  })
  @IsBoolean()
  @IsOptional()
  is_global?: boolean;

  @ApiPropertyOptional({
    description: 'Tenant ID (for tenant-specific components)',
    example: 'uuid-here',
  })
  @IsString()
  @IsOptional()
  tenant_id?: string;
}
