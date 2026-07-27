# Time Clock Module — REST API Documentation

**STATUS:** VERIFIED BY DOCUMENTATION AGENT — 2026-04-13
**Module:** `time-clock`
**Source of truth:** `/var/www/lead360.app/api/src/modules/time-clock/` (read line-by-line against this document)
**Global API prefix:** `api/v1` (set in `src/main.ts:109`)
**Base URL (prod):** `https://api.lead360.app/api/v1`
**Base URL (local):** `http://localhost:8000/api/v1`
**Swagger UI:** `http://localhost:8000/api/docs`

> Every path below is written **relative to the global prefix**. The full URL for `GET /time-clock/settings` is `http://localhost:8000/api/v1/time-clock/settings`.

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [Pagination Format](#2-pagination-format)
3. [Error Response Format](#3-error-response-format)
4. [Enum Reference](#4-enum-reference)
5. [RBAC Permission Matrix](#5-rbac-permission-matrix)
6. [Endpoints — Settings](#6-endpoints--settings)
7. [Endpoints — Employee Profiles](#7-endpoints--employee-profiles)
8. [Endpoints — Clock-In Addresses](#8-endpoints--clock-in-addresses)
9. [Endpoints — Employee-Project Assignments](#9-endpoints--employee-project-assignments)
10. [Endpoints — Work Shifts](#10-endpoints--work-shifts)
11. [Endpoints — Clock Sessions](#11-endpoints--clock-sessions)
12. [Endpoints — Breaks](#12-endpoints--breaks)
13. [Endpoints — Manual Session Edit](#13-endpoints--manual-session-edit)
14. [Endpoints — Disputes](#14-endpoints--disputes)
15. [Endpoints — Kiosk](#15-endpoints--kiosk)
16. [Endpoints — Dashboard](#16-endpoints--dashboard)
17. [Endpoints — Reports](#17-endpoints--reports)
18. [Background Jobs](#18-background-jobs)
19. [Notification Events](#19-notification-events)
20. [Appendix A — Full Clock Session Shapes](#20-appendix-a--full-clock-session-shapes)

---

## 1. Authentication

The Time Clock module uses **two authentication mechanisms** depending on the endpoint.

### 1.1 JWT Bearer Token (almost all endpoints)

All endpoints except the three `/time-clock/kiosk/*` routes require a JWT:

```
Authorization: Bearer <JWT>
```

The JWT is obtained from `POST /api/v1/auth/login` (outside this module). The JWT payload populates `req.user`, from which every controller reads:

- `req.user.tenant_id` → used as the multi-tenant filter on every query.
- `req.user.id` → the authenticated user's UUID (used for audit logs and ownership checks).
- `req.user.roles` → string array of role names (e.g. `['Owner']`, `['Admin', 'Project Manager']`).

**Tenant ID and user ID are NEVER read from the request body or query string.** Any attempt to send them as fields is silently ignored because the validation pipe is configured with `whitelist: true, forbidNonWhitelisted: true`.

### 1.2 Kiosk Token (kiosk endpoints only)

The three `/time-clock/kiosk/*` endpoints use a **kiosk token** instead of a JWT:

```
X-Kiosk-Token: <plaintext_token>
```

- The plaintext token is generated once per tenant by `POST /time-clock/settings/kiosk-token/regenerate` (see §6.3). Only a **bcrypt hash** of the token is persisted; the plaintext is returned exactly once at generation time and must be copied.
- The `KioskTokenGuard` iterates every tenant that has `kiosk_mode_enabled = true` and `kiosk_token_hash != null`, and runs `bcrypt.compare(token, hash)` until a match is found. On match, the guard attaches `kioskTenantId` and `kioskTokenHash` to the request — the tenant is resolved by the token itself.
- A missing or empty `X-Kiosk-Token` header yields `401 Missing X-Kiosk-Token header`. An unmatched token yields `401 Invalid kiosk token`.
- A tenant must have `kiosk_mode_enabled = true` (set via `PATCH /time-clock/settings`) for its kiosk token to be accepted.

### 1.3 Which mechanism does which endpoint use?

| Path prefix | Auth |
|---|---|
| `/time-clock/settings/*` | JWT |
| `/time-clock/employees/*` | JWT |
| `/time-clock/addresses/*` | JWT |
| `/time-clock/employee-projects/*` | JWT |
| `/time-clock/shifts/*` | JWT |
| `/time-clock/sessions/*` | JWT |
| `/time-clock/disputes/*` | JWT |
| `/time-clock/dashboard/*` | JWT |
| `/time-clock/reports/*` | JWT |
| `/time-clock/kiosk/*` | **Kiosk Token (`X-Kiosk-Token`)** |

---

## 2. Pagination Format

Every paginated `GET` endpoint in this module accepts these query parameters:

| Parameter | Type | Default | Max | Description |
|---|---|---|---|---|
| `page` | integer | `1` | — | 1-based page index |
| `limit` | integer | `20` (assignments list defaults to `50`; activity feed defaults to `50`) | `100` (activity feed max is `200`) | Items per page |

The standard paginated response shape is:

```json
{
  "data": [ /* array of entities */ ],
  "meta": {
    "total": 137,
    "page": 2,
    "limit": 20,
    "totalPages": 7
  }
}
```

- `total` is the full unfiltered-by-page row count.
- `totalPages = Math.ceil(total / limit)`.
- **Keys are camelCase** inside `meta` (e.g. `totalPages`, not `total_pages`).

Some endpoints return a different top-level shape (no `meta`) — those are flagged individually.

---

## 3. Error Response Format

All errors thrown by NestJS exception filters follow this shape:

```json
{
  "statusCode": 400,
  "message": "Descriptive error message",
  "error": "Bad Request"
}
```

When a DTO validation fails (class-validator), `message` becomes an **array** of human strings, one per failed validator:

```json
{
  "statusCode": 400,
  "message": [
    "pin must be longer than or equal to 4 characters",
    "PIN must be 4-6 digits"
  ],
  "error": "Bad Request"
}
```

The kiosk service also throws one custom-shaped error for wrong PINs:

```json
{
  "statusCode": 401,
  "message": "Invalid PIN",
  "remaining_attempts": 3,
  "error": "Unauthorized"
}
```

### Standard status codes used in this module

| Status | When it occurs |
|---|---|
| `200 OK` | Successful read, update, delete, or clock-out |
| `201 Created` | Successful create or clock-in |
| `400 Bad Request` | Validation failure, invalid state transition |
| `401 Unauthorized` | Missing/invalid JWT or kiosk token, wrong PIN |
| `403 Forbidden` | RBAC reject, ownership reject, geofence `block` action |
| `404 Not Found` | Entity does not exist in the tenant |
| `409 Conflict` | Duplicate (active session, duplicate assignment, pending dispute) |
| `423 Locked` | Kiosk PIN locked for 15 min after 5 failures |
| `429 Too Many Requests` | Kiosk PIN rate limit (10 attempts per minute per token) |
| `500 Internal Server Error` | Unhandled exception (should never reach production) |

---

## 4. Enum Reference

All enums below match the Prisma schema at `api/prisma/schema.prisma` lines 4926–4998.

### 4.1 `clock_in_mode`

Controls which locations are considered valid clock-in locations for the tenant.

| Value | Meaning |
|---|---|
| `anywhere` | Geofence is not enforced. Clock-in accepted from any coordinates. |
| `specific_addresses` | Only the tenant's `clockin_address` records are valid. |
| `active_job_sites` | The jobsites of the tenant's active projects are valid. |

### 4.2 `geofence_violation_action`

| Value | Meaning |
|---|---|
| `block` | Clock-in is rejected with **403** if outside every geofence. |
| `warn_only` | Clock-in succeeds, session is flagged (`is_flagged = true`). |

### 4.3 `gps_unavailable_action`

| Value | Meaning |
|---|---|
| `block` | Clock-in is rejected with **403** if no lat/lon provided. |
| `allow_flagged` | Clock-in succeeds, session is flagged. |

### 4.4 `pay_period_type`

| Value | Meaning |
|---|---|
| `weekly` | 7-day period, anchored by `pay_period_start_day` |
| `biweekly` | 14-day period, anchored by `pay_period_anchor_date` |
| `semimonthly` | 1st–15th and 16th–end-of-month |
| `monthly` | Calendar month |

### 4.5 `clock_session_status`

| Value | Meaning |
|---|---|
| `active` | Clocked in, not on break |
| `on_break` | On an unpaid or paid break |
| `completed` | Clocked out |

### 4.6 `location_source`

Where the GPS coordinates came from.

| Value | Meaning |
|---|---|
| `browser_gps` | Web browser Geolocation API (default) |
| `native_gps` | Mobile/native app GPS |
| `kiosk` | Taken from a shared kiosk device (auto-set by `KioskService`) |
| `manual` | Manually entered or missing |

### 4.7 `geofence_status`

Result of the geofence check at clock-in or clock-out.

| Value | Meaning |
|---|---|
| `inside` | Coordinates were inside at least one address radius |
| `outside` | Coordinates were outside every address |
| `unavailable` | No coordinates supplied |
| `not_enforced` | Tenant has `clock_in_mode = anywhere`, no check performed |

### 4.8 `break_type`

| Value | Meaning |
|---|---|
| `paid` | Minutes COUNT toward `total_worked_minutes` |
| `unpaid` | Minutes are subtracted from `total_worked_minutes` at clock-out |

### 4.9 `work_shift_status`

| Value | Meaning |
|---|---|
| `scheduled` | Created, not yet started |
| `in_progress` | Matched to an active clock session |
| `completed` | Matched session is closed |
| `missed` | Auto-set by the missed-shift job when threshold passed without a session |
| `cancelled` | Manually cancelled |

### 4.10 `dispute_type`

| Value | Meaning |
|---|---|
| `flag_only` | Employee raises a concern without proposing specific changes. Approving does not mutate the session. |
| `correction_request` | Employee proposes one or more specific field changes that are applied to the session on approval. Must supply at least one proposed value. |

### 4.11 `dispute_status`

| Value | Meaning |
|---|---|
| `pending` | Submitted, awaiting admin review |
| `approved` | Approved — proposed fields have been applied to the session (edit logs created) |
| `rejected` | Rejected with review notes |
| `resolved` | Used when an employee cancels their own pending dispute (`DELETE /disputes/:id`) |

### 4.12 `edit_field_type` (virtual)

The `clock_session_edit_log.field_changed` column is a free-form `VARCHAR(100)`. The service only writes these five literal strings when the corresponding field is edited:

| Value | Source |
|---|---|
| `clock_in_at` | Edit time-in |
| `clock_out_at` | Edit time-out |
| `project_id` | Re-tag project |
| `task_id` | Re-tag task |
| `notes` | Edit notes |

---

## 5. RBAC Permission Matrix

Legend: **✅** = allowed, **—** = forbidden (returns `403 Forbidden`).

> **"Employee" in this matrix covers any authenticated user whose JWT roles include the literal string `'Employee'`.** The role name used in `@Roles(...)` is exactly `'Employee'`.

| Endpoint | Owner | Admin | Project Manager | Bookkeeper | Employee |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET    /time-clock/settings` | ✅ | ✅ | — | — | — |
| `PATCH  /time-clock/settings` | ✅ | ✅ | — | — | — |
| `POST   /time-clock/settings/kiosk-token/regenerate` | ✅ | ✅ | — | — | — |
| `POST   /time-clock/employees/me/push-subscription` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/employees` | ✅ | ✅ | — | — | — |
| `POST   /time-clock/employees` | ✅ | ✅ | — | — | — |
| `GET    /time-clock/employees/:id` | ✅ | ✅ | — | — | — |
| `PATCH  /time-clock/employees/:id` | ✅ | ✅ | — | — | — |
| `POST   /time-clock/employees/:id/pin` | ✅ | ✅ | — | — | — |
| `DELETE /time-clock/employees/:id/pin` | ✅ | ✅ | — | — | — |
| `GET    /time-clock/addresses` | ✅ | ✅ | — | — | — |
| `POST   /time-clock/addresses` | ✅ | ✅ | — | — | — |
| `GET    /time-clock/addresses/:id` | ✅ | ✅ | — | — | — |
| `PATCH  /time-clock/addresses/:id` | ✅ | ✅ | — | — | — |
| `DELETE /time-clock/addresses/:id` | ✅ | ✅ | — | — | — |
| `POST   /time-clock/addresses/import-from-quote` | ✅ | ✅ | — | — | — |
| `POST   /time-clock/addresses/import-from-lead` | ✅ | ✅ | — | — | — |
| `GET    /time-clock/employee-projects` | ✅ | ✅ | — | — | — |
| `POST   /time-clock/employee-projects` | ✅ | ✅ | — | — | — |
| `DELETE /time-clock/employee-projects/:id` | ✅ | ✅ | — | — | — |
| `GET    /time-clock/shifts` | ✅ | ✅ | ✅ | — | — |
| `POST   /time-clock/shifts` | ✅ | ✅ | ✅ | — | — |
| `POST   /time-clock/shifts/bulk` | ✅ | ✅ | ✅ | — | — |
| `GET    /time-clock/shifts/mine` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/shifts/:id` | ✅ | ✅ | ✅ | — | — |
| `PATCH  /time-clock/shifts/:id` | ✅ | ✅ | ✅ | — | — |
| `DELETE /time-clock/shifts/:id` | ✅ | ✅ | ✅ | — | — |
| `POST   /time-clock/sessions/clock-in` | ✅ | ✅ | ✅ | — | ✅ |
| `POST   /time-clock/sessions/clock-out` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/sessions` | ✅ | ✅ | ✅ | ✅ | — |
| `GET    /time-clock/sessions/:id` | ✅ | ✅ | ✅ | ✅ | — |
| `PATCH  /time-clock/sessions/:id` | ✅ | ✅ | — | — | — |
| `GET    /time-clock/sessions/me/active` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/sessions/me/available-projects` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/sessions/mine` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/sessions/active/all` | ✅ | ✅ | ✅ | — | — |
| `POST   /time-clock/sessions/:id/breaks/start` | ✅ | ✅ | ✅ | — | ✅ |
| `POST   /time-clock/sessions/:id/breaks/end` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/sessions/:id/breaks` | ✅ | ✅ | ✅ | — | ✅ |
| `POST   /time-clock/sessions/:sessionId/disputes` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/disputes` | ✅ | ✅ | — | — | — |
| `GET    /time-clock/disputes/mine` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/disputes/:id` | ✅ | ✅ | ✅ | — | ✅ |
| `PATCH  /time-clock/disputes/:id/approve` | ✅ | ✅ | — | — | — |
| `PATCH  /time-clock/disputes/:id/reject` | ✅ | ✅ | — | — | — |
| `DELETE /time-clock/disputes/:id` | ✅ | ✅ | ✅ | — | ✅ |
| `GET    /time-clock/kiosk/employees` | — kiosk token — | | | | |
| `POST   /time-clock/kiosk/clock-in` | — kiosk token — | | | | |
| `POST   /time-clock/kiosk/clock-out` | — kiosk token — | | | | |
| `GET    /time-clock/dashboard/whos-in` | ✅ | ✅ | ✅ | — | — |
| `GET    /time-clock/reports/timesheet` | ✅ | ✅ | ✅ | ✅ | — |
| `GET    /time-clock/reports/payroll` | ✅ | ✅ | — | ✅ | — |
| `GET    /time-clock/reports/payroll/export` | ✅ | ✅ | — | ✅ | — |
| `GET    /time-clock/reports/shift-variance` | ✅ | ✅ | ✅ | — | — |
| `GET    /time-clock/reports/geo-violations` | ✅ | ✅ | — | — | — |
| `GET    /time-clock/reports/activity-feed` | ✅ | ✅ | ✅ | — | — |

---

## 6. Endpoints — Settings

Controller: `src/modules/time-clock/controllers/time-clock-settings.controller.ts`
Service: `src/modules/time-clock/services/time-clock-settings.service.ts`

### 6.1 `GET /time-clock/settings`

Returns the tenant's time clock configuration. If no row exists, a default object with `id: null` is returned (not a 404).

**Auth:** JWT
**Roles:** `Owner`, `Admin`

**Request body:** *none*

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/settings \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "id": "b3d1a6a8-4efa-4c5c-8f0d-4c0f7a4f6e3e",
  "tenant_id": "d7c2e5a6-1111-2222-3333-444444444444",
  "clock_in_mode": "anywhere",
  "geofence_violation_action": "warn_only",
  "gps_required": true,
  "gps_unavailable_action": "allow_flagged",
  "require_job_tag": false,
  "require_task_tag": false,
  "overtime_enabled": true,
  "overtime_daily_threshold_hours": "8.00",
  "overtime_weekly_threshold_hours": "40.00",
  "overtime_multiplier": "1.50",
  "pay_period_type": "biweekly",
  "pay_period_start_day": 1,
  "pay_period_anchor_date": "2026-01-06T00:00:00.000Z",
  "kiosk_mode_enabled": false,
  "kiosk_token_hash": null,
  "shift_reminder_minutes": 30,
  "missed_shift_threshold_minutes": 30,
  "native_app_features_enabled": false,
  "created_at": "2026-03-01T12:00:00.000Z",
  "updated_at": "2026-03-20T09:45:00.000Z"
}
```

**Field notes:**

| Field | Type | Notes |
|---|---|---|
| `id` | uuid \| null | `null` on the defaults object when no row has been saved yet |
| `overtime_daily_threshold_hours` | **string** | Decimal returned as a fixed 2-decimal string (`"8.00"`) — NOT a number. |
| `overtime_weekly_threshold_hours` | **string** | Same |
| `overtime_multiplier` | **string** | Same |
| `kiosk_token_hash` | string \| null | The bcrypt hash (never the plaintext). Do NOT display this in the UI. |
| `pay_period_start_day` | integer (0–6) \| null | 0 = Sunday, 6 = Saturday |
| `pay_period_anchor_date` | ISO 8601 \| null | Date only, time portion meaningless |

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 6.2 `PATCH /time-clock/settings`

Upserts the tenant's settings row. Every field is optional — only included fields are written. If no row exists, one is created. The response is the full settings object (same shape as §6.1).

**Auth:** JWT
**Roles:** `Owner`, `Admin`

**Request body** (all fields optional):

| Field | Type | Validation | Description |
|---|---|---|---|
| `clock_in_mode` | enum | `anywhere` \| `specific_addresses` \| `active_job_sites` | See §4.1 |
| `geofence_violation_action` | enum | `block` \| `warn_only` | See §4.2 |
| `gps_required` | boolean | — | If `true`, `gps_unavailable_action` governs missing coords |
| `gps_unavailable_action` | enum | `block` \| `allow_flagged` | See §4.3 |
| `require_job_tag` | boolean | — | If `true`, `project_id` is required at clock-in |
| `require_task_tag` | boolean | — | If `true`, `task_id` is required at clock-in |
| `overtime_enabled` | boolean | — | If `false`, `overtime_minutes` is always `0` |
| `overtime_daily_threshold_hours` | number | `0 ≤ x ≤ 24`, ≤2 decimal places | Example `8.0` |
| `overtime_weekly_threshold_hours` | number | `0 ≤ x ≤ 168`, ≤2 decimal places | Example `40.0` |
| `overtime_multiplier` | number | `1 ≤ x ≤ 5`, ≤2 decimal places | Example `1.5` |
| `pay_period_type` | enum | `weekly` \| `biweekly` \| `semimonthly` \| `monthly` | See §4.4 |
| `pay_period_start_day` | integer | `0 ≤ x ≤ 6` | 0 = Sun, 6 = Sat |
| `pay_period_anchor_date` | string | ISO 8601 date (e.g. `"2026-01-06"`) | Anchor for biweekly |
| `kiosk_mode_enabled` | boolean | — | Master switch for the kiosk guard |
| `shift_reminder_minutes` | integer | `5 ≤ x ≤ 120` | Minutes before shift start |
| `missed_shift_threshold_minutes` | integer | `5 ≤ x ≤ 120` | Minutes after shift start before auto-marking missed |

**Example request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/time-clock/settings \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "clock_in_mode": "specific_addresses",
    "geofence_violation_action": "block",
    "overtime_enabled": true,
    "overtime_daily_threshold_hours": 8,
    "overtime_multiplier": 1.5,
    "kiosk_mode_enabled": true
  }'
```

**Example response (200):**

```json
{
  "id": "b3d1a6a8-4efa-4c5c-8f0d-4c0f7a4f6e3e",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "clock_in_mode": "specific_addresses",
  "geofence_violation_action": "block",
  "gps_required": true,
  "gps_unavailable_action": "allow_flagged",
  "require_job_tag": false,
  "require_task_tag": false,
  "overtime_enabled": true,
  "overtime_daily_threshold_hours": "8.00",
  "overtime_weekly_threshold_hours": "40.00",
  "overtime_multiplier": "1.50",
  "pay_period_type": "biweekly",
  "pay_period_start_day": null,
  "pay_period_anchor_date": null,
  "kiosk_mode_enabled": true,
  "kiosk_token_hash": null,
  "shift_reminder_minutes": 30,
  "missed_shift_threshold_minutes": 30,
  "native_app_features_enabled": false,
  "created_at": "2026-04-12T21:23:17.515Z",
  "updated_at": "2026-04-13T14:00:00.000Z"
}
```

**Audit log:** `action = "updated"` (or `"created"` if this was the first write), `entityType = "time_clock_settings"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Validation failure (enum, bounds, decimal precision) | `{"statusCode":400,"message":["overtime_daily_threshold_hours must not be greater than 24"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 6.3 `POST /time-clock/settings/kiosk-token/regenerate`

Generates a new kiosk token for the tenant. **The plaintext token is returned exactly once** — only its bcrypt hash (cost 12) is stored in `time_clock_settings.kiosk_token_hash`. Re-calling this endpoint invalidates the previous token.

**Auth:** JWT
**Roles:** `Owner`, `Admin`
**HTTP status on success:** `201 Created`.

**Request body:** *none*

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/settings/kiosk-token/regenerate \
  -H "Authorization: Bearer <JWT>"
```

**Example response (201):**

```json
{
  "kiosk_token": "tc_k_3a4f1e8c6a9d2b5e7f0a1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f"
}
```

The token is always `tc_k_` followed by 96 lowercase hex characters (48 bytes of randomness).

**Audit log:** `action = "updated"`, `description = "Regenerated kiosk authentication token"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

> ⚠️ Save the returned `kiosk_token` immediately — the frontend should prompt the user to copy it into their kiosk device. There is no endpoint to fetch it again.

---

## 7. Endpoints — Employee Profiles

Controller: `src/modules/time-clock/controllers/employee-profile.controller.ts`
Service: `src/modules/time-clock/services/employee-profile.service.ts`

### Shared shape — `EmployeeProfile`

Every list/detail response returns objects of this shape. `kiosk_pin_hash` and `push_subscription_json` are **always stripped** before sending — the raw hash is NEVER serialized on any endpoint in this module.

Two derived convenience booleans are computed server-side and included on every response (`findAll`, `findOne`, `create`, `update`):

| Field | Type | Computation |
|---|---|---|
| `has_pin` | boolean | `true` if `kiosk_pin_hash` is non-null (i.e. the employee has a kiosk PIN set). |
| `is_locked` | boolean | `true` if `kiosk_pin_locked_until` is non-null AND strictly greater than the server's current time. Set by the kiosk lockout logic after repeated PIN failures. |

Use `has_pin` to decide whether to show a "Set PIN" vs "Reset PIN" button in the UI. Use `is_locked` to decide whether to show a lockout banner. You do not need to compute these yourself from `kiosk_pin_locked_until` — the backend already does it for you at response time.

```json
{
  "id": "a111...",
  "tenant_id": "d7c2...",
  "user_id": "u222...",
  "crew_member_id": "cm33...",
  "hourly_rate": "25.00",
  "overtime_rule_override": false,
  "overtime_daily_threshold_hours": null,
  "overtime_weekly_threshold_hours": null,
  "kiosk_pin_failed_attempts": 0,
  "kiosk_pin_locked_until": null,
  "is_active": true,
  "push_token_native": null,
  "has_pin": true,
  "is_locked": false,
  "created_at": "2026-03-01T12:00:00.000Z",
  "updated_at": "2026-03-20T09:45:00.000Z",

  "user": {
    "id": "u222...",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com"
  },
  "crew_member": {
    "id": "cm33...",
    "first_name": "Jane",
    "last_name": "Smith",
    "default_hourly_rate": "25.00"
  }
}
```

> `crew_member` may be `null` if `crew_member_id` is `null`. The `findOne` response additionally includes a `project_assignments` array; list/create/update do not. `kiosk_pin_hash` is never present on any response — only the derived `has_pin` boolean is.

---

### 7.1 `GET /time-clock/employees`

List employee profiles (paginated). Each row is an `EmployeeProfile` object (see shared shape above).

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `limit` | integer | `20` | Max 100 |
| `is_active` | boolean | — | Filter by active status |
| `search` | string | — | Search on `user.first_name`, `user.last_name`, `user.email` (contains, ≤100 chars) |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/employees?page=1&limit=20&is_active=true&search=jane" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "crew_member_id": null,
      "hourly_rate": "35.00",
      "overtime_rule_override": true,
      "overtime_daily_threshold_hours": "8.00",
      "overtime_weekly_threshold_hours": "40.00",
      "kiosk_pin_failed_attempts": 0,
      "kiosk_pin_locked_until": null,
      "is_active": true,
      "push_token_native": null,
      "has_pin": true,
      "is_locked": false,
      "created_at": "2026-04-12T22:37:53.590Z",
      "updated_at": "2026-04-12T22:38:34.607Z",
      "user": {
        "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane@example.com"
      },
      "crew_member": null
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

> **Decimal precision:** `hourly_rate`, `overtime_daily_threshold_hours`, `overtime_weekly_threshold_hours` are Prisma `Decimal` columns — they are serialized as strings with whatever precision was stored (e.g. `"35"`, `"35.00"`, or `"35.50"`). Always `parseFloat(value)` before displaying or computing.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 7.2 `POST /time-clock/employees`

Create an employee profile. The `user_id` must already exist in the tenant. Only one profile is allowed per `(tenant_id, user_id)` pair.

**Auth:** JWT • **Roles:** `Owner`, `Admin`
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `user_id` | uuid | ✅ | — | The underlying `user` row |
| `crew_member_id` | uuid | — | — | Link to a `crew_member` for labor-cost attribution |
| `hourly_rate` | number | — | ≥ 0, ≤2 decimals | Overrides `crew_member.default_hourly_rate` in payroll |
| `overtime_rule_override` | boolean | — | — | If `true`, use this profile's OT thresholds instead of tenant's |
| `overtime_daily_threshold_hours` | number | — | `0 ≤ x ≤ 24` | Only applied when override is `true` |
| `overtime_weekly_threshold_hours` | number | — | `0 ≤ x ≤ 168` | Only applied when override is `true` |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/employees \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "crew_member_id": "cm3a5c12-aaaa-bbbb-cccc-dddddddddddd",
    "hourly_rate": 35,
    "overtime_rule_override": true,
    "overtime_daily_threshold_hours": 8,
    "overtime_weekly_threshold_hours": 40
  }'
```

**Example response (201):**

```json
{
  "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "crew_member_id": "cm3a5c12-aaaa-bbbb-cccc-dddddddddddd",
  "hourly_rate": "35",
  "overtime_rule_override": true,
  "overtime_daily_threshold_hours": "8",
  "overtime_weekly_threshold_hours": "40",
  "kiosk_pin_failed_attempts": 0,
  "kiosk_pin_locked_until": null,
  "is_active": true,
  "push_token_native": null,
  "has_pin": false,
  "is_locked": false,
  "created_at": "2026-04-13T14:22:11.000Z",
  "updated_at": "2026-04-13T14:22:11.000Z",
  "user": {
    "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com"
  },
  "crew_member": {
    "id": "cm3a5c12-aaaa-bbbb-cccc-dddddddddddd",
    "first_name": "Jane",
    "last_name": "Smith",
    "default_hourly_rate": "33.50"
  }
}
```

> Note: `has_pin` is `false` on create because `POST /time-clock/employees` does not set a PIN. Call `POST /time-clock/employees/:id/pin` afterwards to set one, then re-fetch (or update — any subsequent response) and `has_pin` will be `true`.

**Audit log:** `action = "created"`, `entityType = "employee_profile"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Validation failure | `{"statusCode":400,"message":["user_id must be a UUID"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | `user_id` or `crew_member_id` not found in tenant | `{"statusCode":404,"message":"User not found in tenant","error":"Not Found"}` |
| `409` | Profile already exists for this `user_id` | `{"statusCode":409,"message":"Profile already exists for this user","error":"Conflict"}` |

---

### 7.3 `GET /time-clock/employees/:id`

Get one profile with the full nested context, including the employee's project assignments (not returned by the list endpoint).

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `employee_profile.id` |

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/employees/4fa4fe34-f38c-4e59-8c8f-e8f91a39558c \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "crew_member_id": "cm3a5c12-aaaa-bbbb-cccc-dddddddddddd",
  "hourly_rate": "35",
  "overtime_rule_override": true,
  "overtime_daily_threshold_hours": "8",
  "overtime_weekly_threshold_hours": "40",
  "kiosk_pin_failed_attempts": 0,
  "kiosk_pin_locked_until": null,
  "is_active": true,
  "push_token_native": null,
  "has_pin": true,
  "is_locked": false,
  "created_at": "2026-04-12T22:37:53.590Z",
  "updated_at": "2026-04-12T22:38:34.607Z",
  "user": {
    "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com"
  },
  "crew_member": {
    "id": "cm3a5c12-aaaa-bbbb-cccc-dddddddddddd",
    "first_name": "Jane",
    "last_name": "Smith",
    "default_hourly_rate": "33.50"
  },
  "project_assignments": [
    {
      "id": "epa-aaaa-1111-2222-3333-444444444444",
      "project_id": "p-aaaa-1111-2222-3333-444444444444",
      "created_at": "2026-03-12T11:00:00.000Z",
      "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel — Smith", "status": "in_progress" }
    }
  ]
}
```

> The `project_assignments[].project` object includes `id`, `name`, AND `status` (one of the `project.status` enum values, e.g. `"planned"`, `"in_progress"`, `"on_hold"`, `"completed"`, `"cancelled"`). This is the project's current lifecycle state — use it to grey out assignments for inactive projects in the UI.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Profile not found in tenant | `{"statusCode":404,"message":"Employee profile not found","error":"Not Found"}` |

---

### 7.4 `PATCH /time-clock/employees/:id`

Update an employee profile. All body fields are optional; only supplied fields are written.

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `employee_profile.id` |

**Request body (all optional):**

| Field | Type | Validation | Description |
|---|---|---|---|
| `crew_member_id` | uuid | — | Link/unlink to a `crew_member`. Pass a valid UUID to link. |
| `hourly_rate` | number | ≥ 0, ≤2 decimals | New override rate |
| `overtime_rule_override` | boolean | — | If `true`, use employee-level OT thresholds |
| `overtime_daily_threshold_hours` | number | `0 ≤ x ≤ 24` | |
| `overtime_weekly_threshold_hours` | number | `0 ≤ x ≤ 168` | |
| `is_active` | boolean | — | `false` = soft-deactivate this employee |

> Setting `is_active = false` is the module's **soft-deactivate** for an employee (no separate deactivate endpoint exists). An inactive employee cannot clock in via JWT or kiosk.

**Example request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/time-clock/employees/4fa4fe34-f38c-4e59-8c8f-e8f91a39558c \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "hourly_rate": 38.50,
    "is_active": true
  }'
```

**Example response (200):** Updated `EmployeeProfile` (same shape as §7.3 but WITHOUT the `project_assignments` array).

```json
{
  "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "crew_member_id": "cm3a5c12-aaaa-bbbb-cccc-dddddddddddd",
  "hourly_rate": "38.50",
  "overtime_rule_override": true,
  "overtime_daily_threshold_hours": "8",
  "overtime_weekly_threshold_hours": "40",
  "kiosk_pin_failed_attempts": 0,
  "kiosk_pin_locked_until": null,
  "is_active": true,
  "push_token_native": null,
  "has_pin": true,
  "is_locked": false,
  "created_at": "2026-04-12T22:37:53.590Z",
  "updated_at": "2026-04-13T14:30:02.000Z",
  "user": { "id": "...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" },
  "crew_member": { "id": "...", "first_name": "Jane", "last_name": "Smith", "default_hourly_rate": "33.50" }
}
```

**Audit log:** `action = "updated"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Validation failure | `{"statusCode":400,"message":["hourly_rate must not be less than 0"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Profile not found in tenant | `{"statusCode":404,"message":"Employee profile not found","error":"Not Found"}` |

---

### 7.5 `POST /time-clock/employees/:id/pin`

Set or replace the employee's kiosk PIN. The PIN is bcrypt-hashed (cost 12) and stored in `kiosk_pin_hash`. The plaintext PIN **never appears in any response**. Calling this endpoint also resets `kiosk_pin_failed_attempts` to `0` and clears `kiosk_pin_locked_until`.

**Auth:** JWT • **Roles:** `Owner`, `Admin`
**HTTP status on success:** `201 Created`.

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `employee_profile.id` |

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `pin` | string | ✅ | 4–6 characters, `^\d{4,6}$` | Numeric only (digits `0`–`9`) |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/employees/4fa4fe34-f38c-4e59-8c8f-e8f91a39558c/pin \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{ "pin": "4821" }'
```

**Example response (201):**

```json
{ "message": "PIN updated successfully" }
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | PIN is missing, shorter than 4, longer than 6, or contains non-digits | `{"statusCode":400,"message":["PIN must be 4-6 digits"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Employee profile not found in tenant | `{"statusCode":404,"message":"Employee profile not found","error":"Not Found"}` |

---

### 7.6 `DELETE /time-clock/employees/:id/pin`

Remove the employee's kiosk PIN (sets `kiosk_pin_hash = null`). After this, the employee no longer appears in `GET /time-clock/kiosk/employees` and cannot clock in or out via the kiosk until a new PIN is set.

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `employee_profile.id` |

**Request body:** *none*

**Example request:**

```bash
curl -X DELETE https://api.lead360.app/api/v1/time-clock/employees/4fa4fe34-f38c-4e59-8c8f-e8f91a39558c/pin \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{ "message": "PIN removed successfully" }
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Employee profile not found in tenant | `{"statusCode":404,"message":"Employee profile not found","error":"Not Found"}` |

---

### 7.7 `POST /time-clock/employees/me/push-subscription`

Save a Web Push subscription JSON string on the authenticated user's employee profile. Used by the frontend to receive shift reminder / missed shift notifications on the device. The string is stored verbatim in `employee_profile.push_subscription_json` and delivered back to the notifications worker when it fires a push.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `push_subscription_json` | string | ✅ | non-empty | The `JSON.stringify(subscription)` output from `serviceWorker.pushManager.subscribe()`. Opaque to the backend — pass it through as-is. |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/employees/me/push-subscription \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "push_subscription_json": "{\"endpoint\":\"https://fcm.googleapis.com/fcm/send/abc...\",\"expirationTime\":null,\"keys\":{\"p256dh\":\"BNc...\",\"auth\":\"abc...\"}}"
  }'
```

**Example response (201):**

```json
{ "message": "Push subscription saved" }
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | `push_subscription_json` missing or empty | `{"statusCode":400,"message":["push_subscription_json should not be empty"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller has no role that can access this route | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Caller has no `employee_profile` in this tenant | `{"statusCode":404,"message":"No employee profile found for current user","error":"Not Found"}` |

> **Route order warning:** The controller registers this route BEFORE `/employees/:id` on purpose. NestJS walks routes top-down; swapping the order would make Express treat `"me"` as the `:id` path parameter and return `400` (not a UUID).

---

## 8. Endpoints — Clock-In Addresses

Controller: `src/modules/time-clock/controllers/clockin-address.controller.ts`
Service: `src/modules/time-clock/services/clockin-address.service.ts`

### Shared shape — `ClockinAddress`

```json
{
  "id": "ca-uuid",
  "tenant_id": "d7c2...",
  "project_id": "p-uuid",
  "label": "Main Office",
  "address_line1": "123 Main St",
  "address_line2": "Suite 200",
  "city": "Austin",
  "state": "TX",
  "zip_code": "78701",
  "latitude": "30.26715000",
  "longitude": "-97.74306000",
  "radius_meters": 100,
  "is_active": true,
  "source": "manual",
  "source_address_id": null,
  "created_by_user_id": "u222...",
  "created_at": "2026-03-01T12:00:00.000Z",
  "updated_at": "2026-03-20T09:45:00.000Z",
  "project": { "id": "p-uuid", "name": "Main Office Upfit" }
}
```

- `latitude` / `longitude` are **Prisma Decimal** strings, not JSON numbers.
- `source` is always one of `manual`, `imported_from_quote`, `imported_from_lead`.
- `project` is `null` when `project_id` is `null`.

---

### 8.1 `GET /time-clock/addresses`

List clock-in addresses (paginated). Each row is a `ClockinAddress` object (see shared shape above).

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `limit` | integer | `20` | Max 100 |
| `is_active` | boolean | — | Accepts `"true"` / `"false"` strings |
| `project_id` | uuid | — | Exact match |
| `search` | string | — | Contains match on `label` (≤255 chars) |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/addresses?page=1&limit=20&is_active=true" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "ca-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "project_id": null,
      "label": "Main Office",
      "address_line1": "123 Main St",
      "address_line2": "Suite 200",
      "city": "Austin",
      "state": "TX",
      "zip_code": "78701",
      "latitude": "30.26715000",
      "longitude": "-97.74306000",
      "radius_meters": 100,
      "is_active": true,
      "source": "manual",
      "source_address_id": null,
      "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "created_at": "2026-03-01T12:00:00.000Z",
      "updated_at": "2026-03-20T09:45:00.000Z",
      "project": null
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 8.2 `POST /time-clock/addresses`

Create a clock-in address. If both `latitude` and `longitude` are provided the service skips geocoding; otherwise it calls the internal geocoder on the supplied US street/city/state/zip and populates the coordinates automatically.

**Auth:** JWT • **Roles:** `Owner`, `Admin`
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `label` | string | ✅ | 1–100 chars | UI display name |
| `address_line1` | string | ✅ | 1–255 chars | |
| `address_line2` | string | — | ≤255 chars | |
| `city` | string | — | ≤100 chars | |
| `state` | string | — | ≤2 chars | US state abbreviation (e.g. `"TX"`) |
| `zip_code` | string | ✅ | 1–10 chars | |
| `latitude` | number | — | — | If supplied together with `longitude`, skips geocoding |
| `longitude` | number | — | — | |
| `radius_meters` | integer | — | `25 ≤ x ≤ 5000` | Default `100` |
| `project_id` | uuid | — | — | Optional link to a project |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/addresses \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Main Office",
    "address_line1": "123 Main St",
    "address_line2": "Suite 200",
    "city": "Austin",
    "state": "TX",
    "zip_code": "78701",
    "radius_meters": 100
  }'
```

**Example response (201):**

```json
{
  "id": "ca-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "project_id": null,
  "label": "Main Office",
  "address_line1": "123 Main St",
  "address_line2": "Suite 200",
  "city": "Austin",
  "state": "TX",
  "zip_code": "78701",
  "latitude": "30.26715000",
  "longitude": "-97.74306000",
  "radius_meters": 100,
  "is_active": true,
  "source": "manual",
  "source_address_id": null,
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-04-13T14:35:00.000Z",
  "updated_at": "2026-04-13T14:35:00.000Z",
  "project": null
}
```

**Audit log:** `action = "created"`, `entityType = "clockin_address"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Validation failure | `{"statusCode":400,"message":["label must be longer than or equal to 1 characters"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | `project_id` passed but project not found in tenant | `{"statusCode":404,"message":"Project not found","error":"Not Found"}` |

---

### 8.3 `GET /time-clock/addresses/:id`

Get a single clock-in address by ID.

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `clockin_address.id` |

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/addresses/ca-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):** See §8.2 response shape — identical fields.

```json
{
  "id": "ca-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "label": "Main Office",
  "address_line1": "123 Main St",
  "address_line2": "Suite 200",
  "city": "Austin",
  "state": "TX",
  "zip_code": "78701",
  "latitude": "30.26715000",
  "longitude": "-97.74306000",
  "radius_meters": 100,
  "is_active": true,
  "source": "manual",
  "source_address_id": null,
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-03-01T12:00:00.000Z",
  "updated_at": "2026-03-20T09:45:00.000Z",
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Main Office Upfit" }
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Address not found in tenant | `{"statusCode":404,"message":"Address not found","error":"Not Found"}` |

---

### 8.4 `PATCH /time-clock/addresses/:id`

Update an address. Changes to `address_line1`/`address_line2`/`city`/`state`/`zip_code` cause re-geocoding (new lat/lon are written automatically).

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `clockin_address.id` |

**Request body (all optional):**

| Field | Type | Validation | Description |
|---|---|---|---|
| `label` | string | 1–100 chars | |
| `address_line1` | string | 1–255 chars | |
| `address_line2` | string | ≤255 chars | |
| `city` | string | ≤100 chars | |
| `state` | string | ≤2 chars | |
| `zip_code` | string | ≤10 chars | The PATCH DTO enforces only a max length — there is no min length. |
| `radius_meters` | integer | `25 ≤ x ≤ 5000` | |
| `is_active` | boolean | — | `false` = soft-deactivate |
| `project_id` | uuid | — | Link/unlink to a project |

**Example request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/time-clock/addresses/ca-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Main Office (Downtown)",
    "radius_meters": 150
  }'
```

**Example response (200):** Updated `ClockinAddress` — identical shape to §8.3.

```json
{
  "id": "ca-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "project_id": null,
  "label": "Main Office (Downtown)",
  "address_line1": "123 Main St",
  "address_line2": "Suite 200",
  "city": "Austin",
  "state": "TX",
  "zip_code": "78701",
  "latitude": "30.26715000",
  "longitude": "-97.74306000",
  "radius_meters": 150,
  "is_active": true,
  "source": "manual",
  "source_address_id": null,
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-03-01T12:00:00.000Z",
  "updated_at": "2026-04-13T14:40:00.000Z",
  "project": null
}
```

**Audit log:** `action = "updated"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Validation failure | `{"statusCode":400,"message":["radius_meters must not be less than 25"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Address or passed `project_id` not found | `{"statusCode":404,"message":"Address not found","error":"Not Found"}` |

---

### 8.5 `DELETE /time-clock/addresses/:id`

Soft-delete — sets `is_active = false`. The row is never physically removed; existing `clock_session.clockin_address_id` references stay intact so old sessions still render their address.

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `clockin_address.id` |

**Request body:** *none*

**Example request:**

```bash
curl -X DELETE https://api.lead360.app/api/v1/time-clock/addresses/ca-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{ "message": "Address deactivated successfully" }
```

**Audit log:** `action = "deleted"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Address not found in tenant | `{"statusCode":404,"message":"Address not found","error":"Not Found"}` |

---

### 8.6 `POST /time-clock/addresses/import-from-quote`

Clone the jobsite address from a quote into a new `clockin_address` row. The quote must have a jobsite address set, and the street/city/state/zip are copied verbatim (no re-geocoding — lat/lon come from the quote's original geocode).

**Auth:** JWT • **Roles:** `Owner`, `Admin`
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `quote_id` | uuid | ✅ | — | Source quote ID |
| `label` | string | ✅ | 1–100 chars | Label for the new address row |
| `project_id` | uuid | — | — | Optional project link |
| `radius_meters` | integer | — | `25 ≤ x ≤ 5000`, default `100` | |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/addresses/import-from-quote \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_id": "q-aaaa-1111-2222-3333-444444444444",
    "label": "Quote #1042 Jobsite",
    "radius_meters": 100
  }'
```

**Example response (201):**

```json
{
  "id": "ca-bbbb-2222-3333-4444-555555555555",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "project_id": null,
  "label": "Quote #1042 Jobsite",
  "address_line1": "456 Elm Ave",
  "address_line2": null,
  "city": "Austin",
  "state": "TX",
  "zip_code": "78704",
  "latitude": "30.24500000",
  "longitude": "-97.76000000",
  "radius_meters": 100,
  "is_active": true,
  "source": "imported_from_quote",
  "source_address_id": "q-jobsite-aaaa-1111-2222-3333-4444",
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-04-13T14:50:00.000Z",
  "updated_at": "2026-04-13T14:50:00.000Z",
  "project": null
}
```

**Audit log:** `action = "created"`, `entityType = "clockin_address"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Quote exists but has no jobsite address | `{"statusCode":400,"message":"Quote does not have a jobsite address","error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | `quote_id` or `project_id` not found in tenant | `{"statusCode":404,"message":"Quote not found","error":"Not Found"}` |

---

### 8.7 `POST /time-clock/addresses/import-from-lead`

Clone a `lead_address` row into a new `clockin_address`. Street/city/state/zip are copied verbatim from the lead address; lat/lon come from the lead address's original geocode.

**Auth:** JWT • **Roles:** `Owner`, `Admin`
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `lead_address_id` | uuid | ✅ | — | Source `lead_address.id` |
| `label` | string | ✅ | 1–100 chars | Label for the new address row |
| `project_id` | uuid | — | — | Optional project link |
| `radius_meters` | integer | — | `25 ≤ x ≤ 5000`, default `100` | |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/addresses/import-from-lead \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_address_id": "la-aaaa-1111-2222-3333-444444444444",
    "label": "Smith Residence",
    "radius_meters": 100
  }'
```

**Example response (201):**

```json
{
  "id": "ca-cccc-3333-4444-5555-666666666666",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "project_id": null,
  "label": "Smith Residence",
  "address_line1": "789 Oak Lane",
  "address_line2": null,
  "city": "Round Rock",
  "state": "TX",
  "zip_code": "78664",
  "latitude": "30.50830000",
  "longitude": "-97.67890000",
  "radius_meters": 100,
  "is_active": true,
  "source": "imported_from_lead",
  "source_address_id": "la-aaaa-1111-2222-3333-444444444444",
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-04-13T14:55:00.000Z",
  "updated_at": "2026-04-13T14:55:00.000Z",
  "project": null
}
```

**Audit log:** `action = "created"`, `entityType = "clockin_address"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | `lead_address_id` or `project_id` not found in tenant | `{"statusCode":404,"message":"Lead address not found","error":"Not Found"}` |

---

## 9. Endpoints — Employee-Project Assignments

Controller: `src/modules/time-clock/controllers/employee-project-assignment.controller.ts`
Service: `src/modules/time-clock/services/employee-project-assignment.service.ts`

This endpoint group controls which employees are allowed to clock in to which projects when `time_clock_settings.clock_in_mode` is `specific_addresses` or `active_job_sites`.

### Shared shape — `EmployeeProjectAssignment`

```json
{
  "id": "epa-uuid",
  "tenant_id": "d7c2...",
  "employee_profile_id": "a111...",
  "project_id": "p-uuid",
  "assigned_by_user_id": "u222...",
  "created_at": "2026-03-12T11:00:00.000Z",
  "employee_profile": {
    "id": "a111...",
    "tenant_id": "...",
    "user_id": "u222...",
    "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
  },
  "project": { "id": "p-uuid", "name": "Kitchen Remodel" }
}
```

---

### 9.1 `GET /time-clock/employee-projects`

List employee-project assignments (paginated).

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `limit` | integer | `50` | Max 100 |
| `employee_profile_id` | uuid | — | Filter by employee |
| `project_id` | uuid | — | Filter by project |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/employee-projects?page=1&limit=50&employee_profile_id=4fa4fe34-f38c-4e59-8c8f-e8f91a39558c" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "epa-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "project_id": "p-aaaa-1111-2222-3333-444444444444",
      "assigned_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "created_at": "2026-03-12T11:00:00.000Z",
      "employee_profile": {
        "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
        "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
        "user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
        "user": {
          "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
          "first_name": "Jane",
          "last_name": "Smith",
          "email": "jane@example.com"
        }
      },
      "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 50, "totalPages": 1 }
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 9.2 `POST /time-clock/employee-projects`

Create a single assignment linking an employee to a project. A unique constraint on `(tenant_id, employee_profile_id, project_id)` prevents duplicates.

**Auth:** JWT • **Roles:** `Owner`, `Admin`
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `employee_profile_id` | uuid | ✅ | — | Must exist in tenant |
| `project_id` | uuid | ✅ | — | Must exist in tenant |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/employee-projects \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "project_id": "p-aaaa-1111-2222-3333-444444444444"
  }'
```

**Example response (201):**

```json
{
  "id": "epa-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "assigned_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-04-13T15:00:00.000Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
    "user": { "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
  },
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" }
}
```

**Audit log:** `action = "created"`, `entityType = "employee_project_assignment"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Validation failure | `{"statusCode":400,"message":["employee_profile_id must be a UUID"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Employee profile or project not found in tenant | `{"statusCode":404,"message":"Employee profile not found","error":"Not Found"}` |
| `409` | Duplicate assignment already exists | `{"statusCode":409,"message":"Employee is already assigned to this project","error":"Conflict"}` |

---

### 9.3 `DELETE /time-clock/employee-projects/:id`

Remove an employee-project assignment (hard delete — no soft flag on this table).

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `employee_project_assignment.id` |

**Request body:** *none*

**Example request:**

```bash
curl -X DELETE https://api.lead360.app/api/v1/time-clock/employee-projects/epa-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{ "message": "Assignment removed successfully" }
```

**Audit log:** `action = "deleted"`, `entityType = "employee_project_assignment"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Assignment not found in tenant | `{"statusCode":404,"message":"Assignment not found","error":"Not Found"}` |

---

## 10. Endpoints — Work Shifts

Controller: `src/modules/time-clock/controllers/work-shift.controller.ts`
Service: `src/modules/time-clock/services/work-shift.service.ts`

### Shared shape — `WorkShift`

```json
{
  "id": "ws-uuid",
  "tenant_id": "d7c2...",
  "employee_profile_id": "a111...",
  "project_id": "p-uuid",
  "task_id": "t-uuid",
  "scheduled_start": "2026-04-10T08:00:00.000Z",
  "scheduled_end": "2026-04-10T17:00:00.000Z",
  "title": "Morning Shift",
  "notes": null,
  "status": "scheduled",
  "reminder_sent_at": null,
  "published_at": "2026-04-09T12:00:00.000Z",
  "created_by_user_id": "u222...",
  "created_at": "2026-04-09T11:55:00.000Z",
  "updated_at": "2026-04-09T11:55:00.000Z",

  "employee_profile": {
    "id": "a111...",
    "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
  },
  "project": { "id": "p-uuid", "name": "Kitchen Remodel" }
}
```

- **List/create/update/bulk** responses do NOT include `task`. **`findOne` (GET :id)** additionally includes `task: { id, title }`.
- **`findMine`** returns a lighter shape: no `employee_profile`, but includes both `project` and `task` (id + name/title).

---

### 10.1 `GET /time-clock/shifts`

List shifts for the whole tenant (paginated).

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `limit` | integer | `20` | Max 100 |
| `employee_profile_id` | uuid | — | Filter by employee |
| `project_id` | uuid | — | Filter by project |
| `date_from` | ISO 8601 | — | Filters `scheduled_start >= date_from` |
| `date_to` | ISO 8601 | — | Filters `scheduled_end <= date_to` |
| `status` | enum | — | `scheduled` \| `in_progress` \| `completed` \| `missed` \| `cancelled` |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/shifts?date_from=2026-04-01&date_to=2026-04-30&status=scheduled" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "ws-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "project_id": "p-aaaa-1111-2222-3333-444444444444",
      "task_id": null,
      "scheduled_start": "2026-04-10T08:00:00.000Z",
      "scheduled_end": "2026-04-10T17:00:00.000Z",
      "title": "Morning Shift",
      "notes": null,
      "status": "scheduled",
      "reminder_sent_at": null,
      "published_at": "2026-04-09T12:00:00.000Z",
      "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "created_at": "2026-04-09T11:55:00.000Z",
      "updated_at": "2026-04-09T11:55:00.000Z",
      "employee_profile": {
        "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
        "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
      },
      "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

> The list response does NOT include `task`. For the task object, use `GET /shifts/:id` (§10.5).

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 10.2 `POST /time-clock/shifts`

Create a single shift. `published_at` is automatically set to `now()` on create — the shift is immediately eligible for reminders from the background job.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `employee_profile_id` | uuid | ✅ | — | Must exist in tenant |
| `project_id` | uuid | — | — | Optional project tag |
| `task_id` | uuid | — | — | Optional task tag |
| `scheduled_start` | ISO 8601 | ✅ | — | |
| `scheduled_end` | ISO 8601 | ✅ | — | Must be after `scheduled_start` |
| `title` | string | — | ≤100 chars | UI display label |
| `notes` | string | — | free text | |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/shifts \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "project_id": "p-aaaa-1111-2222-3333-444444444444",
    "scheduled_start": "2026-04-10T08:00:00.000Z",
    "scheduled_end": "2026-04-10T17:00:00.000Z",
    "title": "Morning Shift"
  }'
```

**Example response (201):**

```json
{
  "id": "ws-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "task_id": null,
  "scheduled_start": "2026-04-10T08:00:00.000Z",
  "scheduled_end": "2026-04-10T17:00:00.000Z",
  "title": "Morning Shift",
  "notes": null,
  "status": "scheduled",
  "reminder_sent_at": null,
  "published_at": "2026-04-13T15:10:00.000Z",
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-04-13T15:10:00.000Z",
  "updated_at": "2026-04-13T15:10:00.000Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
  },
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" }
}
```

**Audit log:** `action = "created"`, `entityType = "work_shift"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Validation failure (e.g. end before start) | `{"statusCode":400,"message":["scheduled_end must be after scheduled_start"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Employee profile, project, or task not found in tenant | `{"statusCode":404,"message":"Employee profile not found","error":"Not Found"}` |

---

### 10.3 `POST /time-clock/shifts/bulk`

Create up to 50 shifts atomically. If any shift in the batch fails validation, the whole request fails — nothing is persisted. Every shift inside the request body must be a complete `CreateWorkShiftDto` (see §10.2).

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `shifts` | array | ✅ | 1 ≤ length ≤ 50 | Array of CreateWorkShiftDto objects |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/shifts/bulk \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "shifts": [
      {
        "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
        "project_id": "p-aaaa-1111-2222-3333-444444444444",
        "scheduled_start": "2026-04-13T08:00:00.000Z",
        "scheduled_end": "2026-04-13T17:00:00.000Z",
        "title": "Mon"
      },
      {
        "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
        "project_id": "p-aaaa-1111-2222-3333-444444444444",
        "scheduled_start": "2026-04-14T08:00:00.000Z",
        "scheduled_end": "2026-04-14T17:00:00.000Z",
        "title": "Tue"
      }
    ]
  }'
```

**Example response (201):**

```json
{
  "created": 2,
  "shifts": [
    {
      "id": "ws-mmmm-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "project_id": "p-aaaa-1111-2222-3333-444444444444",
      "task_id": null,
      "scheduled_start": "2026-04-13T08:00:00.000Z",
      "scheduled_end": "2026-04-13T17:00:00.000Z",
      "title": "Mon",
      "notes": null,
      "status": "scheduled",
      "reminder_sent_at": null,
      "published_at": "2026-04-13T15:15:00.000Z",
      "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "created_at": "2026-04-13T15:15:00.000Z",
      "updated_at": "2026-04-13T15:15:00.000Z",
      "employee_profile": {
        "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
        "user": { "id": "...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
      },
      "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" }
    },
    {
      "id": "ws-tttt-2222-3333-4444-555555555555",
      "title": "Tue",
      "scheduled_start": "2026-04-14T08:00:00.000Z",
      "scheduled_end": "2026-04-14T17:00:00.000Z",
      "status": "scheduled",
      "employee_profile": { "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c", "user": { "first_name": "Jane", "last_name": "Smith" } },
      "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" }
    }
  ]
}
```

**Audit log:** One `action = "created"` entry per shift row.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Any shift fails validation OR array size is 0 or > 50 | `{"statusCode":400,"message":["shifts must contain at least 1 elements"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | A referenced employee/project/task not found | `{"statusCode":404,"message":"Employee profile not found","error":"Not Found"}` |

---

### 10.4 `GET /time-clock/shifts/mine`

List the authenticated user's shifts (paginated). Uses a lighter include than `/shifts` — no `employee_profile` field, but both `project` AND `task` are returned.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `limit` | integer | `20` | Max 100 |
| `date_from` | ISO 8601 | — | Filters `scheduled_start >= date_from` |
| `date_to` | ISO 8601 | — | Filters `scheduled_end <= date_to` |
| `status` | enum | — | `scheduled` \| `in_progress` \| `completed` \| `missed` \| `cancelled` |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/shifts/mine?date_from=2026-04-01&date_to=2026-04-30" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "ws-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "project_id": "p-aaaa-1111-2222-3333-444444444444",
      "task_id": "t-aaaa-1111-2222-3333-444444444444",
      "scheduled_start": "2026-04-10T08:00:00.000Z",
      "scheduled_end": "2026-04-10T17:00:00.000Z",
      "title": "Morning Shift",
      "notes": null,
      "status": "scheduled",
      "reminder_sent_at": null,
      "published_at": "2026-04-09T12:00:00.000Z",
      "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "created_at": "2026-04-09T11:55:00.000Z",
      "updated_at": "2026-04-09T11:55:00.000Z",
      "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" },
      "task": { "id": "t-aaaa-1111-2222-3333-444444444444", "title": "Install cabinets" }
    }
  ],
  "meta": { "total": 12, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `404` | Caller has no `employee_profile` in this tenant | `{"statusCode":404,"message":"No employee profile found for current user","error":"Not Found"}` |

---

### 10.5 `GET /time-clock/shifts/:id`

Get a single shift by ID. This response includes the `task` object, which the list endpoint (`GET /shifts`) does not.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `work_shift.id` |

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/shifts/ws-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "id": "ws-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "task_id": "t-aaaa-1111-2222-3333-444444444444",
  "scheduled_start": "2026-04-10T08:00:00.000Z",
  "scheduled_end": "2026-04-10T17:00:00.000Z",
  "title": "Morning Shift",
  "notes": null,
  "status": "scheduled",
  "reminder_sent_at": null,
  "published_at": "2026-04-09T12:00:00.000Z",
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-04-09T11:55:00.000Z",
  "updated_at": "2026-04-09T11:55:00.000Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
  },
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" },
  "task": { "id": "t-aaaa-1111-2222-3333-444444444444", "title": "Install cabinets" }
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Shift not found in tenant | `{"statusCode":404,"message":"Work shift not found","error":"Not Found"}` |

---

### 10.6 `PATCH /time-clock/shifts/:id`

Update a shift. All fields optional. The `status` field may be set to any enum value — typically used to `cancel` a shift or to manually correct after an automatic state transition.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `work_shift.id` |

**Request body (all optional):**

| Field | Type | Validation | Description |
|---|---|---|---|
| `employee_profile_id` | uuid | — | Reassign to a different employee |
| `project_id` | uuid | — | Retag to a different project |
| `task_id` | uuid | — | Retag to a different task |
| `scheduled_start` | ISO 8601 | — | |
| `scheduled_end` | ISO 8601 | — | Must be after `scheduled_start` |
| `title` | string | ≤100 chars | |
| `notes` | string | — | |
| `status` | enum | `scheduled` \| `in_progress` \| `completed` \| `missed` \| `cancelled` | |

**Example request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/time-clock/shifts/ws-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Morning Shift — reassigned",
    "status": "cancelled",
    "notes": "Employee called in sick"
  }'
```

**Example response (200):** Updated `WorkShift` — same shape as §10.2 response.

```json
{
  "id": "ws-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "task_id": null,
  "scheduled_start": "2026-04-10T08:00:00.000Z",
  "scheduled_end": "2026-04-10T17:00:00.000Z",
  "title": "Morning Shift — reassigned",
  "notes": "Employee called in sick",
  "status": "cancelled",
  "reminder_sent_at": null,
  "published_at": "2026-04-09T12:00:00.000Z",
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-04-09T11:55:00.000Z",
  "updated_at": "2026-04-13T15:20:00.000Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
  },
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" }
}
```

**Audit log:** `action = "updated"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Validation failure | `{"statusCode":400,"message":["status must be one of..."],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Shift not found in tenant | `{"statusCode":404,"message":"Work shift not found","error":"Not Found"}` |

---

### 10.7 `DELETE /time-clock/shifts/:id`

Hard-delete a shift. Only shifts in `scheduled` status can be deleted — once a shift has been matched to a session (`in_progress`, `completed`, `missed`, `cancelled`) the request returns `400`. For non-`scheduled` shifts, use `PATCH` with `status = "cancelled"` instead.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `work_shift.id` |

**Request body:** *none*

**Example request:**

```bash
curl -X DELETE https://api.lead360.app/api/v1/time-clock/shifts/ws-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{ "message": "Shift deleted successfully" }
```

**Audit log:** `action = "deleted"`, `entityType = "work_shift"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Shift is not in `scheduled` status | `{"statusCode":400,"message":"Cannot delete shift in current status","error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Shift not found in tenant | `{"statusCode":404,"message":"Work shift not found","error":"Not Found"}` |

---

## 11. Endpoints — Clock Sessions

Controller: `src/modules/time-clock/controllers/clock-session.controller.ts`
Services: `clock-session.service.ts`, `clock-session-edit.service.ts`

This is the heart of the module. A **clock session** represents one uninterrupted period between a clock-in and its matching clock-out.

### Key concepts

- **Active session:** a row with `status = 'active'` or `status = 'on_break'` and `clock_out_at IS NULL`.
- **One active session per employee.** Attempting a second `clock-in` while one is active returns `409`.
- **Geofence enforcement** happens inside `clockIn()` using `GeofenceService` and the tenant's `clock_in_mode` and `geofence_violation_action`.
- **Automatic work_shift matching:** on `clockIn`, the service searches for a `work_shift` row for the same employee within a **±2 hour window** of `scheduled_start`/`scheduled_end` and links it via `work_shift_id`. If matched, the shift is bumped from `scheduled` to `in_progress`.
- **Overtime calculation** happens on `clockOut` via `OvertimeService`, using either the tenant's thresholds or the employee's override.
- **Labor cost posting** happens fire-and-forget on `clockOut` via `LaborCostAttributionService` — failures are logged but do not fail the request. If the post succeeds, `labor_cost_posted = true`.

### `ClockSession` — list shape (used by `findAll`, `findMine`, `findAllActive`)

```json
{
  "id": "cs-uuid",
  "tenant_id": "d7c2...",
  "employee_profile_id": "a111...",
  "work_shift_id": "ws-uuid",
  "project_id": "p-uuid",
  "task_id": "t-uuid",
  "clockin_address_id": "ca-uuid",
  "status": "active",
  "clock_in_at": "2026-04-10T07:58:32.000Z",
  "clock_out_at": null,
  "clock_in_latitude": "30.26715000",
  "clock_in_longitude": "-97.74306000",
  "clock_in_location_source": "browser_gps",
  "clock_in_geofence_status": "inside",
  "clock_out_latitude": null,
  "clock_out_longitude": null,
  "clock_out_location_source": "browser_gps",
  "clock_out_geofence_status": "not_enforced",
  "total_worked_minutes": null,
  "regular_minutes": null,
  "overtime_minutes": null,
  "is_manual_edit": false,
  "is_flagged": false,
  "flag_reason": null,
  "labor_cost_posted": false,
  "labor_cost_entry_id": null,
  "labor_cost_reconciliation_needed": false,
  "notes": "Starting at the main site",
  "created_at": "2026-04-10T07:58:32.000Z",
  "updated_at": "2026-04-10T07:58:32.000Z",

  "employee_profile": {
    "id": "a111...",
    "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
  },
  "project": { "id": "p-uuid", "name": "Kitchen Remodel", "project_number": "2026-042" },
  "task": { "id": "t-uuid", "title": "Install cabinets" },
  "work_shift": { "id": "ws-uuid", "scheduled_start": "...", "scheduled_end": "...", "status": "in_progress" }
}
```

### `ClockSession` — detail shape (used by `findOne`, `clockIn`, `clockOut`, `PATCH /:id`)

The detail shape starts with all the above fields PLUS:

```json
{
  "employee_profile": {
    "id": "a111...",
    "user": { "id": "...", "first_name": "...", "last_name": "...", "email": "..." },
    "crew_member": { "id": "...", "first_name": "...", "last_name": "..." }
  },
  "project": { "id": "...", "name": "...", "project_number": "...", "status": "..." },
  "task": { "id": "...", "title": "...", "status": "..." },
  "work_shift": { "id": "...", "scheduled_start": "...", "scheduled_end": "...", "status": "...", "title": "..." },
  "clockin_address": { "id": "...", "label": "...", "latitude": "...", "longitude": "..." },
  "break_entries": [
    {
      "id": "be-uuid",
      "break_type": "unpaid",
      "break_label": "Lunch",
      "started_at": "2026-04-10T12:00:00.000Z",
      "ended_at": "2026-04-10T12:30:00.000Z",
      "duration_minutes": 30
    }
  ],
  "edit_logs": [
    {
      "id": "el-uuid",
      "field_changed": "clock_in_at",
      "original_value": "2026-04-10T07:58:32.000Z",
      "new_value": "2026-04-10T08:00:00.000Z",
      "reason": "Rounded to scheduled start",
      "edited_at": "2026-04-10T17:05:00.000Z",
      "edited_by_user_id": "admin-uuid",
      "edited_by": { "id": "admin-uuid", "first_name": "Adam", "last_name": "Admin" }
    }
  ],
  "disputes": [
    {
      "id": "td-uuid",
      "dispute_type": "correction_request",
      "status": "pending",
      "description": "..."
    }
  ]
}
```

---

### 11.1 `POST /time-clock/sessions/clock-in`

Start a new work session for the authenticated user.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `project_id` | uuid | conditional | — | Required when `time_clock_settings.require_job_tag = true` |
| `task_id` | uuid | conditional | — | Required when `time_clock_settings.require_task_tag = true` |
| `latitude` | number | conditional | `-90 ≤ x ≤ 90`, ≤8 decimals | See GPS rules |
| `longitude` | number | conditional | `-180 ≤ x ≤ 180`, ≤8 decimals | See GPS rules |
| `location_source` | enum | — | `browser_gps` \| `native_gps` \| `kiosk` \| `manual` | Defaults to `browser_gps` |
| `notes` | string | — | ≤500 chars | |

**GPS rules (applied in `clockIn()`):**

1. If `gps_required = true` and no coordinates supplied:
   - If `gps_unavailable_action = block` → `403`.
   - If `gps_unavailable_action = allow_flagged` → `is_flagged = true`, `clock_in_geofence_status = unavailable`.
2. If `clock_in_mode = anywhere` → no geofence check, `clock_in_geofence_status = not_enforced`.
3. Otherwise the service calls `GeofenceService.checkGeofence()`:
   - **`inside`** → session gets `clockin_address_id` set to the matched address.
   - **`outside`** → if `geofence_violation_action = block` → `403`; else `is_flagged = true`.

**Business rules:**

- `require_job_tag` / `require_task_tag` enforcement returns `400`.
- If another session for the same employee has `status IN ('active','on_break')` and `clock_out_at IS NULL` → `409 Employee already has an active session`.
- A matching `work_shift` in the ±2 hour window is linked and bumped to `in_progress`.

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/sessions/clock-in \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "project_id": "p-aaaa-1111-2222-3333-444444444444",
    "task_id": "t-aaaa-1111-2222-3333-444444444444",
    "latitude": 30.26715,
    "longitude": -97.74306,
    "location_source": "browser_gps",
    "notes": "Starting at the main site"
  }'
```

**Example response (201):**

```json
{
  "id": "cs-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "work_shift_id": "ws-aaaa-1111-2222-3333-444444444444",
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "task_id": "t-aaaa-1111-2222-3333-444444444444",
  "clockin_address_id": "ca-aaaa-1111-2222-3333-444444444444",
  "status": "active",
  "clock_in_at": "2026-04-13T13:00:00.000Z",
  "clock_out_at": null,
  "clock_in_latitude": "30.26715000",
  "clock_in_longitude": "-97.74306000",
  "clock_in_location_source": "browser_gps",
  "clock_in_geofence_status": "inside",
  "clock_out_latitude": null,
  "clock_out_longitude": null,
  "clock_out_location_source": "browser_gps",
  "clock_out_geofence_status": "not_enforced",
  "total_worked_minutes": null,
  "regular_minutes": null,
  "overtime_minutes": null,
  "is_manual_edit": false,
  "is_flagged": false,
  "flag_reason": null,
  "labor_cost_posted": false,
  "labor_cost_entry_id": null,
  "labor_cost_reconciliation_needed": false,
  "notes": "Starting at the main site",
  "created_at": "2026-04-13T13:00:00.000Z",
  "updated_at": "2026-04-13T13:00:00.000Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" },
    "crew_member": null
  },
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel", "project_number": "2026-042", "status": "in_progress" },
  "task": { "id": "t-aaaa-1111-2222-3333-444444444444", "title": "Install cabinets", "status": "in_progress" },
  "work_shift": { "id": "ws-aaaa-1111-2222-3333-444444444444", "scheduled_start": "2026-04-13T13:00:00.000Z", "scheduled_end": "2026-04-13T22:00:00.000Z", "status": "in_progress", "title": "Afternoon" },
  "clockin_address": { "id": "ca-aaaa-1111-2222-3333-444444444444", "label": "Main Office", "latitude": "30.26715000", "longitude": "-97.74306000" },
  "break_entries": [],
  "edit_logs": [],
  "disputes": []
}
```

**Audit log:** `action = "created"`, `entityType = "clock_session"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Missing required `project_id`/`task_id` per settings, or invalid body | `{"statusCode":400,"message":"project_id is required","error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | GPS blocked by `gps_unavailable_action=block` OR geofence outside with `geofence_violation_action=block` | `{"statusCode":403,"message":"Outside geofence — clock-in blocked","error":"Forbidden"}` |
| `404` | Caller has no active employee profile | `{"statusCode":404,"message":"Employee profile not found or inactive","error":"Not Found"}` |
| `409` | Employee already has an active session | `{"statusCode":409,"message":"Employee already has an active session","error":"Conflict"}` |

---

### 11.2 `POST /time-clock/sessions/clock-out`

End the current active session.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`
**HTTP status on success:** `200 OK`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `latitude` | number | — | `-90 ≤ x ≤ 90` | |
| `longitude` | number | — | `-180 ≤ x ≤ 180` | |
| `location_source` | enum | — | see §4.6 | |
| `notes` | string | — | ≤500 chars | Appended on clock-out |

**Business rules on clock-out:**

1. If the session is `on_break`, the open break is auto-ended (`ended_at = now()`, `duration_minutes` computed, session returned to `active` first).
2. `total_worked_minutes` = `(clock_out_at - clock_in_at)` minus the sum of all `unpaid` break `duration_minutes`.
3. `OvertimeService.calculate()` splits that into `regular_minutes` and `overtime_minutes`.
4. `status` becomes `completed`, `clock_out_at` is set.
5. Any linked `work_shift` in `in_progress` is bumped to `completed`.
6. Labor cost posting runs asynchronously. If it succeeds `labor_cost_posted = true`; if it fails the session remains `labor_cost_posted = false` and the request still returns 200.

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/sessions/clock-out \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "latitude": 30.26715,
    "longitude": -97.74306,
    "location_source": "browser_gps",
    "notes": "Wrapped up the cabinet install"
  }'
```

**Example response (200):**

```json
{
  "id": "cs-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "work_shift_id": "ws-aaaa-1111-2222-3333-444444444444",
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "task_id": "t-aaaa-1111-2222-3333-444444444444",
  "clockin_address_id": "ca-aaaa-1111-2222-3333-444444444444",
  "status": "completed",
  "clock_in_at": "2026-04-13T13:00:00.000Z",
  "clock_out_at": "2026-04-13T21:30:00.000Z",
  "clock_in_latitude": "30.26715000",
  "clock_in_longitude": "-97.74306000",
  "clock_in_location_source": "browser_gps",
  "clock_in_geofence_status": "inside",
  "clock_out_latitude": "30.26715000",
  "clock_out_longitude": "-97.74306000",
  "clock_out_location_source": "browser_gps",
  "clock_out_geofence_status": "inside",
  "total_worked_minutes": 510,
  "regular_minutes": 480,
  "overtime_minutes": 30,
  "is_manual_edit": false,
  "is_flagged": false,
  "flag_reason": null,
  "labor_cost_posted": true,
  "labor_cost_entry_id": "fe-aaaa-1111-2222-3333-444444444444",
  "labor_cost_reconciliation_needed": false,
  "notes": "Starting at the main site\nWrapped up the cabinet install",
  "created_at": "2026-04-13T13:00:00.000Z",
  "updated_at": "2026-04-13T21:30:00.000Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" },
    "crew_member": null
  },
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel", "project_number": "2026-042", "status": "in_progress" },
  "task": { "id": "t-aaaa-1111-2222-3333-444444444444", "title": "Install cabinets", "status": "in_progress" },
  "work_shift": { "id": "ws-aaaa-1111-2222-3333-444444444444", "scheduled_start": "...", "scheduled_end": "...", "status": "completed", "title": "Afternoon" },
  "clockin_address": { "id": "ca-aaaa-1111-2222-3333-444444444444", "label": "Main Office", "latitude": "30.26715000", "longitude": "-97.74306000" },
  "break_entries": [
    {
      "id": "be-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "break_type": "unpaid",
      "break_label": "Lunch",
      "started_at": "2026-04-13T17:00:00.000Z",
      "ended_at": "2026-04-13T17:30:00.000Z",
      "duration_minutes": 30,
      "created_at": "2026-04-13T17:00:00.000Z",
      "updated_at": "2026-04-13T17:30:00.000Z"
    }
  ],
  "edit_logs": [],
  "disputes": []
}
```

**Audit log:** `action = "updated"`, `entityType = "clock_session"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `404` | Caller has no active session | `{"statusCode":404,"message":"No active clock session found","error":"Not Found"}` |

---

### 11.3 `GET /time-clock/sessions`

List every clock session across the whole tenant (paginated). Each row uses the list-shape `ClockSession` (see §11 header — lighter than detail).

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Bookkeeper`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `limit` | integer | `20` | Max 100 |
| `employee_profile_id` | uuid | — | Filter by employee |
| `project_id` | uuid | — | Filter by project |
| `status` | enum | — | `active` \| `on_break` \| `completed` |
| `date_from` | ISO 8601 | — | Filters `clock_in_at >= date_from` |
| `date_to` | ISO 8601 | — | Filters `clock_in_at <= date_to` |
| `is_flagged` | boolean | — | Accepts `"true"`/`"false"`/`"1"`/`"0"` |
| `is_manual_edit` | boolean | — | |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/sessions?status=completed&date_from=2026-04-01&date_to=2026-04-15&page=1&limit=20" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "cs-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "work_shift_id": "ws-aaaa-1111-2222-3333-444444444444",
      "project_id": "p-aaaa-1111-2222-3333-444444444444",
      "task_id": null,
      "clockin_address_id": "ca-aaaa-1111-2222-3333-444444444444",
      "status": "completed",
      "clock_in_at": "2026-04-10T08:00:00.000Z",
      "clock_out_at": "2026-04-10T17:00:00.000Z",
      "clock_in_latitude": "30.26715000",
      "clock_in_longitude": "-97.74306000",
      "clock_in_location_source": "browser_gps",
      "clock_in_geofence_status": "inside",
      "clock_out_latitude": "30.26715000",
      "clock_out_longitude": "-97.74306000",
      "clock_out_location_source": "browser_gps",
      "clock_out_geofence_status": "inside",
      "total_worked_minutes": 480,
      "regular_minutes": 480,
      "overtime_minutes": 0,
      "is_manual_edit": false,
      "is_flagged": false,
      "flag_reason": null,
      "labor_cost_posted": true,
      "labor_cost_entry_id": "fe-aaaa-...",
      "labor_cost_reconciliation_needed": false,
      "notes": null,
      "created_at": "2026-04-10T08:00:00.000Z",
      "updated_at": "2026-04-10T17:00:05.000Z",
      "employee_profile": {
        "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
        "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
      },
      "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel", "project_number": "2026-042" },
      "task": null,
      "work_shift": { "id": "ws-aaaa-1111-2222-3333-444444444444", "scheduled_start": "2026-04-10T08:00:00.000Z", "scheduled_end": "2026-04-10T17:00:00.000Z", "status": "completed" }
    }
  ],
  "meta": { "total": 10, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Invalid query parameter format | `{"statusCode":400,"message":["date_from must be a valid ISO 8601 date string"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 11.4 `GET /time-clock/sessions/:id`

Get a single session with its **full detail context** — includes `employee_profile.user`, `employee_profile.crew_member`, `project` (with `project_number` and `status`), `task`, `work_shift`, `clockin_address`, all `break_entries` (open and closed), all `edit_logs` (with editor user info), and all `disputes`.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Bookkeeper`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `clock_session.id` |

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/sessions/cs-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):** Detail-shape `ClockSession` — identical to the successful clock-out response in §11.2. A session with edits and disputes looks like:

```json
{
  "id": "cs-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "work_shift_id": "ws-aaaa-1111-2222-3333-444444444444",
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "task_id": "t-aaaa-1111-2222-3333-444444444444",
  "clockin_address_id": "ca-aaaa-1111-2222-3333-444444444444",
  "status": "completed",
  "clock_in_at": "2026-04-10T08:00:00.000Z",
  "clock_out_at": "2026-04-10T17:00:00.000Z",
  "clock_in_latitude": "30.26715000",
  "clock_in_longitude": "-97.74306000",
  "clock_in_location_source": "browser_gps",
  "clock_in_geofence_status": "inside",
  "clock_out_latitude": "30.26715000",
  "clock_out_longitude": "-97.74306000",
  "clock_out_location_source": "browser_gps",
  "clock_out_geofence_status": "inside",
  "total_worked_minutes": 510,
  "regular_minutes": 480,
  "overtime_minutes": 30,
  "is_manual_edit": true,
  "is_flagged": false,
  "flag_reason": null,
  "labor_cost_posted": true,
  "labor_cost_entry_id": "fe-aaaa-1111-2222-3333-444444444444",
  "labor_cost_reconciliation_needed": true,
  "notes": "Adjusted per badge log review",
  "created_at": "2026-04-10T08:00:00.000Z",
  "updated_at": "2026-04-13T16:05:00.000Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" },
    "crew_member": { "id": "cm3a5c12-...", "first_name": "Jane", "last_name": "Smith" }
  },
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel", "project_number": "2026-042", "status": "in_progress" },
  "task": { "id": "t-aaaa-1111-2222-3333-444444444444", "title": "Install cabinets", "status": "in_progress" },
  "work_shift": { "id": "ws-aaaa-1111-2222-3333-444444444444", "scheduled_start": "2026-04-10T08:00:00.000Z", "scheduled_end": "2026-04-10T17:00:00.000Z", "status": "completed", "title": "Morning Shift" },
  "clockin_address": { "id": "ca-aaaa-1111-2222-3333-444444444444", "label": "Main Office", "latitude": "30.26715000", "longitude": "-97.74306000" },
  "break_entries": [
    {
      "id": "be-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "break_type": "unpaid",
      "break_label": "Lunch",
      "started_at": "2026-04-10T12:00:00.000Z",
      "ended_at": "2026-04-10T12:30:00.000Z",
      "duration_minutes": 30,
      "created_at": "2026-04-10T12:00:00.000Z",
      "updated_at": "2026-04-10T12:30:00.000Z"
    }
  ],
  "edit_logs": [
    {
      "id": "el-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "edited_by_user_id": "admin-11111111-2222-3333-4444-555555555555",
      "field_changed": "clock_in_at",
      "original_value": "2026-04-10T08:05:17.000Z",
      "new_value": "2026-04-10T08:00:00.000Z",
      "reason": "Rounded to scheduled start per badge log",
      "edited_at": "2026-04-13T16:05:00.000Z",
      "edited_by": { "id": "admin-11111111-2222-3333-4444-555555555555", "first_name": "Adam", "last_name": "Admin" }
    }
  ],
  "disputes": [
    {
      "id": "td-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "submitted_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "dispute_type": "correction_request",
      "description": "Badge showed 8:00, not 8:05",
      "proposed_clock_in_at": "2026-04-10T08:00:00.000Z",
      "proposed_clock_out_at": null,
      "proposed_project_id": null,
      "proposed_task_id": null,
      "proposed_notes": null,
      "status": "approved",
      "reviewed_by_user_id": "admin-11111111-2222-3333-4444-555555555555",
      "review_notes": "Confirmed via badge reader export",
      "reviewed_at": "2026-04-13T16:05:00.000Z",
      "created_at": "2026-04-12T09:15:00.000Z",
      "updated_at": "2026-04-13T16:05:00.000Z"
    }
  ]
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Session not found in tenant | `{"statusCode":404,"message":"Clock session not found","error":"Not Found"}` |

---

### 11.5 `GET /time-clock/sessions/me/active`

Return the authenticated user's currently active session, or `null` if they're clocked out. The `break_entries` array in this response only contains breaks that are still OPEN (`ended_at IS NULL`) — useful for knowing if the user is currently on a break and which one.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Request body:** *none*

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/sessions/me/active \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200) — user is on break:**

```json
{
  "data": {
    "id": "cs-aaaa-1111-2222-3333-444444444444",
    "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
    "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "work_shift_id": "ws-aaaa-1111-2222-3333-444444444444",
    "project_id": "p-aaaa-1111-2222-3333-444444444444",
    "task_id": "t-aaaa-1111-2222-3333-444444444444",
    "clockin_address_id": "ca-aaaa-1111-2222-3333-444444444444",
    "status": "on_break",
    "clock_in_at": "2026-04-13T08:00:00.000Z",
    "clock_out_at": null,
    "clock_in_latitude": "30.26715000",
    "clock_in_longitude": "-97.74306000",
    "clock_in_location_source": "browser_gps",
    "clock_in_geofence_status": "inside",
    "total_worked_minutes": null,
    "regular_minutes": null,
    "overtime_minutes": null,
    "is_manual_edit": false,
    "is_flagged": false,
    "flag_reason": null,
    "labor_cost_posted": false,
    "labor_cost_entry_id": null,
    "labor_cost_reconciliation_needed": false,
    "notes": null,
    "created_at": "2026-04-13T08:00:00.000Z",
    "updated_at": "2026-04-13T12:00:00.000Z",
    "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel", "project_number": "2026-042" },
    "task": { "id": "t-aaaa-1111-2222-3333-444444444444", "title": "Install cabinets" },
    "work_shift": { "id": "ws-aaaa-1111-2222-3333-444444444444", "scheduled_start": "2026-04-13T08:00:00.000Z", "scheduled_end": "2026-04-13T17:00:00.000Z", "status": "in_progress" },
    "clockin_address": { "id": "ca-aaaa-1111-2222-3333-444444444444", "label": "Main Office", "latitude": "30.26715000", "longitude": "-97.74306000" },
    "break_entries": [
      {
        "id": "be-aaaa-1111-2222-3333-444444444444",
        "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
        "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
        "break_type": "unpaid",
        "break_label": "Lunch",
        "started_at": "2026-04-13T12:00:00.000Z",
        "ended_at": null,
        "duration_minutes": null,
        "created_at": "2026-04-13T12:00:00.000Z",
        "updated_at": "2026-04-13T12:00:00.000Z"
      }
    ]
  }
}
```

**Example response (200) — user is clocked out:**

```json
{ "data": null }
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `404` | Caller has no active `employee_profile` in this tenant | `{"statusCode":404,"message":"Employee profile not found or inactive","error":"Not Found"}` |

---

### 11.6 `GET /time-clock/sessions/me/available-projects`

Returns the list of projects the authenticated user is currently allowed to clock in to. Projects are resolved from `employee_project_assignment` rows OR the tenant's active projects, depending on `clock_in_mode`. When `clock_in_mode = anywhere`, the user gets all active projects.

Each project includes its active clock-in addresses (full street address + latitude/longitude) so the client can compute Haversine distance from the employee's current GPS position and sort the list by nearest job site.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Request body:** *none*

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/sessions/me/available-projects \
  -H "Authorization: Bearer <JWT>"
```

**Response item shape:**

| Field | Type | Description |
|---|---|---|
| `id` | string (uuid) | Project id |
| `name` | string | Project name |
| `project_number` | string | Human-readable project number |
| `clockin_addresses` | array | All active clock-in addresses for the project, ordered by `created_at asc`. May be empty. |
| `clockin_addresses[].id` | string (uuid) | Address id |
| `clockin_addresses[].label` | string | Human label (e.g. `"Main Site"`) |
| `clockin_addresses[].address_line1` | string | Street line 1 |
| `clockin_addresses[].address_line2` | string \| null | Street line 2 |
| `clockin_addresses[].city` | string | City |
| `clockin_addresses[].state` | string(2) | 2-letter state code |
| `clockin_addresses[].zip_code` | string | ZIP code |
| `clockin_addresses[].latitude` | string (decimal) | WGS84 latitude, serialized as string (`parseFloat` on the client) |
| `clockin_addresses[].longitude` | string (decimal) | WGS84 longitude, serialized as string (`parseFloat` on the client) |
| `clockin_addresses[].radius_meters` | integer | Geofence radius used for clock-in validation |

**Example response (200):**

```json
{
  "data": [
    {
      "id": "p-aaaa-1111-2222-3333-444444444444",
      "name": "Kitchen Remodel",
      "project_number": "2026-042",
      "clockin_addresses": [
        {
          "id": "ca-1111-2222-3333-4444-555555555555",
          "label": "Main Site",
          "address_line1": "123 Oak St",
          "address_line2": null,
          "city": "Plantation",
          "state": "FL",
          "zip_code": "33317",
          "latitude": "26.12240000",
          "longitude": "-80.13730000",
          "radius_meters": 100
        }
      ]
    },
    {
      "id": "p-bbbb-2222-3333-4444-555555555555",
      "name": "Bathroom Reno",
      "project_number": "2026-045",
      "clockin_addresses": []
    }
  ]
}
```

**Example response (200) — no eligible projects:**

```json
{ "data": [] }
```

**Frontend note (distance sorting):** only `is_active = true` addresses are returned. For each project, compute the Haversine distance from the user's current `gps.latitude` / `gps.longitude` against every address and use the smallest as the project's distance. Projects with an empty `clockin_addresses` array have no known location — render them at the end of the list or hide them at the client's discretion. Do not send `tenant_id` from the client; it is derived server-side from the JWT.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `404` | Caller has no active `employee_profile` in this tenant | `{"statusCode":404,"message":"Employee profile not found or inactive","error":"Not Found"}` |

---

### 11.7 `GET /time-clock/sessions/mine`

Paginated history of the authenticated user's own sessions. Uses a lighter include — no `employee_profile` field (it's always the caller).

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `limit` | integer | `20` | Max 100 |
| `status` | enum | — | `active` \| `on_break` \| `completed` |
| `date_from` | ISO 8601 | — | Filters `clock_in_at >= date_from` |
| `date_to` | ISO 8601 | — | Filters `clock_in_at <= date_to` |
| `project_id` | uuid | — | Filter by project |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/sessions/mine?date_from=2026-04-01&date_to=2026-04-15&status=completed" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "cs-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "work_shift_id": "ws-aaaa-1111-2222-3333-444444444444",
      "project_id": "p-aaaa-1111-2222-3333-444444444444",
      "task_id": null,
      "clockin_address_id": "ca-aaaa-1111-2222-3333-444444444444",
      "status": "completed",
      "clock_in_at": "2026-04-10T08:00:00.000Z",
      "clock_out_at": "2026-04-10T17:00:00.000Z",
      "total_worked_minutes": 480,
      "regular_minutes": 480,
      "overtime_minutes": 0,
      "is_manual_edit": false,
      "is_flagged": false,
      "flag_reason": null,
      "notes": null,
      "created_at": "2026-04-10T08:00:00.000Z",
      "updated_at": "2026-04-10T17:00:05.000Z",
      "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel", "project_number": "2026-042" },
      "task": null,
      "work_shift": { "id": "ws-aaaa-1111-2222-3333-444444444444", "scheduled_start": "2026-04-10T08:00:00.000Z", "scheduled_end": "2026-04-10T17:00:00.000Z", "status": "completed" }
    }
  ],
  "meta": { "total": 8, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `404` | Caller has no active `employee_profile` in this tenant | `{"statusCode":404,"message":"Employee profile not found or inactive","error":"Not Found"}` |

---

### 11.8 `GET /time-clock/sessions/active/all`

Returns every currently open session (`status IN ('active', 'on_break')`) in the tenant. **Not paginated** — returns the full set in one shot. For large tenants, prefer `/dashboard/whos-in` (§16) which is optimized for display.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`

**Request body:** *none*

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/sessions/active/all \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "cs-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "work_shift_id": "ws-aaaa-1111-2222-3333-444444444444",
      "project_id": "p-aaaa-1111-2222-3333-444444444444",
      "task_id": "t-aaaa-1111-2222-3333-444444444444",
      "clockin_address_id": "ca-aaaa-1111-2222-3333-444444444444",
      "status": "on_break",
      "clock_in_at": "2026-04-13T13:00:00.000Z",
      "clock_out_at": null,
      "is_flagged": false,
      "employee_profile": {
        "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
        "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
      },
      "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel", "project_number": "2026-042" },
      "task": { "id": "t-aaaa-1111-2222-3333-444444444444", "title": "Install cabinets" },
      "clockin_address": { "id": "ca-aaaa-1111-2222-3333-444444444444", "label": "Main Office" },
      "break_entries": [
        {
          "id": "be-aaaa-1111-2222-3333-444444444444",
          "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
          "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
          "break_type": "unpaid",
          "break_label": "Lunch",
          "started_at": "2026-04-13T17:00:00.000Z",
          "ended_at": null,
          "duration_minutes": null
        }
      ]
    }
  ],
  "total": 1
}
```

- `break_entries` is filtered to only `ended_at = null` — i.e. the currently open break if the session is `on_break`. For `active` sessions the array is empty.
- `total` is the number of rows in `data` (not a pagination field — there's no pagination here).

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

## 12. Endpoints — Breaks

Controller: `src/modules/time-clock/controllers/break-entry.controller.ts`
Service: `src/modules/time-clock/services/break-entry.service.ts`

### Shared shape — `BreakEntry`

```json
{
  "id": "be-uuid",
  "tenant_id": "d7c2...",
  "clock_session_id": "cs-uuid",
  "break_type": "unpaid",
  "break_label": "Lunch",
  "started_at": "2026-04-10T12:00:00.000Z",
  "ended_at": "2026-04-10T12:30:00.000Z",
  "duration_minutes": 30,
  "created_at": "2026-04-10T12:00:00.000Z",
  "updated_at": "2026-04-10T12:30:00.000Z"
}
```

### Ownership rule

On `POST .../breaks/start` and `POST .../breaks/end`, the service compares the session's `employee_profile.user_id` to the authenticated `user.id`. A user may manage their own breaks freely; `Owner` and `Admin` roles may manage any user's breaks; everyone else returns `403`.

---

### 12.1 `POST /time-clock/sessions/:id/breaks/start`

Start a break on the given session. The session must be `active` (not already on break, not completed).

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`
**Path:** `:id` = clock session UUID.
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `break_type` | enum | — | `paid` \| `unpaid` | Defaults to `unpaid` |
| `break_label` | string | — | ≤50 chars | Informational (e.g. `"Lunch"`, `"Rest"`) |

The service uses an atomic `UPDATE ... WHERE status = 'active'` to flip the session to `on_break`, preventing race conditions between concurrent clients.

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/sessions/cs-aaaa-1111-2222-3333-444444444444/breaks/start \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "break_type": "unpaid",
    "break_label": "Lunch"
  }'
```

**Example response (201):**

```json
{
  "id": "be-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
  "break_type": "unpaid",
  "break_label": "Lunch",
  "started_at": "2026-04-13T12:00:00.000Z",
  "ended_at": null,
  "duration_minutes": null,
  "created_at": "2026-04-13T12:00:00.000Z",
  "updated_at": "2026-04-13T12:00:00.000Z"
}
```

**Audit log:** `action = "created"`, `entityType = "break_entry"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Session is not in `active` status (e.g. already on break or completed) | `{"statusCode":400,"message":"Session is not active — cannot start a break","error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Non-admin caller does not own this session | `{"statusCode":403,"message":"You can only manage breaks on your own sessions","error":"Forbidden"}` |
| `404` | Session not found in tenant | `{"statusCode":404,"message":"Clock session not found","error":"Not Found"}` |
| `409` | A break is already open on this session (concurrent start) | `{"statusCode":409,"message":"A break is already active on this session","error":"Conflict"}` |

---

### 12.2 `POST /time-clock/sessions/:id/breaks/end`

End the currently open break on the session. The session is flipped back from `on_break` to `active` atomically, and `duration_minutes` is computed on the break row.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `clock_session.id` |

**Request body:** *none*

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/sessions/cs-aaaa-1111-2222-3333-444444444444/breaks/end \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "id": "be-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
  "break_type": "unpaid",
  "break_label": "Lunch",
  "started_at": "2026-04-13T12:00:00.000Z",
  "ended_at": "2026-04-13T12:30:00.000Z",
  "duration_minutes": 30,
  "created_at": "2026-04-13T12:00:00.000Z",
  "updated_at": "2026-04-13T12:30:00.000Z"
}
```

**Audit log:** `action = "updated"`, `entityType = "break_entry"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Non-admin caller does not own this session | `{"statusCode":403,"message":"You can only manage breaks on your own sessions","error":"Forbidden"}` |
| `404` | Session not found, or no open break to end | `{"statusCode":404,"message":"No active break to end","error":"Not Found"}` |

---

### 12.3 `GET /time-clock/sessions/:id/breaks`

List every break on a session (open and closed), ordered by `started_at` ascending.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `clock_session.id` |

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/sessions/cs-aaaa-1111-2222-3333-444444444444/breaks \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "be-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "break_type": "unpaid",
      "break_label": "Lunch",
      "started_at": "2026-04-13T12:00:00.000Z",
      "ended_at": "2026-04-13T12:30:00.000Z",
      "duration_minutes": 30,
      "created_at": "2026-04-13T12:00:00.000Z",
      "updated_at": "2026-04-13T12:30:00.000Z"
    },
    {
      "id": "be-bbbb-2222-3333-4444-555555555555",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "break_type": "paid",
      "break_label": "Rest",
      "started_at": "2026-04-13T15:00:00.000Z",
      "ended_at": null,
      "duration_minutes": null,
      "created_at": "2026-04-13T15:00:00.000Z",
      "updated_at": "2026-04-13T15:00:00.000Z"
    }
  ]
}
```

**Example response (200) — no breaks on this session:**

```json
{ "data": [] }
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `404` | Session not found in tenant | `{"statusCode":404,"message":"Clock session not found","error":"Not Found"}` |

---

## 13. Endpoints — Manual Session Edit

Service: `src/modules/time-clock/services/clock-session-edit.service.ts`

### 13.1 `PATCH /time-clock/sessions/:id`

Manually edit a clock session. **Every changed field produces one immutable `clock_session_edit_log` row.** The `reason` field is required and copied onto every log row in the batch.

**Auth:** JWT • **Roles:** `Owner`, `Admin` only (Project Manager cannot edit)
**Path:** `:id` = clock session UUID.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `clock_in_at` | ISO 8601 | — | — | New in-time |
| `clock_out_at` | ISO 8601 | — | — | New out-time |
| `project_id` | uuid | — | — | Re-tag project |
| `task_id` | uuid | — | — | Re-tag task |
| `notes` | string | — | ≤500 chars | New notes |
| `reason` | string | **✅** | non-empty, ≤500 chars | Mandatory — auditing |

**Behavior:**

1. Only fields whose new value differs from the current value generate an edit log.
2. `is_manual_edit` is set to `true`.
3. If `clock_in_at` or `clock_out_at` changed, `total_worked_minutes`, `regular_minutes`, `overtime_minutes` are recalculated.
4. If the session had `labor_cost_posted = true`, the service sets `labor_cost_reconciliation_needed = true` (so a later job can fix up the posted entry).
5. An `edit_logs[]` array in the response shows every edit row, including this call's newly-appended rows, ordered by `edited_at DESC`.

**Example request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/time-clock/sessions/cs-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "clock_in_at": "2026-04-10T08:00:00.000Z",
    "notes": "Rounded to scheduled start per badge log",
    "reason": "Employee reported incorrect start time — corrected from badge log"
  }'
```

**Example response (200):** Full detail-shape `ClockSession` (§11.4) with updated fields and the full `edit_logs[]` array.

```json
{
  "id": "cs-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "work_shift_id": "ws-aaaa-1111-2222-3333-444444444444",
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "task_id": null,
  "clockin_address_id": "ca-aaaa-1111-2222-3333-444444444444",
  "status": "completed",
  "clock_in_at": "2026-04-10T08:00:00.000Z",
  "clock_out_at": "2026-04-10T17:00:00.000Z",
  "total_worked_minutes": 510,
  "regular_minutes": 480,
  "overtime_minutes": 30,
  "is_manual_edit": true,
  "is_flagged": false,
  "labor_cost_posted": true,
  "labor_cost_entry_id": "fe-aaaa-...",
  "labor_cost_reconciliation_needed": true,
  "notes": "Rounded to scheduled start per badge log",
  "created_at": "2026-04-10T08:05:17.000Z",
  "updated_at": "2026-04-13T16:05:00.000Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" },
    "crew_member": null
  },
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel", "project_number": "2026-042", "status": "in_progress" },
  "task": null,
  "work_shift": { "id": "ws-aaaa-1111-2222-3333-444444444444", "scheduled_start": "2026-04-10T08:00:00.000Z", "scheduled_end": "2026-04-10T17:00:00.000Z", "status": "completed", "title": "Morning" },
  "clockin_address": { "id": "ca-aaaa-1111-2222-3333-444444444444", "label": "Main Office", "latitude": "30.26715000", "longitude": "-97.74306000" },
  "break_entries": [],
  "edit_logs": [
    {
      "id": "el-11111111-2222-3333-4444-555555555555",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "edited_by_user_id": "admin-11111111-2222-3333-4444-555555555555",
      "field_changed": "clock_in_at",
      "original_value": "2026-04-10T08:05:17.000Z",
      "new_value": "2026-04-10T08:00:00.000Z",
      "reason": "Employee reported incorrect start time — corrected from badge log",
      "edited_at": "2026-04-13T16:05:00.000Z",
      "edited_by": { "id": "admin-11111111-2222-3333-4444-555555555555", "first_name": "Adam", "last_name": "Admin" }
    },
    {
      "id": "el-22222222-3333-4444-5555-666666666666",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "edited_by_user_id": "admin-11111111-2222-3333-4444-555555555555",
      "field_changed": "notes",
      "original_value": null,
      "new_value": "Rounded to scheduled start per badge log",
      "reason": "Employee reported incorrect start time — corrected from badge log",
      "edited_at": "2026-04-13T16:05:00.000Z",
      "edited_by": { "id": "admin-11111111-2222-3333-4444-555555555555", "first_name": "Adam", "last_name": "Admin" }
    }
  ],
  "disputes": []
}
```

**Audit log:** One `action = "updated"` per edit log row, with `field_changed`, `original_value`, `new_value`, `reason`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | `reason` missing, empty, or over 500 chars | `{"statusCode":400,"message":["Edit reason is required"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin (Project Manager returns 403) | `{"statusCode":403,"message":"Insufficient permissions — only Owner / Admin may edit","error":"Forbidden"}` |
| `404` | Session not found in tenant | `{"statusCode":404,"message":"Clock session not found","error":"Not Found"}` |

---

## 14. Endpoints — Disputes

Controller: `src/modules/time-clock/controllers/time-dispute.controller.ts`
Service: `src/modules/time-clock/services/time-dispute.service.ts`

### Shared shape — `TimeDispute` (list include)

```json
{
  "id": "td-uuid",
  "tenant_id": "d7c2...",
  "clock_session_id": "cs-uuid",
  "submitted_by_user_id": "u222...",
  "dispute_type": "correction_request",
  "description": "Forgot to clock in this morning.",
  "proposed_clock_in_at": "2026-04-10T07:00:00.000Z",
  "proposed_clock_out_at": null,
  "proposed_project_id": null,
  "proposed_task_id": null,
  "proposed_notes": null,
  "status": "pending",
  "reviewed_by_user_id": null,
  "review_notes": null,
  "reviewed_at": null,
  "created_at": "2026-04-10T17:02:11.000Z",
  "updated_at": "2026-04-10T17:02:11.000Z",

  "clock_session": {
    "id": "cs-uuid",
    "clock_in_at": "2026-04-10T08:30:00.000Z",
    "clock_out_at": "2026-04-10T17:00:00.000Z",
    "status": "completed",
    "employee_profile": {
      "id": "a111...",
      "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith" }
    }
  },
  "submitted_by": { "id": "u222...", "first_name": "Jane", "last_name": "Smith" },
  "reviewed_by": null
}
```

### Dispute detail shape (used by `findOne`, `approve`, `reject`)

In addition to the above, `clock_session` is expanded to include `project`, `task`, `break_entries`, and `edit_logs` — effectively the full session context.

---

### 14.1 `POST /time-clock/sessions/:sessionId/disputes`

Submit a dispute for a session.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`
**Path:** `:sessionId` = clock session UUID.
**HTTP status on success:** `201 Created`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `dispute_type` | enum | ✅ | `flag_only` \| `correction_request` | |
| `description` | string | ✅ | non-empty, ≤2000 chars | |
| `proposed_clock_in_at` | ISO 8601 | — | — | |
| `proposed_clock_out_at` | ISO 8601 | — | — | |
| `proposed_project_id` | uuid | — | — | |
| `proposed_task_id` | uuid | — | — | |
| `proposed_notes` | string | — | ≤2000 chars | |

**Business rules:**

- When `dispute_type = correction_request`, at least one `proposed_*` field must be provided (enforced in the service — returns `400` if none).
- Only one `pending` dispute may exist per session — a second submission returns `409`.

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/sessions/cs-aaaa-1111-2222-3333-444444444444/disputes \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "dispute_type": "correction_request",
    "description": "I forgot to clock in this morning. My actual start time was 7:00 AM.",
    "proposed_clock_in_at": "2026-04-10T07:00:00.000Z"
  }'
```

**Example response (201):**

```json
{
  "id": "td-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
  "submitted_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "dispute_type": "correction_request",
  "description": "I forgot to clock in this morning. My actual start time was 7:00 AM.",
  "proposed_clock_in_at": "2026-04-10T07:00:00.000Z",
  "proposed_clock_out_at": null,
  "proposed_project_id": null,
  "proposed_task_id": null,
  "proposed_notes": null,
  "status": "pending",
  "reviewed_by_user_id": null,
  "review_notes": null,
  "reviewed_at": null,
  "created_at": "2026-04-10T17:02:11.000Z",
  "updated_at": "2026-04-10T17:02:11.000Z",
  "clock_session": {
    "id": "cs-aaaa-1111-2222-3333-444444444444",
    "clock_in_at": "2026-04-10T08:30:00.000Z",
    "clock_out_at": "2026-04-10T17:00:00.000Z",
    "status": "completed",
    "employee_profile": {
      "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "user": { "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59", "first_name": "Jane", "last_name": "Smith" }
    }
  },
  "submitted_by": { "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59", "first_name": "Jane", "last_name": "Smith" },
  "reviewed_by": null
}
```

**Audit log:** `action = "created"`, `entityType = "time_dispute"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Missing description, or `correction_request` with no `proposed_*` field | `{"statusCode":400,"message":"correction_request must include at least one proposed value","error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `404` | Session not found in tenant | `{"statusCode":404,"message":"Clock session not found","error":"Not Found"}` |
| `409` | A pending dispute already exists for this session | `{"statusCode":409,"message":"A pending dispute already exists for this session","error":"Conflict"}` |

---

### 14.2 `GET /time-clock/disputes`

List all disputes in the tenant (admin view), paginated.

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `limit` | integer | `20` | Max 100 |
| `status` | enum | — | `pending` \| `approved` \| `rejected` \| `resolved` |
| `employee_profile_id` | uuid | — | Filter to one employee |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/disputes?status=pending&page=1&limit=20" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "td-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "submitted_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "dispute_type": "correction_request",
      "description": "Forgot to clock in this morning.",
      "proposed_clock_in_at": "2026-04-10T07:00:00.000Z",
      "proposed_clock_out_at": null,
      "proposed_project_id": null,
      "proposed_task_id": null,
      "proposed_notes": null,
      "status": "pending",
      "reviewed_by_user_id": null,
      "review_notes": null,
      "reviewed_at": null,
      "created_at": "2026-04-10T17:02:11.000Z",
      "updated_at": "2026-04-10T17:02:11.000Z",
      "clock_session": {
        "id": "cs-aaaa-1111-2222-3333-444444444444",
        "clock_in_at": "2026-04-10T08:30:00.000Z",
        "clock_out_at": "2026-04-10T17:00:00.000Z",
        "status": "completed",
        "employee_profile": {
          "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
          "user": { "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59", "first_name": "Jane", "last_name": "Smith" }
        }
      },
      "submitted_by": { "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59", "first_name": "Jane", "last_name": "Smith" },
      "reviewed_by": null
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 14.3 `GET /time-clock/disputes/mine`

List disputes submitted by the authenticated user (paginated). Results are always filtered to `submitted_by_user_id = req.user.id`, regardless of any `employee_profile_id` query parameter.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | 1-based page index |
| `limit` | integer | `20` | Max 100 |
| `status` | enum | — | `pending` \| `approved` \| `rejected` \| `resolved` |
| `employee_profile_id` | uuid | — | *Ignored — results are always scoped to the caller.* |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/disputes/mine?status=approved" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):** Same shape as §14.2.

```json
{
  "data": [
    {
      "id": "td-aaaa-1111-2222-3333-444444444444",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
      "submitted_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "dispute_type": "correction_request",
      "description": "Forgot to clock in this morning.",
      "proposed_clock_in_at": "2026-04-10T07:00:00.000Z",
      "proposed_clock_out_at": null,
      "proposed_project_id": null,
      "proposed_task_id": null,
      "proposed_notes": null,
      "status": "approved",
      "reviewed_by_user_id": "admin-11111111-2222-3333-4444-555555555555",
      "review_notes": "Confirmed via badge reader export",
      "reviewed_at": "2026-04-13T16:05:00.000Z",
      "created_at": "2026-04-10T17:02:11.000Z",
      "updated_at": "2026-04-13T16:05:00.000Z",
      "clock_session": {
        "id": "cs-aaaa-1111-2222-3333-444444444444",
        "clock_in_at": "2026-04-10T08:00:00.000Z",
        "clock_out_at": "2026-04-10T17:00:00.000Z",
        "status": "completed",
        "employee_profile": {
          "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
          "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith" }
        }
      },
      "submitted_by": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith" },
      "reviewed_by": { "id": "admin-...", "first_name": "Adam", "last_name": "Admin" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |

> **Route order warning:** The controller registers `disputes/mine` before `disputes/:id`. Do not reorder — otherwise Express would treat `"mine"` as the `:id` UUID and return `400`.

---

### 14.4 `GET /time-clock/disputes/:id`

Get a dispute with the full session context — the nested `clock_session` object is expanded with `project`, `task`, `break_entries`, and `edit_logs`.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Ownership rule:** A non-admin caller can only fetch disputes where `submitted_by_user_id = req.user.id`; otherwise `403`.

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `time_dispute.id` |

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/disputes/td-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "id": "td-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
  "submitted_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "dispute_type": "correction_request",
  "description": "Forgot to clock in this morning.",
  "proposed_clock_in_at": "2026-04-10T07:00:00.000Z",
  "proposed_clock_out_at": null,
  "proposed_project_id": null,
  "proposed_task_id": null,
  "proposed_notes": null,
  "status": "pending",
  "reviewed_by_user_id": null,
  "review_notes": null,
  "reviewed_at": null,
  "created_at": "2026-04-10T17:02:11.000Z",
  "updated_at": "2026-04-10T17:02:11.000Z",
  "clock_session": {
    "id": "cs-aaaa-1111-2222-3333-444444444444",
    "clock_in_at": "2026-04-10T08:30:00.000Z",
    "clock_out_at": "2026-04-10T17:00:00.000Z",
    "status": "completed",
    "total_worked_minutes": 510,
    "regular_minutes": 480,
    "overtime_minutes": 30,
    "employee_profile": {
      "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" }
    },
    "project": { "id": "p-aaaa-...", "name": "Kitchen Remodel", "project_number": "2026-042", "status": "in_progress" },
    "task": { "id": "t-aaaa-...", "title": "Install cabinets", "status": "in_progress" },
    "break_entries": [
      { "id": "be-aaaa-...", "break_type": "unpaid", "break_label": "Lunch", "started_at": "2026-04-10T12:00:00.000Z", "ended_at": "2026-04-10T12:30:00.000Z", "duration_minutes": 30 }
    ],
    "edit_logs": []
  },
  "submitted_by": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith" },
  "reviewed_by": null
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Non-admin caller is not the submitter of this dispute | `{"statusCode":403,"message":"Non-admin users may only view their own disputes","error":"Forbidden"}` |
| `404` | Dispute not found in tenant | `{"statusCode":404,"message":"Dispute not found","error":"Not Found"}` |

---

### 14.5 `PATCH /time-clock/disputes/:id/approve`

Approve a dispute. The underlying session is mutated via `ClockSessionEditService` — each non-null `proposed_*` field becomes a `clock_session_edit_log` row with the reason `"Approved dispute <id>"`. `flag_only` disputes produce no edit rows. Only a `pending` dispute can be approved.

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `time_dispute.id` |

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `review_notes` | string | — | ≤2000 chars | Optional reviewer notes |

**Example request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/time-clock/disputes/td-aaaa-1111-2222-3333-444444444444/approve \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "review_notes": "Confirmed with security camera footage."
  }'
```

**Example response (200):** `TimeDispute` detail shape (§14.4) with `status = "approved"` and reviewer fields populated.

```json
{
  "id": "td-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
  "submitted_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "dispute_type": "correction_request",
  "description": "Forgot to clock in this morning.",
  "proposed_clock_in_at": "2026-04-10T07:00:00.000Z",
  "proposed_clock_out_at": null,
  "proposed_project_id": null,
  "proposed_task_id": null,
  "proposed_notes": null,
  "status": "approved",
  "reviewed_by_user_id": "admin-11111111-2222-3333-4444-555555555555",
  "review_notes": "Confirmed with security camera footage.",
  "reviewed_at": "2026-04-13T16:05:00.000Z",
  "created_at": "2026-04-10T17:02:11.000Z",
  "updated_at": "2026-04-13T16:05:00.000Z",
  "clock_session": {
    "id": "cs-aaaa-1111-2222-3333-444444444444",
    "clock_in_at": "2026-04-10T07:00:00.000Z",
    "clock_out_at": "2026-04-10T17:00:00.000Z",
    "status": "completed",
    "total_worked_minutes": 570,
    "regular_minutes": 480,
    "overtime_minutes": 90,
    "employee_profile": { "id": "4fa4fe34-...", "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" } },
    "project": { "id": "p-aaaa-...", "name": "Kitchen Remodel", "project_number": "2026-042", "status": "in_progress" },
    "task": null,
    "break_entries": [],
    "edit_logs": [
      {
        "id": "el-11111111-2222-3333-4444-555555555555",
        "field_changed": "clock_in_at",
        "original_value": "2026-04-10T08:30:00.000Z",
        "new_value": "2026-04-10T07:00:00.000Z",
        "reason": "Approved dispute td-aaaa-1111-2222-3333-444444444444",
        "edited_at": "2026-04-13T16:05:00.000Z",
        "edited_by": { "id": "admin-11111111-2222-3333-4444-555555555555", "first_name": "Adam", "last_name": "Admin" }
      }
    ]
  },
  "submitted_by": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith" },
  "reviewed_by": { "id": "admin-11111111-2222-3333-4444-555555555555", "first_name": "Adam", "last_name": "Admin" }
}
```

**Audit log:** `action = "updated"` on the dispute, PLUS edit-log rows if any `proposed_*` fields were applied.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Dispute is not in `pending` status | `{"statusCode":400,"message":"Only pending disputes can be approved","error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Dispute not found in tenant | `{"statusCode":404,"message":"Dispute not found","error":"Not Found"}` |

---

### 14.6 `PATCH /time-clock/disputes/:id/reject`

Reject a dispute. **`review_notes` is required** so the employee gets actionable feedback. Rejection does NOT modify the clock session — the row stays untouched.

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `time_dispute.id` |

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `review_notes` | string | **✅** | non-empty, ≤2000 chars | Reason for rejection |

**Example request:**

```bash
curl -X PATCH https://api.lead360.app/api/v1/time-clock/disputes/td-aaaa-1111-2222-3333-444444444444/reject \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "review_notes": "GPS logs show you were at home during that period."
  }'
```

**Example response (200):**

```json
{
  "id": "td-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "clock_session_id": "cs-aaaa-1111-2222-3333-444444444444",
  "submitted_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "dispute_type": "correction_request",
  "description": "Forgot to clock in this morning.",
  "proposed_clock_in_at": "2026-04-10T07:00:00.000Z",
  "proposed_clock_out_at": null,
  "proposed_project_id": null,
  "proposed_task_id": null,
  "proposed_notes": null,
  "status": "rejected",
  "reviewed_by_user_id": "admin-11111111-2222-3333-4444-555555555555",
  "review_notes": "GPS logs show you were at home during that period.",
  "reviewed_at": "2026-04-13T16:10:00.000Z",
  "created_at": "2026-04-10T17:02:11.000Z",
  "updated_at": "2026-04-13T16:10:00.000Z",
  "clock_session": {
    "id": "cs-aaaa-1111-2222-3333-444444444444",
    "clock_in_at": "2026-04-10T08:30:00.000Z",
    "clock_out_at": "2026-04-10T17:00:00.000Z",
    "status": "completed",
    "total_worked_minutes": 510,
    "regular_minutes": 480,
    "overtime_minutes": 30,
    "employee_profile": { "id": "4fa4fe34-...", "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" } },
    "project": { "id": "p-aaaa-...", "name": "Kitchen Remodel", "project_number": "2026-042", "status": "in_progress" },
    "task": null,
    "break_entries": [],
    "edit_logs": []
  },
  "submitted_by": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith" },
  "reviewed_by": { "id": "admin-11111111-2222-3333-4444-555555555555", "first_name": "Adam", "last_name": "Admin" }
}
```

**Audit log:** `action = "updated"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Dispute not in `pending` status, OR `review_notes` missing/empty | `{"statusCode":400,"message":["Review notes are required when rejecting a dispute"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |
| `404` | Dispute not found in tenant | `{"statusCode":404,"message":"Dispute not found","error":"Not Found"}` |

---

### 14.7 `DELETE /time-clock/disputes/:id`

Cancel a dispute. Non-admin callers can only cancel their own; admins can cancel any. **Only `pending` disputes may be cancelled.** The row's `status` becomes `resolved` (not `cancelled` — `dispute_status` has no `cancelled` value).

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Path parameters:**

| Name | Type | Description |
|---|---|---|
| `id` | uuid | The `time_dispute.id` |

**Request body:** *none*

**Example request:**

```bash
curl -X DELETE https://api.lead360.app/api/v1/time-clock/disputes/td-aaaa-1111-2222-3333-444444444444 \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{ "message": "Dispute cancelled" }
```

**Audit log:** `action = "updated"` (status transitions to `resolved`).

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Dispute is not in `pending` status | `{"statusCode":400,"message":"Only pending disputes can be cancelled","error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Non-admin caller does not own the dispute | `{"statusCode":403,"message":"Non-admin users may only cancel their own disputes","error":"Forbidden"}` |
| `404` | Dispute not found in tenant | `{"statusCode":404,"message":"Dispute not found","error":"Not Found"}` |

---

## 15. Endpoints — Kiosk

Controller: `src/modules/time-clock/controllers/kiosk.controller.ts`
Service: `src/modules/time-clock/services/kiosk.service.ts`
Guard: `src/modules/time-clock/guards/kiosk-token.guard.ts`

**Authentication:** Every endpoint in this group is marked `@Public()` (no JWT) and protected by `KioskTokenGuard`. Requests must include `X-Kiosk-Token: <plaintext_token>`. The token resolves to a tenant automatically — **do not** send a `Bearer` token to these endpoints.

### Rate limiting & lockout

- **Rate limit:** 10 PIN attempts per minute per kiosk token (in-memory per-process). Exceeding returns `429 Too many PIN attempts. Please wait.`.
- **Lockout:** 5 failed PIN validations lock the employee for 15 minutes (`kiosk_pin_locked_until`). During lockout, any attempt returns `423 Account locked for 15 minutes`. Admin and Owner users in the tenant receive a `timeclock_kiosk_lockout` notification.

---

### 15.1 `GET /time-clock/kiosk/employees`

List every employee eligible for kiosk clock-in — i.e. `is_active = true` AND `kiosk_pin_hash IS NOT NULL`. Last names are **truncated to their first initial + "."** to protect privacy on a shared device.

**Auth:** `X-Kiosk-Token`

**Request headers:**

```
X-Kiosk-Token: tc_k_3a4f1e8c6a9d2b5e7f0a1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f
```

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/kiosk/employees \
  -H "X-Kiosk-Token: tc_k_3a4f1e8c6a9d2b5e7f0a1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f"
```

**Example response (200):**

```json
{
  "data": [
    {
      "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "user": { "first_name": "Jane", "last_name": "S." },
      "has_pin": true,
      "is_clocked_in": true
    },
    {
      "id": "5bb5ff45-1234-5678-9abc-def012345678",
      "user": { "first_name": "Bob",  "last_name": "J." },
      "has_pin": true,
      "is_clocked_in": false
    }
  ]
}
```

**Example response (200) — no eligible employees:**

```json
{ "data": [] }
```

- Ordered by `user.first_name` then `user.last_name`.
- `has_pin` is always `true` (the query already filters on `kiosk_pin_hash != null`).
- `is_clocked_in` is computed from a secondary query for any `clock_session` in `active` or `on_break` status.

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | `X-Kiosk-Token` header missing or empty | `{"statusCode":401,"message":"Missing X-Kiosk-Token header","error":"Unauthorized"}` |
| `401` | Token does not match any tenant's `kiosk_token_hash`, OR that tenant has `kiosk_mode_enabled = false` | `{"statusCode":401,"message":"Invalid kiosk token","error":"Unauthorized"}` |

---

### 15.2 `POST /time-clock/kiosk/clock-in`

Authenticate an employee with their PIN and create a clock session. The controller returns `HTTP 200` (not 201) on success — the `@HttpCode(200)` decorator is explicit.

**Auth:** `X-Kiosk-Token`

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `employee_profile_id` | uuid | ✅ | — | Must belong to the kiosk's tenant |
| `pin` | string | ✅ | 4–6 digits, `^\d{4,6}$` | |
| `project_id` | uuid | — | — | Optional — used when `require_job_tag` is on |
| `task_id` | uuid | — | — | Optional — used when `require_task_tag` is on |
| `notes` | string | — | ≤500 chars | |

**Behavior:**

- Rate-limit check first.
- Employee must exist and be `is_active = true` with a `kiosk_pin_hash`.
- Not-locked-out check.
- `bcrypt.compare(pin, kiosk_pin_hash)`:
  - On success, `kiosk_pin_failed_attempts` is reset to `0`.
  - On failure, attempts increment; after 5 failures, `kiosk_pin_locked_until = now() + 15min`.
- Delegates to `ClockSessionService.clockIn()` with `location_source = "kiosk"`. All the same business rules apply (geofence, require tags, active session check).

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/kiosk/clock-in \
  -H "X-Kiosk-Token: tc_k_3a4f1e8c6a9d2b5e7f0a1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "pin": "4821",
    "project_id": "p-aaaa-1111-2222-3333-444444444444",
    "notes": "Kiosk at front desk"
  }'
```

**Example response (200):** Detail-shape `ClockSession` (§11.1 response) with `clock_in_location_source = "kiosk"`.

```json
{
  "id": "cs-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "work_shift_id": null,
  "project_id": "p-aaaa-1111-2222-3333-444444444444",
  "task_id": null,
  "clockin_address_id": null,
  "status": "active",
  "clock_in_at": "2026-04-13T13:00:00.000Z",
  "clock_out_at": null,
  "clock_in_latitude": null,
  "clock_in_longitude": null,
  "clock_in_location_source": "kiosk",
  "clock_in_geofence_status": "not_enforced",
  "total_worked_minutes": null,
  "regular_minutes": null,
  "overtime_minutes": null,
  "is_manual_edit": false,
  "is_flagged": false,
  "flag_reason": null,
  "labor_cost_posted": false,
  "notes": "Kiosk at front desk",
  "created_at": "2026-04-13T13:00:00.000Z",
  "updated_at": "2026-04-13T13:00:00.000Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" },
    "crew_member": null
  },
  "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel", "project_number": "2026-042", "status": "in_progress" },
  "task": null,
  "work_shift": null,
  "clockin_address": null,
  "break_entries": [],
  "edit_logs": [],
  "disputes": []
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Missing or malformed PIN / employee_profile_id | `{"statusCode":400,"message":["PIN must be 4-6 digits"],"error":"Bad Request"}` |
| `401` | Wrong PIN — the body additionally includes `remaining_attempts` | `{"statusCode":401,"message":"Invalid PIN","remaining_attempts":3,"error":"Unauthorized"}` |
| `401` | Missing/invalid `X-Kiosk-Token` header | `{"statusCode":401,"message":"Invalid kiosk token","error":"Unauthorized"}` |
| `404` | Employee does not exist, is inactive, or has no PIN set | `{"statusCode":404,"message":"Employee not found","error":"Not Found"}` |
| `409` | Employee already has an active session | `{"statusCode":409,"message":"Employee already has an active session","error":"Conflict"}` |
| `423` | PIN has been locked after 5 failures | `{"statusCode":423,"message":"Account locked for 15 minutes"}` |
| `429` | Rate limit: more than 10 PIN attempts/minute/token | `{"statusCode":429,"message":"Too many PIN attempts. Please wait."}` |

**Audit log:** `action = "created"` on `clock_session` (same as JWT clock-in).

---

### 15.3 `POST /time-clock/kiosk/clock-out`

End the employee's current session via kiosk PIN. Same rate limit and lockout behavior as §15.2.

**Auth:** `X-Kiosk-Token`
**HTTP status on success:** `200 OK`.

**Request body:**

| Field | Type | Required | Validation | Description |
|---|---|---|---|---|
| `employee_profile_id` | uuid | ✅ | — | Must belong to the kiosk's tenant |
| `pin` | string | ✅ | 4–6 digits, `^\d{4,6}$` | |
| `notes` | string | — | ≤500 chars | |

**Example request:**

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/kiosk/clock-out \
  -H "X-Kiosk-Token: tc_k_3a4f1e8c6a9d2b5e7f0a1c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "pin": "4821",
    "notes": "Wrapped up at the front desk"
  }'
```

**Example response (200):** Detail-shape `ClockSession` with `status = "completed"`, populated pay fields, and `clock_out_location_source = "kiosk"`.

```json
{
  "id": "cs-aaaa-1111-2222-3333-444444444444",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "status": "completed",
  "clock_in_at": "2026-04-13T13:00:00.000Z",
  "clock_out_at": "2026-04-13T21:30:00.000Z",
  "clock_in_location_source": "kiosk",
  "clock_out_location_source": "kiosk",
  "clock_in_geofence_status": "not_enforced",
  "clock_out_geofence_status": "not_enforced",
  "total_worked_minutes": 510,
  "regular_minutes": 480,
  "overtime_minutes": 30,
  "is_manual_edit": false,
  "is_flagged": false,
  "labor_cost_posted": true,
  "notes": "Kiosk at front desk\nWrapped up at the front desk",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": { "id": "32cd6d0d-...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" },
    "crew_member": null
  },
  "project": { "id": "p-aaaa-...", "name": "Kitchen Remodel", "project_number": "2026-042", "status": "in_progress" },
  "task": null,
  "work_shift": null,
  "clockin_address": null,
  "break_entries": [],
  "edit_logs": [],
  "disputes": []
}
```

**Audit log:** `action = "updated"` on `clock_session`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Missing or malformed PIN / employee_profile_id | `{"statusCode":400,"message":["PIN must be 4-6 digits"],"error":"Bad Request"}` |
| `401` | Wrong PIN — includes `remaining_attempts` | `{"statusCode":401,"message":"Invalid PIN","remaining_attempts":3,"error":"Unauthorized"}` |
| `401` | Missing/invalid `X-Kiosk-Token` header | `{"statusCode":401,"message":"Invalid kiosk token","error":"Unauthorized"}` |
| `404` | Employee or active session not found | `{"statusCode":404,"message":"No active clock session found","error":"Not Found"}` |
| `423` | PIN locked after 5 failures | `{"statusCode":423,"message":"Account locked for 15 minutes"}` |
| `429` | Rate limit exceeded | `{"statusCode":429,"message":"Too many PIN attempts. Please wait."}` |

---

## 16. Endpoints — Dashboard

Controller: `src/modules/time-clock/controllers/time-clock-dashboard.controller.ts`
Service: `src/modules/time-clock/services/time-clock-dashboard.service.ts`

### 16.1 `GET /time-clock/dashboard/whos-in`

Fast "who's clocked in right now" view. Returns every session where `status IN ('active', 'on_break')` in the tenant. Not paginated. Ordered by `clock_in_at` ascending (oldest first).

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`

**Request body:** *none*

**Example request:**

```bash
curl -X GET https://api.lead360.app/api/v1/time-clock/dashboard/whos-in \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "total_clocked_in": 4,
  "total_on_break": 1,
  "employees": [
    {
      "employee_profile_id": "a111...",
      "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith" },
      "session": {
        "id": "cs-uuid",
        "status": "active",
        "clock_in_at": "2026-04-13T13:00:00.000Z",
        "elapsed_minutes": 47,
        "project": { "id": "p-uuid", "name": "Kitchen Remodel" },
        "task": { "id": "t-uuid", "title": "Install cabinets" },
        "clockin_address": { "label": "Smith Residence" },
        "is_flagged": false,
        "current_break": null
      }
    },
    {
      "employee_profile_id": "a333...",
      "user": { "id": "u444...", "first_name": "Bob", "last_name": "Jones" },
      "session": {
        "id": "cs-uuid-2",
        "status": "on_break",
        "clock_in_at": "2026-04-13T08:00:00.000Z",
        "elapsed_minutes": 347,
        "project": null,
        "task": null,
        "clockin_address": null,
        "is_flagged": false,
        "current_break": {
          "id": "be-uuid",
          "break_type": "unpaid",
          "break_label": "Lunch",
          "started_at": "2026-04-13T12:30:00.000Z"
        }
      }
    }
  ]
}
```

**Field notes:**

**Example response (200) — nobody clocked in:**

```json
{
  "total_clocked_in": 0,
  "total_on_break": 0,
  "employees": []
}
```

**Field notes:**

- `elapsed_minutes` = `floor((now - clock_in_at) / 60000)`; never goes negative.
- `total_clocked_in` counts sessions with `status = 'active'`.
- `total_on_break` counts sessions with `status = 'on_break'`.
- `current_break` is the single currently-open break (`ended_at IS NULL`) or `null`.
- Sessions are ordered by `clock_in_at ASC` (oldest first).

**Errors:**

| Status | When | Body |
|---|---|---|
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

## 17. Endpoints — Reports

Controller: `src/modules/time-clock/controllers/time-clock-reports.controller.ts`
Service: `src/modules/time-clock/services/time-clock-reports.service.ts`

Every report endpoint takes `date_from` and `date_to` as ISO 8601 dates (`"YYYY-MM-DD"`). The range is **inclusive** on both sides; both are required.

### 17.1 `GET /time-clock/reports/timesheet`

Grouped-by-employee-and-day timesheet for a date range.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`, `Bookkeeper`

**Query parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `date_from` | ISO 8601 date | ✅ | Inclusive start (`"YYYY-MM-DD"`) |
| `date_to` | ISO 8601 date | ✅ | Inclusive end |
| `employee_profile_id` | uuid | — | Scope to one employee |
| `project_id` | uuid | — | Scope to one project |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/reports/timesheet?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "date_from": "2026-04-01",
  "date_to": "2026-04-15",
  "employees": [
    {
      "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "user": { "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59", "first_name": "Jane", "last_name": "Smith" },
      "total_regular_minutes": 4800,
      "total_overtime_minutes": 120,
      "total_sessions": 10,
      "days": [
        {
          "date": "2026-04-10",
          "sessions": [
            {
              "id": "cs-aaaa-1111-2222-3333-444444444444",
              "clock_in_at": "2026-04-10T08:00:00.000Z",
              "clock_out_at": "2026-04-10T17:00:00.000Z",
              "total_worked_minutes": 480,
              "regular_minutes": 480,
              "overtime_minutes": 0,
              "project": { "id": "p-aaaa-1111-2222-3333-444444444444", "name": "Kitchen Remodel" },
              "task": { "id": "t-aaaa-1111-2222-3333-444444444444", "title": "Install cabinets" },
              "is_flagged": false,
              "is_manual_edit": false
            }
          ],
          "day_regular_minutes": 480,
          "day_overtime_minutes": 0,
          "day_total_minutes": 480
        }
      ]
    }
  ]
}
```

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Missing or malformed `date_from` / `date_to` | `{"statusCode":400,"message":["date_from must be a valid ISO 8601 date string"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 17.2 `GET /time-clock/reports/payroll`

Per-employee pay summary for a date range. Uses `hourly_rate` from `employee_profile` if set, else `crew_member.default_hourly_rate`, else `0`. Overtime multiplier comes from `time_clock_settings.overtime_multiplier` (default `1.5`).

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Bookkeeper`

**Query parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `date_from` | ISO 8601 date | ✅ | Inclusive start (`"YYYY-MM-DD"`) |
| `date_to` | ISO 8601 date | ✅ | Inclusive end |
| `employee_profile_id` | uuid | — | Scope to one employee |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/reports/payroll?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "date_from": "2026-04-01",
  "date_to": "2026-04-15",
  "summary": {
    "total_employees": 3,
    "total_regular_hours": 240.00,
    "total_overtime_hours": 12.50,
    "total_regular_pay": 6000.00,
    "total_overtime_pay": 468.75,
    "total_pay": 6468.75
  },
  "employees": [
    {
      "employee_profile_id": "a111...",
      "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith", "email": "jane@example.com" },
      "hourly_rate": 25.00,
      "regular_hours": 80.00,
      "overtime_hours": 4.50,
      "overtime_multiplier": 1.50,
      "regular_pay": 2000.00,
      "overtime_pay": 168.75,
      "total_pay": 2168.75,
      "sessions_count": 10,
      "flagged_sessions": 1,
      "manual_edits": 0
    }
  ]
}
```

- All currency/hour fields are JSON **numbers** (not strings) rounded to 2 decimals.
- Conversion: `hours = minutes / 60`, rounded to 2 decimals.
- `regular_pay = regular_hours * hourly_rate`
- `overtime_pay = overtime_hours * hourly_rate * overtime_multiplier`
- `total_pay = regular_pay + overtime_pay`
- Rate resolution: `employee_profile.hourly_rate` → `crew_member.default_hourly_rate` → `0`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Missing or malformed `date_from` / `date_to` | `{"statusCode":400,"message":["date_from must be a valid ISO 8601 date string"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 17.3 `GET /time-clock/reports/payroll/export`

Streams the same data as §17.2 but as a CSV file.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Bookkeeper`

**Query parameters:** identical to §17.2.

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/reports/payroll/export?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer <JWT>" \
  -o payroll_2026-04-01_2026-04-15.csv
```

**Example response (200):**

Headers:

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="payroll_2026-04-01_2026-04-15.csv"
```

Body (CSV, one header row + one row per employee):

```
Employee Name,Employee ID,Email,Hourly Rate,Regular Hours,Overtime Hours,Overtime Multiplier,Regular Pay,Overtime Pay,Total Pay,Sessions Count,Flagged Sessions,Manual Edits
Jane Smith,4fa4fe34-f38c-4e59-8c8f-e8f91a39558c,jane@example.com,25.00,80.00,4.50,1.50,2000.00,168.75,2168.75,10,1,0
Bob Jones,5bb5ff45-...,bob@example.com,22.00,160.00,8.00,1.50,3520.00,264.00,3784.00,20,0,2
```

> This endpoint uses `res.send(csv)` directly — the body is plain text, not JSON. Do NOT attempt to parse as JSON.

**Audit log:** `action = "accessed"`, `entityType = "payroll_export"`, `entityId = "payroll_export"`, plus `metadata = { date_from, date_to, employee_profile_id, total_employees, total_pay }`. The literal `"accessed"` value is written through the audit logger to the `action_type` column verbatim — if the frontend team filters audit logs they should match on `"accessed"` exactly, not `"exported"`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Missing or malformed `date_from` / `date_to` | `{"statusCode":400,"message":["date_from must be a valid ISO 8601 date string"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 17.4 `GET /time-clock/reports/shift-variance`

Compare scheduled `work_shift` rows against the matching `clock_session` to compute variance.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`

**Query parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `date_from` | ISO 8601 date | ✅ | Inclusive start |
| `date_to` | ISO 8601 date | ✅ | Inclusive end |
| `employee_profile_id` | uuid | — | Scope to one employee |
| `project_id` | uuid | — | Scope to one project |
| `page` | integer | — | Default `1` |
| `limit` | integer | — | Default `20`, max `100` |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/reports/shift-variance?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "date_from": "2026-04-01",
  "date_to": "2026-04-15",
  "data": [
    {
      "work_shift_id": "ws-aaaa-1111-2222-3333-444444444444",
      "employee_profile_id": "a111...",
      "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith" },
      "project": { "id": "p-uuid", "name": "Kitchen Remodel" },
      "scheduled_start": "2026-04-10T08:00:00.000Z",
      "scheduled_end": "2026-04-10T17:00:00.000Z",
      "scheduled_minutes": 540,
      "actual_clock_in_at": "2026-04-10T08:05:00.000Z",
      "actual_clock_out_at": "2026-04-10T17:02:00.000Z",
      "actual_worked_minutes": 477,
      "variance_start_minutes": 5,
      "variance_end_minutes": 2,
      "variance_total_minutes": -63,
      "shift_status": "completed",
      "session_id": "cs-uuid"
    }
  ],
  "meta": { "total": 14, "page": 1, "limit": 20, "totalPages": 1 }
}
```

**Field notes:**

- `variance_start_minutes` = `actual_clock_in_at - scheduled_start` (positive = late).
- `variance_end_minutes` = `actual_clock_out_at - scheduled_end` (positive = worked past end).
- `variance_total_minutes` = `actual_worked_minutes - scheduled_minutes` (negative = worked less than scheduled).
- If no matching session exists, `actual_*` and `variance_*` are `null` and `shift_status` is `missed` or `scheduled`.

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Missing or malformed `date_from` / `date_to` | `{"statusCode":400,"message":["date_from must be a valid ISO 8601 date string"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 17.5 `GET /time-clock/reports/geo-violations`

Sessions flagged for geofence issues (outside or unavailable) in the range.

**Auth:** JWT • **Roles:** `Owner`, `Admin`

**Query parameters:**

| Name | Type | Required | Description |
|---|---|---|---|
| `date_from` | ISO 8601 date | ✅ | Inclusive start |
| `date_to` | ISO 8601 date | ✅ | Inclusive end |
| `employee_profile_id` | uuid | — | Scope to one employee |
| `page` | integer | — | Default `1` |
| `limit` | integer | — | Default `20`, max `100` |

**Filter logic:** `is_flagged = true` AND `clock_in_geofence_status IN ('outside', 'unavailable')` within the date range.

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/reports/geo-violations?date_from=2026-04-01&date_to=2026-04-15" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "session_id": "cs-uuid",
      "employee_profile_id": "a111...",
      "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith" },
      "clock_in_at": "2026-04-10T08:05:12.000Z",
      "clock_in_latitude": 30.41322,
      "clock_in_longitude": -97.84712,
      "clock_in_geofence_status": "outside",
      "is_flagged": true,
      "flag_reason": "Outside geofence (nearest 412m)",
      "nearest_address": {
        "id": "ca-aaaa-1111-2222-3333-444444444444",
        "label": "Main Office",
        "distance_meters": 413
      },
      "project": { "id": "p-uuid", "name": "Kitchen Remodel" },
      "status": "completed"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

- `clock_in_latitude`/`clock_in_longitude` are JSON **numbers** (Decimal → number conversion happens in this report only).
- `nearest_address` is `null` if no clock-in addresses exist in the tenant OR if coordinates were unavailable.
- `distance_meters` is the haversine distance from the session's clock-in coordinates to the nearest address, **rounded to the nearest integer** (`Math.round` in the service — no fractional meters).

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Missing or malformed `date_from` / `date_to` | `{"statusCode":400,"message":["date_from must be a valid ISO 8601 date string"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller is not Owner or Admin | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

### 17.6 `GET /time-clock/reports/activity-feed`

Unified reverse-chronological feed of time-clock events. Used to power the admin activity sidebar.

**Auth:** JWT • **Roles:** `Owner`, `Admin`, `Project Manager`

**Query parameters:**

| Name | Type | Default | Description |
|---|---|---|---|
| `limit` | integer | `50` | `1 ≤ x ≤ 200` |
| `employee_profile_id` | uuid | — | Scope to one employee |
| `after` | ISO 8601 | — | Cursor — return events strictly BEFORE this timestamp (descending pagination) |

**Example request:**

```bash
curl -X GET "https://api.lead360.app/api/v1/time-clock/reports/activity-feed?limit=50" \
  -H "Authorization: Bearer <JWT>"
```

**Example response (200):**

```json
{
  "data": [
    {
      "event_type": "clock_out",
      "timestamp": "2026-04-13T17:00:00.000Z",
      "employee_profile_id": "a111...",
      "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith" },
      "session_id": "cs-uuid",
      "project": { "id": "p-uuid", "name": "Kitchen Remodel" },
      "details": {
        "total_worked_minutes": 510,
        "regular_minutes": 480,
        "overtime_minutes": 30
      }
    },
    {
      "event_type": "break_start",
      "timestamp": "2026-04-13T12:00:00.000Z",
      "employee_profile_id": "a111...",
      "user": { "id": "u222...", "first_name": "Jane", "last_name": "Smith" },
      "session_id": "cs-uuid",
      "project": { "id": "p-uuid", "name": "Kitchen Remodel" },
      "details": { "break_type": "unpaid", "break_label": "Lunch" }
    }
  ]
}
```

### Activity `event_type` reference

| `event_type` | `details` shape |
|---|---|
| `clock_in` | `{ "notes": string \| null }` |
| `clock_out` | `{ "total_worked_minutes": number, "regular_minutes": number, "overtime_minutes": number }` |
| `break_start` | `{ "break_type": "paid" \| "unpaid", "break_label": string \| null }` |
| `break_end` | `{ "break_type": "paid" \| "unpaid", "break_label": string \| null, "duration_minutes": number }` |
| `dispute_submitted` | `{ "dispute_type": "flag_only" \| "correction_request", "dispute_id": string }` |
| `dispute_approved` | `{ "dispute_type": "...", "dispute_id": string, "review_notes": string \| null }` |
| `dispute_rejected` | `{ "dispute_type": "...", "dispute_id": string, "review_notes": string }` |
| `manual_edit` | `{ "field_changed": string, "original_value": string \| null, "new_value": string \| null, "reason": string, "edited_by_user_id": string }` |
| `shift_missed` | `{ "shift_id": string, "scheduled_start": "...", "scheduled_end": "..." }` |

**Errors:**

| Status | When | Body |
|---|---|---|
| `400` | Malformed `after` cursor or `limit` out of bounds | `{"statusCode":400,"message":["limit must not be greater than 200"],"error":"Bad Request"}` |
| `401` | Missing/invalid JWT | `{"statusCode":401,"message":"Unauthorized"}` |
| `403` | Caller lacks required role | `{"statusCode":403,"message":"Forbidden resource","error":"Forbidden"}` |

---

## 18. Background Jobs

Queue: `time-clock` (BullMQ, backed by Redis)
Scheduler: `src/modules/time-clock/schedulers/time-clock.scheduler.ts`
Processor: `src/modules/time-clock/processors/time-clock.processor.ts`

### 18.1 Missed Shift Detector

- **Cron:** `*/15 * * * *` (every 15 minutes)
- **Job name:** `missed-shift-check`
- **BullMQ options:** `attempts: 3`, `backoff: { type: 'exponential', delay: 10000 }`, `removeOnComplete: { count: 100 }`, `removeOnFail: { count: 500 }`
- **Entry point:** `MissedShiftService.detectMissedShifts()` → iterates all tenants and calls `processTenantMissedShifts(tenantId)`.
- **Logic:** For each tenant, finds every `work_shift` row where:
  - `status = 'scheduled'`
  - `scheduled_start < (now - time_clock_settings.missed_shift_threshold_minutes)`
  - No matching `clock_session` within a ±2 hour window of `scheduled_start`.
- Marks qualifying shifts as `status = 'missed'`.
- **Notifications:**
  - To each Admin/Owner of the tenant → `type = 'timeclock_missed_shift'`, title `"Missed Shift"`.
  - To the employee themselves → same `type`.
- **Error isolation:** Per-tenant try/catch — if one tenant errors, the rest still process. The job is marked failed only if an error escapes the loop.

### 18.2 Shift Reminder

- **Cron:** `* * * * *` (every minute)
- **Job name:** `shift-reminder`
- **BullMQ options:** `attempts: 2`, `backoff: { type: 'exponential', delay: 5000 }`, `removeOnComplete: { count: 100 }`, `removeOnFail: { count: 500 }`
- **Entry point:** `ShiftReminderService.sendReminders()`.
- **Logic:** For each tenant, finds every `work_shift` row where:
  - `status = 'scheduled'`
  - `published_at IS NOT NULL`
  - `scheduled_start BETWEEN now AND (now + shift_reminder_minutes)`
  - `reminder_sent_at IS NULL`
- **At-most-once guarantee:** The service stamps `reminder_sent_at = now()` **before** sending the notification. If the send fails, the reminder does not fire again — avoiding duplicate pushes to the employee.
- **Notifications:** Employee only → `type = 'timeclock_shift_reminder'`, title `"Upcoming Shift"`, message templated with minutes until start.

---

## 19. Notification Events

All notifications are written through `NotificationsService.createNotification()` with a unified shape. Each entry includes the `type`, who gets it, and when it fires.

| Event Type | Recipients | Title | Message Template | Trigger |
|---|---|---|---|---|
| `timeclock_kiosk_lockout` | Every active `Owner` + `Admin` in the tenant | `Kiosk Account Locked` | `{employeeName} has been locked out of the kiosk after 5 failed PIN attempts` | Fifth consecutive wrong PIN on kiosk (`KioskService.validatePin`) |
| `timeclock_missed_shift` | Every active `Owner` + `Admin` AND the affected employee | `Missed Shift` | `{employeeName} has not clocked in for a shift scheduled at {time}` | `MissedShiftService.detectMissedShifts()` marks a shift as `missed` |
| `timeclock_shift_reminder` | The affected employee only | `Upcoming Shift` | `Your shift starts in {minutes} minutes` | `ShiftReminderService.sendReminders()` |

All notifications include an `action_url` pointing to the relevant UI page (e.g. `/settings/time-clock` for lockouts). Frontend clients can navigate the user directly to that page when the notification is tapped.

---

## 20. Appendix A — Full Clock Session Shapes

### 20.1 Full field reference — `clock_session`

Mapped one-to-one from Prisma schema lines 5142–5192.

| Field | Type | Nullable | Notes |
|---|---|---|---|
| `id` | uuid | No | Primary key |
| `tenant_id` | uuid | No | Multi-tenant |
| `employee_profile_id` | uuid | No | FK → `employee_profile.id` |
| `work_shift_id` | uuid | Yes | Auto-linked on clock-in if a matching shift exists |
| `project_id` | uuid | Yes | |
| `task_id` | uuid | Yes | |
| `clockin_address_id` | uuid | Yes | Set only if geofence matched an address |
| `status` | enum | No | `active` \| `on_break` \| `completed` |
| `clock_in_at` | datetime | No | |
| `clock_out_at` | datetime | Yes | `null` until clock-out |
| `clock_in_latitude` | decimal(10,8) | Yes | Serialized as a string |
| `clock_in_longitude` | decimal(11,8) | Yes | Serialized as a string |
| `clock_in_location_source` | enum | No | Default `browser_gps` |
| `clock_in_geofence_status` | enum | No | Default `not_enforced` |
| `clock_out_latitude` | decimal(10,8) | Yes | |
| `clock_out_longitude` | decimal(11,8) | Yes | |
| `clock_out_location_source` | enum | No | Default `browser_gps` |
| `clock_out_geofence_status` | enum | No | Default `not_enforced` |
| `total_worked_minutes` | integer | Yes | `null` until clock-out |
| `regular_minutes` | integer | Yes | |
| `overtime_minutes` | integer | Yes | |
| `is_manual_edit` | boolean | No | Set true by the edit endpoint |
| `is_flagged` | boolean | No | Set true by GPS/geofence violations |
| `flag_reason` | string(255) | Yes | Populated when flagged |
| `labor_cost_posted` | boolean | No | True once the fire-and-forget labor post succeeds |
| `labor_cost_entry_id` | uuid | Yes | `financial_entry.id` when posted |
| `labor_cost_reconciliation_needed` | boolean | No | Set true when a posted session is manually edited |
| `notes` | text | Yes | |
| `created_at` | datetime | No | |
| `updated_at` | datetime | No | |

### 20.2 Decimal serialization rules

Prisma `Decimal` fields are serialized as **JSON strings** with stored precision in most endpoints. Exceptions:

- `time_clock_settings` response (`GET`/`PATCH /settings`) — **formatted to exactly 2 decimal places** (e.g. `"8.00"`).
- Payroll report (`GET /reports/payroll`) — all money/hours are **JSON numbers** rounded to 2 decimals (Decimal → number conversion).
- Geo-violations report (`GET /reports/geo-violations`) — `clock_in_latitude`/`clock_in_longitude`/`distance_meters` are **JSON numbers**.

Everywhere else (clock sessions, addresses, dashboard), Decimal fields remain as strings in the JSON.

---

**END OF DOCUMENT — 56 REST endpoints + 2 background jobs, verified line-by-line against the codebase at `src/modules/time-clock/` on 2026-04-13.**

### Endpoint count reconciliation

The sprint file states 57 endpoints; the codebase ships 56 distinct HTTP handlers:

- Settings: 3 (`GET /settings`, `PATCH /settings`, `POST /settings/kiosk-token/regenerate`)
- Employee Profiles: 7 (list, create, get, patch, set pin, delete pin, save push subscription)
- Clock-In Addresses: 7 (list, create, get, patch, delete, import-from-quote, import-from-lead)
- Employee-Project Assignments: 3 (list, create, delete)
- Work Shifts: 7 (list, create, bulk, mine, get, patch, delete)
- Clock Sessions: 9 (clock-in, clock-out, list, get, edit, me/active, me/available-projects, mine, active/all)
- Breaks: 3 (start, end, list)
- Disputes: 7 (submit, list, mine, get, approve, reject, cancel)
- Kiosk: 3 (employees, clock-in, clock-out)
- Dashboard: 1 (whos-in)
- Reports: 6 (timesheet, payroll, payroll export, shift-variance, geo-violations, activity-feed)

Total: **3 + 7 + 7 + 3 + 7 + 9 + 3 + 7 + 3 + 1 + 6 = 56**.
