# Sprint 41b.2 — Verification Gate: Quote-to-Project Types & API

**Module:** Project Management
**File:** `./documentation/sprints/project-management/s41b/sprint_41b_2.md`
**Type:** Frontend Verification (STOP gate — no code changes, verification only)
**Depends On:** Sprint 41b.1 must be fully complete
**Estimated Complexity:** Trivial

---

## Developer Standards

You are a **masterclass-level frontend engineer** — the kind that makes Google, Amazon, and Apple engineers jealous of the quality of your work. This verification sprint ensures every detail is correct before downstream sprints (41c, 41d) begin.

**Critical Warnings:**
- **Never leave the dev server running in the background** when the sprint is complete
- **Never break existing code** — the platform is 85% production-ready and serves real users
- **Read the codebase before touching anything** — verify with surgical precision. Not a single comma may be wrong
- **Do NOT use PM2** — this project does not use PM2. Use `lsof -i :7000` + `kill {PID}` if needed. Never use `pkill -f`
- **Do NOT modify any file in `/var/www/lead360.app/api/`** — you are a frontend agent only
- **Do not rush** — pay attention to every detail: every import, name, file, property, type

---

## Objective

This is a **STOP gate**. Verify that all types and API functions from Sprint 41b.1 are correctly implemented, compile without errors, and will be importable by Sprint 41c (modal component) and Sprint 41d (integration). No code changes should be needed — if something is wrong, fix it surgically.

---

## Verification Steps

### Step 1 — TypeScript Compilation

Run the TypeScript compiler in check mode:

```bash
cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50
```

**Expected:** No errors related to `CreateProjectFromQuoteDto`, `quote_id`, `createProjectFromQuote`, or `getProjectTemplates`. Pre-existing errors in other modules are acceptable — focus ONLY on project-related types.

**If there are errors:** Fix them surgically. Do not refactor or change unrelated code.

---

### Step 2 — Verify `CreateProjectFromQuoteDto` Interface

**Read file:** `/var/www/lead360.app/app/src/lib/types/projects.ts`

**Check ALL of the following:**

| # | Check | Expected |
|---|-------|----------|
| 1 | Interface name | `CreateProjectFromQuoteDto` (exact spelling, PascalCase) |
| 2 | Field count | Exactly 8 fields |
| 3 | `name` | `name?: string` — OPTIONAL (has `?`) |
| 4 | `description` | `description?: string` — OPTIONAL |
| 5 | `start_date` | `start_date?: string` — OPTIONAL |
| 6 | `target_completion_date` | `target_completion_date?: string` — OPTIONAL |
| 7 | `permit_required` | `permit_required?: boolean` — OPTIONAL, type `boolean` |
| 8 | `assigned_pm_user_id` | `assigned_pm_user_id?: string` — OPTIONAL |
| 9 | `notes` | `notes?: string` — OPTIONAL |
| 10 | `template_id` | `template_id?: string` — OPTIONAL |
| 11 | No `estimated_cost` | `estimated_cost` must NOT be present |
| 12 | Exported | `export interface` (not just `interface`) |
| 13 | Position | After `CreateProjectDto`, before `UpdateProjectDto` |

**Cross-reference with backend DTO:**
```
/var/www/lead360.app/api/src/modules/projects/dto/create-project-from-quote.dto.ts
```
Every field name and type must match exactly.

---

### Step 3 — Verify `ListProjectsParams` Has `quote_id`

**Read file:** `/var/www/lead360.app/app/src/lib/types/projects.ts`

**Check:**

| # | Check | Expected |
|---|-------|----------|
| 1 | `quote_id` field exists | `quote_id?: string` |
| 2 | Optional | Has `?` suffix |
| 3 | Type | `string` (UUIDs are strings) |
| 4 | No existing fields changed | `page`, `limit`, `status`, `assigned_pm_user_id`, `search` all unchanged |

---

### Step 4 — Verify `getProjects` Passes `quote_id`

**Read file:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Find the `getProjects` function and check:**

| # | Check | Expected |
|---|-------|----------|
| 1 | `quote_id` handling exists | `if (params?.quote_id) queryParams.quote_id = params.quote_id;` |
| 2 | Position | After `search` handling, before `apiClient.get` call |
| 3 | No existing params removed | `page`, `limit`, `status`, `assigned_pm_user_id`, `search` all still present |
| 4 | Function signature unchanged | `async (params?: ListProjectsParams): Promise<ListProjectsResponse>` |

---

### Step 5 — Verify `createProjectFromQuote` Function

**Read file:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Check:**

