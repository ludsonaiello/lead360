// Lead360 - Communication Module Type Definitions
// Complete type definitions for all 41 API endpoints
// Critical mappings:
// - Provider configs: JSON Schema validated
// - Email configs: credentials NEVER returned in responses
// - Templates: Handlebars syntax with variable_schema
// - Events: provider_id vs provider object (depends on endpoint)
// - Notifications: user_id null = tenant-wide notifications

// ==========================================
// JSON SCHEMA TYPES
// ==========================================

export interface JSONSchema {
  type: string;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  [key: string]: any;
}

export interface JSONSchemaProperty {
  type: string;
  description?: string;
  pattern?: string;
  format?: string;
  minimum?: number;
  maximum?: number;
  default?: any;
  enum?: string[];
  [key: string]: any;
}

// ==========================================
// PROVIDER TYPES
// ==========================================

export interface CommunicationProvider {
  id: string;
  provider_key: string;
  provider_name: string;
  provider_type: 'email' | 'sms' | 'whatsapp' | 'call' | 'push';
  credentials_schema: JSONSchema;
  config_schema?: JSONSchema | null;
  default_config?: Record<string, any> | null;
  supports_webhooks: boolean;
  webhook_events?: string[] | null;
  webhook_verification_method?: 'signature' | 'token' | 'ip_whitelist' | null;
  documentation_url?: string | null;
  logo_url?: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
  updated_at: string;
  // Only present when requested with counts
  _count?: {
    platform_email_configs: number;
    tenant_email_configs: number;
    communication_events: number;
  };
}

// Nested provider object (in email config responses)
export interface ProviderReference {
  id: string;
  provider_key: string;
  provider_name: string;
  provider_type: string;
}

// ==========================================
// PLATFORM EMAIL CONFIG (Admin)
// ==========================================

export interface PlatformEmailConfig {
  id: string;
  provider_id: string;
  provider: ProviderReference;
  provider_config?: Record<string, any> | null;
  credentials?: Record<string, any> | null; // Credentials ARE returned
  from_email: string;
  from_name: string;
  reply_to_email?: string | null;
  webhook_secret?: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ==========================================
// TENANT EMAIL CONFIG
// ==========================================

export interface TenantEmailConfig {
  id: string;
  tenant_id: string;
  provider_id: string;
  provider: ProviderReference;
  provider_config?: Record<string, any> | null;
  credentials?: Record<string, any> | null; // Credentials ARE returned
  from_email: string;
  from_name: string;
  reply_to_email?: string | null;
  webhook_secret?: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ==========================================
// EMAIL TEMPLATES
// ==========================================

export interface EmailTemplate {
  id: string;
  tenant_id: string | null; // null = platform/shared templates
  template_key: string;
  description?: string | null;
  category: 'system' | 'transactional' | 'marketing' | 'notification';
  template_type: 'platform' | 'shared' | 'tenant'; // 3-tier system
  subject: string; // Handlebars template
  html_body: string; // Handlebars template
  text_body?: string | null; // Handlebars template
  variables: string[]; // Array of variable names (e.g., ["user_name", "activation_link"])
  variable_schema?: JSONSchema | null; // Variables validation schema
  is_system: boolean; // DEPRECATED: use template_type instead
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ==========================================
// COMMUNICATION EVENTS
// ==========================================

export interface CommunicationEvent {
  id: string;
  tenant_id: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'call';
  direction: 'outbound' | 'inbound';
  provider_id: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';

  // Email-specific fields
  to_email?: string | null;
  cc_emails?: string[] | null;
  bcc_emails?: string[] | null;
  from_email?: string | null;
  from_name?: string | null;
  subject?: string | null;

  // SMS/WhatsApp fields
  to_phone?: string | null;
  from_phone?: string | null;

  // Template info
  template_key?: string | null;
  template_variables?: Record<string, any> | null;

  // Provider info
  provider_message_id?: string | null;
  provider_metadata?: Record<string, any> | null;

  // Related entity
  related_entity_type?: string | null;
  related_entity_id?: string | null;

