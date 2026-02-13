import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { BulkSendSmsDto } from '../dto/sms/bulk-send-sms.dto';
import { TemplateMergeService } from './template-merge.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * Bulk SMS Service
 *
 * Handles bulk SMS sending operations to multiple Leads.
 * Designed for campaigns, reminders, and announcements.
 *
 * Key Features:
 * - Sends SMS to up to 500 Leads per operation
 * - Automatic opt-out filtering (TCPA compliance)
 * - Rate limiting to avoid Twilio throttling
 * - Template merge support with personalization
 * - Multi-tenant isolation enforced
 * - Status tracking for bulk operations
 *
 * Flow:
 * 1. Validate tenant has active SMS configuration
 * 2. Load Leads and filter by tenant ownership
 * 3. Filter out opted-out Leads (TCPA compliance)
 * 4. Filter out Leads without phone numbers
 * 5. Load and merge template if provided
 * 6. Create communication_event for each SMS
 * 7. Queue jobs with rate limiting delays
 * 8. Return tracking information
 *
 * IMPORTANT: Multi-tenant isolation is CRITICAL.
 * All Lead queries MUST filter by tenant_id from JWT.
 */
@Injectable()
export class BulkSmsService {
  private readonly logger = new Logger(BulkSmsService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('communication-sms') private readonly smsQueue: Queue,
    private readonly templateMerge: TemplateMergeService,
  ) {}

