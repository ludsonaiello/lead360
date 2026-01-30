// Unit Measurements API Client
// Sprint 2: 6 endpoints for unit measurement management
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  UnitMeasurement,
  UnitMeasurementListResponse,
  CreateCustomUnitDto,
  UpdateCustomUnitDto,
  UnitUsageResponse,
} from '@/lib/types/quotes';

// ========== UNIT MEASUREMENTS (6 endpoints) ==========

/**
 * List all unit measurements (global + custom)
 * @endpoint GET /units
 * @permission quotes:view
 * @returns Object with data array containing all units (use is_global flag to differentiate)
 * @note Global units have is_global=true (platform-wide, read-only), custom units have is_global=false (tenant-specific, editable)
 */
export const getUnitMeasurements =
  async (): Promise<UnitMeasurementListResponse> => {
    const { data } = await apiClient.get<UnitMeasurementListResponse>(
      '/units'
    );
    return data;
  };

/**
 * Create custom unit measurement
 * @endpoint POST /units
 * @permission quotes:edit (Owner, Admin, Manager only)
 * @param dto Custom unit creation data
 * @returns Created custom unit
 * @throws 400 - Validation errors
 * @throws 409 - Name or abbreviation already exists for tenant
 */
export const createCustomUnit = async (
  dto: CreateCustomUnitDto
): Promise<UnitMeasurement> => {
  const { data } = await apiClient.post<UnitMeasurement>(
    '/units',
    dto
  );
  return data;
};

/**
 * Get single custom unit
 * @endpoint GET /units/:id
 * @permission quotes:view
 * @param id Custom unit UUID
 * @returns Custom unit details
 * @throws 404 - Custom unit not found or doesn't belong to tenant
 */
export const getCustomUnitById = async (
  id: string
): Promise<UnitMeasurement> => {
  const { data } = await apiClient.get<UnitMeasurement>(
    `/units/${id}`
  );
  return data;
};

/**
 * Update custom unit
 * @endpoint PATCH /units/:id
 * @permission quotes:edit (Owner, Admin, Manager only)
 * @param id Custom unit UUID
 * @param dto Partial custom unit update data
 * @returns Updated custom unit
 * @throws 400 - Validation errors
 * @throws 404 - Custom unit not found
 * @throws 409 - Name or abbreviation already exists
 */
export const updateCustomUnit = async (
  id: string,
  dto: UpdateCustomUnitDto
): Promise<UnitMeasurement> => {
  const { data } = await apiClient.patch<UnitMeasurement>(
    `/units/${id}`,
    dto
  );
  return data;
};

/**
 * Delete custom unit
 * @endpoint DELETE /units/:id
 * @permission quotes:edit (Owner, Admin only)
 * @param id Custom unit UUID
 * @returns void (204 No Content)
 * @throws 404 - Custom unit not found
 * @throws 400 - Cannot delete unit that is in use (usage_count > 0)
 */
export const deleteCustomUnit = async (id: string): Promise<void> => {
  await apiClient.delete(`/units/${id}`);
};

/**
 * Check if custom unit is in use
 * @endpoint GET /units/:id/usage
 * @permission quotes:view
 * @param id Custom unit UUID
 * @returns Usage information with locations where unit is used
 * @throws 404 - Custom unit not found
 * @note Use this before deleting to check for dependencies
 */
export const getCustomUnitUsage = async (
  id: string
): Promise<UnitUsageResponse> => {
  const { data } = await apiClient.get<UnitUsageResponse>(
    `/units/${id}/usage`
  );
  return data;
};
