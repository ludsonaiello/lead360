/**
 * Background Jobs API Client
 * Handles all job management, scheduled jobs, email settings, and templates
 */

import { apiClient } from './axios';
import type {
  Job,
  JobDetail,
  JobFilters,
  JobListResponse,
  ScheduledJob,
  ScheduledJobHistory,
  ScheduledJobListResponse,
  CreateScheduledJobDto,
  UpdateScheduledJobDto,
  EmailSettings,
  UpdateEmailSettingsDto,
  TestEmailDto,
  TestEmailResponse,
  EmailTemplate,
  EmailTemplateListResponse,
  CreateEmailTemplateDto,
  UpdateEmailTemplateDto,
  PreviewEmailDto,
  PreviewEmailResponse,
  QueueHealth,
  VariableRegistry,
  VariableSampleData,
  TemplateValidationRequest,
  TemplateValidationResponse,
} from '@/lib/types/jobs';

// ============================================================================
// Job Management APIs
// ============================================================================

/**
 * Get paginated list of jobs with filters
 */
export async function getJobs(filters: JobFilters = {}): Promise<JobListResponse> {
  const params = new URLSearchParams();

  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.status) params.append('status', filters.status);
  if (filters.job_type) params.append('job_type', filters.job_type);
  if (filters.tenant_id) params.append('tenant_id', filters.tenant_id);
  if (filters.date_from) params.append('date_from', filters.date_from);
  if (filters.date_to) params.append('date_to', filters.date_to);

  const url = `/admin/jobs?${params.toString()}`;
  console.log('[API] GET Jobs - URL:', url);

  const response = await apiClient.get<JobListResponse>(url);

  console.log('[API] GET Jobs - Raw Response:', {
    status: response.status,
    data: response.data,
    dataType: typeof response.data,
    hasData: !!response.data?.data,
    hasPagination: !!response.data?.pagination,
  });

  return response.data;
}

/**
 * Get job details with logs and email queue
 */
export async function getJobDetail(jobId: string): Promise<JobDetail> {
  const response = await apiClient.get<JobDetail>(`/admin/jobs/${jobId}`);
  return response.data;
}

/**
 * Retry a failed job
 */
export async function retryJob(jobId: string): Promise<{ message: string; job_id: string }> {
  const response = await apiClient.post(`/admin/jobs/${jobId}/retry`);
  return response.data;
}

/**
 * Delete a specific job
 */
export async function deleteJob(jobId: string): Promise<void> {
  await apiClient.delete(`/admin/jobs/${jobId}`);
}

/**
 * Get all failed jobs
 */
export async function getFailedJobs(filters: Omit<JobFilters, 'status'> = {}): Promise<JobListResponse> {
  const params = new URLSearchParams();

  if (filters.page) params.append('page', filters.page.toString());
  if (filters.limit) params.append('limit', filters.limit.toString());
  if (filters.job_type) params.append('job_type', filters.job_type);
  if (filters.tenant_id) params.append('tenant_id', filters.tenant_id);
  if (filters.date_from) params.append('date_from', filters.date_from);
  if (filters.date_to) params.append('date_to', filters.date_to);

  const response = await apiClient.get<JobListResponse>(
    `/admin/jobs/failed/list?${params.toString()}`
  );
  return response.data;
}

/**
 * Retry all failed jobs
 */
export async function retryAllFailedJobs(): Promise<{ message: string; count: number }> {
  const response = await apiClient.post('/admin/jobs/failed/retry-all');
  return response.data;
}

/**
 * Clear all failed jobs
 */
export async function clearAllFailedJobs(): Promise<{ message: string; count: number }> {
  const response = await apiClient.delete('/admin/jobs/failed/clear');
  return response.data;
}

/**
 * Get queue health metrics
 */
export async function getQueueHealth(): Promise<QueueHealth> {
  console.log('[API] GET Queue Health - Calling /admin/jobs/health/status');
  const response = await apiClient.get<QueueHealth>('/admin/jobs/health/status');
  console.log('[API] GET Queue Health - Response:', response.data);
  return response.data;
}

// ============================================================================
// Scheduled Jobs APIs
// ============================================================================

/**
 * Get all scheduled jobs
 */
export async function getScheduledJobs(
  page: number = 1,
  limit: number = 50
): Promise<ScheduledJobListResponse> {
  const response = await apiClient.get<ScheduledJobListResponse>(
    `/admin/jobs/schedules?page=${page}&limit=${limit}`
  );
  return response.data;
}

/**
 * Get scheduled job details
 */
export async function getScheduledJob(id: string): Promise<ScheduledJob> {
  const response = await apiClient.get<ScheduledJob>(`/admin/jobs/schedules/${id}`);
  return response.data;
}

/**
 * Create new scheduled job
 */
export async function createScheduledJob(data: CreateScheduledJobDto): Promise<ScheduledJob> {
  const response = await apiClient.post<ScheduledJob>('/admin/jobs/schedules', data);
  return response.data;
}

/**
 * Update scheduled job
 */
export async function updateScheduledJob(
  id: string,
  data: UpdateScheduledJobDto
): Promise<ScheduledJob> {
  const response = await apiClient.patch<ScheduledJob>(`/admin/jobs/schedules/${id}`, data);
  return response.data;
}

/**
 * Delete scheduled job
 */
export async function deleteScheduledJob(id: string): Promise<void> {
  await apiClient.delete(`/admin/jobs/schedules/${id}`);
}

/**
 * Trigger scheduled job manually
 */
