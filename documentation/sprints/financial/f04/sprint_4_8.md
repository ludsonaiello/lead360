# Sprint 4_8 — API Documentation

**Module:** Financial
**File:** ./documentation/sprints/financial/f04/sprint_4_8.md
**Type:** Backend — Documentation
**Depends On:** Sprint 4_7 (all tests passing)
**Gate:** STOP — Documentation complete with 100% endpoint coverage, all details verified against live code
**Estimated Complexity:** Medium

---

> **You are a masterclass-level engineer.** Your code makes Google, Amazon, and Apple engineers jealous of the quality. Every line you write is intentional, precise, and production-grade.

> ⚠️ **CRITICAL WARNINGS:**
> - This platform is **85% production-ready**. Never break existing code. Not a single comma.
> - Never leave the dev server running in the background when you finish.
> - Read the codebase BEFORE touching anything. Implement with surgical precision.
> - MySQL credentials are in `/var/www/lead360.app/api/.env`
> - This project does **NOT** use PM2. Do not reference or run any PM2 command.

---

## Objective

Produce the complete `financial_REST_API.md` documentation file covering ALL financial entry endpoints added or modified in Sprint F-04. This documentation is based on the LIVE codebase — not assumptions or the contract. Read every controller route, every service method, every DTO, and document what actually exists.

---

## Pre-Sprint Checklist

- [ ] Read the current `financial-entry.controller.ts` — document every route
- [ ] Read the current `financial-entry.service.ts` — document every validation, business rule, and response shape
- [ ] Read ALL DTOs — document every field, type, validation rule
- [ ] Read the Prisma schema for `financial_entry` — document the complete data model
- [ ] Read existing API docs at `/var/www/lead360.app/api/documentation/` — follow the same format

---

## Dev Server

```
CHECK if port 8000 is already in use:
  lsof -i :8000

If a process is found, kill it by PID:
  kill {PID}
  If it does not stop: kill -9 {PID}

Wait 2 seconds, confirm port is free:
  lsof -i :8000   ← must return nothing before proceeding

START the dev server (optional — for verifying Swagger):
  cd /var/www/lead360.app/api && npm run start:dev

BEFORE marking the sprint COMPLETE:
  lsof -i :8000
  kill {PID} (if running)
  Confirm port is free: lsof -i :8000   ← must return nothing
```

---

## Tasks

### Task 1 — Read the Live Codebase

**What:** Read these files in full before writing any documentation:

1. `/var/www/lead360.app/api/src/modules/financial/controllers/financial-entry.controller.ts`
2. `/var/www/lead360.app/api/src/modules/financial/services/financial-entry.service.ts`
3. `/var/www/lead360.app/api/src/modules/financial/dto/create-financial-entry.dto.ts`
4. `/var/www/lead360.app/api/src/modules/financial/dto/update-financial-entry.dto.ts`
5. `/var/www/lead360.app/api/src/modules/financial/dto/list-financial-entries-query.dto.ts`
6. `/var/www/lead360.app/api/src/modules/financial/dto/list-pending-entries-query.dto.ts`
7. `/var/www/lead360.app/api/src/modules/financial/dto/approve-entry.dto.ts`
8. `/var/www/lead360.app/api/src/modules/financial/dto/reject-entry.dto.ts`
9. `/var/www/lead360.app/api/src/modules/financial/dto/resubmit-entry.dto.ts`
10. `/var/www/lead360.app/api/prisma/schema.prisma` (financial_entry model)

**Why:** The documentation MUST reflect the live code, not the contract. If the implementation deviates from the contract, document what IS, not what was planned.

---

### Task 2 — Read Existing API Documentation Format

**What:** Read one of the existing API documentation files to understand the format:

- `/var/www/lead360.app/api/documentation/financial_gate1_REST_API.md` (if exists)
- OR `/var/www/lead360.app/api/documentation/financial_gate3_REST_API.md` (if exists)

Follow the SAME format: title, version, base URL, TOC, authentication section, multi-tenant section, error format, then each endpoint with full details.

---

### Task 3 — Write the Documentation

**File:** `/var/www/lead360.app/api/documentation/financial_f04_REST_API.md`

**Required sections:**

```markdown
# Financial Entry Engine — REST API Documentation (Sprint F-04)

## Version: 1.0
## Base URL: /financial
## Authentication: Bearer JWT token required on all endpoints

## Table of Contents
1. Authentication & RBAC
2. Multi-Tenant Isolation
3. Error Response Format
4. Role-Based Behavior Matrix
5. Endpoints
   5.1 POST /financial/entries — Create Entry
   5.2 GET /financial/entries — List Entries
   5.3 GET /financial/entries/pending — List Pending Entries
   5.4 GET /financial/entries/export — Export CSV
   5.5 GET /financial/entries/:id — Get Entry
   5.6 PATCH /financial/entries/:id — Update Entry
   5.7 DELETE /financial/entries/:id — Delete Entry
   5.8 POST /financial/entries/:id/approve — Approve Entry
   5.9 POST /financial/entries/:id/reject — Reject Entry
   5.10 POST /financial/entries/:id/resubmit — Resubmit Entry
6. Enriched Response Shape
7. Business Rules
8. Pending Review Workflow
```

**For EACH endpoint, document:**
- HTTP method and path
- Description
- Authentication requirement
- Roles allowed (from `@Roles` decorator)
- Request body (if POST/PATCH) — every field with type, required/optional, validation rules, examples
- Query parameters (if GET) — every parameter with type, default, description
- Path parameters — with type and description
- Response body — full shape with types and descriptions
- Response status codes — every possible code with description
- Example request (curl)
- Example response (JSON)
- Business rules specific to this endpoint

**The role-based behavior matrix MUST be included** — the table from the contract showing which role can do what.

**The enriched response shape MUST be documented** — the full flat response with all joined fields.

**The pending workflow MUST be documented** — sequence diagram (text-based):

```
Employee submits expense
  → submission_status = pending_review
  → Entry appears in GET /financial/entries/pending

Reviewer (Owner/Admin/Manager/Bookkeeper) reviews:
  → APPROVE: POST /entries/:id/approve → submission_status = confirmed
  → REJECT:  POST /entries/:id/reject  → rejection_reason set, stays pending_review

If REJECTED:
  → Employee edits and resubmits: POST /entries/:id/resubmit
  → Clears rejection, stays pending_review
  → Reviewer reviews again...
```

---

### Task 4 — Verify Against Swagger

**What:** Start the dev server and compare the Swagger docs at `/api/docs` against your documentation. Ensure:
- Every endpoint in Swagger is documented
- Every request/response field is documented
- No endpoint is missing

---

## Acceptance Criteria

- [ ] Documentation file created at `/var/www/lead360.app/api/documentation/financial_f04_REST_API.md`
- [ ] ALL 10 endpoints documented with full request/response details
- [ ] Role-based behavior matrix included and accurate
- [ ] Enriched response shape documented with all fields and types
- [ ] Pending review workflow documented with sequence description
- [ ] All query parameters for GET endpoints documented
- [ ] All error responses documented with status codes and descriptions
- [ ] CSV export format documented (column headers)
- [ ] Business rules section includes all 25+ rules from the implementation
- [ ] Documentation is based on the LIVE codebase — verified against actual code
- [ ] Dev server shut down before sprint is marked complete

---

## Gate Marker

**STOP** — Documentation must be 100% complete. Every endpoint, every field, every business rule documented. This is a deliverable — not optional.

---

## Handoff Notes

The API documentation is now available at `/var/www/lead360.app/api/documentation/financial_f04_REST_API.md` for the frontend agent to use when building the UI in future sprints.
