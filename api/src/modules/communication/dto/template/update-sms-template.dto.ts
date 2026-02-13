import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for updating SMS template
 *
 * All fields are optional - only provided fields will be updated.
 * Multi-tenant isolation: template ownership is verified in service layer.
 */
export class UpdateSmsTemplateDto {
  @ApiProperty({
    description: 'Template name',
    example: 'Quote Follow-up (Updated)',
    maxLength: 100,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100, {
    message: 'Template name cannot exceed 100 characters',
  })
  name?: string;

  @ApiProperty({
    description: 'Template description',
    example: 'Updated description for quote follow-up',
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
    description: 'Template text with merge fields',
    example:
      'Hello {lead.first_name}, your updated quote from {tenant.company_name} is ready!',
    maxLength: 1600,
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1600, {
    message: 'Template body cannot exceed 1600 characters',
  })
  template_body?: string;

  @ApiProperty({
    description: 'Template category',
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
    description: 'Whether template is active',
    example: true,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiProperty({
    description: 'Set as default template for this category',
    example: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
