/**
 * Tool definitions for LLM function calling — Sprint VAB-05
 *
 * These are passed to the LLM so it knows what tools are available.
 * When the LLM decides to use a tool, we execute the corresponding HTTP call.
 */

export interface LlmToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description?: string; enum?: string[] }>;
      required: string[];
    };
  };
}

/**
 * AGENT_TOOLS — Tool definitions for the voice agent LLM
 *
 * These tools are registered with the LLM and called when appropriate during conversation.
 * Each tool corresponds to an HTTP endpoint on /api/v1/internal/voice-ai/tenant/:tenantId/tools/
 */
export const AGENT_TOOLS: LlmToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'check_service_area',
      description: 'Check if a location is within the service area. Call before creating a lead to confirm coverage.',
      parameters: {
        type: 'object',
        properties: {
          zip_code: { type: 'string', description: 'ZIP code to check' },
          city: { type: 'string', description: 'City name (optional)' },
          state: { type: 'string', description: 'State abbreviation (optional)' },
        },
        required: ['zip_code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_lead',
      description: 'Find an existing lead by their phone number. Call to check if the caller is already in the system. Returns full lead information including name, email, phone, address, and status if found.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: 'Phone number in E.164 format' },
        },
        required: ['phone_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Create a new lead record. Only call after confirming name, phone, and address. If a lead with this phone number already exists, returns the existing lead information instead of creating a duplicate (check the lead_exists field in response).',
      parameters: {
        type: 'object',
        properties: {
          first_name: { type: 'string', description: 'First name' },
          last_name: { type: 'string', description: 'Last name' },
          phone_number: { type: 'string', description: 'Phone in E.164 format' },
          email: { type: 'string', description: 'Email address (optional)' },
          address: { type: 'string', description: 'Street address' },
          city: { type: 'string', description: 'City' },
          state: { type: 'string', description: 'State abbreviation' },
          zip_code: { type: 'string', description: 'ZIP code' },
          service_description: { type: 'string', description: 'What service they need' },
          language: { type: 'string', description: 'Language: en, es, pt', enum: ['en', 'es', 'pt'] },
        },
        required: ['first_name', 'last_name', 'phone_number', 'address', 'city', 'state', 'zip_code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transfer_call',
      description: 'Transfer the call to a human. Use when caller requests to speak with a person or for complex issues.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the call is being transferred' },
          destination: { type: 'string', description: 'Department (sales, support, etc.) - optional' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'end_call',
      description: 'End the call when the conversation is complete and you have said goodbye to the caller. Use this tool after you\'ve provided all necessary information and concluded the conversation.',
      parameters: {
        type: 'object',
        properties: {
          reason: {
            type: 'string',
            description: 'Why the call is ending',
            enum: ['lead_created', 'transferred', 'not_interested', 'information_provided', 'service_unavailable', 'other']
          },
          notes: {
            type: 'string',
            description: 'Optional brief notes about the call outcome (max 200 chars)'
          },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'book_appointment',
      description: 'Book an appointment for a quote visit. Call after lead is created or found. Use this to schedule a specific date/time for the appointment. If the caller has a preferred date, search availability for that date first. If no availability on preferred date or no preference given, offer next available slots.',
      parameters: {
        type: 'object',
        properties: {
          lead_id: { type: 'string', description: 'Lead ID (from create_lead or find_lead tool)' },
          preferred_date: { type: 'string', description: 'Preferred date in YYYY-MM-DD format (optional)' },
          confirmed_date: { type: 'string', description: 'Confirmed appointment date in YYYY-MM-DD format (when caller selects a slot)' },
          confirmed_start_time: { type: 'string', description: 'Confirmed start time in HH:MM format (when caller selects a slot)' },
          notes: { type: 'string', description: 'Any additional notes about the appointment (optional)' },
        },
        required: ['lead_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'reschedule_appointment',
      description: 'Reschedule an existing appointment to a new date/time. Verifies caller identity before allowing reschedule. Call with lead_id first to get current appointment and available slots, then call again with appointment_id, new_date, and new_time to confirm the reschedule.',
      parameters: {
        type: 'object',
        properties: {
          call_log_id: { type: 'string', description: 'The UUID of the current call log (required for identity verification)' },
          lead_id: { type: 'string', description: 'The UUID of the lead requesting reschedule' },
          appointment_id: { type: 'string', description: 'The UUID of the appointment to reschedule (provide when caller confirms new time)' },
          new_date: { type: 'string', description: 'New date in YYYY-MM-DD format (provide when caller confirms new time)' },
          new_time: { type: 'string', description: 'New start time in HH:MM format (provide when caller confirms new time)' },
        },
        required: ['call_log_id', 'lead_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancel an existing appointment. Verifies caller identity before allowing cancellation. Call with lead_id first to get active appointments, then call again with appointment_id to confirm the cancellation.',
      parameters: {
        type: 'object',
        properties: {
          call_log_id: { type: 'string', description: 'The UUID of the current call log (required for identity verification)' },
          lead_id: { type: 'string', description: 'The UUID of the lead requesting cancellation' },
          appointment_id: { type: 'string', description: 'The UUID of the appointment to cancel (provide when caller confirms cancellation)' },
          reason: { type: 'string', description: 'Reason for cancellation (optional - defaults to customer_cancelled)' },
        },
        required: ['call_log_id', 'lead_id'],
      },
    },
  },
];
