# Sprint 42b — Frontend: DocumentsTab Component + Page Wiring

**Module:** Project Management
**File:** ./documentation/sprints/project-management/sprint-42b-frontend-documents-tab.md
**Type:** Frontend
**Depends On:** Sprint 42a (document types + API client must exist)
**Gate:** NONE
**Estimated Complexity:** Medium

---

## Objective

Build the `DocumentsTab` component and wire it into the project detail page, replacing the placeholder "This tab will be available in a future sprint" message. The tab lists project documents with type filtering, supports upload via a modal with document_type/description/is_public fields, and allows deletion (Owner/Admin only). Follow the exact patterns used by the existing `LogsTab` and `PhotosTab` components.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/components/LogsTab.tsx` — structural pattern to follow
- [ ] Read `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/components/PhotosTab.tsx` — file upload pattern to follow
- [ ] Read `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/page.tsx` — understand where to wire the new tab
- [ ] Read `/var/www/lead360.app/app/src/lib/api/projects.ts` — confirm `getProjectDocuments`, `uploadProjectDocument`, `deleteProjectDocument` exist (from Sprint 42a)
- [ ] Read `/var/www/lead360.app/api/documentation/project_files_REST_API.md` — understand all API contracts

---

## Dev Server

This sprint requires BOTH servers running for end-to-end testing.

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

Frontend:
  cd /var/www/lead360.app/app && npm run dev
  Wait for "Ready" message.

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing
  lsof -i :7000
  kill {PID}
  Confirm port is free: lsof -i :7000   ← must return nothing

---

## Tasks

### Task 42b.1 — Create DocumentsTab Component

**What:** Create the `DocumentsTab` component.

**File to create:** `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/components/DocumentsTab.tsx`

**Follow the exact same patterns as LogsTab.tsx.** The structure should be:

**Props Interface:**
```typescript
interface DocumentsTabProps {
  projectId: string;
}
```

**Imports (follow LogsTab/PhotosTab patterns):**
```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  AlertTriangle,
  Trash2,
  Upload,
  Download,
  Filter,
  X,
  File,
  FileImage,
  FileCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { Select } from '@/components/ui/Select';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getProjectDocuments,
  uploadProjectDocument,
  deleteProjectDocument,
  formatDate,
  getFileUrl,
} from '@/lib/api/projects';
import type { ProjectDocument, DocumentType } from '@/lib/types/projects';
import toast from 'react-hot-toast';
```

**State Management:**
```typescript
const [documents, setDocuments] = useState<ProjectDocument[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [typeFilter, setTypeFilter] = useState<DocumentType | ''>('');
const [showUploadModal, setShowUploadModal] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<ProjectDocument | null>(null);
```

**RBAC (follow PhotosTab pattern):**
```typescript
const { hasRole } = useRBAC();
const canUpload = hasRole(['Owner', 'Admin', 'Manager']);
const canDelete = hasRole(['Owner', 'Admin']);
```

**Data Fetching (follow LogsTab pattern):**
```typescript
const loadDocuments = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const params: { document_type?: DocumentType } = {};
    if (typeFilter) params.document_type = typeFilter;
    const result = await getProjectDocuments(projectId, params);
    setDocuments(result);
  } catch (err: unknown) {
    const e = err as { message?: string };
    setError(e.message || 'Failed to load documents');
  } finally {
    setLoading(false);
  }
}, [projectId, typeFilter]);

useEffect(() => {
  loadDocuments();
}, [loadDocuments]);
```

**Note:** `getProjectDocuments` returns a flat array `ProjectDocument[]`, NOT `{ data, meta }`. No pagination needed.

**Document Type Labels (for filter dropdown and display):**
```typescript
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  contract: 'Contract',
  permit: 'Permit',
  blueprint: 'Blueprint',
  agreement: 'Agreement',
  photo: 'Photo',
  other: 'Other',
};

const DOCUMENT_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  ...Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];
```

**UI Sections (in order):**

1. **Header bar** — "Documents" title + type filter dropdown + "Upload Document" button (if `canUpload`)
2. **Loading state** — `<LoadingSpinner>` in a Card (same as LogsTab)
3. **Error state** — AlertTriangle icon + error message + Retry button (same as LogsTab)
4. **Empty state** — FileText icon + "No Documents" message + "Upload your first document" prompt (same pattern as LogsTab's empty state)
5. **Document list** — Card for each document showing:
   - File icon (use `FileText` for PDFs, `FileImage` for images, `File` for other)
   - File name (`document.file_name`)
   - Document type badge (formatted via `DOCUMENT_TYPE_LABELS`)
   - Description (if present)
   - Upload date (formatted via `formatDate(document.created_at)`)
   - Public/Private badge
   - Download link — use `getFileUrl(document.file_url)` to build the full URL
   - Delete button (if `canDelete`) — opens `DeleteConfirmationModal`

**Download link pattern:**
```tsx
<a
  href={getFileUrl(document.file_url) || '#'}
  target="_blank"
  rel="noopener noreferrer"
  className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
>
  <Download className="w-4 h-4" />
  Download
</a>
```

**Delete handler:**
```typescript
const handleDelete = async () => {
  if (!deleteTarget) return;
  try {
    await deleteProjectDocument(projectId, deleteTarget.id);
    toast.success('Document deleted');
    setDeleteTarget(null);
    loadDocuments();
  } catch (err: unknown) {
    const e = err as { message?: string };
    toast.error(e.message || 'Failed to delete document');
  }
};
```

**Upload Modal (inline in same component):**

The upload modal should have:
- File input (single file)
- `document_type` select dropdown (required) — contract, permit, blueprint, agreement, photo, other
- `description` textarea (optional, max 500 chars)
- `is_public` toggle (optional, default false)
- Submit builds FormData and calls `uploadProjectDocument(projectId, formData)`

```typescript
const [uploadForm, setUploadForm] = useState({
  file: null as File | null,
  document_type: 'other' as DocumentType,
  description: '',
  is_public: false,
});
const [uploading, setUploading] = useState(false);

