import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { FinancialEntryService } from '../../financial/services/financial-entry.service';
import { ProjectNumberGeneratorService } from './project-number-generator.service';
import { ProjectTemplateService } from './project-template.service';
import { ProjectActivityService } from './project-activity.service';
import { CreateProjectDto } from '../dto/create-project.dto';
import { CreateProjectFromQuoteDto } from '../dto/create-project-from-quote.dto';
import { UpdateProjectDto } from '../dto/update-project.dto';
import { PortalAuthService } from '../../portal/services/portal-auth.service';

interface ListProjectsQuery {
  page?: number;
  limit?: number;
  status?: string;
  assigned_pm_user_id?: string;
  search?: string;
}

/**
 * Convert Prisma Decimal fields to plain numbers in a project record.
 * Prisma returns Decimal as strings; the API contract requires numbers.
 */
function normalizeProjectDecimals(project: any) {
  if (!project) return project;
  return {
    ...project,
    contract_value: project.contract_value != null ? Number(project.contract_value) : null,
    estimated_cost: project.estimated_cost != null ? Number(project.estimated_cost) : null,
    progress_percent: project.progress_percent != null ? Number(project.progress_percent) : 0,
  };
}

@Injectable()
export class ProjectService {
  private readonly logger = new Logger(ProjectService.name);

  // Valid quote statuses that allow project creation
  private readonly VALID_QUOTE_STATUSES = ['approved', 'started', 'concluded'];

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
    private readonly financialEntryService: FinancialEntryService,
    private readonly projectNumberGenerator: ProjectNumberGeneratorService,
    private readonly projectTemplateService: ProjectTemplateService,
    private readonly projectActivityService: ProjectActivityService,
    private readonly portalAuthService: PortalAuthService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. createFromQuote
  // ---------------------------------------------------------------------------

