// Lead360 - Subcontractor Type Definitions
// Matches subcontractor_REST_API.md response shapes exactly
// Bank fields are encrypted; use reveal endpoint for full values

import type { PaymentMethod } from './crew';

// ========== COMPLIANCE STATUS ==========

export type ComplianceStatus = 'valid' | 'expiring_soon' | 'expired' | 'unknown';

// ========== DOCUMENT TYPE ==========

export type SubcontractorDocumentType = 'insurance' | 'agreement' | 'coi' | 'contract' | 'license' | 'other';

// ========== SUBCONTRACTOR ENTITY ==========

export interface Subcontractor {
  id: string;
  tenant_id: string;
  business_name: string;
  trade_specialty: string | null;
  email: string | null;
  website: string | null;
  insurance_provider: string | null;
  insurance_policy_number: string | null;
  insurance_expiry_date: string | null;
  coi_on_file: boolean;
  compliance_status: ComplianceStatus;
  default_payment_method: PaymentMethod | null;
  bank_name: string | null;
  bank_routing_masked: string | null;
  has_bank_routing: boolean;
  bank_account_masked: string | null;
  has_bank_account: boolean;
  venmo_handle: string | null;
  zelle_contact: string | null;
  notes: string | null;
  is_active: boolean;
  contacts?: SubcontractorContact[];
  documents?: SubcontractorDocument[];
  created_at: string;
  updated_at: string;
}

// ========== CONTACT ==========

export interface SubcontractorContact {
  id: string;
  tenant_id?: string;
  subcontractor_id?: string;
  contact_name: string;
  phone: string;
  role: string | null;
  email: string | null;
  is_primary: boolean;
  created_at: string;
}

// ========== DOCUMENT ==========

export interface SubcontractorDocument {
  id: string;
  tenant_id?: string;
  subcontractor_id?: string;
  file_id?: string;
  file_url: string;
  file_name: string;
  document_type: SubcontractorDocumentType;
  description: string | null;
  uploaded_by_user_id?: string;
  created_at: string;
}

// ========== REVEAL ==========

export type RevealableSubcontractorField = 'bank_routing' | 'bank_account';

export interface RevealFieldResponse {
  field: RevealableSubcontractorField;
  value: string;
}

// ========== DTOs ==========

export interface CreateSubcontractorDto {
  business_name: string;
  trade_specialty?: string;
  email?: string;
  website?: string;
  insurance_provider?: string;
  insurance_policy_number?: string;
  insurance_expiry_date?: string;
  coi_on_file?: boolean;
  default_payment_method?: PaymentMethod;
  bank_name?: string;
  bank_routing_number?: string;
  bank_account_number?: string;
  venmo_handle?: string;
  zelle_contact?: string;
  notes?: string;
}

export interface UpdateSubcontractorDto extends Partial<CreateSubcontractorDto> {
  is_active?: boolean;
}

export interface AddContactDto {
  contact_name: string;
  phone: string;
  role?: string;
  email?: string;
  is_primary?: boolean;
}

export interface UploadDocumentDto {
  file: File;
  document_type: SubcontractorDocumentType;
  description?: string;
}

// ========== LIST RESPONSE ==========

export interface ListSubcontractorsResponse {
  data: Subcontractor[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ========== FILTERS ==========

export interface SubcontractorFilters {
  page?: number;
  limit?: number;
  is_active?: boolean;
  compliance_status?: ComplianceStatus;
  search?: string;
}

// ========== DOCUMENT TYPE LABELS ==========

export const DOCUMENT_TYPE_LABELS: Record<SubcontractorDocumentType, string> = {
  insurance: 'Insurance',
  agreement: 'Agreement',
  coi: 'Certificate of Insurance (COI)',
  contract: 'Contract',
  license: 'License',
  other: 'Other',
};

export const COMPLIANCE_STATUS_CONFIG: Record<ComplianceStatus, { label: string; color: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  valid: { label: 'Valid', color: 'green', variant: 'success' },
  expiring_soon: { label: 'Expiring Soon', color: 'yellow', variant: 'warning' },
  expired: { label: 'Expired', color: 'red', variant: 'danger' },
  unknown: { label: 'Unknown', color: 'gray', variant: 'neutral' },
};
