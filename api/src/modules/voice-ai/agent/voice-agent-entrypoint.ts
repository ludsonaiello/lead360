/**
 * Voice Agent Entrypoint — Refactored for HTTP API Bridge (VAB-04)
 *
 * This function is called by LiveKit AgentServer for each incoming call.
 * It runs in a SEPARATE CHILD PROCESS - NestJS services are NOT available.
 *
 * All data is fetched via HTTP calls to the Lead360 API.
 *
 * Flow:
 * 1. Connect to LiveKit room
 * 2. Wait for SIP participant
 * 3. Extract SIP attributes (phone numbers, call SID)
 * 4. Look up tenant by phone number (HTTP)
 * 5. Check access/quota (HTTP)
 * 6. Load full context (HTTP)
 * 7. Start call log (HTTP)
 * 8. Run agent session (STT → LLM → TTS)
 * 9. Complete call log (HTTP)
 */

import { JobContext, defineAgent } from '@livekit/agents';
import {
  lookupTenant,
  checkAccess,
  getContext,
  startCallLog,
  completeCallLog,
} from './utils/agent-api';
import { waitForSipParticipant, extractSipAttributes } from './utils/sip-participant';
import { VoiceAiContext } from './utils/api-types';
import { VoiceAgentSession } from './voice-agent.session';
import { AgentTool } from './tools/tool.interface';
import {
  HttpFindLeadTool,
  HttpCreateLeadTool,
  HttpCheckServiceAreaTool,
  HttpTransferCallTool,
} from './tools/http-tools';

/**
 * Log separator for visual clarity in logs
 */
function logSeparator(message: string): void {
  console.log('');
  console.log('='.repeat(100));
  console.log(`  ${message}`);
  console.log('='.repeat(100));
  console.log('');
}

/**
 * Agent entrypoint function
 *
 * Called by @livekit/agents AgentServer for each job.
 * Runs in a child process - no NestJS services available.
 */
async function voiceAgentEntrypoint(ctx: JobContext): Promise<void> {
  const startTime = Date.now();
  let tenantId: string | null = null;
  let callSid: string | null = null;
  let callLogId: string | null = null;

  try {
    logSeparator(`🆕 NEW CALL STARTING - Job ID: ${ctx.job.id}`);

    // Step 1: Connect to LiveKit room
    console.log('[VoiceAgent] Connecting to LiveKit room...');
    await ctx.connect();
    console.log(`[VoiceAgent] Connected to room: ${ctx.room.name}`);

    // Step 2: Wait for SIP participant
    console.log('[VoiceAgent] Waiting for SIP participant...');
    const sipParticipant = await waitForSipParticipant(ctx.room as any);

    if (!sipParticipant) {
      console.error('[VoiceAgent] ❌ No SIP participant joined within timeout');
      logSeparator('❌ CALL FAILED - No SIP participant');
      return;
    }

    // Step 3: Extract SIP attributes
    const sipAttrs = extractSipAttributes(sipParticipant);
    callSid = sipAttrs.callSid;

    console.log(`[VoiceAgent] SIP attributes:`);
    console.log(`  - Call SID: ${sipAttrs.callSid}`);
    console.log(`  - Trunk Phone: ${sipAttrs.trunkPhoneNumber}`);
    console.log(`  - Caller Phone: ${sipAttrs.callerPhoneNumber}`);

    if (!sipAttrs.trunkPhoneNumber) {
      console.error('[VoiceAgent] ❌ Missing trunk phone number in SIP attributes');
      logSeparator('❌ CALL FAILED - Missing trunk phone number');
      return;
    }

    // Step 4: Look up tenant by phone number
    console.log('[VoiceAgent] 🔍 Looking up tenant...');
    const lookupResult = await lookupTenant(sipAttrs.trunkPhoneNumber);

    if (!lookupResult.success || !lookupResult.data?.found) {
      console.error(`[VoiceAgent] ❌ Tenant not found for phone: ${sipAttrs.trunkPhoneNumber}`);
      // TODO: Play "number not configured" message to caller
      logSeparator('❌ CALL FAILED - Tenant not found');
      return;
    }

    tenantId = lookupResult.data.tenant_id!;
    console.log(`[VoiceAgent] ✅ Tenant found: ${lookupResult.data.tenant_name} (${tenantId})`);

    // Step 5: Check access/quota
    console.log('[VoiceAgent] 📊 Checking quota...');
    const accessResult = await checkAccess(tenantId);

    if (!accessResult.success || !accessResult.data?.has_access) {
      const reason = accessResult.data?.reason || 'unknown';
      console.error(`[VoiceAgent] ❌ Access denied: ${reason}`);
      // TODO: Play "service unavailable" message to caller
      logSeparator(`❌ CALL FAILED - Access denied: ${reason}`);
      return;
    }

    console.log(`[VoiceAgent] ✅ Quota OK - ${accessResult.data.minutes_remaining} minutes remaining`);

    // Step 6: Load full context
    console.log('[VoiceAgent] 📋 Loading context...');
    const contextResult = await getContext(tenantId);

    if (!contextResult.success || !contextResult.data) {
      console.error('[VoiceAgent] ❌ Failed to load context');
      logSeparator('❌ CALL FAILED - Context load failed');
      return;
    }

    const context = contextResult.data;
    console.log(`[VoiceAgent] ✅ Context loaded for: ${context.tenant.company_name}`);

    // Step 7: Start call log
    console.log('[VoiceAgent] 📝 Starting call log...');
    const startResult = await startCallLog({
      tenant_id: tenantId,
      call_sid: callSid || `job-${ctx.job.id}`,
      from_number: sipAttrs.callerPhoneNumber || 'unknown',
      to_number: sipAttrs.trunkPhoneNumber,
      room_name: ctx.room.name,
      direction: 'inbound',
    });

    if (startResult.success && startResult.data) {
      callLogId = startResult.data.call_log_id;
      console.log(`[VoiceAgent] ✅ Call log started: ${callLogId}`);
    } else {
      console.warn('[VoiceAgent] ⚠️  Failed to start call log, continuing anyway');
    }

    // Step 8: Run agent session
    console.log('[VoiceAgent] 🚀 Starting conversation pipeline...');
    await runAgentSession(ctx, context, sipAttrs);

    // Step 9: Complete call log
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    logSeparator(`✅ CALL COMPLETED - Duration: ${durationSeconds}s`);

    if (callLogId && callSid) {
      await completeCallLog(callSid, {
        status: 'completed',
        duration_seconds: durationSeconds,
        outcome: 'abandoned', // Default to abandoned - will be updated when lead creation/transfer is implemented
        // transcript_summary: will be added when transcription is implemented
        // full_transcript: will be added when transcription is implemented
      });
      console.log('[VoiceAgent] ✅ Call log completed');
    }

  } catch (error: any) {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    console.error(`[VoiceAgent] ❌ Error: ${error.message}`, error.stack);
    logSeparator(`❌ CALL FAILED - Duration: ${durationSeconds}s`);

    // Try to complete call log with error
    if (callSid) {
      try {
        await completeCallLog(callSid, {
          status: 'failed',
          duration_seconds: durationSeconds,
          outcome: 'abandoned',
          error_message: error.message,
        });
      } catch (e) {
        console.error('[VoiceAgent] Failed to complete call log on error');
      }
    }
  }
}

