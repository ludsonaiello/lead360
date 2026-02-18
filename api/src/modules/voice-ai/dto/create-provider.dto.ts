import {
  IsString,
  IsIn,
  IsOptional,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
  IsUrl,
  IsNumber,
  IsPositive,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateProviderDto {
  @ApiProperty({
    example: 'deepgram',
    description: 'Unique provider key (e.g. deepgram, openai, cartesia)',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  provider_key: string;

  @ApiProperty({
    example: 'STT',
    description: 'Provider type',
    enum: ['STT', 'LLM', 'TTS'],
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(['STT', 'LLM', 'TTS'])
  provider_type: string;

  @ApiProperty({
    example: 'Deepgram',
    description: 'Human-readable display name',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  display_name: string;

  @ApiPropertyOptional({
    example: 'State-of-the-art speech recognition with Nova-2 model',
    description: 'Optional provider description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'https://deepgram.com/favicon.ico',
    description: 'URL to provider logo image',
  })
  @IsOptional()
  @IsUrl()
  logo_url?: string;

  @ApiPropertyOptional({
    example: 'https://developers.deepgram.com',
    description: 'URL to provider documentation',
  })
  @IsOptional()
  @IsUrl()
  documentation_url?: string;

  @ApiPropertyOptional({
    example: '["streaming","multilingual","punctuation"]',
    description: 'JSON array string of provider capabilities',
  })
  @IsOptional()
  @IsString()
  capabilities?: string;

  @ApiPropertyOptional({
    description: 'JSON Schema string that drives dynamic config UI (FSA03)',
    example: '{"type":"object","properties":{"model":{"type":"string"}}}',
  })
  @IsOptional()
  @IsString()
  config_schema?: string;

  @ApiPropertyOptional({
    description: 'JSON object string with default configuration field values',
    example: '{"model":"nova-2","punctuate":true}',
  })
  @IsOptional()
  @IsString()
  default_config?: string;

  @ApiPropertyOptional({
    description: 'JSON object string with pricing information',
    example: '{"per_minute":0.0043}',
  })
  @IsOptional()
  @IsString()
  pricing_info?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the provider is active (default: true)',
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    example: 0.0000716,
    description: 'USD cost per 1 usage unit — e.g. 0.0000716 for Deepgram (per second of audio)',
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  cost_per_unit?: number;

  @ApiPropertyOptional({
    example: 'per_second',
    description: "Billing unit matching usage_unit on voice_usage_record: 'per_second' | 'per_token' | 'per_character'",
    enum: ['per_second', 'per_token', 'per_character'],
  })
  @IsOptional()
  @IsString()
  @IsIn(['per_second', 'per_token', 'per_character'])
  cost_unit?: string;
}
