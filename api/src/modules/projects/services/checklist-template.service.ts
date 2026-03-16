import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { CreateChecklistTemplateDto } from '../dto/create-checklist-template.dto';
import { UpdateChecklistTemplateDto } from '../dto/update-checklist-template.dto';

@Injectable()
export class ChecklistTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLoggerService: AuditLoggerService,
  ) {}

  /**
   * Create a checklist template with items in a single transaction.
   * Enforces unique name per tenant.
   */
  async create(
    tenantId: string,
    userId: string,
    dto: CreateChecklistTemplateDto,
  ) {
    // Check for duplicate name within tenant
    const existing = await this.prisma.completion_checklist_template.findFirst({
      where: { tenant_id: tenantId, name: dto.name },
    });

    if (existing) {
      throw new ConflictException(
        'A checklist template with this name already exists',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const template = await tx.completion_checklist_template.create({
        data: {
          tenant_id: tenantId,
          created_by_user_id: userId,
          name: dto.name,
          description: dto.description ?? null,
        },
      });

      if (dto.items.length > 0) {
        await tx.completion_checklist_template_item.createMany({
          data: dto.items.map((item) => ({
            template_id: template.id,
            tenant_id: tenantId,
            title: item.title,
            description: item.description ?? null,
            is_required: item.is_required ?? true,
            order_index: item.order_index,
          })),
        });
      }

      return tx.completion_checklist_template.findFirst({
        where: { id: template.id, tenant_id: tenantId },
        include: {
          items: { orderBy: { order_index: 'asc' } },
        },
      });
    });

    await this.auditLoggerService.logTenantChange({
      action: 'created',
      entityType: 'completion_checklist_template',
      entityId: result!.id,
      tenantId,
      actorUserId: userId,
      after: {
        id: result!.id,
        name: result!.name,
        item_count: result!.items.length,
      },
      description: `Created checklist template: ${result!.name}`,
    });

    return result;
  }

  /**
   * List templates with pagination and optional filters.
   * Includes items ordered by order_index.
   */
  async findAll(
    tenantId: string,
    query: {
      is_active?: boolean;
      page?: number;
      limit?: number;
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

    const [data, total] = await Promise.all([
      this.prisma.completion_checklist_template.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          items: { orderBy: { order_index: 'asc' } },
        },
      }),
      this.prisma.completion_checklist_template.count({ where }),
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
   * Get a single template by ID with its items.
   */
  async findOne(tenantId: string, id: string) {
    const template =
      await this.prisma.completion_checklist_template.findFirst({
        where: { id, tenant_id: tenantId },
        include: {
          items: { orderBy: { order_index: 'asc' } },
        },
      });

    if (!template) {
      throw new NotFoundException('Checklist template not found');
    }

    return template;
  }

  /**
   * Update a template. If items array is provided, replace all items
   * (delete existing, insert new) within a transaction.
   */
  async update(
    tenantId: string,
    id: string,
    userId: string,
    dto: UpdateChecklistTemplateDto,
  ) {
    const existing =
      await this.prisma.completion_checklist_template.findFirst({
        where: { id, tenant_id: tenantId },
        include: { items: true },
      });

    if (!existing) {
      throw new NotFoundException('Checklist template not found');
    }

    // If name is being changed, check for uniqueness
    if (dto.name !== undefined && dto.name !== existing.name) {
      const duplicate =
        await this.prisma.completion_checklist_template.findFirst({
          where: { tenant_id: tenantId, name: dto.name, NOT: { id } },
        });

      if (duplicate) {
        throw new ConflictException(
          'A checklist template with this name already exists',
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // Build update data from only provided fields (excluding items)
      const updateData: any = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (dto.description !== undefined)
        updateData.description = dto.description;
      if (dto.is_active !== undefined) updateData.is_active = dto.is_active;

      if (Object.keys(updateData).length > 0) {
        await tx.completion_checklist_template.update({
          where: { id },
          data: updateData,
        });
      }

      // If items array is provided, replace all existing items
      if (Array.isArray(dto.items)) {
        await tx.completion_checklist_template_item.deleteMany({
          where: { template_id: id, tenant_id: tenantId },
        });

        if (dto.items.length > 0) {
          await tx.completion_checklist_template_item.createMany({
            data: dto.items.map((item) => ({
              template_id: id,
              tenant_id: tenantId,
              title: item.title,
              description: item.description ?? null,
              is_required: item.is_required ?? true,
              order_index: item.order_index,
            })),
          });
        }
      }

      return tx.completion_checklist_template.findFirst({
        where: { id, tenant_id: tenantId },
        include: {
          items: { orderBy: { order_index: 'asc' } },
        },
      });
    });

    await this.auditLoggerService.logTenantChange({
      action: 'updated',
      entityType: 'completion_checklist_template',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: {
        name: existing.name,
        is_active: existing.is_active,
        item_count: existing.items.length,
      },
      after: {
        name: result!.name,
        is_active: result!.is_active,
        item_count: result!.items.length,
      },
      description: `Updated checklist template: ${result!.name}`,
    });

    return result;
  }

  /**
   * Hard delete a template. Items cascade-delete via FK.
   */
  async delete(tenantId: string, id: string, userId: string) {
    const existing = await this.prisma.$transaction(async (tx) => {
      const found = await tx.completion_checklist_template.findFirst({
        where: { id, tenant_id: tenantId },
      });

      if (!found) {
        throw new NotFoundException('Checklist template not found');
      }

      await tx.completion_checklist_template.delete({
        where: { id },
      });

      return found;
    });

    await this.auditLoggerService.logTenantChange({
      action: 'deleted',
      entityType: 'completion_checklist_template',
      entityId: id,
      tenantId,
      actorUserId: userId,
      before: { id: existing.id, name: existing.name },
      description: `Deleted checklist template: ${existing.name}`,
    });
  }
}
