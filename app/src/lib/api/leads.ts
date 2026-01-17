// Lead360 - Leads Module API Client
// All 29 endpoints from backend API documentation
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  Lead,
  CreateLeadDto,
  UpdateLeadDto,
  UpdateLeadStatusDto,
  ListLeadsResponse,
  LeadStatsResponse,
  LeadEmail,
  LeadPhone,
  LeadAddress,
  AddEmailDto,
  UpdateEmailDto,
  AddPhoneDto,
  UpdatePhoneDto,
  AddAddressDto,
  UpdateAddressDto,
  ServiceRequest,
  CreateServiceRequestDto,
  UpdateServiceRequestDto,
  ListServiceRequestsResponse,
  LeadNote,
  AddNoteDto,
  UpdateNoteDto,
  ListNotesResponse,
  LeadActivity,
  ListActivitiesResponse,
  WebhookApiKey,
  CreateWebhookKeyResponse,
  ListWebhookKeysResponse,
  LeadFilters,
} from '@/lib/types/leads';

// ========== LEADS MANAGEMENT (8 endpoints) ==========

/**
 * Get paginated list of leads with optional filters
 * @endpoint GET /leads
 * @permission leads:view
 */
export const getLeads = async (filters?: LeadFilters): Promise<ListLeadsResponse> => {
  const params: Record<string, any> = {};

  if (filters?.page) params.page = filters.page;
  if (filters?.limit) params.limit = filters.limit;
  if (filters?.status) params.status = filters.status.join(',');
  if (filters?.source) params.source = filters.source.join(',');
  if (filters?.search) params.search = filters.search;
  if (filters?.created_after) params.created_after = filters.created_after;
  if (filters?.created_before) params.created_before = filters.created_before;

  const { data } = await apiClient.get<ListLeadsResponse>('/leads', { params });
  return data;
};

/**
 * Get single lead by ID with all relations
 * @endpoint GET /leads/:id
 * @permission leads:view
 */
export const getLeadById = async (id: string): Promise<Lead> => {
  const { data } = await apiClient.get<Lead>(`/leads/${id}`);
  return data;
};

/**
 * Create new lead with nested contacts and service request
 * @endpoint POST /leads
 * @permission leads:create
 * @returns Lead object with all relations
 * @throws 400 - Validation errors
 * @throws 409 - Phone number already exists for tenant
 * @throws 422 - Address validation failed (Google Maps)
 */
export const createLead = async (dto: CreateLeadDto): Promise<Lead> => {
  const { data } = await apiClient.post<Lead>('/leads', dto);
  return data;
};

/**
 * Update lead basic information
 * @endpoint PATCH /leads/:id
 * @permission leads:edit
 */
export const updateLead = async (id: string, dto: UpdateLeadDto): Promise<Lead> => {
  const { data } = await apiClient.patch<Lead>(`/leads/${id}`, dto);
  return data;
};

/**
 * Update lead status with validation
 * @endpoint PATCH /leads/:id/status
 * @permission leads:edit
 * @throws 400 - Invalid status transition or missing lost_reason when status="lost"
 */
export const updateLeadStatus = async (
  id: string,
  status: string,
  lost_reason?: string
): Promise<{ id: string; status: string; lost_reason?: string; lost_at?: string; updated_at: string }> => {
  const { data } = await apiClient.patch(`/leads/${id}/status`, { status, lost_reason });
  return data;
};

/**
 * Hard delete lead (cascades to all related entities)
 * @endpoint DELETE /leads/:id
 * @permission leads:delete
 * @returns void (204 No Content)
 */
export const deleteLead = async (id: string): Promise<void> => {
  await apiClient.delete(`/leads/${id}`);
};

/**
 * Get lead statistics for dashboard
 * @endpoint GET /leads/stats
 * @permission leads:view
 */
export const getLeadStats = async (): Promise<LeadStatsResponse> => {
  const { data } = await apiClient.get<LeadStatsResponse>('/leads/stats');
  return data;
};

// ========== EMAIL MANAGEMENT (3 endpoints) ==========

/**
 * Add email to lead
 * @endpoint POST /leads/:id/emails
 * @permission leads:edit
 * @note If is_primary=true, unsets other primary emails
 */
export const addEmail = async (
  leadId: string,
  emailDto: AddEmailDto
): Promise<LeadEmail> => {
  const { data } = await apiClient.post<LeadEmail>(`/leads/${leadId}/emails`, emailDto);
  return data;
};

/**
 * Update email
 * @endpoint PATCH /leads/:leadId/emails/:emailId
 * @permission leads:edit
 */
export const updateEmail = async (
  leadId: string,
  emailId: string,
  updates: UpdateEmailDto
): Promise<LeadEmail> => {
  const { data } = await apiClient.patch<LeadEmail>(
    `/leads/${leadId}/emails/${emailId}`,
    updates
  );
  return data;
};

