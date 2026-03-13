import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateProjectTemplateDto } from '../dto/create-project-template.dto';
import { UpdateProjectTemplateDto } from '../dto/update-project-template.dto';

@Injectable()
export class ProjectTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
  ) {}

  /**
   * Create a project template, optionally with tasks in a single transaction.
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateProjectTemplateDto,
  ) {
    if (dto.tasks?.length) {
      this.validateTaskDependencies(dto.tasks);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const template = await tx.project_template.create({
        data: {
          tenant_id: tenantId,
          created_by_user_id: userId,
          name: dto.name,
          description: dto.description ?? null,
          industry_type: dto.industry_type ?? null,
        },
      });

      if (dto.tasks?.length) {
        await tx.project_template_task.createMany({
          data: dto.tasks.map((task) => ({
            template_id: template.id,
            tenant_id: tenantId,
            title: task.title,
            description: task.description ?? null,
            estimated_duration_days: task.estimated_duration_days ?? null,
            category: task.category ?? null,
            order_index: task.order_index,
            depends_on_order_index: task.depends_on_order_index ?? null,
          })),
        });
      }

      const created = await tx.project_template.findFirst({
        where: { id: template.id, tenant_id: tenantId },
        include: {
          tasks: { orderBy: { order_index: 'asc' } },
        },
      });

      // Template was just created inside this transaction, so this should never be null
      return created!;
    });

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'project_template',
      entityId: result.id,
      tenantId,
      actorUserId: userId,
      after: { id: result.id, name: result.name, task_count: result.tasks.length },
      description: `Created project template: ${result.name}`,
    });

    return result;
  }

  /**
   * List templates with pagination and optional filters.
   */
  async findAll(
    tenantId: string,
    query: {
      page?: number;
      limit?: number;
      is_active?: boolean;
      industry_type?: string;
    } = {},
  ) {
    let page = query.page ?? 1;
    let limit = query.limit ?? 20;
    if (page < 1) page = 1;
    if (limit > 100) limit = 100;
    if (limit < 1) limit = 1;

    const skip = (page - 1) * limit;

    const where: any = { tenant_id: tenantId };

    if (query.is_active !== undefined) {
      where.is_active = query.is_active;
    }

    if (query.industry_type) {
      where.industry_type = query.industry_type;
    }

    const [data, total] = await Promise.all([
      this.prisma.project_template.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          tasks: { orderBy: { order_index: 'asc' } },
        },
      }),
      this.prisma.project_template.count({ where }),
    ]);

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

  /**
   * Get a single template by ID with its tasks.
   */
  async findOne(tenantId: string, id: string) {
    const template = await this.prisma.project_template.findFirst({
      where: { id, tenant_id: tenantId },
      include: {
        tasks: { orderBy: { order_index: 'asc' } },
      },
    });

    if (!template) {
      throw new NotFoundException('Project template not found');
    }

    return template;
  }

  /**
   * Update a template. If dto.tasks is provided, replace all tasks
   * (delete existing, insert new) within a transaction.
   */
  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateProjectTemplateDto,
  ) {
    const existing = await this.prisma.project_template.findFirst({
      where: { id, tenant_id: tenantId },
      include: { tasks: true },
    });

    if (!existing) {
      throw new NotFoundException('Project template not found');
    }

    if (dto.tasks?.length) {
      this.validateTaskDependencies(dto.tasks);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Build update data from only provided fields (excluding tasks)
      const updateData: any = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined) updateData.description = dto.description;
      if (dto.industry_type !== undefined) updateData.industry_type = dto.industry_type;
      if (dto.is_active !== undefined) updateData.is_active = dto.is_active;

      await tx.project_template.update({
        where: { id },
        data: updateData,
      });

      // If tasks array is provided, replace all existing tasks
      if (Array.isArray(dto.tasks)) {
        await tx.project_template_task.deleteMany({
          where: { template_id: id, tenant_id: tenantId },
        });

        if (dto.tasks.length > 0) {
          await tx.project_template_task.createMany({
            data: dto.tasks.map((task) => ({
              template_id: id,
              tenant_id: tenantId,
              title: task.title,
              description: task.description ?? null,
              estimated_duration_days: task.estimated_duration_days ?? null,
              category: task.category ?? null,
              order_index: task.order_index,
              depends_on_order_index: task.depends_on_order_index ?? null,
            })),
          });
        }
      }

      const updated = await tx.project_template.findFirst({
        where: { id, tenant_id: tenantId },
        include: {
          tasks: { orderBy: { order_index: 'asc' } },
        },
      });

      return updated!;
    });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'project_template',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: { name: existing.name, is_active: existing.is_active, task_count: existing.tasks.length },
      after: { name: result.name, is_active: result.is_active, task_count: result.tasks.length },
      description: `Updated project template: ${result.name}`,
    });

    return result;
  }

  /**
   * Hard delete a template and cascade-delete its tasks.
   */
  async delete(tenantId: string, id: string, userId: string) {
    const existing = await this.prisma.$transaction(async (tx) => {
      const found = await tx.project_template.findFirst({
        where: { id, tenant_id: tenantId },
      });

      if (!found) {
        throw new NotFoundException('Project template not found');
      }

      // Cascade delete is handled by the FK onDelete: Cascade on tasks
      await tx.project_template.delete({
        where: { id },
      });

      return found;
    });

    await this.auditLoggerService.logTenantChange({
      action: 'deleted',
      entityType: 'project_template',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: { id: existing.id, name: existing.name },
      description: `Deleted project template: ${existing.name}`,
    });
  }

  /**
   * Validate that depends_on_order_index references a valid order_index
   * within the same task set, and that no circular dependencies exist.
   */
  private validateTaskDependencies(
    tasks: { order_index: number; depends_on_order_index?: number }[],
  ) {
    const orderIndexes = new Set(tasks.map((t) => t.order_index));

    // Check for duplicate order_index values
    if (orderIndexes.size !== tasks.length) {
      throw new BadRequestException('Duplicate order_index values found in tasks');
    }

    for (const task of tasks) {
      if (task.depends_on_order_index !== undefined && task.depends_on_order_index !== null) {
        if (!orderIndexes.has(task.depends_on_order_index)) {
          throw new BadRequestException(
            `Task at order_index ${task.order_index} references depends_on_order_index ${task.depends_on_order_index} which does not exist in the task list`,
          );
        }
        if (task.depends_on_order_index === task.order_index) {
          throw new BadRequestException(
            `Task at order_index ${task.order_index} cannot depend on itself`,
          );
        }
      }
    }

    // Detect circular dependencies via DFS cycle detection
    const depMap = new Map<number, number>();
    for (const task of tasks) {
      if (task.depends_on_order_index !== undefined && task.depends_on_order_index !== null) {
        depMap.set(task.order_index, task.depends_on_order_index);
      }
    }

    for (const startIndex of orderIndexes) {
      const visited = new Set<number>();
      let current: number | undefined = startIndex;
      while (current !== undefined) {
        if (visited.has(current)) {
          throw new BadRequestException(
            `Circular dependency detected involving task at order_index ${current}`,
          );
        }
        visited.add(current);
        current = depMap.get(current);
      }
    }
  }
}
