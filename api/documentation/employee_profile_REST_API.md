# Employee Profile — REST API Documentation

**Module:** `time-clock`
**Sprint:** 4 — Employee Profile DTOs + Service + Controller
**Base URL:** `https://api.lead360.app/api/v1`
**Local Dev URL:** `http://127.0.0.1:8000/api/v1`
**Authentication:** Bearer JWT required on all endpoints
**Multi-Tenant:** All queries scoped by `tenant_id` from JWT — never accepted from the client
**Total Endpoints:** 7

---

## Overview

The Employee Profile resource is the time-clock module's representation of an
individual worker. It is the join point between the platform `user` record and
the crew-management `crew_member` record, and it carries the worker's kiosk PIN,
per-employee overtime rules, and web-push subscription.

Key business rules enforced in this sprint:

- **BR-013** — When creating a profile without a `crew_member_id`, the service
  will auto-link an existing `crew_member` that matches the `user_id` within the
  tenant.
- A `user_id` is unique per tenant; creating a second profile for the same user
  returns **409 Conflict**.
- The target user must be an **ACTIVE** member of the tenant
  (`user_tenant_membership.status = 'ACTIVE'`).
- Kiosk PINs are hashed with bcrypt (12 rounds); the plaintext PIN is never
  returned, logged, or stored.
- The `kiosk_pin_hash` and `push_subscription_json` fields are **never**
  returned in any response payload.

---

## Endpoint Index

| # | Method | Path                                               | Roles                                      |
|---|--------|----------------------------------------------------|--------------------------------------------|
| 1 | POST   | `/time-clock/employees/me/push-subscription`       | Owner, Admin, Project Manager, Employee    |
| 2 | GET    | `/time-clock/employees`                            | Owner, Admin                               |
| 3 | POST   | `/time-clock/employees`                            | Owner, Admin                               |
| 4 | GET    | `/time-clock/employees/:id`                        | Owner, Admin                               |
| 5 | PATCH  | `/time-clock/employees/:id`                        | Owner, Admin                               |
| 6 | POST   | `/time-clock/employees/:id/pin`                    | Owner, Admin                               |
| 7 | DELETE | `/time-clock/employees/:id/pin`                    | Owner, Admin                               |

> **Route ordering:** `/time-clock/employees/me/push-subscription` is declared
> **before** `/time-clock/employees/:id` in the controller so `me` is not
> interpreted as an `:id` path parameter.

---

## Common Data Structures

### `EmployeeProfile` (response object)

| Field                              | Type                 | Nullable | Description                                                                    |
|------------------------------------|----------------------|----------|--------------------------------------------------------------------------------|
| `id`                               | `uuid`               | no       | Profile ID.                                                                    |
| `tenant_id`                        | `uuid`               | no       | Tenant that owns the profile.                                                  |
| `user_id`                          | `uuid`               | no       | Platform user linked to this profile.                                          |
| `crew_member_id`                   | `uuid`               | yes      | Linked crew member (auto-linked when omitted on create).                       |
| `hourly_rate`                      | `decimal(10,2)`      | yes      | Override hourly rate; when null, crew member / tenant default applies.         |
| `overtime_rule_override`           | `boolean`            | no       | When true, the fields below override the tenant's overtime thresholds.         |
| `overtime_daily_threshold_hours`   | `decimal(4,2)`       | yes      | Employee daily OT threshold (0–24).                                            |
| `overtime_weekly_threshold_hours`  | `decimal(5,2)`       | yes      | Employee weekly OT threshold (0–168).                                          |
| `kiosk_pin_failed_attempts`        | `int`                | no       | Number of failed kiosk PIN attempts.                                           |
| `kiosk_pin_locked_until`           | `datetime`           | yes      | When the kiosk PIN is locked until.                                            |
| `is_active`                        | `boolean`            | no       | Whether the profile is active.                                                 |
| `push_token_native`                | `string`             | yes      | Native mobile push token.                                                      |
| `created_at`                       | `datetime`           | no       |                                                                                |
| `updated_at`                       | `datetime`           | no       |                                                                                |
| `user`                             | `UserSummary`        | no       | See below.                                                                     |
| `crew_member`                      | `CrewMemberSummary`  | yes      | See below.                                                                     |
| `project_assignments`              | `ProjectAssignment[]`| no\*     | Only included on the detail endpoint.                                          |

**Never returned:** `kiosk_pin_hash`, `push_subscription_json`.

### `UserSummary`

