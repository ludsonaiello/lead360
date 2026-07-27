# Work Shift REST API

**Module:** time-clock
**Base path:** `/api/v1/time-clock`
**Authentication:** Bearer JWT required for every endpoint.
**Tenant scope:** Every request is scoped to the caller's `tenant_id` (resolved from JWT). The client never sends or overrides `tenant_id`.

Work shifts represent scheduled work periods for employees. Every shift is anchored to an `employee_profile` and can optionally be tied to a `project` and/or a `project_task`. When created, shifts are automatically published (`published_at = now()`) and start in the `scheduled` state.

**Status transitions (managed by the clock-session workflow, not by this API directly):**

```
scheduled ──► in_progress ──► completed
     │                             
     ├──► cancelled                
     └──► missed                   
```

---

## Route summary

| # | Method | Path                                 | Roles                                        | Description                        |
|---|--------|--------------------------------------|----------------------------------------------|------------------------------------|
| 1 | GET    | `/time-clock/shifts/mine`            | Owner, Admin, Project Manager, Employee      | Current user's published shifts    |
| 2 | POST   | `/time-clock/shifts/bulk`            | Owner, Admin, Project Manager                | Create up to 50 shifts atomically  |
| 3 | GET    | `/time-clock/shifts`                 | Owner, Admin, Project Manager                | Paginated list of shifts           |
| 4 | POST   | `/time-clock/shifts`                 | Owner, Admin, Project Manager                | Create a single shift              |
| 5 | GET    | `/time-clock/shifts/:id`             | Owner, Admin, Project Manager                | Retrieve a single shift            |
| 6 | PATCH  | `/time-clock/shifts/:id`             | Owner, Admin, Project Manager                | Partial update                     |
| 7 | DELETE | `/time-clock/shifts/:id`             | Owner, Admin, Project Manager                | Delete (only `scheduled`/`cancelled`) |

> **Route ordering is critical.** `/shifts/mine` and `/shifts/bulk` are declared before `/shifts/:id` so they are matched as static routes rather than UUID parameters.

---

## Shared schemas

### WorkShift (list/detail response object)

| Field                 | Type                    | Nullable | Description                                                                 |
|-----------------------|-------------------------|----------|-----------------------------------------------------------------------------|
| `id`                  | string (uuid)           | no       | Shift identifier                                                            |
| `tenant_id`           | string (uuid)           | no       | Tenant owning the shift                                                     |
| `employee_profile_id` | string (uuid)           | no       | Employee profile owning the shift                                           |
| `project_id`          | string (uuid)           | yes      | Optional project association                                                |
| `task_id`             | string (uuid)           | yes      | Optional task association                                                   |
| `scheduled_start`     | string (ISO 8601)       | no       | Shift start time                                                            |
| `scheduled_end`       | string (ISO 8601)       | no       | Shift end time (always `> scheduled_start`)                                 |
| `title`               | string (≤100)           | yes      | Optional short label                                                        |
| `notes`               | string                  | yes      | Optional free-form notes                                                    |
| `status`              | enum                    | no       | One of `scheduled`, `in_progress`, `completed`, `missed`, `cancelled`        |
| `reminder_sent_at`    | string (ISO 8601)       | yes      | Timestamp when the reminder notification was sent (set by background jobs)  |
| `published_at`        | string (ISO 8601)       | yes      | Set on creation; `null` means draft (drafts are not returned by `/mine`)    |
| `created_by_user_id`  | string (uuid)           | no       | User who created the shift                                                  |
| `created_at`          | string (ISO 8601)       | no       | Created timestamp                                                           |
| `updated_at`          | string (ISO 8601)       | no       | Last-modified timestamp                                                     |
| `employee_profile`    | object (optional)       | no       | Included in list/detail responses. Contains `id` and nested `user`.         |
| `employee_profile.user` | object                | no       | `{ id, first_name, last_name, email }`                                      |
| `project`             | object (optional)       | yes      | Included in list/detail responses. `{ id, name }` or `null`                 |
| `task`                | object (optional)       | yes      | Included in detail and `/mine`. `{ id, title }` or `null`                   |

