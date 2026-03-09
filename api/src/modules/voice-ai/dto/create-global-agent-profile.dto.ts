import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsInt,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * CreateGlobalAgentProfileDto
 *
 * DTO for creating a global voice agent profile (system admin only).
 * Global profiles are available to all tenants for selection/customization.
 *
 * Required fields: language_code, language_name, voice_id, display_name
 * Optional fields: default_greeting, default_instructions, description, display_order
 * Defaults: is_active=true, voice_provider_type='tts', display_order=0
 */
export class CreateGlobalAgentProfileDto {
  @ApiProperty({
    description:
      'ISO 639-1 language code (2-letter code). Examples: en, pt, es, fr, de',
    minLength: 2,
    maxLength: 10,
    example: 'en',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  language_code: string;

  @ApiProperty({
    description: 'Human-readable language name. Shown in UI.',
    minLength: 1,
    maxLength: 100,
    example: 'English',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  language_name: string;

  @ApiProperty({
    description:
      'TTS provider voice identifier (e.g., Cartesia voice UUID). ' +
      'Must be valid for the selected TTS provider.',
    minLength: 1,
    maxLength: 200,
    example: '2b568345-1f36-4cf8-baa7-5932856bf66a',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  voice_id: string;

  @ApiPropertyOptional({
    description:
      'Voice provider type. Default: tts. Used for future provider routing.',
    maxLength: 20,
    example: 'tts',
    default: 'tts',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  voice_provider_type?: string;

  @ApiProperty({
    description:
      'Display name shown in admin UI and tenant profile selector. ' +
      'Should be descriptive and unique (e.g., "English - Professional", "Portuguese - Friendly").',
    minLength: 1,
    maxLength: 100,
    example: 'English - Professional',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  display_name: string;

  @ApiPropertyOptional({
    description:
      'Optional description explaining when to use this profile. Shown in UI tooltips.',
    nullable: true,
    example:
      'Professional English voice optimized for business calls. Clear, formal tone.',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Default greeting template. Use {business_name} placeholder for tenant name. ' +
      'Tenants can override this per their preferences.',
    nullable: true,
    example:
      'Hello, thank you for calling {business_name}! How can I help you today?',
  })
  @IsOptional()
  @IsString()
  default_greeting?: string;

  @ApiPropertyOptional({
    description:
      'Default system instructions for the LLM. Tenants can override this. ' +
      'Should describe the assistant personality and behavior.',
    nullable: true,
    example:
      'You are a professional phone assistant for a service business. ' +
      'Be concise, friendly, and helpful. Keep responses under 20 seconds.',
  })
  @IsOptional()
  @IsString()
  default_instructions?: string;

  @ApiPropertyOptional({
    description: 'Active status. Default: true. Set to false to soft-delete.',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description:
      'Display order in UI (lower numbers appear first). Default: 0.',
    minimum: 0,
    maximum: 9999,
    default: 0,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  display_order?: number;
}
