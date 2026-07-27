// Lead360 — Time Clock Module API Client
// Complete coverage: 57 endpoints grouped by resource
// Reference: api/documentation/time-clock_REST_API.md
// All functions fully typed against live API responses (see lib/types/time-clock.ts)

import axios from 'axios';
import { apiClient } from './axios';
import type {
  // Settings
  TimeClockSettings,
  UpdateTimeClockSettingsRequest,
  RegenerateKioskTokenResponse,
  // Employee profiles
  EmployeeProfile,
  ListEmployeeProfilesParams,
  CreateEmployeeProfileRequest,
  UpdateEmployeeProfileRequest,
  SetEmployeePinRequest,
  SavePushSubscriptionRequest,
  // Addresses
  ClockinAddress,
  ListClockinAddressesParams,
  CreateClockinAddressRequest,
  UpdateClockinAddressRequest,
  ImportAddressFromQuoteRequest,
  ImportAddressFromLeadRequest,
  // Employee-project assignments
  EmployeeProjectAssignment,
  ListEmployeeProjectsParams,
  CreateEmployeeProjectRequest,
  // Shifts
  WorkShift,
  ShiftFilterParams,
  CreateShiftRequest,
  UpdateShiftRequest,
  BulkCreateShiftsRequest,
  BulkCreateShiftsResponse,
  // Sessions
  ClockSession,
  SessionFilterParams,
  ClockInRequest,
  ClockOutRequest,
  EditSessionRequest,
  AvailableProject,
  ActiveSessionsResponse,
  // Breaks
  BreakEntry,
  StartBreakRequest,
  // Disputes
  TimeDispute,
  DisputeFilterParams,
  SubmitDisputeRequest,
  ApproveDisputeRequest,
  RejectDisputeRequest,
  // Kiosk
  KioskEmployeesResponse,
  KioskClockInRequest,
  KioskClockOutRequest,
  // Dashboard
  WhosInResponse,
  WhosInParams,
  // Reports
  ReportFilterParams,
  PayrollFilterParams,
  TimesheetReport,
  PayrollReport,
  ShiftVarianceReport,
  ShiftVarianceFilterParams,
  GeoViolationsReport,
  GeoViolationsFilterParams,
  ActivityFeedResponse,
  ActivityFeedParams,
  // Shared
  PaginatedResponse,
  SimpleDataResponse,
} from '@/lib/types/time-clock';

// =================================================================
// Kiosk client — no JWT refresh interceptor, uses X-Kiosk-Token
// =================================================================
// Using a plain axios instance here prevents kiosk 401s from hijacking
// the authenticated user's session and redirecting to /login.
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://api.lead360.app/api/v1';

const kioskClient = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

function kioskConfig(token: string) {
  return { headers: { 'X-Kiosk-Token': token } };
}

// =================================================================
// SETTINGS (3 functions)
// =================================================================

export const getTimeClockSettings = async (): Promise<TimeClockSettings> => {
  const { data } = await apiClient.get<TimeClockSettings>('/time-clock/settings');
  return data;
};

export const updateTimeClockSettings = async (
  dto: UpdateTimeClockSettingsRequest,
): Promise<TimeClockSettings> => {
  const { data } = await apiClient.patch<TimeClockSettings>('/time-clock/settings', dto);
  return data;
};

export const regenerateKioskToken = async (): Promise<RegenerateKioskTokenResponse> => {
  const { data } = await apiClient.post<RegenerateKioskTokenResponse>(
    '/time-clock/settings/kiosk-token/regenerate',
  );
  return data;
};

// =================================================================
// EMPLOYEE PROFILES (7 functions)
// =================================================================

export const listEmployeeProfiles = async (
  params?: ListEmployeeProfilesParams,
): Promise<PaginatedResponse<EmployeeProfile>> => {
  const { data } = await apiClient.get<PaginatedResponse<EmployeeProfile>>(
    '/time-clock/employees',
    { params },
  );
  return data;
};

export const createEmployeeProfile = async (
  dto: CreateEmployeeProfileRequest,
): Promise<EmployeeProfile> => {
  const { data } = await apiClient.post<EmployeeProfile>('/time-clock/employees', dto);
  return data;
};

export const getEmployeeProfile = async (id: string): Promise<EmployeeProfile> => {
  const { data } = await apiClient.get<EmployeeProfile>(`/time-clock/employees/${id}`);
  return data;
};

