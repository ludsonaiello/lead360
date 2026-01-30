// Lead360 - Leads Module Type Definitions
// Critical field mappings:
// - Emails: Only `email` and `is_primary` fields (NO email_type)
// - Phones: `phone` (10 digits), `phone_type`, `is_primary`
// - Addresses: `latitude` and `longitude` REQUIRED (Decimal strings)
// - Service Requests: `lead_address_id` (NOT address_id), `time_demand` in response
// - Notes/Activities: `user_id` field (NOT performed_by_user_id)

// User type (nested in responses)
export interface User {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

// ========== LEAD ENTITY & RELATED ==========

export interface Lead {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  language_spoken: string;
  accept_sms: boolean;
  preferred_communication: 'email' | 'phone' | 'sms';
  status: 'lead' | 'prospect' | 'customer' | 'lost';
  source: 'manual' | 'webhook' | 'ai_phone' | 'ai_sms' | 'website' | 'referral' | 'phone_call' | 'walk_in' | 'social_media' | 'email' | 'other';
  external_source_id?: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id?: string | null;
  lost_reason?: string | null;
  lost_at?: string | null;
  deleted_at?: string | null;
  emails: LeadEmail[];
  phones: LeadPhone[];
  addresses: LeadAddress[];
  service_requests: ServiceRequest[];
  notes?: LeadNote[];
  activities?: LeadActivity[];
  created_by_user?: User;
}

// Email - CRITICAL: NO email_type field
export interface LeadEmail {
  id: string;
  lead_id: string;
  email: string;
  is_primary: boolean;
  created_at: string;
}

// Phone - CRITICAL: phone is 10 digits only (no formatting)
export interface LeadPhone {
  id: string;
  lead_id: string;
  phone: string; // "5551234567" - digits only
  phone_type: 'mobile' | 'home' | 'work' | 'other';
  is_primary: boolean;
  created_at: string;
}

// Address - CRITICAL: lat/lng are REQUIRED (Decimal strings)
export interface LeadAddress {
  id: string;
  lead_id: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  latitude: string; // Decimal string "42.36010000"
  longitude: string; // Decimal string "-71.05890000"
  google_place_id?: string | null;
  address_type: 'service' | 'billing' | 'mailing' | 'other';
  is_primary: boolean;
  created_at: string;
}

// Service Request - CRITICAL: lead_address_id, time_demand in response
export interface ServiceRequest {
  id: string;
  lead_id: string;
  lead_address_id?: string | null; // NOT address_id
  service_name: string;
  service_type?: string | null;
  description?: string | null; // Backend returns 'description', not 'service_description'
  service_description?: string | null; // Keep for backwards compatibility
  time_demand?: 'low' | 'medium' | 'high' | 'emergency'; // Corresponds to urgency in request (optional in actual API response)
  status: 'new' | 'pending' | 'scheduled' | 'completed' | 'cancelled' | 'visit_scheduled' | 'quote_generated' | 'quote_sent';
  extra_data?: {
    requested_date?: string;
    estimated_value?: number;
    notes?: string;
    [key: string]: any; // Allow additional fields
  } | null;
  created_at: string;
  updated_at?: string;
  lead_address?: LeadAddress;
  tenant_id?: string; // Present in backend response
}

// Note - CRITICAL: user_id (not performed_by_user_id)
export interface LeadNote {
  id: string;
  lead_id: string;
  note_text: string;
  is_pinned: boolean;
  user_id: string;
  created_at: string;
  updated_at?: string;
  user?: User;
}

// Activity - CRITICAL: user_id (not performed_by_user_id)
export interface LeadActivity {
  id: string;
  lead_id: string;
  activity_type:
    | 'created'
    | 'updated'
    | 'status_changed'
    | 'email_added'
    | 'email_updated'
    | 'email_deleted'
    | 'phone_added'
    | 'phone_updated'
    | 'phone_deleted'
    | 'address_added'
    | 'address_updated'
    | 'address_deleted'
    | 'note_added'
    | 'note_updated'
    | 'note_deleted'
    | 'service_request_created'
    | 'service_request_updated'
    | 'converted_to_customer'
    | 'marked_as_lost'
    | 'reactivated';
  description: string;
  user_id?: string | null;
  metadata?: any;
  created_at: string;
  user?: User;
}

// ========== DTOs (Data Transfer Objects) ==========

export interface CreateLeadDto {
  first_name: string;
  last_name: string;
  language_spoken?: string;
  accept_sms?: boolean;
  preferred_communication?: 'email' | 'phone' | 'sms';
  source?: 'manual' | 'website' | 'referral' | 'phone_call' | 'walk_in' | 'social_media' | 'email' | 'webhook' | 'other';
  external_source_id?: string;
  emails?: Array<{
    email: string;
    is_primary?: boolean;
  }>;
  phones?: Array<{
    phone: string;
    phone_type?: 'mobile' | 'home' | 'work' | 'other';
    is_primary?: boolean;
  }>;
  addresses?: Array<{
    address_line1: string;
    address_line2?: string;
    city?: string;
    state?: string;
    zip_code: string;
    latitude?: number;
    longitude?: number;
    address_type?: 'service' | 'billing' | 'mailing' | 'other';
    is_primary?: boolean;
  }>;
  service_request?: {
    service_name?: string;
    service_type?: string;
    service_description?: string;
    urgency?: 'low' | 'medium' | 'high' | 'emergency';
    requested_date?: string;
    estimated_value?: number;
    notes?: string;
  };
}

export interface UpdateLeadDto {
  first_name?: string;
  last_name?: string;
  language_spoken?: string;
  accept_sms?: boolean;
  preferred_communication?: 'email' | 'phone' | 'sms';
}

export interface UpdateLeadStatusDto {
  status: 'lead' | 'prospect' | 'customer' | 'lost';
  lost_reason?: string;
}

export interface LeadListItem {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  source: string;
  created_at: string;
  updated_at?: string;
  emails: LeadEmail[];
  phones: LeadPhone[];
  addresses: LeadAddress[];
  service_requests: ServiceRequest[];
  company_name?: string;
}

export interface ListLeadsResponse {
  data: LeadListItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface LeadStatsResponse {
  total: number;
  by_status: {
    lead: number;
    prospect: number;
    customer: number;
    lost: number;
  };
  by_source: Record<string, number>;
  recent: Array<{
    id: string;
    first_name: string;
    last_name: string;
    status: string;
    source: string;
    created_at: string;
  }>;
}

// ========== CONTACT METHODS DTOs ==========

export interface AddEmailDto {
  email: string;
  is_primary?: boolean;
}

export interface UpdateEmailDto {
  email?: string;
  is_primary?: boolean;
}

export interface AddPhoneDto {
  phone: string;
  phone_type?: 'mobile' | 'home' | 'work' | 'other';
  is_primary?: boolean;
}

export interface UpdatePhoneDto {
  phone?: string;
  phone_type?: 'mobile' | 'home' | 'work' | 'other';
  is_primary?: boolean;
}

export interface AddAddressDto {
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code: string;
  latitude?: number;
  longitude?: number;
  address_type?: 'service' | 'billing' | 'mailing' | 'other';
  is_primary?: boolean;
}

export interface UpdateAddressDto {
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  address_type?: 'service' | 'billing' | 'mailing' | 'other';
  is_primary?: boolean;
}

// ========== NOTES DTOs ==========

export interface AddNoteDto {
  note_text: string;
  is_pinned?: boolean;
}

export interface UpdateNoteDto {
  note_text?: string;
  is_pinned?: boolean;
}

export interface ListNotesResponse {
  data: LeadNote[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ========== ACTIVITIES DTOs ==========

export interface ListActivitiesResponse {
  data: LeadActivity[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ========== SERVICE REQUESTS DTOs ==========

export interface CreateServiceRequestDto {
  service_name: string;
  service_type?: string;
  service_description: string;
  requested_date?: string;
  urgency?: 'low' | 'medium' | 'high' | 'emergency';
  estimated_value?: number;
  notes?: string;
}

export interface UpdateServiceRequestDto {
  service_name?: string;
  service_type?: string;
  service_description?: string;
  urgency?: 'low' | 'medium' | 'high' | 'emergency';
  status?: 'new' | 'pending' | 'scheduled' | 'completed' | 'cancelled';
}

export interface ListServiceRequestsResponse {
  data: ServiceRequest[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ========== WEBHOOK API KEYS ==========

export interface WebhookApiKey {
  id: string;
  key_name: string;
  is_active: boolean;
  created_at: string;
  last_used_at?: string | null;
  created_by?: {
    id: string;
    name: string;
    email: string;
  };
}

export interface CreateWebhookKeyResponse {
  success: boolean;
  api_key: string; // ONLY shown once
  key_id: string;
  key_name: string;
  webhook_url: string;
  created_at: string;
  warning: string;
}

export interface ListWebhookKeysResponse {
  webhook_url: string;
  api_keys: WebhookApiKey[];
}

// ========== GOOGLE MAPS TYPES ==========

export interface GoogleAddressComponents {
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  google_place_id?: string;
}

// ========== FILTERS & SEARCH ==========

export interface LeadFilters {
  status?: ('lead' | 'prospect' | 'customer' | 'lost')[];
  source?: string[];
  search?: string;
  created_after?: string;
  created_before?: string;
  page?: number;
  limit?: number;
  sort_by?: 'name' | 'city' | 'state' | 'status' | 'source' | 'created_at';
  sort_order?: 'asc' | 'desc';
}
