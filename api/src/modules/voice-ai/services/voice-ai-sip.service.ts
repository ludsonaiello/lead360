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
      this.logger.warn(
        `Voice AI not included in plan for tenant ${tenantId}`,
      );
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
   * Build TwiML that transfers the call to the LiveKit SIP trunk.
   *
   * Output:
   * ```xml
   * <Response>
   *   <Dial>
   *     <Sip>
   *       sip:voice-ai@{livekit_sip_trunk_url}
   *       <SipHeader name="X-Twilio-Number">{toNumber}</SipHeader>
   *     </Sip>
   *   </Dial>
   * </Response>
   * ```
   *
   * @param tenantId  Tenant UUID
   * @param callSid   Twilio CallSid for session correlation
   * @param toNumber  Original Twilio number called (for agent tenant lookup)
   * @returns TwiML XML string
   */
  async buildSipTwiml(tenantId: string, callSid: string, toNumber?: string): Promise<string> {
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

    // Build SIP URI with X-Called-Number as query parameter
    // LiveKit SIP automatically captures Twilio-specific attributes on the SIP participant:
    //   - sip.twilio.callSid
    //   - sip.trunkPhoneNumber (returns "voice-ai" trunk name, NOT the actual Twilio number)
    //   - sip.phoneNumber (the caller's number)
    // We pass the actual Twilio number via query parameter in SIP URI for agent tenant lookup
    // IMPORTANT: Cannot use X-Twilio-* prefix (reserved by Twilio, silently dropped)
    // LiveKit will expose this as sip.h.X-Called-Number participant attribute
    const sipUriBase = `sip:voice-ai@${livekitUrl}`;
    const sipUri = toNumber
      ? `${sipUriBase}?X-Called-Number=${encodeURIComponent(toNumber)}`
      : sipUriBase;

    this.logger.log(
      `Routing call ${callSid} to LiveKit SIP for tenant ${tenantId}`,
    );

    // Build callback URL for SIP dial results
    const actionUrl = `https://${tenant?.subdomain || 'app'}.lead360.app/api/v1/twilio/sip/dial-result`;

    voiceLogger.log(
      'SUCCESS' as any,
      'SESSION' as any,
      '🚀 SIP routing configured, call will be transferred to LiveKit',
      {
        livekit_sip_url: livekitUrl,
        sip_uri: sipUri,
        tenant_id: tenantId,
        call_sid: callSid,
        twilio_number: toNumber,
        action_url: actionUrl,
        note: 'Twilio number passed as X-Called-Number query parameter (X-Twilio-* prefix reserved by Twilio). Action URL will capture SIP response codes.',
      },
    );

    // Build TwiML with SIP URI (header now in query string)
    // The action URL receives DialSipResponseCode when the dial completes
    // This is CRITICAL for debugging - shows WHY LiveKit accepted/rejected the call
    const twiml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Response>',
      `  <Dial action="${actionUrl}" method="POST">`,
      `    <Sip>${sipUri}</Sip>`,
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
}
