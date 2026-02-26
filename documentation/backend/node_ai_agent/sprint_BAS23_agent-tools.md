# Sprint BAS23 — Agent Tools (find_lead, create_lead, check_service_area, transfer_call)

**Module**: Voice AI → agent/tools/
**Sprint**: BAS23
**Depends on**: BAS22 (all providers complete)
**Estimated size**: 4 files, ~300 lines total

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `api/src/modules/leads/services/leads.service.ts` — REAL method signatures (`create()`, `findById()`, `list()`)
- Read `api/src/modules/leads/services/lead-phones.service.ts` — `checkPhoneUniqueness()` signature
- Read `api/src/modules/leads/dto/` — actual `CreateLeadDto` shape (all required/optional fields)
- NEVER recreate what LeadsService already does — inject and call it
- These tools are called by the OpenAI LLM when it decides an action is needed
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Create the 4 agent tools that the LLM calls during a voice conversation. Each tool corresponds to an OpenAI function definition plus an executor. Tools use EXISTING NestJS services — they do NOT bypass or duplicate them.

---

## Pre-Coding Checklist

- [ ] BAS22 complete (TTS Cartesia provider done)
- [ ] Read `api/src/modules/leads/services/leads.service.ts` — ALL method signatures
- [ ] Read `api/src/modules/leads/services/lead-phones.service.ts` — ALL method signatures
- [ ] Read `api/src/modules/leads/dto/create-lead.dto.ts` — EXACT required fields
- [ ] Read `api/prisma/schema.prisma` — `lead` model and `service_area` or area-served model (check what exists)
- [ ] Read `api/src/modules/voice-ai/services/voice-call-log.service.ts` — for transfer logging

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/leads/services/leads.service.ts` | REAL method signatures — do NOT guess |
| `api/src/modules/leads/services/lead-phones.service.ts` | Read ALL methods — note: there is NO `findByPhone()` method. The `find_lead` tool must query `lead_phone` via `PrismaService` directly |
| `api/src/modules/leads/dto/create-lead.dto.ts` | Exact required fields for lead creation |
| `api/prisma/schema.prisma` | `lead`, `lead_phone`, `service_request` models — read `lead_phone` model for exact field names |
| `api/src/core/database/prisma.service.ts` | PrismaService for direct queries in find_lead tool |

---

## Task 1: Create Tool Interface

Create `api/src/modules/voice-ai/agent/tools/tool.interface.ts`:

```typescript
import { LlmTool } from '../providers/llm.interface';

export interface AgentTool {
  // OpenAI function definition (sent to LLM with each request)
  definition: LlmTool;

  // Execute the tool when LLM calls it
  execute(args: Record<string, any>, context: ToolExecutionContext): Promise<string>;
}

export interface ToolExecutionContext {
  tenant_id: string;
  call_sid: string;
  caller_phone: string;    // The caller's phone number (from_number in voice_call_log)
}
```

---

## Task 2: Tool 1 — find_lead

Create `api/src/modules/voice-ai/agent/tools/find-lead.tool.ts`:

```typescript
// Uses LeadPhonesService to look up existing lead by caller's phone number
// If found, returns lead name and any relevant info
// Tool definition tells LLM when to use this (at call start)

export class FindLeadTool implements AgentTool {
  constructor(private readonly prisma: PrismaService) {}

  definition: LlmTool = {
    type: 'function',
    function: {
      name: 'find_lead',
      description: 'Find an existing lead/customer by their phone number. Call this at the start of every conversation.',
      parameters: {
        type: 'object',
        properties: {
          phone_number: { type: 'string', description: 'The caller\'s phone number in E.164 format' }
        },
        required: ['phone_number']
      }
    }
  };

