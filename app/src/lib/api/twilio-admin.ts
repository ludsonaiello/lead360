/**
 * Twilio Admin API Client
 * Sprint 1: Provider Management & System Health
 * Sprint 2: Cross-Tenant Monitoring
 * All endpoints for Twilio admin interface
 */

import { apiClient } from './axios';
import type {
  SystemProvider,
  SystemProviderResponse,
  RegisterProviderDto,
  UpdateProviderDto,
  ConnectivityTestResult,
  AvailableNumbersResponse,
  OwnedPhoneNumber,
  SystemHealthResponse,
  TestResult,
  ResponseTimeMetrics,
  SystemAlert,
  AlertsQuery,
  PaginatedResponse,
  CallRecord,
  CallFilters,
  CommunicationEvent,
  MessageFilters,
  TenantConfigsResponse,
  TenantMetricsResponse,
  UsageQuery,
  UsageSummaryResponse,
  TenantUsageResponse,
  CostEstimateResponse,
  TopTenantsResponse,
  FailedTranscriptionsResponse,
  TranscriptionDetail,
  TranscriptionProvidersResponse,
  SystemMetricsResponse,
  CronJobStatusResponse,
  ReloadCronResponse,
  WebhookConfig,
  UpdateWebhookConfigDto,
  WebhookConfigUpdateResponse,
  TestWebhookDto,
  WebhookTestResult,
  WebhookEvent,
  WebhookEventFilters,
  PurchasePhoneNumberDto,
  PhoneNumberPurchaseResponse,
  AllocatePhoneNumberDto,
  PhoneNumberAllocationResponse,
  DeallocatePhoneNumberDto,
  PhoneNumberDeallocationResponse,
  PhoneNumberReleaseResponse,
  OwnedPhoneNumbersResponse,
  PhoneNumber,
  CreateTranscriptionProviderDto,
  UpdateTranscriptionProviderDto,
  TranscriptionProvider,
  TranscriptionProviderDetail,
  TestTranscriptionResult,
  CreateTenantSmsConfigDto,
  UpdateTenantSmsConfigDto,
  TenantSmsConfig,
  CreateTenantWhatsAppConfigDto,
  UpdateTenantWhatsAppConfigDto,
  TenantWhatsAppConfig,
  TestConfigResult,
  AcknowledgeAlertDto,
  ResolveAlertDto,
  BulkAcknowledgeAlertsDto,
  BulkAcknowledgeResponse,
  SystemAlertDetail,
  ResendEventResponse,
  UpdateEventStatusDto,
  UpdateEventStatusResponse,
  DeleteEventDto,
  DeleteEventResponse,
  BatchRetryTranscriptionsDto,
  BatchResendCommunicationEventsDto,
  BatchRetryWebhookEventsDto,
  BulkOperationResponse,
} from '../types/twilio-admin';

// ============================================
// Provider Management (5 endpoints)
// ============================================

/**
 * GET /admin/communication/twilio/provider
 * Get current system provider status
 * Returns SystemProvider if configured, or {configured: false} if not
 */
export async function getSystemProvider(): Promise<SystemProviderResponse> {
  const { data } = await apiClient.get('/admin/communication/twilio/provider');
  return data;
}

/**
 * POST /admin/communication/twilio/provider
 * Register system provider
 */
export async function registerSystemProvider(dto: RegisterProviderDto): Promise<SystemProvider> {
  const { data } = await apiClient.post('/admin/communication/twilio/provider', dto);
  return data;
}

/**
 * PATCH /admin/communication/twilio/provider
 * Update provider credentials
 */
export async function updateSystemProvider(dto: UpdateProviderDto): Promise<{ message: string }> {
  const { data } = await apiClient.patch('/admin/communication/twilio/provider', dto);
  return data;
}

/**
 * POST /admin/communication/twilio/provider/test
 * Test provider connectivity
 */
export async function testSystemProvider(): Promise<ConnectivityTestResult> {
  const { data } = await apiClient.post('/admin/communication/twilio/provider/test');
  return data;
}

/**
 * GET /admin/communication/twilio/available-numbers
 * Get available phone numbers from Twilio
 */
