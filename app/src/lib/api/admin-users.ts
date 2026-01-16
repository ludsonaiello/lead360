/**
 * Admin User Management API Client
 * Endpoints for managing users across all tenants
 */

import apiClient from './axios';
import type {
  AdminUser,
  UserListResponse,
  UserFilters,
  PaginationParams,
} from '../types/admin';

/**
 * Get list of all users across tenants
 * GET /api/v1/admin/users
 */
export async function getAllUsers(
  filters?: UserFilters,
  pagination?: PaginationParams
): Promise<UserListResponse> {
  const params: Record<string, any> = {
    page: pagination?.page || 1,
    limit: pagination?.limit || 50,
    ...filters,
  };

  if (pagination?.sort_by) {
    params.sort_by = pagination.sort_by;
    params.sort_order = pagination.sort_order || 'asc';
  }

  const response = await apiClient.get<UserListResponse>('/admin/users', { params });
  return response.data;
}

/**
 * Get user details by ID
 * GET /api/v1/admin/users/:id
 */
export async function getUserById(userId: string): Promise<AdminUser> {
  const response = await apiClient.get<AdminUser>(`/admin/users/${userId}`);
  return response.data;
}

/**
 * Force password reset for a user
 * POST /api/v1/admin/users/:id/force-reset-password
 *
 * Triggers password reset email to user
 */
export async function forcePasswordReset(userId: string): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>(
    `/admin/users/${userId}/force-reset-password`
  );
  return response.data;
}

/**
 * Activate a user
 * PATCH /api/v1/admin/users/:id/activate
 */
export async function activateUser(userId: string): Promise<AdminUser> {
  const response = await apiClient.patch<AdminUser>(`/admin/users/${userId}/activate`);
  return response.data;
}

/**
 * Deactivate a user
 * PATCH /api/v1/admin/users/:id/deactivate
 */
export async function deactivateUser(userId: string): Promise<AdminUser> {
  const response = await apiClient.patch<AdminUser>(`/admin/users/${userId}/deactivate`);
  return response.data;
}

/**
 * Delete a user (soft delete)
 * DELETE /api/v1/admin/users/:id
 */
export async function deleteUser(userId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/admin/users/${userId}`);
  return response.data;
}
