// Audit Log API Client
// Endpoints: /api/v1/audit-logs

import { apiClient } from './axios';
import type {
  AuditLog,
  AuditLogResponse,
  AuditLogFilters,
  ExportFormat
} from '@/lib/types/audit';

/**
 * Get paginated list of audit logs with optional filters
 *
 * @param filters - Filter parameters
 * @returns Promise<AuditLogResponse>
 *
 * Endpoint: GET /audit-logs
 * Permission: audit:view
 * Tenant Isolation: Auto-filtered to user's tenant (Platform Admin sees all)
 */
export async function getAuditLogs(
  filters?: AuditLogFilters
): Promise<AuditLogResponse> {
  const response = await apiClient.get<AuditLogResponse>('/audit-logs', {
    params: filters
  });
  return response.data;
}

/**
 * Get a single audit log entry by ID
 *
 * @param id - Audit log UUID
 * @param tenantId - Optional tenant ID (Platform Admin only - for cross-tenant access)
 * @returns Promise<AuditLog>
 *
 * Endpoint: GET /audit-logs/:id OR GET /tenants/:tenantId/audit-logs/:id
 * Permission: audit:view
 * Tenant Isolation: Returns 404 if log doesn't belong to user's tenant (unless Platform Admin with tenantId)
 */
export async function getAuditLog(id: string, tenantId?: string): Promise<AuditLog> {
  const url = tenantId
    ? `/tenants/${tenantId}/audit-logs/${id}`
    : `/audit-logs/${id}`;
  const response = await apiClient.get<AuditLog>(url);
  return response.data;
}

/**
 * Export audit logs to CSV or JSON format
 * Triggers browser download automatically
 *
 * @param format - Export format (csv or json)
 * @param filters - Filter parameters (page and limit excluded)
 * @returns Promise<void>
 *
 * Endpoint: GET /audit-logs/export
 * Permission: audit:export
 * Limit: Maximum 10,000 rows per export
 *
 * @throws Error if export exceeds 10,000 rows
 */
export async function exportAuditLogs(
  format: ExportFormat,
  filters?: Omit<AuditLogFilters, 'page' | 'limit'>
): Promise<void> {
  const response = await apiClient.get('/audit-logs/export', {
    params: { ...filters, format },
    responseType: 'blob'
  });

  // Create blob URL for download
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;

  // Extract filename from Content-Disposition header or generate default
  const contentDisposition = response.headers['content-disposition'];
  let filename = `audit-log-export-${Date.now()}.${format}`;

  if (contentDisposition) {
    const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
    if (filenameMatch && filenameMatch[1]) {
      filename = filenameMatch[1].replace(/"/g, '');
    }
  }

  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();

  // Cleanup
  link.remove();
  window.URL.revokeObjectURL(url);
}

/**
 * Get audit logs for a specific user's activity
 *
 * @param userId - User UUID
 * @param filters - Filter parameters
 * @returns Promise<AuditLogResponse>
 *
 * Endpoint: GET /users/:userId/audit-logs
 * Permission: audit:view
 * Tenant Isolation: Can only view users in own tenant
 */
export async function getUserAuditLogs(
  userId: string,
  filters?: AuditLogFilters
): Promise<AuditLogResponse> {
  const response = await apiClient.get<AuditLogResponse>(
    `/users/${userId}/audit-logs`,
    { params: filters }
  );
  return response.data;
}

/**
 * Get audit logs for a specific tenant (Platform Admin only)
 *
 * @param tenantId - Tenant UUID
 * @param filters - Filter parameters
 * @returns Promise<AuditLogResponse>
 *
 * Endpoint: GET /tenants/:tenantId/audit-logs
 * Permission: platform_admin.view_all_tenants
 * Access: Platform Admin only
 */
export async function getTenantAuditLogs(
  tenantId: string,
  filters?: AuditLogFilters
): Promise<AuditLogResponse> {
  const response = await apiClient.get<AuditLogResponse>(
    `/tenants/${tenantId}/audit-logs`,
    { params: filters }
  );
  return response.data;
}
