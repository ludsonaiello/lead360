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
      description: 'Find an existing lead by their phone number. Call to check if the caller is already in the system.',
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
      description: 'Create a new lead record. Only call after confirming name, phone, and address.',
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
];
