# Employee-Project Assignment REST API

**Module:** `time-clock` — Employee-Project Assignments
**Base URL:** `https://api.lead360.app/api/v1`
**Local Base URL:** `http://localhost:8000/api/v1`
**Sprint:** 6 (Employee-Project Assignments CRUD)

All endpoints in this module require a valid JWT bearer token.
All endpoints are restricted to the `Owner` and `Admin` roles.
All queries are scoped to the authenticated user's `tenant_id` — tenant isolation is enforced server-side. Clients never supply `tenant_id` or `assigned_by_user_id`; both are derived from the JWT.

The purpose of this resource is to assign employee profiles to projects. The assignment drives:

- Project-scoped geofencing at clock-in time (Sprint 9)
- Shift eligibility validation for project-scoped shifts (Sprint 7)
- The admin UI that manages which employees work on which projects

---

## Authentication & Authorization

```
Authorization: Bearer <jwt-access-token>
```

| Guard           | Purpose                                                       |
|-----------------|---------------------------------------------------------------|
| `JwtAuthGuard`  | Validates JWT; rejects expired/invalid tokens                 |
| `RolesGuard`    | Enforces `@Roles('Owner', 'Admin')` on every endpoint         |

**Common error responses:**

- `401 Unauthorized` — missing/invalid token
- `403 Forbidden` — authenticated user lacks `Owner` or `Admin` role
- `404 Not Found` — resource does not exist or belongs to another tenant
- `409 Conflict` — duplicate assignment for the same `(employee_profile_id, project_id)` pair

---

## Shared Objects

### `EmployeeProjectAssignment` (response object)

