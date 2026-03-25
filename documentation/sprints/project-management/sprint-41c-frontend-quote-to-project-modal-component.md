# Sprint 41c — Frontend: Create Project From Quote Modal Component

**Module:** Project Management
**File:** ./documentation/sprints/project-management/sprint-41c-frontend-quote-to-project-modal-component.md
**Type:** Frontend
**Depends On:** Sprint 41b (API client function + types must exist)
**Gate:** STOP — Modal component must render and TypeScript must compile before Sprint 41d starts
**Estimated Complexity:** Medium

---

## Objective

Build the `CreateProjectFromQuoteModal` component that lets users convert an accepted quote into a project. The modal pre-fills the project name from the quote title, shows the contract value (read-only), provides optional fields for dates/template/permit/notes, and calls `POST /projects/from-quote/:quoteId`. This modal follows the exact same structure as the existing `CreateProjectModal` component.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/app/src/app/(dashboard)/projects/components/CreateProjectModal.tsx` — this is the pattern to follow exactly
- [ ] Read `/var/www/lead360.app/app/src/lib/api/projects.ts` — confirm `createProjectFromQuote` function exists (from Sprint 41b)
- [ ] Read `/var/www/lead360.app/app/src/lib/types/projects.ts` — confirm `CreateProjectFromQuoteDto` type exists (from Sprint 41b)

---

## Tasks

### Task 41c.1 — Create the CreateProjectFromQuoteModal Component

**What:** Create a new modal component for converting a quote into a project.

**File to create:** `/var/www/lead360.app/app/src/components/quotes/CreateProjectFromQuoteModal.tsx`

**Why this location:** The modal is triggered from the quote detail page context, so it belongs in the quotes component directory alongside `ApprovalActionsCard.tsx` and other quote-specific components.

**Props Interface:**

```typescript
interface CreateProjectFromQuoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (projectId: string) => void;
  quoteId: string;
  quoteName: string;
  quoteTotal: number;
  quoteNumber: string;
}
```

**Exact imports to use (matching CreateProjectModal patterns):**

```typescript
'use client';

