import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import {
  CreateIvrConfigDto,
  IvrMenuOptionDto,
  IvrDefaultActionDto,
  IVR_ACTION_TYPES,
  IvrActionType,
} from '../dto/ivr/create-ivr-config.dto';
import { VoiceAiSipService } from '../../voice-ai/services/voice-ai-sip.service';
import { VoiceAiCallMetadataService } from '../../voice-ai/services/voice-ai-call-metadata.service';
import { createVoiceAILogger } from '../../voice-ai/utils/voice-ai-logger.util';

/**
 * IvrConfigurationService
 *
 * Production-grade IVR (Interactive Voice Response) management system.
 *
 * Features:
 * - Create/update/delete IVR configurations per tenant
 * - Validate menu options (unique digits, valid actions, proper config)
 * - Generate TwiML responses for call flow control
 * - Handle DTMF input routing
 * - Support retry logic for invalid input
 * - Enforce security best practices (HTTPS webhooks, E.164 phone numbers)
 *
 * Architecture:
 * - One IVR configuration per tenant (1:1 relationship)
 * - Upsert pattern for create/update
 * - Soft delete (status = 'inactive')
 * - TwiML generation using Twilio SDK
 *
 * IVR Call Flow:
 * 1. Inbound call arrives
 * 2. Play consent message ("This call will be recorded...")
 * 3. Play greeting message
 * 4. Present menu options ("Press 1 for Sales...")
 * 5. Gather DTMF digit input
 * 6. Execute action based on digit
 * 7. If invalid/timeout, retry or execute default action
 *
 * Compliance:
 * - Consent message MUST be played before recording
 * - All webhooks MUST use HTTPS
 * - Phone numbers MUST be in E.164 format
 * - Tenant data isolation (CRITICAL)
 *
 * @see https://www.twilio.com/docs/voice/twiml
 * @see https://www.twilio.com/docs/voice/tutorials/ivr-phone-tree
 */
