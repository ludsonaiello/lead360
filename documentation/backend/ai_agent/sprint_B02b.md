YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B02b — Admin Credentials CRUD

**Module**: Voice AI
**Sprint**: B02b
**Depends on**: B02a (module + providers exist)

---

## Objective

Build admin-only CRUD endpoints for managing encrypted API credentials per provider. Keys are stored encrypted and NEVER returned in plaintext — only the last 4 characters are shown.

---

## Pre-Coding Checklist

- [ ] B02a is complete — providers exist
- [ ] Read `/api/src/core/encryption/encryption.service.ts` — understand `encrypt(text)` and `decrypt(text)`
- [ ] Read `/api/src/modules/communication/services/tenant-sms-config.service.ts` — encryption usage reference
- [ ] **HIT THE ENDPOINT** after implementing: `curl http://localhost:8000/api/v1/system/voice-ai/credentials -H "Authorization: Bearer $TOKEN" | jq .`

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: Credential DTO

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

## Task 2: Credentials Service

`voice-ai-credentials.service.ts`:

```typescript
export interface MaskedCredential {
  id: string;
  provider_id: string;
  provider_key: string;
  masked_key: string;  // e.g. "sk-...4abc"
  updated_by: string | null;
  updated_at: Date;
}

@Injectable()
export class VoiceAiCredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async findAll(): Promise<MaskedCredential[]> {
    const creds = await this.prisma.voice_ai_credentials.findMany({
      include: { provider: { select: { provider_key: true } } },
    });
    return creds.map(c => this.mask(c));
  }

  async upsert(providerId: string, dto: UpsertCredentialDto, updatedBy: string): Promise<MaskedCredential> {
    const encrypted = await this.encryption.encrypt(dto.api_key);
    const last4 = dto.api_key.slice(-4);  // Derive last4 from PLAIN key BEFORE encryption — ciphertext bytes are not human-readable
    const maskedApiKey = `****${last4}`;
    const cred = await this.prisma.voice_ai_credentials.upsert({
      where: { provider_id: providerId },
      create: {
        provider_id: providerId,
        encrypted_api_key: encrypted,
        masked_api_key: maskedApiKey,
        updated_by: updatedBy,
      },
      update: {
        encrypted_api_key: encrypted,
        masked_api_key: maskedApiKey,
        updated_by: updatedBy,
      },
      include: { provider: { select: { provider_key: true } } },
    });
    return this.mask(cred);
  }

  async delete(providerId: string): Promise<void> {
    await this.prisma.voice_ai_credentials.delete({
      where: { provider_id: providerId },
    });
  }

  async getDecryptedKey(providerId: string): Promise<string> {
    // Used INTERNALLY by context builder — NEVER exposed via controller
    const cred = await this.prisma.voice_ai_credentials.findUnique({
      where: { provider_id: providerId },
    });
    if (!cred) throw new NotFoundException(`No credential found for provider ${providerId}`);
    return this.encryption.decrypt(cred.encrypted_api_key);
  }

  private mask(cred: any): MaskedCredential {
    // Use the stored masked_api_key column — already formatted as "****XXXX"
    return {
      id: cred.id,
      provider_id: cred.provider_id,
      provider_key: cred.provider?.provider_key ?? '',
      masked_key: cred.masked_api_key,
      updated_by: cred.updated_by,
      updated_at: cred.updated_at,
    };
  }
}
```

**Rules**:
- `findAll()` NEVER returns decrypted keys
- `getDecryptedKey()` is NOT exposed via controller — internal use by context builder only

---

## Task 3: Credentials Controller

`controllers/admin/voice-ai-credentials.controller.ts`:

```typescript
@ApiTags('Voice AI - System Admin Credentials')
@Controller('system/voice-ai/credentials')  // → /api/v1/system/voice-ai/credentials
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
export class VoiceAiCredentialsController {
  constructor(private readonly credentialsService: VoiceAiCredentialsService) {}

  @Get()
  findAll() {
    return this.credentialsService.findAll();
  }

  @Put(':providerId')
  async upsert(
    @Param('providerId') providerId: string,
    @Body() dto: UpsertCredentialDto,
    @Request() req: any,
  ) {
    return this.credentialsService.upsert(providerId, dto, req.user.id);
  }

  @Delete(':providerId')
  @HttpCode(204)
  async delete(@Param('providerId') providerId: string) {
    await this.credentialsService.delete(providerId);
  }
}
```

---

## Task 4: Update Module

Update `voice-ai.module.ts` to add credentials:

```typescript
@Module({
  imports: [PrismaModule, EncryptionModule],
  controllers: [
    VoiceAiProvidersController,
    VoiceAiCredentialsController,
  ],
  providers: [
    VoiceAiProvidersService,
    VoiceAiCredentialsService,
  ],
  exports: [
    VoiceAiProvidersService,
    VoiceAiCredentialsService,  // needed by context builder (B04)
  ],
})
export class VoiceAiModule {}
```

---

## Acceptance Criteria

- [ ] `PUT /api/v1/system/voice-ai/credentials/:providerId` stores encrypted credential in `encrypted_api_key` column + stores masked version in `masked_api_key` column + sets `updated_by`
- [ ] `GET /api/v1/system/voice-ai/credentials` returns masked keys only (no plain text, no decrypted values) — reads from `masked_api_key` column
- [ ] `DELETE /api/v1/system/voice-ai/credentials/:providerId` removes credential
- [ ] Non-admin gets 403
- [ ] `VoiceAiCredentialsService.getDecryptedKey()` reads `encrypted_api_key` column and decrypts correctly (verify internally)
- [ ] No reference to `api_key_encrypted` anywhere — the correct column name is `encrypted_api_key` (per schema)
- [ ] `EncryptionModule` imported in `voice-ai.module.ts`
- [ ] `npm run build` passes without errors
