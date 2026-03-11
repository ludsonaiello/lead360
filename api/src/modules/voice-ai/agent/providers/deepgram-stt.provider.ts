import { Logger } from '@nestjs/common';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { LiveTranscriptionEvent } from '@deepgram/sdk';
import { SttProvider, SttConfig, SttSession } from './stt.interface';
import { getConfigField, convertFlatToNested } from '../utils/config-helper';

export class DeepgramSttProvider implements SttProvider {
  private readonly logger = new Logger(DeepgramSttProvider.name);

  async startTranscription(config: SttConfig): Promise<SttSession> {
    // Convert flat config to nested (if schema uses dot notation)
    const dynamicConfig = convertFlatToNested(config);

    // Get model from config dynamically (try multiple possible field names)
    const model = getConfigField<string>(
      dynamicConfig,
      ['model_id', 'model', 'stt_model'],
      'nova-2-phonecall',
    );

    // Log the STT configuration being used (Sprint 5: STT Config from DB)
    this.logger.log('[DeepgramSTT] Starting transcription with config:', {
      model,
      language: config.language,
      endpointing: config.endpointing ?? 800,
      utterance_end_ms: config.utterance_end_ms ?? 2000,
      vad_events: config.vad_events ?? true,
      interim_results: config.interim_results ?? true,
      punctuate: config.punctuate ?? true,
    });

    // Deepgram SDK v3+ requires an options object with 'key' property
    // DEBUG: Log API key presence and format
    this.logger.log(`🔍 DEBUG: Deepgram API Key: ${config.apiKey ? `${config.apiKey.substring(0, 10)}... (length: ${config.apiKey.length})` : 'MISSING'}`);

    const deepgram = createClient({ key: config.apiKey });

    const connectionOptions = {
      language: config.language,
      model,
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
    };

    this.logger.log(`🔍 DEBUG: Deepgram connection options: ${JSON.stringify(connectionOptions)}`);

    const connection = deepgram.listen.live(connectionOptions);

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
          connection.on(LiveTranscriptionEvents.Error, (error) => {
            this.logger.error(`❌ Deepgram error details: ${JSON.stringify(error, null, 2)}`);
            handler(error);
          });
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