  async execute(args: { phone_number: string }, context: ToolExecutionContext): Promise<string> {
    // IMPORTANT: LeadPhonesService has NO findByPhone() method.
    // Query lead_phone directly via PrismaService.
    // Before writing: read api/prisma/schema.prisma — find the lead_phone model
    // and verify the exact field name for the phone number column (may be `phone` or `phone_number`)
    try {
      const sanitizedPhone = args.phone_number.replace(/\D/g, '');

      // Read schema for exact model and field names — do NOT guess
      const leadPhone = await this.prisma.lead_phone.findFirst({
        where: {
          // Replace `phone` with the ACTUAL field name from schema (check schema first)
          phone: { contains: sanitizedPhone },
          lead: { tenant_id: context.tenant_id },  // TENANT ISOLATION — mandatory
        },
        include: {
          lead: {
            select: { id: true, first_name: true, last_name: true, status: true }
          }
        }
      });

      if (!leadPhone?.lead) {
        return JSON.stringify({ found: false, message: 'No existing record found' });
      }

      return JSON.stringify({
        found: true,
        lead_id: leadPhone.lead.id,
        name: `${leadPhone.lead.first_name} ${leadPhone.lead.last_name}`,
        status: leadPhone.lead.status,
      });
    } catch (error) {
      return JSON.stringify({ found: false, error: 'Could not search records' });
    }
  }
}
```

**STOP before writing**: Read `api/prisma/schema.prisma` — find the `lead_phone` model and verify:
1. The exact field name for the phone number column
2. The relation field name to `lead`
3. The exact Prisma model accessor (e.g., `this.prisma.lead_phone` — check the `@@map()` name)

---

## Task 3: Tool 2 — create_lead

Create `api/src/modules/voice-ai/agent/tools/create-lead.tool.ts`:

```typescript
// Uses LeadsService to create a new lead
// LLM calls this after collecting caller information
// MUST check lead_creation_enabled from VoiceAiContext before executing

export class CreateLeadTool implements AgentTool {
  constructor(private readonly leadsService: LeadsService) {}

  definition: LlmTool = {
    type: 'function',
    function: {
      name: 'create_lead',
      description: 'Create a new lead record after collecting caller information. Only call after confirming name, phone, and address.',
      parameters: {
        type: 'object',
        properties: {
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          phone_number: { type: 'string', description: 'E.164 format' },
          email: { type: 'string', description: 'Optional' },
          address: { type: 'string', description: 'Street address' },
          city: { type: 'string' },
          state: { type: 'string' },
          zip_code: { type: 'string' },
          service_description: { type: 'string', description: 'What service they need' },
          language: { type: 'string', description: 'Language spoken: en, es, pt' },
        },
        required: ['first_name', 'last_name', 'phone_number', 'address', 'city', 'state', 'zip_code']
      }
    }
  };

  async execute(args: any, context: ToolExecutionContext): Promise<string> {
    try {
      // Build CreateLeadDto from args — READ THE ACTUAL DTO SHAPE from create-lead.dto.ts
      // Match field names EXACTLY as the service expects
      const createLeadDto = {
        first_name: args.first_name,
        last_name: args.last_name,
        source: 'phone_call',
        language_spoken: args.language || 'EN',
        phones: [{ phone: args.phone_number, type: 'mobile', is_primary: true }],
        emails: args.email ? [{ email: args.email, type: 'primary', is_primary: true }] : [],
        addresses: [{
          // READ actual address DTO fields from leads module
          // DO NOT guess field names
        }],
      };

      // READ leadsService.create() signature exactly before calling
      const lead = await this.leadsService.create(context.tenant_id, null, createLeadDto as any);

      return JSON.stringify({
        success: true,
        lead_id: lead.id,
        message: `Lead created for ${args.first_name} ${args.last_name}`
      });
    } catch (error) {
      return JSON.stringify({ success: false, error: error.message });
    }
  }
}
```

**STOP**: Read `api/src/modules/leads/dto/create-lead.dto.ts` completely. Map every required field correctly. Read the `leads.service.ts` `create()` method signature.

---

## Task 4: Tool 3 — check_service_area

Create `api/src/modules/voice-ai/agent/tools/check-service-area.tool.ts`:

```typescript
// Checks if the caller's address is within the tenant's service area
// First: check if there's an existing service_area or area_served table in Prisma
// Read the schema BEFORE writing this tool

export class CheckServiceAreaTool implements AgentTool {
  constructor(private readonly prisma: PrismaService) {}

  definition: LlmTool = {
    type: 'function',
    function: {
      name: 'check_service_area',
      description: 'Check if an address is within the service area. Call before creating a lead to confirm coverage.',
      parameters: {
        type: 'object',
        properties: {
          zip_code: { type: 'string', description: 'ZIP code to check' },
          city: { type: 'string' },
          state: { type: 'string' },
        },
        required: ['zip_code']
      }
    }
  };