  /**
   * Create a project from an accepted quote.
   * - Validates quote status (must be approved/started/concluded)
   * - Generates project number
   * - Creates project record with contract_value from quote.total
   * - Locks quote (deletion_locked = true)
   * - Updates lead status to 'customer'
   * - Seeds project tasks from quote items
   * - Optionally applies template tasks
   */
  async createFromQuote(
    tenantId: string,
    userId: string,
    quoteId: string,
    dto: CreateProjectFromQuoteDto,
  ) {
    // Fetch quote with items — validate tenant ownership
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: {
        items: {
          orderBy: { order_index: 'asc' },
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote not found: ${quoteId}`);
    }

    // Validate quote status
    if (!this.VALID_QUOTE_STATUSES.includes(quote.status)) {
      throw new BadRequestException(
        `Quote status must be one of: ${this.VALID_QUOTE_STATUSES.join(', ')}. Current status: ${quote.status}`,
      );
    }

    // Check if a project already exists for this quote (prevent duplicates)
    const existingProject = await this.prisma.project.findFirst({
      where: { tenant_id: tenantId, quote_id: quoteId },
    });
    if (existingProject) {
      throw new ConflictException(
        `A project already exists for quote ${quoteId}: ${existingProject.project_number}`,
      );
    }

    // If template_id is provided, validate it exists before starting transaction
    if (dto.template_id) {
      await this.projectTemplateService.findOne(tenantId, dto.template_id);
    }

    const project = await this.prisma.$transaction(async (tx) => {
      // a. Generate project number (thread-safe)
      const projectNumber = await this.projectNumberGenerator.generate(
        tenantId,
        tx,
      );

      // b. Create project record
      const newProject = await tx.project.create({
        data: {
          tenant_id: tenantId,
          quote_id: quoteId,
          lead_id: quote.lead_id,
          project_number: projectNumber,
          name: dto.name || quote.title,
          description: dto.description ?? null,
          status: 'planned',
          start_date: dto.start_date ? new Date(dto.start_date) : null,
          target_completion_date: dto.target_completion_date
            ? new Date(dto.target_completion_date)
            : null,
          permit_required: dto.permit_required ?? false,
          assigned_pm_user_id: dto.assigned_pm_user_id ?? null,
          contract_value: quote.total ?? null,
          is_standalone: false,
          portal_enabled: true,
          notes: dto.notes ?? null,
          created_by_user_id: userId,
        },
      });

      // c. Lock quote — prevent deletion
      await tx.quote.update({
        where: { id: quoteId },
        data: { deletion_locked: true },
      });

      // d. Update lead status to 'customer' if lead exists
      if (quote.lead_id) {
        await tx.lead.update({
          where: { id: quote.lead_id },
          data: {
            status: 'customer',
          },
        });
      }

      // e. Create project tasks from quote items
      let orderIndex = 0;
      for (const item of quote.items) {
        await tx.project_task.create({
          data: {
            tenant_id: tenantId,
            project_id: newProject.id,
            quote_item_id: item.id,
            title: item.title,
            description: item.description ?? null,
            status: 'not_started',
            order_index: orderIndex,
            created_by_user_id: userId,
          },
        });
        orderIndex++;
      }

      // f. Apply template tasks if template_id provided (append after quote item tasks)
      if (dto.template_id) {
        const template = await tx.project_template.findFirst({
          where: { id: dto.template_id, tenant_id: tenantId },
          include: {
            tasks: { orderBy: { order_index: 'asc' } },
          },
        });
        if (template) {
          for (const task of template.tasks) {
            await tx.project_task.create({
              data: {
                tenant_id: tenantId,
                project_id: newProject.id,
                title: task.title,
                description: task.description ?? null,
                status: 'not_started',
                estimated_duration_days: task.estimated_duration_days ?? null,
                category: task.category ?? null,
                order_index: orderIndex,
                created_by_user_id: userId,
              },
            });
            orderIndex++;
          }
        }
      }

      return newProject;
    });

    // g. Audit log (outside transaction for non-blocking behavior)
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'project',
      entityId: project.id,
      tenantId,
      actorUserId: userId,
      after: project,
      description: `Created project ${project.project_number} from quote ${quoteId}`,
    });

    // h. Create portal account for the lead (Sprint 31)
    // Only for quote-based projects with a lead. Standalone projects are never eligible.
    if (quote.lead_id) {
      try {
        await this.portalAuthService.createForLead(tenantId, quote.lead_id);
      } catch (error) {
        // Non-blocking: log but do not fail project creation
        this.logger.warn(
          `Failed to create portal account for lead ${quote.lead_id}: ${error.message}`,
        );
      }
    }

    // Return full project with relations
    return this.findOne(tenantId, project.id);
  }

  // ---------------------------------------------------------------------------
  // 2. createStandalone
  // ---------------------------------------------------------------------------

  /**
   * Create a standalone project (not linked to a quote).
   * is_standalone = true, quote_id = null, lead_id = null.
   * Portal account is NEVER created for standalone projects.
   */
  async createStandalone(
    tenantId: string,
    userId: string,
    dto: CreateProjectDto,
  ) {
    // If template_id provided, validate it exists
    if (dto.template_id) {
      await this.projectTemplateService.findOne(tenantId, dto.template_id);
    }

    const project = await this.prisma.$transaction(async (tx) => {
      // a. Generate project number
      const projectNumber = await this.projectNumberGenerator.generate(
        tenantId,
        tx,
      );

      // b. Create project record
      const newProject = await tx.project.create({
        data: {
          tenant_id: tenantId,
          project_number: projectNumber,
          name: dto.name,
          description: dto.description ?? null,
          status: 'planned',
          start_date: dto.start_date ? new Date(dto.start_date) : null,
          target_completion_date: dto.target_completion_date
            ? new Date(dto.target_completion_date)
            : null,
          permit_required: dto.permit_required ?? false,
          assigned_pm_user_id: dto.assigned_pm_user_id ?? null,
          estimated_cost: dto.estimated_cost ?? null,
          is_standalone: true,
          portal_enabled: false,
          notes: dto.notes ?? null,
          created_by_user_id: userId,
        },
      });

      // c. Apply template tasks if template_id provided
      if (dto.template_id) {
        const template = await tx.project_template.findFirst({
          where: { id: dto.template_id, tenant_id: tenantId },
          include: {
            tasks: { orderBy: { order_index: 'asc' } },
          },
        });
        if (template) {
          let orderIndex = 0;
          for (const task of template.tasks) {
            await tx.project_task.create({
              data: {
                tenant_id: tenantId,
                project_id: newProject.id,
                title: task.title,
                description: task.description ?? null,
                status: 'not_started',
                estimated_duration_days: task.estimated_duration_days ?? null,
                category: task.category ?? null,
                order_index: orderIndex,
                created_by_user_id: userId,
              },
            });
            orderIndex++;
          }
        }
      }

      return newProject;
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'created',
      entityType: 'project',
      entityId: project.id,
      tenantId,
      actorUserId: userId,
      after: project,
      description: `Created standalone project ${project.project_number}`,
    });

    return this.findOne(tenantId, project.id);
  }

  // ---------------------------------------------------------------------------
  // 3. findAll
  // ---------------------------------------------------------------------------

  /**
   * Paginated list of projects. Includes task_count and completed_task_count.
   */
  async findAll(tenantId: string, query: ListProjectsQuery) {
    const page = Math.max(query.page || 1, 1);
    const limit = Math.min(Math.max(query.limit || 20, 1), 100);
    const skip = (page - 1) * limit;

    const where: any = {
      tenant_id: tenantId,
    };

    if (query.status) {
      where.status = query.status;
    }

    if (query.assigned_pm_user_id) {
      where.assigned_pm_user_id = query.assigned_pm_user_id;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search } },
        { project_number: { contains: query.search } },
      ];
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        include: {
          assigned_pm_user: {
            select: { id: true, first_name: true, last_name: true },
          },
          quote: {
            select: { id: true, quote_number: true, title: true },
          },
          lead: {
            select: { id: true, first_name: true, last_name: true },
          },
          _count: {
            select: {
              tasks: {
                where: { deleted_at: null },
              },
            },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.project.count({ where }),
    ]);

    // For each project, also get completed task count
    const projectIds = projects.map((p) => p.id);
    const completedCounts = await this.prisma.project_task.groupBy({
      by: ['project_id'],
      where: {
        tenant_id: tenantId,
        project_id: { in: projectIds },
        status: 'done',
        deleted_at: null,
      },
      _count: { id: true },
    });

    const completedMap = new Map(
      completedCounts.map((c) => [c.project_id, c._count.id]),
    );

    const data = projects.map((project) => normalizeProjectDecimals({
      ...project,
      assigned_pm: project.assigned_pm_user,
      assigned_pm_user: undefined,
      task_count: project._count.tasks,
      completed_task_count: completedMap.get(project.id) || 0,
      _count: undefined,
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ---------------------------------------------------------------------------
  // 4. findOne
  // ---------------------------------------------------------------------------

  /**
   * Full project detail with relations and task counts.
   */
  async findOne(tenantId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        assigned_pm_user: {
          select: { id: true, first_name: true, last_name: true },
        },
        quote: {
          select: { id: true, quote_number: true, title: true },
        },
        lead: {
          select: { id: true, first_name: true, last_name: true },
        },
        created_by_user: {
          select: { id: true, first_name: true, last_name: true },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Get task counts
    const [taskCount, completedTaskCount] = await Promise.all([
      this.prisma.project_task.count({
        where: {
          tenant_id: tenantId,
          project_id: id,
          deleted_at: null,
        },
      }),
      this.prisma.project_task.count({
        where: {
          tenant_id: tenantId,
          project_id: id,
          status: 'done',
          deleted_at: null,
        },
      }),
    ]);

    return normalizeProjectDecimals({
      ...project,
      assigned_pm: project.assigned_pm_user,
      assigned_pm_user: undefined,
      task_count: taskCount,
      completed_task_count: completedTaskCount,
    });
  }

  // ---------------------------------------------------------------------------
  // 5. update
  // ---------------------------------------------------------------------------

  /**
   * Update project fields.
   * If status changes to 'completed', actual_completion_date is set automatically.
   */
  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateProjectDto,
  ) {
    const existing = await this.prisma.project.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!existing) {
      throw new NotFoundException('Project not found');
    }

    const data: any = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) {
      data.status = dto.status;
      // Auto-set actual_completion_date when status becomes completed
      if (dto.status === 'completed' && existing.status !== 'completed') {
        data.actual_completion_date = new Date();
      }
      // Clear actual_completion_date if moving away from completed
      if (dto.status !== 'completed' && existing.status === 'completed') {
        data.actual_completion_date = null;
      }
    }
    if (dto.start_date !== undefined) {
      data.start_date = dto.start_date ? new Date(dto.start_date) : null;
    }
    if (dto.target_completion_date !== undefined) {
      data.target_completion_date = dto.target_completion_date
        ? new Date(dto.target_completion_date)
        : null;
    }
    if (dto.permit_required !== undefined) {
      data.permit_required = dto.permit_required;
    }
    if (dto.assigned_pm_user_id !== undefined) {
      data.assigned_pm_user_id = dto.assigned_pm_user_id;
    }
    if (dto.portal_enabled !== undefined) {
      data.portal_enabled = dto.portal_enabled;
    }
    if (dto.notes !== undefined) data.notes = dto.notes;

    const updated = await this.prisma.project.update({
      where: { id },
      data,
    });

    // Audit log with before/after
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'project',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: existing,
      after: updated,
      description: `Updated project ${existing.project_number}`,
    });

    return this.findOne(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // 6. softDelete
  // ---------------------------------------------------------------------------

  /**
   * Soft-delete a project. Only if no active (non-done) tasks exist.
   * Sets deletion_locked = true to prevent further operations.
   */
  async softDelete(tenantId: string, id: string, userId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (project.deletion_locked) {
      throw new BadRequestException(
        'This project is locked and cannot be deleted',
      );
    }

    // Check for active tasks
    const activeTasks = await this.prisma.project_task.count({
      where: {
        tenant_id: tenantId,
        project_id: id,
        status: { in: ['in_progress', 'blocked'] },
        deleted_at: null,
      },
    });

    if (activeTasks > 0) {
      throw new BadRequestException(
        `Cannot delete project with ${activeTasks} active task(s). Complete or remove active tasks first.`,
      );
    }

    // Soft delete: set status to canceled
    await this.prisma.project.update({
      where: { id },
      data: { status: 'canceled' },
    });

    // Audit log
    await this.auditLogger.logTenantChange({
      action: 'deleted',
      entityType: 'project',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: project,
      description: `Soft-deleted project ${project.project_number}`,
    });

    return { message: 'Project deleted successfully' };
  }

  // ---------------------------------------------------------------------------
  // 7. getFinancialSummary
  // ---------------------------------------------------------------------------

  /**
   * Get combined financial summary for a project.
   * Delegates cost breakdown to FinancialEntryService.
   * Adds contract_value, estimated_cost, receipt_count, and margin calculations.
   */
  async getFinancialSummary(tenantId: string, projectId: string) {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: {
        id: true,
        project_number: true,
        contract_value: true,
        estimated_cost: true,
        progress_percent: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Delegate to FinancialEntryService for cost breakdown
    const costSummary = await this.financialEntryService.getProjectCostSummary(
      tenantId,
      projectId,
    );

    // Task counts + receipt count in parallel
    const [taskCount, completedTaskCount, receiptCount] = await Promise.all([
      this.prisma.project_task.count({
        where: {
          tenant_id: tenantId,
          project_id: projectId,
          deleted_at: null,
        },
      }),
      this.prisma.project_task.count({
        where: {
          tenant_id: tenantId,
          project_id: projectId,
          status: 'done',
          deleted_at: null,
        },
      }),
      this.prisma.receipt.count({
        where: {
          tenant_id: tenantId,
          project_id: projectId,
        },
      }),
    ]);

    // costSummary already contains project_id — destructure to avoid duplication
    const { project_id: _pid, ...costBreakdown } = costSummary;

    const contractValue = project.contract_value != null
      ? Number(project.contract_value)
      : null;
    const estimatedCost = project.estimated_cost != null
      ? Number(project.estimated_cost)
      : null;
    const totalActualCost = costBreakdown.total_actual_cost;

    // Margin calculations — null when contract_value is not set (e.g. standalone projects)
    const marginEstimated =
      contractValue != null && estimatedCost != null
        ? Math.round((contractValue - estimatedCost) * 100) / 100
        : null;
    const marginActual =
      contractValue != null
        ? Math.round((contractValue - totalActualCost) * 100) / 100
        : null;

    return {
      project_id: project.id,
      project_number: project.project_number,
      contract_value: contractValue,
      estimated_cost: estimatedCost,
      progress_percent: Number(project.progress_percent),
      task_count: taskCount,
      completed_task_count: completedTaskCount,
      ...costBreakdown,
      receipt_count: receiptCount,
      margin_estimated: marginEstimated,
      margin_actual: marginActual,
    };
  }

  // ---------------------------------------------------------------------------
  // 8. getChangeOrdersRedirect — Sprint 24
  // ---------------------------------------------------------------------------

  /**
   * Returns the redirect URL for the Change Orders tab of the project's linked quote.
   * Standalone projects (no quote_id) are rejected with 400.
   */
  async getChangeOrdersRedirect(
    tenantId: string,
    projectId: string,
  ): Promise<{ redirect_url: string }> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true, quote_id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    if (!project.quote_id) {
      throw new BadRequestException(
        'This project was not created from a quote. Change orders are not available for standalone projects.',
      );
    }

    return {
      redirect_url: `/quotes/${project.quote_id}?tab=change-orders`,
    };
  }

  // ---------------------------------------------------------------------------
  // 9. recomputeProgress
  // ---------------------------------------------------------------------------

  /**
   * Recompute progress_percent for a project based on task completion.
   * Formula: (done tasks / total tasks) * 100
   * Called internally after task status changes.
   */
  async recomputeProgress(tenantId: string, projectId: string) {
    const [totalTasks, doneTasks] = await Promise.all([
      this.prisma.project_task.count({
        where: {
          tenant_id: tenantId,
          project_id: projectId,
          deleted_at: null,
        },
      }),
      this.prisma.project_task.count({
        where: {
          tenant_id: tenantId,
          project_id: projectId,
          status: 'done',
          deleted_at: null,
        },
      }),
    ]);

    const progressPercent =
      totalTasks > 0
        ? Math.round((doneTasks / totalTasks) * 10000) / 100
        : 0;

    // Use updateMany with tenant_id to enforce tenant isolation
    const result = await this.prisma.project.updateMany({
      where: { id: projectId, tenant_id: tenantId },
      data: { progress_percent: progressPercent },
    });

    if (result.count === 0) {
      this.logger.warn(
        `recomputeProgress: project ${projectId} not found for tenant ${tenantId}`,
      );
    }

    return { progress_percent: progressPercent, totalTasks, doneTasks };
  }

  // ---------------------------------------------------------------------------
  // 10. applyTemplate
  // ---------------------------------------------------------------------------

  /**
   * Apply a project template to an existing project.
   * Creates project_task records from template tasks and resolves
   * depends_on_order_index references into task_dependency records.
   *
   * Tasks are appended after any existing tasks in the project.
   */
  async applyTemplate(
    tenantId: string,
    projectId: string,
    templateId: string,
    userId: string,
  ): Promise<{ tasks_created: number; dependencies_created: number }> {
    // 1. Fetch template with tasks — validate tenant ownership and active status
    const template = await this.prisma.project_template.findFirst({
      where: { id: templateId, tenant_id: tenantId },
      include: {
        tasks: { orderBy: { order_index: 'asc' } },
      },
    });

    if (!template) {
      throw new NotFoundException(`Template not found: ${templateId}`);
    }

    if (!template.is_active) {
      throw new BadRequestException(
        'Template is inactive and cannot be applied',
      );
    }

    // 2. Fetch project — validate tenant ownership
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
    });

    if (!project) {
      throw new NotFoundException(`Project not found: ${projectId}`);
    }

    if (template.tasks.length === 0) {
      return { tasks_created: 0, dependencies_created: 0 };
    }

    // 3. Execute in a transaction for atomicity
    const result = await this.prisma.$transaction(async (tx) => {
      // a. Determine starting order_index — append after existing tasks
      const maxOrderResult = await tx.project_task.aggregate({
        where: {
          tenant_id: tenantId,
          project_id: projectId,
          deleted_at: null,
        },
        _max: { order_index: true },
      });

      const startingIndex =
        maxOrderResult._max.order_index != null
          ? maxOrderResult._max.order_index + 1
          : 0;

      // b. Create project_task records from template tasks
      //    Track mapping: template task order_index → created project_task id
      const orderIndexToTaskId = new Map<number, string>();

      for (const templateTask of template.tasks) {
        const createdTask = await tx.project_task.create({
          data: {
            tenant_id: tenantId,
            project_id: projectId,
            title: templateTask.title,
            description: templateTask.description ?? null,
            status: 'not_started',
            estimated_duration_days:
              templateTask.estimated_duration_days ?? null,
            category: templateTask.category ?? null,
            order_index: startingIndex + templateTask.order_index,
            created_by_user_id: userId,
          },
        });

        orderIndexToTaskId.set(templateTask.order_index, createdTask.id);
      }

      // c. Resolve dependencies: depends_on_order_index → task_dependency records
      let dependenciesCreated = 0;

      for (const templateTask of template.tasks) {
        if (templateTask.depends_on_order_index == null) continue;

        const currentTaskId = orderIndexToTaskId.get(
          templateTask.order_index,
        );
        const prerequisiteTaskId = orderIndexToTaskId.get(
          templateTask.depends_on_order_index,
        );

        if (!currentTaskId || !prerequisiteTaskId) {
          this.logger.warn(
            `applyTemplate: could not resolve dependency for template task ` +
              `order_index=${templateTask.order_index} → depends_on=${templateTask.depends_on_order_index}`,
          );
          continue;
        }

        await tx.task_dependency.create({
          data: {
            tenant_id: tenantId,
            task_id: currentTaskId,
            depends_on_task_id: prerequisiteTaskId,
            dependency_type: 'finish_to_start',
            created_by_user_id: userId,
          },
        });

        dependenciesCreated++;
      }

      return {
        tasks_created: template.tasks.length,
        dependencies_created: dependenciesCreated,
      };
    });

    // 4. Audit log (outside transaction)
    await this.auditLogger.logTenantChange({
      action: 'updated',
      entityType: 'project',
      entityId: projectId,
      tenantId,
      actorUserId: userId,
      after: {
        template_id: templateId,
        template_name: template.name,
        tasks_created: result.tasks_created,
        dependencies_created: result.dependencies_created,
      },
      description: `Applied template "${template.name}" to project ${project.project_number}: ${result.tasks_created} tasks, ${result.dependencies_created} dependencies`,
    });

    // 5. Activity log
    this.projectActivityService.logActivity(tenantId, {
      project_id: projectId,
      user_id: userId,
      activity_type: 'task_created',
      description: `Applied template "${template.name}" — created ${result.tasks_created} task(s) with ${result.dependencies_created} dependency(ies)`,
      metadata: {
        template_id: templateId,
        template_name: template.name,
        tasks_created: result.tasks_created,
        dependencies_created: result.dependencies_created,
      },
    });

    return result;
  }
}
