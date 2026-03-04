// ============================================================================
// Calendar & Scheduling API Client
// ============================================================================
// This file contains all API methods for the Calendar & Scheduling module.
// Methods are organized by category and match the backend API documentation.
// ============================================================================

import apiClient from './axios';
import type {
  // Appointment Types
  AppointmentType,
  AppointmentTypeWithSchedules,
  AppointmentTypeSchedule,
  CreateAppointmentTypeRequest,
  UpdateAppointmentTypeRequest,
  BulkUpdateScheduleRequest,
  UpdateDayScheduleRequest,
  AppointmentTypesListResponse,
  AppointmentTypesQueryParams,

  // Appointments
  Appointment,
  AppointmentWithRelations,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
  ConfirmAppointmentRequest,
  CancelAppointmentRequest,
  RescheduleAppointmentRequest,
  RescheduleAppointmentResponse,
  CompleteAppointmentRequest,
  NoShowAppointmentRequest,
  AppointmentsListResponse,
  AppointmentsQueryParams,

  // Availability
  AvailabilityResponse,
  AvailabilityQueryParams,

  // External Blocks
  ExternalBlocksResponse,
  ExternalBlocksQueryParams,

  // Dashboard
  DashboardUpcomingResponse,
  DashboardNewAppointmentsResponse,
  AcknowledgeAppointmentResponse,

  // Google Calendar Integration
  GoogleAuthUrlResponse,
  GoogleCalendarsListResponse,
  ConnectGoogleCalendarRequest,
  ConnectGoogleCalendarResponse,
  DisconnectGoogleCalendarResponse,
  ManualSyncResponse,
  TestConnectionResponse,

  // Integration Status
  CalendarIntegrationStatusResponse,
  CalendarIntegrationHealthResponse,

  // Sync Logs
  SyncLogsListResponse,
  SyncLogsQueryParams,
} from '../types/calendar';

// ============================================================================
// Appointment Types Management
// Base path: /calendar/appointment-types
// ============================================================================

/**
 * List all appointment types for the current tenant
 *
 * @param params - Optional query parameters
 * @returns Promise<AppointmentTypesListResponse>
 *
 * @example
 * const types = await calendarApi.getAppointmentTypes({ is_active: true });
 */
export const getAppointmentTypes = async (
  params?: AppointmentTypesQueryParams
): Promise<AppointmentTypesListResponse> => {
  const { data } = await apiClient.get('/calendar/appointment-types', { params });
  return data;
};

/**
 * Get a single appointment type by ID with schedules
 *
 * @param typeId - Appointment Type UUID
 * @returns Promise<AppointmentTypeWithSchedules>
 *
 * @example
 * const type = await calendarApi.getAppointmentType('type-id-123');
 */
export const getAppointmentType = async (
  typeId: string
): Promise<AppointmentTypeWithSchedules> => {
  const { data } = await apiClient.get(`/calendar/appointment-types/${typeId}`);
  return data;
};

/**
 * Create a new appointment type
 *
 * @param request - Appointment type data
 * @returns Promise<AppointmentTypeWithSchedules>
 *
 * @example
 * const type = await calendarApi.createAppointmentType({
 *   name: 'Quote Visit',
 *   slot_duration_minutes: 90
 * });
 */
export const createAppointmentType = async (
  request: CreateAppointmentTypeRequest
): Promise<AppointmentTypeWithSchedules> => {
  const { data } = await apiClient.post('/calendar/appointment-types', request);
  return data;
};

/**
 * Update an existing appointment type
 *
 * @param typeId - Appointment Type UUID
 * @param request - Partial appointment type data
 * @returns Promise<AppointmentTypeWithSchedules>
 *
 * @example
 * const type = await calendarApi.updateAppointmentType('type-id-123', {
 *   slot_duration_minutes: 120
 * });
 */
export const updateAppointmentType = async (
  typeId: string,
  request: UpdateAppointmentTypeRequest
): Promise<AppointmentTypeWithSchedules> => {
  const { data } = await apiClient.patch(`/calendar/appointment-types/${typeId}`, request);
  return data;
};

/**
 * Delete (soft-delete) an appointment type
 *
 * @param typeId - Appointment Type UUID
 * @returns Promise<void>
 *
 * @example
 * await calendarApi.deleteAppointmentType('type-id-123');
 */
