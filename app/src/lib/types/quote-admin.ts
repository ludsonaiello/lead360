/**
 * Quote Admin TypeScript Type Definitions
 * Types for platform admin quote management across all tenants
 * Source: /var/www/lead360.app/api/documentation/quote_admin_REST_API.md
 */

// ==========================================
// PAGINATION & COMMON TYPES
// ==========================================

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

export interface DateRangeParams {
  date_from?: string; // ISO 8601
  date_to?: string; // ISO 8601
}

// ==========================================
// DASHBOARD ANALYTICS TYPES
// ==========================================

export interface DashboardOverviewResponse {
  global_stats: {
    total_tenants: number;
    active_tenants: number;
    total_quotes: number;
    total_revenue: number;
    avg_quote_value: number;
    conversion_rate: number;
  };
  tenant_breakdown: {
    top_tenants_by_revenue: TopTenant[];
    top_tenants_by_quote_count: TopTenant[];
    new_tenants_this_period: number;
  };
  trends: {
    quote_velocity: string; // e.g., "+15.2%"
    avg_value_change: string;
    conversion_rate_change: string;
  };
  date_from: string;
  date_to: string;
}

export interface TopTenant {
  tenant_id: string;
  company_name: string;
  revenue: number;
  quote_count: number;
}

export interface QuoteTrendsResponse {
  interval: 'day' | 'week' | 'month';
  data_points: TrendDataPoint[];
  summary: {
    total_quotes: number;
    total_revenue: number;
    avg_per_interval: number; // Backend returns avg_per_interval, not avg_quote_value
  };
  date_from: string;
  date_to: string;
}

export interface TrendDataPoint {
  date: string; // Backend returns 'date', not 'period'
  count: number; // Backend returns 'count', not 'quote_count'
  revenue: number;
}

export interface ConversionFunnelResponse {
  funnel_stages: FunnelStage[];
  conversion_rates: {
    sent_to_viewed: number;
    viewed_to_accepted: number;
    overall: number;
  };
  date_from: string;
  date_to: string;
}

export interface FunnelStage {
  stage: string;
  count: number;
  percentage: number;
}

export interface DropOffAnalysis {
  from_stage: string;
  to_stage: string;
  drop_off_count: number;
  drop_off_percentage: number;
}

export interface SystemHealthResponse {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: ServiceHealth & {
      connection_pool: {
        active: number;
        idle: number;
        total: number;
      };
    };
    cache: ServiceHealth & {
      hit_rate: number;
      memory_used_mb: number;
    };
    storage: ServiceHealth & {
      disk_used_gb: number;
      disk_total_gb: number;
      disk_usage_percentage: number;
    };
    pdf_service: ServiceHealth & {
      queue_length: number;
    };
    email_service: ServiceHealth & {
      queue_length: number;
      failed_last_hour: number;
    };
  };
  quotes_module: {
    active_sessions: number;
    quotes_created_last_hour: number;
    pdfs_generated_last_hour: number;
    errors_last_hour: number;
  };
}

export interface ServiceHealth {
  status: 'healthy' | 'degraded' | 'down';
  response_time_ms: number;
}

export interface RevenueAnalyticsResponse {
  total_revenue: number;
  revenue_by_group: RevenueGroup[];
  top_revenue_sources: RevenueGroup[];
  revenue_trend: RevenueTrendPoint[];
  date_from: string;
  date_to: string;
}

export interface RevenueGroup {
  group_id: string;
  group_name: string;
  revenue: number;
  quote_count: number;
}

export interface RevenueTrendPoint {
  date: string;
  revenue: number;
}

export interface GlobalItemPricingResponse {
  benchmarks: PricingBenchmark[];
  privacy_notice: string;
  date_from?: string;
  date_to?: string;
  min_tenant_count: number;
  total_count: number;
  returned_count: number;
}

export interface PricingBenchmark {
  task_title: string;
  tenant_count: number;
  usage_count: number;
  pricing: {
    avg_price: number;
    min_price: number;
    max_price: number;
    median_price: number;
    std_deviation: number;
  };
  price_variance: 'low' | 'medium' | 'high';
}

// ==========================================
// TENANT MANAGEMENT TYPES
// ==========================================

export interface TenantListParams {
  status?: 'active' | 'trial' | 'suspended' | 'all';
  search?: string;
  sort_by?: 'quote_count' | 'revenue' | 'name';
  page?: number;
  limit?: number;
}

