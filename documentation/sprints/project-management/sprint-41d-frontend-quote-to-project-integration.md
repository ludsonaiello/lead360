# Sprint 41d — Frontend: Quote Detail Page Integration

**Module:** Project Management
**File:** ./documentation/sprints/project-management/sprint-41d-frontend-quote-to-project-integration.md
**Type:** Frontend
**Depends On:** Sprint 41c (CreateProjectFromQuoteModal component must exist)
**Gate:** NONE — This is the final sprint in the 41 series
**Estimated Complexity:** Medium

---

## Objective

Wire the `CreateProjectFromQuoteModal` into the quote detail page so users can convert an approved quote into a project. Add a "Create Project" button that appears when a quote's status is `approved`, `started`, or `concluded` AND no project already exists for it. If a project already exists, show a "View Project" link instead.

---

## Pre-Sprint Checklist

- [ ] Read `/var/www/lead360.app/app/src/app/(dashboard)/quotes/[id]/page.tsx` — the full quote detail page (large file)
- [ ] Read `/var/www/lead360.app/app/src/components/quotes/CreateProjectFromQuoteModal.tsx` — confirm it exists (from Sprint 41c)
- [ ] Read `/var/www/lead360.app/app/src/lib/api/projects.ts` — confirm `createProjectFromQuote` and `getProjects` exist (from Sprint 41b)
- [ ] Verify the backend `GET /projects?quote_id={uuid}` works (from Sprint 41a)

---

## Dev Server

This sprint requires BOTH servers running for end-to-end testing.

**Backend:**

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

**Frontend:**

In a separate terminal:
  cd /var/www/lead360.app/app && npm run dev

Wait for "Ready" message.

**BEFORE marking the sprint COMPLETE:**

  lsof -i :8000
  kill {PID}
  Confirm port is free: lsof -i :8000   ← must return nothing

  lsof -i :7000
  kill {PID}
  Confirm port is free: lsof -i :7000   ← must return nothing

---

## Tasks

### Task 41d.1 — Detect Whether a Project Already Exists for This Quote

**What:** The quote detail page must know whether this quote already has a project linked to it, to decide whether to show "Create Project" or "View Project".

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/quotes/[id]/page.tsx`

**How it works:** Use the `getProjects` function with the `quote_id` filter (added in Sprint 41a/41b) to check if a project exists for this quote.

**Step 1 — Add the import.** At the top of the file, alongside other API imports, add:

```typescript
import { getProjects } from '@/lib/api/projects';
```

Check if `getProjects` is already imported. If so, skip this import.

**Step 2 — Add state.** Find where other `useState` declarations are (around lines 130-200, near `deleteModalOpen`, `messageModalOpen`, etc.) and add:

```typescript
const [linkedProject, setLinkedProject] = useState<{ id: string; project_number: string; name: string } | null>(null);
```

**Step 3 — Add the detection logic.** Find the main data-loading `useEffect` (the one that calls `loadQuote()` — around line 282). Add a new `useEffect` AFTER the existing quote loading, that runs when the `quote` state changes:

```typescript
// Detect if a project already exists for this quote
useEffect(() => {
  if (!quote?.id) {
    setLinkedProject(null);
    return;
  }
  getProjects({ quote_id: quote.id, limit: 1 })
    .then((res) => {
      if (res.data && res.data.length > 0) {
        setLinkedProject({
          id: res.data[0].id,
          project_number: res.data[0].project_number,
          name: res.data[0].name,
        });
      } else {
        setLinkedProject(null);
      }
    })
    .catch(() => setLinkedProject(null));
}, [quote?.id]);
```

**Why this approach works:**
- Sprint 41a added `quote_id` as a query parameter to `GET /projects`
- Sprint 41b added `quote_id` to `ListProjectsParams` and the `getProjects` function
- `getProjects({ quote_id: quote.id, limit: 1 })` calls `GET /projects?quote_id={uuid}&limit=1`
- If a project exists for this quote, `res.data[0]` contains it
- If no project exists, `res.data` is empty
- Silent failure on error (defensive — doesn't break the page)

**Derive convenience variables** (add near the top of the render section, before the JSX return):

```typescript
const hasLinkedProject = !!linkedProject;
```

**Acceptance:**
- [ ] `linkedProject` state variable exists
- [ ] `useEffect` calls `getProjects({ quote_id: quote.id, limit: 1 })` when quote loads
- [ ] `hasLinkedProject` derived boolean available for UI conditionals
- [ ] Detection does not cause errors if no project exists
- [ ] Detection does not break if the API call fails

**Do NOT:** Modify the backend quote response. Do NOT search by quote name/title (unreliable). Do NOT make the API call on every render (only when `quote.id` changes).

---

### Task 41d.2 — Add Import and State for the Modal

**What:** Import the `CreateProjectFromQuoteModal` component and add the state variable to control it.

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/quotes/[id]/page.tsx`

