/**
 * HTTP-based Tool Wrappers — VAB Architecture
 *
 * These tools implement the AgentTool interface but use HTTP API calls
 * instead of direct NestJS service access (for process isolation).
 *
 * CRITICAL: Tool definitions are imported from tool-definitions.ts to ensure
 * consistency between what the LLM sees and what gets executed.
 *
 * Used by VoiceAgentSession in the isolated agent process.
 */

import { AgentTool, ToolExecutionContext } from './tool.interface';
import { LlmTool } from '../providers/llm.interface';
import { AGENT_TOOLS } from './tool-definitions';
import {
  toolCreateLead,
  toolFindLead,
  toolCheckServiceArea,
  toolTransferCall,
} from '../utils/agent-api';

/**
 * FindLeadTool - HTTP-based wrapper
 *
 * Uses canonical definition from AGENT_TOOLS[1] (find_lead)
 */
export class HttpFindLeadTool implements AgentTool {
  definition: LlmTool = AGENT_TOOLS[1] as LlmTool;

  async execute(
    args: { phone_number: string },
    context: ToolExecutionContext,
  ): Promise<string> {
    console.log(`[HttpFindLeadTool] Looking up lead for: ${args.phone_number}`);

    const response = await toolFindLead(context.tenant_id, args.phone_number);

    if (!response.success) {
      return JSON.stringify({ error: response.error });
    }

    return JSON.stringify(response.data);
  }
}

/**
 * CreateLeadTool - HTTP-based wrapper
 *
 * Uses canonical definition from AGENT_TOOLS[2] (create_lead)
 */
export class HttpCreateLeadTool implements AgentTool {
  definition: LlmTool = AGENT_TOOLS[2] as LlmTool;

  async execute(args: any, context: ToolExecutionContext): Promise<string> {
    console.log(
      `[HttpCreateLeadTool] Creating lead for: ${args.first_name} ${args.last_name}`,
    );

    const response = await toolCreateLead(context.tenant_id, args);

    if (!response.success) {
      return JSON.stringify({ error: response.error });
    }

    return JSON.stringify(response.data);
  }
}

/**
 * CheckServiceAreaTool - HTTP-based wrapper
 *
 * Uses canonical definition from AGENT_TOOLS[0] (check_service_area)
 */
export class HttpCheckServiceAreaTool implements AgentTool {
  definition: LlmTool = AGENT_TOOLS[0] as LlmTool;

  async execute(
    args: { zip_code: string; city?: string; state?: string },
    context: ToolExecutionContext,
  ): Promise<string> {
    console.log(
      `[HttpCheckServiceAreaTool] Checking service area for ZIP: ${args.zip_code}`,
    );

    const response = await toolCheckServiceArea(context.tenant_id, args);

    if (!response.success) {
      return JSON.stringify({ error: response.error });
    }

    return JSON.stringify(response.data);
  }
}

/**
 * TransferCallTool - HTTP-based wrapper
 *
 * Uses canonical definition from AGENT_TOOLS[3] (transfer_call)
 */
export class HttpTransferCallTool implements AgentTool {
  definition: LlmTool = AGENT_TOOLS[3] as LlmTool;

  async execute(
    args: { reason: string; destination?: string },
    context: ToolExecutionContext,
  ): Promise<string> {
    console.log(
      `[HttpTransferCallTool] Transferring call - Reason: ${args.reason}`,
    );

    const response = await toolTransferCall(
      context.tenant_id,
      args.reason,
      args.destination,
    );

    if (!response.success) {
      return JSON.stringify({ error: response.error });
    }

    return JSON.stringify(response.data);
  }
}

/**
 * EndCallTool - HTTP-based wrapper
 *
 * Uses canonical definition from AGENT_TOOLS[4] (end_call)
 *
 * This tool allows the LLM to end the call when conversation is complete.
 * It does NOT make HTTP calls (local execution only).
 * The actual session termination is handled in VoiceAgentSession.
 */
export class HttpEndCallTool implements AgentTool {
  definition: LlmTool = AGENT_TOOLS[4] as LlmTool;

  async execute(
    args: { reason: string; notes?: string },
    context: ToolExecutionContext,
  ): Promise<string> {
    console.log(
      `[HttpEndCallTool] End call requested - Reason: ${args.reason}`,
    );
    if (args.notes) {
      console.log(`[HttpEndCallTool] Notes: ${args.notes}`);
    }

    // Return success response
    // The actual session stop will be handled by VoiceAgentSession when it detects this tool call
    return JSON.stringify({
      success: true,
      message: 'Call will end after this response',
      reason: args.reason,
      notes: args.notes || null,
    });
  }
}
