import { IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

class PartialComponentPositionDto {
  @ApiPropertyOptional({ description: 'X position in pixels', example: 10 })
  x?: number;

  @ApiPropertyOptional({ description: 'Y position in pixels', example: 20 })
  y?: number;

  @ApiPropertyOptional({ description: 'Width (pixels or "auto")', example: '50%' })
  width?: number | string;

  @ApiPropertyOptional({ description: 'Height (pixels or "auto")', example: 100 })
  height?: number | string;
}

class ComponentConditionsDto {
  @ApiPropertyOptional({ description: 'Show component if condition is true', example: 'quote.discount_amount' })
  show_if?: string;

  @ApiPropertyOptional({ description: 'Hide component if condition is true', example: 'quote.is_archived' })
  hide_if?: string;
}

export class UpdateComponentDto {
  @ApiPropertyOptional({ description: 'Updated position/sizing', type: PartialComponentPositionDto })
  @ValidateNested()
  @Type(() => PartialComponentPositionDto)
  @IsOptional()
  position?: PartialComponentPositionDto;

  @ApiPropertyOptional({ description: 'Updated component properties', example: { show_logo: false } })
  @IsObject()
  @IsOptional()
  props?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Updated custom styles', example: { borderColor: '#e5e7eb' } })
  @IsObject()
  @IsOptional()
  style?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Updated data bindings', example: { email: '{{quote.lead.email}}' } })
  @IsObject()
  @IsOptional()
  data_bindings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Conditional rendering rules', type: ComponentConditionsDto })
  @ValidateNested()
  @Type(() => ComponentConditionsDto)
  @IsOptional()
  conditions?: ComponentConditionsDto;
}
