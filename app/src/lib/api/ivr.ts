/**
 * IVR Configuration API Client
 * Maps to /api/v1/communication/twilio/ivr endpoints
 * Updated for multi-level IVR support (Sprint IVR-4)
 */

import { IVRConfiguration, IVRFormData } from "@/lib/types/ivr";
import { validateIVRMenuTree } from "@/lib/utils/ivr-validation";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

/**
 * Get IVR Configuration
 * GET /api/v1/communication/twilio/ivr
 * Now supports multi-level menu structures
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

  const config: IVRConfiguration = await response.json();

  // Ensure max_depth exists (backward compatibility)
  if (!config.max_depth) {
    config.max_depth = 4; // Default
  }

  return config;
}

/**
 * Create or Update IVR Configuration (Upsert)
 * POST /api/v1/communication/twilio/ivr
 * Supports multi-level menu structures with validation
 *
 * @param token - JWT token
 * @param data - IVR configuration data (supports nested menus)
 * @returns Created or updated IVR configuration
 * @throws Error on validation errors or server errors
 */
export async function upsertIVRConfiguration(
  token: string,
  data: IVRFormData
): Promise<IVRConfiguration> {
  try {
    // Client-side validation before sending
    const { isValid, errors } = validateIVRMenuTree(
      data.menu_options,
      data.max_depth || 4
    );

    if (!isValid) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    const response = await fetch(`${API_BASE_URL}/communication/twilio/ivr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        ivr_enabled: data.ivr_enabled,
        greeting_message: data.greeting_message,
        menu_options: data.menu_options,
        default_action: data.default_action,
        timeout_seconds: data.timeout_seconds,
        max_retries: data.max_retries,
        max_depth: data.max_depth || 4,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: "Unknown error" }));
      throw new Error(error.message || `Failed to save IVR configuration: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Error saving IVR configuration:", error);
    throw error;
  }
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
