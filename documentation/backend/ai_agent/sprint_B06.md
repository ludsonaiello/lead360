YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B06 — Internal API for Python Agent

**Module**: Voice AI
**Sprint**: B06
**Depends on**: B01, B04, B05

---

## Objective

Build the internal REST API endpoints that the Python Voice AI agent calls during live calls. These endpoints use a dedicated API key guard (NOT JWT) to authenticate the Python process. This is the critical integration surface between NestJS and the Python agent.

**API path prefix**: `/api/internal/voice-ai/` — this is a SEPARATE path prefix from the tenant/admin routes which live under `/api/v1/`. The internal routes must NOT be protected by the global JWT guard.

---

## Pre-Coding Checklist

- [ ] B04, B05 are complete — `VoiceAiContextBuilderService` exists and works
- [ ] Read `/api/src/modules/communication/services/webhook-verification.service.ts` — timing-safe comparison pattern
- [ ] Read `/api/src/modules/leads/leads.service.ts` — `create(tenantId, userId, dto)` method signature
- [ ] Read `voice_ai_global_config` model — `agent_api_key_hash` and `agent_api_key_preview` fields
- [ ] Read `/api/src/main.ts` — understand global prefix setup; internal routes need a DIFFERENT prefix or exception
- [ ] Check how `@Public()` decorator works for bypassing global JWT guard

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: VoiceAgentKeyGuard

Create `/api/src/modules/voice-ai/guards/voice-agent-key.guard.ts`:

```typescript
import {
  Injectable, CanActivate, ExecutionContext, UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class VoiceAgentKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-voice-agent-key'];

    if (!providedKey || typeof providedKey !== 'string') {
      throw new UnauthorizedException('X-Voice-Agent-Key header required');
    }

    const config = await this.prisma.voice_ai_global_config.findUnique({
      where: { id: 'default' },
      select: { agent_api_key_hash: true },
    });

    if (!config?.agent_api_key_hash) {
      throw new UnauthorizedException('Voice AI agent key not configured');
    }

    const providedHash = crypto.createHash('sha256').update(providedKey).digest('hex');
    const storedHash = config.agent_api_key_hash;

    // CRITICAL: Timing-safe comparison to prevent timing attacks
    if (providedHash.length !== storedHash.length) {
      throw new UnauthorizedException('Invalid agent key');
    }
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedHash, 'hex'),
      Buffer.from(storedHash, 'hex'),
    );
    if (!isValid) throw new UnauthorizedException('Invalid agent key');

    return true;
  }
}
```

---

## Task 2: Internal DTOs

### `start-call.dto.ts`

```typescript
export class StartCallDto {
  @IsString() @IsNotEmpty() tenant_id: string;
  @IsString() @IsNotEmpty() call_sid: string;
  @IsString() @Matches(/^\+[1-9]\d{1,14}$/) from_number: string;
  @IsString() @IsNotEmpty() to_number: string;
  @IsOptional() @IsString() direction?: string;  // default: 'inbound'
  // Provider IDs actually used for this call (resolved from context)
  @IsOptional() @IsString() stt_provider_id?: string;
  @IsOptional() @IsString() llm_provider_id?: string;
  @IsOptional() @IsString() tts_provider_id?: string;
}
```

### `complete-call.dto.ts`

```typescript
export class CompleteCallDto {
  @IsString() @IsNotEmpty() call_sid: string;
  @IsInt() @Min(0) duration_seconds: number;
  @IsString() @IsIn(['completed','transferred','voicemail','abandoned','error']) outcome: string;
  @IsOptional() @IsString() transcript_summary?: string;
  @IsOptional() @IsString() full_transcript?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) actions_taken?: string[];
  @IsOptional() @IsString() lead_id?: string;
  // Usage data per provider (for billing)
  @IsOptional() @IsArray() usage_records?: UsageRecordDto[];
}

export class UsageRecordDto {
  @IsString() provider_id: string;
  @IsString() @IsIn(['STT','LLM','TTS']) provider_type: string;
  @IsNumber() @Min(0) usage_quantity: number;  // seconds | tokens | characters
  @IsString() usage_unit: string;              // 'seconds' | 'tokens' | 'characters'
  @IsOptional() @IsNumber() estimated_cost?: number;  // USD
}
```

