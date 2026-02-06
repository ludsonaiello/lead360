import { randomBytes } from 'crypto';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

/**
 * Role Service - Role Management (CRUD + Clone)
 *
 * Handles:
 * - Listing all roles (system + custom)
 * - Creating custom roles (Platform Admin only)
 * - Updating roles (with system role protection)
 * - Soft deleting roles (with validation - can't delete if assigned)
 * - Cloning roles (duplicate with new name)
 * - Audit logging
 */
@Injectable()
export class RoleService {
  private readonly logger = new Logger(RoleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get all roles (system + custom)
   *
   * @param includeDeleted - Whether to include soft-deleted roles
   */
  async getAllRoles(includeDeleted = false) {
    return this.prisma.role.findMany({
      where: includeDeleted ? {} : { deleted_at: null },
      include: {
        role_permission: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
        },
        _count: {
          select: {
            user_role: true,
          },
        },
      },
      orderBy: [{ is_system: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Get single role by ID with permissions
   */
  async getRole(roleId: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        deleted_at: null,
      },
      include: {
        role_permission: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
        },
        _count: {
          select: {
            user_role: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    return role;
  }

  /**
   * Create custom role (Platform Admin only)
   *
   * @param name - Role name (must be unique)
   * @param permissionIds - Array of permission IDs to assign
   * @param createdByUserId - Platform Admin user ID
   */
  async createRole(
    name: string,
    permissionIds: string[],
    createdByUserId: string,
  ) {
    // Verify creator is Platform Admin
    const creator = await this.prisma.user.findUnique({
      where: { id: createdByUserId },
      select: { is_platform_admin: true },
    });

    if (!creator?.is_platform_admin) {
      throw new ForbiddenException(
        'Only Platform Admins can create custom roles',
      );
    }

    // Check if role name already exists
    const existing = await this.prisma.role.findFirst({
      where: { name },
    });

    if (existing) {
      throw new ConflictException(`Role with name "${name}" already exists`);
    }

    // Verify all permissions exist
    const permissions = await this.prisma.permission.findMany({
      where: {
        id: { in: permissionIds },
      },
    });

    if (permissions.length !== permissionIds.length) {
      throw new BadRequestException('One or more permissions not found');
    }

    // Create role + assign permissions (atomic transaction)
    const role = await this.prisma.$transaction(async (tx) => {
      // Create role
      const newRole = await tx.role.create({
        data: {
          id: randomBytes(16).toString('hex'),
          updated_at: new Date(),
          name,
          is_system: false,
          is_active: true,
          created_by_user_id: createdByUserId,
        },
      });

      // Assign permissions
      await tx.role_permission.createMany({
        data: permissionIds.map((permissionId) => ({
          id: randomBytes(16).toString('hex'),
          role_id: newRole.id,
          permission_id: permissionId,
          granted_by_user_id: createdByUserId,
        })),
      });

      // Return role with permissions
      return tx.role.findUnique({
        where: { id: newRole.id },
        include: {
          role_permission: {
            include: {
              permission: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
      });
    });

    if (!role) {
      throw new InternalServerErrorException('Failed to create role');
    }

    // Audit log
    await this.auditLogger.logRBACChange({
      action: 'created',
      entityType: 'role',
      entityId: role.id,
      tenantId: undefined,
      actorUserId: createdByUserId,
      metadata: {
        name: role.name,
        permission_count: permissionIds.length,
        is_system: false,
      },
      description: `Role "${role.name}" created`,
    });

    this.logger.log(
      `Custom role "${name}" created by Platform Admin ${createdByUserId} with ${permissionIds.length} permissions`,
    );

    return role;
  }

  /**
   * Update role
   *
   * RESTRICTIONS:
   * - Cannot modify is_system flag
   * - System roles can be modified by Platform Admin only
   * - Can update name (if unique), is_active, permissions
   */
  async updateRole(
    roleId: string,
    updates: {
      name?: string;
      is_active?: boolean;
      permissionIds?: string[];
    },
    updatedByUserId: string,
  ) {
    // Get existing role
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        deleted_at: null,
      },
      include: {
        role_permission: true,
      },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    // If modifying system role, require Platform Admin
    if (role.is_system) {
      const updater = await this.prisma.user.findUnique({
        where: { id: updatedByUserId },
        select: { is_platform_admin: true },
      });

      if (!updater?.is_platform_admin) {
        throw new ForbiddenException(
          'Only Platform Admins can modify system roles',
        );
      }
    }

    // If changing name, verify uniqueness
    if (updates.name && updates.name !== role.name) {
      const existing = await this.prisma.role.findFirst({
        where: { name: updates.name },
      });

      if (existing) {
        throw new ConflictException(
          `Role with name "${updates.name}" already exists`,
        );
      }
    }

    // Verify permissions if updating
    if (updates.permissionIds) {
      const permissions = await this.prisma.permission.findMany({
        where: {
          id: { in: updates.permissionIds },
        },
      });

      if (permissions.length !== updates.permissionIds.length) {
        throw new BadRequestException('One or more permissions not found');
      }
    }

    // Update role + permissions (atomic transaction)
    const updatedRole = await this.prisma.$transaction(async (tx) => {
      // Update role metadata
      const updated = await tx.role.update({
        where: { id: roleId },
        data: {
          name: updates.name,
          is_active: updates.is_active,
        },
      });

      // Update permissions if provided
      if (updates.permissionIds) {
        // Delete existing permissions
        await tx.role_permission.deleteMany({
          where: { role_id: roleId },
        });

        // Add new permissions
        await tx.role_permission.createMany({
          data: updates.permissionIds.map((permissionId) => ({
            id: randomBytes(16).toString('hex'),
            role_id: roleId,
            permission_id: permissionId,
            granted_by_user_id: updatedByUserId,
          })),
        });
      }

      // Return updated role with permissions
      return tx.role.findUnique({
        where: { id: roleId },
        include: {
          role_permission: {
            include: {
              permission: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
      });
    });

    // Audit log
    await this.auditLogger.logRBACChange({
      action: 'updated',
      entityType: 'role',
      entityId: roleId,
      tenantId: undefined,
      actorUserId: updatedByUserId,
      metadata: {
        before: {
          name: role.name,
          is_active: role.is_active,
          permission_count: role.role_permission.length,
        },
        after: {
          name: updates.name ?? role.name,
          is_active: updates.is_active ?? role.is_active,
          permission_count:
            updates.permissionIds?.length ?? role.role_permission.length,
        },
      },
      description: `Role "${role.name}" updated`,
    });

    this.logger.log(`Role ${roleId} updated by ${updatedByUserId}`);

    return updatedRole;
  }

  /**
   * Soft delete role
   *
   * CRITICAL: Cannot delete role if assigned to any users
   */
  async deleteRole(roleId: string, deletedByUserId: string) {
    // Get role
    const role = await this.prisma.role.findFirst({
      where: {
        id: roleId,
        deleted_at: null,
      },
      include: {
        _count: {
          select: {
            user_role: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    // Check if role is assigned to any users
    if (role._count.user_role > 0) {
      throw new BadRequestException(
        `Cannot delete role "${role.name}" - assigned to ${role._count.user_role} user(s). Remove all assignments first.`,
      );
    }

    // If deleting system role, require Platform Admin
    if (role.is_system) {
      const deleter = await this.prisma.user.findUnique({
        where: { id: deletedByUserId },
        select: { is_platform_admin: true },
      });

      if (!deleter?.is_platform_admin) {
        throw new ForbiddenException(
          'Only Platform Admins can delete system roles',
        );
      }
    }

    // Soft delete
    await this.prisma.role.update({
      where: { id: roleId },
      data: {
        deleted_at: new Date(),
      },
    });

    // Audit log
    await this.auditLogger.logRBACChange({
      action: 'deleted',
      entityType: 'role',
      entityId: roleId,
      tenantId: undefined,
      actorUserId: deletedByUserId,
      metadata: {
        name: role.name,
        is_system: role.is_system,
      },
      description: `Role "${role.name}" deleted`,
    });

    this.logger.log(
      `Role ${role.name} (${roleId}) soft deleted by ${deletedByUserId}`,
    );

    return { message: 'Role deleted successfully' };
  }

  /**
   * Clone role (duplicate with new name)
   *
   * Useful for creating similar roles with minor changes
   */
  async cloneRole(
    sourceRoleId: string,
    newName: string,
    clonedByUserId: string,
  ) {
    // Get source role
    const sourceRole = await this.prisma.role.findFirst({
      where: {
        id: sourceRoleId,
        deleted_at: null,
      },
      include: {
        role_permission: true,
      },
    });

    if (!sourceRole) {
      throw new NotFoundException(`Source role not found`);
    }

    // Check if new name already exists
    const existing = await this.prisma.role.findFirst({
      where: { name: newName },
    });

    if (existing) {
      throw new ConflictException(`Role with name "${newName}" already exists`);
    }

    // Verify creator is Platform Admin
    const creator = await this.prisma.user.findUnique({
      where: { id: clonedByUserId },
      select: { is_platform_admin: true },
    });

    if (!creator?.is_platform_admin) {
      throw new ForbiddenException('Only Platform Admins can clone roles');
    }

    // Clone role + permissions (atomic transaction)
    const clonedRole = await this.prisma.$transaction(async (tx) => {
      // Create new role
      const newRole = await tx.role.create({
        data: {
          id: randomBytes(16).toString('hex'),
          updated_at: new Date(),
          name: newName,
          is_system: false, // Cloned roles are never system roles
          is_active: true,
          created_by_user_id: clonedByUserId,
        },
      });

      // Copy permissions
      if (sourceRole.role_permission.length > 0) {
        await tx.role_permission.createMany({
          data: sourceRole.role_permission.map((rp) => ({
            id: randomBytes(16).toString('hex'),
            role_id: newRole.id,
            permission_id: rp.permission_id,
            granted_by_user_id: clonedByUserId,
          })),
        });
      }

      // Return cloned role with permissions
      return tx.role.findUnique({
        where: { id: newRole.id },
        include: {
          role_permission: {
            include: {
              permission: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
      });
    });

    if (!clonedRole) {
      throw new InternalServerErrorException('Failed to clone role');
    }

    // Audit log
    await this.auditLogger.logRBACChange({
      action: 'created',
      entityType: 'role',
      entityId: clonedRole.id,
      tenantId: undefined,
      actorUserId: clonedByUserId,
      metadata: {
        source_role_id: sourceRoleId,
        source_role_name: sourceRole.name,
        new_role_name: newName,
        permission_count: sourceRole.role_permission.length,
        operation: 'clone',
      },
      description: `Role "${newName}" cloned from "${sourceRole.name}"`,
    });

    this.logger.log(
      `Role "${sourceRole.name}" cloned to "${newName}" by ${clonedByUserId} with ${sourceRole.role_permission.length} permissions`,
    );

    return clonedRole;
  }

  /**
   * Get role by name
   */
  async getRoleByName(name: string) {
    const role = await this.prisma.role.findFirst({
      where: {
        name,
        deleted_at: null,
      },
      include: {
        role_permission: {
          include: {
            permission: {
              include: {
                module: true,
              },
            },
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role "${name}" not found`);
    }

    return role;
  }
}
