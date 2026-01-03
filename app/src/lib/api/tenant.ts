/**
 * Tenant API Client
 * Source: /var/www/lead360.app/api/documentation/tenant_REST_API.md
 *
 * CRITICAL: 100% endpoint coverage - ALL 40+ endpoints implemented
 * Field names copied EXACTLY from API documentation
 */

import apiClient from './axios';
import {
  TenantProfile,
  Address,
  CreateAddressData,
  UpdateAddressData,
  License,
  CreateLicenseData,
  UpdateLicenseData,
  LicenseStatus,
  LicenseType,
  Insurance,
  UpdateInsuranceData,
  InsuranceStatus,
  InsuranceCoverage,
  PaymentTerms,
  UpdatePaymentTermsData,
  UpdatePaymentTermsResponse,
  PaymentTermTemplates,
  BusinessHours,
  UpdateBusinessHoursData,
  CustomHours,
  CreateCustomHoursData,
  UpdateCustomHoursData,
  ServiceArea,
  CreateServiceAreaData,
  UpdateServiceAreaData,
  ServiceCoverageCheck,
  TenantStatistics,
  SubdomainAvailability,
  UpdateBrandingData,
  LogoUploadResponse,
  UpdateTenantProfileData,
} from '@/lib/types/tenant';

// ==========================================
// TENANT PROFILE ENDPOINTS (6 endpoints)
// ==========================================

/**
 * GET /api/v1/tenants/current
 * Get current tenant profile including all relations
 * Auth: Required (All roles)
 */
export async function getCurrentTenant(): Promise<TenantProfile> {
  const response = await apiClient.get<TenantProfile>('/tenants/current');
  return response.data;
}

/**
 * PATCH /api/v1/tenants/current
 * Update tenant profile (protected fields excluded)
 * Auth: Required (Owner, Admin only)
 */
export async function updateTenantProfile(data: UpdateTenantProfileData): Promise<TenantProfile> {
  const response = await apiClient.patch<TenantProfile>('/tenants/current', data);
  return response.data;
}

/**
 * PATCH /api/v1/tenants/current/branding
 * Update visual branding settings
 * Auth: Required (Owner, Admin only)
 */
export async function updateTenantBranding(data: UpdateBrandingData): Promise<TenantProfile> {
  const response = await apiClient.patch<TenantProfile>('/tenants/current/branding', data);
  return response.data;
}

/**
 * POST /api/v1/tenants/current/logo
 * Upload tenant logo (PNG, JPG, JPEG, SVG, max 5MB)
 * Auth: Required (Owner, Admin only)
 * Content-Type: multipart/form-data
 */
export async function uploadTenantLogo(file: File): Promise<LogoUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<LogoUploadResponse>('/tenants/current/logo', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * DELETE /api/v1/tenants/current/logo
 * Delete tenant logo
 * Auth: Required (Owner, Admin only)
 */
export async function deleteTenantLogo(): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>('/tenants/current/logo');
  return response.data;
}

/**
 * GET /api/v1/tenants/current/statistics
 * Get dashboard statistics for tenant
 * Auth: Required (Owner, Admin only)
 */
export async function getTenantStatistics(): Promise<TenantStatistics> {
  const response = await apiClient.get<TenantStatistics>('/tenants/current/statistics');
  return response.data;
}

/**
 * GET /api/v1/tenants/check-subdomain
 * Check if subdomain is available (public endpoint, no auth)
 * Auth: NOT required (public)
 */
export async function checkSubdomainAvailability(subdomain: string): Promise<SubdomainAvailability> {
  const response = await apiClient.get<SubdomainAvailability>(
    `/tenants/check-subdomain?subdomain=${subdomain}`
  );
  return response.data;
}

// ==========================================
// ADDRESS ENDPOINTS (6 endpoints)
// ==========================================

/**
 * GET /api/v1/tenants/current/addresses
 * Retrieve all addresses for tenant
 * Auth: Required (All roles)
 */
