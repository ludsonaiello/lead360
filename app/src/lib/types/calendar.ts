// ============================================================================
// Calendar & Scheduling Types
// ============================================================================
// TypeScript types for the Calendar & Scheduling module API responses
// Matches the backend REST API documentation at:
// /var/www/lead360.app/api/documentation/calendar_REST_API.md
// ============================================================================

// ============================================================================
// Enums
// ============================================================================

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

export type AppointmentCancellationReason =
  | 'customer_cancelled'
  | 'business_cancelled'
  | 'no_show'
  | 'rescheduled'
  | 'other';

export type AppointmentSource = 'voice_ai' | 'manual' | 'system';

export type CalendarSyncStatus = 'active' | 'disconnected' | 'error' | 'syncing' | 'inactive';

export type CalendarProviderType = 'google_calendar';

export type SyncDirection = 'outbound' | 'inbound';

export type SyncAction =
  | 'event_created'
  | 'event_updated'
  | 'event_deleted'
  | 'block_created'
  | 'block_updated'
  | 'block_deleted'
  | 'full_sync'
  | 'token_refreshed'
  | 'webhook_received'
  | 'event_fetched'
  | 'webhook_renewed';

export type SyncLogStatus = 'success' | 'failed' | 'skipped';

// ============================================================================
// Appointment Types
// ============================================================================

export interface AppointmentType {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  slot_duration_minutes: number;
  max_lookahead_weeks: number;
  reminder_24h_enabled: boolean;
  reminder_1h_enabled: boolean;
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
}

