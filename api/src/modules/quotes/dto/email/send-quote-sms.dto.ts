import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class SendQuoteSmsDto {
  @ApiPropertyOptional({
    description: 'Recipient phone number (if different from lead phone)',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  recipient_phone?: string;

  @ApiPropertyOptional({
    description: 'Custom message to include in SMS',
    example: 'Your quote is ready',
    maxLength: 160,
  })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  custom_message?: string;
}

export class SendQuoteSmsResponseDto {
  @ApiProperty({
    description: 'Error message - SMS not yet available',
    example: 'SMS sending not yet available',
  })
  error: string;

  @ApiProperty({
    description: 'Planned for future release',
    example: 'Phase 2',
  })
  planned_for: string;
}
