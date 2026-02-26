import { VoiceTransferNumbersService } from '../../services/voice-transfer-numbers.service';
import { AgentTool, ToolExecutionContext } from './tool.interface';
import { LlmTool } from '../providers/llm.interface';

/**
 * TransferCallTool
 *
 * Signals to the agent pipeline that the call should be transferred to a human.
 * This tool does NOT perform the actual transfer — that's handled by the pipeline (BAS24).
 * It returns the transfer number for the pipeline to use.
 *
 * CRITICAL:
 *   - Uses VoiceTransferNumbersService to get configured transfer numbers
 *   - Returns JSON string with action: 'TRANSFER' to signal the pipeline
 *   - Tenant isolation enforced by VoiceTransferNumbersService
 */
export class TransferCallTool implements AgentTool {
  constructor(private readonly transferNumbersService: VoiceTransferNumbersService) {}

  definition: LlmTool = {
    type: 'function',
    function: {
      name: 'transfer_call',
      description: 'Transfer the call to a human agent. Use when the caller requests to speak with a person.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the call is being transferred' },
          destination: { type: 'string', description: 'Optional: which department (sales, support, etc.)' }
        },
        required: ['reason']
      }
    }
  };

  async execute(args: { reason: string; destination?: string }, context: ToolExecutionContext): Promise<string> {
    try {
      // Get all transfer numbers for this tenant
      const numbers = await this.transferNumbersService.findAll(context.tenant_id);

      // Find default number, or use first available
      const defaultNumber = numbers.find(n => n.is_default) || numbers[0];

      if (!defaultNumber) {
        return JSON.stringify({
          success: false,
          error: 'No transfer number configured'
        });
      }

      return JSON.stringify({
        success: true,
        transfer_to: defaultNumber.phone_number,
        label: defaultNumber.label,
        reason: args.reason,
        destination: args.destination,
        // Signal to pipeline: initiate transfer
        action: 'TRANSFER',
      });
    } catch (error) {
      return JSON.stringify({
        success: false,
        error: error.message || 'Could not retrieve transfer number'
      });
    }
  }
}