export const updateEmployeeProfile = async (
  id: string,
  dto: UpdateEmployeeProfileRequest,
): Promise<EmployeeProfile> => {
  const { data } = await apiClient.patch<EmployeeProfile>(
    `/time-clock/employees/${id}`,
    dto,
  );
  return data;
};

export const setEmployeePin = async (
  id: string,
  dto: SetEmployeePinRequest,
): Promise<{ success: true }> => {
  const { data } = await apiClient.post<{ success: true }>(
    `/time-clock/employees/${id}/pin`,
    dto,
  );
  return data;
};

export const removeEmployeePin = async (id: string): Promise<{ success: true }> => {
  const { data } = await apiClient.delete<{ success: true }>(
    `/time-clock/employees/${id}/pin`,
  );
  return data;
};

export const savePushSubscription = async (
  dto: SavePushSubscriptionRequest,
): Promise<{ success: true }> => {
  const { data } = await apiClient.post<{ success: true }>(
    '/time-clock/employees/me/push-subscription',
    dto,
  );
  return data;
};

// =================================================================
// CLOCK-IN ADDRESSES (7 functions)
// =================================================================

export const listClockinAddresses = async (
  params?: ListClockinAddressesParams,
): Promise<PaginatedResponse<ClockinAddress>> => {
  const { data } = await apiClient.get<PaginatedResponse<ClockinAddress>>(
    '/time-clock/addresses',
    { params },
  );
  return data;
};

export const createClockinAddress = async (
  dto: CreateClockinAddressRequest,
): Promise<ClockinAddress> => {
  const { data } = await apiClient.post<ClockinAddress>('/time-clock/addresses', dto);
  return data;
};

export const getClockinAddress = async (id: string): Promise<ClockinAddress> => {
  const { data } = await apiClient.get<ClockinAddress>(`/time-clock/addresses/${id}`);
  return data;
};

export const updateClockinAddress = async (
  id: string,
  dto: UpdateClockinAddressRequest,
): Promise<ClockinAddress> => {
  const { data } = await apiClient.patch<ClockinAddress>(
    `/time-clock/addresses/${id}`,
    dto,
  );
  return data;
};

export const deleteClockinAddress = async (id: string): Promise<{ success: true }> => {
  const { data } = await apiClient.delete<{ success: true }>(
    `/time-clock/addresses/${id}`,
  );
  return data;
};

export const importAddressFromQuote = async (
  dto: ImportAddressFromQuoteRequest,
): Promise<ClockinAddress> => {
  const { data } = await apiClient.post<ClockinAddress>(
    '/time-clock/addresses/import-from-quote',
    dto,
  );
  return data;
};

export const importAddressFromLead = async (
  dto: ImportAddressFromLeadRequest,
): Promise<ClockinAddress> => {
  const { data } = await apiClient.post<ClockinAddress>(
    '/time-clock/addresses/import-from-lead',
    dto,
  );
  return data;
};

// =================================================================
// EMPLOYEE-PROJECT ASSIGNMENTS (3 functions)
// =================================================================

export const listEmployeeProjects = async (
  params?: ListEmployeeProjectsParams,
): Promise<PaginatedResponse<EmployeeProjectAssignment>> => {
  const { data } = await apiClient.get<PaginatedResponse<EmployeeProjectAssignment>>(
    '/time-clock/employee-projects',
    { params },
  );
  return data;
};

export const createEmployeeProject = async (
  dto: CreateEmployeeProjectRequest,
): Promise<EmployeeProjectAssignment> => {
  const { data } = await apiClient.post<EmployeeProjectAssignment>(
    '/time-clock/employee-projects',
    dto,
  );
  return data;
};

export const deleteEmployeeProject = async (id: string): Promise<{ success: true }> => {
  const { data } = await apiClient.delete<{ success: true }>(
    `/time-clock/employee-projects/${id}`,
  );
  return data;
};

// =================================================================
// WORK SHIFTS (7 functions)
// =================================================================

export const listShifts = async (
  params?: ShiftFilterParams,
): Promise<PaginatedResponse<WorkShift>> => {
  const { data } = await apiClient.get<PaginatedResponse<WorkShift>>(
    '/time-clock/shifts',
    { params },
  );
  return data;
};

export const createShift = async (dto: CreateShiftRequest): Promise<WorkShift> => {
  const { data } = await apiClient.post<WorkShift>('/time-clock/shifts', dto);
  return data;
};

