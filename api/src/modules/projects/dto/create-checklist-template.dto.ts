import {
  IsString,
  IsOptional,
  IsArray,
  IsInt,
  IsBoolean,
  MaxLength,
  MinLength,
  Min,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateChecklistTemplateItemDto {
  @ApiProperty({ description: 'Item title', example: 'Final inspection passed', maxLength: 300 })
  @IsString()
  @MinLength(1)
  @MaxLength(300)
  title: string;

  @ApiPropertyOptional({ description: 'Item description', example: 'Ensure all inspections have passed' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether this item is required for completion', example: true, default: true })
  @IsBoolean()
  @IsOptional()
  is_required?: boolean;

  @ApiProperty({ description: 'Display order (0-based)', example: 0 })
  @IsInt()
  @Min(0)
  order_index: number;
}

export class CreateChecklistTemplateDto {
  @ApiProperty({ description: 'Template name (unique per tenant)', example: 'Standard Roofing Completion', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({ description: 'Template description', example: 'Checklist for residential roofing projects' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Array of checklist items to create with the template',
    type: [CreateChecklistTemplateItemDto],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistTemplateItemDto)
  items: CreateChecklistTemplateItemDto[];
}