| Field        | Type     |
|--------------|----------|
| `id`         | `uuid`   |
| `first_name` | `string` |
| `last_name`  | `string` |
| `email`      | `string` |

### `CrewMemberSummary`

| Field                 | Type            |
|-----------------------|-----------------|
| `id`                  | `uuid`          |
| `first_name`          | `string`        |
| `last_name`           | `string`        |
| `default_hourly_rate` | `decimal(8,2)`  |

### `ProjectAssignment`

| Field                  | Type             |
|------------------------|------------------|
| `id`                   | `uuid`           |
| `employee_profile_id`  | `uuid`           |
| `project_id`           | `uuid`           |
| `assigned_by_user_id`  | `uuid`           |
| `created_at`           | `datetime`       |
| `project.id`           | `uuid`           |
| `project.name`         | `string`         |
| `project.status`       | `project_status` |

### Pagination meta

```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

---

## 1. Save Web Push Subscription (current user)

Save (or overwrite) the authenticated user's Web Push subscription JSON. The
profile is located by the JWT's `user_id` and `tenant_id` — the caller cannot
set a subscription for anyone else.

- **Method / Path:** `POST /time-clock/employees/me/push-subscription`
- **Auth:** Bearer JWT required
- **Roles:** `Owner`, `Admin`, `Project Manager`, `Employee`

### Request body

| Field                     | Type     | Required | Validation           | Description                     |
|---------------------------|----------|----------|----------------------|---------------------------------|
| `push_subscription_json`  | `string` | yes      | non-empty string     | Web Push subscription JSON blob |

### Response 201

```json
{ "message": "Push subscription saved" }
```

### Errors

| Status | Code                 | Reason                                                |
|--------|----------------------|-------------------------------------------------------|
| 400    | Bad Request          | Validation error (missing or empty field).            |
| 401    | Unauthorized         | Missing or invalid JWT.                               |
| 403    | Forbidden            | Role not permitted.                                   |
| 404    | Not Found            | `No employee profile found for current user`.        |

### Example

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/employees/me/push-subscription \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"push_subscription_json":"{\"endpoint\":\"https://fcm.googleapis.com/...\"}"}'
```

---

## 2. List Employee Profiles

Paginated list of employee profiles scoped to the caller's tenant.

- **Method / Path:** `GET /time-clock/employees`
- **Auth:** Bearer JWT required
- **Roles:** `Owner`, `Admin`

### Query parameters

| Name        | Type      | Default | Validation                    | Description                                    |
|-------------|-----------|---------|-------------------------------|------------------------------------------------|
| `page`      | `int`     | `1`     | integer ≥ 1                   | Page number (1-based).                         |
| `limit`     | `int`     | `20`    | integer in `[1, 100]`         | Page size.                                     |
| `is_active` | `boolean` | —       | boolean                       | Filter by active status.                       |
| `search`    | `string`  | —       | string, max 100 chars         | Matches user's `first_name`, `last_name`, or `email` (case-insensitive via MySQL collation). |

### Response 200

```json
{
  "data": [
    {
      "id": "…uuid…",
      "tenant_id": "…uuid…",
      "user_id": "…uuid…",
      "crew_member_id": "…uuid…",
      "hourly_rate": "25.00",
      "overtime_rule_override": false,
      "overtime_daily_threshold_hours": null,
      "overtime_weekly_threshold_hours": null,
      "kiosk_pin_failed_attempts": 0,
      "kiosk_pin_locked_until": null,
      "is_active": true,
      "push_token_native": null,
      "created_at": "2026-04-12T14:00:00.000Z",
      "updated_at": "2026-04-12T14:00:00.000Z",
      "user": {
        "id": "…uuid…",
        "first_name": "Jane",
        "last_name": "Doe",
        "email": "jane@example.com"
      },
      "crew_member": {
        "id": "…uuid…",
        "first_name": "Jane",
        "last_name": "Doe",
        "default_hourly_rate": "25.00"
      }
    }
  ],
  "meta": { "total": 1, "page": 1, "limit": 20, "totalPages": 1 }
}
```

`kiosk_pin_hash` and `push_subscription_json` are **never** present in the
response.

### Errors

| Status | Reason                               |
|--------|--------------------------------------|
| 400    | Invalid query parameters.            |
| 401    | Missing or invalid JWT.              |
| 403    | Role not permitted.                  |

### Example