  // Timeline
  sent_at?: string | null;
  delivered_at?: string | null;
  opened_at?: string | null;
  clicked_at?: string | null;
  bounced_at?: string | null;
  bounce_type?: 'soft' | 'hard' | null;

  // Error handling
  error_message?: string | null;

  // Audit
  created_at: string;
  created_by_user_id?: string | null;
}

// Extended event details (from GET /communication/history/:id)
export interface CommunicationEventDetail extends CommunicationEvent {
  provider: ProviderReference;
  html_body?: string | null;
  text_body?: string | null;
  attachments?: any | null;
  created_by_user?: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  webhook_events?: WebhookEventSummary[];
}

export interface WebhookEventSummary {
  id: string;
  event_type: string;
  created_at: string;
  signature_verified: boolean;
}

// ==========================================
// NOTIFICATIONS
// ==========================================

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string | null; // null = tenant-wide notification
  type: string;
  title: string;
  message: string;
  action_url?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  expires_at?: string | null;
  created_at: string;
}

// ==========================================
// NOTIFICATION RULES
// ==========================================

export interface NotificationRule {
  id: string;
  tenant_id: string;
  event_type: string;
  notify_in_app: boolean;
  notify_email: boolean;
  email_template_key?: string | null;
  recipient_type: 'owner' | 'assigned_user' | 'specific_users' | 'all_users';
  specific_user_ids?: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ==========================================
// REQUEST DTOs
// ==========================================

// Provider Management (Admin)
export interface CreateProviderDto {
  provider_key: string;
  provider_name: string;
  provider_type: 'email' | 'sms' | 'whatsapp';
  credentials_schema: JSONSchema;
  config_schema?: JSONSchema;
  default_config?: Record<string, any>;
  supports_webhooks: boolean;
  webhook_events?: string[];
  webhook_verification_method?: 'signature' | 'token' | 'ip_whitelist';
  documentation_url?: string;
  logo_url?: string;
}

export interface UpdateProviderDto {
  provider_name?: string;
  credentials_schema?: JSONSchema;
  config_schema?: JSONSchema;
  default_config?: Record<string, any>;
  supports_webhooks?: boolean;
  webhook_events?: string[];
  webhook_verification_method?: 'signature' | 'token' | 'ip_whitelist';
  documentation_url?: string;
  logo_url?: string;
}

// Platform Email Config (Admin)
export interface UpdatePlatformEmailConfigDto {
  provider_id: string;
  credentials: Record<string, any>; // Must match provider's credentials_schema
  provider_config?: Record<string, any>;
  from_email: string;
  from_name: string;
  reply_to_email?: string;
  webhook_secret?: string;
}

export interface TestEmailDto {
  to: string;
}

// Tenant Email Config
export interface UpdateTenantEmailConfigDto {
  provider_id: string;
  credentials: Record<string, any>; // Must match provider's credentials_schema
  provider_config?: Record<string, any>;
  from_email: string;
  from_name: string;
  reply_to_email?: string;
  webhook_secret?: string;
}

// Email Templates
export interface CreateTemplateDto {
  template_key: string;
  description?: string;
  category: 'system' | 'transactional' | 'marketing' | 'notification';
  template_type?: 'platform' | 'shared' | 'tenant'; // Default: tenant, only admins can create platform/shared
  tenant_id?: string; // Only for platform admins creating tenant-specific templates
  subject: string;
  html_body: string;
  text_body?: string;
  variables?: string[]; // Array of variable names
  variable_schema?: JSONSchema;
}

export interface UpdateTemplateDto {
  description?: string;
  category?: 'system' | 'transactional' | 'marketing' | 'notification';
  subject?: string;
  html_body?: string;
  text_body?: string;
  variables?: string[]; // Array of variable names
  variable_schema?: JSONSchema;
  is_active?: boolean;
}

export interface CloneTemplateDto {
  new_template_key: string; // New unique key for cloned template
  description?: string; // Optional: customize description
}

export interface PreviewTemplateDto {
  template_key?: string;
  subject?: string;
  html_body?: string;
  text_body?: string;
  sample_data: Record<string, any>;
}

export interface ValidateTemplateDto {
  subject: string;
  html_body: string;
  text_body?: string;
}

// Send Email
export interface SendTemplatedEmailDto {
  template_key: string;
  to: string;
  variables: Record<string, any>;
  cc?: string[];
  bcc?: string[];
  reply_to?: string;
  attachments?: any[];
  related_entity_type?: string;
  related_entity_id?: string;
}

export interface SendRawEmailDto {
  to: string;
  subject: string;
  html_body: string;
  text_body?: string;
  cc?: string[];
  bcc?: string[];
  from_email?: string;
  from_name?: string;
  reply_to?: string;
  attachments?: any[];
  related_entity_type?: string;
  related_entity_id?: string;
}

// Notification Rules
export interface CreateNotificationRuleDto {
  event_type: string;
  notify_in_app?: boolean; // Default: true
  notify_email?: boolean; // Default: false
  email_template_key?: string; // Required if notify_email=true
  recipient_type: 'owner' | 'assigned_user' | 'specific_users' | 'all_users';
  specific_user_ids?: string[]; // Required if recipient_type='specific_users'
}

export interface UpdateNotificationRuleDto {
  event_type?: string;
  notify_in_app?: boolean;
  notify_email?: boolean;
  email_template_key?: string;
  recipient_type?: 'owner' | 'assigned_user' | 'specific_users' | 'all_users';
  specific_user_ids?: string[];
  is_active?: boolean;
}

// ==========================================
// RESPONSE DTOs
// ==========================================

// Paginated responses
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
  };
}

// Provider statistics
export interface ProviderStats {
  total_configs: number;
  active_configs: number;
  total_events: number;
  events_last_30_days: number;
  success_rate: number;
  avg_delivery_time_ms: number;
}

// Template preview
export interface TemplatePreview {
  subject: string;
  html_body: string;
  text_body?: string;
}

// Variable registry
export interface VariableRegistry {
  [context: string]: {
    [variableName: string]: {
      type: string;
      description: string;
      example: string;
    };
  };
}

// Template validation
export interface TemplateValidationResult {
  valid: boolean; // Backend returns "valid", not "is_valid"
  variables_used: string[]; // Array of variable names found in template
  errors?: { // Optional - only present when validation fails
    subject?: string[];
    html_body?: string[];
    text_body?: string[];
  };
}

// Send email response
export interface SendEmailResponse {
  communication_event_id: string;
  status: 'pending' | 'sent' | 'failed';
  provider_message_id?: string;
  error_message?: string;
}

// Unread count
export interface UnreadCountResponse {
  unread_count: number;
}

// Mark all read response
export interface MarkAllReadResponse {
  marked_count: number;
}

// ==========================================
// QUERY PARAMETER TYPES
// ==========================================

export interface GetProvidersParams {
  type?: 'email' | 'sms' | 'whatsapp';
  is_active?: boolean;
  include_system?: boolean;
}

export interface GetTemplatesParams {
  category?: 'system' | 'transactional' | 'marketing' | 'notification';
  template_type?: 'platform' | 'shared' | 'tenant'; // Filter by template type
  is_active?: boolean;
  is_system?: boolean; // DEPRECATED: use template_type instead
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetCommunicationHistoryParams {
  channel?: 'email' | 'sms' | 'whatsapp';
  status?: 'pending' | 'sent' | 'delivered' | 'failed' | 'bounced';
  to_email?: string;
  to_phone?: string;
  related_entity_type?: string;
  related_entity_id?: string;
  start_date?: string; // ISO 8601
  end_date?: string; // ISO 8601
  page?: number;
  limit?: number;
}

export interface GetNotificationsParams {
  is_read?: boolean;
  type?: string;
  start_date?: string; // ISO 8601
  page?: number;
  limit?: number;
}

export interface GetNotificationRulesParams {
  event_type?: string;
  is_active?: boolean;
}
