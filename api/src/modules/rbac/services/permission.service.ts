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
 * Permission Service - Permission Management
 *
 * Handles:
 * - Listing all permissions (by module or all)
 * - Creating permissions (Platform Admin only)
 * - Updating permissions
 * - Soft deleting permissions (removes from all roles)
 * - Audit logging
 */
@Injectable()
export class PermissionService {
  private readonly logger = new Logger(PermissionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all permissions (optionally filtered by module)
   */
  async getAllPermissions(moduleId?: string) {
    return this.prisma.permission.findMany({
      where: moduleId ? { module_id: moduleId } : {},
      include: {
        module: true,
        _count: {
          select: {
            role_permissions: true,
            role_template_permissions: true,
          },
        },
      },
      orderBy: [{ module: { sort_order: 'asc' } }, { action: 'asc' }],
    });
  }

  /**
   * Get single permission by ID
   */
  async getPermission(permissionId: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        module: true,
        role_permissions: {
          include: {
            role: {
              select: {
                id: true,
                name: true,
                is_system: true,
              },
            },
          },
        },
        _count: {
          select: {
            role_permissions: true,
            role_template_permissions: true,
          },
        },
      },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found`);
    }

    return permission;
  }

  /**
   * Create permission (Platform Admin only)
   *
   * @param moduleId - Module ID this permission belongs to
   * @param action - Action name (e.g., "view", "create", "edit", "delete")
   * @param displayName - Human-readable name
   * @param description - Optional description
   * @param createdByUserId - Platform Admin user ID
   */
  async createPermission(
    moduleId: string,
    action: string,
    displayName: string,
    description: string | null,
    createdByUserId: string,
  ) {
    // Verify creator is Platform Admin
    const creator = await this.prisma.user.findUnique({
      where: { id: createdByUserId },
      select: { is_platform_admin: true },
    });

    if (!creator?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can create permissions',
      );
    }

    // Verify module exists
    const module = await this.prisma.module.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new NotFoundException(`Module not found`);
    }

    // Check for duplicate (module + action must be unique)
    const existing = await this.prisma.permission.findFirst({
      where: {
        module_id: moduleId,
        action,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Permission "${module.name}:${action}" already exists`,
      );
    }

    // Create permission
    const permission = await this.prisma.permission.create({
      data: {
        module_id: moduleId,
        action,
        display_name: displayName,
        description,
        is_active: true,
      },
      include: {
        module: true,
      },
    });

    // Audit log
    await this.createAuditLog(
      null,
      createdByUserId,
      'permission',
      permission.id,
      'permission_created',
      null,
      {
        module_id: moduleId,
        module_name: module.name,
        action,
        display_name: displayName,
      },
    );

    this.logger.log(
      `Permission "${module.name}:${action}" created by Platform Admin ${createdByUserId}`,
    );

    return permission;
  }

  /**
   * Update permission
   *
   * Can update: display_name, description, is_active
   * CANNOT update: module_id, action (would break references)
   */
  async updatePermission(
    permissionId: string,
    updates: {
      display_name?: string;
      description?: string | null;
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
        'Only Platform Admins can update permissions',
      );
    }

    // Get existing permission
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
      include: { module: true },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found`);
    }

    // Update permission
    const updatedPermission = await this.prisma.permission.update({
      where: { id: permissionId },
      data: {
        display_name: updates.display_name,
        description: updates.description,
        is_active: updates.is_active,
      },
      include: {
        module: true,
      },
    });

    // Audit log
    await this.createAuditLog(
      null,
      updatedByUserId,
      'permission',
      permissionId,
      'permission_updated',
      {
        display_name: permission.display_name,
        description: permission.description,
        is_active: permission.is_active,
      },
      {
        display_name: updates.display_name ?? permission.display_name,
        description: updates.description ?? permission.description,
        is_active: updates.is_active ?? permission.is_active,
      },
    );

    this.logger.log(
      `Permission ${permission.module.name}:${permission.action} updated by ${updatedByUserId}`,
    );

    return updatedPermission;
  }

  /**
   * Delete permission
   *
   * CRITICAL: Deleting a permission removes it from ALL roles
   * Uses CASCADE on foreign key, so role_permissions are auto-deleted
   */
  async deletePermission(permissionId: string, deletedByUserId: string) {
    // Verify deleter is Platform Admin
    const deleter = await this.prisma.user.findUnique({
      where: { id: deletedByUserId },
      select: { is_platform_admin: true },
    });

    if (!deleter?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can delete permissions',
      );
    }

    // Get permission
    const permission = await this.prisma.permission.findUnique({
      where: { id: permissionId },
      include: {
        module: true,
        _count: {
          select: {
            role_permissions: true,
          },
        },
      },
    });

    if (!permission) {
      throw new NotFoundException(`Permission not found`);
    }

    // Warn if permission is assigned to roles (deletion will cascade)
    if (permission._count.role_permissions > 0) {
      this.logger.warn(
        `Deleting permission ${permission.module.name}:${permission.action} which is assigned to ${permission._count.role_permissions} role(s). This will remove it from all roles.`,
      );
    }

    // Delete permission (CASCADE will remove role_permissions)
    await this.prisma.permission.delete({
      where: { id: permissionId },
    });

    // Audit log
    await this.createAuditLog(
      null,
      deletedByUserId,
      'permission',
      permissionId,
      'permission_deleted',
      {
        module_name: permission.module.name,
        action: permission.action,
        display_name: permission.display_name,
        roles_affected: permission._count.role_permissions,
      },
      null,
    );

    this.logger.log(
      `Permission ${permission.module.name}:${permission.action} deleted by ${deletedByUserId}`,
    );

    return {
      message: 'Permission deleted successfully',
      roles_affected: permission._count.role_permissions,
    };
  }

  /**
   * Get permissions by module name
   */
  async getPermissionsByModule(moduleName: string) {
    const module = await this.prisma.module.findUnique({
      where: { name: moduleName },
    });

    if (!module) {
      throw new NotFoundException(`Module "${moduleName}" not found`);
    }

    return this.prisma.permission.findMany({
      where: {
        module_id: module.id,
        is_active: true,
      },
      include: {
        module: true,
      },
      orderBy: { action: 'asc' },
    });
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
      await this.prisma.auditLog.create({
        data: {
          tenant_id: tenantId,
          actor_user_id: actorUserId,
          entity_type: entityType,
          entity_id: entityId,
          action,
          before_json: beforeJson,
          after_json: afterJson,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
      // Don't throw - audit log failure shouldn't break the operation
    }
  }
}
