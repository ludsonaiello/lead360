# Time Clock — Break Entry REST API

**Module:** `time-clock / break-entry`
**Base path:** `/api/v1/time-clock/sessions`
**Auth:** `Authorization: Bearer <JWT>` (required on every endpoint)
**Tenant:** `tenant_id` is always resolved from the JWT — never accepted from the client.
**Swagger tag:** `Time Clock - Breaks`

---

## 1. Overview

Breaks are sub-records of a clock session. The business rules enforced by this module:

| Rule | Description |
|---|---|
| BR-007B / BR-016 | Only **one** break may be active (`ended_at IS NULL`) per session at any time. |
| Session transition | Starting a break flips `clock_session.status` from `active` → `on_break`. Ending a break flips it back `on_break` → `active`. |
| Auto-end on clock-out | If the session is clocked out while a break is still open, the break is auto-ended (handled by `ClockSessionService.clockOut()`, not by this module). |
| Paid vs unpaid | `break_type = 'unpaid'` is subtracted from `total_worked_minutes` at clock-out. `break_type = 'paid'` is NOT subtracted. |
| Ownership | A caller may only manage breaks on sessions owned by their own `employee_profile.user_id`, **unless** they have the `Owner` or `Admin` role. |
| Tenant isolation | Every query filters by the caller's tenant. Cross-tenant access is impossible. |

All endpoints require the `JwtAuthGuard` + `RolesGuard` and are restricted to roles **`Owner`, `Admin`, `Project Manager`, `Employee`**.

---

## 2. Data Model — `break_entry`

| Field | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `tenant_id` | `uuid` | Tenant owning this break (never sent from the client) |
| `clock_session_id` | `uuid` | Parent clock session |
| `break_type` | `'paid' \| 'unpaid'` | Whether this break is deducted from worked minutes. Defaults to `unpaid`. |
| `break_label` | `string \| null` | Informational label (e.g. `Lunch`, `Rest`, `Coffee`). Max 50 chars. Not used in any calculation. |
| `started_at` | `ISO 8601 datetime` | Server-side timestamp set when the break is created. |
| `ended_at` | `ISO 8601 datetime \| null` | `null` while break is active. Populated on explicit end **or** auto-end at clock-out. |
| `duration_minutes` | `integer \| null` | Floor of `(ended_at − started_at) / 60_000`. Clamped to `≥ 0`. `null` until the break ends. |
| `created_at` | `ISO 8601 datetime` | Row creation timestamp |
| `updated_at` | `ISO 8601 datetime` | Row last-modified timestamp |

---

## 3. Endpoints

### 3.1 `POST /api/v1/time-clock/sessions/:id/breaks/start`

**Summary:** Start a break on an active clock session.

**Path parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `uuid` | Yes | Clock session ID (parent session) |

**Request headers**

| Header | Required | Value |
|---|---|---|
| `Authorization` | Yes | `Bearer <JWT>` |
| `Content-Type` | Yes | `application/json` |

**Request body** — `StartBreakDto`

| Field | Type | Required | Default | Validation | Description |
|---|---|---|---|---|---|
| `break_type` | `'paid' \| 'unpaid'` | No | `'unpaid'` | `IsEnum(BreakTypeEnum)` | Paid breaks do not reduce total worked minutes. |
| `break_label` | `string` | No | `null` | `IsString`, `MaxLength(50)` | Human-readable label such as `Lunch`, `Rest`, `Coffee`. |

Both fields are optional. An empty body (`{}`) is valid.

**Required roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Ownership:** A non-admin caller must be the owner of the session's `employee_profile`. `Owner` and `Admin` roles bypass this check.

**Success response — `201 Created`**

```json
{
  "id": "92eddb1e-381a-4e36-8e93-7cc87fdebabe",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "clock_session_id": "684a702b-d8dc-4155-b52b-5aaed1d3c74c",
  "break_type": "unpaid",
  "break_label": "Lunch",
  "started_at": "2026-04-13T02:44:19.822Z",
  "ended_at": null,
  "duration_minutes": null,
  "created_at": "2026-04-13T02:44:19.823Z",
  "updated_at": "2026-04-13T02:44:19.823Z"
}
```

