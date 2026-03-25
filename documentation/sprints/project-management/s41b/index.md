# Sprint 41b — Frontend: Quote-to-Project API Client & Types

**Module:** Project Management
**Type:** Frontend (Types + API Client only — no UI)
**Depends On:** Sprint 41a (backend `quote_id` filter must be working)
**Estimated Complexity:** Low

---

## Sub-Sprints

| # | File | Title | Description |
|---|------|-------|-------------|
| 1 | `sprint_41b_1.md` | Add Types & API Functions | Add `CreateProjectFromQuoteDto`, `quote_id` to `ListProjectsParams`, `createProjectFromQuote()`, `getProjectTemplates()`, update `getProjects()` |
| 2 | `sprint_41b_2.md` | Verification Gate | TypeScript compilation check, acceptance criteria validation, confirm no regressions |

---

## Files Modified

- `/var/www/lead360.app/app/src/lib/types/projects.ts` — 2 changes (new interface + field addition)
- `/var/www/lead360.app/app/src/lib/api/projects.ts` — 3 changes (1 import + 2 new functions + 1 line addition)

## No Backend Changes

This sprint modifies ONLY frontend type and API files. Zero backend files touched.
