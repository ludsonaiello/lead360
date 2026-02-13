/**
 * Twilio Tenant-Facing API Type Definitions
 * Lead360 Platform - Communication Module (Twilio Integration)
 *
 * All types based on API documentation and tested against live backend
 * Base URL: /api/v1/communication/twilio/*
 */

// ============================================
// SMS Configuration Types
// ============================================

/**
 * SMS configuration response from API
 * Credentials are NEVER included in responses for security
 */
export interface SMSConfig {
  /** Configuration UUID */
  id: string;
  /** Tenant UUID (from JWT token) */
  tenant_id: string;
  /** Communication provider UUID */
  provider_id: string;
  /** Phone number in E.164 format */
  from_phone: string;
  /** Whether configuration is active */
  is_active: boolean;
  /** Whether credentials were verified with Twilio */
  is_verified: boolean;
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  /** Last update timestamp (ISO 8601) */
  updated_at: string;
}

/**
 * Create SMS configuration request payload
 * Credentials are validated against Twilio API before storage
 */
export interface CreateSMSConfigRequest {
  /** Communication provider ID (must be twilio_sms provider) */
  provider_id: string;
  /** Twilio Account SID (starts with AC + 32 chars) */
  account_sid: string;
  /** Twilio Auth Token (min 32 characters) */
  auth_token: string;
  /** Twilio phone number with country code (E.164 format) */
  from_phone: string;
  /** Optional webhook secret for signature verification */
  webhook_secret?: string;
}

/**
 * Update SMS configuration request payload
 * All fields are optional
 */
export interface UpdateSMSConfigRequest {
  /** Twilio Account SID */
  account_sid?: string;
  /** Twilio Auth Token */
  auth_token?: string;
  /** Phone number (E.164 format) */
  from_phone?: string;
  /** Webhook secret */
  webhook_secret?: string;
  /** Active status */
  is_active?: boolean;
}

/**
 * Test SMS configuration response
 * Returned after sending test SMS to verify configuration
 */
export interface TestSMSConfigResponse {
  /** Whether test was successful */
  success: boolean;
  /** Success message */
  message: string;
  /** Twilio Message SID */
  twilio_message_sid: string;
  /** Sender phone number */
  from: string;
  /** Recipient phone number (same as from for self-test) */
  to: string;
}

// ============================================
// WhatsApp Configuration Types
// ============================================

/**
 * WhatsApp configuration response from API
 * Credentials are NEVER included in responses for security
 */
export interface WhatsAppConfig {
  /** Configuration UUID */
  id: string;
  /** Tenant UUID (from JWT token) */
  tenant_id: string;
  /** Communication provider UUID */
  provider_id: string;
  /** Phone number with "whatsapp:" prefix */
  from_phone: string;
  /** Whether configuration is active */
  is_active: boolean;
  /** Whether credentials were verified with Twilio */
  is_verified: boolean;
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  /** Last update timestamp (ISO 8601) */
  updated_at: string;
}

/**
 * Create WhatsApp configuration request payload
 * Requires approved WhatsApp Business Account with Twilio
 */
export interface CreateWhatsAppConfigRequest {
  /** Communication provider ID (must be twilio_whatsapp provider) */
  provider_id: string;
  /** Twilio Account SID (starts with AC + 32 chars) */
  account_sid: string;
  /** Twilio Auth Token (min 32 characters) */
  auth_token: string;
  /** WhatsApp-enabled phone number (E.164 format, with or without "whatsapp:" prefix) */
  from_phone: string;
  /** Optional webhook secret for signature verification */
  webhook_secret?: string;
}

/**
 * Update WhatsApp configuration request payload
 * All fields are optional
 */
export interface UpdateWhatsAppConfigRequest {
  /** Twilio Account SID */
  account_sid?: string;
  /** Twilio Auth Token */
  auth_token?: string;
  /** Phone number (E.164 format) */
  from_phone?: string;
  /** Webhook secret */
  webhook_secret?: string;
  /** Active status */
  is_active?: boolean;
}

/**
 * Test WhatsApp configuration response
 * Returned after sending test WhatsApp message
 */
