import { ApiProperty } from '@nestjs/swagger';

/**
 * Sprint BAS15: Call log response DTO
 * Returned by all list endpoints (tenant and admin)
 */
export class VoiceCallLogResponseDto {
  @ApiProperty({ description: 'Call log UUID' })
  id: string;

  @ApiProperty({ description: 'Tenant UUID' })
  tenant_id: string;

  @ApiProperty({ description: 'Twilio CallSid' })
  call_sid: string;

  @ApiProperty({ description: 'Caller phone number' })
  from_number: string;

  @ApiProperty({ description: 'Called phone number' })
  to_number: string;

  @ApiProperty({ description: 'Call direction', enum: ['inbound', 'outbound'] })
  direction: string;

  @ApiProperty({ description: 'Call status', enum: ['in_progress', 'completed', 'failed', 'transferred'] })
  status: string;

  @ApiProperty({ description: 'Call outcome', enum: ['lead_created', 'transferred', 'abandoned'], nullable: true })
  outcome: string | null;

  @ApiProperty({ description: 'Whether this call exceeded plan limits' })
  is_overage: boolean;

  @ApiProperty({ description: 'Call duration in seconds', nullable: true })
  duration_seconds: number | null;

  @ApiProperty({ description: 'AI-generated transcript summary', nullable: true })
  transcript_summary: string | null;

  @ApiProperty({ description: 'Full STT transcript', nullable: true })
  full_transcript: string | null;

  @ApiProperty({ description: 'Actions taken during call (JSON array)', nullable: true, type: [String] })
  actions_taken: string[] | null;

  @ApiProperty({ description: 'Lead UUID created/matched during call', nullable: true })
  lead_id: string | null;

  @ApiProperty({ description: 'STT provider UUID used', nullable: true })
  stt_provider_id: string | null;

  @ApiProperty({ description: 'LLM provider UUID used', nullable: true })
  llm_provider_id: string | null;

  @ApiProperty({ description: 'TTS provider UUID used', nullable: true })
  tts_provider_id: string | null;

  @ApiProperty({ description: 'Call start timestamp' })
  started_at: Date;

  @ApiProperty({ description: 'Call end timestamp', nullable: true })
  ended_at: Date | null;

  @ApiProperty({ description: 'Record creation timestamp' })
  created_at: Date;
}

/**
 * Pagination metadata
 */
export class PaginationMetaDto {
  @ApiProperty({ description: 'Total number of records' })
  total: number;

  @ApiProperty({ description: 'Current page number (1-indexed)' })
  page: number;

  @ApiProperty({ description: 'Results per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  total_pages: number;
}

/**
 * Paginated call logs response
 */
export class PaginatedCallLogsDto {
  @ApiProperty({ description: 'Array of call log records', type: [VoiceCallLogResponseDto] })
  data: VoiceCallLogResponseDto[];

  @ApiProperty({ description: 'Pagination metadata' })
  meta: PaginationMetaDto;
}

/**
 * Sprint BAS15: Usage report aggregate DTO (admin only)
 */
export class UsageReportDto {
  @ApiProperty({ description: 'Total number of calls in period' })
  total_calls: number;

  @ApiProperty({ description: 'Total duration in seconds' })
  total_duration_seconds: number;

  @ApiProperty({ description: 'Number of overage calls' })
  overage_calls: number;

  @ApiProperty({ description: 'Total estimated cost in USD' })
  total_estimated_cost: number;

  @ApiProperty({ description: 'Breakdown by provider type (STT, LLM, TTS)' })
  by_provider_type: {
    provider_type: string;
    total_quantity: number;
    usage_unit: string;
    estimated_cost: number;
  }[];

  @ApiProperty({ description: 'Breakdown by outcome' })
  by_outcome: {
    outcome: string | null;
    count: number;
  }[];
}
