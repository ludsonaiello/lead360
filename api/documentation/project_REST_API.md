# Project REST API Documentation

**Module**: Projects
**Base URL**: `https://api.lead360.app/api/v1/projects`
**Authentication**: Bearer JWT required on all endpoints
**Multi-Tenant**: All queries scoped by `tenant_id` from JWT

---

## Endpoints Overview

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/projects` | Owner, Admin, Manager | Create standalone project |
| POST | `/projects/from-quote/:quoteId` | Owner, Admin, Manager | Create project from accepted quote |
| GET | `/projects` | Owner, Admin, Manager, Field | List projects (paginated) |
| GET | `/projects/:id` | Owner, Admin, Manager, Field | Get project detail |
| PATCH | `/projects/:id` | Owner, Admin, Manager | Update project |
| DELETE | `/projects/:id` | Owner, Admin | Soft delete project |
| POST | `/projects/:id/apply-template/:templateId` | Owner, Admin, Manager | Apply template to project |
| GET | `/projects/:id/change-orders-redirect` | Owner, Admin, Manager | Get redirect URL for quote's change orders tab |
| GET | `/projects/:id/summary` | Owner, Admin, Manager, Bookkeeper | Get financial summary |

---

## 1. POST /projects — Create Standalone Project

Creates a project not linked to any quote. `is_standalone = true`, `quote_id = null`, `lead_id = null`.

### Request

**Headers**:
```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Body**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | **yes** | max 200 chars | Project name |
| description | string | no | — | Project description |
| start_date | string | no | ISO date (YYYY-MM-DD) | Planned start date |
| target_completion_date | string | no | ISO date (YYYY-MM-DD) | Target completion date |
| permit_required | boolean | no | default: false | Whether permit is needed |
| assigned_pm_user_id | string | no | UUID | Assigned project manager |
| estimated_cost | number | no | >= 0 | Estimated project cost |
| notes | string | no | — | Internal notes |
| template_id | string | no | UUID | Template to seed tasks from |

### Example Request

```json
POST /api/v1/projects
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "name": "Office Build-out",
  "description": "Interior renovation for new office space",
  "start_date": "2026-04-01",
  "target_completion_date": "2026-06-30",
  "permit_required": true,
  "estimated_cost": 25000,
  "notes": "Phase 1 of 2"
}
```

### Success Response — 201 Created

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "tenant-uuid",
  "quote_id": null,
  "lead_id": null,
  "project_number": "PRJ-2026-0001",
  "name": "Office Build-out",
  "description": "Interior renovation for new office space",
  "status": "planned",
  "start_date": "2026-04-01",
  "target_completion_date": "2026-06-30",
  "actual_completion_date": null,
  "permit_required": true,
  "assigned_pm_user_id": null,
  "assigned_pm": null,
  "contract_value": null,
  "estimated_cost": 25000.00,
  "progress_percent": 0.00,
  "is_standalone": true,
  "portal_enabled": false,
  "deletion_locked": false,
  "notes": "Phase 1 of 2",
  "task_count": 0,
  "completed_task_count": 0,
  "quote": null,
  "lead": null,
  "created_by_user_id": "user-uuid",
  "created_by_user": {
    "id": "user-uuid",
    "first_name": "Jane",
    "last_name": "Admin"
  },
  "created_at": "2026-03-13T10:00:00.000Z",
  "updated_at": "2026-03-13T10:00:00.000Z"
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validation error (missing name, invalid dates, etc.) |
| 401 | Missing or invalid JWT token |
| 403 | User role not Owner, Admin, or Manager |

---

## 2. POST /projects/from-quote/:quoteId — Create Project from Quote

Creates a project from an accepted quote. Locks the quote, updates lead status to "customer", and seeds project tasks from quote items.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| quoteId | UUID | The quote to convert to a project |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | no | max 200 chars | Override name (defaults to quote.title) |
| description | string | no | — | Project description |
| start_date | string | no | ISO date | Planned start date |
| target_completion_date | string | no | ISO date | Target completion date |
| permit_required | boolean | no | default: false | Whether permit is needed |
| assigned_pm_user_id | string | no | UUID | Assigned project manager |
| notes | string | no | — | Internal notes |
| template_id | string | no | UUID | Additional template tasks to append |

### Business Rules

- Quote status must be `approved`, `started`, or `concluded`
- Only one project can be created per quote (duplicate prevention)
- Quote is locked (`deletion_locked = true`) after project creation
- Lead status is updated to `customer` if lead exists
- `contract_value` is set from `quote.total`
- Tasks are seeded from quote items (title, description, order preserved)
- Template tasks (if provided) are appended after quote item tasks

### Example Request

