// Lead360 - Crew Member API Client
// All 8 endpoints from crew_member_REST_API.md + crew hours summary
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import { buildFileUrl } from './files';
import type {
  CrewMember,
  CreateCrewMemberDto,
  UpdateCrewMemberDto,
  ListCrewMembersResponse,
  CrewMemberFilters,
  RevealableCrewField,
  RevealFieldResponse,
  CrewHoursSummary,
} from '@/lib/types/crew';

// ========== CREW MEMBER CRUD ==========

/**
 * Create a new crew member
 * @endpoint POST /crew
 * @roles Owner, Admin, Manager
 */
export const createCrewMember = async (dto: CreateCrewMemberDto): Promise<CrewMember> => {
  const { data } = await apiClient.post<CrewMember>('/crew', dto);
  return data;
};

/**
 * List crew members with pagination, search, and filters
 * @endpoint GET /crew
 * @roles Owner, Admin, Manager
 */
export const getCrewMembers = async (filters?: CrewMemberFilters): Promise<ListCrewMembersResponse> => {
  const params: Record<string, any> = {};
  if (filters?.page) params.page = filters.page;
  if (filters?.limit) params.limit = filters.limit;
  if (filters?.is_active !== undefined) params.is_active = filters.is_active;
  if (filters?.search) params.search = filters.search;

  const { data } = await apiClient.get<ListCrewMembersResponse>('/crew', { params });
  return data;
};

/**
 * Get crew member detail (with masked sensitive fields)
 * @endpoint GET /crew/:id
 * @roles Owner, Admin, Manager
 */
export const getCrewMemberById = async (id: string): Promise<CrewMember> => {
  const { data } = await apiClient.get<CrewMember>(`/crew/${id}`);
  return data;
};

/**
 * Update a crew member
 * @endpoint PATCH /crew/:id
 * @roles Owner, Admin, Manager
 */
export const updateCrewMember = async (id: string, dto: UpdateCrewMemberDto): Promise<CrewMember> => {
  const { data } = await apiClient.patch<CrewMember>(`/crew/${id}`, dto);
  return data;
};

/**
 * Soft delete (deactivate) a crew member
 * @endpoint DELETE /crew/:id
 * @roles Owner, Admin
 */
export const deactivateCrewMember = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/crew/${id}`);
  return data;
};

// ========== SENSITIVE FIELD REVEAL ==========

/**
 * Reveal a sensitive field (audit logged)
 * @endpoint GET /crew/:id/reveal/:field
 * @roles Owner, Admin ONLY
 * @fields ssn, itin, drivers_license_number, bank_routing, bank_account
 */
export const revealCrewField = async (
  id: string,
  field: RevealableCrewField
): Promise<RevealFieldResponse> => {
  const { data } = await apiClient.get<RevealFieldResponse>(`/crew/${id}/reveal/${field}`);
  return data;
};

// ========== PROFILE PHOTO ==========

/**
 * Upload profile photo
 * @endpoint POST /crew/:id/photo
 * @roles Owner, Admin, Manager
 * @content-type multipart/form-data
 */
export const uploadCrewPhoto = async (id: string, file: File): Promise<CrewMember> => {
  const formData = new FormData();
  formData.append('file', file);

  const { data } = await apiClient.post<CrewMember>(`/crew/${id}/photo`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

/**
 * Delete profile photo
 * @endpoint DELETE /crew/:id/photo
 * @roles Owner, Admin
 */
export const deleteCrewPhoto = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/crew/${id}/photo`);
  return data;
};

// ========== CREW HOURS ==========

/**
 * Get crew member hours summary (aggregate across all projects)
 * @endpoint GET /crew/:crewMemberId/hours
 * @roles Owner, Admin, Manager, Bookkeeper
 */
export const getCrewHoursSummary = async (crewMemberId: string): Promise<CrewHoursSummary> => {
  const { data } = await apiClient.get<CrewHoursSummary>(`/crew/${crewMemberId}/hours`);
  return data;
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Format crew member full name
 */
export const formatCrewName = (member: Pick<CrewMember, 'first_name' | 'last_name'>): string => {
  return `${member.first_name} ${member.last_name}`.trim();
};

/**
 * Format phone number for display
 */
export const formatCrewPhone = (phone: string | null): string => {
  if (!phone) return '';
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith('1')) {
    return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
  }
  return phone;
};

/**
 * Get profile photo full URL
 * API returns /public/{tenant_id}/images/{uuid}.webp
 * Nginx serves from /uploads/public/... on app domain
 */
export const getCrewPhotoUrl = (photoUrl: string | null): string | null => {
  if (!photoUrl) return null;
  return buildFileUrl(photoUrl);
};

/**
 * Format hourly rate as currency
 */
export const formatHourlyRate = (rate: number | null): string => {
  if (rate === null || rate === undefined) return '-';
  return `$${rate.toFixed(2)}/hr`;
};
