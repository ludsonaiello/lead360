# Sprint 42a — Frontend: Documents Types + API Client

**Module:** Project Management
**File:** ./documentation/sprints/project-management/sprint-42a-frontend-documents-api.md
**Type:** Frontend
**Depends On:** Sprint 09 (backend document endpoints must exist)
**Gate:** STOP — All new types and API functions must compile before Sprint 42b starts
**Estimated Complexity:** Low

---

## Objective

Add the missing frontend TypeScript types and API client functions for project documents. The backend endpoints at `POST/GET/DELETE /projects/:projectId/documents` already exist and are fully documented (Sprint 09). The frontend simply never wired up to them.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/app/src/lib/types/projects.ts` — confirm no `ProjectDocument` type exists yet
- [ ] Read `/var/www/lead360.app/app/src/lib/api/projects.ts` — confirm no `getProjectDocuments` function exists
- [ ] Read `/var/www/lead360.app/api/documentation/project_files_REST_API.md` — understand the API contract

---

## Dev Server

This sprint modifies ONLY frontend type and API files. No backend dev server needed. Verify with TypeScript compilation only.

---

## Tasks

### Task 42a.1 — Add ProjectDocument Type and DocumentType Enum

**What:** Add the `ProjectDocument` interface and `DocumentType` type to the frontend types file.

**File to modify:** `/var/www/lead360.app/app/src/lib/types/projects.ts`

**Where to add:** Find the `// ========== PROJECT PHOTOS ==========` section comment (or the photo-related types). Add the documents section BEFORE it:

```typescript
// ========== PROJECT DOCUMENTS ==========

export type DocumentType = 'contract' | 'permit' | 'blueprint' | 'agreement' | 'photo' | 'other';

export interface ProjectDocument {
  id: string;
  project_id: string;
  file_id: string;
  file_url: string;
  file_name: string;
  document_type: DocumentType;
  description: string | null;
  is_public: boolean;
  uploaded_by_user_id: string;
  created_at: string;
}
```

**These fields match the backend response exactly** as documented in `project_files_REST_API.md` lines 66-77.

**Acceptance:**
- [ ] `DocumentType` type exported
- [ ] `ProjectDocument` interface exported
- [ ] All fields match backend response shape exactly

**Do NOT:** Add fields not in the backend response. Do not modify any existing types.

---

### Task 42a.2 — Add Document API Client Functions

**What:** Add three API client functions for project documents.

**File to modify:** `/var/www/lead360.app/app/src/lib/api/projects.ts`

**Step 1 — Add the type import.** Find the existing `import type { ... } from '@/lib/types/projects'` block (lines 6-47) and add `ProjectDocument` and `DocumentType`:

```typescript
  ProjectDocument,
  DocumentType,
```

**Step 2 — Add the functions.** Place them after the `getChangeOrdersRedirect` function and before the `// ========== UTILITY FUNCTIONS ==========` comment (around line 178):

```typescript
// ========== PROJECT DOCUMENTS ==========

/**
 * List documents for a project, optionally filtered by type
 * @endpoint GET /projects/:projectId/documents
 * @roles Owner, Admin, Manager
 */
export const getProjectDocuments = async (
  projectId: string,
  params?: { document_type?: DocumentType },
): Promise<ProjectDocument[]> => {
  const queryParams: Record<string, string> = {};
  if (params?.document_type) queryParams.document_type = params.document_type;

  const { data } = await apiClient.get<ProjectDocument[]>(
    `/projects/${projectId}/documents`,
    { params: queryParams },
  );
  return data;
};

/**
 * Upload a document to a project (multipart/form-data)
 * @endpoint POST /projects/:projectId/documents
 * @roles Owner, Admin, Manager
 */
export const uploadProjectDocument = async (
  projectId: string,
  formData: FormData,
): Promise<ProjectDocument> => {
  const { data } = await apiClient.post<ProjectDocument>(
    `/projects/${projectId}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
};

/**
 * Delete a document from a project
 * @endpoint DELETE /projects/:projectId/documents/:id
 * @roles Owner, Admin
 */
export const deleteProjectDocument = async (
  projectId: string,
  documentId: string,
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(
    `/projects/${projectId}/documents/${documentId}`,
  );
  return data;
};
```

**Important notes:**
- `getProjectDocuments` returns a flat array `ProjectDocument[]` (NOT paginated — the backend returns a plain array, not `{ data, meta }`)
- `uploadProjectDocument` uses `multipart/form-data` — same pattern as `uploadProjectPhoto` and `createProjectLog`
- `deleteProjectDocument` returns `{ message: string }` — same pattern as `deleteProjectPhoto`

**Acceptance:**
- [ ] `getProjectDocuments` function exported — calls `GET /projects/:projectId/documents`
- [ ] `uploadProjectDocument` function exported — calls `POST /projects/:projectId/documents` with FormData
- [ ] `deleteProjectDocument` function exported — calls `DELETE /projects/:projectId/documents/:id`
- [ ] `ProjectDocument` and `DocumentType` imported in the type import block
- [ ] No existing functions modified

**Do NOT:** Change any existing functions. Do not add pagination — the backend returns a flat array.

---

## Patterns to Apply

### API Client Pattern (from existing photo functions in same file)

```typescript
// File upload pattern (from uploadProjectPhoto, line 419-424):
export const uploadProjectPhoto = async (projectId: string, formData: FormData): Promise<ProjectPhoto> => {
  const { data } = await apiClient.post<ProjectPhoto>(`/projects/${projectId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

// Delete pattern (from deleteProjectPhoto, line 438-441):
export const deleteProjectPhoto = async (projectId: string, photoId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${projectId}/photos/${photoId}`);
  return data;
};
```

---

## Acceptance Criteria

- [ ] `ProjectDocument` interface added to `/app/src/lib/types/projects.ts`
- [ ] `DocumentType` type added to `/app/src/lib/types/projects.ts`
- [ ] Three API functions added to `/app/src/lib/api/projects.ts`
- [ ] TypeScript compilation passes: `cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50`
- [ ] No existing code modified or broken
- [ ] No backend code touched

---

## Gate Marker

**STOP** — Verify TypeScript compiles without errors before proceeding to Sprint 42b.

---

## Handoff Notes

Sprint 42b will use:
- `getProjectDocuments(projectId, params?)` from `@/lib/api/projects`
- `uploadProjectDocument(projectId, formData)` from `@/lib/api/projects`
- `deleteProjectDocument(projectId, documentId)` from `@/lib/api/projects`
- `ProjectDocument` and `DocumentType` from `@/lib/types/projects`
- `getFileUrl(relativePath)` from `@/lib/api/projects` (already exists — for building download URLs)