**Side effect:** The parent session's `status` is updated from `active` to `on_break`.

**Error responses**

| Status | Error | When |
|---|---|---|
| `400 Bad Request` | `Can only start a break on an active session` | Session status is not `active` (e.g. `completed`). |
| `400 Bad Request` | `Validation failed` | `break_type` is not `'paid'`/`'unpaid'`, or `break_label` exceeds 50 chars. |
| `401 Unauthorized` | — | Missing or invalid JWT. |
| `403 Forbidden` | `You can only manage breaks on your own sessions` | Caller is not the session's employee and lacks `Owner`/`Admin`. |
| `403 Forbidden` | `Forbidden resource` | Caller's role is not in the allowed set. |
| `404 Not Found` | `Clock session not found` | Session does not exist in the caller's tenant. |
| `409 Conflict` | `A break is already active.` | An open break (`ended_at IS NULL`) already exists on this session. |
| `500 Internal Server Error` | — | Unexpected server error. |

**Example request**

```bash
curl -X POST "https://api.lead360.app/api/v1/time-clock/sessions/684a702b-d8dc-4155-b52b-5aaed1d3c74c/breaks/start" \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"break_type":"unpaid","break_label":"Lunch"}'
```

---

### 3.2 `POST /api/v1/time-clock/sessions/:id/breaks/end`

**Summary:** End the currently active break on a clock session.

**Path parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `uuid` | Yes | Clock session ID |

**Request headers**

| Header | Required | Value |
|---|---|---|
| `Authorization` | Yes | `Bearer <JWT>` |

**Request body:** None.

**Required roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Ownership:** Same as `start` — caller must own the session or hold `Owner`/`Admin`.

**Success response — `200 OK`**

The updated `break_entry` row, with `ended_at` and `duration_minutes` populated.

```json
{
  "id": "92eddb1e-381a-4e36-8e93-7cc87fdebabe",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "clock_session_id": "684a702b-d8dc-4155-b52b-5aaed1d3c74c",
  "break_type": "unpaid",
  "break_label": "Lunch",
  "started_at": "2026-04-13T02:44:19.822Z",
  "ended_at": "2026-04-13T02:59:32.117Z",
  "duration_minutes": 15,
  "created_at": "2026-04-13T02:44:19.823Z",
  "updated_at": "2026-04-13T02:59:32.118Z"
}
```

**Duration calculation:**
```
duration_minutes = max(
  0,
  floor((ended_at.getTime() − started_at.getTime()) / 60000)
)
```

**Side effect:** The parent session's `status` is updated from `on_break` back to `active`.

**Error responses**

| Status | Error | When |
|---|---|---|
| `401 Unauthorized` | — | Missing or invalid JWT. |
| `403 Forbidden` | `You can only manage breaks on your own sessions` | Caller is not the session's employee and lacks `Owner`/`Admin`. |
| `403 Forbidden` | `Forbidden resource` | Caller's role is not in the allowed set. |
| `404 Not Found` | `Clock session not found` | Session does not exist in the caller's tenant. |
| `404 Not Found` | `No active break found` | Session exists but has no open break. |
| `500 Internal Server Error` | — | Unexpected server error. |

**Example request**

```bash
curl -X POST "https://api.lead360.app/api/v1/time-clock/sessions/684a702b-d8dc-4155-b52b-5aaed1d3c74c/breaks/end" \
  -H "Authorization: Bearer $TOKEN"
```

---

### 3.3 `GET /api/v1/time-clock/sessions/:id/breaks`

**Summary:** List every break (active and ended) for a clock session, ordered by `started_at` ascending.

**Path parameters**

| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `uuid` | Yes | Clock session ID |

**Query parameters:** None.

**Request body:** None.

**Required roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

**Ownership:** No owner check — any role in the allowed set may list breaks for any session in their tenant. Tenant isolation is still enforced.

