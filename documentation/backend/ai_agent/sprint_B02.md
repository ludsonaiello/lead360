YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B02 — Module Scaffold + Admin Provider & Credential CRUD

**Module**: Voice AI  
**Sprint**: B02  
**Depends on**: B01 (schema + migration complete)  
**Estimated scope**: ~3 hours

---

## Objective

Create the NestJS `voice-ai` module structure with admin-only CRUD endpoints for managing AI providers and their credentials. Credentials are encrypted using the existing EncryptionService.

---

## Pre-Coding Checklist

- [ ] B01 is complete — all tables exist
- [ ] Read `/api/src/core/encryption/encryption.service.ts` — understand encrypt/decrypt pattern
- [ ] Read `/api/src/modules/communication/services/tenant-sms-config.service.ts` — encryption usage reference
- [ ] Read `/api/src/modules/admin/` — admin guard pattern
- [ ] Verify backend running: `http://localhost:8000/api/v1`

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- Tenant: `contato@honeydo4you.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Module Structure to Create

```
/api/src/modules/voice-ai/
├── voice-ai.module.ts
├── controllers/
│   ├── admin/
│   │   ├── voice-ai-providers.controller.ts
│   │   └── voice-ai-credentials.controller.ts
│   ├── tenant/       (empty for now, used in B04+)
│   └── internal/     (empty for now, used in B06+)
├── services/
│   ├── voice-ai-providers.service.ts
│   └── voice-ai-credentials.service.ts
└── dto/
    ├── create-provider.dto.ts
    ├── update-provider.dto.ts
    └── upsert-credential.dto.ts
```

---

## Task 1: DTOs

### `create-provider.dto.ts`

```typescript
import { IsString, IsIn, IsOptional, IsBoolean, MaxLength, IsUrl } from 'class-validator';

export class CreateProviderDto {
  @IsString()
  @MaxLength(50)
  provider_key: string;  // e.g. 'deepgram', 'openai', 'cartesia'

  @IsString()
  @IsIn(['STT', 'LLM', 'TTS'])
  provider_type: string;

  @IsString()
  @MaxLength(100)
  display_name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUrl()
  logo_url?: string;

  @IsOptional()
  @IsUrl()
  documentation_url?: string;

  @IsOptional()
  @IsString()
  capabilities?: string;  // JSON array string

  @IsOptional()
  @IsString()
  config_schema?: string;  // JSON Schema string

  @IsOptional()
  @IsString()
  default_config?: string;  // JSON object string

