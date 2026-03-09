import { Logger } from '@nestjs/common';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { LiveTranscriptionEvent } from '@deepgram/sdk';
import { SttProvider, SttConfig, SttSession } from './stt.interface';

export class DeepgramSttProvider implements SttProvider {
  private readonly logger = new Logger(DeepgramSttProvider.name);

  async startTranscription(config: SttConfig): Promise<SttSession> {
    // Log the STT configuration being used (Sprint 5: STT Config from DB)
    this.logger.log('[DeepgramSTT] Starting transcription with config:', {
      model: config.model || 'nova-2-phonecall',
      language: config.language,
      endpointing: config.endpointing ?? 800,
      utterance_end_ms: config.utterance_end_ms ?? 2000,
      vad_events: config.vad_events ?? true,
      interim_results: config.interim_results ?? true,
      punctuate: config.punctuate ?? true,
    });

    const deepgram = createClient(config.apiKey);

    const connection = deepgram.listen.live({
      language: config.language,
      model: config.model || 'nova-2-phonecall',
      encoding: 'linear16',
      sample_rate: config.sampleRate || 16000,
      channels: 1,
      smart_format: true,

      // Configurable settings with sensible defaults
      // Sprint 5: Updated fallbacks to reduce interruptions (500→800, 1500→2000)
      punctuate: config.punctuate ?? true,
      interim_results: config.interim_results ?? true,
      endpointing: config.endpointing ?? 800,
      utterance_end_ms: config.utterance_end_ms ?? 2000,
      vad_events: config.vad_events ?? true,
    });

    // Track usage: session start time for duration calculation
    const startTime = Date.now();

    // Return a session object that wraps the Deepgram connection
    return {
      sendAudio: (audioChunk: Buffer) => {
        // Send the buffer's underlying ArrayBuffer, sliced to the actual data portion
        // Buffer.buffer may be a pooled ArrayBuffer larger than the actual data
        connection.send(
          audioChunk.buffer.slice(
            audioChunk.byteOffset,
            audioChunk.byteOffset + audioChunk.byteLength,
          ),
        );
      },
      on: (event, handler) => {
        if (event === 'transcript') {
          connection.on(
            LiveTranscriptionEvents.Transcript,
            (data: LiveTranscriptionEvent) => {
              const transcript = data.channel?.alternatives?.[0]?.transcript;
              if (transcript) {
                const isFinal = data.is_final || false;
                handler(transcript, isFinal);
              }
            },
          );
        }
        if (event === 'error') {
          connection.on(LiveTranscriptionEvents.Error, handler);
        }
      },
      close: async () => {
        connection.requestClose();
      },
      getUsage: () => {
        const totalSeconds = Math.round((Date.now() - startTime) / 1000);
        return { totalSeconds };
      },
    };
  }
}
