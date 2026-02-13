import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { SendSmsDto } from '../dto/sms/send-sms.dto';
import { SendSmsResponseDto } from '../dto/sms/send-sms-response.dto';
import { TemplateMergeService } from './template-merge.service';
import { v4 as uuidv4 } from 'uuid';

/**
 * SMS Sending Service
 *
 * Orchestrates the SMS sending flow:
 * 1. Validates tenant has active SMS configuration
 * 2. Validates Lead belongs to tenant (if lead_id provided)
 * 3. Checks opt-out status (TCPA compliance)
 * 4. Creates communication_event record
 * 5. Queues SMS job for processing
 *
 * IMPORTANT: This service does NOT send SMS directly.
 * It delegates to existing SendSmsProcessor via BullMQ queue.
 *
 * Multi-tenant isolation: All queries filtered by tenant_id from JWT.
 * RBAC: Endpoint enforces Owner, Admin, Manager, Sales roles only.
 */
@Injectable()
export class SmsSendingService {
  private readonly logger = new Logger(SmsSendingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly templateMergeService: TemplateMergeService,
    @InjectQueue('communication-sms') private readonly smsQueue: Queue,
  ) {}

  /**
   * Send SMS to a recipient
   *
   * Flow:
   * 1. Validate tenant has active & verified SMS config
   * 2. If lead_id provided:
   *    - Verify Lead belongs to tenant (multi-tenant isolation)
   *    - Check opt-out status (TCPA compliance)
   *    - Load primary phone if to_phone not provided
   * 3. Create communication_event record
   * 4. Queue SMS job
   *
   * @param tenantId - Tenant UUID from JWT token
   * @param userId - User UUID from JWT token
   * @param dto - SMS sending data
   * @returns Response with communication_event_id and job_id
   * @throws NotFoundException if SMS config or Lead not found
   * @throws BadRequestException if phone number missing
   * @throws ForbiddenException if recipient opted out
   */
  async sendSms(
    tenantId: string,
    userId: string,
    dto: SendSmsDto,
  ): Promise<SendSmsResponseDto> {
    // Step 1: Validate tenant has active SMS configuration
    const smsConfig = await this.prisma.tenant_sms_config.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      select: {
        id: true,
        provider_id: true,
        from_phone: true,
        is_verified: true,
      },
    });

    if (!smsConfig) {
      throw new NotFoundException(
        'No active SMS configuration found. Please configure Twilio settings first.',
      );
    }

    if (!smsConfig.is_verified) {
      throw new BadRequestException(
        'SMS configuration is not verified. Please test your configuration first.',
      );
    }

    // Step 2: Handle template_id if provided
    let messageBody = dto.text_body;

    if (dto.template_id) {
      // Load template and verify it belongs to tenant
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

      // Load merge data from database
      const mergeData = await this.templateMergeService.loadMergeData(
        tenantId,
        userId,
        dto.lead_id,
      );

      // Merge template with data
      messageBody = await this.templateMergeService.mergeTemplate(
        template.template_body,
        mergeData,
      );

      // Increment template usage count
      await this.prisma.sms_template.update({
        where: { id: template.id },
        data: { usage_count: { increment: 1 } },
      });

      this.logger.log(
        `Using template ${template.id} "${template.name}" for SMS (usage_count: ${template.usage_count + 1})`,
      );
    }

    // Step 3: If lead_id provided, validate Lead and load phone
    let recipientPhone = dto.to_phone;

    if (dto.lead_id) {
      // CRITICAL: Multi-tenant isolation - check tenant_id
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: dto.lead_id,
          tenant_id: tenantId, // MANDATORY: Prevent cross-tenant access
        },
        select: {
          id: true,
          first_name: true,
          last_name: true,
          sms_opt_out: true,
          sms_opt_out_at: true,
          phones: {
            where: { is_primary: true },
            select: { phone: true },
            take: 1,
          },
        },
      });

      if (!lead) {
        throw new NotFoundException(
          'Lead not found or does not belong to your organization',
        );
      }

      // Check opt-out status (TCPA compliance)
      if (lead.sms_opt_out === true) {
        this.logger.warn(
          `Blocked SMS to Lead ${dto.lead_id} - user has opted out (TCPA compliance)`,
        );
        throw new ForbiddenException(
          'Cannot send SMS: recipient has opted out (replied STOP)',
        );
      }

      // If to_phone not provided, use Lead's primary phone
      if (!recipientPhone && lead.phones && lead.phones.length > 0) {
        recipientPhone = lead.phones[0].phone;
      }
    }

    // Step 4: Validate message body exists (either from text_body or template)
    if (!messageBody || messageBody.trim().length === 0) {
      throw new BadRequestException(
        'Message body is required (provide text_body or template_id)',
      );
    }

    // Step 5: Validate phone number exists
    if (!recipientPhone) {
      throw new BadRequestException(
        'Recipient phone number is required (provide to_phone or lead_id with a phone number)',
      );
    }

    // Step 6: Parse and validate scheduled_at if provided
    let scheduledAt: Date | null = null;
    if (dto.scheduled_at) {
      scheduledAt = new Date(dto.scheduled_at);

      // Validate not in past
      if (scheduledAt <= new Date()) {
        throw new BadRequestException('scheduled_at must be in the future');
      }

      // Validate not too far in future (max 90 days)
      const maxDate = new Date();
      maxDate.setDate(maxDate.getDate() + 90);
      if (scheduledAt > maxDate) {
        throw new BadRequestException(
          'scheduled_at cannot be more than 90 days in the future',
        );
      }

      this.logger.log(
        `SMS scheduled for ${scheduledAt.toISOString()} (tenant: ${tenantId})`,
      );
    }

    // Step 7: Create communication_event record
    const communicationEventId = uuidv4();

    const communicationEvent = await this.prisma.communication_event.create({
      data: {
        id: communicationEventId,
        tenant_id: tenantId,
        provider_id: smsConfig.provider_id,
        channel: 'sms',
        direction: 'outbound',
        to_phone: recipientPhone,
        text_body: messageBody, // Use merged template body or original text_body
        status: scheduledAt ? 'scheduled' : 'pending', // Set status based on scheduling
        scheduled_at: scheduledAt,
        scheduled_by: scheduledAt ? userId : null,
        related_entity_type:
          dto.related_entity_type || (dto.lead_id ? 'lead' : undefined),
        related_entity_id: dto.related_entity_id || dto.lead_id,
        created_by_user_id: userId,
      },
    });

    this.logger.log(
      `Created communication_event ${communicationEvent.id} for SMS to ${recipientPhone} (tenant: ${tenantId}, status: ${scheduledAt ? 'scheduled' : 'pending'})`,
    );

    // Step 8: Queue SMS job with delay if scheduled
    // Calculate delay in milliseconds (0 for immediate sending)
    const delay = scheduledAt ? scheduledAt.getTime() - Date.now() : 0;

    // CRITICAL: Match exact job data structure expected by SendSmsProcessor
    const job = await this.smsQueue.add(
      'send-sms',
      {
        communicationEventId: communicationEvent.id,
      },
      {
        delay, // BullMQ delay in milliseconds
        jobId: `sms-${communicationEvent.id}`, // For tracking and cancellation
      },
    );

    if (scheduledAt) {
      this.logger.log(
        `Scheduled SMS job ${job.id} for communication_event ${communicationEvent.id} at ${scheduledAt.toISOString()} (delay: ${delay}ms)`,
      );
    } else {
      this.logger.log(
        `Queued SMS job ${job.id} for communication_event ${communicationEvent.id} (immediate delivery)`,
      );
    }

    // Step 9: Return response
    return {
      communication_event_id: communicationEvent.id,
      job_id: job.id as string,
      status: scheduledAt ? 'scheduled' : 'queued',
      message: scheduledAt
        ? `SMS scheduled for delivery at ${scheduledAt.toISOString()}`
        : 'SMS queued for delivery',
      to_phone: recipientPhone,
      from_phone: smsConfig.from_phone,
      scheduled_at: scheduledAt?.toISOString(),
    };
  }
}
