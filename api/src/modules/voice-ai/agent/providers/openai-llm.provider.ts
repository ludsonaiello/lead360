import { Logger } from '@nestjs/common';
import OpenAI from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { LlmProvider, LlmChatConfig, LlmSession, LlmToolCall } from './llm.interface';

export class OpenAiLlmProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiLlmProvider.name);

  async chat(config: LlmChatConfig): Promise<LlmSession> {
    const client = new OpenAI({ apiKey: config.apiKey });

    const messages: ChatCompletionMessageParam[] = [
      { role: 'system' as const, content: config.systemPrompt || '' },
      ...config.messages as ChatCompletionMessageParam[],
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
      stream_options: { include_usage: true }, // Request usage data in stream
    });

    // Buffer for collecting chunks
    let fullText = '';
    const toolCallsMap: Map<number, any> = new Map();
    let streamConsumed = false;
    let streamComplete = false;
    const textChunks: string[] = [];
    let totalTokens = 0; // Track usage

    // Consume stream once and buffer everything
    const consumeStream = async () => {
      if (streamConsumed) return;
      streamConsumed = true;

      try {
        for await (const chunk of stream) {
          const delta = chunk.choices[0]?.delta;

          // Accumulate text content
          if (delta?.content) {
            fullText += delta.content;
            textChunks.push(delta.content);
          }

          // Accumulate tool calls
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const index = tc.index;
              if (!toolCallsMap.has(index)) {
                toolCallsMap.set(index, {
                  id: '',
                  type: 'function' as const,
                  function: { name: '', arguments: '' },
                });
              }

              const existing = toolCallsMap.get(index);
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name += tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            }
          }

          // Capture usage data (included in final chunk when stream_options.include_usage is true)
          if (chunk.usage) {
            totalTokens = chunk.usage.total_tokens || 0;
          }
        }
      } catch (error) {
        this.logger.error('Error consuming OpenAI stream:', error);
        throw error;
      } finally {
        streamComplete = true;
      }
    };

    return {
      getText: async () => {
        await consumeStream();
        return fullText;
      },

      getToolCalls: async () => {
        await consumeStream();
        const toolCalls: LlmToolCall[] = [];

        // Convert map to array, filtering out incomplete entries
        for (const tc of toolCallsMap.values()) {
          if (tc.id && tc.function?.name) {
            toolCalls.push({
              id: tc.id,
              type: 'function',
              function: {
                name: tc.function.name,
                arguments: tc.function.arguments,
              },
            });
          }
        }

        return toolCalls;
      },

      stream: async function* () {
        // If stream hasn't been consumed yet, consume it and yield chunks
        if (!streamConsumed) {
          streamConsumed = true;

          try {
            for await (const chunk of stream) {
              const delta = chunk.choices[0]?.delta;

              // Accumulate text content
              if (delta?.content) {
                fullText += delta.content;
                textChunks.push(delta.content);
                yield delta.content;
              }

              // Accumulate tool calls (same logic as consumeStream)
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const index = tc.index;
                  if (!toolCallsMap.has(index)) {
                    toolCallsMap.set(index, {
                      id: '',
                      type: 'function' as const,
                      function: { name: '', arguments: '' },
                    });
                  }

                  const existing = toolCallsMap.get(index);
                  if (tc.id) existing.id = tc.id;
                  if (tc.function?.name) existing.function.name += tc.function.name;
                  if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
                }
              }

              // Capture usage data (included in final chunk when stream_options.include_usage is true)
              if (chunk.usage) {
                totalTokens = chunk.usage.total_tokens || 0;
              }
            }
          } finally {
            streamComplete = true;
          }
        } else if (streamComplete) {
          // Stream already consumed by getText(), yield buffered chunks
          for (const chunk of textChunks) {
            yield chunk;
          }
        }
      },

      getUsage: () => {
        return { totalTokens };
      },
    };
  }
}
