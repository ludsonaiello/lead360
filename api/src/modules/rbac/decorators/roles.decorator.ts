import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles Decorator
 *
 * Specifies which roles are allowed to access a route.
 * Must be used with RolesGuard.
 *
 * This is a DYNAMIC check - roles are queried from database with tenant context.
 *
 * @param roles - Array of role names (e.g., 'Owner', 'Admin', 'Estimator')
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('Owner')
 * async ownerOnlyMethod() { ... }
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('Owner', 'Admin')
 * async ownerOrAdminMethod() { ... }
 *
 * IMPORTANT:
 * - Platform Admins bypass this check (via RBACService)
 * - Role check is tenant-aware (user must have role in current tenant)
 * - User's roles are queried from database dynamically (no cached roles)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
