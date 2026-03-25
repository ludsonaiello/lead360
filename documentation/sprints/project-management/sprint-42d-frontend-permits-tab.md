# Sprint 42d — Frontend: PermitsTab Component + Page Wiring

**Module:** Project Management
**File:** ./documentation/sprints/project-management/sprint-42d-frontend-permits-tab.md
**Type:** Frontend
**Depends On:** Sprint 42c (permit/inspection types + API client must exist), Sprint 42b (documents tab must be wired — so permits placeholder is separate)
**Gate:** NONE — This is the final sprint in the 42 series
**Estimated Complexity:** High

---

## Objective

Build the `PermitsTab` component and wire it into the project detail page, replacing the last placeholder. The tab lists permits with status filtering, supports create/edit via a modal, shows inspections as an expandable section under each permit, and allows creating/editing inspections. Follow the patterns from `LogsTab` and `DocumentsTab`.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/components/DocumentsTab.tsx` — pattern reference (from Sprint 42b)
- [ ] Read `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/components/LogsTab.tsx` — structural pattern
- [ ] Read `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/page.tsx` — verify permits placeholder still exists
- [ ] Read `/var/www/lead360.app/app/src/lib/api/projects.ts` — confirm permit/inspection functions exist (from Sprint 42c)
- [ ] Read `/var/www/lead360.app/api/documentation/permit_REST_API.md` — permit lifecycle
- [ ] Read `/var/www/lead360.app/api/documentation/inspection_REST_API.md` — inspection lifecycle

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

### Task 42d.1 — Create PermitsTab Component

**What:** Create the `PermitsTab` component with permit CRUD and inline inspections.

**File to create:** `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/components/PermitsTab.tsx`

**Props Interface:**
```typescript
interface PermitsTabProps {
  projectId: string;
}
```

**Imports:**
```typescript
'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  AlertTriangle,
  Plus,
  Edit3,
  Trash2,
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  Calendar,
  Building2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { DeleteConfirmationModal } from '@/components/ui/DeleteConfirmationModal';
import { Select } from '@/components/ui/Select';
import { Modal, ModalActions } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { useRBAC } from '@/contexts/RBACContext';
import {
  getProjectPermits,
  createProjectPermit,
  updateProjectPermit,
  deleteProjectPermit,
  createPermitInspection,
  updatePermitInspection,
  deletePermitInspection,
  formatDate,
} from '@/lib/api/projects';
import type {
  Permit,
  PermitStatus,
  CreatePermitDto,
  UpdatePermitDto,
  Inspection,
  InspectionResult,
  CreateInspectionDto,
  UpdateInspectionDto,
} from '@/lib/types/projects';
import toast from 'react-hot-toast';
```

**RBAC:**
```typescript
const { hasRole } = useRBAC();
const canManage = hasRole(['Owner', 'Admin', 'Manager']);
const canDelete = hasRole(['Owner', 'Admin']);
```

**State Management:**
```typescript
const [permits, setPermits] = useState<Permit[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [statusFilter, setStatusFilter] = useState<PermitStatus | ''>('');

// Permit modal state
const [showPermitModal, setShowPermitModal] = useState(false);
const [editingPermit, setEditingPermit] = useState<Permit | null>(null);
const [permitForm, setPermitForm] = useState<CreatePermitDto>({ permit_type: '' });
const [savingPermit, setSavingPermit] = useState(false);
const [deleteTarget, setDeleteTarget] = useState<Permit | null>(null);

// Expanded permit (to show inspections)
const [expandedPermitId, setExpandedPermitId] = useState<string | null>(null);

// Inspection modal state
const [showInspectionModal, setShowInspectionModal] = useState(false);
const [inspectionPermitId, setInspectionPermitId] = useState<string | null>(null);
const [editingInspection, setEditingInspection] = useState<Inspection | null>(null);
const [inspectionForm, setInspectionForm] = useState<CreateInspectionDto>({ inspection_type: '' });
const [savingInspection, setSavingInspection] = useState(false);
const [deleteInspectionTarget, setDeleteInspectionTarget] = useState<{ permitId: string; inspection: Inspection } | null>(null);
```

**Data Fetching (follow DocumentsTab pattern):**
```typescript
const loadPermits = useCallback(async () => {
  setLoading(true);
  setError(null);
  try {
    const params: { status?: PermitStatus } = {};
    if (statusFilter) params.status = statusFilter;
    const result = await getProjectPermits(projectId, params);
    setPermits(result);
  } catch (err: unknown) {
    const e = err as { message?: string };
    setError(e.message || 'Failed to load permits');
  } finally {
    setLoading(false);
  }
}, [projectId, statusFilter]);

useEffect(() => {
  loadPermits();
}, [loadPermits]);
```

**Permit Status Display Config:**

```typescript
const PERMIT_STATUS_LABELS: Record<PermitStatus, string> = {
  not_required: 'Not Required',
  pending_application: 'Pending Application',
  submitted: 'Submitted',
  approved: 'Approved',
  active: 'Active',
  failed: 'Failed',
  closed: 'Closed',
};

const PERMIT_STATUS_BADGE_VARIANT: Record<PermitStatus, string> = {
  not_required: 'neutral',
  pending_application: 'warning',
  submitted: 'info',
  approved: 'success',
  active: 'blue',
  failed: 'danger',
  closed: 'neutral',
};

const PERMIT_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  ...Object.entries(PERMIT_STATUS_LABELS).map(([value, label]) => ({ value, label })),
];

