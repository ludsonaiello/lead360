/**
 * Users Module Type Definitions
 * Types for user management, invitations, and membership lifecycle
 * Matches backend API at /api/v1/users/*
 * Verified against live API responses on 2026-03-16
 */

// ============================================================================
// Enums
// ============================================================================

export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'INACTIVE';

// ============================================================================
// Core Entities
// ============================================================================

export interface RoleInfo {
  id: string;
  name: string;
  description?: string | null;
}

export interface InvitedByInfo {
  id: string;
  first_name: string;
  last_name: string;
}

export interface MembershipItem {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url?: string | null;
  role: RoleInfo;
  status: MembershipStatus;
  joined_at: string | null;
  left_at: string | null;
  invited_by: InvitedByInfo | null;
  created_at: string;
}

export interface UserMeResponse {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  membership: {
    id: string;
    tenant_id: string;
    role: RoleInfo;
    status: MembershipStatus;
    joined_at: string | null;
  };
}

// ============================================================================
// Pagination
// ============================================================================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface PaginatedMemberships {
  data: MembershipItem[];
  meta: PaginationMeta;
}

// ============================================================================
// Request DTOs
// ============================================================================

export interface InviteUserDto {
  email: string;
  role_id: string;
  first_name: string;
  last_name: string;
}

export interface ListUsersParams {
  page?: number;
  limit?: number;
  status?: MembershipStatus;
  role_id?: string;
}

export interface UpdateUserRoleDto {
  role_id: string;
}

export interface DeactivateUserDto {
  reason?: string;
}

export interface UpdateMeDto {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface ChangePasswordDto {
  current_password: string;
  new_password: string;
}

export interface AcceptInviteDto {
  password: string;
}

// ============================================================================
// Response DTOs
// ============================================================================

export interface InviteUserResponse {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleInfo;
  status: 'INVITED';
  created_at: string;
}

export interface DeactivateResponse {
  id: string;
  status: 'INACTIVE';
  left_at: string;
}

export interface ReactivateResponse {
  id: string;
  status: 'ACTIVE';
  joined_at: string;
}

export interface InviteTokenInfo {
  tenant_name: string;
  role_name: string;
  invited_by_name: string;
  email: string;
  expires_at: string;
}

export interface AcceptInviteResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  tenant: {
    id: string;
    company_name: string;
  };
  role: string;
}

// ============================================================================
// Platform Admin Types
// ============================================================================

export interface AdminUserListItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_platform_admin: boolean;
  tenant_id?: string;
  tenant_subdomain?: string;
  tenant_company_name?: string;
  roles: string[];
  last_login_at: string | null;
  created_at: string;
}

export interface AdminUserListResponse {
  data: AdminUserListItem[];
  pagination: PaginationMeta;
}

export interface AdminUserListParams {
  page?: number;
  limit?: number;
  tenant_id?: string;
  role?: string;
  status?: 'active' | 'inactive' | 'deleted';
  search?: string;
  last_login_from?: string;
  last_login_to?: string;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
  email_verified: boolean;
  tenant_id?: string;
  tenant?: {
    id: string;
    subdomain: string;
    company_name: string;
  } | null;
  roles: {
    id: string;
    name: string;
    description: string | null;
    assigned_at: string;
  }[];
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminCreateUserResponse {
  id: string;
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: RoleInfo;
  status: 'ACTIVE';
  joined_at: string | null;
  created_at: string;
}

export interface CreateUserAdminDto {
  email: string;
  first_name: string;
  last_name: string;
  role_id: string;
  password: string;
  phone?: string;
}
