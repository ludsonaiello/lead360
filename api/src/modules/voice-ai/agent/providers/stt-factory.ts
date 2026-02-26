import { DeepgramSttProvider } from './deepgram-stt.provider';
import { SttProvider } from './stt.interface';

export function createSttProvider(providerKey: string): SttProvider {
  switch (providerKey) {
    case 'deepgram':
      return new DeepgramSttProvider();
    default:
      throw new Error(`Unknown STT provider: ${providerKey}`);
  }
}
