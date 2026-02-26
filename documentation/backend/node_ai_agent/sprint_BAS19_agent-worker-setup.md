# Sprint BAS19 — Agent Worker Setup (LiveKit NestJS OnModuleInit)

**Module**: Voice AI → agent/
**Sprint**: BAS19
**Depends on**: BAS18 (all services and config complete, LiveKit credentials in DB)
**Estimated size**: 2–3 files, ~200 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-global-config.service.ts` — `getLiveKitConfig()` method — this is how you get LiveKit credentials
- Read `api/package.json` — check what LiveKit/audio packages are already installed
- Install ONLY what is needed — read the npm registry for correct package names
- Understand NestJS `OnModuleInit` lifecycle — `onModuleInit()` runs after module loads
- The worker must start ONLY if `agent_enabled = true` in `voice_ai_global_config`
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Create the LiveKit agent worker that runs **inside NestJS** as a service. This replaces the Python agent that was removed in BAS00. The worker starts on NestJS boot (`OnModuleInit`), connects to LiveKit, and dispatches voice agent sessions for each incoming SIP call.

**Architecture:**
```
NestJS starts → VoiceAgentService.onModuleInit()
  → Reads LiveKit config from DB (getLiveKitConfig())
  → If agent_enabled = true: starts LiveKit worker
  → Worker listens for room dispatch events
  → Per call: creates VoiceAgentSession (handled in BAS24)
```

---

## Pre-Coding Checklist

- [ ] BAS18 complete (LiveKit credentials in DB via BAS08, agent_enabled can be set to true)
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-global-config.service.ts` — `getLiveKitConfig()` method
- [ ] Read `api/package.json` — check for `livekit-server-sdk` or `@livekit/agents` packages
- [ ] Read `api/src/modules/voice-ai/voice-ai.module.ts` — understand current module setup
- [ ] Read `api/src/modules/voice-ai/agent/` folder — what exists (if anything)

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| LiveKit URL/keys | Already stored in DB via BAS08 — fetch via `getLiveKitConfig()` |

**NEVER hardcode LiveKit credentials. Always fetch from DB via VoiceAiGlobalConfigService.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/services/voice-ai-global-config.service.ts` | `getLiveKitConfig()` — credentials fetch |
| `api/package.json` | What LiveKit packages are installed |
| `api/src/modules/voice-ai/agent/` | What's already there |
| `api/src/modules/voice-ai/voice-ai.module.ts` | Current providers/imports |

---

## Task 1: Install Required npm Packages

First check what's already in `api/package.json`:

```bash
cat /var/www/lead360.app/api/package.json | grep -i livekit
```

Install what's needed:

```bash
cd /var/www/lead360.app/api

# LiveKit server SDK (for creating tokens, managing rooms)
npm install livekit-server-sdk

# LiveKit Agents SDK for Node.js (check latest version)
# This is the Node.js equivalent of livekit-agents Python package
npm install @livekit/agents

# If @livekit/agents is not yet stable for Node.js, use the server SDK directly
# with WorkerOptions — check https://docs.livekit.io/agents/quickstart
```

**IMPORTANT**: If `@livekit/agents` Node.js SDK doesn't exist yet (check npm), use the approach of:
1. `livekit-server-sdk` for room management and token generation
2. Subscribe to room events directly via LiveKit's RoomServiceClient
3. Handle SIP participant joins via webhook (see BAS — LiveKit webhook approach)

Read the LiveKit Node.js documentation to understand the correct approach before installing packages.

---

## Task 2: Create VoiceAgentService (OnModuleInit)

Create `api/src/modules/voice-ai/agent/voice-agent.service.ts`:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { VoiceAiGlobalConfigService } from '../services/voice-ai-global-config.service';

@Injectable()
export class VoiceAgentService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VoiceAgentService.name);
  private worker: any = null;   // LiveKit Worker instance — type depends on SDK

  constructor(
    private readonly globalConfigService: VoiceAiGlobalConfigService,
    // Injected in later sprints:
    // private readonly contextBuilder: VoiceAiContextBuilderService,
    // private readonly callLogService: VoiceCallLogService,
    // private readonly usageService: VoiceUsageService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const config = await this.globalConfigService.getConfig();

      if (!config.agent_enabled) {
        this.logger.log('Voice AI agent disabled — skipping worker start');
        return;
      }

      const livekitConfig = await this.globalConfigService.getLiveKitConfig();

      if (!livekitConfig.url || !livekitConfig.apiKey || !livekitConfig.apiSecret) {
        this.logger.warn('LiveKit credentials not configured — voice agent not started');
        return;
      }

      await this.startWorker(livekitConfig);
      this.logger.log('Voice AI agent worker started successfully');

    } catch (error) {
      // CRITICAL: Never crash the NestJS API if voice agent fails to start
      this.logger.error('Voice agent failed to start — API continues without voice AI', error.message);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.stopWorker();
      this.logger.log('Voice AI agent worker stopped');
    }
  }

  private async startWorker(config: { url: string; apiKey: string; apiSecret: string }): Promise<void> {
    // Implementation in BAS24 (agent pipeline)
    // This is the placeholder — connects to LiveKit and starts listening for jobs
    this.logger.log(`Connecting to LiveKit: ${config.url}`);
    // TODO: BAS24 will complete this
  }

  private async stopWorker(): Promise<void> {
    // Gracefully close the LiveKit worker connection
    this.worker = null;
  }

  // Public: check if worker is running (for monitoring endpoint BAS25)
  isRunning(): boolean {
    return this.worker !== null;
  }
}
```

---

## Task 3: Register VoiceAgentService in Module

In `voice-ai.module.ts`:
1. Import `VoiceAgentService` from `./agent/voice-agent.service`
2. Add to `providers` array
3. Ensure `VoiceAiGlobalConfigService` is available in the same module (it should already be)

---

## Task 4: Verify OnModuleInit Does NOT Crash API

```bash
cd /var/www/lead360.app/api
npm run build
npm run start:dev
```

Check the logs:
- If `agent_enabled = false`: should see "Voice AI agent disabled — skipping worker start"
- If LiveKit config not set: should see "LiveKit credentials not configured"
- API should boot completely — no crashes
- Once BAS08 credentials are entered and `agent_enabled = true`: should see "Connecting to LiveKit..."

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/agent/voice-agent.service.ts` | CREATE | OnModuleInit worker entry point |
| `api/src/modules/voice-ai/voice-ai.module.ts` | MODIFY | Register VoiceAgentService |
| `api/package.json` | MODIFY | Add livekit-server-sdk and/or @livekit/agents |

---

## Acceptance Criteria

- [ ] `VoiceAgentService` implements `OnModuleInit` and `OnModuleDestroy`
- [ ] NestJS API starts without crashing even with no LiveKit config
- [ ] Log message shows when agent is disabled
- [ ] Log message shows when agent starts connecting
- [ ] `isRunning()` method exists (used by BAS25 monitoring)
- [ ] `npm run build` passes with 0 errors
- [ ] `npm run start:dev` boots without errors

---

## Testing

```bash
# Start API and watch logs
cd /var/www/lead360.app/api && npm run start:dev 2>&1 | grep -i "voice\|livekit"

# Expected with agent_enabled=false:
# "Voice AI agent disabled — skipping worker start"

# To test with agent_enabled=true, first ensure LiveKit config is set (BAS08)
# then: PATCH /api/v1/system/voice-ai/config { agent_enabled: true }
# then restart the API
```
