/**
 * Admin Panel TypeScript Types
 * Based on actual API responses from http://localhost:8000/api/v1/admin/*
 *
 * NOTE: Some types may differ from documentation - these are based on ACTUAL responses
 */

// ============================================================================
// Dashboard Types
// ============================================================================

export interface MetricGrowth {
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface TenantMetric {
  count: number;
  growth: MetricGrowth;
  sparkline: number[];
}

export interface UserMetric {
  count: number;
  growth: MetricGrowth;
  sparkline: number[];
}

export interface JobSuccessMetric {
  percentage: number;
  totalJobs: number;
  failedJobs: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface StorageMetric {
  current: number;       // GB used
  limit: number;         // Total GB limit
  percentage: number;    // Percentage used (0-100)
}

export interface SystemHealthChecks {
  database: boolean;
  redis: boolean;
}

export interface SystemHealthMetric {
  status: 'healthy' | 'unhealthy';
  checks: SystemHealthChecks;
}

export interface DashboardMetrics {
  activeTenants: TenantMetric;
  totalUsers: UserMetric;
  jobSuccessRate: JobSuccessMetric;
  storageUsed: StorageMetric;
  systemHealth: SystemHealthMetric;
}

// Chart data types
export interface TimeSeriesDataPoint {
  date: string;
  count: number;
  cumulative: number;
}

export interface JobTrendsDataPoint {
  date: string;
  success: number;
  failed: number;
  successRate: number;
}

export interface DistributionDataPoint {
  category: string;
  count: number;
  percentage: number;
}

export type ChartType =
  | 'tenant-growth'
  | 'user-signups'
  | 'job-trends'
  | 'tenants-by-industry'
  | 'tenants-by-size'
  | 'users-by-role';

export type ChartData =
  | TimeSeriesDataPoint[]
  | JobTrendsDataPoint[]
  | DistributionDataPoint[];

// Activity feed types
export interface ActivityActor {
  id: string;
  name: string;
  email: string;
}

export interface ActivityItem {
  id: string;
  action: 'created' | 'updated' | 'deleted' | 'failed';
  entity: string;
  entityId: string;
  description: string;
  actor: ActivityActor | null;
  timestamp: string;
  status: 'success' | 'failure';
}

// ============================================================================
// Industry Types
// ============================================================================

export interface Industry {
  id: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type BusinessSize = '1-5' | '6-10' | '11-25' | '26-50' | '51-100' | '101-250' | '251+';

export const BUSINESS_SIZE_OPTIONS: Array<{ label: string; value: BusinessSize }> = [
  { label: '1-5 employees', value: '1-5' },
  { label: '6-10 employees', value: '6-10' },
  { label: '11-25 employees', value: '11-25' },
  { label: '26-50 employees', value: '26-50' },
  { label: '51-100 employees', value: '51-100' },
  { label: '101-250 employees', value: '101-250' },
  { label: '251+ employees', value: '251+' },
];

// ============================================================================
// Tenant Management Types
// ============================================================================

export interface Tenant {
  id: string;
  subdomain: string;
  company_name: string;
  legal_business_name?: string;
  business_name?: string;
  industry_id?: string | null; // Deprecated - kept for backward compatibility
  business_size?: BusinessSize | null;
  industry?: Industry | null; // Deprecated - kept for backward compatibility
  industries?: Industry[]; // NEW: Many-to-many relationship
  primary_contact_email: string;
  owner_email?: string;
  owner_name?: string;
  is_active: boolean;
  status?: 'active' | 'suspended' | 'pending';
  subscription_status?: 'active' | 'trial' | 'cancelled' | 'expired' | 'past_due';
  deleted_at: string | null;
  user_count: number;
  created_at: string;
  updated_at?: string;
  _count?: {
    users: number;
    jobs: number;
  };
}

export interface TenantListResponse {
  tenants: Tenant[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface TenantDetail extends Tenant {
  owner_phone: string | null;
  storage_used: number;
  storage_limit: number;
  settings: Record<string, any>;
  users?: TenantUser[];
  // Subscription fields
  subscription_plan_id?: string | null;
  subscription_plan?: SubscriptionPlan | null;
  trial_end_date?: string | null;
  next_billing_date?: string | null;
  billing_cycle?: string | null;
}

export interface TenantUser {
  id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
  last_login: string | null;
  created_at: string;
}

export interface CreateTenantDto {
  business_name: string;
  subdomain: string;
  industry_id?: string; // Deprecated - use industry_ids instead
  industry_ids?: string[]; // NEW: Many-to-many relationship
  business_size?: BusinessSize;
  business_entity_type?: string;
  state_of_registration?: string;
  ein?: string;
  subscription_plan_id?: string; // Subscription plan selection
  subscription_status?: 'trial' | 'active' | 'cancelled' | 'past_due' | 'expired';
  trial_end_date?: string; // ISO date string for trial end (YYYY-MM-DD)
  billing_cycle?: BillingCycle; // 'monthly' | 'annual' (for active subscriptions)
  next_billing_date?: string; // ISO date string (YYYY-MM-DD) (for active subscriptions)
  owner_first_name: string;
  owner_last_name: string;
  owner_email: string;
  owner_phone?: string;
  owner_password: string;
  skip_email_verification?: boolean;
}

export interface UpdateTenantDto {
  business_name?: string;
  industry_id?: string; // Deprecated - use industry_ids instead
  industry_ids?: string[]; // NEW: Many-to-many relationship
  business_size?: BusinessSize;
  status?: 'active' | 'suspended';
  storage_limit?: number;
  settings?: Record<string, any>;
}

export interface SubdomainCheckResponse {
  available: boolean;
  subdomain: string;
  suggestion?: string;
}

// ============================================================================
// Impersonation Types
// ============================================================================

export interface ImpersonationSession {
  id: string;
  impersonation_token: string;
  tenant_id: string;
  user_id: string;
  admin_id: string;
  admin_email: string;
  started_at: string;
  expires_at: string;
}

export interface StartImpersonationDto {
  tenant_id: string;
  user_id: string;
}

// ============================================================================
// User Management Types
// ============================================================================

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  tenant_id: string | null;
  tenant_name: string | null;
  is_active: boolean;
  is_platform_admin: boolean;
  last_login: string | null;
  created_at: string;
}

export interface UserListResponse {
  users: AdminUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface UserFilters {
  role?: string;
  status?: 'active' | 'inactive';
  tenant_id?: string;
  last_login_from?: string;
  last_login_to?: string;
}

// ============================================================================
// System Settings Types
// ============================================================================

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  is_critical: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface MaintenanceModeConfig {
  enabled: boolean;
  mode: 'immediate' | 'scheduled';
  message: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  allowed_ips: string[];
  updated_by: string | null;
  updated_at: string;
}

export interface GlobalSetting {
  id: string;
  category: string;
  key: string;
  value: string;
  data_type: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  updated_by: string | null;
  updated_at: string;
}

export interface GlobalSettingsResponse {
  settings: GlobalSetting[];
  grouped: Record<string, GlobalSetting[]>;
}

export interface UpdateGlobalSettingsDto {
  settings: Array<{
    id: string;
    value: string;
  }>;
}

// ============================================================================
// Alerts & Notifications Types
// ============================================================================

export interface Alert {
  id: string;
  type: 'new_tenant' | 'storage_warning' | 'job_spike' | 'system_downtime' | 'suspicious_activity';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface AlertsResponse {
  alerts: Alert[];
  unreadCount: number;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AlertFilters {
  unread_only?: boolean;
  type?: string;
  date_from?: string;
  date_to?: string;
}

// ============================================================================
// Data Export Types
// ============================================================================

export type ExportType = 'tenants' | 'users' | 'audit_logs';
export type ExportFormat = 'csv' | 'pdf';
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ExportJob {
  id: string;
  export_type: ExportType;
  format: ExportFormat;
  status: ExportStatus;
  filters: Record<string, any>;
  file_path: string | null;
  file_size: number | null;
  row_count: number | null;
  error_message: string | null;
  created_by: string;
  created_at: string;
  completed_at: string | null;
}

export interface ExportHistoryResponse {
  exports: ExportJob[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateExportDto {
  export_type: ExportType;
  format: ExportFormat;
  filters?: Record<string, any>;
}

export interface ExportEstimate {
  estimatedRows: number;
  estimatedSize: string;
  estimatedTime: string;
}

// ============================================================================
// API Response Wrappers
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  statusCode: number;
  errorCode: string;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId: string;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// ============================================================================
// Subscription Plan Types
// ============================================================================

export type BillingCycle = 'monthly' | 'annual';

export interface FeatureFlags {
  [key: string]: boolean | undefined;
  // Core modules (usually included)
  dashboard?: boolean;
  settings?: boolean;
  users?: boolean;
  subscription?: boolean;
  files?: boolean;

  // CRM Features
  leads?: boolean;
  tasks?: boolean;
  calendar?: boolean;
  timeclock?: boolean;

  // Financial Features
  quotes_module?: boolean;
  invoices_module?: boolean;
  payments?: boolean;
  expenses?: boolean;

  // Project Management
  projects?: boolean;

  // Advanced Features
  reports?: boolean;
  advanced_reporting?: boolean;
  inventory_module?: boolean;

  // API & Integrations
  api_access?: boolean;
  custom_integrations?: boolean;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  max_users: number | null; // null = unlimited
  max_storage_gb: number | null; // null = unlimited
  feature_flags: FeatureFlags; // JSON object with feature availability
  is_active: boolean;
  is_default: boolean; // Default plan for new signups
  offers_trial: boolean; // Whether this plan offers a free trial period
  trial_days: number | null; // Trial duration in days (only if offers_trial is true)
  created_at: string;
  updated_at: string;
}

export interface SubscriptionPlanListResponse {
  plans: SubscriptionPlan[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CreateSubscriptionPlanDto {
  name: string;
  description?: string;
  monthly_price: number;
  annual_price: number;
  max_users?: number | null;
  max_storage_gb?: number | null;
  feature_flags?: FeatureFlags;
  is_active?: boolean;
  is_default?: boolean;
  offers_trial?: boolean;
  trial_days?: number | null;
}

export interface UpdateSubscriptionPlanDto {
  name?: string;
  description?: string;
  monthly_price?: number;
  annual_price?: number;
  max_users?: number | null;
  max_storage_gb?: number | null;
  feature_flags?: FeatureFlags;
  is_active?: boolean;
  is_default?: boolean;
  offers_trial?: boolean;
  trial_days?: number | null;
}

// ============================================================================
// Tenant Subscription Management Types
// ============================================================================

export interface UpdateTenantSubscriptionDetailsDto {
  subscription_status?: 'trial' | 'active' | 'cancelled' | 'past_due' | 'expired';
  trial_end_date?: string; // ISO date (YYYY-MM-DD)
  billing_cycle?: BillingCycle; // 'monthly' | 'annual'
  next_billing_date?: string; // ISO date (YYYY-MM-DD)
}

export interface SubscriptionHistoryEntry {
  id: string;
  action: string; // 'updated'
  description: string; // Human-readable description
  changes: {
    before: string; // JSON string
    after: string; // JSON string
  };
  changed_by: {
    id: string;
    email: string;
    name: string;
  };
  changed_at: string; // ISO datetime
}

export interface SubscriptionHistoryResponse {
  tenant: {
    id: string;
    company_name: string;
  };
  history: SubscriptionHistoryEntry[];
}
