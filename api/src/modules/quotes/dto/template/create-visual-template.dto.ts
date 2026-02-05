import { IsString, IsOptional, IsArray, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateVisualTemplateDto {
  @ApiProperty({ description: 'Template name', example: 'Modern Professional Quote' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Template description', example: 'Clean, modern quote template with bold typography' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: 'Category ID', example: 'uuid-here' })
  @IsString()
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({ description: 'Tags', example: ['modern', 'professional', 'clean'], type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({
    description: 'Layout preset to start with',
    enum: ['blank', 'standard', 'modern', 'minimal'],
    example: 'modern'
  })
  @IsString()
  @IsIn(['blank', 'standard', 'modern', 'minimal'])
  @IsOptional()
  layout_preset?: 'blank' | 'standard' | 'modern' | 'minimal';

  @ApiPropertyOptional({ description: 'Is this a global (platform-wide) template?', example: false })
  @IsBoolean()
  @IsOptional()
  is_global?: boolean;

  @ApiPropertyOptional({ description: 'Set as default template?', example: false })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @ApiPropertyOptional({ description: 'Tenant ID (for tenant-specific templates)', example: 'uuid-here' })
  @IsString()
  @IsOptional()
  tenant_id?: string;
}
