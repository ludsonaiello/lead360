import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Allowed activity_type values for project_activity records.
 * Validated at write time to prevent junk data.
 */
const ALLOWED_ACTIVITY_TYPES = [
  'task_created',
  'task_completed',
  'task_delayed',
  'task_assigned',
  'status_changed',
  'log_added',
  'photo_added',
  'document_added',
  'permit_updated',
  'checklist_completed',
  'sms_sent',
  'crew_assigned',
] as const;

export type ProjectActivityType = (typeof ALLOWED_ACTIVITY_TYPES)[number];

interface LogActivityData {
  project_id: string;
  user_id?: string;
  activity_type: string;
  description: string;
  metadata?: any;
}

@Injectable()
export class ProjectActivityService {
  private readonly logger = new Logger(ProjectActivityService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // 1. logActivity
  // ---------------------------------------------------------------------------

  /**
   * Creates a project_activity record. Always includes tenant_id.
   *
   * This is designed to be fire-and-forget safe — callers can await it
   * or call it without await when activity logging should not block
   * the primary mutation.
   *
   * If the activity_type is not in the allowed list, the record is still
   * created but a warning is logged.
   */
  async logActivity(
    tenantId: string,
    data: LogActivityData,
  ): Promise<any> {
    if (!ALLOWED_ACTIVITY_TYPES.includes(data.activity_type as any)) {
      this.logger.warn(
        `Unknown activity_type "${data.activity_type}" for project ${data.project_id}. Recording anyway.`,
      );
    }

    try {
      return await this.prisma.project_activity.create({
        data: {
          tenant_id: tenantId,
          project_id: data.project_id,
          user_id: data.user_id ?? null,
          activity_type: data.activity_type,
          description: data.description,
          metadata: data.metadata ?? undefined,
        },
      });
    } catch (error) {
      // Log error but do not rethrow — activity logging should never
      // break the calling mutation when used fire-and-forget.
      this.logger.error(
        `Failed to log activity for project ${data.project_id}: ${error.message}`,
        error.stack,
      );
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 2. getProjectActivity
  // ---------------------------------------------------------------------------

  /**
   * Returns the last N activities for a project, ordered by created_at DESC.
   */
  async getProjectActivity(
    tenantId: string,
    projectId: string,
    limit: number = 20,
  ): Promise<any[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    return this.prisma.project_activity.findMany({
      where: {
        tenant_id: tenantId,
        project_id: projectId,
      },
      orderBy: { created_at: 'desc' },
      take: safeLimit,
    });
  }

  // ---------------------------------------------------------------------------
  // 3. getTenantRecentActivity
  // ---------------------------------------------------------------------------

  /**
   * Returns the last N activities across ALL projects for the tenant.
   * Joins with project (for name) and user (for actor name).
   * Used by the dashboard (Sprint 34).
   */
  async getTenantRecentActivity(
    tenantId: string,
    limit: number = 20,
  ): Promise<any[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);

    return this.prisma.project_activity.findMany({
      where: {
        tenant_id: tenantId,
      },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            project_number: true,
          },
        },
        user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: safeLimit,
    });
  }
}