### `create-lead-from-call.dto.ts`

```typescript
export class CreateLeadFromCallDto {
  @IsString() tenant_id: string;
  @IsString() call_log_id: string;
  @IsString() @Matches(/^\+[1-9]\d{1,14}$/) phone_number: string;
  @IsOptional() @IsString() first_name?: string;
  @IsOptional() @IsString() last_name?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsString() service_type?: string;
}
```

### `execute-tool.dto.ts`

```typescript
export class ExecuteToolDto {
  @IsString() tenant_id: string;
  @IsString() call_log_id: string;
  @IsObject() parameters: Record<string, unknown>;
}
```

---

## Task 3: Internal Service

`voice-ai-internal.service.ts`:

```typescript
@Injectable()
export class VoiceAiInternalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contextBuilder: VoiceAiContextBuilderService,
    private readonly leadsService: LeadsService,
    private readonly callLogService: VoiceCallLogService,
    private readonly usageService: VoiceUsageService,
  ) {}

  async checkAccess(tenantId: string): Promise<{
    has_access: boolean;
    reason?: string;
    minutes_remaining?: number;
    overage_rate?: number | null;
  }>
  // Check: tenant exists, voice AI enabled, quota not exceeded
  // Returns { has_access: true } or { has_access: false, reason: 'quota_exceeded' | 'not_enabled' | 'plan_not_included' }

  async getContext(tenantId: string): Promise<FullVoiceAiContext>
  // Delegates to contextBuilder.buildContext(tenantId)

  async startCall(dto: StartCallDto): Promise<{ call_log_id: string }>
  // Creates voice_call_log with status='in_progress', provider IDs

  async completeCall(callSid: string, dto: CompleteCallDto): Promise<void>
  // Finds call_log by call_sid
  // Updates: status='completed', duration, transcript, outcome, ended_at
  // Creates voice_usage_record rows for each UsageRecordDto
  // actions_taken stored as JSON string

  async executeTool(toolName: string, dto: ExecuteToolDto): Promise<unknown>
  // Dispatches to the correct action handler by toolName:
  //   'create_lead'      → createLeadFromCall()
  //   'book_appointment' → createAppointmentFromCall()
  //   'transfer_call'    → initTransfer()
  // Returns result from handler
  // Throws NotFoundException for unknown tool

  async createLeadFromCall(dto: CreateLeadFromCallDto): Promise<{ lead_id: string; created: boolean }>
  // Check if lead with this phone already exists for tenant
  // If exists: update call_log.lead_id, return { lead_id, created: false }
  // If not: create via LeadsService, update call_log.lead_id, return { lead_id, created: true }

  async createAppointmentFromCall(dto: CreateAppointmentFromCallDto): Promise<{ appointment_id: string }>
  // Create service_request or lead_note with appointment details as fallback

  async initTransfer(dto: { tenant_id: string; call_log_id: string; transfer_number_id?: string; phone_number?: string }): Promise<{ success: boolean; phone_number: string }>
  // Looks up transfer number (by ID or default), returns the E.164 phone number
  // Logs transfer action to call_log.actions_taken
}
```

---

## Task 4: Internal Controller

`controllers/internal/voice-ai-internal.controller.ts`:

```typescript
// IMPORTANT: This controller is mounted WITHOUT the global /api/v1/ prefix
// Mount at: /api/internal/voice-ai/ by configuring the module route prefix OR
// by using a separate app prefix setup. Read main.ts to determine the right approach.
// If global prefix is '/api/v1', you may need to add '../../' prefix exclusion,
// or register this controller with a different global prefix.
// Preferred: use NestJS module-level path and ensure @Public() skips JWT guard.

@Controller('internal/voice-ai')
@UseGuards(VoiceAgentKeyGuard)   // ONLY API key — NO JWT
export class VoiceAiInternalController {

  // API-026: Pre-flight access check (called BEFORE accepting the job)
  @Get('tenant/:tenantId/access')
  async checkAccess(@Param('tenantId') tenantId: string) {
    return this.internalService.checkAccess(tenantId);
  }

  // API-022: Fetch full context for the agent
  @Get('tenant/:tenantId/context')
  async getContext(@Param('tenantId') tenantId: string) {
    return this.internalService.getContext(tenantId);
  }

  // API-024: Start a call
  @Post('calls/start')
  @HttpCode(201)
  async startCall(@Body() dto: StartCallDto) {
    return this.internalService.startCall(dto);
    // Returns: { call_log_id: string }
  }

  // API-030: Complete a call with usage data
  @Post('calls/:callSid/complete')
  @HttpCode(200)
  async completeCall(
    @Param('callSid') callSid: string,
    @Body() dto: CompleteCallDto,
  ) {
    await this.internalService.completeCall(callSid, dto);
    return { success: true };
  }

  // API-027: Generic tool execution dispatcher
  @Post('tenant/:tenantId/tools/:tool')
  async executeTool(
    @Param('tenantId') tenantId: string,
    @Param('tool') tool: string,
    @Body() dto: ExecuteToolDto,
  ) {
    return this.internalService.executeTool(tool, { ...dto, tenant_id: tenantId });
  }
}
```

**CRITICAL**: No `@UseGuards(JwtAuthGuard)` on this controller. Apply `@Public()` decorator (or equivalent bypass) at the class level. Check how existing webhook controllers skip the global JWT guard.

---

## Task 5: Route Prefix Configuration

Read `/api/src/main.ts` to understand how the global prefix is set. The internal routes must be accessible at `/api/internal/voice-ai/` (without the `/v1/` version segment).

**Option A**: If the app uses `app.setGlobalPrefix('api/v1')`, register the internal controller with a path that compensates: `@Controller('../internal/voice-ai')` — **this won't work in NestJS**.

**Option B** (RECOMMENDED): Create a separate Express router or use NestJS module `forRoutes()` pattern to mount internal routes at `/api/internal/` outside the versioned prefix.

**Option C**: Accept `/api/v1/internal/voice-ai/` as the path and update the Python agent config to match. This is simplest and still clean.

**→ Use Option C** if options A/B create excessive complexity. Document the actual path clearly in sprint B12 (REST API docs).

---

## Task 6: Update Module

Add to `voice-ai.module.ts`:
- Import `LeadsModule` (to inject LeadsService)
- `VoiceAgentKeyGuard`
- `VoiceAiInternalService`
- `VoiceAiInternalController`
- Export `VoiceAgentKeyGuard` for use in B09 quota guard

---

## Acceptance Criteria

- [ ] `GET /api/.../internal/voice-ai/tenant/:tenantId/access` returns `{ has_access, reason, minutes_remaining }` using `X-Voice-Agent-Key`
- [ ] `GET /api/.../internal/voice-ai/tenant/:tenantId/context` returns full context
- [ ] `POST /api/.../internal/voice-ai/calls/start` creates call log, returns `call_log_id`
- [ ] `POST /api/.../internal/voice-ai/calls/:callSid/complete` updates call log AND creates usage records
- [ ] `POST /api/.../internal/voice-ai/tenant/:tenantId/tools/create_lead` creates or finds lead by phone
- [ ] `POST /api/.../internal/voice-ai/tenant/:tenantId/tools/book_appointment` creates appointment/note
- [ ] `POST /api/.../internal/voice-ai/tenant/:tenantId/tools/transfer_call` returns transfer phone number
- [ ] `POST /api/.../internal/voice-ai/tenant/:tenantId/tools/unknown_tool` returns 404
- [ ] Request without `X-Voice-Agent-Key` → 401
- [ ] Request with invalid key → 401
- [ ] JWT-authenticated users CANNOT access internal endpoints (different auth mechanism)
- [ ] `npm run build` passes
