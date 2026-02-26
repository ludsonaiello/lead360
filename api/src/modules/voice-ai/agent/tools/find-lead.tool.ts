import { PrismaService } from '../../../../core/database/prisma.service';
import { AgentTool, ToolExecutionContext } from './tool.interface';
import { LlmTool } from '../providers/llm.interface';

/**
 * FindLeadTool
 *
 * Uses PrismaService to look up an existing lead by caller's phone number.
 * Queries the lead_phone table directly (LeadPhonesService has no findByPhone method).
 *
 * CRITICAL:
 *   - Enforces tenant_id filtering via lead relation
 *   - Phone numbers are stored as sanitized digits (10 digits)
 *   - Returns JSON string (LLM requires string response, not object)
 */
export class FindLeadTool implements AgentTool {
  constructor(private readonly prisma: PrismaService) {}

  definition: LlmTool = {
    type: 'function',
    function: {
      name: 'find_lead',
      description: 'Find an existing lead/customer by their phone number. Call this at the start of every conversation.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: 'The caller\'s phone number in E.164 format' }
        },
        required: ['phone_number']
      }
    }
  };

  async execute(args: { phone_number: string }, context: ToolExecutionContext): Promise<string> {
    try {
      // Sanitize phone number to match database format (digits only)
      const sanitizedPhone = args.phone_number.replace(/\D/g, '');

      // Query lead_phone table directly with tenant isolation
      const leadPhone = await this.prisma.lead_phone.findFirst({
        where: {
          phone: { contains: sanitizedPhone },
          lead: { tenant_id: context.tenant_id },  // CRITICAL: Tenant isolation
        },
        include: {
          lead: {
            select: { id: true, first_name: true, last_name: true, status: true }
          }
        }
      });

      if (!leadPhone?.lead) {
        return JSON.stringify({ found: false, message: 'No existing record found' });
      }

      return JSON.stringify({
        found: true,
        lead_id: leadPhone.lead.id,
        name: `${leadPhone.lead.first_name} ${leadPhone.lead.last_name}`,
        status: leadPhone.lead.status,
      });
    } catch (error) {
      return JSON.stringify({ found: false, error: 'Could not search records' });
    }
  }
}
