import { IsNotEmpty, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * DTO for testing SMS configuration
 *
 * Validates the destination phone number for sending a test SMS.
 */
export class TestSmsConfigDto {
  @ApiProperty({
    description:
      'Destination phone number in E.164 format (e.g., +19781234567)',
    example: '+19781234567',
    pattern: '^\\+[1-9]\\d{1,14}$',
  })
  @IsNotEmpty({ message: 'Destination phone number is required' })
  @Matches(/^\+[1-9]\d{1,14}$/, {
    message:
      'Phone number must be in E.164 format (e.g., +19781234567). Must start with + and country code.',
  })
  to_phone: string;
}