  @IsOptional()
  @IsString()
  pricing_info?: string;  // JSON object string

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
```

### `update-provider.dto.ts`

Partial version of CreateProviderDto — use `PartialType(CreateProviderDto)`.

### `upsert-credential.dto.ts`

```typescript
import { IsString, MinLength } from 'class-validator';

export class UpsertCredentialDto {
  @IsString()
  @MinLength(10)
  api_key: string;  // Plain key — will be encrypted before storing
}
```

---

## Task 2: Providers Service

`voice-ai-providers.service.ts`:

```typescript
@Injectable()
export class VoiceAiProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<voice_ai_provider[]>
  async findById(id: string): Promise<voice_ai_provider>
  async create(dto: CreateProviderDto): Promise<voice_ai_provider>
  async update(id: string, dto: UpdateProviderDto): Promise<voice_ai_provider>
  async softDelete(id: string): Promise<void>  // Sets is_active = false
}
```

- `findById` throws `NotFoundException` if not found
- `create` throws `ConflictException` if `provider_key` already exists
- `softDelete` sets `is_active = false`, does NOT delete the row (credentials may reference it)

---

## Task 3: Credentials Service

`voice-ai-credentials.service.ts`:

```typescript
@Injectable()
export class VoiceAiCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async findAll(): Promise<MaskedCredential[]>  // Returns masked keys ONLY
  async upsert(providerId: string, dto: UpsertCredentialDto): Promise<MaskedCredential>
  async delete(providerId: string): Promise<void>
  async getDecryptedKey(providerId: string): Promise<string>  // Used internally by context builder
}
```

**Masking logic**: Last 4 characters visible. Example: `sk-abc123` → `sk-...3123`.
**Encryption**: `this.encryption.encrypt(dto.api_key)` before storing.
**`getDecryptedKey`** is NOT exposed via controller — internal use only for context builder.
**`findAll`** NEVER returns decrypted keys.

---

## Task 4: Providers Controller

`voice-ai-providers.controller.ts`:

```typescript
@ApiTags('Voice AI - System Admin Providers')
@Controller('system/voice-ai/providers')  // → /api/v1/system/voice-ai/providers
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceAiProvidersController {
  @Get()          // GET /api/v1/system/voice-ai/providers
  @Post()         // POST /api/v1/system/voice-ai/providers
  @Patch(':id')   // PATCH /api/v1/system/voice-ai/providers/:id
  @Delete(':id')  // DELETE /api/v1/system/voice-ai/providers/:id
}
```

All endpoints require `is_platform_admin: true`. Check pattern from existing admin module.

---

## Task 5: Credentials Controller

`voice-ai-credentials.controller.ts`:

```typescript
@ApiTags('Voice AI - System Admin Credentials')
@Controller('system/voice-ai/credentials')  // → /api/v1/system/voice-ai/credentials
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceAiCredentialsController {
  @Get()                   // GET /api/v1/system/voice-ai/credentials
  @Put(':providerId')      // PUT /api/v1/system/voice-ai/credentials/:providerId
  @Delete(':providerId')   // DELETE /api/v1/system/voice-ai/credentials/:providerId
}
```

---

## Task 6: Module + Registration

`voice-ai.module.ts`:

```typescript
@Module({
  imports: [PrismaModule, EncryptionModule],  // import existing core modules
  controllers: [VoiceAiProvidersController, VoiceAiCredentialsController],
  providers: [VoiceAiProvidersService, VoiceAiCredentialsService],
  exports: [VoiceAiProvidersService, VoiceAiCredentialsService],
})
export class VoiceAiModule {}
```

Register `VoiceAiModule` in `/api/src/app.module.ts` imports array.

---

## Task 7: Seed Script

Add to the Prisma seed file (or create a migration with seed data) to insert the 3 default providers:

```typescript
await prisma.voice_ai_provider.createMany({
  data: [
    { provider_key: 'deepgram', provider_type: 'STT', display_name: 'Deepgram', description: 'Speech-to-text provider' },
    { provider_key: 'openai', provider_type: 'LLM', display_name: 'OpenAI', description: 'Language model provider (GPT-4o-mini)' },
    { provider_key: 'cartesia', provider_type: 'TTS', display_name: 'Cartesia', description: 'Text-to-speech provider' },
  ],
  skipDuplicates: true,
});
```

Run with: `npx prisma db seed` or execute manually.

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/voice-ai/providers` returns list of providers (admin only)
- [ ] `POST /api/v1/system/voice-ai/providers` creates a provider with all new fields (config_schema, default_config, capabilities, pricing_info, logo_url, documentation_url)
- [ ] `PATCH /api/v1/system/voice-ai/providers/:id` updates provider
- [ ] `DELETE /api/v1/system/voice-ai/providers/:id` soft-deletes (sets is_active=false)
- [ ] Non-admin gets 403 on all system/* endpoints
- [ ] `PUT /api/v1/system/voice-ai/credentials/:providerId` stores encrypted credential + sets updated_by
- [ ] `GET /api/v1/system/voice-ai/credentials` returns masked keys (no plain text, no decrypted values)
- [ ] 3 default providers seeded (deepgram, openai, cartesia) with full metadata
- [ ] Module registered in app.module.ts
- [ ] `npm run build` passes without errors
