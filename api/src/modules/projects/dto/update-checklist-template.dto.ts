import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateChecklistTemplateItemDto } from './create-checklist-template.dto';

export class UpdateChecklistTemplateDto {
  @ApiPropertyOptional({ description: 'Template name (unique per tenant)', example: 'Updated Roofing Completion', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: 'Template description', example: 'Updated checklist for residential roofing projects' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Whether the template is active', example: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'If provided, replaces ALL existing items with this set',
    type: [CreateChecklistTemplateItemDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateChecklistTemplateItemDto)
  @IsOptional()
  items?: CreateChecklistTemplateItemDto[];
}
