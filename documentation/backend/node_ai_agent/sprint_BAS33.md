# Sprint VAB-05: Agent Tools via HTTP

**Module**: Voice AI - HTTP API Bridge  
**Sprint**: VAB-05  
**Depends on**: VAB-04 (entrypoint refactored)  
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

Add HTTP-based tool functions that the agent can use during conversations:
- `create_lead` - Create a new lead from call information
- `find_lead` - Find existing lead by phone number
- `check_service_area` - Verify if an address is in service area
- `transfer_call` - Get transfer number for handoff to human

These tools are registered with the LLM and called when appropriate during conversation.

---

## Background

The agent uses tools (function calling) to perform actions. These tools need to call the Lead360 API since the agent runs in a separate process.

Internal tool endpoints already exist:
- `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/create_lead`
- `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/find_lead`
- `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/check_service_area`
- `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/transfer_call`

---

## Pre-Coding Checklist

- [ ] Verify tool endpoints exist and work (test with curl)
- [ ] Review existing tool interface definitions
- [ ] Understand how tools are registered with the LLM
- [ ] VAB-04 complete (agent uses HTTP)

**DO NOT START CODING UNTIL ALL BOXES ARE CHECKED**

---

## Task 1: Verify Tool Endpoints

Test each endpoint with curl:

```bash
TENANT_ID="14a34ab2-6f6f-4e41-9bea-c444a304557e"
API_KEY="your-key"

# Create Lead
curl -X POST "http://localhost:3000/api/v1/internal/voice-ai/tenant/${TENANT_ID}/tools/create_lead" \
  -H "X-Voice-Agent-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Test",
    "last_name": "User",
    "phone_number": "+15551234567",
    "address": "123 Test St",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101"
  }' | jq .

# Find Lead
curl -X POST "http://localhost:3000/api/v1/internal/voice-ai/tenant/${TENANT_ID}/tools/find_lead" \
  -H "X-Voice-Agent-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"phone_number": "+19788968047"}' | jq .

# Check Service Area
curl -X POST "http://localhost:3000/api/v1/internal/voice-ai/tenant/${TENANT_ID}/tools/check_service_area" \
  -H "X-Voice-Agent-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"zip_code": "01420", "city": "Fitchburg", "state": "MA"}' | jq .

# Transfer Call
curl -X POST "http://localhost:3000/api/v1/internal/voice-ai/tenant/${TENANT_ID}/tools/transfer_call" \
  -H "X-Voice-Agent-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer requested human"}' | jq .
```

Document what each endpoint returns.

---

## Task 2: Add Tool Type Definitions

**File**: `api/src/modules/voice-ai/agent/utils/api-types.ts`

Add tool-related types:

```typescript
// Add to existing file

// Tool response types
export interface CreateLeadResult {
  success: boolean;
  lead_id?: string;
  message?: string;
  error?: string;
}

export interface FindLeadResult {
  success: boolean;
  found: boolean;
  lead_id?: string;
  lead_name?: string;
  error?: string;
}

export interface CheckServiceAreaResult {
  success: boolean;
  in_service_area: boolean;
  message?: string;
  error?: string;
}

export interface TransferCallResult {
  success: boolean;
  transfer_to?: string;
  label?: string;
  reason?: string;
  action?: string;  // 'TRANSFER'
  error?: string;
}
```

---

## Task 3: Add Tool API Functions

**File**: `api/src/modules/voice-ai/agent/utils/agent-api.ts`

Add tool functions:

```typescript
import {
  // ... existing imports
  CreateLeadResult,
  FindLeadResult,
  CheckServiceAreaResult,
  TransferCallResult,
} from './api-types';

// ... existing functions ...

// ============================================================================
// TOOL FUNCTIONS
// ============================================================================

/**
 * Create a new lead from call information
 */
export async function toolCreateLead(
  tenantId: string,
  data: {
    first_name: string;
    last_name: string;
    phone_number: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    zip_code?: string;
    service_description?: string;
    language?: string;
  }
): Promise<ApiResponse<CreateLeadResult>> {
  console.log(`[Agent API] Creating lead for tenant: ${tenantId}`);
  return apiPost<CreateLeadResult>(
    `/api/v1/internal/voice-ai/tenant/${tenantId}/tools/create_lead`,
    data
  );
}

/**
 * Find existing lead by phone number
 */
export async function toolFindLead(
  tenantId: string,
  phoneNumber: string
): Promise<ApiResponse<FindLeadResult>> {
  console.log(`[Agent API] Finding lead for phone: ${phoneNumber}`);
  return apiPost<FindLeadResult>(
    `/api/v1/internal/voice-ai/tenant/${tenantId}/tools/find_lead`,
    { phone_number: phoneNumber }
  );
}

/**
 * Check if an address is in the tenant's service area
 */
export async function toolCheckServiceArea(
  tenantId: string,
  data: {
    zip_code: string;
    city?: string;
    state?: string;
  }
): Promise<ApiResponse<CheckServiceAreaResult>> {
  console.log(`[Agent API] Checking service area for ZIP: ${data.zip_code}`);
  return apiPost<CheckServiceAreaResult>(
    `/api/v1/internal/voice-ai/tenant/${tenantId}/tools/check_service_area`,
    data
  );
}

/**
 * Get transfer number for call handoff
 */
export async function toolTransferCall(
  tenantId: string,
  reason: string,
  destination?: string
): Promise<ApiResponse<TransferCallResult>> {
  console.log(`[Agent API] Getting transfer number, reason: ${reason}`);
  return apiPost<TransferCallResult>(
    `/api/v1/internal/voice-ai/tenant/${tenantId}/tools/transfer_call`,
    { reason, destination }
  );
}
```

---

## Task 4: Create Tool Definitions for LLM

**File**: `api/src/modules/voice-ai/agent/tools/tool-definitions.ts`

```typescript
/**
 * Tool definitions for LLM function calling
 * 
 * These are passed to the LLM so it knows what tools are available.
 * When the LLM decides to use a tool, we execute the corresponding HTTP call.
 */

export interface LlmToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, { type: string; description?: string; enum?: string[] }>;
      required: string[];
    };
  };
}

export const AGENT_TOOLS: LlmToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'check_service_area',
      description: 'Check if a location is within the service area. Call before creating a lead to confirm coverage.',
      parameters: {
        type: 'object',
        properties: {
          zip_code: { type: 'string', description: 'ZIP code to check' },
          city: { type: 'string', description: 'City name (optional)' },
          state: { type: 'string', description: 'State abbreviation (optional)' },
        },
        required: ['zip_code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'find_lead',
      description: 'Find an existing lead by their phone number. Call to check if the caller is already in the system.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: 'Phone number in E.164 format' },
        },
        required: ['phone_number'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Create a new lead record. Only call after confirming name, phone, and address.',
      parameters: {
        type: 'object',
        properties: {
          first_name: { type: 'string', description: 'First name' },
          last_name: { type: 'string', description: 'Last name' },
          phone_number: { type: 'string', description: 'Phone in E.164 format' },
          email: { type: 'string', description: 'Email address (optional)' },
          address: { type: 'string', description: 'Street address' },
          city: { type: 'string', description: 'City' },
          state: { type: 'string', description: 'State abbreviation' },
          zip_code: { type: 'string', description: 'ZIP code' },
          service_description: { type: 'string', description: 'What service they need' },
          language: { type: 'string', description: 'Language: en, es, pt', enum: ['en', 'es', 'pt'] },
        },
        required: ['first_name', 'last_name', 'phone_number', 'address', 'city', 'state', 'zip_code'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transfer_call',
      description: 'Transfer the call to a human. Use when caller requests to speak with a person or for complex issues.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the call is being transferred' },
          destination: { type: 'string', description: 'Department (sales, support, etc.) - optional' },
        },
        required: ['reason'],
      },
    },
  },
];
```

---

## Task 5: Create Tool Executor

**File**: `api/src/modules/voice-ai/agent/tools/tool-executor.ts`

