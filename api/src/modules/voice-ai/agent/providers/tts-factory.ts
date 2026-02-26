import { CartesiaTtsProvider } from './cartesia-tts.provider';
import { TtsProvider } from './tts.interface';

export function createTtsProvider(providerKey: string): TtsProvider {
  switch (providerKey) {
    case 'cartesia':
      return new CartesiaTtsProvider();
    default:
      throw new Error(`Unknown TTS provider: ${providerKey}`);
  }
}
