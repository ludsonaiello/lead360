import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsObject,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
} from 'class-validator';

export enum TemplateCategory {
  SYSTEM = 'system',
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
  NOTIFICATION = 'notification',
}

/**
 * DTO for creating email template
 */
export class CreateEmailTemplateDto {
  @ApiProperty({
    description: 'Unique template key (kebab-case)',
    example: 'quote-sent',
  })
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Template key must be lowercase alphanumeric with hyphens',
  })
  template_key: string;

  @ApiProperty({
    description: 'Template category',
    enum: TemplateCategory,
    example: TemplateCategory.TRANSACTIONAL,
  })
  @IsEnum(TemplateCategory)
  category: TemplateCategory;

  @ApiProperty({
    description: 'Email subject (supports Handlebars variables)',
    example: 'Your Quote from {{companyName}}',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  subject: string;

  @ApiProperty({
    description: 'HTML email body (supports Handlebars)',
    example: '<h1>Hi {{customerName}},</h1><p>Your quote is ready!</p>',
  })
  @IsString()
  @MinLength(1)
  html_body: string;

  @ApiPropertyOptional({
    description: 'Plain text email body (supports Handlebars)',
    example: 'Hi {{customerName}}, Your quote is ready!',
  })
  @IsString()
  @IsOptional()
  text_body?: string;

  @ApiProperty({
    description: 'Array of variable names used in template',
    example: ['customerName', 'companyName', 'quoteNumber'],
  })
  @IsObject()
  variables: string[];

  @ApiPropertyOptional({
    description: 'JSON Schema defining variable types and validation',
    example: {
      customerName: { type: 'string', description: 'Customer full name' },
      companyName: { type: 'string', description: 'Company name' },
    },
  })
  @IsObject()
  @IsOptional()
  variable_schema?: object;

  @ApiPropertyOptional({
    description: 'Template description',
    example: 'Sent when quote is emailed to customer',
  })
  @IsString()
  @IsOptional()
  description?: string;
}

/**
 * DTO for updating email template
 */
export class UpdateEmailTemplateDto {
  @ApiPropertyOptional({
    description: 'Template category',
    enum: TemplateCategory,
  })
  @IsEnum(TemplateCategory)
  @IsOptional()
  category?: TemplateCategory;

  @ApiPropertyOptional({
    description: 'Email subject (supports Handlebars variables)',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({
    description: 'HTML email body (supports Handlebars)',
  })
  @IsString()
  @MinLength(1)
  @IsOptional()
  html_body?: string;

  @ApiPropertyOptional({
    description: 'Plain text email body (supports Handlebars)',
  })
  @IsString()
  @IsOptional()
  text_body?: string;

  @ApiPropertyOptional({
    description: 'Array of variable names used in template',
  })
  @IsObject()
  @IsOptional()
  variables?: string[];

  @ApiPropertyOptional({
    description: 'JSON Schema defining variable types',
  })
  @IsObject()
  @IsOptional()
  variable_schema?: object;

  @ApiPropertyOptional({
    description: 'Template description',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether template is active',
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}

/**
 * DTO for previewing template
 */
export class PreviewTemplateDto {
  @ApiPropertyOptional({
    description: 'Template key (if previewing existing template)',
    example: 'quote-sent',
  })
  @IsString()
  @IsOptional()
  template_key?: string;

  @ApiPropertyOptional({
    description: 'Subject to preview (if not using template_key)',
    example: 'Your Quote from {{companyName}}',
  })
  @IsString()
  @IsOptional()
  subject?: string;

  @ApiPropertyOptional({
    description: 'HTML body to preview (if not using template_key)',
  })
  @IsString()
  @IsOptional()
  html_body?: string;

  @ApiPropertyOptional({
    description: 'Text body to preview (if not using template_key)',
  })
  @IsString()
  @IsOptional()
  text_body?: string;

  @ApiProperty({
    description: 'Sample data for rendering template',
    example: {
      customerName: 'John Doe',
      companyName: 'Acme Plumbing',
      quoteNumber: 'Q-12345',
    },
  })
  @IsObject()
  sample_data: Record<string, any>;
}

/**
 * DTO for validating Handlebars syntax
 */
export class ValidateTemplateDto {
  @ApiProperty({
    description: 'Template subject to validate',
    example: 'Your Quote from {{companyName}}',
  })
  @IsString()
  subject: string;

  @ApiProperty({
    description: 'HTML body to validate',
    example: '<h1>Hi {{customerName}}</h1>',
  })
  @IsString()
  html_body: string;

  @ApiPropertyOptional({
    description: 'Text body to validate',
  })
  @IsString()
  @IsOptional()
  text_body?: string;
}

/**
 * DTO for listing templates
 */
export class ListTemplatesDto {
  @ApiPropertyOptional({
    description: 'Filter by category',
    enum: TemplateCategory,
  })
  @IsEnum(TemplateCategory)
  @IsOptional()
  category?: TemplateCategory;

  @ApiPropertyOptional({
    description: 'Filter by active status',
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Search by template key or description',
  })
  @IsString()
  @IsOptional()
  search?: string;
}
