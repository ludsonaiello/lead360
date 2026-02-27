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
import { VoiceAILogger } from '../utils/voice-ai-logger.util';

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
  private transferReason: string | null = null;
  private audioSource: AudioSource | null = null;
  private audioTrack: LocalAudioTrack | null = null;
  private audioStreamReader: ReadableStreamDefaultReader<AudioFrame> | null = null;
  private actionsTaken: string[] = [];

  constructor(
    private readonly context: VoiceAiContext,
    private readonly tools: AgentTool[],
    private readonly room: Room,
    private readonly livekitConfig: { url: string; apiKey: string; apiSecret: string },
    private readonly voiceLogger?: VoiceAILogger,
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
      this.voiceLogger?.logSessionEvent('session_started', {
        tenant_id: this.context.tenant.id,
        company_name: this.context.tenant.company_name,
      });

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
      this.voiceLogger?.logProviderInit('STT', this.context.providers.stt.provider_key, {
        provider_id: this.context.providers.stt.provider_id,
        language: this.context.behavior.language,
        config: this.context.providers.stt.config,
      });
      const sttProvider = createSttProvider(this.context.providers.stt.provider_key);

      this.voiceLogger?.logProviderInit('LLM', this.context.providers.llm.provider_key, {
        provider_id: this.context.providers.llm.provider_id,
        model: this.context.providers.llm.config?.model,
      });
      const llmProvider = createLlmProvider(this.context.providers.llm.provider_key);

      this.voiceLogger?.logProviderInit('TTS', this.context.providers.tts.provider_key, {
        provider_id: this.context.providers.tts.provider_id,
        voice_id: this.context.providers.tts.voice_id,
        language: this.context.behavior.language,
        config: this.context.providers.tts.config,
      });
      const ttsProvider = createTtsProvider(this.context.providers.tts.provider_key);

      // Initialize conversation with system prompt
      this.conversationHistory = [
        { role: 'system', content: this.context.behavior.system_prompt },
      ];

      this.voiceLogger?.logSessionEvent('system_prompt_loaded', {
        prompt_length: this.context.behavior.system_prompt.length,
        prompt_preview: this.context.behavior.system_prompt.substring(0, 200),
      });

      // Gap 2: Create and publish audio track for TTS output
      // Create audio source for TTS output (16kHz mono, matching Cartesia output)
      this.audioSource = new AudioSource(16000, 1);
      this.audioTrack = LocalAudioTrack.createAudioTrack('agent-voice', this.audioSource);

      // Publish the audio track to the room
      if (this.room.localParticipant) {
        await this.room.localParticipant.publishTrack(this.audioTrack, new TrackPublishOptions());
        this.logger.log('✅ Published audio track to room');

        // Log audio track details
        this.logger.log(`📊 Audio Track Details:`);
        this.logger.log(`  - Track SID: ${this.audioTrack?.sid || 'unknown'}`);
        this.logger.log(`  - Track name: ${this.audioTrack?.name || 'unknown'}`);
        this.logger.log(`  - Track kind: ${this.audioTrack?.kind || 'unknown'}`);
        this.logger.log(`  - Muted: ${this.audioTrack?.muted || 'unknown'}`);
        this.logger.log(`  - Sample rate: 16000Hz`);
        this.logger.log(`  - Channels: 1 (mono)`);

        // VoiceAI structured logging
        this.voiceLogger?.logSessionEvent('audio_track_published', {
          track_sid: this.audioTrack?.sid,
          track_name: this.audioTrack?.name,
          sample_rate: 16000,
          channels: 1,
          muted: this.audioTrack?.muted,
        });

        // Check if any participants are subscribed (should be 0 initially)
        let subscriberCount = 0;
        const subscribers: string[] = [];

        for (const participant of this.room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.sid === this.audioTrack.sid) {
              subscriberCount++;
              subscribers.push(`${participant.identity} (${participant.kind})`);
              this.logger.log(`  📌 Subscriber detected: ${participant.identity} (kind: ${participant.kind})`);
            }
          }
        }

        this.logger.log(`📊 Audio track subscribers: ${subscriberCount}`);
        if (subscriberCount === 0) {
          this.logger.warn(`⚠️  No subscribers yet - this is normal immediately after publishing`);
        }

        // VoiceAI structured logging
        this.voiceLogger?.logSessionEvent('audio_track_subscription_check', {
          subscriber_count: subscriberCount,
          subscribers: subscribers,
          check_time: 'immediately_after_publish',
        });
      } else {
        this.logger.warn('No local participant - cannot publish audio track');
        this.voiceLogger?.logSessionEvent('audio_track_publish_failed', {
          reason: 'No local participant',
        });
      }

      // ====================================================================================
      // CRITICAL DIAGNOSTIC: Check SIP participant audio readiness BEFORE speaking greeting
      // ====================================================================================

      this.logger.log(`🔍 🔍 🔍 CHECKING SIP PARTICIPANT READINESS 🔍 🔍 🔍`);

      let sipParticipantFound = false;
      let sipParticipantAudioPublished = false;

      for (const participant of this.room.remoteParticipants.values()) {
        if (participant.kind === ParticipantKind.SIP) {
          sipParticipantFound = true;

          this.logger.log(`📞 SIP Participant Found:`);
          this.logger.log(`  - Identity: ${participant.identity}`);
          this.logger.log(`  - Name: ${participant.name || 'N/A'}`);
          this.logger.log(`  - Kind: ${participant.kind}`);
          this.logger.log(`  - Tracks published: ${participant.trackPublications.size}`);

          // Log all tracks published by SIP participant
          let audioTrackCount = 0;
          for (const publication of participant.trackPublications.values()) {
            const trackKind = publication.kind === TrackKind.KIND_AUDIO ? 'AUDIO' :
                              publication.kind === TrackKind.KIND_VIDEO ? 'VIDEO' : 'UNKNOWN';

            this.logger.log(`  📡 Track: ${trackKind}`);
            this.logger.log(`    - SID: ${publication.sid}`);
            this.logger.log(`    - Name: ${publication.name || 'unnamed'}`);
            this.logger.log(`    - Subscribed: ${publication.subscribed}`);
            this.logger.log(`    - Muted: ${publication.muted}`);

            if (publication.kind === TrackKind.KIND_AUDIO) {
              audioTrackCount++;
              sipParticipantAudioPublished = true;
            }
          }

          this.logger.log(`  ✅ SIP participant audio tracks published: ${audioTrackCount}`);

          // Check if SIP participant is subscribed to OUR (agent's) audio track
          // Note: This might not be possible to check directly - we can only see their published tracks
          // and our own track subscriptions, not who is subscribed to our tracks.
          this.logger.log(`  📊 Checking if SIP participant can receive our audio...`);
          this.logger.log(`    Agent audio track SID: ${this.audioTrack?.sid || 'unknown'}`);

          // VoiceAI structured logging
          this.voiceLogger?.logSessionEvent('sip_participant_check', {
            participant_identity: participant.identity,
            participant_name: participant.name,
            tracks_published: participant.trackPublications.size,
            audio_tracks_published: audioTrackCount,
          });
        }
      }

      // Log summary
      if (!sipParticipantFound) {
        this.logger.error(`❌ NO SIP PARTICIPANT FOUND IN ROOM!`);
        this.voiceLogger?.logSessionEvent('sip_participant_not_found', {
          total_participants: this.room.remoteParticipants.size,
        });
      }

      if (sipParticipantFound && !sipParticipantAudioPublished) {
        this.logger.warn(`⚠️  SIP participant found but has NOT published audio track yet`);
        this.voiceLogger?.logSessionEvent('sip_participant_no_audio', {});
      }

      if (sipParticipantFound && sipParticipantAudioPublished) {
        this.logger.log(`✅ SIP participant is ready (has published audio track)`);
        this.voiceLogger?.logSessionEvent('sip_participant_ready', {});
      }

      this.logger.log(`🔍 🔍 🔍 SIP READINESS CHECK COMPLETE 🔍 🔍 🔍`);
      this.logger.log(``);

      // Play greeting
      if (this.context.behavior.greeting) {
        this.voiceLogger?.logSessionEvent('playing_greeting', {
          greeting: this.context.behavior.greeting,
        });
        await this.speak(ttsProvider, this.context.behavior.greeting);
      }

      // Start STT session
      this.voiceLogger?.logSessionEvent('starting_stt_session', {
        language: this.context.behavior.language,
      });
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

        // Log all transcripts (interim and final)
        this.voiceLogger?.logSTT(text, isFinal);

        if (isFinal && text.trim()) {
          this.logger.log(`User said: ${text}`);
          await this.handleUtterance(text, llmProvider, ttsProvider);
          currentUtterance = '';
        }
      });

      sttSession.on('error', (error: Error) => {
        this.logger.error(`STT error: ${error.message}`, error.stack);
        this.voiceLogger?.logError(error, 'STT session error');
      });

      // Subscribe to caller audio from LiveKit room
      // Gap 1: Pipe incoming audio to STT
      this.room.on('trackSubscribed', async (track: RemoteTrack, publication, participant) => {
        if (track.kind === TrackKind.KIND_AUDIO) {
          this.logger.log(`Subscribed to audio track from participant: ${participant.identity}`);
          this.voiceLogger?.logSessionEvent('audio_track_subscribed', {
            participant_identity: participant.identity,
            participant_name: participant.name,
            track_sid: track.sid,
          });

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
              this.voiceLogger?.logError(error, 'Audio piping to STT');
            });

          } catch (error) {
            this.logger.error(`Error setting up audio stream: ${error.message}`, error.stack);
            this.voiceLogger?.logError(error, 'Audio stream setup');
          }
        }
      });

      this.logger.log('Voice session started successfully');
      this.voiceLogger?.logSessionEvent('session_ready', {
        conversation_started: true,
      });

      // Keep session alive until stopped
      await this.waitUntilStopped();

      // Cleanup
      await this.cleanup();
      await sttSession.close();
      this.logger.log('Voice session ended');
      this.voiceLogger?.logSessionEvent('session_ended', {
        actions_taken: this.actionsTaken,
      });

    } catch (error) {
      this.logger.error(`Voice session error: ${error.message}`, error.stack);
      this.voiceLogger?.logError(error, 'Voice session');
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

      // Log LLM request
      this.voiceLogger?.logLLMRequest(this.conversationHistory, (this.context.providers.llm!.config?.model as string) || 'gpt-4o');

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

        // Log response with tool calls
        const responseText = await llmSession.getText();
        this.voiceLogger?.logLLMResponse(responseText || '[tool calls only]', toolCalls);

        for (const toolCall of toolCalls) {
          await this.executeToolCall(toolCall);

          // Check if transfer was requested
          if (this.transferRequested) {
            await this.handleTransfer(this.transferNumber!, ttsProvider);
            return;
          }
        }

        // Get follow-up response after tool execution
        this.voiceLogger?.logLLMRequest(this.conversationHistory, (this.context.providers.llm!.config?.model as string) || 'gpt-4o');

        const followUpSession = await llmProvider.chat({
          apiKey: this.context.providers.llm!.api_key,
          model: (this.context.providers.llm!.config?.model as string) || 'gpt-4o',
          messages: this.conversationHistory,
          maxTokens: 200,
        });

        const followUpText = await followUpSession.getText();
        this.voiceLogger?.logLLMResponse(followUpText, []);

        this.conversationHistory.push({ role: 'assistant', content: followUpText });
        await this.speak(ttsProvider, followUpText);

      } else {
        // No tool calls — just speak the response
        const responseText = await llmSession.getText();
        this.logger.log(`Assistant: ${responseText}`);

        this.voiceLogger?.logLLMResponse(responseText, []);

        this.conversationHistory.push({ role: 'assistant', content: responseText });
        await this.speak(ttsProvider, responseText);
      }

    } catch (error) {
      this.logger.error(`Error handling utterance: ${error.message}`, error.stack);
      this.voiceLogger?.logError(error, 'Handling utterance');

      // Attempt to speak an error message
      try {
        await this.speak(ttsProvider, "I'm sorry, I encountered an error. Please try again.");
      } catch (speakError) {
        this.logger.error(`Failed to speak error message: ${speakError.message}`);
        this.voiceLogger?.logError(speakError, 'Speaking error message');
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
      this.voiceLogger?.logToolCall(toolCall.function.name, JSON.parse(toolCall.function.arguments || '{}'), undefined, { error: 'Tool not found' });

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

      // Log successful tool execution
      this.voiceLogger?.logToolCall(toolCall.function.name, args, JSON.parse(result));

      // Track action
      this.actionsTaken.push(`${toolCall.function.name}: ${JSON.stringify(args)}`);

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
            this.transferReason = args.reason || 'User requested transfer';

            this.voiceLogger?.logTransferRequest(this.transferReason || 'User requested transfer', args.department);
          }
        } catch (e) {
          // Not a valid transfer response
        }
      }

      // Log lead actions
      if (toolCall.function.name === 'find_lead') {
        const parsed = JSON.parse(result);
        if (parsed.lead_id) {
          this.voiceLogger?.logLeadFound(parsed.lead_id, parsed);
        }
      }

      if (toolCall.function.name === 'create_lead') {
        const parsed = JSON.parse(result);
        if (parsed.lead_id) {
          this.voiceLogger?.logLeadCreated(parsed.lead_id, parsed);
        }
      }

    } catch (error) {
      this.logger.error(`Tool execution error: ${error.message}`, error.stack);
      this.voiceLogger?.logToolCall(toolCall.function.name, JSON.parse(toolCall.function.arguments || '{}'), undefined, error);

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
      this.logger.log(`🗣️  Speaking: "${text.substring(0, 100)}..." (${text.length} chars)`);

      // VoiceAI structured logging
      this.voiceLogger?.logTTS(text, this.context.providers.tts!.voice_id || 'default');
      this.voiceLogger?.logSessionEvent('tts_synthesis_start', {
        text_length: text.length,
        text_preview: text.substring(0, 100),
        voice_id: this.context.providers.tts!.voice_id,
      });

      // Log TTS request
      this.logger.log(`📤 Requesting TTS synthesis...`);
      this.logger.debug(`  API Key: ${this.context.providers.tts!.api_key ? 'SET (length: ' + this.context.providers.tts!.api_key.length + ')' : 'MISSING'}`);
      this.logger.debug(`  Voice ID: ${this.context.providers.tts!.voice_id}`);
      this.logger.debug(`  Language: ${this.context.behavior.language}`);

      const ttsSession = await ttsProvider.synthesize({
        apiKey: this.context.providers.tts!.api_key,
        voiceId: this.context.providers.tts!.voice_id || '',
        text,
        language: this.context.behavior.language,
        ...this.context.providers.tts!.config,
      });

      // Get audio buffer
      const audioBuffer = await ttsSession.getAudio();

      // CRITICAL: Log audio buffer details
      this.logger.log(`✅ ✅ ✅ TTS AUDIO RECEIVED FROM PROVIDER ✅ ✅ ✅`);
      this.logger.log(`  Buffer length: ${audioBuffer.length} bytes`);
      this.logger.log(`  Expected format: PCM s16le, 16kHz, mono`);
      this.logger.log(`  Sample count: ${audioBuffer.length / 2} samples (2 bytes per sample)`);
      this.logger.log(`  Expected duration: ${((audioBuffer.length / 2) / 16000 * 1000).toFixed(0)}ms`);

      // VoiceAI structured logging
      this.voiceLogger?.logSessionEvent('tts_audio_received', {
        audio_bytes: audioBuffer.length,
        text_length: text.length,
        sample_count: audioBuffer.length / 2,
        expected_duration_ms: (audioBuffer.length / 2) / 16000 * 1000,
      });

      // Validate buffer is not empty
      if (audioBuffer.length === 0) {
        this.logger.error(`❌ CRITICAL: TTS returned EMPTY buffer!`);
        this.voiceLogger?.logSessionEvent('tts_empty_buffer', { text });
        throw new Error('TTS returned empty audio buffer');
      }

      // Gap 2: Publish audio to LiveKit room
      if (!this.audioSource) {
        this.logger.warn('Audio source not initialized - cannot play audio');
        this.voiceLogger?.logSessionEvent('audio_publish_failed', {
          reason: 'Audio source not initialized',
        });
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

      this.logger.log(`📦 Preparing audio frames for LiveKit...`);
      this.logger.log(`  Int16 samples: ${int16Array.length}`);
      this.logger.log(`  Samples per channel: ${samplesPerChannel}`);
      this.logger.log(`  Sample rate: ${sampleRate}Hz`);
      this.logger.log(`  Channels: ${numChannels}`);

      // Split audio into frames (10ms chunks = 160 samples at 16kHz)
      const frameSizeMs = 10;
      const samplesPerFrame = (sampleRate * frameSizeMs) / 1000;
      const totalFrames = Math.ceil(samplesPerChannel / samplesPerFrame);

      this.logger.log(`  Frame size: ${frameSizeMs}ms (${samplesPerFrame} samples/frame)`);
      this.logger.log(`  Total frames to send: ${totalFrames}`);

      // VoiceAI structured logging
      this.voiceLogger?.logSessionEvent('audio_frame_preparation', {
        total_frames: totalFrames,
        frame_size_ms: frameSizeMs,
        samples_per_frame: samplesPerFrame,
        total_samples: samplesPerChannel,
      });

      let framesSent = 0;
      let framesFailed = 0;

      for (let i = 0; i < samplesPerChannel; i += samplesPerFrame) {
        const frameLength = Math.min(samplesPerFrame, samplesPerChannel - i);
        const frameData = int16Array.slice(i, i + frameLength);
        const frameNumber = Math.floor(i / samplesPerFrame) + 1;

        const audioFrame = new AudioFrame(frameData, sampleRate, numChannels, frameLength);

        // Log every 50th frame to avoid spam
        if (frameNumber % 50 === 0 || frameNumber === 1) {
          this.logger.log(`📡 Sending frame ${frameNumber}/${totalFrames} (${frameLength} samples)`);
        }

        try {
          // Send frame to audio source
          await this.audioSource.captureFrame(audioFrame);
          framesSent++;

          // Debug logging for first 5 frames
          if (frameNumber <= 5) {
            this.logger.debug(`✅ Frame ${frameNumber} captured successfully`);
          }

        } catch (error) {
          framesFailed++;
          this.logger.error(`❌ ❌ ❌ FRAME CAPTURE FAILED ❌ ❌ ❌`);
          this.logger.error(`  Frame number: ${frameNumber}/${totalFrames}`);
          this.logger.error(`  Frame length: ${frameLength} samples`);
          this.logger.error(`  Error: ${error.message}`);
          this.logger.error(`  Error stack: ${error.stack}`);

          this.voiceLogger?.logSessionEvent('audio_frame_capture_error', {
            frame_number: frameNumber,
            total_frames: totalFrames,
            error: error.message,
          });

          throw error; // Stop processing on first error
        }
      }

      this.logger.log(`✅ ✅ ✅ ALL FRAMES SENT TO LIVEKIT ✅ ✅ ✅`);
      this.logger.log(`  Frames sent: ${framesSent}/${totalFrames}`);
      this.logger.log(`  Frames failed: ${framesFailed}`);
      this.logger.log(`  Audio duration: ${(samplesPerChannel / sampleRate * 1000).toFixed(0)}ms`);
      this.logger.log(`  Total samples: ${samplesPerChannel}`);

      // VoiceAI structured logging
      this.voiceLogger?.logSessionEvent('audio_published', {
        frames_sent: framesSent,
        frames_failed: framesFailed,
        duration_ms: (samplesPerChannel / sampleRate) * 1000,
        total_samples: samplesPerChannel,
      });

    } catch (error) {
      this.logger.error(`❌ ❌ ❌ TTS/AUDIO PIPELINE ERROR ❌ ❌ ❌`);
      this.logger.error(`  Error message: ${error.message}`);
      this.logger.error(`  Error name: ${error.name}`);
      this.logger.error(`  Error type: ${error.constructor.name}`);

      // Log full error stack
      this.logger.error(`  Error stack:`);
      this.logger.error(error.stack);

      // Log error details (try to serialize)
      try {
        this.logger.error(`  Error object: ${JSON.stringify(error, null, 2)}`);
      } catch (e) {
        this.logger.error(`  Error object: [Could not serialize]`);
      }

      // Log pipeline state at time of error
      this.logger.error(`📊 Pipeline State at Error:`);
      this.logger.error(`  - Audio source: ${this.audioSource ? 'initialized' : 'null/closed'}`);
      this.logger.error(`  - Audio track: ${this.audioTrack ? 'initialized' : 'null/closed'}`);

      if (this.audioSource) {
        try {
          this.logger.error(`  - Audio source sample rate: 16000Hz (expected)`);
          this.logger.error(`  - Audio source channels: 1 (mono)`);
        } catch (e) {
          this.logger.error(`  - Could not read audio source properties`);
        }
      }

      if (this.audioTrack) {
        try {
          this.logger.error(`  - Audio track SID: ${this.audioTrack.sid}`);
          this.logger.error(`  - Audio track muted: ${this.audioTrack.muted}`);
          this.logger.error(`  - Audio track kind: ${this.audioTrack.kind}`);
        } catch (e) {
          this.logger.error(`  - Could not read audio track properties`);
        }
      }

      // Log context about what we were trying to do
      this.logger.error(`📝 Context:`);
      this.logger.error(`  - Text length: ${text.length} characters`);
      this.logger.error(`  - Text preview: "${text.substring(0, 100)}..."`);
      this.logger.error(`  - Voice ID: ${this.context.providers.tts!.voice_id || 'not set'}`);
      this.logger.error(`  - TTS provider: ${this.context.providers.tts!.provider_key}`);

      // VoiceAI structured logging
      this.voiceLogger?.logError(error, 'TTS synthesis or audio publishing');
      this.voiceLogger?.logSessionEvent('tts_pipeline_error', {
        error_message: error.message,
        error_name: error.name,
        text_length: text.length,
        audio_source_state: this.audioSource ? 'initialized' : 'null',
        audio_track_state: this.audioTrack ? 'initialized' : 'null',
        voice_id: this.context.providers.tts!.voice_id,
      });

      // Do NOT swallow the error - re-throw so it's visible
      throw error;
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
        this.voiceLogger?.logError(new Error('No SIP participant found'), 'Transfer execution');
        return;
      }

      const roomName = this.room.name || '';
      const participantIdentity = sipParticipant.identity;

      this.logger.log(
        `Transferring SIP participant ${participantIdentity} in room ${roomName} to ${phoneNumber}`,
      );

      // Log detailed transfer execution
      this.voiceLogger?.logTransferExecution(
        phoneNumber,
        participantIdentity,
        {
          room_name: roomName,
          participant_identity: participantIdentity,
          participant_name: sipParticipant.name,
          play_dialtone: true,
          livekit_url: this.livekitConfig.url,
        },
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
      this.voiceLogger?.logSessionEvent('transfer_completed', {
        to_number: phoneNumber,
        participant: participantIdentity,
      });

      // Track transfer action
      this.actionsTaken.push(`Transfer to ${phoneNumber}`);

    } catch (error) {
      this.logger.error(`Transfer error: ${error.message}`, error.stack);
      this.voiceLogger?.logError(error, 'Transfer execution failed');

      // Try to inform the caller
      try {
        await this.speak(ttsProvider, "I'm sorry, I couldn't complete the transfer. Please try calling back.");
      } catch (speakError) {
        this.logger.error(`Failed to speak transfer error message: ${speakError.message}`);
        this.voiceLogger?.logError(speakError, 'Speaking transfer error message');
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
   * Get transfer information if transfer was requested.
   */
  getTransferInfo(): { number: string; reason: string } | null {
    if (this.transferRequested && this.transferNumber) {
      return {
        number: this.transferNumber,
        reason: this.transferReason || 'User requested transfer',
      };
    }
    return null;
  }

  /**
   * Get list of actions taken during the call.
   */
  getActionsTaken(): string[] {
    return [...this.actionsTaken];
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