export async function getAvailableNumbers(params?: {
  area_code?: string;
  limit?: number;
}): Promise<AvailableNumbersResponse> {
  const { data } = await apiClient.get('/admin/communication/twilio/available-numbers', { params });
  return data;
}

/**
 * GET /admin/communication/twilio/phone-numbers
 * Get owned phone numbers from Twilio account with allocation status
 */
export async function getOwnedPhoneNumbers(): Promise<OwnedPhoneNumber[]> {
  const { data } = await apiClient.get('/admin/communication/twilio/phone-numbers');
  return data;
}

// ============================================
// System Health (6 endpoints)
// ============================================

/**
 * GET /admin/communication/health
 * Get overall system health
 */
export async function getSystemHealth(): Promise<SystemHealthResponse> {
  const { data } = await apiClient.get('/admin/communication/health');
  return data;
}

/**
 * POST /admin/communication/health/twilio-test
 * Test Twilio API connectivity
 */
export async function testTwilioConnectivity(tenantId: string = 'system'): Promise<TestResult> {
  const { data } = await apiClient.post('/admin/communication/health/twilio-test', { tenant_id: tenantId });
  return data;
}

/**
 * POST /admin/communication/health/webhooks-test
 * Test webhook delivery
 */
export async function testWebhooks(): Promise<TestResult> {
  const { data } = await apiClient.post('/admin/communication/health/webhooks-test');
  return data;
}

/**
 * POST /admin/communication/health/transcription-test
 * Test transcription provider
 */
export async function testTranscriptionProvider(): Promise<TestResult> {
  const { data } = await apiClient.post('/admin/communication/health/transcription-test');
  return data;
}

/**
 * GET /admin/communication/health/provider-response-times
 * Get performance metrics (last 24 hours)
 */
export async function getProviderResponseTimes(): Promise<ResponseTimeMetrics> {
  const { data } = await apiClient.get('/admin/communication/health/provider-response-times');
  return data;
}

/**
 * GET /admin/communication/alerts
 * Get system alerts with optional filters
 */
export async function getSystemAlerts(params?: AlertsQuery): Promise<PaginatedResponse<SystemAlert>> {
  const { data } = await apiClient.get('/admin/communication/alerts', { params });
  return data;
}

// ============================================
// Sprint 2: Cross-Tenant Monitoring (6 endpoints)
// ============================================

/**
 * GET /admin/communication/calls
 * Get all voice calls across all tenants
 */
export async function getAllCalls(params?: CallFilters): Promise<PaginatedResponse<CallRecord>> {
  const { data } = await apiClient.get('/admin/communication/calls', { params });
  return data;
}

/**
 * GET /admin/communication/sms
 * Get all SMS messages across all tenants
 */
export async function getAllSMS(params?: MessageFilters): Promise<PaginatedResponse<CommunicationEvent>> {
  const { data } = await apiClient.get('/admin/communication/sms', { params });
  return data;
}

/**
 * GET /admin/communication/whatsapp
 * Get all WhatsApp messages across all tenants
 */
export async function getAllWhatsApp(params?: MessageFilters): Promise<PaginatedResponse<CommunicationEvent>> {
  const { data } = await apiClient.get('/admin/communication/whatsapp', { params });
  return data;
}

/**
 * GET /admin/communication/tenant-configs
 * Get all tenant communication configurations
 */
export async function getAllTenantConfigs(): Promise<TenantConfigsResponse> {
  const { data } = await apiClient.get('/admin/communication/tenant-configs');
  return data;
}

/**
 * GET /admin/communication/tenants/:id/configs
 * Get specific tenant's communication configurations
 */
export async function getTenantConfigs(tenantId: string): Promise<TenantConfigsResponse> {
  const { data } = await apiClient.get(`/admin/communication/tenants/${tenantId}/configs`);
  return data;
}

/**
 * GET /admin/communication/tenants/:id/metrics
 * Get communication metrics for specific tenant
 */
export async function getTenantMetrics(tenantId: string): Promise<TenantMetricsResponse> {
  const { data } = await apiClient.get(`/admin/communication/tenants/${tenantId}/metrics`);
  return data;
}

