/**
 * Portal API Client
 * Customer-facing portal endpoints — uses raw axios (NOT apiClient)
 * to avoid staff JWT interceptors and token refresh logic.
 * Source: portal_auth_REST_API.md, portal_project_REST_API.md
 */

import axios from 'axios';
import type {
  PortalBranding,
  PortalLoginDto,
  PortalLoginResponse,
  PortalForgotPasswordDto,
  PortalResetPasswordDto,
  PortalChangePasswordDto,
  PortalMessageResponse,
  PortalProject,
  PortalProjectDetail,
  PortalLog,
  PortalPhoto,
  PaginatedPortalResponse,
} from '../types/portal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lead360.app/api/v1';

// ============================================================================
// Public endpoints (no authentication)
// ============================================================================

/** Get tenant branding by subdomain slug (public, no auth) */
export async function getTenantBranding(slug: string): Promise<PortalBranding> {
  const { data } = await axios.get<PortalBranding>(
    `${API_BASE_URL}/portal/auth/tenant-info/${slug}`,
  );
  return data;
}

/** Portal login */
export async function portalLogin(dto: PortalLoginDto): Promise<PortalLoginResponse> {
  const { data } = await axios.post<PortalLoginResponse>(
    `${API_BASE_URL}/portal/auth/login`,
    dto,
  );
  return data;
}

/** Request portal password reset */
export async function portalForgotPassword(dto: PortalForgotPasswordDto): Promise<PortalMessageResponse> {
  const { data } = await axios.post<PortalMessageResponse>(
    `${API_BASE_URL}/portal/auth/forgot-password`,
    dto,
  );
  return data;
}

/** Reset portal password using token */
export async function portalResetPassword(dto: PortalResetPasswordDto): Promise<PortalMessageResponse> {
  const { data } = await axios.post<PortalMessageResponse>(
    `${API_BASE_URL}/portal/auth/reset-password`,
    dto,
  );
  return data;
}

// ============================================================================
// Authenticated endpoints (portal JWT required)
// ============================================================================

/** Change portal password (portal JWT required) */
export async function portalChangePassword(
  token: string,
  dto: PortalChangePasswordDto,
): Promise<PortalMessageResponse> {
  const { data } = await axios.post<PortalMessageResponse>(
    `${API_BASE_URL}/portal/auth/change-password`,
    dto,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

/** List portal projects */
export async function listPortalProjects(
  token: string,
  customerSlug: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedPortalResponse<PortalProject>> {
  const { data } = await axios.get<PaginatedPortalResponse<PortalProject>>(
    `${API_BASE_URL}/portal/${customerSlug}/projects`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    },
  );
  return data;
}

/** Get portal project detail */
export async function getPortalProject(
  token: string,
  customerSlug: string,
  projectId: string,
): Promise<PortalProjectDetail> {
  const { data } = await axios.get<PortalProjectDetail>(
    `${API_BASE_URL}/portal/${customerSlug}/projects/${projectId}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  return data;
}

/** Get portal project public logs */
export async function getPortalProjectLogs(
  token: string,
  customerSlug: string,
  projectId: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedPortalResponse<PortalLog>> {
  const { data } = await axios.get<PaginatedPortalResponse<PortalLog>>(
    `${API_BASE_URL}/portal/${customerSlug}/projects/${projectId}/logs`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    },
  );
  return data;
}

/** Get portal project public photos */
export async function getPortalProjectPhotos(
  token: string,
  customerSlug: string,
  projectId: string,
  params?: { page?: number; limit?: number },
): Promise<PaginatedPortalResponse<PortalPhoto>> {
  const { data } = await axios.get<PaginatedPortalResponse<PortalPhoto>>(
    `${API_BASE_URL}/portal/${customerSlug}/projects/${projectId}/photos`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params,
    },
  );
  return data;
}

// ============================================================================
// Convenience export
// ============================================================================

export const portalApi = {
  getTenantBranding,
  portalLogin,
  portalForgotPassword,
  portalResetPassword,
  portalChangePassword,
  listPortalProjects,
  getPortalProject,
  getPortalProjectLogs,
  getPortalProjectPhotos,
};
