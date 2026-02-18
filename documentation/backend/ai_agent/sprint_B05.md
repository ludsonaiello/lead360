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
import { IsString, IsIn, IsOptional, IsBoolean, IsNotEmpty, IsInt, MaxLength, Min, Matches } from 'class-validator';

export class CreateTransferNumberDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  label: string;  // e.g. "Sales", "Emergency", "Main Office"

  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone must be in E.164 format (+15551234567)' })
  phone_number: string;

  @IsOptional()
  @IsString()
  @IsIn(['primary', 'overflow', 'after_hours', 'emergency'])
  transfer_type?: string;  // default: 'primary'

  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @IsOptional()
  @IsString()
  available_hours?: string;  // JSON: {"mon":[["09:00","17:00"]],...} — null means always available

  @IsOptional()
  @IsInt()
  @Min(0)
  display_order?: number;  // sort order in UI; lower = higher priority
}
```

### `update-transfer-number.dto.ts`

PartialType of CreateTransferNumberDto.

### `reorder-transfer-numbers.dto.ts`

```typescript
import { IsArray, IsString, IsInt, IsNotEmpty, Min, ValidateNested, ArrayMinSize, ArrayMaxSize } from 'class-validator';
import { Type } from 'class-transformer';

export class ReorderItemDto {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsInt()
  @Min(0)
  display_order: number;
}

export class ReorderTransferNumbersDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
```

---

## Task 2: Transfer Numbers Service

`voice-transfer-numbers.service.ts`:

```typescript
@Injectable()
export class VoiceTransferNumbersService {
  private readonly MAX_TRANSFER_NUMBERS = 10;

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<tenant_voice_transfer_number[]>
  // ORDER BY display_order ASC, created_at ASC

  async create(tenantId: string, dto: CreateTransferNumberDto): Promise<tenant_voice_transfer_number>
  // Throws BadRequestException if count >= 10
  // If is_default: true, unset previous default first (use transaction)

  async update(tenantId: string, id: string, dto: UpdateTransferNumberDto): Promise<tenant_voice_transfer_number>
  // Throws NotFoundException if not found or wrong tenant
  // If is_default: true, unset previous default first

  async delete(tenantId: string, id: string): Promise<void>
  // Throws NotFoundException if not found or wrong tenant

  async reorder(tenantId: string, items: ReorderItemDto[]): Promise<tenant_voice_transfer_number[]>
  // Bulk-update display_order for multiple transfer numbers in a single transaction
  // Verify ALL ids belong to tenant before updating (throw BadRequestException if any mismatch)
  // Use prisma.$transaction([...]) with individual updates for each item
  // Return updated list ordered by display_order ASC

  private async ensureSingleDefault(tenantId: string, tx: Prisma.TransactionClient): Promise<void>
  // Sets all transfer numbers for tenant to is_default=false
}
```

---

## Task 3: Controller

`controllers/tenant/voice-transfer-numbers.controller.ts`:

```
GET    /api/v1/voice-ai/transfer-numbers          → findAll(req.user.tenant_id)
POST   /api/v1/voice-ai/transfer-numbers          → create(req.user.tenant_id, dto)
POST   /api/v1/voice-ai/transfer-numbers/reorder  → reorder(req.user.tenant_id, dto.items)
PATCH  /api/v1/voice-ai/transfer-numbers/:id      → update(req.user.tenant_id, id, dto)
DELETE /api/v1/voice-ai/transfer-numbers/:id      → delete(req.user.tenant_id, id)
```

⚠️ **CRITICAL ROUTE ORDER**: The `/reorder` static route MUST be declared BEFORE `/:id` in the
controller class. If `/:id` comes first, NestJS will match `POST /reorder` as `/:id` with
`id = "reorder"` and throw a 404 or NotFoundException.

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
- [ ] `POST /reorder` bulk-updates `display_order` for multiple numbers in one transaction
- [ ] `POST /reorder` rejects any IDs not belonging to the tenant (BadRequestException)
- [ ] `POST /reorder` returns full updated list ordered by `display_order` ASC
- [ ] `/reorder` route is declared BEFORE `/:id` in the controller (avoids NestJS route conflict)
- [ ] All operations are tenant-isolated (can't access other tenant's numbers)
- [ ] `transfer_type`, `description`, `available_hours`, `display_order` fields accepted and persisted
- [ ] `findAll` returns numbers ordered by `display_order` ASC
- [ ] Context builder `buildContext()` now includes transfer_numbers array with `transfer_type` and `available_hours`
- [ ] `npm run build` passes