export const deleteAppointmentType = async (typeId: string): Promise<void> => {
  await apiClient.delete(`/calendar/appointment-types/${typeId}`);
};

// ============================================================================
// Appointment Type Schedules
// Base path: /calendar/appointment-types/:typeId/schedule
// ============================================================================

/**
 * Get the weekly schedule for an appointment type
 *
 * @param typeId - Appointment Type UUID
 * @returns Promise<AppointmentTypeSchedule[]>
 *
 * @example
 * const schedule = await calendarApi.getAppointmentTypeSchedule('type-id-123');
 */
export const getAppointmentTypeSchedule = async (
  typeId: string
): Promise<AppointmentTypeSchedule[]> => {
  const { data } = await apiClient.get(`/calendar/appointment-types/${typeId}/schedule`);
  return data;
};

/**
 * Bulk update the entire weekly schedule (all 7 days)
 *
 * @param typeId - Appointment Type UUID
 * @param request - Array of 7 schedule objects (one per day)
 * @returns Promise<AppointmentTypeSchedule[]>
 *
 * @example
 * const schedules = await calendarApi.bulkUpdateSchedule('type-id-123', {
 *   schedules: [
 *     { day_of_week: 0, is_available: false, window1_start: null, window1_end: null },
 *     { day_of_week: 1, is_available: true, window1_start: '09:00', window1_end: '17:00' },
 *     // ... 5 more days
 *   ]
 * });
 */
export const bulkUpdateSchedule = async (
  typeId: string,
  request: BulkUpdateScheduleRequest
): Promise<AppointmentTypeSchedule[]> => {
  const { data } = await apiClient.put(`/calendar/appointment-types/${typeId}/schedule`, request);
  return data;
};

/**
 * Update a single day's schedule
 *
 * @param typeId - Appointment Type UUID
 * @param dayOfWeek - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @param request - Schedule data for that day
 * @returns Promise<AppointmentTypeSchedule>
 *
 * @example
 * const schedule = await calendarApi.updateDaySchedule('type-id-123', 1, {
 *   is_available: true,
 *   window1_start: '09:00',
 *   window1_end: '17:00'
 * });
 */
export const updateDaySchedule = async (
  typeId: string,
  dayOfWeek: number,
  request: UpdateDayScheduleRequest
): Promise<AppointmentTypeSchedule> => {
  const { data } = await apiClient.patch(
    `/calendar/appointment-types/${typeId}/schedule/${dayOfWeek}`,
    request
  );
  return data;
};

// ============================================================================
// Appointments CRUD
// Base path: /calendar/appointments
// ============================================================================

/**
 * List appointments with optional filters
 *
 * @param params - Optional query parameters
 * @returns Promise<AppointmentsListResponse>
 *
 * @example
 * const appointments = await calendarApi.getAppointments({
 *   status: 'scheduled',
 *   date_from: '2026-03-01',
 *   date_to: '2026-03-31'
 * });
 */
export const getAppointments = async (
  params?: AppointmentsQueryParams
): Promise<AppointmentsListResponse> => {
  const { data } = await apiClient.get('/calendar/appointments', { params });
  return data;
};

/**
 * Get a single appointment by ID with full details
 *
 * @param appointmentId - Appointment UUID
 * @returns Promise<AppointmentWithRelations>
 *
 * @example
 * const appointment = await calendarApi.getAppointment('appt-id-123');
 */
export const getAppointment = async (
  appointmentId: string
): Promise<AppointmentWithRelations> => {
  const { data } = await apiClient.get(`/calendar/appointments/${appointmentId}`);
  return data;
};

/**
 * Create (book) a new appointment
 *
 * @param request - Appointment data
 * @returns Promise<AppointmentWithRelations>
 *
 * @example
 * const appointment = await calendarApi.createAppointment({
 *   appointment_type_id: 'type-id-123',
 *   lead_id: 'lead-id-456',
 *   scheduled_date: '2026-03-15',
 *   start_time: '09:00',
 *   end_time: '10:30'
 * });
 */
export const createAppointment = async (
  request: CreateAppointmentRequest
): Promise<AppointmentWithRelations> => {
  const { data } = await apiClient.post('/calendar/appointments', request);
  return data;
};

