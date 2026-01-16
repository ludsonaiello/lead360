/**
 * Admin Data Export API Client
 * Endpoints for exporting tenants, users, and audit logs to CSV/PDF
 */

import apiClient from './axios';
import type {
  ExportJob,
  ExportHistoryResponse,
  CreateExportDto,
  ExportEstimate,
  ExportType,
  PaginationParams,
} from '../types/admin';

/**
 * Get export history
 * GET /api/v1/admin/exports/history
 */
export async function getExportHistory(
  pagination?: PaginationParams
): Promise<ExportHistoryResponse> {
  const params = {
    page: pagination?.page || 1,
    limit: pagination?.limit || 10,
  };

  const response = await apiClient.get<ExportHistoryResponse>('/admin/exports/history', {
    params,
  });
  return response.data;
}

/**
 * Get export job status
 * GET /api/v1/admin/exports/:id
 */
export async function getExportStatus(exportId: string): Promise<ExportJob> {
  const response = await apiClient.get<ExportJob>(`/admin/exports/${exportId}`);
  return response.data;
}

/**
 * Create a new export job
 * POST /api/v1/admin/exports/create
 *
 * This queues a background job to generate the export.
 * Poll getExportStatus() to check completion.
 */
export async function createExport(dto: CreateExportDto): Promise<ExportJob> {
  const response = await apiClient.post<ExportJob>('/admin/exports/create', dto);
  return response.data;
}

/**
 * Get estimated export size
 * POST /api/v1/admin/exports/estimate
 *
 * Returns estimated row count, file size, and processing time
 * before actually creating the export.
 */
export async function getExportEstimate(
  exportType: ExportType,
  filters?: Record<string, any>
): Promise<ExportEstimate> {
  const response = await apiClient.post<ExportEstimate>('/admin/exports/estimate', {
    export_type: exportType,
    filters,
  });
  return response.data;
}

/**
 * Download an export file
 * GET /api/v1/admin/exports/:id/download
 *
 * Returns a blob URL for downloading the file
 */
export async function downloadExport(exportId: string): Promise<Blob> {
  const response = await apiClient.get(`/admin/exports/${exportId}/download`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Helper: Download export and trigger browser download
 */
export async function downloadExportFile(exportId: string, filename: string): Promise<void> {
  const blob = await downloadExport(exportId);
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

/**
 * Poll export status until completed or failed
 * Useful for showing progress spinner
 *
 * @param exportId Export job ID
 * @param onProgress Callback for progress updates
 * @param intervalMs Polling interval (default: 2000ms)
 * @param maxAttempts Maximum polling attempts (default: 60)
 */
export async function pollExportStatus(
  exportId: string,
  onProgress?: (job: ExportJob) => void,
  intervalMs: number = 2000,
  maxAttempts: number = 60
): Promise<ExportJob> {
  let attempts = 0;

  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        attempts++;
        const job = await getExportStatus(exportId);

        if (onProgress) {
          onProgress(job);
        }

        if (job.status === 'completed') {
          clearInterval(interval);
          resolve(job);
        } else if (job.status === 'failed') {
          clearInterval(interval);
          reject(new Error(job.error_message || 'Export failed'));
        } else if (attempts >= maxAttempts) {
          clearInterval(interval);
          reject(new Error('Export timed out'));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, intervalMs);
  });
}
