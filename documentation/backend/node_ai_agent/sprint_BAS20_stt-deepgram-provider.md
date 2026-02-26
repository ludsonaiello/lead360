# Sprint BAS20 — STT Provider: Deepgram Integration

**Module**: Voice AI → agent/providers/
**Sprint**: BAS20
**Depends on**: BAS19 (agent worker setup, livekit-server-sdk installed)
**Estimated size**: 2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `api/package.json` — verify `@deepgram/sdk` is installed or needs to be installed
- Read `api/src/modules/voice-ai/services/voice-ai-credentials.service.ts` — `getDecryptedKey()` method
- Read Deepgram Node.js SDK documentation for real-time transcription (LiveSocket)
- The Deepgram API key comes from `VoiceAiCredentialsService.getDecryptedKey(deepgramProviderId)`
- NEVER hardcode API keys
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Create the Deepgram STT (Speech-to-Text) provider class that the agent pipeline (BAS24) will use. This class wraps the Deepgram Node.js SDK to provide real-time transcription of audio from the LiveKit room.

---

## Pre-Coding Checklist

- [ ] BAS19 complete (agent worker setup done)
- [ ] Read `api/package.json` — check if `@deepgram/sdk` is already installed
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-credentials.service.ts` — `getDecryptedKey()` signature
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-providers.service.ts` — `findByKey('deepgram')` method
- [ ] Verify Deepgram API key is stored (from BAS06)

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Deepgram API key | Fetched from DB via `VoiceAiCredentialsService.getDecryptedKey(providerId)` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |

**NEVER hardcode credentials. Always fetch from DB.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/package.json` | Check installed packages |
| `api/src/modules/voice-ai/services/voice-ai-credentials.service.ts` | `getDecryptedKey()` signature |
| `api/src/modules/voice-ai/services/voice-ai-providers.service.ts` | `findByKey('deepgram')` |
| `api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts` | `VoiceAiContext.stt` shape |

---

## Task 1: Install Deepgram SDK

```bash
cd /var/www/lead360.app/api

# Check if already installed
cat package.json | grep deepgram

# Install if missing
npm install @deepgram/sdk
```

---

## Task 2: Create STT Interface

Create `api/src/modules/voice-ai/agent/providers/stt.interface.ts`:

```typescript
export interface SttProvider {
  // Start transcription for an audio stream
  // Returns an async generator of transcription results
  startTranscription(config: SttConfig): Promise<SttSession>;
}

export interface SttConfig {
  language: string;       // 'en', 'es', 'pt'
  apiKey: string;         // Decrypted from credentials service
  model?: string;         // 'nova-2', 'nova-3', etc.
  sampleRate?: number;    // Audio sample rate (default 16000)
}

export interface SttSession {
  // Send audio chunk to transcription
  sendAudio(audioChunk: Buffer): void;

  // Event emitter for transcript results
  on(event: 'transcript', handler: (text: string, isFinal: boolean) => void): void;
  on(event: 'error', handler: (error: Error) => void): void;

  // Close the session
  close(): Promise<void>;
}
```

---

## Task 3: Create Deepgram STT Provider

Create `api/src/modules/voice-ai/agent/providers/deepgram-stt.provider.ts`:

```typescript
import { Logger } from '@nestjs/common';
import { createClient, LiveTranscriptionEvents } from '@deepgram/sdk';
import { SttProvider, SttConfig, SttSession } from './stt.interface';

export class DeepgramSttProvider implements SttProvider {
  private readonly logger = new Logger(DeepgramSttProvider.name);

  async startTranscription(config: SttConfig): Promise<SttSession> {
    const deepgram = createClient(config.apiKey);

    const connection = deepgram.listen.live({
      language: config.language,
      model: config.model || 'nova-2',
      encoding: 'linear16',
      sample_rate: config.sampleRate || 16000,
      channels: 1,
      smart_format: true,
      punctuate: true,
      interim_results: true,
    });

    // Return a session object that wraps the Deepgram connection
    return {
      sendAudio: (audioChunk: Buffer) => {
        connection.send(audioChunk);
      },
      on: (event, handler) => {
        if (event === 'transcript') {
          connection.on(LiveTranscriptionEvents.Transcript, (data) => {
            const transcript = data.channel?.alternatives?.[0]?.transcript;
            if (transcript) {
              const isFinal = data.is_final || false;
              handler(transcript, isFinal);
            }
          });
        }
        if (event === 'error') {
          connection.on(LiveTranscriptionEvents.Error, handler);
        }
      },
      close: async () => {
        connection.finish();
      },
    };
  }
}
```

**Note**: Read the Deepgram SDK documentation for the correct event names and method signatures. The code above is a structural guide — verify actual API against the installed SDK version.

---

## Task 4: Create STT Provider Factory Helper

Create `api/src/modules/voice-ai/agent/providers/stt-factory.ts`:

```typescript
import { DeepgramSttProvider } from './deepgram-stt.provider';
import { SttProvider } from './stt.interface';

export function createSttProvider(providerKey: string): SttProvider {
  switch (providerKey) {
    case 'deepgram':
      return new DeepgramSttProvider();
    default:
      throw new Error(`Unknown STT provider: ${providerKey}`);
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
| `api/src/modules/voice-ai/agent/providers/stt.interface.ts` | CREATE | STT provider contract |
| `api/src/modules/voice-ai/agent/providers/deepgram-stt.provider.ts` | CREATE | Deepgram implementation |
| `api/src/modules/voice-ai/agent/providers/stt-factory.ts` | CREATE | Factory for provider selection |
| `api/package.json` | MODIFY (if needed) | Add @deepgram/sdk |

---

## Acceptance Criteria

- [ ] `@deepgram/sdk` installed and importable
- [ ] `DeepgramSttProvider` implements `SttProvider` interface
- [ ] STT session wraps Deepgram live connection
- [ ] API key comes from function argument (never hardcoded)
- [ ] `npm run build` passes with 0 errors

---

## Testing (Integration — BAS24 will test this fully)

```typescript
// Unit test: verify provider instantiates without error
const provider = new DeepgramSttProvider();
// Full integration test after BAS24 pipeline complete
```
