import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import twilio from 'twilio';
import { AddWhitelistDto } from '../dto/office-bypass/add-whitelist.dto';

/**
 * OfficeBypassService
 *
 * Production-grade office phone number whitelist management system.
 *
 * Purpose:
 * Allows authorized office staff to bypass IVR and make outbound calls
 * using the company's Twilio phone number. Useful for:
 * - Sales staff making outbound prospecting calls
 * - Support staff calling customers
 * - Management making business calls
 *
 * Security Model:
 * - Only Owner/Admin can add/remove whitelist entries
 * - All bypass calls are recorded and audited
 * - Phone numbers must be verified before whitelisting
 * - Whitelist entries can be disabled (soft delete) for audit trail
 *
 * Call Flow:
 * 1. Whitelisted number calls company Twilio number
 * 2. System detects whitelist match (bypasses IVR)
 * 3. Caller prompted: "Please enter the phone number you'd like to call"
 * 4. System validates input (10 digits or E.164 format)
 * 5. System initiates outbound call to target
 * 6. Call is recorded with consent message
 * 7. CallRecord created with call_type = 'office_bypass_call'
 *
 * Compliance:
 * - Consent message played before recording
 * - All bypass calls logged in CallRecord table
 * - Audit trail maintained (who, when, to whom)
 * - Tenant data isolation (CRITICAL)
 *
 * @see https://www.twilio.com/docs/voice/twiml/dial
 * @see https://www.twilio.com/docs/voice/twiml/gather
 */