  async execute(args: { zip_code: string; city?: string; state?: string }, context: ToolExecutionContext): Promise<string> {
    // BEFORE WRITING THIS: read api/prisma/schema.prisma
    // Search for: service_area, area_served, served_zip_code, coverage
    // If no service area table exists: return { covered: true } (assume all areas served)
    // If a table exists: query it with tenant_id + zip_code

    // Example if no service area table found:
    return JSON.stringify({
      covered: true,
      message: 'Service area check not configured — assuming coverage'
    });
  }
}
```

**STOP**: Check the Prisma schema for service area tables. If found, use the real table. If not found, implement as always-covered with a log message.

---

## Task 5: Tool 4 — transfer_call

Create `api/src/modules/voice-ai/agent/tools/transfer-call.tool.ts`:

```typescript
// Signals to the agent pipeline that the call should be transferred
// Does NOT actually transfer the call — that's handled by the pipeline (BAS24)
// This tool returns the transfer number for the pipeline to use

export class TransferCallTool implements AgentTool {
  constructor(private readonly transferNumbersService: VoiceTransferNumbersService) {}

  definition: LlmTool = {
    type: 'function',
    function: {
      name: 'transfer_call',
      description: 'Transfer the call to a human agent. Use when the caller requests to speak with a person.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Why the call is being transferred' },
          destination: { type: 'string', description: 'Optional: which department (sales, support, etc.)' }
        },
        required: ['reason']
      }
    }
  };

  async execute(args: { reason: string; destination?: string }, context: ToolExecutionContext): Promise<string> {
    // Get the default transfer number for this tenant
    const numbers = await this.transferNumbersService.findAll(context.tenant_id);
    const defaultNumber = numbers.find(n => n.is_default) || numbers[0];

    if (!defaultNumber) {
      return JSON.stringify({ success: false, error: 'No transfer number configured' });
    }

    return JSON.stringify({
      success: true,
      transfer_to: defaultNumber.phone_number,
      label: defaultNumber.label,
      reason: args.reason,
      // Signal to pipeline: initiate transfer
      action: 'TRANSFER',
    });
  }
}
```

---

## Task 6: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/agent/tools/tool.interface.ts` | CREATE | Tool contract |
| `api/src/modules/voice-ai/agent/tools/find-lead.tool.ts` | CREATE | Find lead by phone |
| `api/src/modules/voice-ai/agent/tools/create-lead.tool.ts` | CREATE | Create new lead |
| `api/src/modules/voice-ai/agent/tools/check-service-area.tool.ts` | CREATE | Service area check |
| `api/src/modules/voice-ai/agent/tools/transfer-call.tool.ts` | CREATE | Transfer signal |

---

## Acceptance Criteria

- [ ] `find_lead` tool queries `prisma.lead_phone` directly with `tenant_id` filter — NO cross-tenant data
- [ ] `create_lead` tool uses `LeadsService.create()` (real service, real DTO fields verified from source)
- [ ] `check_service_area` queries real service_area table OR returns `{ covered: true }` if table not found
- [ ] `transfer_call` returns transfer number from `VoiceTransferNumbersService.findAll()`
- [ ] NO guessed method names — all verified by reading service files first
- [ ] Every tool returns a JSON string (not an object) — LLM requires string responses
- [ ] `npm run build` passes with 0 errors

---

## Testing

Unit test each tool by calling `execute()` directly with mock context:

```typescript
// Test find_lead
const tool = new FindLeadTool(prismaService);
const result = await tool.execute(
  { phone_number: '+15551234567' },
  { tenant_id: '<test_tenant_id>', call_sid: 'CA123', caller_phone: '+15551234567' }
);
const parsed = JSON.parse(result);
console.assert(typeof parsed.found === 'boolean', 'found must be boolean');

// Test create_lead
const createTool = new CreateLeadTool(leadsService);
const createResult = await createTool.execute(
  {
    first_name: 'John', last_name: 'Doe',
    phone_number: '+15559876543',
    address: '123 Main St', city: 'Miami', state: 'FL', zip_code: '33101'
  },
  { tenant_id: '<test_tenant_id>', call_sid: 'CA123', caller_phone: '+15559876543' }
);
const createParsed = JSON.parse(createResult);
console.assert(createParsed.success === true || createParsed.error, 'must return success or error');

// Verify via database — parse DATABASE_URL from .env for direct DB check
// mysql -u "<user>" -p"<pass>" <db> -e "SELECT id, first_name FROM lead WHERE tenant_id='<id>' ORDER BY created_at DESC LIMIT 1;"
```
