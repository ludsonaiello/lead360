import { Logger } from '@nestjs/common';
import WebSocket from 'ws';
import { StreamingTtsProvider, StreamingTtsConfig } from './tts.interface';

/**
 * Cartesia WebSocket TTS Provider — Sprint BAS-TTS-01
 *
 * Provides ultra-low latency text-to-speech by maintaining a persistent
 * WebSocket connection to Cartesia's streaming API.
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
 * - WebSocket TTS: 300-500ms time-to-first-audio
 *
 * CRITICAL: All configuration is dynamic (no hardcoded API keys, voice IDs, models).
 * Configuration comes from context.providers.tts and is passed via StreamingTtsConfig.
 */
export class CartesiaWebSocketTtsProvider implements StreamingTtsProvider {
  private readonly logger = new Logger(CartesiaWebSocketTtsProvider.name);
  private ws: WebSocket | null = null;
  private config: StreamingTtsConfig | null = null;
  private audioCallback: ((contextId: string, audioData: Buffer, isDone: boolean) => void) | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 3;
  private isConnecting = false;
  private messageQueue: string[] = []; // Queue messages during reconnection

  /**
   * Connect to Cartesia WebSocket API.
   *
   * @param config Dynamic configuration from context.providers.tts
   */
  async connect(config: StreamingTtsConfig): Promise<void> {
    this.config = config;

    const wsUrl = `wss://api.cartesia.ai/tts/websocket?api_key=${config.apiKey}&cartesia_version=2025-04-16`;

    this.logger.log('🔌 Connecting to Cartesia WebSocket TTS...');
    this.logger.log(`  Model: ${config.model || 'sonic-3'}`);
    this.logger.log(`  Voice ID: ${config.voiceId}`);
    this.logger.log(`  Language: ${config.language || 'en'}`);
    this.logger.log(`  Sample Rate: ${config.sampleRate || 16000}Hz`);
    this.logger.log(`  Encoding: ${config.encoding || 'pcm_s16le'}`);

    return new Promise<void>((resolve, reject) => {
      this.isConnecting = true;

      try {
        this.ws = new WebSocket(wsUrl);

        this.ws.on('open', () => {
          this.logger.log('✅ WebSocket TTS connection established');
          this.isConnecting = false;
          this.reconnectAttempts = 0;

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
          this.logger.warn(`⚠️  WebSocket closed (code: ${code}, reason: ${reason.toString() || 'none'})`);

          if (!this.isConnecting && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.attemptReconnect();
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
   */
  private async attemptReconnect(): Promise<void> {
    if (!this.config || this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached or no config available');
      return;
    }

    this.reconnectAttempts++;
    const backoffMs = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 10000);

    this.logger.log(`🔄 Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffMs}ms...`);

    await new Promise(resolve => setTimeout(resolve, backoffMs));

    try {
      await this.connect(this.config);
    } catch (error) {
      this.logger.error(`Reconnection attempt ${this.reconnectAttempts} failed: ${error.message}`);
    }
  }

  /**
   * Handle incoming WebSocket message.
   *
   * Cartesia sends two message types:
   * 1. Chunk: { type: 'chunk', data: '<base64-audio>', done: false, context_id: '...' }
   * 2. Done: { type: 'done', done: true, context_id: '...' }
   */
  private handleMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      // Log message type for debugging
      this.logger.debug(`📨 Received message type: ${message.type}, context: ${message.context_id}`);

      if (message.type === 'chunk' && message.data) {
        // Decode base64 audio to Buffer
        const audioBuffer = Buffer.from(message.data, 'base64');

        this.logger.debug(`🔊 Audio chunk: ${audioBuffer.length} bytes, context: ${message.context_id}, done: ${message.done}`);

        // Dispatch to callback
        if (this.audioCallback) {
          this.audioCallback(message.context_id, audioBuffer, message.done || false);
        }
      } else if (message.type === 'done') {
        this.logger.debug(`✅ TTS generation complete for context: ${message.context_id}`);

        // Dispatch final done signal
        if (this.audioCallback) {
          this.audioCallback(message.context_id, Buffer.alloc(0), true);
        }
      } else if (message.type === 'error') {
        this.logger.error(`❌ Cartesia TTS error: ${JSON.stringify(message)}`);
      }

    } catch (error) {
      this.logger.error(`Failed to parse WebSocket message: ${error.message}`);
      this.logger.error(`Raw message: ${data.toString()}`);
    }
  }

  /**
   * Stream text chunk to Cartesia for synthesis.
   *
   * @param text Text chunk (can be partial sentence or empty for final flush)
   * @param contextId Unique identifier for this utterance
   * @param isFinal Whether this is the last chunk (triggers final flush)
   */
  streamText(text: string, contextId: string, isFinal: boolean): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`WebSocket not ready - queueing text for context: ${contextId}`);
      // Queue the message for when connection is restored
      const message = this.buildTtsMessage(text, contextId, isFinal);
      this.messageQueue.push(JSON.stringify(message));
      return;
    }

    const message = this.buildTtsMessage(text, contextId, isFinal);

    this.logger.debug(`📤 Streaming text: "${text.substring(0, 50)}...", context: ${contextId}, final: ${isFinal}`);

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      this.logger.error(`Failed to send text to WebSocket: ${error.message}`);
    }
  }

  /**
   * Build Cartesia TTS WebSocket message.
   *
   * Uses dynamic configuration from context.providers.tts.
   */
  private buildTtsMessage(text: string, contextId: string, isFinal: boolean): any {
    if (!this.config) {
      throw new Error('TTS config not initialized');
    }

    return {
      model_id: this.config.model || 'sonic-3',
      transcript: text,
      voice: {
        mode: 'id',
        id: this.config.voiceId,
      },
      language: this.config.language || 'en',
      context_id: contextId,
      output_format: {
        container: 'raw',
        encoding: this.config.encoding || 'pcm_s16le',
        sample_rate: this.config.sampleRate || 16000,
      },
      continue: !isFinal, // true = expect more text, false = flush final audio
      max_buffer_delay_ms: 3000, // Cartesia's recommended buffering
    };
  }

  /**
   * Register callback for audio chunks.
   */
  onAudioChunk(callback: (contextId: string, audioData: Buffer, isDone: boolean) => void): void {
    this.audioCallback = callback;
  }

  /**
   * Cancel TTS generation for a specific context (barge-in support).
   */
  cancelContext(contextId: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Cannot cancel context ${contextId} - WebSocket not connected`);
      return;
    }

    const cancelMessage = {
      context_id: contextId,
      cancel: true,
    };

    this.logger.log(`🛑 Cancelling TTS generation for context: ${contextId}`);

    try {
      this.ws.send(JSON.stringify(cancelMessage));
    } catch (error) {
      this.logger.error(`Failed to cancel context: ${error.message}`);
    }
  }

  /**
   * Disconnect from WebSocket.
   */
  async disconnect(): Promise<void> {
    if (this.ws) {
      this.logger.log('🔌 Disconnecting WebSocket TTS...');

      // Clear callback to prevent handling messages during shutdown
      this.audioCallback = null;

      // Close WebSocket
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }

      this.ws = null;
      this.config = null;
      this.messageQueue = [];
    }
  }

  /**
   * Check if WebSocket is connected.
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }
}
