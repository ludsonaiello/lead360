# Sprint BAS22 — TTS Provider: Cartesia Integration

**Module**: Voice AI → agent/providers/
**Sprint**: BAS22
**Depends on**: BAS21 (LLM OpenAI provider complete)
**Estimated size**: 2 files, ~120 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `api/package.json` — check if `cartesia-typescript` or `@cartesia/sdk` is installed
- If not installed, find the correct package name: `npm search cartesia`
- Read the installed Cartesia SDK documentation for TTS streaming
- Follow the same interface pattern as STT and LLM providers
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Create the Cartesia TTS (Text-to-Speech) provider class. Converts LLM text output to audio that is played back to the caller via LiveKit. Supports streaming for low latency.

---

## Pre-Coding Checklist

- [ ] BAS21 complete (LLM OpenAI provider done)
- [ ] Run `cat /var/www/lead360.app/api/package.json | grep -i cartesia` — check if installed
- [ ] Read `api/src/modules/voice-ai/agent/providers/stt.interface.ts` — pattern to follow
- [ ] Read `api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts` — `VoiceAiContext.tts` shape

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Cartesia API key | From `VoiceAiContext.tts.api_key` (passed as argument) |

**NEVER hardcode credentials.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/package.json` | Check cartesia installation |
| `api/src/modules/voice-ai/agent/providers/stt.interface.ts` | Pattern reference |
| `api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts` | TTS config shape |

---

## Task 1: Install Cartesia SDK

```bash
cd /var/www/lead360.app/api

# Check if installed
cat package.json | grep -i cartesia

# Install if missing — verify the correct package name:
npm install cartesia-typescript
# OR
npm install @cartesia/cartesia-js
# Check https://www.npmjs.com/search?q=cartesia for the correct package
```

---

## Task 2: Create TTS Interface

Create `api/src/modules/voice-ai/agent/providers/tts.interface.ts`:

```typescript
export interface TtsProvider {
  // Convert text to audio
  synthesize(config: TtsConfig): Promise<TtsSession>;
}

export interface TtsConfig {
  apiKey: string;
  voiceId: string;        // Cartesia voice ID (e.g., from voice_ai_global_config.default_voice_id)
  text: string;
  language?: string;      // 'en', 'es', 'pt'
  model?: string;         // 'sonic-english', 'sonic-multilingual'
  outputFormat?: {
    container: string;    // 'raw'
    encoding: string;     // 'pcm_s16le' for LiveKit
    sampleRate: number;   // 16000 or 24000
  };
}

export interface TtsSession {
  // Get full audio buffer
  getAudio(): Promise<Buffer>;

  // Stream audio chunks (for low latency)
  streamAudio(): AsyncIterable<Buffer>;

  // Estimated duration in seconds
  estimatedDuration?: number;
}
```

---

## Task 3: Create Cartesia TTS Provider

Create `api/src/modules/voice-ai/agent/providers/cartesia-tts.provider.ts`:

```typescript
import { Logger } from '@nestjs/common';
import { TtsProvider, TtsConfig, TtsSession } from './tts.interface';

export class CartesiaTtsProvider implements TtsProvider {
  private readonly logger = new Logger(CartesiaTtsProvider.name);

  async synthesize(config: TtsConfig): Promise<TtsSession> {
    // Import Cartesia SDK — use the package installed in Task 1
    // DO NOT assume the import path — check node_modules/cartesia-typescript/
    // Read the SDK's README or index.d.ts for correct import and usage
    const Cartesia = await import('cartesia-typescript');  // adjust based on actual package

    const client = new Cartesia.default({ apiKey: config.apiKey });

    const audioChunks: Buffer[] = [];

    return {
      getAudio: async () => {
        // Call Cartesia TTS API — read SDK docs for correct method
        // Cartesia provides bytes streaming via WebSocket or HTTP
        const response = await client.tts.bytes({
          model_id: config.model || 'sonic-english',
          transcript: config.text,
          voice: { mode: 'id', id: config.voiceId },
          output_format: config.outputFormat || {
            container: 'raw',
            encoding: 'pcm_s16le',
            sample_rate: 16000,
          },
          language: config.language || 'en',
        });

        // Collect chunks
        const chunks: Buffer[] = [];
        for await (const chunk of response) {
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      },
      streamAudio: async function* () {
        // Streaming version — yields audio chunks as they arrive
        const response = await client.tts.bytes({
          model_id: config.model || 'sonic-english',
          transcript: config.text,
          voice: { mode: 'id', id: config.voiceId },
          output_format: config.outputFormat || {
            container: 'raw',
            encoding: 'pcm_s16le',
            sample_rate: 16000,
          },
          language: config.language || 'en',
        });
        for await (const chunk of response) {
          yield Buffer.from(chunk);
        }
      },
    };
  }
}
```

**CRITICAL NOTE**: The code above is a structural guide. The actual Cartesia SDK API may differ significantly. Before writing the implementation:
1. `ls /var/www/lead360.app/api/node_modules/cartesia-typescript/` — see what's there
2. `cat /var/www/lead360.app/api/node_modules/cartesia-typescript/README.md` — read the API
3. Check `index.d.ts` for actual types and method signatures
4. Write code against the REAL SDK, not the guide above

---

## Task 4: Add TTS Factory

Create `api/src/modules/voice-ai/agent/providers/tts-factory.ts`:

```typescript
import { CartesiaTtsProvider } from './cartesia-tts.provider';
import { TtsProvider } from './tts.interface';

export function createTtsProvider(providerKey: string): TtsProvider {
  switch (providerKey) {
    case 'cartesia':
      return new CartesiaTtsProvider();
    default:
      throw new Error(`Unknown TTS provider: ${providerKey}`);
  }
}
```

---

## Task 5: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/agent/providers/tts.interface.ts` | CREATE | TTS provider contract |
| `api/src/modules/voice-ai/agent/providers/cartesia-tts.provider.ts` | CREATE | Cartesia implementation |
| `api/src/modules/voice-ai/agent/providers/tts-factory.ts` | CREATE | Factory function |
| `api/package.json` | MODIFY (if needed) | Add cartesia SDK |

---

## Acceptance Criteria

- [ ] Cartesia SDK installed
- [ ] `CartesiaTtsProvider` implements `TtsProvider` interface
- [ ] `getAudio()` returns complete audio as Buffer
- [ ] `streamAudio()` yields chunks for low latency
- [ ] Implementation matches actual SDK (not guessed)
- [ ] `npm run build` passes with 0 errors
