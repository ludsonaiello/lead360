/**
 * Twilio Tenant-Facing API Client
 * Lead360 Platform - Communication Module (Twilio Integration)
 *
 * All 22 tenant-facing endpoints from backend API documentation
 * Base URL: /api/v1/communication/twilio/*
 * Tested against live backend on 2026-02-11
 */

import { apiClient } from './axios';
import type {
  // SMS
  SMSConfig,
  CreateSMSConfigRequest,
  UpdateSMSConfigRequest,
  TestSMSConfigResponse,
  // WhatsApp
  WhatsAppConfig,
  CreateWhatsAppConfigRequest,
  UpdateWhatsAppConfigRequest,
  TestWhatsAppConfigResponse,
  // Calls
  CallRecord,
  InitiateCallRequest,
  InitiateCallResponse,
  CallHistoryResponse,
  CallRecordingResponse,
  CallTranscriptionResponse,
  // IVR
  IVRConfig,
  CreateOrUpdateIVRConfigRequest,
  // Whitelist
  OfficeWhitelistEntry,
  AddPhoneToWhitelistRequest,
  UpdateWhitelistLabelRequest,
} from '@/lib/types/twilio-tenant';

// ============================================
// SMS Configuration API (5 endpoints)
// ============================================

/**
 * Get active SMS configuration for tenant
 * @endpoint GET /api/v1/communication/twilio/sms-config
 * @permission All roles
 * @throws 404 - No active SMS configuration found
 */
export async function getActiveSMSConfig(): Promise<SMSConfig> {
  const response = await apiClient.get<SMSConfig>('/communication/twilio/sms-config');
  return response.data;
}

/**
 * Create new SMS configuration
 * @endpoint POST /api/v1/communication/twilio/sms-config
 * @permission Owner, Admin
 * @throws 400 - Invalid Twilio credentials or validation error
 * @throws 401 - Missing or invalid JWT token
 * @throws 403 - Insufficient permissions
 * @throws 409 - Active SMS configuration already exists
 */
export async function createSMSConfig(data: CreateSMSConfigRequest): Promise<SMSConfig> {
  const response = await apiClient.post<SMSConfig>('/communication/twilio/sms-config', data);
  return response.data;
}

/**
 * Update existing SMS configuration
 * @endpoint PATCH /api/v1/communication/twilio/sms-config/:id
 * @permission Owner, Admin
 * @throws 400 - Invalid credentials if updated
 * @throws 404 - SMS configuration not found
 * @throws 401 - Invalid or missing JWT token
 * @throws 403 - Insufficient permissions
 */
export async function updateSMSConfig(
  id: string,
  data: UpdateSMSConfigRequest
): Promise<SMSConfig> {
  const response = await apiClient.patch<SMSConfig>(
    `/communication/twilio/sms-config/${id}`,
    data
  );
  return response.data;
}

/**
 * Deactivate SMS configuration (soft delete)
 * @endpoint DELETE /api/v1/communication/twilio/sms-config/:id
 * @permission Owner, Admin
 * @throws 404 - SMS configuration not found
 * @throws 401 - Invalid or missing JWT token
 * @throws 403 - Insufficient permissions
 */
export async function deactivateSMSConfig(id: string): Promise<SMSConfig> {
  const response = await apiClient.delete<SMSConfig>(`/communication/twilio/sms-config/${id}`);
  return response.data;
}

/**
 * Send test SMS to verify configuration
 * @endpoint POST /api/v1/communication/twilio/sms-config/:id/test
 * @permission Owner, Admin
 * @param id Configuration ID
 * @param toPhone Destination phone number in E.164 format
 * @throws 400 - SMS test failed (invalid credentials or Twilio error)
 * @throws 404 - SMS configuration not found
 * @throws 401 - Invalid or missing JWT token
 * @throws 403 - Insufficient permissions
 */
export async function testSMSConfig(id: string, toPhone: string): Promise<TestSMSConfigResponse> {
  const response = await apiClient.post<TestSMSConfigResponse>(
    `/communication/twilio/sms-config/${id}/test`,
    { to_phone: toPhone }
  );
  return response.data;
}

// ============================================
// WhatsApp Configuration API (5 endpoints)
// ============================================

/**
 * Get active WhatsApp configuration for tenant
 * @endpoint GET /api/v1/communication/twilio/whatsapp-config
 * @permission All roles
 * @throws 404 - No active WhatsApp configuration found
 */
export async function getActiveWhatsAppConfig(): Promise<WhatsAppConfig> {
  const response = await apiClient.get<WhatsAppConfig>('/communication/twilio/whatsapp-config');
  return response.data;
}

/**
 * Create new WhatsApp configuration
 * @endpoint POST /api/v1/communication/twilio/whatsapp-config
 * @permission Owner, Admin
 * @throws 400 - Invalid Twilio credentials or phone number format
 * @throws 401 - Missing or invalid JWT token
 * @throws 403 - Insufficient permissions
 * @throws 409 - Active WhatsApp configuration already exists
 */