// ============================================
// Sprint 3: Usage Tracking & Billing (8 endpoints)
// ============================================

/**
 * POST /admin/communication/usage/sync
 * Trigger usage sync from Twilio API for all tenants
 * Note: Asynchronous operation (runs in background)
 */
export async function triggerUsageSync(): Promise<{ message: string }> {
  const { data } = await apiClient.post('/admin/communication/usage/sync');
  return data;
}

/**
 * POST /admin/communication/usage/sync/:tenantId
 * Sync usage for specific tenant
 */
export async function syncTenantUsage(tenantId: string): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/admin/communication/usage/sync/${tenantId}`);
  return data;
}

/**
 * GET /admin/communication/usage/tenants
 * Get usage summary for all tenants
 */
export async function getUsageSummary(params?: UsageQuery): Promise<UsageSummaryResponse> {
  const { data } = await apiClient.get('/admin/communication/usage/tenants', { params });
  return data;
}

/**
 * GET /admin/communication/usage/tenants/:id
 * Get detailed usage for specific tenant
 */
export async function getTenantUsage(
  tenantId: string,
  params?: { month?: string }
): Promise<TenantUsageResponse> {
  const { data } = await apiClient.get(`/admin/communication/usage/tenants/${tenantId}`, { params });
  return data;
}

/**
 * GET /admin/communication/usage/system
 * Get system-wide usage aggregation
 */
export async function getSystemWideUsage(params?: UsageQuery): Promise<UsageSummaryResponse> {
  const { data } = await apiClient.get('/admin/communication/usage/system', { params });
  return data;
}

/**
 * GET /admin/communication/usage/export
 * Export usage report as CSV (Future Enhancement)
 * Currently returns a message about planned future enhancement
 */
export async function exportUsageReport(params?: UsageQuery): Promise<any> {
  const { data } = await apiClient.get('/admin/communication/usage/export', { params });
  return data;
}

/**
 * GET /admin/communication/costs/tenants/:id
 * Get cost estimation for tenant
 */
export async function getTenantCostEstimate(
  tenantId: string,
  month: string
): Promise<CostEstimateResponse> {
  const { data } = await apiClient.get(`/admin/communication/costs/tenants/${tenantId}`, {
    params: { month }
  });
  return data;
}

/**
 * GET /admin/communication/metrics/top-tenants
 * Get top tenants by communication volume
 */
export async function getTopTenants(limit: number = 10): Promise<TopTenantsResponse> {
  const { data } = await apiClient.get('/admin/communication/metrics/top-tenants', {
    params: { limit }
  });
  return data;
}

// ============================================
// Sprint 4: Transcription Monitoring (4 endpoints)
// ============================================

/**
 * GET /admin/communication/transcriptions/failed
 * Get all failed transcriptions across all tenants
 */
export async function getFailedTranscriptions(): Promise<FailedTranscriptionsResponse> {
  try {
    const { data } = await apiClient.get('/admin/communication/transcriptions/failed');
    return data;
  } catch (error) {
    console.error('[getFailedTranscriptions] Error:', error);
    throw error;
  }
}

/**
 * GET /admin/communication/transcriptions/:id
 * Get detailed transcription information
 */
export async function getTranscriptionDetails(id: string): Promise<TranscriptionDetail> {
  try {
    const { data } = await apiClient.get(`/admin/communication/transcriptions/${id}`);
    return data;
  } catch (error) {
    console.error(`[getTranscriptionDetails] Error for ID ${id}:`, error);
    throw error;
  }
}

/**
 * POST /admin/communication/transcriptions/:id/retry
 * Retry a failed transcription
 */
export async function retryTranscription(id: string): Promise<{ message: string }> {
  try {
    const { data } = await apiClient.post(`/admin/communication/transcriptions/${id}/retry`);
    return data;
  } catch (error) {
    console.error(`[retryTranscription] Error for ID ${id}:`, error);
    throw error;
  }
}

/**
 * GET /admin/communication/transcription-providers
 * Get all transcription providers with statistics
 */
export async function getTranscriptionProviders(): Promise<TranscriptionProvidersResponse> {
  try {
    const { data } = await apiClient.get('/admin/communication/transcription-providers');
    return data;
  } catch (error) {
    console.error('[getTranscriptionProviders] Error:', error);
    throw error;
  }
}

/**
 * Bulk retry utility (calls individual retry in sequence)
 * Not a direct API endpoint - orchestrates multiple retry calls
 */
export async function bulkRetryTranscriptions(ids: string[]): Promise<{
  succeeded: string[];
  failed: { id: string; error: string }[];
}> {
  const results = { succeeded: [] as string[], failed: [] as { id: string; error: string }[] };

  for (const id of ids) {
    try {
      await retryTranscription(id);
      results.succeeded.push(id);
    } catch (error: any) {
      results.failed.push({ id, error: error?.message || 'Unknown error' });
    }
  }

  return results;
}

// ============================================
// Sprint 5: Metrics & Cron Management (3 new endpoints)
// ============================================

/**
 * GET /admin/communication/metrics/system-wide
 * Get comprehensive system-wide metrics across all tenants
 */
export async function getSystemWideMetrics(): Promise<SystemMetricsResponse> {
  try {
    const { data } = await apiClient.get('/admin/communication/metrics/system-wide');
    return data;
  } catch (error) {
    console.error('[getSystemWideMetrics] Error:', error);
    throw error;
  }
}

/**
 * GET /admin/communication/cron/status
 * Get status of all scheduled cron jobs
 */
export async function getCronJobStatus(): Promise<CronJobStatusResponse> {
  try {
    const { data } = await apiClient.get('/admin/communication/cron/status');
    return data;
  } catch (error) {
    console.error('[getCronJobStatus] Error:', error);
    throw error;
  }
}

/**
 * POST /admin/communication/cron/reload
 * Reload cron schedules from system settings
 */
export async function reloadCronSchedules(): Promise<ReloadCronResponse> {
  try {
    const { data } = await apiClient.post('/admin/communication/cron/reload');
    return data;
  } catch (error) {
    console.error('[reloadCronSchedules] Error:', error);
    throw error;
  }
}

// ============================================
// Sprint 6: Webhook Management (5 endpoints)
// ============================================

/**
 * GET /admin/communication/webhooks/config
 * Get current webhook configuration
 */
export async function getWebhookConfig(): Promise<WebhookConfig> {
  try {
    const { data } = await apiClient.get('/admin/communication/webhooks/config');
    return data;
  } catch (error) {
    console.error('[getWebhookConfig] Error:', error);
    throw error;
  }
}

/**
 * PATCH /admin/communication/webhooks/config
 * Update webhook configuration
 */
export async function updateWebhookConfig(dto: UpdateWebhookConfigDto): Promise<WebhookConfigUpdateResponse> {
  try {
    const { data } = await apiClient.patch('/admin/communication/webhooks/config', dto);
    return data;
  } catch (error) {
    console.error('[updateWebhookConfig] Error:', error);
    throw error;
  }
}

/**
 * POST /admin/communication/webhooks/test
 * Test webhook endpoint
 */
export async function testWebhookEndpoint(dto: TestWebhookDto): Promise<WebhookTestResult> {
  try {
    const { data } = await apiClient.post('/admin/communication/webhooks/test', dto);
    return data;
  } catch (error) {
    console.error('[testWebhookEndpoint] Error:', error);
    throw error;
  }
}

/**
 * GET /admin/communication/webhook-events
 * List webhook events with optional filters
 */
export async function getWebhookEvents(params?: WebhookEventFilters): Promise<PaginatedResponse<WebhookEvent>> {
  try {
    const { data } = await apiClient.get('/admin/communication/webhook-events', { params });
    return data;
  } catch (error) {
    console.error('[getWebhookEvents] Error:', error);
    throw error;
  }
}

/**
 * POST /admin/communication/webhook-events/:id/retry
 * Retry failed webhook event
 */
export async function retryWebhookEvent(id: string): Promise<{
  success: boolean;
  message: string;
  event_id: string;
  new_status: string;
}> {
  try {
    const { data } = await apiClient.post(`/admin/communication/webhook-events/${id}/retry`);
    return data;
  } catch (error) {
    console.error(`[retryWebhookEvent] Error for ID ${id}:`, error);
    throw error;
  }
}

// ============================================
// Sprint 6: Phone Number Operations (5 endpoints)
// ============================================

/**
 * POST /admin/communication/phone-numbers/purchase
 * Purchase new Twilio phone number
 */
export async function purchasePhoneNumber(dto: PurchasePhoneNumberDto): Promise<PhoneNumberPurchaseResponse> {
  try {
    const { data } = await apiClient.post('/admin/communication/phone-numbers/purchase', dto);
    return data;
  } catch (error) {
    console.error('[purchasePhoneNumber] Error:', error);
    throw error;
  }
}

/**
 * POST /admin/communication/phone-numbers/:sid/allocate
 * Allocate phone number to tenant
 */
export async function allocatePhoneNumber(sid: string, dto: AllocatePhoneNumberDto): Promise<PhoneNumberAllocationResponse> {
  try {
    const { data } = await apiClient.post(`/admin/communication/phone-numbers/${sid}/allocate`, dto);
    return data;
  } catch (error) {
    console.error(`[allocatePhoneNumber] Error for SID ${sid}:`, error);
    throw error;
  }
}

/**
 * DELETE /admin/communication/phone-numbers/:sid/allocate
 * Deallocate phone number from tenant
 */
export async function deallocatePhoneNumber(sid: string, dto: DeallocatePhoneNumberDto): Promise<PhoneNumberDeallocationResponse> {
  try {
    const { data } = await apiClient.delete(`/admin/communication/phone-numbers/${sid}/allocate`, { data: dto });
    return data;
  } catch (error) {
    console.error(`[deallocatePhoneNumber] Error for SID ${sid}:`, error);
    throw error;
  }
}

/**
 * DELETE /admin/communication/phone-numbers/:sid
 * Release phone number back to Twilio
 */
export async function releasePhoneNumber(sid: string): Promise<PhoneNumberReleaseResponse> {
  try {
    const { data } = await apiClient.delete(`/admin/communication/phone-numbers/${sid}`);
    return data;
  } catch (error) {
    console.error(`[releasePhoneNumber] Error for SID ${sid}:`, error);
    throw error;
  }
}

/**
 * GET /admin/communication/twilio/phone-numbers
 * Get all owned phone numbers with allocation status (updated for Sprint 6)
 */
export async function getOwnedPhoneNumbersDetailed(): Promise<OwnedPhoneNumbersResponse> {
  try {
    const { data } = await apiClient.get('/admin/communication/twilio/phone-numbers');
    // API returns plain array, transform to expected format
    // Handle edge case where data might not be an array
    const phoneNumbers: PhoneNumber[] = Array.isArray(data) ? data : [];
    const allocatedCount = phoneNumbers.filter(p => p.status === 'allocated').length;
    const availableCount = phoneNumbers.filter(p => p.status === 'available').length;

    return {
      phone_numbers: phoneNumbers,
      total_count: phoneNumbers.length,
      allocated_count: allocatedCount,
      available_count: availableCount
    };
  } catch (error) {
    console.error('[getOwnedPhoneNumbersDetailed] Error:', error);
    throw error;
  }
}

// ============================================
// Sprint 7: Transcription Provider CRUD (5 endpoints)
// ============================================

/**
 * POST /admin/communication/transcription-providers
 * Create new transcription provider
 */
export async function createTranscriptionProvider(dto: CreateTranscriptionProviderDto): Promise<TranscriptionProvider> {
  try {
    const { data } = await apiClient.post('/admin/communication/transcription-providers', dto);
    return data;
  } catch (error) {
    console.error('[createTranscriptionProvider] Error:', error);
    throw error;
  }
}

/**
 * GET /admin/communication/transcription-providers/:id
 * Get transcription provider details
 */
export async function getTranscriptionProviderDetail(id: string): Promise<TranscriptionProviderDetail> {
  try {
    const { data } = await apiClient.get(`/admin/communication/transcription-providers/${id}`);
    return data;
  } catch (error) {
    console.error(`[getTranscriptionProviderDetail] Error for ID ${id}:`, error);
    throw error;
  }
}

/**
 * PATCH /admin/communication/transcription-providers/:id
 * Update transcription provider
 */
export async function updateTranscriptionProvider(id: string, dto: UpdateTranscriptionProviderDto): Promise<TranscriptionProvider> {
  try {
    const { data } = await apiClient.patch(`/admin/communication/transcription-providers/${id}`, dto);
    return data;
  } catch (error) {
    console.error(`[updateTranscriptionProvider] Error for ID ${id}:`, error);
    throw error;
  }
}

/**
 * DELETE /admin/communication/transcription-providers/:id
 * Delete transcription provider
 */
export async function deleteTranscriptionProvider(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const { data } = await apiClient.delete(`/admin/communication/transcription-providers/${id}`);
    return data;
  } catch (error) {
    console.error(`[deleteTranscriptionProvider] Error for ID ${id}:`, error);
    throw error;
  }
}

/**
 * POST /admin/communication/transcription-providers/:id/test
 * Test transcription provider connectivity
 */
export async function testTranscriptionProviderConnectivity(id: string, audioUrl?: string): Promise<TestTranscriptionResult> {
  try {
    const { data } = await apiClient.post(`/admin/communication/transcription-providers/${id}/test`, {
      audio_url: audioUrl
    });
    return data;
  } catch (error) {
    console.error(`[testTranscriptionProviderConnectivity] Error for ID ${id}:`, error);
    throw error;
  }
}

// ============================================
// Sprint 7: Tenant Assistance (6 endpoints)
// ============================================

/**
 * POST /admin/communication/tenants/:tenantId/sms-config
 * Create SMS configuration for tenant
 */
export async function createTenantSmsConfig(tenantId: string, dto: CreateTenantSmsConfigDto): Promise<TenantSmsConfig> {
  try {
    const { data } = await apiClient.post(`/admin/communication/tenants/${tenantId}/sms-config`, dto);
    return data;
  } catch (error) {
    console.error(`[createTenantSmsConfig] Error for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * PATCH /admin/communication/tenants/:tenantId/sms-config/:configId
 * Update SMS configuration for tenant
 */