  /**
   * Queue bulk SMS sending
   *
   * Validates tenant config, filters Leads, creates events, and queues jobs.
   *
   * CRITICAL Security Rules:
   * - Filter Leads by tenant_id (multi-tenant isolation)
   * - Filter out opted-out Leads (TCPA compliance)
   * - Rate limit to avoid Twilio throttling (max 10/sec)
   * - Validate all Leads belong to tenant
   *
   * @param tenantId - Tenant UUID from JWT token
   * @param userId - User UUID from JWT token
   * @param dto - Bulk SMS data
   * @returns Tracking information (job IDs, event IDs, counts)
   * @throws NotFoundException if SMS config not found
   * @throws BadRequestException if no valid recipients
   */
  async queueBulkSms(
    tenantId: string,
    userId: string,
    dto: BulkSendSmsDto,
  ): Promise<{
    queued_count: number;
    skipped_count: number;
    job_ids: string[];
    communication_event_ids: string[];
    estimated_completion_seconds: number;
  }> {
    // Step 1: Validate tenant has active SMS config
    const smsConfig = await this.prisma.tenant_sms_config.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
        is_verified: true,
      },
      select: {
        id: true,
        provider_id: true,
        from_phone: true,
      },
    });

    if (!smsConfig) {
      throw new NotFoundException(
        'No active SMS configuration found. Please configure Twilio settings first.',
      );
    }

    this.logger.log(
      `Starting bulk SMS for tenant ${tenantId}: ${dto.lead_ids.length} Leads requested`,
    );

    // Step 2: Load all Leads with opt-out status
    // CRITICAL: Multi-tenant isolation - filter by tenant_id
    const leads = await this.prisma.lead.findMany({
      where: {
        id: { in: dto.lead_ids },
        tenant_id: tenantId, // MANDATORY: Prevent cross-tenant access
      },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        sms_opt_out: true,
        emails: {
          where: { is_primary: true },
          select: { email: true },
          take: 1,
        },
        phones: {
          where: { is_primary: true },
          select: { phone: true },
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
      },
    });

    // Step 3: Filter out opted-out and phoneless Leads
    const validLeads = leads.filter(
      (lead) => !lead.sms_opt_out && lead.phones && lead.phones.length > 0,
    );

    const skippedLeads = leads.length - validLeads.length;

    this.logger.log(
      `Bulk SMS filtering: ${validLeads.length} valid, ${skippedLeads} skipped (opted-out or no phone)`,
    );

    if (validLeads.length === 0) {
      throw new BadRequestException(
        'No valid recipients found. All Leads either opted out or missing phone numbers.',
      );
    }

    // Step 4: Load template if provided
    let templateBody = dto.text_body;
    if (dto.template_id) {
      const template = await this.prisma.sms_template.findFirst({
        where: {
          id: dto.template_id,
          tenant_id: tenantId, // CRITICAL: Multi-tenant isolation
          is_active: true,
        },
      });

      if (!template) {
        throw new NotFoundException(
          'Template not found or does not belong to your organization',
        );
      }

      templateBody = template.template_body;

      // Increment usage count
      await this.prisma.sms_template.update({
        where: { id: template.id },
        data: { usage_count: { increment: validLeads.length } },
      });

      this.logger.log(
        `Using template ${template.id} "${template.name}" for ${validLeads.length} SMS`,
      );
    }

    // Step 5: Load tenant and user data for template merging
    const [tenant, user] = await Promise.all([
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
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          first_name: true,
          last_name: true,
          phone: true,
          email: true,
        },
      }),
    ]);

    // Format tenant address for merge
    const tenantAddress = tenant?.tenant_address?.[0]
      ? `${tenant.tenant_address[0].line1}${tenant.tenant_address[0].line2 ? ' ' + tenant.tenant_address[0].line2 : ''}, ${tenant.tenant_address[0].city}, ${tenant.tenant_address[0].state} ${tenant.tenant_address[0].zip_code}`
      : undefined;

    // Step 6: Create communication_event records and queue jobs
    const jobs: string[] = [];
    const communicationEventIds: string[] = [];
    const rateLimit = dto.rate_limit_per_second || 5; // Default 5/sec
    let delayMs = 0;

    for (const lead of validLeads) {
      // Format lead data for template merge
      const leadPhone = lead.phones[0]?.phone;
      const leadEmail = lead.emails?.[0]?.email;
      const leadAddress = lead.addresses?.[0]
        ? `${lead.addresses[0].address_line1}${lead.addresses[0].address_line2 ? ' ' + lead.addresses[0].address_line2 : ''}, ${lead.addresses[0].city}, ${lead.addresses[0].state} ${lead.addresses[0].zip_code}`
        : undefined;

      // Merge template with Lead data
      const mergedBody = await this.templateMerge.mergeTemplate(templateBody, {
        lead: {
          first_name: lead.first_name,
          last_name: lead.last_name,
          phone: leadPhone,
          email: leadEmail,
          address: leadAddress,
        },
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
      });

      // Create communication_event
      const communicationEventId = uuidv4();
      const event = await this.prisma.communication_event.create({
        data: {
          id: communicationEventId,
          tenant_id: tenantId,
          provider_id: smsConfig.provider_id,
          channel: 'sms',
          direction: 'outbound',
          to_phone: leadPhone,
          text_body: mergedBody,
          status: 'pending',
          related_entity_type: dto.related_entity_type || 'lead',
          related_entity_id: dto.related_entity_id || lead.id,
          created_by_user_id: userId,
        },
      });

      communicationEventIds.push(event.id);

      // Queue job with delay (rate limiting)
      // CRITICAL: Match exact job data structure expected by SendSmsProcessor
      const job = await this.smsQueue.add(
        'send-sms',
        {
          communicationEventId: event.id,
        },
        {
          delay: delayMs,
          jobId: `bulk-sms-${event.id}`,
        },
      );

      jobs.push(job.id as string);

      // Increment delay for rate limiting
      delayMs += Math.floor(1000 / rateLimit);
    }

    this.logger.log(
      `Queued ${jobs.length} bulk SMS jobs for tenant ${tenantId} (estimated completion: ${Math.ceil(delayMs / 1000)}s)`,
    );

    return {
      queued_count: jobs.length,
      skipped_count: skippedLeads,
      job_ids: jobs,
      communication_event_ids: communicationEventIds,
      estimated_completion_seconds: Math.ceil(delayMs / 1000),
    };
  }

  /**
   * Get bulk SMS status
   *
   * Retrieves status of all SMS in a bulk operation.
   * Shows summary counts and individual event details.
   *
   * @param tenantId - Tenant UUID from JWT token
   * @param communicationEventIds - Array of communication event UUIDs
   * @returns Summary and individual event statuses
   */
  async getBulkSmsStatus(
    tenantId: string,
    communicationEventIds: string[],
  ): Promise<{
    summary: {
      total: number;
      pending: number;
      sent: number;
      delivered: number;
      failed: number;
    };
    events: Array<{
      id: string;
      to_phone: string | null;
      status: string;
      sent_at: Date | null;
      delivered_at: Date | null;
      error_message: string | null;
    }>;
  }> {
    // CRITICAL: Multi-tenant isolation - filter by tenant_id
    const events = await this.prisma.communication_event.findMany({
      where: {
        id: { in: communicationEventIds },
        tenant_id: tenantId, // MANDATORY: Prevent cross-tenant access
      },
      select: {
        id: true,
        to_phone: true,
        status: true,
        sent_at: true,
        delivered_at: true,
        error_message: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    // Calculate summary
    const summary = {
      total: events.length,
      pending: events.filter((e) => e.status === 'pending').length,
      sent: events.filter((e) => e.status === 'sent').length,
      delivered: events.filter((e) => e.status === 'delivered').length,
      failed: events.filter((e) => e.status === 'failed').length,
    };

    this.logger.debug(
      `Bulk SMS status for tenant ${tenantId}: ${summary.delivered}/${summary.total} delivered, ${summary.failed} failed`,
    );

    return { summary, events };
  }
}
