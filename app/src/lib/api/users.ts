/**
 * Users API Client
 * Tenant-scoped user management, self-service, invite flow, and platform admin endpoints
 * Source: /var/www/lead360.app/api/documentation/users_REST_API.md
 */

import apiClient from './axios';
import type {
  PaginatedMemberships,
  ListUsersParams,
  MembershipItem,
  InviteUserDto,
  InviteUserResponse,
  UpdateUserRoleDto,
  DeactivateUserDto,
  DeactivateResponse,
  ReactivateResponse,
  UserMeResponse,
  UpdateMeDto,
  ChangePasswordDto,
  InviteTokenInfo,
  AcceptInviteDto,
  AcceptInviteResponse,
  RoleInfo,
  AdminUserListResponse,
  AdminUserListParams,
  AdminUserDetail,
  AdminCreateUserResponse,
  CreateUserAdminDto,
} from '../types/users';

// ============================================================================
// Tenant-Scoped User Management (Owner/Admin)
// ============================================================================

/** List all memberships in tenant (paginated) */
export async function listUsers(params?: ListUsersParams): Promise<PaginatedMemberships> {
  const response = await apiClient.get<PaginatedMemberships>('/users', { params });
  return response.data;
}

/** Get single membership by ID */
export async function getUserById(membershipId: string): Promise<MembershipItem> {
  const response = await apiClient.get<MembershipItem>(`/users/${membershipId}`);
  return response.data;
}

/** Invite a new user to the tenant */
export async function inviteUser(dto: InviteUserDto): Promise<InviteUserResponse> {
  const response = await apiClient.post<InviteUserResponse>('/users/invite', dto);
  return response.data;
}

/** Change a user's role */
export async function changeUserRole(membershipId: string, dto: UpdateUserRoleDto): Promise<MembershipItem> {
  const response = await apiClient.patch<MembershipItem>(`/users/${membershipId}/role`, dto);
  return response.data;
}

/** Deactivate a user (immediate JWT revocation) */
export async function deactivateUser(membershipId: string, dto?: DeactivateUserDto): Promise<DeactivateResponse> {
  const response = await apiClient.patch<DeactivateResponse>(`/users/${membershipId}/deactivate`, dto || {});
  return response.data;
}

/** Reactivate an inactive user */
export async function reactivateUser(membershipId: string): Promise<ReactivateResponse> {
  const response = await apiClient.patch<ReactivateResponse>(`/users/${membershipId}/reactivate`);
  return response.data;
}

/** Delete a user (soft or hard based on history) — Owner only */
export async function deleteUser(membershipId: string): Promise<void> {
  await apiClient.delete(`/users/${membershipId}`);
}

// ============================================================================
// Self-Service (Any Authenticated User)
// ============================================================================

/** Get own profile + active membership */
export async function getMe(): Promise<UserMeResponse> {
  const response = await apiClient.get<UserMeResponse>('/users/me');
  return response.data;
}

/** Update own profile */
export async function updateMe(dto: UpdateMeDto): Promise<{ message: string }> {
  const response = await apiClient.patch<{ message: string }>('/users/me', dto);
  return response.data;
}

/** Change own password */
export async function changeMyPassword(dto: ChangePasswordDto): Promise<{ message: string }> {
  const response = await apiClient.patch<{ message: string }>('/users/me/password', dto);
  return response.data;
}

// ============================================================================
// Invite Flow (Public — No Auth Required)
// ============================================================================

/** Validate invite token (public) */
export async function validateInviteToken(token: string): Promise<InviteTokenInfo> {
  const response = await apiClient.get<InviteTokenInfo>(`/users/invite/${token}`);
  return response.data;
}

/** Accept invite and set password (public) */
export async function acceptInvite(token: string, dto: AcceptInviteDto): Promise<AcceptInviteResponse> {
  const response = await apiClient.post<AcceptInviteResponse>(`/users/invite/${token}/accept`, dto);
  return response.data;
}

// ============================================================================
// Role Listing (for dropdowns)
// ============================================================================

/** List active roles (Owner/Admin only — used in invite and role-change dropdowns) */
export async function listRoles(): Promise<RoleInfo[]> {
  const response = await apiClient.get<RoleInfo[]>('/rbac/roles');
  return response.data;
}

// ============================================================================
// Platform Admin User Management
// ============================================================================

/** List all users cross-tenant (Platform Admin only) */
export async function adminListUsers(params?: AdminUserListParams): Promise<AdminUserListResponse> {
  const response = await apiClient.get<AdminUserListResponse>('/admin/users', { params });
  return response.data;
}

/** Get user details (Platform Admin only) */
export async function adminGetUser(userId: string): Promise<AdminUserDetail> {
  const response = await apiClient.get<AdminUserDetail>(`/admin/users/${userId}`);
  return response.data;
}

/** Force password reset (Platform Admin only) */
export async function adminResetPassword(userId: string): Promise<{ message: string; email: string }> {
  const response = await apiClient.post<{ message: string; email: string }>(`/admin/users/${userId}/reset-password`);
  return response.data;
}

/** Deactivate user — Platform Admin */
export async function adminDeactivateUser(userId: string): Promise<{ message: string; user: { id: string; email: string; is_active: boolean } }> {
  const response = await apiClient.patch<{ message: string; user: { id: string; email: string; is_active: boolean } }>(`/admin/users/${userId}/deactivate`);
  return response.data;
}

/** Activate user — Platform Admin */
export async function adminActivateUser(userId: string): Promise<{ message: string; user: { id: string; email: string; is_active: boolean } }> {
  const response = await apiClient.post<{ message: string; user: { id: string; email: string; is_active: boolean } }>(`/admin/users/${userId}/activate`);
  return response.data;
}

/** Delete user (soft) — Platform Admin */
export async function adminDeleteUser(userId: string): Promise<{ message: string; user: { id: string; email: string; deleted_at: string } }> {
  const response = await apiClient.delete<{ message: string; user: { id: string; email: string; deleted_at: string } }>(`/admin/users/${userId}`);
  return response.data;
}

/** List users in a specific tenant — Platform Admin */
export async function adminListTenantUsers(tenantId: string, params?: ListUsersParams): Promise<PaginatedMemberships> {
  const response = await apiClient.get<PaginatedMemberships>(`/admin/tenants/${tenantId}/users`, { params });
  return response.data;
}

/** Create user in a specific tenant (bypass invite) — Platform Admin */
export async function adminCreateUserInTenant(tenantId: string, dto: CreateUserAdminDto): Promise<AdminCreateUserResponse> {
  const response = await apiClient.post<AdminCreateUserResponse>(`/admin/tenants/${tenantId}/users`, dto);
  return response.data;
}

// ============================================================================
// Export as object (alternative import style)
// ============================================================================

export const usersApi = {
  listUsers,
  getUserById,
  inviteUser,
  changeUserRole,
  deactivateUser,
  reactivateUser,
  deleteUser,
  getMe,
  updateMe,
  changeMyPassword,
  validateInviteToken,
  acceptInvite,
  listRoles,
  adminListUsers,
  adminGetUser,
  adminResetPassword,
  adminDeactivateUser,
  adminActivateUser,
  adminDeleteUser,
  adminListTenantUsers,
  adminCreateUserInTenant,
};

export default usersApi;
