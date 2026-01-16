/**
 * Admin Industries API Client
 * Platform admin endpoints for managing industries
 */

import apiClient from './axios';
import type { Industry } from '../types/admin';

// ==========================================
// INDUSTRY MANAGEMENT ENDPOINTS
// ==========================================

/**
 * List all industries
 * GET /api/v1/admin/industries
 */
export async function listIndustries(activeOnly: boolean = false): Promise<Industry[]> {
  const response = await apiClient.get<Industry[]>('/admin/industries', {
    params: { active_only: activeOnly },
  });
  return response.data;
}

/**
 * Get single industry by ID
 * GET /api/v1/admin/industries/:id
 */
export async function getIndustry(id: string): Promise<Industry> {
  const response = await apiClient.get<Industry>(`/admin/industries/${id}`);
  return response.data;
}

/**
 * Create new industry
 * POST /api/v1/admin/industries
 */
export async function createIndustry(data: {
  name: string;
  description?: string;
  is_active?: boolean;
}): Promise<Industry> {
  const response = await apiClient.post<Industry>('/admin/industries', data);
  return response.data;
}

/**
 * Update existing industry
 * PATCH /api/v1/admin/industries/:id
 */
export async function updateIndustry(
  id: string,
  data: {
    name?: string;
    description?: string;
    is_active?: boolean;
  }
): Promise<Industry> {
  const response = await apiClient.patch<Industry>(`/admin/industries/${id}`, data);
  return response.data;
}

/**
 * Delete industry
 * DELETE /api/v1/admin/industries/:id
 * Returns 409 if industry is in use by tenants
 */
export async function deleteIndustry(id: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/admin/industries/${id}`);
  return response.data;
}
