import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBACService } from '../services/rbac.service';
import { REQUIRE_PERMISSION_KEY } from '../decorators/require-permission.decorator';

/**
 * Permission Guard - Dynamic Permission Checking
 *
 * Checks if user has specific permission (module + action) via RBACService.
 * This is the DYNAMIC RBAC implementation - all permissions queried from database.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @RequirePermission('leads', 'create')
 * async createLead() { ... }
 *
 * IMPORTANT:
 * - User must be authenticated (user object on request)
 * - Tenant must be resolved (tenant_id on request)
 * - Platform Admins bypass all checks (via RBACService)
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RBACService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get permission metadata from decorator
    const requiredPermission = this.reflector.getAllAndOverride<{
      module: string;
      action: string;
    }>(REQUIRE_PERMISSION_KEY, [context.getHandler(), context.getClass()]);

    // No permission required
    if (!requiredPermission) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const tenantId = request.tenant_id;

    // User must be authenticated
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Tenant must be resolved
    if (!tenantId) {
      throw new ForbiddenException('Tenant context not found');
    }

    // Check permission via RBACService (dynamic database check)
    const hasPermission = await this.rbacService.checkPermission(
      user.id,
      tenantId,
      requiredPermission.module,
      requiredPermission.action,
    );

    if (!hasPermission) {
      throw new ForbiddenException(
        `Access denied. Required permission: ${requiredPermission.module}:${requiredPermission.action}`,
      );
    }

    return true;
  }
}
