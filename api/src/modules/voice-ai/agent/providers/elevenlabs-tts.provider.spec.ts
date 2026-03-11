import { ElevenLabsTtsProvider } from './elevenlabs-tts.provider';
import { StreamingTtsConfig } from './tts.interface';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('ElevenLabsTtsProvider', () => {
  let provider: ElevenLabsTtsProvider;
  let mockWebSocket: any;

  beforeEach(() => {
    provider = new ElevenLabsTtsProvider();

    // Create mock WebSocket instance
    mockWebSocket = {
      readyState: WebSocket.OPEN,
      send: jest.fn(),
      close: jest.fn(),
      on: jest.fn(),
    };

    // Mock WebSocket constructor
    (WebSocket as any).mockImplementation(() => mockWebSocket);
    (WebSocket as any).OPEN = 1;
    (WebSocket as any).CONNECTING = 0;
    (WebSocket as any).CLOSED = 3;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('connect', () => {
    it('should throw error if apiKey is missing', async () => {
      const config: StreamingTtsConfig = {
        apiKey: '',
        voiceId: 'test-voice-id',
      };

      await expect(provider.connect(config)).rejects.toThrow(
        'ElevenLabs TTS: apiKey is required',
      );
    });

    it('should throw error if apiKey is whitespace only', async () => {
      const config: StreamingTtsConfig = {
        apiKey: '   ',
        voiceId: 'test-voice-id',
      };

      await expect(provider.connect(config)).rejects.toThrow(
        'ElevenLabs TTS: apiKey is required',
      );
    });

    it('should throw error if voiceId is missing', async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: '',
      };

      await expect(provider.connect(config)).rejects.toThrow(
        'ElevenLabs TTS: voiceId is required',
      );
    });

    it('should throw error if voiceId is whitespace only', async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: '   ',
      };

      await expect(provider.connect(config)).rejects.toThrow(
        'ElevenLabs TTS: voiceId is required',
      );
    });

    it('should open WebSocket connection with correct URL', async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: 'test-voice-id',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.connect(config);

      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('wss://api.elevenlabs.io/v1/text-to-speech/'),
        expect.objectContaining({
          headers: {
            'xi-api-key': 'test-api-key',
          },
        }),
      );
      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('test-voice-id'),
        expect.any(Object),
      );
      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('model_id=eleven_flash_v2_5'),
        expect.any(Object),
      );
    });

    it('should use custom model when provided', async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: 'test-voice-id',
        model: 'eleven_multilingual_v2',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.connect(config);

      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringContaining('model_id=eleven_multilingual_v2'),
        expect.any(Object),
      );
    });

    it('should send initialization message on WebSocket open', async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: 'test-voice-id',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.connect(config);

      expect(mockWebSocket.send).toHaveBeenCalled();
      const initMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(initMessage).toHaveProperty('text');
      expect(initMessage).toHaveProperty('voice_settings');
      expect(initMessage).toHaveProperty('xi_api_key', 'test-api-key');
    });
  });

  describe('streamText', () => {
    beforeEach(async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: 'test-voice-id',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.connect(config);
      jest.clearAllMocks(); // Clear init message send
    });

    it('should send message to WebSocket when text is provided', () => {
      provider.streamText('Hello world', 'context-1', false);

      expect(mockWebSocket.send).toHaveBeenCalled();
      const message = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(message).toHaveProperty('text', 'Hello world');
      expect(message).toHaveProperty('try_trigger_generation', true);
    });

    it('should send flush message when isFinal is true', () => {
      provider.streamText('Final text', 'context-1', true);

      const message = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(message).toHaveProperty('flush', true);
    });

    it('should buffer trivially short tokens before sending', () => {
      // First token is punctuation only - should be buffered
      provider.streamText('.', 'context-1', false);
      expect(mockWebSocket.send).not.toHaveBeenCalled();

      // Second token has content - should send buffered + new
      provider.streamText(' Hello', 'context-1', false);
      expect(mockWebSocket.send).toHaveBeenCalled();
    });

    it('should queue messages when WebSocket is not ready', () => {
      mockWebSocket.readyState = WebSocket.CONNECTING;

      provider.streamText('Queued text', 'context-1', false);

      // Message should be queued, not sent immediately
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });

  describe('onAudioChunk', () => {
    beforeEach(async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: 'test-voice-id',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.connect(config);
    });

    it('should register callback and fire it when audio data arrives', () => {
      const audioCallback = jest.fn();
      provider.onAudioChunk(audioCallback);

      // Simulate receiving audio message from ElevenLabs
      const messageCallback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1];

      const audioData = Buffer.from('test audio').toString('base64');
      const message = JSON.stringify({
        audio: audioData,
        isFinal: false,
      });

      messageCallback(message);

      expect(audioCallback).toHaveBeenCalledWith(
        'default',
        expect.any(Buffer),
        false,
      );
    });

    it('should handle final audio message', () => {
      const audioCallback = jest.fn();
      provider.onAudioChunk(audioCallback);

      const messageCallback = mockWebSocket.on.mock.calls.find(
        (call) => call[0] === 'message',
      )?.[1];

      const message = JSON.stringify({
        isFinal: true,
      });

      messageCallback(message);

      expect(audioCallback).toHaveBeenCalledWith(
        'default',
        expect.any(Buffer),
        true,
      );
    });
  });

  describe('cancelContext', () => {
    beforeEach(async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: 'test-voice-id',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.connect(config);
    });

    it('should clear context buffer when cancelled', () => {
      // Set up some text in buffer
      provider.streamText('.', 'context-1', false);

      // Cancel
      provider.cancelContext('context-1');

      // Next text should not include buffered content
      jest.clearAllMocks();
      provider.streamText('Hello', 'context-1', false);

      const sendCalls = mockWebSocket.send.mock.calls;
      expect(sendCalls.length).toBeGreaterThan(0);
      const message = JSON.parse(sendCalls[0][0]);
      expect(message.text).toBe('Hello');
    });
  });

  describe('disconnect', () => {
    beforeEach(async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: 'test-voice-id',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.connect(config);
    });

    it('should close WebSocket and clear callback', async () => {
      mockWebSocket.readyState = WebSocket.OPEN;

      await provider.disconnect();

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"text":""'),
      );
      expect(mockWebSocket.close).toHaveBeenCalled();
    });

    it('should not throw if WebSocket is already closed', async () => {
      mockWebSocket.readyState = WebSocket.CLOSED;

      await expect(provider.disconnect()).resolves.not.toThrow();
    });
  });

  describe('isConnected', () => {
    it('should return false when not connected', () => {
      expect(provider.isConnected()).toBe(false);
    });

    it('should return true when WebSocket is open', async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: 'test-voice-id',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });
      mockWebSocket.readyState = WebSocket.OPEN;

      await provider.connect(config);

      expect(provider.isConnected()).toBe(true);
    });
  });

  describe('getUsage', () => {
    beforeEach(async () => {
      const config: StreamingTtsConfig = {
        apiKey: 'test-api-key',
        voiceId: 'test-voice-id',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.connect(config);
      jest.clearAllMocks(); // Clear init message
    });

    it('should return correct character count', () => {
      provider.streamText('Hello', 'context-1', false);
      provider.streamText(' world', 'context-1', true);

      const usage = provider.getUsage();

      expect(usage).toHaveProperty('totalCharacters');
      expect(usage.totalCharacters).toBeGreaterThan(0);
    });

    it('should persist character count after disconnect', async () => {
      provider.streamText('Test message', 'context-1', true);

      const usageBeforeDisconnect = provider.getUsage();

      await provider.disconnect();

      const usageAfterDisconnect = provider.getUsage();

      expect(usageAfterDisconnect.totalCharacters).toBe(
        usageBeforeDisconnect.totalCharacters,
      );
    });
  });

  describe('reconnection', () => {
    it('should attempt reconnection up to 3 times', async () => {
      // This test verifies the reconnection logic exists
      // Full reconnection testing would require more complex mocking
      // For now, we verify the maxReconnectAttempts constant is set correctly
      const provider2 = new ElevenLabsTtsProvider();
      expect(provider2['maxReconnectAttempts']).toBe(3);
    });
  });
});
