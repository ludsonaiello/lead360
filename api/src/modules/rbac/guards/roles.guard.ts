import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBACService } from '../services/rbac.service';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * Roles Guard - Role-Based Access Control
 *
 * Checks if user has one of the required roles via RBACService.
 * This is a DYNAMIC check - roles are queried from database with tenant context.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('Owner', 'Admin')
 * async someMethod() { ... }
 *
 * IMPORTANT:
 * - User must be authenticated (user object on request)
 * - Tenant must be resolved (tenant_id on request)
 * - Platform Admins bypass all checks (via RBACService)
 * - Checks roles in CURRENT TENANT only (multi-tenant aware)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private rbacService: RBACService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Get required roles from decorator
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No roles required
    if (!requiredRoles || requiredRoles.length === 0) {
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

    // Check if user has any of the required roles (dynamic database check)
    const hasRole = await this.rbacService.hasAnyRole(
      user.id,
      tenantId,
      requiredRoles,
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
