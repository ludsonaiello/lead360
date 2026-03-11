import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { VoiceAiSettingsService } from './voice-ai-settings.service';
import { VoiceUsageService } from './voice-usage.service';
import { createVoiceAILogger } from '../utils/voice-ai-logger.util';

export interface CanHandleCallResult {
  allowed: boolean;
  reason?: 'disabled' | 'quota_exceeded' | 'plan_not_included';
}

/**
 * VoiceAiSipService — Sprint B08
 *
 * Bridges the IVR system with Voice AI call routing.
 *
 * Responsibilities:
 *   1. canHandleCall()     — pre-flight check: tenant enabled + plan includes + quota available
 *   2. buildSipTwiml()     — generates <Dial><Sip> TwiML to transfer to LiveKit SIP trunk
 *   3. buildFallbackTwiml() — generates <Say><Dial> TwiML to play message + transfer to phone
 *
 * Called by IvrConfigurationService when a caller presses the digit mapped to 'voice_ai'.
 * This service is intentionally kept free of HTTP concerns — it only returns TwiML strings.
 */
@Injectable()
export class VoiceAiSipService {
  private readonly logger = new Logger(VoiceAiSipService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: VoiceAiSettingsService,
    private readonly usageService: VoiceUsageService,
  ) {}

  /**
   * Pre-flight authorization check before routing a call to Voice AI.
   *
   * Checks (in order):
   *   1. tenant_voice_ai_settings.is_enabled = true
   *   2. subscription_plan.voice_ai_enabled = true
   *   3. quota not exceeded OR plan has overage_rate (pay-as-you-go)
   *
   * @param tenantId  Tenant UUID
   * @returns { allowed: true } or { allowed: false, reason }
   */
  async canHandleCall(tenantId: string): Promise<CanHandleCallResult> {
    // Check 1: tenant-level toggle
    const settings = await this.settingsService.getTenantSettings(tenantId);
    if (!settings || !settings.is_enabled) {
      this.logger.warn(
        `Voice AI not enabled for tenant ${tenantId} — is_enabled = ${settings?.is_enabled ?? 'no settings row'}`,
      );
      return { allowed: false, reason: 'disabled' };
    }

    // Check 2: subscription plan includes voice AI
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { subscription_plan: true },
    });

    if (!tenant?.subscription_plan?.voice_ai_enabled) {
      this.logger.warn(`Voice AI not included in plan for tenant ${tenantId}`);
      return { allowed: false, reason: 'plan_not_included' };
    }

    // Check 3: quota — allowed if minutes_remaining > 0 OR overage_rate is set
    const quota = await this.usageService.getQuota(tenantId);
    if (quota.quota_exceeded) {
      this.logger.warn(
        `Voice AI quota exceeded for tenant ${tenantId} (used: ${quota.minutes_used}/${quota.minutes_included} min)`,
      );
      return { allowed: false, reason: 'quota_exceeded' };
    }

    return { allowed: true };
  }

  /**
   * Builds TwiML to route call to LiveKit SIP trunk for AI agent handling
   * @param tenantId - Tenant UUID
   * @param callSid - Twilio call SID
   * @param toNumber - Original dialed number (optional)
   * @param agentProfileId - Voice agent profile ID for language/voice selection (optional)
   * @returns TwiML XML string
   */
  async buildSipTwiml(
    tenantId: string,
    callSid: string,
    toNumber?: string,
    agentProfileId?: string,
  ): Promise<string> {
    // Create voice AI logger for this call
    const voiceLogger = createVoiceAILogger(tenantId, callSid);

    voiceLogger.log(
      'INFO' as any,
      'SESSION' as any,
      '🔌 Building SIP TwiML to route call to LiveKit',
    );

    // Load tenant info for callback URL
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subdomain: true },
    });

    const globalConfig = await this.prisma.voice_ai_global_config.findUnique({
      where: { id: 'default' },
    });

    const livekitUrl = globalConfig?.livekit_sip_trunk_url;

    if (!livekitUrl) {
      this.logger.error(
        'LiveKit SIP trunk URL not configured in voice_ai_global_config — cannot route to Voice AI',
      );
      voiceLogger.logError(
        new Error('LiveKit SIP trunk URL not configured'),
        'SIP TwiML generation',
      );
      // Fall back to hangup with an informative message rather than crashing
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        '  <Say voice="Polly.Joanna" language="en-US">Our AI assistant is temporarily unavailable. Please call back later.</Say>',
        '  <Hangup/>',
        '</Response>',
      ].join('\n');
    }

    this.logger.log(
      `Routing call ${callSid} to LiveKit SIP for tenant ${tenantId}`,
    );

    // Build callback URL for SIP dial results
    const actionUrl = `https://${tenant?.subdomain || 'app'}.lead360.app/api/v1/twilio/sip/dial-result`;

    // Build status callback URL for SIP call SID mapping (child → parent)
    const statusCallbackUrl = `https://${tenant?.subdomain || 'app'}.lead360.app/api/v1/twilio/sip/status`;

    // Build recording callback URL (uses same webhook as IVR calls)
    const recordingCallbackUrl = `https://${tenant?.subdomain || 'app'}.lead360.app/api/v1/twilio/recording/ready`;

    voiceLogger.log(
      'SUCCESS' as any,
      'SESSION' as any,
      '🚀 SIP routing configured, call will be transferred to LiveKit',
      {
        livekit_sip_url: livekitUrl,
        tenant_id: tenantId,
        call_sid: callSid,
        twilio_number: toNumber,
        agent_profile_id: agentProfileId,
        action_url: actionUrl,
        status_callback_url: statusCallbackUrl,
        recording_callback_url: recordingCallbackUrl,
        note: 'Agent profile ID stored in Redis. Status callback will map child→parent CallSid. Call routed with clean SIP URI (phone number only). Recording enabled with dual-channel capture.',
      },
    );

    // Build Sip element with proper XML structure
    // CLEAN SIP URI: Phone number ONLY (no query params, no headers)
    //
    // Use the actual Twilio phone number as the SIP URI username.
    // LiveKit's sip.trunkPhoneNumber attribute will automatically extract this value,
    // enabling proper tenant lookup without workarounds.
    //
    // Agent profile ID is stored in Redis (not passed via SIP) to avoid
    // concatenation issues that occur when mixing data in SIP protocol.
    let sipUri = `sip:${livekitUrl}`;
    if (toNumber) {
      // Use phone number as SIP username (standard SIP routing)
      sipUri = `sip:${toNumber}@${livekitUrl}`;
    }
    // NO query parameters, NO headers - clean SIP URI

    // Format with proper indentation (6 spaces for nested content)
    // Add statusCallback to enable call SID mapping (child → parent)
    // The "initiated" event fires when dial starts (before LiveKit answers)
    // This creates the mapping BEFORE voice agent starts, ensuring it's available
    const sipElement = [
      `    <Sip statusCallback="${statusCallbackUrl}" statusCallbackEvent="initiated">`,
      `      ${sipUri}`,
      '    </Sip>',
    ].join('\n');

    // Build TwiML with properly structured Sip element
    // The action URL receives DialSipResponseCode when the dial completes
    // This is CRITICAL for debugging - shows WHY LiveKit accepted/rejected the call
    // Recording is enabled with record-from-answer-dual to capture both caller and AI agent
    const twiml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      // Recording consent message (legal requirement in many jurisdictions)
      '  <Say voice="Polly.Joanna" language="en-US">This call will be recorded for quality and training purposes.</Say>',
      // Dial with recording enabled (dual-channel: records both sides)
      `  <Dial action="${actionUrl}"`,
      '        method="POST"',
      '        record="record-from-answer-dual"',
      `        recordingStatusCallback="${recordingCallbackUrl}"`,
      '        recordingStatusCallbackMethod="POST">',
      sipElement,
      '  </Dial>',
      '</Response>',
    ].join('\n');

    voiceLogger.log(
      'INFO' as any,
      'SESSION' as any,
      '⏳ Waiting for LiveKit to spawn agent job...',
    );

    return twiml;
  }

  /**
   * Build TwiML that plays a message and transfers to a fallback phone number.
   *
   * Output:
   * ```xml
   * <Response>
   *   <Say voice="Polly.Joanna" language="en-US">{message}</Say>
   *   <Dial>{transferNumber}</Dial>
   * </Response>
   * ```
   *
   * @param transferNumber  E.164 phone number to transfer to
   * @param message         Optional message spoken before transfer
   * @returns TwiML XML string
   */
  buildFallbackTwiml(transferNumber: string, message?: string): string {
    const safeMessage = message ?? 'Transferring you now. Please hold.';

    this.logger.log(
      `Building fallback TwiML — transferring to ${transferNumber}`,
    );

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `  <Say voice="Polly.Joanna" language="en-US">${this.escapeTwimlText(safeMessage)}</Say>`,
      `  <Dial>${this.escapeTwimlText(transferNumber)}</Dial>`,
      '</Response>',
    ].join('\n');
  }

  /**
   * Escape characters that are special in XML/TwiML text content.
   * Prevents XSS/injection if caller-controlled strings ever reach TwiML bodies.
   */
  private escapeTwimlText(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Escape XML special characters in header values.
   * Prevents XML injection in SIP header values.
   */
  private escapeXml(unsafe: string): string {
    return unsafe
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}
