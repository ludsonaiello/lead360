import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Platform Admin Guard
 *
 * Restricts access to Platform Admins only (is_platform_admin = true).
 * Used for system-wide operations like:
 * - Creating/modifying roles
 * - Creating/modifying permissions
 * - Creating/modifying modules
 * - Managing role templates
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, PlatformAdminGuard)
 * async createRole() { ... }
 *
 * IMPORTANT:
 * - User must be authenticated
 * - Checks is_platform_admin flag on user record
 * - Does NOT require tenant context (platform-wide access)
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // User must be authenticated
    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Check Platform Admin flag
    if (!user.is_platform_admin) {
      throw new ForbiddenException(
        'Access denied. Platform Admin privileges required.',
      );
    }

    return true;
  }
}
