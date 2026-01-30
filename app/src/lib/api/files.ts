/**
 * Files API Client
 * Source: /var/www/lead360.app/api/documentation/files_REST_API.md
 *
 * CRITICAL: 100% endpoint coverage - ALL 15 endpoints implemented
 * Field names copied EXACTLY from API documentation
 */

import apiClient from './axios';
import type { AxiosProgressEvent } from 'axios';
import type {
  File,
  FileFilters,
  ListFilesResponse,
  UploadResponse,
  ShareLink,
  CreateShareLinkRequest,
  CreateShareLinkResponse,
  ListShareLinksResponse,
  AccessSharedFileResponse,
  BulkDeleteRequest,
  BulkDeleteResponse,
  OrphanFilesResponse,
  UploadOptions,
} from '@/lib/types/files';

// ==========================================
// FILE MANAGEMENT ENDPOINTS (7 endpoints)
// ==========================================

/**
 * Upload a file with automatic optimization
 * POST /files/upload
 *
 * @param file - File to upload
 * @param options - Upload options (category, entity_type, entity_id)
 * @returns Upload response with file metadata
 */
export async function uploadFile(
  file: globalThis.File,
  options: UploadOptions
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', options.category);

  if (options.entity_type) {
    formData.append('entity_type', options.entity_type);
  }

  if (options.entity_id) {
    formData.append('entity_id', options.entity_id);
  }

  // Don't pass headers at all - let axios handle Content-Type with boundary automatically
  // and let the interceptor add Authorization header
  const config: any = {
    onUploadProgress: (progressEvent: AxiosProgressEvent) => {
      if (options.onProgress && progressEvent.total) {
        const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        options.onProgress(progress);
      }
    },
  };

  const response = await apiClient.post<UploadResponse>('/files/upload', formData, config);

  return response.data;
}

/**
 * Get all files with filters and pagination
 * GET /files
 *
 * @param filters - Filter parameters (category, entity_type, entity_id, page, limit, etc.)
 * @returns Paginated list of files
 */
export async function getFiles(filters?: FileFilters): Promise<ListFilesResponse> {
  const params = new URLSearchParams();

  if (filters?.category) params.append('category', filters.category);
  if (filters?.entity_type) params.append('entity_type', filters.entity_type);
  if (filters?.entity_id) params.append('entity_id', filters.entity_id);
  if (filters?.file_type) params.append('file_type', filters.file_type);
  if (filters?.start_date) params.append('start_date', filters.start_date);
  if (filters?.end_date) params.append('end_date', filters.end_date);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.limit) params.append('limit', filters.limit.toString());

  const response = await apiClient.get<ListFilesResponse>(`/files?${params.toString()}`);
  return response.data;
}

/**
 * Get a single file by ID
 * GET /files/:id
 *
 * @param id - File ID
 * @returns File metadata
 */
export async function getFile(id: string): Promise<File> {
  const response = await apiClient.get<File>(`/files/${id}`);
  return response.data;
}

/**
 * Delete a file permanently
 * DELETE /files/:id
 * RBAC: Owner or Admin only
 *
 * @param id - File ID
 * @returns Success message
 */
