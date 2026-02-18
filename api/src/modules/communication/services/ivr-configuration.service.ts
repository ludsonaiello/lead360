import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
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
      // 1. Validate menu options
      this.validateMenuOptions(dto.menu_options);

      // 2. Validate default action
      this.validateAction(dto.default_action);

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

    return config;
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
   * Generate IVR menu TwiML
   *
   * Creates TwiML response for initial IVR menu presentation.
   *
   * TwiML Structure:
   * 1. <Say> - Consent message
   * 2. <Say> - Greeting message
   * 3. <Gather> - Present menu options and collect input
   *    - numDigits: 1 (single digit)
   *    - timeout: Configured timeout
   *    - action: Webhook for handling input
   * 4. <Redirect> - If no input, execute default action
   *
   * @param tenantId - Tenant UUID
   * @returns TwiML XML string
   * @throws NotFoundException if configuration does not exist
   * @throws BadRequestException if IVR is not enabled
   */
  async generateIvrMenuTwiML(tenantId: string): Promise<string> {
    const config = await this.findByTenantId(tenantId);

    if (!config.ivr_enabled) {
      throw new BadRequestException('IVR is not enabled for this tenant');
    }

    // Fetch tenant for subdomain (needed for webhook URLs)
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new Error(`Tenant not found: ${tenantId}`);
    }

    this.logger.log(`Generating IVR menu TwiML for tenant: ${tenantId}`);

    const twiml = new twilio.twiml.VoiceResponse();

    // 1. Consent message (REQUIRED for recording compliance)
    twiml.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      'This call will be recorded for quality and training purposes.',
    );

    // 2. Greeting message
    twiml.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      config.greeting_message,
    );

    // 3. Build menu options text
    const menuOptions = config.menu_options as unknown as IvrMenuOptionDto[];
    const menuText = menuOptions
      .map((opt) => `Press ${opt.digit} for ${opt.label}.`)
      .join(' ');

    // 4. Gather digit input
    const gather = twiml.gather({
      numDigits: 1,
      timeout: config.timeout_seconds,
      action: `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/input`,
      method: 'POST',
    });

    gather.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      menuText,
    );

    // 5. If no input, redirect to default action handler
    twiml.redirect(
      {
        method: 'POST',
      },
      `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/default`,
    );

    return twiml.toString();
  }

  /**
   * Execute IVR action based on digit pressed
   *
   * Called when user presses a digit in the IVR menu.
   *
   * Flow:
   * 1. Find menu option matching digit
   * 2. If invalid, say error and redirect to menu
   * 3. If valid, execute action
   *
   * @param tenantId - Tenant UUID
   * @param digit - Digit pressed by user (0-9)
   * @returns TwiML XML string
   * @throws NotFoundException if configuration does not exist
   */
  async executeIvrAction(
    tenantId: string,
    digit: string,
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

    const menuOptions = config.menu_options as unknown as IvrMenuOptionDto[];
    const selectedOption = menuOptions.find((opt) => opt.digit === digit);

    const twiml = new twilio.twiml.VoiceResponse();

    if (!selectedOption) {
      // Invalid input - replay menu
      this.logger.warn(
        `Invalid IVR digit pressed: ${digit} for tenant ${tenantId}`,
      );
      twiml.say(
        {
          voice: 'Polly.Joanna',
          language: 'en-US',
        },
        'Invalid option. Please try again.',
      );
      twiml.redirect(
        {
          method: 'POST',
        },
        `https://${tenant.subdomain}.lead360.app/api/v1/twilio/ivr/menu`,
      );
      return twiml.toString();
    }

    // Handle voice_ai action — async path using VoiceAiSipService
    if (selectedOption.action === 'voice_ai') {
      return this.executeVoiceAiAction(tenantId, callSid ?? '', selectedOption);
    }

    // Execute selected action (synchronous path for all other action types)
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
   * @returns TwiML XML string
   */
  private async executeVoiceAiAction(
    tenantId: string,
    callSid: string,
    action: IvrMenuOptionDto | IvrDefaultActionDto,
  ): Promise<string> {
    this.logger.log(
      `Executing voice_ai IVR action for tenant ${tenantId}, callSid=${callSid}`,
    );

    const canHandle = await this.voiceAiSipService.canHandleCall(tenantId);

    if (canHandle.allowed) {
      return this.voiceAiSipService.buildSipTwiml(tenantId, callSid);
    }

    // Fallback: determine transfer number and message
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
      return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<Response>',
        `  <Say voice="Polly.Joanna" language="en-US">${message}</Say>`,
        '  <Hangup/>',
        '</Response>',
      ].join('\n');
    }

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
   *
   * @param menuOptions - Array of menu options
   * @throws BadRequestException if validation fails
   */
  private validateMenuOptions(menuOptions: IvrMenuOptionDto[]) {
    if (!Array.isArray(menuOptions)) {
      throw new BadRequestException('menu_options must be an array');
    }

    if (menuOptions.length === 0 || menuOptions.length > 10) {
      throw new BadRequestException(
        'menu_options must have between 1 and 10 entries',
      );
    }

    // Check for duplicate digits
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
        // No additional config required — routing parameters are resolved at call time
        // from tenant_voice_ai_settings and voice_ai_global_config.
        // Optional: phone_number may be used as fallback transfer number.
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
}