export async function createWhatsAppConfig(
  data: CreateWhatsAppConfigRequest
): Promise<WhatsAppConfig> {
  const response = await apiClient.post<WhatsAppConfig>(
    '/communication/twilio/whatsapp-config',
    data
  );
  return response.data;
}

/**
 * Update existing WhatsApp configuration
 * @endpoint PATCH /api/v1/communication/twilio/whatsapp-config/:id
 * @permission Owner, Admin
 * @throws 400 - Invalid credentials if updated
 * @throws 404 - WhatsApp configuration not found
 */
export async function updateWhatsAppConfig(
  id: string,
  data: UpdateWhatsAppConfigRequest
): Promise<WhatsAppConfig> {
  const response = await apiClient.patch<WhatsAppConfig>(
    `/communication/twilio/whatsapp-config/${id}`,
    data
  );
  return response.data;
}

/**
 * Deactivate WhatsApp configuration (soft delete)
 * @endpoint DELETE /api/v1/communication/twilio/whatsapp-config/:id
 * @permission Owner, Admin
 * @throws 404 - WhatsApp configuration not found or does not belong to this tenant
 */
export async function deactivateWhatsAppConfig(id: string): Promise<WhatsAppConfig> {
  const response = await apiClient.delete<WhatsAppConfig>(
    `/communication/twilio/whatsapp-config/${id}`
  );
  return response.data;
}

/**
 * Send test WhatsApp message to verify configuration
 * @endpoint POST /api/v1/communication/twilio/whatsapp-config/:id/test
 * @permission Owner, Admin
 * @throws 400 - WhatsApp test failed
 * @throws 404 - WhatsApp configuration not found
 */
export async function testWhatsAppConfig(id: string): Promise<TestWhatsAppConfigResponse> {
  const response = await apiClient.post<TestWhatsAppConfigResponse>(
    `/communication/twilio/whatsapp-config/${id}/test`
  );
  return response.data;
}

// ============================================
// Call Management API (4 endpoints)
// ============================================

/**
 * Initiate outbound call to a Lead
 * System calls user's phone first, then bridges to Lead when user answers
 * @endpoint POST /api/v1/communication/twilio/calls/initiate
 * @permission Owner, Admin, Manager, Sales
 * @throws 400 - Invalid data or Lead has no phone number
 * @throws 404 - Lead not found
 */
export async function initiateCall(data: InitiateCallRequest): Promise<InitiateCallResponse> {
  const response = await apiClient.post<InitiateCallResponse>(
    '/communication/twilio/calls/initiate',
    data
  );
  return response.data;
}

/**
 * Get paginated call history for tenant
 * Results sorted by creation date (newest first)
 * @endpoint GET /api/v1/communication/twilio/call-history
 * @permission Owner, Admin, Manager, Sales
 * @param params Pagination parameters
 * @param params.page Page number (1-indexed, default: 1)
 * @param params.limit Items per page (1-100, default: 20)
 */
export async function getCallHistory(params: {
  page?: number;
  limit?: number;
}): Promise<CallHistoryResponse> {
  const response = await apiClient.get<CallHistoryResponse>(
    '/communication/twilio/call-history',
    { params }
  );
  return response.data;
}

/**
 * Get call details by ID
 * @endpoint GET /api/v1/communication/twilio/calls/:id
 * @permission Owner, Admin, Manager, Sales
 * @throws 404 - Call record not found
 */
export async function getCallById(id: string): Promise<CallRecord> {
  const response = await apiClient.get<CallRecord>(`/communication/twilio/calls/${id}`);
  return response.data;
}

/**
 * Get recording URL for a call
 * @endpoint GET /api/v1/communication/twilio/calls/:id/recording
 * @permission Owner, Admin, Manager, Sales
 * @throws 404 - Call record not found or recording not available
 */
export async function getCallRecording(id: string): Promise<CallRecordingResponse> {
  const response = await apiClient.get<CallRecordingResponse>(
    `/communication/twilio/calls/${id}/recording`
  );
  return response.data;
}

/**
 * Get transcription for a call
 * @endpoint GET /api/v1/communication/twilio/calls/:id/transcription
 * @permission Owner, Admin, Manager, Sales
 * @throws 404 - Call record not found or transcription not available
 */
export async function getCallTranscription(id: string): Promise<CallTranscriptionResponse> {
  const response = await apiClient.get<CallTranscriptionResponse>(
    `/communication/twilio/calls/${id}/transcription`
  );
  return response.data;
}

/**
 * Retry transcription for a call (using transcription ID)
 * @endpoint POST /api/v1/communication/transcriptions/:id/retry
 * @permission Owner, Admin, Manager, Sales
 * @throws 400 - Recording URL missing or validation failed
 * @throws 404 - Call transcription not found
 */
export async function retryCallTranscription(transcriptionId: string): Promise<CallTranscriptionResponse> {
  const response = await apiClient.post<CallTranscriptionResponse>(
    `/communication/transcriptions/${transcriptionId}/retry`
  );
  return response.data;
}