import React, { useState, useEffect } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { DatePicker } from '@/components/ui/DatePicker';
import { ToggleSwitch } from '@/components/ui/ToggleSwitch';
import { createProjectFromQuote, getProjectTemplates, formatCurrency } from '@/lib/api/projects';
import type { CreateProjectFromQuoteDto } from '@/lib/types/projects';
import toast from 'react-hot-toast';
```

**IMPORTANT — `formatCurrency` already exists** in `/app/src/lib/api/projects.ts` (lines 212-215). Use it directly for displaying the contract value. Do NOT create a duplicate formatter:

```typescript
// Already exists in @/lib/api/projects — signature:
// export const formatCurrency = (value: number | null | undefined): string
```

**Form Fields (in order):**

| # | Field | Type | Default Value | Required | Notes |
|---|---|---|---|---|---|
| 1 | name | text input (Input) | Pre-filled with `quoteName` prop | No | Max 200 chars |
| 2 | Contract Value | read-only text | Formatted `quoteTotal` via `formatCurrency` | N/A — display only | Show as `$X,XXX.XX` in a styled `<div>`, NOT an input element |
| 3 | description | textarea (Textarea) | empty string | No | |
| 4 | start_date | date input (DatePicker) | empty string | No | ISO date format |
| 5 | target_completion_date | date input (DatePicker) | empty string | No | Must be >= start_date if both provided |
| 6 | permit_required | toggle (ToggleSwitch) | false | No | |
| 7 | template_id | select (`<select>`) | empty string | No | Populated from `getProjectTemplates()` |
| 8 | notes | textarea (Textarea) | empty string | No | |

**Note: No `assigned_pm_user_id` field in this modal.** The existing `CreateProjectModal` does NOT have a PM dropdown — it only has name, description, dates, estimated cost, permit toggle, and notes. Follow the same scope. PM can be assigned later from the project detail page.

**State Management (follow CreateProjectModal exactly):**

```typescript
export default function CreateProjectFromQuoteModal({
  isOpen, onClose, onSuccess, quoteId, quoteName, quoteTotal, quoteNumber,
}: CreateProjectFromQuoteModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<CreateProjectFromQuoteDto>({
    name: quoteName,
    description: '',
    start_date: '',
    target_completion_date: '',
    permit_required: false,
    notes: '',
    template_id: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [templates, setTemplates] = useState<Array<{ id: string; name: string }>>([]);
```

**Template Loading (on modal open):**

```typescript
  useEffect(() => {
    if (isOpen) {
      getProjectTemplates()
        .then((res) => setTemplates(res.data || []))
        .catch(() => setTemplates([]));
    }
  }, [isOpen]);
```

**Validation (follow CreateProjectModal pattern):**

```typescript
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (form.name && form.name.length > 200) {
      newErrors.name = 'Project name must be 200 characters or less';
    }
    if (form.start_date && form.target_completion_date && form.start_date > form.target_completion_date) {
      newErrors.target_completion_date = 'Target date must be after start date';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
```

**Note: `name` is NOT required here** (unlike CreateProjectModal where it IS required). The backend defaults to the quote title when name is omitted.

**Submit Handler — CRITICAL: Correct error handling pattern:**

The axios client at `/app/src/lib/api/axios.ts` (lines 256-261) transforms ALL API errors into **plain objects** with this shape:

```typescript
{ status: number; message: string; error: string; data: any }
```

The error does **NOT** have a `.response` property. Access `.status` and `.message` directly on the error object:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const dto: CreateProjectFromQuoteDto = {};
      if (form.name?.trim()) dto.name = form.name.trim();
      if (form.description?.trim()) dto.description = form.description.trim();
      if (form.start_date) dto.start_date = form.start_date;
      if (form.target_completion_date) dto.target_completion_date = form.target_completion_date;
      if (form.permit_required) dto.permit_required = true;
      if (form.template_id) dto.template_id = form.template_id;
      if (form.notes?.trim()) dto.notes = form.notes.trim();

      const project = await createProjectFromQuote(quoteId, dto);
      toast.success('Project created successfully');
      onSuccess(project.id);
      handleClose();
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string };
      if (error.status === 409) {
        toast.error('A project already exists for this quote');
      } else if (error.status === 400) {
        toast.error(error.message || 'Quote must be approved before creating a project');
      } else {
        toast.error(error.message || 'Failed to create project');
      }
    } finally {
      setLoading(false);
    }
  };
```

**CRITICAL NOTES on error handling:**
- Use `catch (err: unknown)` — NOT `catch (err: any)`. This matches the pattern in CreateProjectModal (line 68).
- Cast to `{ status?: number; message?: string }` — NOT to `{ response?: { status; data } }`.
- Access `error.status` directly — NOT `error.response.status`. The axios interceptor already unwraps the response.

**Close/Reset Handler:**

```typescript
  const handleClose = () => {
    setForm({
      name: quoteName,
      description: '',
      start_date: '',
      target_completion_date: '',
      permit_required: false,
      notes: '',
      template_id: '',
    });
    setErrors({});
    onClose();
  };
```

**JSX Structure (follow CreateProjectModal layout):**

```tsx
  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={`Create Project from ${quoteNumber}`} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Project Name"
          placeholder="Defaults to quote title if left empty"
          value={form.name || ''}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          error={errors.name}
        />

        {/* Contract Value — READ-ONLY display, not an input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Contract Value
          </label>
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-900 dark:text-gray-100">
            {formatCurrency(quoteTotal)}
          </div>
        </div>

        <Textarea
          label="Description"
          placeholder="Brief project description..."
          value={form.description || ''}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker
            label="Start Date"
            value={form.start_date || ''}
            onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          />
          <DatePicker
            label="Target Completion Date"
            value={form.target_completion_date || ''}
            onChange={(e) => setForm({ ...form, target_completion_date: e.target.value })}
            error={errors.target_completion_date}
          />
        </div>

        <ToggleSwitch
          label="Permit Required"
          enabled={form.permit_required || false}
          onChange={(enabled) => setForm({ ...form, permit_required: enabled })}
        />

        {/* Template Dropdown — optional */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Project Template (optional)
          </label>
          <select
            value={form.template_id || ''}
            onChange={(e) => setForm({ ...form, template_id: e.target.value || undefined })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">No template</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        <Textarea
          label="Notes"
          placeholder="Internal notes..."
          value={form.notes || ''}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button variant="ghost" type="button" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create Project
          </Button>
        </div>
      </form>
    </Modal>
  );
```

**Acceptance:**
- [ ] Component file created at `/app/src/components/quotes/CreateProjectFromQuoteModal.tsx`
- [ ] Props interface matches exactly as defined above
- [ ] Form has all fields in the correct order
- [ ] Contract Value shown as read-only `<div>` (NOT an input), using `formatCurrency` from `@/lib/api/projects`
- [ ] `name` pre-filled with `quoteName` prop
- [ ] Template dropdown populated from `getProjectTemplates()` on modal open
- [ ] `catch (err: unknown)` used — NOT `catch (err: any)`
- [ ] Error cast to `{ status?: number; message?: string }` — NOT `{ response?: ... }`
- [ ] `error.status` accessed directly — NOT `error.response.status`
- [ ] 409 error handled with "A project already exists for this quote"
- [ ] 400 error handled with server message or fallback
- [ ] Loading state on submit button via `loading` prop
- [ ] Form resets on close
- [ ] Uses `import toast from 'react-hot-toast'` — NOT sonner, NOT custom
- [ ] Uses `Modal`, `Button`, `Input`, `Textarea`, `DatePicker`, `ToggleSwitch` from `@/components/ui/`
- [ ] Does NOT use `MoneyInput` (contract value is display-only, not editable)
- [ ] No `assigned_pm_user_id` field (matches CreateProjectModal scope)
- [ ] Component exported as default function

**Do NOT:**
- Create the component in the projects directory (it belongs in `/app/src/components/quotes/`)
- Make Contract Value an editable `MoneyInput` or `Input` — it is read-only display only
- Use `catch (err: any)` — use `catch (err: unknown)` with proper type cast
- Access `err.response.status` — the axios interceptor already unwraps errors, use `err.status` directly
- Add `assigned_pm_user_id` dropdown — the existing CreateProjectModal doesn't have one
- Use `import { toast } from 'sonner'` — this project uses `react-hot-toast`
- Modify CreateProjectModal or any existing component

---

## Patterns to Apply

### Error Object Shape (from axios interceptor at `/app/src/lib/api/axios.ts` lines 256-261)

The axios response interceptor transforms ALL errors into plain objects:
```typescript
// What the interceptor rejects with:
{ status: number; message: string; error: string; data: any }

// How to handle in catch:
catch (err: unknown) {
  const error = err as { status?: number; message?: string };
  // error.status === 409, 400, etc.
  // error.message === "A project already exists for this quote", etc.
}
```

**NEVER** use `err.response.status` — the interceptor does NOT preserve the original AxiosError shape.

### Modal Component Pattern (from CreateProjectModal)

- Uses `'use client'` directive at top
- Default function export
- State: `loading`, `form`, `errors` via `useState`
- `validate()` returns boolean, sets `errors` state
- `handleSubmit()` prevents default, validates, calls API, shows toast
- `handleClose()` resets form, calls `onClose()`
- Layout: `<Modal>` wrapping `<form>` with fields + footer buttons
- Footer: Cancel (`variant="ghost"`) + Submit (`loading` prop for spinner)

### Toast Library

```typescript
import toast from 'react-hot-toast';
// Usage:
toast.success('Project created successfully');
toast.error('A project already exists for this quote');
```

---

## Business Rules Enforced in This Sprint

- BR-QUOTE-PROJECT: Only quotes with status `approved`, `started`, or `concluded` can be converted (backend enforces, frontend shows error on 400)
- BR-QUOTE-UNIQUE: One project per quote (backend returns 409, frontend shows specific error message)
- BR-TEMPLATE-OPTIONAL: Template selection is always optional; silent failure if templates don't load
- BR-NAME-OPTIONAL: Project name defaults to quote title on backend if omitted

---

## Integration Points

| Dependency | Import Path | Purpose |
|---|---|---|
| createProjectFromQuote | `@/lib/api/projects` | API call to create project (Sprint 41b) |
| getProjectTemplates | `@/lib/api/projects` | Fetch template options (Sprint 41b) |
| formatCurrency | `@/lib/api/projects` | Format quoteTotal for display (existing) |
| CreateProjectFromQuoteDto | `@/lib/types/projects` | Form data type (Sprint 41b) |
| Modal | `@/components/ui/Modal` | Dialog wrapper |
| Button | `@/components/ui/Button` | Cancel + Submit buttons |
| Input | `@/components/ui/Input` | Name field |
| Textarea | `@/components/ui/Textarea` | Description + Notes |
| DatePicker | `@/components/ui/DatePicker` | Start + Target dates |
| ToggleSwitch | `@/components/ui/ToggleSwitch` | Permit required toggle |
| toast | `react-hot-toast` | Success/error notifications |

---

## Acceptance Criteria

- [ ] `CreateProjectFromQuoteModal` component exists at `/app/src/components/quotes/CreateProjectFromQuoteModal.tsx`
- [ ] Modal opens and closes correctly
- [ ] `name` field pre-filled with quote title
- [ ] Contract Value displayed as formatted read-only text using `formatCurrency`
- [ ] Template dropdown loads and shows options (or "No template" if none exist)
- [ ] Form submits and calls `createProjectFromQuote` API
- [ ] 409 error shows "A project already exists for this quote"
- [ ] 400 error shows server message or "Quote must be approved before creating a project"
- [ ] Success shows toast and calls `onSuccess(project.id)`
- [ ] Loading spinner on submit button during API call
- [ ] TypeScript compilation passes with no new errors: `cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50`
- [ ] No existing components modified
- [ ] No backend code touched

---

## Gate Marker

**STOP** — Verify the component compiles and has no TypeScript errors:
```bash
cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50
```

---

## Handoff Notes

Sprint 41d will import and use:
- `CreateProjectFromQuoteModal` from `@/components/quotes/CreateProjectFromQuoteModal`
- Props: `{ isOpen, onClose, onSuccess, quoteId, quoteName, quoteTotal, quoteNumber }`
- `onSuccess` receives `projectId: string` — Sprint 41d will use this to navigate to `/projects/${projectId}`
