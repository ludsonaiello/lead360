/**
 * IVR Configuration Types
 * Maps to API response from GET /api/v1/communication/twilio/ivr
 * Updated for multi-level IVR support (Sprint IVR-3)
 */

export type IVRActionType =
  | "route_to_number"
  | "route_to_default"
  | "trigger_webhook"
  | "voicemail"
  | "voice_ai"          // AI-powered voice assistant
  | "submenu"           // Navigate to nested submenu
  | "return_to_parent"  // Navigate back one level
  | "return_to_root";   // Return to main menu

export type IVRStatus = "active" | "inactive";

export interface IVRActionConfig {
  phone_number?: string;
  webhook_url?: string;
  max_duration_seconds?: number;
}

/**
 * IVR Submenu Configuration
 * Used for nested multi-level IVR menus
 */
export interface IVRSubmenu {
  greeting_message: string;          // 5-500 characters
  options: IVRMenuOption[];         // Recursive array
  timeout_seconds?: number;          // Optional override (5-60)
}

/**
 * IVR Menu Option (updated for multi-level support)
 */
export interface IVRMenuOption {
  id: string;                        // UUID for circular reference detection
  digit: string;                     // "0"-"9"
  action: IVRActionType;
  label: string;                     // 1-100 characters
  config: IVRActionConfig;
  submenu?: IVRSubmenu;             // Only present if action === "submenu"
}

/**
 * Default Action (submenu and navigation cannot be default actions)
 */
export interface IVRDefaultAction {
  action: Exclude<IVRActionType, "submenu" | "return_to_parent" | "return_to_root">; // Submenu and navigation cannot be default actions
  config: IVRActionConfig;
}

export interface IVRConfiguration {
  id: string;
  tenant_id: string;
  twilio_config_id: string | null;
  ivr_enabled: boolean;
  greeting_message: string;          // 5-500 characters
  menu_options: IVRMenuOption[];    // 1-10 options (now supports nesting)
  default_action: IVRDefaultAction;
  timeout_seconds: number;           // 5-60 seconds
  max_retries: number;              // 1-5 attempts
  max_depth: number;                // 1-5 levels (NEW for multi-level IVR)
  status: IVRStatus;                // "active" | "inactive"
  created_at: string;
  updated_at: string;
}

/**
 * Form data type (for React Hook Form)
 */
export interface IVRFormData {
  ivr_enabled: boolean;
  greeting_message: string;
  menu_options: IVRMenuOption[];
  default_action: IVRDefaultAction;
  timeout_seconds: number;
  max_retries: number;
  max_depth: number;
}

/**
 * IVR Constants
 */
export const IVR_CONSTANTS = {
  MAX_OPTIONS_PER_LEVEL: 10,
  MAX_DEPTH: 5,
  MIN_DEPTH: 1,
  DEFAULT_DEPTH: 4,
  MIN_TIMEOUT: 5,
  MAX_TIMEOUT: 60,
  DEFAULT_TIMEOUT: 10,
  MIN_RETRIES: 1,
  MAX_RETRIES: 5,
  DEFAULT_RETRIES: 3,
  MIN_GREETING_LENGTH: 5,
  MAX_GREETING_LENGTH: 500,
  MAX_TOTAL_NODES: 100,
} as const;

/**
 * Action type labels for UI
 */
export const ACTION_TYPE_LABELS: Record<IVRActionType, string> = {
  route_to_number: "Route to Phone Number",
  route_to_default: "Route to Default Number",
  trigger_webhook: "Trigger Webhook",
  voicemail: "Voicemail",
  voice_ai: "Voice AI Assistant",
  submenu: "Navigate to Submenu",
  return_to_parent: "Go Back",
  return_to_root: "Return to Main Menu",
};

/**
 * Action type descriptions
 */
export const ACTION_TYPE_DESCRIPTIONS: Record<IVRActionType, string> = {
  route_to_number: "Forward the call to a specific phone number",
  route_to_default: "Forward to the default company phone number",
  trigger_webhook: "Send a webhook notification to an external URL",
  voicemail: "Record a voicemail message",
  voice_ai: "Connect to AI-powered voice assistant",
  submenu: "Navigate to a nested submenu with more options",
  return_to_parent: "Go back one level in the menu tree",
  return_to_root: "Return to the main menu (root level)",
};
