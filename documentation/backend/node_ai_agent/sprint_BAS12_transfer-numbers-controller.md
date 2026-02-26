# Sprint BAS12 — Transfer Numbers Controller

**Module**: Voice AI
**Sprint**: BAS12
**Depends on**: BAS11 (VoiceTransferNumbersService complete)
**Estimated size**: 1 file, ~100 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-transfer-numbers.controller.ts` completely
- Understand that `tenant_id` always comes from `req.user.tenant_id` — NEVER from URL or body
- Ensure the reorder endpoint exists (PATCH /reorder)
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) `VoiceTransferNumbersController` (tenant-facing) at `/api/v1/voice-ai/transfer-numbers`. Full CRUD plus reorder endpoint.

---

## Pre-Coding Checklist

- [ ] BAS11 complete (VoiceTransferNumbersService verified)
- [ ] Read `api/src/modules/voice-ai/controllers/tenant/voice-transfer-numbers.controller.ts`
- [ ] Read how tenant controllers extract `tenant_id` from JWT

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Tenant login | `contato@honeydo4you.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/controllers/tenant/voice-transfer-numbers.controller.ts` | Existing controller |
| `api/src/modules/voice-ai/services/voice-transfer-numbers.service.ts` | Service methods |

---

## Task 1: Verify Controller Endpoints

```typescript
@Controller('voice-ai/transfer-numbers')   // → /api/v1/voice-ai/transfer-numbers
@UseGuards(RolesGuard)
export class VoiceTransferNumbersController {

  @Get()    @Roles('Owner','Admin','Manager') findAll(@Req() req)
  @Get(':id') @Roles('Owner','Admin','Manager') findOne(@Param('id') id: string, @Req() req)
  @Post()   @Roles('Owner','Admin') create(@Body() dto: CreateTransferNumberDto, @Req() req)
  @Patch(':id') @Roles('Owner','Admin') update(@Param('id') id: string, @Body() dto: UpdateTransferNumberDto, @Req() req)
  @Delete(':id') @Roles('Owner','Admin') deactivate(@Param('id') id: string, @Req() req)

  // PATCH /api/v1/voice-ai/transfer-numbers/reorder
  // Body: { ordered_ids: string[] }
  @Patch('reorder') @Roles('Owner','Admin') reorder(@Body() dto: ReorderDto, @Req() req)
}
```

**Note on route ordering**: `@Patch('reorder')` must be declared BEFORE `@Patch(':id')` in NestJS to avoid route conflicts.

---

## Task 2: ReorderDto

```typescript
export class ReorderDto {
  @IsArray() @IsUUID('4', { each: true }) ordered_ids: string[];
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/controllers/tenant/voice-transfer-numbers.controller.ts` | VERIFY/MODIFY | Full CRUD + reorder |
| `api/src/modules/voice-ai/dto/reorder-transfer-numbers.dto.ts` | CREATE (if missing) | Reorder DTO |

---

## Acceptance Criteria

- [ ] All 6 endpoints work with correct HTTP methods
- [ ] `@Patch('reorder')` declared before `@Patch(':id')` (no route conflict)
- [ ] `tenant_id` always from JWT
- [ ] 400 returned when trying to create more than 10 numbers
- [ ] `npm run build` passes with 0 errors

---

## Testing

```bash
TENANT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contato@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Create transfer number
curl -X POST http://localhost:3000/api/v1/voice-ai/transfer-numbers \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"label":"Sales","phone_number":"+15551234567","is_default":true}'

# List numbers
curl http://localhost:3000/api/v1/voice-ai/transfer-numbers \
  -H "Authorization: Bearer $TENANT_TOKEN"
```
