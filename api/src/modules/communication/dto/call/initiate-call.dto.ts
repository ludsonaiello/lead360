import { IsString, IsUUID, Matches, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * InitiateCallDto
 *
 * DTO for initiating an outbound call to a Lead.
 *
 * Call Flow:
 * 1. User requests to call a Lead via API
 * 2. System calls user's phone first
 * 3. When user answers, system bridges call to Lead
 * 4. Two-party call begins
 *
 * This pattern prevents "robocall" perception and ensures user is ready
 * before connecting to the Lead.
 */
export class InitiateCallDto {
  @ApiProperty({
    description: 'Lead ID to call',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @IsUUID(4, { message: 'lead_id must be a valid UUID' })
  lead_id: string;

  @ApiProperty({
    description:
      'User phone number to call first (E.164 format: +[country code][number])',
    example: '+12025551234',
    pattern: '^\\+[1-9]\\d{1,14}$',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'Phone number must be in E.164 format (e.g., +12025551234). Start with + followed by country code and number.',
  })
  user_phone_number: string;

  @ApiProperty({
    description: 'Reason for the call (optional)',
    example: 'Following up on quote request',
    required: false,
  })
  @IsOptional()
  @IsString()
  call_reason?: string;
}