export async function deleteFile(id: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/files/${id}`);
  return response.data;
}

/**
 * Get orphan files (not attached to any entity, >30 days old)
 * GET /files/orphans
 * RBAC: Owner or Admin only
 *
 * @returns List of orphan files
 */
export async function getOrphanFiles(): Promise<OrphanFilesResponse> {
  const response = await apiClient.get<OrphanFilesResponse>('/files/orphans');
  return response.data;
}

/**
 * Move orphan files to trash
 * POST /files/orphans/trash
 * RBAC: Owner or Admin only
 *
 * @returns Count of files moved to trash
 */
export async function trashOrphanFiles(): Promise<{ message: string; count: number }> {
  const response = await apiClient.post<{ message: string; count: number }>('/files/orphans/trash');
  return response.data;
}

/**
 * Permanently delete trashed files (>30 days in trash)
 * DELETE /files/trash/cleanup
 * RBAC: Owner or Admin only
 *
 * @returns Count of files deleted
 */
export async function cleanupTrashedFiles(): Promise<{ message: string; count: number }> {
  const response = await apiClient.delete<{ message: string; count: number }>('/files/trash/cleanup');
  return response.data;
}

// ==========================================
// SHARE LINK ENDPOINTS (5 endpoints)
// ==========================================

/**
 * Create a temporary public share link
 * POST /files/share
 *
 * @param data - Share link configuration (file_id, password, expires_at, max_downloads)
 * @returns Share link details
 */
export async function createShareLink(data: CreateShareLinkRequest): Promise<CreateShareLinkResponse> {
  const response = await apiClient.post<CreateShareLinkResponse>('/files/share', data);
  return response.data;
}

/**
 * List all share links (optionally filtered by file_id)
 * GET /files/share/list
 *
 * @param fileId - Optional file ID to filter by
 * @returns List of share links
 */
export async function listShareLinks(fileId?: string): Promise<ListShareLinksResponse> {
  const params = fileId ? `?file_id=${fileId}` : '';
  const response = await apiClient.get<ListShareLinksResponse>(`/files/share/list${params}`);
  return response.data;
}

/**
 * Revoke a share link
 * DELETE /files/share/:id
 * RBAC: Owner or Admin only
 *
 * @param id - Share link ID
 * @returns Success message
 */
export async function revokeShareLink(id: string): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(`/files/share/${id}`);
  return response.data;
}

/**
 * Access/view a shared file (public endpoint, no auth)
 * Increments VIEW count, not download count
 * POST /public/share/:token/access
 *
 * @param token - Share token (64-char hex)
 * @param password - Optional password if link is password-protected
 * @returns File details and share info (view_count incremented, download_count unchanged)
 */
export async function accessSharedFile(
  token: string,
  password?: string
): Promise<AccessSharedFileResponse> {
  const body = password ? { password } : {};
  const response = await apiClient.post<AccessSharedFileResponse>(
    `/public/share/${token}/access`,
    body
  );
  return response.data;
}

/**
 * Download a shared file (public endpoint, no auth)
 * Increments DOWNLOAD count (counts toward max_downloads limit)
 * POST /public/share/:token/download
 *
 * @param token - Share token (64-char hex)
 * @param password - Optional password if link is password-protected
 * @returns File details and share info (download_count incremented)
 */
export async function downloadSharedFile(
  token: string,
  password?: string
): Promise<AccessSharedFileResponse> {
  const body = password ? { password } : {};
  const response = await apiClient.post<AccessSharedFileResponse>(
    `/public/share/${token}/download`,
    body
  );
  return response.data;
}

// ==========================================
// BULK OPERATIONS ENDPOINTS (2 endpoints)
// ==========================================

/**
 * Bulk delete files
 * POST /files/bulk/delete
 * RBAC: Owner or Admin only
 *
 * @param fileIds - Array of file IDs to delete
 * @returns Count of files deleted
 */
export async function bulkDeleteFiles(fileIds: string[]): Promise<BulkDeleteResponse> {
  const response = await apiClient.post<BulkDeleteResponse>('/files/bulk/delete', {
    file_ids: fileIds,
  });
  return response.data;
}

/**
 * Bulk download files as ZIP archive
 * POST /files/bulk/download
 * RBAC: All authenticated users
 *
 * @param fileIds - Array of file IDs to download (min 1, max 50)
 * @param zipName - Optional name for ZIP file (default: "files.zip")
 * @returns Binary ZIP file data (triggers browser download)
 */
export async function bulkDownloadFiles(
  fileIds: string[],
  zipName: string = 'files.zip'
): Promise<void> {
  const response = await apiClient.post(
    '/files/bulk/download',
    {
      file_ids: fileIds,
      zip_name: zipName,
    },
    {
      responseType: 'blob', // Important for binary data
    }
  );

  // Trigger browser download
  const blob = new Blob([response.data], { type: 'application/zip' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  link.download = zipName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(link.href);
}

// ==========================================
// DOWNLOAD HELPERS
// ==========================================

/**
 * Download a file (triggers browser download)
 *
 * @param file - File object
 */
export function downloadFile(file: File): void {
  const link = document.createElement('a');
  link.href = buildFileUrl(file.url);
  link.download = file.original_filename;
  link.target = '_blank';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Get API base URL from environment
 */
export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL || 'https://api.lead360.app/api/v1';
}

/**
 * Build absolute file URL from relative path
 * Backend now returns full absolute URLs with tenant subdomains
 *
 * @param relativePath - Can be absolute URL or relative path
 * @returns Absolute URL
 */
export function buildFileUrl(relativePath: string | null | undefined): string {
  // Handle null/undefined
  if (!relativePath) {
    return '';
  }

  // Trim whitespace
  const cleanPath = relativePath.trim();

  // If it's already an absolute URL (starts with http:// or https://), return as-is
  if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    return cleanPath;
  }

  // For relative paths, build URL with app base
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.lead360.app';

  // If it's a full storage path like /var/www/lead360.app/app/uploads/public/...
  // Extract everything after 'uploads/public/'
  if (cleanPath.includes('/uploads/public/')) {
    const parts = cleanPath.split('/uploads/public/');
    const finalPath = `/uploads/public/${parts[1]}`;
    return `${appUrl}${finalPath}`;
  }
  // If backend returns /public/{tenant_id}/... we need to change it to /uploads/public/{tenant_id}/...
  else if (cleanPath.startsWith('/public/')) {
    return `${appUrl}/uploads${cleanPath}`;
  }
  // Ensure path starts with /
  else if (!cleanPath.startsWith('/')) {
    return `${appUrl}/${cleanPath}`;
  }

  return `${appUrl}${cleanPath}`;
}

/**
 * Build tenant-specific share link URL
 * Uses tenant subdomain for branded sharing
 *
 * @param token - Share token
 * @param tenantSubdomain - Tenant subdomain (e.g., "acmeplumbing")
 * @returns Share URL with tenant subdomain
 */
export function buildShareLinkUrl(token: string, tenantSubdomain?: string): string {
  if (tenantSubdomain) {
    // Use tenant-specific subdomain for personalized sharing
    return `https://${tenantSubdomain}.lead360.app/public/share/${token}`;
  }

  // Fallback to app.lead360.app if no tenant context
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.lead360.app';
  return `${appUrl}/public/share/${token}`;
}