export async function getAllAddresses(): Promise<Address[]> {
  const response = await apiClient.get<Address[]>('/tenants/current/addresses');
  return response.data;
}

/**
 * POST /api/v1/tenants/current/addresses
 * Create new address for tenant
 * Auth: Required (Owner, Admin only)
 */
export async function createAddress(data: CreateAddressData): Promise<Address> {
  const response = await apiClient.post<Address>('/tenants/current/addresses', data);
  return response.data;
}

/**
 * GET /api/v1/tenants/current/addresses/:id
 * Retrieve specific address
 * Auth: Required (All roles)
 */
export async function getAddressById(id: string): Promise<Address> {
  const response = await apiClient.get<Address>(`/tenants/current/addresses/${id}`);
  return response.data;
}

/**
 * PATCH /api/v1/tenants/current/addresses/:id
 * Update existing address
 * Auth: Required (Owner, Admin only)
 */
export async function updateAddress(id: string, data: UpdateAddressData): Promise<Address> {
  const response = await apiClient.patch<Address>(`/tenants/current/addresses/${id}`, data);
  return response.data;
}

/**
 * DELETE /api/v1/tenants/current/addresses/:id
 * Delete address (cannot delete last legal address)
 * Auth: Required (Owner, Admin only)
 */
export async function deleteAddress(id: string): Promise<void> {
  await apiClient.delete(`/tenants/current/addresses/${id}`);
}

/**
 * PATCH /api/v1/tenants/current/addresses/:id/set-default
 * Set address as default for its type
 * Auth: Required (Owner, Admin only)
 */
export async function setAddressAsDefault(id: string): Promise<{ message: string }> {
  const response = await apiClient.patch<{ message: string }>(
    `/tenants/current/addresses/${id}/set-default`
  );
  return response.data;
}

// ==========================================
// LICENSE ENDPOINTS (6 endpoints)
// ==========================================

/**
 * GET /api/v1/tenants/current/licenses
 * Retrieve all professional licenses for tenant
 * Auth: Required (All roles)
 */
export async function getAllLicenses(): Promise<License[]> {
  const response = await apiClient.get<License[]>('/tenants/current/licenses');
  return response.data;
}

/**
 * POST /api/v1/tenants/current/licenses
 * Create new professional license
 * Auth: Required (Owner, Admin only)
 */
export async function createLicense(data: CreateLicenseData): Promise<License> {
  const response = await apiClient.post<License>('/tenants/current/licenses', data);
  return response.data;
}

/**
 * GET /api/v1/tenants/current/licenses/:id
 * Retrieve specific license
 * Auth: Required (All roles)
 */
export async function getLicenseById(id: string): Promise<License> {
  const response = await apiClient.get<License>(`/tenants/current/licenses/${id}`);
  return response.data;
}

/**
 * PATCH /api/v1/tenants/current/licenses/:id
 * Update existing license
 * Auth: Required (Owner, Admin only)
 */
export async function updateLicense(id: string, data: UpdateLicenseData): Promise<License> {
  const response = await apiClient.patch<License>(`/tenants/current/licenses/${id}`, data);
  return response.data;
}

/**
 * DELETE /api/v1/tenants/current/licenses/:id
 * Delete license
 * Auth: Required (Owner, Admin only)
 */
export async function deleteLicense(id: string): Promise<void> {
  await apiClient.delete(`/tenants/current/licenses/${id}`);
}

/**
 * GET /api/v1/tenants/current/licenses/:id/status
 * Get expiry status of license
 * Auth: Required (All roles)
 * Returns: { status: 'expired' | 'expiring_soon' | 'valid', days_until_expiry: number }
 */
export async function getLicenseStatus(id: string): Promise<LicenseStatus> {
  const response = await apiClient.get<LicenseStatus>(`/tenants/current/licenses/${id}/status`);
  return response.data;
}

/**
 * POST /api/v1/tenants/current/licenses/:id/document
 * Upload license document (PDF, PNG, JPG - max 10MB)
 * Auth: Required (Owner, Admin only)
 * Content-Type: multipart/form-data
 * Note: Replaces existing document (old file permanently deleted)
 */