/**
 * Transcribe a call by call record ID
 * Works for both first-time transcription and retries
 * Creates transcription if none exists, retries if it does
 * @endpoint POST /api/v1/communication/transcriptions/call/:callRecordId/transcribe
 * @permission Owner, Admin, Manager, Sales
 * @param callRecordId The call record ID
 * @param reason Optional reason for transcription
 * @throws 400 - Recording URL missing or validation failed
 * @throws 404 - Call record not found
 * @throws 409 - Transcription already processing
 */
export async function transcribeCallByCallId(
  callRecordId: string,
  reason?: string
): Promise<{
  success: boolean;
  transcription_id: string;
  previous_transcription_id: string | null;
  call_record_id: string;
  retry_count: number;
  status: string;
  recording_url: string;
  message: string;
}> {
  const response = await apiClient.post(
    `/communication/transcriptions/call/${callRecordId}/transcribe`,
    reason ? { reason } : {}
  );
  return response.data;
}

// ============================================
// IVR Configuration API (3 endpoints)
// ============================================

/**
 * Get IVR configuration for tenant
 * @endpoint GET /api/v1/communication/twilio/ivr
 * @permission Owner, Admin, Manager
 * @throws 404 - IVR configuration not found for this tenant
 */
export async function getIVRConfig(): Promise<IVRConfig> {
  const response = await apiClient.get<IVRConfig>('/communication/twilio/ivr');
  return response.data;
}

/**
 * Create or update IVR configuration (upsert)
 * Uses upsert pattern - if configuration exists, it will be updated
 * @endpoint POST /api/v1/communication/twilio/ivr
 * @permission Owner, Admin
 * @throws 400 - Validation failed (duplicate digits, invalid config)
 */
export async function createOrUpdateIVRConfig(
  data: CreateOrUpdateIVRConfigRequest
): Promise<IVRConfig> {
  const response = await apiClient.post<IVRConfig>('/communication/twilio/ivr', data);
  return response.data;
}

/**
 * Disable IVR configuration (soft delete)
 * Sets ivr_enabled to false and status to inactive
 * Data is retained for audit purposes
 * @endpoint DELETE /api/v1/communication/twilio/ivr
 * @permission Owner, Admin
 * @throws 404 - IVR configuration not found
 */
export async function disableIVRConfig(): Promise<IVRConfig> {
  const response = await apiClient.delete<IVRConfig>('/communication/twilio/ivr');
  return response.data;
}

// ============================================
// Office Bypass Whitelist API (5 endpoints)
// Note: Sprint doc lists 4, but API has 5 (including update label)
// ============================================

/**
 * Get all whitelisted phone numbers for tenant
 * Returns both active and inactive entries, sorted by most recent first
 * @endpoint GET /api/v1/communication/twilio/office-whitelist
 * @permission Owner, Admin, Manager
 */
export async function getOfficeWhitelist(): Promise<OfficeWhitelistEntry[]> {
  const response = await apiClient.get<OfficeWhitelistEntry[]>(
    '/communication/twilio/office-whitelist'
  );
  return response.data;
}

/**
 * Add phone number to whitelist
 * Whitelisted numbers bypass IVR and can make outbound calls using company's phone number
 * @endpoint POST /api/v1/communication/twilio/office-whitelist
 * @permission Owner, Admin
 * @throws 400 - Invalid phone number format
 * @throws 409 - Phone number already whitelisted
 */
export async function addPhoneToWhitelist(
  data: AddPhoneToWhitelistRequest
): Promise<OfficeWhitelistEntry> {
  const response = await apiClient.post<OfficeWhitelistEntry>(
    '/communication/twilio/office-whitelist',
    data
  );
  return response.data;
}

/**
 * Update whitelist entry label
 * Phone number itself cannot be changed (delete and re-add to change number)
 * @endpoint PATCH /api/v1/communication/twilio/office-whitelist/:id
 * @permission Owner, Admin
 * @throws 404 - Whitelist entry not found or does not belong to this tenant
 */
export async function updateWhitelistLabel(
  id: string,
  data: UpdateWhitelistLabelRequest
): Promise<OfficeWhitelistEntry> {
  const response = await apiClient.patch<OfficeWhitelistEntry>(
    `/communication/twilio/office-whitelist/${id}`,
    data
  );
  return response.data;
}

/**
 * Remove phone number from whitelist (soft delete)
 * Sets status to inactive. Data is retained for audit purposes
 * @endpoint DELETE /api/v1/communication/twilio/office-whitelist/:id
 * @permission Owner, Admin
 * @throws 404 - Whitelist entry not found or does not belong to this tenant
 */
export async function removeFromWhitelist(id: string): Promise<OfficeWhitelistEntry> {
  const response = await apiClient.delete<OfficeWhitelistEntry>(
    `/communication/twilio/office-whitelist/${id}`
  );
  return response.data;
}

// ============================================
// TOTAL: 22 ENDPOINTS (23 with updateWhitelistLabel)
// ============================================
// SMS Configuration: 5
// WhatsApp Configuration: 5
// Call Management: 4
// IVR Configuration: 3
// Office Bypass Whitelist: 5 (4 in sprint doc + update label from API)
