# Sprint BAS03 — Provider Service (CRUD)

**Module**: Voice AI
**Sprint**: BAS03
**Depends on**: BAS02 (module scaffold complete)
**Estimated size**: 1–2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read the existing `voice-ai-providers.service.ts` completely
- Read `api/prisma/schema.prisma` — find `voice_ai_provider` model — know every field name and type
- Compare against similar services (e.g., `transcription-provider.service.ts`) for patterns
- NEVER guess field names — check the Prisma schema
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceAiProvidersService` — the CRUD service for the `voice_ai_provider` table. This service manages the registry of AI providers (Deepgram, OpenAI, Cartesia). It must support list, get, create, update, and soft-delete.

---

## Pre-Coding Checklist

- [ ] BAS02 complete (module scaffold verified)
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-providers.service.ts` completely
- [ ] Read `api/prisma/schema.prisma` — voice_ai_provider model (every field)
- [ ] Read `api/src/modules/communication/services/transcription-provider.service.ts` — pattern reference
- [ ] Read `api/src/core/database/prisma.service.ts` — understand PrismaService usage

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
| `api/src/modules/voice-ai/services/voice-ai-providers.service.ts` | Existing implementation — understand what's there |
| `api/prisma/schema.prisma` | `voice_ai_provider` model — field names and types |
| `api/src/modules/communication/services/transcription-provider.service.ts` | Pattern reference for provider CRUD |
| `api/src/modules/voice-ai/dto/` | Check existing DTOs for provider create/update |

---

## Task 1: Verify Service Methods

`VoiceAiProvidersService` must implement these methods. Read the existing file first — add what's missing:

```typescript
@Injectable()
export class VoiceAiProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  // List all providers, optionally filtered by type
  async findAll(filters?: { provider_type?: string; is_active?: boolean }): Promise<voice_ai_provider[]>

  // Get single provider by ID — throw NotFoundException if not found
  async findById(id: string): Promise<voice_ai_provider>

  // Get provider by key (e.g., 'deepgram', 'openai', 'cartesia')
  async findByKey(provider_key: string): Promise<voice_ai_provider | null>

  // Create a new provider — check provider_key uniqueness
  async create(dto: CreateVoiceAiProviderDto): Promise<voice_ai_provider>

  // Update provider — throw NotFoundException if not found
  async update(id: string, dto: UpdateVoiceAiProviderDto): Promise<voice_ai_provider>

  // Soft delete — set is_active = false, do NOT delete the row
  async deactivate(id: string): Promise<voice_ai_provider>
}
```

**Key rules:**
- `findAll()` must filter by `is_active: true` by default (unless caller explicitly requests inactive)
- `create()` must check `provider_key` uniqueness and throw `ConflictException` if duplicate
- `deactivate()` sets `is_active = false`, does NOT delete — this preserves credential and usage history
- All queries use `this.prisma.voice_ai_provider` — check the exact Prisma model name in schema

---

## Task 2: Verify DTOs

Check `api/src/modules/voice-ai/dto/` for existing DTOs. Create if missing:

**CreateVoiceAiProviderDto**:
```typescript
export class CreateVoiceAiProviderDto {
  @IsString() @Length(1, 50) provider_key: string;        // 'deepgram'
  @IsEnum(['STT', 'LLM', 'TTS']) provider_type: string;
  @IsString() @Length(1, 100) display_name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsUrl() logo_url?: string;
  @IsOptional() @IsUrl() documentation_url?: string;
  @IsOptional() @IsString() capabilities?: string;         // JSON string
  @IsOptional() @IsString() config_schema?: string;        // JSON Schema string
  @IsOptional() @IsString() default_config?: string;       // JSON string
  @IsOptional() @IsString() pricing_info?: string;         // JSON string
}
```

**UpdateVoiceAiProviderDto**: `PartialType(CreateVoiceAiProviderDto)` with `@IsOptional()` on all fields.

Check if these DTOs already exist before creating them. Read `api/src/modules/voice-ai/dto/` first.

---

## Task 3: Seed Initial Providers (Optional but Recommended)

If no providers exist, add a seed method or document the curl commands to create the 3 default providers (Deepgram, OpenAI, Cartesia). These will be used to set up `voice_ai_global_config` in BAS08.

```typescript
// Seed data (for documentation — enter via API after BAS04 controller is done)
const defaultProviders = [
  { provider_key: 'deepgram', provider_type: 'STT', display_name: 'Deepgram', ... },
  { provider_key: 'openai', provider_type: 'LLM', display_name: 'OpenAI GPT-4o', ... },
  { provider_key: 'cartesia', provider_type: 'TTS', display_name: 'Cartesia', ... },
];
```

---

## Task 4: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/services/voice-ai-providers.service.ts` | VERIFY/MODIFY | All 5 CRUD methods complete |
| `api/src/modules/voice-ai/dto/create-voice-ai-provider.dto.ts` | CREATE (if missing) | Validated DTO |
| `api/src/modules/voice-ai/dto/update-voice-ai-provider.dto.ts` | CREATE (if missing) | Partial update DTO |

---

## Acceptance Criteria

- [ ] `VoiceAiProvidersService` has `findAll`, `findById`, `findByKey`, `create`, `update`, `deactivate`
- [ ] `create()` throws `ConflictException` on duplicate `provider_key`
- [ ] `findById()` throws `NotFoundException` if not found
- [ ] `deactivate()` sets `is_active = false`, does NOT hard-delete
- [ ] DTOs exist with proper class-validator decorators
- [ ] `npm run build` passes with 0 errors

---

## Testing (after BAS04 controller is done)

```bash
# Create Deepgram STT provider
curl -X POST http://localhost:3000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"provider_key":"deepgram","provider_type":"STT","display_name":"Deepgram"}'

# List providers
curl http://localhost:3000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer <admin_token>"
```