export async function uploadLicenseDocument(
  id: string,
  file: File
): Promise<{ message: string; file_id: string; url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<{ message: string; file_id: string; url: string }>(
    `/tenants/current/licenses/${id}/document`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

/**
 * DELETE /api/v1/tenants/current/licenses/:id/document
 * Delete license document (permanent hard delete)
 * Auth: Required (Owner, Admin only)
 */
export async function deleteLicenseDocument(id: string): Promise<void> {
  await apiClient.delete(`/tenants/current/licenses/${id}/document`);
}

// ==========================================
// INSURANCE ENDPOINTS (4 endpoints)
// ==========================================

/**
 * GET /api/v1/tenants/current/insurance
 * Retrieve insurance information (GL and WC)
 * Auth: Required (All roles)
 * Note: Auto-creates empty record if none exists
 */
export async function getInsurance(): Promise<Insurance> {
  const response = await apiClient.get<Insurance>('/tenants/current/insurance');
  return response.data;
}

/**
 * PATCH /api/v1/tenants/current/insurance
 * Update General Liability and/or Workers' Compensation insurance
 * Auth: Required (Owner, Admin only)
 */
export async function updateInsurance(data: UpdateInsuranceData): Promise<Insurance> {
  const response = await apiClient.patch<Insurance>('/tenants/current/insurance', data);
  return response.data;
}

/**
 * GET /api/v1/tenants/current/insurance/status
 * Get expiry status for both GL and WC insurance
 * Auth: Required (All roles)
 */
export async function getInsuranceStatus(): Promise<InsuranceStatus> {
  const response = await apiClient.get<InsuranceStatus>('/tenants/current/insurance/status');
  return response.data;
}

/**
 * GET /api/v1/tenants/current/insurance/coverage
 * Check if both GL and WC insurance are currently valid
 * Auth: Required (All roles)
 */
export async function checkInsuranceCoverage(): Promise<InsuranceCoverage> {
  const response = await apiClient.get<InsuranceCoverage>('/tenants/current/insurance/coverage');
  return response.data;
}

/**
 * POST /api/v1/tenants/current/insurance/gl-document
 * Upload General Liability insurance document (PDF, PNG, JPG - max 10MB)
 * Auth: Required (Owner, Admin only)
 * Content-Type: multipart/form-data
 * Note: Replaces existing GL document (old file permanently deleted)
 */
export async function uploadGLInsuranceDocument(
  file: File
): Promise<{ message: string; file_id: string; url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<{ message: string; file_id: string; url: string }>(
    '/tenants/current/insurance/gl-document',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

/**
 * POST /api/v1/tenants/current/insurance/wc-document
 * Upload Workers Compensation insurance document (PDF, PNG, JPG - max 10MB)
 * Auth: Required (Owner, Admin only)
 * Content-Type: multipart/form-data
 * Note: Replaces existing WC document (old file permanently deleted)
 */
export async function uploadWCInsuranceDocument(
  file: File
): Promise<{ message: string; file_id: string; url: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await apiClient.post<{ message: string; file_id: string; url: string }>(
    '/tenants/current/insurance/wc-document',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
}

/**
 * DELETE /api/v1/tenants/current/insurance/gl-document
 * Delete GL insurance document (permanent hard delete)
 * Auth: Required (Owner, Admin only)
 */
export async function deleteGLInsuranceDocument(): Promise<void> {
  await apiClient.delete('/tenants/current/insurance/gl-document');
}

/**
 * DELETE /api/v1/tenants/current/insurance/wc-document
 * Delete WC insurance document (permanent hard delete)
 * Auth: Required (Owner, Admin only)
 */
export async function deleteWCInsuranceDocument(): Promise<void> {
  await apiClient.delete('/tenants/current/insurance/wc-document');
}

// ==========================================
// PAYMENT TERMS ENDPOINTS (3 endpoints)
// ==========================================

/**
 * GET /api/v1/tenants/current/payment-terms
 * Retrieve payment milestone structure
 * Auth: Required (All roles)
 * Note: Auto-creates default (100% upfront) if none exists
 */
export async function getPaymentTerms(): Promise<PaymentTerms> {
  const response = await apiClient.get<PaymentTerms>('/tenants/current/payment-terms');
  return response.data;
}

/**
 * PATCH /api/v1/tenants/current/payment-terms
 * Update payment milestone structure
 * Auth: Required (Owner, Admin only)
 * Validation: Sequences must be sequential (1, 2, 3, ...)
 * Warning: Returns percentage_warning if sum != 100%
 */
export async function updatePaymentTerms(data: UpdatePaymentTermsData): Promise<UpdatePaymentTermsResponse> {
  const response = await apiClient.patch<UpdatePaymentTermsResponse>('/tenants/current/payment-terms', data);
  return response.data;
}

/**
 * GET /api/v1/tenants/payment-terms/templates
 * Get pre-defined payment term templates
 * Auth: Required (All roles)
 * Returns: Record<string, PaymentTerm[]> (e.g., "50_25_25", "33_33_34", "100_upfront")
 */
export async function getPaymentTermTemplates(): Promise<PaymentTermTemplates> {
  const response = await apiClient.get<PaymentTermTemplates>('/tenants/payment-terms/templates');
  return response.data;
}

// ==========================================
// BUSINESS HOURS ENDPOINTS (2 endpoints)
// ==========================================

/**
 * GET /api/v1/tenants/current/business-hours
 * Retrieve weekly business hours
 * Auth: Required (All roles)
 * Note: Auto-creates default (Mon-Fri 9-5) if none exists
 */
export async function getBusinessHours(): Promise<BusinessHours> {
  const response = await apiClient.get<BusinessHours>('/tenants/current/business-hours');
  return response.data;
}

/**
 * PATCH /api/v1/tenants/current/business-hours
 * Update weekly business hours
 * Auth: Required (Owner, Admin only)
 * Validation: open1 < close1, close1 < open2 (if open2 provided)
 */
export async function updateBusinessHours(data: UpdateBusinessHoursData): Promise<BusinessHours> {
  const response = await apiClient.patch<BusinessHours>('/tenants/current/business-hours', data);
  return response.data;
}

// ==========================================
// CUSTOM HOURS ENDPOINTS (4 endpoints)
// ==========================================

/**
 * GET /api/v1/tenants/current/custom-hours
 * Retrieve all custom hours (holidays, special dates)
 * Auth: Required (All roles)
 */
export async function getAllCustomHours(): Promise<CustomHours[]> {
  const response = await apiClient.get<CustomHours[]>('/tenants/current/custom-hours');
  return response.data;
}

/**
 * POST /api/v1/tenants/current/custom-hours
 * Create custom hours for special date
 * Auth: Required (Owner, Admin only)
 */
export async function createCustomHours(data: CreateCustomHoursData): Promise<CustomHours> {
  const response = await apiClient.post<CustomHours>('/tenants/current/custom-hours', data);
  return response.data;
}

/**
 * PATCH /api/v1/tenants/current/custom-hours/:id
 * Update existing custom hours
 * Auth: Required (Owner, Admin only)
 */
export async function updateCustomHours(id: string, data: UpdateCustomHoursData): Promise<CustomHours> {
  const response = await apiClient.patch<CustomHours>(`/tenants/current/custom-hours/${id}`, data);
  return response.data;
}

/**
 * DELETE /api/v1/tenants/current/custom-hours/:id
 * Delete custom hours
 * Auth: Required (Owner, Admin only)
 */
export async function deleteCustomHours(id: string): Promise<void> {
  await apiClient.delete(`/tenants/current/custom-hours/${id}`);
}

// ==========================================
// SERVICE AREA ENDPOINTS (6 endpoints)
// ==========================================

/**
 * GET /api/v1/tenants/current/service-areas
 * Retrieve all service areas
 * Auth: Required (All roles)
 */
export async function getAllServiceAreas(): Promise<ServiceArea[]> {
  const response = await apiClient.get<ServiceArea[]>('/tenants/current/service-areas');
  return response.data;
}

/**
 * POST /api/v1/tenants/current/service-areas
 * Create new service area
 * Auth: Required (Owner, Admin only)
 * Validation: Required fields depend on area_type
 */
export async function createServiceArea(data: CreateServiceAreaData): Promise<ServiceArea> {
  const response = await apiClient.post<ServiceArea>('/tenants/current/service-areas', data);
  return response.data;
}

/**
 * GET /api/v1/tenants/current/service-areas/:id
 * Retrieve specific service area
 * Auth: Required (All roles)
 */
export async function getServiceAreaById(id: string): Promise<ServiceArea> {
  const response = await apiClient.get<ServiceArea>(`/tenants/current/service-areas/${id}`);
  return response.data;
}

/**
 * PATCH /api/v1/tenants/current/service-areas/:id
 * Update existing service area
 * Auth: Required (Owner, Admin only)
 */
export async function updateServiceArea(id: string, data: UpdateServiceAreaData): Promise<ServiceArea> {
  const response = await apiClient.patch<ServiceArea>(`/tenants/current/service-areas/${id}`, data);
  return response.data;
}

/**
 * DELETE /api/v1/tenants/current/service-areas/:id
 * Delete service area
 * Auth: Required (Owner, Admin only)
 */
export async function deleteServiceArea(id: string): Promise<void> {
  await apiClient.delete(`/tenants/current/service-areas/${id}`);
}

/**
 * GET /api/v1/tenants/current/service-areas/check-coverage
 * Check if location is covered by tenant's service areas
 * Auth: Required (All roles)
 * Query params: lat, long
 */
export async function checkServiceCoverage(lat: number, long: number): Promise<ServiceCoverageCheck> {
  const response = await apiClient.get<ServiceCoverageCheck>(
    `/tenants/current/service-areas/check-coverage?lat=${lat}&long=${long}`
  );
  return response.data;
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * GET /api/v1/tenants/license-types
 * Get all active license types (platform-wide list)
 * Auth: Required (All roles)
 * Note: This is a public reference data endpoint
 */
export async function getLicenseTypes(): Promise<LicenseType[]> {
  const response = await apiClient.get<LicenseType[]>('/tenants/license-types');
  return response.data;
}

// ==========================================
// EXPORT AS OBJECT (alternative style)
// ==========================================

export const tenantApi = {
  // Tenant Profile
  getCurrentTenant,
  updateTenantProfile,
  updateTenantBranding,
  uploadTenantLogo,
  deleteTenantLogo,
  getTenantStatistics,
  checkSubdomainAvailability,

  // Addresses
  getAllAddresses,
  createAddress,
  getAddressById,
  updateAddress,
  deleteAddress,
  setAddressAsDefault,

  // Licenses
  getAllLicenses,
  createLicense,
  getLicenseById,
  updateLicense,
  deleteLicense,
  getLicenseStatus,
  getLicenseTypes,
  uploadLicenseDocument,
  deleteLicenseDocument,

  // Insurance
  getInsurance,
  updateInsurance,
  getInsuranceStatus,
  checkInsuranceCoverage,
  uploadGLInsuranceDocument,
  uploadWCInsuranceDocument,
  deleteGLInsuranceDocument,
  deleteWCInsuranceDocument,

  // Payment Terms
  getPaymentTerms,
  updatePaymentTerms,
  getPaymentTermTemplates,

  // Business Hours
  getBusinessHours,
  updateBusinessHours,

  // Custom Hours
  getAllCustomHours,
  createCustomHours,
  updateCustomHours,
  deleteCustomHours,

  // Service Areas
  getAllServiceAreas,
  createServiceArea,
  getServiceAreaById,
  updateServiceArea,
  deleteServiceArea,
  checkServiceCoverage,
};

export default tenantApi;
