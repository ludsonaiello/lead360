/**
 * HTTP Client for Voice Agent
 *
 * Provides type-safe HTTP methods for the agent to call Lead360 API.
 * Handles authentication, timeouts, retries, and error handling.
 *
 * IMPORTANT: This runs in a child process, NOT in NestJS context.
 * Uses native fetch (Node 18+) - no external dependencies.
 */

import { getApiConfig } from './api-config';

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: number;
}

/**
 * Delay utility for retries
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make an HTTP POST request to Lead360 API
 *
 * @param path API path (e.g., '/api/v1/internal/voice-ai/lookup-tenant')
 * @param body Request body (will be JSON stringified)
 * @returns ApiResponse with typed data or error
 */
export async function apiPost<T>(path: string, body: object): Promise<ApiResponse<T>> {
  const config = getApiConfig();
  const url = `${config.baseUrl}${path}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[API Client] Retry attempt ${attempt} for POST ${path}`);
        await delay(1000 * attempt); // Exponential backoff: 1s, 2s, 3s...
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Voice-Agent-Key': config.agentKey,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        console.error(`[API Client] POST ${path} failed: ${response.status}`, responseData);
        return {
          success: false,
          error: responseData.message || `HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      return {
        success: true,
        data: responseData as T,
        statusCode: response.status,
      };

    } catch (error: any) {
      lastError = error;

      if (error.name === 'AbortError') {
        console.error(`[API Client] POST ${path} timed out after ${config.timeoutMs}ms`);
      } else {
        console.error(`[API Client] POST ${path} error:`, error.message);
      }

      // Don't retry on certain errors
      if (error.name === 'AbortError' || attempt === config.maxRetries) {
        break;
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
  };
}

/**
 * Make an HTTP GET request to Lead360 API
 *
 * @param path API path (e.g., '/api/v1/internal/voice-ai/tenant/:id/context')
 * @returns ApiResponse with typed data or error
 */
export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const config = getApiConfig();
  const url = `${config.baseUrl}${path}`;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[API Client] Retry attempt ${attempt} for GET ${path}`);
        await delay(1000 * attempt);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.timeoutMs);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Voice-Agent-Key': config.agentKey,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        console.error(`[API Client] GET ${path} failed: ${response.status}`, responseData);
        return {
          success: false,
          error: responseData.message || `HTTP ${response.status}`,
          statusCode: response.status,
        };
      }

      return {
        success: true,
        data: responseData as T,
        statusCode: response.status,
      };

    } catch (error: any) {
      lastError = error;

      if (error.name === 'AbortError') {
        console.error(`[API Client] GET ${path} timed out after ${config.timeoutMs}ms`);
      } else {
        console.error(`[API Client] GET ${path} error:`, error.message);
      }

      if (error.name === 'AbortError' || attempt === config.maxRetries) {
        break;
      }
    }
  }

  return {
    success: false,
    error: lastError?.message || 'Unknown error',
  };
}
