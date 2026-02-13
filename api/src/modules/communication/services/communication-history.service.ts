import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { randomUUID } from 'crypto';

export interface CommunicationHistoryFilters {
  channel?: 'email' | 'sms' | 'whatsapp' | 'call';
  status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  to_email?: string;
  to_phone?: string;
  date_from?: string;
  date_to?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  page?: number;
  limit?: number;
}

/**
 * Communication History Service
 *
 * Provides access to communication event history with filtering and pagination.
 * Supports resending failed messages.
 *
 * Features:
 * - Filtered listing with pagination
 * - Single event retrieval
 * - Resend failed communications
 * - Multi-channel support (email, SMS, WhatsApp)
 */
@Injectable()
export class CommunicationHistoryService {
  private readonly logger = new Logger(CommunicationHistoryService.name);

  constructor(
    @InjectQueue('communication-email') private emailQueue: Queue,
    @InjectQueue('communication-sms') private smsQueue: Queue,
    @InjectQueue('communication-whatsapp') private whatsappQueue: Queue,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * List communication events with filters and pagination
   * Includes email, SMS, WhatsApp, and call records
   */
  async findAll(tenantId: string, filters: CommunicationHistoryFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100); // Max 100 per page

    // Check if we should query calls only, communications only, or both
    const includeMessages =
      !filters.channel ||
      ['email', 'sms', 'whatsapp'].includes(filters.channel);
    const includeCalls = !filters.channel || filters.channel === 'call';

    let allEvents: any[] = [];
    let totalCount = 0;

    // Query communication events (email, SMS, WhatsApp)
    if (includeMessages) {
      const messageWhere: any = {
        tenant_id: tenantId,
      };

      if (filters.channel && filters.channel !== 'call') {
        messageWhere.channel = filters.channel;
      }

      if (filters.status) {
        messageWhere.status = filters.status;
      }

      if (filters.to_email) {
        messageWhere.to_email = { contains: filters.to_email };
      }

      if (filters.to_phone) {
        messageWhere.to_phone = { contains: filters.to_phone };
      }

      if (filters.date_from || filters.date_to) {
        messageWhere.created_at = {};
        if (filters.date_from) {
          messageWhere.created_at.gte = new Date(filters.date_from);
        }
        if (filters.date_to) {
          messageWhere.created_at.lte = new Date(filters.date_to);
        }
      }

      // Handle related entity filtering with smart resolution
      if (filters.related_entity_type === 'lead' && filters.related_entity_id) {
        // Get all quotes, service requests, and other entities for this lead
        const [quotes, serviceRequests] = await Promise.all([
          this.prisma.quote.findMany({
            where: { lead_id: filters.related_entity_id },
            select: { id: true },
          }),
          this.prisma.service_request.findMany({
            where: { lead_id: filters.related_entity_id },
            select: { id: true },
          }),
        ]);

        const quoteIds = quotes.map((q) => q.id);
        const serviceRequestIds = serviceRequests.map((sr) => sr.id);

        // Include communications for:
        // 1. Directly linked to lead
        // 2. Linked to quotes belonging to lead
        // 3. Linked to service requests belonging to lead
        messageWhere.OR = [
          {
            related_entity_type: 'lead',
            related_entity_id: filters.related_entity_id,
          },
          ...(quoteIds.length > 0
            ? [
                {
                  related_entity_type: 'quote',
                  related_entity_id: { in: quoteIds },
                },
              ]
            : []),
          ...(serviceRequestIds.length > 0
            ? [
                {
                  related_entity_type: 'service_request',
                  related_entity_id: { in: serviceRequestIds },
                },
              ]
            : []),
        ];
      } else {
        // Standard filtering for other entity types
        if (filters.related_entity_type) {
          messageWhere.related_entity_type = filters.related_entity_type;
        }

        if (filters.related_entity_id) {
          messageWhere.related_entity_id = filters.related_entity_id;
        }
      }

      const [messageEvents, messageCount] = await Promise.all([
        this.prisma.communication_event.findMany({
          where: messageWhere,
          orderBy: { created_at: 'desc' },
          include: {
            provider: {
              select: {
                provider_name: true,
                provider_key: true,
                provider_type: true,
              },
            },
            created_by_user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
        }),
        this.prisma.communication_event.count({ where: messageWhere }),
      ]);

      allEvents = [...messageEvents];
      totalCount += messageCount;
    }

    // Query call records
    if (includeCalls) {
      const callWhere: any = {
        tenant_id: tenantId,
      };

      // For calls, related_entity_type is always 'lead' and related_entity_id is lead_id
      if (filters.related_entity_type === 'lead' && filters.related_entity_id) {
        callWhere.lead_id = filters.related_entity_id;
      }

      // Map communication statuses to call statuses
      if (filters.status) {
        const statusMap: Record<string, string[]> = {
          pending: ['initiated', 'ringing'],
          sent: ['in_progress'],
          delivered: ['completed'],
          failed: ['failed', 'no_answer', 'busy', 'canceled'],
        };
        if (statusMap[filters.status]) {
          callWhere.status = { in: statusMap[filters.status] };
        }
      }

      // Filter by phone (from or to)
      if (filters.to_phone) {
        callWhere.OR = [
          { from_number: { contains: filters.to_phone } },
          { to_number: { contains: filters.to_phone } },
        ];
      }

      if (filters.date_from || filters.date_to) {
        callWhere.created_at = {};
        if (filters.date_from) {
          callWhere.created_at.gte = new Date(filters.date_from);
        }
        if (filters.date_to) {
          callWhere.created_at.lte = new Date(filters.date_to);
        }
      }

      const [callRecords, callCount] = await Promise.all([
        this.prisma.call_record.findMany({
          where: callWhere,
          orderBy: { created_at: 'desc' },
          include: {
            lead: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
            initiated_by_user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
                email: true,
              },
            },
          },
        }),
        this.prisma.call_record.count({ where: callWhere }),
      ]);

      // Map call records to communication event format
      const mappedCalls = callRecords.map((call) => ({
        id: call.id,
        channel: 'call',
        direction: call.direction,
        status: this.mapCallStatus(call.status),
        to_email: null,
        to_phone:
          call.direction === 'inbound' ? call.to_number : call.from_number,
        from_phone:
          call.direction === 'inbound' ? call.from_number : call.to_number,
        cc_emails: null,
        bcc_emails: null,
        from_email: null,
        from_name: null,
        subject: `${call.direction === 'inbound' ? 'Inbound' : 'Outbound'} Call - ${call.call_type}`,
        html_body: null,
        text_body: `Call duration: ${call.recording_duration_seconds || 0}s`,
        template_key: null,
        template_variables: null,
        attachments: null,
        provider: {
          provider_name: 'Twilio',
          provider_key: 'twilio',
          provider_type: 'voice',
        },
        provider_message_id: call.twilio_call_sid,
        provider_metadata: null,
        error_message: null,
        sent_at: call.started_at,
        delivered_at: call.ended_at,
        opened_at: null,
        clicked_at: null,
        bounced_at: null,
        bounce_type: null,
        related_entity_type: 'lead',
        related_entity_id: call.lead_id,
        created_at: call.created_at,
        created_by_user: call.initiated_by_user,
        // Call-specific fields
        call_sid: call.twilio_call_sid,
        call_status: call.status,
        call_duration: call.recording_duration_seconds,
        recording_url: call.recording_url,
        cost: call.cost ? parseFloat(call.cost.toString()) : null,
      }));

      allEvents = [...allEvents, ...mappedCalls];
      totalCount += callCount;
    }

