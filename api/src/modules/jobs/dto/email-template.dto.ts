import { IsString, IsArray, IsOptional, IsBoolean, IsObject, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { PaginationDto } from './common.dto';

export class CreateEmailTemplateDto {
  @ApiProperty({
    example: 'welcome-email',
    description: 'Unique template identifier (kebab-case recommended)',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  template_key: string;

  @ApiProperty({
    example: 'Welcome to {{company_name}}!',
    description: 'Email subject line (supports Handlebars variables)',
    minLength: 3,
  })
  @IsString()
  @MinLength(3)
  subject: string;

  @ApiProperty({
    example: '<h1>Welcome {{user_name}}!</h1><p>Thanks for joining {{company_name}}.</p>',
    description: 'HTML email body (supports Handlebars variables)',
    minLength: 10,
  })
  @IsString()
  @MinLength(10)
  html_body: string;

  @ApiPropertyOptional({
    example: 'Welcome {{user_name}}! Thanks for joining {{company_name}}.',
    description: 'Plain text email body (optional, supports Handlebars variables)',
  })
  @IsOptional()
  @IsString()
  text_body?: string;

  @ApiProperty({
    example: ['user_name', 'company_name'],
    type: [String],
    description: 'List of variable names available in this template',
  })
  @IsArray()
  @IsString({ each: true })
  variables: string[];

  @ApiPropertyOptional({
    example: 'Welcome email sent to new users',
    description: 'Human-readable description of template purpose',
  })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateEmailTemplateDto extends PartialType(CreateEmailTemplateDto) {
  @ApiPropertyOptional()
  template_key?: never; // Cannot update template_key
}

export class PreviewEmailTemplateDto {
  @ApiProperty({
    example: { user_name: 'John Doe', company_name: 'Acme Corp' },
    description: 'Variables to use for rendering the template preview',
  })
  @IsObject()
  variables: Record<string, any>;
}

export class EmailTemplateFilterDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'password',
    description: 'Search templates by key, subject, or description',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description: 'Filter by system templates only',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_system?: boolean;
}
