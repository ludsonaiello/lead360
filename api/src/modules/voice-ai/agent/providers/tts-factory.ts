import { CartesiaTtsProvider } from './cartesia-tts.provider';
import { ElevenLabsTtsProvider } from './elevenlabs-tts.provider';
import { TtsProvider, StreamingTtsProvider } from './tts.interface';

export function createTtsProvider(
  providerKey: string,
): TtsProvider | StreamingTtsProvider {
  switch (providerKey) {
    case 'cartesia':
      return new CartesiaTtsProvider();
    case 'elevenlabs_tts':
      return new ElevenLabsTtsProvider();
    default:
      throw new Error(`Unknown TTS provider: ${providerKey}`);
  }
}