**Success response — `200 OK`**

```json
{
  "data": [
    {
      "id": "92eddb1e-381a-4e36-8e93-7cc87fdebabe",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "684a702b-d8dc-4155-b52b-5aaed1d3c74c",
      "break_type": "unpaid",
      "break_label": "Lunch",
      "started_at": "2026-04-13T02:44:19.822Z",
      "ended_at": "2026-04-13T02:59:32.117Z",
      "duration_minutes": 15,
      "created_at": "2026-04-13T02:44:19.823Z",
      "updated_at": "2026-04-13T02:59:32.118Z"
    },
    {
      "id": "f0e10107-38d0-4a52-a172-d2dc6cc2b0c5",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "clock_session_id": "684a702b-d8dc-4155-b52b-5aaed1d3c74c",
      "break_type": "paid",
      "break_label": "Coffee",
      "started_at": "2026-04-13T03:15:01.000Z",
      "ended_at": null,
      "duration_minutes": null,
      "created_at": "2026-04-13T03:15:01.001Z",
      "updated_at": "2026-04-13T03:15:01.001Z"
    }
  ]
}
```

Returns an empty array `{ "data": [] }` if the session has no breaks.

**Error responses**

| Status | Error | When |
|---|---|---|
| `401 Unauthorized` | — | Missing or invalid JWT. |
| `403 Forbidden` | `Forbidden resource` | Caller's role is not in the allowed set. |
| `404 Not Found` | `Clock session not found` | Session does not exist in the caller's tenant. |
| `500 Internal Server Error` | — | Unexpected server error. |

**Example request**

```bash
curl "https://api.lead360.app/api/v1/time-clock/sessions/684a702b-d8dc-4155-b52b-5aaed1d3c74c/breaks" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 4. Interaction With Clock-Out (reference only — not this module)

When `POST /api/v1/time-clock/sessions/clock-out` is called while the session has an open break, `ClockSessionService.clockOut()` automatically:

1. Sets `break_entry.ended_at = clock_out_at` and computes `duration_minutes` using the same formula as `endBreak()`.
2. Subtracts the sum of all `break_type = 'unpaid'` `duration_minutes` from `total_worked_minutes`.
3. Transitions the session from `on_break` → `completed`.

Consumers should not need to call `POST /breaks/end` before clock-out — the clock-out endpoint handles it.

---

## 5. Execution Order Summary

### `startBreak`
1. Load the session (with `employee_profile.user_id`) filtered by `tenant_id`. → `404` if not found.
2. Ownership check: caller must own the session OR hold `Owner`/`Admin`. → `403` otherwise.
3. Reject if an open break already exists on the session. → `409 Conflict`.
4. Reject if the session status is not `active`. → `400 Bad Request`.
5. Create the `break_entry` row with `started_at = now()`.
6. Update the session `status → on_break`.
7. Return the created break.

### `endBreak`
1. Load the session filtered by `tenant_id`. → `404` if not found.
2. Ownership check. → `403` otherwise.
3. Find the single open break on the session. → `404` if none.
4. Compute `duration_minutes = max(0, floor((now − started_at) / 60000))`.
5. Update the break with `ended_at` and `duration_minutes`.
6. Update the session `status → active`.
7. Return the updated break.

### `getBreaks`
1. Verify session exists in the caller's tenant. → `404` if not found.
2. Return every break for the session ordered by `started_at ASC`.

---

## 6. Security Checklist

- [x] All endpoints protected by `JwtAuthGuard` + `RolesGuard`.
- [x] All Prisma queries include `where: { tenant_id }`.
- [x] `tenant_id` and `user_id` are derived exclusively from the JWT — never accepted in request bodies.
- [x] Path `id` validated as a UUID via `ParseUUIDPipe`.
- [x] Ownership enforced for non-admin callers on mutating operations.
- [x] `break_label` length capped at 50 characters to prevent payload abuse.
- [x] `break_type` restricted by `IsEnum` — only `'paid'`/`'unpaid'` accepted.
