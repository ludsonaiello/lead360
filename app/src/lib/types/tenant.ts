/**
 * Tenant TypeScript Types
 * Source: /var/www/lead360.app/api/documentation/tenant_REST_API.md
 *
 * CRITICAL: All field names copied EXACTLY from API documentation
 * DO NOT assume any field names or types
 */

// ==========================================
// MAIN TENANT PROFILE
// ==========================================

export interface TenantProfile {
  id: string;
  subdomain: string;
  company_name: string;
  is_active: boolean;

  // LEGAL & TAX INFORMATION
  legal_business_name: string | null;
  dba_name: string | null;
  business_entity_type: 'sole_proprietorship' | 'llc' | 'corporation' | 's-corporation' | 'partnership' | 'dba' | null;
  state_of_registration: string | null;
  date_of_incorporation: string | null; // ISO 8601 date string
  ein: string | null;
  state_tax_id: string | null;
  sales_tax_permit: string | null;
  services_offered: string[]; // Array of service names

  // CONTACT INFORMATION
  primary_contact_phone: string | null;
  secondary_phone: string | null;
  primary_contact_email: string | null;
  support_email: string | null;
  billing_email: string | null;
  website_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  youtube_url: string | null;

  // FINANCIAL & PAYMENT INFORMATION
  bank_name: string | null;
  routing_number: string | null;
  account_number: string | null;
  account_type: 'checking' | 'savings' | null;
  venmo_username: string | null;
  venmo_qr_code_file_id: string | null;

  // BRANDING
  logo_file_id: string | null;
  logo_file?: FileMetadata | null;
  primary_brand_color: string | null;
  secondary_brand_color: string | null;
  accent_color: string | null;

  // INVOICE & QUOTE SETTINGS
  invoice_prefix: string | null;
  next_invoice_number: number | null;
  quote_prefix: string | null;
  next_quote_number: number | null;
  default_quote_validity_days: number | null;
  default_quote_terms: string | null;
  default_quote_footer: string | null;
  default_invoice_footer: string | null;
  default_payment_instructions: string | null;
  sales_tax_rate: number | null; // 0-99.999%
  default_profit_margin: number | null; // 0-999.99%
  default_overhead_rate: number | null; // 0-999.99%
  default_contingency_rate: number | null; // 0-999.99%

  // OPERATIONAL
  timezone: string | null;

  // SUBSCRIPTION MANAGEMENT
  subscription_plan_id: string | null;
  subscription_status: string | null;
  trial_end_date: string | null;
  billing_cycle: string | null;
  next_billing_date: string | null;

  // RELATIONS (optional, populated on request)
  subscription_plan?: SubscriptionPlan;
  addresses?: Address[];
  licenses?: License[];
  insurance?: Insurance;
  payment_terms?: PaymentTerms;
  business_hours?: BusinessHours;
  custom_hours?: CustomHours[];
  service_areas?: ServiceArea[];

  // TIMESTAMPS
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// ==========================================
// FILE METADATA
// ==========================================

export interface FileMetadata {
  file_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

// ==========================================
// ADDRESSES
// ==========================================

export interface Address {
  id: string;
  tenant_id: string;
  address_type: 'legal' | 'billing' | 'service' | 'mailing' | 'office';
  line1: string;
  line2: string | null;
  city: string;
  state: string; // 2-letter code
  zip_code: string;
  country: string;
  lat: number | null;
  long: number | null;
  is_po_box: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAddressData {
  address_type: 'legal' | 'billing' | 'service' | 'mailing' | 'office';
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  zip_code: string;
  country?: string;
  lat?: number | null;
  long?: number | null;
  is_po_box?: boolean;
  is_default?: boolean;
}

export interface UpdateAddressData {
  address_type?: 'legal' | 'billing' | 'service' | 'mailing' | 'office';
  line1?: string;
  line2?: string | null;
  city?: string;
  state?: string;
  zip_code?: string;
  lat?: number | null;
  long?: number | null;
  is_po_box?: boolean;
  is_default?: boolean;
}

// ==========================================
// LICENSES
// ==========================================

export interface License {
  id: string;
  tenant_id: string;
  license_type_id: string | null;
  custom_license_type: string | null;
  license_number: string;
  issuing_state: string;
  issue_date: string; // ISO 8601 date string
  expiry_date: string; // ISO 8601 date string
  document_file_id: string | null;
  document_file?: FileMetadata | null;
  license_type?: LicenseType;
  created_at: string;
  updated_at: string;
}

export interface LicenseType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateLicenseData {
  license_type_id?: string | null;
  custom_license_type?: string | null;
  license_number: string;
  issuing_state: string;
  issue_date: string;
  expiry_date: string;
  document_file_id?: string | null;
}

export interface UpdateLicenseData {
  license_type_id?: string | null;
  custom_license_type?: string | null;
  license_number?: string;
  issuing_state?: string;
  issue_date?: string;
  expiry_date?: string;
  document_file_id?: string | null;
}

export interface LicenseStatus {
  license: License;
  status: 'expired' | 'expiring_soon' | 'valid';
  days_until_expiry: number;
}

// ==========================================
// INSURANCE
// ==========================================

export interface Insurance {
  id: string;
  tenant_id: string;