export async function updateTenantSmsConfig(
  tenantId: string,
  configId: string,
  dto: UpdateTenantSmsConfigDto
): Promise<TenantSmsConfig> {
  try {
    const { data } = await apiClient.patch(`/admin/communication/tenants/${tenantId}/sms-config/${configId}`, dto);
    return data;
  } catch (error) {
    console.error(`[updateTenantSmsConfig] Error for tenant ${tenantId}, config ${configId}:`, error);
    throw error;
  }
}

/**
 * POST /admin/communication/tenants/:tenantId/whatsapp-config
 * Create WhatsApp configuration for tenant
 */
export async function createTenantWhatsAppConfig(tenantId: string, dto: CreateTenantWhatsAppConfigDto): Promise<TenantWhatsAppConfig> {
  try {
    const { data } = await apiClient.post(`/admin/communication/tenants/${tenantId}/whatsapp-config`, dto);
    return data;
  } catch (error) {
    console.error(`[createTenantWhatsAppConfig] Error for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * PATCH /admin/communication/tenants/:tenantId/whatsapp-config/:configId
 * Update WhatsApp configuration for tenant
 */
export async function updateTenantWhatsAppConfig(
  tenantId: string,
  configId: string,
  dto: UpdateTenantWhatsAppConfigDto
): Promise<TenantWhatsAppConfig> {
  try {
    const { data } = await apiClient.patch(`/admin/communication/tenants/${tenantId}/whatsapp-config/${configId}`, dto);
    return data;
  } catch (error) {
    console.error(`[updateTenantWhatsAppConfig] Error for tenant ${tenantId}, config ${configId}:`, error);
    throw error;
  }
}

/**
 * POST /admin/communication/tenants/:tenantId/test-sms
 * Test tenant SMS configuration
 */
export async function testTenantSmsConfig(tenantId: string, configId?: string): Promise<TestConfigResult> {
  try {
    const { data } = await apiClient.post(`/admin/communication/tenants/${tenantId}/test-sms`, null, {
      params: configId ? { configId } : undefined
    });
    return data;
  } catch (error) {
    console.error(`[testTenantSmsConfig] Error for tenant ${tenantId}:`, error);
    throw error;
  }
}

/**
 * POST /admin/communication/tenants/:tenantId/test-whatsapp
 * Test tenant WhatsApp configuration
 */
export async function testTenantWhatsAppConfig(tenantId: string, configId?: string): Promise<TestConfigResult> {
  try {
    const { data } = await apiClient.post(`/admin/communication/tenants/${tenantId}/test-whatsapp`, null, {
      params: configId ? { configId } : undefined
    });
    return data;
  } catch (error) {
    console.error(`[testTenantWhatsAppConfig] Error for tenant ${tenantId}:`, error);
    throw error;
  }
}

// ============================================
// Sprint 8: Alert Management (3 endpoints)
// ============================================

/**
 * PATCH /admin/communication/alerts/:id/acknowledge
 * Acknowledge alert with optional comment
 */
export async function acknowledgeAlert(id: string, dto?: AcknowledgeAlertDto): Promise<SystemAlertDetail> {
  const { data } = await apiClient.patch(`/admin/communication/alerts/${id}/acknowledge`, dto);
  return data;
}

/**
 * PATCH /admin/communication/alerts/:id/resolve
 * Resolve alert with resolution notes (required)
 */
export async function resolveAlert(id: string, dto: ResolveAlertDto): Promise<SystemAlertDetail> {
  const { data } = await apiClient.patch(`/admin/communication/alerts/${id}/resolve`, dto);
  return data;
}

/**
 * POST /admin/communication/alerts/bulk-acknowledge
 * Bulk acknowledge multiple alerts (best-effort approach)
 * Acknowledges all valid alerts and reports which were not found
 */
export async function bulkAcknowledgeAlerts(dto: BulkAcknowledgeAlertsDto): Promise<BulkAcknowledgeResponse> {
  const { data } = await apiClient.post('/admin/communication/alerts/bulk-acknowledge', dto);
  return data;
}

// ============================================
// Sprint 8: Communication Event Management (3 endpoints)
// ============================================

/**
 * POST /admin/communication/communication-events/:id/resend
 * Resend failed communication event
 */
export async function resendCommunicationEvent(id: string): Promise<ResendEventResponse> {
  const { data } = await apiClient.post(`/admin/communication/communication-events/${id}/resend`);
  return data;
}

/**
 * PATCH /admin/communication/communication-events/:id/status
 * Update communication event status with reason
 */
export async function updateCommunicationEventStatus(
  id: string,
  dto: UpdateEventStatusDto
): Promise<UpdateEventStatusResponse> {
  const { data } = await apiClient.patch(`/admin/communication/communication-events/${id}/status`, dto);
  return data;
}

/**
 * DELETE /admin/communication/communication-events/:id
 * Delete communication event with reason (use force flag for delivered messages)
 */
export async function deleteCommunicationEvent(id: string, dto: DeleteEventDto): Promise<DeleteEventResponse> {
  const { data } = await apiClient.delete(`/admin/communication/communication-events/${id}`, { data: dto });
  return data;
}

// ============================================
// Sprint 8: Bulk Operations (3 endpoints)
// ============================================

/**
 * POST /admin/communication/transcriptions/batch-retry
 * Batch retry failed transcriptions with optional filters
 */
export async function batchRetryTranscriptions(dto: BatchRetryTranscriptionsDto): Promise<BulkOperationResponse> {
  const { data } = await apiClient.post('/admin/communication/transcriptions/batch-retry', dto);
  return data;
}

/**
 * POST /admin/communication/communication-events/batch-resend
 * Batch resend failed communication events with optional filters
 */
export async function batchResendCommunicationEvents(
  dto: BatchResendCommunicationEventsDto
): Promise<BulkOperationResponse> {
  const { data } = await apiClient.post('/admin/communication/communication-events/batch-resend', dto);
  return data;
}

/**
 * POST /admin/communication/webhook-events/batch-retry
 * Batch retry failed webhook events with optional filters
 */
export async function batchRetryWebhookEvents(dto: BatchRetryWebhookEventsDto): Promise<BulkOperationResponse> {
  const { data } = await apiClient.post('/admin/communication/webhook-events/batch-retry', dto);
  return data;
}
