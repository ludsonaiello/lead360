import { createSttProvider } from './stt-factory';
import { createTtsProvider } from './tts-factory';
import { DeepgramSttProvider } from './deepgram-stt.provider';
import { ElevenLabsSttProvider } from './elevenlabs-stt.provider';
import { CartesiaTtsProvider } from './cartesia-tts.provider';
import { ElevenLabsTtsProvider } from './elevenlabs-tts.provider';

describe('Provider Factories', () => {
  describe('createSttProvider', () => {
    it('should return DeepgramSttProvider for "deepgram" key', () => {
      const provider = createSttProvider('deepgram');
      expect(provider).toBeInstanceOf(DeepgramSttProvider);
    });

    it('should return ElevenLabsSttProvider for "elevenlabs_stt" key', () => {
      const provider = createSttProvider('elevenlabs_stt');
      expect(provider).toBeInstanceOf(ElevenLabsSttProvider);
    });

    it('should throw error for unknown provider key', () => {
      expect(() => createSttProvider('unknown')).toThrow(
        'Unknown STT provider: unknown',
      );
    });

    it('should not break existing Deepgram provider (regression test)', () => {
      const provider = createSttProvider('deepgram');
      expect(provider).toBeDefined();
      expect(typeof provider.startTranscription).toBe('function');
    });
  });

  describe('createTtsProvider', () => {
    it('should return CartesiaTtsProvider for "cartesia" key', () => {
      const provider = createTtsProvider('cartesia');
      expect(provider).toBeInstanceOf(CartesiaTtsProvider);
    });

    it('should return ElevenLabsTtsProvider for "elevenlabs_tts" key', () => {
      const provider = createTtsProvider('elevenlabs_tts');
      expect(provider).toBeInstanceOf(ElevenLabsTtsProvider);
    });

    it('should throw error for unknown provider key', () => {
      expect(() => createTtsProvider('unknown')).toThrow(
        'Unknown TTS provider: unknown',
      );
    });

    it('should not break existing Cartesia provider (regression test)', () => {
      const provider = createTtsProvider('cartesia');
      expect(provider).toBeDefined();
      expect(typeof provider.synthesize).toBe('function');
    });

    it('should return StreamingTtsProvider for ElevenLabs', () => {
      const provider = createTtsProvider('elevenlabs_tts');
      expect(provider).toBeDefined();
      expect(typeof (provider as any).connect).toBe('function');
      expect(typeof (provider as any).streamText).toBe('function');
      expect(typeof (provider as any).disconnect).toBe('function');
    });
  });
});
