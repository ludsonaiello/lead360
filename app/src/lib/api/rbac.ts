// ============================================================================
// RBAC API Client
// ============================================================================
// This file contains all API methods for the RBAC (Role-Based Access Control)
// system. Methods are organized by category and match the backend API docs.
// ============================================================================

import apiClient from './axios';
import type {
  // Response types
  UserRolesResponse,
  UserPermissionsResponse,
  PermissionMatrixResponse,
  Role,
  RoleWithPermissions,
  Permission,
  PermissionWithModule,
  Module,
  ModuleWithPermissions,
  RoleTemplate,
  RoleTemplateWithPermissions,
  BatchRoleAssignmentResponse,
  RoleUsersResponse,
  ReplaceUserRolesResponse,
  DeletePermissionResponse,
  DeleteModuleResponse,
  CloneRoleResponse,
  // Request types
  ReplaceUserRolesRequest,
  BatchRoleAssignmentRequest,
  CloneRoleRequest,
  RoleFormData,
  PermissionFormData,
  ModuleFormData,
  RoleTemplateFormData,
  ApplyTemplateRequest,
} from '../types/rbac';

// ============================================================================
// User Role Management (Owner/Admin Endpoints)
// Base path: /api/v1/user-roles
// ============================================================================

/**
 * Get all roles assigned to a specific user in the current tenant
 *
 * @param userId - User ID (UUID)
 * @returns Promise<UserRole[]>
 *
 * @example
 * const roles = await rbacApi.getUserRoles('user-id-123');
 */
export const getUserRoles = async (userId: string): Promise<UserRolesResponse> => {
  const { data } = await apiClient.get(`/user-roles/${userId}`);
  return data;
};

/**
 * Get all permissions for a user (aggregated from all their roles)
 *
 * @param userId - User ID (UUID)
 * @returns Promise<Permission[]>
 *
 * @example
 * const permissions = await rbacApi.getUserPermissions('user-id-123');
 */
export const getUserPermissions = async (
  userId: string
): Promise<UserPermissionsResponse> => {
  const { data } = await apiClient.get(`/user-roles/${userId}/permissions`);
  return data;
};

/**
 * Assign a single role to a user
 *
 * @param userId - User ID (UUID)
 * @param roleId - Role ID (UUID)
 * @returns Promise<UserRolesResponse>
 *
 * @example
 * await rbacApi.assignRoleToUser('user-id-123', 'role-id-456');
 */
export const assignRoleToUser = async (
  userId: string,
  roleId: string
): Promise<UserRolesResponse> => {
  const { data } = await apiClient.post(`/user-roles/${userId}/roles/${roleId}`);
  return data;
};

/**
 * Remove a single role from a user
 *
 * @param userId - User ID (UUID)
 * @param roleId - Role ID (UUID)
 * @returns Promise<{ message: string }>
 *
 * @example
 * await rbacApi.removeRoleFromUser('user-id-123', 'role-id-456');
 */
export const removeRoleFromUser = async (
  userId: string,
  roleId: string
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete(`/user-roles/${userId}/roles/${roleId}`);
  return data;
};

/**
 * Replace all roles for a user (atomic operation)
 *
 * @param userId - User ID (UUID)
 * @param roleIds - Array of role IDs to assign (replaces all existing)
 * @returns Promise<ReplaceUserRolesResponse>
 *
 * @example
 * await rbacApi.replaceUserRoles('user-id-123', ['role-id-456', 'role-id-789']);
 */
export const replaceUserRoles = async (
  userId: string,
  roleIds: string[]
): Promise<ReplaceUserRolesResponse> => {
  const requestBody: ReplaceUserRolesRequest = { role_ids: roleIds };
  const { data } = await apiClient.patch(`/user-roles/${userId}/roles`, requestBody);
  return data;
};

