import { DeepgramSttProvider } from './deepgram-stt.provider';
import { ElevenLabsSttProvider } from './elevenlabs-stt.provider';
import { SttProvider } from './stt.interface';

export function createSttProvider(providerKey: string): SttProvider {
  switch (providerKey) {
    case 'deepgram':
      return new DeepgramSttProvider();
    case 'elevenlabs_stt':
      return new ElevenLabsSttProvider();
    default:
      throw new Error(`Unknown STT provider: ${providerKey}`);
  }
}
