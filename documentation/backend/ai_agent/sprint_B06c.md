YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B06c — Internal API: Tool Action Endpoints

**Module**: Voice AI
**Sprint**: B06c
**Depends on**: B06a (guard + context), B06b (call endpoints), B04 (context builder)

---

## Objective

Add the generic tool dispatcher endpoint to the internal API. When the LLM decides to create a lead, book an appointment, or transfer a call, the Python agent calls `POST /internal/voice-ai/tenant/:tenantId/tools/:tool`. This single endpoint dispatches to the correct handler.

---

## Pre-Coding Checklist

- [ ] B06a and B06b are complete
- [ ] Read `/api/src/modules/leads/leads.service.ts` — `create(tenantId, userId, dto)` method signature
- [ ] **HIT THE ENDPOINT** after implementing:
  ```bash
  # Create a lead from a call
  curl -X POST http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/tools/create_lead \
    -H "X-Voice-Agent-Key: YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"call_log_id":"LOG_ID","phone_number":"+15551234567","first_name":"John"}' | jq .
  # Expect: { "lead_id": "uuid", "created": true }

  # Book an appointment
  curl -X POST http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/tools/book_appointment \
    -H "X-Voice-Agent-Key: YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"call_log_id":"LOG_ID","service_type":"Plumbing","preferred_date":"2026-03-01"}' | jq .

  # Unknown tool → 404
  curl -X POST http://localhost:8000/api/v1/internal/voice-ai/tenant/TENANT_ID/tools/unknown_tool \
    -H "X-Voice-Agent-Key: YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"call_log_id":"LOG_ID"}' | jq .
  ```

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Tool DTOs

### `execute-tool.dto.ts`

```typescript
import { IsString, IsOptional } from 'class-validator';

// Generic wrapper — all tool payloads go through this
// Specific field validation is done inside each tool handler
export class ExecuteToolDto {
  @IsString() call_log_id: string;
  // Tool-specific fields below:
  @IsOptional() @IsString() phone_number?: string;      // create_lead
  @IsOptional() @IsString() first_name?: string;        // create_lead
  @IsOptional() @IsString() last_name?: string;         // create_lead
  @IsOptional() @IsString() notes?: string;             // create_lead, book_appointment
  @IsOptional() @IsString() service_type?: string;      // create_lead, book_appointment
  @IsOptional() @IsString() lead_id?: string;           // book_appointment, transfer_call
  @IsOptional() @IsString() preferred_date?: string;    // book_appointment (ISO date)
  @IsOptional() @IsString() transfer_number_id?: string; // transfer_call
}
```

---

## Task 2: Add Tool Methods to Internal Service

Inject `LeadsService`, `PrismaService` into `VoiceAiInternalService` and add:

```typescript
// Add to constructor:
private readonly prisma: PrismaService,
private readonly leadsService: LeadsService,

// Add these methods:

async executeTool(
  toolName: string,
  tenantId: string,
  dto: ExecuteToolDto,
): Promise<unknown> {
  switch (toolName) {
    case 'create_lead':
      return this.createLeadFromCall(tenantId, dto);
    case 'book_appointment':
      return this.createAppointmentFromCall(tenantId, dto);
    case 'transfer_call':
      return this.initTransfer(tenantId, dto);
    default:
      throw new NotFoundException(`Unknown tool: '${toolName}'. Available: create_lead, book_appointment, transfer_call`);
  }
}

async createLeadFromCall(
  tenantId: string,
  dto: ExecuteToolDto,
): Promise<{ lead_id: string; created: boolean }> {
  if (!dto.phone_number) throw new BadRequestException('phone_number required for create_lead');

  // Check if lead with this phone already exists for this tenant
  const existing = await this.prisma.lead.findFirst({
    where: { tenant_id: tenantId, phone: dto.phone_number },
  });

  if (existing) {
    // Link lead to call log
    await this.prisma.voice_call_log.update({
      where: { id: dto.call_log_id },
      data: { lead_id: existing.id },
    });
    return { lead_id: existing.id, created: false };
  }

  // Create new lead via existing LeadsService
  const lead = await this.leadsService.create(tenantId, null, {
    phone: dto.phone_number,
    first_name: dto.first_name ?? null,
    last_name: dto.last_name ?? null,
    notes: dto.notes ?? null,
    source: 'voice_ai',
  });

  await this.prisma.voice_call_log.update({
    where: { id: dto.call_log_id },
    data: { lead_id: lead.id },
  });

  return { lead_id: lead.id, created: true };
}

async createAppointmentFromCall(
  tenantId: string,
  dto: ExecuteToolDto,
): Promise<{ appointment_id: string; status: string }> {
  // Create a service_request or lead_note as a simple appointment placeholder
  // This is a basic implementation — enhance with proper booking module later
  const note = await this.prisma.lead_note.create({
    data: {
      tenant_id: tenantId,
      lead_id: dto.lead_id ?? null,
      content: `Appointment request via AI call. Service: ${dto.service_type ?? 'unspecified'}. Preferred date: ${dto.preferred_date ?? 'flexible'}. Notes: ${dto.notes ?? 'none'}`,
      source: 'voice_ai',
    },
  });
  return { appointment_id: note.id, status: 'pending' };
}

async initTransfer(
  tenantId: string,
  dto: ExecuteToolDto,
): Promise<{ success: boolean; phone_number: string }> {
  // Look up transfer number — by ID or find default
  let transferNumber: any;

  if (dto.transfer_number_id) {
    transferNumber = await this.prisma.tenant_voice_transfer_number.findFirst({
      where: { id: dto.transfer_number_id, tenant_id: tenantId },
    });
  } else {
    transferNumber = await this.prisma.tenant_voice_transfer_number.findFirst({
      where: { tenant_id: tenantId, is_default: true },
    });
  }

  if (!transferNumber) {
    return { success: false, phone_number: '' };
  }

  // Log transfer in call actions
  await this.prisma.voice_call_log.update({
    where: { id: dto.call_log_id },
    data: {
      outcome: 'transferred',
    },
  });

  return { success: true, phone_number: transferNumber.phone_number };
}
```

---

## Task 3: Add Tool Endpoint to Internal Controller

Add to `VoiceAiInternalController` (extending B06a + B06b):

```typescript
// API-027: Generic tool dispatcher
// tool param: 'create_lead' | 'book_appointment' | 'transfer_call'
@Post('tenant/:tenantId/tools/:tool')
@HttpCode(200)
executeTool(
  @Param('tenantId') tenantId: string,
  @Param('tool') tool: string,
  @Body() dto: ExecuteToolDto,
) {
  return this.internalService.executeTool(tool, tenantId, dto);
}
```

---

## Task 4: Update Module

Add to `voice-ai.module.ts` imports:

```typescript
// Add to imports:
LeadsModule,  // to inject LeadsService
```

---

## Acceptance Criteria

- [ ] `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/create_lead` creates or finds lead by phone, links to call log, returns `{ lead_id, created }`
- [ ] `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/create_lead` with existing phone returns `{ created: false, lead_id: existing_id }`
- [ ] `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/book_appointment` creates appointment/note, returns `{ appointment_id, status }`
- [ ] `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/transfer_call` returns `{ success: true, phone_number }` for configured number
- [ ] `POST /api/v1/internal/voice-ai/tenant/:tenantId/tools/unknown_tool` returns 404
- [ ] Tool calls are tenant-isolated — tenantId from URL path, never from body
- [ ] Request without `X-Voice-Agent-Key` → 401
- [ ] `npm run build` passes