/**
 * Update an existing appointment (notes, assigned user)
 *
 * @param appointmentId - Appointment UUID
 * @param request - Partial appointment data
 * @returns Promise<AppointmentWithRelations>
 *
 * @example
 * const appointment = await calendarApi.updateAppointment('appt-id-123', {
 *   notes: 'Customer requested morning slot'
 * });
 */
export const updateAppointment = async (
  appointmentId: string,
  request: UpdateAppointmentRequest
): Promise<AppointmentWithRelations> => {
  const { data } = await apiClient.patch(`/calendar/appointments/${appointmentId}`, request);
  return data;
};

// ============================================================================
// Appointment Actions (State Transitions)
// Base path: /calendar/appointments/:id/[action]
// ============================================================================

/**
 * Confirm an appointment (scheduled → confirmed)
 *
 * @param appointmentId - Appointment UUID
 * @param request - Optional confirmation notes
 * @returns Promise<AppointmentWithRelations>
 *
 * @example
 * const appointment = await calendarApi.confirmAppointment('appt-id-123', {
 *   notes: 'Confirmed via phone'
 * });
 */
export const confirmAppointment = async (
  appointmentId: string,
  request?: ConfirmAppointmentRequest
): Promise<AppointmentWithRelations> => {
  const { data } = await apiClient.post(
    `/calendar/appointments/${appointmentId}/confirm`,
    request || {}
  );
  return data;
};

/**
 * Cancel an appointment with reason
 *
 * @param appointmentId - Appointment UUID
 * @param request - Cancellation reason and notes
 * @returns Promise<AppointmentWithRelations>
 *
 * @example
 * const appointment = await calendarApi.cancelAppointment('appt-id-123', {
 *   cancellation_reason: 'customer_cancelled',
 *   cancellation_notes: 'Customer found another contractor'
 * });
 */
export const cancelAppointment = async (
  appointmentId: string,
  request: CancelAppointmentRequest
): Promise<AppointmentWithRelations> => {
  const { data } = await apiClient.post(
    `/calendar/appointments/${appointmentId}/cancel`,
    request
  );
  return data;
};

/**
 * Reschedule an appointment to a new time
 *
 * @param appointmentId - Appointment UUID
 * @param request - New date/time and optional reason
 * @returns Promise<RescheduleAppointmentResponse>
 *
 * @example
 * const result = await calendarApi.rescheduleAppointment('appt-id-123', {
 *   new_scheduled_date: '2026-03-20',
 *   new_start_time: '14:00',
 *   reason: 'Customer requested afternoon slot'
 * });
 */
export const rescheduleAppointment = async (
  appointmentId: string,
  request: RescheduleAppointmentRequest
): Promise<RescheduleAppointmentResponse> => {
  const { data } = await apiClient.post(
    `/calendar/appointments/${appointmentId}/reschedule`,
    request
  );
  return data;
};

/**
 * Mark an appointment as completed
 *
 * @param appointmentId - Appointment UUID
 * @param request - Optional completion notes
 * @returns Promise<AppointmentWithRelations>
 *
 * @example
 * const appointment = await calendarApi.completeAppointment('appt-id-123', {
 *   completion_notes: 'Quote visit completed successfully'
 * });
 */
export const completeAppointment = async (
  appointmentId: string,
  request?: CompleteAppointmentRequest
): Promise<AppointmentWithRelations> => {
  const { data } = await apiClient.post(
    `/calendar/appointments/${appointmentId}/complete`,
    request || {}
  );
  return data;
};

/**
 * Mark an appointment as no-show
 *
 * @param appointmentId - Appointment UUID
 * @param request - Optional notes
 * @returns Promise<AppointmentWithRelations>
 *
 * @example
 * const appointment = await calendarApi.markNoShow('appt-id-123', {
 *   notes: 'Customer did not arrive'
 * });
 */
export const markNoShow = async (
  appointmentId: string,
  request?: NoShowAppointmentRequest
): Promise<AppointmentWithRelations> => {
  const { data } = await apiClient.post(
    `/calendar/appointments/${appointmentId}/no-show`,
    request || {}
  );
  return data;
};