@Injectable()
export class IvrConfigurationService {
  private readonly logger = new Logger(IvrConfigurationService.name);
  private readonly apiBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly voiceAiSipService: VoiceAiSipService,
    private readonly callMetadataService: VoiceAiCallMetadataService,
  ) {
    this.apiBaseUrl =
      this.config.get<string>('API_BASE_URL') || 'https://api.lead360.app';
  }

  /**
   * Create or update IVR configuration for tenant
   *
   * Uses upsert pattern - if configuration exists, it will be updated.
   * This simplifies client logic and prevents race conditions.
   *
   * Validation:
   * - Menu options: 1-10 items, unique digits (0-9), valid actions
   * - Phone numbers: E.164 format (+[country][number])
   * - Webhook URLs: HTTPS only (security requirement)
   * - Timeout: 5-60 seconds (UX best practice)
   * - Max retries: 1-5 (prevent caller frustration)
   *
   * @param tenantId - Tenant UUID (enforces multi-tenant isolation)
   * @param dto - IVR configuration data
   * @returns Created or updated IVR configuration
   * @throws BadRequestException if validation fails
   * @throws InternalServerErrorException if database operation fails
   */
  async createOrUpdate(tenantId: string, dto: CreateIvrConfigDto) {
    this.logger.log(
      `Creating/updating IVR configuration for tenant: ${tenantId}`,
    );

    try {
      // 1. Validate menu options (pass max_depth for multi-level validation)
      this.validateMenuOptions(dto.menu_options, dto.max_depth || 4);

      // 2. Validate default action
      this.validateAction(dto.default_action);

      // NEW: Validate agent_profile_id references (after menu options validation)
      await this.validateAgentProfileReferences(tenantId, dto);

      // 3. Check if config exists
      const existing = await this.prisma.ivr_configuration.findUnique({
        where: { tenant_id: tenantId },
      });

      // 4. Prepare data for upsert
      const data = {
        ivr_enabled: dto.ivr_enabled,
        greeting_message: dto.greeting_message,
        menu_options: dto.menu_options as any,
        default_action: dto.default_action as any,
        timeout_seconds: dto.timeout_seconds,
        max_retries: dto.max_retries,
        max_depth: dto.max_depth || 4, // NEW: Add max_depth field
        status: 'active',
      };

      if (existing) {
        // Update existing configuration
        this.logger.log(`Updating existing IVR config: ${existing.id}`);
        return await this.prisma.ivr_configuration.update({
          where: { tenant_id: tenantId },
          data,
        });
      }

      // Create new configuration
      this.logger.log(`Creating new IVR configuration for tenant ${tenantId}`);
      return await this.prisma.ivr_configuration.create({
        data: {
          tenant_id: tenantId,
          ...data,
        },
      });
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      this.logger.error(
        `Failed to create/update IVR config: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to save IVR configuration',
      );
    }
  }

  /**
   * Get IVR configuration for tenant
   *
   * @param tenantId - Tenant UUID
   * @returns IVR configuration
   * @throws NotFoundException if configuration does not exist
   */
  async findByTenantId(tenantId: string) {
    const config = await this.prisma.ivr_configuration.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!config) {
      throw new NotFoundException(
        'IVR configuration not found for this tenant',
      );
    }

    // Ensure all menu options have UUIDs (for backward compatibility with legacy configs)
    const menuOptions = config.menu_options as any[];
    const menuOptionsWithIds = this.ensureMenuOptionsHaveIds(menuOptions);

    return {
      ...config,
      menu_options: menuOptionsWithIds,
    };
  }

  /**
   * Delete (soft delete) IVR configuration
   *
   * Disables IVR and marks status as 'inactive'.
   * Does not physically delete data for audit trail purposes.
   *
   * @param tenantId - Tenant UUID
   * @returns Updated configuration with ivr_enabled = false
   * @throws NotFoundException if configuration does not exist
   */
  async delete(tenantId: string) {
    const config = await this.prisma.ivr_configuration.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!config) {
      throw new NotFoundException(
        'IVR configuration not found for this tenant',
      );
    }

    this.logger.log(`Disabling IVR configuration for tenant: ${tenantId}`);

    return await this.prisma.ivr_configuration.update({
      where: { tenant_id: tenantId },
      data: {
        ivr_enabled: false,
        status: 'inactive',
      },
    });
  }

  /**
   * Generate IVR menu TwiML with support for multi-level navigation
   *
   * Creates TwiML response for IVR menu at any level in the tree.
   * Uses path notation to navigate to the correct menu level.
   *
   * TwiML Structure:
   * 1. <Say> - Consent message (only at root level)
   * 2. <Say> - Greeting message (for current level)
   * 3. <Gather> - Present menu options and collect input
   *    - numDigits: 1 (single digit)
   *    - timeout: Submenu timeout or config default
   *    - action: Webhook for handling input (includes path)
   * 4. <Redirect> - If no input, execute default action
   *
   * @param tenantId - Tenant UUID
   * @param path - Navigation path (e.g., "1.2" for submenu)
   * @param callSid - Twilio CallSid (optional, passed to voice_ai routing)
   * @param toNumber - Original Twilio number called (optional, used for voice_ai tenant lookup)
   * @returns TwiML XML string
   * @throws NotFoundException if configuration does not exist
   * @throws BadRequestException if IVR is not enabled
   */
  async generateIvrMenuTwiML(
    tenantId: string,
    path?: string,
    callSid?: string,
    toNumber?: string,
  ): Promise<string> {
    const config = await this.findByTenantId(tenantId);

    if (!config.ivr_enabled) {
      throw new BadRequestException('IVR is not enabled for this tenant');
    }

    // Fetch tenant for subdomain (needed for webhook URLs)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    this.logger.log(
      `Generating IVR menu TwiML for tenant: ${tenantId}, path: ${path || 'root'}`,
    );

    // Navigate to correct menu level based on path
    const currentMenu = this.navigateToMenuLevel(
      config.menu_options as unknown as IvrMenuOptionDto[],
      config.greeting_message,
      path,
    );

    const twiml = new twilio.twiml.VoiceResponse();

    // 1. Consent message (only on root level)
    if (!path || path === '') {
      twiml.say(
        { voice: 'Polly.Joanna', language: 'en-US' },
        'This call will be recorded for quality and training purposes.',
      );
    }

    // 2. Greeting message for current level
    twiml.say(
      { voice: 'Polly.Joanna', language: 'en-US' },
      currentMenu.greeting,
    );

    // 3. Build menu options text (e.g., "Press 1 for Sales. Press 2 for Support.")
    const menuText = currentMenu.options
      .map((opt) => `Press ${opt.digit} for ${opt.label}.`)
      .join(' ');

    // 4. Determine timeout (submenu override or config default)
    const timeoutSeconds = currentMenu.timeout || config.timeout_seconds;

    // 5. Gather DTMF digit input
    const gather = twiml.gather({
      numDigits: 1,
      timeout: timeoutSeconds,
      action: `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/input${path ? `?path=${path}` : ''}`,
      method: 'POST',
    });

    gather.say({ voice: 'Polly.Joanna', language: 'en-US' }, menuText);

    // 6. Default action on timeout/no input
    twiml.redirect(
      { method: 'POST' },
      `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/default`,
    );

    return twiml.toString();
  }

  /**
   * Execute IVR action based on digit input with multi-level navigation support
   *
   * Called when user presses a digit in the IVR menu at any level.
   * Handles submenu navigation by building path and redirecting to deeper levels.
   *
   * Flow:
   * 1. Navigate to current menu level using path
   * 2. Find menu option matching digit at current level
   * 3. If invalid, say error and redirect to current menu
   * 4. If submenu action, build new path and redirect deeper
   * 5. If terminal action, execute action (dial, voicemail, etc.)
   *
   * @param tenantId - Tenant UUID
   * @param digit - Digit pressed by user (0-9)
   * @param callSid - Twilio call SID
   * @param path - Current menu path (optional)
   * @param toNumber - Original Twilio number called (optional, used for voice_ai tenant lookup)
   * @returns TwiML XML string
   * @throws NotFoundException if configuration does not exist
   */
  async executeIvrAction(
    tenantId: string,
    digit: string,
    callSid?: string,
    path?: string,
    toNumber?: string,
  ): Promise<string> {
    const config = await this.findByTenantId(tenantId);

    // Fetch tenant for subdomain (needed for webhook URLs)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException(`Tenant not found: ${tenantId}`);
    }

    this.logger.log(
      `Executing IVR action for tenant: ${tenantId}, digit: ${digit}, path: ${path || 'root'}`,
    );

    // Navigate to current menu level
    const currentMenu = this.navigateToMenuLevel(
      config.menu_options as unknown as IvrMenuOptionDto[],
      config.greeting_message,
      path,
    );

    // Find selected option at current level
    const selectedOption = currentMenu.options.find(
      (opt) => opt.digit === digit,
    );

    const twiml = new twilio.twiml.VoiceResponse();

    if (!selectedOption) {
      // Invalid digit at this level
      this.logger.warn(
        `Invalid IVR digit: ${digit} at path: ${path || 'root'} for tenant: ${tenantId}`,
      );
      twiml.say(
        { voice: 'Polly.Joanna', language: 'en-US' },
        'Invalid option. Please try again.',
      );
      // Redirect back to current menu level
      twiml.redirect(
        { method: 'POST' },
        `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/menu${path ? `?path=${path}` : ''}`,
      );
      return twiml.toString();
    }

    // Handle navigation actions
    if (selectedOption.action === 'return_to_parent') {
      // Navigate back one level by removing last digit from path
      if (!path || path === '') {
        // Already at root, redirect to root menu
        this.logger.log(`Already at root, redirecting to main menu`);
        twiml.redirect(
          { method: 'POST' },
          `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/menu`,
        );
      } else {
        // Remove last segment from path (e.g., "1.2.3" -> "1.2")
        const pathSegments = path.split('.');
        pathSegments.pop(); // Remove last segment
        const parentPath = pathSegments.join('.');

        this.logger.log(`Navigating to parent menu: ${parentPath || 'root'}`);

        const menuUrl = parentPath
          ? `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/menu?path=${parentPath}`
          : `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/menu`;

        twiml.redirect({ method: 'POST' }, menuUrl);
      }
      return twiml.toString();
    }

    if (selectedOption.action === 'return_to_root') {
      // Navigate to root menu (no path)
      this.logger.log(`Returning to main menu from path: ${path || 'root'}`);
      twiml.redirect(
        { method: 'POST' },
        `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/menu`,
      );
      return twiml.toString();
    }

    // Handle submenu action (navigate deeper)
    if (selectedOption.action === 'submenu') {
      const newPath = path ? `${path}.${digit}` : digit;
      this.logger.log(`Navigating to submenu: ${newPath}`);

      twiml.redirect(
        { method: 'POST' },
        `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/menu?path=${newPath}`,
      );
      return twiml.toString();
    }

    // Handle voice_ai action (special routing)
    if (selectedOption.action === 'voice_ai') {
      return this.executeVoiceAiAction(
        tenantId,
        callSid ?? '',
        selectedOption,
        toNumber,
      );
    }

    // Execute terminal action (route_to_number, voicemail, webhook, etc.)
    this.logger.log(
      `Executing IVR action: ${selectedOption.action} for tenant ${tenantId}`,
    );
    this.executeActionTwiML(twiml, selectedOption, tenant.subdomain);

    return twiml.toString();
  }

  /**
   * Execute default action (timeout/no input)
   *
   * Called when user does not provide input within timeout period.
   *
   * @param tenantId - Tenant UUID
   * @returns TwiML XML string
   * @throws NotFoundException if configuration does not exist
   */
  async executeDefaultAction(
    tenantId: string,
    callSid?: string,
  ): Promise<string> {
    const config = await this.findByTenantId(tenantId);

    // Fetch tenant for subdomain (needed for webhook URLs)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    this.logger.log(
      `Executing default IVR action for tenant: ${tenantId} (timeout/no input)`,
    );

    const defaultAction =
      config.default_action as unknown as IvrDefaultActionDto;

    // Handle voice_ai action — async path using VoiceAiSipService
    if (defaultAction.action === 'voice_ai') {
      return this.executeVoiceAiAction(tenantId, callSid ?? '', defaultAction);
    }

    const twiml = new twilio.twiml.VoiceResponse();
    this.executeActionTwiML(twiml, defaultAction, tenant.subdomain);

    return twiml.toString();
  }

  /**
   * Execute voice_ai IVR action.
   *
   * Checks quota/enabled status via VoiceAiSipService.canHandleCall():
   * - If allowed: returns <Dial><Sip> TwiML routed to LiveKit SIP trunk
   * - If not allowed: returns <Say><Dial> fallback TwiML with a message + transfer number
   *
   * @param tenantId - Tenant UUID
   * @param callSid - Twilio CallSid for SIP routing correlation
   * @param action - The IVR action config (used for fallback phone_number)
   * @param toNumber - Original Twilio number called (for voice_ai tenant lookup)
   * @returns TwiML XML string
   */
  private async executeVoiceAiAction(
    tenantId: string,
    callSid: string,
    action: IvrMenuOptionDto | IvrDefaultActionDto,
    toNumber?: string,
  ): Promise<string> {
    this.logger.log(
      `Executing voice_ai IVR action for tenant ${tenantId}, callSid=${callSid}`,
    );

    // NEW: Extract agent_profile_id from config
    const agentProfileId = action.config?.agent_profile_id;

    // Create voice AI logger for this call
    const voiceLogger = createVoiceAILogger(tenantId, callSid);

    voiceLogger.log(
      'INFO' as any,
      'SESSION' as any,
      '🔀 IVR routing to Voice AI agent',
      {
        action_type: 'voice_ai',
        action_config: action.config,
        agent_profile_id: agentProfileId,
      },
    );

    const canHandle = await this.voiceAiSipService.canHandleCall(tenantId);

    voiceLogger.logQuotaCheck(canHandle.allowed, {
      allowed: canHandle.allowed,
      reason: canHandle.reason,
    });

    if (canHandle.allowed) {
      voiceLogger.log(
        'SUCCESS' as any,
        'SESSION' as any,
        '✅ Quota check passed, routing to LiveKit SIP',
      );

      // Look up call_record to get its ID and mark as voice_ai-handled
      let callRecordId: string | null = null;
      if (callSid) {
        try {
          const callRecord = await this.prisma.call_record.findUnique({
            where: { twilio_call_sid: callSid },
            select: { id: true },
          });
          if (callRecord) {
            callRecordId = callRecord.id;
            // Mark call_record as handled by voice_ai
            await this.prisma.call_record.update({
              where: { id: callRecord.id },
              data: { handled_by: 'voice_ai' },
            });
            this.logger.log(
              `✅ call_record ${callRecord.id} marked as handled_by=voice_ai`,
            );
          }
        } catch (err: any) {
          this.logger.warn(
            `⚠️ Failed to update call_record for voice_ai handoff: ${err.message}`,
          );
        }
      }

      // Store call metadata for voice agent to retrieve later
      // Includes call_record_id so voice agent can link voice_call_log → call_record
      await this.callMetadataService.storeCallMetadata(callSid, {
        tenant_id: tenantId,
        agent_profile_id: agentProfileId || null,
        call_record_id: callRecordId,
        parent_call_sid: callSid,
        timestamp: Date.now(),
      });

      return this.voiceAiSipService.buildSipTwiml(
        tenantId,
        callSid,
        toNumber,
        agentProfileId,
      );
    }

    // Fallback: determine transfer number and message
    voiceLogger.log(
      'WARN' as any,
      'SESSION' as any,
      '⚠️ Voice AI not available, using fallback',
      {
        reason: canHandle.reason,
      },
    );

    const settings = await this.prisma.tenant_voice_ai_settings.findUnique({
      where: { tenant_id: tenantId },
    });

    const fallbackNumber =
      settings?.default_transfer_number || action.config.phone_number || '';

    const message =
      canHandle.reason === 'quota_exceeded'
        ? 'Our AI assistant has reached its limit for this month. Transferring you now.'
        : 'Our AI assistant is not available. Transferring you now.';

    if (!fallbackNumber) {
      this.logger.warn(
        `Voice AI fallback: no transfer number configured for tenant ${tenantId} — hanging up`,
      );
      voiceLogger.log(
        'ERROR' as any,
        'SESSION' as any,
        '❌ No fallback number configured, hanging up',
      );
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        `  <Say voice="Polly.Joanna" language="en-US">${message}</Say>`,
        '  <Hangup/>',
        '</Response>',
      ].join('\n');
    }

    voiceLogger.log(
      'INFO' as any,
      'SESSION' as any,
      `📞 Using fallback transfer to ${fallbackNumber}`,
    );

    return this.voiceAiSipService.buildFallbackTwiml(fallbackNumber, message);
  }

  /**
   * Execute action and append to TwiML
   *
   * Private helper method for generating TwiML based on action type.
   *
   * Supported Actions:
   * - route_to_number: Dial specific phone number
   * - route_to_default: Dial default company number
   * - trigger_webhook: Send HTTP webhook (not implemented in TwiML, handled async)
   * - voicemail: Record message
   * - voice_ai: Handled upstream in executeVoiceAiAction (async) — never reaches here
   *
   * @param twiml - TwiML VoiceResponse object (mutated)
   * @param action - Action configuration
   * @param tenantSubdomain - Tenant subdomain for webhook URL generation
   */
  private executeActionTwiML(
    twiml: twilio.twiml.VoiceResponse,
    action: IvrMenuOptionDto | IvrDefaultActionDto,
    tenantSubdomain: string,
  ) {
    switch (action.action) {
      case 'route_to_number':
        // Dial specific phone number
        twiml.say(
          {
            voice: 'Polly.Joanna',
            language: 'en-US',
          },
          'Please hold while we transfer your call.',
        );
        twiml.dial(
          {
            callerId: action.config.phone_number,
            record: 'record-from-answer-dual', // Enable dual-channel stereo recording
            recordingStatusCallback: `https://${tenantSubdomain}.lead360.app/api/v1/twilio/recording/ready`,
          },
          action.config.phone_number,
        );
        break;

      case 'route_to_default':
        // Dial default company number (could implement queue logic here)
        twiml.say(
          {
            voice: 'Polly.Joanna',
            language: 'en-US',
          },
          'Please hold while we transfer your call.',
        );
        twiml.dial(
          {
            record: 'record-from-answer-dual', // Enable dual-channel stereo recording
            recordingStatusCallback: `https://${tenantSubdomain}.lead360.app/api/v1/twilio/recording/ready`,
          },
          action.config.phone_number,
        );
        break;

      case 'trigger_webhook':
        // Webhook trigger (not directly in TwiML - log for async processing)
        this.logger.log(`Webhook trigger action: ${action.config.webhook_url}`);
        twiml.say(
          {
            voice: 'Polly.Joanna',
            language: 'en-US',
          },
          'Thank you. Your request has been received.',
        );
        twiml.hangup();
        break;

      case 'voicemail':
        // Record voicemail
        twiml.say(
          {
            voice: 'Polly.Joanna',
            language: 'en-US',
          },
          'Please leave a message after the beep.',
        );
        twiml.record({
          maxLength: action.config.max_duration_seconds || 180,
          playBeep: true,
          transcribe: false, // Use dedicated transcription service instead
          recordingStatusCallback: `https://${tenantSubdomain}.lead360.app/api/v1/twilio/recording/ready`,
        });
        twiml.say(
          {
            voice: 'Polly.Joanna',
            language: 'en-US',
          },
          'Thank you for your message. Goodbye.',
        );
        break;

      case 'voice_ai':
        // voice_ai is handled asynchronously in executeVoiceAiAction() and should
        // never reach this synchronous method. Log a warning and hang up defensively.
        this.logger.warn(
          'voice_ai action reached synchronous executeActionTwiML — this is a bug. Hanging up.',
        );
        twiml.say(
          {
            voice: 'Polly.Joanna',
            language: 'en-US',
          },
          'Our AI assistant is temporarily unavailable. Goodbye.',
        );
        twiml.hangup();
        break;

      default:
        // Fallback for unsupported actions
        this.logger.error(`Unsupported IVR action: ${action.action}`);
        twiml.say(
          {
            voice: 'Polly.Joanna',
            language: 'en-US',
          },
          'Sorry, that option is not available. Goodbye.',
        );
        twiml.hangup();
    }
  }

  /**
   * Recursively ensure all menu options have UUIDs
   *
   * Legacy configurations may not have option IDs. This method adds them
   * if missing to maintain consistency with the IvrMenuOptionDto schema.
   *
   * IMPORTANT: If UUID already exists, it is returned unchanged.
   * Only generates new UUIDs when the id field is missing.
   *
   * @param options - Array of menu options (possibly without IDs)
   * @returns Array of menu options with guaranteed IDs
   */
  private ensureMenuOptionsHaveIds(options: any[]): any[] {
    return options.map((option) => {
      const optionWithId = {
        ...option,
        id: option.id || randomUUID(), // Keep existing ID or generate new one
      };

      // Recursively process submenu options if present
      if (optionWithId.submenu?.options) {
        optionWithId.submenu.options = this.ensureMenuOptionsHaveIds(
          optionWithId.submenu.options,
        );
      }

      return optionWithId;
    });
  }

  /**
   * Navigate to specific menu level using path notation
   *
   * Traverses the menu tree following the path notation (e.g., "1.2.1").
   * Each digit in the path represents a menu choice at that level.
   *
   * @param rootOptions - Root level menu options
   * @param rootGreeting - Root level greeting message
   * @param path - Navigation path (e.g., "1.2.1" means: digit 1 → digit 2 → digit 1)
   * @returns Current menu level with greeting, options, and timeout
   * @throws NotFoundException if path is invalid
   * @throws BadRequestException if path points to non-submenu option
   *
   * @example
   * // Navigate to root
   * navigateToMenuLevel(options, "Welcome", null)
   * // Returns: { greeting: "Welcome", options: [...], timeout: undefined }
   *
   * @example
   * // Navigate to submenu after pressing 1
   * navigateToMenuLevel(options, "Welcome", "1")
   * // Returns: { greeting: "Sales Dept...", options: [...], timeout: 10 }
   *
   * @example
   * // Navigate to sub-submenu after pressing 1, then 2
   * navigateToMenuLevel(options, "Welcome", "1.2")
   * // Returns: { greeting: "New Customers...", options: [...] }
   */
  private navigateToMenuLevel(
    rootOptions: IvrMenuOptionDto[],
    rootGreeting: string,
    path?: string,
  ): {
    greeting: string;
    options: IvrMenuOptionDto[];
    timeout?: number;
  } {
    // Base case: no path = root level
    if (!path || path === '') {
      return {
        greeting: rootGreeting,
        options: rootOptions,
        timeout: undefined, // Use default from config
      };
    }

    // Split path into digits (e.g., "1.2.3" → ["1", "2", "3"])
    const digits = path.split('.');
    let currentOptions = rootOptions;
    let currentGreeting = rootGreeting;
    let currentTimeout: number | undefined;

    // Traverse tree by following digit path
    for (let i = 0; i < digits.length; i++) {
      const digit = digits[i];

      // Find option matching this digit at current level
      const option = currentOptions.find((opt) => opt.digit === digit);

      if (!option) {
        throw new NotFoundException(
          `Invalid menu path: digit "${digit}" not found at level ${i + 1} (path: "${path}")`,
        );
      }

      // Verify this option is a submenu
      if (option.action !== 'submenu' || !option.submenu) {
        throw new BadRequestException(
          `Invalid menu path: option at digit "${digit}" (${option.label}) is not a submenu. Cannot navigate deeper. Path: "${path}"`,
        );
      }

      // Move to submenu
      currentOptions = option.submenu.options;
      currentGreeting = option.submenu.greeting_message;
      currentTimeout = option.submenu.timeout_seconds;
    }

    return {
      greeting: currentGreeting,
      options: currentOptions,
      timeout: currentTimeout,
    };
  }

  /**
   * Recursively validate menu tree structure
   *
   * Performs deep validation of multi-level IVR menu tree:
   * - Checks depth limit is not exceeded
   * - Detects circular references (duplicate option IDs)
   * - Validates unique IDs across entire tree
   * - Counts total nodes to prevent abuse
   * - Validates submenu configuration consistency
   *
   * @param menuOptions - Array of menu options to validate
   * @param maxDepth - Maximum allowed depth (from config, default 4)
   * @param currentDepth - Current depth level (starts at 1)
   * @param visitedIds - Set of visited option IDs (for circular detection)
   * @returns Object with totalNodes count
   * @throws BadRequestException if validation fails
   */
  private validateMenuTree(
    menuOptions: IvrMenuOptionDto[],
    maxDepth: number,
    currentDepth: number = 1,
    visitedIds: Set<string> = new Set(),
  ): { totalNodes: number } {
    // 1. Check depth limit
    if (currentDepth > maxDepth) {
      throw new BadRequestException(
        `Menu depth exceeds maximum of ${maxDepth} levels. Current depth: ${currentDepth}. Please reduce nesting.`,
      );
    }

    let totalNodes = 0;

    // 2. Loop through each option
    for (const option of menuOptions) {
      // Check for circular reference (duplicate ID)
      if (visitedIds.has(option.id)) {
        throw new BadRequestException(
          `Circular reference detected: Option ID '${option.id}' appears multiple times in the menu tree.`,
        );
      }

      // Add to visited set
      visitedIds.add(option.id);

      // Increment node counter
      totalNodes++;

      // Validate submenu configuration
      if (option.action === 'submenu') {
        // Submenu action MUST have submenu config
        if (
          !option.submenu ||
          !option.submenu.options ||
          option.submenu.options.length === 0
        ) {
          throw new BadRequestException(
            `Option '${option.label}' (digit ${option.digit}) is set to 'submenu' action but has no submenu configuration or empty options array.`,
          );
        }

        // Recursively validate submenu tree
        const submenuResult = this.validateMenuTree(
          option.submenu.options,
          maxDepth,
          currentDepth + 1,
          visitedIds,
        );

        // Add submenu nodes to total count
        totalNodes += submenuResult.totalNodes;
      } else if (option.submenu) {
        // Non-submenu action MUST NOT have submenu config
        throw new BadRequestException(
          `Option '${option.label}' has submenu configuration but action is not 'submenu'. Either change action to 'submenu' or remove submenu config.`,
        );
      }
    }

    return { totalNodes };
  }

  /**
   * Validate total node count doesn't exceed limit
   *
   * Prevents abuse by limiting total number of menu options across entire tree.
   * Default limit is 100 nodes, which is sufficient for any reasonable IVR menu.
   *
   * @param totalNodes - Total nodes in tree
   * @param maxNodes - Maximum allowed nodes (default 100)
   * @throws BadRequestException if exceeds limit
   */
  private validateTotalNodeCount(
    totalNodes: number,
    maxNodes: number = 100,
  ): void {
    if (totalNodes > maxNodes) {
      throw new BadRequestException(
        `Total menu options (${totalNodes}) exceeds maximum of ${maxNodes} across entire tree. Please simplify your menu structure.`,
      );
    }
  }

  /**
   * Recursively validate digit uniqueness at each submenu level
   *
   * Ensures that within each level of the menu, all digits are unique.
   * This is critical for proper DTMF routing.
   *
   * @param options - Menu options at this level
   * @throws BadRequestException if duplicate digits found at any level
   */
  private validateSubmenuDigitsUnique(options: IvrMenuOptionDto[]): void {
    const digits = options.map((opt) => opt.digit);
    const uniqueDigits = new Set(digits);

    if (digits.length !== uniqueDigits.size) {
      throw new BadRequestException(
        'Menu options must have unique digits within each submenu level',
      );
    }

    // Recurse into submenus
    for (const option of options) {
      if (option.action === 'submenu' && option.submenu) {
        this.validateSubmenuDigitsUnique(option.submenu.options);
      }
    }
  }

  /**
   * Validate menu options
   *
   * Comprehensive validation of IVR menu options:
   * - Array must have 1-10 items
   * - Each digit must be unique
   * - Each option must have: digit, action, label, config
   * - Digits must be 0-9
   * - Actions must be valid types
   * - Phone numbers must be E.164 format
   * - Webhook URLs must be HTTPS
   * - Multi-level validation: depth, circular refs, total nodes
   *
   * @param menuOptions - Array of menu options
   * @param maxDepth - Maximum allowed depth (default 4)
   * @throws BadRequestException if validation fails
   */
  private validateMenuOptions(
    menuOptions: IvrMenuOptionDto[],
    maxDepth: number = 4,
  ) {
    if (!Array.isArray(menuOptions)) {
      throw new BadRequestException('menu_options must be an array');
    }

    if (menuOptions.length === 0 || menuOptions.length > 10) {
      throw new BadRequestException(
        'menu_options must have between 1 and 10 entries',
      );
    }

    // Check for duplicate digits at root level
    const digits = menuOptions.map((opt) => opt.digit);
    const uniqueDigits = new Set(digits);

    if (digits.length !== uniqueDigits.size) {
      const duplicates = digits.filter(
        (digit, index) => digits.indexOf(digit) !== index,
      );
      throw new BadRequestException(
        `Duplicate digits found: ${[...new Set(duplicates)].join(', ')}. Each digit must be unique.`,
      );
    }

    // NEW: Recursive tree validation (depth, circular refs, total nodes)
    const visitedIds = new Set<string>();
    const { totalNodes } = this.validateMenuTree(
      menuOptions,
      maxDepth,
      1, // Start at depth 1
      visitedIds,
    );

    // NEW: Validate total node count
    this.validateTotalNodeCount(totalNodes);

    // Validate each option
    for (let i = 0; i < menuOptions.length; i++) {
      const option = menuOptions[i];
      const position = `Menu option ${i + 1} (digit ${option.digit})`;

      // Validate required fields
      if (!option.digit || !option.action || !option.label || !option.config) {
        throw new BadRequestException(
          `${position}: Must have digit, action, label, and config`,
        );
      }

      // Validate digit is 0-9
      if (
        !['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(
          option.digit,
        )
      ) {
        throw new BadRequestException(`${position}: Digit must be 0-9`);
      }

      // Validate action type
      if (!IVR_ACTION_TYPES.includes(option.action)) {
        throw new BadRequestException(
          `${position}: Invalid action type '${option.action}'. Must be one of: ${IVR_ACTION_TYPES.join(', ')}`,
        );
      }

      // Validate action-specific config
      this.validateActionConfig(position, option);
    }

    // NEW: Recursively validate digit uniqueness at each submenu level
    this.validateSubmenuDigitsUnique(menuOptions);
  }

  /**
   * Validate action configuration
   *
   * Ensures action-specific config is valid:
   * - route_to_number: requires phone_number (E.164)
   * - route_to_default: requires phone_number (E.164)
   * - trigger_webhook: requires webhook_url (HTTPS)
   * - voicemail: max_duration_seconds optional (default 180)
   *
   * @param position - Human-readable position (for error messages)
   * @param action - Action configuration
   * @throws BadRequestException if validation fails
   */
  private validateActionConfig(
    position: string,
    action: IvrMenuOptionDto | IvrDefaultActionDto,
  ) {
    const { action: actionType, config } = action;

    switch (actionType) {
      case 'route_to_number':
      case 'route_to_default':
        // Validate phone number presence
        if (!config.phone_number) {
          throw new BadRequestException(
            `${position}: '${actionType}' action requires phone_number in config`,
          );
        }

        // Validate E.164 format
        if (!config.phone_number.startsWith('+')) {
          throw new BadRequestException(
            `${position}: Phone number must be in E.164 format (start with '+' followed by country code and number)`,
          );
        }

        // Validate E.164 format more strictly
        const e164Regex = /^\+[1-9]\d{1,14}$/;
        if (!e164Regex.test(config.phone_number)) {
          throw new BadRequestException(
            `${position}: Phone number '${config.phone_number}' is not valid E.164 format. Must be +[country code][number] with 1-15 total digits.`,
          );
        }
        break;

      case 'trigger_webhook':
        // Validate webhook URL presence
        if (!config.webhook_url) {
          throw new BadRequestException(
            `${position}: 'trigger_webhook' action requires webhook_url in config`,
          );
        }

        // Validate HTTPS (security requirement)
        if (!config.webhook_url.startsWith('https://')) {
          throw new BadRequestException(
            `${position}: Webhook URL must use HTTPS for security. Got: ${config.webhook_url}`,
          );
        }

        // Validate URL format
        try {
          new URL(config.webhook_url);
        } catch {
          throw new BadRequestException(
            `${position}: Invalid webhook URL format: ${config.webhook_url}`,
          );
        }
        break;

      case 'voicemail':
        // Validate max_duration_seconds if provided
        if (
          config.max_duration_seconds !== undefined &&
          (config.max_duration_seconds < 30 ||
            config.max_duration_seconds > 600)
        ) {
          throw new BadRequestException(
            `${position}: max_duration_seconds must be between 30 and 600 seconds (0.5 - 10 minutes)`,
          );
        }
        break;

      case 'voice_ai':
        // NEW: Validate agent_profile_id if provided
        if (config.agent_profile_id !== undefined) {
          const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          if (
            typeof config.agent_profile_id !== 'string' ||
            !uuidRegex.test(config.agent_profile_id)
          ) {
            throw new BadRequestException(
              `${position}: voice_ai action: agent_profile_id must be a valid UUID`,
            );
          }
        }
        // No other config required for voice_ai
        break;

      case 'submenu':
        // Submenu validation is handled in validateMenuTree()
        // No additional config validation required here
        // The submenu property itself is validated in the recursive tree validation
        break;

      case 'return_to_parent':
      case 'return_to_root':
        // Navigation actions don't require any config validation
        // They use the current path to determine where to navigate
        break;

      default:
        throw new BadRequestException(
          `${position}: Unsupported action type: ${actionType}`,
        );
    }
  }

  /**
   * Validate default action
   *
   * Same validation as menu options, but for default action.
   *
   * @param defaultAction - Default action configuration
   * @throws BadRequestException if validation fails
   */
  private validateAction(defaultAction: IvrDefaultActionDto) {
    const position = 'Default action';

    // Validate required fields
    if (!defaultAction.action || !defaultAction.config) {
      throw new BadRequestException(`${position}: Must have action and config`);
    }

    // Validate action type
    if (!IVR_ACTION_TYPES.includes(defaultAction.action)) {
      throw new BadRequestException(
        `${position}: Invalid action type '${defaultAction.action}'. Must be one of: ${IVR_ACTION_TYPES.join(', ')}`,
      );
    }

    // Validate action-specific config
    this.validateActionConfig(position, defaultAction);
  }

  /**
   * Validate agent_profile_id references (Sprint 18: Updated Architecture)
   *
   * Ensures all agent_profile_id values in IVR config:
   * - Exist in voice_ai_agent_profile table (GLOBAL profiles, not tenant overrides)
   * - Are active (is_active = true)
   *
   * Architecture Change (Sprint 18):
   * - IVR config now references GLOBAL profile IDs (voice_ai_agent_profile.id)
   * - Tenant customizations (greeting/instructions) are applied at runtime via tenant_voice_agent_profile_override
   * - This validation ensures IVR only references valid, active global profiles
   *
   * @param tenantId - Tenant UUID (not used for validation, but kept for future compatibility)
   * @param dto - IVR configuration DTO
   * @throws BadRequestException if any profile is invalid or inactive
   */
  private async validateAgentProfileReferences(
    tenantId: string,
    dto: CreateIvrConfigDto,
  ): Promise<void> {
    // Collect all agent_profile_id values from menu_options and default_action
    const profileIds: string[] = [];

    // Check menu_options
    this.collectProfileIds(dto.menu_options, profileIds);

    // Check default_action
    if (dto.default_action?.config?.agent_profile_id) {
      profileIds.push(dto.default_action.config.agent_profile_id);
    }

    // Remove duplicates
    const uniqueProfileIds = [...new Set(profileIds)];

    // Validate: All profile IDs must reference GLOBAL profiles (not tenant overrides)
    if (uniqueProfileIds.length > 0) {
      const globalProfiles = await this.prisma.voice_ai_agent_profile.findMany({
        where: {
          id: { in: uniqueProfileIds },
          is_active: true,
        },
      });

      if (globalProfiles.length !== uniqueProfileIds.length) {
        const foundIds = globalProfiles.map((p) => p.id);
        const missingIds = uniqueProfileIds.filter((id) => !foundIds.includes(id));
        throw new BadRequestException(
          `Invalid voice agent profile ID(s): ${missingIds.join(', ')}. ` +
            `Profile must be a valid active global profile. ` +
            `To see available profiles, use GET /api/v1/voice-ai/available-profiles`,
        );
      }
    }
  }

  /**
   * NEW METHOD: Recursive helper to collect profile IDs from menu tree
   *
   * Traverses the entire IVR menu tree (including nested submenus)
   * and collects all agent_profile_id values where action === 'voice_ai'
   *
   * @param menuOptions - Array of menu options to scan
   * @param profileIds - Array to accumulate profile IDs (mutated)
   */
  private collectProfileIds(menuOptions: any[], profileIds: string[]): void {
    if (!Array.isArray(menuOptions)) return;

    for (const option of menuOptions) {
      // Check this option's config
      if (option.action === 'voice_ai' && option.config?.agent_profile_id) {
        profileIds.push(option.config.agent_profile_id);
      }

      // Recursively check submenu
      if (option.submenu?.options) {
        this.collectProfileIds(option.submenu.options, profileIds);
      }
    }
  }
}
