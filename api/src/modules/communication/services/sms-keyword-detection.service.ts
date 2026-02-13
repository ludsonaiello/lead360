import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * SMS Keyword Actions (TCPA Compliance)
 */
export enum SmsKeywordAction {
  OPT_OUT = 'opt_out',
  OPT_IN = 'opt_in',
  HELP = 'help',
  NONE = 'none',
}

/**
 * Keyword Detection Result
 */
export interface KeywordDetectionResult {
  action: SmsKeywordAction;
  keyword: string | null;
  autoReplyMessage: string | null;
}

/**
 * SMS Keyword Detection Service
 *
 * Detects STOP/START/HELP keywords in inbound SMS messages
 * for TCPA compliance (Telephone Consumer Protection Act).
 *
 * Features:
 * - Opt-out detection (STOP, STOPALL, UNSUBSCRIBE, etc.)
 * - Opt-in detection (START, UNSTOP, YES)
 * - Help keyword detection (HELP, INFO)
 * - Multi-tenant isolation
 * - Auto-reply message generation
 *
 * Legal Requirements (TCPA):
 * - Must honor opt-out requests within 24 hours
 * - Must provide clear opt-out mechanism (STOP keyword)
 * - Must maintain opt-out list
 * - Failure to comply: Fines up to $1,500 per violation
 */
@Injectable()
export class SmsKeywordDetectionService {
  private readonly logger = new Logger(SmsKeywordDetectionService.name);

  /**
   * TCPA-Compliant Opt-Out Keywords
   * Source: https://www.ctia.org/the-wireless-industry/industry-commitments/messaging-principles-and-best-practices
   */
  private readonly OPT_OUT_KEYWORDS = [
    'STOP',
    'STOPALL',
    'UNSUBSCRIBE',
    'CANCEL',
    'END',
    'QUIT',
  ];

  /**
   * Opt-In Keywords (Re-subscription)
   */
  private readonly OPT_IN_KEYWORDS = ['START', 'UNSTOP', 'YES'];

  /**
   * Help Keywords
   */
  private readonly HELP_KEYWORDS = ['HELP', 'INFO'];

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Detect keyword in SMS message body
   *
   * @param messageBody - SMS message text
   * @returns Detection result with action and auto-reply message
   */
  detectKeyword(messageBody: string): KeywordDetectionResult {
    // Normalize message: trim whitespace and convert to uppercase
    const trimmed = messageBody.trim().toUpperCase();

    // Check opt-out keywords (highest priority)
    if (this.OPT_OUT_KEYWORDS.includes(trimmed)) {
      return {
        action: SmsKeywordAction.OPT_OUT,
        keyword: trimmed,
        autoReplyMessage:
          "You've been unsubscribed from SMS messages. Reply START to resume.",
      };
    }

    // Check opt-in keywords
    if (this.OPT_IN_KEYWORDS.includes(trimmed)) {
      return {
        action: SmsKeywordAction.OPT_IN,
        keyword: trimmed,
        autoReplyMessage:
          "You've been re-subscribed to SMS messages. Reply STOP to unsubscribe.",
      };
    }

    // Check help keywords
    if (this.HELP_KEYWORDS.includes(trimmed)) {
      return {
        action: SmsKeywordAction.HELP,
        keyword: trimmed,
        autoReplyMessage:
          'Reply STOP to unsubscribe, START to resume messages.',
      };
    }

    // No keyword detected
    return {
      action: SmsKeywordAction.NONE,
      keyword: null,
      autoReplyMessage: null,
    };
  }

  /**
   * Process opt-out for a Lead (TCPA Compliance)
   *
   * Updates lead record to mark as opted out of SMS.
   * CRITICAL: Must include tenant_id filter for multi-tenant isolation.
   *
   * @param tenantId - Tenant ID (multi-tenant isolation)
   * @param leadId - Lead ID
   * @param reason - Optional reason for opt-out
   */
  async processOptOut(
    tenantId: string,
    leadId: string,
    reason?: string,
  ): Promise<void> {
    this.logger.log(
      `Processing SMS opt-out for Lead ${leadId} (tenant: ${tenantId})`,
    );

    // Update lead record with opt-out status
    // CRITICAL: MUST include tenant_id filter for multi-tenant isolation
    await this.prisma.lead.update({
      where: {
        id: leadId,
        tenant_id: tenantId, // Multi-tenant isolation MANDATORY
      },
      data: {
        sms_opt_out: true,
        sms_opt_out_at: new Date(),
        sms_opt_out_reason: reason || 'User requested via SMS keyword',
        sms_opt_in_at: null, // Clear previous opt-in timestamp
      },
    });

    this.logger.log(
      `✅ Lead ${leadId} opted out of SMS for tenant ${tenantId}. Reason: ${reason || 'User requested'}`,
    );
  }

  /**
   * Process opt-in (re-subscription) for a Lead
   *
   * Updates lead record to re-enable SMS communications.
   * CRITICAL: Must include tenant_id filter for multi-tenant isolation.
   *
   * @param tenantId - Tenant ID (multi-tenant isolation)
   * @param leadId - Lead ID
   */
  async processOptIn(tenantId: string, leadId: string): Promise<void> {
    this.logger.log(
      `Processing SMS opt-in for Lead ${leadId} (tenant: ${tenantId})`,
    );

    // Update lead record to re-enable SMS
    await this.prisma.lead.update({
      where: {
        id: leadId,
        tenant_id: tenantId,
      },
      data: {
        sms_opt_out: false,
        sms_opt_in_at: new Date(),
        sms_opt_out_reason: null, // Clear opt-out reason
      },
    });

    this.logger.log(
      `✅ Lead ${leadId} opted back in to SMS for tenant ${tenantId}`,
    );
  }

  /**
   * Check if Lead has opted out of SMS
   *
   * Used by SMS sending service to block messages to opted-out leads.
   * CRITICAL: Must include tenant_id filter for multi-tenant isolation.
   *
   * @param tenantId - Tenant ID (multi-tenant isolation)
   * @param leadId - Lead ID
   * @returns True if lead has opted out, false otherwise
   */
  async isOptedOut(tenantId: string, leadId: string): Promise<boolean> {
    const lead = await this.prisma.lead.findUnique({
      where: {
        id: leadId,
        tenant_id: tenantId,
      },
      select: {
        sms_opt_out: true,
      },
    });

    return lead?.sms_opt_out || false;
  }

  /**
   * Check if phone number has opted out (by phone lookup)
   *
   * Alternative method when lead_id is not known.
   * Looks up lead by phone number within tenant.
   *
   * @param tenantId - Tenant ID (multi-tenant isolation)
   * @param phoneNumber - Phone number in E.164 format
   * @returns True if any lead with this phone has opted out
   */
  async isPhoneOptedOut(
    tenantId: string,
    phoneNumber: string,
  ): Promise<boolean> {
    // Find lead by phone number within tenant
    const leadPhones = await this.prisma.lead_phone.findMany({
      where: {
        phone: phoneNumber,
        lead: {
          tenant_id: tenantId,
        },
      },
      include: {
        lead: {
          select: {
            sms_opt_out: true,
          },
        },
      },
    });

    // Check if any lead with this phone has opted out
    return leadPhones.some((lp) => lp.lead.sms_opt_out === true);
  }
}
