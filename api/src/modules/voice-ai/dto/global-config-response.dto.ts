import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * SafeProviderInfo
 *
 * Minimal provider details included in global config response.
 */
export class SafeProviderInfo {
  @ApiProperty({ description: 'Provider UUID' })
  id: string;

  @ApiProperty({
    description: 'Provider key (e.g. deepgram, openai, cartesia)',
  })
  provider_key: string;

  @ApiProperty({ description: 'Provider type (STT, LLM, TTS)' })
  provider_type: string;

  @ApiProperty({ description: 'Human-readable provider name' })
  display_name: string;
}

/**
 * GlobalConfigResponseDto
 *
 * Safe response shape for global config — never exposes raw LiveKit credentials.
 * LiveKit keys are replaced with boolean flags indicating presence.
 * Includes resolved provider objects with display_name and provider_key.
 */
export class GlobalConfigResponseDto {
  @ApiProperty({ description: 'Config ID (always "default")' })
  id: string;

  @ApiProperty({
    description: 'Whether the voice AI agent is globally enabled',
  })
  agent_enabled: boolean;

  @ApiPropertyOptional({
    description: 'Default STT provider details',
    type: SafeProviderInfo,
  })
  default_stt_provider: SafeProviderInfo | null;

  @ApiPropertyOptional({
    description: 'Default LLM provider details',
    type: SafeProviderInfo,
  })
  default_llm_provider: SafeProviderInfo | null;

  @ApiPropertyOptional({
    description: 'Default TTS provider details',
    type: SafeProviderInfo,
  })
  default_tts_provider: SafeProviderInfo | null;

  @ApiPropertyOptional({
    description:
      'JSON object with STT provider-specific config (includes endpointing, utterance_end_ms, etc.)',
    example:
      '{"model":"nova-2-phonecall","endpointing":800,"utterance_end_ms":2000,"vad_events":true}',
  })
  default_stt_config: string | null;

  @ApiPropertyOptional({
    description: 'JSON object with LLM provider-specific config',
  })
  default_llm_config: string | null;

  @ApiPropertyOptional({
    description: 'JSON object with TTS provider-specific config',
  })
  default_tts_config: string | null;

  @ApiPropertyOptional({ description: 'Default voice ID for TTS' })
  default_voice_id: string | null;

  @ApiProperty({ description: 'Default language code (BCP-47)' })
  default_language: string;

  @ApiProperty({ description: 'JSON array of enabled language codes' })
  default_languages: string;

  @ApiProperty({ description: 'Default greeting template' })
  default_greeting_template: string;

  @ApiProperty({ description: 'Base system prompt for agents' })
  default_system_prompt: string;

  @ApiProperty({ description: 'Max call duration in seconds' })
  default_max_call_duration_seconds: number;

  @ApiProperty({ description: 'Transfer behavior when call ends' })
  default_transfer_behavior: string;

  @ApiProperty({ description: 'JSON object of enabled tools' })
  default_tools_enabled: string;

  @ApiPropertyOptional({
    description: 'LiveKit server URL for agent connections',
  })
  livekit_url: string | null;

  @ApiPropertyOptional({
    description: 'LiveKit SIP trunk URL for inbound calls',
  })
  livekit_sip_trunk_url: string | null;

  @ApiProperty({
    description:
      'True when livekit_api_key is stored (key itself never returned)',
  })
  livekit_api_key_set: boolean;

  @ApiProperty({
    description:
      'True when livekit_api_secret is stored (secret itself never returned)',
  })
  livekit_api_secret_set: boolean;

  @ApiPropertyOptional({
    description: 'Preview of agent API key (last 4 chars)',
  })
  agent_api_key_preview: string | null;

  @ApiProperty({ description: 'Max concurrent calls platform-wide' })
  max_concurrent_calls: number;

  // Sprint Voice-UX-01: Conversational phrases (2026-02-27)
  @ApiPropertyOptional({
    description: 'Recovery messages when STT fails or gets empty input',
    type: [String],
  })
  recovery_messages: string[] | null;

  @ApiPropertyOptional({
    description: 'Filler phrases spoken before tool execution',
    type: [String],
  })
  filler_phrases: string[] | null;

  @ApiPropertyOptional({
    description: 'Messages during long tool execution (>20s)',
    type: [String],
  })
  long_wait_messages: string[] | null;

  @ApiPropertyOptional({
    description: 'Generic system error messages',
    type: [String],
  })
  system_error_messages: string[] | null;

  @ApiPropertyOptional({
    description: 'Per-tool LLM instruction overrides (JSON string)',
    nullable: true,
  })
  tool_instructions: string | null;

  @ApiProperty({ description: 'Last updated timestamp' })
  updated_at: Date;

  @ApiPropertyOptional({ description: 'User ID who last updated this config' })
  updated_by: string | null;
}