// ============================================================================
// Availability
// Base path: /calendar/availability
// ============================================================================

/**
 * Get available time slots for a date range and appointment type
 *
 * @param params - Query parameters (appointment_type_id, date_from, date_to)
 * @returns Promise<AvailabilityResponse>
 *
 * @example
 * const availability = await calendarApi.getAvailability({
 *   appointment_type_id: 'type-id-123',
 *   date_from: '2026-03-01',
 *   date_to: '2026-03-15'
 * });
 */
export const getAvailability = async (
  params: AvailabilityQueryParams
): Promise<AvailabilityResponse> => {
  const { data } = await apiClient.get('/calendar/availability', { params });
  return data;
};

// ============================================================================
// External Blocks (Sprint 31)
// Base path: /calendar/external-blocks
// ============================================================================

/**
 * Get external calendar blocks for visual display
 *
 * @param params - Query parameters (date_from, date_to, appointment_type_id)
 * @returns Promise<ExternalBlocksResponse>
 *
 * @example
 * const blocks = await calendarApi.getExternalBlocks({
 *   date_from: '2026-03-01',
 *   date_to: '2026-03-31'
 * });
 */
export const getExternalBlocks = async (
  params: ExternalBlocksQueryParams
): Promise<ExternalBlocksResponse> => {
  const { data } = await apiClient.get('/calendar/external-blocks', { params });
  return data;
};

// ============================================================================
// Dashboard Widgets
// Base path: /calendar/dashboard
// ============================================================================

/**
 * Get upcoming appointments for dashboard banner
 *
 * @param limit - Number of appointments to return (default: 5)
 * @returns Promise<DashboardUpcomingResponse>
 *
 * @example
 * const upcoming = await calendarApi.getDashboardUpcoming(5);
 */
export const getDashboardUpcoming = async (
  limit: number = 5
): Promise<DashboardUpcomingResponse> => {
  const { data } = await apiClient.get('/calendar/dashboard/upcoming', {
    params: { limit },
  });
  return data;
};

/**
 * Get new appointments (not yet acknowledged)
 *
 * @param limit - Number of appointments to return (default: 10)
 * @returns Promise<DashboardNewAppointmentsResponse>
 *
 * @example
 * const newAppointments = await calendarApi.getDashboardNew(10);
 */
export const getDashboardNew = async (
  limit: number = 10
): Promise<DashboardNewAppointmentsResponse> => {
  const { data } = await apiClient.get('/calendar/dashboard/new', {
    params: { limit },
  });
  return data;
};

/**
 * Acknowledge a new appointment (mark as seen)
 *
 * @param appointmentId - Appointment UUID
 * @returns Promise<AcknowledgeAppointmentResponse>
 *
 * @example
 * await calendarApi.acknowledgeAppointment('appt-id-123');
 */
export const acknowledgeAppointment = async (
  appointmentId: string
): Promise<AcknowledgeAppointmentResponse> => {
  const { data } = await apiClient.patch(
    `/calendar/dashboard/new/${appointmentId}/acknowledge`
  );
  return data;
};

// ============================================================================
// Google Calendar Integration
// Base path: /calendar/integration/google
// ============================================================================

/**
 * Generate Google OAuth authorization URL
 *
 * @returns Promise<GoogleAuthUrlResponse>
 *
 * @example
 * const { authUrl } = await calendarApi.getGoogleAuthUrl();
 * window.location.href = authUrl; // Redirect to Google consent screen
 */
export const getGoogleAuthUrl = async (): Promise<GoogleAuthUrlResponse> => {
  const { data } = await apiClient.get('/calendar/integration/google/auth-url');
  return data;
};

/**
 * List available Google Calendars (after OAuth)
 *
 * @returns Promise<GoogleCalendarsListResponse>
 *
 * @example
 * const { calendars } = await calendarApi.listGoogleCalendars();
 */
export const listGoogleCalendars = async (): Promise<GoogleCalendarsListResponse> => {
  const { data } = await apiClient.get('/calendar/integration/google/calendars');
  return data;
};

/**
 * Connect to a specific Google Calendar
 *
 * @param request - Calendar ID and name
 * @returns Promise<ConnectGoogleCalendarResponse>
 *
 * @example
 * const result = await calendarApi.connectGoogleCalendar({
 *   calendarId: 'primary',
 *   calendarName: 'My Calendar'
 * });
 */