/**
 * Run the actual agent session (STT → LLM → TTS)
 *
 * Integrates VoiceAgentSession class to handle full conversation pipeline.
 * Tools are created with HTTP API client for isolated process architecture.
 */
async function runAgentSession(
  ctx: JobContext,
  context: VoiceAiContext,
  sipAttrs: { callSid: string | null; callerPhoneNumber: string | null }
): Promise<void> {
  console.log(`[VoiceAgent] Greeting: ${context.behavior.greeting}`);
  console.log(`[VoiceAgent] Services: ${context.services.map(s => s.name).join(', ')}`);
  console.log(`[VoiceAgent] Service areas: ${context.service_areas.length} configured`);

  // Load LiveKit configuration for transfer functionality
  const livekitUrl = process.env.LIVEKIT_WS_URL || '';
  const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    console.warn('[VoiceAgent] ⚠️  LiveKit credentials incomplete - call transfer will not work');
  }

  const livekitConfig = {
    url: livekitUrl,
    apiKey: livekitApiKey,
    apiSecret: livekitApiSecret,
  };

  // Create HTTP-based tool instances for VAB architecture
  // These tools use HTTP API calls instead of direct NestJS service access (process isolation)
  const tools: AgentTool[] = [
    new HttpFindLeadTool(),
    new HttpCreateLeadTool(),
    new HttpCheckServiceAreaTool(),
    new HttpTransferCallTool(),
  ];

  console.log('[VoiceAgent] 🚀 Starting VoiceAgentSession with full STT→LLM→TTS pipeline...');

  // Create and start VoiceAgentSession
  // Note: Minor type difference between api-types.VoiceAiContext and interface.VoiceAiContext
  // (email field nullability), but runtime data structure is compatible
  const session = new VoiceAgentSession(
    context as any,
    tools,
    ctx.room as any,
    livekitConfig,
    undefined, // voiceLogger - optional for now
  );

  try {
    await session.start();
    console.log('[VoiceAgent] ✅ VoiceAgentSession completed successfully');
  } catch (error: any) {
    console.error(`[VoiceAgent] ❌ VoiceAgentSession error: ${error.message}`, error.stack);
    throw error;
  }
}

// Export as Agent object for LiveKit
export default defineAgent({
  entry: voiceAgentEntrypoint,
});