| # | Check | Expected |
|---|-------|----------|
| 1 | Function exists | `export const createProjectFromQuote` |
| 2 | Parameter 1 | `quoteId: string` |
| 3 | Parameter 2 | `dto?: CreateProjectFromQuoteDto` (optional) |
| 4 | Return type | `Promise<Project>` |
| 5 | HTTP method | `apiClient.post` |
| 6 | URL | `` `/projects/from-quote/${quoteId}` `` |
| 7 | Body | `dto || {}` (sends empty object when dto is undefined) |
| 8 | Import | `CreateProjectFromQuoteDto` is in the import block at top of file |
| 9 | Position | Between `createProject` and `getProjects` functions |

---

### Step 6 — Verify `getProjectTemplates` Function

**Read file:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Check:**

| # | Check | Expected |
|---|-------|----------|
| 1 | Function exists | `export const getProjectTemplates` |
| 2 | No parameters | `async ()` |
| 3 | URL | `'/project-templates'` (NOT `/settings/project-templates`) |
| 4 | Query params | `{ is_active: true, limit: 100 }` |
| 5 | Return type | Includes `data` array and `meta` with `totalPages` (camelCase) |
| 6 | Position | After `deleteProject`, before `// ========== FINANCIAL SUMMARY ==========` |
| 7 | Does NOT conflict | Not confused with `listChecklistTemplates` (which is `/settings/checklist-templates`) |

---

### Step 7 — Verify Import Consistency

**Read file:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Check the import block (lines 6-47):**

| # | Check | Expected |
|---|-------|----------|
| 1 | `CreateProjectFromQuoteDto` imported | Yes, from `@/lib/types/projects` |
| 2 | Adjacent to `CreateProjectDto` | `CreateProjectDto` on one line, `CreateProjectFromQuoteDto` on the next |
| 3 | No duplicate imports | Each type imported exactly once |
| 4 | No removed imports | All previously imported types still present |

---

### Step 8 — Final TypeScript Compilation

Run the TypeScript compiler one final time:

```bash
cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50
```

**STOP gate:** If there are ANY errors related to the sprint 41b changes, they MUST be fixed before proceeding. Pre-existing errors in unrelated modules are acceptable.

---

### Step 9 — Verify Importability for Downstream Sprints

Confirm that Sprint 41c and 41d will be able to import these:

```typescript
// Sprint 41c will use:
import { createProjectFromQuote } from '@/lib/api/projects';
import { CreateProjectFromQuoteDto } from '@/lib/types/projects';
import { getProjectTemplates } from '@/lib/api/projects';

// Sprint 41d will use:
import { getProjects } from '@/lib/api/projects';  // with quote_id support
import { ListProjectsParams } from '@/lib/types/projects';  // has quote_id field
```

These imports must resolve without error. The `tsc --noEmit` check in Step 8 covers this, but visually confirm the exports exist.

---

## Final Acceptance Criteria

**ALL must be true before marking this sprint complete:**

- [ ] `CreateProjectFromQuoteDto` interface added to `/app/src/lib/types/projects.ts` with exactly 8 optional fields matching the backend DTO
- [ ] `quote_id?: string` added to `ListProjectsParams` in `/app/src/lib/types/projects.ts`
- [ ] `getProjects` updated to pass `quote_id` parameter in `/app/src/lib/api/projects.ts`
- [ ] `createProjectFromQuote(quoteId, dto?)` function added to `/app/src/lib/api/projects.ts`
- [ ] `getProjectTemplates()` function added to `/app/src/lib/api/projects.ts`
- [ ] `CreateProjectFromQuoteDto` imported in the API file's type import block
- [ ] TypeScript compilation passes: `cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50` — no sprint-related errors
- [ ] No existing code modified or broken
- [ ] No backend code touched
- [ ] No new files created (all changes in existing files)
- [ ] Dev server shut down (if started): `lsof -i :7000` returns nothing

---

## STOP Gate

**STOP** — Do NOT proceed to Sprint 41c until ALL acceptance criteria above are verified.

Sprint 41c (modal component) and Sprint 41d (integration) depend on the types and functions created here. If anything is wrong or missing, those sprints will fail.

---

## Handoff Notes for Downstream Sprints

**Sprint 41c will import:**
- `createProjectFromQuote(quoteId, dto?)` from `@/lib/api/projects`
- `CreateProjectFromQuoteDto` from `@/lib/types/projects`
- `getProjectTemplates()` from `@/lib/api/projects`

**Sprint 41d will import:**
- `getProjects({ quote_id: 'uuid' })` from `@/lib/api/projects`
- `ListProjectsParams` (with `quote_id` field) from `@/lib/types/projects`

All of these must be importable and type-safe before Sprint 41c begins.

---

## Dev Server Notes

This verification sprint should NOT require the dev server. Only `tsc --noEmit` is needed. But if you started it:

- **Check if port 7000 is in use:** `lsof -i :7000`
- **Kill by PID:** `kill {PID}` (never `pkill -f`, never PM2)
- **Before marking complete:** `lsof -i :7000` must return nothing