const handleUpload = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!uploadForm.file) {
    toast.error('Please select a file');
    return;
  }
  setUploading(true);
  try {
    const formData = new FormData();
    formData.append('file', uploadForm.file);
    formData.append('document_type', uploadForm.document_type);
    if (uploadForm.description.trim()) {
      formData.append('description', uploadForm.description.trim());
    }
    formData.append('is_public', String(uploadForm.is_public));

    await uploadProjectDocument(projectId, formData);
    toast.success('Document uploaded successfully');
    setShowUploadModal(false);
    setUploadForm({ file: null, document_type: 'other', description: '', is_public: false });
    loadDocuments();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    toast.error(error.message || 'Failed to upload document');
  } finally {
    setUploading(false);
  }
};
```

**Error handling note:** The axios interceptor transforms errors to `{ status, message }` — use `err as { status?: number; message?: string }` (NOT `err.response.status`).

**Export:**
```typescript
export default function DocumentsTab({ projectId }: DocumentsTabProps) {
```

**Acceptance:**
- [ ] Component created at the specified path
- [ ] Lists documents from API
- [ ] Type filter dropdown works
- [ ] Upload modal with file + document_type + description + is_public
- [ ] Download links work (using `getFileUrl`)
- [ ] Delete with confirmation (Owner/Admin only)
- [ ] Loading/error/empty states handled (matching LogsTab patterns)
- [ ] RBAC enforced via `useRBAC` hook
- [ ] Uses `import toast from 'react-hot-toast'`
- [ ] Error handling uses `err as { status?: number; message?: string }` pattern
- [ ] Dark mode supported (uses `dark:` Tailwind variants)

**Do NOT:**
- Add pagination (backend returns flat array)
- Create a separate modal component file (inline in DocumentsTab)
- Modify any existing component

---

### Task 42b.2 — Wire DocumentsTab into Project Detail Page

**What:** Replace the documents placeholder in the project detail page with the real `DocumentsTab` component.

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/page.tsx`

**Step 1 — Add import.** Add alongside other tab imports (around line 26-30):

```typescript
import DocumentsTab from './components/DocumentsTab';
```

**Step 2 — Replace the placeholder.** Find the `renderTabContent` function's switch statement. The current code has:

```typescript
case 'documents':
case 'permits':
  return (
    <Card className="p-12 text-center mt-6">
      ...placeholder...
    </Card>
  );
```

**Change this to separate the cases.** Replace the combined `case 'documents': case 'permits':` with:

```typescript
    case 'documents':
      return <DocumentsTab projectId={projectId} />;
    case 'permits':
      return (
        <Card className="p-12 text-center mt-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            Permits
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            This tab will be available in a future sprint.
          </p>
        </Card>
      );
```

**IMPORTANT:** Keep the permits placeholder for now — Sprint 42d will replace it.

**Acceptance:**
- [ ] `DocumentsTab` imported
- [ ] Documents tab renders the real component
- [ ] Permits tab still shows placeholder (unchanged until Sprint 42d)
- [ ] `projectId` prop passed correctly

**Do NOT:** Remove the permits placeholder yet.

---

### Task 42b.3 — Verify End-to-End

**What:** Test the Documents tab works with both servers running.

**Test flow:**
1. Login at `http://localhost:7000` with `contact@honeydo4you.com` / `978@F32c`
2. Navigate to a project detail page (`/projects/{id}`)
3. Click the "Documents" tab
4. Verify the placeholder is gone — should show the documents list (likely empty)
5. Click "Upload Document" — modal should open
6. Upload a test file (PDF or image) with type "contract" and a description
7. Verify the document appears in the list after upload
8. Verify the Download link works (opens the file)
9. Verify the Delete button appears for Owner/Admin roles
10. Delete the test document and verify it disappears

**Acceptance:**
- [ ] Documents tab shows real content (not placeholder)
- [ ] Upload works
- [ ] List displays documents with type badges, dates, download links
- [ ] Delete works with confirmation
- [ ] Type filter works

---

## Integration Points

| Dependency | Import Path | Purpose |
|---|---|---|
| getProjectDocuments | `@/lib/api/projects` | List documents (Sprint 42a) |
| uploadProjectDocument | `@/lib/api/projects` | Upload document (Sprint 42a) |
| deleteProjectDocument | `@/lib/api/projects` | Delete document (Sprint 42a) |
| getFileUrl | `@/lib/api/projects` | Build download URL (existing) |
| formatDate | `@/lib/api/projects` | Format dates (existing) |
| useRBAC | `@/contexts/RBACContext` | Role checking (existing) |
| toast | `react-hot-toast` | Notifications (existing) |

---

## Acceptance Criteria

- [ ] `DocumentsTab` component exists and renders document list
- [ ] Upload modal works with file + document_type + description + is_public
- [ ] Download links functional
- [ ] Delete with confirmation modal
- [ ] Type filter dropdown
- [ ] Loading/error/empty states
- [ ] Wired into project detail page (placeholder replaced)
- [ ] End-to-end verified
- [ ] TypeScript compiles: `cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50`

---

## Gate Marker

**NONE** — Sprint 42c (permits API) is independent.

---

## Handoff Notes

The Documents tab is now live. Sprint 42c/42d will do the same for the Permits tab.
