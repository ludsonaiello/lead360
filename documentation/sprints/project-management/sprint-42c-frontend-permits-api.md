# Sprint 42c — Frontend: Permits + Inspections Types + API Client

**Module:** Project Management
**File:** ./documentation/sprints/project-management/sprint-42c-frontend-permits-api.md
**Type:** Frontend
**Depends On:** Sprint 22/23 (backend permit + inspection endpoints must exist)
**Gate:** STOP — All new types and API functions must compile before Sprint 42d starts
**Estimated Complexity:** Low

---

## Objective

Add the missing frontend TypeScript types and API client functions for permits and inspections. The backend has full CRUD at `projects/:projectId/permits` (Sprint 22) and `projects/:projectId/permits/:permitId/inspections` (Sprint 23). The frontend has zero types or functions for these entities.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/app/src/lib/types/projects.ts` — confirm no `Permit` or `Inspection` type exists
- [ ] Read `/var/www/lead360.app/app/src/lib/api/projects.ts` — confirm no permit/inspection functions exist
- [ ] Read `/var/www/lead360.app/api/documentation/permit_REST_API.md` — permit API contract
- [ ] Read `/var/www/lead360.app/api/documentation/inspection_REST_API.md` — inspection API contract

---

## Dev Server

This sprint modifies ONLY frontend type and API files. No backend dev server needed. Verify with TypeScript compilation only.

---

## Tasks

### Task 42c.1 — Add Permit and Inspection Types

**What:** Add types for permits and inspections to the frontend types file.

**File to modify:** `/var/www/lead360.app/app/src/lib/types/projects.ts`

**Where to add:** After the `ProjectDocument` types (added in Sprint 42a), before any existing section.

```typescript
// ========== PERMITS ==========

export type PermitStatus =
  | 'not_required'
  | 'pending_application'
  | 'submitted'
  | 'approved'
  | 'active'
  | 'failed'
  | 'closed';

export type InspectionResult = 'pass' | 'fail' | 'conditional' | 'pending';

