// Quote Module - TypeScript Type Definitions
// Sprint 1: Foundation & Core Operations

// ========== CORE QUOTE TYPES ==========

export interface Quote {
  id: string;
  quote_number: string;
  title: string;
  status: QuoteStatus;
  active_version_number: number;
  lead_id: string;
  vendor_id: string;
  jobsite_address_id: string;
  parent_quote_id?: string | null; // Change Order: If NOT NULL, this is a change order
  po_number?: string | null;
  private_notes?: string | null;
  use_default_settings: boolean;
  custom_profit_percent?: number | null;
  custom_overhead_percent?: number | null;
  custom_contingency_percent?: number | null;
  custom_tax_rate?: number | null;
  custom_terms?: string | null;
  custom_payment_instructions?: string | null;
  expiration_days: number;
  expires_at: string | null;
  active_template_id?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total: number;
  // NEW: Change Order calculated fields (always present from backend)
  total_with_change_orders?: number; // Original total + approved COs total
  approved_change_orders_total?: number; // Sum of approved COs only
  approved_change_orders_count?: number; // Count of approved COs
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  lead: LeadSummary;
  vendor: VendorSummary;
  jobsite_address: Address;
  items?: QuoteItem[];
  groups?: QuoteGroup[];
  discount_rules?: any[];
  draw_schedule?: any[];
  attachments?: any[];
  tag_assignments?: any[];
  // NEW: Change orders array (only on GET /quotes/:id, not on list)
  change_orders?: Array<{
    id: string;
    quote_number: string; // "CO-2026-0001"
    title: string;
    status: QuoteStatus;
    total: number;
    created_at: string;
    updated_at: string;
  }>;
}

export type QuoteStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'ready'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'opened'
  | 'downloaded'
  | 'email_failed'
  | 'denied'
  | 'lost'
  | 'started'
  | 'concluded';

export interface QuoteSummary {
  id: string;
  quote_number: string;
  title: string;
  status: QuoteStatus;
  version: string;
  total: number;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  lead: {
    id: string;
    first_name: string;
    last_name: string;
  };
  vendor: {
    id: string;
    name: string;
  };
  jobsite_address: {
    id: string;
    city: string;
    state: string;
    address_line1: string;
  };
  created_at: string;
  expires_at: string;
}

