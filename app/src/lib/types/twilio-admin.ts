/**
 * Twilio Admin TypeScript Types
 * Sprint 1: Provider Management & System Health
 */

// Response when provider IS configured (from GET endpoint)
export interface SystemProviderConfigured {
  configured: true;
  is_active: boolean;
  provider_name: string;
  created_at: string;
  updated_at: string;
  model_b_tenant_count: number;
}

// Response when provider is NOT configured
export interface SystemProviderNotConfigured {
  configured: false;
  message: string;
}

// Union type for GET provider response
export type SystemProviderResponse = SystemProviderConfigured | SystemProviderNotConfigured;

// Full provider object (returned by POST register)
export interface SystemProvider {
  provider_key: string;
  provider_name: string;
  provider_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegisterProviderDto {
  account_sid: string;
  auth_token: string;
}

export interface UpdateProviderDto extends RegisterProviderDto {}

export interface ConnectivityTestResult {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  response_time_ms: number;
  message: string;
  account_sid?: string;
  tested_at: string;
}

export interface AvailableNumbersResponse {
  available_numbers: AvailableNumber[];
  count: number;
}

export interface AvailableNumber {
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
  };
  address_requirements: string;
  beta: boolean;
  iso_country: string;
  region?: string;
  locality?: string;
}

// Owned Phone Numbers (from Twilio account)
export interface OwnedPhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  status: 'allocated' | 'available';
  allocated_to_tenant: {
    id: string;
    company_name: string;
    subdomain: string;
  } | null;
  allocated_for: string[] | null;
  date_created: string;
  date_updated: string;
}

export interface SystemHealthResponse {
  isHealthy: boolean;
  checked_at: string;
  checks: {
    twilio_api: {
      status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
      response_time_ms: number;
      details?: {
        account_status: string;
      };
    };
    transcription_provider?: {
      status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
      response_time_ms: number;
      details?: any;
    };
    webhook_delivery?: {
      status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
      message?: string;
      response_time_ms: number;
    };
  };
}

export interface ComponentHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  response_time_ms: number;
  message: string;
}

export interface TranscriptionHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  providers: Record<string, ComponentHealth>;
}

export interface TestResult {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  response_time_ms?: number;
  message: string;
  tested_at: string;
  providers_tested?: string[];
}

export interface SystemAlert {
  id: string;
  type: 'SYSTEM_HEALTH' | 'FAILED_TRANSCRIPTION' | 'QUOTA_EXCEEDED' | 'HIGH_USAGE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: any;
  acknowledged: boolean;
  acknowledged_by?: any;
  acknowledged_at?: string;
  created_at: string;
}

export interface AlertsQuery {
  acknowledged?: boolean;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  page?: number;
  limit?: number;
}

// Actual API response format (array of metrics)
export interface ProviderMetrics {
  check_type: string;
  avg_response_time_ms: number;
  max_response_time_ms: number;
  min_response_time_ms: number;
  check_count: number;
  period: string;
}

// Response is an array of ProviderMetrics
export type ResponseTimeMetrics = ProviderMetrics[];

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// ============================================
// Sprint 2: Cross-Tenant Monitoring Types
// ============================================

export interface TenantInfo {
  id: string;
  company_name: string;
  subdomain: string;
}

export interface LeadInfo {
  id: string;
  first_name: string;
  last_name: string;
  phones?: Array<{ phone_number: string; is_primary: boolean }>;
}

export interface UserInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface ProviderInfo {
  id: string;
  provider_name: string;
  provider_type: string;
}

export interface TranscriptionInfo {
  id: string;
  status: string;
  transcription_provider: string;
  transcription_text?: string;
  language_detected?: string;
  confidence_score?: string;
}

