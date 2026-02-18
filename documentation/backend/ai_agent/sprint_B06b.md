YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B06b — Internal API: Call Start/Complete Endpoints

**Module**: Voice AI
**Sprint**: B06b
**Depends on**: B06a
**Next**: B06c (Tool actions)

---

## Objective

Add the call lifecycle endpoints to the internal API. The Python agent calls `/calls/start` when a call begins (before audio) and `/calls/:callSid/complete` when the call ends (after audio). Usage records are persisted in the complete endpoint.

---

## Pre-Coding Checklist

- [ ] B06a is complete — guard and controller exist
- [ ] **EXECUTION ORDER**: Build B06b FIRST (defines DTOs + controller skeleton that injects services by name), THEN build B07 (which creates the actual VoiceCallLogService and VoiceUsageService). The module compiles after both are complete. Do NOT depend on B07 before B06b — that creates a circular dependency since B07 depends on B06b's DTOs.
- [ ] B07 is complete — `VoiceCallLogService` with `startCall()` and `completeCall()` methods exist (wire these into B06b controller after B07 is done)
- [ ] **HIT BOTH ENDPOINTS** to verify:
  ```bash
  # Start a test call
  curl -X POST http://localhost:8000/api/v1/internal/voice-ai/calls/start \
    -H "X-Voice-Agent-Key: YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"tenant_id":"T1","call_sid":"test-sid-123","from_number":"+15551234567","to_number":"+15559999999"}' | jq .
  # Expect: { "call_log_id": "uuid" }

  # Complete the test call
  curl -X POST http://localhost:8000/api/v1/internal/voice-ai/calls/test-sid-123/complete \
    -H "X-Voice-Agent-Key: YOUR_KEY" \
    -H "Content-Type: application/json" \
    -d '{"call_sid":"test-sid-123","duration_seconds":120,"outcome":"completed","usage_records":[]}' | jq .
  ```

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant: `contato@honeydo4you.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: DTOs

### `start-call.dto.ts`

```typescript
import { IsString, IsNotEmpty, IsOptional, Matches } from 'class-validator';

export class StartCallDto {
  @IsString() @IsNotEmpty() tenant_id: string;
  @IsString() @IsNotEmpty() call_sid: string;
  @IsString() @Matches(/^\+[1-9]\d{1,14}$/) from_number: string;
  @IsString() @IsNotEmpty() to_number: string;
  @IsOptional() @IsString() direction?: string;  // default: 'inbound'
  // Provider IDs resolved from context — used for per-call usage tracking
  @IsOptional() @IsString() stt_provider_id?: string;
  @IsOptional() @IsString() llm_provider_id?: string;
  @IsOptional() @IsString() tts_provider_id?: string;
}
```

### `complete-call.dto.ts`

```typescript
import { IsString, IsInt, IsOptional, IsArray, IsNumber, IsBoolean, IsIn, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UsageRecordDto {
  @IsString() provider_id: string;
  @IsString() @IsIn(['STT', 'LLM', 'TTS']) provider_type: string;
  @IsNumber() @Min(0) usage_quantity: number;  // seconds | tokens | characters
  @IsString() @IsIn(['seconds', 'tokens', 'characters']) usage_unit: string;  // must match B07 UsageRecordData union type
  @IsOptional() @IsNumber() estimated_cost?: number;  // USD
}

export class CompleteCallDto {
  @IsString() @IsNotEmpty() call_sid: string;
  @IsInt() @Min(0) duration_seconds: number;
  @IsString() @IsIn(['completed', 'transferred', 'voicemail', 'abandoned', 'error']) outcome: string;
  @IsOptional() @IsString() transcript_summary?: string;
  @IsOptional() @IsString() full_transcript?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) actions_taken?: string[];
  @IsOptional() @IsString() lead_id?: string;
  @IsOptional() @IsBoolean() is_overage?: boolean;  // true if call consumed overage minutes
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => UsageRecordDto) usage_records?: UsageRecordDto[];
}
```

---

## Task 2: Add Call Methods to Internal Service

Inject `VoiceCallLogService` into `VoiceAiInternalService` (from B06a) and add:

```typescript
// Add to constructor:
private readonly callLogService: VoiceCallLogService,

// Add these methods:

async startCall(dto: StartCallDto): Promise<{ call_log_id: string }> {
  return this.callLogService.startCall({
    tenantId: dto.tenant_id,
    callSid: dto.call_sid,
    fromNumber: dto.from_number,
    toNumber: dto.to_number,
    direction: dto.direction ?? 'inbound',
    sttProviderId: dto.stt_provider_id,
    llmProviderId: dto.llm_provider_id,
    ttsProviderId: dto.tts_provider_id,
  });
}

async completeCall(callSid: string, dto: CompleteCallDto): Promise<void> {
  await this.callLogService.completeCall({
    callSid,
    durationSeconds: dto.duration_seconds,
    outcome: dto.outcome,
    transcriptSummary: dto.transcript_summary,
    fullTranscript: dto.full_transcript,
    actionsTaken: dto.actions_taken,
    leadId: dto.lead_id,
    isOverage: dto.is_overage ?? false,
    usageRecords: dto.usage_records,
  });
}
```

---

## Task 3: Add Endpoints to Internal Controller

Add to `VoiceAiInternalController` (extending B06a):

```typescript
// API-024: Start a call — creates voice_call_log row
@Post('calls/start')
@HttpCode(201)
startCall(@Body() dto: StartCallDto) {
  return this.internalService.startCall(dto);
  // Returns: { call_log_id: string }
}

// API-030: Complete a call — updates call log + creates usage records
// call_sid is in the URL path — NOT in the body (except for confirmation)
@Post('calls/:callSid/complete')
@HttpCode(200)
async completeCall(
  @Param('callSid') callSid: string,
  @Body() dto: CompleteCallDto,
) {
  await this.internalService.completeCall(callSid, dto);
  return { success: true };
}
```

---

## Task 4: Update Module

Add to `voice-ai.module.ts` imports/providers:

```typescript
// Add to imports:
VoiceCallLogModule,   // or whatever module exports VoiceCallLogService

// VoiceCallLogService already injected via module exports from B07
// No new providers needed if VoiceCallLogService is already exported
```

---

## Acceptance Criteria

- [ ] `POST /api/v1/internal/voice-ai/calls/start` creates `voice_call_log` with `status='in_progress'`, returns `{ call_log_id }`
- [ ] `POST /api/v1/internal/voice-ai/calls/:callSid/complete` updates call log status to `completed` + creates `voice_usage_record` rows
- [ ] `usage_records` array creates one `voice_usage_record` row per entry (per-provider granularity)
- [ ] `is_overage: true` persisted to `voice_call_log.is_overage`
- [ ] Duplicate `call_sid` on start returns conflict or existing record (idempotent)
- [ ] Request without `X-Voice-Agent-Key` → 401
- [ ] `npm run build` passes
