/**
 * Tool Instructions Builder — Voice AI Agent
 *
 * Generates structured prompt instructions that tell the LLM WHEN, HOW, and in
 * what ORDER to use available tools. Injected into the system prompt alongside
 * business context so the agent can make informed decisions.
 *
 * Sections:
 *   A) General rules (always included)
 *   B) Per-tool rules (only for enabled tools)
 *   C) Workflow templates
 *   D) Business context (services, hours, areas, transfer numbers)
 *   E) Override support (admin-configurable per-tool instructions)
 */

import { VoiceAiContext } from '../../interfaces/voice-ai-context.interface';

// ---------------------------------------------------------------------------
// Default per-tool instructions
// ---------------------------------------------------------------------------

const DEFAULT_TOOL_INSTRUCTIONS: Record<string, string> = {
  find_lead: `- Call IMMEDIATELY at the start of every conversation using the caller's phone number.
- Do NOT say "let me look that up" first — just call the tool directly. The system handles wait messaging.
- If a lead is found, greet them by name and skip information collection.
- If no lead found, proceed to collect their information.
- Do NOT ask for the phone number — use the caller's phone from the call context.`,

  check_service_area: `- Call BEFORE creating a new lead to verify coverage.
- Ask the caller for their ZIP code, then call this tool IMMEDIATELY — do not announce it first.
- If the area is NOT covered, politely inform the caller and do NOT create a lead.
- If covered, proceed with lead creation.`,

  create_lead: `- Only call AFTER find_lead returns no match AND check_service_area confirms coverage.
- Collect ALL required fields before calling: first name, last name, phone, address, city, state, ZIP code.
- Read back the information to the caller and ask them to confirm before submitting.
- If the response indicates lead_exists=true, treat it as a found lead (do not re-create).`,

  book_appointment: `- Only call AFTER a lead exists (found or just created).
- First call with lead_id only (or with preferred_date) to get available time slots.
- IMPORTANT: When presenting dates and times, use the day_name and start_time_display fields directly.
  - Say only 2-3 options at a time (e.g., "I have Tuesday at 9 AM, Wednesday at 2 PM, or Thursday at 10 AM").
  - Do NOT read the date or start_time fields — only use day_name and start_time_display.
- Once the caller selects a slot, call again with lead_id + confirmed_date + confirmed_start_time + notes.
- NOTES ARE REQUIRED when confirming. Include ALL of the following in the notes field:
  - Lead full name
  - Full address (street, city, state, ZIP)
  - Phone number
  - Service requested / description
  - Brief summary of the call conversation
- Confirm the booked appointment details with the caller using natural language.`,

  reschedule_appointment: `- First call with lead_id to get the current appointment and available slots.
- Tell the caller their current appointment using the day_name and time_display fields.
- IMPORTANT: Use day_name and start_time_display fields when presenting slots — do NOT read raw dates or times.
- Present 2-3 new time slot options at a time.
- Once confirmed, call again with appointment_id + new_date + new_time + reason.
- REASON IS REQUIRED: Include the original appointment notes/context plus the caller's reason for rescheduling.
- Confirm the new appointment details with the caller.`,

  cancel_appointment: `- First ask the caller to confirm they want to cancel.
- Call with lead_id to get their active appointments.
- Present appointment details using natural language (day name + 12-hour time).
- If multiple appointments, ask which one to cancel.
- Optionally ask for a cancellation reason.
- Call again with appointment_id to confirm the cancellation.
- Inform the caller the appointment has been cancelled.`,

  transfer_call: `- Only transfer when: the caller explicitly requests a human, the issue is too complex to handle, or the caller is frustrated.
- Always attempt to resolve the issue yourself first.
- Before transferring, tell the caller you're connecting them with someone who can help.
- Provide a brief reason for the transfer.`,

  end_call: `- Only call AFTER saying goodbye to the caller.
- Select the correct reason from the enum that best matches the call outcome.
- Add brief notes summarizing what happened during the call (max 200 chars).
- Do NOT end the call abruptly — always conclude naturally.`,
};

const GENERAL_RULES = `=== TOOL USAGE RULES ===

GENERAL RULES:
- CRITICAL: When you need to call a tool, call it IMMEDIATELY in the same response. Do NOT first say "let me check" or "one moment" as a separate response and then call the tool in the next turn. Either include the tool call alongside your text, or call the tool with no text. The system will automatically play a filler phrase while the tool executes.
- Always confirm information with the caller before calling any tool.
- Handle tool errors gracefully — apologize and try an alternative approach.
- Never call the same tool twice with identical arguments.
- Collect ALL required fields before calling a tool — do not call with missing data.
- When a tool returns an error, explain the issue to the caller in simple terms.
- VOICE FORMAT: When reading dates, times, or numbers from tool results, always convert to natural spoken language. Never read raw ISO dates, 24-hour times, or technical formats. Use day names, 12-hour AM/PM, and conversational phrasing.`;

