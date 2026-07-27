import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'https://api.lead360.app/api/v1';

/**
 * Creates an axios instance for kiosk endpoints.
 * Uses X-Kiosk-Token header — NO JWT, no token refresh, no auth interceptors.
 */
export function createKioskApi(token: string): AxiosInstance {
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      'X-Kiosk-Token': token,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

// ── Types ────────────────────────────────────────────────────────────────

export interface KioskEmployee {
  id: string;
  user: {
    first_name: string;
    last_name: string;
  };
  has_pin: boolean;
  is_clocked_in: boolean;
}

export interface KioskEmployeesResponse {
  data: KioskEmployee[];
}

export interface KioskClockResponse {
  id: string;
  status: string;
  clock_in_at: string;
  clock_out_at: string | null;
  clock_in_location_source: string;
  total_worked_minutes: number | null;
}

export interface KioskErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  remaining_attempts?: number | null;
}
