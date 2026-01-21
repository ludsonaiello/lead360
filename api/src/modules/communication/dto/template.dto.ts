import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsEnum,
  IsBoolean,
  IsObject,
  IsArray,
  IsOptional,
  Matches,
  MinLength,
  MaxLength,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

export enum TemplateCategory {
  SYSTEM = 'system',
  TRANSACTIONAL = 'transactional',
  MARKETING = 'marketing',
  NOTIFICATION = 'notification',
}

export enum TemplateType {
  PLATFORM = 'platform',
  SHARED = 'shared',
  TENANT = 'tenant',
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

  @ApiPropertyOptional({
    description: 'Array of variable names used in template (auto-extracted if not provided)',
    example: ['customerName', 'companyName', 'quoteNumber'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];

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

  @ApiPropertyOptional({
    description: 'Whether template is active (defaults to true)',
    example: true,
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Template type (platform/shared/tenant). Defaults to tenant. Only platform admins can create platform/shared templates.',
    enum: TemplateType,
    example: TemplateType.TENANT,
  })
  @IsEnum(TemplateType)
  @IsOptional()
  template_type?: TemplateType;

  @ApiPropertyOptional({
    description: 'Tenant ID (only for platform admins creating templates for specific tenants)',
    example: '14a34ab2-6f6f-4e41-9bea-c444a304557e',
  })
  @IsString()
  @IsOptional()
  tenant_id?: string;
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
  @IsArray()
  @IsString({ each: true })
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
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by system template status (DEPRECATED: use template_type instead)',
    deprecated: true,
  })
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  @IsOptional()
  is_system?: boolean;

  @ApiPropertyOptional({
    description: 'Filter by template type (platform/shared/tenant)',
    enum: TemplateType,
  })
  @IsEnum(TemplateType)
  @IsOptional()
  template_type?: TemplateType;

  @ApiPropertyOptional({
    description: 'Search by template key or description',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({
    description: 'Page number (1-based)',
    example: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({
    description: 'Items per page',
    example: 20,
    default: 20,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number;
}
