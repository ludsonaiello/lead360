export interface TtsProvider {
  // Convert text to audio (legacy HTTP-based method)
  synthesize(config: TtsConfig): Promise<TtsSession>;
}

export interface TtsConfig {
  apiKey: string;
  voiceId: string; // Provider voice ID
  text: string;
  language?: string; // 'en', 'es', 'pt'
  model?: string; // Provider-specific model name
  outputFormat?: {
    container: string;
    encoding: string;
    sampleRate: number;
  };
  // Allow any additional provider-specific fields
  [key: string]: unknown;
}

export interface TtsSession {
  // Get full audio buffer
  getAudio(): Promise<Buffer>;

  // Stream audio chunks (for low latency)
  streamAudio(): AsyncIterable<Buffer>;

  // Estimated duration in seconds
  estimatedDuration?: number;
}

/**
 * WebSocket-based TTS provider for ultra-low latency streaming.
 *
 * This provider maintains a persistent WebSocket connection and streams
 * text chunks directly to the TTS service as they arrive from the LLM,
 * enabling time-to-first-audio of 300-500ms (vs 2000-10000ms for HTTP).
 */
export interface StreamingTtsProvider {
  /**
   * Initialize WebSocket connection (call once at session start).
   * @param config Configuration from context.providers.tts (api_key, voice_id, model, language, etc.)
   */
  connect(config: StreamingTtsConfig): Promise<void>;

  /**
   * Stream text chunk for synthesis (call multiple times per utterance).
   * Returns immediately - audio arrives via callback.
   *
   * @param text Text chunk to synthesize (can be partial sentence)
   * @param contextId Unique identifier for this utterance (e.g., 'turn-123')
   * @param isFinal Whether this is the last chunk of the utterance
   */
  streamText(text: string, contextId: string, isFinal: boolean): void;

  /**
   * Register callback for audio chunks.
   * @param callback Function called when audio data arrives from TTS service
   */
  onAudioChunk(
    callback: (contextId: string, audioData: Buffer, isDone: boolean) => void,
  ): void;

  /**
   * Cancel current generation (for barge-in).
   * @param contextId Context ID to cancel
   */
  cancelContext(contextId: string): void;

  /**
   * Close WebSocket connection (call at session end).
   */
  disconnect(): Promise<void>;

  /**
   * Check if connected.
   */
  isConnected(): boolean;

  /**
   * Get usage statistics (total characters synthesized).
   */
  getUsage(): { totalCharacters: number };
}

/**
 * Configuration for WebSocket-based streaming TTS.
 * Populated from context.providers.tts (dynamic configuration).
 *
 * Core fields (apiKey, voiceId, language) are universal across all providers.
 * Common provider fields (model, sampleRate, encoding) are optional and provider-specific.
 * Additional provider-specific fields are passed through via index signature.
 *
 * This allows providers to define their own schemas without backend code changes.
 */
export interface StreamingTtsConfig {
  apiKey: string;
  voiceId: string;
  language?: string;
  model?: string; // Provider-specific model name
  sampleRate?: number; // Audio sample rate (typically 16000)
  encoding?: string; // Audio encoding (e.g., 'pcm_s16le')
  // Allow any additional provider-specific fields
  [key: string]: unknown;
}
