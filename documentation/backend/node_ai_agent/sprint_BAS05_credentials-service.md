# Sprint BAS05 — Credentials Service

**Module**: Voice AI
**Sprint**: BAS05
**Depends on**: BAS04 (providers controller complete — providers must exist in DB)
**Estimated size**: 1–2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-credentials.service.ts` completely
- Read `api/prisma/schema.prisma` — `voice_ai_credentials` model — every field
- Read `api/src/core/encryption/encryption.service.ts` — understand `encrypt()` and `decrypt()` method signatures
- NEVER roll your own encryption — inject and use `EncryptionService`
- NEVER return decrypted keys in API responses — always return `masked_api_key`
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceAiCredentialsService` — manages encrypted API keys for each AI provider. One credential per provider (enforced by `provider_id UNIQUE`). Uses `EncryptionService` (AES-256-GCM) for storage. Never exposes plain keys in API responses.

---

## Pre-Coding Checklist

- [ ] BAS04 complete (3 providers exist in DB: deepgram, openai, cartesia)
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-credentials.service.ts` completely
- [ ] Read `api/prisma/schema.prisma` — `voice_ai_credentials` model
- [ ] Read `api/src/core/encryption/encryption.service.ts` — `encrypt(text)` and `decrypt(encrypted)` signatures
- [ ] Verify `EncryptionService` is exported from its module and available for injection

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |
| Encryption key | Read `ENCRYPTION_KEY` from `/var/www/lead360.app/api/.env` — used by EncryptionService |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/services/voice-ai-credentials.service.ts` | Existing implementation |
| `api/prisma/schema.prisma` | `voice_ai_credentials` model — exact field names |
| `api/src/core/encryption/encryption.service.ts` | `encrypt()` / `decrypt()` signatures |
| `api/src/modules/communication/services/tenant-sms-config.service.ts` | Pattern reference — encrypted credentials |

---

## Task 1: Verify Service Methods

`VoiceAiCredentialsService` must implement:

```typescript
@Injectable()
export class VoiceAiCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  // List all credentials — return masked keys ONLY, never plain keys
  async findAll(): Promise<SafeCredentialDto[]>

  // Get credential for a specific provider (by provider ID)
  // Returns null if no credential set yet
  async findByProviderId(providerId: string): Promise<SafeCredentialDto | null>

  // INTERNAL ONLY: Get decrypted key for agent use (BAS20–22 will call this)
  async getDecryptedKey(providerId: string): Promise<string>

  // Upsert: create or update credential for a provider
  // Accepts plain API key → encrypts → stores encrypted + masked
  async upsert(providerId: string, dto: UpsertCredentialDto, updatedBy: string): Promise<SafeCredentialDto>

  // Delete credential for a provider
  async delete(providerId: string): Promise<void>

  // Test if the stored API key is valid (attempt a lightweight API call)
  async testConnection(providerId: string): Promise<{ success: boolean; message: string }>
}
```

**Key rules**:
- `upsert()` creates masked key: take first 4 chars + `...` + last 4 chars
- `findAll()` and `findByProviderId()` NEVER return `encrypted_api_key` — use `SafeCredentialDto`
- `getDecryptedKey()` is only called internally (from agent services in BAS20–22) — never via HTTP
- `testConnection()` tries a simple API call: for Deepgram do a test transcription request, for OpenAI check models list, for Cartesia check voices list

---

## Task 2: Create SafeCredentialDto

```typescript
export class SafeCredentialDto {
  id: string;
  provider_id: string;
  masked_api_key: string;          // 'sk-...xyz'
  additional_config: string | null; // JSON string (masked if needed)
  created_at: Date;
  updated_at: Date;
  updated_by: string | null;
}
```

---

## Task 3: Create UpsertCredentialDto

```typescript
export class UpsertCredentialDto {
  @IsString() @MinLength(10) api_key: string;    // Plain API key — will be encrypted
  @IsOptional() @IsString() additional_config?: string;  // JSON string for extra config
}
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
| `api/src/modules/voice-ai/services/voice-ai-credentials.service.ts` | VERIFY/MODIFY | All methods complete, encryption correct |
| `api/src/modules/voice-ai/dto/safe-credential.dto.ts` | CREATE (if missing) | Safe response DTO (no plain keys) |
| `api/src/modules/voice-ai/dto/upsert-credential.dto.ts` | CREATE (if missing) | Request DTO for upsert |

---

## Acceptance Criteria

- [ ] `upsert()` encrypts the key with `EncryptionService.encrypt()`
- [ ] `upsert()` stores masked version: first 4 + `...` + last 4 chars
- [ ] API responses NEVER include `encrypted_api_key`
- [ ] `getDecryptedKey()` uses `EncryptionService.decrypt()` correctly
- [ ] `testConnection()` attempts real API validation per provider type
- [ ] `npm run build` passes with 0 errors
