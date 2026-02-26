import { Logger } from '@nestjs/common';
import { VoiceAiContext } from '../interfaces/voice-ai-context.interface';
import { createSttProvider } from './providers/stt-factory';
import { createLlmProvider } from './providers/llm-factory';
import { createTtsProvider } from './providers/tts-factory';
import { AgentTool } from './tools/tool.interface';
import { LlmMessage, LlmToolCall } from './providers/llm.interface';
import { Room, RemoteTrack, RemoteAudioTrack, AudioStream, AudioSource, LocalAudioTrack, AudioFrame, TrackKind, TrackPublishOptions } from '@livekit/rtc-node';
import { ParticipantKind } from '@livekit/rtc-node';
import { SipClient } from 'livekit-server-sdk';

/**
 * VoiceAgentSession — Sprint BAS24
 *
 * Manages a single voice conversation session using STT → LLM → TTS pipeline.
 *
 * Architecture:
 *   1. Receives a LiveKit Room connection (already connected via JobContext)
 *   2. Builds context from VoiceAiContextBuilderService
 *   3. Initializes STT, LLM, TTS providers
 *   4. Manages conversation loop:
 *      - STT transcribes caller speech
 *      - LLM generates response (with optional tool calls)
 *      - Tools executed when LLM requests them
 *      - TTS synthesizes response
 *      - Audio published to LiveKit room
 *   5. Handles transfer (signals pipeline to transfer call)
 *   6. Cleanup on call end
 *
 * CRITICAL:
 *   - All provider API keys are already decrypted in context
 *   - Never log or cache the context object (contains secrets)
 *   - This session runs entirely in-memory for the call duration
 */
export class VoiceAgentSession {
  private readonly logger = new Logger(VoiceAgentSession.name);
  private conversationHistory: LlmMessage[] = [];
  private isActive = true;
  private transferRequested = false;
  private transferNumber: string | null = null;
  private audioSource: AudioSource | null = null;
  private audioTrack: LocalAudioTrack | null = null;
  private audioStreamReader: ReadableStreamDefaultReader<AudioFrame> | null = null;

  constructor(
    private readonly context: VoiceAiContext,
    private readonly tools: AgentTool[],
    private readonly room: Room,
    private readonly livekitConfig: { url: string; apiKey: string; apiSecret: string },
  ) {}