/**
 * Batch assign roles to multiple users
 *
 * @param userIds - Array of user IDs
 * @param roleIds - Array of role IDs to assign to each user
 * @returns Promise<BatchRoleAssignmentResponse>
 *
 * @example
 * await rbacApi.batchAssignRoles({
 *   user_ids: ['user-1', 'user-2'],
 *   role_ids: ['role-estimator']
 * });
 */
export const batchAssignRoles = async (
  request: BatchRoleAssignmentRequest
): Promise<BatchRoleAssignmentResponse> => {
  const { data } = await apiClient.post('/user-roles/batch/assign', request);
  return data;
};

/**
 * Get all users who have a specific role in the current tenant
 *
 * @param roleId - Role ID (UUID)
 * @returns Promise<RoleUsersResponse[]>
 *
 * @example
 * const users = await rbacApi.getUsersWithRole('role-id-123');
 */
export const getUsersWithRole = async (
  roleId: string
): Promise<RoleUsersResponse[]> => {
  const { data } = await apiClient.get(`/user-roles/role/${roleId}/users`);
  return data;
};

/**
 * Get the complete permission matrix (all roles × permissions)
 * This is useful for displaying role comparison tables
 *
 * @returns Promise<PermissionMatrixResponse>
 *
 * @example
 * const matrix = await rbacApi.getPermissionMatrix();
 * const canOwnerViewLeads = matrix.matrix.Owner.leads.includes('view');
 */
export const getPermissionMatrix = async (): Promise<PermissionMatrixResponse> => {
  const { data } = await apiClient.get('/user-roles/permissions/matrix');
  return data;
};

// ============================================================================
// Platform Admin: Role Management
// Base path: /api/v1/admin/rbac/roles
// ============================================================================

/**
 * Get all roles (Platform Admin only)
 *
 * @param params - Optional query parameters
 * @returns Promise<RoleWithPermissions[]>
 *
 * @example
 * const roles = await rbacApi.getAllRoles({ includeDeleted: false });
 */
export const getAllRoles = async (params?: {
  includeDeleted?: boolean;
}): Promise<RoleWithPermissions[]> => {
  const { data } = await apiClient.get('/admin/rbac/roles', { params });
  return data;
};

/**
 * Get a single role by ID (Platform Admin only)
 *
 * @param roleId - Role ID (UUID)
 * @returns Promise<RoleWithPermissions>
 *
 * @example
 * const role = await rbacApi.getRoleById('role-id-123');
 */
export const getRoleById = async (roleId: string): Promise<RoleWithPermissions> => {
  const { data } = await apiClient.get(`/admin/rbac/roles/${roleId}`);
  return data;
};

/**
 * Create a new custom role (Platform Admin only)
 *
 * @param formData - Role creation data
 * @returns Promise<RoleWithPermissions>
 *
 * @example
 * const role = await rbacApi.createRole({
 *   name: 'Sales Manager',
 *   description: 'Manages sales team',
 *   permission_ids: ['perm-1', 'perm-2']
 * });
 */
export const createRole = async (
  formData: RoleFormData
): Promise<RoleWithPermissions> => {
  // Transform snake_case to camelCase for backend
  const backendPayload = {
    name: formData.name,
    permissionIds: formData.permission_ids,
  };

  const { data } = await apiClient.post('/admin/rbac/roles', backendPayload);
  return data;
};

/**
 * Update an existing role (Platform Admin only)
 *
 * @param roleId - Role ID (UUID)
 * @param formData - Partial role update data
 * @returns Promise<RoleWithPermissions>
 *
 * @example
 * const role = await rbacApi.updateRole('role-id-123', {
 *   name: 'Senior Sales Manager',
 *   is_active: false
 * });
 */
export const updateRole = async (
  roleId: string,
  formData: Partial<RoleFormData>
): Promise<RoleWithPermissions> => {
  // Transform snake_case to camelCase for backend
  const backendPayload: any = {};
  if (formData.name !== undefined) backendPayload.name = formData.name;
  if (formData.permission_ids !== undefined) backendPayload.permissionIds = formData.permission_ids;

  const { data } = await apiClient.patch(`/admin/rbac/roles/${roleId}`, backendPayload);
  return data;
};

