import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { parsePhoneNumber, CountryCode } from 'libphonenumber-js';
import { randomUUID } from 'crypto';

/**
 * LeadMatchingService
 *
 * Production-grade phone number matching and Lead auto-creation system.
 *
 * Core Responsibilities:
 * - Phone number normalization to E.164 format (international standard)
 * - Lead matching by normalized phone number
 * - Auto-creation of Leads for unknown callers
 * - Multi-tenant isolation enforcement
 *
 * Use Cases:
 * - Inbound call handling (match caller to existing Lead or create new)
 * - SMS/WhatsApp message matching
 * - Phone number validation and formatting
 *
 * Phone Number Standards:
 * - E.164 format: +[country code][number] (e.g., +12025551234)
 * - Supports international phone numbers
 * - Removes 'whatsapp:' prefix for WhatsApp numbers
 * - Default country: US (configurable per tenant in future)
 *
 * Auto-Created Lead Properties:
 * - first_name: Normalized phone number (for easy identification)
 * - last_name: "Phone/SMS lead"
 * - source: "Phone/SMS"
 * - status: "lead"
 * - created_by: "SYSTEM"
 */
@Injectable()
export class LeadMatchingService {
  private readonly logger = new Logger(LeadMatchingService.name);
  private readonly defaultCountry: CountryCode = 'US';

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Match phone number to existing Lead or auto-create new Lead
   *
   * Algorithm:
   * 1. Normalize phone number to E.164 format
   * 2. Search for existing Lead with matching phone
   * 3. If found, return Lead ID
   * 4. If not found, auto-create new Lead with phone number
   *
   * @param tenantId - Tenant UUID (multi-tenant isolation)
   * @param phoneNumber - Raw phone number (any format)
   * @returns Lead UUID (existing or newly created)
   */
  async matchOrCreateLead(
    tenantId: string,
    phoneNumber: string,
  ): Promise<string> {
    // 1. Normalize phone number
    const normalizedPhone = this.normalizePhoneNumber(phoneNumber);

    this.logger.log(`🔍 Matching phone: ${phoneNumber} → ${normalizedPhone}`);

    // 2. Try to match existing Lead by phone number
    const existingLead = await this.prisma.lead.findFirst({
      where: {
        tenant_id: tenantId,
        phones: {
          some: {
            phone: normalizedPhone,
          },
        },
      },
    });

    if (existingLead) {
      this.logger.log(
        `✅ Lead matched: ${existingLead.id} (${existingLead.first_name} ${existingLead.last_name})`,
      );
      return existingLead.id;
    }

    // 3. Auto-create new Lead if no match found
    this.logger.log(
      `🆕 Creating new Lead for unknown phone: ${normalizedPhone}`,
    );

    const newLead = await this.createLeadFromPhone(tenantId, normalizedPhone);

    this.logger.log(`✅ New Lead created: ${newLead.id}`);

    return newLead.id;
  }

  /**
   * Create a new Lead from a phone number
   * Used for auto-creation when caller is not in system
   *
   * @param tenantId - Tenant UUID
   * @param normalizedPhone - E.164 formatted phone number
   * @returns Created Lead with phone record
   * @private
   */
  private async createLeadFromPhone(tenantId: string, normalizedPhone: string) {
    // Get tenant info for logging purposes
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { subdomain: true },
    });

    const leadId = randomUUID();
    const phoneId = randomUUID();

    // Create Lead with phone
    const newLead = await this.prisma.lead.create({
      data: {
        id: leadId,
        tenant_id: tenantId,
        first_name: normalizedPhone, // Use phone as first name for easy identification
        last_name: 'Phone/SMS lead',
        source: 'Phone/SMS',
        status: 'lead',
        language_spoken: 'EN',
        preferred_communication: 'phone',
        created_by_user_id: null, // System-created
        phones: {
          create: {
            id: phoneId,
            phone: normalizedPhone,
            phone_type: 'mobile',
            is_primary: true,
          },
        },
      },
      include: {
        phones: true,
      },
    });

    this.logger.log(
      `🆕 Auto-created Lead: ${newLead.id} for phone ${normalizedPhone} (Tenant: ${tenant?.subdomain || tenantId})`,
    );

    return newLead;
  }

  /**
   * Normalize phone number to E.164 format
   *
   * E.164 Format: +[country code][subscriber number]
   * Examples:
   * - US: +12025551234
   * - UK: +442071234567
   * - Brazil: +5511987654321
   *
   * Handles:
   * - WhatsApp prefix (whatsapp:+12025551234 → +12025551234)
   * - Various input formats (spaces, dashes, parentheses)
   * - Missing country code (assumes US by default)
   * - International numbers with country code
   *
   * @param phoneNumber - Raw phone number in any format
   * @returns E.164 formatted phone number (+[country][number])
   */
  normalizePhoneNumber(phoneNumber: string): string {
    try {
      // Remove 'whatsapp:' prefix if present
      const cleanNumber = phoneNumber.replace(/^whatsapp:/, '');

      // Parse and format to E.164
      const parsed = parsePhoneNumber(cleanNumber, this.defaultCountry);

      if (parsed && parsed.isValid()) {
        const e164 = parsed.number; // Returns E.164 format
        this.logger.debug(`📞 Normalized: ${phoneNumber} → ${e164}`);
        return e164;
      }

      // If parsing fails but number starts with +, assume it's already formatted
      if (cleanNumber.startsWith('+')) {
        this.logger.warn(
          `⚠️  Phone number could not be validated but appears formatted: ${cleanNumber}`,
        );
        return cleanNumber;
      }

      // Last resort: return cleaned number (will likely fail validation later)
      this.logger.warn(`⚠️  Failed to normalize phone number: ${phoneNumber}`);
      return cleanNumber;
    } catch (error) {
      this.logger.error(
        `❌ Phone normalization error for ${phoneNumber}: ${error.message}`,
      );

      // Return original if all else fails
      return phoneNumber;
    }
  }

  /**
   * Validate phone number format
   * Checks if phone number is valid E.164 format
   *
   * @param phoneNumber - Phone number to validate
   * @returns True if valid E.164 format
   */
  isValidPhoneNumber(phoneNumber: string): boolean {
    try {
      const parsed = parsePhoneNumber(phoneNumber, this.defaultCountry);
      return parsed ? parsed.isValid() : false;
    } catch {
      return false;
    }
  }

  /**
   * Get phone number country
   * Extracts country code from phone number
   *
   * @param phoneNumber - Phone number (any format)
   * @returns Country code (e.g., 'US', 'GB', 'BR') or null if cannot determine
   */
  getPhoneCountry(phoneNumber: string): string | null {
    try {
      const cleanNumber = phoneNumber.replace(/^whatsapp:/, '');
      const parsed = parsePhoneNumber(cleanNumber, this.defaultCountry);
      return parsed?.country || null;
    } catch {
      return null;
    }
  }

  /**
   * Format phone number for display
   * Converts E.164 to human-readable format
   *
   * Examples:
   * - +12025551234 → (202) 555-1234
   * - +442071234567 → +44 20 7123 4567
   *
   * @param phoneNumber - E.164 phone number
   * @param format - Display format ('national' or 'international')
   * @returns Formatted phone number for display
   */
  formatPhoneForDisplay(
    phoneNumber: string,
    format: 'national' | 'international' = 'national',
  ): string {
    try {
      const parsed = parsePhoneNumber(phoneNumber);

      if (!parsed) {
        return phoneNumber;
      }

      return format === 'national'
        ? parsed.formatNational()
        : parsed.formatInternational();
    } catch {
      return phoneNumber;
    }
  }
}
