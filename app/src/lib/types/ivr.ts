/**
 * IVR Configuration Types
 * Maps to API response from GET /api/v1/communication/twilio/ivr
 */

export type IVRActionType =
  | "route_to_number"
  | "route_to_default"
  | "trigger_webhook"
  | "voicemail";

export type IVRStatus = "active" | "inactive";

export interface IVRActionConfig {
  phone_number?: string;
  webhook_url?: string;
  max_duration_seconds?: number;
}

export interface IVRMenuOption {
  digit: string; // "0"-"9"
  action: IVRActionType;
  label: string;
  config: IVRActionConfig;
}

export interface IVRDefaultAction {
  action: IVRActionType;
  config: IVRActionConfig;
}

export interface IVRConfiguration {
  id: string;
  tenant_id: string;
  twilio_config_id: string | null;
  ivr_enabled: boolean;
  greeting_message: string;
  menu_options: IVRMenuOption[];
  default_action: IVRDefaultAction;
  timeout_seconds: number;
  max_retries: number;
  status: IVRStatus;
  created_at: string;
  updated_at: string;
}
