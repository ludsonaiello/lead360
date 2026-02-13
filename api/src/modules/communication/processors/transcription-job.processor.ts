import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { TranscriptionProviderService } from '../services/transcription-provider.service';
import { AudioProcessingService } from '../services/audio-processing.service';
import {
  SpeakerLabelResolverService,
  CallRecordForLabeling,
} from '../services/speaker-label-resolver.service';
import {
  TranscriptMergerService,
  TranscriptSegment,
} from '../services/transcript-merger.service';
import {
  CallRecordWithRelations,
  TranscriptionProviderConfig,
  OpenAIWhisperConfig,
  TranscriptionResult,
  TranscriptionJobData,
} from './transcription-job.types';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';

/**
 * Transcription Job Processor
 *
 * BullMQ processor that handles async transcription of call recordings
 * with dual-channel stereo support for speaker separation.
 *
 * Features:
 * - Downloads recording from Twilio URL
 * - Detects mono vs stereo audio
 * - Splits stereo channels for separate speaker transcription
 * - Transcribes using OpenAI Whisper or GPT-4o models
 * - Merges dual-channel transcriptions with timestamps and speaker labels
 * - Stores transcription in database with metadata
 * - Supports multiple providers (extensible)
 * - Automatic retry with exponential backoff
 * - Usage tracking and limit enforcement
 * - Comprehensive error handling
 * - Temporary file cleanup
 *
 * Performance Targets:
 * - Process transcription within 30-minute SLA
 * - Support 1-minute recordings in ~10 seconds (mono) or ~20 seconds (stereo)
 * - Handle concurrent jobs (up to 10 simultaneous)
 *
 * Error Handling:
 * - Network errors: Retry with backoff
 * - API errors: Retry with backoff
 * - Invalid audio: Mark as failed (no retry)
 * - Usage limit: Mark as failed (no retry)
 *
 * @example
 * Job payload:
 * ```typescript
 * {
 *   callRecordId: 'call-123',
 *   transcriptionId: 'trans-456'
 * }
 * ```
 */
@Processor('communication-call-transcription', {
  concurrency: 10, // Process up to 10 jobs simultaneously
  limiter: {
    max: 100, // Max 100 jobs
    duration: 60000, // Per minute
  },
})
export class TranscriptionJobProcessor extends WorkerHost {
  private readonly logger = new Logger(TranscriptionJobProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transcriptionProvider: TranscriptionProviderService,
    private readonly audioProcessing: AudioProcessingService,
    private readonly speakerLabelResolver: SpeakerLabelResolverService,
    private readonly transcriptMerger: TranscriptMergerService,
  ) {
    super();
  }

