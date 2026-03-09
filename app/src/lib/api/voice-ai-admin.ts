// ============================================================================
// Voice AI Admin API Client
// ============================================================================
// API methods for Voice AI Admin Portal (Platform Admin Only)
// Manages global voice agent profiles for multilingual v2 architecture
// ============================================================================

import apiClient from './axios';
import type {
  GlobalAgentProfile,
  CreateGlobalProfileDto,
  UpdateGlobalProfileDto,
} from '../types/voice-ai';

// ============================================================================
// Global Agent Profiles Management
// Base path: /api/v1/system/voice-ai/agent-profiles
// ============================================================================

export const voiceAiAdminApi = {
  globalProfiles: {
    /**
     * List all global agent profiles
     * @param activeOnly - If true, returns only active profiles
     * @returns Promise<GlobalAgentProfile[]>
     */
    list: async (activeOnly = false): Promise<GlobalAgentProfile[]> => {
      const params: Record<string, string> = {};

      if (activeOnly) {
        params.active_only = 'true';
      }

      const { data } = await apiClient.get('/system/voice-ai/agent-profiles', { params });
      return data;
    },

    /**
     * Create a new global profile
     * @param data - Profile creation data
     * @returns Promise<GlobalAgentProfile>
     */
    create: async (data: CreateGlobalProfileDto): Promise<GlobalAgentProfile> => {
      const response = await apiClient.post('/system/voice-ai/agent-profiles', data);
      return response.data;
    },

    /**
     * Get a single global profile by ID
     * @param id - Profile ID (UUID)
     * @returns Promise<GlobalAgentProfile>
     */
    get: async (id: string): Promise<GlobalAgentProfile> => {
      const response = await apiClient.get(`/system/voice-ai/agent-profiles/${id}`);
      return response.data;
    },

    /**
     * Update a global profile
     * @param id - Profile ID (UUID)
     * @param data - Partial update data
     * @returns Promise<GlobalAgentProfile>
     */
    update: async (id: string, data: UpdateGlobalProfileDto): Promise<GlobalAgentProfile> => {
      const response = await apiClient.patch(`/system/voice-ai/agent-profiles/${id}`, data);
      return response.data;
    },

    /**
     * Delete a global profile (soft delete)
     * @param id - Profile ID (UUID)
     * @returns Promise<void>
     */
    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/system/voice-ai/agent-profiles/${id}`);
    },
  },
};
