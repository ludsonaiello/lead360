/**
 * API Client Configuration for Voice Agent
 *
 * These values come from environment variables.
 * The child process inherits env vars from the parent NestJS process.
 */

export interface ApiConfig {
  baseUrl: string;
  agentKey: string;
  timeoutMs: number;
  maxRetries: number;
}

let cachedConfig: ApiConfig | null = null;

/**
 * Get API configuration from environment variables.
 * Values are cached after first read.
 */
export function getApiConfig(): ApiConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const baseUrl = process.env.LEAD360_API_URL || process.env.API_URL || 'http://localhost:8000';
  const agentKey = process.env.VOICE_AGENT_API_KEY || '';
  const timeoutMs = parseInt(process.env.VOICE_AGENT_TIMEOUT_MS || '10000', 10);
  const maxRetries = parseInt(process.env.VOICE_AGENT_MAX_RETRIES || '2', 10);

  if (!agentKey) {
    console.error('[API Client] WARNING: VOICE_AGENT_API_KEY not set!');
  }

  cachedConfig = {
    baseUrl: baseUrl.replace(/\/$/, ''), // Remove trailing slash
    agentKey,
    timeoutMs,
    maxRetries,
  };

  console.log(`[API Client] Configured: baseUrl=${cachedConfig.baseUrl}, timeout=${cachedConfig.timeoutMs}ms`);

  return cachedConfig;
}
