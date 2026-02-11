import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsBoolean } from 'class-validator';

/**
 * Update Communication Event Status DTO
 *
 * Request body for manually updating message status.
 *
 * @class UpdateCommunicationEventStatusDto
 */
export class UpdateCommunicationEventStatusDto {
  @ApiProperty({
    description: 'New status for the communication event',
    example: 'delivered',
    enum: ['pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked'],
  })
  @IsString()
  @IsEnum(['pending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked'], {
    message:
      'Status must be one of: pending, sent, delivered, failed, bounced, opened, clicked',
  })
  status: string;

  @ApiProperty({
    description: 'Reason for manual status change (for audit log)',
    example: 'Webhook was missed, manually confirmed delivery with customer',
  })
  @IsString()
  reason: string;
}

/**
 * Delete Communication Event DTO
 *
 * Request body for deleting communication events.
 *
 * @class DeleteCommunicationEventDto
 */
export class DeleteCommunicationEventDto {
  @ApiProperty({
    description: 'Reason for deletion (required for audit log)',
    example: 'Test message sent to production environment',
  })
  @IsString()
  reason: string;

  @ApiProperty({
    required: false,
    description:
      'Force delete even if message was delivered or recent (bypasses safety checks)',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
