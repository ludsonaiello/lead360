export interface SttProvider {
  // Start transcription for an audio stream
  // Returns an async generator of transcription results
  startTranscription(config: SttConfig): Promise<SttSession>;
}

export interface SttConfig {
  language: string;       // 'en', 'es', 'pt'
  apiKey: string;         // Decrypted from credentials service
  model?: string;         // 'nova-2', 'nova-3', etc.
  sampleRate?: number;    // Audio sample rate (default 16000)
}

export interface SttSession {
  // Send audio chunk to transcription
  sendAudio(audioChunk: Buffer): void;

  // Event emitter for transcript results
  on(event: 'transcript', handler: (text: string, isFinal: boolean) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;

  // Close the session
  close(): Promise<void>;
}
