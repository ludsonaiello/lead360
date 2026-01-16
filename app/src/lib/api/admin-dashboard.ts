/**
 * Admin Dashboard API Client
 * Endpoints for Platform Admin dashboard metrics, charts, and activity
 * Based on ACTUAL API responses from http://localhost:8000/api/v1/admin/dashboard/*
 */

import apiClient from './axios';
import type {
  DashboardMetrics,
  ChartType,
  ChartData,
  ActivityItem,
} from '../types/admin';

/**
 * Get all dashboard metrics
 * GET /api/v1/admin/dashboard/metrics
 *
 * Returns comprehensive dashboard metrics including:
 * - Active tenants with growth and sparkline
 * - Total users with growth and sparkline
 * - Job success rate
 * - Storage usage
 * - System health (database, redis)
 */
export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await apiClient.get<DashboardMetrics>('/admin/dashboard/metrics');
  return response.data;
}

/**
 * Get chart data for dashboard visualizations
 * GET /admin/dashboard/charts/:chartType
 *
 * Chart type is passed as a path parameter (e.g., /admin/dashboard/charts/tenant-growth)
 * Backend correctly uses @Param('chartType') to extract the parameter.
 *
 * Valid chart types:
 * - tenant-growth: 90-day tenant growth (time-series)
 * - user-signups: 90-day user signups (time-series)
 * - job-trends: 7-day job success/failure trends
 * - tenants-by-industry: Distribution by industry
 * - tenants-by-size: Distribution by business size
 * - users-by-role: Distribution by user role
 */
export async function getChartData(chartType: ChartType): Promise<ChartData> {
  const response = await apiClient.get<ChartData>(`/admin/dashboard/charts/${chartType}`);
  return response.data;
}

/**
 * Get recent activity feed
 * GET /api/v1/admin/dashboard/activity
 *
 * Returns recent actions from audit log
 *
 * @param limit Number of activity items to return (default: 10, max: 50)
 */
export async function getRecentActivity(limit: number = 10): Promise<ActivityItem[]> {
  const response = await apiClient.get<ActivityItem[]>('/admin/dashboard/activity', {
    params: { limit: Math.min(limit, 50) },
  });
  return response.data;
}

/**
 * Helper function to fetch all dashboard data at once
 * Useful for initial page load
 */
export async function getAllDashboardData() {
  const [metrics, activity] = await Promise.all([
    getDashboardMetrics(),
    getRecentActivity(10),
  ]);

  return {
    metrics,
    activity,
  };
}
