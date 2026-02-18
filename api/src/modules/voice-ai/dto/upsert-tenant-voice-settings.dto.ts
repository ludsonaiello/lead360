import {
  IsOptional,
  IsBoolean,
  IsArray,
  IsString,
  MaxLength,
  IsInt,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * UpsertTenantVoiceSettingsDto
 *
 * Behavior-only fields that a tenant admin can configure.
 * Infrastructure override fields (provider IDs, per-tenant provider overrides, monthly_minutes_override)
 * are admin-only and NOT exposed here — they are set in Sprint B11.
 *
 * All fields are optional — PATCH semantics; only provided fields are written.
 */
export class UpsertTenantVoiceSettingsDto {
  @ApiPropertyOptional({
    description: 'Enable or disable the Voice AI agent for this tenant',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'ISO 639-1 language codes the agent should support',
    example: ['en', 'es'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  enabled_languages?: string[];

  @ApiPropertyOptional({
    description:
      'Custom greeting message. Pass null to revert to the global template.',
    example: 'Hello! Thank you for calling. How can I assist you today?',
    nullable: true,
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  custom_greeting?: string | null;

  @ApiPropertyOptional({
    description:
      'Additional instructions appended to the agent system prompt. Pass null to clear.',
    example:
      'Always ask if the caller has an emergency. Always mention we serve the Miami area.',
    nullable: true,
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  custom_instructions?: string | null;

  @ApiPropertyOptional({
    description: 'Allow the agent to book appointments for callers',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  booking_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Allow the agent to create leads from calls',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  lead_creation_enabled?: boolean;

  @ApiPropertyOptional({
    description: 'Allow the agent to transfer calls to a human operator',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  transfer_enabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Default fallback transfer number in E.164 format. Pass null to clear.',
    example: '+15551234567',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'default_transfer_number must be a valid E.164 phone number (e.g. +15551234567)',
  })
  default_transfer_number?: string | null;

  @ApiPropertyOptional({
    description:
      'Maximum call duration in seconds. Min: 60 (1 min), Max: 3600 (1 hr). Pass null to use the global default.',
    minimum: 60,
    maximum: 3600,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  max_call_duration_seconds?: number | null;
}
