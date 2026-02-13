import { Decimal } from '@prisma/client/runtime/library';
import { TranscriptSegment } from '../services/transcript-merger.service';

/**
 * Call record with all necessary relations for transcription processing
 * Replaces 'any' type with strict typing
 */
export interface CallRecordWithRelations {
  id: string;
  tenant_id: string | null;
  lead_id: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  direction: string;
  from_number: string;
  to_number: string;
  cost: Decimal | null;
  tenant: {
    company_name: string;
    default_language: string | null;
  } | null;
  lead: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

/**
 * Transcription provider configuration with decrypted config
 * Replaces 'any' type for provider
 */
export interface TranscriptionProviderConfig {
  id: string;
  provider_name: string;
  cost_per_minute: Decimal | null;
}

/**
 * OpenAI Whisper configuration (decrypted)
 * Replaces 'any' type for config
 */
export interface OpenAIWhisperConfig {
  api_key: string;
  model?: string; // 'whisper-1', 'gpt-4o-transcribe', 'gpt-4o-transcribe-diarize'
  language?: string; // Deprecated - now comes from tenant settings
}

/**
 * Transcription result from provider with full metadata
 * Strict typing for transcription responses
 */
export interface TranscriptionResult {
  text: string;
  language: string;
  segments: TranscriptSegment[];
  confidence: number;
}

/**
 * Job data payload from BullMQ queue
 */
export interface TranscriptionJobData {
  callRecordId: string;
  transcriptionId: string;
}
