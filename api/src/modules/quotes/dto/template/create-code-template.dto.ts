import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCodeTemplateDto {
  @ApiProperty({
    description: 'Template name',
    example: 'Classic Business Quote',
  })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiPropertyOptional({
    description: 'Template description',
    example: 'Traditional quote format with formal styling',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({
    description: 'Handlebars HTML content',
    example: '<div>{{quote.quote_number}}</div>',
  })
  @IsString()
  html_content: string;

  @ApiPropertyOptional({
    description: 'CSS styles',
    example: 'body { font-family: Arial; }',
  })
  @IsString()
  @IsOptional()
  css_content?: string;

  @ApiPropertyOptional({ description: 'Category ID', example: 'uuid-here' })
  @IsString()
  @IsOptional()
  category_id?: string;

  @ApiPropertyOptional({
    description: 'Tags',
    example: ['classic', 'traditional', 'formal'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];

  @ApiPropertyOptional({ description: 'Thumbnail URL', example: 'https://...' })
  @IsString()
  @IsOptional()
  thumbnail_url?: string;

  @ApiPropertyOptional({
    description: 'Is this a global (platform-wide) template?',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  is_global?: boolean;

  @ApiPropertyOptional({
    description: 'Set as default template?',
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  is_default?: boolean;

  @ApiPropertyOptional({
    description: 'Tenant ID (for tenant-specific templates)',
    example: 'uuid-here',
  })
  @IsString()
  @IsOptional()
  tenant_id?: string;
}