```bash
curl -s "https://api.lead360.app/api/v1/time-clock/employees?page=1&limit=20&search=jane" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 3. Create Employee Profile

Create a new employee profile. The target user must be an **ACTIVE** member of
the caller's tenant, and must not already have a profile.

- **Method / Path:** `POST /time-clock/employees`
- **Auth:** Bearer JWT required
- **Roles:** `Owner`, `Admin`

### Request body

| Field                              | Type      | Required | Validation                        | Description                                                                |
|------------------------------------|-----------|----------|-----------------------------------|----------------------------------------------------------------------------|
| `user_id`                          | `uuid`    | yes      | valid UUID                        | Platform user to create the profile for.                                   |
| `crew_member_id`                   | `uuid`    | no       | valid UUID                        | Crew member to link; if omitted, an auto-link is attempted (BR-013).       |
| `hourly_rate`                      | `number`  | no       | ≥ 0, ≤ 2 decimals                 | Override hourly rate.                                                      |
| `overtime_rule_override`           | `boolean` | no       | boolean                           | Turn on per-employee OT thresholds.                                        |
| `overtime_daily_threshold_hours`   | `number`  | no       | in `[0, 24]`, ≤ 2 decimals        | Employee daily OT threshold.                                               |
| `overtime_weekly_threshold_hours`  | `number`  | no       | in `[0, 168]`, ≤ 2 decimals       | Employee weekly OT threshold.                                              |

Fields **not** accepted from the client: `id`, `tenant_id`, `is_active`,
`kiosk_pin_hash`, `kiosk_pin_failed_attempts`, `kiosk_pin_locked_until`,
`push_subscription_json`, `push_token_native`, `created_at`, `updated_at`.

### Response 201

An `EmployeeProfile` with `user` and `crew_member` includes (see structure
above). `crew_member` may be populated from the auto-link even if
`crew_member_id` was omitted in the request.

### Errors

| Status | Code                 | Reason                                                                           |
|--------|----------------------|----------------------------------------------------------------------------------|
| 400    | Bad Request          | Validation error.                                                                |
| 401    | Unauthorized         | Missing or invalid JWT.                                                          |
| 403    | Forbidden            | Role not permitted.                                                              |
| 404    | Not Found            | `User not found in this tenant` or `Crew member not found`.                      |
| 409    | Conflict             | `Employee profile already exists for this user`.                                 |

### Example

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/employees \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
        "user_id": "3f1a8c2c-6f5b-4b42-9b6d-8f1e2d3c4b5a",
        "hourly_rate": 27.50,
        "overtime_rule_override": true,
        "overtime_daily_threshold_hours": 8,
        "overtime_weekly_threshold_hours": 40
      }'
```

### Audit

- `action: 'created'`, `entityType: 'employee_profile'`, `after` = the created
  profile (with sensitive fields already stripped).

---

## 4. Get Employee Profile Detail

Fetch a single profile with its user, crew member, and project assignments.

- **Method / Path:** `GET /time-clock/employees/:id`
- **Auth:** Bearer JWT required
- **Roles:** `Owner`, `Admin`

### Path parameters

| Name | Type   | Description       |
|------|--------|-------------------|
| `id` | `uuid` | Profile UUID.     |

### Response 200

An `EmployeeProfile` with `user`, `crew_member`, and `project_assignments`
(including nested `project { id, name, status }`).

### Errors

| Status | Reason                             |
|--------|------------------------------------|
| 400    | Invalid UUID in path.              |
| 401    | Missing or invalid JWT.            |
| 403    | Role not permitted.                |
| 404    | `Employee profile not found`.      |

### Example

```bash
curl -s https://api.lead360.app/api/v1/time-clock/employees/$PROFILE_ID \
  -H "Authorization: Bearer $TOKEN"
```

---

## 5. Update Employee Profile

Partial update of the given profile. The `user_id` cannot be changed after
creation; it is intentionally absent from the update DTO.

- **Method / Path:** `PATCH /time-clock/employees/:id`
- **Auth:** Bearer JWT required
- **Roles:** `Owner`, `Admin`

### Path parameters

| Name | Type   | Description   |
|------|--------|---------------|
| `id` | `uuid` | Profile UUID. |

### Request body

All fields are optional; at least one must be provided.

| Field                              | Type      | Validation                     | Description                     |
|------------------------------------|-----------|--------------------------------|---------------------------------|
| `crew_member_id`                   | `uuid`    | valid UUID                     | Re-link crew member.            |
| `hourly_rate`                      | `number`  | ≥ 0, ≤ 2 decimals              | Override hourly rate.           |
| `overtime_rule_override`           | `boolean` | boolean                        |                                 |
| `overtime_daily_threshold_hours`   | `number`  | in `[0, 24]`, ≤ 2 decimals     |                                 |
| `overtime_weekly_threshold_hours`  | `number`  | in `[0, 168]`, ≤ 2 decimals    |                                 |
| `is_active`                        | `boolean` | boolean                        | Deactivate or reactivate.       |

