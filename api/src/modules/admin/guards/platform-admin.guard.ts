import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

/**
 * Platform Admin Guard
 *
 * Ensures only users with is_platform_admin = true can access admin endpoints.
 *
 * Usage:
 * @UseGuards(JwtAuthGuard, PlatformAdminGuard)
 * async someAdminMethod() { ... }
 *
 * IMPORTANT:
 * - User must be authenticated (user object on request)
 * - Only Platform Admins can pass this guard
 * - This is a GLOBAL permission check (not tenant-specific)
 * - Should be used on ALL admin panel endpoints
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

    // User must be Platform Admin
    if (!user.is_platform_admin) {
      throw new ForbiddenException(
        'Platform Admin access required. This endpoint is restricted to platform administrators.',
      );
    }

    return true;
  }
}
