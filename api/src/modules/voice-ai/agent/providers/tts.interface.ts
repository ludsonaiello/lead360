export interface TtsProvider {
  // Convert text to audio
  synthesize(config: TtsConfig): Promise<TtsSession>;
}

export interface TtsConfig {
  apiKey: string;
  voiceId: string;        // Cartesia voice ID (e.g., from voice_ai_global_config.default_voice_id)
  text: string;
  language?: string;      // 'en', 'es', 'pt'
  model?: string;         // 'sonic-english', 'sonic-multilingual'
  outputFormat?: {
    container: string;    // 'raw'
    encoding: string;     // 'pcm_s16le' for LiveKit
    sampleRate: number;   // 16000 or 24000
  };
}

export interface TtsSession {
  // Get full audio buffer
  getAudio(): Promise<Buffer>;

  // Stream audio chunks (for low latency)
  streamAudio(): AsyncIterable<Buffer>;

  // Estimated duration in seconds
  estimatedDuration?: number;
}
