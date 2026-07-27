# Sprint 10 — Break DTOs + Service Methods + Controller Routes (3 Endpoints)
**Module:** time-clock
**File:** ./documentation/sprints/clockin_backend/sprint_10.md
**Type:** Backend — CRUD
**Depends On:** Sprint 9
**Gate:** NONE
**Estimated Complexity:** Low

---

## Code Quality Standard

> You are a **Google / Amazon / Apple senior-level engineer**. Every file you produce must be production-grade: clean, safe, fully typed, zero lint errors, zero runtime errors. No TODO comments, no placeholder code, no shortcuts. Review your own output as if submitting a PR to a FAANG codebase.

---

## Objective

Implement the **BreakEntryService** with 3 methods (start break, end break, list breaks) and wire them to 3 controller endpoints. Breaks are sub-records of a clock session. Only one break can be active (ended_at IS NULL) per session at a time. Starting a break sets the session status to `on_break`; ending a break returns it to `active`. Auto-end on clock-out is already handled in Sprint 9's `clockOut()` method.

---

## Pre-Sprint Checklist
- [ ] Verify Sprint 9 is complete (clock-in/out cycle works, all 8 session endpoints respond)
- [ ] Read `api/src/modules/time-clock/services/clock-session.service.ts` — understand session query patterns and session status transitions
- [ ] Read `api/src/modules/time-clock/controllers/clock-session.controller.ts` — understand the route structure and existing endpoint order
- [ ] Read `api/prisma/schema.prisma` — verify `break_entry` model exists with fields: `id`, `tenant_id`, `clock_session_id`, `break_type`, `break_label`, `started_at`, `ended_at`, `duration_minutes`
- [ ] Read `api/src/modules/time-clock/time-clock.module.ts` — understand current providers/controllers
- [ ] Read `api/src/modules/time-clock/dto/clock-session.dto.ts` — check if `StartBreakDto` already exists from a prior sprint

---

## Environment

- **This project does NOT use PM2. Do not reference or run any PM2 command.**
- **Database credentials**: Read from `.env` file (`DATABASE_URL`). Never hardcode credentials.
- **Dev server runs in watch mode**: `npm run start:dev` (NestJS hot-reload)
- **API prefix**: `api/v1` — all endpoints are prefixed automatically
- **Port**: 8000
- **Tenant ID**: Always extracted from JWT via `@TenantId()` decorator. Never accept tenant_id from request body.

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   <- must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT -- the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   <- must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests -- keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   <- must return nothing
```

---

## Test Credentials

- **Admin login**: `ludsonaiello@gmail.com` / `978@F32c`
- Use this to obtain a JWT Bearer token for all authenticated endpoint tests.

---

## Tasks

### Task 1 — StartBreakDto

**What:** Create `api/src/modules/time-clock/dto/break-entry.dto.ts` (or add to an existing break DTO file).

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, MaxLength } from 'class-validator';

export enum BreakTypeEnum {
  PAID = 'paid',
  UNPAID = 'unpaid',
}

export class StartBreakDto {
  @ApiPropertyOptional({
    description: 'Break type — paid breaks do not reduce total worked time',
    enum: BreakTypeEnum,
    default: BreakTypeEnum.UNPAID,
  })
  @IsOptional()
  @IsEnum(BreakTypeEnum)
  break_type?: BreakTypeEnum;

  @ApiPropertyOptional({
    description: 'Break label (e.g. Lunch, Rest, Coffee)',
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  break_label?: string;
}
```

**Rules:**
- `break_type` defaults to `unpaid` if not provided.
- `break_label` is purely informational — not used in any calculations.
- No body is required for the end-break endpoint.
- No DTO is needed for the list-breaks endpoint (it uses the session ID from the URL param).

---

### Task 2 — BreakEntryService

**What:** Create `api/src/modules/time-clock/services/break-entry.service.ts`

**Constructor dependencies:**
- `PrismaService` (from `../../../core/database/prisma.service`)

---

#### Method: `startBreak(tenantId: string, userId: string, sessionId: string, dto: StartBreakDto, userRoles: string[])`

**Execution order — STOP on first failure:**

**Step 1 — Find the session:**
```
Find clock_session where:
  id = sessionId
  AND tenant_id = tenantId

If not found: throw NotFoundException("Clock session not found")
```

**Step 2 — Verify session status:**
```
If session.status !== 'active':
  throw BadRequestException("Can only start a break on an active session")
```

**Step 3 — Ownership check:**
```
Load the session's employee_profile (or use include in Step 1).
If employee_profile.user_id !== userId:
  If user does NOT have 'Owner' or 'Admin' in their roles:
    throw ForbiddenException("You can only manage breaks on your own sessions")
```