/**
 * Delete email
 * @endpoint DELETE /leads/:leadId/emails/:emailId
 * @permission leads:edit
 * @throws 400 - Cannot delete last contact method (must have at least 1 email OR 1 phone)
 * @returns void (204 No Content)
 */
export const deleteEmail = async (leadId: string, emailId: string): Promise<void> => {
  await apiClient.delete(`/leads/${leadId}/emails/${emailId}`);
};

// ========== PHONE MANAGEMENT (3 endpoints) ==========

/**
 * Add phone to lead
 * @endpoint POST /leads/:id/phones
 * @permission leads:edit
 * @note Phone automatically sanitized to 10 digits
 * @throws 400 - Invalid phone format (must be 10 digits after sanitization)
 * @throws 409 - Phone already exists for this tenant
 */
export const addPhone = async (
  leadId: string,
  phoneDto: AddPhoneDto
): Promise<LeadPhone> => {
  const { data } = await apiClient.post<LeadPhone>(`/leads/${leadId}/phones`, phoneDto);
  return data;
};

/**
 * Update phone
 * @endpoint PATCH /leads/:leadId/phones/:phoneId
 * @permission leads:edit
 * @throws 400 - Invalid phone format
 * @throws 409 - Phone already exists for this tenant
 */
export const updatePhone = async (
  leadId: string,
  phoneId: string,
  updates: UpdatePhoneDto
): Promise<LeadPhone> => {
  const { data } = await apiClient.patch<LeadPhone>(
    `/leads/${leadId}/phones/${phoneId}`,
    updates
  );
  return data;
};

/**
 * Delete phone
 * @endpoint DELETE /leads/:leadId/phones/:phoneId
 * @permission leads:edit
 * @throws 400 - Cannot delete last contact method
 * @returns void (204 No Content)
 */
export const deletePhone = async (leadId: string, phoneId: string): Promise<void> => {
  await apiClient.delete(`/leads/${leadId}/phones/${phoneId}`);
};

// ========== ADDRESS MANAGEMENT (3 endpoints) ==========

/**
 * Add address to lead
 * @endpoint POST /leads/:id/addresses
 * @permission leads:edit
 * @note Google Maps validation MANDATORY - all addresses require lat/lng
 * @throws 422 - Address validation failed (Google Maps)
 */
export const addAddress = async (
  leadId: string,
  addressDto: AddAddressDto
): Promise<LeadAddress> => {
  const { data } = await apiClient.post<LeadAddress>(`/leads/${leadId}/addresses`, addressDto);
  return data;
};

/**
 * Update address
 * @endpoint PATCH /leads/:leadId/addresses/:addressId
 * @permission leads:edit
 * @note If address components change, re-validates with Google Maps
 */
export const updateAddress = async (
  leadId: string,
  addressId: string,
  updates: UpdateAddressDto
): Promise<LeadAddress> => {
  const { data } = await apiClient.patch<LeadAddress>(
    `/leads/${leadId}/addresses/${addressId}`,
    updates
  );
  return data;
};

/**
 * Delete address
 * @endpoint DELETE /leads/:leadId/addresses/:addressId
 * @permission leads:edit
 * @throws 400 - Cannot delete address linked to service requests
 * @returns void (204 No Content)
 */
export const deleteAddress = async (leadId: string, addressId: string): Promise<void> => {
  await apiClient.delete(`/leads/${leadId}/addresses/${addressId}`);
};

// ========== NOTES MANAGEMENT (4 endpoints) ==========

/**
 * Add note to lead
 * @endpoint POST /leads/:id/notes
 * @permission leads:edit
 */
export const addNote = async (leadId: string, noteDto: AddNoteDto): Promise<LeadNote> => {
  const { data } = await apiClient.post<LeadNote>(`/leads/${leadId}/notes`, noteDto);
  return data;
};

/**
 * Update note
 * @endpoint PATCH /leads/:leadId/notes/:noteId
 * @permission leads:edit
 */
export const updateNote = async (
  leadId: string,
  noteId: string,
  updates: UpdateNoteDto
): Promise<LeadNote> => {
  const { data } = await apiClient.patch<LeadNote>(
    `/leads/${leadId}/notes/${noteId}`,
    updates
  );
  return data;
};

/**
 * Delete note
 * @endpoint DELETE /leads/:leadId/notes/:noteId
 * @permission leads:edit
 * @returns void (204 No Content)
 */
export const deleteNote = async (leadId: string, noteId: string): Promise<void> => {
  await apiClient.delete(`/leads/${leadId}/notes/${noteId}`);
};

/**
 * Get notes for a lead (pinned first, newest first)
 * @endpoint GET /leads/:id/notes
 * @permission leads:view
 */
export const getNotes = async (
  leadId: string,
  params?: { page?: number; limit?: number }
): Promise<ListNotesResponse> => {
  const { data } = await apiClient.get<ListNotesResponse>(`/leads/${leadId}/notes`, { params });
  return data;
};

