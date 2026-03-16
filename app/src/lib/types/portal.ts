/**
 * Portal Module Type Definitions
 * Types for customer portal: authentication, projects, logs, photos
 * Matches backend API at /api/v1/portal/*
 */

// ============================================================================
// Branding (public, no auth)
// ============================================================================

export interface PortalBranding {
  company_name: string;
  logo_file_id: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
  phone: string;
  email: string;
  website: string | null;
  address: PortalAddress | null;
  social_media: PortalSocialMedia;
}

export interface PortalAddress {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip_code: string;
  country: string;
}

export interface PortalSocialMedia {
  instagram: string | null;
  facebook: string | null;
  tiktok: string | null;
  youtube: string | null;
}

// ============================================================================
// Authentication
// ============================================================================

export interface PortalLoginDto {
  tenant_slug: string;
  email: string;
  password: string;
}

export interface PortalLoginResponse {
  token: string;
  customer_slug: string;
  must_change_password: boolean;
  lead: {
    first_name: string;
    last_name: string;
  } | null;
}

export interface PortalForgotPasswordDto {
  tenant_slug: string;
  email: string;
}

export interface PortalResetPasswordDto {
  token: string;
  new_password: string;
}

export interface PortalChangePasswordDto {
  old_password: string;
  new_password: string;
}

export interface PortalMessageResponse {
  message: string;
}

// ============================================================================
// Projects
// ============================================================================

export interface PortalProject {
  id: string;
  project_number: string;
  name: string;
  status: PortalProjectStatus;
  start_date: string | null;
  target_completion_date: string | null;
  progress_percent: number;
}

export interface PortalProjectDetail extends PortalProject {
  description: string | null;
  actual_completion_date: string | null;
  permit_required: boolean;
  tasks: PortalTask[];
  permits: PortalPermit[];
}

export type PortalProjectStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed';

export interface PortalTask {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'blocked' | 'done';
  order_index: number;
  estimated_start_date: string | null;
  estimated_end_date: string | null;
}

export type PortalPermitStatus =
  | 'pending_application'
  | 'submitted'
  | 'approved'
  | 'active'
  | 'failed'
  | 'closed';

export interface PortalPermit {
  id: string;
  permit_type: string;
  status: PortalPermitStatus;
  submitted_date: string | null;
  approved_date: string | null;
}

// ============================================================================
// Logs
// ============================================================================

export interface PortalLogAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'photo' | 'pdf' | 'document';
}

export interface PortalLog {
  id: string;
  log_date: string;
  content: string;
  weather_delay: boolean;
  author: string | null;
  attachments: PortalLogAttachment[];
  created_at: string;
}

// ============================================================================
// Photos
// ============================================================================

export interface PortalPhoto {
  id: string;
  file_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  taken_at: string | null;
  created_at: string;
}

// ============================================================================
// Pagination
// ============================================================================

export interface PortalPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedPortalResponse<T> {
  data: T[];
  meta: PortalPaginationMeta;
}
