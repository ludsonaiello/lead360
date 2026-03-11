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
  getCallMetadata,
  getParentCallSid,
  startCallLog,
  completeCallLog,
  findLeadByPhone,
} from './utils/agent-api';
import {
  waitForSipParticipant,
  extractSipAttributes,
} from './utils/sip-participant';
import { VoiceAiContext } from './utils/api-types';
import { VoiceAgentSession } from './voice-agent.session';
import { AgentTool } from './tools/tool.interface';
import {
  HttpFindLeadTool,
  HttpCreateLeadTool,
  HttpCheckServiceAreaTool,
  HttpTransferCallTool,
  HttpEndCallTool,
  HttpBookAppointmentTool,
  HttpRescheduleAppointmentTool,
  HttpCancelAppointmentTool,
} from './tools/http-tools';
import { createVoiceAILogger } from '../utils/voice-ai-logger.util';

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
    console.log(
      `  - Agent Profile ID: ${sipAttrs.agentProfileId || 'none (will use default)'}`,
    );

    if (!sipAttrs.trunkPhoneNumber) {
      console.error(
        '[VoiceAgent] ❌ Missing trunk phone number in SIP attributes',
      );
      logSeparator('❌ CALL FAILED - Missing trunk phone number');
      return;
    }

    if (!callSid) {
      console.error('[VoiceAgent] ❌ Missing call SID in SIP attributes');
      logSeparator('❌ CALL FAILED - Missing call SID');
      return;
    }

    // Step 3.5: Resolve parent call SID (child → parent mapping)
    // When Twilio uses <Dial><Sip>, it creates two call SIDs:
    // - Child DialCallSid (what we have): SIP outbound leg to LiveKit
    // - Parent CallSid (what we need): Original inbound call with metadata
    console.log('[VoiceAgent] 📋 Resolving parent call SID from Redis mapping...');
    const parentCallSidResult = await getParentCallSid(callSid);
    let parentCallSid = callSid; // Default to child if no mapping found

    if (parentCallSidResult.success && parentCallSidResult.data?.found) {
      parentCallSid = parentCallSidResult.data.parent_call_sid || callSid;
      console.log(
        `[VoiceAgent] ✅ Parent call SID resolved: ${callSid} → ${parentCallSid}`,
      );
    } else {
      console.log(
        `[VoiceAgent] ℹ️  No parent mapping found, using call SID as-is: ${callSid}`,
      );
    }

    // Step 3.6: Retrieve call metadata from Redis (using parent call SID)
    // Metadata is stored by IVR using the parent CallSid, so we must use it
    console.log(
      `[VoiceAgent] 📋 Retrieving call metadata from Redis (parent SID: ${parentCallSid})...`,
    );
    const metadataResult = await getCallMetadata(parentCallSid);
    let agentProfileId: string | null = null;

    if (metadataResult.success && metadataResult.data?.found) {
      agentProfileId = metadataResult.data.agent_profile_id || null;
      console.log(
        `[VoiceAgent] ✅ Agent Profile ID from Redis metadata: ${agentProfileId}`,
      );
    } else {
      console.log(
        '[VoiceAgent] ℹ️  No metadata found in Redis, will use default profile',
      );
    }

    // Step 4: Look up tenant by phone number
    console.log('[VoiceAgent] 🔍 Looking up tenant...');
    const lookupResult = await lookupTenant(sipAttrs.trunkPhoneNumber);

    if (!lookupResult.success || !lookupResult.data?.found) {
      console.error(
        `[VoiceAgent] ❌ Tenant not found for phone: ${sipAttrs.trunkPhoneNumber}`,
      );
      // TODO: Play "number not configured" message to caller
      logSeparator('❌ CALL FAILED - Tenant not found');
      return;
    }

    tenantId = lookupResult.data.tenant_id!;
    console.log(
      `[VoiceAgent] ✅ Tenant found: ${lookupResult.data.tenant_name} (${tenantId})`,
    );

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

    console.log(
      `[VoiceAgent] ✅ Quota OK - ${accessResult.data.minutes_remaining} minutes remaining`,
    );

    // Step 6: Load full context
    console.log('[VoiceAgent] 📋 Loading context...');
    const contextResult = await getContext(tenantId, agentProfileId);

    if (!contextResult.success || !contextResult.data) {
      console.error('[VoiceAgent] ❌ Failed to load context');
      logSeparator('❌ CALL FAILED - Context load failed');
      return;
    }

    const context = contextResult.data;
    console.log(
      `[VoiceAgent] ✅ Context loaded for: ${context.tenant.company_name}`,
    );

    // Log active agent profile information (Sprint 7: Multi-lingual support)
    if (context.active_agent_profile) {
      console.log(
        `[VoiceAgent] 🌍 Active Agent Profile: ${context.active_agent_profile.title} (${context.active_agent_profile.language_code})`,
      );
      console.log(
        `[VoiceAgent]   - Profile ID: ${context.active_agent_profile.id}`,
      );
      console.log(
        `[VoiceAgent]   - Is Override: ${context.active_agent_profile.is_override ? 'Yes' : 'No'}`,
      );
    } else {
      console.log(
        '[VoiceAgent] 🌍 Using default language settings (no profile specified)',
      );
    }

    // Step 6.5: Look up lead by phone number (Sprint 4: agent_sprint_fixes_feb27_4)
    console.log('[VoiceAgent] 🔍 Looking up lead by phone...');
    const leadResult = await findLeadByPhone(
      tenantId,
      sipAttrs.callerPhoneNumber || '',
    );

    let leadContext: any = null;
    if (leadResult.success && leadResult.data?.found) {
      leadContext = leadResult.data.lead;
      console.log(
        `[VoiceAgent] ✅ Known caller detected: ${leadContext.full_name}`,
      );
      console.log(`[VoiceAgent]   - Status: ${leadContext.status}`);
      console.log(
        `[VoiceAgent]   - Total contacts: ${leadContext.total_contacts}`,
      );
      console.log(
        `[VoiceAgent]   - Last contact: ${leadContext.last_contact_date ? new Date(leadContext.last_contact_date).toLocaleDateString() : 'First time caller'}`,
      );

      // Add lead to context
      context.lead = leadContext;
    } else {
      console.log('[VoiceAgent] ℹ️  New caller (no existing lead found)');
      context.lead = null;
    }

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
      console.warn(
        '[VoiceAgent] ⚠️  Failed to start call log, continuing anyway',
      );
    }

    // Step 8: Run agent session
    console.log('[VoiceAgent] 🚀 Starting conversation pipeline...');
    const session = await runAgentSession(ctx, context, sipAttrs, callLogId);

    // Step 9: Complete call log (SUCCESS PATH)
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    logSeparator(`✅ CALL COMPLETED - Duration: ${durationSeconds}s`);

    if (callSid) {
      console.log(
        `[VoiceAgent] 📝 Attempting to complete call log for call_sid: ${callSid}`,
      );

      // Collect usage records from the session
      const usageRecords = session.getUsageRecords();
      console.log(
        `[VoiceAgent] 📊 Collected usage records: ${usageRecords.length} providers`,
      );
      usageRecords.forEach((record) => {
        console.log(
          `  - ${record.provider_type}: ${record.usage_quantity} ${record.usage_unit}`,
        );
      });

      try {
        const leadId = session.getLeadId();
        if (leadId) {
          console.log(`[VoiceAgent] 🔗 Linking call log to lead: ${leadId}`);
        }

        await completeCallLog(callSid, {
          status: 'completed',
          duration_seconds: durationSeconds,
          outcome: session.getCallOutcome() || 'abandoned',
          lead_id: leadId || undefined,
          usage_records: usageRecords,
        });
        console.log(
          '[VoiceAgent] ✅ Call log completion request sent successfully',
        );
      } catch (e: any) {
        // Log error but don't throw - call should be considered ended
        console.error(
          `[VoiceAgent] ⚠️  Call log completion failed but call still ended: ${e.message}`,
        );
      }
    } else {
      console.warn(
        '[VoiceAgent] ⚠️  Cannot complete call log - callSid is null',
      );
    }
  } catch (error: any) {
    const durationSeconds = Math.round((Date.now() - startTime) / 1000);
    console.error(
      `[VoiceAgent] ❌ Error during call: ${error.message}`,
      error.stack,
    );
    logSeparator(`❌ CALL FAILED - Duration: ${durationSeconds}s`);

    // ALWAYS try to complete call log with error status (FAILURE PATH)
    if (callSid) {
      console.log(
        `[VoiceAgent] 📝 Attempting to complete call log as 'failed' for call_sid: ${callSid}`,
      );
      try {
        await completeCallLog(callSid, {
          status: 'failed',
          duration_seconds: durationSeconds,
          outcome: 'abandoned',
          error_message: error.message,
        });
        console.log('[VoiceAgent] ✅ Call log marked as failed successfully');
      } catch (e: any) {
        // Log detailed error but don't throw - we've already logged the original error
        console.error(
          `[VoiceAgent] ❌ Failed to mark call log as failed for call_sid: ${callSid}`,
        );
        console.error(`[VoiceAgent]   - Reason: ${e.message}`);
        console.error(
          '[VoiceAgent]   - This call may remain stuck in "in_progress" status',
        );
      }
    } else {
      console.warn(
        '[VoiceAgent] ⚠️  Cannot complete call log - callSid is null (call will remain orphaned)',
      );
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
  sipAttrs: { callSid: string | null; callerPhoneNumber: string | null },
  callLogId?: string | null,
): Promise<VoiceAgentSession> {
  console.log(`[VoiceAgent] Greeting: ${context.behavior.greeting}`);
  console.log(
    `[VoiceAgent] Services: ${context.services.map((s) => s.name).join(', ')}`,
  );
  console.log(
    `[VoiceAgent] Service areas: ${context.service_areas.length} configured`,
  );

  // Load LiveKit configuration for transfer functionality
  const livekitUrl = process.env.LIVEKIT_WS_URL || '';
  const livekitApiKey = process.env.LIVEKIT_API_KEY || '';
  const livekitApiSecret = process.env.LIVEKIT_API_SECRET || '';

  if (!livekitUrl || !livekitApiKey || !livekitApiSecret) {
    console.warn(
      '[VoiceAgent] ⚠️  LiveKit credentials incomplete - call transfer will not work',
    );
  }

  const livekitConfig = {
    url: livekitUrl,
    apiKey: livekitApiKey,
    apiSecret: livekitApiSecret,
  };

  // Create HTTP-based tool instances for VAB architecture
  // Tools are conditionally registered based on tenant feature flags
  const tools: AgentTool[] = [
    new HttpFindLeadTool(),        // Always available
    new HttpCheckServiceAreaTool(), // Always available
    new HttpEndCallTool(),          // Always available
  ];

  if (context.behavior.lead_creation_enabled) {
    tools.push(new HttpCreateLeadTool());
  }
  if (context.behavior.transfer_enabled) {
    tools.push(new HttpTransferCallTool());
  }
  if (context.behavior.booking_enabled) {
    tools.push(new HttpBookAppointmentTool());
    tools.push(new HttpRescheduleAppointmentTool());
    tools.push(new HttpCancelAppointmentTool());
  }

  console.log(
    `[VoiceAgent] 🔧 Registered ${tools.length} tools: ${tools.map((t) => t.definition.function.name).join(', ')}`,
  );

  console.log(
    '[VoiceAgent] 🚀 Starting VoiceAgentSession with full STT→LLM→TTS pipeline...',
  );

  // Create VoiceAILogger for structured logging to voice-ai-calls.log
  const voiceLogger = createVoiceAILogger(
    context.tenant.id,
    sipAttrs.callSid || undefined,
  );

  // Create and start VoiceAgentSession
  // Note: Minor type difference between api-types.VoiceAiContext and interface.VoiceAiContext
  // (email field nullability), but runtime data structure is compatible
  const session = new VoiceAgentSession(
    context as any,
    tools,
    ctx.room as any,
    livekitConfig,
    voiceLogger, // ✅ Now passing VoiceAILogger for full structured logging
    callLogId || undefined,
  );

  try {
    await session.start();
    console.log('[VoiceAgent] ✅ VoiceAgentSession completed successfully');
  } catch (error: any) {
    console.error(
      `[VoiceAgent] ❌ VoiceAgentSession error: ${error.message}`,
      error.stack,
    );
    throw error;
  }

  return session;
}

// Export as Agent object for LiveKit
export default defineAgent({
  entry: voiceAgentEntrypoint,
});