| Field                  | Type                                   | Nullable | Description                                                   |
|------------------------|----------------------------------------|----------|---------------------------------------------------------------|
| `id`                   | `string (uuid)`                        | no       | Primary key                                                   |
| `tenant_id`            | `string (uuid)`                        | no       | Owning tenant (always the authenticated user's tenant)        |
| `employee_profile_id`  | `string (uuid)`                        | no       | FK → `employee_profile.id`                                    |
| `project_id`           | `string (uuid)`                        | no       | FK → `project.id`                                             |
| `assigned_by_user_id`  | `string (uuid)`                        | no       | User who created the assignment (from JWT `sub` / `user.id`)  |
| `created_at`           | `ISO-8601 datetime`                    | no       | Creation timestamp                                            |
| `employee_profile`     | `EmployeeProfile` (see below)          | no       | Eager-loaded employee profile with nested user                |
| `project`              | `{ id: string; name: string }`         | no       | Eager-loaded project (minimal fields)                         |

### `EmployeeProfile` (nested in responses)

Includes all columns from the `employee_profile` model plus a nested `user` object with:

| Field         | Type              |
|---------------|-------------------|
| `id`          | `string (uuid)`   |
| `first_name`  | `string`          |
| `last_name`   | `string`          |
| `email`       | `string`          |

### Pagination envelope

```json
{
  "data": [ EmployeeProjectAssignment, ... ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

### Error envelope

```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Employee profile not found",
  "error": "Not Found",
  "timestamp": "2026-04-13T00:13:22.396Z",
  "path": "/api/v1/time-clock/employee-projects",
  "requestId": "req_171dabd01be9f95d"
}
```

---

## Endpoint Index

| Method   | Path                                          | Summary                                 |
|----------|-----------------------------------------------|-----------------------------------------|
| `GET`    | `/api/v1/time-clock/employee-projects`        | List employee-project assignments       |
| `POST`   | `/api/v1/time-clock/employee-projects`        | Assign an employee to a project         |
| `DELETE` | `/api/v1/time-clock/employee-projects/:id`    | Remove an employee-project assignment   |

---

## 1. List Employee-Project Assignments

`GET /api/v1/time-clock/employee-projects`

Returns a paginated list of employee-project assignments for the authenticated tenant. Results are ordered by `created_at` descending and include the related employee profile (with nested user) and the related project (id and name).

### Authentication
Required — `JwtAuthGuard`

### Roles
`Owner`, `Admin`

### Query Parameters

| Name                  | Type                 | Required | Default | Validation                        | Description                                  |
|-----------------------|----------------------|----------|---------|-----------------------------------|----------------------------------------------|
| `page`                | `integer`            | no       | `1`     | `>= 1`                            | Page number (1-indexed)                      |
| `limit`               | `integer`            | no       | `50`    | `1 <= limit <= 100`               | Page size                                    |
| `employee_profile_id` | `string (uuid v4)`   | no       | —       | Valid UUID                        | Filter assignments for a specific employee   |
| `project_id`          | `string (uuid v4)`   | no       | —       | Valid UUID                        | Filter assignments for a specific project    |

Unknown query parameters are rejected by the global `ValidationPipe` (`forbidNonWhitelisted: true`) and return `400 Bad Request`.

### Response — `200 OK`

```json
{
  "data": [
    {
      "id": "9bf649d5-a882-4020-982e-2f0058c39f67",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
      "project_id": "2ce7804e-0d73-4895-adce-882b0ff1f9e4",
      "assigned_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "created_at": "2026-04-13T00:13:22.219Z",
      "employee_profile": {
        "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
        "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
        "user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
        "crew_member_id": null,
        "hourly_rate": "35",
        "is_active": true,
        "created_at": "2026-04-12T22:37:53.590Z",
        "updated_at": "2026-04-12T22:38:34.607Z",
        "user": {
          "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
          "first_name": "Ludson",
          "last_name": "Menezes",
          "email": "contact@honeydo4you.com"
        }
      },
      "project": {
        "id": "2ce7804e-0d73-4895-adce-882b0ff1f9e4",
        "name": "Driveway Replacement Projeto"
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 50,
    "totalPages": 1
  }
}
```

### Error Responses

| Status | When                                          |
|--------|-----------------------------------------------|
| `400`  | Invalid query param (non-UUID, negative page) |
| `401`  | Missing/invalid JWT                           |
| `403`  | Caller is not `Owner` or `Admin`              |

### Example Request

```bash
curl -s -X GET \
  "http://localhost:8000/api/v1/time-clock/employee-projects?page=1&limit=20&project_id=2ce7804e-0d73-4895-adce-882b0ff1f9e4" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 2. Create Employee-Project Assignment

`POST /api/v1/time-clock/employee-projects`

Creates a new assignment of an employee profile to a project. The `assigned_by_user_id` is always the authenticated user's ID — clients must **not** send it in the request body.

### Authentication
Required — `JwtAuthGuard`

### Roles
`Owner`, `Admin`

### Request Body

| Field                 | Type               | Required | Validation | Description                  |
|-----------------------|--------------------|----------|------------|------------------------------|
| `employee_profile_id` | `string (uuid v4)` | yes      | Valid UUID | FK → `employee_profile.id`   |
| `project_id`          | `string (uuid v4)` | yes      | Valid UUID | FK → `project.id`            |

Unknown body fields are rejected by `ValidationPipe` (`forbidNonWhitelisted: true`) and return `400 Bad Request`. The server ignores `tenant_id`, `assigned_by_user_id`, `id`, `created_at`, or any other field if present.

### Response — `201 Created`

Returns the full `EmployeeProjectAssignment` (with eager-loaded `employee_profile.user` and `project`), same shape as in the list response.

```json
{
  "id": "9bf649d5-a882-4020-982e-2f0058c39f67",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
  "project_id": "2ce7804e-0d73-4895-adce-882b0ff1f9e4",
  "assigned_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-04-13T00:13:22.219Z",
  "employee_profile": {
    "id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "user": {
      "id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "first_name": "Ludson",
      "last_name": "Menezes",
      "email": "contact@honeydo4you.com"
    }
  },
  "project": {
    "id": "2ce7804e-0d73-4895-adce-882b0ff1f9e4",
    "name": "Driveway Replacement Projeto"
  }
}
```

### Error Responses

| Status | `message`                                      | When                                                                |
|--------|------------------------------------------------|---------------------------------------------------------------------|
| `400`  | `"validation failed"`                          | Missing or malformed `employee_profile_id`/`project_id`             |
| `401`  | `"Unauthorized"`                               | Missing/invalid JWT                                                 |
| `403`  | `"Forbidden resource"`                         | Caller is not `Owner` or `Admin`                                    |
| `404`  | `"Employee profile not found"`                 | `employee_profile_id` does not exist in the authenticated tenant    |
| `404`  | `"Project not found"`                          | `project_id` does not exist in the authenticated tenant             |
| `409`  | `"Employee is already assigned to this project"` | `(tenant_id, employee_profile_id, project_id)` already exists     |

### Example Request

```bash
curl -s -X POST \
  "http://localhost:8000/api/v1/time-clock/employee-projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "employee_profile_id": "4fa4fe34-f38c-4e59-8c8f-e8f91a39558c",
    "project_id": "2ce7804e-0d73-4895-adce-882b0ff1f9e4"
  }'
```

---

## 3. Remove Employee-Project Assignment

`DELETE /api/v1/time-clock/employee-projects/:id`

Hard-deletes an employee-project assignment. The assignment must belong to the authenticated tenant. This is a permanent deletion — there is no soft-delete flag on this resource.

### Authentication
Required — `JwtAuthGuard`

### Roles
`Owner`, `Admin`

### Path Parameters

| Name | Type               | Required | Validation          | Description                       |
|------|--------------------|----------|---------------------|-----------------------------------|
| `id` | `string (uuid v4)` | yes      | Valid UUID (`ParseUUIDPipe`) | Primary key of the assignment |

### Response — `200 OK`

```json
{
  "message": "Assignment removed successfully"
}
```

### Error Responses

| Status | `message`                          | When                                                     |
|--------|------------------------------------|----------------------------------------------------------|
| `400`  | `"Validation failed (uuid is expected)"` | `id` is not a valid UUID                           |
| `401`  | `"Unauthorized"`                   | Missing/invalid JWT                                      |
| `403`  | `"Forbidden resource"`             | Caller is not `Owner` or `Admin`                         |
| `404`  | `"Assignment not found"`           | Assignment does not exist or belongs to another tenant   |

### Example Request

```bash
curl -s -X DELETE \
  "http://localhost:8000/api/v1/time-clock/employee-projects/9bf649d5-a882-4020-982e-2f0058c39f67" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Integrity & Business Rules

1. **Tenant isolation.** Every query includes `where: { tenant_id }` resolved from the JWT. Cross-tenant reads, writes, and deletes are impossible by design.
2. **FK validation on create.** Both `employee_profile_id` and `project_id` are validated to belong to the authenticated tenant before the insert runs.
3. **Unique constraint.** The database enforces `@@unique([tenant_id, employee_profile_id, project_id])`. The service performs a pre-check and returns `409 Conflict` with a human-readable message instead of surfacing a Prisma unique-violation error.
4. **Hard delete.** `DELETE` is final — there is no soft-delete column on `employee_project_assignment`.
5. **Audit trail.** `assigned_by_user_id` is set from the JWT and never trusted from client input.

---

## Related Resources

- `employee_profile` — Sprint 4, `api/documentation/employee_profile_REST_API.md`
- `clockin_address` — Sprint 5, `api/documentation/clockin_address_REST_API.md`
- `project` — Project module REST API
