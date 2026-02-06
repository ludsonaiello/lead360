import { ApiProperty } from '@nestjs/swagger';

/**
 * Tenant WhatsApp Configuration Response DTO
 *
 * IMPORTANT: Credentials are NEVER included in API responses for security.
 * This DTO defines the safe structure returned to clients.
 */
export class TenantWhatsAppConfigResponseDto {
  @ApiProperty({
    description: 'Configuration UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Tenant UUID',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  tenant_id: string;

  @ApiProperty({
    description: 'Provider UUID',
    example: '550e8400-e29b-41d4-a716-446655440002',
  })
  provider_id: string;

  @ApiProperty({
    description: 'Twilio WhatsApp phone number (with whatsapp: prefix)',
    example: 'whatsapp:+19781234567',
  })
  from_phone: string;

  @ApiProperty({
    description: 'Whether this configuration is currently active',
    example: true,
  })
  is_active: boolean;

  @ApiProperty({
    description: 'Whether credentials have been verified by test message',
    example: true,
  })
  is_verified: boolean;

  @ApiProperty({
    description: 'Configuration creation timestamp',
    example: '2026-02-05T10:00:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Configuration last update timestamp',
    example: '2026-02-05T10:00:00.000Z',
  })
  updated_at: Date;

  // SECURITY: Credentials field is explicitly excluded
  // It is stripped in the service layer before returning to controller
}