const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  pass: 'Pass',
  fail: 'Fail',
  conditional: 'Conditional',
  pending: 'Pending',
};

const INSPECTION_RESULT_BADGE_VARIANT: Record<InspectionResult, string> = {
  pass: 'success',
  fail: 'danger',
  conditional: 'warning',
  pending: 'info',
};
```

**Check the actual `Badge` component's `variant` prop values.** Read `/var/www/lead360.app/app/src/components/ui/Badge.tsx` to confirm which variants exist (e.g., `'success'`, `'danger'`, `'warning'`, `'info'`, `'neutral'`, `'blue'`). Adjust the badge variant mappings above to match only the variants the Badge component actually supports.

**UI Sections (in order):**

1. **Header bar** — "Permits" title + status filter dropdown + "Add Permit" button (if `canManage`)
2. **Loading state** — `<LoadingSpinner>` in Card
3. **Error state** — AlertTriangle + error message + Retry
4. **Empty state** — Shield icon + "No Permits" + "Add your first permit" prompt
5. **Permit list** — Card for each permit showing:
   - Permit type (e.g., "Building") as heading
   - Permit number (if present)
   - Status badge (colored by status)
   - Issuing authority (if present)
   - Key dates: submitted, approved, expiry
   - Notes (if present)
   - Edit button (if `canManage`) — opens permit modal in edit mode
   - Delete button (if `canDelete`) — opens DeleteConfirmationModal
   - Expand/collapse button for inspections section
6. **Inspections section (expandable under each permit):**
   - "Add Inspection" button (if `canManage`)
   - List of inspections showing:
     - Inspection type
     - Scheduled date
     - Inspector name (if present)
     - Result badge (pass/fail/conditional/pending)
     - Reinspection required indicator (if true, show reinspection date)
     - Notes (if present)
     - Edit button (if `canManage`)
     - Delete button (if `canDelete`)

**Permit Create/Edit Modal:**

Form fields (all in one modal, mode determined by `editingPermit`):

| Field | Type | Required | Notes |
|---|---|---|---|
| permit_type | Input | Yes (create only) | e.g., Building, Electrical, Plumbing |
| permit_number | Input | No | Assigned by authority |
| status | Select | No | Default: `pending_application` |
| submitted_date | DatePicker | No | When application was submitted |
| approved_date | DatePicker | No | When permit was approved |
| expiry_date | DatePicker | No | When permit expires |
| issuing_authority | Input | No | e.g., City of Boston |
| notes | Textarea | No | Free text |

**Permit submit handler:**
```typescript
const handlePermitSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!permitForm.permit_type?.trim()) {
    toast.error('Permit type is required');
    return;
  }
  setSavingPermit(true);
  try {
    if (editingPermit) {
      await updateProjectPermit(projectId, editingPermit.id, permitForm as UpdatePermitDto);
      toast.success('Permit updated');
    } else {
      await createProjectPermit(projectId, permitForm);
      toast.success('Permit created');
    }
    setShowPermitModal(false);
    setEditingPermit(null);
    setPermitForm({ permit_type: '' });
    loadPermits();
  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    toast.error(error.message || 'Failed to save permit');
  } finally {
    setSavingPermit(false);
  }
};
```

**Open permit modal for editing:**
```typescript
const openEditPermit = (permit: Permit) => {
  setEditingPermit(permit);
  setPermitForm({
    permit_type: permit.permit_type,
    permit_number: permit.permit_number || undefined,
    status: permit.status,
    submitted_date: permit.submitted_date || undefined,
    approved_date: permit.approved_date || undefined,
    expiry_date: permit.expiry_date || undefined,
    issuing_authority: permit.issuing_authority || undefined,
    notes: permit.notes || undefined,
  });
  setShowPermitModal(true);
};
```

**Inspection Create/Edit Modal:**

Form fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| inspection_type | Input | Yes | e.g., Framing, Electrical Rough-In, Final |
| scheduled_date | DatePicker | No | Scheduled inspection date |
| inspector_name | Input | No | Inspector's name |
| result | Select | No | pass, fail, conditional, pending |
| reinspection_required | ToggleSwitch | No | Auto-set if result = fail |
| reinspection_date | DatePicker | No | Shown when reinspection required |
| notes | Textarea | No | Free text |

**Inspection submit handler** follows the same pattern as permit submit, calling `createPermitInspection` or `updatePermitInspection`.

**Delete handlers** follow the same pattern as DocumentsTab — use `DeleteConfirmationModal`, call the API, show toast, refresh data.

**Error handling note:** The axios interceptor transforms errors to `{ status, message }` — use `err as { status?: number; message?: string }` (NOT `err.response.status`).

**Export:**
```typescript
export default function PermitsTab({ projectId }: PermitsTabProps) {
```

**Acceptance:**
- [ ] Component created at the specified path
- [ ] Lists permits from API with status badges
- [ ] Status filter dropdown works
- [ ] Create permit modal works (permit_type required)
- [ ] Edit permit modal pre-fills existing data
- [ ] Delete permit with confirmation (Owner/Admin only)
- [ ] Expandable inspections section per permit
- [ ] Create/edit/delete inspections within permit context
- [ ] Loading/error/empty states handled
- [ ] RBAC enforced
- [ ] Dark mode supported
- [ ] Uses `import toast from 'react-hot-toast'`
- [ ] Error handling uses `err as { status?: number; message?: string }` pattern

**Do NOT:**
- Create separate files for the modals (inline in PermitsTab)
- Add pagination (backend returns flat arrays)
- Modify any existing component

---

### Task 42d.2 — Wire PermitsTab into Project Detail Page

**What:** Replace the permits placeholder in the project detail page with the real `PermitsTab` component.

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/projects/[id]/page.tsx`

**Step 1 — Add import.** Add alongside other tab imports:

```typescript
import PermitsTab from './components/PermitsTab';
```

**Step 2 — Replace the placeholder.** Find the permits case in the `renderTabContent` switch statement (it should be the last placeholder from Sprint 42b). Replace:

```typescript
    case 'permits':
      return (
        <Card className="p-12 text-center mt-6">
          ...placeholder...
        </Card>
      );
```

With:

```typescript
    case 'permits':
      return <PermitsTab projectId={projectId} />;
```

**Acceptance:**
- [ ] `PermitsTab` imported
- [ ] Permits tab renders the real component
- [ ] No more placeholder messages on any tab
- [ ] `projectId` prop passed correctly

---

### Task 42d.3 — Verify End-to-End

**What:** Test the Permits tab with both servers running.

**Test flow:**
1. Login at `http://localhost:7000` with `contact@honeydo4you.com` / `978@F32c`
2. Navigate to a project detail page (`/projects/{id}`)
3. Click the "Permits" tab
4. Verify the placeholder is gone — should show the permits list (likely empty)
5. Click "Add Permit" — modal should open
6. Create a permit: type "Building", issuing authority "City of Boston", status "pending_application"
7. Verify the permit appears in the list with correct status badge
8. Click Edit on the permit — modal pre-fills, change status to "submitted" and add submitted_date
9. Verify the update is reflected
10. Expand the permit's inspections section
11. Click "Add Inspection" — create an inspection: type "Framing", scheduled date, result "pending"
12. Verify inspection appears under the permit
13. Edit the inspection — change result to "pass"
14. Delete the inspection
15. Delete the permit
16. Test the status filter dropdown
17. Also verify the Documents tab from Sprint 42b still works

**Acceptance:**
- [ ] Permits tab shows real content (not placeholder)
- [ ] Permit CRUD works (create, read, update, delete)
- [ ] Inspection CRUD works (nested under permits)
- [ ] Status badges display correctly
- [ ] Status filter works
- [ ] Documents tab still functional (no regressions)
- [ ] No placeholder messages on any project tab

---

## Patterns to Apply

### Error Object Shape (from axios interceptor)

```typescript
catch (err: unknown) {
  const error = err as { status?: number; message?: string };
  toast.error(error.message || 'Failed to save');
}
```

### Tab Component Pattern (from LogsTab/DocumentsTab)

- `'use client'` directive
- Default function export
- Props: `{ projectId: string }`
- State: data array, loading, error, filter(s), modal state(s)
- `useCallback` + `useEffect` for data fetching
- `useRBAC` for role checking
- Loading → Error → Empty → Content rendering pattern

### Toast Library

```typescript
import toast from 'react-hot-toast';
```

---

## Business Rules Enforced in This Sprint

- BR-PERMIT-LIFECYCLE: Status transition `pending_application → submitted → approved → active → closed` (or `failed` at any point)
- BR-INSPECTION-AUTOFAIL: When inspection result is `fail`, `reinspection_required` is auto-set to `true` by backend
- BR-APPROVED-DATE: When permit status is set to `approved` and `approved_date` is empty, backend auto-sets it to today
- BR-RBAC: Create/edit requires Owner/Admin/Manager. Delete requires Owner/Admin only.

---

## Integration Points

| Dependency | Import Path | Purpose |
|---|---|---|
| getProjectPermits | `@/lib/api/projects` | List permits (Sprint 42c) |
| createProjectPermit | `@/lib/api/projects` | Create permit (Sprint 42c) |
| updateProjectPermit | `@/lib/api/projects` | Update permit (Sprint 42c) |
| deleteProjectPermit | `@/lib/api/projects` | Delete permit (Sprint 42c) |
| createPermitInspection | `@/lib/api/projects` | Create inspection (Sprint 42c) |
| updatePermitInspection | `@/lib/api/projects` | Update inspection (Sprint 42c) |
| deletePermitInspection | `@/lib/api/projects` | Delete inspection (Sprint 42c) |
| formatDate | `@/lib/api/projects` | Format dates (existing) |
| useRBAC | `@/contexts/RBACContext` | Role checking (existing) |
| toast | `react-hot-toast` | Notifications (existing) |
| Badge | `@/components/ui/Badge` | Status/result display |

---

## Acceptance Criteria

- [ ] `PermitsTab` component exists and renders permit list
- [ ] Permit CRUD via modal
- [ ] Inspections expandable under each permit
- [ ] Inspection CRUD via modal
- [ ] Status and result badges
- [ ] Status filter dropdown
- [ ] Loading/error/empty states
- [ ] Wired into project detail page (placeholder replaced)
- [ ] End-to-end verified
- [ ] TypeScript compiles: `cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50`
- [ ] No placeholder messages remain on any project tab
- [ ] No regressions on Documents tab

---

## Gate Marker

**NONE** — This is the final sprint in the 42 series.

---

## Handoff Notes

After Sprint 42d:
- All project detail tabs are fully functional
- No more "available in a future sprint" placeholders
- Documents: list, upload, delete
- Permits: full CRUD with status lifecycle
- Inspections: nested CRUD under permits with result tracking
