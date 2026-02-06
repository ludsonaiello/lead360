import {
  IsString,
  IsOptional,
  IsObject,
  IsIn,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class ComponentPositionDto {
  @ApiProperty({ description: 'X position in pixels', example: 0 })
  x: number;

  @ApiProperty({ description: 'Y position in pixels', example: 0 })
  y: number;

  @ApiProperty({ description: 'Width (pixels or "auto")', example: '100%' })
  width: number | string;

  @ApiProperty({ description: 'Height (pixels or "auto")', example: 'auto' })
  height: number | string;
}

export class AddComponentDto {
  @ApiPropertyOptional({
    description: 'Component ID from library (optional)',
    example: 'global-header-modern',
  })
  @IsString()
  @IsOptional()
  component_id?: string;

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
  component_type: string;

  @ApiProperty({
    description: 'Component position and sizing',
    type: ComponentPositionDto,
  })
  @ValidateNested()
  @Type(() => ComponentPositionDto)
  position: ComponentPositionDto;

  @ApiPropertyOptional({
    description: 'Component properties',
    example: { show_logo: true, company_name: 'My Company' },
  })
  @IsObject()
  @IsOptional()
  props?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Custom styles',
    example: { backgroundColor: '#ffffff', padding: 20 },
  })
  @IsObject()
  @IsOptional()
  style?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Data bindings (Handlebars)',
    example: { customer_name: '{{quote.lead.full_name}}' },
  })
  @IsObject()
  @IsOptional()
  data_bindings?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Section to add component to',
    enum: ['header', 'body', 'footer'],
    example: 'body',
  })
  @IsString()
  @IsIn(['header', 'body', 'footer'])
  @IsOptional()
  section?: 'header' | 'body' | 'footer';
}
