import { Logger } from '@nestjs/common';
import { CartesiaClient } from '@cartesia/cartesia-js';
import { Cartesia } from '@cartesia/cartesia-js';
import { TtsProvider, TtsConfig, TtsSession } from './tts.interface';
import { Readable } from 'stream';
import { getConfigField, convertFlatToNested } from '../utils/config-helper';

export class CartesiaTtsProvider implements TtsProvider {
  private readonly logger = new Logger(CartesiaTtsProvider.name);

  async synthesize(config: TtsConfig): Promise<TtsSession> {
    // Convert flat config to nested (if schema uses dot notation)
    const dynamicConfig = convertFlatToNested(config);

    // Get model from config dynamically (try multiple possible field names)
    const model = getConfigField<string>(
      dynamicConfig,
      ['model_id', 'model', 'modelId', 'tts_model'],
      'sonic-english',
    );

    // Log full TTS request configuration
    this.logger.log(`📋 TTS Request Configuration:`);
    this.logger.log(
      `  - API Key: ${config.apiKey ? config.apiKey.substring(0, 12) + '...' : 'MISSING'}`,
    );
    this.logger.log(`  - Voice ID: ${config.voiceId}`);
    this.logger.log(`  - Model: ${model}`);
    this.logger.log(`  - Language: ${config.language || 'en'}`);
    this.logger.log(
      `  - Text: "${config.text.substring(0, 100)}..." (${config.text.length} chars)`,
    );
    this.logger.log(
      `  - Output Format: ${config.outputFormat?.encoding || 'pcm_s16le'}, ${config.outputFormat?.sampleRate || 16000}Hz`,
    );

    // Create Cartesia client
    const client = new CartesiaClient({ apiKey: config.apiKey });

    // Prepare TTS request parameters
    const ttsRequest: Cartesia.TtsRequest = {
      modelId: model,
      transcript: config.text,
      voice: {
        mode: 'id',
        id: config.voiceId,
      },
      language: (config.language || 'en') as Cartesia.SupportedLanguage,
      outputFormat: {
        container: 'raw',
        encoding: (config.outputFormat?.encoding ||
          'pcm_s16le') as Cartesia.RawEncoding,
        sampleRate: config.outputFormat?.sampleRate || 16000,
      },
    };

    // Log the full request object being sent to Cartesia
    this.logger.log(`📤 Cartesia API Request:`);
    this.logger.log(JSON.stringify(ttsRequest, null, 2));

    return {
      // getAudio: async () => {
      //   const startTime = Date.now();

      //   this.logger.log(`⏳ Calling Cartesia TTS API...`);
      //   this.logger.log(`  Text: "${config.text}"`);

      //   // Call Cartesia TTS API
      //   const audioStream: Readable = await client.tts.bytes(ttsRequest);
      //   const apiCallDuration = Date.now() - startTime;

      //   this.logger.log(`✅ Cartesia API responded (${apiCallDuration}ms) - receiving audio stream...`);

      //   // Collect all chunks into a buffer
      //   const chunks: Buffer[] = [];
      //   let totalBytesReceived = 0;

      //   return new Promise<Buffer>((resolve, reject) => {
      //     // Add timeout to detect hung streams (15 seconds max)
      //     const streamTimeout = setTimeout(() => {
      //       this.logger.error(`❌ TTS stream TIMEOUT - no data for 15s`);
      //       this.logger.error(`  Chunks received: ${chunks.length}`);
      //       this.logger.error(`  Bytes received: ${totalBytesReceived}`);
      //       this.logger.error(`  Time elapsed: ${Date.now() - startTime}ms`);
      //       reject(new Error('TTS stream timeout - Cartesia did not complete audio streaming'));
      //     }, 15000);

      //     let chunkCount = 0;

      //     audioStream.on('data', (chunk: Buffer) => {
      //       chunkCount++;
      //       totalBytesReceived += chunk.length;
      //       chunks.push(chunk);

      //       // Reset timeout on each chunk (stream is still active)
      //       clearTimeout(streamTimeout);

      //       // Log every chunk (use debug to avoid spam, but shows stream progress)
      //       this.logger.debug(`📦 Chunk ${chunkCount}: ${chunk.length} bytes (total: ${totalBytesReceived} bytes)`);

      //       // Log every 10 chunks at info level
      //       if (chunkCount % 10 === 0) {
      //         this.logger.log(`📊 Progress: ${chunkCount} chunks, ${totalBytesReceived} bytes`);
      //       }
      //     });

      //     audioStream.on('end', () => {
      //       clearTimeout(streamTimeout);

      //       const fullBuffer = Buffer.concat(chunks);
      //       const totalDuration = Date.now() - startTime;
      //       const sampleCount = fullBuffer.length / 2; // 2 bytes per sample (16-bit)
      //       const audioDuration = (sampleCount / (config.outputFormat?.sampleRate || 16000)) * 1000;

      //       // CRITICAL: Change to .log for visibility
      //       this.logger.log(`✅ ✅ ✅ TTS STREAM COMPLETE ✅ ✅ ✅`);
      //       this.logger.log(`  Total bytes: ${fullBuffer.length}`);
      //       this.logger.log(`  Total chunks: ${chunks.length}`);
      //       this.logger.log(`  Sample count: ${sampleCount}`);
      //       this.logger.log(`  Audio duration: ~${audioDuration.toFixed(0)}ms`);
      //       this.logger.log(`  Stream duration: ${totalDuration}ms`);
      //       this.logger.log(`  Sample rate: ${config.outputFormat?.sampleRate || 16000}Hz`);
      //       this.logger.log(`  Encoding: ${config.outputFormat?.encoding || 'pcm_s16le'}`);

      //       // Log raw response metadata (what Cartesia sent us)
      //       this.logger.log(`📥 Cartesia Response Summary:`);
      //       this.logger.log(`  - Status: SUCCESS`);
      //       this.logger.log(`  - Audio format: Raw ${config.outputFormat?.encoding || 'pcm_s16le'}`);
      //       this.logger.log(`  - Sample rate: ${config.outputFormat?.sampleRate || 16000}Hz`);
      //       this.logger.log(`  - Channels: 1 (mono)`);
      //       this.logger.log(`  - Bits per sample: 16`);
      //       this.logger.log(`  - Byte rate: ${((config.outputFormat?.sampleRate || 16000) * 2).toLocaleString()} bytes/sec`);

      //       resolve(fullBuffer);
      //     });

      //     audioStream.on('error', (error) => {
      //       clearTimeout(streamTimeout);

      //       this.logger.error(`❌ ❌ ❌ TTS SYNTHESIS ERROR ❌ ❌ ❌`);
      //       this.logger.error(`  Error message: ${error.message}`);
      //       this.logger.error(`  Error name: ${error.name}`);
      //       this.logger.error(`  Chunks received before error: ${chunks.length}`);
      //       this.logger.error(`  Bytes received before error: ${totalBytesReceived}`);
      //       this.logger.error(`  Time elapsed: ${Date.now() - startTime}ms`);

      //       // Log full error object
      //       this.logger.error(`  Error stack: ${error.stack}`);
      //       this.logger.error(`  Error details: ${JSON.stringify(error, null, 2)}`);

      //       // Log request params for debugging
      //       this.logger.error(`  Request params:`);
      //       this.logger.error(`    - Voice ID: ${config.voiceId}`);
      //       this.logger.error(`    - Model: ${model}`);
      //       this.logger.error(`    - Text length: ${config.text.length}`);
      //       this.logger.error(`    - Sample rate: ${config.outputFormat?.sampleRate || 16000}`);

      //       reject(error);
      //     });
      //   });
      // },

      getAudio: async () => {
        const startTime = Date.now();
        this.logger.log(`⏳ Calling Cartesia TTS API...`);
        this.logger.log(`  Text: "${config.text}"`);

        try {
          const audioStream = await client.tts.bytes(ttsRequest);
          const apiCallDuration = Date.now() - startTime;
          this.logger.log(
            `✅ Cartesia API responded (${apiCallDuration}ms) - receiving audio stream...`,
          );

          //const chunks = [];
          const chunks: Buffer[] = [];
          let totalBytesReceived = 0;
          let chunkCount = 0;

          // Cartesia SDK returns AsyncIterable, not Node.js EventEmitter stream
          // Must use for-await-of instead of .on('data')
          for await (const chunk of audioStream) {
            chunkCount++;
            const buffer = Buffer.from(chunk);
            totalBytesReceived += buffer.length;
            chunks.push(buffer);

            this.logger.debug(
              `📦 Chunk ${chunkCount}: ${buffer.length} bytes (total: ${totalBytesReceived} bytes)`,
            );

            if (chunkCount % 10 === 0) {
              this.logger.log(
                `📊 Progress: ${chunkCount} chunks, ${totalBytesReceived} bytes`,
              );
            }
          }

          const fullBuffer = Buffer.concat(chunks);
          const totalDuration = Date.now() - startTime;
          const sampleCount = fullBuffer.length / 2;
          const audioDuration =
            (sampleCount / (config.outputFormat?.sampleRate || 16000)) * 1000;

          this.logger.log(`✅ ✅ ✅ TTS STREAM COMPLETE ✅ ✅ ✅`);
          this.logger.log(`  Total bytes: ${fullBuffer.length}`);
          this.logger.log(`  Total chunks: ${chunks.length}`);
          this.logger.log(`  Sample count: ${sampleCount}`);
          this.logger.log(`  Audio duration: ~${audioDuration.toFixed(0)}ms`);
          this.logger.log(`  Stream duration: ${totalDuration}ms`);
          this.logger.log(
            `  Sample rate: ${config.outputFormat?.sampleRate || 16000}Hz`,
          );
          this.logger.log(
            `  Encoding: ${config.outputFormat?.encoding || 'pcm_s16le'}`,
          );
          this.logger.log(`📥 Cartesia Response Summary:`);
          this.logger.log(`  - Status: SUCCESS`);
          this.logger.log(
            `  - Audio format: Raw ${config.outputFormat?.encoding || 'pcm_s16le'}`,
          );
          this.logger.log(
            `  - Sample rate: ${config.outputFormat?.sampleRate || 16000}Hz`,
          );
          this.logger.log(`  - Channels: 1 (mono)`);
          this.logger.log(`  - Bits per sample: 16`);
          this.logger.log(
            `  - Byte rate: ${((config.outputFormat?.sampleRate || 16000) * 2).toLocaleString()} bytes/sec`,
          );

          return fullBuffer;
        } catch (error) {
          const totalDuration = Date.now() - startTime;
          this.logger.error(`❌ ❌ ❌ TTS SYNTHESIS ERROR ❌ ❌ ❌`);
          this.logger.error(`  Error message: ${error.message}`);
          this.logger.error(`  Error name: ${error.name}`);
          this.logger.error(`  Time elapsed: ${totalDuration}ms`);
          this.logger.error(`  Error stack: ${error.stack}`);
          this.logger.error(`  Request params:`);
          this.logger.error(`    - Voice ID: ${config.voiceId}`);
          this.logger.error(`    - Model: ${model}`);
          this.logger.error(`    - Text length: ${config.text.length}`);
          this.logger.error(
            `    - Sample rate: ${config.outputFormat?.sampleRate || 16000}`,
          );
          throw error;
        }
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
