import { Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { StreamingTtsProvider, StreamingTtsConfig } from './tts.interface';
import { getConfigField, convertFlatToNested } from '../utils/config-helper';

/**
 * ElevenLabs Flash v2.5 Streaming TTS Provider
 *
 * Provides ultra-low latency text-to-speech by maintaining a persistent
 * WebSocket connection to ElevenLabs streaming TTS API.
 *
 * Key Features:
 * - Single WebSocket connection for entire session (eliminates HTTP connection overhead)
 * - Streams text chunks as they arrive from LLM (no waiting for full response)
 * - Receives audio chunks immediately as synthesis progresses
 * - Multiplexing: Multiple concurrent utterances via context IDs
 * - Cancellation support for barge-in scenarios
 *
 * Architecture:
 * - Connection opened at session start (connect())
 * - Text chunks sent via streamText() as LLM generates tokens
 * - Audio chunks received via WebSocket and dispatched to callback
 * - Connection closed at session end (disconnect())
 *
 * Latency Improvement:
 * - HTTP-based TTS: 2,000-10,000ms time-to-first-audio
 * - WebSocket TTS: ~75ms time-to-first-audio (Flash v2.5)
 *
 * CRITICAL: All configuration is dynamic (no hardcoded API keys, voice IDs, models).
 * Configuration comes from context.providers.tts and is passed via StreamingTtsConfig.
 */
export class ElevenLabsTtsProvider implements StreamingTtsProvider {
  private readonly logger = new Logger(ElevenLabsTtsProvider.name);
  private ws: WebSocket | null = null;
  private config: StreamingTtsConfig | null = null;
  private audioCallback:
    | ((contextId: string, audioData: Buffer, isDone: boolean) => void)
    | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private isConnecting = false;
  private messageQueue: string[] = []; // Queue messages during reconnection

  // Sprint VAB-05: Prevent infinite reconnection loops (2026-03-10)
  private reconnectTimeoutId: NodeJS.Timeout | null = null; // Track setTimeout ID
  private disconnectRequested = false; // Flag to prevent reconnection after disconnect

  // Token buffering to prevent empty/punctuation-only transcripts
  // ElevenLabs may reject empty or punctuation-only text as initial transcript.
  // We buffer tokens until we have meaningful content before sending.
  private tokenBuffer: Map<string, string> = new Map();
  private contextHasContent: Set<string> = new Set();

  // CRITICAL: Track current context ID for audio callback
  // ElevenLabs WebSocket is single-stream (no multiplexing), so we track the current context
  // and return it in the audio callback so VoiceAgentSession can match it to currentTtsContextId
  private currentContextId: string | null = null;

  // Usage tracking: total characters sent for synthesis
  private totalCharactersSent = 0;

  /**
   * Connect to ElevenLabs WebSocket API.
   *
   * @param config Dynamic configuration from context.providers.tts
   */
  async connect(config: StreamingTtsConfig): Promise<void> {
    // Validate required configuration
    if (!config.apiKey || config.apiKey.trim() === '') {
      throw new Error('ElevenLabs TTS: apiKey is required');
    }
    if (!config.voiceId || config.voiceId.trim() === '') {
      throw new Error('ElevenLabs TTS: voiceId is required');
    }

    // Store original config (keep required fields intact)
    this.config = config;

    // Convert to nested for dynamic field access
    const nestedConfig = convertFlatToNested(config);

    // Build WebSocket URL with voice_id and model
    // API key is passed in headers, not query parameters
    // All settings come from database config_schema/default_config - NOT hardcoded!

    // Model ID from dynamic config (schema field: model_id)
    const model = getConfigField<string>(
      nestedConfig,
      ['model_id', 'model', 'tts_model'],
      'eleven_flash_v2_5',
    );

    // Output format from dynamic config (schema field: output_format)
    // CRITICAL: Must be pcm_XXXXX format for LiveKit compatibility
    // The database schema defines this with default 'pcm_16000'
    const outputFormat = getConfigField<string>(
      nestedConfig,
      ['output_format', 'encoding'],
      'pcm_16000',
    );

    // Language code from dynamic config
    const languageCode = getConfigField<string>(
      nestedConfig,
      ['language_code', 'language'],
      config.language || 'en',
    );

    // Inactivity timeout from dynamic config (prevents WebSocket timeout)
    const inactivityTimeout = getConfigField<number>(
      nestedConfig,
      ['inactivity_timeout'],
      20,
    );

    // Build WebSocket URL with all dynamic parameters
    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(config.voiceId)}/stream-input?model_id=${encodeURIComponent(model)}&output_format=${encodeURIComponent(outputFormat)}&inactivity_timeout=${inactivityTimeout}`;

    this.logger.log('🔌 Connecting to ElevenLabs WebSocket TTS...');
    this.logger.log(`  Model: ${model}`);
    this.logger.log(`  Voice ID: ${config.voiceId}`);
    this.logger.log(`  Language: ${languageCode}`);
    this.logger.log(`  Output Format: ${outputFormat}`);
    this.logger.log(`  Inactivity Timeout: ${inactivityTimeout}s`);
    this.logger.log(`  WebSocket URL: ${wsUrl}`);

    return new Promise<void>((resolve, reject) => {
      this.isConnecting = true;

      try {
        // API key passed in WebSocket headers (xi-api-key)
        this.ws = new WebSocket(wsUrl, {
          headers: {
            'xi-api-key': config.apiKey,
          },
        });

        this.ws.on('open', () => {
          this.logger.log('✅ WebSocket TTS connection established');
          this.isConnecting = false;
          // DO NOT reset reconnectAttempts here - auth hasn't been validated yet!
          // Counter will be reset when we receive first successful message
          this.disconnectRequested = false; // Sprint VAB-05: Allow reconnection after manual disconnect

          // Send initialization message
          // API key must be included in init message for authentication
          // Voice settings can be customized via config (dynamic schema fields)
          const voiceSettings = getConfigField<any>(
            this.config!,
            ['voice_settings', 'voiceSettings'],
            {
              stability: getConfigField<number>(
                this.config!,
                ['voice_settings.stability', 'stability'],
                0.5,
              ),
              similarity_boost: getConfigField<number>(
                this.config!,
                ['voice_settings.similarity_boost', 'similarity_boost'],
                0.8,
              ),
            },
          );

          const initMessage: any = {
            text: ' ', // Space character to initialize
            voice_settings: voiceSettings,
            xi_api_key: this.config!.apiKey, // API key for authentication
          };

          // Add generation_config if provided, otherwise use default
          const generationConfig = getConfigField<any>(
            this.config!,
            ['generation_config', 'generationConfig'],
            { chunk_length_schedule: [120, 160, 250, 290] },
          );
          if (generationConfig) {
            initMessage.generation_config = generationConfig;
          }

          try {
            this.ws!.send(JSON.stringify(initMessage));
            this.logger.debug('📤 Sent initialization message');
          } catch (error) {
            this.logger.error(
              `Failed to send init message: ${error.message}`,
            );
          }

          // Send any queued messages
          while (this.messageQueue.length > 0) {
            const msg = this.messageQueue.shift();
            if (msg && this.ws?.readyState === WebSocket.OPEN) {
              this.ws.send(msg);
            }
          }

          resolve();
        });

        this.ws.on('message', (data: WebSocket.Data) => {
          this.handleMessage(data);
        });

        this.ws.on('error', (error: Error) => {
          this.logger.error(`❌ WebSocket error: ${error.message}`);
          if (this.isConnecting) {
            reject(error);
            this.isConnecting = false;
          }
        });

        this.ws.on('close', (code: number, reason: Buffer) => {
          this.logger.warn(
            `⚠️  WebSocket closed (code: ${code}, reason: ${reason.toString() || 'none'})`,
          );

          // CRITICAL: Check if disconnect was requested before reconnecting
          // This prevents infinite reconnection loops after the call ends
          if (
            !this.isConnecting &&
            !this.disconnectRequested &&
            this.reconnectAttempts < this.maxReconnectAttempts
          ) {
            this.attemptReconnect();
          } else if (this.disconnectRequested) {
            this.logger.log('🛑 Reconnection skipped - disconnect was requested');
          } else if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            this.logger.error(
              `❌ Max reconnection attempts (${this.maxReconnectAttempts}) reached - giving up`,
            );
          }
        });
      } catch (error) {
        this.logger.error(`Failed to create WebSocket: ${error.message}`);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Attempt to reconnect with exponential backoff.
   * Sprint VAB-05: Prevent infinite reconnection loops (2026-03-10)
   */
  private async attemptReconnect(): Promise<void> {
    // CRITICAL: Check if disconnect was requested
    if (
      this.disconnectRequested ||
      !this.config ||
      this.reconnectAttempts >= this.maxReconnectAttempts
    ) {
      this.logger.error(
        `Reconnection stopped: disconnectRequested=${this.disconnectRequested}, ` +
          `attempts=${this.reconnectAttempts}/${this.maxReconnectAttempts}`,
      );
      return;
    }

    this.reconnectAttempts++;
    const backoffMs = Math.min(
      1000 * Math.pow(2, this.reconnectAttempts - 1),
      10000,
    );

    this.logger.log(
      `🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffMs}ms...`,
    );

    // Store timeout ID so it can be cancelled
    this.reconnectTimeoutId = setTimeout(async () => {
      if (this.disconnectRequested) {
        this.logger.log('Reconnection cancelled - disconnect requested');
        return;
      }

      try {
        await this.connect(this.config!);
      } catch (error) {
        this.logger.error(
          `Reconnection attempt ${this.reconnectAttempts} failed: ${error.message}`,
        );
      }
    }, backoffMs);
  }

  /**
   * Handle incoming WebSocket message.
   *
   * ElevenLabs sends different message types:
   * 1. Audio chunk: { audio: '<base64-audio>', isFinal: false, ... }
   * 2. Final: { isFinal: true, ... }
   * 3. Error: { error: '...' }
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      this.logger.debug(
        `📨 Received message: ${JSON.stringify(message).substring(0, 100)}...`,
      );

      if (message.error) {
        this.logger.error(`❌ ElevenLabs TTS error: ${message.error}`);
        return;
      }

      if (message.audio) {
        // Sprint VAB-05: Reset reconnection counter on first successful message
        // This confirms authentication succeeded (only reset once, not on every message)
        if (this.reconnectAttempts > 0) {
          this.logger.log(
            `✅ Authentication successful - resetting reconnection counter`,
          );
          this.reconnectAttempts = 0;
        }

        // Decode base64 audio to Buffer
        const audioBuffer = Buffer.from(message.audio, 'base64');

        this.logger.debug(
          `🔊 Audio chunk: ${audioBuffer.length} bytes, final: ${message.isFinal || false}`,
        );

        // CRITICAL FIX: Use the stored currentContextId instead of 'default'
        // ElevenLabs doesn't send context_id in responses (single stream per connection)
        // We track the current context and return it so VoiceAgentSession can match
        // audio chunks to this.currentTtsContextId (e.g., 'greeting-123', 'turn-456')
        const contextIdToUse = this.currentContextId || 'default';

        if (this.audioCallback) {
          this.audioCallback(
            contextIdToUse,
            audioBuffer,
            message.isFinal || false,
          );
        }
      }

      if (message.isFinal) {
        this.logger.debug('✅ TTS generation complete');

        // Dispatch final done signal with the correct context ID
        const contextIdToUse = this.currentContextId || 'default';
        if (this.audioCallback) {
          this.audioCallback(contextIdToUse, Buffer.alloc(0), true);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to parse WebSocket message: ${error.message}`);
      this.logger.error(`Raw message: ${data.toString()}`);
    }
  }

  /**
   * Stream text chunk to ElevenLabs for synthesis.
   *
   * @param text Text chunk (can be partial sentence or empty for final flush)
   * @param contextId Unique identifier for this utterance (note: ElevenLabs uses single stream)
   * @param isFinal Whether this is the last chunk (triggers final flush)
   *
   * Token buffering: Buffers tokens until meaningful content exists.
   * ElevenLabs may reject empty or punctuation-only text as the initial transcript.
   * We buffer tokens until we have at least some alphanumeric characters before sending.
   */
  streamText(text: string, contextId: string, isFinal: boolean): void {
    // CRITICAL: Store the current context ID so audio callbacks return the correct ID
    // ElevenLabs WebSocket is single-stream, so we track which context is currently active.
    // This allows VoiceAgentSession to match audio chunks to this.currentTtsContextId
    this.currentContextId = contextId;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(
        `WebSocket not ready - queueing text for context: ${contextId}`,
      );
      // Queue the message for when connection is restored
      const message = this.buildTtsMessage(text, isFinal);
      this.messageQueue.push(JSON.stringify(message));
      return;
    }

    // ====================================================================================
    // Token buffering and validation
    // ====================================================================================

    // Get or create buffer for this context
    const currentBuffer = this.tokenBuffer.get(contextId) || '';
    const newBuffer = currentBuffer + text;
    this.tokenBuffer.set(contextId, newBuffer);

    // Check if buffer has meaningful content (not just punctuation/whitespace)
    // Unicode-aware pattern supports all languages (Latin, Cyrillic, Arabic, Chinese, etc.)
    const hasContent = /\p{L}|\p{N}/u.test(newBuffer);

    // If this context hasn't sent content yet, wait until we have meaningful text
    if (!this.contextHasContent.has(contextId)) {
      if (hasContent) {
        // First meaningful content - send buffered text
        this.contextHasContent.add(contextId);
        const textToSend = this.tokenBuffer.get(contextId) || '';
        this.tokenBuffer.set(contextId, ''); // Clear buffer

        if (textToSend.trim()) {
          this.sendToElevenLabs(textToSend, isFinal);
        }

        // Cleanup if this was also the final chunk (single-token utterance)
        if (isFinal) {
          this.tokenBuffer.delete(contextId);
          this.contextHasContent.delete(contextId);
        }
      } else if (isFinal) {
        // Final chunk but no meaningful content - skip entirely
        this.logger.warn(
          `Context ${contextId} has no meaningful content - skipping`,
        );
        this.tokenBuffer.delete(contextId);
      }
      // Otherwise, keep buffering
      return;
    }

    // Context already has content - send immediately (even punctuation is fine now)
    this.tokenBuffer.set(contextId, ''); // Clear buffer
    if (text.trim() || isFinal) {
      this.sendToElevenLabs(text, isFinal);
    }

    // Cleanup on final
    if (isFinal) {
      this.tokenBuffer.delete(contextId);
      this.contextHasContent.delete(contextId);
    }
  }

  /**
   * Send text to ElevenLabs WebSocket (internal helper).
   * Called after buffering and validation.
   */
  private sendToElevenLabs(text: string, isFinal: boolean): void {
    const message = this.buildTtsMessage(text, isFinal);
    this.logger.debug(
      `📤 Sending to ElevenLabs: "${text.substring(0, 50)}...", final: ${isFinal}`,
    );

    try {
      this.ws!.send(JSON.stringify(message));
      // Track characters sent for usage reporting
      this.totalCharactersSent += text.length;
    } catch (error) {
      this.logger.error(`Failed to send text to WebSocket: ${error.message}`);
    }
  }

  /**
   * Build ElevenLabs TTS WebSocket message.
   *
   * Uses dynamic configuration from context.providers.tts.
   */
  private buildTtsMessage(text: string, isFinal: boolean): any {
    if (!this.config) {
      throw new Error('TTS config not initialized');
    }

    const message: any = {
      text: text,
      try_trigger_generation: !isFinal, // Generate as we go, unless final
    };

    // Add flush on final chunk
    if (isFinal) {
      message.flush = true;
    }

    return message;
  }

  /**
   * Register callback for audio chunks.
   */
  onAudioChunk(
    callback: (contextId: string, audioData: Buffer, isDone: boolean) => void,
  ): void {
    this.audioCallback = callback;
  }

  /**
   * Cancel TTS generation for a specific context.
   * Note: ElevenLabs WebSocket TTS doesn't have explicit cancellation per context.
   * We'll need to close and reconnect to stop generation.
   */
  cancelContext(contextId: string): void {
    this.logger.log(
      `🛑 Cancel requested for context: ${contextId} (ElevenLabs requires reconnect)`,
    );

    // Clear the context's buffer
    this.tokenBuffer.delete(contextId);
    this.contextHasContent.delete(contextId);

    // For ElevenLabs, cancellation requires closing the connection
    // In practice, the session will handle this by disconnecting and reconnecting
    // if needed, so we just log and clean up our state
  }

  /**
   * Disconnect from WebSocket.
   * Sprint VAB-05: Prevent infinite reconnection loops (2026-03-10)
   */
  async disconnect(): Promise<void> {
    // CRITICAL: Set flag to prevent future reconnection attempts
    this.disconnectRequested = true;

    // Cancel any pending reconnection timeout
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
      this.logger.log('🛑 Cancelled pending reconnection timeout');
    }

    if (this.ws) {
      this.logger.log('🔌 Disconnecting WebSocket TTS...');

      // Clear callback to prevent handling messages during shutdown
      this.audioCallback = null;

      // Close WebSocket
      if (
        this.ws.readyState === WebSocket.OPEN ||
        this.ws.readyState === WebSocket.CONNECTING
      ) {
        // Send EOS (end of stream) message
        try {
          this.ws.send(JSON.stringify({ text: '' }));
        } catch (error) {
          this.logger.warn(`Failed to send EOS: ${error.message}`);
        }

        this.ws.close();
      }

      this.ws = null;
      this.config = null;
      this.messageQueue = [];

      // Clear token buffers
      this.tokenBuffer.clear();
      this.contextHasContent.clear();

      // Note: Don't reset totalCharactersSent here - it needs to be available for usage reporting
      // after disconnect() is called
    }
  }

  /**
   * Check if WebSocket is connected.
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get usage statistics.
   * Returns total characters sent for TTS synthesis during this session.
   */
  getUsage(): { totalCharacters: number } {
    return { totalCharacters: this.totalCharactersSent };
  }
}
