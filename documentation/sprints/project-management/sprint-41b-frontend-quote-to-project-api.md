# Sprint 41b — Frontend: Quote-to-Project API Client & Types

**Module:** Project Management
**File:** ./documentation/sprints/project-management/sprint-41b-frontend-quote-to-project-api.md
**Type:** Frontend
**Depends On:** Sprint 41a (backend `quote_id` filter must be working)
**Gate:** STOP — All new types and API functions must compile before Sprint 41c starts
**Estimated Complexity:** Low

---

## Objective

Add the missing frontend TypeScript types and API client functions for creating a project from an accepted quote and for detecting whether a project already exists for a given quote. The backend endpoint `POST /projects/from-quote/:quoteId` already exists — the frontend simply never wired up to it. Sprint 41a added the `quote_id` filter to `GET /projects` — this sprint adds the frontend client to call it.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/app/src/lib/types/projects.ts` — confirm `CreateProjectFromQuoteDto` does NOT exist yet
- [ ] Read `/var/www/lead360.app/app/src/lib/api/projects.ts` — confirm `createProjectFromQuote` does NOT exist yet
- [ ] Read `/var/www/lead360.app/app/src/lib/api/axios.ts` — understand the apiClient import pattern

---

## Dev Server

This sprint modifies ONLY frontend type and API files. No backend dev server needed. Verify with TypeScript compilation only.

---

## Tasks

### Task 41b.1 — Add CreateProjectFromQuoteDto Type

**What:** Add the `CreateProjectFromQuoteDto` interface to the frontend types file.

**File to modify:** `/var/www/lead360.app/app/src/lib/types/projects.ts`

**Add this interface** directly after the existing `CreateProjectDto` interface (after line 250, before `UpdateProjectDto`):

```typescript
export interface CreateProjectFromQuoteDto {
  name?: string;
  description?: string;
  start_date?: string;
  target_completion_date?: string;
  permit_required?: boolean;
  assigned_pm_user_id?: string;
  notes?: string;
  template_id?: string;
}
```

**Key differences from `CreateProjectDto`:**
- `name` is **optional** (defaults to quote.title on backend)
- No `estimated_cost` field (quote-based projects use `contract_value` from `quote.total`)

**Why:** The backend DTO at `api/src/modules/projects/dto/create-project-from-quote.dto.ts` accepts these exact 8 fields — all optional. The frontend type must match exactly.

**Acceptance:**
- [ ] `CreateProjectFromQuoteDto` interface exists in types file
- [ ] All 8 fields match the backend DTO exactly
- [ ] No `estimated_cost` field present
- [ ] `name` is optional (not required)

**Do NOT:** Add any fields not in the backend DTO. Do not modify `CreateProjectDto`.

---

### Task 41b.2 — Add quote_id to ListProjectsParams

**What:** Add the `quote_id` optional field to the existing `ListProjectsParams` interface so the frontend can filter projects by source quote.

**File to modify:** `/var/www/lead360.app/app/src/lib/types/projects.ts`

**Find the `ListProjectsParams` interface** (lines 69-75) and add `quote_id`:

```typescript
export interface ListProjectsParams {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  assigned_pm_user_id?: string;
  search?: string;
  quote_id?: string;
}
```

**Why:** Sprint 41a added `quote_id` as a backend query parameter. The frontend type must include it so `getProjects({ quote_id: '...' })` compiles.

**Acceptance:**
- [ ] `quote_id?: string` added to `ListProjectsParams`
- [ ] No existing fields modified

**Do NOT:** Change the type of any existing field.

---

### Task 41b.3 — Update getProjects to Pass quote_id

**What:** Update the existing `getProjects` function to pass the `quote_id` parameter to the API.

**File to modify:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Find the `getProjects` function** (lines 101-111) and add `quote_id` handling alongside the existing parameters:

Add this line inside the function, after the existing `if (params?.search)` check:

```typescript
  if (params?.quote_id) queryParams.quote_id = params.quote_id;
```

**The updated function should be:**

```typescript
export const getProjects = async (params?: ListProjectsParams): Promise<ListProjectsResponse> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.status) queryParams.status = params.status;
  if (params?.assigned_pm_user_id) queryParams.assigned_pm_user_id = params.assigned_pm_user_id;
  if (params?.search) queryParams.search = params.search;
  if (params?.quote_id) queryParams.quote_id = params.quote_id;

  const { data } = await apiClient.get<ListProjectsResponse>('/projects', { params: queryParams });
  return data;
};
```

**Acceptance:**
- [ ] `quote_id` passed as query parameter when provided
- [ ] No existing parameters removed or changed
- [ ] Existing callers of `getProjects()` unaffected (parameter is optional)

**Do NOT:** Change the function signature or return type.

---

### Task 41b.4 — Add createProjectFromQuote API Function

**What:** Add the API client function that calls `POST /projects/from-quote/:quoteId`.

**File to modify:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Step 1 — Add the import.** In the existing import block at the top of the file (lines 6-47), add `CreateProjectFromQuoteDto` to the import from `@/lib/types/projects`:

Find the line that imports `CreateProjectDto` (line 16) and add `CreateProjectFromQuoteDto` next to it:

```typescript
  CreateProjectDto,
  CreateProjectFromQuoteDto,
