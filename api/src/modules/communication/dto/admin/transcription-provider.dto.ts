import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsUrl,
  IsObject,
  IsInt,
  IsNumber,
  Min,
} from 'class-validator';

/**
 * Create Transcription Provider DTO
 *
 * Request body for creating a new transcription provider configuration.
 *
 * @class CreateTranscriptionProviderDto
 */
export class CreateTranscriptionProviderDto {
  @ApiProperty({
    required: false,
    description: 'Tenant ID (optional, for creating tenant-specific provider)',
    example: 'tenant-uuid-here',
  })
  @IsOptional()
  @IsString()
  tenant_id?: string;

  @ApiProperty({
    description: 'Provider name/type',
    example: 'openai_whisper',
    enum: ['openai_whisper', 'assemblyai', 'deepgram'],
  })
  @IsString()
  @IsEnum(['openai_whisper', 'assemblyai', 'deepgram'])
  provider_name: string;

  @ApiProperty({
    description: 'API key for the provider (will be encrypted)',
    example: 'sk-proj-...',
  })
  @IsString()
  api_key: string;

  @ApiProperty({
    required: false,
    description: 'API endpoint URL (if different from default)',
    example: 'https://api.openai.com/v1/audio/transcriptions',
  })
  @IsOptional()
  @IsUrl()
  api_endpoint?: string;

  @ApiProperty({
    required: false,
    description:
      'Model to use for transcription. Supported: whisper-1 (classic), gpt-4o-transcribe (GPT-4o with diarization)',
    example: 'whisper-1',
    examples: ['whisper-1', 'gpt-4o-transcribe-diarize-api-ev3'],
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    required: false,
    description: 'Language code for transcription',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({
    required: false,
    description: 'Additional provider-specific settings',
    example: { temperature: 0, response_format: 'json' },
  })
  @IsOptional()
  @IsObject()
  additional_settings?: any;

  @ApiProperty({
    required: false,
    description: 'Set as system default provider',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_system_default?: boolean;

  @ApiProperty({
    required: false,
    description: 'Monthly usage limit (transcription requests)',
    example: 10000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  usage_limit?: number;

  @ApiProperty({
    required: false,
    description: 'Cost per minute of transcription (USD)',
    example: 0.006,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_per_minute?: number;
}

/**
 * Update Transcription Provider DTO
 *
 * Request body for updating an existing transcription provider configuration.
 *
 * @class UpdateTranscriptionProviderDto
 */
export class UpdateTranscriptionProviderDto {
  @ApiProperty({
    required: false,
    description: 'New API key for the provider (will be encrypted)',
    example: 'sk-proj-...',
  })
  @IsOptional()
  @IsString()
  api_key?: string;

  @ApiProperty({
    required: false,
    description: 'API endpoint URL',
    example: 'https://api.openai.com/v1/audio/transcriptions',
  })
  @IsOptional()
  @IsUrl()
  api_endpoint?: string;

  @ApiProperty({
    required: false,
    description:
      'Model to use for transcription. Supported: whisper-1 (classic), gpt-4o-transcribe (GPT-4o with diarization)',
    example: 'whisper-1',
    examples: ['whisper-1', 'gpt-4o-transcribe-diarize-api-ev3'],
  })
  @IsOptional()
  @IsString()
  model?: string;

  @ApiProperty({
    required: false,
    description: 'Language code for transcription',
    example: 'en',
  })
  @IsOptional()
  @IsString()
  language?: string;

  @ApiProperty({
    required: false,
    description: 'Additional provider-specific settings',
    example: { temperature: 0, response_format: 'json' },
  })
  @IsOptional()
  @IsObject()
  additional_settings?: any;

  @ApiProperty({
    required: false,
    description: 'Provider status',
    example: 'active',
    enum: ['active', 'inactive'],
  })
  @IsOptional()
  @IsEnum(['active', 'inactive'])
  status?: string;

  @ApiProperty({
    required: false,
    description: 'Monthly usage limit (transcription requests)',
    example: 10000,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  usage_limit?: number;

  @ApiProperty({
    required: false,
    description: 'Cost per minute of transcription (USD)',
    example: 0.006,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  cost_per_minute?: number;

  @ApiProperty({
    required: false,
    description: 'Set/unset as system default provider',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  is_system_default?: boolean;
}

/**
 * Test Transcription Provider DTO
 *
 * Request body for testing transcription provider API connectivity.
 *
 * @class TestTranscriptionProviderDto
 */
export class TestTranscriptionProviderDto {
  @ApiProperty({
    required: false,
    description:
      'URL of audio file to test transcription (if not provided, uses default test file)',
    example: 'https://storage.example.com/test-audio.mp3',
  })
  @IsOptional()
  @IsUrl()
  audio_url?: string;
}