// ========== ACTIVITIES (1 endpoint) ==========

/**
 * Get activity timeline for a lead
 * @endpoint GET /leads/:id/activities
 * @permission leads:view
 */
export const getActivities = async (
  leadId: string,
  params?: { page?: number; limit?: number }
): Promise<ListActivitiesResponse> => {
  const { data } = await apiClient.get<ListActivitiesResponse>(`/leads/${leadId}/activities`, { params });
  return data;
};

// ========== SERVICE REQUESTS (4 endpoints) ==========

/**
 * Create service request for lead
 * @endpoint POST /service-requests/leads/:leadId?addressId={addressId}
 * @permission leads:edit
 * @param leadId Lead UUID
 * @param addressId Address UUID where service will be performed (query param)
 * @param serviceDto Service request data
 * @note urgency in request becomes time_demand in response
 */
export const createServiceRequest = async (
  leadId: string,
  addressId: string,
  serviceDto: CreateServiceRequestDto
): Promise<ServiceRequest> => {
  const { data } = await apiClient.post<ServiceRequest>(
    `/service-requests/leads/${leadId}?addressId=${addressId}`,
    serviceDto
  );
  return data;
};

/**
 * Get all service requests with filters
 * @endpoint GET /service-requests
 * @permission leads:view
 */
export const getAllServiceRequests = async (params?: {
  status?: string;
  urgency?: string;
  service_type?: string;
  page?: number;
  limit?: number;
}): Promise<ListServiceRequestsResponse> => {
  const { data } = await apiClient.get<ListServiceRequestsResponse>('/service-requests', { params });
  return data;
};

/**
 * Get single service request
 * @endpoint GET /service-requests/:id
 * @permission leads:view
 */
export const getServiceRequest = async (id: string): Promise<ServiceRequest> => {
  const { data } = await apiClient.get<ServiceRequest>(`/service-requests/${id}`);
  return data;
};

/**
 * Update service request
 * @endpoint PATCH /service-requests/:id
 * @permission leads:edit
 * @note urgency in request becomes time_demand in response
 */
export const updateServiceRequest = async (
  id: string,
  updates: UpdateServiceRequestDto
): Promise<ServiceRequest> => {
  const { data } = await apiClient.patch<ServiceRequest>(`/service-requests/${id}`, updates);
  return data;
};

/**
 * Delete service request
 * @endpoint DELETE /service-requests/:id
 * @permission leads:edit
 * @returns void (204 No Content)
 */
export const deleteServiceRequest = async (id: string): Promise<void> => {
  await apiClient.delete(`/service-requests/${id}`);
};

// ========== WEBHOOK API KEYS (3 endpoints) ==========

/**
 * Create webhook API key
 * @endpoint POST /webhook-keys
 * @permission Owner, Admin
 * @note API key shown ONLY ONCE - must be saved immediately
 */
export const createWebhookKey = async (
  key_name: string
): Promise<CreateWebhookKeyResponse> => {
  const { data } = await apiClient.post<CreateWebhookKeyResponse>('/webhook-keys', { key_name });
  return data;
};

/**
 * List webhook API keys
 * @endpoint GET /webhook-keys
 * @permission Owner, Admin, Manager
 * @note API keys are hashed - actual key not returned
 */
export const getWebhookKeys = async (): Promise<ListWebhookKeysResponse> => {
  const { data } = await apiClient.get<ListWebhookKeysResponse>('/webhook-keys');
  return data;
};

/**
 * Toggle webhook API key active status
 * @endpoint PATCH /webhook-keys/:id/toggle
 * @permission Owner, Admin
 * @note Toggles current state - no body required
 */
export const toggleWebhookKey = async (id: string): Promise<WebhookApiKey> => {
  const { data} = await apiClient.patch<WebhookApiKey>(`/webhook-keys/${id}/toggle`);
  return data;
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Format phone number for display (10 digits → (XXX) XXX-XXXX)
 * @param phone 10-digit phone number (digits only)
 * @returns Formatted phone string
 */
export const formatPhone = (phone: string): string => {
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
export const sanitizePhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

/**
 * Get primary contact method
 * @param emails Lead emails array
 * @param phones Lead phones array
 * @returns Primary email or phone
 */
export const getPrimaryContact = (emails: LeadEmail[], phones: LeadPhone[]): string => {
  const primaryEmail = emails.find(e => e.is_primary);
  if (primaryEmail) return primaryEmail.email;

  const primaryPhone = phones.find(p => p.is_primary);
  if (primaryPhone) return formatPhone(primaryPhone.phone);

  return 'No contact';
};

/**
 * Format address for display
 * @param address LeadAddress object
 * @returns Single-line formatted address
 */
export const formatAddress = (address: LeadAddress): string => {
  const parts = [address.address_line1];
  if (address.address_line2) parts.push(address.address_line2);
  parts.push(`${address.city}, ${address.state} ${address.zip_code}`);
  return parts.join(', ');
};