**Step 1 — Import the modal.** Add alongside other component imports at the top:

```typescript
import CreateProjectFromQuoteModal from '@/components/quotes/CreateProjectFromQuoteModal';
```

**Step 2 — Add modal state.** Find where other modal states are declared (e.g., `deleteModalOpen`, `showSendModal`, `skipApprovalModalOpen` — around lines 141-200) and add:

```typescript
const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
```

**Acceptance:**
- [ ] `CreateProjectFromQuoteModal` imported
- [ ] `showCreateProjectModal` state variable declared
- [ ] No naming conflict with existing state variables

---

### Task 41d.3 — Add "Create Project" Button and "View Project" Link

**What:** Add action buttons in the quote detail page header area.

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/quotes/[id]/page.tsx`

**Where to place:** Find the action buttons area in the header section. This is where Edit, Clone, Delete buttons are rendered. The existing pattern uses:

- `<Link>` wrapping `<Button variant="secondary">` for Edit (navigation)
- `<Button variant="secondary">` for Clone (onClick handler)
- `<Button variant="danger">` for Delete (onClick handler)

Match this pattern exactly.

**First, add the icon import.** The file already imports many icons from `lucide-react`. Find the existing lucide-react import line and add `FolderPlus` to it:

```typescript
// Find the existing import like:
import { Edit, Copy, Trash2, ... , Folder, ... } from 'lucide-react';
// Add FolderPlus:
import { Edit, Copy, Trash2, ... , Folder, FolderPlus, ... } from 'lucide-react';
```

**Visibility rules:**

```typescript
// Statuses that allow project creation (matches backend VALID_QUOTE_STATUSES in project.service.ts line 46)
const PROJECT_ELIGIBLE_STATUSES = ['approved', 'started', 'concluded'];
const showCreateProjectButton = PROJECT_ELIGIBLE_STATUSES.includes(quote.status) && !hasLinkedProject;
const showViewProjectLink = hasLinkedProject;
```

Place these derived variables near the `hasLinkedProject` variable from Task 41d.1.

**"Create Project" Button (when no project exists):**

Place this alongside the existing action buttons (Edit, Clone, Delete):

```tsx
{showCreateProjectButton && (
  <Button
    variant="secondary"
    onClick={() => setShowCreateProjectModal(true)}
  >
    <FolderPlus className="w-4 h-4" />
    Create Project
  </Button>
)}
```

**Uses `<Button variant="secondary">` — matching the Clone button pattern.** Do NOT use raw `<button>` with inline Tailwind classes.

**"View Project" Link (when project already exists):**

```tsx
{showViewProjectLink && linkedProject && (
  <Link href={`/projects/${linkedProject.id}`}>
    <Button variant="secondary">
      <Folder className="w-4 h-4" />
      View Project
    </Button>
  </Link>
)}
```

**Uses `<Link>` wrapping `<Button>` — matching the Edit button pattern.** `Link` is already imported at line 10 (`import Link from 'next/link'`). Do NOT use a raw `<a>` tag (causes full page reload in Next.js App Router).

**Acceptance:**
- [ ] "Create Project" button visible when quote status is `approved`/`started`/`concluded` AND no project exists
- [ ] "View Project" link visible when project already exists for this quote
- [ ] Neither button visible when quote is in `draft`/`pending_approval`/`ready`/`sent`/etc.
- [ ] Both buttons use `<Button variant="secondary">` component (not raw `<button>`)
- [ ] "View Project" uses `<Link>` component (not raw `<a>`)
- [ ] `FolderPlus` icon added to lucide-react import
- [ ] `Folder` icon already imported (verify, do not duplicate)
- [ ] Button styling is consistent with existing Edit/Clone/Delete buttons

**Do NOT:**
- Show both buttons simultaneously (mutually exclusive)
- Use raw `<button>` elements with Tailwind classes
- Use raw `<a>` tags for navigation
- Use a button variant that doesn't exist (stick with `"secondary"`)

---

### Task 41d.4 — Wire Up the Modal and Navigation

**What:** Add the success handler and render the modal in the quote detail page.

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/quotes/[id]/page.tsx`

**Step 1 — Add the onSuccess handler.** Place it near other handler functions:

```typescript
const handleProjectCreated = (projectId: string) => {
  setShowCreateProjectModal(false);
  router.push(`/projects/${projectId}`);
};
```

The page already imports and uses `useRouter` from `next/navigation` (line 9: `import { useRouter, useParams } from 'next/navigation'`; line 124: `const router = useRouter()`).

**IMPORTANT:** Do NOT call `loadQuote()` before `router.push()`. The `loadQuote()` result would never be seen because navigation happens immediately. It is dead code that could cause a "setState on unmounted component" warning. When the user navigates back to the quote page, the page will re-fetch data on mount anyway.