  /**
   * Start the voice agent session.
   *
   * Execution flow:
   *   1. Initialize STT, LLM, TTS providers from context
   *   2. Build conversation history with system prompt
   *   3. Play greeting via TTS
   *   4. Start STT transcription session
   *   5. Listen for transcripts and handle them
   *
   * NOTE: This method is async but does NOT return until session ends.
   * The caller should await this in the background or handle it appropriately.
   */
  async start(): Promise<void> {
    try {
      this.logger.log(`Starting voice session for tenant: ${this.context.tenant.id}`);

      // Validate providers are configured
      if (!this.context.providers.stt) {
        throw new Error('STT provider not configured');
      }
      if (!this.context.providers.llm) {
        throw new Error('LLM provider not configured');
      }
      if (!this.context.providers.tts) {
        throw new Error('TTS provider not configured');
      }

      // Initialize providers
      const sttProvider = createSttProvider(this.context.providers.stt.provider_key);
      const llmProvider = createLlmProvider(this.context.providers.llm.provider_key);
      const ttsProvider = createTtsProvider(this.context.providers.tts.provider_key);

      // Initialize conversation with system prompt
      this.conversationHistory = [
        { role: 'system', content: this.context.behavior.system_prompt },
      ];

      // Gap 2: Create and publish audio track for TTS output
      // Create audio source for TTS output (16kHz mono, matching Cartesia output)
      this.audioSource = new AudioSource(16000, 1);
      this.audioTrack = LocalAudioTrack.createAudioTrack('agent-voice', this.audioSource);

      // Publish the audio track to the room
      if (this.room.localParticipant) {
        await this.room.localParticipant.publishTrack(this.audioTrack, new TrackPublishOptions());
        this.logger.log('Published audio track to room');
      } else {
        this.logger.warn('No local participant - cannot publish audio track');
      }

      // Play greeting
      if (this.context.behavior.greeting) {
        await this.speak(ttsProvider, this.context.behavior.greeting);
      }

      // Start STT session
      const sttSession = await sttProvider.startTranscription({
        apiKey: this.context.providers.stt.api_key,
        language: this.context.behavior.language,
        ...this.context.providers.stt.config,
      });

      // Handle transcripts
      let currentUtterance = '';
      sttSession.on('transcript', async (text: string, isFinal: boolean) => {
        if (!this.isActive) return;

        currentUtterance = text;

        if (isFinal && text.trim()) {
          this.logger.log(`User said: ${text}`);
          await this.handleUtterance(text, llmProvider, ttsProvider);
          currentUtterance = '';
        }
      });

      sttSession.on('error', (error: Error) => {
        this.logger.error(`STT error: ${error.message}`, error.stack);
      });

      // Subscribe to caller audio from LiveKit room
      // Gap 1: Pipe incoming audio to STT
      this.room.on('trackSubscribed', async (track: RemoteTrack, publication, participant) => {
        if (track.kind === TrackKind.KIND_AUDIO) {
          this.logger.log(`Subscribed to audio track from participant: ${participant.identity}`);

          try {
            // Create audio stream from the remote audio track
            const audioStream = new AudioStream(track as RemoteAudioTrack, {
              sampleRate: 16000, // Match Deepgram's expected sample rate
              numChannels: 1,    // Mono audio
            });

            // Read audio frames and send to STT
            this.audioStreamReader = audioStream.getReader();

            // Start reading frames in background
            this.pipeAudioToStt(this.audioStreamReader, sttSession).catch((error) => {
              this.logger.error(`Error piping audio to STT: ${error.message}`, error.stack);
            });

          } catch (error) {
            this.logger.error(`Error setting up audio stream: ${error.message}`, error.stack);
          }
        }
      });

      this.logger.log('Voice session started successfully');

      // Keep session alive until stopped
      await this.waitUntilStopped();

      // Cleanup
      await this.cleanup();
      await sttSession.close();
      this.logger.log('Voice session ended');

    } catch (error) {
      this.logger.error(`Voice session error: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Handle a complete utterance from the caller.
   *
   * Flow:
   *   1. Add user message to conversation history
   *   2. Call LLM with conversation history and tool definitions
   *   3. Check if LLM wants to call any tools
   *   4. Execute tools if requested
   *   5. Get LLM follow-up response after tool execution
   *   6. Speak the response via TTS
   */
  private async handleUtterance(
    text: string,
    llmProvider: any,
    ttsProvider: any,
  ): Promise<void> {
    try {
      // Add user message to history
      this.conversationHistory.push({ role: 'user', content: text });

      // Build tool definitions for LLM
      const toolDefinitions = this.tools.map(t => t.definition);

      // Call LLM
      const llmSession = await llmProvider.chat({
        apiKey: this.context.providers.llm!.api_key,
        model: (this.context.providers.llm!.config?.model as string) || 'gpt-4o',
        messages: this.conversationHistory,
        tools: toolDefinitions,
        maxTokens: 200,
      });

      // Check for tool calls
      const toolCalls = await llmSession.getToolCalls();

      if (toolCalls.length > 0) {
        this.logger.log(`LLM requested ${toolCalls.length} tool calls`);

        for (const toolCall of toolCalls) {
          await this.executeToolCall(toolCall);

          // Check if transfer was requested
          if (this.transferRequested) {
            await this.handleTransfer(this.transferNumber!, ttsProvider);
            return;
          }
        }

        // Get follow-up response after tool execution
        const followUpSession = await llmProvider.chat({
          apiKey: this.context.providers.llm!.api_key,
          model: (this.context.providers.llm!.config?.model as string) || 'gpt-4o',
          messages: this.conversationHistory,
          maxTokens: 200,
        });

        const followUpText = await followUpSession.getText();
        this.conversationHistory.push({ role: 'assistant', content: followUpText });
        await this.speak(ttsProvider, followUpText);

      } else {
        // No tool calls — just speak the response
        const responseText = await llmSession.getText();
        this.logger.log(`Assistant: ${responseText}`);
        this.conversationHistory.push({ role: 'assistant', content: responseText });
        await this.speak(ttsProvider, responseText);
      }

    } catch (error) {
      this.logger.error(`Error handling utterance: ${error.message}`, error.stack);
      // Attempt to speak an error message
      try {
        await this.speak(ttsProvider, "I'm sorry, I encountered an error. Please try again.");
      } catch (speakError) {
        this.logger.error(`Failed to speak error message: ${speakError.message}`);
      }
    }
  }

  /**
   * Execute a tool call requested by the LLM.
   */
  private async executeToolCall(toolCall: LlmToolCall): Promise<void> {
    const tool = this.tools.find(t => t.definition.function.name === toolCall.function.name);

    if (!tool) {
      this.logger.warn(`Unknown tool requested: ${toolCall.function.name}`);
      this.conversationHistory.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({ error: 'Tool not found' }),
      });
      return;
    }

    try {
      const args = JSON.parse(toolCall.function.arguments);
      this.logger.log(`Executing tool: ${toolCall.function.name} with args: ${JSON.stringify(args)}`);

      const result = await tool.execute(args, {
        tenant_id: this.context.tenant.id,
        call_sid: this.context.call_sid || '',
        caller_phone: '', // TODO: Extract from voice_call_log.from_number
      });

      // Add tool result to conversation history
      this.conversationHistory.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: result,
      });

      // Check for transfer action
      if (toolCall.function.name === 'transfer_call') {
        try {
          const parsed = JSON.parse(result);
          if (parsed.action === 'TRANSFER' && parsed.transfer_to) {
            this.transferRequested = true;
            this.transferNumber = parsed.transfer_to;
          }
        } catch (e) {
          // Not a valid transfer response
        }
      }

    } catch (error) {
      this.logger.error(`Tool execution error: ${error.message}`, error.stack);
      this.conversationHistory.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify({ error: error.message || 'Tool execution failed' }),
      });
    }
  }

  /**
   * Synthesize text and play it to the caller via LiveKit room.
   */
  private async speak(ttsProvider: any, text: string): Promise<void> {
    if (!text.trim()) return;

    try {
      this.logger.log(`Speaking: ${text.substring(0, 50)}...`);

      const ttsSession = await ttsProvider.synthesize({
        apiKey: this.context.providers.tts!.api_key,
        voiceId: this.context.providers.tts!.voice_id || '',
        text,
        language: this.context.behavior.language,
        ...this.context.providers.tts!.config,
      });

      // Get audio buffer
      const audioBuffer = await ttsSession.getAudio();
      this.logger.log(`Generated ${audioBuffer.length} bytes of audio`);

      // Gap 2: Publish audio to LiveKit room
      if (!this.audioSource) {
        this.logger.warn('Audio source not initialized - cannot play audio');
        return;
      }

      // Convert Buffer to Int16Array (TTS output is pcm_s16le)
      const int16Array = new Int16Array(
        audioBuffer.buffer,
        audioBuffer.byteOffset,
        audioBuffer.length / 2, // 2 bytes per Int16
      );

      // Calculate samples per channel (mono audio)
      const sampleRate = 16000;
      const numChannels = 1;
      const samplesPerChannel = int16Array.length / numChannels;

      // Split audio into frames (10ms chunks = 160 samples at 16kHz)
      const frameSizeMs = 10;
      const samplesPerFrame = (sampleRate * frameSizeMs) / 1000;

      for (let i = 0; i < samplesPerChannel; i += samplesPerFrame) {
        const frameLength = Math.min(samplesPerFrame, samplesPerChannel - i);
        const frameData = int16Array.slice(i, i + frameLength);

        const audioFrame = new AudioFrame(frameData, sampleRate, numChannels, frameLength);

        // Send frame to audio source
        await this.audioSource.captureFrame(audioFrame);
      }

      this.logger.log('Audio published to room');

    } catch (error) {
      this.logger.error(`TTS error: ${error.message}`, error.stack);
    }
  }

  /**
   * Handle call transfer.
   *
   * Flow:
   *   1. Speak transfer message
   *   2. Mark session as inactive
   *   3. Signal LiveKit to transfer the SIP call
   */
  private async handleTransfer(phoneNumber: string, ttsProvider: any): Promise<void> {
    this.logger.log(`Transferring call to: ${phoneNumber}`);

    try {
      await this.speak(ttsProvider, 'Let me transfer you to a team member right away.');
      this.isActive = false;

      // Gap 3: Execute SIP transfer
      // Create SIP client
      const sipClient = new SipClient(
        this.livekitConfig.url,
        this.livekitConfig.apiKey,
        this.livekitConfig.apiSecret,
      );

      // Find the SIP participant in the room
      // The caller is a remote participant (not the agent)
      const sipParticipant = Array.from(this.room.remoteParticipants.values()).find(
        (p) => p.kind === ParticipantKind.STANDARD, // SIP participants are standard participants (kind = 0)
      );

      if (!sipParticipant) {
        this.logger.error('No SIP participant found in room - cannot transfer');
        return;
      }

      const roomName = this.room.name || '';
      const participantIdentity = sipParticipant.identity;

      this.logger.log(
        `Transferring SIP participant ${participantIdentity} in room ${roomName} to ${phoneNumber}`,
      );

      // Execute transfer via LiveKit SIP API
      await sipClient.transferSipParticipant(
        roomName,
        participantIdentity,
        phoneNumber,
        {
          playDialtone: true, // Play dial tone during transfer
        },
      );

      this.logger.log('Call transfer completed successfully');

    } catch (error) {
      this.logger.error(`Transfer error: ${error.message}`, error.stack);
      // Try to inform the caller
      try {
        await this.speak(ttsProvider, "I'm sorry, I couldn't complete the transfer. Please try calling back.");
      } catch (speakError) {
        this.logger.error(`Failed to speak transfer error message: ${speakError.message}`);
      }
    }
  }

  /**
   * Cleanup resources to prevent memory leaks.
   *
   * Releases:
   * - Audio stream reader
   * - Audio source and track
   * - Event listeners
   */
  private async cleanup(): Promise<void> {
    this.logger.log('Cleaning up session resources');

    try {
      // Release audio stream reader
      if (this.audioStreamReader) {
        try {
          this.audioStreamReader.releaseLock();
          this.audioStreamReader = null;
        } catch (e) {
          // Reader may already be released
        }
      }

      // Close audio source and track
      if (this.audioSource) {
        try {
          await this.audioSource.close();
          this.audioSource = null;
        } catch (e) {
          this.logger.warn(`Error closing audio source: ${e.message}`);
        }
      }

      if (this.audioTrack) {
        try {
          await this.audioTrack.close(true); // Close and close source
          this.audioTrack = null;
        } catch (e) {
          this.logger.warn(`Error closing audio track: ${e.message}`);
        }
      }

      // Remove all room event listeners to prevent memory leaks
      // Note: LiveKit Room uses TypedEventEmitter, we should remove our listeners
      // However, since the room is managed by the JobContext and will be cleaned up
      // when the job ends, and our session lifecycle is tied to the job lifecycle,
      // we don't need to explicitly remove listeners here.

      this.logger.log('Session cleanup completed');
    } catch (error) {
      this.logger.error(`Cleanup error: ${error.message}`, error.stack);
    }
  }

  /**
   * Stop the session.
   *
   * @param outcome - Call outcome (e.g., 'completed', 'transferred', 'error')
   * @param transcript - Array of transcript lines
   */
  async stop(outcome: string, transcript: string[]): Promise<void> {
    this.logger.log(`Stopping session with outcome: ${outcome}`);
    this.isActive = false;
    await this.cleanup();
  }

  /**
   * Get the full conversation history.
   */
  getConversationHistory(): LlmMessage[] {
    return [...this.conversationHistory];
  }

  /**
   * Pipe audio frames from LiveKit to STT session.
   *
   * Reads AudioFrame data from the stream and sends it to Deepgram.
   */
  private async pipeAudioToStt(
    reader: ReadableStreamDefaultReader<AudioFrame>,
    sttSession: any,
  ): Promise<void> {
    try {
      while (this.isActive) {
        const { done, value } = await reader.read();

        if (done) {
          this.logger.log('Audio stream ended');
          break;
        }

        if (value) {
          // Convert AudioFrame to Buffer
          // AudioFrame.data is Int16Array, need to convert to Buffer
          const buffer = Buffer.from(value.data.buffer, value.data.byteOffset, value.data.byteLength);

          // Send to STT
          sttSession.sendAudio(buffer);
        }
      }
    } catch (error) {
      this.logger.error(`Error reading audio stream: ${error.message}`, error.stack);
    } finally {
      try {
        reader.releaseLock();
      } catch (e) {
        // Reader may already be released
      }
    }
  }

  /**
   * Wait until session is stopped.
   */
  private async waitUntilStopped(): Promise<void> {
    // Poll every 100ms until inactive
    while (this.isActive) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}
