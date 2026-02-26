# Sprint BAS07 — Global Config Service

**Module**: Voice AI
**Sprint**: BAS07
**Depends on**: BAS06 (credentials stored for all 3 providers)
**Estimated size**: 1–2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-global-config.service.ts` completely
- Read `api/prisma/schema.prisma` — `voice_ai_global_config` model — every field
- Understand this is a SINGLETON table: exactly one row with `id = "default"`
- Read `EncryptionService` for `livekit_api_key_encrypted` and `livekit_api_secret_encrypted`
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceAiGlobalConfigService` — manages the single `voice_ai_global_config` row that stores platform-wide Voice AI settings including LiveKit connection details and default provider selections.

---

## Pre-Coding Checklist

- [ ] BAS06 complete (API keys stored for Deepgram, OpenAI, Cartesia)
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-global-config.service.ts` completely
- [ ] Read `api/prisma/schema.prisma` — `voice_ai_global_config` model
- [ ] Read `api/src/core/encryption/encryption.service.ts`
- [ ] Verify the `voice_ai_global_config` table has exactly one row: `SELECT * FROM voice_ai_global_config;`

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |
| LiveKit URL | Will be stored via PATCH endpoint after BAS08 |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/services/voice-ai-global-config.service.ts` | Existing service |
| `api/prisma/schema.prisma` | `voice_ai_global_config` — every field and relation |
| `api/src/core/encryption/encryption.service.ts` | For LiveKit key encryption |

---

## Task 1: Verify Service Methods

```typescript
@Injectable()
export class VoiceAiGlobalConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // Get the global config (always returns the singleton row)
  // Creates the row with defaults if it doesn't exist (upsert pattern)
  // Returns response WITH relation details (provider display_name)
  // Returns masked LiveKit key info — NOT raw secrets
  async getConfig(): Promise<GlobalConfigResponseDto>

  // Update the global config (partial update)
  // If livekit_api_key or livekit_api_secret provided: encrypt before storing
  async updateConfig(dto: UpdateGlobalConfigDto, updatedBy: string): Promise<GlobalConfigResponseDto>

  // INTERNAL: Get LiveKit connection details (decrypted) for agent worker (BAS19)
  async getLiveKitConfig(): Promise<{ url: string; apiKey: string; apiSecret: string }>
}
```

**Key rules**:
- `getConfig()` uses `upsert` with `where: { id: 'default' }` — creates row if first call
- `updateConfig()` only updates provided fields — never wipes fields not in the DTO
- LiveKit credentials are stored encrypted — `getLiveKitConfig()` decrypts them
- Response DTO should include resolved provider objects (display_name, provider_key) not just IDs

---

## Task 2: Verify DTOs

**UpdateGlobalConfigDto** — all fields optional:
```typescript
export class UpdateGlobalConfigDto {
  @IsOptional() @IsBoolean() agent_enabled?: boolean;
  @IsOptional() @IsUUID() default_stt_provider_id?: string;
  @IsOptional() @IsUUID() default_llm_provider_id?: string;
  @IsOptional() @IsUUID() default_tts_provider_id?: string;
  @IsOptional() @IsString() default_voice_id?: string;
  @IsOptional() @IsString() @Length(2, 10) default_language?: string;
  @IsOptional() @IsString() default_greeting_template?: string;
  @IsOptional() @IsString() default_system_prompt?: string;
  @IsOptional() @IsInt() @Min(60) @Max(3600) default_max_call_seconds?: number;
  @IsOptional() @IsUrl() livekit_url?: string;
  @IsOptional() @IsString() livekit_api_key?: string;    // Encrypted before storage
  @IsOptional() @IsString() livekit_api_secret?: string; // Encrypted before storage
  @IsOptional() @IsInt() @Min(1) @Max(100) max_concurrent_calls?: number;
}
```

---

## Task 3: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/services/voice-ai-global-config.service.ts` | VERIFY/MODIFY | getConfig, updateConfig, getLiveKitConfig |
| `api/src/modules/voice-ai/dto/update-global-config.dto.ts` | VERIFY/CREATE | Update DTO with all optional fields |
| `api/src/modules/voice-ai/dto/global-config-response.dto.ts` | VERIFY/CREATE | Safe response (no raw secrets) |

---

## Acceptance Criteria

- [ ] `getConfig()` returns singleton row (creates if missing)
- [ ] `updateConfig()` encrypts LiveKit credentials before storing
- [ ] `getLiveKitConfig()` decrypts and returns raw LiveKit credentials (internal only)
- [ ] Response DTO never exposes `livekit_api_key_encrypted` or `livekit_api_secret_encrypted`
- [ ] Response includes provider `display_name` and `provider_key` for each provider FK
- [ ] `npm run build` passes with 0 errors
