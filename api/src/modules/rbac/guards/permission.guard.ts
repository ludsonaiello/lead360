import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RBACService } from '../services/rbac.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
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
  // Rate limiting cache: prevents flooding audit log with repeated failed checks
  // Key format: "userId:module:action" → timestamp of last log
  private failedCheckCache = new Map<string, number>();

  constructor(
    private reflector: Reflector,
    private rbacService: RBACService,
    private auditLogger: AuditLoggerService,
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

    // Platform Admins can bypass tenant context requirement
    const isPlatformAdmin = user.is_platform_admin || false;

    // Tenant must be resolved (unless Platform Admin)
    if (!tenantId && !isPlatformAdmin) {
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
      // Rate limit audit logging: only log same user+module+action failure once per 30 seconds
      // This prevents audit log flooding from repeated failed permission checks
      const cacheKey = `${user.id}:${requiredPermission.module}:${requiredPermission.action}`;
      const now = Date.now();
      const lastLogged = this.failedCheckCache.get(cacheKey) || 0;

      if (now - lastLogged > 30000) {
        // 30 seconds
        this.failedCheckCache.set(cacheKey, now);

        // Log failed permission check
        await this.auditLogger.logFailedAction({
          entityType: requiredPermission.module,
          actorUserId: user.id,
          tenantId,
          errorMessage: `Permission denied: ${requiredPermission.module}.${requiredPermission.action}`,
          description: `Failed permission check for ${requiredPermission.module}.${requiredPermission.action}`,
          metadata: {
            endpoint: request.url,
            method: request.method,
            required_permission: `${requiredPermission.module}:${requiredPermission.action}`,
            user_role: user.roles || [],
          },
          ipAddress:
            request.ip ||
            request.headers['x-forwarded-for'] ||
            request.connection?.remoteAddress,
          userAgent: request.headers['user-agent'],
        });
      }

      throw new ForbiddenException(
        `Access denied. Required permission: ${requiredPermission.module}:${requiredPermission.action}`,
      );
    }

    return true;
  }
}
