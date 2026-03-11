import { Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { SttProvider, SttConfig, SttSession } from './stt.interface';
import { getConfigField, convertFlatToNested } from '../utils/config-helper';

/**
 * ElevenLabs Scribe v2 Realtime STT Provider
 *
 * Provides real-time speech-to-text transcription via WebSocket connection
 * to ElevenLabs Scribe v2 Realtime API.
 *
 * Key Features:
 * - Real-time streaming transcription (16kHz audio)
 * - Multilingual support (32+ languages)
 * - Native end-of-turn detection (VAD-based)
 * - Interim and final transcript support
 *
 * CRITICAL: All configuration is dynamic (no hardcoded API keys or models).
 * Configuration comes from context.providers.stt and is passed via SttConfig.
 *
 * PROTOCOL NOTES (ElevenLabs Scribe v2 Realtime):
 * - Configuration is passed via URL query parameters (NOT an init message)
 * - Audio is sent as JSON with base64-encoded data (NOT raw binary)
 * - Message type field is 'message_type' (NOT 'type')
 */
export class ElevenLabsSttProvider implements SttProvider {
  private readonly logger = new Logger(ElevenLabsSttProvider.name);

  async startTranscription(config: SttConfig): Promise<SttSession> {
    // Validate required configuration
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('ElevenLabs STT: apiKey is required');
    }

    // Convert flat config to nested (if schema uses dot notation)
    const dynamicConfig = convertFlatToNested(config);

    // All settings come from database config_schema/default_config - NOT hardcoded!
    // The schema defines: model_id, language_code, audio_format, commit_strategy,
    // vad_silence_threshold_secs, vad_threshold, min_speech_duration_ms, etc.

    // Model ID from dynamic config
    const model = getConfigField<string>(
      dynamicConfig,
      ['model_id', 'model', 'stt_model'],
      'scribe_v2_realtime',
    );

    // Language code from dynamic config
    const languageCode = getConfigField<string>(
      dynamicConfig,
      ['language_code', 'language'],
      config.language || 'en',
    );

    // Audio format from dynamic config (schema field: audio_format)
    // This is NOT sample_rate - it's the full format string like 'pcm_16000'
    const audioFormat = getConfigField<string>(
      dynamicConfig,
      ['audio_format'],
      'pcm_16000',
    );

    // Commit strategy from dynamic config (vad or manual)
    const commitStrategy = getConfigField<string>(
      dynamicConfig,
      ['commit_strategy'],
      'vad',
    );

    // VAD settings from dynamic config
    const vadSilenceThreshold = getConfigField<number>(
      dynamicConfig,
      ['vad_silence_threshold_secs'],
      1.5,
    );

    const vadThreshold = getConfigField<number>(
      dynamicConfig,
      ['vad_threshold'],
      0.5,
    );

    const minSpeechDuration = getConfigField<number>(
      dynamicConfig,
      ['min_speech_duration_ms'],
      100,
    );

    const minSilenceDuration = getConfigField<number>(
      dynamicConfig,
      ['min_silence_duration_ms'],
      100,
    );

    const enableLogging = getConfigField<boolean>(
      dynamicConfig,
      ['enable_logging'],
      true,
    );

    // Log the STT configuration being used (excluding API key)
    this.logger.log('[ElevenLabsSTT] Starting transcription with config:', {
      model,
      language: languageCode,
      audioFormat,
      commitStrategy,
      vadSilenceThreshold,
      vadThreshold,
      minSpeechDuration,
      minSilenceDuration,
      enableLogging,
    });

    // Build WebSocket URL with all dynamic query parameters
    // ElevenLabs Scribe v2 Realtime uses query params for configuration (NOT an init message)
    const queryParams = new URLSearchParams({
      model_id: model,
      language_code: languageCode,
      audio_format: audioFormat,
      commit_strategy: commitStrategy,
      vad_silence_threshold_secs: vadSilenceThreshold.toString(),
      vad_threshold: vadThreshold.toString(),
      min_speech_duration_ms: minSpeechDuration.toString(),
      min_silence_duration_ms: minSilenceDuration.toString(),
      enable_logging: enableLogging.toString(),
    });

    const wsUrl = `wss://api.elevenlabs.io/v1/speech-to-text/realtime?${queryParams.toString()}`;

    this.logger.log(`  WebSocket URL: ${wsUrl}`);

    // Track usage: session start time for duration calculation
    const startTime = Date.now();

    // WebSocket connection state
    let ws: WebSocket | null = null;
    let isConnected = false;

    // Event handlers
    const transcriptHandlers: ((text: string, isFinal: boolean) => void)[] = [];
    const errorHandlers: ((error: Error) => void)[] = [];

    // Connect to ElevenLabs WebSocket
    return new Promise<SttSession>((resolve, reject) => {
      try {
        // API key passed in WebSocket headers (xi-api-key)
        ws = new WebSocket(wsUrl, {
          headers: {
            'xi-api-key': config.apiKey,
          },
        });

        ws.on('open', () => {
          this.logger.log('✅ ElevenLabs STT WebSocket connection established');
          isConnected = true;

          // NOTE: ElevenLabs Scribe v2 Realtime does NOT require an init message!
          // Configuration is passed via URL query parameters (already done above).
          // The server will send a 'session_started' message to confirm config.
          // Sending any message with message_type other than 'input_audio_chunk'
          // will result in: {"message_type":"input_error","error":"Unexpected message type: init"}

          this.logger.debug(
            `📤 Connection established - config passed via URL params: model=${model}, language=${languageCode}, audio_format=${audioFormat}`,
          );

          // Return the session object
          resolve({
            sendAudio: (audioChunk: Buffer) => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                try {
                  // CRITICAL: ElevenLabs expects JSON with base64-encoded audio
                  // NOT raw binary data! This is different from Deepgram.
                  const audioMessage = {
                    message_type: 'input_audio_chunk',
                    audio_base_64: audioChunk.toString('base64'),
                  };
                  ws.send(JSON.stringify(audioMessage));
                } catch (error) {
                  this.logger.error(
                    `Failed to send audio chunk: ${error.message}`,
                  );
                }
              } else {
                this.logger.warn(
                  'Attempted to send audio but WebSocket is not open - dropping chunk',
                );
              }
            },

            on: (event, handler) => {
              if (event === 'transcript') {
                transcriptHandlers.push(handler);
              } else if (event === 'error') {
                errorHandlers.push(handler);
              }
            },

            close: async () => {
              if (ws) {
                this.logger.log('🔌 Closing ElevenLabs STT WebSocket...');
                if (
                  ws.readyState === WebSocket.OPEN ||
                  ws.readyState === WebSocket.CONNECTING
                ) {
                  ws.close();
                }
                ws = null;
                isConnected = false;
              }
            },

            getUsage: () => {
              const totalSeconds = Math.round((Date.now() - startTime) / 1000);
              return { totalSeconds };
            },
          });
        });

        ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = JSON.parse(data.toString());

            // CRITICAL: ElevenLabs uses 'message_type' not 'type'
            const messageType = message.message_type || 'unknown';
            this.logger.debug(`📨 Received message type: ${messageType}`);

            // Handle different message types from ElevenLabs Scribe v2 Realtime
            switch (messageType) {
              case 'session_started':
                // Connection confirmed with config acknowledgment
                this.logger.log(
                  `✅ ElevenLabs STT session started: ${message.session_id}`,
                );
                this.logger.debug(
                  `  Config: model=${message.config?.model_id}, language=${message.config?.language_code}, sample_rate=${message.config?.sample_rate}`,
                );
                break;

              case 'partial_transcript':
                // Interim result (live transcription)
                const partialText = message.text || message.transcript || '';
                if (partialText && (config.interim_results ?? true)) {
                  this.logger.debug(
                    `🔊 Partial transcript: "${partialText.substring(0, 50)}${partialText.length > 50 ? '...' : ''}"`,
                  );
                  transcriptHandlers.forEach((handler) =>
                    handler(partialText, false),
                  );
                }
                break;

              case 'committed_transcript':
                // Final result (committed segment)
                const finalText = message.text || message.transcript || '';
                if (finalText) {
                  this.logger.debug(
                    `✅ Final transcript: "${finalText.substring(0, 50)}${finalText.length > 50 ? '...' : ''}"`,
                  );
                  transcriptHandlers.forEach((handler) =>
                    handler(finalText, true),
                  );
                }
                break;

              case 'input_error':
                // Error with input (e.g., invalid message type)
                const inputError = new Error(
                  `ElevenLabs STT input error: ${message.error || 'Unknown error'}`,
                );
                this.logger.error(`❌ ${inputError.message}`);
                errorHandlers.forEach((handler) => handler(inputError));
                break;

              case 'auth_error':
                // Authentication failed
                const authError = new Error(
                  `ElevenLabs STT auth error: ${message.error || 'Authentication failed'}`,
                );
                this.logger.error(`❌ ${authError.message}`);
                errorHandlers.forEach((handler) => handler(authError));
                break;

              case 'quota_exceeded':
              case 'rate_limited':
              case 'resource_exhausted':
                // Rate/quota errors
                const quotaError = new Error(
                  `ElevenLabs STT ${messageType}: ${message.error || message.message || 'Limit exceeded'}`,
                );
                this.logger.error(`❌ ${quotaError.message}`);
                errorHandlers.forEach((handler) => handler(quotaError));
                break;

              default:
                // Unknown message type - log for debugging but don't treat as error
                this.logger.debug(
                  `📨 Received message type '${messageType}': ${JSON.stringify(message).substring(0, 200)}`,
                );
            }
          } catch (error) {
            this.logger.error(
              `Failed to parse WebSocket message: ${error.message}`,
            );
            this.logger.error(`Raw message: ${data.toString()}`);
          }
        });

        ws.on('error', (error: Error) => {
          this.logger.error(`❌ WebSocket error: ${error.message}`);
          if (!isConnected) {
            // Connection failed
            reject(error);
          } else {
            // Runtime error
            errorHandlers.forEach((handler) => handler(error));
          }
        });

        ws.on('close', (code: number, reason: Buffer) => {
          this.logger.warn(
            `⚠️  WebSocket closed (code: ${code}, reason: ${reason.toString() || 'none'})`,
          );
          isConnected = false;
        });
      } catch (error) {
        this.logger.error(`Failed to create WebSocket: ${error.message}`);
        reject(error);
      }
    });
  }
}
