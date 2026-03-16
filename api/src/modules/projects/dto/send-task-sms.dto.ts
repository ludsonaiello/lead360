import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsUUID,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for sending SMS from a task context.
 *
 * Phone resolution priority:
 *   1. dto.to_phone (explicit E.164 number)
 *   2. Lead's primary phone (via project.lead_id)
 *
 * If project.lead_id is null (standalone project), to_phone is required.
 */
export class SendTaskSmsDto {
  @ApiProperty({
    description:
      'Recipient phone number in E.164 format (e.g., +19781234567). ' +
      'If omitted, resolved from the project lead\'s primary phone.',
    example: '+19781234567',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message: 'Phone number must be in E.164 format (e.g., +19781234567)',
  })
  to_phone?: string;

  @ApiProperty({
    description: 'SMS message body (max 1600 characters)',
    example: 'Hi John, your roof installation starts tomorrow at 8 AM.',
    maxLength: 1600,
  })
  @IsNotEmpty({ message: 'text_body is required' })
  @IsString()
  @MaxLength(1600, {
    message: 'SMS message cannot exceed 1600 characters',
  })
  text_body: string;

  @ApiProperty({
    description:
      'Optional lead UUID. If omitted, auto-resolved from project.lead_id.',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    required: false,
  })
  @IsOptional()
  @IsUUID('4', { message: 'lead_id must be a valid UUID' })
  lead_id?: string;
}
