import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * TenantVoiceAiSettingsDto
 *
 * Response DTO for tenant Voice AI settings.
 * Includes all settings fields plus plan entitlement information.
 */
export class TenantVoiceAiSettingsDto {
  @ApiProperty({
    description: 'Unique ID of the settings record',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id: string;

  @ApiProperty({
    description: 'Tenant ID this settings record belongs to',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  tenant_id: string;

  @ApiProperty({
    description: 'Whether Voice AI is enabled for this tenant',
    example: true,
  })
  is_enabled: boolean;

  @ApiProperty({
    description: 'Default language code',
    example: 'en',
  })
  default_language: string;

  @ApiProperty({
    description: 'Array of enabled language codes',
    example: ['en', 'es'],
    type: [String],
  })
  enabled_languages: string[];

  @ApiPropertyOptional({
    description: 'Custom greeting message',
    example: 'Hello! Thank you for calling. How can I assist you today?',
    nullable: true,
  })
  custom_greeting: string | null;

  @ApiPropertyOptional({
    description: 'Custom instructions for the AI agent',
    example: 'Always ask if the caller has an emergency.',
    nullable: true,
  })
  custom_instructions: string | null;

  @ApiPropertyOptional({
    description: 'After-hours behavior setting',
    example: 'voicemail',
    nullable: true,
  })
  after_hours_behavior: string | null;

  @ApiProperty({
    description: 'Whether appointment booking is enabled',
    example: true,
  })
  booking_enabled: boolean;

  @ApiProperty({
    description: 'Whether lead creation is enabled',
    example: true,
  })
  lead_creation_enabled: boolean;

  @ApiProperty({
    description: 'Whether call transfer is enabled',
    example: true,
  })
  transfer_enabled: boolean;

  @ApiPropertyOptional({
    description: 'Default transfer phone number in E.164 format',
    example: '+15551234567',
    nullable: true,
  })
  default_transfer_number: string | null;

  @ApiPropertyOptional({
    description: 'ID of the default transfer number record',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
    nullable: true,
  })
  default_transfer_number_id: string | null;

  @ApiPropertyOptional({
    description: 'Maximum call duration in seconds',
    example: 600,
    nullable: true,
  })
  max_call_duration_seconds: number | null;

  @ApiProperty({
    description: 'Record creation timestamp',
    example: '2026-01-15T10:30:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Record last update timestamp',
    example: '2026-01-20T14:45:00Z',
  })
  updated_at: Date;

  @ApiPropertyOptional({
    description: 'ID of the user who last updated this record',
    example: 'u1b2c3d4-e5f6-7890-abcd-ef1234567890',
    nullable: true,
  })
  updated_by: string | null;

  // Plan entitlement information
  @ApiProperty({
    description: 'Whether the tenant subscription plan includes Voice AI',
    example: true,
  })
  plan_includes_voice_ai: boolean;

  @ApiPropertyOptional({
    description: 'Monthly minutes included in the plan',
    example: 500,
  })
  plan_monthly_minutes: number;

  @ApiPropertyOptional({
    description: 'Admin override for monthly minutes (if set)',
    example: 1000,
    nullable: true,
  })
  monthly_minutes_override: number | null;

  @ApiPropertyOptional({
    description: 'Admin notes (visible to admins only)',
    example: 'Premium trial for Q1 2026',
    nullable: true,
  })
  admin_notes: string | null;
}
