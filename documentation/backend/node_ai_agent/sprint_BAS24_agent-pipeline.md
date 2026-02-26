# Sprint BAS24 — Agent Pipeline (STT → LLM → TTS Full Flow)

**Module**: Voice AI → agent/
**Sprint**: BAS24
**Depends on**: BAS23 (all tools complete), BAS19 (worker setup)
**Estimated size**: 2–3 files, ~300 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `api/src/modules/voice-ai/agent/voice-agent.service.ts` from BAS19
- Read ALL provider interfaces (stt.interface.ts, llm.interface.ts, tts.interface.ts)
- Read `voice-ai-context-builder.service.ts` — `buildContext()` return shape
- Read `voice-call-log.service.ts` — `startCall()` and `completeCall()` method signatures
- Read `voice-usage.service.ts` — `checkAndReserveMinute()` method signature
- Read LiveKit Node.js SDK documentation for handling room participants and audio
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Complete the agent pipeline — the full STT→LLM→TTS loop that handles a voice conversation. This is the core of the Voice AI system. Completes `VoiceAgentService` started in BAS19 and adds per-call session management.

**Pipeline for each call:**
```
LiveKit SIP call arrives → room dispatch → VoiceAgentSession created
→ context built (BAS13)
→ quota checked (BAS14)
→ call logged (BAS15: startCall)
→ STT started (BAS20: Deepgram)
→ Conversation loop:
    1. STT transcribes caller speech
    2. LLM generates response (with tools)
    3. If tool called: execute tool (BAS23)
    4. TTS synthesizes response audio
    5. Audio sent back to LiveKit room
→ Call ends (transfer/hangup)
→ call logged (BAS15: completeCall)
→ usage recorded (BAS14)
```

---

## Pre-Coding Checklist

- [ ] BAS23 complete (all 4 tools created)
- [ ] Read `api/src/modules/voice-ai/agent/voice-agent.service.ts` (from BAS19)
- [ ] Read all provider interfaces
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts`
- [ ] Read `api/src/modules/voice-ai/services/voice-call-log.service.ts`
- [ ] Read `api/src/modules/voice-ai/services/voice-usage.service.ts`
- [ ] Read `livekit-server-sdk` installed package — check `ls api/node_modules/livekit-server-sdk/`
- [ ] Read LiveKit Node.js docs for: Room, Participant, audio track handling

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| LiveKit credentials | From `VoiceAiGlobalConfigService.getLiveKitConfig()` (already in DB) |
| Provider API keys | From `VoiceAiContextBuilderService.buildContext()` (already in DB) |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

**NEVER hardcode credentials.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/agent/voice-agent.service.ts` | BAS19 scaffold — complete the `startWorker()` |
| `api/src/modules/voice-ai/services/voice-ai-context-builder.service.ts` | `buildContext()` |
| `api/src/modules/voice-ai/services/voice-call-log.service.ts` | `startCall()` / `completeCall()` |
| `api/src/modules/voice-ai/services/voice-usage.service.ts` | `checkAndReserveMinute()` |
| `api/src/modules/voice-ai/agent/tools/` | All 4 tool files from BAS23 |
| LiveKit Node SDK | `ls api/node_modules/livekit-server-sdk/` — read index.d.ts |

---

## Task 1: Create VoiceAgentSession

Create `api/src/modules/voice-ai/agent/voice-agent.session.ts`:

```typescript
import { Logger } from '@nestjs/common';
import { VoiceAiContext } from '../interfaces/voice-ai-context.interface';
import { createSttProvider } from './providers/stt-factory';
import { createLlmProvider } from './providers/llm-factory';
import { createTtsProvider } from './providers/tts-factory';
import { AgentTool } from './tools/tool.interface';

export class VoiceAgentSession {
  private readonly logger = new Logger(VoiceAgentSession.name);
  private conversationHistory: any[] = [];
  private isActive = true;

  constructor(
    private readonly context: VoiceAiContext,
    private readonly tools: AgentTool[],
    private readonly room: any,  // LiveKit Room — type from livekit-server-sdk
  ) {}

  async start(): Promise<void> {
    const sttProvider = createSttProvider(this.context.stt.provider_key);
    const llmProvider = createLlmProvider(this.context.llm.provider_key);
    const ttsProvider = createTtsProvider(this.context.tts.provider_key);

    // Initialize conversation with system prompt
    this.conversationHistory = [
      { role: 'system', content: this.context.system_prompt }
    ];

    // Play greeting via TTS
    await this.speak(ttsProvider, this.context.greeting);

    // Start STT session
    const sttSession = await sttProvider.startTranscription({
      apiKey: this.context.stt.api_key,
      language: this.context.language,
    });

    // STT transcript handler
    let currentUtterance = '';
    sttSession.on('transcript', async (text: string, isFinal: boolean) => {
      if (!this.isActive) return;
      currentUtterance = text;

      if (isFinal && text.trim()) {
        await this.handleUtterance(text, llmProvider, ttsProvider);
        currentUtterance = '';
      }
    });

    // Subscribe to audio from LiveKit room participant
    // READ LiveKit SDK docs for exact method to get audio stream
    await this.subscribeToCallerAudio(sttSession);
  }

  private async handleUtterance(text: string, llmProvider: any, ttsProvider: any): Promise<void> {
    // Add user message to history
    this.conversationHistory.push({ role: 'user', content: text });

    // Build tool definitions for LLM
    const toolDefinitions = this.tools.map(t => t.definition);

    // Call LLM
    const llmSession = await llmProvider.chat({
      apiKey: this.context.llm.api_key,
      model: this.context.llm.config?.model || 'gpt-4o',
      messages: this.conversationHistory,
      tools: toolDefinitions,
      systemPrompt: this.context.system_prompt,
      maxTokens: 200,
    });

    // Check for tool calls
    const toolCalls = await llmSession.getToolCalls();

    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        const tool = this.tools.find(t => t.definition.function.name === toolCall.function.name);
        if (tool) {
          const result = await tool.execute(
            JSON.parse(toolCall.function.arguments),
            {
              tenant_id: this.context.tenant_id,
              call_sid: this.context.call_sid,
              caller_phone: '', // from voice_call_log.from_number
            }
          );
          // Handle TRANSFER action
          if (toolCall.function.name === 'transfer_call') {
            const parsed = JSON.parse(result);
            if (parsed.action === 'TRANSFER') {
              await this.handleTransfer(parsed.transfer_to, ttsProvider);
              return;
            }
          }
          // Add tool result to history
          this.conversationHistory.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result,
          });
        }
      }

      // Get follow-up response after tool execution
      const followUpSession = await llmProvider.chat({
        apiKey: this.context.llm.api_key,
        model: this.context.llm.config?.model || 'gpt-4o',
        messages: this.conversationHistory,
        maxTokens: 200,
      });
      const followUpText = await followUpSession.getText();
      this.conversationHistory.push({ role: 'assistant', content: followUpText });
      await this.speak(ttsProvider, followUpText);

    } else {
      const responseText = await llmSession.getText();
      this.conversationHistory.push({ role: 'assistant', content: responseText });
      await this.speak(ttsProvider, responseText);
    }
  }

  private async speak(ttsProvider: any, text: string): Promise<void> {
    if (!text.trim()) return;

    const ttsSession = await ttsProvider.synthesize({
      apiKey: this.context.tts.api_key,
      voiceId: this.context.voice_id,
      text,
      language: this.context.language,
    });

    // Send audio to LiveKit room
    // READ LiveKit SDK docs for exact method to publish audio to a room
    const audioBuffer = await ttsSession.getAudio();
    await this.publishAudioToRoom(audioBuffer);
  }

  private async subscribeToCallerAudio(sttSession: any): Promise<void> {
    // READ livekit-server-sdk documentation
    // The exact API depends on the SDK version installed
    // Check api/node_modules/livekit-server-sdk/README.md
    this.logger.log('Subscribing to caller audio stream');
    // TODO: implement with actual LiveKit SDK
  }

  private async publishAudioToRoom(audio: Buffer): Promise<void> {
    // READ livekit-server-sdk documentation
    this.logger.log(`Publishing ${audio.length} bytes of audio`);
    // TODO: implement with actual LiveKit SDK
  }

  private async handleTransfer(phoneNumber: string, ttsProvider: any): Promise<void> {
    await this.speak(ttsProvider, 'Let me transfer you to a team member right away.');
    this.isActive = false;
    // Signal LiveKit to transfer the SIP call
    // READ LiveKit SIP documentation for transfer API
  }

  async stop(outcome: string, transcript: string[]): Promise<void> {
    this.isActive = false;
    // Cleanup resources
  }

  getConversationHistory(): any[] {
    return [...this.conversationHistory];
  }
}
```

