// ============================================================================
// RBAC Type Definitions
// ============================================================================
// This file contains all TypeScript interfaces for the RBAC (Role-Based
// Access Control) system. Types are based on the API documentation.
// ============================================================================

// ============================================================================
// Core Entities
// ============================================================================

/**
 * Role entity
 */
export interface Role {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
  created_by_user_id: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Permission entity
 */
export interface Permission {
  id: string;
  module_id: string;
  action: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  module?: Module; // Optional nested module
}

/**
 * Module entity (platform features)
 */
export interface Module {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Role Template entity
 */
export interface RoleTemplate {
  id: string;
  name: string;
  description: string | null;
  is_system_template: boolean;
  is_active: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * User Role assignment (junction table)
 */
export interface UserRole {
  id: string;
  user_id: string;
  role_id: string;
  tenant_id: string;
  assigned_by_user_id: string | null;
  assigned_at: string;
  updated_at: string;
  role: Role; // Nested role details
}

/**
 * Role Permission assignment (junction table)
 */
export interface RolePermission {
  id: string;
  role_id: string;
  permission_id: string;
  granted_at: string;
  granted_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  permission: Permission; // Nested permission details
}

/**
 * Role Template Permission (junction table)
 */
export interface RoleTemplatePermission {
  id: string;
  role_template_id: string;
  permission_id: string;
  created_at: string;
  permission: Permission; // Nested permission details
}

// ============================================================================
// API Response Shapes
// ============================================================================

/**
 * Response for GET /user-roles/:userId
 */
export interface UserRolesResponse {
  roles: UserRole[];
}

/**
 * Response for GET /user-roles/:userId/permissions
 */
export interface UserPermissionsResponse {
  permissions: Permission[];
}

/**
 * Permission Matrix Response
 * Response for GET /user-roles/permissions/matrix
 */
export interface PermissionMatrixResponse {
  matrix: {
    [roleName: string]: {
      [moduleName: string]: string[]; // Array of action names
    };
  };
  modules: Array<{
    id: string;
    name: string;
    display_name: string;
    description: string | null;
    is_active: boolean;
    sort_order: number;
    icon: string | null;
    created_at: string;
    updated_at: string;
    permissions: Array<{
      id: string;
      action: string;
      display_name: string;
    }>;
  }>;
}

/**
 * Role with permissions and user count
 */
export interface RoleWithPermissions extends Role {
  role_permissions: RolePermission[];
  _count?: {
    user_roles: number;
  };
}

/**
 * Permission with module and usage count
 */
export interface PermissionWithModule extends Permission {
  module: Module;
  _count?: {
    role_permissions: number;
    role_template_permissions: number;
  };
}

/**
 * Module with permissions
 */
export interface ModuleWithPermissions extends Module {
  permissions: Permission[];
  _count?: {
    permissions: number;
  };
}

/**
 * Template with permissions
 */
export interface RoleTemplateWithPermissions extends RoleTemplate {
  role_template_permissions: RoleTemplatePermission[];
  _count?: {
    role_template_permissions: number;
  };
}

/**
 * Response for batch role assignment
 * Response for POST /user-roles/batch/assign
 */
export interface BatchRoleAssignmentResponse {
  users_updated: number;
  roles_assigned: number;
  details: Array<{
    user_id: string;
    roles_added: number;
  }>;
}

/**
 * Response for GET /user-roles/role/:roleId/users
 */
export interface RoleUsersResponse {
  id: string;
  user_id: string;
  role_id: string;
  tenant_id: string;
  assigned_by_user_id: string | null;
  assigned_at: string;
  updated_at: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  role: {
    name: string;
  };
}

/**
 * Response for PATCH /user-roles/:userId/roles
 */
export interface ReplaceUserRolesResponse {
  roles_added: number;
  roles_removed: number;
  current_roles: UserRole[];
}

/**
 * Response for DELETE /admin/rbac/permissions/:id
 */
export interface DeletePermissionResponse {
  message: string;
  roles_affected: number;
}

/**
 * Response for DELETE /admin/rbac/modules/:id
 */
export interface DeleteModuleResponse {
  message: string;
  permissions_deleted: number;
  role_permissions_deleted: number;
}

/**
 * Response for POST /admin/rbac/roles/:id/clone
 */
export interface CloneRoleResponse extends RoleWithPermissions {
  permissions_copied?: number;
}

// ============================================================================
// Form Data Types (for creating/updating entities)
// ============================================================================

/**
 * Form data for creating/updating a role
 */
export interface RoleFormData {
  name: string;
  description?: string | null;
  permission_ids?: string[];
}

/**
 * Form data for creating/updating a permission
 */
export interface PermissionFormData {
  module_id: string;
  action: string;
  display_name: string;
  description?: string | null;
}

/**
 * Form data for creating/updating a module
 */
export interface ModuleFormData {
  name: string;
  display_name: string;
  description?: string | null;
  icon?: string | null;
  sort_order: number;
  is_active?: boolean;
}

/**
 * Form data for creating/updating a role template
 */
export interface RoleTemplateFormData {
  name: string;
  description?: string | null;
  permission_ids: string[];
}

/**
 * Form data for applying a template to create a role
 */
export interface ApplyTemplateFormData {
  role_name: string;
  description?: string | null;
}

/**
 * Form data for editing user roles
 */
export interface EditUserRolesFormData {
  role_ids: string[];
}

/**
 * Form data for batch role assignment
 */
export interface BatchRoleAssignmentFormData {
  user_ids: string[];
  role_ids: string[];
}

/**
 * Form data for cloning a role
 */
export interface CloneRoleFormData {
  new_name: string;
  description?: string | null;
}

// ============================================================================
// Request Body Types
// ============================================================================

/**
 * Request body for PATCH /user-roles/:userId/roles
 */
export interface ReplaceUserRolesRequest {
  role_ids: string[];
}

/**
 * Request body for POST /user-roles/batch/assign
 */
export interface BatchRoleAssignmentRequest {
  user_ids: string[];
  role_ids: string[];
}

/**
 * Request body for POST /admin/rbac/roles/:id/clone
 */
export interface CloneRoleRequest {
  new_name: string;
}

/**
 * Request body for PATCH /admin/rbac/roles/:id/permissions/batch
 */
export interface BatchUpdateRolePermissionsRequest {
  add: string[];
  remove: string[];
}

/**
 * Request body for PUT /admin/rbac/roles/:id/permissions
 */
export interface ReplaceRolePermissionsRequest {
  permission_ids: string[];
}

/**
 * Request body for POST /admin/rbac/templates/:id/apply
 */
export interface ApplyTemplateRequest {
  role_name: string;
  description?: string | null;
}

// ============================================================================
// Hook Return Types
// ============================================================================

/**
 * Return type for useRole hook
 */
export interface UseRoleResult {
  hasRole: (roleName: string | string[]) => boolean;
  hasAnyRole: (roleNames: string[]) => boolean;
  hasAllRoles: (roleNames: string[]) => boolean;
  roles: Role[];
  roleNames: Set<string>;
  loading: boolean;
}

/**
 * Return type for usePermission hook
 */
export interface UsePermissionResult {
  hasPermission: (moduleAction: string | string[]) => boolean;
  hasAnyPermission: (moduleActions: string[]) => boolean;
  hasAllPermissions: (moduleActions: string[]) => boolean;
  canPerform: (module: string, action: string) => boolean;
  permissions: Permission[];
  permissionCodes: Set<string>;
  loading: boolean;
}

/**
 * Return type for usePermissionMatrix hook
 */
export interface UsePermissionMatrixResult {
  matrix: PermissionMatrixResponse | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Return type for useCurrentUserRoles hook
 */
export interface UseCurrentUserRolesResult {
  roles: Role[];
  permissions: Permission[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// ============================================================================
// Context State Shape
// ============================================================================

/**
 * RBAC Context state
 */
export interface RBACContextState {
  currentUserId: string | null;
  roles: Role[];
  permissions: Permission[];
  roleNames: Set<string>; // For O(1) lookup
  permissionCodes: Set<string>; // For O(1) lookup (format: "module:action")
  loading: boolean;
  error: Error | null;

  // Methods
  hasRole: (roleName: string | string[]) => boolean;
  hasPermission: (moduleAction: string | string[]) => boolean;
  canPerform: (module: string, action: string) => boolean;
  refresh: () => Promise<void>;
}

// ============================================================================
// Component Props
// ============================================================================

/**
 * Props for ProtectedRoute component
 */
export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string | string[];
  requiredRole?: string | string[];
  requireAll?: boolean; // Require all permissions/roles (default: false = any)
  fallback?: React.ReactNode;
  redirectTo?: string; // Default: /forbidden
}

/**
 * Props for ProtectedButton component
 */
export interface ProtectedButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  requiredPermission?: string | string[];
  requiredRole?: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode; // Show this instead of button if unauthorized
}

/**
 * Props for ProtectedMenuItem component
 */
export interface ProtectedMenuItemProps {
  children: React.ReactNode;
  requiredPermission?: string | string[];
  requiredRole?: string | string[];
  requireAll?: boolean;
}

/**
 * Props for PermissionGate component
 */
export interface PermissionGateProps {
  children: React.ReactNode;
  requiredPermission?: string | string[];
  requiredRole?: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}

/**
 * Props for RoleGate component
 */
export interface RoleGateProps {
  children: React.ReactNode;
  requiredRole: string | string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}

/**
 * Props for PermissionBuilder component
 */
export interface PermissionBuilderProps {
  selectedPermissionIds: string[];
  onChange: (permissionIds: string[]) => void;
  disabled?: boolean;
  loading?: boolean;
}

/**
 * Props for RoleBadge component
 */
export interface RoleBadgeProps {
  role: Role;
  onRemove?: (roleId: string) => void;
  removable?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Props for UserRoleBadges component
 */
export interface UserRoleBadgesProps {
  userId: string;
  maxDisplay?: number;
  showCount?: boolean;
  editable?: boolean;
  onEdit?: () => void;
}

/**
 * Props for EditUserRolesModal component
 */
export interface EditUserRolesModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Props for BatchRoleAssignmentModal component
 */
export interface BatchRoleAssignmentModalProps {
  userIds: string[];
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * Props for RoleCard component
 */
export interface RoleCardProps {
  role: RoleWithPermissions;
  showActions?: boolean;
  onEdit?: (roleId: string) => void;
  onClone?: (roleId: string) => void;
  onDelete?: (roleId: string) => void;
}

/**
 * Props for CloneRoleModal component
 */
export interface CloneRoleModalProps {
  role: Role;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newRole: Role) => void;
}

/**
 * Props for DeleteRoleModal component
 */
export interface DeleteRoleModalProps {
  role: RoleWithPermissions;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Permission code format: "module:action"
 * Example: "leads:view", "quotes:create"
 */
export type PermissionCode = string;

/**
 * Role name (from backend)
 * Example: "Owner", "Admin", "Estimator"
 */
export type RoleName = string;

/**
 * Error info for display
 */
export interface ErrorInfo {
  title: string;
  message: string;
  action?: string;
  requestId?: string;
  errorCode?: string;
}

/**
 * Standard API error response
 */
export interface ApiError {
  statusCode: number;
  message: string;
  error: string;
  errorCode?: string;
}
