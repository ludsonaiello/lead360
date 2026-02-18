import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
} from 'class-validator';

/**
 * AdminOverrideTenantVoiceDto
 *
 * DTO for platform admin override of per-tenant Voice AI infrastructure settings.
 * All fields are optional — only fields explicitly sent will be updated.
 * Sending `null` for a field removes the override (reverts to plan/global default).
 *
 * Admin-only: never exposed to tenants.
 */
export class AdminOverrideTenantVoiceDto {
  @ApiPropertyOptional({
    description:
      'Force-enable or force-disable Voice AI for this tenant. ' +
      'true/false overrides the tenant toggle. null removes the admin force (tenant controls again).',
    nullable: true,
    example: true,
  })
  @IsOptional()
  @ValidateIf((o: AdminOverrideTenantVoiceDto) => o.force_enabled !== null)
  @IsBoolean()
  force_enabled?: boolean | null;

  @ApiPropertyOptional({
    description:
      'Override the monthly minute quota for this tenant. ' +
      'null removes the override and reverts to the plan default.',
    nullable: true,
    minimum: 0,
    example: 1000,
  })
  @IsOptional()
  @ValidateIf((o: AdminOverrideTenantVoiceDto) => o.monthly_minutes_override !== null)
  @IsInt()
  @Min(0)
  monthly_minutes_override?: number | null;

  @ApiPropertyOptional({
    description:
      'Override the STT (Speech-to-Text) provider for this tenant. ' +
      'Must be a valid voice_ai_provider UUID. null removes the override.',
    nullable: true,
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  @IsOptional()
  @ValidateIf((o: AdminOverrideTenantVoiceDto) => o.stt_provider_override_id !== null)
  @IsString()
  stt_provider_override_id?: string | null;

  @ApiPropertyOptional({
    description:
      'Override the LLM (Language Model) provider for this tenant. ' +
      'Must be a valid voice_ai_provider UUID. null removes the override.',
    nullable: true,
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d480',
  })
  @IsOptional()
  @ValidateIf((o: AdminOverrideTenantVoiceDto) => o.llm_provider_override_id !== null)
  @IsString()
  llm_provider_override_id?: string | null;

  @ApiPropertyOptional({
    description:
      'Override the TTS (Text-to-Speech) provider for this tenant. ' +
      'Must be a valid voice_ai_provider UUID. null removes the override.',
    nullable: true,
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d481',
  })
  @IsOptional()
  @ValidateIf((o: AdminOverrideTenantVoiceDto) => o.tts_provider_override_id !== null)
  @IsString()
  tts_provider_override_id?: string | null;

  @ApiPropertyOptional({
    description:
      'Internal admin note explaining the reason for this override. ' +
      'Visible in the admin panel only. null clears the note.',
    nullable: true,
    example: 'Upgrading to premium providers for Q1 2026 trial period.',
  })
  @IsOptional()
  @ValidateIf((o: AdminOverrideTenantVoiceDto) => o.admin_notes !== null)
  @IsString()
  admin_notes?: string | null;
}