const WORKFLOW_RULES = `WORKFLOW TEMPLATES:

New caller flow:
  find_lead → (not found) → check_service_area → create_lead → book_appointment → end_call

Returning caller flow:
  find_lead → (found) → ask how to help → book/reschedule/cancel appointment → end_call

Transfer scenario:
  find_lead → attempt to resolve → (unable) → transfer_call

Service area not covered:
  find_lead → (not found) → check_service_area → (not covered) → inform caller → end_call`;

// ---------------------------------------------------------------------------
// Builder function
// ---------------------------------------------------------------------------

/**
 * Build structured tool usage instructions for the LLM system prompt.
 *
 * @param context           Full voice AI context (business info, hours, etc.)
 * @param enabledToolNames  Names of tools registered for this session
 * @param customToolInstructions  Admin-configured per-tool overrides (from global config)
 * @returns Formatted prompt block to append to system prompt
 */
export function buildToolInstructions(
  context: VoiceAiContext,
  enabledToolNames: string[],
  customToolInstructions?: Record<string, string> | null,
): string {
  const sections: string[] = [];

  // A) General rules
  const generalOverride = customToolInstructions?.general_rules;
  sections.push(generalOverride || GENERAL_RULES);

  // B) Per-tool rules (only for enabled tools)
  const toolRulesLines: string[] = ['TOOL-SPECIFIC INSTRUCTIONS:'];
  for (const toolName of enabledToolNames) {
    const customRule = customToolInstructions?.[toolName];
    const defaultRule = DEFAULT_TOOL_INSTRUCTIONS[toolName];
    const rule = customRule || defaultRule;

    if (rule) {
      toolRulesLines.push('');
      toolRulesLines.push(`[${toolName}]`);
      toolRulesLines.push(rule);
    }
  }
  sections.push(toolRulesLines.join('\n'));

  // C) Workflow templates
  const workflowOverride = customToolInstructions?.workflow_rules;
  sections.push(workflowOverride || WORKFLOW_RULES);

  // D) Business context
  sections.push(buildBusinessContext(context));

  return sections.join('\n\n');
}

// ---------------------------------------------------------------------------
// Business context builder
// ---------------------------------------------------------------------------

function buildBusinessContext(context: VoiceAiContext): string {
  const lines: string[] = ['=== BUSINESS CONTEXT ==='];

  // Company info
  lines.push(`Company: ${context.tenant.company_name}`);
  if (context.tenant.business_description) {
    lines.push(`Description: ${context.tenant.business_description}`);
  }
  lines.push(`Timezone: ${context.tenant.timezone}`);

  // Services offered (with IDs for create_lead tool)
  if (context.services.length > 0) {
    lines.push('');
    lines.push('Services offered (use the id when calling create_lead with requested_service_ids):');
    for (const svc of context.services) {
      lines.push(`- id: "${svc.id}" | name: "${svc.name}"${svc.description ? ` | description: ${svc.description}` : ''}`);
    }
  }

  // Service areas
  if (context.service_areas.length > 0) {
    lines.push('');
    lines.push('Service areas:');
    const byType: Record<string, string[]> = {};
    for (const area of context.service_areas) {
      const key = area.type;
      if (!byType[key]) byType[key] = [];
      byType[key].push(area.state ? `${area.value}, ${area.state}` : area.value);
    }
    for (const [type, values] of Object.entries(byType)) {
      lines.push(`- ${type}: ${values.join(', ')}`);
    }
  }

  // Business hours
  if (context.business_hours.length > 0) {
    lines.push('');
    lines.push('Business hours:');
    for (const day of context.business_hours) {
      if (day.is_closed) {
        lines.push(`- ${day.day}: Closed`);
      } else if (day.shifts.length > 0) {
        const shiftStr = day.shifts
          .map((s) => `${s.open} - ${s.close}`)
          .join(', ');
        lines.push(`- ${day.day}: ${shiftStr}`);
      }
    }
  }

  // Transfer numbers
  if (context.transfer_numbers.length > 0) {
    lines.push('');
    lines.push('Transfer destinations:');
    for (const tn of context.transfer_numbers) {
      const defaultTag = tn.is_default ? ' (default)' : '';
      lines.push(`- ${tn.label}: ${tn.phone_number}${defaultTag}`);
    }
  }

  return lines.join('\n');
}