  /**
   * Process transcription job
   *
   * Workflow:
   * 1. Load call record with tenant and lead information
   * 2. Get active transcription provider
   * 3. Check usage limits
   * 4. Download recording from URL to temp directory
   * 5. Detect channel count (mono vs stereo)
   * 6. Get tenant language setting
   * 7. Branch: Process stereo (dual-channel) OR mono (legacy)
   * 8. Cleanup temp files
   *
   * @param job - BullMQ job with callRecordId and transcriptionId
   * @returns Processing result
   * @throws Error on failure (triggers retry)
   */
  async process(job: Job<TranscriptionJobData>): Promise<{
    success: boolean;
    transcriptionId: string;
    callRecordId: string;
    channelCount: number;
    totalTime: number;
  }> {
    const { callRecordId, transcriptionId } = job.data;

    this.logger.log(
      `[Job ${job.id}] Processing transcription for call ${callRecordId}`,
    );

    const startTime = Date.now();
    let tempDir: string | null = null;

    try {
      // Step 1: Load call record with tenant and lead
      const callRecord = await this.prisma.call_record.findUnique({
        where: { id: callRecordId },
        select: {
          id: true,
          tenant_id: true,
          lead_id: true,
          recording_url: true,
          recording_duration_seconds: true,
          direction: true,
          from_number: true,
          to_number: true,
          cost: true,
          tenant: {
            select: {
              company_name: true,
              default_language: true,
            },
          },
          lead: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      if (!callRecord) {
        throw new Error(`CallRecord not found: ${callRecordId}`);
      }

      if (!callRecord.recording_url) {
        throw new Error(`No recording URL available for call ${callRecordId}`);
      }

      this.logger.debug(
        `[Job ${job.id}] Call record loaded: ${callRecord.recording_url}`,
      );

      // Step 2: Get transcription provider
      const provider = await this.transcriptionProvider.getActiveProvider(
        callRecord.tenant_id || undefined,
      );

      this.logger.debug(
        `[Job ${job.id}] Using provider: ${provider.provider_name}`,
      );

      // Step 3: Check usage limits
      const hasExceeded =
        await this.transcriptionProvider.hasExceededUsageLimit(provider.id);

      if (hasExceeded) {
        throw new Error(
          `Transcription provider usage limit exceeded for ${provider.provider_name}`,
        );
      }

      // Get decrypted provider configuration
      const { config } = await this.transcriptionProvider.getDecryptedConfig(
        provider.id,
      );

      // Step 4: Create temp directory and download recording
      tempDir = path.join(
        os.tmpdir(),
        `transcription-${callRecordId}-${Date.now()}`,
      );
      await fs.promises.mkdir(tempDir, { recursive: true });

      this.logger.debug(
        `[Job ${job.id}] Downloading recording from ${callRecord.recording_url}`,
      );

      const originalFilePath = await this.downloadRecording(
        callRecord.recording_url,
        callRecordId,
        tempDir,
      );

      this.logger.log(
        `[Job ${job.id}] Recording downloaded to ${originalFilePath}`,
      );

      // Step 5: Detect channel count
      const channelCount =
        await this.audioProcessing.detectChannelCount(originalFilePath);

      this.logger.log(
        `[Job ${job.id}] Detected ${channelCount} channel(s) in recording`,
      );

      // Step 6: Get tenant language setting
      const language = callRecord.tenant?.default_language || 'en';

      this.logger.debug(`[Job ${job.id}] Using language: ${language}`);

      // Step 7: Branch based on channel count
      if (channelCount === 2) {
        // STEREO: Dual-channel transcription with speaker separation
        await this.processStereoRecording(
          callRecord,
          provider,
          config,
          originalFilePath,
          tempDir,
          language,
          transcriptionId,
          job.id,
        );
      } else {
        // MONO: Legacy single transcription flow (backward compatible)
        await this.processMonoRecording(
          callRecord,
          provider,
          config,
          originalFilePath,
          language,
          transcriptionId,
          job.id,
        );
      }

      // Step 8: Cleanup temp directory
      if (tempDir) {
        await this.audioProcessing.cleanupTempFiles([tempDir]);
        this.logger.debug(`[Job ${job.id}] Temp directory cleaned up`);
      }

      const totalDuration = Math.floor((Date.now() - startTime) / 1000);

      this.logger.log(
        `[Job ${job.id}] ✅ Transcription completed successfully in ${totalDuration}s`,
      );

      return {
        success: true,
        transcriptionId,
        callRecordId,
        channelCount,
        totalTime: totalDuration,
      };
    } catch (error) {
      this.logger.error(
        `[Job ${job.id}] ❌ Transcription failed for call ${callRecordId}: ${error.message}`,
      );
      this.logger.error(`[Job ${job.id}] Stack: ${error.stack}`);

      // Clean up temp directory on error
      if (tempDir) {
        try {
          await this.audioProcessing.cleanupTempFiles([tempDir]);
          this.logger.debug(
            `[Job ${job.id}] Temp directory deleted after error`,
          );
        } catch (cleanupError) {
          this.logger.warn(
            `[Job ${job.id}] Failed to delete temp directory: ${cleanupError.message}`,
          );
        }
      }

      // Update transcription status to failed
      try {
        await this.prisma.call_transcription.update({
          where: { id: transcriptionId },
          data: {
            status: 'failed',
            error_message: error.message,
          },
        });
      } catch (updateError) {
        this.logger.error(
          `[Job ${job.id}] Failed to update transcription status: ${updateError.message}`,
        );
      }

      // Re-throw error for BullMQ retry logic
      throw error;
    }
  }

  /**
   * Process stereo recording with dual-channel speaker separation
   *
   * Workflow:
   * 1. Split stereo into 2 mono WAV files (channel 1, channel 2)
   * 2. Determine speaker labels based on call direction
   * 3. Transcribe channel 1
   * 4. Transcribe channel 2
   * 5. Merge transcriptions by timestamp
   * 6. Save all results to database
   * 7. Update call record and costs
   * 8. Increment usage counter (2x for dual transcription)
   *
   * @param callRecord - Call record with tenant and lead info
   * @param provider - Transcription provider config
   * @param config - Decrypted provider configuration
   * @param stereoFilePath - Path to stereo audio file
   * @param tempDir - Temporary directory for processing
   * @param language - Language code for transcription
   * @param transcriptionId - Transcription record ID
   * @param jobId - Job ID for logging
   */
  private async processStereoRecording(
    callRecord: CallRecordWithRelations,
    provider: TranscriptionProviderConfig,
    config: OpenAIWhisperConfig,
    stereoFilePath: string,
    tempDir: string,
    language: string,
    transcriptionId: string,
    jobId: string | undefined,
  ): Promise<void> {
    this.logger.log(
      `[Job ${jobId}] Processing STEREO recording with dual-channel transcription`,
    );

    // Split channels
    this.logger.debug(`[Job ${jobId}] Splitting stereo channels...`);
    const { channel1Path, channel2Path } =
      await this.audioProcessing.splitStereoChannels(stereoFilePath, tempDir);

    // Determine speaker labels
    const callRecordForLabeling: CallRecordForLabeling = {
      direction: callRecord.direction,
      lead: callRecord.lead,
      tenant: callRecord.tenant,
    };

    const { speaker1Label, speaker2Label } =
      this.speakerLabelResolver.resolveSpeakerLabels(callRecordForLabeling);

    this.logger.debug(
      `[Job ${jobId}] Speaker labels: Channel 1 = "${speaker1Label}", Channel 2 = "${speaker2Label}"`,
    );

    // Update transcription with initial metadata
    await this.prisma.call_transcription.update({
      where: { id: transcriptionId },
      data: {
        status: 'processing',
        language_requested: language,
        channel_count: 2,
        speaker_1_label: speaker1Label,
        speaker_2_label: speaker2Label,
      },
    });

    // Transcribe both channels
    const transcriptionStartTime = Date.now();

    this.logger.debug(`[Job ${jobId}] Transcribing channel 1...`);
    const channel1Result = await this.transcribeAudioFile(
      channel1Path,
      provider.provider_name,
      config,
      language,
      jobId,
    );

    this.logger.debug(`[Job ${jobId}] Transcribing channel 2...`);
    const channel2Result = await this.transcribeAudioFile(
      channel2Path,
      provider.provider_name,
      config,
      language,
      jobId,
    );

    const processingDuration = Math.floor(
      (Date.now() - transcriptionStartTime) / 1000,
    );

    this.logger.log(
      `[Job ${jobId}] Both channels transcribed in ${processingDuration}s`,
    );

    // Merge transcriptions by timestamp
    this.logger.debug(`[Job ${jobId}] Merging transcriptions...`);
    const mergedTranscript = this.transcriptMerger.mergeTranscriptions(
      channel1Result.segments,
      channel2Result.segments,
      speaker1Label,
      speaker2Label,
    );

    this.logger.debug(
      `[Job ${jobId}] Merged transcript: ${mergedTranscript.length} characters`,
    );

    // Calculate cost (2x for dual channel)
    const durationMinutes = (callRecord.recording_duration_seconds || 0) / 60;
    const costPerChannel =
      durationMinutes * parseFloat(provider.cost_per_minute?.toString() || '0');
    const totalCost = costPerChannel * 2;

    this.logger.debug(
      `[Job ${jobId}] Transcription cost: $${totalCost.toFixed(4)} (${costPerChannel.toFixed(4)} × 2 channels)`,
    );

    // Calculate average confidence
    const averageConfidence =
      (channel1Result.confidence + channel2Result.confidence) / 2;

    // Save results
    await this.prisma.call_transcription.update({
      where: { id: transcriptionId },
      data: {
        speaker_1_transcription: JSON.stringify(channel1Result.segments),
        speaker_2_transcription: JSON.stringify(channel2Result.segments),
        transcription_text: mergedTranscript,
        language_detected: channel1Result.language, // Both should be same
        confidence_score: averageConfidence,
        status: 'completed',
        completed_at: new Date(),
        processing_duration_seconds: processingDuration,
        cost: totalCost,
      },
    });

    // Update call record
    const currentCallCost = callRecord.cost
      ? parseFloat(callRecord.cost.toString())
      : 0;
    const newTotalCost = currentCallCost + totalCost;

    await this.prisma.call_record.update({
      where: { id: callRecord.id },
      data: {
        recording_status: 'transcribed',
        cost: newTotalCost,
      },
    });

    this.logger.log(
      `[Job ${jobId}] 💰 Total cost updated: Call: $${currentCallCost.toFixed(4)} + Transcription: $${totalCost.toFixed(4)} = $${newTotalCost.toFixed(4)}`,
    );

    // Increment usage (2x for dual transcription)
    await this.transcriptionProvider.incrementUsage(provider.id, 2);

    this.logger.log(
      `[Job ${jobId}] ✅ Stereo transcription completed successfully`,
    );
  }

  /**
   * Process mono recording (legacy single transcription flow)
   *
   * Backward-compatible flow for mono recordings
   *
   * Workflow:
   * 1. Update transcription status with language
   * 2. Transcribe audio file
   * 3. Save results to database
   * 4. Update call record and costs
   * 5. Increment usage counter (1x for mono)
   *
   * @param callRecord - Call record
   * @param provider - Transcription provider config
   * @param config - Decrypted provider configuration
   * @param monoFilePath - Path to mono audio file
   * @param language - Language code for transcription
   * @param transcriptionId - Transcription record ID
   * @param jobId - Job ID for logging
   */
  private async processMonoRecording(
    callRecord: CallRecordWithRelations,
    provider: TranscriptionProviderConfig,
    config: OpenAIWhisperConfig,
    monoFilePath: string,
    language: string,
    transcriptionId: string,
    jobId: string | undefined,
  ): Promise<void> {
    this.logger.log(`[Job ${jobId}] Processing MONO recording (legacy flow)`);

    // Update transcription with language
    await this.prisma.call_transcription.update({
      where: { id: transcriptionId },
      data: {
        status: 'processing',
        language_requested: language,
        channel_count: 1,
      },
    });

    // Transcribe
    const transcriptionStartTime = Date.now();

    const result = await this.transcribeAudioFile(
      monoFilePath,
      provider.provider_name,
      config,
      language,
      jobId,
    );

    const processingDuration = Math.floor(
      (Date.now() - transcriptionStartTime) / 1000,
    );

    this.logger.log(
      `[Job ${jobId}] Transcription completed in ${processingDuration}s (${result.text.length} chars)`,
    );

    // Calculate cost (1x for mono)
    const durationMinutes = (callRecord.recording_duration_seconds || 0) / 60;
    const cost =
      durationMinutes * parseFloat(provider.cost_per_minute?.toString() || '0');

    this.logger.debug(`[Job ${jobId}] Transcription cost: $${cost.toFixed(4)}`);

    // Save results (legacy format - transcription_text only)
    await this.prisma.call_transcription.update({
      where: { id: transcriptionId },
      data: {
        transcription_text: result.text,
        language_detected: result.language,
        confidence_score: result.confidence,
        status: 'completed',
        completed_at: new Date(),
        processing_duration_seconds: processingDuration,
        cost: cost,
      },
    });

    // Update call record
    const currentCallCost = callRecord.cost
      ? parseFloat(callRecord.cost.toString())
      : 0;
    const newTotalCost = currentCallCost + cost;

    await this.prisma.call_record.update({
      where: { id: callRecord.id },
      data: {
        recording_status: 'transcribed',
        cost: newTotalCost,
      },
    });

    this.logger.log(
      `[Job ${jobId}] 💰 Total cost updated: Call: $${currentCallCost.toFixed(4)} + Transcription: $${cost.toFixed(4)} = $${newTotalCost.toFixed(4)}`,
    );

    // Increment usage (1x for mono)
    await this.transcriptionProvider.incrementUsage(provider.id, 1);

    this.logger.log(
      `[Job ${jobId}] ✅ Mono transcription completed successfully`,
    );
  }

  /**
   * Transcribe audio file using configured provider
   *
   * @param filePath - Path to audio file (mono WAV)
   * @param providerName - Provider name ('openai_whisper', etc.)
   * @param config - Provider configuration
   * @param language - Language code for transcription
   * @param jobId - Job ID for logging
   * @returns Transcription result with text, language, segments, confidence
   */
  private async transcribeAudioFile(
    filePath: string,
    providerName: string,
    config: OpenAIWhisperConfig,
    language: string,
    jobId: string | undefined,
  ): Promise<TranscriptionResult> {
    switch (providerName) {
      case 'openai_whisper':
        return await this.transcribeWithWhisper(
          filePath,
          config,
          language,
          jobId,
        );

      case 'oracle':
        throw new Error('Oracle transcription provider not yet implemented');

      case 'assemblyai':
        throw new Error('AssemblyAI provider not yet implemented');

      case 'deepgram':
        throw new Error('Deepgram provider not yet implemented');

      default:
        throw new Error(`Unsupported transcription provider: ${providerName}`);
    }
  }

  /**
   * Transcribe audio using OpenAI Whisper or GPT-4o models
   *
   * Supports both whisper-1 (verbose_json) and gpt-4o-transcribe (json) models
   *
   * @param filePath - Path to audio file
   * @param config - OpenAI configuration
   * @param language - Language code for transcription
   * @param jobId - Job ID for logging
   * @returns Transcription result with segments and timestamps
   */
  private async transcribeWithWhisper(
    filePath: string,
    config: OpenAIWhisperConfig,
    language: string,
    jobId: string | undefined,
  ): Promise<TranscriptionResult> {
    this.logger.debug(
      `[Job ${jobId}] Starting OpenAI Whisper transcription (language: ${language})`,
    );

    const openai = new OpenAI({ apiKey: config.api_key });

    try {
      const model = config.model || 'whisper-1';

      // GPT-4o transcription models use 'json' format, whisper-1 uses 'verbose_json'
      const isGpt4oModel =
        model.startsWith('gpt-4o-transcribe') || model === 'gpt-4o-transcribe';

      const responseFormat = isGpt4oModel ? 'json' : 'verbose_json';

      // ALL OpenAI models require base ISO-639-1 language codes (e.g., 'pt', 'en', 'es')
      // Extended codes like 'pt-BR', 'en-US' are NOT accepted by the API
      // Always extract base language code (e.g., 'pt-BR' → 'pt')
      const languageCode = language.split('-')[0];

      this.logger.debug(
        `[Job ${jobId}] Using model: ${model}, response_format: ${responseFormat}, language: ${languageCode} (original: ${language})`,
      );

      // Build params object based on model requirements
      const params: any = {
        file: fs.createReadStream(filePath),
        model: model,
        language: languageCode, // Always use base ISO-639-1 code (pt, en, es)
        response_format: responseFormat,
        temperature: 0.0, // Deterministic results
      };

      // Add timestamp granularities for verbose_json
      if (responseFormat === 'verbose_json') {
        params.timestamp_granularities = ['segment'];
      }

      // Add chunking_strategy for diarization models (required by API)
      if (model === 'gpt-4o-transcribe-diarize') {
        params.chunking_strategy = 'auto';
        this.logger.debug(
          `[Job ${jobId}] Added chunking_strategy: auto for diarization model`,
        );
      }

      const transcription = await openai.audio.transcriptions.create(params);

      this.logger.debug(
        `[Job ${jobId}] Whisper transcription completed: ${transcription.text.length} chars`,
      );

      // Extract segments
      let segments: TranscriptSegment[] = [];
      if (
        responseFormat === 'verbose_json' &&
        (transcription as any).segments
      ) {
        segments = (transcription as any).segments.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        }));
      } else if (responseFormat === 'json' && (transcription as any).segments) {
        // GPT-4o json format
        segments = (transcription as any).segments.map((seg: any) => ({
          start: seg.start,
          end: seg.end,
          text: seg.text,
        }));
      } else {
        // No segments - create single segment from full text
        segments = [
          {
            start: 0.0,
            end: 0.0,
            text: transcription.text,
          },
        ];
      }

      // Extract language
      const detectedLanguage = isGpt4oModel
        ? language // GPT-4o doesn't return language, use requested
        : (transcription as any).language || language;

      return {
        text: transcription.text,
        language: detectedLanguage,
        segments: segments,
        confidence: 0.95, // OpenAI doesn't provide confidence, assume high quality
      };
    } catch (error) {
      // Enhanced error handling for OpenAI API
      if (error.status === 413) {
        throw new Error('Recording file too large for Whisper API (max 25MB)');
      }

      if (error.status === 400) {
        throw new Error(`Invalid audio file format: ${error.message}`);
      }

      if (error.status === 401) {
        throw new Error('Invalid OpenAI API key. Please check configuration.');
      }

      if (error.status === 429) {
        throw new Error(
          'OpenAI API rate limit exceeded. Please try again later.',
        );
      }

      throw new Error(`OpenAI Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Download recording from URL to temporary directory
   *
   * Supports both HTTP and HTTPS protocols. Downloads to specified temp directory
   * with unique filename based on call record ID.
   *
   * @param url - Recording URL (from Twilio)
   * @param callRecordId - Call record ID for unique naming
   * @param tempDir - Temporary directory path
   * @returns Path to downloaded temporary file
   * @throws Error if download fails
   */
  private async downloadRecording(
    url: string,
    callRecordId: string,
    tempDir: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // IMPORTANT: Twilio recordings are ALWAYS WAV format (RIFF WAVE audio, PCM, 16-bit)
      // Even though the URL/filename may have .mp3 extension, the actual content is WAV.
      // OpenAI Whisper expects the file extension to match the actual format, so we use .wav
      const fileExtension = 'wav';
      const tempFilePath = path.join(tempDir, `original.${fileExtension}`);

      const protocol = url.startsWith('https://') ? https : http;

      this.logger.debug(`Downloading from ${url} to ${tempFilePath}`);

      const file = fs.createWriteStream(tempFilePath);

      protocol
        .get(url, (response) => {
          // Handle redirects
          if (response.statusCode === 301 || response.statusCode === 302) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              reject(new Error('Redirect without location header'));
              return;
            }

            this.logger.debug(`Following redirect to ${redirectUrl}`);
            file.close();
            fs.unlinkSync(tempFilePath); // Clean up empty file

            // Retry with redirect URL
            this.downloadRecording(redirectUrl, callRecordId, tempDir)
              .then(resolve)
              .catch(reject);
            return;
          }

          // Handle non-200 responses
          if (response.statusCode !== 200) {
            reject(
              new Error(
                `Failed to download recording: HTTP ${response.statusCode}`,
              ),
            );
            file.close();
            return;
          }

          // Pipe response to file
          response.pipe(file);

          file.on('finish', () => {
            file.close();

            // Validate file was written
            const stats = fs.statSync(tempFilePath);
            if (stats.size === 0) {
              reject(new Error('Downloaded file is empty'));
              return;
            }

            this.logger.debug(
              `Downloaded ${stats.size} bytes to ${tempFilePath}`,
            );
            resolve(tempFilePath);
          });
        })
        .on('error', (error) => {
          file.close();

          // Clean up partial file
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }

          reject(new Error(`Failed to download recording: ${error.message}`));
        });

      file.on('error', (error) => {
        file.close();

        // Clean up partial file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }

        reject(new Error(`Failed to write recording file: ${error.message}`));
      });
    });
  }
}
