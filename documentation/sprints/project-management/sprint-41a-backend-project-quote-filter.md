# Sprint 41a — Backend: Add quote_id Filter to Projects List API

**Module:** Project Management
**File:** ./documentation/sprints/project-management/sprint-41a-backend-project-quote-filter.md
**Type:** Backend
**Depends On:** Sprint 08 (project API must exist)
**Gate:** STOP — `GET /projects?quote_id={uuid}` must return filtered results before Sprint 41b starts
**Estimated Complexity:** Low

---

## Objective

Add `quote_id` as an optional query parameter to the existing `GET /projects` endpoint. This tiny backend change is required because the frontend needs to check whether a project already exists for a given quote — and the current API provides no way to do this. The quote API response does not include project data, and the projects list does not support filtering by `quote_id`. Without this filter, the frontend cannot determine whether to show "Create Project" or "View Project" on the quote detail page.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/api/src/modules/projects/controllers/project.controller.ts` — lines 85-113 (the `findAll` endpoint)
- [ ] Read `/var/www/lead360.app/api/src/modules/projects/services/project.service.ts` — lines 339-426 (the `findAll` method)
- [ ] Confirm `quote_id` is NOT already a query parameter

---

## Dev Server

CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

START the dev server:
  cd /var/www/lead360.app/api && npm run start:dev

WAIT — the server takes 60 to 120 seconds to compile and become ready.
Do NOT attempt to hit any endpoint until the health check passes:
  curl -s http://localhost:8000/health   ← must return 200 before proceeding

Keep retrying the health check every 10 seconds until it responds.

KEEP the server running for the entire duration of the sprint.
Do NOT stop and restart between tests — keep it open.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing

---

## Tasks

### Task 41a.1 — Add quote_id Query Parameter to Controller

**What:** Add `quote_id` as an optional query parameter to the `GET /projects` endpoint.

**File to modify:** `/var/www/lead360.app/api/src/modules/projects/controllers/project.controller.ts`

**Location:** The `findAll` method, currently at lines 88-113.

**Changes (3 additions):**

1. **Add Swagger documentation** — insert after the existing `@ApiQuery` for `search` (line 96):

```typescript
  @ApiQuery({ name: 'quote_id', required: false, description: 'Filter by source quote ID (UUID)' })
```

2. **Add query parameter** — insert after the existing `@Query('search')` parameter (line 104):

```typescript
    @Query('quote_id') quote_id?: string,
```

3. **Pass to service** — add `quote_id` to the object passed to `findAll` (inside the object at line 106-112):

```typescript
      quote_id,
```

**The resulting method signature should be:**

```typescript
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('assigned_pm_user_id') assigned_pm_user_id?: string,
    @Query('search') search?: string,
    @Query('quote_id') quote_id?: string,
  ) {
    return this.projectService.findAll(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status,
      assigned_pm_user_id,
      search,
      quote_id,
    });
  }
```

**Acceptance:**
- [ ] `quote_id` appears as `@ApiQuery` decorator
- [ ] `quote_id` appears as `@Query` parameter
- [ ] `quote_id` is passed to service in the query object

**Do NOT:** Change any existing parameters. Do not add validation (UUIDs from frontend are already validated by the caller context; invalid UUIDs simply return empty results).

---

### Task 41a.2 — Add quote_id Filter to Service

**What:** Add `quote_id` filtering logic to the `findAll` method in the project service.

**File to modify:** `/var/www/lead360.app/api/src/modules/projects/services/project.service.ts`

**Change 1 — Update the interface.** Find `interface ListProjectsQuery` (lines 19-25) and add `quote_id`:

```typescript
interface ListProjectsQuery {
  page?: number;
  limit?: number;
  status?: string;
  assigned_pm_user_id?: string;
  search?: string;
  quote_id?: string;
}
```

**Change 2 — Add filter to where clause.** In the `findAll` method (line 339+), after the `search` filter block (after line 361), add:

```typescript
    if (query.quote_id) {
      where.quote_id = query.quote_id;
    }
