# Sprint BAS21 — LLM Provider: OpenAI Integration

**Module**: Voice AI → agent/providers/
**Sprint**: BAS21
**Depends on**: BAS20 (STT Deepgram provider complete)
**Estimated size**: 2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `api/package.json` — `openai` package is ALREADY installed (verify the version)
- Read `api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts` — `VoiceAiContext.llm` shape
- Read `api/src/modules/voice-ai/agent/providers/stt.interface.ts` to follow same pattern
- The OpenAI API key comes from `VoiceAiContext.llm.api_key` (already decrypted by context builder)
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Create the OpenAI LLM provider class for the agent pipeline. This wraps the `openai` npm package (already installed) for streaming chat completions. The LLM takes conversation history + tool definitions and produces responses that drive agent behavior.

---

## Pre-Coding Checklist

- [ ] BAS20 complete (Deepgram STT provider done)
- [ ] Run `cat /var/www/lead360.app/api/package.json | grep '"openai"'` — verify installed
- [ ] Read `api/src/modules/voice-ai/agent/providers/stt.interface.ts` — follow same interface pattern
- [ ] Read `api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts`
- [ ] Check the OpenAI SDK version: `cat api/node_modules/openai/package.json | grep '"version"'`

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| OpenAI API key | From `VoiceAiContext.llm.api_key` (passed to methods as argument) |

**NEVER hardcode credentials.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/package.json` | Verify openai version installed |
| `api/src/modules/voice-ai/agent/providers/stt.interface.ts` | Pattern to follow |
| `api/src/modules/voice-ai/interfaces/voice-ai-context.interface.ts` | LLM config shape |

---

## Task 1: Create LLM Interface

Create `api/src/modules/voice-ai/agent/providers/llm.interface.ts`:

```typescript
export interface LlmProvider {
  // Generate response for current conversation
  // Returns streaming text chunks
  chat(config: LlmChatConfig): Promise<LlmSession>;
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_calls?: LlmToolCall[];
}

export interface LlmToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;  // JSON string
  };
}

export interface LlmTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;  // JSON Schema
  };
}

export interface LlmChatConfig {
  apiKey: string;
  model: string;            // 'gpt-4o', 'gpt-4o-mini'
  messages: LlmMessage[];
  tools?: LlmTool[];
  systemPrompt?: string;
  temperature?: number;     // Default 0.7
  maxTokens?: number;       // Default 200 (short for voice)
}

export interface LlmSession {
  // Collect full response text (waits for completion)
  getText(): Promise<string>;

  // Get tool calls (if any) from the response
  getToolCalls(): Promise<LlmToolCall[]>;

  // Stream text chunks for TTS
  stream(): AsyncIterable<string>;
}
```

---

## Task 2: Create OpenAI LLM Provider

Create `api/src/modules/voice-ai/agent/providers/openai-llm.provider.ts`:

```typescript
import { Logger } from '@nestjs/common';
import OpenAI from 'openai';   // Already installed — read package.json to confirm import path
import { LlmProvider, LlmChatConfig, LlmSession } from './llm.interface';

export class OpenAiLlmProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiLlmProvider.name);

  async chat(config: LlmChatConfig): Promise<LlmSession> {
    const client = new OpenAI({ apiKey: config.apiKey });

    const messages = [
      { role: 'system' as const, content: config.systemPrompt || '' },
      ...config.messages,
    ];

    // Create streaming chat completion
    const stream = await client.chat.completions.create({
      model: config.model || 'gpt-4o',
      messages,
      tools: config.tools?.length ? config.tools : undefined,
      tool_choice: config.tools?.length ? 'auto' : undefined,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.maxTokens ?? 200,
      stream: true,
    });

    let fullText = '';
    const toolCalls: any[] = [];

    return {
      getText: async () => {
        // Collect all chunks
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;
          if (delta?.content) fullText += delta.content;
          if (delta?.tool_calls) {
            // Accumulate tool calls
            for (const tc of delta.tool_calls) {
              if (!toolCalls[tc.index]) toolCalls[tc.index] = { id: '', function: { name: '', arguments: '' } };
              if (tc.id) toolCalls[tc.index].id = tc.id;
              if (tc.function?.name) toolCalls[tc.index].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[tc.index].function.arguments += tc.function.arguments;
            }
          }
        }
        return fullText;
      },
      getToolCalls: async () => {
        if (!fullText && toolCalls.length === 0) await this.getText();
        return toolCalls.filter(tc => tc?.function?.name);
      },
      stream: async function* () {
        for await (const chunk of stream) {
          const text = chunk.choices[0]?.delta?.content;
          if (text) yield text;
        }
      },
    };
  }
}
```

**Note**: Read the actual `openai` package API from the installed version. The streaming API may differ. Check `api/node_modules/openai/` for actual types.

---

## Task 3: Add to Factory

Update `api/src/modules/voice-ai/agent/providers/stt-factory.ts` — rename to `provider-factory.ts` (or create a separate llm-factory.ts):

```typescript
// api/src/modules/voice-ai/agent/providers/llm-factory.ts
import { OpenAiLlmProvider } from './openai-llm.provider';
import { LlmProvider } from './llm.interface';

export function createLlmProvider(providerKey: string): LlmProvider {
  switch (providerKey) {
    case 'openai':
      return new OpenAiLlmProvider();
    default:
      throw new Error(`Unknown LLM provider: ${providerKey}`);
  }
}
```

---

## Task 4: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/agent/providers/llm.interface.ts` | CREATE | LLM provider contract |
| `api/src/modules/voice-ai/agent/providers/openai-llm.provider.ts` | CREATE | OpenAI chat completion implementation |
| `api/src/modules/voice-ai/agent/providers/llm-factory.ts` | CREATE | Factory function |

---

## Acceptance Criteria

- [ ] `OpenAiLlmProvider` implements `LlmProvider` interface
- [ ] Uses streaming chat completions (stream: true)
- [ ] Tool calls properly accumulated from stream chunks
- [ ] API key passed as argument (never hardcoded)
- [ ] Compatible with tool definitions for BAS23
- [ ] `npm run build` passes with 0 errors