    // Sort all events by created_at descending
    allEvents.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    // Apply pagination
    const skip = (page - 1) * limit;
    const paginatedEvents = allEvents.slice(skip, skip + limit);

    return {
      events: paginatedEvents,
      pagination: {
        page,
        limit,
        total: totalCount,
        total_pages: Math.ceil(totalCount / limit),
      },
    };
  }

  /**
   * Map call status to communication event status
   */
  private mapCallStatus(callStatus: string): string {
    const statusMap: Record<string, string> = {
      initiated: 'pending',
      ringing: 'pending',
      in_progress: 'sent',
      completed: 'delivered',
      failed: 'failed',
      no_answer: 'failed',
      busy: 'failed',
      canceled: 'failed',
    };
    return statusMap[callStatus] || callStatus;
  }

  /**
   * Get single communication event
   */
  async findOne(tenantId: string, id: string) {
    const event = await this.prisma.communication_event.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      include: {
        provider: {
          select: {
            provider_name: true,
            provider_key: true,
            provider_type: true,
          },
        },
        created_by_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
        webhook_events: {
          orderBy: { created_at: 'desc' },
          select: {
            id: true,
            event_type: true,
            signature_verified: true,
            processed: true,
            created_at: true,
          },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(
        `Communication event '${id}' not found for this tenant`,
      );
    }

    return event;
  }

  /**
   * Resend failed communication
   */
  async resend(tenantId: string, id: string, userId: string) {
    // Find original event
    const originalEvent = await this.prisma.communication_event.findFirst({
      where: {
        id,
        tenant_id: tenantId,
      },
      include: {
        provider: true,
      },
    });

    if (!originalEvent) {
      throw new NotFoundException(
        `Communication event '${id}' not found for this tenant`,
      );
    }

    // Only allow resending failed or bounced events
    if (!['failed', 'bounced'].includes(originalEvent.status)) {
      throw new BadRequestException(
        `Cannot resend communication with status '${originalEvent.status}'. Only failed or bounced communications can be resent.`,
      );
    }

    this.logger.log(
      `Resending ${originalEvent.channel} communication ${id} for tenant ${tenantId}`,
    );

    // Create new communication event (copy of original)
    const newEventId = randomUUID();
    await this.prisma.communication_event.create({
      data: {
        id: newEventId,
        tenant_id: originalEvent.tenant_id,
        channel: originalEvent.channel,
        direction: originalEvent.direction,
        provider_id: originalEvent.provider_id,
        status: 'pending',
        to_email: originalEvent.to_email,
        to_phone: originalEvent.to_phone,
        cc_emails: originalEvent.cc_emails ?? undefined,
        bcc_emails: originalEvent.bcc_emails ?? undefined,
        from_email: originalEvent.from_email,
        from_name: originalEvent.from_name,
        subject: originalEvent.subject,
        html_body: originalEvent.html_body,
        text_body: originalEvent.text_body,
        template_key: originalEvent.template_key,
        template_variables: originalEvent.template_variables ?? undefined,
        attachments: originalEvent.attachments ?? undefined,
        related_entity_type: originalEvent.related_entity_type,
        related_entity_id: originalEvent.related_entity_id,
        created_by_user_id: userId,
      },
    });

    // Re-queue based on channel
    const jobId = randomUUID();
    const jobOptions = {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential' as const,
        delay: 2000,
      },
      removeOnComplete: {
        age: 86400,
        count: 1000,
      },
      removeOnFail: false,
    };

    switch (originalEvent.channel) {
      case 'email':
        await this.emailQueue.add(
          'send-email',
          {
            communication_event_id: newEventId,
            tenant_id: tenantId,
            to: originalEvent.to_email,
            cc: originalEvent.cc_emails || undefined,
            bcc: originalEvent.bcc_emails || undefined,
            subject: originalEvent.subject,
            html_body: originalEvent.html_body,
            text_body: originalEvent.text_body,
            from_email: originalEvent.from_email,
            from_name: originalEvent.from_name,
            attachments: originalEvent.attachments ?? undefined,
          },
          jobOptions,
        );
        break;

      case 'sms':
        await this.smsQueue.add(
          'send-sms',
          {
            communication_event_id: newEventId,
            tenant_id: tenantId,
            to: originalEvent.to_phone,
            body: originalEvent.text_body,
          },
          jobOptions,
        );
        break;

      case 'whatsapp':
        await this.whatsappQueue.add(
          'send-whatsapp',
          {
            communication_event_id: newEventId,
            tenant_id: tenantId,
            to: originalEvent.to_phone,
            body: originalEvent.text_body,
          },
          jobOptions,
        );
        break;

      default:
        throw new BadRequestException(
          `Unsupported channel: ${originalEvent.channel}`,
        );
    }

    this.logger.log(
      `Communication resent: original=${id}, new=${newEventId}, job=${jobId}`,
    );

    return {
      job_id: jobId,
      communication_event_id: newEventId,
      original_event_id: id,
      status: 'queued',
      message: 'Communication queued for resending',
    };
  }
}