/**
 * Delete a role (Platform Admin only)
 * Cannot delete if role is assigned to users
 *
 * @param roleId - Role ID (UUID)
 * @returns Promise<{ message: string }>
 *
 * @example
 * await rbacApi.deleteRole('role-id-123');
 */
export const deleteRole = async (roleId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete(`/admin/rbac/roles/${roleId}`);
  return data;
};

/**
 * Clone an existing role with all its permissions (Platform Admin only)
 *
 * @param roleId - Source role ID (UUID)
 * @param newName - Name for the cloned role
 * @returns Promise<CloneRoleResponse>
 *
 * @example
 * const clonedRole = await rbacApi.cloneRole('role-id-123', 'Custom Manager');
 */
export const cloneRole = async (
  roleId: string,
  newName: string
): Promise<CloneRoleResponse> => {
  const requestBody: CloneRoleRequest = { new_name: newName };
  const { data } = await apiClient.post(`/admin/rbac/roles/${roleId}/clone`, requestBody);
  return data;
};

// ============================================================================
// Platform Admin: Permission Management
// Base path: /api/v1/admin/rbac/permissions
// ============================================================================

/**
 * Get all permissions (Platform Admin only)
 *
 * @param params - Optional filter by module
 * @returns Promise<PermissionWithModule[]>
 *
 * @example
 * const permissions = await rbacApi.getAllPermissions({ module_id: 'module-id-123' });
 */
export const getAllPermissions = async (params?: {
  moduleId?: string;
}): Promise<PermissionWithModule[]> => {
  const { data } = await apiClient.get('/admin/rbac/permissions', { params });
  return data;
};

/**
 * Get a single permission by ID (Platform Admin only)
 *
 * @param permissionId - Permission ID (UUID)
 * @returns Promise<PermissionWithModule>
 *
 * @example
 * const permission = await rbacApi.getPermissionById('perm-id-123');
 */
export const getPermissionById = async (
  permissionId: string
): Promise<PermissionWithModule> => {
  const { data } = await apiClient.get(`/admin/rbac/permissions/${permissionId}`);
  return data;
};

/**
 * Create a new permission (Platform Admin only)
 *
 * @param formData - Permission creation data
 * @returns Promise<Permission>
 *
 * @example
 * const permission = await rbacApi.createPermission({
 *   module_id: 'module-id-123',
 *   action: 'export',
 *   display_name: 'Export Leads',
 *   description: 'Allows exporting leads to CSV/Excel'
 * });
 */
export const createPermission = async (
  formData: PermissionFormData
): Promise<Permission> => {
  // Transform snake_case to camelCase for backend
  const backendPayload = {
    moduleId: formData.module_id,
    action: formData.action,
    displayName: formData.display_name,
    description: formData.description || null,
  };
  const { data } = await apiClient.post('/admin/rbac/permissions', backendPayload);
  return data;
};

/**
 * Update an existing permission (Platform Admin only)
 *
 * @param permissionId - Permission ID (UUID)
 * @param formData - Partial permission update data
 * @returns Promise<Permission>
 *
 * @example
 * const permission = await rbacApi.updatePermission('perm-id-123', {
 *   display_name: 'Export All Leads',
 *   is_active: false
 * });
 */
export const updatePermission = async (
  permissionId: string,
  formData: Partial<PermissionFormData>
): Promise<Permission> => {
  // Transform snake_case to camelCase for backend
  const backendPayload: any = {};
  if (formData.display_name !== undefined) backendPayload.displayName = formData.display_name;
  if (formData.description !== undefined) backendPayload.description = formData.description;

  const { data } = await apiClient.patch(
    `/admin/rbac/permissions/${permissionId}`,
    backendPayload
  );
  return data;
};