**Step 2 — Render the modal.** Add at the bottom of the JSX return, alongside other modals (near delete confirmation modal, clone modal, etc.):

```tsx
{/* Create Project from Quote Modal */}
{quote && (
  <CreateProjectFromQuoteModal
    isOpen={showCreateProjectModal}
    onClose={() => setShowCreateProjectModal(false)}
    onSuccess={handleProjectCreated}
    quoteId={quote.id}
    quoteName={quote.title}
    quoteTotal={quote.total}
    quoteNumber={quote.quote_number}
  />
)}
```

**The `{quote && ...}` guard** prevents rendering the modal when quote data hasn't loaded yet (avoids passing `undefined` to props).

**Acceptance:**
- [ ] `handleProjectCreated` handler navigates to new project page
- [ ] No `loadQuote()` call before navigation (confirmed removed)
- [ ] Modal rendered conditionally (only when `quote` is loaded)
- [ ] All 7 props passed correctly: `isOpen`, `onClose`, `onSuccess`, `quoteId`, `quoteName`, `quoteTotal`, `quoteNumber`
- [ ] `quote.title` maps to `quoteName` prop
- [ ] `quote.total` maps to `quoteTotal` prop
- [ ] `quote.quote_number` maps to `quoteNumber` prop
- [ ] Modal closes on cancel without side effects

---

### Task 41d.5 — Add Visual Indicator on Quote Header When Project Exists

**What:** When a project has been created from this quote, add a subtle badge in the quote header.

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/quotes/[id]/page.tsx`

**Where:** In the quote header area, near the existing status badge. Find where the quote status badge is rendered and add this badge next to it:

```tsx
{hasLinkedProject && (
  <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
    <Folder className="w-3 h-3" />
    Project Created
  </span>
)}
```

**Acceptance:**
- [ ] "Project Created" badge visible in header when project exists
- [ ] Badge not visible when no project exists
- [ ] Badge styling is subtle (xs text, light background)
- [ ] Works in both light and dark mode (uses `dark:` variants)
- [ ] Uses `Folder` icon (already imported — do NOT import again)

**Do NOT:** Make this badge clickable. Do not make it large or distracting.

---

### Task 41d.6 — Refresh Linked Project State After Modal Success

**What:** After a project is created, the `linkedProject` state must update so the UI switches from "Create Project" to "View Project" — even though we navigate away, we should handle the edge case where the user clicks the browser back button.

**File to modify:** `/var/www/lead360.app/app/src/app/(dashboard)/quotes/[id]/page.tsx`

**This is already handled** by the existing `useEffect` in Task 41d.1 — when the component re-mounts (user navigates back), it re-runs the effect and detects the project. No additional code needed.

**However, verify that the `useEffect` dependency is correct:**
- The effect depends on `quote?.id`
- When the page re-mounts, `quote` will be `null` initially, then loaded
- When `quote.id` becomes available, the effect fires and detects the project

**Acceptance:**
- [ ] Confirmed: no additional code needed for refresh
- [ ] Verified: useEffect with `[quote?.id]` dependency handles re-mount correctly

---

### Task 41d.7 — End-to-End Verification

**What:** Verify the complete quote-to-project flow works end-to-end.

**Test Flow:**

1. **Login** to the app at `http://localhost:7000` using test credentials:
   - Email: `contact@honeydo4you.com`
   - Password: `978@F32c`

2. **Navigate to Quotes** (`/quotes`)

3. **Find or create a quote** with status `approved`:
   - If no approved quote exists, create a new quote, add at least one line item, and change its status through the workflow until it reaches `approved`
   - Note the quote ID and title

4. **Open the approved quote** detail page (`/quotes/{id}`)

5. **Verify "Create Project" button** is visible in the action area alongside Edit/Clone/Delete

6. **Click "Create Project"** — modal should open with title "Create Project from {quote_number}"

7. **Verify modal contents:**
   - Name field pre-filled with quote title
   - Contract Value shown as formatted dollar amount (read-only, not an input)
   - All optional fields empty/default
   - Template dropdown shows "No template" (may have options if templates exist)
   - No PM dropdown (matches CreateProjectModal)

8. **Submit the form** — should:
   - Show loading spinner on "Create Project" button
   - Call `POST /projects/from-quote/:quoteId`
   - Show success toast "Project created successfully"
   - Navigate to the new project detail page (`/projects/{new-project-id}`)

9. **On the project detail page**, verify:
   - Project name matches quote title (or overridden name)
   - Contract value matches quote total
   - Project status is "Planned"
   - Tasks were seeded from quote items

10. **Navigate back to the quote** detail page (browser back or `/quotes/{id}`):
    - "Create Project" button should be GONE
    - "View Project" button should appear instead
    - "Project Created" badge should be visible in the header

