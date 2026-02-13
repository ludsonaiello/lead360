import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsObject,
  IsBoolean,
  IsOptional,
  IsEnum,
} from 'class-validator';

/**
 * Register Transcription Provider DTO
 *
 * Request body for registering a new transcription provider
 */
export class RegisterTranscriptionProviderDto {
  @ApiProperty({
    description: 'Provider name',
    example: 'openai_whisper',
    enum: ['openai_whisper', 'oracle', 'assemblyai', 'deepgram'],
  })
  @IsString()
  @IsEnum(['openai_whisper', 'oracle', 'assemblyai', 'deepgram'])
  provider_name: string;

  @ApiProperty({
    description: 'Provider configuration (provider-specific)',
    example: {
      api_key: 'sk-...',
      model: 'whisper-1',
      language: 'en',
    },
  })
  @IsObject()
  configuration: any;

  @ApiProperty({
    description: 'Whether this is the system default provider',
    example: true,
    default: false,
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  is_system_default?: boolean = false;
}

/**
 * OpenAI Whisper Configuration DTO
 *
 * Configuration object for OpenAI Whisper provider
 */
export class OpenAIWhisperConfigDto {
  @ApiProperty({
    description: 'OpenAI API key',
    example: 'sk-...',
  })
  @IsString()
  api_key: string;

  @ApiProperty({
    description: 'Whisper model name',
    example: 'whisper-1',
    default: 'whisper-1',
    required: false,
  })
  @IsOptional()
  @IsString()
  model?: string = 'whisper-1';

  @ApiProperty({
    description: 'Language code (ISO 639-1) for transcription',
    example: 'en',
    required: false,
  })
  @IsOptional()
  @IsString()
  language?: string;
}
