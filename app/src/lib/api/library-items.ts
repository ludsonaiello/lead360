// Library Items API Client
// Sprint 2: 10 endpoints for item library management
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  LibraryItem,
  LibraryItemListResponse,
  CreateLibraryItemDto,
  UpdateLibraryItemDto,
  BulkImportResult,
  LibraryItemUsageStats,
} from '@/lib/types/quotes';

// ========== LIBRARY ITEMS (10 endpoints) ==========

/**
 * Create library item
 * @endpoint POST /item-library
 * @permission quotes:edit
 * @param dto Library item creation data
 * @returns Created library item with calculated totals
 * @throws 400 - Validation errors
 * @throws 404 - Unit not found
 */
export const createLibraryItem = async (
  dto: CreateLibraryItemDto
): Promise<LibraryItem> => {
  const { data } = await apiClient.post<LibraryItem>('/item-library', dto);
  return data;
};

/**
 * List all library items
 * @endpoint GET /item-library
 * @permission quotes:view
 * @param page Page number (default: 1)
 * @param limit Items per page (default: 20, max: 100)
 * @param search Search term (searches title and description)
 * @param unit_measurement_id Filter by unit measurement ID
 * @param is_active Filter by active status (default: true)
 * @param sort_by Sort field (default: 'title')
 * @param sort_order Sort direction (default: 'asc')
 * @returns Paginated list of library items
 */
export const getLibraryItems = async (params?: {
  page?: number;
  limit?: number;
  search?: string;
  unit_measurement_id?: string;
  is_active?: boolean;
  sort_by?: 'title' | 'usage_count' | 'created_at';
  sort_order?: 'asc' | 'desc';
}): Promise<LibraryItemListResponse> => {
  const { data } = await apiClient.get<LibraryItemListResponse>(
    '/item-library',
    { params }
  );
  return data;
};

/**
 * Get single library item
 * @endpoint GET /item-library/:id
 * @permission quotes:view
 * @param id Library item UUID
 * @returns Complete library item details
 * @throws 404 - Library item not found
 */
export const getLibraryItemById = async (id: string): Promise<LibraryItem> => {
  const { data } = await apiClient.get<LibraryItem>(`/item-library/${id}`);
  return data;
};

/**
 * Update library item
 * @endpoint PATCH /item-library/:id
 * @permission quotes:edit
 * @param id Library item UUID
 * @param dto Partial library item update data
 * @returns Updated library item with recalculated totals
 * @throws 400 - Validation errors
 * @throws 404 - Library item not found
 */
export const updateLibraryItem = async (
  id: string,
  dto: UpdateLibraryItemDto
): Promise<LibraryItem> => {
  const { data } = await apiClient.patch<LibraryItem>(
    `/item-library/${id}`,
    dto
  );
  return data;
};

/**
 * Delete library item
 * @endpoint DELETE /item-library/:id
 * @permission quotes:edit
 * @param id Library item UUID
 * @returns void (204 No Content)
 * @throws 404 - Library item not found
 * @throws 400 - Cannot delete item that is in use (has usage_count > 0)
 * @note Should mark as inactive instead if in use
 */
export const deleteLibraryItem = async (id: string): Promise<void> => {
  await apiClient.delete(`/item-library/${id}`);
};

/**
 * Toggle library item active status
 * @endpoint PATCH /item-library/:id/toggle-active
 * @permission quotes:edit
 * @param id Library item UUID
 * @returns Updated library item
 * @throws 404 - Library item not found
 * @note Toggles is_active between true and false
 */
export const toggleLibraryItemActive = async (
  id: string
): Promise<LibraryItem> => {
  const { data } = await apiClient.patch<LibraryItem>(
    `/item-library/${id}/toggle-active`
  );
  return data;
};

/**
 * Bulk import library items from CSV
 * @endpoint POST /item-library/bulk-import
 * @permission quotes:edit
 * @param file CSV file (FormData)
 * @returns Import results with success/error counts and details
 * @throws 400 - Invalid CSV format or validation errors
 * @note CSV columns: title, description, unit_abbreviation, material_cost, labor_cost, equipment_cost, subcontract_cost, other_cost
 */
export const bulkImportLibraryItems = async (
  file: File
): Promise<BulkImportResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post<BulkImportResult>(
    '/item-library/bulk-import',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return data;
};

/**
 * Download CSV template for bulk import
 * @endpoint GET /item-library/bulk-import/template
 * @permission quotes:view
 * @returns CSV file download
 * @note Returns file with correct headers and sample row
 */
export const downloadBulkImportTemplate = async (): Promise<Blob> => {
  const { data } = await apiClient.get('/item-library/bulk-import/template', {
    responseType: 'blob',
  });
  return data;
};

/**
 * Search library items
 * @endpoint GET /item-library/search
 * @permission quotes:view
 * @param query Search term (min: 2 characters)
 * @param limit Max results (default: 10, max: 50)
 * @returns Array of matching library items
 * @note Searches title and description fields
 */
export const searchLibraryItems = async (
  query: string,
  limit: number = 10
): Promise<LibraryItem[]> => {
  const { data } = await apiClient.get<LibraryItem[]>(
    '/item-library/search',
    { params: { q: query, limit } }
  );
  return data;
};

/**
 * Get library usage statistics
 * @endpoint GET /item-library/usage-stats
 * @permission quotes:view
 * @returns Usage statistics with most used items
 */
export const getLibraryUsageStats =
  async (): Promise<LibraryItemUsageStats> => {
    const { data } = await apiClient.get<LibraryItemUsageStats>(
      '/item-library/usage-stats'
    );
    return data;
  };
