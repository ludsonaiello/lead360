# Clock Session REST API — Sprint 9

**Module:** `time-clock` (sub-module: clock-sessions)
**Base URL:** `https://api.lead360.app/api/v1/time-clock/sessions`
**Local Dev URL:** `http://127.0.0.1:8000/api/v1/time-clock/sessions`
**Authentication:** Bearer JWT required on all endpoints.
**Multi-Tenant:** Every query is scoped to the caller's `tenant_id` (resolved from the JWT, never from the client).
**Total Endpoints:** 9
**Sprint Reference:** `documentation/sprints/clockin_backend/sprint_9.md`, `documentation/sprints/clockin_backend/sprint_11.md` (PATCH endpoint)

---

## Table of Contents

1. [Endpoints Overview](#endpoints-overview)
2. [Shared Response Shapes](#shared-response-shapes)
3. [Endpoint 1 — POST /clock-in](#endpoint-1--post-clock-in)
4. [Endpoint 2 — POST /clock-out](#endpoint-2--post-clock-out)
5. [Endpoint 3 — GET /me/active](#endpoint-3--get-meactive)
6. [Endpoint 4 — GET /me/available-projects](#endpoint-4--get-meavailable-projects)
7. [Endpoint 5 — GET /mine](#endpoint-5--get-mine)
8. [Endpoint 6 — GET /active/all](#endpoint-6--get-activeall)
9. [Endpoint 7 — GET /](#endpoint-7--get-)
10. [Endpoint 8 — GET /:id](#endpoint-8--get-id)
11. [Endpoint 9 — PATCH /:id](#endpoint-9--patch-id)
12. [Error Response Format](#error-response-format)
12. [Enums Reference](#enums-reference)
13. [Business Rules Enforced](#business-rules-enforced)
14. [RBAC Permission Matrix](#rbac-permission-matrix)
15. [Notification Events](#notification-events)

---

## Endpoints Overview

| # | Method | Path | Roles | Description |
|---|--------|------|-------|-------------|
| 1 | POST   | `/time-clock/sessions/clock-in`               | Owner, Admin, Project Manager, Employee             | Start a new work session |
| 2 | POST   | `/time-clock/sessions/clock-out`              | Owner, Admin, Project Manager, Employee             | End the active session |
| 3 | GET    | `/time-clock/sessions/me/active`              | Owner, Admin, Project Manager, Employee             | Current user's active session (or null) |
| 4 | GET    | `/time-clock/sessions/me/available-projects` | Owner, Admin, Project Manager, Employee             | Projects available for clock-in (BR-015) |
| 5 | GET    | `/time-clock/sessions/mine`                   | Owner, Admin, Project Manager, Employee             | Current user's paginated session history |
| 6 | GET    | `/time-clock/sessions/active/all`             | Owner, Admin, Project Manager                       | All currently active sessions across tenant |
| 7 | GET    | `/time-clock/sessions`                        | Owner, Admin, Project Manager, Bookkeeper           | Paginated admin list with filters |
| 8 | GET    | `/time-clock/sessions/:id`                    | Owner, Admin, Project Manager, Bookkeeper           | Full session detail with breaks, edits, disputes |
| 9 | PATCH  | `/time-clock/sessions/:id`                    | Owner, Admin                                        | Manually edit a session; creates immutable edit logs |

> **Route order matters.** The controller declares these endpoints in the exact order shown above so that static segments (`clock-in`, `clock-out`, `me/*`, `mine`, `active/all`, `/`) are matched before the `:id` parameter. `PATCH /:id` is declared alongside `GET /:id` to keep route matching unambiguous.

---

## Shared Response Shapes

### `ClockSession` object

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Primary key |
| `tenant_id` | string (uuid) | Always the caller's tenant |
| `employee_profile_id` | string (uuid) | Owner of the session |
| `work_shift_id` | string (uuid) \| null | Matched shift, if any (BR-009) |
| `project_id` | string (uuid) \| null | Optional project tag |
| `task_id` | string (uuid) \| null | Optional task tag |
| `clockin_address_id` | string (uuid) \| null | Geofence-matched address |
| `status` | `'active' \| 'on_break' \| 'completed'` | Lifecycle state |
| `clock_in_at` | string (ISO 8601) | Start timestamp |
| `clock_out_at` | string (ISO 8601) \| null | End timestamp |
| `clock_in_latitude` | decimal \| null | 8 decimal places |
| `clock_in_longitude` | decimal \| null | 8 decimal places |
| `clock_in_location_source` | `LocationSource` | Defaults to `browser_gps` |
| `clock_in_geofence_status` | `GeofenceStatus` | `inside`, `outside`, `unavailable`, `not_enforced` |
| `clock_out_latitude` | decimal \| null | |
| `clock_out_longitude` | decimal \| null | |
| `clock_out_location_source` | `LocationSource` | |
| `clock_out_geofence_status` | `GeofenceStatus` | Not enforced in Phase 1 |
| `total_worked_minutes` | integer \| null | Set at clock-out (excludes unpaid breaks) |
| `regular_minutes` | integer \| null | From `OvertimeService` |
| `overtime_minutes` | integer \| null | From `OvertimeService` |
| `is_manual_edit` | boolean | Set by Sprint 11 edit flow |
| `is_flagged` | boolean | Set by BR-003/BR-004 |
| `flag_reason` | string \| null | Populated when `is_flagged` is true |
| `labor_cost_posted` | boolean | Set by `LaborCostAttributionService` |
| `labor_cost_entry_id` | string (uuid) \| null | |
| `notes` | string \| null | Freeform, ≤ 500 chars |
| `created_at` / `updated_at` | string (ISO 8601) | |

`GET /:id` additionally includes `break_entries` (asc by `started_at`), `edit_logs` (desc by `edited_at`), and `disputes` (desc by `created_at`).

---

## Endpoint 1 — POST /clock-in

Start a new clock session for the authenticated user.

- **Method:** `POST`
- **Path:** `/api/v1/time-clock/sessions/clock-in`
- **Auth:** Bearer JWT
- **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`
- **Success:** `201 Created`

### Request Body (`ClockInDto`)

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `project_id` | string (uuid) | optional | UUID v4 | Required only when `settings.require_job_tag = true` |
| `task_id` | string (uuid) | optional | UUID v4 | Required only when `settings.require_task_tag = true` |
| `latitude` | number | optional | -90 to 90, max 8 decimals | Required only when `settings.gps_required = true` + `gps_unavailable_action = block` |
| `longitude` | number | optional | -180 to 180, max 8 decimals | See `latitude` |
| `location_source` | `LocationSource` | optional | enum | Defaults to `browser_gps` |
| `notes` | string | optional | ≤ 500 chars | Freeform |

### Example Request

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "6a5b3fc2-1e45-4f9e-9321-8f8b3d9c1234",
    "latitude": 40.7128,
    "longitude": -74.006,
    "location_source": "browser_gps",
    "notes": "Starting shift at main yard"
  }'
```

### Example Response (`201 Created`)

```json
{
  "id": "e39a0a2b-b9d5-4d29-a0c2-4c66cf5f4a77",
  "tenant_id": "0d4f1e11-9b6f-4c12-a2d9-0de1e8f2a0bb",
  "employee_profile_id": "a1c2...",
  "work_shift_id": null,
  "project_id": "6a5b3fc2-1e45-4f9e-9321-8f8b3d9c1234",
  "task_id": null,
  "clockin_address_id": null,
  "status": "active",
  "clock_in_at": "2026-04-13T14:02:11.000Z",
  "clock_out_at": null,
  "clock_in_latitude": "40.71280000",
  "clock_in_longitude": "-74.00600000",
  "clock_in_location_source": "browser_gps",
  "clock_in_geofence_status": "not_enforced",
  "total_worked_minutes": null,
  "regular_minutes": null,
  "overtime_minutes": null,
  "is_manual_edit": false,
  "is_flagged": false,
  "flag_reason": null,
  "labor_cost_posted": false,
  "labor_cost_entry_id": null,
  "notes": "Starting shift at main yard",
  "created_at": "2026-04-13T14:02:11.000Z",
  "updated_at": "2026-04-13T14:02:11.000Z",
  "employee_profile": { "id": "a1c2...", "user": { "id": "...", "first_name": "Jane", "last_name": "Doe" } },
  "project": { "id": "6a5b3fc2-...", "name": "Main Street Deck", "project_number": "P-10231" },
  "task": null,
  "work_shift": null,
  "clockin_address": null,
  "break_entries": [],
  "edit_logs": [],
  "disputes": []
}
```

### Error Responses

| Status | When |
|---|---|
| `400 Bad Request` | Validation error, or `require_job_tag`/`require_task_tag` violated |
| `401 Unauthorized` | Missing/invalid JWT |
| `403 Forbidden` | GPS required but not provided and `gps_unavailable_action = block`; **or** outside geofence and `geofence_violation_action = block` |
| `404 Not Found` | Employee profile missing or inactive |
| `409 Conflict` | Employee already has an active or on-break session (BR-001) |

---

## Endpoint 2 — POST /clock-out

End the caller's active session, auto-closing any open break, computing total/regular/overtime minutes, completing the matched shift, and firing labor cost attribution (non-blocking).

- **Method:** `POST`
- **Path:** `/api/v1/time-clock/sessions/clock-out`
- **Auth:** Bearer JWT
- **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`
- **Success:** `200 OK`

### Request Body (`ClockOutDto`)

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `latitude` | number | optional | -90 to 90, max 8 decimals | |
| `longitude` | number | optional | -180 to 180, max 8 decimals | |
| `location_source` | `LocationSource` | optional | enum | Defaults to `browser_gps` |
| `notes` | string | optional | ≤ 500 chars | Overwrites existing notes only if provided |

### Example Request

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/sessions/clock-out \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"latitude": 40.7128, "longitude": -74.006}'
```

### Example Response (`200 OK`)

```json
{
  "id": "e39a0a2b-b9d5-4d29-a0c2-4c66cf5f4a77",
  "status": "completed",
  "clock_in_at": "2026-04-13T14:02:11.000Z",
  "clock_out_at": "2026-04-13T22:07:42.000Z",
  "total_worked_minutes": 485,
  "regular_minutes": 480,
  "overtime_minutes": 5,
  "break_entries": [],
  "edit_logs": [],
  "disputes": []
}
```

### Error Responses

| Status | When |
|---|---|
| `401 Unauthorized` | Missing/invalid JWT |
| `404 Not Found` | No active or on-break session for the caller |

---

## Endpoint 3 — GET /me/active

Get the caller's currently active or on-break session. Absence of an active session is a valid state — the response is `{ "data": null }` rather than a 404.

- **Method:** `GET`
- **Path:** `/api/v1/time-clock/sessions/me/active`
- **Auth:** Bearer JWT
- **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

### Example Response — active session present

```json
{
  "data": {
    "id": "e39a0a2b-...",
    "status": "active",
    "clock_in_at": "2026-04-13T14:02:11.000Z",
    "project": { "id": "6a5b...", "name": "Main Street Deck" },
    "task": null,
    "work_shift": null,
    "clockin_address": null,
    "break_entries": []
  }
}
```

### Example Response — no active session

```json
{ "data": null }
```

### Error Responses

| Status | When |
|---|---|
| `401 Unauthorized` | Missing/invalid JWT |
| `404 Not Found` | Employee profile missing or inactive |

---

## Endpoint 4 — GET /me/available-projects

Return the list of projects the caller may clock in to, per BR-015. Rules depend on `time_clock_settings.clock_in_mode`:

- `anywhere` or `specific_addresses` → every project with `status IN ('planned', 'in_progress')` in the tenant.
- `active_job_sites` → union of projects from `employee_project_assignment` and `task_assignee` (matched by `user_id` or `crew_member_id`), filtered to active statuses.

- **Method:** `GET`
- **Path:** `/api/v1/time-clock/sessions/me/available-projects`
- **Auth:** Bearer JWT
- **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

### Example Response

```json
{
  "data": [
    { "id": "6a5b3fc2-...", "name": "Main Street Deck", "project_number": "P-10231" },
    { "id": "b32a...", "name": "Lakeside Kitchen",  "project_number": "P-10245" }
  ]
}
```

### Error Responses

| Status | When |
|---|---|
| `401 Unauthorized` | Missing/invalid JWT |
| `404 Not Found` | Employee profile missing or inactive |

---

## Endpoint 5 — GET /mine

Paginated list of the caller's own clock sessions.

- **Method:** `GET`
- **Path:** `/api/v1/time-clock/sessions/mine`
- **Auth:** Bearer JWT
- **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

### Query Parameters (`ListMyClockSessionsDto`)

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | 1 | |
| `limit` | integer 1-100 | 20 | |
| `status` | enum | — | `active`, `on_break`, or `completed` |
| `project_id` | uuid | — | |
| `date_from` | ISO 8601 | — | Filters by `clock_in_at >= date_from` |
| `date_to` | ISO 8601 | — | Filters by `clock_in_at <= date_to` |

### Example Response

```json
{
  "data": [
    {
      "id": "e39a0a2b-...",
      "status": "completed",
      "clock_in_at": "2026-04-13T14:02:11.000Z",
      "clock_out_at": "2026-04-13T22:07:42.000Z",
      "total_worked_minutes": 485,
      "project": { "id": "6a5b...", "name": "Main Street Deck", "project_number": "P-10231" },
      "task": null,
      "work_shift": null
    }
  ],
  "meta": { "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
}
```

### Error Responses

| Status | When |
|---|---|
| `401 Unauthorized` | Missing/invalid JWT |
| `404 Not Found` | Employee profile missing or inactive |

---

## Endpoint 6 — GET /active/all

Return every currently active (or on-break) session in the tenant. Used by live dashboards.

- **Method:** `GET`
- **Path:** `/api/v1/time-clock/sessions/active/all`
- **Auth:** Bearer JWT
- **Roles:** `Owner`, `Admin`, `Project Manager`

### Example Response

```json
{
  "data": [
    {
      "id": "e39a0a2b-...",
      "status": "active",
      "clock_in_at": "2026-04-13T14:02:11.000Z",
      "employee_profile": { "user": { "first_name": "Jane", "last_name": "Doe" } },
      "project": { "id": "6a5b...", "name": "Main Street Deck", "project_number": "P-10231" },
      "task": null,
      "clockin_address": null,
      "break_entries": []
    }
  ],
  "total": 1
}
```

### Error Responses

| Status | When |
|---|---|
| `401 Unauthorized` | Missing/invalid JWT |
| `403 Forbidden` | Caller lacks Owner, Admin, or Project Manager role |

---

## Endpoint 7 — GET /

Admin list of every clock session in the tenant, paginated and filterable.

- **Method:** `GET`
- **Path:** `/api/v1/time-clock/sessions`
- **Auth:** Bearer JWT
- **Roles:** `Owner`, `Admin`, `Project Manager`, `Bookkeeper`

### Query Parameters (`ListClockSessionsDto`)

| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer ≥ 1 | 1 | |
| `limit` | integer 1-100 | 20 | |
| `employee_profile_id` | uuid | — | |
| `project_id` | uuid | — | |
| `status` | enum | — | `active`, `on_break`, or `completed` |
| `date_from` | ISO 8601 | — | |
| `date_to` | ISO 8601 | — | |
| `is_flagged` | boolean | — | Accepts `true`/`false`/`1`/`0` |
| `is_manual_edit` | boolean | — | Accepts `true`/`false`/`1`/`0` |

### Example Response

```json
{
  "data": [
    {
      "id": "e39a0a2b-...",
      "status": "completed",
      "clock_in_at": "2026-04-13T14:02:11.000Z",
      "clock_out_at": "2026-04-13T22:07:42.000Z",
      "total_worked_minutes": 485,
      "regular_minutes": 480,
      "overtime_minutes": 5,
      "is_flagged": false,
      "employee_profile": { "user": { "first_name": "Jane", "last_name": "Doe" } },
      "project": { "id": "6a5b...", "name": "Main Street Deck", "project_number": "P-10231" },
      "task": null,
      "work_shift": null
    }
  ],
  "meta": { "total": 128, "page": 1, "limit": 20, "totalPages": 7 }
}
```

### Error Responses

| Status | When |
|---|---|
| `401 Unauthorized` | Missing/invalid JWT |
| `403 Forbidden` | Caller lacks one of the allowed roles |

---

## Endpoint 8 — GET /:id

Full detail for a single clock session, including break entries, edit logs, and disputes.

- **Method:** `GET`
- **Path:** `/api/v1/time-clock/sessions/:id`
- **Auth:** Bearer JWT
- **Roles:** `Owner`, `Admin`, `Project Manager`, `Bookkeeper`

### Path Parameters

| Param | Type | Description |
|---|---|---|
| `id` | uuid | Clock session ID |

### Example Response

```json
{
  "id": "e39a0a2b-...",
  "status": "completed",
  "clock_in_at": "2026-04-13T14:02:11.000Z",
  "clock_out_at": "2026-04-13T22:07:42.000Z",
  "total_worked_minutes": 485,
  "regular_minutes": 480,
  "overtime_minutes": 5,
  "is_flagged": false,
  "flag_reason": null,
  "employee_profile": { "user": { "first_name": "Jane", "last_name": "Doe" } },
  "project": { "id": "6a5b...", "name": "Main Street Deck", "project_number": "P-10231" },
  "task": null,
  "work_shift": null,
  "clockin_address": null,
  "break_entries": [],
  "edit_logs": [],
  "disputes": []
}
```

### Error Responses

| Status | When |
|---|---|
| `401 Unauthorized` | Missing/invalid JWT |
| `403 Forbidden` | Caller lacks one of the allowed roles |
| `404 Not Found` | No session with that `id` in the caller's tenant |

---

## Endpoint 9 — PATCH /:id

**Manually edit a clock session.** Owner and Admin users may correct a completed (or still-active) session. Every field that actually changes produces an **immutable** `clock_session_edit_log` row. If a time field changes, the session's `total_worked_minutes`, `regular_minutes`, and `overtime_minutes` are recalculated via `OvertimeService`. If the session's labor cost was already posted, `labor_cost_reconciliation_needed` is flipped to `true` and every tenant admin receives a `timeclock_reconciliation_needed` notification.

| Item | Value |
|---|---|
| **Method + Path** | `PATCH /api/v1/time-clock/sessions/:id` |
| **Authentication** | Bearer JWT (required) |
| **Roles** | `Owner`, `Admin` |
| **Handler** | `ClockSessionEditService.editSession()` |
| **Sprint Reference** | `sprint_11.md` |
| **Response Status** | `200 OK` |

### Path Parameters

| Name | Type | Description |
|---|---|---|
| `id` | string (uuid) | Clock session ID — scoped to caller's tenant |

### Request Body — `EditClockSessionDto`

All fields other than `reason` are optional. Omitted fields are left untouched. Providing a value identical to the current stored value is a no-op: no edit log is created.

| Field | Type | Required | Validation | Notes |
|---|---|---|---|---|
| `clock_in_at` | string (ISO-8601) | optional | `@IsDateString` | New clock-in timestamp. Triggers recalculation when changed. |
| `clock_out_at` | string (ISO-8601) | optional | `@IsDateString` | New clock-out timestamp. Triggers recalculation when changed. |
| `project_id` | string (uuid) | optional | `@IsUUID` | Reassign to a different project. No recalculation. |
| `task_id` | string (uuid) | optional | `@IsUUID` | Reassign to a different task. No recalculation. |
| `notes` | string (≤500) | optional | `@MaxLength(500)` | Update operator notes. No recalculation. |
| `reason` | string (≤500) | **required** | `@IsNotEmpty`, trimmed non-empty | Copied onto every edit-log row produced by this batch. |

**Non-editable via this endpoint:** `status`, `employee_profile_id`, `is_flagged`, `flag_reason`, `labor_cost_posted`, `labor_cost_entry_id`.

**Sensitive fields never accepted from the client:** `tenant_id`, `user_id`, `edited_by_user_id`, `id`. These come from the JWT or are server-generated.

### Example Request

```bash
curl -X PATCH https://api.lead360.app/api/v1/time-clock/sessions/62afb066-ea4b-4a76-a60d-71e81c48beaa \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "clock_in_at": "2026-04-10T07:00:00.000Z",
    "notes": "Adjusted from badge log",
    "reason": "Employee reported incorrect start time — corrected from badge log"
  }'
```

### Response 200 — Full Session Detail

The response is the same fully-hydrated detail shape returned by `GET /:id`, including the updated `edit_logs` array (ordered newest-first). Key fields to verify after an edit:

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Session ID |
| `is_manual_edit` | boolean | Always `true` after any real edit |
| `clock_in_at` | string (ISO-8601) | Reflects the new value when provided |
| `clock_out_at` | string (ISO-8601) \| null | Reflects the new value when provided |
| `total_worked_minutes` | integer | Recalculated when a time field changed |
| `regular_minutes` | integer | Recalculated when a time field changed |
| `overtime_minutes` | integer | Recalculated when a time field changed |
| `labor_cost_reconciliation_needed` | boolean | `true` when edit landed on a session with `labor_cost_posted = true` |
| `edit_logs[]` | `ClockSessionEditLog[]` | One entry per changed field, append-only |
| `break_entries[]` | `BreakEntry[]` | Included for context |
| `disputes[]` | `TimeDispute[]` | Included for context |
| `employee_profile` | object | Includes nested `user` for frontend rendering |

### `ClockSessionEditLog` Shape

| Field | Type | Notes |
|---|---|---|
| `id` | string (uuid) | Edit-log row ID |
| `tenant_id` | string (uuid) | Always the caller's tenant |
| `clock_session_id` | string (uuid) | FK to `clock_session.id` |
| `edited_by_user_id` | string (uuid) | Always the caller's `user.id` from the JWT |
| `field_changed` | string | One of: `clock_in_at`, `clock_out_at`, `project_id`, `task_id`, `notes` |
| `original_value` | string \| null | Previous value stringified (ISO-8601 for dates, UUID/text otherwise) |
| `new_value` | string \| null | New value stringified |
| `reason` | string | The reason from the edit batch — copied to every row created in that request |
| `edited_at` | string (ISO-8601) | Server timestamp |
| `edited_by` | object | `{ id, first_name, last_name }` of the editor |

### Example Response (excerpt)

```json
{
  "id": "62afb066-ea4b-4a76-a60d-71e81c48beaa",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "status": "completed",
  "clock_in_at": "2026-04-10T06:30:00.000Z",
  "clock_out_at": "2026-04-10T15:00:00.000Z",
  "total_worked_minutes": 510,
  "regular_minutes": 480,
  "overtime_minutes": 30,
  "is_manual_edit": true,
  "labor_cost_posted": false,
  "labor_cost_reconciliation_needed": false,
  "notes": "Adjusted from badge log",
  "edit_logs": [
    {
      "id": "0f0f...",
      "field_changed": "clock_out_at",
      "original_value": "2026-04-13T03:18:52.138Z",
      "new_value": "2026-04-10T15:00:00.000Z",
      "reason": "Adjusted both times based on security camera footage",
      "edited_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "edited_at": "2026-04-13T03:19:45.200Z",
      "edited_by": { "id": "32cd6d0d-...", "first_name": "Ludson", "last_name": "Menezes" }
    },
    {
      "id": "1a1a...",
      "field_changed": "clock_in_at",
      "original_value": "2026-04-10T07:00:00.000Z",
      "new_value": "2026-04-10T06:30:00.000Z",
      "reason": "Adjusted both times based on security camera footage",
      "edited_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "edited_at": "2026-04-13T03:19:45.200Z"
    }
  ],
  "break_entries": [],
  "disputes": []
}
```

### Business Rules Applied

| Rule | Trigger | Effect |
|---|---|---|
| Immutable edit log (BR-E01) | Any field value actually differs | One `clock_session_edit_log` row per changed field, never updated or deleted |
| Manual edit flag | Any real change | `is_manual_edit = true` |
| Time recalculation (BR-004B) | `clock_in_at` or `clock_out_at` changed AND session has a `clock_out_at` | `total_worked_minutes = max(0, (clock_out − clock_in) − Σ unpaid break minutes)` |
| Overtime split (BR-006) | `clock_in_at` or `clock_out_at` changed AND session has a `clock_out_at` | Delegated to `OvertimeService.calculateOvertime()`; updates `regular_minutes` / `overtime_minutes` |
| No-time recalculation skip | Only `project_id` / `task_id` / `notes` changed | Time totals left untouched |
| No-op handling | DTO fields equal existing stored values | No log rows, no update, no audit entry; current session returned |
| Labor cost reconciliation (BR-E02) | `labor_cost_posted === true` at edit time | `labor_cost_reconciliation_needed = true` + `timeclock_reconciliation_needed` notification to every tenant Owner / Admin |
| Notification failure isolation | Notification insert throws | Logged and swallowed — the edit still persists |

### Error Responses

| Status | When |
|---|---|
| `400 Bad Request` | Missing or whitespace-only `reason`, invalid date string, invalid UUID, `notes` > 500 chars |
| `401 Unauthorized` | Missing/invalid JWT |
| `403 Forbidden` | Caller lacks `Owner` / `Admin` role |
| `404 Not Found` | No session with that `id` in the caller's tenant |

```json
{
  "statusCode": 400,
  "message": "Edit reason is required",
  "error": "Bad Request",
  "timestamp": "2026-04-13T03:19:59.906Z",
  "path": "/api/v1/time-clock/sessions/62afb066-ea4b-4a76-a60d-71e81c48beaa"
}
```

### Audit

A single `audit_log` entry is written via `AuditLoggerService.logTenantChange()` per edit batch:

| Field | Value |
|---|---|
| `action` | `updated` |
| `entityType` | `clock_session` |
| `entityId` | Session ID |
| `actorUserId` | JWT user id |
| `before` | `{ <field>: <old value>, ... }` — only fields that changed |
| `after` | `{ <field>: <new value>, ... }` — only fields that changed |
| `metadata.edit_log_ids` | Array of newly created `clock_session_edit_log.id` values |
| `metadata.reason` | The reason from the DTO |
| `metadata.labor_cost_reconciliation_triggered` | `true` when the session had `labor_cost_posted = true` |

---

## Error Response Format

All non-2xx responses follow the platform-standard shape:

```json
{
  "statusCode": 403,
  "message": "You are outside all configured clock-in locations",
  "error": "Forbidden"
}
```

Validation errors (`400`) include an array of violation messages from `class-validator`:

```json
{
  "statusCode": 400,
  "message": [
    "latitude must not be less than -90",
    "longitude must be a number conforming to the specified constraints"
  ],
  "error": "Bad Request"
}
```

---

## Enums Reference

### `LocationSource`

| Value | Description |
|---|---|
| `browser_gps` | Default — HTML5 Geolocation API |
| `native_gps` | Native mobile/desktop app |
| `kiosk` | Shared kiosk device |
| `manual` | Operator-supplied coordinates |

### `GeofenceStatus`

| Value | Description |
|---|---|
| `inside` | Inside a configured clock-in address radius |
| `outside` | Outside all configured addresses (flag or block) |
| `unavailable` | GPS not supplied and `gps_unavailable_action = allow_flagged` |
| `not_enforced` | `clock_in_mode = anywhere` or no addresses configured |

### `ClockSessionStatus`

| Value | Description |
|---|---|
| `active` | Session running, not on break |
| `on_break` | Session running, currently on break |
| `completed` | Session finished |

---

## Business Rules Enforced

| Rule | Where | Enforcement |
|---|---|---|
| BR-001 — one active session per employee | `clockIn()` | Returns `409 Conflict` if an `active`/`on_break` session already exists |
| BR-003 — geofence enforcement | `clockIn()` | Calls `GeofenceService.checkGeofence()`, blocks or flags based on `geofence_violation_action` |
| BR-004 — GPS availability | `clockIn()` | Blocks or flags based on `gps_required` + `gps_unavailable_action` |
| BR-004B — total worked minutes | `clockOut()` | `(clock_out − clock_in) − Σ unpaid break minutes`, never negative |
| BR-004C — matched shift completion | `clockOut()` | Marks the matched `work_shift` as `completed` |
| BR-005 — labor cost attribution | `clockOut()` | Calls `LaborCostAttributionService.postLaborCost()` in a try/catch; failures log but do NOT fail the clock-out |
| BR-006 — overtime split | `clockOut()` | Delegates to `OvertimeService.calculateOvertime()` |
| BR-009 — shift auto-match | `clockIn()` | ±2 hour window from `scheduled_start`, closest match wins; employee project/task selection is not overridden |
| BR-015 — available projects | `findAvailableProjects()` | Respects `clock_in_mode` (anywhere / specific_addresses / active_job_sites) |
| `require_job_tag` | `clockIn()` | Returns `400 Bad Request` when project is missing |
| `require_task_tag` | `clockIn()` | Returns `400 Bad Request` when task is missing |

---

## RBAC Permission Matrix

| Endpoint | Owner | Admin | Project Manager | Bookkeeper | Employee |
|---|---|---|---|---|---|
| POST `/clock-in` | ✅ | ✅ | ✅ | ❌ | ✅ |
| POST `/clock-out` | ✅ | ✅ | ✅ | ❌ | ✅ |
| GET `/me/active` | ✅ | ✅ | ✅ | ❌ | ✅ |
| GET `/me/available-projects` | ✅ | ✅ | ✅ | ❌ | ✅ |
| GET `/mine` | ✅ | ✅ | ✅ | ❌ | ✅ |
| GET `/active/all` | ✅ | ✅ | ✅ | ❌ | ❌ |
| GET `/` | ✅ | ✅ | ✅ | ✅ | ❌ |
| GET `/:id` | ✅ | ✅ | ✅ | ✅ | ❌ |
| PATCH `/:id` | ✅ | ✅ | ❌ | ❌ | ❌ |

Enforced by `JwtAuthGuard` + `RolesGuard` + `@Roles(...)` on every route. `tenant_id` is always drawn from the JWT via `@TenantId()`.

---

## Notification Events

The clock-in path emits notifications to all users with the `Owner` or `Admin` role in the tenant. Failures to deliver notifications are swallowed so they never block the clock-in/out flow.

| Type | Trigger | Title |
|---|---|---|
| `timeclock_gps_unavailable` | GPS required but missing, and `gps_unavailable_action = allow_flagged` | `GPS Unavailable` |
| `timeclock_geofence_warning` | Employee is outside all configured addresses and `geofence_violation_action = warn_only` | `Geofence Warning` |
| `timeclock_geofence_block` | Employee is outside all configured addresses and `geofence_violation_action = block` | `Clock-In Blocked` |
| `timeclock_reconciliation_needed` | PATCH `/:id` lands on a session with `labor_cost_posted = true` | `Reconciliation Needed` |
