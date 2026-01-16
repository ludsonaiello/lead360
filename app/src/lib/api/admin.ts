/**
 * Admin API Client
 * Platform admin endpoints for managing all tenants
 * Source: /var/www/lead360.app/api/documentation/tenant_REST_API.md (Admin Endpoints section)
 */

import apiClient from './axios';
import type {
  Tenant,
  TenantDetail,
  CreateTenantDto,
  UpdateTenantDto,
  SubdomainCheckResponse,
  TenantUser,
  ImpersonationSession,
  StartImpersonationDto,
  SubscriptionPlan,
  SubscriptionPlanListResponse,
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
  UpdateTenantSubscriptionDetailsDto,
  SubscriptionHistoryResponse,
} from '../types/admin';

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
  next_billing_date: string | null; // Next billing date for active subscriptions
  billing_cycle: string | null; // Billing cycle: 'monthly' or 'annual'
  industry?: { id: string; name: string; description?: string } | null; // Deprecated - single industry (backward compatibility)
  industries?: { id: string; name: string; description?: string }[]; // NEW - many-to-many industries
  user_count: number; // Added flat field for user count
  _count: {
    user: number; // Backend returns "user" not "users"
    tenant_address: number; // Backend returns "tenant_address" not "addresses"
    tenant_license: number; // Backend returns "tenant_license" not "licenses"
  };
  deleted_at: string | null; // Soft delete timestamp
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
  industry_ids?: string[]; // Filter by multiple industries
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

  // Handle industry_ids array - backend will normalize single values to arrays automatically
  if (params?.industry_ids && params.industry_ids.length > 0) {
    params.industry_ids.forEach(id => {
      queryParams.append('industry_ids', id);
    });
  }

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

// ==========================================
// TENANT MANAGEMENT - EXTENDED
// ==========================================

/**
 * Get tenant details by ID
 * GET /api/v1/admin/tenants/:id
 */
export async function getTenantById(tenantId: string): Promise<TenantDetail> {
  const response = await apiClient.get<TenantDetail>(`/admin/tenants/${tenantId}`);
  return response.data;
}

/**
 * Get users for a specific tenant
 * GET /api/v1/admin/tenants/:id/users
 */
export async function getTenantUsers(tenantId: string): Promise<TenantUser[]> {
  const response = await apiClient.get<TenantUser[]>(`/admin/tenants/${tenantId}/users`);
  return response.data;
}

/**
 * Create a new tenant
 * POST /api/v1/admin/tenants
 */
export async function createTenant(dto: CreateTenantDto): Promise<Tenant> {
  const response = await apiClient.post<Tenant>('/admin/tenants', dto);
  return response.data;
}

/**
 * Update tenant details
 * PATCH /api/v1/admin/tenants/:id
 */
export async function updateTenant(tenantId: string, dto: UpdateTenantDto): Promise<Tenant> {
  const response = await apiClient.patch<Tenant>(`/admin/tenants/${tenantId}`, dto);
  return response.data;
}

/**
 * Suspend a tenant
 * PATCH /api/v1/admin/tenants/:id/suspend
 */
export async function suspendTenant(tenantId: string): Promise<Tenant> {
  const response = await apiClient.patch<Tenant>(`/admin/tenants/${tenantId}/suspend`);
  return response.data;
}

/**
 * Activate a tenant (reactivate suspended tenant)
 * PATCH /api/v1/admin/tenants/:id/activate
 *
 * Sets is_active = true
 * Does NOT clear deleted_at (use restoreTenant for deleted tenants)
 */
export async function activateTenant(tenantId: string): Promise<Tenant> {
  const response = await apiClient.patch<Tenant>(`/admin/tenants/${tenantId}/activate`);
  return response.data;
}

/**
 * Restore a soft-deleted tenant from trash
 * PATCH /api/v1/admin/tenants/:id/restore
 *
 * Clears deleted_at (sets to null)
 * Sets is_active = true
 * Tenant is fully functional again
 */
export async function restoreTenant(tenantId: string): Promise<Tenant> {
  const response = await apiClient.patch<Tenant>(`/admin/tenants/${tenantId}/restore`);
  return response.data;
}

/**
 * Delete a tenant (soft delete)
 * DELETE /api/v1/admin/tenants/:id
 */