@Injectable()
export class OfficeBypassService {
  private readonly logger = new Logger(OfficeBypassService.name);
  private readonly apiBaseUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.apiBaseUrl =
      this.config.get<string>('API_BASE_URL') || 'https://api.lead360.app';
  }

  /**
   * Check if phone number is whitelisted for tenant
   *
   * Used by CallManagementService to determine if incoming call
   * should bypass IVR system.
   *
   * Only active whitelist entries are checked (status = 'active').
   *
   * @param tenantId - Tenant UUID
   * @param phoneNumber - Phone number to check (E.164 format)
   * @returns true if whitelisted, false otherwise
   */
  async isWhitelisted(tenantId: string, phoneNumber: string): Promise<boolean> {
    try {
      const whitelist = await this.prisma.office_number_whitelist.findFirst({
        where: {
          tenant_id: tenantId,
          phone_number: phoneNumber,
          status: 'active',
        },
      });

      const isWhitelisted = !!whitelist;

      if (isWhitelisted) {
        this.logger.log(
          `✅ Whitelist match: ${phoneNumber} for tenant ${tenantId}`,
        );
      }

      return isWhitelisted;
    } catch (error) {
      // Log error but don't throw - default to not whitelisted
      this.logger.error(
        `Error checking whitelist for ${phoneNumber}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Add phone number to whitelist
   *
   * Security:
   * - Checks for duplicate entries (same phone number)
   * - Validates E.164 format
   * - Creates audit trail (created_at timestamp)
   *
   * Best Practice:
   * - Verify phone number ownership before whitelisting
   * - Use descriptive labels (e.g., "John Doe - Sales Manager")
   * - Regularly audit whitelist entries
   *
   * @param tenantId - Tenant UUID
   * @param dto - Whitelist entry data
   * @returns Created whitelist entry
   * @throws ConflictException if phone number already whitelisted
   * @throws InternalServerErrorException if database operation fails
   */
  async addToWhitelist(tenantId: string, dto: AddWhitelistDto) {
    this.logger.log(
      `Adding phone number to whitelist: ${dto.phone_number} for tenant ${tenantId}`,
    );

    try {
      // Check if already exists (including inactive entries)
      const existing = await this.prisma.office_number_whitelist.findFirst({
        where: {
          tenant_id: tenantId,
          phone_number: dto.phone_number,
        },
      });

      if (existing) {
        if (existing.status === 'active') {
          throw new ConflictException(
            'This phone number is already whitelisted',
          );
        } else {
          // Reactivate inactive entry
          this.logger.log(
            `Reactivating inactive whitelist entry: ${existing.id}`,
          );
          return await this.prisma.office_number_whitelist.update({
            where: { id: existing.id },
            data: {
              status: 'active',
              label: dto.label, // Update label on reactivation
            },
          });
        }
      }

      // Create new whitelist entry
      return await this.prisma.office_number_whitelist.create({
        data: {
          tenant_id: tenantId,
          phone_number: dto.phone_number,
          label: dto.label,
          status: 'active',
        },
      });
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }

      this.logger.error(
        `Failed to add whitelist entry: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException('Failed to add whitelist entry');
    }
  }

  /**
   * List all whitelisted numbers for tenant
   *
   * Returns both active and inactive entries for audit purposes.
   * Frontend can filter by status if needed.
   *
   * Sorted by most recent first (created_at DESC).
   *
   * @param tenantId - Tenant UUID
   * @returns Array of whitelist entries
   */
  async findAll(tenantId: string) {
    return await this.prisma.office_number_whitelist.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Remove phone number from whitelist (soft delete)
   *
   * Sets status to 'inactive' rather than physically deleting.
   * Maintains audit trail and allows reactivation if needed.
   *
   * @param tenantId - Tenant UUID
   * @param whitelistId - Whitelist entry UUID
   * @returns Updated whitelist entry
   * @throws NotFoundException if entry does not exist
   * @throws InternalServerErrorException if database operation fails
   */
  async removeFromWhitelist(tenantId: string, whitelistId: string) {
    this.logger.log(
      `Removing whitelist entry ${whitelistId} for tenant ${tenantId}`,
    );

    try {
      // Verify entry exists and belongs to tenant
      const whitelist = await this.prisma.office_number_whitelist.findFirst({
        where: {
          id: whitelistId,
          tenant_id: tenantId,
        },
      });

      if (!whitelist) {
        throw new NotFoundException(
          'Whitelist entry not found or does not belong to this tenant',
        );
      }

      // Soft delete by setting status to inactive
      return await this.prisma.office_number_whitelist.update({
        where: { id: whitelistId },
        data: { status: 'inactive' },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to remove whitelist entry: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to remove whitelist entry',
      );
    }
  }

  /**
   * Handle bypass call - prompt for target number
   *
   * Called when whitelisted number calls in.
   * Generates TwiML that:
   * 1. Greets caller with company name
   * 2. Prompts for target phone number (10 digits)
   * 3. Collects input via <Gather>
   * 4. Redirects to dial handler with input
   *
   * TwiML Structure:
   * <Say> - Greeting
   * <Gather> - Collect 10 digits (phone number)
   * <Say> - Error message if no input
   * <Hangup>
   *
   * @param tenantId - Tenant UUID
   * @param callerNumber - Whitelisted phone number (for logging)
   * @returns TwiML XML string
   */
  async handleBypassCall(
    tenantId: string,
    callerNumber: string,
  ): Promise<string> {
    this.logger.log(
      `Handling bypass call from ${callerNumber} for tenant ${tenantId}`,
    );

    try {
      // Fetch tenant info for personalized greeting
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { company_name: true },
      });

      const twiml = new twilio.twiml.VoiceResponse();

      // Personalized greeting
      const companyName = tenant?.company_name || 'Lead360';
      twiml.say(
        {
          voice: 'Polly.Joanna',
          language: 'en-US',
        },
        `You've reached ${companyName} office bypass system. Please enter the ten digit phone number you'd like to call, including area code.`,
      );

      // Gather 10 digits (US phone number)
      const gather = twiml.gather({
        numDigits: 10,
        action: `${this.apiBaseUrl}/webhooks/communication/twilio-bypass-dial`,
        method: 'POST',
        timeout: 10,
      });

      // No need for <Say> inside <Gather> - instruction already given

      // If no input received
      twiml.say(
        {
          voice: 'Polly.Joanna',
          language: 'en-US',
        },
        'We did not receive any input. Please try again. Goodbye.',
      );
      twiml.hangup();

      return twiml.toString();
    } catch (error) {
      this.logger.error(
        `Failed to generate bypass prompt TwiML: ${error.message}`,
        error.stack,
      );

      // Return error TwiML
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(
        {
          voice: 'Polly.Joanna',
          language: 'en-US',
        },
        'Sorry, we encountered an error. Please try again later. Goodbye.',
      );
      twiml.hangup();
      return twiml.toString();
    }
  }

  /**
   * Initiate bypass outbound call to target
   *
   * Called after user enters target phone number.
   *
   * Logic:
   * 1. Validate and format phone number
   *    - If 10 digits, assume US and prepend +1
   *    - Must start with + for international
   * 2. Generate TwiML to dial target
   *    - Play "connecting" message
   *    - Play consent message (required for recording)
   *    - Dial target with recording enabled
   *    - Handle dial failure
   *
   * Recording:
   * - Starts from ringing (captures ring time)
   * - Status callback registered for recording availability
   * - Stored via CallManagementService webhook handler
   *
   * @param tenantId - Tenant UUID
   * @param callerCallSid - Twilio Call SID of caller (whitelisted number)
   * @param targetNumber - Phone number to dial (10 digits or E.164)
   * @returns TwiML XML string
   */
  async initiateBypassOutboundCall(
    tenantId: string,
    callerCallSid: string,
    targetNumber: string,
  ): Promise<string> {
    this.logger.log(
      `Initiating bypass outbound call to ${targetNumber} for tenant ${tenantId}`,
    );

    // 1. Validate and format target number
    let formattedNumber = targetNumber;

    // If 10 digits, assume US number and prepend +1
    if (targetNumber.length === 10 && /^\d{10}$/.test(targetNumber)) {
      formattedNumber = `+1${targetNumber}`;
      this.logger.log(`Formatted US number: ${formattedNumber}`);
    }

    // Validate E.164 format
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    if (!e164Regex.test(formattedNumber)) {
      this.logger.warn(
        `Invalid phone number format: ${targetNumber} -> ${formattedNumber}`,
      );

      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say(
        {
          voice: 'Polly.Joanna',
          language: 'en-US',
        },
        'Invalid phone number format. Please try again.',
      );
      twiml.redirect(
        {
          method: 'POST',
        },
        `${this.apiBaseUrl}/webhooks/communication/twilio-bypass-prompt`,
      );
      return twiml.toString();
    }

    // 2. Generate TwiML to dial target
    const twiml = new twilio.twiml.VoiceResponse();

    // Connecting message
    twiml.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      'Please hold while we connect your call.',
    );

    // Consent message (REQUIRED for recording compliance)
    twiml.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      'This call will be recorded for quality and training purposes.',
    );

    // Dial target number with recording
    twiml.dial(
      {
        record: 'record-from-ringing',
        recordingStatusCallback: `${this.apiBaseUrl}/webhooks/communication/twilio-recording-ready`,
        timeout: 30, // Ring timeout (seconds)
        callerId: undefined, // Use Twilio number as caller ID
      },
      formattedNumber,
    );

    // If call fails (no answer, busy, etc.)
    twiml.say(
      {
        voice: 'Polly.Joanna',
        language: 'en-US',
      },
      'The call could not be completed. Please check the number and try again. Goodbye.',
    );
    twiml.hangup();

    return twiml.toString();
  }

  /**
   * Update whitelist entry label
   *
   * Allows updating the human-readable label for a whitelist entry.
   * Phone number itself is immutable (delete and re-add to change).
   *
   * @param tenantId - Tenant UUID
   * @param whitelistId - Whitelist entry UUID
   * @param label - New label
   * @returns Updated whitelist entry
   * @throws NotFoundException if entry does not exist
   * @throws InternalServerErrorException if database operation fails
   */
  async updateLabel(tenantId: string, whitelistId: string, label: string) {
    this.logger.log(
      `Updating whitelist entry label: ${whitelistId} for tenant ${tenantId}`,
    );

    try {
      // Verify entry exists and belongs to tenant
      const whitelist = await this.prisma.office_number_whitelist.findFirst({
        where: {
          id: whitelistId,
          tenant_id: tenantId,
        },
      });

      if (!whitelist) {
        throw new NotFoundException(
          'Whitelist entry not found or does not belong to this tenant',
        );
      }

      // Update label
      return await this.prisma.office_number_whitelist.update({
        where: { id: whitelistId },
        data: { label },
      });
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      this.logger.error(
        `Failed to update whitelist entry: ${error.message}`,
        error.stack,
      );
      throw new InternalServerErrorException(
        'Failed to update whitelist entry',
      );
    }
  }
}
