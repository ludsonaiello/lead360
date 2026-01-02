import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Roles Decorator
 *
 * Specifies which roles are allowed to access a route.
 * Must be used with RolesGuard.
 *
 * @param roles - Array of role names (e.g., 'Platform Admin', 'Owner', 'Admin')
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('Platform Admin')
 * async adminOnlyMethod() { ... }
 *
 * @example
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * @Roles('Owner', 'Admin')
 * async ownerOrAdminMethod() { ... }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