export interface Inspection {
  id: string;
  permit_id: string;
  project_id: string;
  inspection_type: string;
  scheduled_date: string | null;
  inspector_name: string | null;
  result: InspectionResult | null;
  reinspection_required: boolean;
  reinspection_date: string | null;
  notes: string | null;
  inspected_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Permit {
  id: string;
  project_id: string;
  permit_number: string | null;
  permit_type: string;
  status: PermitStatus;
  submitted_date: string | null;
  approved_date: string | null;
  expiry_date: string | null;
  issuing_authority: string | null;
  notes: string | null;
  inspections: Inspection[];
  created_at: string;
  updated_at: string;
}

export interface CreatePermitDto {
  permit_type: string;
  permit_number?: string;
  status?: PermitStatus;
  submitted_date?: string;
  approved_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  notes?: string;
}

export interface UpdatePermitDto {
  permit_type?: string;
  permit_number?: string;
  status?: PermitStatus;
  submitted_date?: string;
  approved_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  notes?: string;
}

export interface CreateInspectionDto {
  inspection_type: string;
  scheduled_date?: string;
  inspector_name?: string;
  result?: InspectionResult;
  reinspection_required?: boolean;
  reinspection_date?: string;
  notes?: string;
  inspected_by_user_id?: string;
}

export interface UpdateInspectionDto {
  inspection_type?: string;
  scheduled_date?: string;
  inspector_name?: string;
  result?: InspectionResult;
  reinspection_required?: boolean;
  reinspection_date?: string;
  notes?: string;
  inspected_by_user_id?: string;
}
```

**All fields match backend API documentation exactly.** Key notes:
- `Permit.inspections` is always an array (empty if no inspections)
- `permit_number` is nullable (not all permits have an assigned number)
- `submitted_date`, `approved_date`, `expiry_date` are `YYYY-MM-DD` strings or `null`
- `Inspection.result` is nullable (can be null if not yet inspected)
- Business rule: if `result` is `fail`, backend auto-sets `reinspection_required` to `true`

**Acceptance:**
- [ ] All types and interfaces exported
- [ ] `PermitStatus` has exactly 7 values
- [ ] `InspectionResult` has exactly 4 values
- [ ] `Permit.inspections` is `Inspection[]`
- [ ] DTOs match backend validation exactly

**Do NOT:** Add fields not in the backend response.

---

### Task 42c.2 — Add Permit API Client Functions

**What:** Add permit CRUD functions.

**File to modify:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Step 1 — Add type imports.** Add to the existing type import block:

```typescript
  Permit,
  PermitStatus,
  CreatePermitDto,
  UpdatePermitDto,
  Inspection,
  CreateInspectionDto,
  UpdateInspectionDto,
```

**Step 2 — Add permit functions.** Place after the document functions (from Sprint 42a):

```typescript
// ========== PERMITS ==========

/**
 * List permits for a project
 * @endpoint GET /projects/:projectId/permits
 * @roles Owner, Admin, Manager
 */
export const getProjectPermits = async (
  projectId: string,
  params?: { status?: PermitStatus },
): Promise<Permit[]> => {
  const queryParams: Record<string, string> = {};
  if (params?.status) queryParams.status = params.status;

  const { data } = await apiClient.get<Permit[]>(
    `/projects/${projectId}/permits`,
    { params: queryParams },
  );
  return data;
};

/**
 * Get a single permit by ID
 * @endpoint GET /projects/:projectId/permits/:id
 * @roles Owner, Admin, Manager
 */
export const getProjectPermitById = async (
  projectId: string,
  permitId: string,
): Promise<Permit> => {
  const { data } = await apiClient.get<Permit>(
    `/projects/${projectId}/permits/${permitId}`,
  );
  return data;
};

/**
 * Create a permit for a project
 * @endpoint POST /projects/:projectId/permits
 * @roles Owner, Admin, Manager
 */
export const createProjectPermit = async (
  projectId: string,
  dto: CreatePermitDto,
): Promise<Permit> => {
  const { data } = await apiClient.post<Permit>(
    `/projects/${projectId}/permits`,
    dto,
  );
  return data;
};

/**
 * Update a permit
 * @endpoint PATCH /projects/:projectId/permits/:id
 * @roles Owner, Admin, Manager
 */
export const updateProjectPermit = async (
  projectId: string,
  permitId: string,
  dto: UpdatePermitDto,
): Promise<Permit> => {
  const { data } = await apiClient.patch<Permit>(
    `/projects/${projectId}/permits/${permitId}`,
    dto,
  );
  return data;
};

/**
 * Delete a permit (hard delete)
 * @endpoint DELETE /projects/:projectId/permits/:id
 * @roles Owner, Admin
 */
export const deleteProjectPermit = async (
  projectId: string,
  permitId: string,
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(
    `/projects/${projectId}/permits/${permitId}`,
  );
  return data;
};
```

**Step 3 — Add inspection functions:**

```typescript
// ========== INSPECTIONS ==========

/**
 * List inspections for a permit
 * @endpoint GET /projects/:projectId/permits/:permitId/inspections
 * @roles Owner, Admin, Manager
 */
export const getPermitInspections = async (
  projectId: string,
  permitId: string,
): Promise<Inspection[]> => {
  const { data } = await apiClient.get<Inspection[]>(
    `/projects/${projectId}/permits/${permitId}/inspections`,
  );
  return data;
};

/**
 * Create an inspection for a permit
 * @endpoint POST /projects/:projectId/permits/:permitId/inspections
 * @roles Owner, Admin, Manager
 */
export const createPermitInspection = async (
  projectId: string,
  permitId: string,
  dto: CreateInspectionDto,
): Promise<Inspection> => {
  const { data } = await apiClient.post<Inspection>(
    `/projects/${projectId}/permits/${permitId}/inspections`,
    dto,
  );
  return data;
};

/**
 * Update an inspection
 * @endpoint PATCH /projects/:projectId/permits/:permitId/inspections/:id
 * @roles Owner, Admin, Manager
 */
export const updatePermitInspection = async (
  projectId: string,
  permitId: string,
  inspectionId: string,
  dto: UpdateInspectionDto,
): Promise<Inspection> => {
  const { data } = await apiClient.patch<Inspection>(
    `/projects/${projectId}/permits/${permitId}/inspections/${inspectionId}`,
    dto,
  );
  return data;
};

/**
 * Delete an inspection (hard delete)
 * @endpoint DELETE /projects/:projectId/permits/:permitId/inspections/:id
 * @roles Owner, Admin
 */
export const deletePermitInspection = async (
  projectId: string,
  permitId: string,
  inspectionId: string,
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(
    `/projects/${projectId}/permits/${permitId}/inspections/${inspectionId}`,
  );
  return data;
};
```

**Important notes:**
- Both `getProjectPermits` and `getPermitInspections` return flat arrays (NOT paginated)
- Permit list supports optional `status` filter
- Inspection endpoints are nested under permits: `/permits/:permitId/inspections`
- Delete endpoints are `Owner, Admin` only (not Manager)

**Acceptance:**
- [ ] 5 permit functions exported (list, getById, create, update, delete)
- [ ] 4 inspection functions exported (list, create, update, delete)
- [ ] All types imported in the type import block
- [ ] No existing functions modified
- [ ] TypeScript compiles

**Do NOT:** Change any existing functions. Do not add pagination — backend returns flat arrays.

---

## Acceptance Criteria

- [ ] All types added to `/app/src/lib/types/projects.ts`
- [ ] 9 API functions added to `/app/src/lib/api/projects.ts`
- [ ] TypeScript compilation passes: `cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50`
- [ ] No existing code modified or broken

---

## Gate Marker

**STOP** — Verify TypeScript compiles before Sprint 42d.

---

## Handoff Notes

Sprint 42d will use all permit/inspection types and API functions from this sprint.
