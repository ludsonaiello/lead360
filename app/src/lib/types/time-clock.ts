// Lead360 — Time Clock Module Type Definitions
// Source of truth: live API responses from /api/v1/time-clock/*
// Reference: api/documentation/time-clock_REST_API.md
//
// NOTE ON NUMERIC FIELDS — Several fields that map to Prisma `Decimal` columns
// are returned as STRINGS (e.g. "8.00", "35.00", "42.5197446"). Reports, by
// contrast, return currency/hour fields as JSON numbers. The types below
// reflect this asymmetry exactly as the backend serializes it.

// ==================================================================
// ENUMS
// ==================================================================

export type ClockInMode = 'anywhere' | 'specific_addresses' | 'active_job_sites';
export type GeofenceViolationAction = 'block' | 'warn_only';
export type GpsUnavailableAction = 'block' | 'allow_flagged';
export type PayPeriodType = 'weekly' | 'biweekly' | 'semimonthly' | 'monthly';
export type ClockSessionStatus = 'active' | 'on_break' | 'completed';
export type LocationSource = 'browser_gps' | 'native_gps' | 'kiosk' | 'manual';
export type GeofenceStatus = 'inside' | 'outside' | 'unavailable' | 'not_enforced';
export type WorkShiftStatus = 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'cancelled';
export type BreakType = 'paid' | 'unpaid';
export type DisputeType = 'flag_only' | 'correction_request';
export type DisputeStatus = 'pending' | 'approved' | 'rejected' | 'resolved';
export type AddressSource = 'manual' | 'imported_from_quote' | 'imported_from_lead';
export type EditFieldType = 'clock_in_at' | 'clock_out_at' | 'project_id' | 'task_id' | 'notes';

export type ActivityEventType =
  | 'clock_in'
  | 'clock_out'
  | 'break_start'
  | 'break_end'
  | 'dispute_submitted'
  | 'dispute_approved'
  | 'dispute_rejected'
  | 'manual_edit'
  | 'shift_missed';

// ==================================================================
// SHARED / PAGINATION
// ==================================================================

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface SimpleDataResponse<T> {
  data: T;
}

// ==================================================================
// EMBEDDED REFERENCES (from Prisma includes)
// ==================================================================

export interface UserRef {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
}

export interface CrewMemberRef {
  id: string;
  first_name: string;
  last_name: string;
  default_hourly_rate?: string | null;
}

export interface ProjectRef {
  id: string;
  name: string;
  project_number?: string;
  status?: string;
}

export interface TaskRef {
  id: string;
  title: string;
}

export interface WorkShiftRef {
  id: string;
  scheduled_start: string;
  scheduled_end: string;
  status: WorkShiftStatus;
  title?: string | null;
}

export interface ClockinAddressRef {
  id: string;
  label: string;
  latitude?: string | null;
  longitude?: string | null;
}

// ==================================================================
// TIME CLOCK SETTINGS
// ==================================================================