### Pagination meta

```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

### Error envelope

All non-2xx responses follow the standard NestJS error envelope:

```json
{
  "statusCode": 400,
  "message": "scheduled_end must be after scheduled_start",
  "error": "Bad Request"
}
```

Validation failures (from `class-validator`) return `message` as an array of field errors.

---

## 1. List shifts

`GET /api/v1/time-clock/shifts`

Paginated list of shifts. Supports filtering by employee, project, status, and a date range anchored on `scheduled_start`. Ordered by `scheduled_start ASC`.

**Roles:** `Owner`, `Admin`, `Project Manager`

### Query parameters

| Name                  | Type    | Default | Validation                                                | Description                                              |
|-----------------------|---------|---------|-----------------------------------------------------------|----------------------------------------------------------|
| `page`                | integer | 1       | `@IsInt` `@Min(1)`                                        | Page number                                              |
| `limit`               | integer | 20      | `@IsInt` `@Min(1)` `@Max(100)`                            | Page size                                                |
| `employee_profile_id` | uuid    | —       | `@IsUUID`                                                 | Restrict to shifts for a specific employee               |
| `project_id`          | uuid    | —       | `@IsUUID`                                                 | Restrict to shifts for a specific project                |
| `date_from`           | ISO 8601 | —      | `@IsDateString`                                           | Only return shifts with `scheduled_start >= date_from`   |
| `date_to`             | ISO 8601 | —      | `@IsDateString`                                           | Only return shifts with `scheduled_start <= date_to`     |
| `status`              | enum    | —       | one of `scheduled,in_progress,completed,missed,cancelled` | Restrict to shifts in a given status                     |

### Example request

```http
GET /api/v1/time-clock/shifts?page=1&limit=20&status=scheduled&date_from=2026-04-01T00:00:00.000Z HTTP/1.1
Host: api.lead360.app
Authorization: Bearer <jwt>
```

### Response 200

```json
{
  "data": [
    {
      "id": "66666666-6666-6666-6666-666666666666",
      "tenant_id": "11111111-1111-1111-1111-111111111111",
      "employee_profile_id": "33333333-3333-3333-3333-333333333333",
      "project_id": "44444444-4444-4444-4444-444444444444",
      "task_id": null,
      "scheduled_start": "2026-04-20T08:00:00.000Z",
      "scheduled_end": "2026-04-20T17:00:00.000Z",
      "title": "Morning Shift",
      "notes": null,
      "status": "scheduled",
      "reminder_sent_at": null,
      "published_at": "2026-04-12T10:00:00.000Z",
      "created_by_user_id": "22222222-2222-2222-2222-222222222222",
      "created_at": "2026-04-12T10:00:00.000Z",
      "updated_at": "2026-04-12T10:00:00.000Z",
      "employee_profile": {
        "id": "33333333-3333-3333-3333-333333333333",
        "user": {
          "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
          "first_name": "Jane",
          "last_name": "Doe",
          "email": "jane@example.com"
        }
      },
      "project": { "id": "44444444-4444-4444-4444-444444444444", "name": "Downtown Remodel" }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### Error responses

| Status | When                                                     |
|--------|----------------------------------------------------------|
| 400    | Query params fail validation                             |
| 401    | Missing or invalid JWT                                   |
| 403    | Caller lacks required role                               |

---

## 2. Create shift

`POST /api/v1/time-clock/shifts`

Creates a single shift. The shift starts in status `scheduled` and is published immediately (`published_at = now()`).

**Roles:** `Owner`, `Admin`, `Project Manager`

### Request body

| Field                 | Type     | Required | Validation                                    | Description                                       |
|-----------------------|----------|----------|-----------------------------------------------|---------------------------------------------------|
| `employee_profile_id` | uuid     | yes      | `@IsUUID`                                     | Must belong to the caller tenant                  |
| `project_id`          | uuid     | no       | `@IsUUID` when present                        | Must belong to the caller tenant when provided    |
| `task_id`             | uuid     | no       | `@IsUUID` when present                        | Must belong to the caller tenant when provided    |
| `scheduled_start`     | ISO 8601 | yes      | `@IsDateString`                               | Start timestamp                                   |
| `scheduled_end`       | ISO 8601 | yes      | `@IsDateString`                               | Must be strictly greater than `scheduled_start`   |
| `title`               | string   | no       | `@MaxLength(100)`                             | Display label                                     |
| `notes`               | string   | no       | —                                             | Free-form notes                                   |

> Clients must **never** send `tenant_id`, `created_by_user_id`, `status`, or `published_at`. They are derived server-side.

### Example request

```http
POST /api/v1/time-clock/shifts HTTP/1.1
Host: api.lead360.app
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "employee_profile_id": "33333333-3333-3333-3333-333333333333",
  "project_id": "44444444-4444-4444-4444-444444444444",
  "scheduled_start": "2026-04-20T08:00:00.000Z",
  "scheduled_end": "2026-04-20T17:00:00.000Z",
  "title": "Morning Shift",
  "notes": "Bring safety kit"
}
```

### Response 201

Returns the created shift using the same schema as the list response (with `employee_profile.user` and `project` included).

### Error responses

| Status | When                                                                                  |
|--------|----------------------------------------------------------------------------------------|
| 400    | Validation failure (missing field, invalid UUID, `scheduled_end <= scheduled_start`)  |
| 401    | Missing or invalid JWT                                                                 |
| 403    | Caller lacks required role                                                             |
| 404    | `employee_profile_id`, `project_id`, or `task_id` not found in caller tenant           |

---

## 3. Bulk create shifts

`POST /api/v1/time-clock/shifts/bulk`

Creates up to 50 shifts in a single transaction. Every shift in the payload is validated **before** any database write; if any validation fails the entire batch is rejected and no shifts are created.

**Roles:** `Owner`, `Admin`, `Project Manager`

### Request body

| Field    | Type                         | Required | Validation                                 | Description                   |
|----------|------------------------------|----------|--------------------------------------------|-------------------------------|
| `shifts` | array of `CreateWorkShiftDto` | yes      | `@ArrayMinSize(1)` `@ArrayMaxSize(50)` `@ValidateNested({ each: true })` | Shifts to create |

Each entry has the same shape and validation rules as the single-create body.

### Example request

```http
POST /api/v1/time-clock/shifts/bulk HTTP/1.1
Host: api.lead360.app
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "shifts": [
    {
      "employee_profile_id": "33333333-3333-3333-3333-333333333333",
      "scheduled_start": "2026-04-20T08:00:00.000Z",
      "scheduled_end": "2026-04-20T17:00:00.000Z",
      "title": "Day 1"
    },
    {
      "employee_profile_id": "33333333-3333-3333-3333-333333333333",
      "scheduled_start": "2026-04-21T08:00:00.000Z",
      "scheduled_end": "2026-04-21T17:00:00.000Z",
      "title": "Day 2"
    }
  ]
}
```

### Response 201

```json
{
  "created": 2,
  "shifts": [ { "id": "...", "scheduled_start": "...", "...": "..." }, { "id": "..." } ]
}
```

Each element of `shifts` uses the same schema as the single-create response.

### Error responses

| Status | When                                                                                                    |
|--------|----------------------------------------------------------------------------------------------------------|
| 400    | `shifts` empty, contains more than 50 entries, or any entry has `scheduled_end <= scheduled_start`       |
| 401    | Missing or invalid JWT                                                                                   |
| 403    | Caller lacks required role                                                                               |
| 404    | Any `employee_profile_id`, `project_id`, or `task_id` not found in caller tenant (batch is rejected)     |

---

## 4. Get shift by ID

`GET /api/v1/time-clock/shifts/:id`

Retrieves a single shift by its UUID. The response includes `employee_profile.user`, `project`, and `task`.

**Roles:** `Owner`, `Admin`, `Project Manager`

### Path parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | uuid | Shift identifier |

### Example request

```http
GET /api/v1/time-clock/shifts/66666666-6666-6666-6666-666666666666 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer <jwt>
```

### Response 200

```json
{
  "id": "66666666-6666-6666-6666-666666666666",
  "tenant_id": "11111111-1111-1111-1111-111111111111",
  "employee_profile_id": "33333333-3333-3333-3333-333333333333",
  "project_id": "44444444-4444-4444-4444-444444444444",
  "task_id": null,
  "scheduled_start": "2026-04-20T08:00:00.000Z",
  "scheduled_end": "2026-04-20T17:00:00.000Z",
  "title": "Morning Shift",
  "notes": null,
  "status": "scheduled",
  "reminder_sent_at": null,
  "published_at": "2026-04-12T10:00:00.000Z",
  "created_by_user_id": "22222222-2222-2222-2222-222222222222",
  "created_at": "2026-04-12T10:00:00.000Z",
  "updated_at": "2026-04-12T10:00:00.000Z",
  "employee_profile": {
    "id": "33333333-3333-3333-3333-333333333333",
    "user": {
      "id": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane@example.com"
    }
  },
  "project": { "id": "44444444-4444-4444-4444-444444444444", "name": "Downtown Remodel" },
  "task": null
}
```

### Error responses

| Status | When                                           |
|--------|------------------------------------------------|
| 400    | `id` is not a valid UUID                       |
| 401    | Missing or invalid JWT                         |
| 403    | Caller lacks required role                     |
| 404    | Shift not found in caller tenant               |

---

## 5. Update shift

`PATCH /api/v1/time-clock/shifts/:id`

Partially updates a shift. Any combination of fields may be provided. If `scheduled_start` or `scheduled_end` is updated, the final pair must still satisfy `scheduled_end > scheduled_start` (the existing value is used for whichever side is omitted).

**Roles:** `Owner`, `Admin`, `Project Manager`

### Path parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | uuid | Shift identifier |

### Request body (all fields optional)

| Field                 | Type     | Validation                                                | Description                                   |
|-----------------------|----------|-----------------------------------------------------------|-----------------------------------------------|
| `employee_profile_id` | uuid     | `@IsUUID`                                                 | Must belong to caller tenant                  |
| `project_id`          | uuid     | `@IsUUID`                                                 | Must belong to caller tenant                  |
| `task_id`             | uuid     | `@IsUUID`                                                 | Must belong to caller tenant                  |
| `scheduled_start`     | ISO 8601 | `@IsDateString`                                           | New start                                     |
| `scheduled_end`       | ISO 8601 | `@IsDateString`                                           | New end                                       |
| `title`               | string   | `@MaxLength(100)`                                         | Display label                                 |
| `notes`               | string   | —                                                         | Free-form notes                               |
| `status`              | enum     | one of `scheduled,in_progress,completed,missed,cancelled` | Explicit status override (use with care)      |

### Example request

```http
PATCH /api/v1/time-clock/shifts/66666666-6666-6666-6666-666666666666 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer <jwt>
Content-Type: application/json

{
  "title": "Morning Shift — Updated",
  "scheduled_end": "2026-04-20T18:00:00.000Z"
}
```

### Response 200

Returns the updated shift using the list-response schema (`employee_profile.user` and `project` included).

### Error responses

| Status | When                                                                            |
|--------|--------------------------------------------------------------------------------|
| 400    | Validation failure or resulting `scheduled_end <= scheduled_start`             |
| 401    | Missing or invalid JWT                                                          |
| 403    | Caller lacks required role                                                      |
| 404    | Shift, employee profile, project, or task not found in caller tenant            |

---

## 6. Delete shift

`DELETE /api/v1/time-clock/shifts/:id`

Hard-deletes a shift. Only shifts in `scheduled` or `cancelled` status can be deleted; any other status returns `400`.

**Roles:** `Owner`, `Admin`, `Project Manager`

### Path parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | uuid | Shift identifier |

### Example request

```http
DELETE /api/v1/time-clock/shifts/66666666-6666-6666-6666-666666666666 HTTP/1.1
Host: api.lead360.app
Authorization: Bearer <jwt>
```

### Response 200

```json
{ "message": "Shift deleted successfully" }
```

### Error responses

| Status | When                                                                    |
|--------|-------------------------------------------------------------------------|
| 400    | Shift status is not `scheduled` or `cancelled` (e.g. `in_progress`)     |
| 401    | Missing or invalid JWT                                                  |
| 403    | Caller lacks required role                                              |
| 404    | Shift not found in caller tenant                                        |

---

## 7. Get my shifts

`GET /api/v1/time-clock/shifts/mine`

Returns the paginated list of **published** shifts belonging to the currently authenticated employee. This endpoint is specifically intended for the employee mobile experience and is therefore available to the `Employee` role in addition to the management roles.

**Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

The server looks up the caller's `employee_profile` by `user_id` + `tenant_id`. If the current user has no employee profile in this tenant, a `404` is returned. Only shifts with `published_at IS NOT NULL` are returned (drafts are invisible to employees). Results are ordered by `scheduled_start ASC` and include `project` and `task` objects.

### Query parameters

| Name        | Type    | Default | Validation                          | Description                                           |
|-------------|---------|---------|-------------------------------------|-------------------------------------------------------|
| `page`      | integer | 1       | `@IsInt` `@Min(1)`                  | Page number                                           |
| `limit`     | integer | 20      | `@IsInt` `@Min(1)` `@Max(100)`      | Page size                                             |
| `date_from` | ISO 8601 | —      | `@IsDateString`                     | Shifts with `scheduled_start >= date_from`            |
| `date_to`   | ISO 8601 | —      | `@IsDateString`                     | Shifts with `scheduled_start <= date_to`              |
| `status`    | enum    | —       | one of the 5 work-shift statuses     | Filter by status                                      |

### Example request

```http
GET /api/v1/time-clock/shifts/mine?status=scheduled HTTP/1.1
Host: api.lead360.app
Authorization: Bearer <jwt>
```

### Response 200

```json
{
  "data": [
    {
      "id": "66666666-6666-6666-6666-666666666666",
      "tenant_id": "11111111-1111-1111-1111-111111111111",
      "employee_profile_id": "33333333-3333-3333-3333-333333333333",
      "project_id": "44444444-4444-4444-4444-444444444444",
      "task_id": null,
      "scheduled_start": "2026-04-20T08:00:00.000Z",
      "scheduled_end": "2026-04-20T17:00:00.000Z",
      "title": "Morning Shift",
      "notes": null,
      "status": "scheduled",
      "reminder_sent_at": null,
      "published_at": "2026-04-12T10:00:00.000Z",
      "created_by_user_id": "22222222-2222-2222-2222-222222222222",
      "created_at": "2026-04-12T10:00:00.000Z",
      "updated_at": "2026-04-12T10:00:00.000Z",
      "project": { "id": "44444444-4444-4444-4444-444444444444", "name": "Downtown Remodel" },
      "task": null
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

### Error responses

| Status | When                                                              |
|--------|-------------------------------------------------------------------|
| 400    | Query params fail validation                                      |
| 401    | Missing or invalid JWT                                            |
| 403    | Caller lacks any of the listed roles                              |
| 404    | Current user has no `employee_profile` in this tenant             |

---

## Audit log

Every CREATE (including each entry of a bulk create), UPDATE, and DELETE emits an `AuditLoggerService.logTenantChange` entry with `entityType = 'work_shift'` and `action = created | updated | deleted`. Updates record both `before` and `after`; deletes record `before`.

## Integration notes

- Work shifts are consumed by the Clock Session module to match clock-in events to scheduled shifts.
- The missed-shift detector (background scheduler) uses `published_at`, `scheduled_start`, and `scheduled_end` to flag shifts that were never started.
- `/shifts/mine` is the primary endpoint powering the employee mobile schedule view.
