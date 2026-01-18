import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { EmailTemplatesService } from './email-templates.service';
import { TenantEmailConfigService } from './tenant-email-config.service';
import { PlatformEmailConfigService } from './platform-email-config.service';
import { randomUUID } from 'crypto';
import {
  SendTemplatedEmailDto,
  SendRawEmailDto,
} from '../dto/send-email.dto';

/**
 * Send Email Service
 *
 * Queues emails via BullMQ for asynchronous sending.
 * Supports both templated and raw emails.
 *
 * Features:
 * - Template rendering with Handlebars
 * - Email queueing via BullMQ
 * - Communication event tracking
 * - Tenant and platform email config support
 */
@Injectable()
export class SendEmailService {
  private readonly logger = new Logger(SendEmailService.name);

  constructor(
    @InjectQueue('communication-email') private emailQueue: Queue,
    private readonly prisma: PrismaService,
    private readonly templatesService: EmailTemplatesService,
    private readonly tenantEmailConfig: TenantEmailConfigService,
    private readonly platformEmailConfig: PlatformEmailConfigService,
  ) {}

  /**
   * Send templated email (renders template then queues)
   */
  async sendTemplated(
    tenantId: string | null,
    dto: SendTemplatedEmailDto,
    userId?: string,
  ) {
    this.logger.log(
      `Sending templated email: ${dto.template_key} to ${dto.to} (tenant: ${tenantId || 'platform'})`,
    );

    // Render template with variables
    const rendered = await this.templatesService.renderTemplate(
      tenantId,
      dto.template_key,
      dto.variables,
    );

    // Load email configuration
    const emailConfig = await this.loadEmailConfig(tenantId);

    // Create communication event record
    const eventId = randomUUID();
    await this.prisma.communication_event.create({
      data: {
        id: eventId,
        tenant_id: tenantId,
        channel: 'email',
        direction: 'outbound',
        provider_id: emailConfig.provider_id,
        status: 'pending',
        to_email: dto.to,
        cc_emails: dto.cc ?? undefined,
        bcc_emails: dto.bcc ?? undefined,
        from_email: emailConfig.from_email,
        from_name: emailConfig.from_name,
        subject: rendered.subject,
        html_body: rendered.html_body,
        text_body: rendered.text_body ?? undefined,
        template_key: dto.template_key,
        template_variables: dto.variables ?? undefined,
        related_entity_type: dto.related_entity_type,
        related_entity_id: dto.related_entity_id,
        created_by_user_id: userId,
      },
    });

    // Queue email job
    const jobId = randomUUID();
    await this.emailQueue.add(
      'send-email',
      {
        communication_event_id: eventId,
        tenant_id: tenantId,
        to: dto.to,
        cc: dto.cc ?? undefined,
        bcc: dto.bcc ?? undefined,
        subject: rendered.subject,
        html_body: rendered.html_body,
        text_body: rendered.text_body ?? undefined,
        from_email: emailConfig.from_email,
        from_name: emailConfig.from_name,
        reply_to: emailConfig.reply_to_email ?? undefined,
      },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400, // 24 hours
          count: 1000,
        },
        removeOnFail: false, // Keep failed jobs for debugging
      },
    );

    this.logger.log(
      `Email queued: job=${jobId}, event=${eventId}, to=${dto.to}`,
    );

    return {
      job_id: jobId,
      communication_event_id: eventId,
      status: 'queued',
      message: 'Email queued for sending',
    };
  }

  /**
   * Send raw email (no template, queues directly)
   */
  async sendRaw(
    tenantId: string | null,
    dto: SendRawEmailDto,
    userId?: string,
  ) {
    this.logger.log(
      `Sending raw email: "${dto.subject}" to ${dto.to} (tenant: ${tenantId || 'platform'})`,
    );

    // Load email configuration
    const emailConfig = await this.loadEmailConfig(tenantId);

    // Create communication event record
    const eventId = randomUUID();
    await this.prisma.communication_event.create({
      data: {
        id: eventId,
        tenant_id: tenantId,
        channel: 'email',
        direction: 'outbound',
        provider_id: emailConfig.provider_id,
        status: 'pending',
        to_email: dto.to,
        cc_emails: dto.cc ?? undefined,
        bcc_emails: dto.bcc ?? undefined,
        from_email: emailConfig.from_email,
        from_name: emailConfig.from_name,
        subject: dto.subject,
        html_body: dto.html_body ?? undefined,
        text_body: dto.text_body ?? undefined,
        attachments: dto.attachments ?? undefined,
        related_entity_type: dto.related_entity_type,
        related_entity_id: dto.related_entity_id,
        created_by_user_id: userId,
      },
    });

    // Queue email job
    const jobId = randomUUID();
    await this.emailQueue.add(
      'send-email',
      {
        communication_event_id: eventId,
        tenant_id: tenantId,
        to: dto.to,
        cc: dto.cc ?? undefined,
        bcc: dto.bcc ?? undefined,
        subject: dto.subject,
        html_body: dto.html_body ?? undefined,
        text_body: dto.text_body ?? undefined,
        from_email: emailConfig.from_email,
        from_name: emailConfig.from_name,
        reply_to: emailConfig.reply_to_email ?? undefined,
        attachments: dto.attachments ?? undefined,
      },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: {
          age: 86400,
          count: 1000,
        },
        removeOnFail: false,
      },
    );

    this.logger.log(
      `Raw email queued: job=${jobId}, event=${eventId}, to=${dto.to}`,
    );

    return {
      job_id: jobId,
      communication_event_id: eventId,
      status: 'queued',
      message: 'Email queued for sending',
    };
  }

  /**
   * Load email configuration for tenant or platform
   */
  private async loadEmailConfig(tenantId: string | null) {
    if (tenantId) {
      // Use tenant-specific configuration
      try {
        const config = await this.tenantEmailConfig.getActiveProvider(tenantId);
        return {
          provider_id: config.provider_id,
          from_email: config.from_email,
          from_name: config.from_name,
          reply_to_email: config.reply_to_email ?? null,
        };
      } catch (error) {
        this.logger.warn(
          `Tenant ${tenantId} has no email config, falling back to platform config`,
        );
        // Fall through to platform config
      }
    }

    // Use platform configuration
    const platformConfig = await this.platformEmailConfig.get();
    if (!platformConfig) {
      throw new NotFoundException(
        'No email configuration found. Please configure email settings.',
      );
    }

    if (!platformConfig.provider_id) {
      throw new NotFoundException(
        'Platform email configuration is missing provider. Please configure email settings.',
      );
    }

    return {
      provider_id: platformConfig.provider_id,
      from_email: platformConfig.from_email,
      from_name: platformConfig.from_name,
      reply_to_email: null,
    };
  }
}
