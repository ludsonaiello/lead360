import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength, IsOptional } from 'class-validator';

/**
 * UpsertCredentialDto
 *
 * Validates the plain API key submitted for a provider credential.
 * The key is encrypted server-side before storage — never stored in plaintext.
 */
export class UpsertCredentialDto {
  @ApiProperty({
    description:
      'Plain-text API key for the provider. Will be AES-256-GCM encrypted before storage. Never returned in responses.',
    minLength: 10,
    example: 'sk-proj-abcdefghij...',
  })
  @IsString()
  @MinLength(10)
  api_key: string;

  @ApiProperty({
    description:
      'Additional provider-specific configuration (JSON string). Can include region, model preferences, or other settings.',
    example: '{"region": "us-west-1", "model": "whisper-1"}',
    required: false,
  })
  @IsOptional()
  @IsString()
  additional_config?: string;
}
