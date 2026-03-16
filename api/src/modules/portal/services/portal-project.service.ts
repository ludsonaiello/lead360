import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * PortalProjectService — Sprint 32
 *
 * A completely separate service for portal-facing project data.
 * Queries Prisma directly with hand-picked SELECT fields to guarantee
 * that internal data (costs, crew, notes, margins, private logs/photos)
 * is NEVER exposed through the portal API.
 *
 * Design principle: this service never imports or delegates to
 * ProjectService, ProjectLogService, or ProjectPhotoService.
 * This isolation prevents accidental data leakage if internal
 * services are later modified to return additional fields.
 */
@Injectable()
export class PortalProjectService {
  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // 1. listProjects(tenantId, leadId, query)
  // ---------------------------------------------------------------------------

  /**
   * Return all projects where lead_id matches and portal_enabled=true.
   * Only safe-to-expose fields are selected.
   */
  async listProjects(
    tenantId: string,
    leadId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const where = {
      tenant_id: tenantId,
      lead_id: leadId,
      portal_enabled: true,
    };

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        select: {
          id: true,
          project_number: true,
          name: true,
          status: true,
          start_date: true,
          target_completion_date: true,
          progress_percent: true,
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects.map((p) => ({
        id: p.id,
        project_number: p.project_number,
        name: p.name,
        status: p.status,
        start_date: p.start_date
          ? p.start_date.toISOString().split('T')[0]
          : null,
        target_completion_date: p.target_completion_date
          ? p.target_completion_date.toISOString().split('T')[0]
          : null,
        progress_percent: Number(p.progress_percent),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 2. getProjectDetail(tenantId, leadId, projectId)
  // ---------------------------------------------------------------------------

  /**
   * Validate project belongs to lead. Return:
   *   - Basic project info (no costs, no notes, no crew)
   *   - Task titles + statuses (no notes, no costs, no crew)
   *   - Permit statuses (no notes, no internal details)
   */
  async getProjectDetail(
    tenantId: string,
    leadId: string,
    projectId: string,
  ) {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenant_id: tenantId,
        lead_id: leadId,
        portal_enabled: true,
      },
      select: {
        id: true,
        project_number: true,
        name: true,
        description: true,
        status: true,
        start_date: true,
        target_completion_date: true,
        actual_completion_date: true,
        progress_percent: true,
        permit_required: true,
        tasks: {
          where: { deleted_at: null },
          select: {
            id: true,
            title: true,
            status: true,
            order_index: true,
            estimated_start_date: true,
            estimated_end_date: true,
            // NEVER: description, notes, category, costs, crew
          },
          orderBy: { order_index: 'asc' },
        },
        permits: {
          where: { deleted_at: null },
          select: {
            id: true,
            permit_type: true,
            status: true,
            submitted_date: true,
            approved_date: true,
            // NEVER: notes, permit_number, issuing_authority, expiry_date
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return {
      id: project.id,
      project_number: project.project_number,
      name: project.name,
      description: project.description,
      status: project.status,
      start_date: project.start_date
        ? project.start_date.toISOString().split('T')[0]
        : null,
      target_completion_date: project.target_completion_date
        ? project.target_completion_date.toISOString().split('T')[0]
        : null,
      actual_completion_date: project.actual_completion_date
        ? project.actual_completion_date.toISOString().split('T')[0]
        : null,
      progress_percent: Number(project.progress_percent),
      permit_required: project.permit_required,
      tasks: project.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        order_index: t.order_index,
        estimated_start_date: t.estimated_start_date
          ? t.estimated_start_date.toISOString().split('T')[0]
          : null,
        estimated_end_date: t.estimated_end_date
          ? t.estimated_end_date.toISOString().split('T')[0]
          : null,
      })),
      permits: project.permits.map((p) => ({
        id: p.id,
        permit_type: p.permit_type,
        status: p.status,
        submitted_date: p.submitted_date
          ? p.submitted_date.toISOString().split('T')[0]
          : null,
        approved_date: p.approved_date
          ? p.approved_date.toISOString().split('T')[0]
          : null,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // 3. getPublicLogs(tenantId, projectId, leadId, query)
  // ---------------------------------------------------------------------------

  /**
   * Return ONLY is_public=true logs.
   * Includes log content, date, author name, and public attachments.
   * NEVER returns private logs.
   */
  async getPublicLogs(
    tenantId: string,
    projectId: string,
    leadId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    // First verify the project belongs to this lead and is portal-enabled
    await this.verifyProjectOwnership(tenantId, leadId, projectId);

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const where = {
      tenant_id: tenantId,
      project_id: projectId,
      is_public: true, // CRITICAL: Only public logs
    };

    const [logs, total] = await Promise.all([
      this.prisma.project_log.findMany({
        where,
        select: {
          id: true,
          log_date: true,
          content: true,
          weather_delay: true,
          created_at: true,
          author: {
            select: {
              first_name: true,
              last_name: true,
            },
          },
          attachments: {
            select: {
              id: true,
              file_url: true,
              file_name: true,
              file_type: true,
            },
          },
        },
        orderBy: [{ log_date: 'desc' }, { created_at: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.project_log.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        log_date: log.log_date
          ? log.log_date.toISOString().split('T')[0]
          : null,
        content: log.content,
        weather_delay: log.weather_delay,
        author: log.author
          ? `${log.author.first_name ?? ''} ${log.author.last_name ?? ''}`.trim()
          : null,
        attachments: (log.attachments ?? []).map((a) => ({
          id: a.id,
          file_url: a.file_url,
          file_name: a.file_name,
          file_type: a.file_type,
        })),
        created_at: log.created_at,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 4. getPublicPhotos(tenantId, projectId, leadId, query)
  // ---------------------------------------------------------------------------

  /**
   * Return ONLY is_public=true photos.
   * Returns photos with URLs. NEVER returns private photos.
   */
  async getPublicPhotos(
    tenantId: string,
    projectId: string,
    leadId: string,
    query: { page?: number; limit?: number } = {},
  ) {
    // First verify the project belongs to this lead and is portal-enabled
    await this.verifyProjectOwnership(tenantId, leadId, projectId);

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);
    const skip = (page - 1) * limit;

    const where = {
      tenant_id: tenantId,
      project_id: projectId,
      is_public: true, // CRITICAL: Only public photos
    };

    const [photos, total] = await Promise.all([
      this.prisma.project_photo.findMany({
        where,
        select: {
          id: true,
          file_url: true,
          thumbnail_url: true,
          caption: true,
          taken_at: true,
          created_at: true,
          // NEVER: file_id, uploaded_by_user_id, task_id, log_id
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project_photo.count({ where }),
    ]);

    return {
      data: photos.map((photo) => ({
        id: photo.id,
        file_url: photo.file_url,
        thumbnail_url: photo.thumbnail_url,
        caption: photo.caption,
        taken_at: photo.taken_at
          ? photo.taken_at.toISOString().split('T')[0]
          : null,
        created_at: photo.created_at,
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Verify that the project exists, belongs to the given lead,
   * is in the correct tenant, and has portal_enabled=true.
   * Throws NotFoundException if any condition fails — this prevents
   * information leakage about the existence of non-owned projects.
   */
  private async verifyProjectOwnership(
    tenantId: string,
    leadId: string,
    projectId: string,
  ): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: {
        id: projectId,
        tenant_id: tenantId,
        lead_id: leadId,
        portal_enabled: true,
      },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }
  }
}
