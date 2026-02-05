/**
 * TypeScript Types for Background Jobs Module
 * Matches backend API response structures
 */

// ============================================================================
// Job Types
// ============================================================================

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface Job {
  id: string;
  job_type: string;
  status: JobStatus;
  tenant_id: string | null;
  payload: Record<string, any>;
  result: Record<string, any> | null;
  priority: number;
  attempts: number;
  max_retries: number;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  duration_ms: number | null;
}

export interface JobLog {
  id: string;
  job_id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  metadata: Record<string, any>;
}

export interface EmailQueue {
  id: string;
  job_id: string;
  template_key: string;
  to_email: string;
  cc_emails: string[] | null;
  bcc_emails: string[] | null;
  subject: string;
  html_body: string;
  text_body: string | null;
  status: 'pending' | 'sent' | 'failed';
  smtp_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface JobDetail extends Job {
  job_log: JobLog[];
  email_queue: EmailQueue[];
}

export interface JobFilters {
  page?: number;
  limit?: number;
  status?: JobStatus;
  job_type?: string;
  tenant_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface JobListResponse {
  data: Job[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    limit: number;
  };
}

// ============================================================================
// Scheduled Job Types
// ============================================================================

export interface ScheduledJob {
  id: string;
  type: 'system' | 'quote-report'; // Backend returns this
  name: string;
  description: string;
  schedule: string; // Cron expression
  schedule_type: string; // daily, weekly, monthly, custom
  is_active: boolean; // Backend uses is_active, not is_enabled
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  updated_at: string;
  metadata: Record<string, any>; // Contains job-specific data (report details, timezone, etc.)
  // Deprecated fields (kept for backwards compatibility)
  job_type?: string;
  timezone?: string;
  is_enabled?: boolean;
  max_retries?: number;
  timeout_seconds?: number;
}

export interface ScheduledJobHistory {
  id: string;
  job_type: string;
  status: JobStatus;
  payload: Record<string, any>;
  result: Record<string, any> | null;
  created_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface CreateScheduledJobDto {
  job_type: string;
  name: string;
  description?: string;
  schedule: string;
  timezone?: string;
  max_retries?: number;
  timeout_seconds?: number;
}

export interface UpdateScheduledJobDto {
  job_type?: string;
  name?: string;
  description?: string;
  schedule?: string;
  timezone?: string;
  is_enabled?: boolean;
  max_retries?: number;
  timeout_seconds?: number;
}

export interface ScheduledJobListResponse {
  data: ScheduledJob[];
  pagination: {
    current_page: number;
    total_pages: number;
    total_count: number;
    limit: number;
  };
  summary?: {
    total_jobs: number;
    system_jobs: number;
    quote_reports: number;
    active_jobs: number;
  };
}

// ============================================================================
// Email Settings Types
// ============================================================================

export type SmtpEncryption = 'none' | 'tls' | 'ssl';

export interface EmailSettings {
  id: string;
  smtp_host: string;
  smtp_port: number;
  smtp_encryption: SmtpEncryption;
  smtp_username: string;
  smtp_password: string; // Masked in GET responses
  from_email: string;
  from_name: string;
  is_verified: boolean;
  updated_at: string;
}

export interface UpdateEmailSettingsDto {
  smtp_host: string;
  smtp_port: number;
  smtp_encryption: SmtpEncryption;
  smtp_username: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
}

export interface TestEmailDto {
  to_email: string;
}

export interface TestEmailResponse {
  message: string;
  messageId: string;
}

// ============================================================================
// Email Template Types
// ============================================================================

export interface EmailTemplate {
  id: string;
  template_key: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  variables: string[];
  description: string | null;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEmailTemplateDto {
  template_key: string;
  subject: string;
  html_body: string;
  text_body?: string;
  variables: string[];
  description?: string;
}

export interface UpdateEmailTemplateDto {
  subject?: string;
  html_body?: string;
  text_body?: string;
  variables?: string[];
  description?: string;
}

export interface PreviewEmailDto {
  variables: Record<string, string>;
}

export interface PreviewEmailResponse {
  subject: string;
  html_body: string;
  text_body: string | null;
}

export interface EmailTemplateListResponse {
  data: EmailTemplate[];
}

// ============================================================================
// Queue Health Types
// ============================================================================

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
  prioritized?: number;        // Optional: from BullMQ
  'waiting-children'?: number; // Optional: from BullMQ (kebab-case property name)
}

export interface QueueHealth {
  queues: {
    email: QueueMetrics;
    scheduled: QueueMetrics;
  };
  database: {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  };
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  status: number;
  message: string;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

// ============================================================================
// Email Template Variables Types
// ============================================================================

export type VariableType = 'string' | 'number' | 'boolean' | 'date' | 'url' | 'email' | 'phone' | 'currency' | 'array' | 'object';
export type VariableCategory = 'user' | 'tenant' | 'subscription' | 'billing' | 'system' | 'custom';

export interface VariableMetadata {
  name: string;
  type: VariableType;
  category: VariableCategory;
  description: string;
  example: any;
  required: boolean;
  format?: string;
  default_value?: any;
}

export interface VariableRegistry {
  [variableName: string]: VariableMetadata;
}

export interface TemplateValidationRequest {
  html_body: string;
  text_body?: string;
  variables: string[];
}

export interface TemplateValidationResult {
  valid: boolean;
  unusedVariables: string[];
  undefinedVariables: string[];
}

export interface TemplateValidationResponse {
  valid: boolean;
  htmlValidation: TemplateValidationResult;
  textValidation: TemplateValidationResult | null;
}

export interface VariableSampleData {
  [variableName: string]: any;
}
