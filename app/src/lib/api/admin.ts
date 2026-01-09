/**
 * Admin API Client
 * Platform admin endpoints for managing all tenants
 * Source: /var/www/lead360.app/api/documentation/tenant_REST_API.md (Admin Endpoints section)
 */

import apiClient from './axios';

// ==========================================
// TYPES
// ==========================================

export interface TenantListItem {
  id: string;
  subdomain: string;
  company_name: string;
  legal_business_name: string | null;
  ein: string | null;
  is_active: boolean;
  subscription_status: string;
  subscription_plan_id: string | null;
  subscription_plan: {
    id: string;
    name: string;
    monthly_price: number;
  } | null;
  _count: {
    user: number; // Backend returns "user" not "users"
    tenant_address: number; // Backend returns "tenant_address" not "addresses"
    tenant_license: number; // Backend returns "tenant_license" not "licenses"
  };
  created_at: string;
}

export interface TenantListResponse {
  data: TenantListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface TenantListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

// ==========================================
// TENANT MANAGEMENT ENDPOINTS
// ==========================================

/**
 * Get paginated list of all tenants (admin only)
 * GET /api/v1/admin/tenants
 */
export async function getAllTenants(params?: TenantListParams): Promise<TenantListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.status) queryParams.append('status', params.status);

  const url = `/admin/tenants${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<TenantListResponse>(url);
  return response.data;
}

// ==========================================
// TYPES - FILES
// ==========================================

export interface AdminFileListParams {
  tenant_id?: string;
  page?: number;
  limit?: number;
  status?: 'active' | 'trashed';
  mime_type?: string;
  search?: string;
  category?: string;
  entity_type?: string;
  entity_id?: string;
  file_type?: string;
  start_date?: string;
  end_date?: string;
}

export interface AdminFileListItem {
  file_id: string;
  tenant_id: string;
  tenant_file_tenant_idTotenant: {
    id: string;
    company_name: string;
  };
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  category: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_trashed: boolean;
  uploaded_by: string;
  user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  created_at: string;
  trashed_at: string | null;
}

export interface AdminFileListResponse {
  data: AdminFileListItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

// ==========================================
// FILE MANAGEMENT ENDPOINTS (ADMIN)
// ==========================================

/**
 * Get paginated list of all files across tenants (admin only)
 * GET /api/v1/admin/files
 */
export async function getAdminFiles(params?: AdminFileListParams): Promise<AdminFileListResponse> {
  const queryParams = new URLSearchParams();

  if (params?.tenant_id) queryParams.append('tenant_id', params.tenant_id);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.mime_type) queryParams.append('mime_type', params.mime_type);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.category) queryParams.append('category', params.category);
  if (params?.entity_type) queryParams.append('entity_type', params.entity_type);
  if (params?.entity_id) queryParams.append('entity_id', params.entity_id);
  if (params?.file_type) queryParams.append('file_type', params.file_type);
  if (params?.start_date) queryParams.append('start_date', params.start_date);
  if (params?.end_date) queryParams.append('end_date', params.end_date);

  const url = `/admin/files${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  console.log('[API] getAdminFiles - Request URL:', url);
  console.log('[API] getAdminFiles - Params:', params);

  const response = await apiClient.get<AdminFileListResponse>(url);

  console.log('[API] getAdminFiles - Response status:', response.status);
  console.log('[API] getAdminFiles - Response data:', response.data);

  return response.data;
}

/**
 * Get file details (admin - any tenant)
 * GET /api/v1/admin/files/:id
 */
export async function getAdminFile(fileId: string): Promise<AdminFileListItem> {
  const response = await apiClient.get<AdminFileListItem>(`/admin/files/${fileId}`);
  return response.data;
}

/**
 * Delete file permanently (admin - any tenant)
 * DELETE /api/v1/admin/files/:id
 */
export async function deleteAdminFile(fileId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/admin/files/${fileId}`);
  return response.data;
}