---

## Task 2: Complete VoiceAgentService.startWorker()

In `voice-agent.service.ts` (from BAS19), complete the `startWorker()` method:

```typescript
private async startWorker(config: { url: string; apiKey: string; apiSecret: string }): Promise<void> {
  // Use livekit-server-sdk to create a worker
  // READ the SDK docs and check api/node_modules/livekit-server-sdk/
  // The worker must:
  // 1. Connect to LiveKit
  // 2. Listen for new room/participant events (SIP calls)
  // 3. For each new SIP call: build context, create session, start pipeline

  this.logger.log(`Starting LiveKit worker: ${config.url}`);

  // Example pattern (verify against actual SDK):
  // this.worker = new Worker(config.url, {
  //   apiKey: config.apiKey,
  //   apiSecret: config.apiSecret,
  //   agentName: 'lead360-voice-ai',
  // });
  //
  // this.worker.on('job_assigned', async (job) => {
  //   await this.handleNewCall(job);
  // });
  //
  // await this.worker.connect();
}

private async handleNewCall(job: any): Promise<void> {
  // Extract tenantId and callSid from SIP URI params
  // Build context
  // Check quota
  // Log call start
  // Create and start VoiceAgentSession

  const { tenantId, callSid } = this.extractCallParams(job);
  const context = await this.contextBuilder.buildContext(tenantId, callSid);
  const quota = await this.usageService.checkAndReserveMinute(tenantId);

  if (!quota.allowed) {
    // Reject call
    return;
  }

  await this.callLogService.startCall({
    tenant_id: tenantId,
    call_sid: callSid,
    from_number: job.fromNumber,
    to_number: job.toNumber,
    room_name: job.roomName,
  });

  const tools = this.buildTools(context, tenantId);
  const session = new VoiceAgentSession(context, tools, job.room);
  await session.start();
}
```

---

## Task 3: Add Required Injections to VoiceAgentService

Add to constructor (they were commented out in BAS19):

```typescript
constructor(
  private readonly globalConfigService: VoiceAiGlobalConfigService,
  private readonly contextBuilder: VoiceAiContextBuilderService,
  private readonly callLogService: VoiceCallLogService,
  private readonly usageService: VoiceUsageService,
  private readonly transferNumbersService: VoiceTransferNumbersService,
  private readonly leadsService: LeadsService,
  private readonly leadPhonesService: LeadPhonesService,
  private readonly prisma: PrismaService,
) {}
```

Update `voice-ai.module.ts` to ensure all these services are available (check which modules need to be imported).

---

## Task 4: Enable Agent and Test

```bash
# Enable agent in global config
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

curl -X PATCH http://localhost:3000/api/v1/system/voice-ai/config \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent_enabled": true}'

# Restart API and watch logs
cd /var/www/lead360.app/api && npm run start:dev 2>&1 | grep -i "voice\|livekit"
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/agent/voice-agent.session.ts` | CREATE | Per-call conversation handler |
| `api/src/modules/voice-ai/agent/voice-agent.service.ts` | MODIFY | Complete startWorker() + handleNewCall() |
| `api/src/modules/voice-ai/voice-ai.module.ts` | MODIFY | Add LeadsModule, LeadPhonesService imports |

---

## Acceptance Criteria

- [ ] `VoiceAgentSession` class created with STT→LLM→TTS loop
- [ ] `VoiceAgentService.startWorker()` connects to LiveKit
- [ ] Tool execution works: `find_lead`, `create_lead`, `check_service_area`, `transfer_call`
- [ ] Call lifecycle logged: `startCall()` and `completeCall()` called correctly
- [ ] Quota checked before call proceeds
- [ ] API starts without error when `agent_enabled = true`
- [ ] `npm run build` passes with 0 errors
- [ ] A test call from LiveKit shows conversation logs in NestJS console
