import { ElevenLabsSttProvider } from './elevenlabs-stt.provider';
import { SttConfig } from './stt.interface';
import WebSocket from 'ws';

// Mock WebSocket
jest.mock('ws');

describe('ElevenLabsSttProvider', () => {
  let provider: ElevenLabsSttProvider;
  let mockWebSocket: any;

  beforeEach(() => {
    provider = new ElevenLabsSttProvider();

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

  describe('startTranscription', () => {
    it('should throw error if apiKey is missing', async () => {
      const config: SttConfig = {
        language: 'en',
        apiKey: '',
      };

      await expect(provider.startTranscription(config)).rejects.toThrow(
        'ElevenLabs STT: apiKey is required',
      );
    });

    it('should throw error if apiKey is whitespace only', async () => {
      const config: SttConfig = {
        language: 'en',
        apiKey: '   ',
      };

      await expect(provider.startTranscription(config)).rejects.toThrow(
        'ElevenLabs STT: apiKey is required',
      );
    });

    it('should connect to WebSocket with correct URL including query params', async () => {
      const config: SttConfig = {
        language: 'en',
        apiKey: 'test-api-key',
      };

      // Trigger 'open' event immediately
      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.startTranscription(config);

      // ElevenLabs uses query params for config, NOT an init message
      // All config comes from database schema: model_id, language_code, audio_format, commit_strategy, etc.
      expect(WebSocket).toHaveBeenCalledWith(
        expect.stringMatching(
          /wss:\/\/api\.elevenlabs\.io\/v1\/speech-to-text\/realtime\?.*model_id=.*language_code=.*audio_format=/,
        ),
        expect.objectContaining({
          headers: {
            'xi-api-key': 'test-api-key',
          },
        }),
      );
    });

    it('should include correct query params for language and model', async () => {
      const config: SttConfig = {
        language: 'pt',
        apiKey: 'test-api-key',
        model: 'scribe_v2_realtime',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.startTranscription(config);

      // Check the URL contains correct query params
      const [wsUrl] = (WebSocket as any).mock.calls[0];
      expect(wsUrl).toContain('language_code=pt');
      expect(wsUrl).toContain('model_id=scribe_v2_realtime');
    });

    it('should NOT send any init message on WebSocket open', async () => {
      const config: SttConfig = {
        language: 'en',
        apiKey: 'test-api-key',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.startTranscription(config);

      // Verify NO init message was sent (ElevenLabs uses query params)
      // send() should not be called during connection setup
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });

    it('should NOT read Deepgram-specific config properties', async () => {
      const config: SttConfig = {
        language: 'en',
        apiKey: 'test-api-key',
        // Deepgram-specific properties that should be ignored
        endpointing: 500,
        utterance_end_ms: 1500,
        vad_events: true,
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.startTranscription(config);

      // Verify URL does NOT contain Deepgram properties
      const [wsUrl] = (WebSocket as any).mock.calls[0];
      expect(wsUrl).not.toContain('endpointing');
      expect(wsUrl).not.toContain('utterance_end_ms');
      expect(wsUrl).not.toContain('vad_events');
    });

    it('should use VAD commit strategy by default', async () => {
      const config: SttConfig = {
        language: 'en',
        apiKey: 'test-api-key',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      await provider.startTranscription(config);

      const [wsUrl] = (WebSocket as any).mock.calls[0];
      expect(wsUrl).toContain('commit_strategy=vad');
    });
  });

  describe('SttSession', () => {
    let session: any;

    beforeEach(async () => {
      const config: SttConfig = {
        language: 'en',
        apiKey: 'test-api-key',
      };

      mockWebSocket.on.mockImplementation((event: string, callback: any) => {
        if (event === 'open') {
          setTimeout(callback, 0);
        }
      });

      session = await provider.startTranscription(config);
    });

    describe('sendAudio', () => {
      it('should send audio as JSON with base64-encoded data when connected', () => {
        const audioChunk = Buffer.from([1, 2, 3, 4]);
        mockWebSocket.readyState = WebSocket.OPEN;

        session.sendAudio(audioChunk);

        // ElevenLabs expects JSON with base64 audio, NOT raw binary
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          expect.stringContaining('"message_type":"input_audio_chunk"'),
        );
        expect(mockWebSocket.send).toHaveBeenCalledWith(
          expect.stringContaining('"audio_base_64"'),
        );
      });

      it('should encode audio as valid base64', () => {
        const audioChunk = Buffer.from([1, 2, 3, 4]);
        mockWebSocket.readyState = WebSocket.OPEN;

        session.sendAudio(audioChunk);

        const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
        expect(sentMessage.message_type).toBe('input_audio_chunk');
        // Verify the base64 can be decoded back
        const decoded = Buffer.from(sentMessage.audio_base_64, 'base64');
        expect(decoded).toEqual(audioChunk);
      });

      it('should not throw when WebSocket is not open', () => {
        const audioChunk = Buffer.from([1, 2, 3, 4]);
        mockWebSocket.readyState = WebSocket.CLOSED;

        expect(() => session.sendAudio(audioChunk)).not.toThrow();
        expect(mockWebSocket.send).not.toHaveBeenCalled();
      });
    });

    describe('transcript event', () => {
      it('should fire handler when final transcript is received (message_type)', () => {
        const transcriptHandler = jest.fn();
        session.on('transcript', transcriptHandler);

        // Simulate receiving a final transcript from ElevenLabs
        const messageCallback = mockWebSocket.on.mock.calls.find(
          (call) => call[0] === 'message',
        )?.[1];

        // ElevenLabs uses 'message_type' not 'type'
        const message = JSON.stringify({
          message_type: 'committed_transcript',
          text: 'Hello world',
        });

        messageCallback(message);

        expect(transcriptHandler).toHaveBeenCalledWith('Hello world', true);
      });

      it('should also support transcript field for backwards compatibility', () => {
        const transcriptHandler = jest.fn();
        session.on('transcript', transcriptHandler);

        const messageCallback = mockWebSocket.on.mock.calls.find(
          (call) => call[0] === 'message',
        )?.[1];

        const message = JSON.stringify({
          message_type: 'committed_transcript',
          transcript: 'Hello world fallback',
        });

        messageCallback(message);

        expect(transcriptHandler).toHaveBeenCalledWith('Hello world fallback', true);
      });

      it('should fire handler for interim results when interim_results is true', async () => {
        const config: SttConfig = {
          language: 'en',
          apiKey: 'test-api-key',
          interim_results: true,
        };

        let messageHandler: any;
        mockWebSocket.on.mockImplementation((event: string, callback: any) => {
          if (event === 'open') {
            setTimeout(callback, 0);
          }
          if (event === 'message') {
            messageHandler = callback;
          }
        });

        session = await provider.startTranscription(config);

        const transcriptHandler = jest.fn();
        session.on('transcript', transcriptHandler);

        // ElevenLabs uses 'message_type' not 'type'
        const message = JSON.stringify({
          message_type: 'partial_transcript',
          text: 'Hello',
        });

        messageHandler(message);

        expect(transcriptHandler).toHaveBeenCalledWith('Hello', false);
      });

      it('should NOT fire handler for interim results when interim_results is false', async () => {
        const config: SttConfig = {
          language: 'en',
          apiKey: 'test-api-key',
          interim_results: false,
        };

        let messageHandler: any;
        mockWebSocket.on.mockImplementation((event: string, callback: any) => {
          if (event === 'open') {
            setTimeout(callback, 0);
          }
          if (event === 'message') {
            messageHandler = callback;
          }
        });

        session = await provider.startTranscription(config);

        const transcriptHandler = jest.fn();
        session.on('transcript', transcriptHandler);

        const message = JSON.stringify({
          message_type: 'partial_transcript',
          text: 'Hello',
        });

        messageHandler(message);

        expect(transcriptHandler).not.toHaveBeenCalled();
      });

      it('should handle session_started message without error', () => {
        const transcriptHandler = jest.fn();
        const errorHandler = jest.fn();
        session.on('transcript', transcriptHandler);
        session.on('error', errorHandler);

        const messageCallback = mockWebSocket.on.mock.calls.find(
          (call) => call[0] === 'message',
        )?.[1];

        const message = JSON.stringify({
          message_type: 'session_started',
          session_id: 'test-session-123',
          config: {
            model_id: 'scribe_v2_realtime',
            sample_rate: 16000,
          },
        });

        messageCallback(message);

        // session_started should not trigger transcript or error
        expect(transcriptHandler).not.toHaveBeenCalled();
        expect(errorHandler).not.toHaveBeenCalled();
      });
    });

    describe('error event', () => {
      it('should propagate WebSocket errors to error handler', () => {
        const errorHandler = jest.fn();
        session.on('error', errorHandler);

        const errorCallback = mockWebSocket.on.mock.calls.find(
          (call) => call[0] === 'error',
        )?.[1];

        const testError = new Error('WebSocket connection failed');
        errorCallback(testError);

        expect(errorHandler).toHaveBeenCalledWith(testError);
      });

      it('should propagate ElevenLabs input_error messages to error handler', () => {
        const errorHandler = jest.fn();
        session.on('error', errorHandler);

        const messageCallback = mockWebSocket.on.mock.calls.find(
          (call) => call[0] === 'message',
        )?.[1];

        // ElevenLabs uses 'message_type' not 'type'
        const message = JSON.stringify({
          message_type: 'input_error',
          error: 'Unexpected message type: init',
        });

        messageCallback(message);

        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Unexpected message type: init'),
          }),
        );
      });

      it('should propagate ElevenLabs auth_error messages to error handler', () => {
        const errorHandler = jest.fn();
        session.on('error', errorHandler);

        const messageCallback = mockWebSocket.on.mock.calls.find(
          (call) => call[0] === 'message',
        )?.[1];

        const message = JSON.stringify({
          message_type: 'auth_error',
          error: 'Invalid API key',
        });

        messageCallback(message);

        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('Invalid API key'),
          }),
        );
      });

      it('should propagate quota_exceeded messages to error handler', () => {
        const errorHandler = jest.fn();
        session.on('error', errorHandler);

        const messageCallback = mockWebSocket.on.mock.calls.find(
          (call) => call[0] === 'message',
        )?.[1];

        const message = JSON.stringify({
          message_type: 'quota_exceeded',
          message: 'Monthly quota exceeded',
        });

        messageCallback(message);

        expect(errorHandler).toHaveBeenCalledWith(
          expect.objectContaining({
            message: expect.stringContaining('quota_exceeded'),
          }),
        );
      });
    });

    describe('close', () => {
      it('should close WebSocket connection', async () => {
        mockWebSocket.readyState = WebSocket.OPEN;

        await session.close();

        expect(mockWebSocket.close).toHaveBeenCalled();
      });

      it('should not throw if WebSocket is already closed', async () => {
        mockWebSocket.readyState = WebSocket.CLOSED;

        await expect(session.close()).resolves.not.toThrow();
      });
    });

    describe('getUsage', () => {
      it('should return elapsed seconds', async () => {
        // Wait a bit
        await new Promise((resolve) => setTimeout(resolve, 100));

        const usage = session.getUsage();

        expect(usage).toHaveProperty('totalSeconds');
        expect(typeof usage.totalSeconds).toBe('number');
        expect(usage.totalSeconds).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
