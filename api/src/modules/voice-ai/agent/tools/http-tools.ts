/**
 * HTTP-based Tool Wrappers — VAB Architecture
 *
 * These tools implement the AgentTool interface but use HTTP API calls
 * instead of direct NestJS service access (for process isolation).
 *
 * CRITICAL: Tool definitions are imported from tool-definitions.ts to ensure
 * consistency between what the LLM sees and what gets executed.
 *
 * Tool definitions are looked up by name (not index) for robustness.
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
  toolBookAppointment,
  toolRescheduleAppointment,
  toolCancelAppointment,
} from '../utils/agent-api';

/**
 * Helper: look up a tool definition by name instead of brittle array index.
 */
function getToolDef(name: string): LlmTool {
  const def = AGENT_TOOLS.find((t) => t.function.name === name);
  if (!def) {
    throw new Error(`Tool definition not found: ${name}`);
  }
  return def as LlmTool;
}

/**
 * FindLeadTool - HTTP-based wrapper
 */
export class HttpFindLeadTool implements AgentTool {
  definition: LlmTool = getToolDef('find_lead');

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
 */
export class HttpCreateLeadTool implements AgentTool {
  definition: LlmTool = getToolDef('create_lead');

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
 */
export class HttpCheckServiceAreaTool implements AgentTool {
  definition: LlmTool = getToolDef('check_service_area');

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
 */
export class HttpTransferCallTool implements AgentTool {
  definition: LlmTool = getToolDef('transfer_call');

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
 * This tool allows the LLM to end the call when conversation is complete.
 * It does NOT make HTTP calls (local execution only).
 * The actual session termination is handled in VoiceAgentSession.
 */
export class HttpEndCallTool implements AgentTool {
  definition: LlmTool = getToolDef('end_call');

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

// =============================================================================
// Appointment Tools — Sprint 18/19
// =============================================================================

/**
 * BookAppointmentTool - HTTP-based wrapper
 *
 * Two modes:
 * 1. SEARCH MODE: Only lead_id → returns available slots
 * 2. CONFIRM MODE: lead_id + confirmed_date + confirmed_start_time → books appointment
 */
export class HttpBookAppointmentTool implements AgentTool {
  definition: LlmTool = getToolDef('book_appointment');

  async execute(
    args: {
      lead_id: string;
      preferred_date?: string;
      confirmed_date?: string;
      confirmed_start_time?: string;
      notes?: string;
    },
    context: ToolExecutionContext,
  ): Promise<string> {
    console.log(
      `[HttpBookAppointmentTool] Booking for lead: ${args.lead_id}`,
    );

    const response = await toolBookAppointment(context.tenant_id, args);

    if (!response.success) {
      return JSON.stringify({ error: response.error });
    }

    return JSON.stringify(response.data);
  }
}

/**
 * RescheduleAppointmentTool - HTTP-based wrapper
 *
 * Two modes:
 * 1. LOOKUP MODE: call_log_id + lead_id → returns current appointment + available slots
 * 2. CONFIRM MODE: + appointment_id + new_date + new_time → reschedules
 */
export class HttpRescheduleAppointmentTool implements AgentTool {
  definition: LlmTool = getToolDef('reschedule_appointment');

  async execute(
    args: {
      call_log_id: string;
      lead_id: string;
      appointment_id?: string;
      new_date?: string;
      new_time?: string;
      reason?: string;
    },
    context: ToolExecutionContext,
  ): Promise<string> {
    // Always use call_log_id from context — the LLM doesn't know the real value
    const resolvedCallLogId = context.call_log_id || args.call_log_id || '';
    console.log(
      `[HttpRescheduleAppointmentTool] Rescheduling for lead: ${args.lead_id}, call_log_id: ${resolvedCallLogId} (context: ${context.call_log_id}, args: ${args.call_log_id})`,
    );

    const data = {
      ...args,
      call_log_id: resolvedCallLogId,
    };

    const response = await toolRescheduleAppointment(context.tenant_id, data);

    if (!response.success) {
      return JSON.stringify({ error: response.error });
    }

    return JSON.stringify(response.data);
  }
}

/**
 * CancelAppointmentTool - HTTP-based wrapper
 *
 * Two modes:
 * 1. LOOKUP MODE: call_log_id + lead_id → returns active appointments
 * 2. CONFIRM MODE: + appointment_id → cancels the appointment
 */
export class HttpCancelAppointmentTool implements AgentTool {
  definition: LlmTool = getToolDef('cancel_appointment');

  async execute(
    args: {
      call_log_id: string;
      lead_id: string;
      appointment_id?: string;
      reason?: string;
    },
    context: ToolExecutionContext,
  ): Promise<string> {
    // Always use call_log_id from context — the LLM doesn't know the real value
    const resolvedCallLogId = context.call_log_id || args.call_log_id || '';
    console.log(
      `[HttpCancelAppointmentTool] Cancelling for lead: ${args.lead_id}, call_log_id: ${resolvedCallLogId} (context: ${context.call_log_id}, args: ${args.call_log_id})`,
    );

    const data = {
      ...args,
      call_log_id: resolvedCallLogId,
    };

    const response = await toolCancelAppointment(context.tenant_id, data);

    if (!response.success) {
      return JSON.stringify({ error: response.error });
    }

    return JSON.stringify(response.data);
  }
}
