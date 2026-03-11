import { LlmTool } from '../providers/llm.interface';

export interface AgentTool {
  // OpenAI function definition (sent to LLM with each request)
  definition: LlmTool;

  // Execute the tool when LLM calls it
  execute(
    args: Record<string, any>,
    context: ToolExecutionContext,
  ): Promise<string>;
}

export interface ToolExecutionContext {
  tenant_id: string;
  call_sid: string;
  caller_phone: string; // The caller's phone number (from_number in voice_call_log)
  call_log_id?: string; // UUID of voice_call_log — needed by reschedule/cancel for identity verification
}
