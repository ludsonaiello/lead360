import { randomBytes } from 'crypto';
import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

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

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get user's roles in specific tenant
   */
  async getUserRoles(userId: string, tenantId: string) {
    return this.prisma.user_role.findMany({
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
    // Verify user exists and belongs to tenant (via membership)
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        memberships: { some: { tenant_id: tenantId, status: 'ACTIVE' } },
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
    const existing = await this.prisma.user_role.findFirst({
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
    const userRole = await this.prisma.user_role.create({
      data: {
        id: randomBytes(16).toString('hex'),
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
    await this.auditLogger.logRBACChange({
      action: 'created',
      entityType: 'user_role',
      entityId: userRole.id,
      tenantId: tenantId,
      actorUserId: assignedByUserId,
      metadata: {
        userId: userId,
        roleId: roleId,
        roleName: role.name,
      },
      description: `Role "${role.name}" assigned to user`,
    });

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
    const userRole = await this.prisma.user_role.findFirst({
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
      const ownerCount = await this.prisma.user_role.count({
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
    await this.prisma.user_role.delete({
      where: { id: userRole.id },
    });

    // Audit log
    await this.auditLogger.logRBACChange({
      action: 'deleted',
      entityType: 'user_role',
      entityId: userRole.id,
      tenantId: tenantId,
      actorUserId: removedByUserId,
      metadata: {
        userId: userId,
        roleId: roleId,
        roleName: userRole.role.name,
      },
      description: `Role "${userRole.role.name}" removed from user`,
    });

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
    const currentUserRoles = await this.prisma.user_role.findMany({
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
      const otherOwnerCount = await this.prisma.user_role.count({
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
        await tx.user_role.deleteMany({
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
        await tx.user_role.create({
          data: {
            id: randomBytes(16).toString('hex'),
            user_id: userId,
            role_id: roleId,
            tenant_id: tenantId,
            assigned_by_user_id: updatedByUserId,
          },
        });
        rolesAdded++;
      }

      // Get updated roles
      const updatedRoles = await tx.user_role.findMany({
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
      await this.auditLogger.logRBACChange({
        action: 'updated',
        entityType: 'user_role',
        entityId: userId,
        tenantId: tenantId,
        actorUserId: updatedByUserId,
        metadata: {
          before: { role_ids: currentRoleIds },
          after: { role_ids: roleIds },
          roles_added: rolesAdded,
          roles_removed: rolesRemoved,
        },
        description: `User roles updated: +${rolesAdded}, -${rolesRemoved}`,
      });

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

    // Verify all users exist in tenant (via membership)
    const users = await this.prisma.user.findMany({
      where: {
        id: { in: userIds },
        memberships: { some: { tenant_id: tenantId, status: 'ACTIVE' } },
      },
    });

    if (users.length !== userIds.length) {
      throw new NotFoundException('One or more users not found in this tenant');
    }

    // Atomic transaction
    return this.prisma.$transaction(async (tx) => {
      let totalAssigned = 0;
      const details: Array<{ user_id: string; roles_added: number }> = [];

      for (const userId of userIds) {
        let rolesAdded = 0;

        for (const roleId of roleIds) {
          // Check if already assigned
          const existing = await tx.user_role.findFirst({
            where: {
              user_id: userId,
              role_id: roleId,
              tenant_id: tenantId,
            },
          });

          if (!existing) {
            await tx.user_role.create({
              data: {
                id: randomBytes(16).toString('hex'),
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
    return this.prisma.user_role.findMany({
      where: {
        tenant_id: tenantId,
        role_id: roleId,
      },
      include: {
        user_user_role_user_idTouser: {
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
}
