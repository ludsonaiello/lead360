import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Merge data interface for template variable replacement
 *
 * Supports various data sources for merge field replacement:
 * - lead: Lead/customer data ({lead.first_name}, {lead.phone}, etc.)
 * - tenant: Business/company data ({tenant.company_name}, {tenant.phone}, etc.)
 * - user: Sender/staff data ({user.first_name}, {user.email}, etc.)
 * - custom: Dynamic data passed at runtime ({custom.quote_url}, {custom.amount}, etc.)
 */
export interface MergeData {
  lead?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    address?: string;
  };
  tenant?: {
    company_name?: string;
    phone?: string;
    address?: string;
  };
  user?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
  };
  custom?: Record<string, any>;
}

/**
 * Template Merge Service
 *
 * Handles replacement of merge fields in SMS templates with actual data.
 *
 * Supported merge fields:
 * - Lead: {lead.first_name}, {lead.last_name}, {lead.phone}, {lead.email}, {lead.address}
 * - Tenant: {tenant.company_name}, {tenant.phone}, {tenant.address}
 * - User: {user.first_name}, {user.last_name}, {user.phone}, {user.email}
 * - Date/Time: {today}, {time}
 * - Custom: {custom.field_name} (for dynamic data like quote_url, amount, etc.)
 *
 * Example:
 * Template: "Hi {lead.first_name}, your quote from {tenant.company_name} is ready!"
 * Result:   "Hi John, your quote from ABC Roofing is ready!"
 *
 * Missing fields are replaced with empty strings (graceful degradation).
 */
@Injectable()
export class TemplateMergeService {
  private readonly logger = new Logger(TemplateMergeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Merge template with data
   *
   * Replaces all merge field placeholders with actual data.
   * Missing fields are replaced with empty strings.
   *
   * @param templateBody - Template text with {merge_fields}
   * @param mergeData - Data to merge into template
   * @returns Merged text with all placeholders replaced
   */
  async mergeTemplate(
    templateBody: string,
    mergeData: MergeData,
  ): Promise<string> {
    let result = templateBody;

    // Replace lead fields
    if (mergeData.lead) {
      result = result.replace(
        /{lead\.first_name}/g,
        mergeData.lead.first_name || '',
      );
      result = result.replace(
        /{lead\.last_name}/g,
        mergeData.lead.last_name || '',
      );
      result = result.replace(/{lead\.phone}/g, mergeData.lead.phone || '');
      result = result.replace(/{lead\.email}/g, mergeData.lead.email || '');
      result = result.replace(/{lead\.address}/g, mergeData.lead.address || '');
    }

    // Replace tenant fields
    if (mergeData.tenant) {
      result = result.replace(
        /{tenant\.company_name}/g,
        mergeData.tenant.company_name || '',
      );
      result = result.replace(/{tenant\.phone}/g, mergeData.tenant.phone || '');
      result = result.replace(
        /{tenant\.address}/g,
        mergeData.tenant.address || '',
      );
    }

    // Replace user fields
    if (mergeData.user) {
      result = result.replace(
        /{user\.first_name}/g,
        mergeData.user.first_name || '',
      );
      result = result.replace(
        /{user\.last_name}/g,
        mergeData.user.last_name || '',
      );
      result = result.replace(/{user\.phone}/g, mergeData.user.phone || '');
      result = result.replace(/{user\.email}/g, mergeData.user.email || '');
    }

    // Replace date/time fields
    const today = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    result = result.replace(/{today}/g, today);
    result = result.replace(/{time}/g, time);

    // Replace custom fields
    if (mergeData.custom) {
      Object.entries(mergeData.custom).forEach(([key, value]) => {
        const regex = new RegExp(`\\{custom\\.${key}\\}`, 'g');
        result = result.replace(regex, String(value || ''));
      });
    }

    this.logger.debug(
      `Merged template: Original="${templateBody.substring(0, 50)}...", Result="${result.substring(0, 50)}..."`,
    );

    return result;
  }

  /**
   * Load merge data from database
   *
   * Fetches tenant, user, and optionally lead data for template merging.
   * All queries respect multi-tenant isolation.
   *
   * @param tenantId - Tenant UUID from JWT token
   * @param userId - User UUID from JWT token
   * @param leadId - Optional Lead UUID (only loads if provided)
   * @returns MergeData object with loaded data
   */
  async loadMergeData(
    tenantId: string,
    userId: string,
    leadId?: string,
  ): Promise<MergeData> {
    const [tenant, user, lead] = await Promise.all([
      // Load tenant data
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          company_name: true,
          primary_contact_phone: true,
          tenant_address: {
            where: { is_default: true },
            select: {
              line1: true,
              line2: true,
              city: true,
              state: true,
              zip_code: true,
            },
            take: 1,
          },
        },
      }),

      // Load user data
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          first_name: true,
          last_name: true,
          phone: true,
          email: true,
        },
      }),

      // Load lead data (if leadId provided)
      leadId
        ? this.prisma.lead.findFirst({
            where: {
              id: leadId,
              tenant_id: tenantId, // CRITICAL: Multi-tenant isolation
            },
            select: {
              first_name: true,
              last_name: true,
              emails: {
                where: { is_primary: true },
                select: { email: true },
                take: 1,
              },
              addresses: {
                where: { is_primary: true },
                select: {
                  address_line1: true,
                  address_line2: true,
                  city: true,
                  state: true,
                  zip_code: true,
                },
                take: 1,
              },
              phones: {
                where: { is_primary: true },
                select: { phone: true },
                take: 1,
              },
            },
          })
        : null,
    ]);

    // Format tenant address
    const tenantAddress = tenant?.tenant_address?.[0]
      ? `${tenant.tenant_address[0].line1}${tenant.tenant_address[0].line2 ? ' ' + tenant.tenant_address[0].line2 : ''}, ${tenant.tenant_address[0].city}, ${tenant.tenant_address[0].state} ${tenant.tenant_address[0].zip_code}`
      : undefined;

    // Format lead address
    const leadAddress = lead?.addresses?.[0]
      ? `${lead.addresses[0].address_line1}${lead.addresses[0].address_line2 ? ' ' + lead.addresses[0].address_line2 : ''}, ${lead.addresses[0].city}, ${lead.addresses[0].state} ${lead.addresses[0].zip_code}`
      : undefined;

    // Format lead phone
    const leadPhone = lead?.phones?.[0]?.phone;

    // Format lead email
    const leadEmail = lead?.emails?.[0]?.email;

    return {
      tenant: tenant
        ? {
            company_name: tenant.company_name,
            phone: tenant.primary_contact_phone,
            address: tenantAddress,
          }
        : undefined,
      user: user
        ? {
            first_name: user.first_name,
            last_name: user.last_name,
            phone: user.phone || undefined,
            email: user.email,
          }
        : undefined,
      lead: lead
        ? {
            first_name: lead.first_name,
            last_name: lead.last_name,
            phone: leadPhone,
            email: leadEmail,
            address: leadAddress,
          }
        : undefined,
    };
  }
}
