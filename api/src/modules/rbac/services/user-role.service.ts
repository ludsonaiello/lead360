import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * User Role Service - User-Role Assignment Logic
 *
 * Handles:
 * - Assigning roles to users (with tenant_id)
 * - Removing roles from users (with last Owner protection)
 * - Replacing all user roles atomically
 * - Batch role assignments
 * - Audit logging
 */
@Injectable()
export class UserRoleService {
  private readonly logger = new Logger(UserRoleService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get user's roles in specific tenant
   */
  async getUserRoles(userId: string, tenantId: string) {
    return this.prisma.userRole.findMany({
      where: {
        user_id: userId,
        tenant_id: tenantId,
      },
      include: {
        role: {
          select: {
            id: true,
            name: true,
            description: true,
            is_system: true,
          },
        },
      },
      orderBy: {
        assigned_at: 'desc',
      },
    });
  }

  /**
   * Assign role to user
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID (roles are tenant-specific)
   * @param roleId - Role ID to assign
   * @param assignedByUserId - Who is assigning this role
   */
  async assignRoleToUser(
    userId: string,
    tenantId: string,
    roleId: string,
    assignedByUserId: string,
  ) {
    // Verify user exists and belongs to tenant
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        tenant_id: tenantId,
      },
    });

    if (!user) {
      throw new NotFoundException(
        `User not found or does not belong to this tenant`,
      );
    }

    // Verify role exists
    const role = await this.prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!role) {
      throw new NotFoundException(`Role not found`);
    }

    if (!role.is_active) {
      throw new BadRequestException(`Cannot assign inactive role`);
    }

    // Check if already assigned (skip duplicate)
    const existing = await this.prisma.userRole.findFirst({
      where: {
        user_id: userId,
        role_id: roleId,
        tenant_id: tenantId,
      },
    });

    if (existing) {
      this.logger.debug(
        `Role ${role.name} already assigned to user ${userId} in tenant ${tenantId}`,
      );
      return existing;
    }

    // Create user_role record
    const userRole = await this.prisma.userRole.create({
      data: {
        user_id: userId,
        role_id: roleId,
        tenant_id: tenantId,
        assigned_by_user_id: assignedByUserId,
      },
      include: {
        role: true,
      },
    });

    // Audit log
    await this.createAuditLog(
      tenantId,
      assignedByUserId,
      'user_role',
      userRole.id,
      'role_assigned',
      null,
      {
        user_id: userId,
        role_id: roleId,
        role_name: role.name,
      },
    );

    this.logger.log(
      `Role ${role.name} assigned to user ${userId} in tenant ${tenantId} by ${assignedByUserId}`,
    );

    return userRole;
  }

  /**
   * Remove role from user
   *
   * CRITICAL: Prevents removing last Owner role
   */
  async removeRoleFromUser(
    userId: string,
    tenantId: string,
    roleId: string,
    removedByUserId: string,
  ) {
    // Find the user_role record
    const userRole = await this.prisma.userRole.findFirst({
      where: {
        user_id: userId,
        role_id: roleId,
        tenant_id: tenantId,
      },
      include: {
        role: true,
      },
    });

    if (!userRole) {
      throw new NotFoundException(`User does not have this role`);
    }

    // CRITICAL: Last Owner Protection
    if (userRole.role.name === 'Owner') {
      const ownerRoleId = userRole.role_id;

      // Count total Owners in tenant
      const ownerCount = await this.prisma.userRole.count({
        where: {
          tenant_id: tenantId,
          role_id: ownerRoleId,
        },
      });

      if (ownerCount === 1) {
        throw new BadRequestException(
          'Cannot remove last Owner. Assign another Owner first.',
        );
      }
    }

    // Delete user_role record
    await this.prisma.userRole.delete({
      where: { id: userRole.id },
    });

    // Audit log
    await this.createAuditLog(
      tenantId,
      removedByUserId,
      'user_role',
      userRole.id,
      'role_removed',
      {
        user_id: userId,
        role_id: roleId,
        role_name: userRole.role.name,
      },
      null,
    );

    this.logger.log(
      `Role ${userRole.role.name} removed from user ${userId} in tenant ${tenantId} by ${removedByUserId}`,
    );

    return { message: 'Role removed successfully' };
  }

  /**
   * Replace all user's roles (atomic operation)
   *
   * Compares current vs new roles and updates accordingly
   */
  async replaceUserRoles(
    userId: string,
    tenantId: string,
    roleIds: string[],
    updatedByUserId: string,
  ) {
    // Get current roles
    const currentUserRoles = await this.prisma.userRole.findMany({
      where: {
        user_id: userId,
        tenant_id: tenantId,
      },
      include: {
        role: true,
      },
    });

    const currentRoleIds = currentUserRoles.map((ur) => ur.role_id);

    // Determine what to add and remove
    const rolesToAdd = roleIds.filter((id) => !currentRoleIds.includes(id));
    const rolesToRemove = currentRoleIds.filter((id) => !roleIds.includes(id));

    // CRITICAL: Check if removing Owner would leave no Owners
    const ownerRole = await this.prisma.role.findFirst({
      where: { name: 'Owner' },
    });

    if (ownerRole && rolesToRemove.includes(ownerRole.id)) {
      // Count Owners in tenant (excluding this user)
      const otherOwnerCount = await this.prisma.userRole.count({
        where: {
          tenant_id: tenantId,
          role_id: ownerRole.id,
          user_id: { not: userId },
        },
      });

      // Check if new roles include Owner
      const willHaveOwner = roleIds.includes(ownerRole.id);

      if (otherOwnerCount === 0 && !willHaveOwner) {
        throw new BadRequestException(
          'Cannot remove last Owner. Assign another Owner first.',
        );
      }
    }

    // Atomic transaction
    return this.prisma.$transaction(async (tx) => {
      let rolesAdded = 0;
      let rolesRemoved = 0;

      // Remove roles
      for (const roleId of rolesToRemove) {
        await tx.userRole.deleteMany({
          where: {
            user_id: userId,
            role_id: roleId,
            tenant_id: tenantId,
          },
        });
        rolesRemoved++;
      }

      // Add roles
      for (const roleId of rolesToAdd) {
        await tx.userRole.create({
          data: {
            user_id: userId,
            role_id: roleId,
            tenant_id: tenantId,
            assigned_by_user_id: updatedByUserId,
          },
        });
        rolesAdded++;
      }

      // Get updated roles
      const updatedRoles = await tx.userRole.findMany({
        where: {
          user_id: userId,
          tenant_id: tenantId,
        },
        include: {
          role: {
            select: {
              id: true,
              name: true,
              description: true,
            },
          },
        },
      });

      // Audit log
      await this.createAuditLog(
        tenantId,
        updatedByUserId,
        'user',
        userId,
        'roles_updated',
        { role_ids: currentRoleIds },
        { role_ids: roleIds },
      );

      this.logger.log(
        `User ${userId} roles updated in tenant ${tenantId}: +${rolesAdded}, -${rolesRemoved}`,
      );

      return {
        roles_added: rolesAdded,
        roles_removed: rolesRemoved,
        current_roles: updatedRoles,
      };
    });
  }

  /**
   * Batch assign roles to multiple users
   */
  async batchAssignRoles(
    userIds: string[],
    roleIds: string[],
    tenantId: string,
    assignedByUserId: string,
  ) {
    // Verify all roles exist
    const roles = await this.prisma.role.findMany({
      where: {
        id: { in: roleIds },
      },
    });

    if (roles.length !== roleIds.length) {
      throw new NotFoundException('One or more roles not found');
    }

    // Verify all users exist in tenant
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        tenant_id: tenantId,
      },
    });

    if (users.length !== userIds.length) {
      throw new NotFoundException(
        'One or more users not found in this tenant',
      );
    }

    // Atomic transaction
    return this.prisma.$transaction(async (tx) => {
      let totalAssigned = 0;
      const details: Array<{ user_id: string; roles_added: number }> = [];

      for (const userId of userIds) {
        let rolesAdded = 0;

        for (const roleId of roleIds) {
          // Check if already assigned
          const existing = await tx.userRole.findFirst({
            where: {
              user_id: userId,
              role_id: roleId,
              tenant_id: tenantId,
            },
          });

          if (!existing) {
            await tx.userRole.create({
              data: {
                user_id: userId,
                role_id: roleId,
                tenant_id: tenantId,
                assigned_by_user_id: assignedByUserId,
              },
            });
            rolesAdded++;
            totalAssigned++;
          }
        }

        details.push({ user_id: userId, roles_added: rolesAdded });
      }

      this.logger.log(
        `Batch role assignment: ${totalAssigned} roles assigned to ${userIds.length} users in tenant ${tenantId}`,
      );

      return {
        users_updated: userIds.length,
        roles_assigned: totalAssigned,
        details,
      };
    });
  }

  /**
   * Get all users with specific role in tenant
   */
  async getUsersWithRole(tenantId: string, roleId: string) {
    return this.prisma.userRole.findMany({
      where: {
        tenant_id: tenantId,
        role_id: roleId,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        role: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    tenantId: string,
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
