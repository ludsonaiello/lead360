/**
 * IVR Configuration API Client
 * Maps to /api/v1/communication/twilio/ivr endpoints
 */

import { IVRConfiguration } from "@/lib/types/ivr";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Get IVR Configuration
 * GET /api/v1/communication/twilio/ivr
 *
 * @returns IVR configuration or null if not found
 * @throws Error on network or server errors
 */
export async function getIVRConfiguration(token: string): Promise<IVRConfiguration | null> {
  const response = await fetch(`${API_BASE_URL}/communication/twilio/ivr`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    // No IVR configuration found - this is expected, return null
    return null;
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || `Failed to fetch IVR configuration: ${response.status}`);
  }

  return response.json();
}

/**
 * Create or Update IVR Configuration (Upsert)
 * POST /api/v1/communication/twilio/ivr
 *
 * @param token - JWT token
 * @param data - IVR configuration data
 * @returns Created or updated IVR configuration
 * @throws Error on validation errors or server errors
 */
export async function upsertIVRConfiguration(
  token: string,
  data: {
    ivr_enabled: boolean;
    greeting_message: string;
    menu_options: Array<{
      digit: string;
      action: string;
      label: string;
      config: {
        phone_number?: string;
        webhook_url?: string;
        max_duration_seconds?: number;
      };
    }>;
    default_action: {
      action: string;
      config: {
        phone_number?: string;
        webhook_url?: string;
        max_duration_seconds?: number;
      };
    };
    timeout_seconds: number;
    max_retries: number;
  }
): Promise<IVRConfiguration> {
  const response = await fetch(`${API_BASE_URL}/communication/twilio/ivr`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || `Failed to save IVR configuration: ${response.status}`);
  }

  return response.json();
}

/**
 * Disable IVR Configuration
 * DELETE /api/v1/communication/twilio/ivr
 *
 * @returns Disabled IVR configuration
 * @throws Error on network or server errors
 */
export async function disableIVRConfiguration(token: string): Promise<IVRConfiguration> {
  const response = await fetch(`${API_BASE_URL}/communication/twilio/ivr`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.message || `Failed to disable IVR configuration: ${response.status}`);
  }

  return response.json();
}