  // General Liability Insurance
  gl_insurance_provider: string | null;
  gl_policy_number: string | null;
  gl_coverage_amount: number | null;
  gl_effective_date: string | null;
  gl_expiry_date: string | null;
  gl_document_file_id: string | null;
  gl_document_file?: FileMetadata | null;

  // Workers' Compensation Insurance
  wc_insurance_provider: string | null;
  wc_policy_number: string | null;
  wc_coverage_amount: number | null;
  wc_effective_date: string | null;
  wc_expiry_date: string | null;
  wc_document_file_id: string | null;
  wc_document_file?: FileMetadata | null;

  created_at: string;
  updated_at: string;
}

export interface UpdateInsuranceData {
  gl_insurance_provider?: string | null;
  gl_policy_number?: string | null;
  gl_coverage_amount?: number | null;
  gl_effective_date?: string | null;
  gl_expiry_date?: string | null;
  gl_document_file_id?: string | null;
  wc_insurance_provider?: string | null;
  wc_policy_number?: string | null;
  wc_coverage_amount?: number | null;
  wc_effective_date?: string | null;
  wc_expiry_date?: string | null;
  wc_document_file_id?: string | null;
}

export interface InsuranceStatus {
  insurance: Insurance;
  gl_status: {
    status: 'expired' | 'expiring_soon' | 'valid' | null;
    days_until_expiry: number | null;
  };
  wc_status: {
    status: 'expired' | 'expiring_soon' | 'valid' | null;
    days_until_expiry: number | null;
  };
}

export interface InsuranceCoverage {
  gl_covered: boolean;
  wc_covered: boolean;
  all_covered: boolean;
}

// ==========================================
// PAYMENT TERMS
// ==========================================

export interface PaymentTerm {
  sequence: number;
  type: 'percentage' | 'fixed';
  amount: number;
  description: string;
}

export interface PaymentTerms {
  id: string;
  tenant_id: string;
  terms_json: PaymentTerm[];
  created_at: string;
  updated_at: string;
}

export interface UpdatePaymentTermsData {
  terms: PaymentTerm[];
}

export interface PaymentTermsValidation {
  percentage_sum: number;
  percentage_warning: string | null;
}

export interface UpdatePaymentTermsResponse extends PaymentTerms {
  validation?: PaymentTermsValidation;
}

export type PaymentTermTemplates = Record<string, PaymentTerm[]>;

// ==========================================
// BUSINESS HOURS
// ==========================================

export interface BusinessHours {
  id: string;
  tenant_id: string;

  // Monday
  monday_closed: boolean;
  monday_open1: string | null; // HH:MM format
  monday_close1: string | null;
  monday_open2: string | null;
  monday_close2: string | null;

  // Tuesday
  tuesday_closed: boolean;
  tuesday_open1: string | null;
  tuesday_close1: string | null;
  tuesday_open2: string | null;
  tuesday_close2: string | null;

  // Wednesday
  wednesday_closed: boolean;
  wednesday_open1: string | null;
  wednesday_close1: string | null;
  wednesday_open2: string | null;
  wednesday_close2: string | null;

  // Thursday
  thursday_closed: boolean;
  thursday_open1: string | null;
  thursday_close1: string | null;
  thursday_open2: string | null;
  thursday_close2: string | null;

  // Friday
  friday_closed: boolean;
  friday_open1: string | null;
  friday_close1: string | null;
  friday_open2: string | null;
  friday_close2: string | null;

  // Saturday
  saturday_closed: boolean;
  saturday_open1: string | null;
  saturday_close1: string | null;
  saturday_open2: string | null;
  saturday_close2: string | null;

  // Sunday
  sunday_closed: boolean;
  sunday_open1: string | null;
  sunday_close1: string | null;
  sunday_open2: string | null;
  sunday_close2: string | null;

