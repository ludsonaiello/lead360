# Sprint BAS11 — Transfer Numbers Service

**Module**: Voice AI
**Sprint**: BAS11
**Depends on**: BAS10 (tenant settings controller complete)
**Estimated size**: 1–2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-transfer-numbers.service.ts` completely
- Read `api/prisma/schema.prisma` — `tenant_voice_transfer_number` model
- Understand the max 10 per tenant rule enforced at service layer
- Validate phone numbers in E.164 format (+1XXXXXXXXXX)
- When `is_default = true` is set, ensure only ONE transfer number is default per tenant
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceTransferNumbersService` — manages per-tenant call transfer phone numbers. Maximum 10 per tenant. Supports ordering (`display_order`). Exactly one can be marked `is_default`.

---

## Pre-Coding Checklist

- [ ] BAS10 complete (tenant settings controller verified)
- [ ] Read `api/src/modules/voice-ai/services/voice-transfer-numbers.service.ts` completely
- [ ] Read `api/prisma/schema.prisma` — `tenant_voice_transfer_number` model
- [ ] Read `api/prisma/schema.prisma` — `tenant_voice_ai_settings` relation to transfer numbers

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
| `api/src/modules/voice-ai/services/voice-transfer-numbers.service.ts` | Existing service |
| `api/prisma/schema.prisma` | `tenant_voice_transfer_number` model |

---

## Task 1: Verify Service Methods

```typescript
@Injectable()
export class VoiceTransferNumbersService {
  constructor(private readonly prisma: PrismaService) {}

  // List all active transfer numbers for a tenant, ordered by display_order
  async findAll(tenantId: string): Promise<tenant_voice_transfer_number[]>

  // Get single number by ID — enforce tenant_id match
  async findById(tenantId: string, id: string): Promise<tenant_voice_transfer_number>

  // Create new transfer number
  // Validates: max 10 per tenant, E.164 phone format
  // If is_default: true, clears other defaults first (transaction)
  async create(tenantId: string, dto: CreateTransferNumberDto): Promise<tenant_voice_transfer_number>

  // Update transfer number — enforce tenant_id ownership
  // If is_default: true, clears other defaults first (transaction)
  async update(tenantId: string, id: string, dto: UpdateTransferNumberDto): Promise<tenant_voice_transfer_number>

  // Soft delete — set is_active = false
  async deactivate(tenantId: string, id: string): Promise<tenant_voice_transfer_number>

  // Reorder — update display_order for a list of IDs
  async reorder(tenantId: string, orderedIds: string[]): Promise<void>
}
```

**Key rules**:
- `create()` checks count: `WHERE tenant_id = ? AND is_active = true` — throw `BadRequestException` if >= 10
- Phone validation: must match `/^\+[1-9]\d{7,14}$/` (E.164)
- `is_default` change: use a Prisma transaction — first `updateMany({ is_default: false })`, then `update({ is_default: true })`
- All queries filter by `tenant_id` — NEVER query without it

---

## Task 2: Verify DTOs

**CreateTransferNumberDto**:
```typescript
export class CreateTransferNumberDto {
  @IsString() @Length(1, 100) label: string;     // "Sales", "Support", "Owner"
  @IsString() @Matches(/^\+[1-9]\d{7,14}$/) phone_number: string;  // E.164
  @IsOptional() @IsBoolean() is_default?: boolean;
  @IsOptional() @IsBoolean() is_active?: boolean;
  @IsOptional() @IsInt() @Min(0) display_order?: number;
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
| `api/src/modules/voice-ai/services/voice-transfer-numbers.service.ts` | VERIFY/MODIFY | All 6 methods |
| `api/src/modules/voice-ai/dto/create-transfer-number.dto.ts` | VERIFY/CREATE | Create DTO with E.164 validation |
| `api/src/modules/voice-ai/dto/update-transfer-number.dto.ts` | VERIFY/CREATE | Partial update DTO |

---

## Acceptance Criteria

- [ ] `create()` throws 400 if tenant already has 10 active numbers
- [ ] Phone number validated as E.164 format
- [ ] Setting `is_default: true` clears all other defaults in same transaction
- [ ] All queries include `tenant_id` filter — never cross-tenant data
- [ ] `deactivate()` sets `is_active = false`, not hard delete
- [ ] `npm run build` passes with 0 errors
