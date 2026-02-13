import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for SMS sending
 *
 * Returns tracking information for queued SMS.
 * Use communication_event_id to track delivery status via history endpoint.
 */
export class SendSmsResponseDto {
  @ApiProperty({
    description: 'Communication event UUID (use this to track delivery status)',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  communication_event_id: string;

  @ApiProperty({
    description: 'BullMQ job ID for tracking in queue',
    example: '12345',
  })
  job_id: string;

  @ApiProperty({
    description: 'Current status (will be "queued" initially)',
    example: 'queued',
    enum: ['queued'],
  })
  status: string;

  @ApiProperty({
    description: 'Success message',
    example: 'SMS queued for delivery',
  })
  message: string;

  @ApiProperty({
    description: 'Recipient phone number',
    example: '+12025551234',
  })
  to_phone: string;

  @ApiProperty({
    description: 'Sender phone number (from tenant SMS config)',
    example: '+19781234567',
  })
  from_phone: string;

  @ApiProperty({
    description:
      'Scheduled delivery time (ISO 8601 format). Only present if SMS is scheduled for future delivery.',
    example: '2026-02-14T09:00:00.000Z',
    required: false,
  })
  scheduled_at?: string;
}
