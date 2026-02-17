YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B05 — Transfer Numbers CRUD

**Module**: Voice AI  
**Sprint**: B05  
**Depends on**: B01, B04  
**Estimated scope**: ~1.5 hours

---

## Objective

Build tenant-facing CRUD endpoints for managing call transfer destinations. These are the phone numbers the AI agent will transfer calls to when needed.

---

## Pre-Coding Checklist

- [ ] B04 is complete
- [ ] Read `/api/src/modules/leads/lead-phones.service.ts` — reference for list CRUD with uniqueness
- [ ] Check `tenant_voice_transfer_number` model in schema
- [ ] Verify: `GET /api/v1/voice-ai/settings` works (from B04)

**DO NOT USE PM2** — run with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`  
- Tenant: `contato@honeydo4you.com` / `978@F32c`  
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode

---

## Task 1: DTOs

### `create-transfer-number.dto.ts`

```typescript
export class CreateTransferNumberDto {
  @IsString()
  @MaxLength(100)
  label: string;  // e.g. "Sales", "Emergency", "Main Office"

  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone must be in E.164 format (+15551234567)' })
  phone_number: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
```

### `update-transfer-number.dto.ts`

PartialType of CreateTransferNumberDto.

---

## Task 2: Transfer Numbers Service

`voice-transfer-numbers.service.ts`:

```typescript
@Injectable()
export class VoiceTransferNumbersService {
  private readonly MAX_TRANSFER_NUMBERS = 10;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<tenant_voice_transfer_number[]>

  async create(tenantId: string, dto: CreateTransferNumberDto): Promise<tenant_voice_transfer_number>
  // Throws BadRequestException if count >= 10
  // If is_default: true, unset previous default first (use transaction)

  async update(tenantId: string, id: string, dto: UpdateTransferNumberDto): Promise<tenant_voice_transfer_number>
  // Throws NotFoundException if not found or wrong tenant
  // If is_default: true, unset previous default first

  async delete(tenantId: string, id: string): Promise<void>
  // Throws NotFoundException if not found or wrong tenant

  private async ensureSingleDefault(tenantId: string, tx: Prisma.TransactionClient): Promise<void>
  // Sets all transfer numbers for tenant to is_default=false
}
```

---

## Task 3: Controller

`controllers/tenant/voice-transfer-numbers.controller.ts`:

```
GET    /api/v1/voice-ai/transfer-numbers       → findAll(req.user.tenant_id)
POST   /api/v1/voice-ai/transfer-numbers       → create(req.user.tenant_id, dto)
PATCH  /api/v1/voice-ai/transfer-numbers/:id   → update(req.user.tenant_id, id, dto)
DELETE /api/v1/voice-ai/transfer-numbers/:id   → delete(req.user.tenant_id, id)
```

Uses `JwtAuthGuard` only.

---

## Task 4: Update Module

Add to `voice-ai.module.ts`:
- `VoiceTransferNumbersService`
- `VoiceTransferNumbersController`
- Export `VoiceTransferNumbersService` (needed by context builder to include in context)

Update `VoiceAiContextBuilderService` to inject and use `VoiceTransferNumbersService.findAll(tenantId)`.

---

## Acceptance Criteria

- [ ] `GET /api/v1/voice-ai/transfer-numbers` returns tenant's transfer numbers
- [ ] `POST` creates a transfer number (max 10 enforced)
- [ ] `POST` with `is_default: true` unsets previous default
- [ ] `PATCH` updates transfer number, handles is_default correctly
- [ ] `DELETE` removes transfer number
- [ ] All operations are tenant-isolated (can't access other tenant's numbers)
- [ ] Context builder `buildContext()` now includes transfer_numbers array
- [ ] `npm run build` passes