```json
POST /api/v1/projects/from-quote/quote-uuid-123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "start_date": "2026-04-15",
  "target_completion_date": "2026-07-01",
  "permit_required": true,
  "assigned_pm_user_id": "pm-user-uuid"
}
```

### Success Response — 201 Created

```json
{
  "id": "project-uuid",
  "tenant_id": "tenant-uuid",
  "quote_id": "quote-uuid-123",
  "lead_id": "lead-uuid",
  "project_number": "PRJ-2026-0002",
  "name": "Kitchen Remodel - Smith Residence",
  "description": null,
  "status": "planned",
  "start_date": "2026-04-15",
  "target_completion_date": "2026-07-01",
  "actual_completion_date": null,
  "permit_required": true,
  "assigned_pm_user_id": "pm-user-uuid",
  "assigned_pm": {
    "id": "pm-user-uuid",
    "first_name": "Jane",
    "last_name": "Admin"
  },
  "contract_value": 45000.00,
  "estimated_cost": null,
  "progress_percent": 0.00,
  "is_standalone": false,
  "portal_enabled": true,
  "deletion_locked": false,
  "notes": null,
  "task_count": 8,
  "completed_task_count": 0,
  "quote": {
    "id": "quote-uuid-123",
    "quote_number": "Q-2026-0015",
    "title": "Kitchen Remodel"
  },
  "lead": {
    "id": "lead-uuid",
    "first_name": "John",
    "last_name": "Smith"
  },
  "created_by_user_id": "user-uuid",
  "created_by_user": {
    "id": "user-uuid",
    "first_name": "Jane",
    "last_name": "Admin"
  },
  "created_at": "2026-03-13T10:00:00.000Z",
  "updated_at": "2026-03-13T10:00:00.000Z"
}
```

### Error Responses

| Status | Condition | Example Message |
|--------|-----------|-----------------|
| 400 | Quote status is not approved/started/concluded | "Quote status must be one of: approved, started, concluded. Current status: draft" |
| 401 | Missing or invalid JWT token | "Unauthorized" |
| 403 | User role not Owner, Admin, or Manager | "Forbidden" |
| 404 | Quote not found (or belongs to different tenant) | "Quote not found: {quoteId}" |
| 409 | A project already exists for this quote | "A project already exists for quote {quoteId}: PRJ-2026-0001" |

---

## 3. GET /projects — List Projects

Returns a paginated list of projects with task counts and basic related data.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number (1-indexed) |
| limit | number | 20 | Items per page (max: 100) |
| status | string | — | Filter by status: `planned`, `in_progress`, `on_hold`, `completed`, `canceled` |
| assigned_pm_user_id | string | — | Filter by assigned project manager UUID |
| search | string | — | Search by name or project_number |

### Example Request

