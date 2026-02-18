import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

/**
 * UpdateGlobalConfigDto
 *
 * All fields are optional — PATCH semantics.
 * LiveKit keys are encrypted at rest (never returned in responses).
 * JSON fields (default_languages, default_tools_enabled, default_*_config)
 * are stored as raw JSON strings — the service validates JSON parseability.
 */
export class UpdateGlobalConfigDto {
  @ApiPropertyOptional({ description: 'UUID of the default STT provider row' })
  @IsOptional()
  @IsString()
  default_stt_provider_id?: string;

  @ApiPropertyOptional({ description: 'UUID of the default LLM provider row' })
  @IsOptional()
  @IsString()
  default_llm_provider_id?: string;

  @ApiPropertyOptional({ description: 'UUID of the default TTS provider row' })
  @IsOptional()
  @IsString()
  default_tts_provider_id?: string;

  @ApiPropertyOptional({ description: 'Cartesia voice ID or provider-specific voice identifier' })
  @IsOptional()
  @IsString()
  default_voice_id?: string;

  @ApiPropertyOptional({ description: 'BCP-47 language code, e.g. "en"', maxLength: 10 })
  @IsOptional()
  @IsString()
  @MaxLength(10)
  default_language?: string;

  @ApiPropertyOptional({
    description: 'JSON array of enabled language codes, e.g. ["en","es","pt"]',
  })
  @IsOptional()
  @IsString()
  default_languages?: string;

  @ApiPropertyOptional({
    description: 'Default greeting template; use {business_name} as placeholder',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  default_greeting_template?: string;

  @ApiPropertyOptional({
    description: 'Base system prompt injected into every agent conversation',
    maxLength: 2000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  default_system_prompt?: string;

  @ApiPropertyOptional({
    description: 'Max call duration in seconds (60–3600)',
    minimum: 60,
    maximum: 3600,
  })
  @IsOptional()
  @IsInt()
  @Min(60)
  @Max(3600)
  default_max_call_duration_seconds?: number;

  @ApiPropertyOptional({
    description: 'Behavior when call ends: end_call | voicemail | hold',
  })
  @IsOptional()
  @IsString()
  default_transfer_behavior?: string;

  @ApiPropertyOptional({
    description:
      'JSON object of tool toggles, e.g. {"booking":true,"lead_creation":true,"call_transfer":true}',
  })
  @IsOptional()
  @IsString()
  default_tools_enabled?: string;

  @ApiPropertyOptional({
    description: 'JSON object with STT provider-specific config (e.g. model, punctuate)',
  })
  @IsOptional()
  @IsString()
  default_stt_config?: string;

  @ApiPropertyOptional({
    description: 'JSON object with LLM provider-specific config (e.g. model, temperature)',
  })
  @IsOptional()
  @IsString()
  default_llm_config?: string;

  @ApiPropertyOptional({
    description: 'JSON object with TTS provider-specific config (e.g. model, speed)',
  })
  @IsOptional()
  @IsString()
  default_tts_config?: string;

  @ApiPropertyOptional({ description: 'LiveKit SIP trunk URL, e.g. sip.livekit.cloud' })
  @IsOptional()
  @IsString()
  livekit_sip_trunk_url?: string;

  @ApiPropertyOptional({ description: 'LiveKit API key — stored encrypted, never returned' })
  @IsOptional()
  @IsString()
  livekit_api_key?: string;

  @ApiPropertyOptional({ description: 'LiveKit API secret — stored encrypted, never returned' })
  @IsOptional()
  @IsString()
  livekit_api_secret?: string;

  @ApiPropertyOptional({
    description: 'Max concurrent calls across the entire platform (≥1)',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  max_concurrent_calls?: number;
}
