import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { StartCompletionDto } from '../dto/start-completion.dto';
import { CompleteChecklistItemDto } from '../dto/complete-checklist-item.dto';
import { AddManualChecklistItemDto } from '../dto/add-manual-checklist-item.dto';
import { AddPunchListItemDto } from '../dto/add-punch-list-item.dto';
import { UpdatePunchListItemDto } from '../dto/update-punch-list-item.dto';

@Injectable()
export class ProjectCompletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. getCompletion — Read current checklist state
  // ---------------------------------------------------------------------------

  async getCompletion(tenantId: string, projectId: string) {
    await this.ensureProjectExists(tenantId, projectId);

    const checklist =
      await this.prisma.project_completion_checklist.findFirst({
        where: { tenant_id: tenantId, project_id: projectId },
        include: {
          items: { orderBy: { order_index: 'asc' } },
          punch_list_items: {
            orderBy: { created_at: 'asc' },
            include: {
              assigned_to_crew: {
                select: { id: true, first_name: true, last_name: true },
              },
            },
          },
        },
      });

    if (!checklist) {
      throw new NotFoundException(
        'No completion checklist exists for this project',
      );
    }

    return this.formatChecklistResponse(checklist);
  }

  // ---------------------------------------------------------------------------
  // 2. startCompletion — Create checklist, optionally from template
  // ---------------------------------------------------------------------------

  async startCompletion(
    tenantId: string,
    projectId: string,
    userId: string,
    dto: StartCompletionDto,
  ) {
    await this.ensureProjectExists(tenantId, projectId);

    // Business rule: one active checklist per project
    const existing =
      await this.prisma.project_completion_checklist.findFirst({
        where: { tenant_id: tenantId, project_id: projectId },
      });

    if (existing) {
      throw new ConflictException(
        'A completion checklist already exists for this project',
      );
    }

    // If template_id provided, validate it exists and belongs to tenant
    let templateItems: Array<{
      id: string;
      title: string;
      is_required: boolean;
      order_index: number;
    }> = [];

    if (dto.template_id) {
      const template =
        await this.prisma.completion_checklist_template.findFirst({
          where: { id: dto.template_id, tenant_id: tenantId },
          include: {
            items: { orderBy: { order_index: 'asc' } },
          },
        });

      if (!template) {
        throw new NotFoundException('Checklist template not found');
      }

      templateItems = template.items;
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const checklist = await tx.project_completion_checklist.create({
        data: {
          tenant_id: tenantId,
          project_id: projectId,
          template_id: dto.template_id ?? null,
          created_by_user_id: userId,
        },
      });

      if (templateItems.length > 0) {
        await tx.project_completion_checklist_item.createMany({
          data: templateItems.map((item) => ({
            tenant_id: tenantId,
            checklist_id: checklist.id,
            title: item.title,
            is_required: item.is_required,
            template_item_id: item.id,
            order_index: item.order_index,
          })),
        });
      }

      return tx.project_completion_checklist.findFirst({
        where: { id: checklist.id, tenant_id: tenantId },
        include: {
          items: { orderBy: { order_index: 'asc' } },
          punch_list_items: {
            orderBy: { created_at: 'asc' },
            include: {
              assigned_to_crew: {
                select: { id: true, first_name: true, last_name: true },
              },
            },
          },
        },
      });
    });

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'project_completion_checklist',
      entityId: result!.id,
      tenantId,
      actorUserId: userId,
      after: {
        id: result!.id,
        project_id: projectId,
        template_id: dto.template_id ?? null,
        item_count: result!.items.length,
      },
      description: `Started completion checklist for project ${projectId}`,
    });

    return this.formatChecklistResponse(result!);
  }

  // ---------------------------------------------------------------------------
  // 3. completeItem — Mark a checklist item as completed
  // ---------------------------------------------------------------------------

  async completeItem(
    tenantId: string,
    projectId: string,
    itemId: string,
    userId: string,
    dto: CompleteChecklistItemDto,
  ) {
    const checklist = await this.getChecklistForProject(tenantId, projectId);

    const item =
      await this.prisma.project_completion_checklist_item.findFirst({
        where: {
          id: itemId,
          checklist_id: checklist.id,
          tenant_id: tenantId,
        },
      });

    if (!item) {
      throw new NotFoundException('Checklist item not found');
    }

    const updated =
      await this.prisma.project_completion_checklist_item.update({
        where: { id: itemId },
        data: {
          is_completed: true,
          completed_at: new Date(),
          completed_by_user_id: userId,
          notes: dto.notes !== undefined ? dto.notes : item.notes,
        },
      });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'project_completion_checklist_item',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      before: { is_completed: item.is_completed, notes: item.notes },
      after: { is_completed: true, notes: updated.notes },
      description: `Completed checklist item: ${item.title}`,
    });

    // Check if all required items are now complete → set checklist.completed_at
    await this.evaluateChecklistCompletion(tenantId, checklist.id);

    return this.getCompletion(tenantId, projectId);
  }

  // ---------------------------------------------------------------------------
  // 4. addManualItem — Add an item not from template
  // ---------------------------------------------------------------------------

  async addManualItem(
    tenantId: string,
    projectId: string,
    userId: string,
    dto: AddManualChecklistItemDto,
  ) {
    const checklist = await this.getChecklistForProject(tenantId, projectId);

    const createdItem =
      await this.prisma.project_completion_checklist_item.create({
        data: {
          tenant_id: tenantId,
          checklist_id: checklist.id,
          title: dto.title,
          is_required: dto.is_required ?? true,
          order_index: dto.order_index,
        },
      });

    // Adding a required item may invalidate checklist completion
    if (dto.is_required !== false) {
      await this.evaluateChecklistCompletion(tenantId, checklist.id);
    }

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'project_completion_checklist_item',
      entityId: createdItem.id,
      tenantId,
      actorUserId: userId,
      after: { title: dto.title, is_required: dto.is_required ?? true },
      description: `Added manual checklist item: ${dto.title}`,
    });

    return this.getCompletion(tenantId, projectId);
  }

  // ---------------------------------------------------------------------------
  // 5. addPunchListItem — Create a punch list deficiency
  // ---------------------------------------------------------------------------

  async addPunchListItem(
    tenantId: string,
    projectId: string,
    userId: string,
    dto: AddPunchListItemDto,
  ) {
    const checklist = await this.getChecklistForProject(tenantId, projectId);

    const created = await this.prisma.punch_list_item.create({
      data: {
        tenant_id: tenantId,
        checklist_id: checklist.id,
        project_id: projectId,
        title: dto.title,
        description: dto.description ?? null,
        assigned_to_crew_id: dto.assigned_to_crew_id ?? null,
        reported_by_user_id: userId,
      },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'punch_list_item',
      entityId: created.id,
      tenantId,
      actorUserId: userId,
      after: {
        id: created.id,
        title: dto.title,
        status: 'open',
      },
      description: `Added punch list item: ${dto.title}`,
    });

    return this.getCompletion(tenantId, projectId);
  }

  // ---------------------------------------------------------------------------
  // 6. updatePunchListItem — Update status, assignment, description
  // ---------------------------------------------------------------------------

  async updatePunchListItem(
    tenantId: string,
    projectId: string,
    itemId: string,
    userId: string,
    dto: UpdatePunchListItemDto,
  ) {
    const checklist = await this.getChecklistForProject(tenantId, projectId);

    const existing = await this.prisma.punch_list_item.findFirst({
      where: {
        id: itemId,
        checklist_id: checklist.id,
        tenant_id: tenantId,
      },
    });

    if (!existing) {
      throw new NotFoundException('Punch list item not found');
    }

    const data: any = {};

    if (dto.status !== undefined) {
      data.status = dto.status;
      // If transitioning to resolved, set timestamps
      if (dto.status === 'resolved' && existing.status !== 'resolved') {
        data.resolved_at = new Date();
        data.resolved_by_user_id = userId;
      }
      // If re-opening from resolved, clear timestamps
      if (dto.status !== 'resolved' && existing.status === 'resolved') {
        data.resolved_at = null;
        data.resolved_by_user_id = null;
      }
    }

    if (dto.description !== undefined) data.description = dto.description;
    if (dto.assigned_to_crew_id !== undefined)
      data.assigned_to_crew_id = dto.assigned_to_crew_id;

    const updated = await this.prisma.punch_list_item.update({
      where: { id: itemId },
      data,
    });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'punch_list_item',
      entityId: itemId,
      tenantId,
      actorUserId: userId,
      before: {
        status: existing.status,
        description: existing.description,
        assigned_to_crew_id: existing.assigned_to_crew_id,
      },
      after: {
        status: updated.status,
        description: updated.description,
        assigned_to_crew_id: updated.assigned_to_crew_id,
      },
      description: `Updated punch list item: ${existing.title}`,
    });

    return this.getCompletion(tenantId, projectId);
  }

  // ---------------------------------------------------------------------------
  // 7. completeProject — Validate and finalize project completion
  // ---------------------------------------------------------------------------

  async completeProject(tenantId: string, projectId: string, userId: string) {
    const project = await this.ensureProjectExists(tenantId, projectId);

    const checklist =
      await this.prisma.project_completion_checklist.findFirst({
        where: { tenant_id: tenantId, project_id: projectId },
        include: {
          items: true,
          punch_list_items: true,
        },
      });

    if (!checklist) {
      throw new ConflictException(
        'Cannot complete project: no completion checklist exists. Start a checklist first.',
      );
    }

    // Validate: all required checklist items completed
    const incompleteRequired = checklist.items.filter(
      (i) => i.is_required && !i.is_completed,
    );

    // Validate: all punch list items resolved
    const unresolvedPunchList = checklist.punch_list_items.filter(
      (p) => p.status !== 'resolved',
    );

    if (incompleteRequired.length > 0 || unresolvedPunchList.length > 0) {
      throw new ConflictException({
        message: 'Cannot complete project: outstanding items remain',
        incomplete_checklist_items: incompleteRequired.map((i) => ({
          id: i.id,
          title: i.title,
        })),
        unresolved_punch_list_items: unresolvedPunchList.map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
        })),
      });
    }

    // All clear — update project status to completed
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'completed',
        actual_completion_date: new Date(),
      },
    });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'project',
      entityId: projectId,
      tenantId,
      actorUserId: userId,
      before: { status: project.status },
      after: { status: 'completed' },
      description: `Completed project via completion checklist`,
    });

    return {
      project_id: projectId,
      status: updated.status,
      actual_completion_date: updated.actual_completion_date,
      checklist_completed_at: checklist.completed_at,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async ensureProjectExists(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  private async getChecklistForProject(
    tenantId: string,
    projectId: string,
  ) {
    await this.ensureProjectExists(tenantId, projectId);

    const checklist =
      await this.prisma.project_completion_checklist.findFirst({
        where: { tenant_id: tenantId, project_id: projectId },
      });

    if (!checklist) {
      throw new NotFoundException(
        'No completion checklist exists for this project. Start a checklist first.',
      );
    }

    return checklist;
  }

  /**
   * Check if all required items are completed. If yes, set completed_at.
   * If a required item was un-completed (or new required item added), clear completed_at.
   */
  private async evaluateChecklistCompletion(
    tenantId: string,
    checklistId: string,
  ) {
    const requiredItems =
      await this.prisma.project_completion_checklist_item.findMany({
        where: {
          checklist_id: checklistId,
          tenant_id: tenantId,
          is_required: true,
        },
        select: { is_completed: true },
      });

    const allRequiredComplete =
      requiredItems.length > 0 &&
      requiredItems.every((i) => i.is_completed);

    const checklist =
      await this.prisma.project_completion_checklist.findFirst({
        where: { id: checklistId, tenant_id: tenantId },
        select: { completed_at: true },
      });

    if (allRequiredComplete && !checklist?.completed_at) {
      await this.prisma.project_completion_checklist.update({
        where: { id: checklistId },
        data: { completed_at: new Date() },
      });
    } else if (!allRequiredComplete && checklist?.completed_at) {
      await this.prisma.project_completion_checklist.update({
        where: { id: checklistId },
        data: { completed_at: null },
      });
    }
  }

  private formatChecklistResponse(checklist: any) {
    return {
      id: checklist.id,
      project_id: checklist.project_id,
      template_id: checklist.template_id,
      completed_at: checklist.completed_at,
      created_at: checklist.created_at,
      items: checklist.items.map((item: any) => ({
        id: item.id,
        title: item.title,
        is_required: item.is_required,
        is_completed: item.is_completed,
        completed_at: item.completed_at,
        completed_by_user_id: item.completed_by_user_id,
        notes: item.notes,
        order_index: item.order_index,
        template_item_id: item.template_item_id,
      })),
      punch_list: checklist.punch_list_items.map((p: any) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        status: p.status,
        assigned_to_crew: p.assigned_to_crew
          ? {
              id: p.assigned_to_crew.id,
              first_name: p.assigned_to_crew.first_name,
              last_name: p.assigned_to_crew.last_name,
            }
          : null,
        resolved_at: p.resolved_at,
        reported_by_user_id: p.reported_by_user_id,
        resolved_by_user_id: p.resolved_by_user_id,
        created_at: p.created_at,
      })),
    };
  }
}
