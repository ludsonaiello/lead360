import { Logger } from '@nestjs/common';
import { CartesiaClient } from '@cartesia/cartesia-js';
import { Cartesia } from '@cartesia/cartesia-js';
import { TtsProvider, TtsConfig, TtsSession } from './tts.interface';
import { Readable } from 'stream';

export class CartesiaTtsProvider implements TtsProvider {
  private readonly logger = new Logger(CartesiaTtsProvider.name);

  async synthesize(config: TtsConfig): Promise<TtsSession> {
    // Create Cartesia client
    const client = new CartesiaClient({ apiKey: config.apiKey });

    // Prepare TTS request parameters
    const ttsRequest: Cartesia.TtsRequest = {
      modelId: config.model || 'sonic-english',
      transcript: config.text,
      voice: {
        mode: 'id',
        id: config.voiceId,
      },
      language: (config.language || 'en') as Cartesia.SupportedLanguage,
      outputFormat: {
        container: 'raw',
        encoding: (config.outputFormat?.encoding || 'pcm_s16le') as Cartesia.RawEncoding,
        sampleRate: config.outputFormat?.sampleRate || 16000,
      },
    };

    return {
      getAudio: async () => {
        this.logger.debug('Synthesizing full audio with Cartesia TTS');

        // Call Cartesia TTS API
        const audioStream: Readable = await client.tts.bytes(ttsRequest);

        // Collect all chunks into a buffer
        const chunks: Buffer[] = [];

        return new Promise<Buffer>((resolve, reject) => {
          audioStream.on('data', (chunk: Buffer) => {
            chunks.push(chunk);
          });

          audioStream.on('end', () => {
            const fullBuffer = Buffer.concat(chunks);
            this.logger.debug(`TTS synthesis complete: ${fullBuffer.length} bytes`);
            resolve(fullBuffer);
          });

          audioStream.on('error', (error) => {
            this.logger.error('TTS synthesis error:', error);
            reject(error);
          });
        });
      },

      streamAudio: async function* () {
        // For streaming, we create a new request and yield chunks as they arrive
        const audioStream: Readable = await client.tts.bytes(ttsRequest);

        // Convert Node.js stream to AsyncIterable
        for await (const chunk of audioStream) {
          yield Buffer.from(chunk);
        }
      },
    };
  }
}