export interface TenantListResponse {
  tenants: TenantWithQuoteStats[];
  pagination: PaginationMeta;
  summary: {
    total_tenants: number;
    active_tenants: number;
  };
}

export interface TenantWithQuoteStats {
  tenant_id: string;
  company_name: string;
  subdomain: string;
  subscription_status: string;
  quote_stats: {
    total_quotes: number;
    quotes_last_30_days: number;
    total_revenue: number;
    conversion_rate: number;
  };
  created_at: string;
}

export interface TenantComparisonParams {
  metric: 'revenue' | 'quote_count' | 'conversion_rate' | 'avg_quote_value';
  limit?: number;
  date_from?: string;
  date_to?: string;
}

export interface TenantComparisonResponse {
  metric: string;
  rankings: RankedTenant[]; // Backend returns 'rankings', not 'comparison'
  date_range: {
    from: string;
    to: string;
  };
  summary: {
    total_tenants: number;
    metric_average: number;
    metric_median: number;
  };
}

export interface RankedTenant {
  rank: number;
  tenant_id: string;
  tenant_name: string; // Backend returns 'tenant_name', not 'company_name'
  value: number; // Backend returns 'value', not 'metric_value'
  supplementary: {
    quote_count: number;
    conversion_rate: number;
    avg_quote_value: number;
  };
}

export interface TenantStatsResponse {
  tenant_id: string;
  tenant_name: string; // Backend returns 'tenant_name', not 'company_name'
  period: {
    from: string;
    to: string;
  };
  statistics: {
    total_quotes: number;
    quotes_by_status: Record<string, number>;
    revenue: {
      total: number;
      average_per_quote: number; // Backend returns 'average_per_quote'
    };
    conversion_rate: number; // At statistics level, not nested
    avg_quote_value: number; // At statistics level, not in revenue object
    top_items: Array<{
      title: string;
      usage_count: number;
      avg_price: number;
    }>;
  };
  trends: {
    quote_volume_change: string;
    revenue_change: string;
  };
}

export interface TenantActivityResponse {
  tenant_id: string;
  company_name: string;
  activities: QuoteActivity[];
  date_from: string;
  date_to: string;
}

export interface QuoteActivity {
  quote_id: string;
  quote_number: string;
  event_type: string;
  event_description: string;
  event_timestamp: string;
  user?: {
    id: string;
    name: string;
  };
}

export interface TenantSettingsResponse {
  tenant_id: string;
  settings: {
    default_currency: string;
    default_markup: number;
    auto_send_enabled: boolean;
    approval_required: boolean;
    pdf_header_logo_url: string | null;
    pdf_footer_text: string | null;
  };
}

export interface UpdateTenantSettingsDto {
  default_currency?: string;
  default_markup?: number;
  auto_send_enabled?: boolean;
  approval_required?: boolean;
  pdf_header_logo_url?: string;
  pdf_footer_text?: string;
}

export interface MigrateTemplateDto {
  from_template_id: string;
  to_template_id: string;
  migrate_drafts: boolean;
}

export interface MigrateTemplateResponse {
  tenant_id: string;
  company_name: string;
  quotes_migrated: number;
  migration_summary: {
    success_count: number;
    failed_count: number;
    skipped_count: number;
  };
}

// ==========================================
// QUOTE MANAGEMENT TYPES (OPERATIONAL)
// ==========================================