```

This goes after the `if (query.search)` block and before the `const [projects, total]` line.

**Why this works:** The `project` table already has a `quote_id` column (FK to `quote.id`). Prisma supports direct equality filtering on it. Combined with the existing `tenant_id` filter in the `where` object, this ensures tenant isolation is maintained.

**Acceptance:**
- [ ] `quote_id` added to `ListProjectsQuery` interface
- [ ] `where.quote_id = query.quote_id` added to filter logic
- [ ] Filter only applied when `quote_id` is provided (existing queries unaffected)

**Do NOT:** Add an index for this — the `quote_id` column already has an FK index from the Prisma schema.

---

### Task 41a.3 — Verify the Filter Works

**What:** Test the new filter with curl.

**Steps:**

1. First, find an existing project that was created from a quote (or create one via the existing endpoint):

```bash
# Get a list of projects and find one with a non-null quote_id
curl -s http://localhost:8000/projects?limit=5 \
  -H "Authorization: Bearer $(curl -s http://localhost:8000/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' | \
    jq -r '.access_token')" | jq '.data[] | {id, quote_id, name}'
```

2. If a project with a `quote_id` is found, test the filter:

```bash
# Replace {QUOTE_ID} with the actual quote_id from step 1
curl -s "http://localhost:8000/projects?quote_id={QUOTE_ID}" \
  -H "Authorization: Bearer {TOKEN}" | jq '.meta.total'
```

Expected: Returns exactly the project(s) linked to that quote.

3. Test with a non-existent quote_id:

```bash
curl -s "http://localhost:8000/projects?quote_id=00000000-0000-0000-0000-000000000000" \
  -H "Authorization: Bearer {TOKEN}" | jq '.meta.total'
```

Expected: Returns `0`.

4. Test that existing queries still work (no regression):

```bash
curl -s "http://localhost:8000/projects?limit=5" \
  -H "Authorization: Bearer {TOKEN}" | jq '.meta.total'
```

Expected: Returns the same count as before.

**Acceptance:**
- [ ] `GET /projects?quote_id={uuid}` returns only the project linked to that quote
- [ ] `GET /projects?quote_id={non-existent}` returns empty data with total: 0
- [ ] `GET /projects` (without quote_id) still works as before
- [ ] All existing query parameters still work alongside quote_id

**Do NOT:** Skip the verification. This filter is the foundation for the entire frontend integration.

---

## Patterns to Apply

### Multi-Tenant Enforcement

The existing `findAll` method already sets `where.tenant_id = tenantId` (line 344-346). Adding `where.quote_id` does NOT bypass tenant isolation — Prisma generates `WHERE tenant_id = ? AND quote_id = ?`.

### Existing Filter Pattern

```typescript
// Existing pattern (lines 348-361 of project.service.ts):
if (query.status) {
  where.status = query.status;
}
if (query.assigned_pm_user_id) {
  where.assigned_pm_user_id = query.assigned_pm_user_id;
}
// NEW filter follows the same pattern:
if (query.quote_id) {
  where.quote_id = query.quote_id;
}
```

---

## Business Rules Enforced in This Sprint

- BR-TENANT-ISOLATION: `quote_id` filter is always combined with `tenant_id` (enforced by existing code)
- BR-NO-SCHEMA-CHANGE: No migration needed — `quote_id` column already exists on `project` table

---

## Integration Points

| Dependency | Import Path | Purpose |
|---|---|---|
| PrismaService | Already injected in ProjectService | Query execution |

---

## Acceptance Criteria

- [ ] `GET /projects?quote_id={uuid}` returns filtered results
- [ ] No database migration required
- [ ] No existing query parameters broken
- [ ] Tenant isolation maintained
- [ ] Swagger docs updated (new query parameter visible)
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — The endpoint `GET /projects?quote_id={uuid}` must return correct filtered results before Sprint 41b starts. Verify with curl as described in Task 41a.3.

---

## Handoff Notes

Sprint 41b (frontend API client) will use this filter:
- Frontend `ListProjectsParams` type needs `quote_id?: string` added
- Frontend `getProjects({ quote_id: 'uuid' })` will call `GET /projects?quote_id=uuid`
- Sprint 41d will use this to detect whether a project exists for a given quote
