import { Logger } from '@nestjs/common';
import { VoiceAiContext } from '../interfaces/voice-ai-context.interface';
import { createSttProvider } from './providers/stt-factory';
import { createLlmProvider } from './providers/llm-factory';
import { createTtsProvider } from './providers/tts-factory';
import { AgentTool } from './tools/tool.interface';
import { LlmMessage, LlmToolCall } from './providers/llm.interface';
import { Room, RemoteTrack, RemoteAudioTrack, AudioStream, AudioSource, LocalAudioTrack, AudioFrame, TrackKind, TrackPublishOptions, LocalTrackPublication } from '@livekit/rtc-node';
import { ParticipantKind } from '@livekit/rtc-node';
import { SipClient } from 'livekit-server-sdk';
import { VoiceAILogger } from '../utils/voice-ai-logger.util';
import { CartesiaWebSocketTtsProvider } from './providers/cartesia-websocket-tts.provider';

//BACKGROUND AUDIO
import { voice } from '@livekit/agents';
import { ReadableStream  } from 'stream/web';

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
  /**
   * Audio publication object returned by LiveKit when track is published.
   * Contains the actual track SID (not TR_unknown) and subscription status.
   * Used to verify track is ready before streaming audio chunks.
   *
   * CRITICAL: Always check this.audioPublication.sid (NOT this.audioTrack.sid)
   * when validating if audio can be streamed.
   */
  private audioPublication: LocalTrackPublication | null = null;
  private audioStreamReader: ReadableStreamDefaultReader<AudioFrame> | null = null;
  private actionsTaken: string[] = [];

  // Sprint BAS-TTS: WebSocket streaming TTS for ultra-low latency
  private streamingTtsProvider: CartesiaWebSocketTtsProvider | null = null;
  private currentTtsContextId: string | null = null;
  private isAgentSpeaking = false;

  // Sprint 05: Audio chunk queue to prevent overlapping audio
  private audioChunkQueue: Buffer[] = [];
  private isProcessingAudioQueue = false;

  // Usage tracking: Store session references and accumulated usage
  private sttSession: any = null;
  private accumulatedLlmTokens = 0;

  // Sprint 2: Call outcome tracking for end_call tool
  private callOutcome: 'lead_created' | 'transferred' | 'not_interested' | 'information_provided' | 'service_unavailable' | 'abandoned' | 'other' | null = null;
  private startTime: number = 0;

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
      this.startTime = Date.now(); // Sprint 2: Track session start time for duration logging
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
      // Sprint 4: Add lead context if available (agent_sprint_fixes_feb27_4)
      let systemPrompt = this.context.behavior.system_prompt;

      // Add lead context if available
      if (this.context.lead) {
        const lead = this.context.lead;
        systemPrompt += `\n\n=== CALLER INFORMATION ===
You are speaking with: ${lead.full_name}
Phone: ${lead.phone_number}
Email: ${lead.email || 'Not provided'}
Status: ${lead.status}
Previous Contacts: ${lead.total_contacts || 0}
Last Contact: ${lead.last_contact_date ? new Date(lead.last_contact_date).toLocaleDateString() : 'First time caller'}

IMPORTANT:
- This is a KNOWN caller, not a new lead
- Greet them by name: "Hi ${lead.first_name}!"
- Do NOT ask for information you already have
- Reference their previous interaction if relevant
- Ask how you can help them today
`;

        if (lead.notes) {
          systemPrompt += `\nPrevious Notes: ${lead.notes}`;
        }

        this.logger.log(`✅ Lead context added to system prompt: ${lead.full_name}`);
        this.voiceLogger?.logSessionEvent('lead_context_added_to_prompt', {
          lead_id: lead.id,
          lead_name: lead.full_name,
          total_contacts: lead.total_contacts,
        });
      } else {
        this.logger.log('ℹ️  No lead context available - new caller');
      }

      this.conversationHistory = [
        { role: 'system', content: systemPrompt },
      ];

      this.voiceLogger?.logSessionEvent('system_prompt_loaded', {
        prompt_length: systemPrompt.length,
        prompt_preview: systemPrompt.substring(0, 200),
        has_lead_context: !!this.context.lead,
      });

      // Gap 2: Create and publish audio track for TTS output
      // Create audio source for TTS output (16kHz mono, matching Cartesia output)
      this.audioSource = new AudioSource(16000, 1);
      this.audioTrack = LocalAudioTrack.createAudioTrack('agent-voice', this.audioSource);

      // Publish the audio track to the room
      if (this.room.localParticipant) {
        this.audioPublication = await this.room.localParticipant.publishTrack(
          this.audioTrack,
          new TrackPublishOptions()
        );
        this.logger.log(`✅ Published audio track to room with SID: ${this.audioPublication.sid}`);

        // ====================================================================================
        // Wait for SIP participant to subscribe to our audio track
        // This ensures they're ready to receive audio before we start speaking
        // ====================================================================================
        this.logger.log(`⏳ Waiting for SIP participant to subscribe to agent audio...`);

        try {
          await Promise.race([
            this.audioPublication.waitForSubscription(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Subscription timeout')), 5000)
            )
          ]);
          this.logger.log(`✅ SIP participant subscribed - ready to stream audio`);
        } catch (error) {
          this.logger.warn(`⚠️  Subscription wait timeout after 5s - proceeding anyway`);
        }

        // Log audio publication details (not just track)
        this.logger.log(`📊 Audio Publication Details:`);
        this.logger.log(`  - Publication SID: ${this.audioPublication.sid}`);
        this.logger.log(`  - Track name: ${this.audioTrack.name}`);
        this.logger.log(`  - Track kind: ${this.audioTrack.kind}`);
        this.logger.log(`  - Muted: ${this.audioPublication.muted}`);
        this.logger.log(`  - Sample rate: 16000Hz`);
        this.logger.log(`  - Channels: 1 (mono)`);

        // VoiceAI structured logging
        this.voiceLogger?.logSessionEvent('audio_publication_ready', {
          publication_sid: this.audioPublication.sid,
          track_name: this.audioTrack.name,
          sample_rate: 16000,
          channels: 1,
          muted: this.audioPublication.muted,
        });

        // Check if any participants are subscribed (should be 0 initially)
        let subscriberCount = 0;
        const subscribers: string[] = [];

        for (const participant of this.room.remoteParticipants.values()) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.sid === this.audioPublication.sid) {
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
          this.logger.log(`    Agent audio publication SID: ${this.audioPublication?.sid || 'unknown'}`);

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

      // ====================================================================================
      // FIX BUG A (STEP 2): Wait for SIP participant to be ready to receive audio
      // The SIP participant needs time to subscribe to our audio track.
      // If we start playing before they're subscribed, they won't hear anything.
      // ====================================================================================
      this.logger.log(`⏳ Waiting for SIP participant to be ready to receive audio...`);

      const maxSubscriberWaitMs = 5000;
      const subscriberWaitStart = Date.now();
      let sipParticipantReady = false;

      while (Date.now() - subscriberWaitStart < maxSubscriberWaitMs) {
        // Check if any remote participant exists (SIP participant)
        // LiveKit auto-subscribes by default, so presence of participant usually means they'll subscribe
        if (this.room.remoteParticipants.size > 0) {
          sipParticipantReady = true;
          this.logger.log(`✅ SIP participant ready to receive audio (${this.room.remoteParticipants.size} participants in room)`);
          break;
        }

        await new Promise(r => setTimeout(r, 200));
      }

      if (!sipParticipantReady) {
        this.logger.warn(`⚠️  No SIP participant found after ${maxSubscriberWaitMs}ms - proceeding anyway`);
      }

      // Additional safety: Small delay to ensure audio track subscription is fully established
      this.logger.log(`⏳ Waiting additional 500ms for audio subscription to stabilize...`);
      await new Promise(r => setTimeout(r, 500));

      // ====================================================================================
      // Sprint BAS-TTS-02: Initialize WebSocket streaming TTS for ultra-low latency
      // ====================================================================================
      this.logger.log(`🚀 Initializing WebSocket streaming TTS...`);

      this.streamingTtsProvider = new CartesiaWebSocketTtsProvider();

      // Build streaming TTS config from context (dynamic configuration)
      const streamingTtsConfig = {
        apiKey: this.context.providers.tts!.api_key,
        voiceId: this.context.providers.tts!.voice_id || '',
        model: (this.context.providers.tts!.config?.model as string) || 'sonic-3',
        language: this.context.behavior.language,
        sampleRate: (this.context.providers.tts!.config?.outputFormat as any)?.sampleRate || 16000,
        encoding: (this.context.providers.tts!.config?.outputFormat as any)?.encoding || 'pcm_s16le',
      };

      await this.streamingTtsProvider.connect(streamingTtsConfig);

      // Set up audio chunk handler - streams audio to LiveKit as it arrives
      this.streamingTtsProvider.onAudioChunk((contextId, audioData, isDone) => {
        // Sprint Voice-UX-01: Support background contexts (filler, longwait) in addition to main context
        // Sprint 04: Removed && this.isAgentSpeaking check - audio should play even if it arrives after timeout
        const isMainContext = contextId === this.currentTtsContextId;
        const isBackgroundContext = contextId.startsWith('longwait-') || contextId.startsWith('filler-');

        // Process audio for current main context OR background contexts
        // Audio will play even if it arrives after timeout (isAgentSpeaking = false)
        if ((isMainContext || isBackgroundContext) && audioData.length > 0) {
          // Sprint 05: Queue chunks to prevent overlapping audio (voices mixing issue)
          this.audioChunkQueue.push(audioData);

          // Start processing queue if not already processing
          this.processAudioChunkQueue().catch(error => {
            this.logger.error(`Error in audio queue processor: ${error.message}`);
            this.logger.error(`  Context: ${contextId}`);
          });
        }

        // Only manage isAgentSpeaking flag for main context (not background contexts)
        if (isDone && contextId === this.currentTtsContextId) {
          this.isAgentSpeaking = false;
          this.logger.log(`✅ TTS complete for context: ${contextId}`);
        }
      });

      this.logger.log(`✅ WebSocket streaming TTS initialized`);

      // ====================================================================================
      // Sprint BAS-TTS-04: Play greeting via streaming TTS (ultra-low latency)
      // ====================================================================================
      if (this.context.behavior.greeting) {
        this.voiceLogger?.logSessionEvent('playing_greeting', {
          greeting: this.context.behavior.greeting,
        });

        this.currentTtsContextId = `greeting-${Date.now()}`;
        this.isAgentSpeaking = true;

        this.logger.log(`🎙️  Playing greeting via streaming TTS (context: ${this.currentTtsContextId})`);

        // Stream greeting to TTS (send entire greeting at once, mark as final)
        this.streamingTtsProvider!.streamText(
          this.context.behavior.greeting,
          this.currentTtsContextId,
          true, // isFinal = true (flush audio immediately)
        );

        // Wait for greeting to complete (with timeout)
        const greetingTimeout = setTimeout(() => {
          this.logger.warn('⚠️  Greeting playback timeout after 10 seconds');
          this.isAgentSpeaking = false;
        }, 10000);

        while (this.isAgentSpeaking) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        clearTimeout(greetingTimeout);
        this.logger.log('✅ Greeting playback complete');
      }

      // Start STT session
      this.voiceLogger?.logSessionEvent('starting_stt_session', {
        language: this.context.behavior.language,
      });
      this.sttSession = await sttProvider.startTranscription({
        apiKey: this.context.providers.stt.api_key,
        language: this.context.behavior.language,
        ...this.context.providers.stt.config,
      });

      // Handle transcripts
      let currentUtterance = '';
      this.sttSession.on('transcript', async (text: string, isFinal: boolean) => {
        if (!this.isActive) return;

        currentUtterance = text;

        // Log all transcripts (interim and final)
        this.voiceLogger?.logSTT(text, isFinal);

        if (isFinal && text.trim()) {
          // ====================================================================================
          // Sprint Voice-UX-01: Filter out invalid/noise transcripts
          // ====================================================================================
          if (!this.isValidTranscript(text)) {
            this.logger.debug(`Filtering out invalid transcript: "${text}"`);
            currentUtterance = '';
            return;
          }

          // ====================================================================================
          // Sprint BAS-TTS-03: Barge-in detection
          // If user speaks while agent is talking, cancel current TTS generation
          // ====================================================================================
          if (this.isAgentSpeaking) {
            this.logger.log(`🛑 Barge-in detected: User interrupted with "${text}"`);

            // Cancel current TTS generation
            if (this.currentTtsContextId && this.streamingTtsProvider) {
              this.streamingTtsProvider.cancelContext(this.currentTtsContextId);
              this.currentTtsContextId = null;
            }

            // Stop agent speaking state (audio callback will ignore future chunks)
            this.isAgentSpeaking = false;

            this.voiceLogger?.logSessionEvent('barge_in_detected', {
              user_text: text,
              cancelled_context: this.currentTtsContextId,
            });
          }

          this.logger.log(`User said: ${text}`);
          await this.handleUtterance(text, llmProvider, ttsProvider);
          currentUtterance = '';
        }
      });

      this.sttSession.on('error', (error: Error) => {
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

          this.setupAudioPipeline(track as RemoteAudioTrack, this.sttSession);
        }
      });

      // Check for already-subscribed tracks (fixes race condition where SIP participant
      // audio track is already subscribed before event listener is attached)
      for (const participant of this.room.remoteParticipants.values()) {
        if (participant.kind === ParticipantKind.SIP) {
          for (const publication of participant.trackPublications.values()) {
            if (publication.track && publication.track.kind === TrackKind.KIND_AUDIO) {
              this.logger.log(`Found already-subscribed audio track from: ${participant.identity}`);
              this.voiceLogger?.logSessionEvent('audio_track_already_subscribed', {
                participant_identity: participant.identity,
                participant_name: participant.name,
                track_sid: publication.track.sid,
              });

              this.setupAudioPipeline(publication.track as RemoteAudioTrack, this.sttSession);
            }
          }
        }
      }

      this.logger.log('Voice session started successfully');
      this.voiceLogger?.logSessionEvent('session_ready', {
        conversation_started: true,
      });

      // Keep session alive until stopped
      await this.waitUntilStopped();

      // Cleanup
      await this.cleanup();
      if (this.sttSession) {
        await this.sttSession.close();
      }
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

        // ═══════════════════════════════════════════════════════════════════════════
        // FIX: Add assistant message WITH tool_calls to history BEFORE adding tool results
        // OpenAI requires: user → assistant (with tool_calls) → tool → assistant
        // ═══════════════════════════════════════════════════════════════════════════
        this.conversationHistory.push({
          role: 'assistant',
          content: responseText || '',  // May be empty when only tool calls
          tool_calls: toolCalls,        // Include the tool_calls array
        });

        // ═══════════════════════════════════════════════════════════════════════════
        // Sprint Voice-UX-01: Speak filler phrase BEFORE executing tools
        // ═══════════════════════════════════════════════════════════════════════════
        await this.speakFillerPhrase();

        // ═══════════════════════════════════════════════════════════════════════════
        // Sprint Voice-UX-01: Start long-wait monitor
        // ═══════════════════════════════════════════════════════════════════════════
        const longWaitMonitor = this.startLongWaitMonitor();

        try {
          for (const toolCall of toolCalls) {
            await this.executeToolCall(toolCall);

            // Check if transfer was requested
            if (this.transferRequested) {
              await this.handleTransfer(this.transferNumber!, ttsProvider);
              return;
            }

            // Sprint 2: Check if end_call was invoked
            if (toolCall.function.name === 'end_call') {
              this.logger.log('🔚 end_call detected - will end session after final response');
              // Don't return here - let the LLM speak the final goodbye message first
              // Session will end naturally when isActive = false
            }
          }
        } finally {
          // Stop long-wait monitor
          longWaitMonitor.stop();
        }

        // Get follow-up response after tool execution
        this.voiceLogger?.logLLMRequest(this.conversationHistory, (this.context.providers.llm!.config?.model as string) || 'gpt-4o');

        const followUpSession = await llmProvider.chat({
          apiKey: this.context.providers.llm!.api_key,
          model: (this.context.providers.llm!.config?.model as string) || 'gpt-4o',
          messages: this.conversationHistory,
          maxTokens: 200,
        });

        // ====================================================================================
        // Sprint BAS-TTS-02: Stream follow-up response to WebSocket TTS (ultra-low latency)
        // ====================================================================================
        this.currentTtsContextId = `turn-${Date.now()}`;
        this.isAgentSpeaking = true;
        let followUpText = '';

        try {
          this.logger.log(`🎙️  Streaming follow-up response to TTS (context: ${this.currentTtsContextId})`);

          // Stream LLM tokens directly to TTS
          for await (const token of followUpSession.stream()) {
            followUpText += token;
            this.streamingTtsProvider!.streamText(token, this.currentTtsContextId, false);
          }

          // Signal end of text (flush final audio)
          this.streamingTtsProvider!.streamText('', this.currentTtsContextId, true);

          this.voiceLogger?.logLLMResponse(followUpText, []);
          this.conversationHistory.push({ role: 'assistant', content: followUpText });
          this.logger.log(`Assistant: ${followUpText}`);

          // Accumulate LLM token usage
          const usage = followUpSession.getUsage();
          this.accumulatedLlmTokens += usage.totalTokens;

        } finally {
          // Wait for TTS to complete before continuing
          while (this.isAgentSpeaking) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }

        // Accumulate LLM token usage from initial session (with tool calls)
        const initialUsage = llmSession.getUsage();
        this.accumulatedLlmTokens += initialUsage.totalTokens;

      } else {
        // ====================================================================================
        // Sprint BAS-TTS-02: Stream response to WebSocket TTS (ultra-low latency)
        // No tool calls — stream response directly to TTS as LLM generates tokens
        // ====================================================================================
        this.currentTtsContextId = `turn-${Date.now()}`;
        this.isAgentSpeaking = true;
        let responseText = '';

        try {
          this.logger.log(`🎙️  Streaming response to TTS (context: ${this.currentTtsContextId})`);

          // Stream LLM tokens directly to TTS
          for await (const token of llmSession.stream()) {
            responseText += token;
            this.streamingTtsProvider!.streamText(token, this.currentTtsContextId, false);
          }

          // Signal end of text (flush final audio)
          this.streamingTtsProvider!.streamText('', this.currentTtsContextId, true);

          this.voiceLogger?.logLLMResponse(responseText, []);
          this.conversationHistory.push({ role: 'assistant', content: responseText });
          this.logger.log(`Assistant: ${responseText}`);

          // Accumulate LLM token usage
          const usage = llmSession.getUsage();
          this.accumulatedLlmTokens += usage.totalTokens;

        } finally {
          // Wait for TTS to complete before continuing
          while (this.isAgentSpeaking) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
      }

    } catch (error) {
      this.logger.error(`Error handling utterance: ${error.message}`, error.stack);
      this.voiceLogger?.logError(error, 'Handling utterance');

      // Sprint Voice-UX-01: Categorize error and use appropriate message
      const errorCategory = this.categorizeError(error);
      const errorMessage = this.getErrorMessage(errorCategory);

      // Attempt to speak an error message
      try {
        await this.speak(ttsProvider, errorMessage);
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

      // Sprint 2: Handle end_call tool execution
      if (toolCall.function.name === 'end_call') {
        try {
          const parsed = JSON.parse(result);
          const reason = args.reason || 'other';

          // Log the termination with duration
          this.logger.log(`🔚 end_call tool invoked: ${reason}`);
          this.voiceLogger?.logSessionEvent('call_ended_by_agent', {
            reason,
            notes: args.notes || null,
            duration_seconds: Math.floor((Date.now() - this.startTime) / 1000),
          });

          // Set call outcome (will be used when completing call log)
          this.setCallOutcome(reason);

          // Mark session as ending
          this.isActive = false;

          this.logger.log('🔚 Call will end after agent speaks final response');
        } catch (e) {
          this.logger.error(`Error processing end_call result: ${e.message}`);
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

      if (this.audioPublication) {
        try {
          this.logger.error(`  - Audio publication SID: ${this.audioPublication.sid}`);
          this.logger.error(`  - Audio publication muted: ${this.audioPublication.muted}`);
        } catch (e) {
          this.logger.error(`  - Could not read audio publication properties`);
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
   * Process audio chunk queue sequentially to prevent overlapping audio (Sprint 05).
   *
   * This ensures chunks are processed one at a time, preventing the "voices mixing" issue.
   */
  private async processAudioChunkQueue(): Promise<void> {
    if (this.isProcessingAudioQueue) {
      return; // Already processing
    }

    this.isProcessingAudioQueue = true;

    try {
      while (this.audioChunkQueue.length > 0) {
        const chunk = this.audioChunkQueue.shift();
        if (chunk) {
          await this.streamAudioChunkToLiveKit(chunk);
        }
      }
    } catch (error) {
      this.logger.error(`Error processing audio chunk queue: ${error.message}`);
    } finally {
      this.isProcessingAudioQueue = false;
    }
  }

  /**
   * Stream audio chunk to LiveKit immediately (Sprint BAS-TTS-02).
   *
   * This method is called by the WebSocket TTS callback as audio chunks arrive,
   * enabling ultra-low latency playback (300-500ms time-to-first-audio).
   *
   * @param audioData PCM audio buffer (s16le format)
   */
  private async streamAudioChunkToLiveKit(audioData: Buffer): Promise<void> {
    if (!this.audioSource) {
      this.logger.warn('Audio source not initialized - dropping chunk');
      return;
    }

    // ====================================================================================
    // Safety check: Verify publication exists and has valid SID before capturing frames
    // If track is not properly published, captureFrame() will throw InvalidState error
    // ====================================================================================
    if (!this.audioPublication || !this.audioPublication.sid || this.audioPublication.sid === 'TR_unknown') {
      this.logger.warn(`Audio publication not ready (SID: ${this.audioPublication?.sid || 'null'}) - dropping chunk`);
      return;
    }

    try {
      // Convert Buffer to Int16Array (PCM s16le format)
      const int16Array = new Int16Array(
        audioData.buffer,
        audioData.byteOffset,
        audioData.length / 2, // 2 bytes per Int16 sample
      );

      const sampleRate = 16000;
      const numChannels = 1;
      const samplesPerChannel = int16Array.length;

      // ====================================================================================
      // FIX: Split audio into 10ms frames for proper real-time streaming
      // Large frames (100ms+) cause choppy audio - LiveKit expects small, paced frames.
      // This matches the working approach in speak() method (lines 856-913).
      // ====================================================================================
      const frameSizeMs = 10;
      const samplesPerFrame = (sampleRate * frameSizeMs) / 1000; // 160 samples at 16kHz

      // Process each 10ms frame sequentially
      for (let i = 0; i < samplesPerChannel; i += samplesPerFrame) {
        const frameLength = Math.min(samplesPerFrame, samplesPerChannel - i);
        const frameData = int16Array.slice(i, i + frameLength);

        // Create audio frame (10ms of audio)
        const audioFrame = new AudioFrame(frameData, sampleRate, numChannels, frameLength);

        // Send frame sequentially - await provides natural pacing for smooth playback
        try {
          await this.audioSource.captureFrame(audioFrame);
        } catch (error) {
          this.logger.error(`Failed to capture audio frame (offset ${i}/${samplesPerChannel} samples): ${error.message}`);
          this.logger.error(`  Publication SID: ${this.audioPublication?.sid}`);
          this.logger.error(`  Frame samples: ${frameLength}`);
          this.logger.error(`  Total chunk samples: ${samplesPerChannel}`);
          throw error; // Stop processing on frame error
        }
      }

    } catch (error) {
      this.logger.error(`Error streaming audio chunk to LiveKit: ${error.message}`);
      this.logger.error(`  Publication SID: ${this.audioPublication?.sid}`);
      this.logger.error(`  Buffer length: ${audioData.length} bytes`);
      this.logger.error(`  Samples: ${audioData.length / 2}`);
    }
  }

  /**
   * Cleanup resources to prevent memory leaks.
   *
   * Releases:
   * - Audio stream reader
   * - Audio source and track
   * - Event listeners
   * - WebSocket TTS connection
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

      // Clean up audio publication
      if (this.audioPublication) {
        try {
          // Note: Publication is automatically cleaned up when track is closed
          // We just need to null out our reference to allow garbage collection
          this.audioPublication = null;
          this.logger.log('✅ Audio publication reference cleared');
        } catch (e) {
          this.logger.warn(`Error cleaning up audio publication: ${e.message}`);
        }
      }

      // Disconnect WebSocket TTS (Sprint BAS-TTS-02)
      if (this.streamingTtsProvider) {
        try {
          await this.streamingTtsProvider.disconnect();
          this.streamingTtsProvider = null;
        } catch (e) {
          this.logger.warn(`Error disconnecting streaming TTS: ${e.message}`);
        }
      }

      // Sprint 05: Clear audio chunk queue
      if (this.audioChunkQueue.length > 0) {
        this.logger.log(`Clearing ${this.audioChunkQueue.length} pending audio chunks from queue`);
        this.audioChunkQueue = [];
      }
      this.isProcessingAudioQueue = false;

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
   * Set call outcome (used by end_call tool).
   * Sprint 2: Tool-Based Call Termination
   */
  setCallOutcome(outcome: string): void {
    this.callOutcome = outcome as any;
  }

  /**
   * Get call outcome (used when completing call log).
   * Sprint 2: Tool-Based Call Termination
   */
  getCallOutcome(): string | null {
    return this.callOutcome;
  }

  /**
   * Get usage records for this session (STT, LLM, TTS).
   * Returns array of usage records with provider IDs, quantities, and estimated costs.
   */
  getUsageRecords(): Array<{
    provider_id: string;
    provider_type: 'STT' | 'LLM' | 'TTS';
    usage_quantity: number;
    usage_unit: 'seconds' | 'tokens' | 'characters';
    estimated_cost?: number;
  }> {
    const records: Array<{
      provider_id: string;
      provider_type: 'STT' | 'LLM' | 'TTS';
      usage_quantity: number;
      usage_unit: 'seconds' | 'tokens' | 'characters';
      estimated_cost?: number;
    }> = [];

    // STT usage
    if (this.sttSession && this.context.providers.stt) {
      try {
        const { totalSeconds } = this.sttSession.getUsage();
        if (totalSeconds > 0) {
          records.push({
            provider_id: this.context.providers.stt.provider_id,
            provider_type: 'STT',
            usage_quantity: totalSeconds,
            usage_unit: 'seconds',
            // Cost calculation can be added here if pricing is available in config
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to get STT usage: ${error.message}`);
      }
    }

    // LLM usage
    if (this.accumulatedLlmTokens > 0 && this.context.providers.llm) {
      records.push({
        provider_id: this.context.providers.llm.provider_id,
        provider_type: 'LLM',
        usage_quantity: this.accumulatedLlmTokens,
        usage_unit: 'tokens',
        // Cost calculation can be added here if pricing is available in config
      });
    }

    // TTS usage
    if (this.streamingTtsProvider && this.context.providers.tts) {
      try {
        const { totalCharacters } = this.streamingTtsProvider.getUsage();
        if (totalCharacters > 0) {
          records.push({
            provider_id: this.context.providers.tts.provider_id,
            provider_type: 'TTS',
            usage_quantity: totalCharacters,
            usage_unit: 'characters',
            // Cost calculation can be added here if pricing is available in config
          });
        }
      } catch (error) {
        this.logger.warn(`Failed to get TTS usage: ${error.message}`);
      }
    }

    return records;
  }

  /**
   * Setup audio pipeline from a LiveKit audio track to STT.
   * This is extracted to avoid code duplication between trackSubscribed event and already-subscribed check.
   */
  private setupAudioPipeline(track: RemoteAudioTrack, sttSession: any): void {
    try {
      const audioStream = new AudioStream(track, {
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

  // ═══════════════════════════════════════════════════════════════════════════
  // Sprint Voice-UX-01: Conversational UX Improvements (2026-02-27)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Categorize error type for appropriate error message selection.
   * Sprint: Voice-UX-01
   */
  private categorizeError(error: Error): 'stt' | 'llm' | 'tool' | 'system' {
    // STT errors
    if (error.name?.includes('Deepgram') ||
        error.message?.includes('transcription') ||
        error.message?.includes('STT')) {
      return 'stt';
    }

    // LLM errors
    if (error.message?.includes('OpenAI') ||
        error.message?.includes('completion') ||
        error.message?.includes('LLM')) {
      return 'llm';
    }

    // Tool execution errors
    if (error.message?.includes('tool') ||
        error.message?.includes('execute')) {
      return 'tool';
    }

    // Generic system error
    return 'system';
  }

  /**
   * Get appropriate error message based on error category.
   * Sprint: Voice-UX-01
   */
  private getErrorMessage(category: 'stt' | 'llm' | 'tool' | 'system'): string {
    const phrases = this.context.conversational_phrases;

    switch (category) {
      case 'stt':
        return this.getRandomPhrase(phrases.recovery_messages);
      case 'llm':
      case 'tool':
      case 'system':
      default:
        return this.getRandomPhrase(phrases.system_error_messages);
    }
  }

  /**
   * Get random phrase from array with fallback.
   * Sprint: Voice-UX-01
   */
  private getRandomPhrase(phrases: string[]): string {
    if (!phrases || phrases.length === 0) {
      // Fallback if admin deleted all phrases
      return "Sorry, could you repeat that?";
    }
    return phrases[Math.floor(Math.random() * phrases.length)];
  }

  /**
   * Check if transcript is valid (not just noise/breathing/silence).
   * Filters out:
   * - Very short utterances (< 2 characters)
   * - Common filler sounds ("uh", "um", "ah", "mm")
   * - Only punctuation
   * Sprint: Voice-UX-01
   */
  private isValidTranscript(text: string): boolean {
    const cleaned = text.trim().toLowerCase();

    // Too short - likely noise
    if (cleaned.length < 2) {
      return false;
    }

    // Common filler sounds - ignore
    const fillerSounds = ['uh', 'um', 'ah', 'mm', 'hmm', 'mhm', 'uh-huh'];
    if (fillerSounds.includes(cleaned)) {
      return false;
    }

    // Only punctuation/special chars - not real speech
    if (!/[a-zA-Z0-9]/.test(cleaned)) {
      return false;
    }

    // Valid transcript
    return true;
  }

  /**
   * Speak a filler phrase before executing tools.
   * Uses streaming TTS for low latency.
   * Sprint: Voice-UX-01
   */
  private async speakFillerPhrase(): Promise<void> {
    if (!this.streamingTtsProvider) {
      this.logger.warn('Streaming TTS not available - skipping filler phrase');
      return;
    }

    const fillerPhrase = this.getRandomPhrase(
      this.context.conversational_phrases.filler_phrases
    );

    this.logger.log(`🗣️  Speaking filler: "${fillerPhrase}"`);

    const contextId = `filler-${Date.now()}`;
    this.currentTtsContextId = contextId;
    this.isAgentSpeaking = true;

    try {
      // Stream filler phrase (mark as final to flush immediately)
      this.streamingTtsProvider.streamText(fillerPhrase, contextId, true);

      // Wait for playback with timeout
      const startTime = Date.now();
      const maxWaitMs = 5000;  // Filler should be short

      while (this.isAgentSpeaking && (Date.now() - startTime) < maxWaitMs) {
        await new Promise(r => setTimeout(r, 100));
      }

      if (this.isAgentSpeaking) {
        this.logger.warn('Filler phrase timeout - proceeding with tool execution');
        this.isAgentSpeaking = false;
      }

    } catch (error) {
      this.logger.error(`Failed to speak filler phrase: ${error.message}`);
      this.isAgentSpeaking = false;
      // Non-critical - continue with tool execution
    }
  }

  /**
   * Start a long-wait monitor that speaks periodic updates.
   * Returns a controller object with stop() method.
   * Sprint: Voice-UX-01
   */
  private startLongWaitMonitor(): { stop: () => void } {
    const LONG_WAIT_THRESHOLD_MS = 20000;  // 20 seconds (user preference)
    const PERIODIC_UPDATE_MS = 15000;       // Every 15 seconds after threshold

    let isStopped = false;
    let timerId: NodeJS.Timeout | null = null;
    let periodicTimerId: NodeJS.Timeout | null = null;

    // Start monitoring
    const startTime = Date.now();

    // Schedule initial long-wait message
    timerId = setTimeout(async () => {
      if (isStopped) return;

      const elapsed = Date.now() - startTime;
      this.logger.log(`⏱️  Long wait detected (${elapsed}ms) - speaking update message`);

      await this.speakLongWaitMessage();

      // Schedule periodic updates
      periodicTimerId = setInterval(async () => {
        if (isStopped) return;
        await this.speakLongWaitMessage();
      }, PERIODIC_UPDATE_MS);

    }, LONG_WAIT_THRESHOLD_MS);

    // Return controller
    return {
      stop: () => {
        isStopped = true;
        if (timerId) clearTimeout(timerId);
        if (periodicTimerId) clearInterval(periodicTimerId);
        this.logger.log('⏱️  Long-wait monitor stopped');
      }
    };
  }

  /**
   * Speak a "still checking" message during long tool execution.
   * Sprint: Voice-UX-01
   */
  private async speakLongWaitMessage(): Promise<void> {
    if (!this.streamingTtsProvider) return;

    const message = this.getRandomPhrase(
      this.context.conversational_phrases.long_wait_messages
    );

    this.logger.log(`🗣️  Speaking long-wait message: "${message}"`);

    // Use separate context to avoid interfering with main conversation
    const contextId = `longwait-${Date.now()}`;

    try {
      this.streamingTtsProvider.streamText(message, contextId, true);
      // Don't wait for completion - let it play in background
    } catch (error) {
      this.logger.error(`Failed to speak long-wait message: ${error.message}`);
    }
  }
}
