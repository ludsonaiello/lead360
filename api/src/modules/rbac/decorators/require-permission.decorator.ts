import { SetMetadata } from '@nestjs/common';

export const REQUIRE_PERMISSION_KEY = 'require_permission';

/**
 * Require Permission Decorator
 *
 * Specifies which permission (module + action) is required to access a route.
 * Must be used with PermissionGuard.
 *
 * This is the DYNAMIC RBAC decorator - permissions are checked via database at runtime.
 *
 * @param module - Module name (e.g., 'leads', 'quotes', 'invoices')
 * @param action - Action name (e.g., 'view', 'create', 'edit', 'delete', 'export')
 *
 * @example
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @RequirePermission('leads', 'create')
 * async createLead() { ... }
 *
 * @example
 * @UseGuards(JwtAuthGuard, PermissionGuard)
 * @RequirePermission('quotes', 'export')
 * async exportQuotes() { ... }
 *
 * IMPORTANT:
 * - Platform Admins bypass this check (via RBACService)
 * - Permission check is tenant-aware (user must have permission in current tenant)
 * - Permission is queried from database dynamically (no hardcoded permissions)
 */
export const RequirePermission = (module: string, action: string) =>
  SetMetadata(REQUIRE_PERMISSION_KEY, { module, action });