export const bulkCreateShifts = async (
  dto: BulkCreateShiftsRequest,
): Promise<BulkCreateShiftsResponse> => {
  const { data } = await apiClient.post<BulkCreateShiftsResponse>(
    '/time-clock/shifts/bulk',
    dto,
  );
  return data;
};

export const getShift = async (id: string): Promise<WorkShift> => {
  const { data } = await apiClient.get<WorkShift>(`/time-clock/shifts/${id}`);
  return data;
};

export const updateShift = async (
  id: string,
  dto: UpdateShiftRequest,
): Promise<WorkShift> => {
  const { data } = await apiClient.patch<WorkShift>(`/time-clock/shifts/${id}`, dto);
  return data;
};

export const deleteShift = async (id: string): Promise<{ success: true }> => {
  const { data } = await apiClient.delete<{ success: true }>(`/time-clock/shifts/${id}`);
  return data;
};

export const getMyShifts = async (
  params?: ShiftFilterParams,
): Promise<PaginatedResponse<WorkShift>> => {
  const { data } = await apiClient.get<PaginatedResponse<WorkShift>>(
    '/time-clock/shifts/mine',
    { params },
  );
  return data;
};

// =================================================================
// CLOCK SESSIONS (9 functions)
// =================================================================

export const clockIn = async (dto: ClockInRequest): Promise<ClockSession> => {
  const { data } = await apiClient.post<ClockSession>('/time-clock/sessions/clock-in', dto);
  return data;
};

export const clockOut = async (dto: ClockOutRequest): Promise<ClockSession> => {
  const { data } = await apiClient.post<ClockSession>(
    '/time-clock/sessions/clock-out',
    dto,
  );
  return data;
};

export const listSessions = async (
  params?: SessionFilterParams,
): Promise<PaginatedResponse<ClockSession>> => {
  const { data } = await apiClient.get<PaginatedResponse<ClockSession>>(
    '/time-clock/sessions',
    { params },
  );
  return data;
};

export const getMyActiveSession = async (): Promise<ClockSession | null> => {
  const { data } = await apiClient.get<SimpleDataResponse<ClockSession | null>>(
    '/time-clock/sessions/me/active',
  );
  return data.data;
};

export const getMyAvailableProjects = async (): Promise<AvailableProject[]> => {
  const { data } = await apiClient.get<SimpleDataResponse<AvailableProject[]>>(
    '/time-clock/sessions/me/available-projects',
  );
  return data.data;
};

export const getMySessionHistory = async (
  params?: SessionFilterParams,
): Promise<PaginatedResponse<ClockSession>> => {
  const { data } = await apiClient.get<PaginatedResponse<ClockSession>>(
    '/time-clock/sessions/mine',
    { params },
  );
  return data;
};

export const getAllActiveSessions = async (): Promise<ActiveSessionsResponse> => {
  const { data } = await apiClient.get<ActiveSessionsResponse>(
    '/time-clock/sessions/active/all',
  );
  return data;
};

export const getSession = async (id: string): Promise<ClockSession> => {
  const { data } = await apiClient.get<ClockSession>(`/time-clock/sessions/${id}`);
  return data;
};

export const editSession = async (
  id: string,
  dto: EditSessionRequest,
): Promise<ClockSession> => {
  const { data } = await apiClient.patch<ClockSession>(`/time-clock/sessions/${id}`, dto);
  return data;
};

// =================================================================
// BREAKS (3 functions)
// =================================================================

export const startBreak = async (
  sessionId: string,
  dto: StartBreakRequest,
): Promise<BreakEntry> => {
  const { data } = await apiClient.post<BreakEntry>(
    `/time-clock/sessions/${sessionId}/breaks/start`,
    dto,
  );
  return data;
};

export const endBreak = async (sessionId: string): Promise<BreakEntry> => {
  const { data } = await apiClient.post<BreakEntry>(
    `/time-clock/sessions/${sessionId}/breaks/end`,
  );
  return data;
};

export const listBreaks = async (sessionId: string): Promise<BreakEntry[]> => {
  const { data } = await apiClient.get<SimpleDataResponse<BreakEntry[]>>(
    `/time-clock/sessions/${sessionId}/breaks`,
  );
  return data.data;
};

// =================================================================
// DISPUTES (7 functions)
// =================================================================

export const submitDispute = async (
  sessionId: string,
  dto: SubmitDisputeRequest,
): Promise<TimeDispute> => {
  const { data } = await apiClient.post<TimeDispute>(
    `/time-clock/sessions/${sessionId}/disputes`,
    dto,
  );
  return data;
};

