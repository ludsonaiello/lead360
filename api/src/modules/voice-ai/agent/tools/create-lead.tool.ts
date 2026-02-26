import { LeadsService } from '../../../leads/services/leads.service';
import { AgentTool, ToolExecutionContext } from './tool.interface';
import { LlmTool } from '../providers/llm.interface';

/**
 * CreateLeadTool
 *
 * Uses LeadsService to create a new lead after the LLM collects caller information.
 * Delegates all business logic to LeadsService (phone uniqueness check, validation, etc.).
 *
 * CRITICAL:
 *   - Uses LeadsService.create() with exact DTO structure from leads module
 *   - Phone uniqueness and address validation handled by LeadsService
 *   - Returns JSON string (LLM requires string response, not object)
 *   - userId is null (voice AI agent is a system actor)
 */
export class CreateLeadTool implements AgentTool {
  constructor(private readonly leadsService: LeadsService) {}

  definition: LlmTool = {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Create a new lead record after collecting caller information. Only call after confirming name, phone, and address.',
      parameters: {
        type: 'object',
        properties: {
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone_number: { type: 'string', description: 'E.164 format' },
          email: { type: 'string', description: 'Optional' },
          address: { type: 'string', description: 'Street address' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip_code: { type: 'string' },
          service_description: { type: 'string', description: 'What service they need' },
          language: { type: 'string', description: 'Language spoken: en, es, pt' },
        },
        required: ['first_name', 'last_name', 'phone_number', 'address', 'city', 'state', 'zip_code']
      }
    }
  };

  async execute(args: any, context: ToolExecutionContext): Promise<string> {
    try {
      // Build CreateLeadDto matching the exact structure from leads module
      const createLeadDto = {
        first_name: args.first_name,
        last_name: args.last_name,
        source: 'phone_call',
        language_spoken: args.language ? args.language.toUpperCase() : 'EN',
        accept_sms: false,
        preferred_communication: 'phone',
        phones: [{
          phone: args.phone_number,
          phone_type: 'mobile',
          is_primary: true
        }],
        emails: args.email ? [{
          email: args.email,
          email_type: 'personal',
          is_primary: true
        }] : [],
        addresses: [{
          address_line1: args.address,
          city: args.city,
          state: args.state,
          zip_code: args.zip_code,
          country: 'US',
          address_type: 'service',
          is_primary: true
        }],
        service_request: args.service_description ? {
          service_name: 'Voice AI Call',
          service_description: args.service_description,
          urgency: 'medium'
        } : undefined
      };

      // Call LeadsService.create() with tenant_id and null userId (system action)
      const lead = await this.leadsService.create(context.tenant_id, null, createLeadDto as any);

      return JSON.stringify({
        success: true,
        lead_id: lead.id,
        message: `Lead created for ${args.first_name} ${args.last_name}`
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Could not create lead'
      });
    }
  }
}