export interface AppointmentTypeWithSchedules extends AppointmentType {
  schedules: AppointmentTypeSchedule[];
  created_by?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface AppointmentTypeSchedule {
  id: string;
  appointment_type_id: string;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  is_available: boolean;
  window1_start: string | null; // HH:mm format
  window1_end: string | null;
  window2_start: string | null;
  window2_end: string | null;
  created_at: string;
  updated_at: string;
}

// Request types
export interface CreateAppointmentTypeRequest {
  name: string;
  description?: string;
  slot_duration_minutes?: number;
  max_lookahead_weeks?: number;
  reminder_24h_enabled?: boolean;
  reminder_1h_enabled?: boolean;
  is_default?: boolean;
  is_active?: boolean;
}

export interface UpdateAppointmentTypeRequest {
  name?: string;
  description?: string;
  slot_duration_minutes?: number;
  max_lookahead_weeks?: number;
  reminder_24h_enabled?: boolean;
  reminder_1h_enabled?: boolean;
  is_default?: boolean;
  is_active?: boolean;
}

export interface BulkUpdateScheduleRequest {
  schedules: Array<{
    day_of_week: number;
    is_available: boolean;
    window1_start: string | null;
    window1_end: string | null;
    window2_start?: string | null;
    window2_end?: string | null;
  }>;
}

export interface UpdateDayScheduleRequest {
  is_available: boolean;
  window1_start?: string | null;
  window1_end?: string | null;
  window2_start?: string | null;
  window2_end?: string | null;
}

// Response types
export interface AppointmentTypesListResponse {
  items: AppointmentTypeWithSchedules[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

// ============================================================================
// Appointments
// ============================================================================

export interface Appointment {
  id: string;
  tenant_id: string;
  appointment_type_id: string;
  lead_id: string;
  service_request_id: string | null;
  scheduled_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  start_datetime_utc: string; // ISO 8601
  end_datetime_utc: string; // ISO 8601
  status: AppointmentStatus;
  cancellation_reason: AppointmentCancellationReason | null;
  cancellation_notes: string | null;
  notes: string | null;
  source: AppointmentSource;
  external_calendar_event_id: string | null;
  rescheduled_from_id: string | null;
  assigned_user_id: string | null;
  created_at: string;
  updated_at: string;
  created_by_user_id: string | null;
  cancelled_at: string | null;
  cancelled_by_user_id: string | null;
  completed_at: string | null;
  acknowledged_at: string | null;
}

export interface AppointmentWithRelations extends Appointment {
  appointment_type?: {
    id: string;
    name: string;
    slot_duration_minutes: number;
  };
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string | null;
    phone: string | null;
    company_name: string | null;
  };
  service_request?: {
    id: string;
    service_type: string;
    status: string;
  };
  assigned_user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
  created_by?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

// Request types
export interface CreateAppointmentRequest {
  appointment_type_id: string;
  lead_id: string;
  service_request_id?: string;
  scheduled_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  notes?: string;
  assigned_user_id?: string;
  source?: AppointmentSource;
}

export interface UpdateAppointmentRequest {
  notes?: string;
  assigned_user_id?: string;
}

export interface ConfirmAppointmentRequest {
  notes?: string;
}

export interface CancelAppointmentRequest {
  cancellation_reason: AppointmentCancellationReason;
  cancellation_notes?: string;
}

export interface RescheduleAppointmentRequest {
  new_scheduled_date: string; // YYYY-MM-DD
  new_start_time: string; // HH:mm
  reason?: string;
}

export interface RescheduleAppointmentResponse {
  oldAppointment: AppointmentWithRelations;
  newAppointment: AppointmentWithRelations;
}

export interface CompleteAppointmentRequest {
  completion_notes?: string;
}

export interface NoShowAppointmentRequest {
  notes?: string;
}

// Response types
export interface AppointmentsListResponse {
  items: AppointmentWithRelations[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

// ============================================================================
// Availability
// ============================================================================

export interface AvailabilitySlot {
  start_time: string; // HH:mm
  end_time: string; // HH:mm
}

export interface AvailabilityDate {
  date: string; // YYYY-MM-DD
  day_name: string;
  slots: AvailabilitySlot[];
}

export interface AvailabilityResponse {
  appointment_type: {
    id: string;
    name: string;
    slot_duration_minutes: number;
  };
  timezone: string;
  date_range: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
  };
  available_dates: AvailabilityDate[];
  total_available_slots: number;
}

// ============================================================================
// Dashboard
// ============================================================================

export interface DashboardAppointmentItem {
  id: string;
  appointment_type_name: string;
  lead_first_name: string;
  lead_last_name: string;
  scheduled_date: string;
  start_time: string;
  end_time: string;
  address?: string;
  status: AppointmentStatus;
  source?: AppointmentSource;
  created_at?: string;
}

export interface DashboardUpcomingResponse {
  items: DashboardAppointmentItem[];
  count: number;
}

export interface DashboardNewAppointmentsResponse {
  items: DashboardAppointmentItem[];
  count: number;
}

export interface AcknowledgeAppointmentResponse {
  message: string;
  appointment_id: string;
  acknowledged_at: string;
}

// ============================================================================
// Google Calendar Integration
// ============================================================================

export interface GoogleAuthUrlResponse {
  authUrl: string;
  state: string;
}

export interface GoogleCalendar {
  id: string;
  summary: string;
  description: string | null;
  primary: boolean;
  timeZone: string;
  backgroundColor: string;
}

export interface GoogleCalendarsListResponse {
  calendars: GoogleCalendar[];
  total: number;
}

export interface ConnectGoogleCalendarRequest {
  calendarId: string;
  calendarName?: string;
}

export interface ConnectGoogleCalendarResponse {
  id: string;
  status: string;
  message: string;
  connectedCalendarId: string;
  connectedCalendarName: string;
  providerType: CalendarProviderType;
}

export interface DisconnectGoogleCalendarResponse {
  status: string;
  message: string;
}

export interface ManualSyncResponse {
  status: string;
  message: string;
}

export interface TestConnectionResponse {
  status: string;
  message: string;
  details: {
    calendarId: string;
    calendarName: string;
    timeZone: string;
  };
}

// ============================================================================
// Calendar Integration Status
// ============================================================================

export interface CalendarIntegrationStatusResponse {
  connected: boolean;
  providerType?: CalendarProviderType;
  connectedCalendarId?: string;
  connectedCalendarName?: string;
  syncStatus?: CalendarSyncStatus;
  lastSyncAt?: string;
  errorMessage?: string | null;
  createdAt?: string;
}

export interface CalendarIntegrationHealthResponse {
  connected: boolean;
  syncStatus: CalendarSyncStatus;
  lastSyncAt?: string | null;
  webhookExpiration?: string | null;
  recentErrors: number;
  recentSuccesses: number;
}

// ============================================================================
// Sync Logs
// ============================================================================

export interface CalendarSyncLog {
  id: string;
  connectionId: string;
  direction: SyncDirection;
  action: SyncAction;
  appointmentId: string | null;
  externalEventId: string | null;
  status: SyncLogStatus;
  errorMessage: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
}

export interface SyncLogsListResponse {
  data: CalendarSyncLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// ============================================================================
// Query Parameters
// ============================================================================

export interface AppointmentTypesQueryParams {
  page?: number;
  limit?: number;
  is_active?: boolean;
  is_default?: boolean;
  search?: string;
  sort_by?: 'name' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

export interface AppointmentsQueryParams {
  page?: number;
  limit?: number;
  status?: AppointmentStatus;
  lead_id?: string;
  date_from?: string; // YYYY-MM-DD
  date_to?: string; // YYYY-MM-DD
  sort_by?: 'scheduled_date' | 'created_at' | 'updated_at';
  sort_order?: 'asc' | 'desc';
}

export interface AvailabilityQueryParams {
  appointment_type_id: string;
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
}

export interface SyncLogsQueryParams {
  page?: number;
  limit?: number;
  status?: SyncLogStatus;
  direction?: SyncDirection;
  action?: string;
}

// ============================================================================
// External Blocks (Sprint 31)
// ============================================================================

export interface ExternalBlock {
  id: string;
  start_datetime_utc: string; // ISO 8601 format
  end_datetime_utc: string; // ISO 8601 format
  is_all_day: boolean;
  source: string; // e.g., "google_calendar"
}

export interface ExternalBlocksResponse {
  date_range: {
    from: string; // YYYY-MM-DD
    to: string; // YYYY-MM-DD
  };
  data: ExternalBlock[];
  total_blocks: number;
}

export interface ExternalBlocksQueryParams {
  date_from: string; // YYYY-MM-DD
  date_to: string; // YYYY-MM-DD
  appointment_type_id?: string; // Optional, reserved for future use
}
