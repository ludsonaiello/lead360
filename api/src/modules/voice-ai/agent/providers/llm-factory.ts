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