export const connectGoogleCalendar = async (
  request: ConnectGoogleCalendarRequest
): Promise<ConnectGoogleCalendarResponse> => {
  const { data } = await apiClient.post('/calendar/integration/google/connect', request);
  return data;
};

/**
 * Disconnect Google Calendar
 *
 * @returns Promise<DisconnectGoogleCalendarResponse>
 *
 * @example
 * await calendarApi.disconnectGoogleCalendar();
 */
export const disconnectGoogleCalendar = async (): Promise<DisconnectGoogleCalendarResponse> => {
  const { data } = await apiClient.delete('/calendar/integration/google/disconnect');
  return data;
};

/**
 * Trigger manual full sync with Google Calendar
 *
 * @returns Promise<ManualSyncResponse>
 *
 * @example
 * await calendarApi.manualSyncGoogleCalendar();
 */
export const manualSyncGoogleCalendar = async (): Promise<ManualSyncResponse> => {
  const { data } = await apiClient.post('/calendar/integration/google/sync');
  return data;
};

/**
 * Test Google Calendar connection health
 *
 * @returns Promise<TestConnectionResponse>
 *
 * @example
 * const result = await calendarApi.testGoogleCalendarConnection();
 */
export const testGoogleCalendarConnection = async (): Promise<TestConnectionResponse> => {
  const { data } = await apiClient.post('/calendar/integration/google/test');
  return data;
};

// ============================================================================
// Calendar Integration Status
// Base path: /calendar/integration/status
// ============================================================================

/**
 * Get current calendar connection status
 *
 * @returns Promise<CalendarIntegrationStatusResponse>
 *
 * @example
 * const status = await calendarApi.getIntegrationStatus();
 * if (status.connected) {
 *   console.log('Connected to:', status.providerType);
 * }
 */
export const getIntegrationStatus = async (): Promise<CalendarIntegrationStatusResponse> => {
  const { data } = await apiClient.get('/calendar/integration/status');
  return data;
};

/**
 * Get calendar integration health
 *
 * @returns Promise<CalendarIntegrationHealthResponse>
 *
 * @example
 * const health = await calendarApi.getIntegrationHealth();
 */
export const getIntegrationHealth = async (): Promise<CalendarIntegrationHealthResponse> => {
  const { data } = await apiClient.get('/calendar/integration/health');
  return data;
};

// ============================================================================
// Sync Logs
// Base path: /calendar/integration/sync-logs
// ============================================================================

/**
 * Get sync operation logs (for debugging)
 *
 * @param params - Optional query parameters
 * @returns Promise<SyncLogsListResponse>
 *
 * @example
 * const logs = await calendarApi.getSyncLogs({ status: 'failed', limit: 50 });
 */
export const getSyncLogs = async (
  params?: SyncLogsQueryParams
): Promise<SyncLogsListResponse> => {
  const { data } = await apiClient.get('/calendar/integration/sync-logs', { params });
  return data;
};

// ============================================================================
// Export all as calendarApi object
// ============================================================================

const calendarApi = {
  // Appointment Types
  getAppointmentTypes,
  getAppointmentType,
  createAppointmentType,
  updateAppointmentType,
  deleteAppointmentType,

  // Appointment Type Schedules
  getAppointmentTypeSchedule,
  bulkUpdateSchedule,
  updateDaySchedule,

  // Appointments CRUD
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,

  // Appointment Actions
  confirmAppointment,
  cancelAppointment,
  rescheduleAppointment,
  completeAppointment,
  markNoShow,

  // Availability
  getAvailability,

  // External Blocks
  getExternalBlocks,

  // Dashboard
  getDashboardUpcoming,
  getDashboardNew,
  acknowledgeAppointment,

  // Google Calendar Integration
  getGoogleAuthUrl,
  listGoogleCalendars,
  connectGoogleCalendar,
  disconnectGoogleCalendar,
  manualSyncGoogleCalendar,
  testGoogleCalendarConnection,

  // Integration Status
  getIntegrationStatus,
  getIntegrationHealth,

  // Sync Logs
  getSyncLogs,
};

export default calendarApi;