```typescript
/**
 * Tool Executor
 * 
 * Executes tool calls requested by the LLM.
 * Each tool is executed via HTTP to the Lead360 API.
 */

import {
  toolCreateLead,
  toolFindLead,
  toolCheckServiceArea,
  toolTransferCall,
} from '../utils/agent-api';

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export interface ToolResult {
  name: string;
  result: string;  // JSON string for LLM
}

/**
 * Execute a tool call and return the result
 * 
 * @param tenantId Tenant UUID
 * @param toolCall Tool call from LLM
 * @returns Tool result as JSON string for LLM
 */
export async function executeTool(
  tenantId: string,
  toolCall: ToolCall
): Promise<ToolResult> {
  console.log(`[Tool Executor] Executing tool: ${toolCall.name}`);
  console.log(`[Tool Executor] Arguments:`, JSON.stringify(toolCall.arguments));

  let resultData: any;

  try {
    switch (toolCall.name) {
      case 'check_service_area': {
        const response = await toolCheckServiceArea(tenantId, {
          zip_code: toolCall.arguments.zip_code,
          city: toolCall.arguments.city,
          state: toolCall.arguments.state,
        });
        resultData = response.success ? response.data : { error: response.error };
        break;
      }

      case 'find_lead': {
        const response = await toolFindLead(tenantId, toolCall.arguments.phone_number);
        resultData = response.success ? response.data : { error: response.error };
        break;
      }

      case 'create_lead': {
        const response = await toolCreateLead(tenantId, toolCall.arguments);
        resultData = response.success ? response.data : { error: response.error };
        break;
      }

      case 'transfer_call': {
        const response = await toolTransferCall(
          tenantId,
          toolCall.arguments.reason,
          toolCall.arguments.destination
        );
        resultData = response.success ? response.data : { error: response.error };
        break;
      }

      default:
        resultData = { error: `Unknown tool: ${toolCall.name}` };
    }
  } catch (error: any) {
    console.error(`[Tool Executor] Error executing ${toolCall.name}:`, error.message);
    resultData = { error: error.message };
  }

  const result = JSON.stringify(resultData);
  console.log(`[Tool Executor] Result for ${toolCall.name}:`, result);

  return {
    name: toolCall.name,
    result,
  };
}
```

---

## Task 6: Test Tool Execution

Create a test script:

```typescript
// test-tools.ts
import { executeTool } from './tool-executor';

const TENANT_ID = '14a34ab2-6f6f-4e41-9bea-c444a304557e';

async function testTools() {
  console.log('Testing Tool Execution...\n');

  // Test 1: Check service area
  console.log('1. Testing check_service_area...');
  const serviceAreaResult = await executeTool(TENANT_ID, {
    name: 'check_service_area',
    arguments: { zip_code: '01420', city: 'Fitchburg', state: 'MA' }
  });
  console.log('Result:', serviceAreaResult.result);

  // Test 2: Find lead
  console.log('\n2. Testing find_lead...');
  const findLeadResult = await executeTool(TENANT_ID, {
    name: 'find_lead',
    arguments: { phone_number: '+19788968047' }
  });
  console.log('Result:', findLeadResult.result);

  // Test 3: Transfer call
  console.log('\n3. Testing transfer_call...');
  const transferResult = await executeTool(TENANT_ID, {
    name: 'transfer_call',
    arguments: { reason: 'Customer requested human' }
  });
  console.log('Result:', transferResult.result);

  console.log('\nAll tests complete!');
}

testTools().catch(console.error);
```

---

## Acceptance Criteria

- [ ] All 4 tool endpoints verified working
- [ ] Tool API functions make correct HTTP calls
- [ ] Tool definitions match LLM function calling format
- [ ] Tool executor handles all tool types
- [ ] Error handling for failed tool calls
- [ ] Results returned as JSON strings for LLM

---

## Files Created/Modified

| File | Action | Description |
|------|--------|-------------|
| `utils/api-types.ts` | MODIFY | Add tool result types |
| `utils/agent-api.ts` | MODIFY | Add tool API functions |
| `tools/tool-definitions.ts` | CREATE | LLM tool definitions |
| `tools/tool-executor.ts` | CREATE | Tool execution logic |

---

## Integration Note

These tools will be integrated into the actual conversation pipeline in a later sprint (when implementing the full STT → LLM → TTS flow). For now, they're ready to be called when the LLM requests a tool.