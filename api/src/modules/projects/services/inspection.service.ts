import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { ProjectActivityService } from './project-activity.service';
import { CreateInspectionDto } from '../dto/create-inspection.dto';
import { UpdateInspectionDto } from '../dto/update-inspection.dto';

@Injectable()
export class InspectionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly projectActivityService: ProjectActivityService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. create(tenantId, projectId, permitId, userId, dto)
  // ---------------------------------------------------------------------------

  async create(
    tenantId: string,
    projectId: string,
    permitId: string,
    userId: string,
    dto: CreateInspectionDto,
  ) {
    // Verify permit exists, belongs to tenant AND project
    const permit = await this.prisma.permit.findFirst({
      where: {
        id: permitId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
      select: { id: true, permit_type: true },
    });

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    // Build data object
    const data: any = {
      tenant_id: tenantId,
      project_id: projectId,
      permit_id: permitId,
      inspection_type: dto.inspection_type,
      scheduled_date: dto.scheduled_date
        ? new Date(dto.scheduled_date)
        : null,
      inspector_name: dto.inspector_name ?? null,
      result: dto.result ?? null,
      reinspection_required: dto.reinspection_required ?? false,
      reinspection_date: dto.reinspection_date
        ? new Date(dto.reinspection_date)
        : null,
      notes: dto.notes ?? null,
      inspected_by_user_id: dto.inspected_by_user_id ?? null,
    };

    // Business rule: result = 'fail' auto-sets reinspection_required = true
    if (data.result === 'fail') {
      data.reinspection_required = true;
    }

    const inspection = await this.prisma.inspection.create({ data });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'inspection',
      entityId: inspection.id,
      tenantId,
      actorUserId: userId,
      after: inspection,
      description: `Inspection "${dto.inspection_type}" created for permit "${permit.permit_type}"`,
    });

    // Project activity
    await this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'inspection_created',
      description: `Inspection "${dto.inspection_type}" created for permit "${permit.permit_type}"`,
      metadata: { inspection_id: inspection.id, permit_id: permitId },
    });

    return this.formatInspectionResponse(inspection);
  }

  // ---------------------------------------------------------------------------
  // 2. update(tenantId, projectId, permitId, inspectionId, userId, dto)
  // ---------------------------------------------------------------------------

  async update(
    tenantId: string,
    projectId: string,
    permitId: string,
    inspectionId: string,
    userId: string,
    dto: UpdateInspectionDto,
  ) {
    // Get current state — validate tenant + project + permit ownership
    const before = await this.prisma.inspection.findFirst({
      where: {
        id: inspectionId,
        tenant_id: tenantId,
        project_id: projectId,
        permit_id: permitId,
        deleted_at: null,
      },
    });

    if (!before) {
      throw new NotFoundException('Inspection not found');
    }

    // Build update data — only include provided fields
    const data: any = {};

    if (dto.inspection_type !== undefined) data.inspection_type = dto.inspection_type;
    if (dto.scheduled_date !== undefined)
      data.scheduled_date = dto.scheduled_date
        ? new Date(dto.scheduled_date)
        : null;
    if (dto.inspector_name !== undefined) data.inspector_name = dto.inspector_name;
    if (dto.result !== undefined) data.result = dto.result;
    if (dto.reinspection_required !== undefined)
      data.reinspection_required = dto.reinspection_required;
    if (dto.reinspection_date !== undefined)
      data.reinspection_date = dto.reinspection_date
        ? new Date(dto.reinspection_date)
        : null;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.inspected_by_user_id !== undefined)
      data.inspected_by_user_id = dto.inspected_by_user_id;

    // Business rule: result = 'fail' auto-sets reinspection_required = true
    if (dto.result === 'fail') {
      data.reinspection_required = true;
    }

    const after = await this.prisma.inspection.update({
      where: { id: inspectionId },
      data,
    });

    // Audit log with before/after state
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'inspection',
      entityId: inspectionId,
      tenantId,
      actorUserId: userId,
      before,
      after,
      description: `Inspection "${after.inspection_type}" updated`,
    });

    // Project activity for result changes
    if (dto.result && dto.result !== before.result) {
      await this.projectActivityService.logActivity(tenantId, {
        project_id: projectId,
        user_id: userId,
        activity_type: 'inspection_result_changed',
        description: `Inspection "${after.inspection_type}" result changed from ${before.result ?? 'none'} to ${dto.result}`,
        metadata: {
          inspection_id: inspectionId,
          permit_id: permitId,
          old_result: before.result,
          new_result: dto.result,
        },
      });
    }

    return this.formatInspectionResponse(after);
  }

  // ---------------------------------------------------------------------------
  // 3. findByPermit(tenantId, projectId, permitId)
  // ---------------------------------------------------------------------------

  async findByPermit(
    tenantId: string,
    projectId: string,
    permitId: string,
  ) {
    // Verify permit exists and belongs to tenant + project
    const permit = await this.prisma.permit.findFirst({
      where: {
        id: permitId,
        tenant_id: tenantId,
        project_id: projectId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!permit) {
      throw new NotFoundException('Permit not found');
    }

    const inspections = await this.prisma.inspection.findMany({
      where: {
        tenant_id: tenantId,
        permit_id: permitId,
        deleted_at: null,
      },
      orderBy: { created_at: 'desc' },
    });

    return inspections.map((i) => this.formatInspectionResponse(i));
  }

  // ---------------------------------------------------------------------------
  // 4. findByPermitRaw(tenantId, permitId)
  //    Internal helper — returns formatted inspections for a permit without
  //    re-validating permit existence (caller already verified).
  // ---------------------------------------------------------------------------

  async findByPermitRaw(tenantId: string, permitId: string) {
    const inspections = await this.prisma.inspection.findMany({
      where: {
        tenant_id: tenantId,
        permit_id: permitId,
        deleted_at: null,
      },
      orderBy: { created_at: 'desc' },
    });

    return inspections.map((i) => this.formatInspectionResponse(i));
  }

  // ---------------------------------------------------------------------------
  // 5. hardDelete(tenantId, projectId, permitId, inspectionId, userId)
  // ---------------------------------------------------------------------------

  async hardDelete(
    tenantId: string,
    projectId: string,
    permitId: string,
    inspectionId: string,
    userId: string,
  ) {
    const inspection = await this.prisma.inspection.findFirst({
      where: {
        id: inspectionId,
        tenant_id: tenantId,
        project_id: projectId,
        permit_id: permitId,
      },
    });

    if (!inspection) {
      throw new NotFoundException('Inspection not found');
    }

    await this.prisma.inspection.delete({
      where: { id: inspectionId },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'inspection',
      entityId: inspectionId,
      tenantId,
      actorUserId: userId,
      before: inspection,
      description: `Inspection "${inspection.inspection_type}" hard-deleted`,
    });

    // Project activity
    await this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'inspection_deleted',
      description: `Inspection "${inspection.inspection_type}" deleted`,
      metadata: { inspection_id: inspectionId, permit_id: permitId },
    });
  }

  // ---------------------------------------------------------------------------
  // 6. countByPermit(tenantId, permitId)
  //    Used by PermitService to block hard-delete when inspections exist.
  // ---------------------------------------------------------------------------

  async countByPermit(tenantId: string, permitId: string): Promise<number> {
    return this.prisma.inspection.count({
      where: {
        tenant_id: tenantId,
        permit_id: permitId,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private formatInspectionResponse(inspection: any) {
    return {
      id: inspection.id,
      permit_id: inspection.permit_id,
      project_id: inspection.project_id,
      inspection_type: inspection.inspection_type,
      scheduled_date: inspection.scheduled_date
        ? this.formatDate(inspection.scheduled_date)
        : null,
      inspector_name: inspection.inspector_name,
      result: inspection.result,
      reinspection_required: inspection.reinspection_required,
      reinspection_date: inspection.reinspection_date
        ? this.formatDate(inspection.reinspection_date)
        : null,
      notes: inspection.notes,
      inspected_by_user_id: inspection.inspected_by_user_id,
      created_at: inspection.created_at.toISOString(),
      updated_at: inspection.updated_at.toISOString(),
    };
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
