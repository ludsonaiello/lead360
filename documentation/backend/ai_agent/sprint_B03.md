YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B03 — Global Config + Subscription Plan Voice AI Extension

**Module**: Voice AI  
**Sprint**: B03  
**Depends on**: B01, B02a, B02b  
**Estimated scope**: ~2 hours

---

## Objective

Build admin endpoints to manage the singleton `voice_ai_global_config` and to configure voice AI settings per subscription plan tier.

---

## Pre-Coding Checklist

- [ ] B01 and B02 are complete
- [ ] Read `/api/src/modules/communication/services/platform-email-config.service.ts` — singleton pattern reference
- [ ] Read `/api/src/modules/admin/services/subscription-management.service.ts` or similar — subscription plan CRUD reference
- [ ] Verify backend running and voice-ai module loading: `http://localhost:8000/api/v1/system/voice-ai/providers`

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: DTOs

### `update-global-config.dto.ts`

```typescript
export class UpdateGlobalConfigDto {
  @IsOptional() @IsString() default_stt_provider_id?: string;
  @IsOptional() @IsString() default_llm_provider_id?: string;
  @IsOptional() @IsString() default_tts_provider_id?: string;
  @IsOptional() @IsString() default_voice_id?: string;
  @IsOptional() @IsString() @MaxLength(10) default_language?: string;
  @IsOptional() @IsString() default_languages?: string;     // JSON array: ["en","es","pt"]
  @IsOptional() @IsString() @MaxLength(500) default_greeting_template?: string;
  @IsOptional() @IsString() @MaxLength(2000) default_system_prompt?: string;
  @IsOptional() @IsInt() @Min(60) @Max(3600) default_max_call_duration_seconds?: number;
  @IsOptional() @IsString() default_transfer_behavior?: string; // end_call | voicemail | hold
  @IsOptional() @IsString() default_tools_enabled?: string;  // JSON: {booking,lead_creation,call_transfer}
  @IsOptional() @IsString() default_stt_config?: string;    // JSON provider-specific config
  @IsOptional() @IsString() default_llm_config?: string;    // JSON provider-specific config
  @IsOptional() @IsString() default_tts_config?: string;    // JSON provider-specific config
  @IsOptional() @IsString() livekit_sip_trunk_url?: string;
  @IsOptional() @IsString() livekit_api_key?: string;    // Stored encrypted
  @IsOptional() @IsString() livekit_api_secret?: string; // Stored encrypted
  @IsOptional() @IsInt() @Min(1) max_concurrent_calls?: number;
}
```

### `update-plan-voice-config.dto.ts`

```typescript
export class UpdatePlanVoiceConfigDto {
  @IsOptional() @IsBoolean() voice_ai_enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) voice_ai_minutes_included?: number;
  @IsOptional() @IsNumber() @Min(0) voice_ai_overage_rate?: number | null;
}
```

---

## Task 2: Global Config Service

`voice-ai-global-config.service.ts`:

```typescript
@Injectable()
export class VoiceAiGlobalConfigService {
  private readonly SINGLETON_ID = 'default';

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async getConfig(): Promise<voice_ai_global_config>
  // Returns config with livekit keys masked (not decrypted in response)

  async updateConfig(userId: string, dto: UpdateGlobalConfigDto): Promise<voice_ai_global_config>
  // Encrypts livekit_api_key and livekit_api_secret if provided
  // Records updated_by = userId
  // Uses prisma.voice_ai_global_config.upsert with where: { id: 'default' }

  async regenerateAgentKey(): Promise<{ plain_key: string; preview: string }>
  // Generates crypto.randomUUID() as plain key
  // Stores SHA-256 hash as HEX string (64 chars) in agent_api_key_hash:
  //   crypto.createHash('sha256').update(plainKey).digest('hex')
  //   IMPORTANT: B06a VoiceAgentKeyGuard uses timing-safe hex comparison — must store as hex
  // Stores last 4 chars in agent_api_key_preview
  // Returns { plain_key, preview } — plain_key shown ONCE, never stored
}
```

**Important**: `getConfig` response should NEVER include decrypted LiveKit keys or agent_api_key_hash. Mask LiveKit keys (show only if null/set status), return agent_api_key_preview only.

---

## Task 3: Plan Config Service

`voice-ai-plan-config.service.ts`:

```typescript
@Injectable()
export class VoiceAiPlanConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getPlansWithVoiceConfig(): Promise<PlanWithVoiceConfig[]>
  // Returns all subscription_plan rows with voice AI fields

  async updatePlanVoiceConfig(planId: string, dto: UpdatePlanVoiceConfigDto): Promise<subscription_plan>
  // Updates only voice_ai_* fields on the plan
  // Throws NotFoundException if plan not found
}
```

---

## Task 4: Controllers

### `voice-ai-global-config.controller.ts`

```
GET  /api/v1/system/voice-ai/config           → getConfig()
PATCH /api/v1/system/voice-ai/config          → updateConfig(req.user.id, dto)
POST /api/v1/system/voice-ai/config/regenerate-key → regenerateAgentKey()
```

`POST /regenerate-key` response:
```json
{
  "plain_key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "preview": "...xxxx",
  "warning": "Save this key now. It will not be shown again."
}
```

### `voice-ai-plan-config.controller.ts`

```
GET  /api/v1/system/voice-ai/plans                    → getPlansWithVoiceConfig()
PATCH /api/v1/system/voice-ai/plans/:planId/voice     → updatePlanVoiceConfig(planId, dto)
```

All admin-only (is_platform_admin required).

---

## Task 5: Register New Services/Controllers in Module

Update `voice-ai.module.ts` to include:
- `VoiceAiGlobalConfigService`
- `VoiceAiPlanConfigService`
- `VoiceAiGlobalConfigController`
- `VoiceAiPlanConfigController`

Export `VoiceAiGlobalConfigService` (needed by context builder in B04).

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/voice-ai/config` returns singleton config (no raw keys)
- [ ] `PATCH /api/v1/system/voice-ai/config` updates all config fields including new: default_languages, default_tools_enabled, default_transfer_behavior, default_*_config JSON
- [ ] `POST /api/v1/system/voice-ai/config/regenerate-key` returns plain_key once
- [ ] `GET /api/v1/system/voice-ai/plans` returns plans with voice AI fields
- [ ] `PATCH /api/v1/system/voice-ai/plans/:planId/voice` updates plan voice config
- [ ] Non-admin gets 403 on all endpoints
- [ ] LiveKit keys stored encrypted, never returned in responses
- [ ] `npm run build` passes
