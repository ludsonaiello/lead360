/**
 * Admin Services API Client
 * Platform admin endpoints for managing services
 */

import apiClient from './axios';
import type { Service } from '../types/admin';

// ==========================================
// SERVICE MANAGEMENT ENDPOINTS
// ==========================================

/**
 * List all services
 * GET /api/v1/admin/services
 */
export async function listServices(activeOnly: boolean = false): Promise<Service[]> {
  const response = await apiClient.get<Service[]>('/admin/services', {
    params: { active_only: activeOnly },
  });
  return response.data;
}

/**
 * Get single service by ID
 * GET /api/v1/admin/services/:id
 */
export async function getService(id: string): Promise<Service> {
  const response = await apiClient.get<Service>(`/admin/services/${id}`);
  return response.data;
}

/**
 * Create new service
 * POST /api/v1/admin/services
 */
export async function createService(data: {
  name: string;
  slug?: string;
  description?: string;
  is_active?: boolean;
}): Promise<Service> {
  const response = await apiClient.post<Service>('/admin/services', data);
  return response.data;
}

/**
 * Update existing service
 * PATCH /api/v1/admin/services/:id
 */
export async function updateService(
  id: string,
  data: {
    name?: string;
    slug?: string;
    description?: string;
    is_active?: boolean;
  }
): Promise<Service> {
  const response = await apiClient.patch<Service>(`/admin/services/${id}`, data);
  return response.data;
}

/**
 * Delete service
 * DELETE /api/v1/admin/services/:id
 * Returns 409 if service is in use by tenants
 */
export async function deleteService(id: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/admin/services/${id}`);
  return response.data;
}