export async function deleteTenant(tenantId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/admin/tenants/${tenantId}`);
  return response.data;
}

/**
 * Permanently delete a tenant (hard delete)
 * DELETE /api/v1/admin/tenants/:id/permanent
 *
 * WARNING: This is irreversible and will cascade delete all related data
 */
export async function permanentDeleteTenant(tenantId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/admin/tenants/${tenantId}/permanent`);
  return response.data;
}

/**
 * Check subdomain availability
 * GET /api/v1/admin/validation/subdomain?subdomain=example
 */
export async function checkSubdomainAvailability(
  subdomain: string
): Promise<SubdomainCheckResponse> {
  const response = await apiClient.get<SubdomainCheckResponse>(
    `/admin/validation/subdomain`,
    {
      params: { subdomain },
    }
  );
  return response.data;
}

// ==========================================
// IMPERSONATION
// ==========================================

/**
 * Start impersonation session
 * POST /api/v1/admin/impersonation/start
 *
 * Returns impersonation token and session details
 */
export async function startImpersonation(
  dto: StartImpersonationDto
): Promise<ImpersonationSession> {
  const response = await apiClient.post<ImpersonationSession>('/admin/impersonation/start', dto);
  return response.data;
}

/**
 * End impersonation session
 * POST /api/v1/admin/impersonation/end
 */
export async function endImpersonation(): Promise<{ message: string }> {
  const response = await apiClient.post<{ message: string }>('/admin/impersonation/end');
  return response.data;
}

// ==========================================
// TENANT-SPECIFIC DATA ACCESS (Admin)
// ==========================================

/**
 * Get assigned services for a specific tenant
 * GET /api/v1/admin/tenants/:id/assigned-services
 */
export async function getTenantAssignedServices(tenantId: string): Promise<any[]> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/assigned-services`);
  return response.data;
}

/**
 * Get business hours for a specific tenant
 * GET /api/v1/admin/tenants/:id/business-hours
 */
export async function getTenantBusinessHours(tenantId: string): Promise<any[]> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/business-hours`);
  return response.data;
}

/**
 * Get custom hours (holidays) for a specific tenant
 * GET /api/v1/admin/tenants/:id/custom-hours
 */
export async function getTenantCustomHours(tenantId: string): Promise<any[]> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/custom-hours`);
  return response.data;
}

/**
 * Get addresses for a specific tenant
 * GET /api/v1/admin/tenants/:id/addresses
 */
export async function getTenantAddresses(tenantId: string): Promise<any[]> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/addresses`);
  return response.data;
}

/**
 * Get licenses for a specific tenant
 * GET /api/v1/admin/tenants/:id/licenses
 */
export async function getTenantLicenses(tenantId: string): Promise<any[]> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/licenses`);
  return response.data;
}

/**
 * Get insurance for a specific tenant
 * GET /api/v1/admin/tenants/:id/insurance
 */
export async function getTenantInsurance(tenantId: string): Promise<any[]> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/insurance`);
  return response.data;
}

/**
 * Get service areas for a specific tenant
 * GET /api/v1/admin/tenants/:id/service-areas
 */
export async function getTenantServiceAreas(tenantId: string): Promise<any[]> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/service-areas`);
  return response.data;
}

/**
 * Get payment terms for a specific tenant
 * GET /api/v1/admin/tenants/:id/payment-terms
 */
export async function getTenantPaymentTerms(tenantId: string): Promise<any[]> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/payment-terms`);
  return response.data;
}

/**
 * Get statistics for a specific tenant
 * GET /api/v1/admin/tenants/:id/statistics
 */
