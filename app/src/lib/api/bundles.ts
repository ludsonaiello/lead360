// Bundles API Client
// Sprint 2: 8 endpoints for bundle management
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  Bundle,
  BundleListResponse,
  CreateBundleDto,
  UpdateBundleDto,
  UpdateBundleWithItemsDto,
} from '@/lib/types/quotes';

// ========== BUNDLES (8 endpoints) ==========

/**
 * Create bundle
 * @endpoint POST /bundles
 * @permission quotes:edit
 * @param dto Bundle creation data with items
 * @returns Created bundle with all items and calculated total
 * @throws 400 - Validation errors
 * @throws 404 - Library items not found
 */
export const createBundle = async (dto: CreateBundleDto): Promise<Bundle> => {
  const { data } = await apiClient.post<Bundle>('/bundles', dto);
  return data;
};

/**
 * List all bundles
 * @endpoint GET /bundles
 * @permission quotes:view
 * @param page Page number (default: 1)
 * @param limit Items per page (default: 20, max: 100)
 * @param is_active Filter by active status (default: true)
 * @param sort_by Sort field (default: 'name')
 * @param sort_order Sort direction (default: 'asc')
 * @returns Paginated list of bundles
 */
export const getBundles = async (params?: {
  page?: number;
  limit?: number;
  is_active?: boolean;
  sort_by?: 'name' | 'created_at' | 'updated_at' | 'is_active';
  sort_order?: 'asc' | 'desc';
}): Promise<BundleListResponse> => {
  const { data } = await apiClient.get<BundleListResponse>('/bundles', {
    params,
  });
  return data;
};

/**
 * Get single bundle
 * @endpoint GET /bundles/:id
 * @permission quotes:view
 * @param id Bundle UUID
 * @returns Complete bundle details with all items
 * @throws 404 - Bundle not found
 */
export const getBundleById = async (id: string): Promise<Bundle> => {
  const { data } = await apiClient.get<Bundle>(`/bundles/${id}`);
  return data;
};

/**
 * Update bundle metadata only
 * @endpoint PATCH /bundles/:id
 * @permission quotes:edit
 * @param id Bundle UUID
 * @param dto Partial bundle metadata (name, description)
 * @returns Updated bundle
 * @throws 400 - Validation errors
 * @throws 404 - Bundle not found
 * @note Only updates name and description, does NOT modify items
 */
export const updateBundle = async (
  id: string,
  dto: UpdateBundleDto
): Promise<Bundle> => {
  const { data } = await apiClient.patch<Bundle>(`/bundles/${id}`, dto);
  return data;
};

/**
 * Replace bundle with new data (full update)
 * @endpoint PUT /bundles/:id
 * @permission quotes:edit
 * @param id Bundle UUID
 * @param dto Complete bundle data with items
 * @returns Updated bundle with all items and recalculated total
 * @throws 400 - Validation errors
 * @throws 404 - Bundle or library items not found
 * @note Replaces ALL bundle items - use this for editing bundle contents
 */
export const replaceBundleWithItems = async (
  id: string,
  dto: UpdateBundleWithItemsDto
): Promise<Bundle> => {
  const { data } = await apiClient.put<Bundle>(`/bundles/${id}`, dto);
  return data;
};

/**
 * Delete bundle
 * @endpoint DELETE /bundles/:id
 * @permission quotes:edit
 * @param id Bundle UUID
 * @returns void (204 No Content)
 * @throws 404 - Bundle not found
 * @throws 400 - Cannot delete bundle that is in use (usage_count > 0)
 * @note Should mark as inactive instead if in use
 */
export const deleteBundle = async (id: string): Promise<void> => {
  await apiClient.delete(`/bundles/${id}`);
};

/**
 * Duplicate bundle
 * @endpoint POST /bundles/:id/duplicate
 * @permission quotes:edit
 * @param id Bundle UUID to duplicate
 * @returns New bundle (copy of original with all items)
 * @throws 404 - Bundle not found
 * @note Appends " (Copy)" to name
 */
export const duplicateBundle = async (id: string): Promise<Bundle> => {
  const { data } = await apiClient.post<Bundle>(`/bundles/${id}/duplicate`);
  return data;
};

/**
 * Add bundle to quote
 * @endpoint POST /quotes/:quoteId/bundles/:bundleId
 * @permission quotes:edit
 * @param quoteId Quote UUID
 * @param bundleId Bundle UUID
 * @param options Configuration for bundle application
 * @returns Response with created items count, group, and discount info
 * @throws 404 - Quote or bundle not found
 * @throws 400 - Bundle is inactive or quote is approved
 */
export const addBundleToQuote = async (
  quoteId: string,
  bundleId: string,
  options?: {
    apply_discount?: boolean;
    create_group?: boolean;
    group_name?: string;
  }
): Promise<{
  success: boolean;
  message: string;
  quote_group_id?: string;
  items_created: number;
  discount_applied: boolean;
  discount_rule_id?: string;
}> => {
  const { data } = await apiClient.post(
    `/quotes/${quoteId}/bundles/${bundleId}`,
    options || {}
  );
  return data;
};

/**
 * Toggle bundle active status
 * @endpoint PATCH /bundles/:id/toggle-active
 * @permission quotes:edit
 * @param id Bundle UUID
 * @returns Updated bundle
 * @throws 404 - Bundle not found
 * @note Toggles is_active between true and false
 */
export const toggleBundleActive = async (id: string): Promise<Bundle> => {
  const { data } = await apiClient.patch<Bundle>(
    `/bundles/${id}/toggle-active`
  );
  return data;
};
