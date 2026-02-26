import { PrismaService } from '../../../../core/database/prisma.service';
import { AgentTool, ToolExecutionContext } from './tool.interface';
import { LlmTool } from '../providers/llm.interface';

/**
 * CheckServiceAreaTool
 *
 * Checks if the caller's address is within the tenant's service area.
 * Queries the tenant_service_area table to verify coverage.
 *
 * CRITICAL:
 *   - Enforces tenant_id filtering
 *   - If no service areas are configured, assumes all areas are covered
 *   - Returns JSON string (LLM requires string response, not object)
 */
export class CheckServiceAreaTool implements AgentTool {
  constructor(private readonly prisma: PrismaService) {}

  definition: LlmTool = {
    type: 'function',
    function: {
      name: 'check_service_area',
      description: 'Check if an address is within the service area. Call before creating a lead to confirm coverage.',
      parameters: {
        type: 'object',
        properties: {
          zip_code: { type: 'string', description: 'ZIP code to check' },
          city: { type: 'string' },
          state: { type: 'string' },
        },
        required: ['zip_code']
      }
    }
  };

  async execute(args: { zip_code: string; city?: string; state?: string }, context: ToolExecutionContext): Promise<string> {
    try {
      // Check if tenant has any service areas configured
      const serviceAreaCount = await this.prisma.tenant_service_area.count({
        where: { tenant_id: context.tenant_id }
      });

      // If no service areas configured, assume all areas are covered
      if (serviceAreaCount === 0) {
        return JSON.stringify({
          covered: true,
          message: 'Service area check not configured — assuming coverage'
        });
      }

      // Check for exact ZIP code match
      const zipMatch = await this.prisma.tenant_service_area.findFirst({
        where: {
          tenant_id: context.tenant_id,
          zipcode: args.zip_code
        }
      });

      if (zipMatch) {
        return JSON.stringify({
          covered: true,
          message: 'ZIP code is in service area'
        });
      }

      // Check for state-level coverage (entire_state = true)
      if (args.state) {
        const stateMatch = await this.prisma.tenant_service_area.findFirst({
          where: {
            tenant_id: context.tenant_id,
            state: args.state,
            entire_state: true
          }
        });

        if (stateMatch) {
          return JSON.stringify({
            covered: true,
            message: `Entire state ${args.state} is in service area`
          });
        }
      }

      // Check for city-level coverage
      if (args.city && args.state) {
        const cityMatch = await this.prisma.tenant_service_area.findFirst({
          where: {
            tenant_id: context.tenant_id,
            city_name: args.city,
            state: args.state,
            type: 'city'
          }
        });

        if (cityMatch) {
          return JSON.stringify({
            covered: true,
            message: `City ${args.city}, ${args.state} is in service area`
          });
        }
      }

      // Not covered
      return JSON.stringify({
        covered: false,
        message: 'This location is outside our service area'
      });

    } catch (error) {
      return JSON.stringify({
        covered: true,
        message: 'Service area check failed — assuming coverage'
      });
    }
  }
}