export interface AdminQuoteSearchParams {
  tenant_id?: string;
  quote_number?: string;
  customer_name?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface AdminQuoteListResponse {
  quotes: AdminQuote[];
  pagination: PaginationMeta;
  total_value: number;
}

export interface AdminQuote {
  id: string;
  quote_number: string;
  tenant_id: string;
  tenant: {
    id: string;
    company_name: string;
    subdomain: string;
  };
  customer_name: string;
  status: string;
  total_price: number;
  created_at: string;
  updated_at: string;
}

export interface AdminQuoteDetailResponse {
  quote: AdminQuote & {
    items: QuoteItem[];
    customer: {
      id: string;
      name: string;
      email: string | null;
      phone: string | null;
    };
    created_by: {
      id: string;
      name: string;
    };
  };
}

export interface QuoteItem {
  id: string;
  title: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface BulkStatusUpdateDto {
  quote_ids: string[];
  new_status: string;
  reason?: string;
}

export interface BulkStatusUpdateResponse {
  updated_count: number;
  failed_count: number;
  results: Array<{
    quote_id: string;
    success: boolean;
    error?: string;
  }>;
}

export interface QuoteDiagnosticsResponse {
  quote_id: string;
  diagnostics: {
    schema_validation: {
      is_valid: boolean;
      errors: string[];
    };
    pricing_validation: {
      is_valid: boolean;
      calculated_total: number;
      stored_total: number;
      discrepancy: number;
    };
    references_validation: {
      customer_exists: boolean;
      vendor_exists: boolean;
      all_items_exist: boolean;
      missing_references: string[];
    };
    pdf_generation: {
      can_generate: boolean;
      last_generated_at: string | null;
      errors: string[];
    };
  };
}

export interface RecalculateQuoteResponse {
  quote_id: string;
  old_total: number;
  new_total: number;
  difference: number;
  recalculated_at: string;
}

export interface BulkExportParams {
  tenant_id?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  format: 'csv' | 'xlsx';
}

export interface BulkExportResponse {
  export_id: string;
  status: 'processing' | 'completed' | 'failed';
  download_url: string | null;
  expires_at: string | null;
}

export interface OrphanedQuotesResponse {
  orphaned_quotes: Array<{
    quote_id: string;
    quote_number: string;
    tenant_id: string;
    issue: string;
    detected_at: string;
  }>;
  total_count: number;
}

// ==========================================
// TEMPLATE MANAGEMENT TYPES
// ==========================================

export interface TemplateListParams {
  is_active?: boolean; // Filter by active status (backend uses is_active, not status)
  search?: string;
  page?: number;
  limit?: number;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'archived';
  content: any; // JSON template content
  assigned_tenant_count: number;
  usage_count: number;
  created_at: string;
  updated_at: string;
  created_by: {
    id: string;
    name: string;
  };
}

export interface CreateTemplateDto {
  name: string;
  description?: string;
  content: any;
  status?: 'active' | 'archived';
}

export interface UpdateTemplateDto {
  name?: string;
  description?: string;
  content?: any;
  status?: 'active' | 'archived';
}

export interface CloneTemplateDto {
  new_name: string;
  new_description?: string;
}

export interface AssignTenantsDto {
  tenant_ids: string[];
}

export interface AssignTenantsResponse {
  template_id: string;
  assigned_tenant_count: number;
  newly_assigned: number;
  already_assigned: number;
}

export interface TemplateVersion {
  version_number: number;
  template_id: string;
  content: any;
  changed_by: {
    id: string;
    name: string;
  };
  changed_at: string;
  change_summary: string | null;
}

export interface PreviewTemplateDto {
  sample_data: any;
}

export interface PreviewTemplateResponse {
  preview_html: string;
  preview_url: string | null;
}

export interface TestPdfDto {
  sample_data: any;
}

export interface TestPdfResponse {
  pdf_url: string;
  generated_at: string;
  expires_at: string;
}

export interface TestEmailDto {
  recipient_email: string;
  sample_data: any;
}

export interface TestEmailResponse {
  sent: boolean;
  recipient_email: string;
  sent_at: string;
  message_id: string;
}

export interface ValidateTemplateDto {
  content: any;
}

export interface ValidateTemplateResponse {
  is_valid: boolean;
  errors: Array<{
    field: string;
    message: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
  }>;
}

// ==========================================
// REPORTS & EXPORTS TYPES
// ==========================================

export interface GenerateReportDto {
  report_type: 'tenant_performance' | 'revenue_analysis' | 'conversion_analysis'; // Backend only supports these 3 types
  date_from: string;
  date_to: string;
  format: 'csv' | 'xlsx' | 'pdf';
  filters?: {
    tenant_ids?: string[];
    status?: string[];
    template_ids?: string[];
  };
}

export interface ReportJob {
  job_id: string; // Backend uses job_id, not id
  report_type?: string; // Optional in initial response
  status: 'queued' | 'processing' | 'completed' | 'failed'; // Backend uses 'queued' not 'pending'
  progress?: number; // 0-100, optional
  download_url?: string | null; // Optional, only present when completed
  error_message?: string | null; // Optional, only present when failed
  format?: string; // Export format (csv, xlsx, pdf)
  created_at?: string; // Optional in initial response
  completed_at?: string | null; // Optional
  expires_at?: string | null; // Optional
  estimated_completion?: string; // Only in initial response
  row_count?: number; // Optional, only when completed
}

export interface ReportListResponse {
  reports: ReportJob[];
  pagination: PaginationMeta;
}

export interface CreateScheduledReportDto {
  name: string;
  report_type: 'tenant_performance' | 'revenue_analysis' | 'conversion_analysis'; // Backend only supports these 3 types
  schedule: 'daily' | 'weekly' | 'monthly'; // Backend uses 'schedule', not 'frequency'
  format: 'csv' | 'xlsx' | 'pdf';
  recipients: string[]; // Email addresses
  parameters?: {
    // Backend uses 'parameters', not 'filters'
    date_from?: string;
    date_to?: string;
    tenant_ids?: string[];
    group_by?: string;
  };
  is_active?: boolean;
}

export interface ScheduledReport {
  id: string;
  admin_user_id: string;
  name: string;
  report_type: string;
  schedule: 'daily' | 'weekly' | 'monthly'; // Backend uses 'schedule', not 'frequency'
  parameters: Record<string, any>; // Backend uses 'parameters', not 'filters'
  format: 'csv' | 'xlsx' | 'pdf';
  recipients: string[];
  is_active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
  admin_user: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface ScheduledReportListResponse {
  reports: ScheduledReport[]; // Backend returns 'reports', not 'schedules'
  total: number; // Backend returns 'total', not 'pagination' (not paginated)
}

// ==========================================
// QUOTE NOTES TYPES
// ==========================================

export interface QuoteNote {
  id: string;
  quote_id: string;
  note_text: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
  created_by: {
    id: string;
    name: string;
  };
}

export interface CreateQuoteNoteDto {
  note_text: string;
  is_pinned?: boolean;
}

export interface UpdateQuoteNoteDto {
  note_text?: string;
  is_pinned?: boolean;
}

// ==========================================
// TEMPLATE BUILDER SYSTEM TYPES (Comprehensive)
// Source: /var/www/lead360.app/api/documentation/quote_template_builder_REST_API.md
// ==========================================

/**
 * Template Types - Visual or Code-based templates
 */
export type TemplateType = 'visual' | 'code';

/**
 * Component Types for Visual Templates
 */
export type ComponentType =
  | 'header'
  | 'footer'
  | 'customer_info'
  | 'line_items'
  | 'totals'
  | 'terms'
  | 'signature'
  | 'payment_schedule'
  | 'warranty'
  | 'custom';

/**
 * Component Categories
 */
export type ComponentCategory = 'layout' | 'content' | 'pricing' | 'branding' | 'custom';

/**
 * Template Categories
 */
export interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
  icon_name?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Visual Template Structure (JSON)
 */
export interface VisualTemplateStructure {
  version: string;
  layout: {
    pageSize: 'letter' | 'a4' | 'legal';
    orientation: 'portrait' | 'landscape';
    margins: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };
    header: {
      enabled: boolean;
      height?: number;
      components: ComponentInstance[];
    };
    body: {
      components: ComponentInstance[];
    };
    footer: {
      enabled: boolean;
      height?: number;
      components: ComponentInstance[];
    };
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
    fontFamily: string;
    fontSize: number;
    lineHeight: number;
  };
}

/**
 * Component Instance in Visual Template
 */
export interface ComponentInstance {
  id: string;
  component_id: string;
  component_type: ComponentType;
  section: 'header' | 'body' | 'footer';
  position: {
    x: number;
    y: number;
    width: number | 'auto';
    height: number | 'auto';
  };
  props: Record<string, any>;
  style?: Record<string, any>;
  data_bindings?: Record<string, string>;
  conditions?: {
    show_if?: string;
    hide_if?: string;
  };
}

/**
 * Complete Template Response (Builder API)
 */
export interface BuilderTemplate {
  id: string;
  tenant_id: string | null;
  name: string;
  description?: string;
  template_type: TemplateType;
  visual_structure?: VisualTemplateStructure;
  html_content?: string;
  css_content?: string;
  category_id?: string;
  category?: TemplateCategory;
  tags?: string[];
  thumbnail_url?: string;
  is_prebuilt: boolean;
  source_template_id?: string;
  source_template?: {
    id: string;
    name: string;
    template_type: TemplateType;
  };
  is_global: boolean;
  is_active: boolean;
  is_default: boolean;
  created_by_user_id?: string;
  created_by_user?: {
    id: string;
    email: string;
    name?: string;
  };
  created_at: string;
  updated_at: string;
}

/**
 * Template List Params (Builder API)
 */
export interface BuilderTemplateListParams {
  is_active?: boolean;
  is_global?: boolean;
  tenant_id?: string;
  template_type?: TemplateType;
  category_id?: string;
  tags?: string[];
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Create Visual Template DTO
 */
export interface CreateVisualTemplateDto {
  name: string;
  description?: string;
  category_id?: string;
  tags?: string[];
  layout_preset?: 'blank' | 'standard' | 'modern' | 'minimal';
  is_global?: boolean;
  theme?: {
    primaryColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
    fontSize?: number;
    lineHeight?: number;
  };
}

/**
 * Create Code Template DTO
 */
export interface CreateCodeTemplateDto {
  name: string;
  description?: string;
  category_id?: string;
  tags?: string[];
  html_content: string;
  css_content?: string;
  is_global?: boolean;
}

/**
 * Update Template DTO (Builder API)
 */
export interface UpdateBuilderTemplateDto {
  name?: string;
  description?: string;
  html_content?: string;
  thumbnail_url?: string;
  is_global?: boolean;
  is_default?: boolean;
  is_active?: boolean;
}

/**
 * Clone Template DTO (Builder API)
 */
export interface CloneBuilderTemplateDto {
  new_name: string;
}

/**
 * Add Component to Visual Template DTO
 */
export interface AddComponentDto {
  component_id?: string;
  component_type: ComponentType;
  section?: 'header' | 'body' | 'footer';
  position: {
    x: number;
    y: number;
    width: number | 'auto';
    height: number | 'auto';
  };
  props?: Record<string, any>;
  style?: Record<string, any>;
  data_bindings?: Record<string, string>;
  conditions?: {
    show_if?: string;
    hide_if?: string;
  };
}

/**
 * Update Component in Visual Template DTO
 */
export interface UpdateComponentDto {
  position?: {
    x?: number;
    y?: number;
    width?: number | 'auto';
    height?: number | 'auto';
  };
  props?: Record<string, any>;
  style?: Record<string, any>;
  data_bindings?: Record<string, string>;
  conditions?: {
    show_if?: string;
    hide_if?: string;
  };
}

/**
 * Reorder Components DTO
 */
export interface ReorderComponentsDto {
  section: 'header' | 'body' | 'footer';
  component_ids: string[];
}

/**
 * Apply Theme DTO
 */
export interface ApplyThemeDto {
  primaryColor?: string;
  secondaryColor?: string;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
}

/**
 * Update Code Template DTO
 */
export interface UpdateCodeTemplateDto {
  html_content?: string;
  css_content?: string;
}

/**
 * Preview Template DTO (Builder API)
 */
export interface PreviewBuilderTemplateDto {
  preview_type: 'minimal' | 'standard' | 'complex';
  use_real_quote: boolean;
  quote_id?: string;
}

/**
 * Preview Template Response (Builder API)
 */
export interface PreviewBuilderTemplateResponse {
  rendered_html: string;
  rendered_css: string;
  preview_url: string;
  expires_at: string;
}

/**
 * Test PDF DTO (Builder API)
 */
export interface TestBuilderPdfDto {
  preview_type: 'minimal' | 'standard' | 'complex';
  use_real_quote: boolean;
  quote_id?: string;
}

/**
 * Test PDF Response (Builder API)
 */
export interface TestBuilderPdfResponse {
  pdf_url: string;
  file_size_bytes: number;
  generation_time_ms: number;
  expires_at: string;
  warnings?: string[];
}

/**
 * Test Email DTO (Builder API)
 */
export interface TestBuilderEmailDto {
  recipient_email: string;
  preview_type: 'minimal' | 'standard' | 'complex';
  use_real_quote: boolean;
  quote_id?: string;
}

/**
 * Test Email Response (Builder API)
 */
export interface TestBuilderEmailResponse {
  html_preview: string;
  text_preview: string;
  subject_line: string;
  test_email_sent: boolean;
  email_job_id?: string;
}

/**
 * Validate Template Response (Builder API)
 */
export interface ValidateBuilderTemplateResponse {
  valid: boolean;
  errors: string[];
  warnings: string[];
  variables: string[];
  security_scan: {
    passed: boolean;
    issues: string[];
  };
}

/**
 * Validate Handlebars DTO
 */
export interface ValidateHandlebarsDto {
  html_content: string;
  css_content?: string;
}

/**
 * Template Variable Schema
 * API returns variables directly at root level, not wrapped in "variables" property
 */
export interface TemplateVariableSchema {
  // Variables are at root level - each category contains field definitions
  quote?: Record<string, any>;
  customer?: Record<string, any>;
  vendor?: Record<string, any>;
  jobsite?: Record<string, any>;
  items?: {
    _description: string;
    _example: any[];
  };
  groups?: {
    _description: string;
    _example: any[];
  };
  totals?: Record<string, any>;
  terms?: Record<string, any>;
  attachments?: {
    _description: string;
    _example: any[];
  };
  draw_schedule?: {
    _description: string;
    _example: any[];
  };
  helpers?: Array<{
    name: string;
    usage: string;
    description: string;
  }>;
  [key: string]: any; // Allow for additional dynamic fields
}

/**
 * Template Version (Builder API)
 */
export interface BuilderTemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  template_type: TemplateType;
  visual_structure?: VisualTemplateStructure;
  html_content?: string;
  css_content?: string;
  changes_summary?: string;
  render_time_ms?: number;
  pdf_size_kb?: number;
  created_by_user_id?: string;
  created_by_user?: {
    id: string;
    email: string;
    name?: string;
  };
  created_at: string;
}

/**
 * Restore Template Version DTO
 */
export interface RestoreTemplateVersionDto {
  version: number;
  create_backup?: boolean;
}

/**
 * Component in Library
 */
export interface TemplateComponent {
  id: string;
  tenant_id?: string;
  name: string;
  component_type: ComponentType;
  category: ComponentCategory;
  description?: string;
  structure: Record<string, any>;
  default_props?: Record<string, any>;
  html_template: string;
  css_template?: string;
  thumbnail_url?: string;
  preview_html?: string;
  usage_notes?: string;
  tags?: string[];
  is_active: boolean;
  is_global: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Component List Params
 */
export interface ComponentListParams {
  component_type?: ComponentType;
  category?: ComponentCategory;
  tags?: string[];
  is_global?: boolean;
  tenant_id?: string;
  is_active?: boolean;
  page?: number;
  limit?: number;
}

/**
 * Create Component DTO
 */
export interface CreateComponentDto {
  name: string;
  component_type: ComponentType;
  category: ComponentCategory;
  description?: string;
  structure: Record<string, any>;
  default_props?: Record<string, any>;
  html_template: string;
  css_template?: string;
  thumbnail_url?: string;
  usage_notes?: string;
  tags?: string[];
  is_global?: boolean;
}

/**
 * Update Component DTO
 */
export interface UpdateComponentDto {
  name?: string;
  description?: string;
  default_props?: Record<string, any>;
  html_template?: string;
  css_template?: string;
  is_active?: boolean;
}

/**
 * Preview Component DTO
 */
export interface PreviewComponentDto {
  props: Record<string, any>;
  sample_data?: Record<string, any>;
}

/**
 * Preview Component Response
 */
export interface PreviewComponentResponse {
  rendered_html: string;
  props: Record<string, any>;
}

/**
 * Export Visual Template to Code Response
 */
export interface ExportCodeResponse {
  template_id: string;
  template_name: string;
  html: string;
  css: string;
  compiled_at: string;
}

/**
 * Pre-built Templates List Params
 */
export interface PrebuiltTemplateListParams {
  category_id?: string;
  tags?: string[];
  template_type?: TemplateType;
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Clone Pre-built Template DTO
 */
export interface ClonePrebuiltTemplateDto {
  name?: string;
  description?: string;
}

/**
 * Run Template Migration DTO
 */
export interface RunMigrationDto {
  template_ids?: string[];
  create_backup?: boolean;
}

/**
 * Template Migration Response
 */
export interface MigrationResponse {
  total: number;
  migrated: number;
  failed: number;
  skipped: number;
  results: Array<{
    template_id: string;
    template_name: string;
    status: 'success' | 'failed' | 'skipped';
    message: string;
  }>;
  started_at: string;
  completed_at: string;
}

/**
 * Migration Statistics Response
 */
export interface MigrationStatsResponse {
  total_templates: number;
  migrated_templates: number;
  pending_migration: number;
  migration_percentage: number;
  templates_by_type: {
    visual: number;
    code: number;
  };
  migration_errors: number;
  last_migration_at?: string;
}

/**
 * Set Active Template DTO (Tenant)
 */
export interface SetActiveTemplateDto {
  template_id: string;
}

/**
 * Set Active Template Response (Tenant)
 */
export interface SetActiveTemplateResponse {
  success: boolean;
  message: string;
  template_id: string;
  tenant_id: string;
  updated_at: string;
}
