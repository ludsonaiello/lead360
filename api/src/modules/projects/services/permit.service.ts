import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectActivityService } from './project-activity.service';
import { InspectionService } from './inspection.service';
import { CreatePermitDto } from '../dto/create-permit.dto';
import { UpdatePermitDto } from '../dto/update-permit.dto';

@Injectable()
export class PermitService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly projectActivityService: ProjectActivityService,
    private readonly inspectionService: InspectionService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. create(tenantId, projectId, userId, dto)
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    projectId: string,
    userId: string,
    dto: CreatePermitDto,
  ) {
    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true, name: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Build data object
    const data: any = {
      tenant_id: tenantId,
      project_id: projectId,
      created_by_user_id: userId,
      permit_type: dto.permit_type,
      permit_number: dto.permit_number ?? null,
      status: dto.status ?? 'pending_application',
      submitted_date: dto.submitted_date
        ? new Date(dto.submitted_date)
        : null,
      approved_date: dto.approved_date ? new Date(dto.approved_date) : null,
      expiry_date: dto.expiry_date ? new Date(dto.expiry_date) : null,
      issuing_authority: dto.issuing_authority ?? null,
      notes: dto.notes ?? null,
    };

    // If status is 'approved' and approved_date not set, auto-set to today
    if (data.status === 'approved' && !data.approved_date) {
      data.approved_date = new Date();
    }

    const permit = await this.prisma.permit.create({ data });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'permit',
      entityId: permit.id,
      tenantId,
      actorUserId: userId,
      after: permit,
      description: `Permit "${dto.permit_type}" created for project "${project.name}"`,
    });

    // Project activity
    await this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'permit_created',
      description: `Permit "${dto.permit_type}" created`,
      metadata: { permit_id: permit.id },
    });

    return this.formatPermitResponse(permit);
  }

  // ---------------------------------------------------------------------------
  // 2. findAll(tenantId, projectId, query)
  // ---------------------------------------------------------------------------

  async findAll(
    tenantId: string,
    projectId: string,
    query: { status?: string } = {},
  ) {
    // Verify project exists and belongs to tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    const where: any = {
      tenant_id: tenantId,
      project_id: projectId,
      deleted_at: null,
    };

    if (query.status) {
      where.status = query.status;
    }

    const permits = await this.prisma.permit.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    return Promise.all(permits.map((p) => this.formatPermitResponse(p)));
  }

  // ---------------------------------------------------------------------------
  // 3. findOne(tenantId, projectId, permitId)
  // ---------------------------------------------------------------------------

  async findOne(tenantId: string, projectId: string, permitId: string) {
    const permit = await this.prisma.permit.findFirst({
      where: {
        id: permitId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
    });

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    return this.formatPermitResponse(permit);
  }

  // ---------------------------------------------------------------------------
  // 4. update(tenantId, projectId, permitId, userId, dto)
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    projectId: string,
    permitId: string,
    userId: string,
    dto: UpdatePermitDto,
  ) {
    // Get current state
    const before = await this.prisma.permit.findFirst({
      where: {
        id: permitId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
    });

    if (!before) {
      throw new NotFoundException('Permit not found');
    }

    // Build update data
    const data: any = {};

    if (dto.permit_number !== undefined) data.permit_number = dto.permit_number;
    if (dto.permit_type !== undefined) data.permit_type = dto.permit_type;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.submitted_date !== undefined)
      data.submitted_date = dto.submitted_date
        ? new Date(dto.submitted_date)
        : null;
    if (dto.approved_date !== undefined)
      data.approved_date = dto.approved_date
        ? new Date(dto.approved_date)
        : null;
    if (dto.expiry_date !== undefined)
      data.expiry_date = dto.expiry_date ? new Date(dto.expiry_date) : null;
    if (dto.issuing_authority !== undefined)
      data.issuing_authority = dto.issuing_authority;
    if (dto.notes !== undefined) data.notes = dto.notes;

    // Business rule: auto-set approved_date when transitioning TO 'approved'
    if (
      dto.status === 'approved' &&
      before.status !== 'approved' &&
      !data.approved_date &&
      !before.approved_date
    ) {
      data.approved_date = new Date();
    }

    const after = await this.prisma.permit.update({
      where: { id: permitId },
      data,
    });

    // Audit log with before/after
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'permit',
      entityId: permitId,
      tenantId,
      actorUserId: userId,
      before,
      after,
      description: `Permit "${after.permit_type}" updated`,
    });

    // Project activity for status changes
    if (dto.status && dto.status !== before.status) {
      await this.projectActivityService.logActivity(tenantId, {
        project_id: projectId,
        user_id: userId,
        activity_type: 'permit_status_changed',
        description: `Permit "${after.permit_type}" status changed from ${before.status} to ${dto.status}`,
        metadata: { permit_id: permitId, old_status: before.status, new_status: dto.status },
      });
    }

    return this.formatPermitResponse(after);
  }

  // ---------------------------------------------------------------------------
  // 5. hardDelete(tenantId, projectId, permitId, userId)
  // ---------------------------------------------------------------------------

  async hardDelete(
    tenantId: string,
    projectId: string,
    permitId: string,
    userId: string,
  ) {
    const permit = await this.prisma.permit.findFirst({
      where: {
        id: permitId,
        tenant_id: tenantId,
        project_id: projectId,
      },
    });

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    // Business rule: cannot hard-delete if linked inspections exist.
    const inspectionCount = await this.inspectionService.countByPermit(
      tenantId,
      permitId,
    );
    if (inspectionCount > 0) {
      throw new ConflictException(
        'Cannot delete permit with linked inspections. Use deactivate instead.',
      );
    }

    await this.prisma.permit.delete({
      where: { id: permitId },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'permit',
      entityId: permitId,
      tenantId,
      actorUserId: userId,
      before: permit,
      description: `Permit "${permit.permit_type}" hard-deleted`,
    });

    // Project activity
    await this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'permit_deleted',
      description: `Permit "${permit.permit_type}" deleted`,
      metadata: { permit_id: permitId },
    });
  }

  // ---------------------------------------------------------------------------
  // 6. softDelete / deactivate(tenantId, projectId, permitId, userId)
  // ---------------------------------------------------------------------------

  async deactivate(
    tenantId: string,
    projectId: string,
    permitId: string,
    userId: string,
  ) {
    const permit = await this.prisma.permit.findFirst({
      where: {
        id: permitId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
    });

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    const deactivated = await this.prisma.permit.update({
      where: { id: permitId },
      data: { deleted_at: new Date() },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'permit',
      entityId: permitId,
      tenantId,
      actorUserId: userId,
      before: permit,
      after: deactivated,
      description: `Permit "${permit.permit_type}" deactivated (soft delete)`,
    });

    // Project activity
    await this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'permit_deactivated',
      description: `Permit "${permit.permit_type}" deactivated`,
      metadata: { permit_id: permitId },
    });

    return this.formatPermitResponse(deactivated);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async formatPermitResponse(permit: any) {
    // Fetch linked inspections for this permit
    const inspections = await this.inspectionService.findByPermitRaw(
      permit.tenant_id,
      permit.id,
    );

    return {
      id: permit.id,
      project_id: permit.project_id,
      permit_number: permit.permit_number,
      permit_type: permit.permit_type,
      status: permit.status,
      submitted_date: permit.submitted_date
        ? this.formatDate(permit.submitted_date)
        : null,
      approved_date: permit.approved_date
        ? this.formatDate(permit.approved_date)
        : null,
      expiry_date: permit.expiry_date
        ? this.formatDate(permit.expiry_date)
        : null,
      issuing_authority: permit.issuing_authority,
      notes: permit.notes,
      inspections,
      created_at: permit.created_at.toISOString(),
      updated_at: permit.updated_at.toISOString(),
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