/**
 * Delete a permission (Platform Admin only)
 * This removes the permission from all roles (cascade delete)
 *
 * @param permissionId - Permission ID (UUID)
 * @returns Promise<DeletePermissionResponse>
 *
 * @example
 * const result = await rbacApi.deletePermission('perm-id-123');
 * console.log(`Removed from ${result.roles_affected} roles`);
 */
export const deletePermission = async (
  permissionId: string
): Promise<DeletePermissionResponse> => {
  const { data } = await apiClient.delete(`/admin/rbac/permissions/${permissionId}`);
  return data;
};

// ============================================================================
// Platform Admin: Module Management
// Base path: /api/v1/admin/rbac/modules
// ============================================================================

/**
 * Get all modules (Platform Admin only)
 *
 * @param params - Optional include inactive modules
 * @returns Promise<ModuleWithPermissions[]>
 *
 * @example
 * const modules = await rbacApi.getAllModules({ includeInactive: false });
 */
export const getAllModules = async (params?: {
  includeInactive?: boolean;
}): Promise<ModuleWithPermissions[]> => {
  const { data } = await apiClient.get('/admin/rbac/modules', { params });
  return data;
};

/**
 * Get a single module by ID (Platform Admin only)
 *
 * @param moduleId - Module ID (UUID)
 * @returns Promise<Module>
 *
 * @example
 * const module = await rbacApi.getModuleById('module-id-123');
 */
export const getModuleById = async (moduleId: string): Promise<Module> => {
  const { data } = await apiClient.get(`/admin/rbac/modules/${moduleId}`);
  return data;
};

/**
 * Create a new module (Platform Admin only)
 *
 * @param formData - Module creation data
 * @returns Promise<Module>
 *
 * @example
 * const module = await rbacApi.createModule({
 *   name: 'work_orders',
 *   display_name: 'Work Orders',
 *   description: 'Manage work orders',
 *   sort_order: 10
 * });
 */
export const createModule = async (formData: ModuleFormData): Promise<Module> => {
  // Transform snake_case to camelCase for backend
  const backendPayload = {
    name: formData.name,
    displayName: formData.display_name,
    description: formData.description || null,
    icon: formData.icon || null,
    sortOrder: formData.sort_order,
    isActive: formData.is_active ?? true,
  };
  const { data } = await apiClient.post('/admin/rbac/modules', backendPayload);
  return data;
};

/**
 * Update an existing module (Platform Admin only)
 *
 * @param moduleId - Module ID (UUID)
 * @param formData - Module update data
 * @returns Promise<Module>
 *
 * @example
 * const module = await rbacApi.updateModule('module-id-123', {
 *   display_name: 'Project Management Pro',
 *   description: 'Enhanced project tracking',
 *   sort_order: 4,
 *   is_active: true
 * });
 */
export const updateModule = async (
  moduleId: string,
  formData: Partial<ModuleFormData>
): Promise<Module> => {
  // Transform snake_case to camelCase for backend
  const backendPayload: any = {};
  if (formData.display_name !== undefined) backendPayload.displayName = formData.display_name;
  if (formData.description !== undefined) backendPayload.description = formData.description;
  if (formData.icon !== undefined) backendPayload.icon = formData.icon;
  if (formData.sort_order !== undefined) backendPayload.sortOrder = formData.sort_order;
  if (formData.is_active !== undefined) backendPayload.isActive = formData.is_active;

  const { data } = await apiClient.patch(`/admin/rbac/modules/${moduleId}`, backendPayload);
  return data;
};

/**
 * Delete a module (Platform Admin only)
 * This cascades to delete all permissions and role_permissions for this module
 *
 * @param moduleId - Module ID (UUID)
 * @returns Promise<DeleteModuleResponse>
 *
 * @example
 * const result = await rbacApi.deleteModule('module-id-123');
 * console.log(`Deleted ${result.permissions_deleted} permissions`);
 */