11. **Click "View Project"** — should navigate to the project detail page (client-side, no full reload)

12. **Test error case — try creating again:**
    - Open browser dev tools Network tab
    - If you can trigger the modal again (shouldn't be possible via UI since button is gone), verify 409 error is shown as "A project already exists for this quote"

13. **Test with a non-approved quote:**
    - Navigate to a quote with status `draft` or `sent`
    - Verify "Create Project" button is NOT visible

**If any step fails:**
- Document the exact error
- Check browser console for JavaScript errors
- Check Network tab for API responses and status codes
- Fix the issue before marking complete

**Acceptance:**
- [ ] Full flow works: approved quote → Create Project button → modal → submit → project created → navigate to project
- [ ] "Create Project" button only appears on approved/started/concluded quotes without existing project
- [ ] "View Project" link appears after project is created
- [ ] "Project Created" badge visible in quote header
- [ ] 409 handled gracefully if project already exists
- [ ] Navigation works correctly (client-side, no full page reload)
- [ ] Non-approved quotes do NOT show "Create Project" button

**Do NOT:** Skip the end-to-end test. This is the critical validation for the entire Sprint 41 series.

---

## Patterns to Apply

### State Management Pattern (from quote detail page)

```typescript
// Follow the existing pattern for modal states:
const [deleteModalOpen, setDeleteModalOpen] = useState(false);           // existing
const [showCreateProjectModal, setShowCreateProjectModal] = useState(false); // new — same pattern
```

### Navigation Pattern (already used in the page)

```typescript
// Already available — do NOT re-import:
import { useRouter, useParams } from 'next/navigation';  // line 9
const router = useRouter();  // line 124

// Navigate:
router.push(`/projects/${projectId}`);
```

### Action Button Pattern (from existing buttons in the page)

```typescript
// Edit button pattern (Link + Button):
<Link href={`/quotes/${quote.id}/edit`}>
  <Button variant="secondary">
    <Edit className="w-4 h-4" />
    Edit
  </Button>
</Link>

// Clone button pattern (Button with onClick):
<Button variant="secondary" onClick={handleClone}>
  <Copy className="w-4 h-4" />
  Clone
</Button>
```

---

## Business Rules Enforced in This Sprint

- BR-QUOTE-PROJECT: Button only shown when status is `approved`, `started`, or `concluded`
- BR-QUOTE-UNIQUE: If project already exists, show "View Project" instead of "Create Project"
- BR-VISUAL-FEEDBACK: "Project Created" badge gives immediate visual confirmation

---

## Integration Points

| Dependency | Import Path | Purpose |
|---|---|---|
| CreateProjectFromQuoteModal | `@/components/quotes/CreateProjectFromQuoteModal` | Modal component (Sprint 41c) |
| getProjects | `@/lib/api/projects` | Detect if project exists for quote (Sprint 41b, using Sprint 41a backend filter) |
| useRouter | `next/navigation` | Already imported (line 9) — navigation after project creation |
| Link | `next/link` | Already imported (line 10) — "View Project" link |
| Folder | `lucide-react` | Already imported — "View Project" icon + badge icon |
| FolderPlus | `lucide-react` | Must add to existing import — "Create Project" icon |
| Button | `@/components/ui/Button` | Already imported — action buttons |

---

## Acceptance Criteria

- [ ] "Create Project" button appears on approved/started/concluded quotes without existing project
- [ ] "View Project" link appears when project already exists for this quote
- [ ] "Project Created" badge visible in quote header when project exists
- [ ] Linked project detection uses `getProjects({ quote_id: quote.id })` (Sprint 41a backend filter)
- [ ] Modal opens and closes correctly
- [ ] On success: toast shown, navigated to project detail page
- [ ] On 409: error toast shown, no navigation
- [ ] No `loadQuote()` called before navigation (dead code removed)
- [ ] Buttons use `<Button>` component, not raw `<button>` elements
- [ ] Links use `<Link>` component, not raw `<a>` elements
- [ ] End-to-end flow verified manually
- [ ] TypeScript compilation passes: `cd /var/www/lead360.app/app && npx tsc --noEmit --pretty 2>&1 | head -50`
- [ ] No existing functionality broken
- [ ] No backend code touched

---

## Gate Marker

**NONE** — This is the final sprint in the 41 series.

---

## Handoff Notes

After Sprint 41d, the full quote-to-project flow is complete:
- User approves a quote → "Create Project" button appears
- User clicks "Create Project" → modal with pre-filled quote data
- User submits → project created, tasks seeded from quote items, navigated to project
- Returning to quote → "View Project" link + "Project Created" badge

**Future enhancements (not in scope):**
- Auto-create project when quote is approved (event-driven, no user intervention)
- Batch project creation from multiple approved quotes
- Quote-to-project conversion from the projects list page
