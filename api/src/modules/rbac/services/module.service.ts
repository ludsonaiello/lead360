import { randomBytes } from 'crypto';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * Module Service - Module Management
 *
 * Handles:
 * - Listing all modules with permissions
 * - Creating modules (Platform Admin only)
 * - Updating modules (metadata, sort order, icons)
 * - Soft deleting modules (cascades to permissions and roles)
 * - Audit logging
 */
@Injectable()
export class ModuleService {
  private readonly logger = new Logger(ModuleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all modules with their permissions
   */
  async getAllModules(includeInactive = false) {
    return this.prisma.module.findMany({
      where: includeInactive ? {} : { is_active: true },
      include: {
        permission: {
          where: includeInactive ? {} : { is_active: true },
          select: {
            id: true,
            action: true,
            display_name: true,
            description: true,
            is_active: true,
            _count: {
              select: {
                role_permission: true,
              },
            },
          },
          orderBy: { action: 'asc' },
        },
        _count: {
          select: {
            permission: true,
          },
        },
      },
      orderBy: { sort_order: 'asc' },
    });
  }

  /**
   * Get single module by ID
   */
  async getModule(moduleId: string) {
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        permission: {
          select: {
            id: true,
            action: true,
            display_name: true,
            description: true,
            is_active: true,
            _count: {
              select: {
                role_permission: true,
              },
            },
          },
          orderBy: { action: 'asc' },
        },
        _count: {
          select: {
            permission: true,
          },
        },
      },
    });

    if (!module) {
      throw new NotFoundException(`Module not found`);
    }

    return module;
  }

  /**
   * Get module by name
   */
  async getModuleByName(name: string) {
    const module = await this.prisma.module.findUnique({
      where: { name },
      include: {
        permission: {
          where: { is_active: true },
          select: {
            id: true,
            action: true,
            display_name: true,
            description: true,
            is_active: true,
          },
          orderBy: { action: 'asc' },
        },
      },
    });

    if (!module) {
      throw new NotFoundException(`Module "${name}" not found`);
    }

    return module;
  }

  /**
   * Create module (Platform Admin only)
   *
   * @param name - Module name (must be unique, lowercase, no spaces)
   * @param displayName - Human-readable name
   * @param description - Optional description
   * @param icon - Optional icon name (e.g., "Users", "FileText")
   * @param sortOrder - Display order (default: 0)
   * @param createdByUserId - Platform Admin user ID
   */
  async createModule(
    name: string,
    displayName: string,
    description: string | null,
    icon: string | null,
    sortOrder: number,
    createdByUserId: string,
  ) {
    // Verify creator is Platform Admin
    const creator = await this.prisma.user.findUnique({
      where: { id: createdByUserId },
      select: { is_platform_admin: true },
    });

    if (!creator?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can create modules',
      );
    }

    // Validate name format (lowercase, no spaces)
    if (!/^[a-z_]+$/.test(name)) {
      throw new BadRequestException(
        'Module name must be lowercase letters and underscores only',
      );
    }

    // Check for duplicate name
    const existing = await this.prisma.module.findUnique({
      where: { name },
    });

    if (existing) {
      throw new ConflictException(`Module "${name}" already exists`);
    }

    // Create module
    const module = await this.prisma.module.create({
      data: {
        id: randomBytes(16).toString('hex'),
        name,
        display_name: displayName,
        description,
        icon,
        sort_order: sortOrder,
        is_active: true,
      },
    });

    // Audit log
    await this.createAuditLog(
      null,
      createdByUserId,
      'module',
      module.id,
      'module_created',
      null,
      {
        name,
        display_name: displayName,
        sort_order: sortOrder,
      },
    );

    this.logger.log(
      `Module "${name}" created by Platform Admin ${createdByUserId}`,
    );

    return module;
  }

  /**
   * Update module
   *
   * Can update: display_name, description, icon, sort_order, is_active
   * CANNOT update: name (would break permission references)
   */
  async updateModule(
    moduleId: string,
    updates: {
      display_name?: string;
      description?: string | null;
      icon?: string | null;
      sort_order?: number;
      is_active?: boolean;
    },
    updatedByUserId: string,
  ) {
    // Verify updater is Platform Admin
    const updater = await this.prisma.user.findUnique({
      where: { id: updatedByUserId },
      select: { is_platform_admin: true },
    });

    if (!updater?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can update modules',
      );
    }

    // Get existing module
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(`Module not found`);
    }

    // Update module
    const updatedModule = await this.prisma.module.update({
      where: { id: moduleId },
      data: {
        display_name: updates.display_name,
        description: updates.description,
        icon: updates.icon,
        sort_order: updates.sort_order,
        is_active: updates.is_active,
      },
      include: {
        permission: {
          select: {
            id: true,
            action: true,
            display_name: true,
            is_active: true,
          },
        },
      },
    });

    // Audit log
    await this.createAuditLog(
      null,
      updatedByUserId,
      'module',
      moduleId,
      'module_updated',
      {
        display_name: module.display_name,
        description: module.description,
        icon: module.icon,
        sort_order: module.sort_order,
        is_active: module.is_active,
      },
      {
        display_name: updates.display_name ?? module.display_name,
        description: updates.description ?? module.description,
        icon: updates.icon ?? module.icon,
        sort_order: updates.sort_order ?? module.sort_order,
        is_active: updates.is_active ?? module.is_active,
      },
    );

    this.logger.log(`Module ${module.name} updated by ${updatedByUserId}`);

    return updatedModule;
  }

  /**
   * Delete module
   *
   * CRITICAL: Deleting a module deletes ALL its permissions (CASCADE)
   * This removes permissions from ALL roles
   */
  async deleteModule(moduleId: string, deletedByUserId: string) {
    // Verify deleter is Platform Admin
    const deleter = await this.prisma.user.findUnique({
      where: { id: deletedByUserId },
      select: { is_platform_admin: true },
    });

    if (!deleter?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can delete modules',
      );
    }

    // Get module
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
      include: {
        permission: {
          include: {
            _count: {
              select: {
                role_permission: true,
              },
            },
          },
        },
      },
    });

    if (!module) {
      throw new NotFoundException(`Module not found`);
    }

    // Count total role assignments affected
    const totalRolePermissions = module.permission.reduce(
      (sum, p) => sum + p._count.role_permission,
      0,
    );

    // Warn about cascading deletes
    if (module.permission.length > 0) {
      this.logger.warn(
        `Deleting module "${module.name}" which has ${module.permission.length} permission(s) assigned to ${totalRolePermissions} role(s). This will cascade delete all permissions and role assignments.`,
      );
    }

    // Delete module (CASCADE will delete permissions and role_permissions)
    await this.prisma.module.delete({
      where: { id: moduleId },
    });

    // Audit log
    await this.createAuditLog(
      null,
      deletedByUserId,
      'module',
      moduleId,
      'module_deleted',
      {
        name: module.name,
        display_name: module.display_name,
        permissions_deleted: module.permission.length,
        role_permissions_deleted: totalRolePermissions,
      },
      null,
    );

    this.logger.log(
      `Module "${module.name}" deleted by ${deletedByUserId} (${module.permission.length} permissions, ${totalRolePermissions} role assignments removed)`,
    );

    return {
      message: 'Module deleted successfully',
      permissions_deleted: module.permission.length,
      role_permissions_deleted: totalRolePermissions,
    };
  }

  /**
   * Reorder modules (update sort_order for multiple modules)
   */
  async reorderModules(
    moduleOrders: Array<{ id: string; sort_order: number }>,
    reorderedByUserId: string,
  ) {
    // Verify reorderer is Platform Admin
    const reorderer = await this.prisma.user.findUnique({
      where: { id: reorderedByUserId },
      select: { is_platform_admin: true },
    });

    if (!reorderer?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can reorder modules',
      );
    }

    // Update all modules in transaction
    await this.prisma.$transaction(
      moduleOrders.map((mo) =>
        this.prisma.module.update({
          where: { id: mo.id },
          data: { sort_order: mo.sort_order },
        }),
      ),
    );

    this.logger.log(
      `${moduleOrders.length} modules reordered by ${reorderedByUserId}`,
    );

    return {
      message: 'Modules reordered successfully',
      modules_updated: moduleOrders.length,
    };
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    tenantId: string | null,
    actorUserId: string,
    entityType: string,
    entityId: string,
    action: string,
    beforeJson: any,
    afterJson: any,
  ) {
    try {
      await this.prisma.audit_log.create({
        data: {
          id: randomBytes(16).toString('hex'),
          tenant_id: tenantId,
          actor_user_id: actorUserId,
          actor_type: 'user',
          entity_type: entityType,
          entity_id: entityId,
          action_type: action,
          description: `Module ${action}`,
          before_json: beforeJson ? JSON.stringify(beforeJson) : null,
          after_json: afterJson ? JSON.stringify(afterJson) : null,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
      // Don't throw - audit log failure shouldn't break the operation
    }
  }
}
