/**
 * Tool Executor — Sprint VAB-05
 *
 * Executes tool calls requested by the LLM.
 * Each tool is executed via HTTP to the Lead360 API.
 */

import {
  toolCreateLead,
  toolFindLead,
  toolCheckServiceArea,
  toolTransferCall,
} from '../utils/agent-api';

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  name: string;
  result: string;  // JSON string for LLM
}

/**
 * Execute a tool call and return the result
 *
 * @param tenantId Tenant UUID
 * @param toolCall Tool call from LLM
 * @returns Tool result as JSON string for LLM
 */
export async function executeTool(
  tenantId: string,
  toolCall: ToolCall
): Promise<ToolResult> {
  console.log(`[Tool Executor] Executing tool: ${toolCall.name}`);
  console.log(`[Tool Executor] Arguments:`, JSON.stringify(toolCall.arguments));

  let resultData: any;

  try {
    switch (toolCall.name) {
      case 'check_service_area': {
        const response = await toolCheckServiceArea(tenantId, {
          zip_code: toolCall.arguments.zip_code,
          city: toolCall.arguments.city,
          state: toolCall.arguments.state,
        });
        resultData = response.success ? response.data : { error: response.error };
        break;
      }

      case 'find_lead': {
        const response = await toolFindLead(tenantId, toolCall.arguments.phone_number);
        resultData = response.success ? response.data : { error: response.error };
        break;
      }

      case 'create_lead': {
        const response = await toolCreateLead(tenantId, toolCall.arguments as any);
        resultData = response.success ? response.data : { error: response.error };
        break;
      }

      case 'transfer_call': {
        const response = await toolTransferCall(
          tenantId,
          toolCall.arguments.reason,
          toolCall.arguments.destination
        );
        resultData = response.success ? response.data : { error: response.error };
        break;
      }

      default:
        resultData = { error: `Unknown tool: ${toolCall.name}` };
    }
  } catch (error: any) {
    console.error(`[Tool Executor] Error executing ${toolCall.name}:`, error.message);
    resultData = { error: error.message };
  }

  const result = JSON.stringify(resultData);
  console.log(`[Tool Executor] Result for ${toolCall.name}:`, result);

  return {
    name: toolCall.name,
    result,
  };
}