export interface CallRecord {
  id: string;
  tenant_id: string;
  tenant?: TenantInfo;
  lead_id?: string;
  lead?: LeadInfo;
  twilio_call_sid: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  status: string;
  call_type: string;
  initiated_by?: string;
  initiated_by_user?: UserInfo;
  recording_url?: string;
  recording_duration_seconds?: number;
  recording_status: string;
  transcription?: TranscriptionInfo;
  cost?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CallFilters {
  tenant_id?: string;
  status?: string;
  direction?: 'inbound' | 'outbound';
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface CommunicationEvent {
  id: string;
  tenant_id?: string;
  tenant?: TenantInfo;
  channel: 'sms' | 'whatsapp';
  direction: 'inbound' | 'outbound';
  provider_id: string;
  provider?: ProviderInfo;
  status: string;
  to_phone?: string;
  from_phone?: string;
  text_body?: string;
  provider_message_id?: string;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
  created_by_user?: UserInfo;
}

export interface MessageFilters extends CallFilters {
  channel?: 'sms' | 'whatsapp';
}

export interface TenantSMSConfig {
  id: string;
  tenant_id: string;
  tenant?: TenantInfo;
  provider_id: string;
  from_phone: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

// Moved to Sprint 7 section (line 878) - see below for complete definition

export interface TenantIVRConfig {
  id: string;
  tenant_id: string;
  tenant?: TenantInfo;
  ivr_enabled: boolean;
  greeting_message?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TenantConfigsResponse {
  sms_configs: TenantSMSConfig[];
  whatsapp_configs: TenantWhatsAppConfig[];
  ivr_configs: TenantIVRConfig[];
}

// Tenant Metrics Response (matches actual API - updated Feb 7, 2026)
// API now returns nested structure with full breakdowns
export interface TenantMetricsResponse {
  tenant: {
    id: string;
    company_name: string;
    subdomain: string;
  };
  period: string;
  calls: {
    total: number;
    inbound: number;
    outbound: number;
    completed: number;
    failed: number;
    average_duration_seconds: number;
    total_duration_minutes: number;
  };
  sms: {
    total: number;
    inbound: number;
    outbound: number;
    delivered: number;
    failed: number;
  };
  whatsapp: {
    total: number;
    inbound: number;
    outbound: number;
    delivered: number;
    failed: number;
  };
  transcriptions: {
    total: number;
    completed: number;
    failed: number;
    success_rate: string;
    average_processing_time_seconds: number;
  };
  costs: {
    estimated_monthly: string;
    breakdown: {
      calls: string;
      sms: string;
      whatsapp: string;
      transcriptions: string;
    };
  };
}

// ============================================
// Sprint 3: Usage Tracking & Billing Types
// ============================================

export interface UsageQuery {
  start_date?: string;
  end_date?: string;
  month?: string;
}

export interface UsageSummaryResponse {
  period: {
    start_date: string;
    end_date: string;
  };
  platform_totals: {
    total_tenants: number;
    calls: UsageCategory;
    sms: UsageCategory;
    recordings: UsageCategory;
    transcriptions: UsageCategory;
  };
  total_cost: string;
}

export interface UsageCategory {
  count: number;
  minutes?: number;
  cost: string;
  storage_mb?: number;
}

export interface TenantUsageResponse {
  tenant_id: string;
  tenant_name: string;
  month: string;
  usage_breakdown: {
    calls: UsageCategory;
    sms: UsageCategory;
    recordings: UsageCategory;
    transcriptions: UsageCategory;
  };
  total_cost: string;
  synced_at: string;
}

export interface CostEstimateResponse {
  tenant_id: string;
  tenant_name: string;
  month: string;
  cost_estimate: {
    calls: string;
    sms: string;
    recordings: string;
    transcriptions: string;
    total: string;
  };
  estimated_at: string;
}

export interface TopTenantsResponse {
  top_tenants: TopTenant[];
  generated_at: string;
}

export interface TopTenant {
  tenant_id: string;
  tenant_name: string;
  subdomain: string;
  total_communications: number;
  calls: number;
  sms: number;
  whatsapp: number;
  rank: number;
}

// ============================================
// Sprint 4: Transcription Monitoring Types
// ============================================

export interface FailedTranscriptionsResponse {
  failed_transcriptions: FailedTranscription[];
  count: number;
}

export interface FailedTranscription {
  id: string;
  tenant_id: string;
  call_record_id: string;
  transcription_provider: string;
  status: 'failed';
  error_message: string;
  created_at: string;
  call_details: {
    twilio_call_sid: string;
    recording_url: string;
    recording_duration_seconds: number;
  };
}

export interface TranscriptionDetail {
  id: string;
  tenant: {
    id: string;
    name: string;
    subdomain: string;
  };
  call: {
    id: string;
    twilio_call_sid: string;
    direction: 'inbound' | 'outbound';
    from_number: string;
    to_number: string;
    recording_url: string;
    recording_duration_seconds: number;
    started_at: string;
  };
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    primary_phone: string;
  };
  transcription_provider: string;
  status: 'completed' | 'failed' | 'queued' | 'processing';
  transcription_text?: string;
  language_detected?: string;
  confidence_score?: string;
  processing_duration_seconds?: number;
  cost?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

export interface TranscriptionProvidersResponse {
  providers: TranscriptionProvider[];
  total_count: number;
}

// Moved to Sprint 7 section (line 807) - see below for complete definition

// ============================================
// Sprint 5: Metrics & Cron Management Types
// ============================================

// System-Wide Metrics Response (actual API response)
export interface SystemMetricsResponse {
  total_calls: number;
  total_sms: number;
  total_whatsapp: number;
  total_communications: number;
  active_tenants: number;
  total_transcriptions: number;
  failed_transcriptions: number;
  transcription_success_rate: string;
  tenants_with_sms_config: number;
  tenants_with_whatsapp_config: number;
  tenants_with_ivr_config: number;
  activity_last_24h: {
    calls: number;
    sms: number;
  };
}

// Cron Job Status (actual API response)
export interface CronJobStatus {
  enabled: boolean;
  schedule: string;
  timezone: string;
  status: 'running' | 'stopped';
}

export interface CronJobStatusResponse {
  usage_sync: CronJobStatus;
  health_check: CronJobStatus;
}

export interface ReloadCronResponse {
  message: string;
  status: CronJobStatusResponse;
}

// ============================================
// Sprint 6: Webhook Management Types
// ============================================

export interface WebhookConfig {
  id: string;
  base_url: string;
  endpoints: {
    twilio: {
      call: {
        inbound: string;
        status: string;
        recording_ready: string;
      };
      sms: {
        inbound: string;
        status: string;
      };
      whatsapp: {
        inbound: string;
        status: string;
      };
      ivr: {
        input: string;
      };
    };
    email: {
      sendgrid: string;
      brevo: string;
      amazon_ses: string;
    };
  };
  security: {
    signature_verification: boolean;
    secret_configured: boolean;
    last_rotated: string;
  };
}

export interface UpdateWebhookConfigDto {
  base_url?: string;
  signature_verification?: boolean;
  rotate_secret?: boolean;
}

export interface WebhookConfigUpdateResponse {
  success: boolean;
  message: string;
  config: {
    base_url: string;
    signature_verification: boolean;
    secret_rotated: boolean;
  };
}

export interface TestWebhookDto {
  type: 'sms' | 'call' | 'whatsapp' | 'email';
  payload?: Record<string, any>;
}

export interface WebhookTestResult {
  status: 'success' | 'failed';
  webhook_url: string;
  response_time_ms: number;
  status_code: number;
  signature_valid: boolean;
  processing_result: string;
}

export interface WebhookEvent {
  id: string;
  webhook_type: 'sms' | 'call' | 'whatsapp' | 'email';
  status: 'pending' | 'processed' | 'failed';
  payload: Record<string, any>;
  processing_attempts: number;
  last_error: string | null;
  processed_at: string | null;
  created_at: string;
}

export interface WebhookEventFilters {
  webhook_type?: 'sms' | 'call' | 'whatsapp' | 'email';
  status?: 'pending' | 'processed' | 'failed';
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

// ============================================
// Sprint 6: Phone Number Management Types
// ============================================

export interface PhoneNumber {
  sid: string;
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    sms: boolean;
    mms: boolean;
  };
  status: 'allocated' | 'available';
  allocated_to_tenant: {
    id: string;
    company_name: string;
    subdomain: string;
  } | null;
  allocated_for: string[] | null;
  date_created: string;
  date_updated: string;
}

export interface OwnedPhoneNumbersResponse {
  phone_numbers: PhoneNumber[];
  total_count: number;
  allocated_count: number;
  available_count: number;
}

export interface PurchasePhoneNumberDto {
  phone_number: string;
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };
  tenant_id?: string;
  purpose?: 'SMS Only' | 'Calls Only' | 'SMS + Calls' | 'WhatsApp';
}

export interface PhoneNumberPurchaseResponse {
  success: boolean;
  message: string;
  phone_number: {
    sid: string;
    phone_number: string;
    friendly_name: string;
    capabilities: {
      voice: boolean;
      sms: boolean;
      mms: boolean;
    };
    monthly_cost: string;
  };
  allocation?: {
    tenant_id: string;
    purpose: string;
    allocated_at: string;
  };
}

export interface AllocatePhoneNumberDto {
  tenant_id: string;
  purpose?: 'SMS Only' | 'Calls Only' | 'SMS + Calls' | 'WhatsApp';
}

export interface PhoneNumberAllocationResponse {
  success: boolean;
  message: string;
  phone_number: {
    sid: string;
    phone_number: string;
    friendly_name: string;
  };
  allocation: {
    tenant_id: string;
    tenant_name: string;
    purpose: string;
    allocated_at: string;
  };
}

export interface DeallocatePhoneNumberDto {
  delete_config?: boolean;
  reason?: string;
}

export interface PhoneNumberDeallocationResponse {
  success: boolean;
  message: string;
  phone_number: {
    sid: string;
    phone_number: string;
    status: string;
  };
  previous_allocation: {
    tenant_id: string;
    tenant_name: string;
    deallocated_at: string;
  };
  config_deleted: boolean;
}

export interface PhoneNumberReleaseResponse {
  success: boolean;
  message: string;
  phone_number: {
    sid: string;
    phone_number: string;
    released_at: string;
  };
}

// Tenant interface (used in allocation modals)
export interface Tenant {
  id: string;
  company_name: string;
  subdomain: string;
}

// ============================================
// Sprint 7: Transcription Provider CRUD Types
// ============================================

export interface CreateTranscriptionProviderDto {
  tenant_id?: string;
  provider_name: 'openai_whisper' | 'assemblyai' | 'deepgram';
  api_key: string;
  api_endpoint?: string;
  model?: string;
  language?: string;
  additional_settings?: Record<string, any>;
  is_system_default?: boolean;
  usage_limit?: number;
  cost_per_minute?: number;
}

export interface UpdateTranscriptionProviderDto {
  api_key?: string;
  api_endpoint?: string;
  model?: string;
  language?: string;
  additional_settings?: Record<string, any>;
  status?: 'active' | 'inactive';
  usage_limit?: number;
  cost_per_minute?: number;
  is_system_default?: boolean;
}

export interface TranscriptionProvider {
  id: string;
  tenant?: {
    id: string;
    company_name: string;
    subdomain: string;
  } | null;
  provider_name: string;
  api_endpoint?: string | null; // Optional - old providers might not have this
  model?: string | null; // Optional - old providers might not have this
  language?: string | null; // Optional - old providers might not have this
  additional_settings?: Record<string, any>; // Optional - defaults to {}
  is_system_default: boolean;
  status: 'active' | 'inactive';
  usage_limit: number;
  usage_current: number;
  cost_per_minute: string; // Backend returns as string
  statistics: {
    total_transcriptions: number;
    successful: number;
    failed: number;
    success_rate: string;
    total_cost?: string; // Optional - might not be in all responses
  };
  created_at: string;
  updated_at: string;
}

export interface TranscriptionProviderDetail extends TranscriptionProvider {}

export interface TestTranscriptionResult {
  test_status: 'success' | 'failed';
  provider_name: string;
  response_time_ms: number;
  transcription_preview: string | null;
  quota_remaining: number | null;
  api_key_valid: boolean;
  error_message?: string;
}

// ============================================
// Sprint 7: Tenant Assistance Types
// ============================================

export interface CreateTenantSmsConfigDto {
  provider_type?: 'system' | 'custom';
  from_phone: string;
  account_sid?: string;
  auth_token?: string;
}

export interface UpdateTenantSmsConfigDto {
  from_phone?: string;
  is_active?: boolean;
  account_sid?: string;
  auth_token?: string;
}

export interface TenantSmsConfig {
  id: string;
  tenant_id?: string; // Optional when tenant object is present
  tenant?: {
    id: string;
    company_name: string;
    subdomain: string;
    is_active: boolean;
  };
  provider_type: string; // API returns channel type (e.g., "sms", "whatsapp")
  from_phone: string;
  is_primary: boolean;
  is_active: boolean;
  is_verified?: boolean; // Extra field from API
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTenantWhatsAppConfigDto {
  provider_type?: 'system' | 'custom';
  from_phone: string;
  account_sid?: string;
  auth_token?: string;
}

export interface UpdateTenantWhatsAppConfigDto {
  from_phone?: string;
  is_active?: boolean;
  account_sid?: string;
  auth_token?: string;
}

export interface TenantWhatsAppConfig {
  id: string;
  tenant_id?: string; // Optional when tenant object is present
  tenant?: {
    id: string;
    company_name: string;
    subdomain: string;
    is_active: boolean;
  };
  provider_type: string; // API returns channel type (e.g., "sms", "whatsapp")
  from_phone: string;
  is_primary: boolean;
  is_active: boolean;
  is_verified?: boolean; // Extra field from API
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TestConfigResult {
  success: boolean;
  message: string;
  config_id: string;
  from_phone: string;
  test_message_sid?: string;
  sent_at?: string;
  error?: string;
  tested_at: string;
}

// ============================================
// Sprint 8: Operations & Maintenance Types
// ============================================

// Alert Management Types

export interface AcknowledgeAlertDto {
  comment?: string;
}

export interface ResolveAlertDto {
  resolution: string;
}

export interface BulkAcknowledgeAlertsDto {
  alert_ids: string[];
  comment?: string;
}

// Best-effort bulk acknowledge response (updated with new structure)
export interface BulkAcknowledgeResponse {
  success: boolean;
  acknowledged_count: number;
  acknowledged_ids: string[];
  not_found_ids: string[];
  total_requested: number;
  message: string;
}

// Updated SystemAlert with resolution fields
export interface SystemAlertDetail extends SystemAlert {
  resolved?: boolean;
  resolved_by?: {
    id: string;
    name: string;
    email: string;
  };
  resolved_at?: string;
  resolution?: string;
  comment?: string;
}

// Communication Event Management Types

export interface ResendEventResponse {
  success: boolean;
  message: string;
  event_id: string;
  channel: string;
  status: string;
  queued_at: string;
}

export interface UpdateEventStatusDto {
  status: string;
  reason: string;
}

export interface UpdateEventStatusResponse {
  id: string;
  channel: string;
  old_status: string;
  new_status: string;
  reason: string;
  updated_by: {
    id: string;
    name: string;
  };
  updated_at: string;
}

export interface DeleteEventDto {
  reason: string;
  force?: boolean;
}

export interface DeleteEventResponse {
  success: boolean;
  message: string;
  event_id: string;
  channel: string;
  reason: string;
  deleted_by: {
    id: string;
    name: string;
  };
  deleted_at: string;
}

// Bulk Operations Types

export interface BatchRetryTranscriptionsDto {
  tenant_id?: string;
  provider_id?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface BatchResendCommunicationEventsDto {
  tenant_id?: string;
  channel?: 'sms' | 'whatsapp';
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface BatchRetryWebhookEventsDto {
  tenant_id?: string;
  event_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}

export interface BulkOperationResponse {
  success: boolean;
  queued_count: number;
  job_ids: string[];
  message: string;
}
