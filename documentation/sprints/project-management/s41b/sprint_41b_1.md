# Sprint 41b.1 — Add Quote-to-Project Types & API Functions

**Module:** Project Management
**File:** `./documentation/sprints/project-management/s41b/sprint_41b_1.md`
**Type:** Frontend (TypeScript types + API client functions only — NO UI, NO pages, NO components)
**Depends On:** Sprint 41a (backend `quote_id` filter already working)
**Estimated Complexity:** Low

---

## Developer Standards

You are a **masterclass-level frontend engineer** — the kind that makes Google, Amazon, and Apple engineers jealous of the quality of your work. Every line you write is surgical, intentional, and production-grade.

**Critical Warnings:**
- **Never leave the dev server running in the background** when the sprint is complete
- **Never break existing code** — the platform is 85% production-ready and serves real users
- **Read the codebase before touching anything** — implement with surgical precision. Not a single comma may break existing business logic
- **Do NOT use PM2** — this project does not use PM2. Use `lsof -i :7000` + `kill {PID}` to manage the dev server. Never use `pkill -f`
- **Do NOT modify any file in `/var/www/lead360.app/api/`** — you are a frontend agent only
- **Do not rush** — pay attention to every detail: every import, name, file, property, type. When you finish, review if you're not missing anything

---

## Objective

Add the missing frontend TypeScript types and API client functions for:
1. Creating a project from an accepted quote (`POST /projects/from-quote/:quoteId`)
2. Detecting whether a project already exists for a given quote (`GET /projects?quote_id=...`)
3. Fetching project templates for dropdown selection (`GET /project-templates`)

The backend endpoints already exist — the frontend simply never wired up to them. This sprint adds ONLY types and API client functions. No UI, no pages, no components.

---

## Pre-Sprint: Read Before Touching Anything

You MUST read and understand these files COMPLETELY before writing a single line of code:

### File 1 — Frontend Types (where you add the new interface + field)
```
/var/www/lead360.app/app/src/lib/types/projects.ts
```
**Confirm:**
- `CreateProjectFromQuoteDto` does NOT exist yet (it shouldn't — you're adding it)
- `ListProjectsParams` interface exists at approximately lines 69-75 and does NOT have a `quote_id` field yet
- `CreateProjectDto` interface exists at approximately lines 240-250 (you'll add the new interface AFTER it)

### File 2 — Frontend API Client (where you add the new functions + import)
```
/var/www/lead360.app/app/src/lib/api/projects.ts
```
**Confirm:**
- `createProjectFromQuote` function does NOT exist yet
- `getProjectTemplates` function does NOT exist yet
- The import block at the top (lines 6-47) imports types from `@/lib/types/projects`
- `getProjects` function exists at approximately lines 101-111 and does NOT pass `quote_id` yet
- The file uses `apiClient` imported from `./axios`

### File 3 — Axios Client (read-only — understand the import pattern)
```
/var/www/lead360.app/app/src/lib/api/axios.ts
```
**Confirm:** `apiClient` is exported and is an Axios instance with baseURL already set.

### File 4 — Backend DTO (read-only — confirm the exact fields)
```
/var/www/lead360.app/api/src/modules/projects/dto/create-project-from-quote.dto.ts
```
**This is the source of truth for the DTO fields.** The backend DTO has exactly 8 optional fields:
- `name?: string`
- `description?: string`
- `start_date?: string`
- `target_completion_date?: string`
- `permit_required?: boolean`
- `assigned_pm_user_id?: string`
- `notes?: string`
- `template_id?: string`

**Do NOT add any fields not in this DTO. Do NOT add `estimated_cost`.**

---

## Tasks

### Task 41b.1.1 — Add `CreateProjectFromQuoteDto` Interface

**What:** Add the `CreateProjectFromQuoteDto` interface to the frontend types file.

**File to modify:** `/var/www/lead360.app/app/src/lib/types/projects.ts`

**Where to add it:** Directly AFTER the existing `CreateProjectDto` interface (which ends at approximately line 250), BEFORE `UpdateProjectDto` (which starts at approximately line 252). Look for the `// ========== CREATE / UPDATE DTOs ==========` section.

**Add this interface:**

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
- `name` is **optional** (in `CreateProjectDto`, `name` is required)
- No `estimated_cost` field (quote-based projects use `contract_value` derived from `quote.total`)

**Acceptance:**
- [ ] `CreateProjectFromQuoteDto` interface exists in `/app/src/lib/types/projects.ts`
- [ ] All 8 fields match the backend DTO exactly (names, types, optional markers)
- [ ] No `estimated_cost` field present
- [ ] `name` is optional (`name?: string`, NOT `name: string`)
- [ ] Interface is placed between `CreateProjectDto` and `UpdateProjectDto`
- [ ] No existing interfaces modified

**Do NOT:** Add any fields not in the backend DTO. Do not modify `CreateProjectDto` or `UpdateProjectDto`.

---

### Task 41b.1.2 — Add `quote_id` to `ListProjectsParams`

**What:** Add the `quote_id` optional field to the existing `ListProjectsParams` interface so the frontend can filter projects by source quote.

**File to modify:** `/var/www/lead360.app/app/src/lib/types/projects.ts`

**Where:** Find the `ListProjectsParams` interface (approximately lines 69-75). It currently looks like:

```typescript
export interface ListProjectsParams {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  assigned_pm_user_id?: string;
  search?: string;
}
```

**Add `quote_id?: string;` as the LAST field** so it becomes:

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

**Why:** Sprint 41a added `quote_id` as a backend query parameter on `GET /projects`. The frontend type must include it so `getProjects({ quote_id: 'uuid' })` compiles without error.

**Acceptance:**
- [ ] `quote_id?: string` is the last field in `ListProjectsParams`
- [ ] No existing fields modified or removed
- [ ] Type is `string` (not `number` — quote IDs are UUIDs)

**Do NOT:** Change the type or order of any existing field. Do not rename the interface.

---

### Task 41b.1.3 — Update `getProjects` to Pass `quote_id`

**What:** Update the existing `getProjects` function in the API client to pass the `quote_id` parameter to the backend when provided.

**File to modify:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Where:** Find the `getProjects` function (approximately lines 101-111). It currently builds `queryParams` for page, limit, status, assigned_pm_user_id, and search.

**Add this single line** AFTER the existing `if (params?.search)` check and BEFORE the `const { data }` line:

```typescript
  if (params?.quote_id) queryParams.quote_id = params.quote_id;
```

**The updated function should look exactly like this (do NOT replace the whole function — just add the one line):**

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
- [ ] `quote_id` is passed as a query parameter when provided
- [ ] The line is placed after `search` and before the API call
- [ ] No existing parameters removed or changed
- [ ] Function signature and return type unchanged
- [ ] Existing callers of `getProjects()` are unaffected (new parameter is optional)

**Do NOT:** Change the function signature, return type, or any existing parameter handling.

---

### Task 41b.1.4 — Add `createProjectFromQuote` API Function

**What:** Add the API client function that calls `POST /projects/from-quote/:quoteId`.

**File to modify:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Step 1 — Update the import block.** Find the type import block at the top of the file (lines 6-47). Find the line that imports `CreateProjectDto` (approximately line 16) and add `CreateProjectFromQuoteDto` on the next line:

Change:
```typescript
  CreateProjectDto,
```

To:
```typescript
  CreateProjectDto,
  CreateProjectFromQuoteDto,
```

**Step 2 — Add the function.** Place it directly AFTER the existing `createProject` function (which ends at approximately line 94) and BEFORE the `getProjects` function (which starts at approximately line 101). Look for the `// ========== PROJECTS CRUD ==========` section.

**Add this function:**

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
- [ ] `CreateProjectFromQuoteDto` is added to the type import block (next to `CreateProjectDto`)
- [ ] Function `createProjectFromQuote` is exported from the file
- [ ] Function calls `POST /projects/from-quote/${quoteId}` via `apiClient.post`
- [ ] Returns `Promise<Project>`
- [ ] Accepts optional `CreateProjectFromQuoteDto` parameter
- [ ] Sends empty object `{}` when dto is undefined (not `undefined` — backend expects a body)
- [ ] Function is placed between `createProject` and `getProjects`
- [ ] JSDoc comment includes error codes (400, 404, 409)
- [ ] No existing functions modified

**Do NOT:** Modify `createProject` or any other existing function. Do not change the axios client configuration.

---

### Task 41b.1.5 — Add `getProjectTemplates` API Function

**What:** Add an API client function to fetch project templates for the template dropdown in the creation modal (Sprint 41c will use this).

**File to modify:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**First — confirm this function does NOT already exist.** Search the file for `project-templates` or `getProjectTemplates`. As of the last codebase read, it does NOT exist (the file has `listChecklistTemplates` for checklist templates at `/settings/checklist-templates`, but NO function for project templates at `/project-templates`).

**Where to add it:** At the bottom of the `// ========== PROJECTS CRUD ==========` section, AFTER the `deleteProject` function (which ends at approximately line 141) and BEFORE the `// ========== FINANCIAL SUMMARY ==========` comment (approximately line 143).

**Add this function:**

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

**IMPORTANT DETAILS:**
- The route is `/project-templates` (NOT `/settings/project-templates`, NOT `/projects/templates`)
- The backend controller is at `api/src/modules/projects/controllers/project-template.controller.ts` with `@Controller('project-templates')`
- The `meta` object uses `totalPages` (camelCase), NOT `total_pages` (snake_case) — this matches the existing `PaginationMeta` interface used throughout the codebase
- Fetches only active templates (`is_active: true`) with a high limit (100) for dropdown use
- The inline type matches the backend's actual response shape

**Acceptance:**
- [ ] `getProjectTemplates` function exists and is exported
- [ ] Calls `GET /project-templates` (correct route)
- [ ] Passes `{ is_active: true, limit: 100 }` as query params
- [ ] Return type includes `data` array and `meta` object
- [ ] `meta.totalPages` is camelCase (NOT `total_pages`)
- [ ] Function is placed in the PROJECTS CRUD section after `deleteProject`
- [ ] No existing functions modified

**Do NOT:** Create a separate file for this. Do not modify existing functions. Do not use `total_pages` (snake_case). Do not confuse this with the checklist templates endpoint (`/settings/checklist-templates`).

---

## Post-Implementation Review

After completing all 5 tasks, review your work:

1. **Open** `/var/www/lead360.app/app/src/lib/types/projects.ts` and verify:
   - `CreateProjectFromQuoteDto` exists with exactly 8 optional fields
   - `ListProjectsParams` has `quote_id?: string` as its last field
   - No other interfaces were modified

2. **Open** `/var/www/lead360.app/app/src/lib/api/projects.ts` and verify:
   - `CreateProjectFromQuoteDto` is in the import block
   - `createProjectFromQuote` function exists between `createProject` and `getProjects`
   - `getProjectTemplates` function exists between `deleteProject` and the financial summary section
   - `getProjects` now passes `quote_id` when provided
   - No other functions were modified
   - No other imports were added or removed

3. **Run TypeScript compilation check:**
   ```bash
   cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50
   ```
   Must show NO errors related to the new types or functions.

---

## Dev Server Notes

This sprint modifies ONLY type definitions and API client functions — no UI compilation needed. You only need the TypeScript compiler check (`tsc --noEmit`), not the full dev server. However, if you do start the dev server:

- **Check if port 7000 is in use:** `lsof -i :7000`
- **Kill by PID:** `kill {PID}` (never `pkill -f`, never PM2)
- **Start:** `cd /var/www/lead360.app/app && npm run dev`
- **Before marking complete:** `lsof -i :7000` must return nothing

---

## What You Do NOT Do In This Sprint

- Create any pages, components, or UI elements
- Modify any backend files (`/api/` folder is off-limits)
- Add any npm dependencies
- Create new files (all changes go in existing files)
- Modify any existing types or functions (only ADD new ones + one line to `getProjects`)
- Add `estimated_cost` to `CreateProjectFromQuoteDto`
- Use `total_pages` instead of `totalPages`
- Use route `/settings/project-templates` (correct route is `/project-templates`)
