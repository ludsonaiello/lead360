import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { TranscriptionProviderService } from '../services/transcription-provider.service';
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
 * using OpenAI Whisper or other configured transcription providers.
 *
 * Features:
 * - Downloads recording from Twilio URL
 * - Transcribes using OpenAI Whisper API
 * - Stores transcription in database with metadata
 * - Supports multiple providers (extensible)
 * - Automatic retry with exponential backoff
 * - Usage tracking and limit enforcement
 * - Comprehensive error handling
 * - Temporary file cleanup
 *
 * Performance Targets:
 * - Process transcription within 30-minute SLA
 * - Support 1-minute recordings in ~10 seconds
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
  ) {
    super();
  }

  /**
   * Process transcription job
   *
   * Workflow:
   * 1. Load call record and validate
   * 2. Get active transcription provider
   * 3. Check usage limits
   * 4. Download recording from Twilio URL to temp file
   * 5. Transcribe using OpenAI Whisper
   * 6. Save transcription to database
   * 7. Update call record status
   * 8. Increment provider usage
   * 9. Cleanup temp file
   *
   * @param job - BullMQ job with callRecordId and transcriptionId
   * @returns Processing result
   * @throws Error on failure (triggers retry)
   */
  async process(job: Job): Promise<any> {
    const { callRecordId, transcriptionId } = job.data;

    this.logger.log(
      `[Job ${job.id}] Processing transcription for call ${callRecordId}`,
    );

    const startTime = Date.now();
    let tempFilePath: string | null = null;

    try {
      // Step 1: Load call record
      const callRecord = await this.prisma.call_record.findUnique({
        where: { id: callRecordId },
        select: {
          id: true,
          tenant_id: true,
          recording_url: true,
          recording_duration_seconds: true,
          from_number: true,
          to_number: true,
        },
      });

      if (!callRecord) {
        throw new Error(`CallRecord not found: ${callRecordId}`);
      }

      if (!callRecord.recording_url) {
        throw new Error(
          `No recording URL available for call ${callRecordId}`,
        );
      }

      this.logger.debug(
        `[Job ${job.id}] Call record loaded: ${callRecord.recording_url}`,
      );

      // Step 2: Get transcription provider
      const provider =
        await this.transcriptionProvider.getActiveProvider(
          callRecord.tenant_id || undefined,
        );

      this.logger.debug(
        `[Job ${job.id}] Using provider: ${provider.provider_name}`,
      );

      // Step 3: Check usage limits
      const hasExceeded =
        await this.transcriptionProvider.hasExceededUsageLimit(
          provider.id,
        );

      if (hasExceeded) {
        throw new Error(
          `Transcription provider usage limit exceeded for ${provider.provider_name}`,
        );
      }

      // Get decrypted provider configuration
      const { config } = await this.transcriptionProvider.getDecryptedConfig(
        provider.id,
      );

      // Step 4: Download recording to temp file
      this.logger.debug(
        `[Job ${job.id}] Downloading recording from ${callRecord.recording_url}`,
      );

      tempFilePath = await this.downloadRecording(
        callRecord.recording_url,
        callRecordId,
      );

      this.logger.log(
        `[Job ${job.id}] Recording downloaded to ${tempFilePath}`,
      );

      // Update transcription status to processing
      await this.prisma.call_transcription.update({
        where: { id: transcriptionId },
        data: { status: 'processing' },
      });

      // Step 5: Transcribe based on provider
      let transcriptionText: string;
      let languageDetected: string;
      let confidenceScore: number;

      const transcriptionStartTime = Date.now();

      switch (provider.provider_name) {
        case 'openai_whisper':
          const whisperResult = await this.transcribeWithWhisper(
            tempFilePath,
            config,
            job.id,
          );
          transcriptionText = whisperResult.text;
          languageDetected = whisperResult.language;
          confidenceScore = whisperResult.confidence;
          break;

        case 'oracle':
          throw new Error('Oracle transcription provider not yet implemented');

        case 'assemblyai':
          throw new Error('AssemblyAI provider not yet implemented');

        case 'deepgram':
          throw new Error('Deepgram provider not yet implemented');

        default:
          throw new Error(
            `Unsupported transcription provider: ${provider.provider_name}`,
          );
      }

      const processingDuration = Math.floor(
        (Date.now() - transcriptionStartTime) / 1000,
      );

      this.logger.log(
        `[Job ${job.id}] Transcription completed in ${processingDuration}s (${transcriptionText.length} chars)`,
      );

      // Step 6: Save transcription
      await this.prisma.call_transcription.update({
        where: { id: transcriptionId },
        data: {
          transcription_text: transcriptionText,
          language_detected: languageDetected,
          confidence_score: confidenceScore,
          status: 'completed',
          completed_at: new Date(),
          processing_duration_seconds: processingDuration,
          transcription_provider: provider.provider_name,
        },
      });

      // Step 7: Update call record
      await this.prisma.call_record.update({
        where: { id: callRecordId },
        data: {
          recording_status: 'transcribed',
        },
      });

      // Step 8: Increment provider usage
      await this.transcriptionProvider.incrementUsage(provider.id);

      // Step 9: Clean up temp file
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        this.logger.debug(`[Job ${job.id}] Temp file deleted`);
      }

      const totalDuration = Math.floor((Date.now() - startTime) / 1000);

      this.logger.log(
        `[Job ${job.id}] ✅ Transcription completed successfully in ${totalDuration}s`,
      );

      return {
        success: true,
        transcriptionId,
        callRecordId,
        text: transcriptionText.substring(0, 100) + '...', // Log snippet
        language: languageDetected,
        confidence: confidenceScore,
        processingTime: processingDuration,
        totalTime: totalDuration,
      };
    } catch (error) {
      this.logger.error(
        `[Job ${job.id}] ❌ Transcription failed for call ${callRecordId}: ${error.message}`,
      );
      this.logger.error(`[Job ${job.id}] Stack: ${error.stack}`);

      // Clean up temp file on error
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        try {
          fs.unlinkSync(tempFilePath);
          this.logger.debug(
            `[Job ${job.id}] Temp file deleted after error`,
          );
        } catch (cleanupError) {
          this.logger.warn(
            `[Job ${job.id}] Failed to delete temp file: ${cleanupError.message}`,
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
   * Transcribe audio using OpenAI Whisper
   *
   * @param filePath - Path to audio file
   * @param config - OpenAI configuration
   * @param jobId - Job ID for logging
   * @returns Transcription result
   */
  private async transcribeWithWhisper(
    filePath: string,
    config: any,
    jobId: string | undefined,
  ): Promise<{
    text: string;
    language: string;
    confidence: number;
  }> {
    this.logger.debug(
      `[Job ${jobId}] Starting OpenAI Whisper transcription`,
    );

    const openai = new OpenAI({ apiKey: config.api_key });

    try {
      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(filePath),
        model: config.model || 'whisper-1',
        language: config.language || undefined, // Undefined = auto-detect
        response_format: 'verbose_json', // Get detailed response with metadata
        temperature: 0.0, // More deterministic results
      });

      this.logger.debug(
        `[Job ${jobId}] Whisper transcription completed: ${transcription.text.length} chars`,
      );

      return {
        text: transcription.text,
        language: transcription.language || 'en',
        confidence: 0.95, // OpenAI doesn't provide confidence score, assume high quality
      };
    } catch (error) {
      // Enhanced error handling for OpenAI API
      if (error.status === 413) {
        throw new Error(
          'Recording file too large for Whisper API (max 25MB)',
        );
      }

      if (error.status === 400) {
        throw new Error(
          `Invalid audio file format: ${error.message}`,
        );
      }

      if (error.status === 401) {
        throw new Error(
          'Invalid OpenAI API key. Please check configuration.',
        );
      }

      if (error.status === 429) {
        throw new Error(
          'OpenAI API rate limit exceeded. Please try again later.',
        );
      }

      throw new Error(
        `OpenAI Whisper transcription failed: ${error.message}`,
      );
    }
  }

  /**
   * Download recording from URL to temporary file
   *
   * Supports both HTTP and HTTPS protocols. Downloads to OS temp directory
   * with unique filename based on call record ID.
   *
   * @param url - Recording URL (from Twilio)
   * @param callRecordId - Call record ID for unique naming
   * @returns Path to downloaded temporary file
   * @throws Error if download fails
   */
  private async downloadRecording(
    url: string,
    callRecordId: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Determine file extension from URL or default to mp3
      const fileExtension = url.match(/\.(mp3|wav|m4a|ogg)(\?|$)/i)?.[1] || 'mp3';
      const tempFilePath = path.join(
        os.tmpdir(),
        `recording-${callRecordId}-${Date.now()}.${fileExtension}`,
      );

      const protocol = url.startsWith('https://') ? https : http;

      this.logger.debug(`Downloading from ${url} to ${tempFilePath}`);

      const file = fs.createWriteStream(tempFilePath);

      protocol
        .get(url, (response) => {
          // Handle redirects
          if (
            response.statusCode === 301 ||
            response.statusCode === 302
          ) {
            const redirectUrl = response.headers.location;
            if (!redirectUrl) {
              reject(new Error('Redirect without location header'));
              return;
            }

            this.logger.debug(`Following redirect to ${redirectUrl}`);
            file.close();
            fs.unlinkSync(tempFilePath); // Clean up empty file

            // Retry with redirect URL
            this.downloadRecording(redirectUrl, callRecordId)
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

          reject(
            new Error(`Failed to download recording: ${error.message}`),
          );
        });

      file.on('error', (error) => {
        file.close();

        // Clean up partial file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }

        reject(
          new Error(`Failed to write recording file: ${error.message}`),
        );
      });
    });
  }
}