export async function triggerScheduledJob(id: string): Promise<{ message: string; job_id: string }> {
  const response = await apiClient.post(`/admin/jobs/schedules/${id}/trigger`);
  return response.data;
}

/**
 * Get scheduled job execution history
 */
export async function getScheduledJobHistory(
  id: string,
  limit: number = 100
): Promise<ScheduledJobHistory[]> {
  const url = `/admin/jobs/schedules/${id}/history?limit=${limit}`;
  console.log('[API] GET Scheduled Job History - URL:', url);
  const response = await apiClient.get<ScheduledJobHistory[]>(url);
  console.log('[API] GET Scheduled Job History - Response:', response.data);
  return response.data;
}

// ============================================================================
// Email Settings APIs
// ============================================================================

/**
 * Get platform SMTP configuration
 */
export async function getEmailSettings(): Promise<EmailSettings | null> {
  console.log('[API] GET Email Settings - Calling /admin/jobs/email-settings');
  const response = await apiClient.get<EmailSettings>('/admin/jobs/email-settings');
  console.log('[API] GET Email Settings - Response:', response.data);
  return response.data;
}

/**
 * Update platform SMTP configuration
 */
export async function updateEmailSettings(data: UpdateEmailSettingsDto): Promise<EmailSettings> {
  const response = await apiClient.patch<EmailSettings>('/admin/jobs/email-settings', data);
  return response.data;
}

/**
 * Send test email
 */
export async function sendTestEmail(data: TestEmailDto): Promise<TestEmailResponse> {
  const response = await apiClient.post<TestEmailResponse>(
    '/admin/jobs/email-settings/test',
    data
  );
  return response.data;
}

// ============================================================================
// Email Templates APIs
// ============================================================================

/**
 * Get all email templates
 */
export async function getEmailTemplates(params: {
  page?: number;
  limit?: number;
  search?: string;
  is_system?: boolean;
} = {}): Promise<EmailTemplateListResponse> {
  const queryParams = new URLSearchParams();

  if (params.page) queryParams.append('page', params.page.toString());
  if (params.limit) queryParams.append('limit', params.limit.toString());
  if (params.search) queryParams.append('search', params.search);
  if (params.is_system !== undefined) {
    queryParams.append('is_system', params.is_system.toString());
  }

  const response = await apiClient.get<EmailTemplateListResponse>(
    `/admin/jobs/email-templates?${queryParams.toString()}`
  );
  return response.data;
}

/**
 * Get email template details
 */
export async function getEmailTemplate(templateKey: string): Promise<EmailTemplate> {
  const response = await apiClient.get<EmailTemplate>(
    `/admin/jobs/email-templates/${templateKey}`
  );
  return response.data;
}

/**
 * Create new email template
 */
export async function createEmailTemplate(data: CreateEmailTemplateDto): Promise<EmailTemplate> {
  const response = await apiClient.post<EmailTemplate>('/admin/jobs/email-templates', data);
  return response.data;
}

/**
 * Update email template
 */
export async function updateEmailTemplate(
  templateKey: string,
  data: UpdateEmailTemplateDto
): Promise<EmailTemplate> {
  const response = await apiClient.patch<EmailTemplate>(
    `/admin/jobs/email-templates/${templateKey}`,
    data
  );
  return response.data;
}

/**
 * Delete email template
 */
export async function deleteEmailTemplate(templateKey: string): Promise<void> {
  await apiClient.delete(`/admin/jobs/email-templates/${templateKey}`);
}

/**
 * Preview email template with variables
 */
export async function previewEmailTemplate(
  templateKey: string,
  data: PreviewEmailDto
): Promise<PreviewEmailResponse> {
  const response = await apiClient.post<PreviewEmailResponse>(
    `/admin/jobs/email-templates/${templateKey}/preview`,
    data
  );
  return response.data;
}

// ============================================================================
// Email Template Variables APIs
// ============================================================================

/**
 * Get variable registry with metadata
 * Returns all available template variables with descriptions, types, and examples
 */
export async function getVariableRegistry(category?: string): Promise<VariableRegistry> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);

  const url = `/admin/jobs/email-templates/variables/registry${params.toString() ? `?${params.toString()}` : ''}`;
  console.log('[API] GET Variable Registry - URL:', url);
  const response = await apiClient.get<VariableRegistry>(url);
  console.log('[API] GET Variable Registry - Response:', response.data);
  return response.data;
}

/**
 * Get sample data for variables (for preview purposes)
 * Takes an array of variable names and returns realistic sample values
 */
export async function getVariableSamples(variables: string[]): Promise<VariableSampleData> {
  if (variables.length === 0) {
    return {};
  }

  const params = new URLSearchParams();
  params.append('variables', variables.join(','));

  const url = `/admin/jobs/email-templates/variables/sample?${params.toString()}`;
  console.log('[API] GET Variable Samples - URL:', url);
  const response = await apiClient.get<VariableSampleData>(url);
  console.log('[API] GET Variable Samples - Response:', response.data);
  return response.data;
}

/**
 * Validate template variables
 * Checks for unused variables and undefined variables in template body
 */
export async function validateTemplateVariables(
  data: TemplateValidationRequest
): Promise<TemplateValidationResponse> {
  console.log('[API] POST Validate Template Variables - Request:', data);
  const response = await apiClient.post<TemplateValidationResponse>(
    '/admin/jobs/email-templates/validate',
    data
  );
  console.log('[API] POST Validate Template Variables - Response:', response.data);
  return response.data;
}
