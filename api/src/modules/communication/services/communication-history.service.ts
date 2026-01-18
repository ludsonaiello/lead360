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
  channel?: 'email' | 'sms' | 'whatsapp';
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
   */
  async findAll(tenantId: string, filters: CommunicationHistoryFilters) {
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 50, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // Build where clause
    const where: any = {
      tenant_id: tenantId,
    };

    if (filters.channel) {
      where.channel = filters.channel;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.to_email) {
      where.to_email = { contains: filters.to_email };
    }

    if (filters.to_phone) {
      where.to_phone = { contains: filters.to_phone };
    }

    if (filters.date_from || filters.date_to) {
      where.created_at = {};
      if (filters.date_from) {
        where.created_at.gte = new Date(filters.date_from);
      }
      if (filters.date_to) {
        where.created_at.lte = new Date(filters.date_to);
      }
    }

    if (filters.related_entity_type) {
      where.related_entity_type = filters.related_entity_type;
    }

    if (filters.related_entity_id) {
      where.related_entity_id = filters.related_entity_id;
    }

    // Execute query
    const [events, total] = await Promise.all([
      this.prisma.communication_event.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
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
      this.prisma.communication_event.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
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