```
GET /api/v1/projects?page=1&limit=20&status=in_progress&search=Kitchen
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response — 200 OK

```json
{
  "data": [
    {
      "id": "project-uuid-1",
      "tenant_id": "tenant-uuid",
      "quote_id": "quote-uuid",
      "lead_id": "lead-uuid",
      "project_number": "PRJ-2026-0002",
      "name": "Kitchen Remodel - Smith Residence",
      "description": "Full kitchen renovation",
      "status": "in_progress",
      "start_date": "2026-04-01",
      "target_completion_date": "2026-06-15",
      "actual_completion_date": null,
      "permit_required": true,
      "assigned_pm_user_id": "pm-uuid",
      "contract_value": 45000.00,
      "estimated_cost": 32000.00,
      "progress_percent": 37.50,
      "is_standalone": false,
      "portal_enabled": true,
      "deletion_locked": false,
      "notes": null,
      "created_by_user_id": "user-uuid",
      "created_at": "2026-03-10T10:00:00.000Z",
      "updated_at": "2026-03-13T14:22:00.000Z",
      "assigned_pm": {
        "id": "pm-uuid",
        "first_name": "Jane",
        "last_name": "Admin"
      },
      "quote": {
        "id": "quote-uuid",
        "quote_number": "Q-2026-0015",
        "title": "Kitchen Remodel"
      },
      "lead": {
        "id": "lead-uuid",
        "first_name": "John",
        "last_name": "Smith"
      },
      "task_count": 8,
      "completed_task_count": 3
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | User role not Owner, Admin, Manager, or Field |

---

## 4. GET /projects/:id — Get Project Detail

Returns a single project with full relations and task counts.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Project UUID |

### Example Request

```
GET /api/v1/projects/project-uuid-123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response — 200 OK

Same shape as the single project object shown in POST response, including:
- `assigned_pm` (object or null)
- `quote` (object or null)
- `lead` (object or null)
- `created_by_user` (object)
- `task_count` (number)
- `completed_task_count` (number)

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | User role not Owner, Admin, Manager, or Field |
| 404 | Project not found (or belongs to different tenant) |

---

## 5. PATCH /projects/:id — Update Project

Partially update a project. Only provided fields are changed.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Project UUID |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| name | string | no | max 200 chars | Project name |
| description | string | no | — | Project description |
| status | string | no | enum: planned, in_progress, on_hold, completed, canceled | Project status |
| start_date | string | no | ISO date | Start date |
| target_completion_date | string | no | ISO date | Target completion date |
| permit_required | boolean | no | — | Whether permit is needed |
| assigned_pm_user_id | string\|null | no | UUID or null | Assigned PM (null to unassign) |
| portal_enabled | boolean | no | — | Whether portal is enabled |
| notes | string | no | — | Internal notes |

### Business Rules

- When `status` changes to `completed`: `actual_completion_date` is automatically set to today
- When `status` changes away from `completed`: `actual_completion_date` is cleared

### Example Request

```json
PATCH /api/v1/projects/project-uuid-123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

{
  "status": "in_progress",
  "assigned_pm_user_id": "pm-user-uuid"
}
```

### Success Response — 200 OK

Returns the full updated project object (same shape as GET /projects/:id).

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Validation error (invalid status enum, etc.) |
| 401 | Missing or invalid JWT token |
| 403 | User role not Owner, Admin, or Manager |
| 404 | Project not found (or belongs to different tenant) |

---

## 6. DELETE /projects/:id — Soft Delete Project

Sets project status to `canceled`. Only allowed if no active tasks (in_progress or blocked) exist and the project is not locked.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Project UUID |

### Example Request

```
DELETE /api/v1/projects/project-uuid-123
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response — 200 OK

```json
{
  "message": "Project deleted successfully"
}
```

### Error Responses

| Status | Condition | Example Message |
|--------|-----------|-----------------|
| 400 | Project has active tasks | "Cannot delete project with 3 active task(s). Complete or remove active tasks first." |
| 400 | Project is locked | "This project is locked and cannot be deleted" |
| 401 | Missing or invalid JWT token | "Unauthorized" |
| 403 | User role not Owner or Admin | "Forbidden" |
| 404 | Project not found | "Project not found" |

---

## 7. GET /projects/:id/change-orders-redirect — Change Orders Redirect

Returns the frontend route to the Change Orders tab of the quote linked to this project. This is a read-only endpoint — no mutations. Returns HTTP 400 if the project is standalone (not created from a quote).

**Use case**: When a user clicks "Add Change Order" from a project view, the frontend calls this endpoint and navigates to the returned URL to manage change orders within the existing Quotes module.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | string (UUID) | Project UUID |

### Request

**Headers**:
```
Authorization: Bearer {jwt_token}
```

**Roles**: Owner, Admin, Manager

### Success Response (200)

```json
{
  "redirect_url": "/quotes/550e8400-e29b-41d4-a716-446655440000?tab=change-orders"
}
```

| Field | Type | Description |
|-------|------|-------------|
| redirect_url | string | Frontend route to the quote's Change Orders tab |

### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Project is standalone (no linked quote) | "This project was not created from a quote. Change orders are not available for standalone projects." |
| 401 | Missing or invalid JWT token | "Unauthorized" |
| 403 | User role not Owner, Admin, or Manager | "Forbidden" |
| 404 | Project not found (or belongs to different tenant) | "Project not found" |

### Example

**Request**:
```http
GET /api/v1/projects/550e8400-e29b-41d4-a716-446655440000/change-orders-redirect
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

**Response (200)** — Project linked to a quote:
```json
{
  "redirect_url": "/quotes/a1b2c3d4-e5f6-7890-abcd-ef1234567890?tab=change-orders"
}
```

**Response (400)** — Standalone project:
```json
{
  "statusCode": 400,
  "message": "This project was not created from a quote. Change orders are not available for standalone projects."
}
```

---

## 8. GET /projects/:id/summary — Financial Summary

Returns a combined financial summary for the project. Includes contract value, estimated cost, progress, task counts, and actual cost breakdown by category.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Project UUID |

### Example Request

```
GET /api/v1/projects/project-uuid-123/summary
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Success Response — 200 OK

```json
{
  "project_id": "project-uuid-123",
  "project_number": "PRJ-2026-0002",
  "contract_value": 45000.00,
  "estimated_cost": 32000.00,
  "progress_percent": 37.50,
  "task_count": 8,
  "completed_task_count": 3,
  "total_actual_cost": 12500.00,
  "cost_by_category": {
    "labor": 5000.00,
    "material": 4000.00,
    "subcontractor": 2500.00,
    "equipment": 500.00,
    "other": 500.00
  },
  "entry_count": 15
}
```

### Field Descriptions

| Field | Type | Description |
|-------|------|-------------|
| project_id | string | Project UUID |
| project_number | string | Human-readable project number |
| contract_value | number\|null | Total contract value (from quote.total for quote-based projects) |
| estimated_cost | number\|null | Estimated project cost |
| progress_percent | number | Computed: (done tasks / total tasks) * 100 |
| task_count | number | Total non-deleted tasks |
| completed_task_count | number | Tasks with status "done" |
| total_actual_cost | number | Sum of all financial entries |
| cost_by_category | object | Breakdown by category type |
| entry_count | number | Number of financial entries |

### Error Responses

| Status | Condition |
|--------|-----------|
| 401 | Missing or invalid JWT token |
| 403 | User role not Owner, Admin, Manager, or Bookkeeper |
| 404 | Project not found |

---

## 9. Apply Template to Project

**POST** `/api/v1/projects/:projectId/apply-template/:templateId`

Applies a project template to an existing project. Creates `project_task` records from the template's tasks and resolves `depends_on_order_index` references into `task_dependency` records.

Tasks are **appended** after any existing tasks in the project (order_index continues from the highest existing value + 1).

### Authentication

Bearer token required (JWT).

### Authorization

Roles: **Owner**, **Admin**, **Manager**

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `projectId` | UUID | Yes | The project to apply the template to |
| `templateId` | UUID | Yes | The template to apply |

### Request Body

None.

### Success Response (200)

```json
{
  "message": "Template applied successfully",
  "tasks_created": 8,
  "dependencies_created": 3
}
```

| Field | Type | Description |
|-------|------|-------------|
| `message` | string | Confirmation message |
| `tasks_created` | number | Number of project_task records created |
| `dependencies_created` | number | Number of task_dependency records created |

### Error Responses

| Status | Condition |
|--------|-----------|
| 400 | Template is inactive (`is_active = false`) |
| 401 | Missing or invalid JWT token |
| 403 | User role not Owner, Admin, or Manager |
| 404 | Project not found (or belongs to different tenant) |
| 404 | Template not found (or belongs to different tenant) |

### Behavior Details

1. **Template validation**: Template must belong to the same tenant and must be active (`is_active = true`)
2. **Project validation**: Project must belong to the same tenant
3. **Order index calculation**: Queries `MAX(order_index)` from existing project tasks, new tasks start at `max + 1` (or `0` if no tasks exist)
4. **Task field mapping**:
   - `title` = template_task.title
   - `description` = template_task.description
   - `estimated_duration_days` = template_task.estimated_duration_days
   - `category` = template_task.category
   - `status` = `not_started` (always)
   - `order_index` = starting_index + template_task.order_index
5. **Dependency resolution**: For each template task with `depends_on_order_index`, a `task_dependency` record is created linking the dependent task to its prerequisite. Both tasks must be part of the same template application batch.
6. **Atomicity**: The entire operation runs in a database transaction
7. **Audit log**: Records template application with template name, tasks created, and dependencies created
8. **Activity log**: Fires a `task_created` activity on the project

### Example

```bash
curl -X POST https://api.lead360.app/api/v1/projects/a1b2c3d4-e5f6-7890-abcd-ef1234567890/apply-template/f0e1d2c3-b4a5-6789-0fed-cba987654321 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

---

## Project Status Enum

| Value | Description |
|-------|-------------|
| `planned` | Initial status at creation |
| `in_progress` | Work has begun |
| `on_hold` | Temporarily paused |
| `completed` | All work finished (auto-sets `actual_completion_date`) |
| `canceled` | Project canceled / soft-deleted |

---

## Project Number Format

- Pattern: `PRJ-{YYYY}-{NNNN}` (e.g., `PRJ-2026-0001`)
- Auto-generated per tenant using a thread-safe counter
- Unique per tenant: `@@unique([tenant_id, project_number])`
- Number increments continuously (does not reset on year boundary)
- Year reflects the year of generation

---

## Task Seeding

When creating a project from a quote:
1. Each `quote_item` generates one `project_task` with:
   - `title` = item.title
   - `description` = item.description
   - `status` = `not_started`
   - `order_index` = sequential from 0
   - `quote_item_id` = item.id (for traceability)
2. If `template_id` is provided, template tasks are appended after quote item tasks

---

## Audit Logging

All write operations (create, update, delete) generate audit log entries with:
- Actor user ID
- Before/after state (for updates)
- Entity type: `project`
- Descriptive message

---

## Multi-Tenant Isolation

- All queries include `tenant_id` filter derived from JWT
- Accessing a project from another tenant returns 404
- `tenant_id` is never accepted from client input