export const deleteModule = async (
  moduleId: string
): Promise<DeleteModuleResponse> => {
  const { data } = await apiClient.delete(`/admin/rbac/modules/${moduleId}`);
  return data;
};

// ============================================================================
// Platform Admin: Role Template Management
// Base path: /api/v1/admin/rbac/templates
// ============================================================================

/**
 * Get all role templates (Platform Admin only)
 *
 * @param params - Optional include inactive templates
 * @returns Promise<RoleTemplateWithPermissions[]>
 *
 * @example
 * const templates = await rbacApi.getAllTemplates({ includeInactive: false });
 */
export const getAllTemplates = async (params?: {
  includeInactive?: boolean;
}): Promise<RoleTemplateWithPermissions[]> => {
  const { data } = await apiClient.get('/admin/rbac/templates', { params });
  return data;
};

/**
 * Get a single template by ID (Platform Admin only)
 *
 * @param templateId - Template ID (UUID)
 * @returns Promise<RoleTemplateWithPermissions>
 *
 * @example
 * const template = await rbacApi.getTemplateById('template-id-123');
 */
export const getTemplateById = async (
  templateId: string
): Promise<RoleTemplateWithPermissions> => {
  const { data } = await apiClient.get(`/admin/rbac/templates/${templateId}`);
  return data;
};

/**
 * Create a new role template (Platform Admin only)
 *
 * @param formData - Template creation data
 * @returns Promise<RoleTemplate>
 *
 * @example
 * const template = await rbacApi.createTemplate({
 *   name: 'Custom Manager',
 *   description: 'Custom manager template',
 *   permission_ids: ['perm-1', 'perm-2']
 * });
 */
export const createTemplate = async (
  formData: RoleTemplateFormData
): Promise<RoleTemplate> => {
  // Transform snake_case to camelCase for backend
  const backendPayload = {
    name: formData.name,
    description: formData.description || null,
    permissionIds: formData.permission_ids,
  };
  const { data } = await apiClient.post('/admin/rbac/templates', backendPayload);
  return data;
};

/**
 * Apply a template to create a new role (Platform Admin only)
 *
 * @param templateId - Template ID (UUID)
 * @param formData - New role creation data
 * @returns Promise<RoleWithPermissions>
 *
 * @example
 * const role = await rbacApi.applyTemplate('template-id-123', {
 *   role_name: 'Custom Sales Manager',
 *   description: 'Customized from template'
 * });
 */
export const applyTemplate = async (
  templateId: string,
  formData: ApplyTemplateRequest
): Promise<RoleWithPermissions> => {
  const { data } = await apiClient.post(
    `/admin/rbac/templates/${templateId}/apply`,
    formData
  );
  return data;
};

/**
 * Delete a template (Platform Admin only)
 *
 * @param templateId - Template ID (UUID)
 * @returns Promise<{ message: string }>
 *
 * @example
 * await rbacApi.deleteTemplate('template-id-123');
 */
export const deleteTemplate = async (
  templateId: string
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete(`/admin/rbac/templates/${templateId}`);
  return data;
};

// ============================================================================
// Export all as rbacApi object
// ============================================================================

const rbacApi = {
  // User role management (Owner/Admin)
  getUserRoles,
  getUserPermissions,
  assignRoleToUser,
  removeRoleFromUser,
  replaceUserRoles,
  batchAssignRoles,
  getUsersWithRole,
  getPermissionMatrix,

  // Role management (Platform Admin)
  getAllRoles,
  getRoleById,
  createRole,
  updateRole,
  deleteRole,
  cloneRole,

  // Permission management (Platform Admin)
  getAllPermissions,
  getPermissionById,
  createPermission,
  updatePermission,
  deletePermission,

  // Module management (Platform Admin)
  getAllModules,
  createModule,
  deleteModule,

  // Template management (Platform Admin)
  getAllTemplates,
  getTemplateById,
  createTemplate,
  applyTemplate,
  deleteTemplate,
};

export default rbacApi;
