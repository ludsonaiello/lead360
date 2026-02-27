/**
 * High-level API functions for Voice Agent
 *
 * These wrap the HTTP client with specific endpoint calls.
 * Use these functions in the agent entrypoint.
 */

import { apiGet, apiPost, ApiResponse } from './api-client';
import {
  LookupTenantResponse,
  AccessCheckResponse,
  StartCallResponse,
  CompleteCallResponse,
  VoiceAiContext,
  CreateLeadResult,
  FindLeadResult,
  CheckServiceAreaResult,
  TransferCallResult,
} from './api-types';

/**
 * Look up tenant by Twilio phone number
 */
export async function lookupTenant(phoneNumber: string): Promise<ApiResponse<LookupTenantResponse>> {
  console.log(`[Agent API] Looking up tenant for phone: ${phoneNumber}`);
  return apiPost<LookupTenantResponse>('/api/v1/internal/voice-ai/lookup-tenant', {
    phone_number: phoneNumber,
  });
}

/**
 * Check if tenant has access (quota/enabled)
 */
export async function checkAccess(tenantId: string): Promise<ApiResponse<AccessCheckResponse>> {
  console.log(`[Agent API] Checking access for tenant: ${tenantId}`);
  return apiGet<AccessCheckResponse>(`/api/v1/internal/voice-ai/tenant/${tenantId}/access`);
}

/**
 * Get full context for agent
 */
export async function getContext(tenantId: string): Promise<ApiResponse<VoiceAiContext>> {
  console.log(`[Agent API] Loading context for tenant: ${tenantId}`);
  return apiGet<VoiceAiContext>(`/api/v1/internal/voice-ai/tenant/${tenantId}/context`);
}

/**
 * Start call log
 */
export async function startCallLog(data: {
  tenant_id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  room_name?: string;
  direction?: string;
}): Promise<ApiResponse<StartCallResponse>> {
  console.log(`[Agent API] Starting call log for call: ${data.call_sid}`);
  return apiPost<StartCallResponse>('/api/v1/internal/voice-ai/calls/start', data);
}

/**
 * Complete call log
 */
export async function completeCallLog(
  callSid: string,
  data: {
    status?: string;
    duration_seconds: number;
    outcome: string;
    transcript_summary?: string;
    full_transcript?: string;
    actions_taken?: string[];
    lead_id?: string;
    transferred_to?: string;
    error_message?: string;
  }
): Promise<ApiResponse<CompleteCallResponse>> {
  console.log(`[Agent API] Completing call log for call: ${callSid}`);
  // DTO requires call_sid in body (even though it's in the URL path)
  return apiPost<CompleteCallResponse>(`/api/v1/internal/voice-ai/calls/${callSid}/complete`, {
    call_sid: callSid,
    ...data,
  });
}

// ============================================================================
// TOOL FUNCTIONS — Sprint VAB-05
// ============================================================================

/**
 * Create a new lead from call information
 */
export async function toolCreateLead(
  tenantId: string,
  data: {
    first_name: string;
    last_name: string;
    phone_number: string;
    email?: string;
    address: string;
    city: string;
    state: string;
    zip_code: string;
    service_description?: string;
    language?: string;
  }
): Promise<ApiResponse<CreateLeadResult>> {
  console.log(`[Agent API] Creating lead for tenant: ${tenantId}`);
  return apiPost<CreateLeadResult>(
    `/api/v1/internal/voice-ai/tenant/${tenantId}/tools/create_lead`,
    data
  );
}

/**
 * Find existing lead by phone number
 */
export async function toolFindLead(
  tenantId: string,
  phoneNumber: string
): Promise<ApiResponse<FindLeadResult>> {
  console.log(`[Agent API] Finding lead for phone: ${phoneNumber}`);
  return apiPost<FindLeadResult>(
    `/api/v1/internal/voice-ai/tenant/${tenantId}/tools/find_lead`,
    { phone_number: phoneNumber }
  );
}

/**
 * Check if an address is in the tenant's service area
 */
export async function toolCheckServiceArea(
  tenantId: string,
  data: {
    zip_code: string;
    city?: string;
    state?: string;
  }
): Promise<ApiResponse<CheckServiceAreaResult>> {
  console.log(`[Agent API] Checking service area for ZIP: ${data.zip_code}`);
  return apiPost<CheckServiceAreaResult>(
    `/api/v1/internal/voice-ai/tenant/${tenantId}/tools/check_service_area`,
    data
  );
}

/**
 * Get transfer number for call handoff
 */
export async function toolTransferCall(
  tenantId: string,
  reason: string,
  destination?: string
): Promise<ApiResponse<TransferCallResult>> {
  console.log(`[Agent API] Getting transfer number, reason: ${reason}`);
  return apiPost<TransferCallResult>(
    `/api/v1/internal/voice-ai/tenant/${tenantId}/tools/transfer_call`,
    { reason, destination }
  );
}
