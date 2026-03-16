import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../../core/database/prisma.service';
import { NotificationsService } from '../../communication/services/notifications.service';
import { InsuranceExpiryCheckProcessor } from './insurance-expiry-check.processor';

/**
 * TaskDelayCheckProcessor — Sprint 16, extended Sprint 33
 *
 * BullMQ processor on the 'project-management' queue.
 * Routes jobs by name to the appropriate handler:
 *
 *  - 'project-task-delay-check'       → delay check logic (Sprint 16)
 *  - 'subcontractor-insurance-check'  → insurance expiry logic (Sprint 33)
 *
 * For every active tenant:
 *   1. Find in_progress projects
 *   2. Find tasks where estimated_end_date < now AND status != 'done' AND is_delayed = false
 *   3. Persist is_delayed = true
 *   4. Create notification for the assigned PM (or broadcast if no PM)
 *
 * Multi-tenant isolation: each tenant is processed independently.
 * If one tenant fails, processing continues for remaining tenants.
 */
@Processor('project-management')
export class TaskDelayCheckProcessor extends WorkerHost {
  private readonly logger = new Logger(TaskDelayCheckProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
    private readonly insuranceExpiryCheck: InsuranceExpiryCheckProcessor,
  ) {
    super();
    this.logger.log(
      'TaskDelayCheckProcessor worker initialized and ready',
    );
  }

  async process(job: Job): Promise<any> {
    const jobId = job.data?.jobId || (job.id as string);

    // -----------------------------------------------------------------------
    // Job-name routing (Sprint 33) — single worker, multiple job types
    // -----------------------------------------------------------------------
    if (job.name === 'subcontractor-insurance-check') {
      this.logger.log(
        `Processing insurance expiry check job ${jobId}`,
      );
      try {
        const results = await this.insuranceExpiryCheck.execute();
        this.logger.log(
          `Insurance expiry check job ${jobId} completed — ` +
            `tenants: ${results.tenants_processed}/${results.tenants_total}, ` +
            `subs checked: ${results.subcontractors_checked}, ` +
            `compliance updated: ${results.compliance_updated}, ` +
            `notifications: ${results.notifications_sent}`,
        );
        return { success: true, ...results };
      } catch (error) {
        this.logger.error(
          `Insurance expiry check job ${jobId} failed: ${error.message}`,
          error.stack,
        );
        throw error;
      }
    }

    // Default: delay check (Sprint 16)
    this.logger.log(`Processing delay check job ${jobId}`);

    try {
      const results = await this.executeDelayCheck();
      this.logger.log(
        `Delay check job ${jobId} completed — ` +
          `tenants: ${results.tenants_processed}/${results.tenants_total}, ` +
          `tasks updated: ${results.tasks_updated}, ` +
          `notifications: ${results.notifications_sent}`,
      );
      return { success: true, ...results };
    } catch (error) {
      this.logger.error(
        `Delay check job ${jobId} failed: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Core execution logic — processes ALL active tenants
  // ---------------------------------------------------------------------------

  private async executeDelayCheck(): Promise<{
    tenants_processed: number;
    tenants_total: number;
    tasks_updated: number;
    notifications_sent: number;
    errors?: string[];
  }> {
    const tenants = await this.prisma.tenant.findMany({
      where: { is_active: true, deleted_at: null },
      select: { id: true, company_name: true },
    });

    let totalTenantsProcessed = 0;
    let totalTasksUpdated = 0;
    let totalNotificationsSent = 0;
    const errors: string[] = [];

    for (const tenant of tenants) {
      try {
        const result = await this.processTenant(tenant.id);
        totalTenantsProcessed++;
        totalTasksUpdated += result.tasksUpdated;
        totalNotificationsSent += result.notificationsSent;
      } catch (error) {
        this.logger.error(
          `Failed to process tenant ${tenant.id} (${tenant.company_name}): ${error.message}`,
          error.stack,
        );
        errors.push(`Tenant ${tenant.id}: ${error.message}`);
        // Continue to next tenant — never let one tenant block the rest
      }
    }

    return {
      tenants_processed: totalTenantsProcessed,
      tenants_total: tenants.length,
      tasks_updated: totalTasksUpdated,
      notifications_sent: totalNotificationsSent,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  // ---------------------------------------------------------------------------
  // Per-tenant processing
  // ---------------------------------------------------------------------------

  private async processTenant(
    tenantId: string,
  ): Promise<{ tasksUpdated: number; notificationsSent: number }> {
    const now = new Date();

    // -----------------------------------------------------------------------
    // Step 1: Clear stale is_delayed flags
    // Tasks that were previously flagged but are no longer overdue (e.g.,
    // estimated_end_date was extended, or task was completed).
    // -----------------------------------------------------------------------
    await this.prisma.project_task.updateMany({
      where: {
        tenant_id: tenantId,
        is_delayed: true,
        deleted_at: null,
        OR: [
          { status: 'done' },
          { estimated_end_date: { gte: now } },
          { estimated_end_date: null },
        ],
      },
      data: { is_delayed: false },
    });

    // -----------------------------------------------------------------------
    // Step 2: Find in_progress projects and flag newly delayed tasks
    // -----------------------------------------------------------------------
    const projects = await this.prisma.project.findMany({
      where: {
        tenant_id: tenantId,
        status: 'in_progress',
      },
      select: {
        id: true,
        name: true,
        assigned_pm_user_id: true,
      },
    });

    let tasksUpdated = 0;
    let notificationsSent = 0;

    for (const project of projects) {
      // Find tasks that are overdue but NOT yet flagged as delayed
      const newlyDelayedTasks = await this.prisma.project_task.findMany({
        where: {
          tenant_id: tenantId,
          project_id: project.id,
          estimated_end_date: { lt: now },
          status: { not: 'done' },
          is_delayed: false,
          deleted_at: null,
        },
        select: {
          id: true,
          title: true,
        },
      });

      if (newlyDelayedTasks.length === 0) continue;

      // Batch update is_delayed = true (with tenant isolation)
      const taskIds = newlyDelayedTasks.map((t) => t.id);
      await this.prisma.project_task.updateMany({
        where: {
          id: { in: taskIds },
          tenant_id: tenantId,
        },
        data: { is_delayed: true },
      });
      tasksUpdated += newlyDelayedTasks.length;

      // Create notification for each newly delayed task
      for (const task of newlyDelayedTasks) {
        try {
          await this.notificationsService.createNotification({
            tenant_id: tenantId,
            user_id: project.assigned_pm_user_id || null,
            type: 'task_delayed',
            title: 'Task Delayed',
            message: `Task '${task.title}' in project '${project.name}' is past its estimated end date.`,
            action_url: `/projects/${project.id}/tasks/${task.id}`,
            related_entity_type: 'project_task',
            related_entity_id: task.id,
          });
          notificationsSent++;
        } catch (error) {
          this.logger.warn(
            `Failed to create notification for task ${task.id}: ${error.message}`,
          );
          // Notification failure must not stop processing
        }
      }
    }

    return { tasksUpdated, notificationsSent };
  }
}
