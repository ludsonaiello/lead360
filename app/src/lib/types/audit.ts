// Audit Log Types
// Based on API Documentation: /api/documentation/audit-log_REST_API.md

/**
 * Actor type - who performed the action
 */
export enum ActorType {
  USER = 'user',
  SYSTEM = 'system',
  PLATFORM_ADMIN = 'platform_admin',
  CRON_JOB = 'cron_job'
}

/**
 * Action type - what action was performed
 */
export enum ActionType {
  CREATED = 'created',
  UPDATED = 'updated',
  DELETED = 'deleted',
  ACCESSED = 'accessed',
  FAILED = 'failed'
}

/**
 * Status of the action
 */
export enum Status {
  SUCCESS = 'success',
  FAILURE = 'failure'
}

/**
 * Export format options
 */
export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json'
}

/**
 * Actor information (populated in responses)
 */
export interface AuditLogActor {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

/**
 * Tenant information (populated in responses)
 */
export interface AuditLogTenant {
  id: string;
  legal_name: string;
  subdomain: string;
}

/**
 * Core audit log entry
 */
export interface AuditLog {
  // Identity Fields
  id: string;
  tenant_id: string | null;

  // Actor Information
  actor_user_id: string | null;
  actor_type: ActorType;

  // Action Details
  entity_type: string;
  entity_id: string;
  description: string;
  action_type: ActionType;

  // Change Tracking
  before_json: Record<string, any> | null;
  after_json: Record<string, any> | null;
  metadata_json: Record<string, any> | null;

  // Request Context
  ip_address: string | null;
  user_agent: string | null;

  // Status & Errors
  status: Status;
  error_message: string | null;

  // Timestamps
  created_at: string; // ISO-8601 timestamp

  // Relationships (populated in responses)
  actor?: AuditLogActor | null;
  user?: AuditLogActor | null;
  tenant?: AuditLogTenant | null;
}

/**
 * Filter parameters for querying audit logs
 */
export interface AuditLogFilters {
  page?: number;
  limit?: number;
  start_date?: string; // ISO-8601
  end_date?: string; // ISO-8601
  actor_user_id?: string;
  actor_type?: ActorType;
  action_type?: ActionType;
  entity_type?: string;
  entity_id?: string;
  status?: Status;
  search?: string;
}

/**
 * Pagination metadata
 */
export interface AuditLogPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * API response for list endpoints
 */
export interface AuditLogResponse {
  data: AuditLog[];
  pagination: AuditLogPagination;
}

/**
 * Export options
 */
export interface AuditLogExportOptions {
  format: ExportFormat;
  filters?: Omit<AuditLogFilters, 'page' | 'limit'>;
}

/**
 * Date range preset option
 */
export interface DateRangePreset {
  label: string;
  getValue: () => { start: Date; end: Date };
}