export interface QuoteListResponse {
  data: QuoteSummary[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface QuoteStatistics {
  total_quotes: number;
  by_status: {
    draft?: number;
    pending_approval?: number;
    approved?: number;
    ready?: number;
    sent?: number;
    delivered?: number;
    read?: number;
    opened?: number;
    downloaded?: number;
    email_failed?: number;
    denied?: number;
    lost?: number;
    started?: number;
    concluded?: number;
  };
  total_revenue: number;
  avg_quote_value: number;
  amount_sent: number;
  amount_lost: number;
  amount_denied: number;
  amount_pending_approval: number;
  conversion_rate: number;
}

export interface QuoteFilters {
  page?: number;
  limit?: number;
  status?: QuoteStatus;
  vendor_id?: string;
  lead_id?: string;
  search?: string;
  created_from?: string;
  created_to?: string;
  sort_by?: 'created_at' | 'updated_at' | 'quote_number' | 'total';
  sort_order?: 'asc' | 'desc';
}

// ========== CREATE/UPDATE DTOs ==========

export interface CreateQuoteDto {
  lead_id?: string; // Optional: Required for POST /quotes, but NOT for POST /quotes/from-lead/:leadId (path param)
  vendor_id: string;
  title: string;
  jobsite_address: Address;
  po_number?: string;
  expiration_days?: number;
  use_default_settings?: boolean;
  custom_profit_percent?: number;
  custom_overhead_percent?: number;
  private_notes?: string;
}

export interface CreateQuoteWithCustomerDto {
  customer: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    company_name?: string;
  };
  vendor_id: string;
  title: string;
  jobsite_address: Address;
  po_number?: string;
  expiration_days?: number;
}

export interface UpdateQuoteDto {
  vendor_id?: string;
  title?: string;
  po_number?: string;
  expiration_date?: string;
  custom_profit_percent?: number | null;
  custom_overhead_percent?: number | null;
  custom_contingency_percent?: number | null;
  custom_tax_rate?: number | null;
  private_notes?: string;
  custom_terms?: string;
  custom_payment_instructions?: string;
}

// ========== VENDOR TYPES ==========

export interface Vendor {
  id: string;
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code: string;
  latitude?: number;
  longitude?: number;
  signature_file_id?: string;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendorSummary {
  id: string;
  name: string;
  email: string;
  phone: string;
  is_active: boolean;
  is_default: boolean;
  quote_count: number;
}

export interface VendorListResponse {
  data: VendorSummary[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface VendorStatistics {
  vendor_id: string;
  total_quotes: number;
  draft_count: number;
  sent_count: number;
  accepted_count: number;
  rejected_count: number;
  total_revenue: number;
  avg_quote_value: number;
}

export interface CreateVendorDto {
  name: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code: string;
  latitude?: number;
  longitude?: number;
  signature_file_id?: string;
  is_active?: boolean;
  is_default?: boolean;
}

// ========== QUOTE SETTINGS TYPES ==========

export interface QuoteSettings {
  // Financial defaults
  default_profit_margin: number;
  default_overhead_rate: number;
  default_contingency_rate: number;
  sales_tax_rate: number | null;
  profitability_thresholds: ProfitabilityThresholds | null;

  // Quote numbering
  quote_prefix: string;
  next_quote_number: number;

  // Invoice numbering
  invoice_prefix: string;
  next_invoice_number: number;

  // Terms & text
  default_quote_terms: string | null;
  default_payment_instructions: string | null;
  default_quote_validity_days: number;
  default_quote_footer: string | null;
  default_invoice_footer: string | null;

  // Display preferences
  show_line_items_by_default: boolean;
  show_cost_breakdown_by_default: boolean;

  // Workflow configuration
  approval_thresholds: ApprovalThreshold[] | null;
  active_quote_template_id: string | null;

  // Meta
  is_using_system_defaults: boolean;
}

export interface ProfitabilityThresholds {
  min_margin?: number;
  target_margin?: number;
  warning_threshold?: number;
  excellent_threshold?: number;
}

export interface ApprovalThreshold {
  level: number;
  amount: number;
  approver_role: string;
}

export interface UpdateQuoteSettingsDto {
  // Financial defaults
  default_profit_margin?: number;
  default_overhead_rate?: number;
  default_contingency_rate?: number;
  sales_tax_rate?: number | null;
  profitability_thresholds?: ProfitabilityThresholds | null;

  // Quote numbering
  quote_prefix?: string;
  next_quote_number?: number;

  // Invoice numbering
  invoice_prefix?: string;
  next_invoice_number?: number;

  // Terms & text
  default_quote_terms?: string | null;
  default_payment_instructions?: string | null;
  default_quote_validity_days?: number;
  default_quote_footer?: string | null;
  default_invoice_footer?: string | null;

  // Display preferences
  show_line_items_by_default?: boolean;
  show_cost_breakdown_by_default?: boolean;

  // Workflow configuration
  approval_thresholds?: ApprovalThreshold[] | null;
  active_quote_template_id?: string | null;
}

export interface ResetSettingsResponse {
  message: string;
  settings: QuoteSettings;
}

// ========== SHARED/HELPER TYPES ==========

export interface Address {
  address_line1: string;
  address_line2?: string;
  city?: string;
  state?: string;
  zip_code: string;
  latitude?: number;
  longitude?: number;
}

interface LeadSummary {
  id: string;
  first_name: string;
  last_name: string;
  emails: Array<{
    id: string;
    lead_id: string;
    email: string;
    is_primary: boolean;
    created_at: string;
  }>;
  phones: Array<{
    id: string;
    lead_id: string;
    phone: string;
    phone_type: string;
    is_primary: boolean;
    created_at: string;
  }>;
}

// ========== SPRINT 2: ITEMS, GROUPS & LIBRARY ==========

// Quote Items
export interface QuoteItem {
  id: string;
  quote_id: string;
  library_item_id?: string;
  quote_group_id?: string;
  title: string;
  description?: string;
  quantity: number;
  unit_measurement_id: string;
  unit_measurement?: UnitMeasurement;
  material_cost_per_unit: number;
  labor_cost_per_unit: number;
  equipment_cost_per_unit: number;
  subcontract_cost_per_unit: number;
  other_cost_per_unit: number;
  total_cost_per_unit: number; // API calculates
  total_cost: number; // API calculates
  // Custom markup percentages (optional - override quote-level defaults)
  custom_profit_percent?: number | null;
  custom_overhead_percent?: number | null;
  custom_contingency_percent?: number | null;
  custom_discount_percentage?: number | null;
  custom_discount_amount?: number | null;
  warranty_tier_id?: string;
  warranty_tier?: WarrantyTier;
  warranty_price?: number; // API calculates if warranty selected
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteItemDto {
  title: string;
  description?: string;
  quantity: number;
  unit_measurement_id: string;
  material_cost_per_unit: number;
  labor_cost_per_unit: number;
  equipment_cost_per_unit: number;
  subcontract_cost_per_unit: number;
  other_cost_per_unit: number;
  // Custom markup percentages (optional - override quote-level defaults)
  custom_profit_percent?: number | null;
  custom_overhead_percent?: number | null;
  custom_contingency_percent?: number | null;
  custom_discount_percentage?: number | null;
  custom_discount_amount?: number | null;
  quote_group_id?: string;
  warranty_tier_id?: string;
}

export interface UpdateQuoteItemDto {
  title?: string;
  description?: string;
  quantity?: number;
  unit_measurement_id?: string;
  material_cost_per_unit?: number;
  labor_cost_per_unit?: number;
  equipment_cost_per_unit?: number;
  subcontract_cost_per_unit?: number;
  other_cost_per_unit?: number;
  // Custom markup percentages (optional - override quote-level defaults)
  custom_profit_percent?: number | null;
  custom_overhead_percent?: number | null;
  custom_contingency_percent?: number | null;
  custom_discount_percentage?: number | null;
  custom_discount_amount?: number | null;
  warranty_tier_id?: string;
}

export interface ReorderItemsDto {
  items: Array<{
    item_id: string;
    order_index: number;
  }>;
}

// Quote Groups
export interface QuoteGroup {
  id: string;
  quote_id: string;
  name: string;
  description?: string;
  order_index: number;
  items: QuoteItem[];
  items_count: number;
  total_cost: number; // API calculates
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteGroupDto {
  name: string;
  description?: string;
}

export interface UpdateQuoteGroupDto {
  name?: string;
  description?: string;
}

export interface DeleteGroupOptions {
  keep_items: boolean; // true = remove from group, false = delete all items
}

export interface ReorderGroupsDto {
  groups: Array<{
    group_id: string;
    order_index: number;
  }>;
}

export interface AddItemsToGroupDto {
  item_ids: string[];
}

// Library Items
export interface LibraryItem {
  id: string;
  title: string;
  description?: string;
  default_quantity: number; // Default quantity when adding to quote (min: 0.01)
  unit_measurement_id: string;
  unit_measurement?: UnitMeasurement;
  material_cost_per_unit: number;
  labor_cost_per_unit: number;
  equipment_cost_per_unit: number;
  subcontract_cost_per_unit: number;
  other_cost_per_unit: number;
  total_cost_per_unit: number; // API calculates
  // Markup overrides (optional - applied when adding to quote)
  override_profit_percent?: number | null;
  override_overhead_percent?: number | null;
  override_contingency_percent?: number | null;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface LibraryItemListResponse {
  data: LibraryItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateLibraryItemDto {
  title: string;
  description?: string;
  default_quantity: number; // Required: min 0.01
  unit_measurement_id: string;
  material_cost_per_unit: number;
  labor_cost_per_unit: number;
  equipment_cost_per_unit: number;
  subcontract_cost_per_unit: number;
  other_cost_per_unit: number;
  // Markup overrides (optional - applied when adding to quote)
  override_profit_percent?: number;
  override_overhead_percent?: number;
  override_contingency_percent?: number;
}

export interface UpdateLibraryItemDto {
  title?: string;
  description?: string;
  default_quantity?: number; // Optional in updates: min 0.01
  unit_measurement_id?: string;
  material_cost_per_unit?: number;
  labor_cost_per_unit?: number;
  equipment_cost_per_unit?: number;
  subcontract_cost_per_unit?: number;
  other_cost_per_unit?: number;
  // Markup overrides (optional - applied when adding to quote)
  override_profit_percent?: number | null;
  override_overhead_percent?: number | null;
  override_contingency_percent?: number | null;
}

export interface BulkImportResult {
  total_rows: number;
  successful_imports: number;
  failed_imports: number;
  results: Array<{
    row_number: number;
    status: 'success' | 'error';
    item?: LibraryItem;
    error_message?: string;
  }>;
}

export interface LibraryItemUsageStats {
  total_items: number;
  active_items: number;
  inactive_items: number;
  most_used_items: Array<{
    id: string;
    title: string;
    usage_count: number;
  }>;
}

// Unit Measurements
export interface UnitMeasurement {
  id: string;
  name: string;
  abbreviation: string;
  is_global: boolean; // true = platform-wide, false = tenant-specific
  tenant_id?: string; // null for global units
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface UnitMeasurementListResponse {
  data: UnitMeasurement[];
}

export interface CreateCustomUnitDto {
  name: string;
  abbreviation: string;
}

export interface UpdateCustomUnitDto {
  name?: string;
  abbreviation?: string;
}

export interface UnitUsageResponse {
  unit_id: string;
  is_in_use: boolean;
  usage_locations: Array<{
    type: 'library_item' | 'quote_item';
    id: string;
    title: string;
  }>;
}

// Bundles
export interface Bundle {
  id: string;
  name: string;
  description?: string;
  items: BundleItem[];
  _count: {
    items: number;
  };
  total_cost: number; // API calculates
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BundleItem {
  id: string;
  quote_bundle_id: string;
  item_library_id: string;
  title: string;
  description?: string;
  quantity: string; // API returns as string
  unit_measurement_id: string;
  material_cost_per_unit: string; // API returns as string
  labor_cost_per_unit: string;
  equipment_cost_per_unit: string;
  subcontract_cost_per_unit: string;
  other_cost_per_unit: string;
  order_index: number;
  created_at: string;
  unit_measurement: {
    id: string;
    name: string;
    abbreviation: string;
  };
}

export interface BundleListResponse {
  data: Bundle[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateBundleDto {
  name: string;
  description?: string;
  items: Array<{
    library_item_id: string;
    quantity: number;
  }>;
}

export interface UpdateBundleDto {
  name?: string;
  description?: string;
}

export interface UpdateBundleWithItemsDto {
  name: string;
  description?: string;
  items: Array<{
    library_item_id: string;
    quantity: number;
  }>;
}

// Warranty Tiers
export interface WarrantyTier {
  id: string;
  tier_name: string;
  description?: string;
  price_type: 'fixed' | 'percentage';
  price_value: number; // dollar amount if fixed, percentage value if percentage
  duration_months: number;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWarrantyTierDto {
  tier_name: string;
  description?: string;
  price_type: 'fixed' | 'percentage';
  price_value: number;
  duration_months: number;
}

export interface UpdateWarrantyTierDto {
  tier_name?: string;
  description?: string;
  price_type?: 'fixed' | 'percentage';
  price_value?: number;
  duration_months?: number;
  is_active?: boolean;
}

// ========== SPRINT 3: DISCOUNT RULES, PROFITABILITY, DRAW SCHEDULE ==========
// NOTE: These types match the ACTUAL API responses, not the REST API documentation
// See: /documentation/frontend/SPRINT3_API_DISCREPANCIES.md for details

// Discount Rules
export type DiscountRuleType = 'percentage' | 'fixed_amount';
export type DiscountApplyTo = 'subtotal';

export interface DiscountRule {
  id: string;
  quote_id: string;
  rule_type: DiscountRuleType;
  value: number;
  reason: string;
  apply_to: DiscountApplyTo;
  order_index: number;
  created_at: string;
  updated_at?: string;
}

// ACTUAL API Response (different from documentation!)
export interface DiscountRulesListResponse {
  discount_rules: DiscountRule[];
  summary: {
    total_discount_amount: number;
    subtotal_before_discounts: number;
    subtotal_after_discounts: number;
    discount_count: number;
  };
}

export interface CreateDiscountRuleDto {
  rule_type: DiscountRuleType;
  value: number;
  reason: string;
  apply_to?: DiscountApplyTo;
}

export interface UpdateDiscountRuleDto {
  rule_type?: DiscountRuleType;
  value?: number;
  reason?: string;
  apply_to?: DiscountApplyTo;
}

// NOTE: Reorder endpoint is currently broken - validation fails
export interface ReorderDiscountRulesDto {
  discount_rules: Array<{
    id: string;
    new_order_index: number;
  }>;
}

export interface DiscountPreviewRequest {
  rule_type: DiscountRuleType;
  value: number;
}

// ACTUAL API Response (completely different from documentation!)
export interface DiscountPreviewResponse {
  current_total: number;
  proposed_discount_amount: number;
  new_total: number;
  impact_amount: number;
  impact_percent: number;
  current_margin_percent: number;
  new_margin_percent: number;
  margin_change: number;
}

// Profitability Analysis - ACTUAL API Response (very different from docs!)
export interface ProfitabilityValidation {
  quote_id: string;
  is_valid: boolean; // NOT is_profitable!
  can_send: boolean;
  margin_percent: number;
  warning_level: 'green' | 'yellow' | 'red';
  thresholds: {
    target: number; // NOT target_margin!
    minimum: number; // NOT minimum_margin!
    hard_floor: number;
  };
  financial_summary: {
    total_cost: number;
    total_revenue: number;
    gross_profit: number; // Use this instead of profit_amount
    discount_amount: number;
    tax_amount: number;
    subtotal_before_discount: number;
  };
  warnings: string[];
  recommendations: string[];
}

// ACTUAL API Response (completely different structure!)
export interface ProfitabilityAnalysis {
  quote_id: string;
  quote_total: number;
  overall_margin_percent: number;
  markup_settings: {
    profit_percent: number;
    overhead_percent: number;
    contingency_percent: number;
    total_markup_multiplier: number;
  };
  items_analysis: Array<{
    item_id: string;
    title: string;
    group_name: string;
    quantity: number;
    unit: string;
    cost: number;
    price_before_discount: number;
    profit: number;
    margin_percent: number;
    status: 'healthy' | 'acceptable' | 'low' | 'critical';
  }>;
  groups_analysis: Array<{
    group_id: string;
    name: string;
    item_count: number;
    total_cost: number;
    total_price: number;
    margin_percent: number;
  }>;
  low_margin_items: Array<any>;
  high_margin_items: Array<any>;
  summary: {
    total_items: number;
    healthy_items: number;
    acceptable_items: number;
    low_margin_items: number;
    critical_items: number;
  };
}

// Draw Schedule - ACTUAL API (completely different from docs!)
export type DrawCalculationType = 'percentage' | 'fixed_amount';

export interface DrawEntry {
  id: string;
  draw_number: number;
  description: string;
  value: number; // NOT "percentage"! This is the user-entered value
  calculated_amount: number; // The dollar amount (calculated by backend)
  running_total: number; // Cumulative total
  percentage_of_total: number; // Running percentage (0-100)
  created_at: string;
}

export interface DrawSchedule {
  quote_id: string;
  quote_total: number;
  calculation_type: DrawCalculationType;
  entries: DrawEntry[];
  validation: {
    is_valid: boolean;
    percentage_sum: number;
    amount_sum: number;
    variance: number;
    variance_percent: number;
  };
}

export interface CreateDrawScheduleDto {
  calculation_type: DrawCalculationType; // REQUIRED! Missing from docs
  entries: Array<{
    draw_number: number;
    description: string;
    value: number; // NOT "percentage", NOT "due_on_event"!
  }>;
}

export interface UpdateDrawScheduleDto {
  calculation_type: DrawCalculationType;
  entries: Array<{
    draw_number: number;
    description: string;
    value: number;
  }>;
}

// ========== SPRINT 5: ATTACHMENTS, PDF, EMAIL & PUBLIC ACCESS ==========

// Attachment Types
export type AttachmentType = 'cover_photo' | 'full_page_photo' | 'grid_photo' | 'url_attachment';
export type GridLayout = 'grid_2' | 'grid_4' | 'grid_6';

export interface QuoteAttachment {
  id: string;
  quote_id: string;
  attachment_type: AttachmentType;
  file_id: string | null;
  url: string | null;
  title: string | null;
  qr_code_file_id: string | null;
  grid_layout: GridLayout | null;
  order_index: number;
  created_at: string;
  // Conditional nested objects based on type
  qr_code_file?: FileDetails; // Only for url_attachment
  file?: FileDetails; // Only for photo types
}

export interface FileDetails {
  file_id: string;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  url: string; // Full path like /public/{tenant_id}/files/{file_id}.ext
  width?: number;
  height?: number;
}

export interface CreateAttachmentDto {
  attachment_type: AttachmentType;
  file_id?: string; // Required for photo types
  url?: string; // Required for url_attachment
  title?: string;
  grid_layout?: GridLayout; // Required for grid_photo
}

export interface UpdateAttachmentDto {
  url?: string; // For url_attachment (triggers QR code regeneration)
  title?: string;
  grid_layout?: GridLayout; // For grid_photo
}

export interface ReorderAttachmentsDto {
  attachments: Array<{
    id: string;
    order_index: number;
  }>;
}

export interface ReorderAttachmentsResponse {
  success: boolean;
  message: string;
}

// PDF Generation Types
export interface GeneratePdfDto {
  include_cost_breakdown?: boolean; // Default: false
  force_regenerate?: boolean; // Force regeneration even if cached PDF exists (Default: false)
}

export interface PdfResponse {
  file_id: string;
  download_url: string;
  filename: string;
  file_size: number;
  generated_at: string;
  regenerated?: boolean;
}

// Email Delivery Types
export interface SendQuoteDto {
  recipient_email?: string; // Defaults to lead's primary email
  cc_emails?: string[];
  custom_message?: string; // Max 1000 characters
}

export interface SendQuoteResponse {
  success: boolean;
  message: string;
  public_url: string;
  pdf_file_id: string;
  email_id: string; // Communication event UUID
}

// Public Access Types
export interface GeneratePublicAccessDto {
  password?: string; // Min 6 chars
  password_hint?: string; // Max 255 chars
  expires_at?: string; // ISO 8601 date string
}

export interface PublicAccessUrl {
  public_url: string;
  access_token: string; // 32-character token
  has_password: boolean;
  password_hint?: string;
  expires_at?: string;
  created_at: string;
}

export interface PublicAccessStatus {
  has_public_access: boolean;
  public_url?: string;
  access_token?: string;
  has_password?: boolean;
  password_hint?: string;
  created_at?: string;
  expires_at?: string;
}

export interface DeactivatePublicAccessResponse {
  message: string;
}

// Public Quote (NO AUTH - for public viewer)
export interface PublicQuote {
  id: string;
  quote_number: string;
  title: string;
  description?: string;
  status: QuoteStatus;
  total_price: number;
  subtotal: number;
  total_tax: number;
  total_discount: number;
  currency: string;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    company_name?: string;
    emails: Array<{
      id: string;
      email: string;
      is_primary: boolean;
    }>;
    phones: Array<{
      id: string;
      phone: string;
      phone_type: string;
      is_primary: boolean;
    }>;
  };
  jobsite_address: {
    address_line1: string;
    address_line2?: string;
    city: string;
    state: string;
    zip_code: string;
  };
  vendor: {
    id: string;
    name: string;
    company_name?: string;
    contact_name?: string;
    phone: string;
    email: string;
    website?: string;
  };
  items: Array<{
    id: string;
    title: string;
    description?: string;
    quantity: number;
    unit: string;
    unit_price: number;
    total_price: number;
    total_cost: number;
    tax_amount: number;
    discount_amount: number;
    group?: {
      id: string;
      name: string;
      description?: string;
      display_order: number;
    };
    display_order: number;
    is_optional: boolean;
    images: string[];
  }>;
  branding?: {
    company_name: string;
    logo_file_id?: string;
    logo_url?: string;
    primary_color?: string;
    secondary_color?: string;
    accent_color?: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string | {
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      zip_code?: string;
      country?: string;
    };
    social_media?: Record<string, string>;
  };
  draw_schedule?: Array<{
    id: string;
    draw_number: number;
    description: string;
    percentage: number;
    amount: number;
  }>;
  payment_instructions?: string;
  po_number?: string;
  pdf?: {
    file_id: string;
    file_name: string;
    file_size: number;
    file_url: string;
  };
  cover_page_image_url?: string;
  attachments: QuoteAttachment[];
  public_notes?: string;
  terms_and_conditions?: string;
}

export interface ValidatePasswordDto {
  password: string;
}

export interface ValidatePasswordResponse {
  valid: boolean;
  message?: string;
  failed_attempts?: number;
  is_locked?: boolean;
  lockout_expires_at?: string | null;
}

export interface LogViewDto {
  referrer_url?: string;
  duration_seconds?: number;
}

// View Analytics Types
export interface ViewAnalytics {
  quote_id: string;
  total_views: number;
  unique_viewers: number;
  average_duration_seconds: number | null;
  engagement_score: number;
  views_by_date: Array<{
    date: string;
    count: number;
  }>;
  views_by_device: {
    desktop: number;
    mobile: number;
    tablet: number;
    unknown: number;
  };
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  total_downloads: number;
  downloads_by_date: Array<{
    date: string;
    count: number;
  }>;
  downloads_by_device: {
    desktop: number;
    mobile: number;
    tablet: number;
    unknown: number;
  };
  first_downloaded_at: string | null;
  last_downloaded_at: string | null;
}

export interface ViewHistoryEntry {
  id: string;
  ip_address: string;
  user_agent: string;
  referrer_url?: string;
  duration_seconds?: number;
  viewed_at: string;
}

export interface ViewHistoryResponse {
  data: ViewHistoryEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// ========== SPRINT 6: DASHBOARD ANALYTICS, SEARCH, & TAGS ==========
// NOTE: These types match ACTUAL API responses (tested 2026-01-30)
// DO NOT modify existing types above - these are ADDITIONS ONLY
// See: /documentation/frontend/SPRINT6_API_TESTING_RESULTS.md

// Dashboard Overview (extends QuoteStatistics with additional API fields)
export interface DashboardOverviewResponse {
  total_quotes: number;
  total_generated: number;
  total_revenue: number;
  avg_quote_value: number;
  amount_sent: number;
  amount_lost: number;
  amount_denied: number;
  amount_pending_approval: number;
  conversion_rate: number;
  by_status: Array<{
    status: string;
    count: number;
    total_revenue: number;
    avg_value: number;
  }>;
  velocity_comparison: {
    current: number;
    previous: number;
    change_percent: number;
    trend: string;
  };
  date_from: string;
  date_to: string;
}

export interface QuotesOverTimeResponse {
  data: Array<{
    date: string;
    count: number;
    total_value: number;
    approved_count: number;
    rejected_count: number;
  }>;
  interval: string;
  date_from: string;
  date_to: string;
}

export interface TopItemsResponse {
  top_items: Array<{
    title: string;
    usage_count: number;
    total_revenue: number;
    avg_price: number;
    library_item_id: string | null;
  }>;
  date_from: string;
  date_to: string;
}

export interface WinLossAnalysisResponse {
  total_wins: number;
  total_losses: number;
  win_rate: number;
  win_revenue: number;
  loss_revenue: number;
  loss_reasons: string[];
  date_from: string;
  date_to: string;
}

export interface ConversionFunnelResponse {
  funnel: Array<{
    stage: string;
    count: number;
    total_value: number;
    conversion_to_next: number | null;
    drop_off_rate: number | null;
  }>;
  overall_conversion_rate: number;
  date_from: string;
  date_to: string;
}

export interface RevenueByVendorResponse {
  vendors: Array<{
    vendor_id: string;
    vendor_name: string;
    quote_count: number;
    total_revenue: number;
    avg_quote_value: number;
    approval_rate: number;
  }>;
  date_from: string;
  date_to: string;
}

export interface AvgPricingByTaskResponse {
  benchmarks: Array<{
    task_title: string;
    usage_count: number;
    avg_price: number;
    min_price: number;
    max_price: number;
    median_price: number;
    library_item_id: string | null;
  }>;
  date_from: string;
  date_to: string;
}

export interface ExportDashboardDto {
  format: 'csv' | 'xlsx' | 'pdf';
  date_from?: string;
  date_to?: string;
  sections: string[]; // REQUIRED: min 1 element
}

export interface ExportDashboardResponse {
  file_id: string;
  download_url: string;
  filename: string;
  file_size: number;
  format: string;
  generated_at: string;
  expires_at: string;
}

// Search Types
export interface QuoteSearchFilters {
  customer_name?: string;
  quote_number?: string;
  status?: string[]; // MUST be array
  vendor_id?: string;
  min_amount?: number;
  max_amount?: number;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface QuoteSearchResponse {
  results: Array<{
    id: string;
    quote_number: string;
    title: string;
    status: string;
    total: number;
    customer_name: string;
    city: string;
    created_at: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface SearchSuggestion {
  value: string;
  type: 'quote_number' | 'customer' | 'item';
  usage_count: number;
}

export interface SearchSuggestionsResponse {
  suggestions: SearchSuggestion[];
}

export interface SavedSearch {
  id: string;
  name: string;
  criteria: QuoteSearchFilters; // API uses "criteria" not "filters"
  created_at: string;
}

export interface SavedSearchesResponse {
  saved_searches: SavedSearch[];
}

export interface CreateSavedSearchDto {
  name: string;
  criteria: QuoteSearchFilters; // API uses "criteria" not "filters"
}

// Tag Types
export interface QuoteTag {
  id: string;
  name: string;
  color: string; // Hex format: #RRGGBB
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteTagDto {
  name: string;
  color: string; // Hex format: #RRGGBB
}

export interface UpdateQuoteTagDto {
  name?: string;
  color?: string;
  is_active?: boolean;
}

export interface AssignTagsDto {
  tag_ids: string[]; // Replaces ALL tags on quote
}

// ========== CHANGE ORDER TYPES (Sprint 6) ==========
// Source: api/documentation/change_order_REST_API.md
// All types match backend DTOs exactly - NO guessing

/**
 * Jobsite Address DTO (nested in CreateChangeOrderDto)
 * Source: api/src/modules/quotes/dto/quote/jobsite-address.dto.ts
 */
export interface JobsiteAddressDto {
  address_line1: string; // Required, 1-255 chars
  address_line2?: string; // Optional, 1-255 chars
  city?: string; // Optional, 1-100 chars
  state?: string; // Optional, exactly 2 chars
  zip_code: string; // Required, regex: /^\d{5}(-\d{4})?$/
  latitude?: number; // Optional
  longitude?: number; // Optional
}

/**
 * Create Change Order DTO - Request body for POST /quotes/:parentQuoteId/change-orders
 * Source: api/src/modules/quotes/dto/change-order/create-change-order.dto.ts
 * Total fields: 8 (1 required, 7 optional)
 */
export interface CreateChangeOrderDto {
  title: string; // Required
  description?: string; // Optional
  jobsite_address?: JobsiteAddressDto; // Optional - override parent quote address
  vendor_id?: string; // Optional UUID - override parent quote vendor
  expiration_days?: number; // Optional 1-365, defaults to 30
  custom_profit_percent?: number; // Optional 0-100
  custom_overhead_percent?: number; // Optional 0-100
  custom_contingency_percent?: number; // Optional 0-100
}

/**
 * Change Order Response DTO - Response from create/approve/reject endpoints
 * Source: api/src/modules/quotes/dto/change-order/change-order-response.dto.ts
 * Total fields: 14 (13 always present, approved_at conditional)
 */
export interface ChangeOrderResponseDto {
  id: string; // Change order UUID
  quote_number: string; // CO-YYYY-#### format
  title: string;
  status: QuoteStatus; // Uses same 14-value enum as regular quotes
  parent_quote_id: string; // Parent quote UUID
  parent_quote_number: string; // Parent quote number (QR-YYYY-####)
  parent_original_total: number; // Parent quote total (float)
  subtotal: number; // CO subtotal (float)
  tax_amount: number; // CO tax (float)
  discount_amount: number; // CO discount (float)
  total: number; // CO total (float)
  created_at: string; // ISO 8601
  updated_at: string; // ISO 8601
  approved_at?: string; // ISO 8601, only present when status === 'approved'
}

/**
 * Change Order Summary DTO - Lightweight version for lists
 * Source: api/src/modules/quotes/dto/change-order/change-order-summary.dto.ts
 * Used in ListChangeOrdersResponseDto and ParentQuoteTotalsDto arrays
 * Total fields: 7 (6 always present, approved_at conditional)
 */
export interface ChangeOrderSummaryDto {
  id: string;
  quote_number: string; // CO-YYYY-#### format
  title: string;
  status: QuoteStatus; // Same 14 values as ChangeOrderResponseDto
  total: number; // Float
  created_at: string; // ISO 8601
  approved_at?: string; // ISO 8601, only when status === 'approved'
}

/**
 * Parent Quote Totals DTO - Response from GET /quotes/:quoteId/with-change-orders
 * Source: api/src/modules/quotes/dto/change-order/parent-quote-totals.dto.ts
 * Total fields: 9 (all always present)
 */
export interface ParentQuoteTotalsDto {
  parent_quote_id: string;
  parent_quote_number: string;
  original_total: number; // Parent quote total before any COs (float)
  approved_change_orders_total: number; // Sum of approved CO totals (float)
  pending_change_orders_total: number; // Sum of pending CO totals (float)
  revised_total: number; // original_total + approved_change_orders_total (float)
  approved_co_count: number; // Count of approved COs (integer)
  pending_co_count: number; // Count of pending COs (integer)
  change_orders: ChangeOrderSummaryDto[]; // ALL COs (approved, pending, AND rejected)
}

/**
 * List Change Orders Response DTO - Response from GET /quotes/:parentQuoteId/change-orders
 * Source: api/src/modules/quotes/dto/change-order/list-change-orders-response.dto.ts
 * Total fields: 4 top-level (with nested summary object)
 */
export interface ListChangeOrdersResponseDto {
  parent_quote_id: string;
  parent_quote_number: string;
  change_orders: ChangeOrderSummaryDto[]; // Sorted by created_at descending
  summary: {
    total_count: number; // All change orders
    approved_count: number; // status === 'approved'
    pending_count: number; // draft, pending_approval, ready, sent, delivered, read, opened, downloaded
    rejected_count: number; // status === 'denied'
  };
}

/**
 * Approve Change Order DTO - Request body for POST /change-orders/:id/approve
 * Source: api/src/modules/quotes/dto/change-order/approve-change-order.dto.ts
 * Total fields: 1 (optional) - empty {} is valid
 */
export interface ApproveChangeOrderDto {
  notes?: string; // Optional approval notes (stored in audit log and version)
}

/**
 * Reject Change Order DTO - Request body for POST /change-orders/:id/reject
 * Source: api/src/modules/quotes/dto/change-order/reject-change-order.dto.ts
 * Total fields: 1 (required)
 */
export interface RejectChangeOrderDto {
  reason: string; // Required, min 10 characters
}

/**
 * Change Order History Event - Timeline event object
 * Source: api/documentation/change_order_REST_API.md (Endpoint 7 inline schema)
 */
export interface ChangeOrderHistoryEvent {
  id: string; // Change order UUID
  event_type: 'change_order_created' | 'change_order_approved' | 'change_order_rejected';
  change_order_number: string; // CO-YYYY-####
  description: string; // CO title
  amount: number; // CO total (float)
  timestamp: string; // ISO 8601 (from created_at)
  status: QuoteStatus; // Current CO status
}

/**
 * Change Order History Response - Response from GET /quotes/:parentQuoteId/change-orders/history
 * Source: api/documentation/change_order_REST_API.md (Endpoint 7)
 */
export interface ChangeOrderHistoryResponse {
  timeline: ChangeOrderHistoryEvent[]; // Sorted by timestamp ascending (oldest first)
  parent_quote_id: string;
  parent_quote_number: string;
  total_events: number;
}
