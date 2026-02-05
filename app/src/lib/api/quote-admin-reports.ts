/**
 * Quote Admin Reports & Exports API Client
 * Report generation, scheduling, and export management
 * Source: /var/www/lead360.app/api/documentation/quote_admin_REST_API.md
 */

import apiClient from './axios';
import type {
  GenerateReportDto,
  ReportJob,
  ReportListResponse,
  CreateScheduledReportDto,
  ScheduledReport,
  ScheduledReportListResponse,
} from '../types/quote-admin';

// ==========================================
// REPORTS & EXPORTS ENDPOINTS
// ==========================================

/**
 * Generate a new report (async operation)
 * @endpoint POST /admin/quotes/reports/generate
 * @permission platform_admin:view_all_tenants
 * @param dto Report generation configuration
 * @returns Report job with status and ID for polling
 * @throws 400 - Validation errors (report_type, date_from, date_to, format required)
 * @throws 403 - Platform Admin privileges required
 * @note Report generation is asynchronous - poll getReportStatus() for completion
 */
export async function generateReport(dto: GenerateReportDto): Promise<ReportJob> {
  const response = await apiClient.post<ReportJob>(
    '/admin/quotes/reports/generate',
    dto
  );
  return response.data;
}

/**
 * Get report generation status and download URL
 * @endpoint GET /admin/quotes/reports/:reportId/status
 * @permission platform_admin:view_all_tenants
 * @param reportId Report job UUID
 * @returns Report job status and download URL (if completed)
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Report not found
 */
export async function getReportStatus(reportId: string): Promise<ReportJob> {
  const response = await apiClient.get<ReportJob>(
    `/admin/quotes/reports/${reportId}/status`
  );
  return response.data;
}

/**
 * Download completed report file
 * @endpoint GET /admin/quotes/reports/:reportId/download
 * @permission platform_admin:view_all_tenants
 * @param reportId Report job UUID
 * @returns Report file blob
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Report not found or not yet completed
 * @throws 410 - Report expired (download window closed)
 */
