/**
 * Admin Alerts & Notifications API Client
 * Endpoints for managing platform admin notifications
 */

import apiClient from './axios';
import type {
  Alert,
  AlertsResponse,
  AlertFilters,
  PaginationParams,
} from '../types/admin';

/**
 * Get unread alerts count
 * GET /api/v1/admin/alerts/unread-count
 */
export async function getUnreadAlertsCount(): Promise<{ count: number }> {
  const response = await apiClient.get<{ count: number }>('/admin/alerts/unread-count');
  return response.data;
}

/**
 * Get recent alerts (for dropdown)
 * GET /api/v1/admin/alerts/recent
 *
 * @param limit Number of alerts to return (default: 10, max: 20)
 */
export async function getRecentAlerts(limit: number = 10): Promise<Alert[]> {
  const response = await apiClient.get<Alert[]>('/admin/alerts/recent', {
    params: { limit: Math.min(limit, 20) },
  });
  return response.data;
}

/**
 * Get all alerts with pagination and filters
 * GET /api/v1/admin/alerts
 */
export async function getAllAlerts(
  filters?: AlertFilters,
  pagination?: PaginationParams
): Promise<AlertsResponse> {
  const params: Record<string, any> = {
    page: pagination?.page || 1,
    limit: pagination?.limit || 20,
    ...filters,
  };

  const response = await apiClient.get<AlertsResponse>('/admin/alerts', { params });
  return response.data;
}

/**
 * Mark an alert as read
 * PATCH /api/v1/admin/alerts/:id/read
 */
export async function markAlertAsRead(alertId: string): Promise<Alert> {
  const response = await apiClient.patch<Alert>(`/admin/alerts/${alertId}/read`);
  return response.data;
}

/**
 * Mark all alerts as read
 * PATCH /api/v1/admin/alerts/read-all
 */
export async function markAllAlertsAsRead(): Promise<{ message: string; updated: number }> {
  const response = await apiClient.patch<{ message: string; updated: number }>(
    '/admin/alerts/read-all'
  );
  return response.data;
}

/**
 * Delete an alert
 * DELETE /api/v1/admin/alerts/:id
 */
export async function deleteAlert(alertId: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/admin/alerts/${alertId}`);
  return response.data;
}