### Response 200

The updated `EmployeeProfile` with `user` and `crew_member` includes.

### Errors

| Status | Reason                                                                        |
|--------|-------------------------------------------------------------------------------|
| 400    | Validation error.                                                             |
| 401    | Missing or invalid JWT.                                                       |
| 403    | Role not permitted.                                                           |
| 404    | `Employee profile not found` or `Crew member not found`.                      |

### Audit

- `action: 'updated'`, `entityType: 'employee_profile'`, includes `before` and
  `after` snapshots (sensitive fields stripped).

### Example

```bash
curl -X PATCH https://api.lead360.app/api/v1/time-clock/employees/$PROFILE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"hourly_rate": 35.00, "is_active": true}'
```

---

## 6. Set Kiosk PIN

Set (or replace) the kiosk PIN for an employee. The PIN is hashed with
**bcrypt (12 rounds)** before being persisted. The failed-attempt counter and
the locked-until timestamp are cleared on success.

- **Method / Path:** `POST /time-clock/employees/:id/pin`
- **Auth:** Bearer JWT required
- **Roles:** `Owner`, `Admin`

### Path parameters

| Name | Type   | Description   |
|------|--------|---------------|
| `id` | `uuid` | Profile UUID. |

### Request body

| Field | Type     | Required | Validation                                   | Description |
|-------|----------|----------|----------------------------------------------|-------------|
| `pin` | `string` | yes      | 4–6 digits, matches `^\d{4,6}$`              | Kiosk PIN.  |

### Response 201

```json
{ "message": "PIN updated successfully" }
```

### Errors

| Status | Reason                             |
|--------|------------------------------------|
| 400    | Validation error (wrong length / non-digits). |
| 401    | Missing or invalid JWT.            |
| 403    | Role not permitted.                |
| 404    | `Employee profile not found`.      |

### Audit

- `action: 'updated'`, `description: 'Updated kiosk PIN for employee'`.
- **Neither the plaintext PIN nor the hash is logged.** `before` and `after`
  are intentionally omitted.

### Example

```bash
curl -X POST https://api.lead360.app/api/v1/time-clock/employees/$PROFILE_ID/pin \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pin": "1234"}'
```

---

## 7. Remove Kiosk PIN

Clear the kiosk PIN for an employee. The failed-attempt counter and the
locked-until timestamp are also cleared.

- **Method / Path:** `DELETE /time-clock/employees/:id/pin`
- **Auth:** Bearer JWT required
- **Roles:** `Owner`, `Admin`

### Path parameters

| Name | Type   | Description   |
|------|--------|---------------|
| `id` | `uuid` | Profile UUID. |

### Response 200

```json
{ "message": "PIN removed successfully" }
```

### Errors

| Status | Reason                             |
|--------|------------------------------------|
| 401    | Missing or invalid JWT.            |
| 403    | Role not permitted.                |
| 404    | `Employee profile not found`.      |

### Audit

- `action: 'updated'`, `description: 'Removed kiosk PIN for employee'`.

### Example

```bash
curl -X DELETE https://api.lead360.app/api/v1/time-clock/employees/$PROFILE_ID/pin \
  -H "Authorization: Bearer $TOKEN"
```

---

## Error Response Format

All error responses follow NestJS's standard shape:

```json
{
  "statusCode": 404,
  "message": "Employee profile not found",
  "error": "Not Found"
}
```

Validation errors (400) return an array of messages:

```json
{
  "statusCode": 400,
  "message": ["pin must be longer than or equal to 4 characters"],
  "error": "Bad Request"
}
```

---

## Security & Multi-Tenancy Notes

- `tenant_id` is always resolved from the JWT (`req.user.tenant_id`) and is
  **never** read from the request body or query string.
- Every Prisma query in `EmployeeProfileService` includes `tenant_id` in its
  `where` clause.
- The kiosk PIN is stored only as a bcrypt hash (12 rounds) in
  `employee_profile.kiosk_pin_hash` and is never returned in any response.
- `push_subscription_json` is persisted on the profile but is never returned in
  any list or detail response.
- All CREATE / UPDATE / PIN operations emit an audit log entry via
  `AuditLoggerService.logTenantChange`.
