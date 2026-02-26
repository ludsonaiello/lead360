# Sprint BAS16 — Call Log Controllers (Tenant + Admin)

**Module**: Voice AI
**Sprint**: BAS16
**Depends on**: BAS15 (VoiceCallLogService complete)
**Estimated size**: 2 files, ~120 lines total

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read both controller files completely
- Tenant controller: `tenant_id` from JWT always, never from URL
- Admin controller: can query across tenants — `PlatformAdminGuard` required
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) both call log controllers:
1. `VoiceAiCallLogsController` (tenant) — `/api/v1/voice-ai/call-logs` — own calls only
2. `VoiceAiAdminCallLogsController` (admin) — `/api/v1/system/voice-ai/call-logs` — cross-tenant

---

## Pre-Coding Checklist

- [ ] BAS15 complete (VoiceCallLogService verified)
- [ ] Read `api/src/modules/voice-ai/controllers/tenant/voice-ai-call-logs.controller.ts`
- [ ] Read `api/src/modules/voice-ai/controllers/admin/voice-ai-admin-call-logs.controller.ts`
- [ ] Read `api/src/modules/admin/guards/platform-admin.guard.ts`

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
| `api/src/modules/voice-ai/controllers/tenant/voice-ai-call-logs.controller.ts` | Existing tenant controller |
| `api/src/modules/voice-ai/controllers/admin/voice-ai-admin-call-logs.controller.ts` | Existing admin controller |
| `api/src/modules/admin/guards/platform-admin.guard.ts` | Guard class name |

---

## Task 1: Verify Tenant Call Log Controller

```typescript
@Controller('voice-ai/call-logs')    // → /api/v1/voice-ai/call-logs
@UseGuards(RolesGuard)
export class VoiceAiCallLogsController {

  // GET /api/v1/voice-ai/call-logs
  // Query: ?status=completed&from=2026-01-01&to=2026-01-31&page=1&limit=20
  @Get() @Roles('Owner','Admin','Manager')
  list(@Query() filters: CallLogFiltersDto, @Req() req)

  // GET /api/v1/voice-ai/call-logs/:id
  @Get(':id') @Roles('Owner','Admin','Manager')
  findOne(@Param('id') id: string, @Req() req)

  // GET /api/v1/voice-ai/usage
  @Get('/usage') @Roles('Owner','Admin','Manager')
  getUsage(@Req() req)
}
```

**Note**: `@Get('/usage')` must be declared BEFORE `@Get(':id')` to avoid route conflicts.

---

## Task 2: Verify Admin Call Log Controller

```typescript
@Controller('system/voice-ai/call-logs')
@UseGuards(PlatformAdminGuard)
export class VoiceAiAdminCallLogsController {

  // GET /api/v1/system/voice-ai/call-logs
  // Query: ?tenant_id=xxx&status=completed&from=2026-01-01&page=1
  @Get() listAll(@Query() filters: AdminCallLogFiltersDto)

  // GET /api/v1/system/voice-ai/usage-report
  // Aggregate report across all tenants
  @Get('/usage-report') getUsageReport(@Query() filters: AdminUsageReportFiltersDto)
}
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/controllers/tenant/voice-ai-call-logs.controller.ts` | VERIFY/MODIFY | List, findOne, usage endpoints |
| `api/src/modules/voice-ai/controllers/admin/voice-ai-admin-call-logs.controller.ts` | VERIFY/MODIFY | Cross-tenant list + usage report |

---

## Acceptance Criteria

- [ ] `GET /api/v1/voice-ai/call-logs` returns only the authenticated tenant's calls
- [ ] `GET /api/v1/voice-ai/usage` returns current month usage summary
- [ ] `GET /api/v1/system/voice-ai/call-logs` returns all tenants' calls (admin only)
- [ ] `GET /api/v1/system/voice-ai/usage-report` returns aggregate report
- [ ] Tenant route: 403 if not authenticated tenant user
- [ ] Admin route: 403 if not platform admin
- [ ] `npm run build` passes with 0 errors

---

## Testing

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

TENANT_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contato@honeydo4you.com","password":"978@F32c"}' | jq -r '.access_token')

# Tenant: get own call logs
curl "http://localhost:3000/api/v1/voice-ai/call-logs?page=1&limit=10" \
  -H "Authorization: Bearer $TENANT_TOKEN"

# Tenant: get usage
curl "http://localhost:3000/api/v1/voice-ai/usage" \
  -H "Authorization: Bearer $TENANT_TOKEN"

# Admin: get all call logs
curl "http://localhost:3000/api/v1/system/voice-ai/call-logs?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"

# Admin: usage report
curl "http://localhost:3000/api/v1/system/voice-ai/usage-report" \
  -H "Authorization: Bearer $TOKEN"
```
