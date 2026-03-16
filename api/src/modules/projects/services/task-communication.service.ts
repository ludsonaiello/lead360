import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { SmsSendingService } from '../../communication/services/sms-sending.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectActivityService } from './project-activity.service';
import { SendTaskSmsDto } from '../dto/send-task-sms.dto';

@Injectable()
export class TaskCommunicationService {
  private readonly logger = new Logger(TaskCommunicationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smsSendingService: SmsSendingService,
    private readonly auditLogger: AuditLoggerService,
    private readonly projectActivityService: ProjectActivityService,
  ) {}

  /**
   * Send SMS from a task context.
   *
   * Resolution order for phone:
   *   1. dto.to_phone (explicit)
   *   2. Lead's primary phone (via project.lead_id)
   *
   * Resolution order for lead_id:
   *   1. dto.lead_id (explicit)
   *   2. project.lead_id (auto-resolved)
   */
  async sendSmsFromTask(
    tenantId: string,
    projectId: string,
    taskId: string,
    userId: string,
    dto: SendTaskSmsDto,
  ) {
    // 1. Fetch task — validate it exists and belongs to tenant + project
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
      select: { id: true, title: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    // 2. Fetch project — need lead_id for phone resolution
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        name: true,
        lead_id: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // 3. Resolve lead_id: dto.lead_id → project.lead_id
    const resolvedLeadId = dto.lead_id || project.lead_id || null;

    // 4. Resolve to_phone
    let resolvedPhone = dto.to_phone || null;

    if (!resolvedPhone) {
      // No explicit phone — must resolve from lead
      if (!resolvedLeadId) {
        throw new BadRequestException(
          'Standalone projects require an explicit to_phone',
        );
      }

      resolvedPhone = await this.resolveLeadPrimaryPhone(
        tenantId,
        resolvedLeadId,
      );
    }

    // 5. Call SmsSendingService
    const smsResponse = await this.smsSendingService.sendSms(
      tenantId,
      userId,
      {
        to_phone: resolvedPhone,
        text_body: dto.text_body,
        lead_id: resolvedLeadId || undefined,
        related_entity_type: 'project_task',
        related_entity_id: taskId,
      },
    );

    // 6. Audit log
    this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'task_sms',
      entityId: smsResponse.communication_event_id,
      tenantId,
      actorUserId: userId,
      after: {
        task_id: taskId,
        project_id: projectId,
        to_phone: resolvedPhone,
        lead_id: resolvedLeadId,
        communication_event_id: smsResponse.communication_event_id,
      },
      description: `SMS sent from task "${task.title}" on project "${project.name}"`,
    });

    // 7. Activity log
    this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'sms_sent',
      description: `SMS sent from task "${task.title}"`,
      metadata: {
        task_id: taskId,
        to_phone: resolvedPhone,
        communication_event_id: smsResponse.communication_event_id,
      },
    });

    // 8. Return response
    return {
      message: smsResponse.message,
      communication_event_id: smsResponse.communication_event_id,
      to_phone: smsResponse.to_phone,
      status: smsResponse.status,
    };
  }

  /**
   * Resolve the primary phone number for a lead.
   * Throws BadRequestException if no primary phone is found.
   */
  private async resolveLeadPrimaryPhone(
    tenantId: string,
    leadId: string,
  ): Promise<string> {
    // Verify lead exists and belongs to tenant
    const lead = await this.prisma.lead.findFirst({
      where: {
        id: leadId,
        tenant_id: tenantId,
      },
      select: {
        id: true,
        phones: {
          where: { is_primary: true },
          select: { phone: true },
          take: 1,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    if (!lead.phones || lead.phones.length === 0) {
      throw new BadRequestException(
        'No phone number available for this lead',
      );
    }

    const rawPhone = lead.phones[0].phone;

    // Normalize to E.164 if not already
    return this.normalizeToE164(rawPhone);
  }

  /**
   * Normalize a phone number to E.164 format.
   * Handles common US formats:
   *   - 10-digit: 9781234567 → +19781234567
   *   - 11-digit: 19781234567 → +19781234567
   *   - Already E.164: +19781234567 → +19781234567
   */
  private normalizeToE164(phone: string): string {
    // Strip non-digit chars except leading +
    const cleaned = phone.replace(/[^\d+]/g, '');

    if (cleaned.startsWith('+')) {
      return cleaned;
    }

    const digitsOnly = cleaned.replace(/\D/g, '');

    if (digitsOnly.length === 10) {
      return `+1${digitsOnly}`;
    }

    if (digitsOnly.length === 11 && digitsOnly.startsWith('1')) {
      return `+${digitsOnly}`;
    }

    // Best effort: prepend +
    return `+${digitsOnly}`;
  }
}