export async function getTenantStatistics(tenantId: string): Promise<any> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/statistics`);
  return response.data;
}

// ==========================================
// SUBSCRIPTION PLANS MANAGEMENT
// ==========================================

/**
 * Get all subscription plans (admin only)
 * GET /api/v1/admin/subscription-plans
 *
 * NOTE: API returns array directly, not wrapped in object
 */
export async function getSubscriptionPlans(): Promise<SubscriptionPlanListResponse> {
  const response = await apiClient.get('/admin/subscription-plans');

  // Handle array response (API returns array directly, not { plans: [] })
  const plansData = Array.isArray(response.data) ? response.data : response.data.plans || [];

  // Transform each plan to match our TypeScript types
  const transformedPlans = plansData.map((plan: any) => ({
    ...plan,
    // Parse monetary values from strings to numbers
    monthly_price: typeof plan.monthly_price === 'string' ? parseFloat(plan.monthly_price) : plan.monthly_price,
    annual_price: typeof plan.annual_price === 'string' ? parseFloat(plan.annual_price) : plan.annual_price,
    max_storage_gb: typeof plan.max_storage_gb === 'string' ? parseFloat(plan.max_storage_gb) : plan.max_storage_gb,
    // Parse feature_flags from JSON string to object
    feature_flags: typeof plan.feature_flags === 'string' ? JSON.parse(plan.feature_flags) : plan.feature_flags,
  }));

  return {
    plans: transformedPlans,
    pagination: undefined,
  };
}

/**
 * Get a specific subscription plan by ID
 * GET /api/v1/admin/subscription-plans/:id
 */
export async function getSubscriptionPlan(planId: string): Promise<SubscriptionPlan> {
  const response = await apiClient.get<SubscriptionPlan>(`/admin/subscription-plans/${planId}`);
  return response.data;
}

/**
 * Create a new subscription plan
 * POST /api/v1/admin/subscription-plans
 */
export async function createSubscriptionPlan(dto: CreateSubscriptionPlanDto): Promise<SubscriptionPlan> {
  const response = await apiClient.post<SubscriptionPlan>('/admin/subscription-plans', dto);
  return response.data;
}

/**
 * Update a subscription plan
 * PATCH /api/v1/admin/subscription-plans/:id
 */
export async function updateSubscriptionPlan(
  planId: string,
  dto: UpdateSubscriptionPlanDto
): Promise<SubscriptionPlan> {
  const response = await apiClient.patch<SubscriptionPlan>(`/admin/subscription-plans/${planId}`, dto);
  return response.data;
}

/**
 * Delete a subscription plan
 * DELETE /api/v1/admin/subscription-plans/:id
 */
export async function deleteSubscriptionPlan(planId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/admin/subscription-plans/${planId}`);
  return response.data;
}

/**
 * Get tenants using a specific subscription plan
 * GET /api/v1/admin/subscription-plans/:id/tenants
 *
 * NOTE: API returns { plan, tenant_count, tenants } format
 */
export async function getSubscriptionPlanTenants(planId: string): Promise<TenantListResponse> {
  const response = await apiClient.get(`/admin/subscription-plans/${planId}/tenants`);

  // API returns: { plan: {...}, tenant_count: number, tenants: [...] }
  // We need to transform to TenantListResponse format: { data: [...], pagination: {...} }
  const responseData = response.data;

  return {
    data: responseData.tenants || [],
    pagination: {
      total: responseData.tenant_count || 0,
      page: 1,
      limit: responseData.tenant_count || 0,
      total_pages: 1,
    },
  };
}

// ============================================================================
// Tenant Subscription Management
// ============================================================================

/**
 * Change a tenant's subscription plan
 * PATCH /api/v1/admin/tenants/:id/subscription
 */
export async function updateTenantSubscriptionPlan(
  tenantId: string,
  subscriptionPlanId: string
): Promise<TenantDetail> {
  const response = await apiClient.patch(`/admin/tenants/${tenantId}/subscription`, {
    subscription_plan_id: subscriptionPlanId,
  });

  return response.data.tenant;
}

/**
 * Update tenant subscription details (status, billing cycle, dates)
 * PATCH /api/v1/admin/tenants/:id/subscription-details
 */
export async function updateTenantSubscriptionDetails(
  tenantId: string,
  dto: UpdateTenantSubscriptionDetailsDto
): Promise<TenantDetail> {
  const response = await apiClient.patch(`/admin/tenants/${tenantId}/subscription-details`, dto);

  return response.data.tenant;
}

/**
 * Get subscription change history for a tenant
 * GET /api/v1/admin/tenants/:id/subscription-history
 */
export async function getTenantSubscriptionHistory(
  tenantId: string
): Promise<SubscriptionHistoryResponse> {
  const response = await apiClient.get(`/admin/tenants/${tenantId}/subscription-history`);

  return response.data;
}
