// Lead360 - Subcontractor API Client
// All 12 endpoints from subcontractor_REST_API.md
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  Subcontractor,
  CreateSubcontractorDto,
  UpdateSubcontractorDto,
  ListSubcontractorsResponse,
  SubcontractorFilters,
  SubcontractorContact,
  AddContactDto,
  SubcontractorDocument,
  SubcontractorDocumentType,
  RevealableSubcontractorField,
  RevealFieldResponse,
} from '@/lib/types/subcontractor';

// ========== SUBCONTRACTOR CRUD ==========

/**
 * Create a new subcontractor
 * @endpoint POST /subcontractors
 * @roles Owner, Admin, Manager
 */
export const createSubcontractor = async (dto: CreateSubcontractorDto): Promise<Subcontractor> => {
  const { data } = await apiClient.post<Subcontractor>('/subcontractors', dto);
  return data;
};

/**
 * List subcontractors with pagination, search, and filters
 * @endpoint GET /subcontractors
 * @roles Owner, Admin, Manager
 * @note List does NOT include contacts or documents arrays
 */
export const getSubcontractors = async (filters?: SubcontractorFilters): Promise<ListSubcontractorsResponse> => {
  const params: Record<string, any> = {};
  if (filters?.page) params.page = filters.page;
  if (filters?.limit) params.limit = filters.limit;
  if (filters?.is_active !== undefined) params.is_active = filters.is_active;
  if (filters?.compliance_status) params.compliance_status = filters.compliance_status;
  if (filters?.search) params.search = filters.search;

  const { data } = await apiClient.get<ListSubcontractorsResponse>('/subcontractors', { params });
  return data;
};

/**
 * Get subcontractor detail (includes contacts and documents)
 * @endpoint GET /subcontractors/:id
 * @roles Owner, Admin, Manager
 */
export const getSubcontractorById = async (id: string): Promise<Subcontractor> => {
  const { data } = await apiClient.get<Subcontractor>(`/subcontractors/${id}`);
  return data;
};

/**
 * Update a subcontractor
 * @endpoint PATCH /subcontractors/:id
 * @roles Owner, Admin, Manager
 */
export const updateSubcontractor = async (id: string, dto: UpdateSubcontractorDto): Promise<Subcontractor> => {
  const { data } = await apiClient.patch<Subcontractor>(`/subcontractors/${id}`, dto);
  return data;
};

/**
 * Soft delete (deactivate) a subcontractor
 * @endpoint DELETE /subcontractors/:id
 * @roles Owner, Admin
 */
export const deactivateSubcontractor = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/subcontractors/${id}`);
  return data;
};

// ========== REVEAL BANK FIELDS ==========

/**
 * Reveal a bank field (audit logged)
 * @endpoint GET /subcontractors/:id/reveal/:field
 * @roles Owner, Admin ONLY
 * @fields bank_routing, bank_account
 */
export const revealSubcontractorField = async (
  id: string,
  field: RevealableSubcontractorField
): Promise<RevealFieldResponse> => {
  const { data } = await apiClient.get<RevealFieldResponse>(`/subcontractors/${id}/reveal/${field}`);
  return data;
};

// ========== CONTACTS ==========

/**
 * Add a contact to a subcontractor
 * @endpoint POST /subcontractors/:id/contacts
 * @roles Owner, Admin, Manager
 * @note If is_primary=true, other contacts become non-primary
 */
export const addSubcontractorContact = async (
  subcontractorId: string,
  dto: AddContactDto
): Promise<SubcontractorContact> => {
  const { data } = await apiClient.post<SubcontractorContact>(
    `/subcontractors/${subcontractorId}/contacts`,
    dto
  );
  return data;
};

/**
 * List contacts for a subcontractor
 * @endpoint GET /subcontractors/:id/contacts
 * @roles Owner, Admin, Manager
 */
export const getSubcontractorContacts = async (
  subcontractorId: string
): Promise<SubcontractorContact[]> => {
  const { data } = await apiClient.get<SubcontractorContact[]>(
    `/subcontractors/${subcontractorId}/contacts`
  );
  return data;
};

/**
 * Remove a contact from a subcontractor
 * @endpoint DELETE /subcontractors/:id/contacts/:contactId
 * @roles Owner, Admin, Manager
 */
export const removeSubcontractorContact = async (
  subcontractorId: string,
  contactId: string
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(
    `/subcontractors/${subcontractorId}/contacts/${contactId}`
  );
  return data;
};

// ========== DOCUMENTS ==========

/**
 * Upload a document for a subcontractor
 * @endpoint POST /subcontractors/:id/documents
 * @roles Owner, Admin, Manager
 * @content-type multipart/form-data
 */
export const uploadSubcontractorDocument = async (
  subcontractorId: string,
  file: File,
  documentType: SubcontractorDocumentType,
  description?: string
): Promise<SubcontractorDocument> => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('document_type', documentType);
  if (description) formData.append('description', description);

  const { data } = await apiClient.post<SubcontractorDocument>(
    `/subcontractors/${subcontractorId}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data;
};

/**
 * List documents for a subcontractor
 * @endpoint GET /subcontractors/:id/documents
 * @roles Owner, Admin, Manager
 */
export const getSubcontractorDocuments = async (
  subcontractorId: string
): Promise<SubcontractorDocument[]> => {
  const { data } = await apiClient.get<SubcontractorDocument[]>(
    `/subcontractors/${subcontractorId}/documents`
  );
  return data;
};

/**
 * Delete a document from a subcontractor
 * @endpoint DELETE /subcontractors/:id/documents/:documentId
 * @roles Owner, Admin
 */
export const deleteSubcontractorDocument = async (
  subcontractorId: string,
  documentId: string
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(
    `/subcontractors/${subcontractorId}/documents/${documentId}`
  );
  return data;
};

// ========== UTILITY ==========

/**
 * Get days until insurance expiry
 * Returns negative number if expired, null if no expiry date
 */
export const getDaysUntilExpiry = (expiryDate: string | null): number | null => {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Get document type icon name (for lucide-react)
 */
export const getDocumentTypeIcon = (type: SubcontractorDocumentType): string => {
  switch (type) {
    case 'insurance':
    case 'coi':
      return 'Shield';
    case 'contract':
    case 'agreement':
      return 'FileText';
    case 'license':
      return 'Award';
    default:
      return 'File';
  }
};
