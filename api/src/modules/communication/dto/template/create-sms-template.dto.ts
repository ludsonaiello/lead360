import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsBoolean,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for creating SMS template
 *
 * Validates input for SMS template creation.
 * Templates support merge fields like {lead.first_name}, {tenant.company_name}, etc.
 *
 * Multi-tenant isolation: tenant_id is derived from JWT token, not from request body.
 */
export class CreateSmsTemplateDto {
  @ApiProperty({
    description:
      'Template name (e.g., "Quote Follow-up", "Appointment Reminder")',
    example: 'Quote Follow-up',
    maxLength: 100,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100, {
    message: 'Template name cannot exceed 100 characters',
  })
  name: string;

  @ApiProperty({
    description: 'Optional description of template purpose',
    example: 'Send after quote is generated to notify customer',
    maxLength: 255,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, {
    message: 'Description cannot exceed 255 characters',
  })
  description?: string;

  @ApiProperty({
    description:
      'Template text with merge fields (e.g., "Hi {lead.first_name}, your quote from {tenant.company_name} is ready!")',
    example:
      'Hi {lead.first_name}, your quote from {tenant.company_name} is ready! View it here: {custom.quote_url}',
    maxLength: 1600,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1600, {
    message: 'Template body cannot exceed 1600 characters',
  })
  template_body: string;

  @ApiProperty({
    description:
      'Optional category (e.g., "quote", "appointment", "follow_up", "reminder")',
    example: 'quote',
    maxLength: 50,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50, {
    message: 'Category cannot exceed 50 characters',
  })
  category?: string;

  @ApiProperty({
    description:
      'Set as default template for this category (only one default per category per tenant)',
    example: false,
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