**Step 4 — Check no active break already exists (BR-007B / BR-016):**
```
Query break_entry where:
  clock_session_id = sessionId
  AND ended_at IS NULL
  AND tenant_id = tenantId

If found: throw ConflictException("A break is already active.")
```

**Step 5 — Create break_entry:**
```
prisma.break_entry.create({
  data: {
    tenant_id: tenantId,
    clock_session_id: sessionId,
    break_type: dto.break_type ?? 'unpaid',
    break_label: dto.break_label ?? null,
    started_at: new Date(),
  },
})
```

**Step 6 — Update session status:**
```
prisma.clock_session.update({
  where: { id: sessionId },
  data: { status: 'on_break' },
})
```

**Step 7 — Return the created break_entry.**

---

#### Method: `endBreak(tenantId: string, userId: string, sessionId: string, userRoles: string[])`

**Execution order — STOP on first failure:**

**Step 1 — Find the session:**
```
Find clock_session where:
  id = sessionId
  AND tenant_id = tenantId

If not found: throw NotFoundException("Clock session not found")
```

**Step 2 — Ownership check:**
```
Same ownership check as startBreak:
  employee_profile.user_id must === userId, unless user has Owner/Admin role.
  If not: throw ForbiddenException("You can only manage breaks on your own sessions")
```

**Step 3 — Find active break:**
```
Find break_entry where:
  clock_session_id = sessionId
  AND ended_at IS NULL
  AND tenant_id = tenantId

If not found: throw NotFoundException("No active break found")
```

**Step 4 — End the break:**
```
const ended_at = new Date();
const duration_minutes = Math.floor(
  (ended_at.getTime() - new Date(breakEntry.started_at).getTime()) / 60000
);

prisma.break_entry.update({
  where: { id: breakEntry.id },
  data: {
    ended_at,
    duration_minutes: Math.max(duration_minutes, 0),
  },
})
```

**Step 5 — Update session status back to active:**
```
prisma.clock_session.update({
  where: { id: sessionId },
  data: { status: 'active' },
})
```

**Step 6 — Return the updated break_entry.**

---

#### Method: `getBreaks(tenantId: string, sessionId: string)`

**Logic:**
1. Verify session exists:
   ```
   Find clock_session where id = sessionId AND tenant_id = tenantId
   If not found: throw NotFoundException("Clock session not found")
   ```
2. Fetch all break_entries:
   ```
   Find many break_entry where:
     clock_session_id = sessionId
     AND tenant_id = tenantId
   Order by: started_at ASC
   ```
3. Return `{ data: [...] }`

---

### Task 3 — Controller Routes

**What:** Add 3 break endpoints. These can be added to the existing `ClockSessionController` (since breaks are sub-resources of sessions) OR created in a separate `BreakEntryController`. Either approach is acceptable — choose based on the existing codebase patterns.

**If adding to ClockSessionController:** Place these routes AFTER the existing session routes but BEFORE the `/:id` param route.

**If creating a separate BreakEntryController:**
```typescript
@ApiTags('Time Clock - Breaks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-clock/sessions')
```

**Endpoint Specifications:**

#### Endpoint 1: POST /sessions/:id/breaks/start
```
@Post(':id/breaks/start')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'Start a break on an active clock session' })
@ApiParam({ name: 'id', description: 'Clock session ID' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string; roles: string[] }
  @Param('id') sessionId: string
  @Body() dto: StartBreakDto

Calls: BreakEntryService.startBreak(tenantId, user.id, sessionId, dto, user.roles)
Returns: 201 with created break_entry
Errors: 404 (session not found), 400 (not active), 403 (not owner), 409 (break already active)
```

#### Endpoint 2: POST /sessions/:id/breaks/end
```
@Post(':id/breaks/end')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'End the active break on a clock session' })
@ApiParam({ name: 'id', description: 'Clock session ID' })

Parameters:
  @TenantId() tenantId: string
  @CurrentUser() user: { id: string; roles: string[] }
  @Param('id') sessionId: string

No request body required.

Calls: BreakEntryService.endBreak(tenantId, user.id, sessionId, user.roles)
Returns: 200 with updated break_entry (ended_at and duration_minutes populated)
Errors: 404 (session not found or no active break), 403 (not owner)
```

#### Endpoint 3: GET /sessions/:id/breaks
```
@Get(':id/breaks')
@Roles('Owner', 'Admin', 'Project Manager', 'Employee')
@ApiOperation({ summary: 'List all breaks for a clock session' })
@ApiParam({ name: 'id', description: 'Clock session ID' })

Parameters:
  @TenantId() tenantId: string
  @Param('id') sessionId: string

Calls: BreakEntryService.getBreaks(tenantId, sessionId)
Returns: 200 with { data: [...] } ordered by started_at ASC
Errors: 404 (session not found)
```

