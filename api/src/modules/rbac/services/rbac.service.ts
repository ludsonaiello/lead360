import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

/**
 * RBAC Service - Core Permission Checking
 *
 * CRITICAL: This service implements DYNAMIC permission checking.
 * All permissions are queried from the database at runtime - NO hardcoded permissions.
 *
 * Permission Check Flow:
 * 1. Get user's roles in specific tenant
 * 2. For each role, get assigned permissions
 * 3. Check if any permission matches (module + action)
 * 4. Verify role, permission, and module are all active
 * 5. Return boolean result
 *
 * Platform Admin Bypass: Users with is_platform_admin=true bypass all checks
 */
@Injectable()
export class RBACService {
  private readonly logger = new Logger(RBACService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if user has specific permission
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID (roles are tenant-specific)
   * @param moduleName - Module name (e.g., "leads", "quotes")
   * @param action - Action name (e.g., "view", "create", "edit")
   * @returns boolean - true if user has permission, false otherwise
   *
   * NEVER hardcoded - always queries database
   */
  async checkPermission(
    userId: string,
    tenantId: string,
    moduleName: string,
    action: string,
  ): Promise<boolean> {
    try {
      // Platform Admin bypass
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { is_platform_admin: true },
      });

      if (user?.is_platform_admin) {
        this.logger.debug(
          `Platform Admin bypass for user ${userId} on ${moduleName}:${action}`,
        );
        return true;
      }

      // Get user's roles WITH their permissions in a SINGLE query (fixes N+1 problem)
      const userRoles = await this.prisma.userRole.findMany({
        where: {
          user_id: userId,
          tenant_id: tenantId,
        },
        include: {
          role: {
            include: {
              role_permissions: {
                include: {
                  permission: {
                    include: {
                      module: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      // No roles = no permissions
      if (userRoles.length === 0) {
        this.logger.debug(
          `User ${userId} has no roles in tenant ${tenantId}`,
        );
        return false;
      }

      // Check each role's permissions (in-memory, no additional queries)
      for (const userRole of userRoles) {
        // Skip inactive roles
        if (!userRole.role.is_active) {
          continue;
        }

        // Check if any permission matches
        for (const rp of userRole.role.role_permissions) {
          const permission = rp.permission;
          const module = permission.module;

          // Match found!
          if (
            module.name === moduleName &&
            permission.action === action &&
            permission.is_active &&
            module.is_active
          ) {
            this.logger.debug(
              `Permission granted: user ${userId} (role: ${userRole.role.name}) has ${moduleName}:${action}`,
            );
            return true;
          }
        }
      }

      // No matching permission found
      this.logger.debug(
        `Permission denied: user ${userId} lacks ${moduleName}:${action} in tenant ${tenantId}`,
      );
      return false;
    } catch (error) {
      this.logger.error(
        `Error checking permission for user ${userId}: ${error.message}`,
        error.stack,
      );
      // Fail closed - deny permission on error
      return false;
    }
  }

  /**
   * Get all permissions user has (across all their roles)
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @returns Array of permissions (deduplicated)
   */
  async getUserPermissions(userId: string, tenantId: string) {
    try {
      // Platform Admin gets all permissions
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { is_platform_admin: true },
      });

      if (user?.is_platform_admin) {
        // Return ALL permissions
        return this.prisma.permission.findMany({
          where: { is_active: true },
          include: { module: true },
        });
      }

      // Get user's roles
      const userRoles = await this.prisma.userRole.findMany({
        where: {
          user_id: userId,
          tenant_id: tenantId,
        },
        include: {
          role: true,
        },
      });

      if (userRoles.length === 0) {
        return [];
      }

      // Filter only active roles
      const activeRoles = userRoles.filter((ur) => ur.role.is_active);
      if (activeRoles.length === 0) {
        return [];
      }

      // Get all permissions from all active roles
      const roleIds = activeRoles.map((ur) => ur.role.id);

      const rolePermissions = await this.prisma.rolePermission.findMany({
        where: {
          role_id: { in: roleIds },
        },
        include: {
          permission: {
            include: {
              module: true,
            },
          },
        },
      });

      // Deduplicate permissions and filter only active ones
      const uniquePermissions = new Map();
      rolePermissions.forEach((rp) => {
        // Only include active permissions from active modules
        if (
          rp.permission &&
          rp.permission.is_active &&
          rp.permission.module &&
          rp.permission.module.is_active
        ) {
          uniquePermissions.set(rp.permission.id, rp.permission);
        }
      });

      return Array.from(uniquePermissions.values());
    } catch (error) {
      this.logger.error(
        `Error getting user permissions for user ${userId}: ${error.message}`,
        error.stack,
      );
      return [];
    }
  }

  /**
   * Get permission matrix (all roles and their permissions)
   *
   * Returns dynamically generated matrix from database
   * Format: { role_name: { module_name: [actions] } }
   *
   * @returns Permission matrix object
   */
  async getPermissionMatrix() {
    try {
      const roles = await this.prisma.role.findMany({
        where: {
          is_active: true,
          deleted_at: null,
        },
        include: {
          role_permissions: {
            include: {
              permission: {
                include: {
                  module: true,
                },
              },
            },
          },
        },
        orderBy: { name: 'asc' },
      });

      const matrix: Record<string, Record<string, string[]>> = {};

      for (const role of roles) {
        matrix[role.name] = {};

        for (const rp of role.role_permissions) {
          // Only include active permissions from active modules
          if (
            rp.permission &&
            rp.permission.is_active &&
            rp.permission.module &&
            rp.permission.module.is_active
          ) {
            const moduleName = rp.permission.module.name;
            const action = rp.permission.action;

            if (!matrix[role.name][moduleName]) {
              matrix[role.name][moduleName] = [];
            }

            matrix[role.name][moduleName].push(action);
          }
        }
      }

      return {
        matrix,
        modules: await this.getActiveModules(),
      };
    } catch (error) {
      this.logger.error(
        `Error generating permission matrix: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Get all active modules with their permissions
   *
   * @returns Array of modules with permissions
   */
  private async getActiveModules() {
    return this.prisma.module.findMany({
      where: { is_active: true },
      include: {
        permissions: {
          where: { is_active: true },
          select: {
            id: true,
            action: true,
            display_name: true,
          },
        },
      },
      orderBy: { sort_order: 'asc' },
    });
  }

  /**
   * Check if user has any of the specified roles
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param roleNames - Array of role names
   * @returns boolean - true if user has at least one of the roles
   */
  async hasAnyRole(
    userId: string,
    tenantId: string,
    roleNames: string[],
  ): Promise<boolean> {
    try {
      // Platform Admin bypass
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { is_platform_admin: true },
      });

      if (user?.is_platform_admin) {
        return true;
      }

      const count = await this.prisma.userRole.count({
        where: {
          user_id: userId,
          tenant_id: tenantId,
          role: {
            name: { in: roleNames },
            is_active: true,
          },
        },
      });

      return count > 0;
    } catch (error) {
      this.logger.error(
        `Error checking roles for user ${userId}: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Check if user has specific role
   *
   * @param userId - User ID
   * @param tenantId - Tenant ID
   * @param roleName - Role name
   * @returns boolean - true if user has the role
   */
  async hasRole(
    userId: string,
    tenantId: string,
    roleName: string,
  ): Promise<boolean> {
    return this.hasAnyRole(userId, tenantId, [roleName]);
  }
}
