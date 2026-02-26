import { Logger } from '@nestjs/common';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import type { LiveTranscriptionEvent } from '@deepgram/sdk';
import { SttProvider, SttConfig, SttSession } from './stt.interface';

export class DeepgramSttProvider implements SttProvider {
  private readonly logger = new Logger(DeepgramSttProvider.name);

  async startTranscription(config: SttConfig): Promise<SttSession> {
    const deepgram = createClient(config.apiKey);

    const connection = deepgram.listen.live({
      language: config.language,
      model: config.model || 'nova-2',
      encoding: 'linear16',
      sample_rate: config.sampleRate || 16000,
      channels: 1,
      smart_format: true,
      punctuate: true,
      interim_results: true,
    });

    // Return a session object that wraps the Deepgram connection
    return {
      sendAudio: (audioChunk: Buffer) => {
        // Send the buffer's underlying ArrayBuffer, sliced to the actual data portion
        // Buffer.buffer may be a pooled ArrayBuffer larger than the actual data
        connection.send(audioChunk.buffer.slice(audioChunk.byteOffset, audioChunk.byteOffset + audioChunk.byteLength));
      },
      on: (event, handler) => {
        if (event === 'transcript') {
          connection.on(LiveTranscriptionEvents.Transcript, (data: LiveTranscriptionEvent) => {
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            if (transcript) {
              const isFinal = data.is_final || false;
              handler(transcript, isFinal);
            }
          });
        }
        if (event === 'error') {
          connection.on(LiveTranscriptionEvents.Error, handler);
        }
      },
      close: async () => {
        connection.requestClose();
      },
    };
  }
}