export const listDisputes = async (
  params?: DisputeFilterParams,
): Promise<PaginatedResponse<TimeDispute>> => {
  const { data } = await apiClient.get<PaginatedResponse<TimeDispute>>(
    '/time-clock/disputes',
    { params },
  );
  return data;
};

export const listMyDisputes = async (
  params?: DisputeFilterParams,
): Promise<PaginatedResponse<TimeDispute>> => {
  const { data } = await apiClient.get<PaginatedResponse<TimeDispute>>(
    '/time-clock/disputes/mine',
    { params },
  );
  return data;
};

export const getDispute = async (id: string): Promise<TimeDispute> => {
  const { data } = await apiClient.get<TimeDispute>(`/time-clock/disputes/${id}`);
  return data;
};

export const approveDispute = async (
  id: string,
  dto?: ApproveDisputeRequest,
): Promise<TimeDispute> => {
  const { data } = await apiClient.patch<TimeDispute>(
    `/time-clock/disputes/${id}/approve`,
    dto ?? {},
  );
  return data;
};

export const rejectDispute = async (
  id: string,
  dto: RejectDisputeRequest,
): Promise<TimeDispute> => {
  const { data } = await apiClient.patch<TimeDispute>(
    `/time-clock/disputes/${id}/reject`,
    dto,
  );
  return data;
};

export const cancelDispute = async (id: string): Promise<{ success: true }> => {
  const { data } = await apiClient.delete<{ success: true }>(
    `/time-clock/disputes/${id}`,
  );
  return data;
};

// =================================================================
// KIOSK (3 functions — X-Kiosk-Token header, NOT JWT)
// =================================================================

export const kioskListEmployees = async (
  token: string,
): Promise<KioskEmployeesResponse> => {
  const { data } = await kioskClient.get<KioskEmployeesResponse>(
    '/time-clock/kiosk/employees',
    kioskConfig(token),
  );
  return data;
};

export const kioskClockIn = async (
  token: string,
  dto: KioskClockInRequest,
): Promise<ClockSession> => {
  const { data } = await kioskClient.post<ClockSession>(
    '/time-clock/kiosk/clock-in',
    dto,
    kioskConfig(token),
  );
  return data;
};

export const kioskClockOut = async (
  token: string,
  dto: KioskClockOutRequest,
): Promise<ClockSession> => {
  const { data } = await kioskClient.post<ClockSession>(
    '/time-clock/kiosk/clock-out',
    dto,
    kioskConfig(token),
  );
  return data;
};

// =================================================================
// DASHBOARD (1 function)
// =================================================================

export const getWhosIn = async (params?: WhosInParams): Promise<WhosInResponse> => {
  const { data } = await apiClient.get<WhosInResponse>('/time-clock/dashboard/whos-in', {
    params,
  });
  return data;
};

// =================================================================
// REPORTS (6 functions)
// =================================================================

export const getTimesheetReport = async (
  params: ReportFilterParams,
): Promise<TimesheetReport> => {
  const { data } = await apiClient.get<TimesheetReport>('/time-clock/reports/timesheet', {
    params,
  });
  return data;
};

export const getPayrollReport = async (
  params: PayrollFilterParams,
): Promise<PayrollReport> => {
  const { data } = await apiClient.get<PayrollReport>('/time-clock/reports/payroll', {
    params,
  });
  return data;
};

export const exportPayroll = async (params: PayrollFilterParams): Promise<Blob> => {
  const { data } = await apiClient.get('/time-clock/reports/payroll/export', {
    params,
    responseType: 'blob',
  });
  return data as Blob;
};

export const getShiftVarianceReport = async (
  params: ShiftVarianceFilterParams,
): Promise<ShiftVarianceReport> => {
  const { data } = await apiClient.get<ShiftVarianceReport>(
    '/time-clock/reports/shift-variance',
    { params },
  );
  return data;
};

export const getGeoViolationsReport = async (
  params: GeoViolationsFilterParams,
): Promise<GeoViolationsReport> => {
  const { data } = await apiClient.get<GeoViolationsReport>(
    '/time-clock/reports/geo-violations',
    { params },
  );
  return data;
};

export const getActivityFeed = async (
  params?: ActivityFeedParams,
): Promise<ActivityFeedResponse> => {
  const { data } = await apiClient.get<ActivityFeedResponse>(
    '/time-clock/reports/activity-feed',
    { params },
  );
  return data;
};
