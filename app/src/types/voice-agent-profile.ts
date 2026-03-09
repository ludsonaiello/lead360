export interface VoiceAgentProfile {
  id: string;
  tenant_id: string;
  title: string;
  language_code: string;
  voice_id: string;
  custom_greeting: string | null;
  custom_instructions: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  updated_by: string | null;
}

export interface CreateVoiceAgentProfileDto {
  title: string;
  language_code: string;
  voice_id: string;
  custom_greeting?: string;
  custom_instructions?: string;
  is_active?: boolean;
  display_order?: number;
}

export interface UpdateVoiceAgentProfileDto {
  title?: string;
  language_code?: string;
  voice_id?: string;
  custom_greeting?: string;
  custom_instructions?: string;
  is_active?: boolean;
  display_order?: number;
}
