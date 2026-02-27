# Sprint VAB-03: HTTP Client Utility for Agent

**Module**: Voice AI - HTTP API Bridge  
**Sprint**: VAB-03  
**Depends on**: VAB-01, VAB-02 (endpoints must exist)  
**Estimated Effort**: Medium (2-3 hours)

---

## Developer Mindset

```
YOU ARE A MASTERCLASS DEVELOPER.

You approach problems with CALM PRECISION.
You DO NOT guess. You DO NOT rush.
You REVIEW existing code patterns before writing new code.
You write PRODUCTION-READY code that follows existing conventions.
You VERIFY your work compiles and runs before marking complete.
You DO NOT forget to test. You DO NOT leave broken code.
Peace. Focus. Excellence.
```

---

## Objective

Create a robust HTTP client utility that the voice agent (running in a child process) uses to communicate with the Lead360 API. This client will handle:
- Authentication with X-Voice-Agent-Key header
- Timeout handling
- Retry logic for transient failures
- Error handling and logging
- Type-safe responses

---

## Background

The LiveKit agent runs in a **separate child process** spawned by the AgentServer. This process cannot access NestJS services directly (they're in a different memory space). Instead, the agent must make HTTP calls back to the Lead360 API.

---

## Pre-Coding Checklist

- [ ] Understand the voice-ai agent directory structure
- [ ] Check what HTTP client is available (fetch is built into Node 18+)
- [ ] Review environment variables needed (API URL, API key)
- [ ] Understand TypeScript/ES module setup in the agent

**DO NOT START CODING UNTIL ALL BOXES ARE CHECKED**

---

## Task 1: Create API Client Configuration

**File**: `api/src/modules/voice-ai/agent/utils/api-config.ts`

```typescript
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

  const baseUrl = process.env.LEAD360_API_URL || process.env.API_URL || 'http://localhost:3000';
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
```

---

## Task 2: Create HTTP Client Utility

**File**: `api/src/modules/voice-ai/agent/utils/api-client.ts`

```typescript
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
```

---

## Task 3: Create Type Definitions

**File**: `api/src/modules/voice-ai/agent/utils/api-types.ts`

```typescript
/**
 * Type definitions for API responses
 * These mirror the DTOs/interfaces from the NestJS side
 */

// Tenant lookup response
export interface LookupTenantResponse {
  found: boolean;
  tenant_id?: string;
  tenant_name?: string;
  phone_number?: string;
  error?: string;
}

// Access check response
export interface AccessCheckResponse {
  has_access: boolean;
  reason?: 'tenant_not_found' | 'not_enabled' | 'quota_exceeded';
  minutes_remaining?: number;
  overage_rate?: number | null;
}

// Start call response
export interface StartCallResponse {
  call_log_id: string;
}

// Complete call response (usually empty success)
export interface CompleteCallResponse {
  success?: boolean;
}

// Context response (full VoiceAiContext)
export interface VoiceAiContext {
  call_sid: string | null;
  tenant: {
    id: string;
    company_name: string;
    phone: string | null;
    timezone: string;
    language: string | null;
    business_description: string | null;
    email?: string | null;
    primary_address?: {
      street: string | null;
      city: string | null;
      state: string | null;
      zip: string | null;
    } | null;
  };
  quota: {
    minutes_included: number;
    minutes_used: number;
    minutes_remaining: number;
    overage_rate: number | null;
    quota_exceeded: boolean;
  };
  behavior: {
    is_enabled: boolean;
    language: string;
    enabled_languages: string[];
    greeting: string;
    system_prompt: string;
    custom_instructions: string | null;
    booking_enabled: boolean;
    lead_creation_enabled: boolean;
    transfer_enabled: boolean;
    max_call_duration_seconds: number;
  };
  providers: {
    stt: ProviderConfig | null;
    llm: ProviderConfig | null;
    tts: (ProviderConfig & { voice_id: string | null }) | null;
  };
  services: Array<{ name: string; description: string | null }>;
  service_areas: Array<{ type: string; value: string; state: string | null }>;
  business_hours: Array<{
    day: string;
    is_closed: boolean;
    shifts: Array<{ open: string; close: string }>;
  }>;
  industries: Array<{ name: string; description: string | null }>;
  transfer_numbers: Array<{
    id: string;
    label: string;
    phone_number: string;
    transfer_type: string;
    is_default: boolean;
    available_hours: string | null;
  }>;
}

interface ProviderConfig {
  provider_id: string;
  provider_key: string;
  api_key: string;
  config: Record<string, unknown>;
}
```

---

## Task 4: Create Agent API Functions

**File**: `api/src/modules/voice-ai/agent/utils/agent-api.ts`

```typescript
/**
 * High-level API functions for Voice Agent
 * 
 * These wrap the HTTP client with specific endpoint calls.
 * Use these functions in the agent entrypoint.
 */

import { apiGet, apiPost, ApiResponse } from './api-client';
import {
  LookupTenantResponse,
  AccessCheckResponse,
  StartCallResponse,
  CompleteCallResponse,
  VoiceAiContext,
} from './api-types';

/**
 * Look up tenant by Twilio phone number
 */
export async function lookupTenant(phoneNumber: string): Promise<ApiResponse<LookupTenantResponse>> {
  console.log(`[Agent API] Looking up tenant for phone: ${phoneNumber}`);
  return apiPost<LookupTenantResponse>('/api/v1/internal/voice-ai/lookup-tenant', {
    phone_number: phoneNumber,
  });
}

/**
 * Check if tenant has access (quota/enabled)
 */
export async function checkAccess(tenantId: string): Promise<ApiResponse<AccessCheckResponse>> {
  console.log(`[Agent API] Checking access for tenant: ${tenantId}`);
  return apiGet<AccessCheckResponse>(`/api/v1/internal/voice-ai/tenant/${tenantId}/access`);
}

/**
 * Get full context for agent
 */
export async function getContext(tenantId: string): Promise<ApiResponse<VoiceAiContext>> {
  console.log(`[Agent API] Loading context for tenant: ${tenantId}`);
  return apiGet<VoiceAiContext>(`/api/v1/internal/voice-ai/tenant/${tenantId}/context`);
}

/**
 * Start call log
 */
export async function startCallLog(data: {
  tenant_id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  room_name?: string;
  direction?: string;
}): Promise<ApiResponse<StartCallResponse>> {
  console.log(`[Agent API] Starting call log for call: ${data.call_sid}`);
  return apiPost<StartCallResponse>('/api/v1/internal/voice-ai/calls/start', data);
}

/**
 * Complete call log
 */
export async function completeCallLog(
  callSid: string,
  data: {
    status?: string;
    duration_seconds: number;
    outcome: string;
    transcript_summary?: string;
    full_transcript?: string;
    actions_taken?: string[];
    lead_id?: string;
    transferred_to?: string;
    error_message?: string;
  }
): Promise<ApiResponse<CompleteCallResponse>> {
  console.log(`[Agent API] Completing call log for call: ${callSid}`);
  return apiPost<CompleteCallResponse>(`/api/v1/internal/voice-ai/calls/${callSid}/complete`, data);
}
```

---

## Task 5: Add Environment Variables

Update `.env` file (or document for ops):

```bash
# Voice Agent HTTP Client Configuration
LEAD360_API_URL=http://localhost:3000
VOICE_AGENT_API_KEY=your-secret-key-here
VOICE_AGENT_TIMEOUT_MS=10000
VOICE_AGENT_MAX_RETRIES=2
```

---

## Task 6: Test the HTTP Client

Create a simple test script or test manually:

```typescript
// Test script (run with: npx ts-node test-api-client.ts)
import { lookupTenant, checkAccess, getContext } from './agent-api';

async function testApiClient() {
  console.log('Testing API Client...\n');

  // Test 1: Lookup tenant
  console.log('1. Testing lookupTenant...');
  const lookupResult = await lookupTenant('+19788787756');
  console.log('Result:', JSON.stringify(lookupResult, null, 2));

  if (!lookupResult.success || !lookupResult.data?.found) {
    console.error('Lookup failed!');
    return;
  }

  const tenantId = lookupResult.data.tenant_id!;

  // Test 2: Check access
  console.log('\n2. Testing checkAccess...');
  const accessResult = await checkAccess(tenantId);
  console.log('Result:', JSON.stringify(accessResult, null, 2));

  // Test 3: Get context
  console.log('\n3. Testing getContext...');
  const contextResult = await getContext(tenantId);
  console.log('Result:', JSON.stringify({
    success: contextResult.success,
    tenant: contextResult.data?.tenant,
    quota: contextResult.data?.quota,
  }, null, 2));

  console.log('\nAll tests complete!');
}

testApiClient().catch(console.error);
```

---

## Acceptance Criteria

- [ ] API config reads from environment variables
- [ ] HTTP client handles timeouts gracefully
- [ ] HTTP client retries on transient failures
- [ ] All API functions return typed responses
- [ ] Error messages are clear and actionable
- [ ] No external dependencies (uses native fetch)

---

## Files Created

| File | Description |
|------|-------------|
| `agent/utils/api-config.ts` | Configuration from environment |
| `agent/utils/api-client.ts` | Low-level HTTP client |
| `agent/utils/api-types.ts` | TypeScript type definitions |
| `agent/utils/agent-api.ts` | High-level API functions |

---

## Notes

- The HTTP client uses native `fetch` (Node 18+)
- Timeout is implemented with AbortController
- Retry uses exponential backoff (1s, 2s, 3s)
- All errors are logged for debugging
- No sensitive data is logged (API keys hidden)