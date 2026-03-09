// ============================================================================
// Voice AI Tenant API Client
// ============================================================================
// API methods for Tenant Profile Override Management (Architecture v2)
// Matches backend API docs from api/documentation/voice_agent_profiles_REST_API.md
// ============================================================================

import { apiClient } from './axios';

export interface AvailableGlobalProfile {
  id: string;
  language_code: string;
  language_name: string;
  voice_id: string;
  display_name: string;
  description?: string;
  default_greeting?: string;
  default_instructions?: string;
  is_active: boolean;
  display_order: number;
}

export interface TenantOverride {
  id: string;
  tenant_id: string;
  agent_profile_id: string;
  custom_greeting?: string;
  custom_instructions?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  agent_profile: AvailableGlobalProfile;
}

export interface CreateOverrideDto {
  agent_profile_id: string;
  custom_greeting?: string;
  custom_instructions?: string;
  is_active?: boolean;
}

export interface UpdateOverrideDto extends Partial<Omit<CreateOverrideDto, 'agent_profile_id'>> {}

export const voiceAiTenantApi = {
  availableProfiles: {
    list: async (activeOnly = true): Promise<AvailableGlobalProfile[]> => {
      const response = await apiClient.get(
        `/voice-ai/available-profiles?active_only=${activeOnly}`
      );
      return response.data;
    },
  },

  overrides: {
    list: async (activeOnly = false): Promise<TenantOverride[]> => {
      const response = await apiClient.get(
        `/voice-ai/agent-profile-overrides?active_only=${activeOnly}`
      );
      return response.data;
    },

    create: async (data: CreateOverrideDto): Promise<TenantOverride> => {
      const response = await apiClient.post('/voice-ai/agent-profile-overrides', data);
      return response.data;
    },

    get: async (id: string): Promise<TenantOverride> => {
      const response = await apiClient.get(`/voice-ai/agent-profile-overrides/${id}`);
      return response.data;
    },

    update: async (id: string, data: UpdateOverrideDto): Promise<TenantOverride> => {
      const response = await apiClient.patch(
        `/voice-ai/agent-profile-overrides/${id}`,
        data
      );
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/voice-ai/agent-profile-overrides/${id}`);
    },
  },
};
