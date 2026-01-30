// Warranty Tiers API Client
// Sprint 2: 5 endpoints for warranty tier management
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  WarrantyTier,
  CreateWarrantyTierDto,
  UpdateWarrantyTierDto,
} from '@/lib/types/quotes';

// ========== WARRANTY TIERS (5 endpoints) ==========

/**
 * Create warranty tier
 * @endpoint POST /warranty-tiers
 * @permission quotes:edit (Owner, Admin, Manager only)
 * @param dto Warranty tier creation data
 * @returns Created warranty tier
 * @throws 400 - Validation errors
 * @throws 409 - Tier name already exists for tenant
 */
export const createWarrantyTier = async (
  dto: CreateWarrantyTierDto
): Promise<WarrantyTier> => {
  const { data } = await apiClient.post<WarrantyTier>('/warranty-tiers', dto);
  return data;
};

/**
 * List all warranty tiers
 * @endpoint GET /warranty-tiers
 * @permission quotes:view
 * @param is_active Filter by active status (optional)
 * @returns Array of warranty tiers
 */
export const getWarrantyTiers = async (params?: {
  is_active?: boolean;
}): Promise<WarrantyTier[]> => {
  const { data } = await apiClient.get<WarrantyTier[]>('/warranty-tiers', {
    params,
  });
  return data;
};

/**
 * Get single warranty tier
 * @endpoint GET /warranty-tiers/:id
 * @permission quotes:view
 * @param id Warranty tier UUID
 * @returns Warranty tier details
 * @throws 404 - Warranty tier not found
 */
export const getWarrantyTierById = async (
  id: string
): Promise<WarrantyTier> => {
  const { data } = await apiClient.get<WarrantyTier>(`/warranty-tiers/${id}`);
  return data;
};

/**
 * Update warranty tier
 * @endpoint PATCH /warranty-tiers/:id
 * @permission quotes:edit (Owner, Admin, Manager only)
 * @param id Warranty tier UUID
 * @param dto Partial warranty tier update data
 * @returns Updated warranty tier
 * @throws 400 - Validation errors
 * @throws 404 - Warranty tier not found
 * @throws 409 - Tier name already exists for tenant
 */
export const updateWarrantyTier = async (
  id: string,
  dto: UpdateWarrantyTierDto
): Promise<WarrantyTier> => {
  const { data } = await apiClient.patch<WarrantyTier>(
    `/warranty-tiers/${id}`,
    dto
  );
  return data;
};

/**
 * Delete warranty tier
 * @endpoint DELETE /warranty-tiers/:id
 * @permission quotes:edit (Owner, Admin, Manager only)
 * @param id Warranty tier UUID
 * @returns void (204 No Content)
 * @throws 404 - Warranty tier not found
 * @throws 400 - Cannot delete tier if in use by quote items
 */
export const deleteWarrantyTier = async (id: string): Promise<void> => {
  await apiClient.delete(`/warranty-tiers/${id}`);
};
