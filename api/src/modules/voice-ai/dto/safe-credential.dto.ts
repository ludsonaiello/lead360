import { ApiProperty } from '@nestjs/swagger';

/**
 * SafeCredentialDto
 *
 * Safe representation of a voice AI credential.
 * NEVER includes the encrypted_api_key — only the masked representation is exposed.
 */
export class SafeCredentialDto {
  @ApiProperty({
    description: 'Credential UUID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'Provider UUID',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  provider_id: string;

  @ApiProperty({
    description: 'Masked API key (first 4 + ... + last 4 characters)',
    example: 'sk-p...xyz',
  })
  masked_api_key: string;

  @ApiProperty({
    description: 'Additional provider-specific configuration (JSON string)',
    example: '{"region": "us-west-1"}',
    nullable: true,
  })
  additional_config: string | null;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2026-01-15T10:30:00Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2026-01-20T14:45:00Z',
  })
  updated_at: Date;

  @ApiProperty({
    description: 'User ID who last updated this credential',
    example: '123e4567-e89b-12d3-a456-426614174002',
    nullable: true,
  })
  updated_by: string | null;
}
