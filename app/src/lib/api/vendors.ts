// Lead360 - Vendors Module API Client
// All 8 vendor endpoints from backend API documentation
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  Vendor,
  VendorSummary,
  VendorListResponse,
  VendorStatistics,
  CreateVendorDto,
} from '@/lib/types/quotes';

// ========== VENDORS (8 endpoints) ==========

/**
 * Create vendor
 * @endpoint POST /vendors
 * @permission vendors:create
 * @param dto Vendor creation data
 * @returns Complete vendor object
 * @throws 400 - Validation errors (missing required fields, invalid email/phone format)
 * @throws 409 - Vendor name already exists for tenant
 * @throws 422 - Address validation failed (Google Maps)
 * @note If is_default=true, unsets previous default vendor automatically
 */
export const createVendor = async (dto: CreateVendorDto): Promise<Vendor> => {
  const { data } = await apiClient.post<Vendor>('/vendors', dto);
  return data;
};

/**
 * List vendors
 * @endpoint GET /vendors
 * @permission vendors:view
 * @param filters Optional query parameters for filtering, pagination, search
 * @returns Paginated list of vendor summaries with metadata
 * @note Default pagination: page=1, limit=50
 * @note Search queries: name, email, phone
 */
export const getVendors = async (filters?: {
  page?: number;
  limit?: number;
  search?: string;
  is_active?: boolean;
}): Promise<VendorListResponse> => {
  const params: Record<string, any> = {};
  if (filters?.page) params.page = filters.page;
  if (filters?.limit) params.limit = filters.limit;
  if (filters?.search) params.search = filters.search;
  if (filters?.is_active !== undefined) params.is_active = filters.is_active;

  const { data } = await apiClient.get<VendorListResponse>('/vendors', { params });
  return data;
};

/**
 * Get vendor by ID
 * @endpoint GET /vendors/:id
 * @permission vendors:view
 * @param id Vendor UUID
 * @returns Complete vendor object
 * @throws 404 - Vendor not found
 */
export const getVendorById = async (id: string): Promise<Vendor> => {
  const { data } = await apiClient.get<Vendor>(`/vendors/${id}`);
  return data;
};

/**
 * Update vendor
 * @endpoint PATCH /vendors/:id
 * @permission vendors:edit
 * @param id Vendor UUID
 * @param dto Partial vendor update data
 * @returns Updated vendor object
 * @throws 400 - Validation errors
 * @throws 404 - Vendor not found
 * @throws 409 - Vendor name already exists for tenant
 * @throws 422 - Address validation failed (Google Maps)
 * @note If is_default=true, unsets previous default vendor
 */
export const updateVendor = async (id: string, dto: Partial<CreateVendorDto>): Promise<Vendor> => {
  const { data } = await apiClient.patch<Vendor>(`/vendors/${id}`, dto);
  return data;
};

/**
 * Delete vendor
 * @endpoint DELETE /vendors/:id
 * @permission vendors:delete
 * @param id Vendor UUID
 * @returns void (204 No Content)
 * @throws 404 - Vendor not found
 * @throws 422 - Cannot delete vendor with active quotes
 * @note Soft delete - vendor marked as deleted but remains in database
 */
export const deleteVendor = async (id: string): Promise<void> => {
  await apiClient.delete(`/vendors/${id}`);
};

/**
 * Set vendor as default
 * @endpoint PATCH /vendors/:id/set-default
 * @permission vendors:edit
 * @param id Vendor UUID
 * @returns void (204 No Content)
 * @throws 404 - Vendor not found
 * @note Automatically unsets previous default vendor
 */
export const setVendorAsDefault = async (id: string): Promise<void> => {
  await apiClient.patch(`/vendors/${id}/set-default`);
};

/**
 * Update vendor signature
 * @endpoint POST /vendors/:id/signature
 * @permission vendors:edit
 * @param id Vendor UUID
 * @param fileId File UUID (must be uploaded first via files API)
 * @returns void (204 No Content)
 * @throws 404 - Vendor not found or file not found
 * @throws 422 - File is not a valid image type
 * @note File must be uploaded to files module first, then reference file_id here
 */
export const updateVendorSignature = async (id: string, fileId: string): Promise<void> => {
  await apiClient.post(`/vendors/${id}/signature`, { file_id: fileId });
};

/**
 * Get vendor statistics
 * @endpoint GET /vendors/:id/stats
 * @permission vendors:view
 * @param id Vendor UUID
 * @returns Vendor statistics object
 * @throws 404 - Vendor not found
 * @note Includes: total quotes, status breakdown, total revenue, avg quote value
 */
export const getVendorStatistics = async (id: string): Promise<VendorStatistics> => {
  const { data } = await apiClient.get<VendorStatistics>(`/vendors/${id}/stats`);
  return data;
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Format phone number for display (10 digits → (XXX) XXX-XXXX)
 * @param phone 10-digit phone number (digits only)
 * @returns Formatted phone string
 */
export const formatVendorPhone = (phone: string): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length !== 10) return phone;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
};

/**
 * Sanitize phone number (remove all non-digits)
 * @param phone Phone number in any format
 * @returns 10-digit phone string
 */
export const sanitizeVendorPhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

/**
 * Format vendor address for display
 * @param vendor Vendor object
 * @returns Single-line formatted address
 */
export const formatVendorAddress = (vendor: Vendor): string => {
  const parts = [vendor.address_line1];
  if (vendor.address_line2) parts.push(vendor.address_line2);
  if (vendor.city && vendor.state && vendor.zip_code) {
    parts.push(`${vendor.city}, ${vendor.state} ${vendor.zip_code}`);
  }
  return parts.join(', ');
};

/**
 * Get vendor display name with default badge
 * @param vendor Vendor or VendorSummary object
 * @returns Display name (e.g., "ABC Company (Default)")
 */
export const getVendorDisplayName = (vendor: Vendor | VendorSummary): string => {
  return vendor.is_default ? `${vendor.name} (Default)` : vendor.name;
};
