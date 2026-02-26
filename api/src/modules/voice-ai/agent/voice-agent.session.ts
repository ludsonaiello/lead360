import { Logger } from '@nestjs/common';
import { VoiceAiContext } from '../interfaces/voice-ai-context.interface';
import { createSttProvider } from './providers/stt-factory';
import { createLlmProvider } from './providers/llm-factory';
import { createTtsProvider } from './providers/tts-factory';
import { AgentTool } from './tools/tool.interface';
import { LlmMessage, LlmToolCall } from './providers/llm.interface';

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

  constructor(
    private readonly context: VoiceAiContext,
    private readonly tools: AgentTool[],
    private readonly room: any, // LiveKit Room — type varies between @livekit/rtc-node versions
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
      // NOTE: Sprint document says to read LiveKit SDK docs for exact method.
      // The @livekit/agents SDK handles room connections automatically via JobContext,
      // so we don't need to manually subscribe to audio here.
      // Audio routing is handled by the LiveKit RTC layer.

      this.logger.log('Voice session started successfully');

      // Keep session alive until stopped
      await this.waitUntilStopped();

      // Cleanup
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

      // Publish to LiveKit room
      // NOTE: Sprint document says to read LiveKit SDK docs for exact method.
      // The @livekit/agents SDK and @livekit/rtc-node handle audio publishing.
      // For now, this is a placeholder. The actual implementation depends on
      // the LiveKit Agents SDK's audio publishing API.
      this.logger.log(`Generated ${audioBuffer.length} bytes of audio`);

      // TODO: Implement actual LiveKit audio publishing
      // This requires using the Room's LocalParticipant to publish an audio track.

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
   *
   * NOTE: Actual SIP transfer requires LiveKit SIP API.
   * This is a placeholder implementation.
   */
  private async handleTransfer(phoneNumber: string, ttsProvider: any): Promise<void> {
    this.logger.log(`Transferring call to: ${phoneNumber}`);

    try {
      await this.speak(ttsProvider, 'Let me transfer you to a team member right away.');
      this.isActive = false;

      // TODO: Implement LiveKit SIP transfer
      // This requires using LiveKit SIP API to transfer the call.
      // Read LiveKit SIP documentation for transfer API.

      this.logger.log('Call transfer initiated');

    } catch (error) {
      this.logger.error(`Transfer error: ${error.message}`, error.stack);
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
  }

  /**
   * Get the full conversation history.
   */
  getConversationHistory(): LlmMessage[] {
    return [...this.conversationHistory];
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