**IMPORTANT Route Ordering Note:**
If these endpoints are added to `ClockSessionController`, the routes `/:id/breaks/start`, `/:id/breaks/end`, and `/:id/breaks` use the `:id` param followed by a static segment (`breaks`). NestJS handles this correctly because `breaks/start`, `breaks/end`, and `breaks` are more specific than a bare `:id`. However, ensure the break routes are declared BEFORE the `GET /:id` route in the controller to avoid any ambiguity.

---

### Task 4 — Register in Module

**What:** Open `api/src/modules/time-clock/time-clock.module.ts` and:
1. Import `BreakEntryService` into the `providers` array.
2. If a separate `BreakEntryController` was created, add it to the `controllers` array.
3. Verify the module compiles without errors.

---

### Task 5 — End-to-End Testing

**What:** Test the full break lifecycle using curl.

```bash
# 1. Login to get JWT token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# 2. Clock in to create an active session
CLOCK_IN=$(curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"latitude":40.7128,"longitude":-74.006}')
echo "$CLOCK_IN" | jq .
SESSION_ID=$(echo "$CLOCK_IN" | jq -r '.id')

# 3. Start a break (unpaid lunch)
curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID/breaks/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"break_type":"unpaid","break_label":"Lunch"}' | jq .

# 4. Verify session status is now 'on_break'
curl -s "http://localhost:8000/api/v1/time-clock/sessions/me/active" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.status'

# 5. Try to start another break (should return 409)
curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID/breaks/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"break_type":"paid","break_label":"Coffee"}' | jq .

# 6. End the break
curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID/breaks/end" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 7. Verify session status is back to 'active'
curl -s "http://localhost:8000/api/v1/time-clock/sessions/me/active" \
  -H "Authorization: Bearer $TOKEN" | jq '.data.status'

# 8. Start a second break (paid coffee)
curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID/breaks/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"break_type":"paid","break_label":"Coffee"}' | jq .

# 9. List all breaks (should show 2 — one ended, one active)
curl -s "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID/breaks" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 10. Clock out (should auto-end the active break)
curl -s -X POST http://localhost:8000/api/v1/time-clock/sessions/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{}' | jq .

# 11. List breaks again (all should have ended_at and duration_minutes)
curl -s "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID/breaks" \
  -H "Authorization: Bearer $TOKEN" | jq .

# 12. Try to start a break on the completed session (should return 400)
curl -s -X POST "http://localhost:8000/api/v1/time-clock/sessions/$SESSION_ID/breaks/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"break_type":"unpaid"}' | jq .
```

**Expected results:**
- Step 3: 201 with break_entry (break_type='unpaid', break_label='Lunch', ended_at=null)
- Step 4: `"on_break"`
- Step 5: 409 — "A break is already active"
- Step 6: 200 with break_entry (ended_at populated, duration_minutes > 0)
- Step 7: `"active"`
- Step 8: 201 with new break_entry (break_type='paid')
- Step 9: 200 with `{ data: [break1, break2] }` — break1 ended, break2 active
- Step 10: 200 with completed session (total_worked_minutes subtracts only unpaid break)
- Step 11: 200 with all breaks ended
- Step 12: 400 — "Can only start a break on an active session"

---

## Acceptance Criteria

- [ ] `StartBreakDto` exists with `break_type` (enum: paid/unpaid, default unpaid) and `break_label` (string, max 50) validators
- [ ] `BreakEntryService` implements `startBreak`, `endBreak`, `getBreaks`
- [ ] `startBreak` verifies session is 'active' before allowing break start
- [ ] `startBreak` enforces ownership check (own session or Owner/Admin role)
- [ ] `startBreak` rejects if a break is already active (409)
- [ ] `startBreak` sets session status to 'on_break'
- [ ] `endBreak` calculates `duration_minutes` correctly (floor division, min 0)
- [ ] `endBreak` sets session status back to 'active'
- [ ] `getBreaks` returns all breaks for a session ordered by `started_at ASC`
- [ ] All 3 endpoints respond with correct status codes
- [ ] All Prisma queries include `tenant_id` filter
- [ ] Module compiles without errors
- [ ] All endpoints tested and return expected responses
- [ ] Dev server is shut down after testing

---

## Handoff Notes

**For Sprint 11 (Manual Edit):**
- Break entries are now fully managed. The manual edit service does NOT need to edit break entries directly — it only edits clock_session fields (clock_in_at, clock_out_at, project_id, task_id, notes).
- If clock_in_at or clock_out_at is edited, total_worked_minutes must be recalculated. The recalculation must still subtract unpaid break durations (query break_entries for the session).

**For Sprint 9 clockOut() verification:**
- Sprint 9's `clockOut()` already handles auto-ending active breaks. Sprint 10's `endBreak()` is for explicit manual break-ending by the employee.
- Both methods use the same calculation: `duration_minutes = Math.floor((ended_at - started_at) / 60000)`.
