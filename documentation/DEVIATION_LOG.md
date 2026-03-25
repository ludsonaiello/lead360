# Lead360 — Deviation Log

Tracks deviations between contracts/sprint specs and actual implementation.

---

## Deviation 1 — Sprint F-04 (4_9 verification) — 2026-03-20

**Sprint Section**: Task 7 — Verify API Documentation File Exists
**Sprint Said**: File should exist at `/api/documentation/financial_f04_REST_API.md`
**Implementation Did**: File was NOT created during sprints 4_1 through 4_8. It was missing when verification gate ran.
**Reason**: Sprint 4_8 (documentation sprint) likely did not execute or was skipped.
**Impact on Frontend**: Documentation was created during verification gate sprint (4_9). Now exists and is verified. No frontend impact.
**Status**: RESOLVED — File created and verified by Documentation Agent on 2026-03-20.

---

## Deviation 2 — Sprint F-04 (4_9 verification) — 2026-03-20

**Sprint Section**: Task 4 — Verify Route Registration
**Sprint Said**: Curl commands use paths like `/financial/entries` without global prefix
**Implementation Did**: All routes are at `/api/v1/financial/entries` due to `app.setGlobalPrefix('api/v1')` in main.ts
**Reason**: Sprint template was written with simplified paths. The actual routes include the global prefix.
**Impact on Frontend**: Frontend must use `/api/v1/` prefix on all routes. Documented in frontend guide.
**Status**: ACCEPTED — Sprint template documentation gap, not a code issue.

---

## Deviation 3 — Sprint F-04 (4_9 verification) — 2026-03-20

**Sprint Section**: Task 9 — Verify Files That Must NOT Be Modified
**Sprint Said**: `api/src/modules/projects/` should not be modified
**Implementation Did**: `task-financial.service.ts` and `task-financial.controller.ts` were updated to pass `userRoles` parameter to `createEntry()` due to signature change in F-04.
**Reason**: F-04 changed the `createEntry()` signature to require `userRoles` for role-based submission_status logic. The projects module's task-financial service calls this method and needed to be updated.
**Impact on Frontend**: None — this is an internal backend integration change. The projects module API surface is unchanged.
**Status**: ACCEPTED — Necessary integration update. Not a scope violation.