export interface TestWhatsAppConfigResponse {
  /** Whether test was successful */
  success: boolean;
  /** Success message */
  message: string;
  /** Twilio Message SID */
  twilio_message_sid: string;
  /** Sender phone number (with "whatsapp:" prefix) */
  from: string;
  /** Recipient phone number (with "whatsapp:" prefix, same as from for self-test) */
  to: string;
}

// ============================================
// Call Management Types
// ============================================

/** Call direction: inbound or outbound */
export type CallDirection = 'inbound' | 'outbound';

/** Call status throughout lifecycle */
export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'canceled';

/** Type of call for routing and classification */
export type CallType =
  | 'customer_call'
  | 'office_bypass_call'
  | 'ivr_routed_call';

/** Recording processing status */
export type RecordingStatus =
  | 'pending'
  | 'available'
  | 'processing_transcription'
  | 'transcribed'
  | 'failed';

/**
 * Call record with all details
 * Includes related Lead and User information when available
 */
export interface CallRecord {
  /** Call record UUID */
  id: string;
  /** Tenant UUID */
  tenant_id: string;
  /** Lead UUID (if matched) */
  lead_id: string | null;
  /** Twilio Call SID */
  twilio_call_sid: string;
  /** Call direction */
  direction: CallDirection;
  /** Caller phone number */
  from_number: string;
  /** Recipient phone number */
  to_number: string;
  /** Current call status */
  status: CallStatus;
  /** Type of call for classification */
  call_type: CallType;
  /** Optional reason for call */
  call_reason: string | null;
  /** Recording file URL (relative path) */
  recording_url: string | null;
  /** Recording duration in seconds */
  recording_duration_seconds: number | null;
  /** Recording processing status */
  recording_status: RecordingStatus;
  /** When call was answered (ISO 8601) */
  started_at: string | null;
  /** When call ended (ISO 8601) */
  ended_at: string | null;
  /** When call record was created (ISO 8601) */
  created_at: string;
  /** Associated Lead information (when available) */
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
  /** User who initiated call (outbound only) */
  initiated_by_user?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

/**
 * Initiate outbound call request payload
 * System calls user's phone first, then bridges to Lead
 */
export interface InitiateCallRequest {
  /** Lead UUID to call */
  lead_id: string;
  /** User's phone number (called first, E.164 format) */
  user_phone_number: string;
  /** Optional reason for call (saved to call record) */
  call_reason?: string;
}

/**
 * Initiate call response
 * Returned after call is initiated successfully
 */
export interface InitiateCallResponse {
  /** Whether call initiation was successful */
  success: boolean;
  /** CallRecord UUID for tracking */
  call_record_id: string;
  /** Twilio Call SID */
  twilio_call_sid: string;
  /** Instruction message */
  message: string;
}

/**
 * Paginated call history response
 * Includes data array and pagination metadata
 */
export interface CallHistoryResponse {
  /** Array of call records */
  data: CallRecord[];
  /** Pagination metadata */
  meta: {
    /** Total number of call records */
    total: number;
    /** Current page number */
    page: number;
    /** Items per page */
    limit: number;
    /** Total number of pages */
    totalPages: number;
  };
}

/**
 * Call recording response
 * Includes URL and transcription availability
 */
export interface CallRecordingResponse {
  /** Recording file URL (relative path) */
  url: string;
  /** Recording duration in seconds */
  duration_seconds: number;
  /** Whether transcription is available for this call */
  transcription_available: boolean;
}

/**
 * Call transcription response
 * Includes transcription text and metadata
 */
export interface CallTranscriptionResponse {
  /** Transcription text */
  transcription_text: string | null;
  /** Language detected (ISO code) */
  language_detected: string | null;
  /** Confidence score (0-1) */
  confidence_score: number | null;
  /** Transcription provider used */
  transcription_provider: string;
  /** Transcription status */
  status: string;
}

// ============================================
// IVR Configuration Types
// ============================================

/** IVR action type */
export type IVRActionType =
  | 'route_to_number'
  | 'route_to_default'
  | 'trigger_webhook'
  | 'voicemail';

/**
 * IVR menu option for a specific DTMF digit
 */
export interface IVRMenuOption {
  /** DTMF digit (0-9, must be unique) */
  digit: string;
  /** Action to execute when this digit is pressed */
  action: IVRActionType;
  /** Human-readable label for this option */
  label: string;
  /** Action-specific configuration */
  config: {
    /** For route_to_number: phone number in E.164 format */
    phone_number?: string;
    /** For trigger_webhook: webhook URL (HTTPS only) */
    webhook_url?: string;
    /** For voicemail: max duration in seconds (60-300) */
    max_duration_seconds?: number;
  };
}

/**
 * IVR default action when no input or timeout
 */
export interface IVRDefaultAction {
  /** Action type */
  action: IVRActionType;
  /** Action-specific configuration */
  config: {
    /** For route_to_number: phone number in E.164 format */
    phone_number?: string;
    /** For trigger_webhook: webhook URL (HTTPS only) */
    webhook_url?: string;
    /** For voicemail: max duration in seconds (60-300) */
    max_duration_seconds?: number;
  };
}

/**
 * IVR configuration response from API
 */
export interface IVRConfig {
  /** Configuration UUID */
  id: string;
  /** Tenant UUID */
  tenant_id: string;
  /** Twilio configuration ID (nullable) */
  twilio_config_id: string | null;
  /** Whether IVR is enabled */
  ivr_enabled: boolean;
  /** Greeting message spoken before menu (5-500 chars) */
  greeting_message: string;
  /** Menu options (1-10 items, unique digits) */
  menu_options: IVRMenuOption[];
  /** Default action if no input or timeout */
  default_action: IVRDefaultAction;
  /** Seconds to wait for input (5-60) */
  timeout_seconds: number;
  /** Max retry attempts for invalid input (1-5) */
  max_retries: number;
  /** Configuration status */
  status: 'active' | 'inactive';
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  /** Last update timestamp (ISO 8601) */
  updated_at: string;
}

/**
 * Create or update IVR configuration request payload
 * Uses upsert pattern - creates or updates existing config
 */
export interface CreateOrUpdateIVRConfigRequest {
  /** Whether IVR is enabled */
  ivr_enabled: boolean;
  /** Greeting message (5-500 chars) */
  greeting_message: string;
  /** Menu options (1-10 items, unique digits) */
  menu_options: IVRMenuOption[];
  /** Default action */
  default_action: IVRDefaultAction;
  /** Timeout in seconds (5-60) */
  timeout_seconds: number;
  /** Max retries (1-5) */
  max_retries: number;
}

// ============================================
// Office Bypass Whitelist Types
// ============================================

/**
 * Office whitelist entry
 * Whitelisted numbers bypass IVR and can make outbound calls
 */
export interface OfficeWhitelistEntry {
  /** Entry UUID */
  id: string;
  /** Tenant UUID */
  tenant_id: string;
  /** Phone number (E.164 format, no spaces or formatting) */
  phone_number: string;
  /** Human-readable identifier (e.g., "John Doe - Sales Manager") */
  label: string;
  /** Entry status */
  status: 'active' | 'inactive';
  /** Creation timestamp (ISO 8601) */
  created_at: string;
  /** Last update timestamp (ISO 8601) */
  updated_at: string;
}

/**
 * Add phone number to whitelist request payload
 */
export interface AddPhoneToWhitelistRequest {
  /** Phone number (E.164 format: +12025551234) */
  phone_number: string;
  /** Human-readable label (1-100 chars) */
  label: string;
}

/**
 * Update whitelist entry request payload
 * Can update phone_number, label, and/or status
 */
export interface UpdateWhitelistLabelRequest {
  /** Updated phone number (E.164 format) */
  phone_number?: string;
  /** Updated label (1-100 chars) */
  label?: string;
  /** Updated status (active/inactive) */
  status?: 'active' | 'inactive';
}

// ============================================
// Common Error Response Type
// ============================================

/**
 * Standard API error response format
 * Matches backend error structure
 */
export interface APIError {
  /** HTTP status code */
  statusCode: number;
  /** Error code for programmatic handling */
  errorCode?: string;
  /** Human-readable error message */
  message: string;
  /** Error type/category */
  error?: string;
  /** Validation errors (when applicable) */
  errors?: Array<{
    /** Field that failed validation */
    field: string;
    /** Validation error message */
    message: string;
  }>;
  /** Request timestamp (ISO 8601) */
  timestamp?: string;
  /** Request path */
  path?: string;
  /** Request ID for tracking */
  requestId?: string;
}
