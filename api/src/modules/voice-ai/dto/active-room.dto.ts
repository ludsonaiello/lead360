import { ApiProperty } from '@nestjs/swagger';

/**
 * ActiveRoomDto
 *
 * Response DTO for GET /api/v1/system/voice-ai/rooms
 * Represents a single active call (voice_call_log with status='in_progress').
 *
 * Sprint BAS25 — Admin Monitoring
 */
export class ActiveRoomDto {
  @ApiProperty({
    description: 'Call log UUID',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  tenant_id: string;

  @ApiProperty({
    description: 'Tenant company name',
    example: 'Acme Plumbing',
  })
  company_name: string;

  @ApiProperty({
    description: 'Call SID (unique identifier from telephony provider)',
    example: 'CA123456789abcdef',
  })
  call_sid: string;

  @ApiProperty({
    description: 'LiveKit room name',
    example: 'tenant_abc123_call_CA123456',
    nullable: true,
  })
  room_name: string | null;

  @ApiProperty({
    description: 'Caller phone number',
    example: '+15551234567',
  })
  from_number: string;

  @ApiProperty({
    description: 'Called phone number',
    example: '+15559876543',
  })
  to_number: string;

  @ApiProperty({
    description: 'Call direction (inbound or outbound)',
    example: 'inbound',
  })
  direction: string;

  @ApiProperty({
    description: 'Duration of the call in seconds (from start to now)',
    example: 127,
  })
  duration_seconds: number;

  @ApiProperty({
    description: 'Timestamp when the call started',
    example: '2026-02-22T14:30:00.000Z',
  })
  started_at: Date;
}
