export interface SttProvider {
  // Start transcription for an audio stream
  // Returns an async generator of transcription results
  startTranscription(config: SttConfig): Promise<SttSession>;
}

export interface SttConfig {
  language: string; // 'en', 'es', 'pt'
  apiKey: string; // Decrypted from credentials service

  // Optional Deepgram-specific settings
  model?: string; // 'nova-2', 'nova-2-phonecall', 'nova-3', etc.
  sampleRate?: number; // Audio sample rate (default 16000)
  punctuate?: boolean; // Add punctuation to transcripts (default true)
  interim_results?: boolean; // Stream intermediate results (default true)
  endpointing?: number; // Milliseconds of silence before finalizing (default 500, range 10-2000)
  utterance_end_ms?: number; // Gap between words to detect utterance end (default 1500, range 500-5000)
  vad_events?: boolean; // Enable voice activity detection events (default true)

  // Allow other provider-specific settings
  [key: string]: unknown;
}

export interface SttSession {
  // Send audio chunk to transcription
  sendAudio(audioChunk: Buffer): void;

  // Event emitter for transcript results
  on(
    event: 'transcript',
    handler: (text: string, isFinal: boolean) => void,
  ): void;
  on(event: 'error', handler: (error: Error) => void): void;

  // Close the session
  close(): Promise<void>;

  // Get usage statistics
  getUsage(): { totalSeconds: number };
}
