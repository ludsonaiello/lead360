import { ApiProperty } from '@nestjs/swagger';

/**
 * Transcription Response DTO
 *
 * Response structure for transcription data including dual-channel support
 */
export class TranscriptionResponseDto {
  @ApiProperty({
    description: 'Transcription ID',
    example: 'trans-uuid-here',
  })
  id: string;

  @ApiProperty({
    description: 'Tenant ID',
    example: 'tenant-uuid-here',
    nullable: true,
  })
  tenant_id: string | null;

  @ApiProperty({
    description: 'Call record ID',
    example: 'call-uuid-here',
  })
  call_record_id: string;

  @ApiProperty({
    description: 'Transcription provider name',
    example: 'openai_whisper',
  })
  transcription_provider: string;

  @ApiProperty({
    description: 'Transcription status',
    example: 'completed',
    enum: ['queued', 'processing', 'completed', 'failed'],
  })
  status: string;

  @ApiProperty({
    description:
      'Full merged transcription text with speaker labels and timestamps',
    example:
      '[00:00:00] Business: Hello, this is John.\n[00:00:03] Lead: Hi, I need help.',
    nullable: true,
  })
  transcription_text: string | null;

  @ApiProperty({
    description: 'Number of audio channels (1=mono, 2=stereo)',
    example: 2,
    nullable: true,
    required: false,
  })
  channel_count?: number | null;

  @ApiProperty({
    description: 'Channel 1 (left) speaker label',
    example: 'Solar Solutions',
    nullable: true,
    required: false,
  })
  speaker_1_label?: string | null;

  @ApiProperty({
    description: 'Channel 2 (right) speaker label',
    example: 'Maria Silva',
    nullable: true,
    required: false,
  })
  speaker_2_label?: string | null;

  @ApiProperty({
    description: 'Channel 1 transcription with timestamps (JSON)',
    example: '[{"start":0.0,"end":3.5,"text":"Hello, this is John."}]',
    nullable: true,
    required: false,
  })
  speaker_1_transcription?: string | null;

  @ApiProperty({
    description: 'Channel 2 transcription with timestamps (JSON)',
    example: '[{"start":3.8,"end":7.2,"text":"Hi, I need help."}]',
    nullable: true,
    required: false,
  })
  speaker_2_transcription?: string | null;

  @ApiProperty({
    description:
      'Language code requested for transcription (from tenant settings)',
    example: 'en',
    nullable: true,
    required: false,
  })
  language_requested?: string | null;

  @ApiProperty({
    description: 'Language detected by provider',
    example: 'en',
    nullable: true,
  })
  language_detected: string | null;

  @ApiProperty({
    description: 'Confidence score (0.00-1.00)',
    example: 0.95,
    nullable: true,
  })
  confidence_score: number | null;

  @ApiProperty({
    description: 'Processing duration in seconds',
    example: 12,
    nullable: true,
  })
  processing_duration_seconds: number | null;

  @ApiProperty({
    description: 'Transcription cost (USD)',
    example: 0.12,
    nullable: true,
  })
  cost: number | null;

  @ApiProperty({
    description: 'Error message (if status is failed)',
    example: null,
    nullable: true,
  })
  error_message: string | null;

  @ApiProperty({
    description: 'Transcription created timestamp',
    example: '2024-01-15T10:30:00.000Z',
  })
  created_at: Date;

  @ApiProperty({
    description: 'Transcription completed timestamp',
    example: '2024-01-15T10:30:12.000Z',
    nullable: true,
  })
  completed_at: Date | null;
}

/**
 * Transcription with Call Record Response DTO
 *
 * Extended transcription response including call record details
 */
export class TranscriptionWithCallRecordResponseDto extends TranscriptionResponseDto {
  @ApiProperty({
    description: 'Call record details',
  })
  call_record: {
    id: string;
    twilio_call_sid: string;
    from_number: string;
    to_number: string;
    direction: string;
    call_type: string | null;
    recording_url: string | null;
    recording_duration_seconds: number | null;
    call_duration_seconds: number | null;
    created_at: Date;
  };
}

/**
 * Search/List Transcriptions Response DTO
 *
 * Paginated response for transcription searches and listings
 */
export class TranscriptionsListResponseDto {
  @ApiProperty({
    description: 'Array of transcription results',
    type: [TranscriptionWithCallRecordResponseDto],
  })
  data: TranscriptionWithCallRecordResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata',
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };

  @ApiProperty({
    description: 'Search query (if applicable)',
    example: 'quote estimate pricing',
    nullable: true,
    required: false,
  })
  query?: string;
}