  created_at: string;
  updated_at: string;
}

export interface UpdateBusinessHoursData {
  monday_closed?: boolean;
  monday_open1?: string | null;
  monday_close1?: string | null;
  monday_open2?: string | null;
  monday_close2?: string | null;
  tuesday_closed?: boolean;
  tuesday_open1?: string | null;
  tuesday_close1?: string | null;
  tuesday_open2?: string | null;
  tuesday_close2?: string | null;
  wednesday_closed?: boolean;
  wednesday_open1?: string | null;
  wednesday_close1?: string | null;
  wednesday_open2?: string | null;
  wednesday_close2?: string | null;
  thursday_closed?: boolean;
  thursday_open1?: string | null;
  thursday_close1?: string | null;
  thursday_open2?: string | null;
  thursday_close2?: string | null;
  friday_closed?: boolean;
  friday_open1?: string | null;
  friday_close1?: string | null;
  friday_open2?: string | null;
  friday_close2?: string | null;
  saturday_closed?: boolean;
  saturday_open1?: string | null;
  saturday_close1?: string | null;
  saturday_open2?: string | null;
  saturday_close2?: string | null;
  sunday_closed?: boolean;
  sunday_open1?: string | null;
  sunday_close1?: string | null;
  sunday_open2?: string | null;
  sunday_close2?: string | null;
}

// ==========================================
// CUSTOM HOURS
// ==========================================

export interface CustomHours {
  id: string;
  tenant_id: string;
  date: string; // ISO 8601 date string
  reason: string;
  closed: boolean;
  open_time1: string | null; // HH:MM format
  close_time1: string | null;
  open_time2: string | null;
  close_time2: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomHoursData {
  date: string;
  reason: string;
  closed: boolean;
  open_time1?: string | null;
  close_time1?: string | null;
  open_time2?: string | null;
  close_time2?: string | null;
}

export interface UpdateCustomHoursData {
  date?: string;
  reason?: string;
  closed?: boolean;
  open_time1?: string | null;
  close_time1?: string | null;
  open_time2?: string | null;
  close_time2?: string | null;
}

// ==========================================
// SERVICE AREAS
// ==========================================

export interface ServiceArea {
  id: string;
  tenant_id: string;
  type: 'city' | 'zipcode' | 'radius' | 'state'; // Database field is 'type', not 'area_type'
  value: string; // City name, ZIP code, or description
  latitude: string; // Decimal as string
  longitude: string; // Decimal as string
  radius_miles: string | null; // Decimal as string
  state: string | null; // 2-letter code
  city_name: string | null; // City name for all types (except entire state)
  zipcode: string | null; // ZIP code for all types (except entire state)
  entire_state: boolean; // True for state type, false for others
  created_at: string;
  updated_at: string;
}

export interface CreateServiceAreaData {
  area_type: 'city' | 'zipcode' | 'radius' | 'state';
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  center_lat?: number | null;
  center_long?: number | null;
  radius_miles?: number | null;
  city_name?: string | null;
  entire_state?: boolean;
}

export interface UpdateServiceAreaData {
  area_type?: 'city' | 'zipcode' | 'radius' | 'state';
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  center_lat?: number | null;
  center_long?: number | null;
  radius_miles?: number | null;
  city_name?: string | null;
  entire_state?: boolean;
}

export interface ServiceAreaWithDistance extends ServiceArea {
  distance_miles?: number;
}

export interface ServiceCoverageCheck {
  is_covered: boolean;
  covering_areas: ServiceAreaWithDistance[];
}

// ==========================================
// SERVICES
// ==========================================

export interface Service {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignServicesData {
  service_ids: string[]; // Array of service UUIDs (0-50 items)
}

// ==========================================
// SUBSCRIPTION PLAN
// ==========================================

export interface SubscriptionPlan {
  id: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  max_users: number;
  max_quotes_per_month: number;
  max_storage_gb: number;
  feature_flags: Record<string, boolean>;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// ==========================================
// STATISTICS
// ==========================================

export interface TenantStatistics {
  users: number;
  addresses: number;
  licenses: number;
  expiring_licenses: number;
  insurance_expiring_soon: {
    gl: boolean;
    wc: boolean;
  };
}

// ==========================================
// SUBDOMAIN AVAILABILITY
// ==========================================

export interface SubdomainAvailability {
  available: boolean;
  reason?: string;
}

// ==========================================
// BRANDING UPDATE
// ==========================================

export interface UpdateBrandingData {
  primary_brand_color?: string;
  secondary_brand_color?: string;
  accent_color?: string;
  logo_file_id?: string;
  company_website?: string;
  tagline?: string;
}

export interface LogoUploadResponse {
  url: string;
}

// ==========================================
// FORM DATA TYPES (for UI)
// ==========================================

export interface BusinessInfoFormData {
  // Legal & Tax
  legal_business_name?: string;
  dba_name?: string;
  business_entity_type?: 'sole_proprietorship' | 'llc' | 'corporation' | 's-corporation' | 'partnership' | 'dba';
  state_of_registration?: string;
  date_of_incorporation?: string;
  ein?: string;
  state_tax_id?: string;
  sales_tax_permit?: string;

  // Contact
  primary_contact_phone?: string;
  secondary_phone?: string;
  primary_contact_email?: string;
  support_email?: string;
  billing_email?: string;
  website_url?: string;
  instagram_url?: string;
  facebook_url?: string;
  tiktok_url?: string;
  youtube_url?: string;

  // Financial
  bank_name?: string;
  routing_number?: string;
  account_number?: string;
  account_type?: 'checking' | 'savings';
  venmo_username?: string;

  // Invoice & Quote
  invoice_prefix?: string;
  next_invoice_number?: number;
  quote_prefix?: string;
  next_quote_number?: number;
  default_quote_validity_days?: number;
  default_quote_terms?: string;
  default_quote_footer?: string;
  default_invoice_footer?: string;
  default_payment_instructions?: string;
}

// Helper type for partial updates
export type UpdateTenantProfileData = Partial<BusinessInfoFormData>;