export async function downloadReport(reportId: string): Promise<Blob> {
  const response = await apiClient.get(`/admin/quotes/reports/${reportId}/download`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Delete a report (cleanup)
 * @endpoint DELETE /admin/quotes/reports/:reportId
 * @permission platform_admin:view_all_tenants
 * @param reportId Report job UUID
 * @returns Deletion confirmation
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Report not found
 */
export async function deleteReport(
  reportId: string
): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(
    `/admin/quotes/reports/${reportId}`
  );
  return response.data;
}

/**
 * List recent reports with pagination
 * @endpoint GET /admin/quotes/reports
 * @permission platform_admin:view_all_tenants
 * @param params Pagination parameters
 * @returns Paginated list of reports
 * @throws 403 - Platform Admin privileges required
 */
export async function listReports(params?: {
  page?: number;
  limit?: number;
}): Promise<ReportListResponse> {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/admin/quotes/reports${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<ReportListResponse>(url);
  return response.data;
}

/**
 * Create a scheduled report (recurring automatic generation)
 * @endpoint POST /admin/quotes/reports/scheduled
 * @permission platform_admin:manage_reports
 * @param dto Scheduled report configuration
 * @returns Created scheduled report
 * @throws 400 - Validation errors (name, report_type, schedule, format, recipients required)
 * @throws 403 - Platform Admin privileges required
 */
export async function createScheduledReport(
  dto: CreateScheduledReportDto
): Promise<ScheduledReport> {
  const response = await apiClient.post<ScheduledReport>(
    '/admin/quotes/reports/scheduled',
    dto
  );
  return response.data;
}

/**
 * List all scheduled reports
 * @endpoint GET /admin/quotes/reports/scheduled
 * @permission platform_admin:view_all_tenants
 * @returns List of all scheduled reports (not paginated)
 * @throws 403 - Platform Admin privileges required
 */
export async function listScheduledReports(): Promise<ScheduledReportListResponse> {
  const response = await apiClient.get<ScheduledReportListResponse>(
    '/admin/quotes/reports/scheduled'
  );
  return response.data;
}

/**
 * Get a scheduled report by ID
 * @endpoint GET /admin/quotes/reports/scheduled/:scheduleId
 * @permission platform_admin:view_all_tenants
 * @param scheduleId Scheduled report UUID
 * @returns Scheduled report details
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Scheduled report not found
 */
export async function getScheduledReport(
  scheduleId: string
): Promise<ScheduledReport> {
  const response = await apiClient.get<ScheduledReport>(
    `/admin/quotes/reports/scheduled/${scheduleId}`
  );
  return response.data;
}

/**
 * Update a scheduled report
 * @endpoint PATCH /admin/quotes/reports/scheduled/:scheduleId
 * @permission platform_admin:manage_reports
 * @param scheduleId Scheduled report UUID
 * @param dto Update data (all fields optional)
 * @returns Updated scheduled report
 * @throws 400 - Invalid request data
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Scheduled report not found
 */
export async function updateScheduledReport(
  scheduleId: string,
  dto: Partial<CreateScheduledReportDto>
): Promise<ScheduledReport> {
  const response = await apiClient.patch<ScheduledReport>(
    `/admin/quotes/reports/scheduled/${scheduleId}`,
    dto
  );
  return response.data;
}

/**
 * Delete a scheduled report (stop recurring generation)
 * @endpoint DELETE /admin/quotes/reports/scheduled/:scheduleId
 * @permission platform_admin:manage_reports
 * @param scheduleId Scheduled report UUID
 * @returns Deletion confirmation
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Scheduled report not found
 */
export async function deleteScheduledReport(
  scheduleId: string
): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(
    `/admin/quotes/reports/scheduled/${scheduleId}`
  );
  return response.data;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Poll report status until completion (helper utility)
 * @param reportId Report job UUID
 * @param onProgress Optional callback for progress updates
 * @param intervalMs Polling interval in milliseconds (default: 2000)
 * @param maxAttempts Maximum polling attempts (default: 60)
 * @returns Completed report job
 * @throws Error if report fails or times out
 */
export async function pollReportStatus(
  reportId: string,
  onProgress?: (job: ReportJob) => void,
  intervalMs: number = 2000,
  maxAttempts: number = 60
): Promise<ReportJob> {
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        attempts++;
        const job = await getReportStatus(reportId);

        if (onProgress) onProgress(job);

        if (job.status === 'completed') {
          clearInterval(interval);
          resolve(job);
        } else if (job.status === 'failed') {
          clearInterval(interval);
          reject(new Error(job.error_message || 'Report generation failed'));
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Report generation timed out'));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, intervalMs);
  });
}

/**
 * Generate report and wait for completion (convenience method)
 * @param dto Report generation configuration
 * @param onProgress Optional callback for progress updates
 * @returns Completed report job with download URL
 * @throws Error if report generation fails
 */
export async function generateAndWaitForReport(
  dto: GenerateReportDto,
  onProgress?: (job: ReportJob) => void
): Promise<ReportJob> {
  const job = await generateReport(dto);
  return pollReportStatus(job.job_id, onProgress); // Use job_id, not id
}

/**
 * Generate report and trigger browser download
 * @param dto Report generation configuration
 * @param filename Optional filename for download (defaults to report type + date)
 * @param onProgress Optional callback for progress updates
 */
export async function generateAndDownloadReport(
  dto: GenerateReportDto,
  filename?: string,
  onProgress?: (job: ReportJob) => void
): Promise<void> {
  const job = await generateAndWaitForReport(dto, onProgress);

  if (!job.download_url) {
    throw new Error('Report completed but download URL not available');
  }

  // Download the report
  const blob = await downloadReport(job.job_id); // Use job_id, not id

  // Determine filename
  const defaultFilename = `${dto.report_type}_${new Date().toISOString().split('T')[0]}.${dto.format}`;
  const finalFilename = filename || defaultFilename;

  // Trigger browser download
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = finalFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}
