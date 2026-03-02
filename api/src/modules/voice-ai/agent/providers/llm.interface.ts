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
    arguments: string; // JSON string
  };
}

export interface LlmTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>; // JSON Schema
  };
}

export interface LlmChatConfig {
  apiKey: string;
  model: string; // 'gpt-4o', 'gpt-4o-mini'
  messages: LlmMessage[];
  tools?: LlmTool[];
  systemPrompt?: string;
  temperature?: number; // Default 0.7
  maxTokens?: number; // Default 200 (short for voice)
}

export interface LlmSession {
  // Collect full response text (waits for completion)
  getText(): Promise<string>;

  // Get tool calls (if any) from the response
  getToolCalls(): Promise<LlmToolCall[]>;

  // Stream text chunks for TTS
  stream(): AsyncIterable<string>;

  // Get usage statistics
  getUsage(): { totalTokens: number };
}