```

**Step 2 — Add the function.** Place it directly after the existing `createProject` function (after line 94), before the `getProjects` function:

```typescript
/**
 * Create project from an accepted quote
 * @endpoint POST /projects/from-quote/:quoteId
 * @roles Owner, Admin, Manager
 * @param quoteId - UUID of the quote to convert
 * @param dto - Optional overrides (name, dates, PM, template)
 * @returns Created project with tasks seeded from quote items
 * @throws 400 - Quote status is not approved/started/concluded
 * @throws 404 - Quote not found
 * @throws 409 - A project already exists for this quote
 */
export const createProjectFromQuote = async (
  quoteId: string,
  dto?: CreateProjectFromQuoteDto,
): Promise<Project> => {
  const { data } = await apiClient.post<Project>(`/projects/from-quote/${quoteId}`, dto || {});
  return data;
};
```

**Acceptance:**
- [ ] Function `createProjectFromQuote` exported from `projects.ts`
- [ ] Calls `POST /projects/from-quote/${quoteId}` via `apiClient.post`
- [ ] Returns `Promise<Project>`
- [ ] Accepts optional `CreateProjectFromQuoteDto` parameter
- [ ] `CreateProjectFromQuoteDto` imported in the type import block
- [ ] No other functions or imports modified

**Do NOT:** Modify any existing functions. Do not change the axios client configuration.

---

### Task 41b.5 — Add getProjectTemplates API Function

**What:** Add an API client function to fetch project templates for the template dropdown in the creation modal (Sprint 41c will use this).

**File to modify:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**First, check if a project templates API function already exists in the file.** Search for `project-templates` or `getProjectTemplates`. If it already exists, skip this task.

**If it does NOT exist, add it** at the bottom of the PROJECTS CRUD section (after the `deleteProject` function, before the FINANCIAL SUMMARY comment):

```typescript
/**
 * List active project templates (for dropdown selection)
 * @endpoint GET /project-templates
 * @roles Owner, Admin, Manager
 */
export const getProjectTemplates = async (): Promise<{
  data: Array<{ id: string; name: string; description: string | null; is_active: boolean }>;
  meta: { total: number; page: number; limit: number; totalPages: number };
}> => {
  const { data } = await apiClient.get('/project-templates', {
    params: { is_active: true, limit: 100 },
  });
  return data;
};
```

**IMPORTANT:** The `meta` object uses `totalPages` (camelCase), NOT `total_pages` (snake_case). This matches the existing `PaginationMeta` interface defined in `/app/src/lib/types/projects.ts` line 77-82:

```typescript
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;  // camelCase — NOT total_pages
}
```

**Acceptance:**
- [ ] `getProjectTemplates` function exists (or was already present)
- [ ] Fetches only active templates (`is_active: true`)
- [ ] Returns paginated response with `data` and `meta`
- [ ] `meta.totalPages` is camelCase (matches `PaginationMeta` interface)
- [ ] No existing functions modified

**Do NOT:** Create a separate file for this. Do not modify existing functions. Do not use `total_pages` (snake_case).

---

## Patterns to Apply

### API Client Pattern (from existing codebase — `/app/src/lib/api/projects.ts`)

```typescript
// Import pattern (top of file)
import { apiClient } from './axios';

// Function pattern — all existing functions follow this shape:
export const functionName = async (param: Type): Promise<ReturnType> => {
  const { data } = await apiClient.post<ReturnType>('/endpoint', body);
  return data;
};
```

### Type Definition Pattern (from existing codebase — `/app/src/lib/types/projects.ts`)

```typescript
// All interfaces use optional fields with `?` suffix
// All date fields are ISO date strings (string type)
// All ID fields are string (UUID format)
export interface DtoName {
  field?: string;
}
```

---

## Business Rules Enforced in This Sprint

- BR-QUOTE-PROJECT: Quote must be in status `approved`, `started`, or `concluded` to create a project (enforced by backend, but frontend should be aware)
- BR-QUOTE-UNIQUE: Only one project per quote (backend returns 409 if duplicate attempted)

---

## Integration Points

| Dependency | Import Path | Purpose |
|---|---|---|
| apiClient | `@/lib/api/axios` | HTTP client (already imported in projects.ts) |
| Project type | `@/lib/types/projects` | Return type (already imported) |
| PaginationMeta | `@/lib/types/projects` | Uses `totalPages` (camelCase) |

---

## Acceptance Criteria

- [ ] `CreateProjectFromQuoteDto` interface added to `/app/src/lib/types/projects.ts`
- [ ] `quote_id?: string` added to `ListProjectsParams` in `/app/src/lib/types/projects.ts`
- [ ] `getProjects` updated to pass `quote_id` parameter
- [ ] `createProjectFromQuote(quoteId, dto?)` function added to `/app/src/lib/api/projects.ts`
- [ ] `getProjectTemplates()` function added (or confirmed existing) in `/app/src/lib/api/projects.ts`
- [ ] TypeScript compilation passes: `cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50`
- [ ] No existing code modified or broken
- [ ] No backend code touched

---

## Gate Marker

**STOP** — Verify TypeScript compiles without errors before proceeding to Sprint 41c. Run:
```bash
cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50
```
Must show no errors related to the new types or functions.

---

## Handoff Notes

Sprint 41c will use:
- `createProjectFromQuote(quoteId, dto?)` from `@/lib/api/projects`
- `CreateProjectFromQuoteDto` from `@/lib/types/projects`
- `getProjectTemplates()` from `@/lib/api/projects`

Sprint 41d will use:
- `getProjects({ quote_id: 'uuid' })` from `@/lib/api/projects` — to detect if a project exists for a quote
- The `quote_id` field on `ListProjectsParams`

These must all be importable and type-safe before Sprint 41c begins.
