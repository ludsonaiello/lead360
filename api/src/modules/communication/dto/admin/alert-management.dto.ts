import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsArray, ArrayMinSize } from 'class-validator';

/**
 * Acknowledge Alert DTO
 *
 * Request body for acknowledging an admin alert with optional comment.
 *
 * @class AcknowledgeAlertDto
 */
export class AcknowledgeAlertDto {
  @ApiProperty({
    required: false,
    description: 'Admin comment about the alert',
    example: 'Investigating this issue with development team',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

/**
 * Resolve Alert DTO
 *
 * Request body for resolving an admin alert with resolution notes.
 *
 * @class ResolveAlertDto
 */
export class ResolveAlertDto {
  @ApiProperty({
    description: 'Resolution notes describing how the issue was fixed',
    example: 'Issue resolved by restarting Twilio webhook processor service',
  })
  @IsString()
  resolution: string;
}

/**
 * Bulk Acknowledge Alerts DTO
 *
 * Request body for acknowledging multiple alerts at once.
 *
 * @class BulkAcknowledgeAlertsDto
 */
export class BulkAcknowledgeAlertsDto {
  @ApiProperty({
    description: 'Array of alert IDs to acknowledge',
    example: ['alert-uuid-1', 'alert-uuid-2', 'alert-uuid-3'],
    type: [String],
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one alert ID must be provided' })
  @IsString({ each: true })
  alert_ids: string[];

  @ApiProperty({
    required: false,
    description: 'Comment to apply to all alerts',
    example: 'Bulk acknowledged - investigating related issues',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}
