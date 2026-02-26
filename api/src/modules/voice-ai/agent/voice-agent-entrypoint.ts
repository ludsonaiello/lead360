/**
 * Voice Agent Entrypoint — Sprint BAS24
 *
 * This file serves as the entrypoint for @livekit/agents AgentServer.
 * The AgentServer requires a file path with a default export function.
 *
 * Architecture:
 *   1. AgentServer loads this file dynamically
 *   2. Calls the default export function with JobContext
 *   3. This function creates VoiceAgentSession and handles the conversation
 *
 * NOTE: This file is loaded outside the NestJS dependency injection context.
 * It receives services via a global registry set by VoiceAgentService.
 */

import type { JobContext } from '@livekit/agents';
import { VoiceAgentSession } from './voice-agent.session';
import { AgentTool } from './tools/tool.interface';

/**
 * Global registry for NestJS services.
 * Set by VoiceAgentService.startWorker() before starting the AgentServer.
 */
export let agentServiceRegistry: {
  contextBuilder: any;
  callLogService: any;
  usageService: any;
  buildTools: () => AgentTool[];
} | null = null;

export function setAgentServiceRegistry(registry: typeof agentServiceRegistry): void {
  agentServiceRegistry = registry;
}

/**
 * Agent entrypoint function.
 *
 * This is called by @livekit/agents AgentServer for each job.
 * It connects to the room, builds context, and starts the conversation.
 *
 * @param ctx JobContext provided by @livekit/agents
 */
export default async function voiceAgentEntrypoint(ctx: JobContext): Promise<void> {
  const logger = console; // Use console for logging (NestJS logger not available here)

  try {
    logger.log(`[VoiceAgent] Job started: ${ctx.job.id}`);

    if (!agentServiceRegistry) {
      throw new Error('Agent service registry not initialized');
    }

    // Connect to the room
    await ctx.connect();
    logger.log(`[VoiceAgent] Connected to room: ${ctx.room.name}`);

    // Extract tenant_id and call_sid from room metadata
    const { tenantId, callSid } = extractCallParams(ctx);

    if (!tenantId || !callSid) {
      logger.error('[VoiceAgent] Missing tenant_id or call_sid in room metadata');
      ctx.shutdown('missing_params');
      return;
    }

    logger.log(`[VoiceAgent] Processing call for tenant: ${tenantId}, call_sid: ${callSid}`);

    // Build context
    const context = await agentServiceRegistry.contextBuilder.buildContext(tenantId, callSid);

    // Build tools
    const tools = agentServiceRegistry.buildTools();

    // Create session
    const session = new VoiceAgentSession(context, tools, ctx.room);

    // Add shutdown callback to complete call log
    ctx.addShutdownCallback(async () => {
      logger.log(`[VoiceAgent] Call ending: ${callSid}`);

      // Get conversation history
      const history = session.getConversationHistory();
      const transcript = history
        .filter(msg => msg.role === 'user' || msg.role === 'assistant')
        .map(msg => `${msg.role}: ${msg.content}`)
        .join('\n');

      // Complete call log
      await agentServiceRegistry!.callLogService.completeCall({
        callSid,
        status: 'completed',
        outcome: 'completed',
        fullTranscript: transcript,
      });

      logger.log(`[VoiceAgent] Call log completed: ${callSid}`);
    });

    // Start the conversation
    await session.start();

  } catch (error: any) {
    logger.error(`[VoiceAgent] Error: ${error.message}`, error.stack);
    ctx.shutdown('error');
  }
}

/**
 * Extract tenant_id and call_sid from JobContext.
 */
function extractCallParams(ctx: JobContext): { tenantId: string; callSid: string } {
  // Try room metadata
  try {
    if (ctx.room.metadata) {
      const metadata = JSON.parse(ctx.room.metadata);
      if (metadata.tenant_id && metadata.call_sid) {
        return { tenantId: metadata.tenant_id, callSid: metadata.call_sid };
      }
    }
  } catch (e) {
    // Not valid JSON
  }

  // Try room name pattern
  const match = ctx.room.name?.match(/tenant_([^_]+)_call_(.+)/);
  if (match) {
    return { tenantId: match[1], callSid: match[2] };
  }

  return { tenantId: '', callSid: '' };
}
