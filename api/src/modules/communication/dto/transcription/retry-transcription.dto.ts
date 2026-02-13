import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

/**
 * DTO for retrying a failed transcription
 * Creates a new transcription attempt for the same call recording
 */
export class RetryTranscriptionDto {
  @ApiPropertyOptional({
    description: 'Optional reason for retry (for audit purposes)',
    example: 'Poor quality transcription, retrying with different settings',
  })
  @IsOptional()
  @IsString()
  reason?: string;
}

/**
 * Response DTO for retry transcription operation
 */
export class RetryTranscriptionResponseDto {
  @ApiProperty({
    description: 'ID of the new transcription record created',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  transcription_id: string;

  @ApiProperty({
    description: 'ID of the call record being re-transcribed',
    example: '123e4567-e89b-12d3-a456-426614174001',
  })
  call_record_id: string;

  @ApiProperty({
    description: 'ID of the previous transcription that was superseded',
    example: '123e4567-e89b-12d3-a456-426614174002',
  })
  previous_transcription_id: string;

  @ApiProperty({
    description: 'Retry count for this new transcription',
    example: 1,
  })
  retry_count: number;

  @ApiProperty({
    description: 'Status of the new transcription job',
    example: 'queued',
  })
  status: string;

  @ApiProperty({
    description: 'Recording URL that will be used for transcription',
    example: 'https://api.twilio.com/recordings/RE123...',
  })
  recording_url: string;

  @ApiProperty({
    description: 'Message describing the retry operation',
    example:
      'Transcription retry queued successfully. Previous attempt superseded.',
  })
  message: string;
}