export interface TimeClockSettings {
  id: string | null;
  tenant_id: string;
  clock_in_mode: ClockInMode;
  geofence_violation_action: GeofenceViolationAction;
  gps_required: boolean;
  gps_unavailable_action: GpsUnavailableAction;
  require_job_tag: boolean;
  require_task_tag: boolean;
  overtime_enabled: boolean;
  /** Decimal string, e.g. "8.00" */
  overtime_daily_threshold_hours: string;
  /** Decimal string, e.g. "40.00" */
  overtime_weekly_threshold_hours: string;
  /** Decimal string, e.g. "1.50" */
  overtime_multiplier: string;
  pay_period_type: PayPeriodType;
  pay_period_start_day: number | null;
  pay_period_anchor_date: string | null;
  kiosk_mode_enabled: boolean;
  /** bcrypt hash — never display to users */
  kiosk_token_hash: string | null;
  shift_reminder_minutes: number;
  missed_shift_threshold_minutes: number;
  native_app_features_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface UpdateTimeClockSettingsRequest {
  clock_in_mode?: ClockInMode;
  geofence_violation_action?: GeofenceViolationAction;
  gps_required?: boolean;
  gps_unavailable_action?: GpsUnavailableAction;
  require_job_tag?: boolean;
  require_task_tag?: boolean;
  overtime_enabled?: boolean;
  overtime_daily_threshold_hours?: number;
  overtime_weekly_threshold_hours?: number;
  overtime_multiplier?: number;
  pay_period_type?: PayPeriodType;
  pay_period_start_day?: number;
  pay_period_anchor_date?: string;
  kiosk_mode_enabled?: boolean;
  shift_reminder_minutes?: number;
  missed_shift_threshold_minutes?: number;
}

export interface RegenerateKioskTokenResponse {
  kiosk_token: string;
}

// ==================================================================
// EMPLOYEE PROFILE
// ==================================================================

export interface EmployeeProfile {
  id: string;
  tenant_id: string;
  user_id: string;
  crew_member_id: string | null;
  /** Decimal string, e.g. "35.00" */
  hourly_rate: string | null;
  overtime_rule_override: boolean;
  overtime_daily_threshold_hours: string | null;
  overtime_weekly_threshold_hours: string | null;
  /** `true` if the employee has a kiosk PIN set. `kiosk_pin_hash` is never serialized. */
  has_pin: boolean;
  /** `true` if `kiosk_pin_locked_until` is in the future (backend-computed at response time). */
  is_locked: boolean;
  kiosk_pin_failed_attempts: number;
  kiosk_pin_locked_until: string | null;
  is_active: boolean;
  push_token_native?: string | null;
  created_at: string;
  updated_at: string;
  user?: UserRef;
  crew_member?: CrewMemberRef | null;
}

export interface ListEmployeeProfilesParams {
  page?: number;
  limit?: number;
  is_active?: boolean;
  search?: string;
}

export interface CreateEmployeeProfileRequest {
  user_id: string;
  crew_member_id?: string;
  hourly_rate?: number;
  overtime_rule_override?: boolean;
  overtime_daily_threshold_hours?: number;
  overtime_weekly_threshold_hours?: number;
}

export interface UpdateEmployeeProfileRequest {
  crew_member_id?: string | null;
  hourly_rate?: number | null;
  overtime_rule_override?: boolean;
  overtime_daily_threshold_hours?: number | null;
  overtime_weekly_threshold_hours?: number | null;
  is_active?: boolean;
}

export interface SetEmployeePinRequest {
  pin: string;
}

export interface SavePushSubscriptionRequest {
  // Live API at POST /time-clock/employees/me/push-subscription accepts only
  // `push_subscription_json` (required, non-empty). Docs use the same name.
  push_subscription_json: string;
}

// ==================================================================
// CLOCK-IN ADDRESS
// ==================================================================

export interface ClockinAddress {
  id: string;
  tenant_id: string;
  project_id: string | null;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  /** Decimal string, e.g. "42.5197446" */
  latitude: string | null;
  /** Decimal string, e.g. "-71.748565" */
  longitude: string | null;
  radius_meters: number;
  is_active: boolean;
  source: AddressSource;
  source_address_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  project?: ProjectRef | null;
}

// Live API only accepts these query params. `source`, `sort_by`, `sort_order`
// are all rejected with 400 ("property X should not exist"). All other
// filtering / sorting must be done client-side.
export interface ListClockinAddressesParams {
  page?: number;
  limit?: number;
  is_active?: boolean;
  project_id?: string;
  search?: string;
}

export interface CreateClockinAddressRequest {
  label: string;
  address_line1: string;
  address_line2?: string;
  city: string;
  state: string;
  zip_code: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  project_id?: string;
}

export interface UpdateClockinAddressRequest {
  label?: string;
  address_line1?: string;
  address_line2?: string | null;
  city?: string;
  state?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;
  radius_meters?: number;
  is_active?: boolean;
  project_id?: string | null;
}

export interface ImportAddressFromQuoteRequest {
  quote_id: string;
  label: string;
  radius_meters?: number;
  project_id?: string;
}

export interface ImportAddressFromLeadRequest {
  lead_address_id: string;
  label: string;
  radius_meters?: number;
  project_id?: string;
}

// ==================================================================
// EMPLOYEE-PROJECT ASSIGNMENT
// ==================================================================

export interface EmployeeProjectAssignment {
  id: string;
  tenant_id: string;
  employee_profile_id: string;
  project_id: string;
  assigned_by_user_id: string;
  created_at: string;
  employee_profile?: EmployeeProfile;
  project?: ProjectRef;
}

export interface ListEmployeeProjectsParams {
  page?: number;
  limit?: number;
  employee_profile_id?: string;
  project_id?: string;
}

export interface CreateEmployeeProjectRequest {
  employee_profile_id: string;
  project_id: string;
}

// ==================================================================
// WORK SHIFT
// ==================================================================

export interface WorkShift {
  id: string;
  tenant_id: string;
  employee_profile_id: string;
  project_id: string | null;
  task_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  title: string | null;
  notes: string | null;
  status: WorkShiftStatus;
  reminder_sent_at: string | null;
  published_at: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  employee_profile?: EmployeeProfile;
  project?: ProjectRef | null;
  task?: TaskRef | null;
}

export interface ShiftFilterParams {
  page?: number;
  limit?: number;
  employee_profile_id?: string;
  project_id?: string;
  status?: WorkShiftStatus;
  date_from?: string;
  date_to?: string;
}

export interface CreateShiftRequest {
  employee_profile_id: string;
  scheduled_start: string;
  scheduled_end: string;
  project_id?: string;
  task_id?: string;
  title?: string;
  notes?: string;
}

export interface UpdateShiftRequest {
  employee_profile_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  project_id?: string | null;
  task_id?: string | null;
  title?: string | null;
  notes?: string | null;
  status?: WorkShiftStatus;
}

export interface BulkCreateShiftsRequest {
  shifts: CreateShiftRequest[];
}

export interface BulkCreateShiftsFormData {
  employee_profile_ids: string[];
  date_from: string;
  date_to: string;
  start_time: string;
  end_time: string;
  project_id?: string;
  task_id?: string;
  title?: string;
  exclude_weekends?: boolean;
}

export interface BulkCreateShiftsResponse {
  created: number;
  shifts: WorkShift[];
}

// ==================================================================
// CLOCK SESSION
// ==================================================================

export interface BreakEntry {
  id: string;
  tenant_id: string;
  clock_session_id: string;
  break_type: BreakType;
  break_label: string | null;
  started_at: string;
  ended_at: string | null;
  duration_minutes: number | null;
  created_at: string;
  updated_at: string;
}

export interface ClockSessionEditLog {
  id: string;
  tenant_id: string;
  clock_session_id: string;
  edited_by_user_id: string;
  field_changed: EditFieldType | string;
  original_value: string | null;
  new_value: string | null;
  reason: string;
  edited_at: string;
  edited_by?: UserRef;
}

export interface ClockSession {
  id: string;
  tenant_id: string;
  employee_profile_id: string;
  work_shift_id: string | null;
  project_id: string | null;
  task_id: string | null;
  clockin_address_id: string | null;
  status: ClockSessionStatus;
  clock_in_at: string;
  clock_out_at: string | null;
  /** Decimal string */
  clock_in_latitude: string | null;
  clock_in_longitude: string | null;
  clock_in_location_source: LocationSource;
  clock_in_geofence_status: GeofenceStatus;
  clock_out_latitude: string | null;
  clock_out_longitude: string | null;
  clock_out_location_source: LocationSource | null;
  clock_out_geofence_status: GeofenceStatus | null;
  total_worked_minutes: number | null;
  regular_minutes: number | null;
  overtime_minutes: number | null;
  is_manual_edit: boolean;
  is_flagged: boolean;
  flag_reason: string | null;
  labor_cost_posted: boolean;
  labor_cost_entry_id: string | null;
  labor_cost_reconciliation_needed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  employee_profile?: EmployeeProfile;
  project?: ProjectRef | null;
  task?: TaskRef | null;
  work_shift?: WorkShiftRef | null;
  clockin_address?: ClockinAddressRef | null;
  break_entries?: BreakEntry[];
  edit_logs?: ClockSessionEditLog[];
  disputes?: TimeDispute[];
}

export interface SessionFilterParams {
  page?: number;
  limit?: number;
  employee_profile_id?: string;
  project_id?: string;
  status?: ClockSessionStatus;
  date_from?: string;
  date_to?: string;
  is_flagged?: boolean;
  is_manual_edit?: boolean;
  search?: string;
}

export interface ClockInRequest {
  latitude?: number;
  longitude?: number;
  location_source: LocationSource;
  project_id?: string;
  task_id?: string;
  clockin_address_id?: string;
  notes?: string;
}

export interface ClockOutRequest {
  latitude?: number;
  longitude?: number;
  location_source?: LocationSource;
  notes?: string;
}

export interface EditSessionRequest {
  clock_in_at?: string;
  clock_out_at?: string;
  project_id?: string | null;
  task_id?: string | null;
  notes?: string | null;
  reason: string;
}

export interface AvailableProjectAddress {
  id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  /** Decimal string, e.g. "26.12240000" */
  latitude: string | null;
  longitude: string | null;
  radius_meters: number;
}

export interface AvailableProject {
  id: string;
  name: string;
  project_number: string;
  clockin_addresses?: AvailableProjectAddress[];
}

export interface ActiveSessionsResponse {
  data: ClockSession[];
  total: number;
}

// ==================================================================
// BREAKS
// ==================================================================

export interface StartBreakRequest {
  break_type: BreakType;
  break_label?: string;
}

// ==================================================================
// DISPUTES
// ==================================================================

export interface TimeDispute {
  id: string;
  tenant_id: string;
  clock_session_id: string;
  submitted_by_user_id: string;
  dispute_type: DisputeType;
  description: string;
  proposed_clock_in_at: string | null;
  proposed_clock_out_at: string | null;
  proposed_project_id: string | null;
  proposed_task_id: string | null;
  proposed_notes: string | null;
  status: DisputeStatus;
  reviewed_by_user_id: string | null;
  review_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  clock_session?: ClockSession | null;
  submitted_by?: UserRef;
  reviewed_by?: UserRef | null;
}

export interface DisputeFilterParams {
  page?: number;
  limit?: number;
  status?: DisputeStatus;
  dispute_type?: DisputeType;
  employee_profile_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface SubmitDisputeRequest {
  dispute_type: DisputeType;
  description: string;
  proposed_clock_in_at?: string;
  proposed_clock_out_at?: string;
  proposed_project_id?: string;
  proposed_task_id?: string;
  proposed_notes?: string;
}

export interface ApproveDisputeRequest {
  review_notes?: string;
}

export interface RejectDisputeRequest {
  review_notes: string;
}

// ==================================================================
// KIOSK
// ==================================================================

export interface KioskEmployee {
  id: string;
  user: { first_name: string; last_name: string };
  has_pin: boolean;
  is_clocked_in: boolean;
}

export interface KioskEmployeesResponse {
  data: KioskEmployee[];
}

export interface KioskClockInRequest {
  employee_profile_id: string;
  pin: string;
  project_id?: string;
  task_id?: string;
  notes?: string;
}

export interface KioskClockOutRequest {
  employee_profile_id: string;
  pin: string;
  notes?: string;
}

// ==================================================================
// DASHBOARD — WHO'S IN
// ==================================================================

export interface WhosInCurrentBreak {
  id: string;
  break_type: BreakType;
  break_label: string | null;
  started_at: string;
}

export interface WhosInSession {
  id: string;
  status: ClockSessionStatus;
  clock_in_at: string;
  elapsed_minutes: number;
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
  clockin_address: { label: string } | null;
  is_flagged: boolean;
  current_break: WhosInCurrentBreak | null;
}

export interface WhosInEmployee {
  employee_profile_id: string;
  user: UserRef;
  session: WhosInSession;
}

export interface WhosInResponse {
  total_clocked_in: number;
  total_on_break: number;
  employees: WhosInEmployee[];
}

export interface WhosInParams {
  project_id?: string;
  status?: ClockSessionStatus;
}

// ==================================================================
// REPORTS
// ==================================================================

export interface ReportFilterParams {
  date_from: string;
  date_to: string;
  employee_profile_id?: string;
  project_id?: string;
}

export interface PayrollFilterParams {
  date_from: string;
  date_to: string;
  employee_profile_id?: string;
}

// Timesheet report — grouped by employee → days → sessions
export interface TimesheetDaySession {
  id: string;
  clock_in_at: string;
  clock_out_at: string | null;
  total_worked_minutes: number;
  regular_minutes: number;
  overtime_minutes: number;
  project: { id: string; name: string } | null;
  task: { id: string; title: string } | null;
  is_flagged: boolean;
  is_manual_edit: boolean;
}

export interface TimesheetDay {
  date: string;
  sessions: TimesheetDaySession[];
  day_regular_minutes: number;
  day_overtime_minutes: number;
  day_total_minutes: number;
}

export interface TimesheetEmployee {
  employee_profile_id: string;
  user: UserRef;
  total_regular_minutes: number;
  total_overtime_minutes: number;
  total_sessions: number;
  days: TimesheetDay[];
}

export interface TimesheetReport {
  date_from: string;
  date_to: string;
  employees: TimesheetEmployee[];
}

// Payroll report
export interface PayrollSummary {
  total_employees: number;
  total_regular_hours: number;
  total_overtime_hours: number;
  total_regular_pay: number;
  total_overtime_pay: number;
  total_pay: number;
}

export interface PayrollEmployee {
  employee_profile_id: string;
  user: UserRef;
  hourly_rate: number;
  regular_hours: number;
  overtime_hours: number;
  overtime_multiplier: number;
  regular_pay: number;
  overtime_pay: number;
  total_pay: number;
  sessions_count: number;
  flagged_sessions: number;
  manual_edits: number;
}

export interface PayrollReport {
  date_from: string;
  date_to: string;
  summary: PayrollSummary;
  employees: PayrollEmployee[];
}

// Shift variance report
export interface ShiftVarianceEntry {
  work_shift_id: string;
  employee_profile_id: string;
  user: UserRef;
  project: { id: string; name: string } | null;
  scheduled_start: string;
  scheduled_end: string;
  scheduled_minutes: number;
  actual_clock_in_at: string | null;
  actual_clock_out_at: string | null;
  actual_worked_minutes: number | null;
  variance_start_minutes: number | null;
  variance_end_minutes: number | null;
  variance_total_minutes: number | null;
  shift_status: WorkShiftStatus;
  session_id: string | null;
}

export interface ShiftVarianceReport {
  date_from: string;
  date_to: string;
  data: ShiftVarianceEntry[];
  meta: PaginationMeta;
}

export interface ShiftVarianceFilterParams extends ReportFilterParams {
  page?: number;
  limit?: number;
}

// Geo-violations report
export interface GeoViolationEntry {
  session_id: string;
  employee_profile_id: string;
  user: UserRef;
  clock_in_at: string;
  clock_in_latitude: number | null;
  clock_in_longitude: number | null;
  clock_in_geofence_status: GeofenceStatus;
  is_flagged: boolean;
  flag_reason: string | null;
  nearest_address: {
    id: string;
    label: string;
    distance_meters: number;
  } | null;
  project: { id: string; name: string } | null;
  status: ClockSessionStatus;
}

export interface GeoViolationsReport {
  data: GeoViolationEntry[];
  meta: PaginationMeta;
}

export interface GeoViolationsFilterParams {
  date_from: string;
  date_to: string;
  employee_profile_id?: string;
  page?: number;
  limit?: number;
}

// Activity feed
export interface ActivityFeedEntry {
  event_type: ActivityEventType;
  timestamp: string;
  employee_profile_id: string;
  user: UserRef;
  session_id: string | null;
  project: { id: string; name: string } | null;
  details: Record<string, unknown>;
}

export interface ActivityFeedResponse {
  data: ActivityFeedEntry[];
}

export interface ActivityFeedParams {
  limit?: number;
  employee_profile_id?: string;
  after?: string;
}
