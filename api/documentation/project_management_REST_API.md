# Project Management Module — Complete REST API Documentation

**STATUS: VERIFIED BY DOCUMENTATION AGENT — 2026-03-16**
**Version**: 2.0 | **Module**: projects + financial (project-scoped) + portal
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT (staff endpoints) | Portal JWT (customer portal endpoints)

---

## Table of Contents

1. [Authentication & Headers](#1-authentication--headers)
2. [Standard Response Formats](#2-standard-response-formats)
3. [Projects](#3-projects)
4. [Project Tasks](#4-project-tasks)
5. [Task Assignments](#5-task-assignments)
6. [Task Dependencies](#6-task-dependencies)
7. [Task SMS](#7-task-sms)
8. [Task Calendar Events](#8-task-calendar-events)
9. [Crew Members](#9-crew-members)
10. [Subcontractors](#10-subcontractors)
11. [Subcontractor Contacts](#11-subcontractor-contacts)
12. [Subcontractor Documents](#12-subcontractor-documents)
13. [Project Logs](#13-project-logs)
14. [Project Photos](#14-project-photos)
15. [Project Documents](#15-project-documents)
16. [Permits](#16-permits)
17. [Inspections](#17-inspections)
18. [Project Templates](#18-project-templates)
19. [Checklist Templates (Settings)](#19-checklist-templates-settings)
20. [Project Completion](#20-project-completion)
21. [Task Financial (Costs & Receipts)](#21-task-financial-costs--receipts)
22. [Task Crew Hours](#22-task-crew-hours)
23. [Financial Categories (Settings)](#23-financial-categories-settings)
24. [Financial Entries](#24-financial-entries)
25. [Receipts (Financial)](#25-receipts-financial)
26. [Crew Hour Logs (Financial)](#26-crew-hour-logs-financial)
27. [Crew Payments (Financial)](#27-crew-payments-financial)
28. [Subcontractor Invoices (Financial)](#28-subcontractor-invoices-financial)
29. [Subcontractor Payments (Financial)](#29-subcontractor-payments-financial)
30. [Project Financial Summary](#30-project-financial-summary)
31. [Dashboard](#31-dashboard)
32. [Gantt Data](#32-gantt-data)
33. [Portal Authentication](#33-portal-authentication)
34. [Portal Projects](#34-portal-projects)

---

## 1. Authentication & Headers

### Staff Endpoints (Sections 3–32)

All staff endpoints require:

```
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

Token obtained via:
```
POST /api/v1/auth/login
Body: { "email": "user@example.com", "password": "yourpassword" }
Response: { "access_token": "eyJhbGciOiJIUzI1NiIs...", "user": { "id": "...", "email": "..." } }
```

The JWT contains `tenant_id` — never send tenant_id from the client. It is extracted server-side via `@TenantId()` decorator.

### Portal Endpoints (Sections 33–34)

Portal endpoints use a **separate JWT** issued by portal auth. The portal token contains: `sub` (portal account ID), `tenant_id`, `lead_id`, `customer_slug`.

```
Authorization: Bearer {portal_jwt_token}
```

### RBAC Roles

| Role | Description |
|------|-------------|
| Owner | Full access to everything |
| Admin | Full access except ownership transfer |
| Manager | Operational access, no delete on most entities |
| Bookkeeper | Financial read/write, no project management |
| Field | Limited access to assigned projects/tasks |

---

## 2. Standard Response Formats

### Paginated List Response
```
{
  "data": [ <array of entity objects> ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

### Single Entity Response

Single entity endpoints return the entity object directly (not wrapped in `data`):

```json
{
  "id": "a1b2c3d4-5678-90ab-cdef-1234567890ab",
  "tenant_id": "tenant-uuid",
  "name": "Example Entity",
  "created_at": "2026-03-16T10:00:00.000Z",
  "updated_at": "2026-03-16T10:00:00.000Z"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Descriptive error message",
  "errors": ["field-level errors if applicable"]
}
```

### Common HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 204 | No Content (successful delete) |
| 400 | Bad Request (validation error) |
| 401 | Unauthorized (missing/invalid token) |
| 403 | Forbidden (insufficient role) |
| 404 | Not Found |
| 409 | Conflict (duplicate, locked resource) |

---

## 3. Projects

### 3.1 Create Standalone Project

```
POST /api/v1/projects
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Project name (max 200 chars) |
| description | string | no | Internal project description |
| start_date | string (YYYY-MM-DD) | no | Scheduled start date |
| target_completion_date | string (YYYY-MM-DD) | no | Target completion date |
| permit_required | boolean | no | Whether permits are needed (default: false) |
| assigned_pm_user_id | string (UUID) | no | Assigned project manager user ID |
| estimated_cost | number | no | Estimated project cost |
| notes | string | no | Internal PM notes |
| template_id | string (UUID) | no | Project template to auto-apply tasks |

**Example Request**:
```json
{
  "name": "Kitchen Remodel - 123 Main St",
  "description": "Full kitchen renovation including cabinets and countertops",
  "start_date": "2026-04-01",
  "target_completion_date": "2026-06-15",
  "permit_required": true,
  "assigned_pm_user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "estimated_cost": 45000.00,
  "template_id": "t1t2t3t4-5678-90ab-cdef-1234567890ab"
}
```

**Response** (201):
```json
{
  "id": "p1p2p3p4-5678-90ab-cdef-1234567890ab",
  "tenant_id": "tenant-uuid",
  "quote_id": null,
  "lead_id": null,
  "project_number": "PRJ-2026-0042",
  "name": "Kitchen Remodel - 123 Main St",
  "description": "Full kitchen renovation including cabinets and countertops",
  "status": "planned",
  "start_date": "2026-04-01",
  "target_completion_date": "2026-06-15",
  "actual_completion_date": null,
  "permit_required": true,
  "assigned_pm_user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "contract_value": null,
  "estimated_cost": 45000.00,
  "progress_percent": 0.00,
  "is_standalone": true,
  "portal_enabled": false,
  "deletion_locked": false,
  "notes": null,
  "created_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z",
  "updated_at": "2026-03-16T10:00:00.000Z"
}
```

**Business Rules**:
- `is_standalone` is automatically set to `true`
- `portal_enabled` defaults to `false` for standalone projects
- `project_number` auto-generated per tenant: `PRJ-{year}-{sequence:0001}`
- If `template_id` provided, tasks from template are auto-created

---

### 3.2 Create Project from Quote

```
POST /api/v1/projects/from-quote/:quoteId
```

**Roles**: Owner, Admin, Manager

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| quoteId | UUID | ID of the accepted quote |

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | no | Override project name (defaults to quote title) |
| description | string | no | Project description |
| start_date | string (YYYY-MM-DD) | no | Scheduled start date |
| target_completion_date | string (YYYY-MM-DD) | no | Target completion date |
| permit_required | boolean | no | Whether permits are needed |
| assigned_pm_user_id | string (UUID) | no | Assigned PM |
| notes | string | no | Internal notes |
| template_id | string (UUID) | no | Template to apply (in addition to quote-derived tasks) |

**Example Request**:
```json
{
  "start_date": "2026-04-15",
  "target_completion_date": "2026-07-01",
  "assigned_pm_user_id": "pm-user-uuid"
}
```

**Response** (201): Same shape as standalone project, but with:
- `quote_id`: set to the source quote UUID
- `lead_id`: set from the quote's lead
- `contract_value`: copied from `quote.total`
- `estimated_cost`: copied from quote's internal cost estimate
- `is_standalone`: `false`
- `portal_enabled`: `true`
- `deletion_locked`: `false` (set on the **quote** record, not the project)

**Business Rules**:
- Quote must have status `approved`, `started`, or `concluded`
- Sets `deletion_locked = true` on the source quote (prevents quote deletion)
- Each `quote_item` generates one `project_task` with status `not_started`
- Creates `portal_account` for the lead if one doesn't exist (auto-generates temp password, queues welcome email)
- Updates lead status to `customer`

**Error Responses**:
| Code | Message |
|------|---------|
| 404 | Quote not found |
| 409 | A project already exists for this quote |
| 400 | Quote status must be approved, started, or concluded |

---

### 3.3 List Projects

```
GET /api/v1/projects
```

**Roles**: Owner, Admin, Manager, Field (own assigned only)

**Query Parameters**:
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| page | number | no | 1 | Page number (min 1) |
| limit | number | no | 20 | Items per page (max 100) |
| status | string | no | — | Filter: `planned`, `in_progress`, `on_hold`, `completed`, `canceled` |
| search | string | no | — | Search by project name or project_number |
| assigned_pm_user_id | string (UUID) | no | — | Filter by assigned PM |

**Example Request**:
```
GET /api/v1/projects?page=1&limit=10&status=in_progress&search=kitchen
```

**Response** (200):
```json
{
  "data": [
    {
      "id": "project-uuid",
      "project_number": "PRJ-2026-0042",
      "name": "Kitchen Remodel - 123 Main St",
      "status": "in_progress",
      "start_date": "2026-04-01",
      "target_completion_date": "2026-06-15",
      "actual_completion_date": null,
      "progress_percent": 35.71,
      "permit_required": true,
      "is_standalone": false,
      "contract_value": 85000.00,
      "estimated_cost": 45000.00,
      "assigned_pm_user_id": "pm-uuid",
      "assigned_pm": {
        "id": "pm-uuid",
        "first_name": "John",
        "last_name": "Smith"
      },
      "lead": {
        "id": "lead-uuid",
        "first_name": "Jane",
        "last_name": "Doe"
      },
      "created_at": "2026-03-10T14:00:00.000Z",
      "updated_at": "2026-03-15T09:30:00.000Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5
  }
}
```

---

### 3.4 Get Project Detail

```
GET /api/v1/projects/:id
```

**Roles**: Owner, Admin, Manager, Field (if assigned)

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | UUID | Project ID |

**Response** (200):
```json
{
  "id": "project-uuid",
  "tenant_id": "tenant-uuid",
  "quote_id": "quote-uuid",
  "lead_id": "lead-uuid",
  "project_number": "PRJ-2026-0042",
  "name": "Kitchen Remodel - 123 Main St",
  "description": "Full kitchen renovation",
  "status": "in_progress",
  "start_date": "2026-04-01",
  "target_completion_date": "2026-06-15",
  "actual_completion_date": null,
  "permit_required": true,
  "assigned_pm_user_id": "pm-uuid",
  "contract_value": 85000.00,
  "estimated_cost": 45000.00,
  "progress_percent": 35.71,
  "is_standalone": false,
  "portal_enabled": true,
  "deletion_locked": false,
  "notes": "Customer prefers communication via email",
  "created_by_user_id": "user-uuid",
  "created_at": "2026-03-10T14:00:00.000Z",
  "updated_at": "2026-03-15T09:30:00.000Z",
  "assigned_pm": {
    "id": "pm-uuid",
    "first_name": "John",
    "last_name": "Smith"
  },
  "quote": {
    "id": "quote-uuid",
    "quote_number": "Q-2026-0100"
  },
  "lead": {
    "id": "lead-uuid",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane@example.com",
    "primary_phone": "+19781234567"
  },
  "created_by_user": {
    "id": "user-uuid",
    "first_name": "Admin",
    "last_name": "User"
  }
}
```

---

### 3.5 Update Project

```
PATCH /api/v1/projects/:id
```

**Roles**: Owner, Admin, Manager

**Request Body** (all fields optional):
| Field | Type | Description |
|-------|------|-------------|
| name | string | Project name (max 200) |
| description | string | Internal description |
| status | enum | `planned`, `in_progress`, `on_hold`, `completed`, `canceled` |
| start_date | string (YYYY-MM-DD) | Scheduled start |
| target_completion_date | string (YYYY-MM-DD) | Target completion |
| permit_required | boolean | Permit flag |
| assigned_pm_user_id | string (UUID) or null | PM assignment (null to unassign) |
| portal_enabled | boolean | Portal visibility |
| notes | string | Internal notes |

**Example Request**:
```json
{
  "status": "in_progress",
  "start_date": "2026-04-05"
}
```

**Response** (200): Updated project object (same shape as GET detail).

**Business Rules**:
- Setting status to `completed` auto-sets `actual_completion_date` to today
- Setting status away from `completed` clears `actual_completion_date`
- Progress percent is recomputed automatically when tasks change

---

### 3.6 Soft Delete Project

```
DELETE /api/v1/projects/:id
```

**Roles**: Owner, Admin

**Response** (204): No content.

**Business Rules**:
- Cannot delete if project has active tasks (status `in_progress` or `blocked`)
- Sets project status to `canceled`

**Error Responses**:
| Code | Message |
|------|---------|
| 404 | Project not found |
| 409 | Cannot delete project with active tasks |

---

### 3.7 Apply Template to Project

```
POST /api/v1/projects/:id/apply-template/:templateId
```

**Roles**: Owner, Admin, Manager

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | UUID | Project ID |
| templateId | UUID | Project template ID |

**Response** (201): Array of created tasks.

**Business Rules**:
- Template tasks are appended to existing tasks (order_index continues from last)
- Template `depends_on_order_index` values are resolved to real `task_dependency` records
- Template must be active and belong to same tenant

---

### 3.8 Get Financial Summary

```
GET /api/v1/projects/:id/summary
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Response** (200):
```json
{
  "project_id": "project-uuid",
  "contract_value": 85000.00,
  "estimated_cost": 45000.00,
  "total_costs": 22450.75,
  "cost_breakdown": {
    "labor": 12000.00,
    "material": 6500.00,
    "subcontractor": 3200.00,
    "equipment": 750.75,
    "other": 0.00
  },
  "total_receipts": 15,
  "categorized_receipts": 12,
  "uncategorized_receipts": 3,
  "margin": 62550.25,
  "margin_percent": 73.59
}
```

---

### 3.9 Change Orders Redirect

```
GET /api/v1/projects/:id/change-orders-redirect
```

**Roles**: Owner, Admin, Manager

**Response** (200):
```json
{
  "redirect_url": "/quotes/a1b2c3d4-5678-90ab-cdef-1234567890ab?tab=change-orders",
  "quote_id": "a1b2c3d4-5678-90ab-cdef-1234567890ab"
}
```

Returns the URL to navigate to the quote's change orders tab. Only available for projects created from quotes.

---

## 4. Project Tasks

### 4.1 Create Task

```
POST /api/v1/projects/:projectId/tasks
```

**Roles**: Owner, Admin, Manager

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| projectId | UUID | Project ID |

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Task title (max 200 chars) |
| description | string | no | Task description |
| estimated_duration_days | number | no | Estimated days to complete |
| estimated_start_date | string (YYYY-MM-DD) | no | Planned start date |
| estimated_end_date | string (YYYY-MM-DD) | no | Planned end date |
| category | enum | no | `labor`, `material`, `subcontractor`, `equipment`, `other` |
| order_index | number | yes | Display order position (integer, min 0) |
| notes | string | no | Internal task notes |

**Example Request**:
```json
{
  "title": "Demo existing cabinets",
  "description": "Remove all existing upper and lower cabinets",
  "estimated_duration_days": 2,
  "estimated_start_date": "2026-04-01",
  "estimated_end_date": "2026-04-02",
  "category": "labor",
  "order_index": 1
}
```

**Response** (201):
```json
{
  "id": "task-uuid",
  "tenant_id": "tenant-uuid",
  "project_id": "project-uuid",
  "quote_item_id": null,
  "title": "Demo existing cabinets",
  "description": "Remove all existing upper and lower cabinets",
  "status": "not_started",
  "estimated_duration_days": 2,
  "estimated_start_date": "2026-04-01",
  "estimated_end_date": "2026-04-02",
  "actual_start_date": null,
  "actual_end_date": null,
  "is_delayed": false,
  "order_index": 1,
  "category": "labor",
  "notes": null,
  "created_by_user_id": "user-uuid",
  "deleted_at": null,
  "created_at": "2026-03-16T10:00:00.000Z",
  "updated_at": "2026-03-16T10:00:00.000Z"
}
```

**Business Rules**:
- Status always starts as `not_started`
- `progress_percent` on parent project is recalculated after creation

---

### 4.2 List Tasks

```
GET /api/v1/projects/:projectId/tasks
```

**Roles**: Owner, Admin, Manager, Field

**Query Parameters**:
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| page | number | no | 1 | Page number |
| limit | number | no | 20 | Items per page (max 100) |
| status | string | no | — | Filter: `not_started`, `in_progress`, `blocked`, `done` |

**Response** (200): Paginated list of tasks ordered by `order_index`. Each task includes computed `is_delayed` flag.

---

### 4.3 Get Task Detail

```
GET /api/v1/projects/:projectId/tasks/:id
```

**Roles**: Owner, Admin, Manager, Field

**Response** (200):
```json
{
  "id": "task-uuid",
  "tenant_id": "tenant-uuid",
  "project_id": "project-uuid",
  "quote_item_id": null,
  "title": "Demo existing cabinets",
  "description": "Remove all existing upper and lower cabinets",
  "status": "in_progress",
  "estimated_duration_days": 2,
  "estimated_start_date": "2026-04-01",
  "estimated_end_date": "2026-04-02",
  "actual_start_date": "2026-04-01",
  "actual_end_date": null,
  "is_delayed": false,
  "order_index": 1,
  "category": "labor",
  "notes": "Started on schedule",
  "created_by_user_id": "user-uuid",
  "deleted_at": null,
  "created_at": "2026-03-16T10:00:00.000Z",
  "updated_at": "2026-04-01T08:00:00.000Z",
  "assignees": [
    {
      "id": "assignee-uuid",
      "task_id": "task-uuid",
      "assignee_type": "crew_member",
      "crew_member": {
        "id": "crew-uuid",
        "first_name": "Carlos",
        "last_name": "Rodriguez"
      },
      "subcontractor": null,
      "user": null,
      "assigned_at": "2026-03-16T12:00:00.000Z",
      "assigned_by_user_id": "user-uuid"
    }
  ],
  "dependencies": [
    {
      "id": "dep-uuid",
      "depends_on_task_id": "other-task-uuid",
      "dependency_type": "finish_to_start",
      "depends_on_task": {
        "id": "other-task-uuid",
        "title": "Site Prep",
        "status": "done"
      }
    }
  ]
}
```

---

### 4.4 Update Task

```
PATCH /api/v1/projects/:projectId/tasks/:id
```

**Roles**: Owner, Admin, Manager

**Request Body** (all fields optional):
| Field | Type | Description |
|-------|------|-------------|
| title | string | Task title (max 200) |
| description | string | Description |
| estimated_duration_days | number | Duration estimate |
| estimated_start_date | string (YYYY-MM-DD) | Planned start |
| estimated_end_date | string (YYYY-MM-DD) | Planned end |
| status | enum | `not_started`, `in_progress`, `blocked`, `done` |
| actual_start_date | string (YYYY-MM-DD) | Actual start |
| actual_end_date | string (YYYY-MM-DD) | Actual end |
| category | enum | `labor`, `material`, `subcontractor`, `equipment`, `other` |
| order_index | number | Ordering position |
| notes | string | Internal notes |

**Status Transition Rules**:
```
not_started → in_progress, blocked
in_progress → blocked, done
blocked     → in_progress
done        → (terminal — no transitions out)
```

**Auto-Set Fields**:
- Transitioning to `in_progress`: sets `actual_start_date` to today if not provided
- Transitioning to `done`: sets `actual_end_date` to today if not provided

**Dependency Blocking**:
- Cannot transition to `in_progress` if `finish_to_start` prerequisites are not `done`

**Error Responses**:
| Code | Message |
|------|---------|
| 400 | Invalid status transition from {current} to {new} |
| 409 | Cannot start task: dependency "{task title}" is not completed |

---

### 4.5 Soft Delete Task

```
DELETE /api/v1/projects/:projectId/tasks/:id
```

**Roles**: Owner, Admin, Manager

**Response** (204): No content.

Sets `deleted_at` timestamp. Task is excluded from future queries. Project `progress_percent` is recalculated.

---

## 5. Task Assignments

### 5.1 Assign to Task

```
POST /api/v1/projects/:projectId/tasks/:taskId/assignees
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| assignee_type | enum | yes | `crew_member`, `subcontractor`, `user` |
| crew_member_id | string (UUID) | conditional | Required when `assignee_type = crew_member` |
| subcontractor_id | string (UUID) | conditional | Required when `assignee_type = subcontractor` |
| user_id | string (UUID) | conditional | Required when `assignee_type = user` |

**Example Request** (crew member):
```json
{
  "assignee_type": "crew_member",
  "crew_member_id": "crew-member-uuid"
}
```

**Response** (201):
```json
{
  "id": "assignee-uuid",
  "task_id": "task-uuid",
  "assignee_type": "crew_member",
  "crew_member": {
    "id": "crew-member-uuid",
    "first_name": "Carlos",
    "last_name": "Rodriguez"
  },
  "subcontractor": null,
  "user": null,
  "assigned_at": "2026-03-16T10:00:00.000Z",
  "assigned_by_user_id": "user-uuid"
}
```

**Error Responses**:
| Code | Message |
|------|---------|
| 400 | Exactly one of crew_member_id, subcontractor_id, or user_id must be provided |
| 409 | This assignee is already assigned to this task |
| 404 | Crew member / Subcontractor / User not found |

---

### 5.2 Remove Assignment

```
DELETE /api/v1/projects/:projectId/tasks/:taskId/assignees/:assigneeId
```

**Roles**: Owner, Admin, Manager

**Response** (204): No content.

---

## 6. Task Dependencies

### 6.1 Add Dependency

```
POST /api/v1/projects/:projectId/tasks/:taskId/dependencies
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| depends_on_task_id | string (UUID) | yes | The prerequisite task ID |
| dependency_type | enum | yes | `finish_to_start`, `start_to_start`, `finish_to_finish` |

**Example Request**:
```json
{
  "depends_on_task_id": "prerequisite-task-uuid",
  "dependency_type": "finish_to_start"
}
```

**Response** (201):
```json
{
  "id": "dependency-uuid",
  "task_id": "task-uuid",
  "depends_on_task_id": "prerequisite-task-uuid",
  "dependency_type": "finish_to_start",
  "created_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z"
}
```

**Business Rules**:
- Both tasks must belong to the same project
- No self-references (task cannot depend on itself)
- Circular dependency detection via DFS before insert
- Duplicate dependencies prevented (unique constraint on `[task_id, depends_on_task_id]`)

**Error Responses**:
| Code | Message |
|------|---------|
| 400 | A task cannot depend on itself |
| 409 | This dependency already exists |
| 409 | Adding this dependency would create a circular reference |
| 404 | Depends-on task not found in this project |

---

### 6.2 Remove Dependency

```
DELETE /api/v1/projects/:projectId/tasks/:taskId/dependencies/:depId
```

**Roles**: Owner, Admin, Manager

**Response** (204): No content.

---

## 7. Task SMS

### 7.1 Send SMS from Task Context

```
POST /api/v1/projects/:projectId/tasks/:taskId/sms
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| to_phone | string | no | E.164 format (+19781234567). Auto-resolved from lead if omitted. |
| text_body | string | yes | SMS text (max 1600 chars) |
| lead_id | string (UUID) | no | Lead to associate. Auto-resolved from project if omitted. |

**Example Request**:
```json
{
  "text_body": "Hi Jane, work on your kitchen demo starts tomorrow at 8 AM. - HoneyDo Team",
  "to_phone": "+19781234567"
}
```

**Response** (200):
```json
{
  "message": "SMS sent successfully",
  "sms_id": "sms-record-uuid"
}
```

**Phone Resolution**:
1. If `to_phone` provided → use it
2. Else → resolve from `project.lead.primary_phone`
3. Standalone projects with no lead require explicit `to_phone`

**Normalization**: 10-digit → `+1{10}`, 11-digit starting with 1 → `+{11}`

---

## 8. Task Calendar Events

### 8.1 Create Calendar Event

```
POST /api/v1/projects/:projectId/tasks/:taskId/calendar-events
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Event title (max 300 chars) |
| description | string | no | Event description |
| start_datetime | string (ISO 8601) | yes | Event start (e.g. `2026-04-01T08:00:00.000Z`) |
| end_datetime | string (ISO 8601) | yes | Event end |

**Example Request**:
```json
{
  "title": "Cabinet Demo - Kitchen Project",
  "description": "Demo existing cabinets, 3-person crew",
  "start_datetime": "2026-04-01T08:00:00.000Z",
  "end_datetime": "2026-04-01T16:00:00.000Z"
}
```

**Response** (201):
```json
{
  "id": "event-uuid",
  "tenant_id": "tenant-uuid",
  "task_id": "task-uuid",
  "project_id": "project-uuid",
  "title": "Cabinet Demo - Kitchen Project",
  "description": "Demo existing cabinets, 3-person crew",
  "start_datetime": "2026-04-01T08:00:00.000Z",
  "end_datetime": "2026-04-01T16:00:00.000Z",
  "google_event_id": "abc123googleeventid",
  "internal_calendar_id": null,
  "sync_status": "synced",
  "created_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z"
}
```

**Business Rules**:
- `start_datetime` must be before `end_datetime`
- Multiple events per task allowed
- Google Calendar sync is best-effort (non-blocking)
- If sync fails: `sync_status = "failed"`, retry queued
- Events are NOT deleted when task is deleted

**sync_status values**: `pending`, `synced`, `failed`, `local_only`

---

### 8.2 List Task Calendar Events

```
GET /api/v1/projects/:projectId/tasks/:taskId/calendar-events
```

**Roles**: Owner, Admin, Manager

**Response** (200): Array of calendar events for the task.

---

### 8.3 Update Calendar Event

```
PATCH /api/v1/projects/:projectId/tasks/:taskId/calendar-events/:eventId
```

**Roles**: Owner, Admin, Manager

**Request Body** (all optional):
| Field | Type | Description |
|-------|------|-------------|
| title | string | Event title |
| description | string | Description |
| start_datetime | string (ISO 8601) | Start time |
| end_datetime | string (ISO 8601) | End time |

**Response** (200): Updated event object.

---

### 8.4 Delete Calendar Event

```
DELETE /api/v1/projects/:projectId/tasks/:taskId/calendar-events/:eventId
```

**Roles**: Owner, Admin, Manager

**Response** (204): No content. Also deletes from Google Calendar (non-blocking).

---

## 9. Crew Members

### 9.1 Create Crew Member

```
POST /api/v1/crew
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| first_name | string | yes | First name (max 100) |
| last_name | string | yes | Last name (max 100) |
| email | string | no | Email address |
| phone | string | no | Phone number (max 20) |
| address_line1 | string | no | Street address |
| address_line2 | string | no | Apt/Suite |
| address_city | string | no | City |
| address_state | string | no | 2-letter state code |
| address_zip | string | no | ZIP code |
| date_of_birth | string (YYYY-MM-DD) | no | Date of birth |
| ssn | string | no | Social Security Number (encrypted before storage) |
| itin | string | no | ITIN (encrypted before storage) |
| has_drivers_license | boolean | no | Has driver's license |
| drivers_license_number | string | no | DL number (encrypted before storage) |
| default_hourly_rate | number | no | Hourly rate |
| weekly_hours_schedule | number | no | Weekly hours (e.g. 40) |
| overtime_enabled | boolean | no | OT enabled (default: false) |
| overtime_rate_multiplier | number | no | OT multiplier (e.g. 1.5) |
| default_payment_method | enum | no | `cash`, `check`, `bank_transfer`, `venmo`, `zelle` |
| bank_name | string | no | Bank name |
| bank_routing_number | string | no | Routing number (encrypted) |
| bank_account_number | string | no | Account number (encrypted) |
| venmo_handle | string | no | Venmo handle |
| zelle_contact | string | no | Zelle phone/email |
| notes | string | no | Internal notes |

**Response** (201): Crew member object with **masked** sensitive fields:
```json
{
  "id": "crew-uuid",
  "first_name": "Carlos",
  "last_name": "Rodriguez",
  "email": "carlos@example.com",
  "phone": "+19781234567",
  "ssn_masked": "***-**-4567",
  "itin_masked": null,
  "drivers_license_number_masked": "****5678",
  "bank_routing_masked": "****1234",
  "bank_account_masked": "****5678",
  "default_hourly_rate": 25.00,
  "weekly_hours_schedule": 40,
  "overtime_enabled": false,
  "overtime_rate_multiplier": null,
  "default_payment_method": "bank_transfer",
  "bank_name": "Chase Bank",
  "venmo_handle": null,
  "zelle_contact": null,
  "address_line1": "456 Oak Ave",
  "address_line2": null,
  "address_city": "Boston",
  "address_state": "MA",
  "address_zip": "02101",
  "date_of_birth": "1990-05-15",
  "has_drivers_license": true,
  "notes": null,
  "is_active": true,
  "profile_photo_url": null,
  "created_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z",
  "updated_at": "2026-03-16T10:00:00.000Z"
}
```

**SECURITY**: SSN, ITIN, DL number, bank routing, bank account are **encrypted at rest** using AES-256-GCM. Standard responses return **masked values only**. Use the reveal endpoint for full values.

---

### 9.2 List Crew Members

```
GET /api/v1/crew
```

**Roles**: Owner, Admin, Manager

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 100) |
| is_active | boolean | — | Filter active/inactive |
| search | string | — | Search by name |

**Response** (200): Paginated list with masked sensitive fields.

---

### 9.3 Get Crew Member Detail

```
GET /api/v1/crew/:id
```

**Roles**: Owner, Admin, Manager

**Response** (200): Full crew member object with masked sensitive fields (same shape as create response).

---

### 9.4 Reveal Sensitive Field

```
GET /api/v1/crew/:id/reveal/:field
```

**Roles**: Owner, Admin **only**

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| id | UUID | Crew member ID |
| field | string | One of: `ssn`, `itin`, `drivers_license_number`, `bank_routing`, `bank_account` |

**Response** (200):
```json
{
  "field": "ssn",
  "value": "123-45-6789"
}
```

**Business Rules**:
- Creates audit log entry with `action: "accessed"` including field name and timestamp
- Only Owner and Admin roles can access

---

### 9.5 Update Crew Member

```
PATCH /api/v1/crew/:id
```

**Roles**: Owner, Admin, Manager

**Request Body**: Same fields as create (all optional) + `is_active` (boolean).

**Response** (200): Updated crew member object with masked fields.

---

### 9.6 Soft Delete Crew Member

```
DELETE /api/v1/crew/:id
```

**Roles**: Owner, Admin

**Response** (204): Sets `is_active = false`.

---

### 9.7 Upload Profile Photo

```
POST /api/v1/crew/:id/photo
```

**Roles**: Owner, Admin, Manager

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | yes | Image file (jpg, png, webp) |

**Response** (200):
```json
{
  "message": "Profile photo uploaded",
  "file_url": "/public/tenant-uuid/images/photo-uuid.jpg"
}
```

---

### 9.8 Delete Profile Photo

```
DELETE /api/v1/crew/:id/photo
```

**Roles**: Owner, Admin

**Response** (204): No content.

---

## 10. Subcontractors

### 10.1 Create Subcontractor

```
POST /api/v1/subcontractors
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| business_name | string | yes | Business name (max 200) |
| trade_specialty | string | no | E.g. Electrical, Plumbing, Framing |
| email | string | no | Primary contact email |
| website | string | no | Website URL |
| insurance_provider | string | no | Insurance company |
| insurance_policy_number | string | no | Policy number |
| insurance_expiry_date | string (YYYY-MM-DD) | no | Insurance expiration |
| coi_on_file | boolean | no | Certificate of Insurance on file (default: false) |
| default_payment_method | enum | no | `cash`, `check`, `bank_transfer`, `venmo`, `zelle` |
| bank_name | string | no | Bank name |
| bank_routing_number | string | no | Routing (encrypted) |
| bank_account_number | string | no | Account (encrypted) |
| venmo_handle | string | no | Venmo handle |
| zelle_contact | string | no | Zelle contact |
| notes | string | no | Internal notes |

**Response** (201):
```json
{
  "id": "sub-uuid",
  "business_name": "Ace Electric LLC",
  "trade_specialty": "Electrical",
  "compliance_status": "valid",
  "insurance_expiry_date": "2027-01-15",
  "coi_on_file": true,
  "bank_routing_masked": "****1234",
  "bank_account_masked": "****5678",
  "default_payment_method": "bank_transfer",
  "bank_name": "Bank of America",
  "venmo_handle": null,
  "zelle_contact": null,
  "website": "https://aceelectric.example.com",
  "notes": null,
  "is_active": true,
  "created_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z",
  "updated_at": "2026-03-16T10:00:00.000Z"
}
```

**compliance_status** is computed on every read:
| Value | Condition |
|-------|-----------|
| `unknown` | `insurance_expiry_date` is null |
| `expired` | `insurance_expiry_date` < today |
| `expiring_soon` | `insurance_expiry_date` between today and today + 30 days |
| `valid` | `insurance_expiry_date` > today + 30 days |

---

### 10.2 List Subcontractors

```
GET /api/v1/subcontractors
```

**Roles**: Owner, Admin, Manager

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |
| is_active | boolean | — | Active filter |
| compliance_status | string | — | `valid`, `expiring_soon`, `expired`, `unknown` |
| search | string | — | Search business name |

---

### 10.3 Get Subcontractor Detail

```
GET /api/v1/subcontractors/:id
```

**Roles**: Owner, Admin, Manager

**Response** (200): Full subcontractor object with computed `compliance_status` and masked bank fields.

---

### 10.4 Update Subcontractor

```
PATCH /api/v1/subcontractors/:id
```

**Roles**: Owner, Admin, Manager

**Request Body**: Same fields as create (all optional) + `is_active` (boolean).

---

### 10.5 Soft Delete Subcontractor

```
DELETE /api/v1/subcontractors/:id
```

**Roles**: Owner, Admin

**Response** (204): Sets `is_active = false`.

---

### 10.6 Reveal Sensitive Field

```
GET /api/v1/subcontractors/:id/reveal/:field
```

**Roles**: Owner, Admin **only**

**Path Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| field | string | `bank_routing` or `bank_account` |

**Response** (200):
```json
{
  "field": "bank_routing",
  "value": "021000021"
}
```

---

## 11. Subcontractor Contacts

### 11.1 Add Contact

```
POST /api/v1/subcontractors/:id/contacts
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| contact_name | string | yes | Contact person name (max 200) |
| phone | string | yes | Phone number (max 20) |
| role | string | no | E.g. Owner, Project Manager, Billing |
| email | string | no | Contact email |
| is_primary | boolean | no | Primary contact flag (default: false) |

**Response** (201): Created contact object.

---

### 11.2 List Contacts

```
GET /api/v1/subcontractors/:id/contacts
```

**Roles**: Owner, Admin, Manager

**Response** (200): Array of contacts for the subcontractor.

---

### 11.3 Remove Contact

```
DELETE /api/v1/subcontractors/:id/contacts/:contactId
```

**Roles**: Owner, Admin, Manager

**Response** (204): No content.

---

## 12. Subcontractor Documents

### 12.1 Upload Document

```
POST /api/v1/subcontractors/:id/documents
```

**Roles**: Owner, Admin, Manager

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | yes | Document file |
| document_type | enum | yes | `insurance`, `agreement`, `coi`, `contract`, `license`, `other` |
| description | string | no | Document description |

**Response** (201):
```json
{
  "id": "doc-uuid",
  "subcontractor_id": "sub-uuid",
  "file_id": "file-uuid",
  "file_url": "/public/tenant-uuid/files/doc-uuid.pdf",
  "file_name": "insurance_certificate.pdf",
  "document_type": "insurance",
  "description": "2026 liability insurance certificate",
  "uploaded_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z"
}
```

---

### 12.2 List Documents

```
GET /api/v1/subcontractors/:id/documents
```

**Roles**: Owner, Admin, Manager

**Response** (200): Array of document records.

---

### 12.3 Delete Document

```
DELETE /api/v1/subcontractors/:id/documents/:documentId
```

**Roles**: Owner, Admin

**Response** (204): No content.

---

## 13. Project Logs

### 13.1 Create Log Entry

```
POST /api/v1/projects/:projectId/logs
```

**Roles**: Owner, Admin, Manager, Field (if assigned)

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| content | string | yes | Log entry text |
| task_id | string (UUID) | no | Optional task context |
| log_date | string (YYYY-MM-DD) | no | Date of entry (default: today, can backfill) |
| is_public | boolean | no | Portal visibility (default: false) |
| weather_delay | boolean | no | Weather delay flag (default: false) |
| attachments | File[] | no | Up to 10 files (photos, PDFs, documents) |

**Example** (multipart form):
```
content: "Completed framing inspection. Inspector approved all load-bearing walls."
log_date: "2026-04-10"
is_public: true
weather_delay: false
attachments: [file1.jpg, file2.pdf]
```

**Response** (201):
```json
{
  "id": "log-uuid",
  "project_id": "project-uuid",
  "task_id": null,
  "author_user_id": "user-uuid",
  "log_date": "2026-04-10",
  "content": "Completed framing inspection. Inspector approved all load-bearing walls.",
  "is_public": true,
  "weather_delay": false,
  "created_at": "2026-03-16T10:00:00.000Z",
  "updated_at": "2026-03-16T10:00:00.000Z",
  "author": {
    "id": "user-uuid",
    "first_name": "John",
    "last_name": "Smith"
  },
  "attachments": [
    {
      "id": "att-uuid",
      "file_id": "file-uuid",
      "file_url": "/public/tenant-uuid/images/photo-uuid.jpg",
      "file_name": "framing_complete.jpg",
      "file_type": "photo",
      "file_size_bytes": 245000
    }
  ]
}
```

**Business Rules**:
- Log content is **immutable** after creation (no edit endpoint)
- Photos uploaded via log are also linked to `project_photo` records
- File types determined from MIME: `photo`, `pdf`, `document`
- Max 10 file attachments per log entry

---

### 13.2 List Log Entries

```
GET /api/v1/projects/:projectId/logs
```

**Roles**: Owner, Admin, Manager, Field

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |
| is_public | boolean | — | Filter by visibility |
| has_attachments | boolean | — | Filter entries with/without attachments |
| date_from | string (YYYY-MM-DD) | — | Start date filter |
| date_to | string (YYYY-MM-DD) | — | End date filter |

**Response** (200): Paginated list ordered by `log_date DESC`, then `created_at DESC`. Each entry includes author info and attachment count.

---

### 13.3 Get Log Attachments

```
GET /api/v1/projects/:projectId/logs/:logId/attachments
```

**Roles**: Owner, Admin, Manager, Field

**Response** (200): Array of attachment objects with file URLs.

---

### 13.4 Delete Log Entry

```
DELETE /api/v1/projects/:projectId/logs/:id
```

**Roles**: Owner, Admin

**Response** (204): Cascades to delete associated `project_photo` records and files.

---

## 14. Project Photos

### 14.1 Upload Photo

```
POST /api/v1/projects/:projectId/photos
```

**Roles**: Owner, Admin, Manager, Field

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | yes | Image file (jpg, png, webp) |
| task_id | string (UUID) | no | Associate with specific task |
| caption | string | no | Photo caption (max 500) |
| is_public | boolean | no | Portal visibility (default: false) |
| taken_at | string (YYYY-MM-DD) | no | When photo was taken |

**Response** (201):
```json
{
  "id": "photo-uuid",
  "project_id": "project-uuid",
  "task_id": "task-uuid",
  "log_id": null,
  "file_id": "file-uuid",
  "file_url": "/public/tenant-uuid/images/photo-uuid.jpg",
  "thumbnail_url": "/public/tenant-uuid/images/photo-uuid_thumb.jpg",
  "caption": "Cabinets installed",
  "is_public": true,
  "taken_at": "2026-04-15",
  "uploaded_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z"
}
```

---

### 14.2 Batch Upload Photos

```
POST /api/v1/projects/:projectId/photos/batch
```

**Roles**: Owner, Admin, Manager, Field

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| files | File[] | yes | Multiple image files |
| task_id | string (UUID) | no | Task context |
| is_public | boolean | no | Portal visibility |

**Response** (201): Array of created photo objects.

---

### 14.3 List Photos

```
GET /api/v1/projects/:projectId/photos
```

**Roles**: Owner, Admin, Manager, Field

**Query Parameters**:
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Max 100 |
| task_id | string (UUID) | — | Filter by task |
| is_public | boolean | — | Filter by visibility |
| date_from | string (YYYY-MM-DD) | — | From date |
| date_to | string (YYYY-MM-DD) | — | To date |

---

### 14.4 Photo Timeline

```
GET /api/v1/projects/:projectId/photos/timeline
```

**Roles**: Owner, Admin, Manager, Field

**Query Parameters**: Same as list (page, limit, task_id, is_public, date_from, date_to).

**Response** (200): Photos grouped by date:
```json
{
  "data": [
    {
      "date": "2026-04-15",
      "photos": [
        {
          "id": "photo-uuid",
          "file_url": "/public/tenant-uuid/images/photo.jpg",
          "thumbnail_url": "/public/tenant-uuid/images/photo_thumb.jpg",
          "caption": "Cabinets installed",
          "task_id": "task-uuid",
          "is_public": true
        }
      ]
    },
    {
      "date": "2026-04-14",
      "photos": [
        {
          "id": "photo-uuid-2",
          "file_url": "/public/tenant-uuid/images/photo2.jpg",
          "thumbnail_url": "/public/tenant-uuid/images/photo2_thumb.jpg",
          "caption": "Plumbing rough-in complete",
          "task_id": "task-uuid-2",
          "is_public": false
        }
      ]
    }
  ],
  "meta": { "total": 45, "page": 1, "limit": 20, "totalPages": 3 }
}
```

---

### 14.5 Update Photo

```
PATCH /api/v1/projects/:projectId/photos/:id
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| caption | string | Photo caption |
| is_public | boolean | Portal visibility |

---

### 14.6 Delete Photo

```
DELETE /api/v1/projects/:projectId/photos/:id
```

**Roles**: Owner, Admin, Manager

**Response** (204): Hard deletes photo record and underlying file.

---

## 15. Project Documents

### 15.1 Upload Document

```
POST /api/v1/projects/:projectId/documents
```

**Roles**: Owner, Admin, Manager

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | yes | Document file |
| document_type | enum | yes | `contract`, `permit`, `blueprint`, `agreement`, `photo`, `other` |
| description | string | no | Document description |
| is_public | boolean | no | Portal visibility (default: false) |

**Response** (201):
```json
{
  "id": "doc-uuid",
  "project_id": "project-uuid",
  "file_id": "file-uuid",
  "file_url": "/public/tenant-uuid/files/doc-uuid.pdf",
  "file_name": "building_permit.pdf",
  "document_type": "permit",
  "description": "City building permit approved 2026-04-01",
  "is_public": false,
  "uploaded_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z"
}
```

---

### 15.2 List Documents

```
GET /api/v1/projects/:projectId/documents
```

**Roles**: Owner, Admin, Manager

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| document_type | string | Filter by type |

**Response** (200): Array of document objects.

---

### 15.3 Delete Document

```
DELETE /api/v1/projects/:projectId/documents/:id
```

**Roles**: Owner, Admin

**Response** (204): Hard deletes document and underlying file.

---

## 16. Permits

### 16.1 Create Permit

```
POST /api/v1/projects/:projectId/permits
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| permit_type | string | yes | E.g. Building, Electrical, Plumbing (max 200) |
| permit_number | string | no | Permit number (max 100) |
| status | enum | no | Default: `pending_application`. Values: `not_required`, `pending_application`, `submitted`, `approved`, `active`, `failed`, `closed` |
| submitted_date | string (YYYY-MM-DD) | no | Date submitted |
| approved_date | string (YYYY-MM-DD) | no | Date approved (auto-set if status=approved) |
| expiry_date | string (YYYY-MM-DD) | no | Permit expiration |
| issuing_authority | string | no | Issuing body name (max 200) |
| notes | string | no | Internal notes |

**Response** (201):
```json
{
  "id": "permit-uuid",
  "project_id": "project-uuid",
  "permit_type": "Building",
  "permit_number": "BP-2026-001234",
  "status": "submitted",
  "submitted_date": "2026-03-20",
  "approved_date": null,
  "expiry_date": null,
  "issuing_authority": "City of Boston Building Department",
  "notes": null,
  "created_at": "2026-03-16T10:00:00.000Z",
  "inspections": []
}
```

---

### 16.2 List Permits

```
GET /api/v1/projects/:projectId/permits
```

**Roles**: Owner, Admin, Manager

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by permit status |

**Response** (200): Array of permits with linked inspections.

---

### 16.3 Get Permit Detail

```
GET /api/v1/projects/:projectId/permits/:id
```

**Roles**: Owner, Admin, Manager

**Response** (200): Full permit object with linked inspections array.

---

### 16.4 Update Permit

```
PATCH /api/v1/projects/:projectId/permits/:id
```

**Roles**: Owner, Admin, Manager

**Request Body**: All fields from create are optional.

**Business Rules**:
- If status changed to `approved` and `approved_date` not provided, auto-sets to today

---

### 16.5 Delete Permit

```
DELETE /api/v1/projects/:projectId/permits/:id
```

**Roles**: Owner, Admin

**Response** (204): Hard delete.

**Error**: Returns 409 if permit has linked inspections. Use deactivate instead.

---

### 16.6 Deactivate Permit

```
PATCH /api/v1/projects/:projectId/permits/:id/deactivate
```

**Roles**: Owner, Admin

**Response** (200): Sets `deleted_at` timestamp (soft delete). Safer than hard delete when inspections exist.

---

## 17. Inspections

### 17.1 Create Inspection

```
POST /api/v1/projects/:projectId/permits/:permitId/inspections
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| inspection_type | string | yes | E.g. Framing, Electrical Rough-In, Final (max 200) |
| scheduled_date | string (YYYY-MM-DD) | no | Scheduled inspection date |
| inspector_name | string | no | Inspector name (max 200) |
| result | enum | no | `pass`, `fail`, `conditional`, `pending` |
| reinspection_required | boolean | no | Default: false (auto-set true if result=fail) |
| reinspection_date | string (YYYY-MM-DD) | no | Reinspection date |
| notes | string | no | Notes |
| inspected_by_user_id | string (UUID) | no | User who performed inspection |

**Response** (201):
```json
{
  "id": "insp-uuid",
  "permit_id": "permit-uuid",
  "project_id": "project-uuid",
  "inspection_type": "Framing",
  "scheduled_date": "2026-04-20",
  "inspector_name": "Mike Johnson",
  "result": "pass",
  "reinspection_required": false,
  "reinspection_date": null,
  "notes": "All load-bearing walls approved",
  "created_at": "2026-03-16T10:00:00.000Z"
}
```

**Business Rules**:
- If `result = "fail"`, `reinspection_required` is auto-set to `true`

---

### 17.2 List Inspections

```
GET /api/v1/projects/:projectId/permits/:permitId/inspections
```

**Roles**: Owner, Admin, Manager

**Response** (200): Array of inspections for the permit.

---

### 17.3 Update Inspection

```
PATCH /api/v1/projects/:projectId/permits/:permitId/inspections/:id
```

**Roles**: Owner, Admin, Manager

**Request Body**: All fields from create are optional.

---

### 17.4 Delete Inspection

```
DELETE /api/v1/projects/:projectId/permits/:permitId/inspections/:id
```

**Roles**: Owner, Admin

**Response** (204): Hard delete.

---

## 18. Project Templates

### 18.1 Create Template

```
POST /api/v1/project-templates
```

**Roles**: Owner, Admin

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Template name (max 200) |
| description | string | no | Description |
| industry_type | string | no | E.g. Roofing, Painting, Remodeling (max 100) |
| tasks | array | no | Array of template tasks |

**Task Object**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Task title (max 200) |
| description | string | no | Task description |
| estimated_duration_days | number | no | Duration |
| category | enum | no | `labor`, `material`, `subcontractor`, `equipment`, `other` |
| order_index | number | yes | Task sequence order |
| depends_on_order_index | number | no | References another task's order_index |

**Example Request**:
```json
{
  "name": "Kitchen Remodel Standard",
  "industry_type": "Remodeling",
  "tasks": [
    { "title": "Demo existing", "order_index": 1, "estimated_duration_days": 2, "category": "labor" },
    { "title": "Rough plumbing", "order_index": 2, "estimated_duration_days": 3, "category": "subcontractor", "depends_on_order_index": 1 },
    { "title": "Electrical rough-in", "order_index": 3, "estimated_duration_days": 2, "category": "subcontractor", "depends_on_order_index": 1 },
    { "title": "Install cabinets", "order_index": 4, "estimated_duration_days": 3, "category": "labor", "depends_on_order_index": 2 }
  ]
}
```

**Business Rules**:
- `depends_on_order_index` must reference a valid `order_index` in the same template
- No duplicate `order_index` values
- No circular dependencies
- No self-references

---

### 18.2 List Templates

```
GET /api/v1/project-templates
```

**Roles**: Owner, Admin, Manager

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| page | number | Page number |
| limit | number | Items per page |
| is_active | boolean | Active filter |
| industry_type | string | Industry filter |

---

### 18.3 Get Template Detail

```
GET /api/v1/project-templates/:id
```

**Roles**: Owner, Admin, Manager

**Response** (200): Template with ordered tasks array.

---

### 18.4 Update Template

```
PATCH /api/v1/project-templates/:id
```

**Roles**: Owner, Admin

**Request Body**: Same as create (all optional) + `is_active` (boolean). If `tasks` provided, replaces all existing tasks (transactional).

---

### 18.5 Delete Template

```
DELETE /api/v1/project-templates/:id
```

**Roles**: Owner, Admin

**Response** (204): Hard delete (cascades to template tasks).

---

## 19. Checklist Templates (Settings)

### 19.1 Create Checklist Template

```
POST /api/v1/settings/checklist-templates
```

**Roles**: Owner, Admin

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Template name (max 200, unique per tenant) |
| description | string | no | Template description |
| items | array | yes | At least 1 item required |

**Item Object**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Item title (max 300) |
| description | string | no | Item description |
| is_required | boolean | no | Required for completion (default: true) |
| order_index | number | yes | Item order |

**Example Request**:
```json
{
  "name": "Standard Completion Checklist",
  "description": "Default checklist for project closeout",
  "items": [
    { "title": "Final walkthrough with customer", "is_required": true, "order_index": 1 },
    { "title": "Clean up job site", "is_required": true, "order_index": 2 },
    { "title": "Collect final payment", "is_required": true, "order_index": 3 },
    { "title": "Customer satisfaction survey", "is_required": false, "order_index": 4 }
  ]
}
```

---

### 19.2 List Checklist Templates

```
GET /api/v1/settings/checklist-templates
```

**Roles**: Owner, Admin, Manager

**Query Parameters**: `page`, `limit`, `is_active`

---

### 19.3 Get Checklist Template Detail

```
GET /api/v1/settings/checklist-templates/:id
```

**Roles**: Owner, Admin, Manager

**Response** (200): Template with items array ordered by `order_index`.

---

### 19.4 Update Checklist Template

```
PATCH /api/v1/settings/checklist-templates/:id
```

**Roles**: Owner, Admin

**Request Body**: `name`, `description`, `is_active` (all optional). If `items` provided, replaces all items.

---

### 19.5 Delete Checklist Template

```
DELETE /api/v1/settings/checklist-templates/:id
```

**Roles**: Owner, Admin

**Response** (204): Hard delete (cascades to items).

---

## 20. Project Completion

### 20.1 Get Completion Status

```
GET /api/v1/projects/:projectId/completion
```

**Roles**: Owner, Admin, Manager

**Response** (200):
```json
{
  "id": "checklist-uuid",
  "project_id": "project-uuid",
  "template_id": "template-uuid",
  "completed_at": null,
  "created_at": "2026-05-01T10:00:00.000Z",
  "items": [
    {
      "id": "item-uuid",
      "title": "Final walkthrough with customer",
      "is_required": true,
      "is_completed": true,
      "completed_at": "2026-05-10T14:00:00.000Z",
      "completed_by_user_id": "user-uuid",
      "notes": "Customer approved all work",
      "order_index": 1
    },
    {
      "id": "item-uuid-2",
      "title": "Clean up job site",
      "is_required": true,
      "is_completed": false,
      "completed_at": null,
      "completed_by_user_id": null,
      "notes": null,
      "order_index": 2
    }
  ],
  "punch_list_items": [
    {
      "id": "punch-uuid",
      "title": "Touch up paint in hallway",
      "description": "Minor scuff marks from cabinet delivery",
      "status": "open",
      "assigned_to_crew_id": "crew-uuid",
      "resolved_at": null,
      "created_at": "2026-05-08T12:00:00.000Z"
    }
  ]
}
```

Returns `null` if no completion checklist has been started.

---

### 20.2 Start Completion

```
POST /api/v1/projects/:projectId/completion
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| template_id | string (UUID) | no | Checklist template to populate from |

**Business Rules**:
- Only one active checklist per project
- If `template_id` provided, items are copied from the template
- If omitted, creates empty checklist (items added manually)

**Error**: 409 if completion checklist already exists for this project.

---

### 20.3 Complete Checklist Item

```
PATCH /api/v1/projects/:projectId/completion/items/:itemId
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| notes | string | no | Completion notes |

**Response** (200): Updated item with `is_completed: true`, `completed_at` set, `completed_by_user_id` set.

**Business Rules**: When all required items are completed, `checklist.completed_at` is auto-set.

---

### 20.4 Add Manual Checklist Item

```
POST /api/v1/projects/:projectId/completion/items
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Item title (max 300) |
| is_required | boolean | no | Default: true |
| order_index | number | yes | Item position |

---

### 20.5 Add Punch List Item

```
POST /api/v1/projects/:projectId/completion/punch-list
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Deficiency title (max 300) |
| description | string | no | Deficiency description |
| assigned_to_crew_id | string (UUID) | no | Crew member to fix it |

**Response** (201):
```json
{
  "id": "punch-uuid",
  "checklist_id": "checklist-uuid",
  "project_id": "project-uuid",
  "title": "Touch up paint in hallway",
  "description": "Minor scuff marks from cabinet delivery",
  "status": "open",
  "assigned_to_crew_id": "crew-uuid",
  "resolved_at": null,
  "created_at": "2026-05-08T12:00:00.000Z"
}
```

---

### 20.6 Update Punch List Item

```
PATCH /api/v1/projects/:projectId/completion/punch-list/:itemId
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| status | enum | no | `open`, `in_progress`, `resolved` |
| description | string | no | Updated description |
| assigned_to_crew_id | string (UUID) | no | Reassign |

**Business Rules**: Setting status to `resolved` auto-sets `resolved_at` and `resolved_by_user_id`.

---

### 20.7 Complete Project

```
POST /api/v1/projects/:projectId/complete
```

**Roles**: Owner, Admin, Manager

**Response** (200): Updated project with `status: "completed"` and `actual_completion_date` set.

**Validation Requirements** (all must be true):
1. All required checklist items must be `is_completed = true`
2. All punch list items must have `status = "resolved"`
3. Completion checklist must exist

**Error Responses**:
| Code | Message |
|------|---------|
| 400 | Cannot complete: {N} required checklist items are not completed |
| 400 | Cannot complete: {N} punch list items are not resolved |
| 404 | No completion checklist found. Start completion first. |

---

## 21. Task Financial (Costs & Receipts)

### 21.1 Create Task Cost Entry

```
POST /api/v1/projects/:projectId/tasks/:taskId/costs
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| category_id | string (UUID) | yes | Financial category ID |
| amount | number | yes | Cost amount (min 0.01) |
| entry_date | string (YYYY-MM-DD) | yes | Date of expense |
| vendor_name | string | no | Vendor name |
| crew_member_id | string (UUID) | no | Associated crew member |
| subcontractor_id | string (UUID) | no | Associated subcontractor |
| notes | string | no | Notes |

**Response** (201): Created financial entry linked to project and task.

---

### 21.2 List Task Cost Entries

```
GET /api/v1/projects/:projectId/tasks/:taskId/costs
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Response** (200): Array of cost entries for the task.

---

### 21.3 Upload Task Receipt

```
POST /api/v1/projects/:projectId/tasks/:taskId/receipts
```

**Roles**: Owner, Admin, Manager, Bookkeeper, Field

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | yes | Receipt file (jpg, png, webp, pdf — max 25MB) |
| vendor_name | string | no | Vendor name |
| amount | number | no | Receipt amount |
| receipt_date | string (YYYY-MM-DD) | no | Receipt date |

**Response** (201): Receipt object with file URL.

---

### 21.4 List Task Receipts

```
GET /api/v1/projects/:projectId/tasks/:taskId/receipts
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Response** (200): Array of receipt objects.

---

## 22. Task Crew Hours

### 22.1 Log Crew Hours on Task

```
POST /api/v1/projects/:projectId/tasks/:taskId/crew-hours
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| crew_member_id | string (UUID) | yes | Crew member ID |
| log_date | string (YYYY-MM-DD) | yes | Date of work |
| hours_regular | number | yes | Regular hours (min 0.01) |
| hours_overtime | number | no | Overtime hours (default: 0) |
| notes | string | no | Notes |

**Response** (201): Created crew hour log entry.

---

### 22.2 List Task Crew Hours

```
GET /api/v1/projects/:projectId/tasks/:taskId/crew-hours
```

**Roles**: Owner, Admin, Manager

**Response** (200): Array of crew hour log entries for the task.

---

### 22.3 Crew Member Hour Summary

```
GET /api/v1/crew/:crewMemberId/hours
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Response** (200):
```json
{
  "crew_member_id": "crew-uuid",
  "total_regular_hours": 240.50,
  "total_overtime_hours": 32.00,
  "projects": [
    {
      "project_id": "project-uuid",
      "project_name": "Kitchen Remodel",
      "regular_hours": 120.25,
      "overtime_hours": 16.00
    }
  ]
}
```

---

## 23. Financial Categories (Settings)

### 23.1 Create Category

```
POST /api/v1/settings/financial-categories
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | Category name |
| type | enum | yes | `labor`, `material`, `subcontractor`, `equipment`, `other` |
| description | string | no | Description |

---

### 23.2 List Categories

```
GET /api/v1/settings/financial-categories
```

**Roles**: Owner, Admin, Manager

**Response** (200): Flat array of all active categories for the tenant (not paginated).

```json
[
  {
    "id": "category-uuid",
    "tenant_id": "tenant-uuid",
    "name": "Lumber & Materials",
    "type": "material",
    "description": "Wood, drywall, concrete, etc.",
    "is_active": true,
    "is_system_default": false,
    "created_at": "2026-03-01T10:00:00.000Z"
  }
]
```

---

### 23.3 Update Category

```
PATCH /api/v1/settings/financial-categories/:id
```

**Roles**: Owner, Admin

**Request Body**: `name`, `description` (optional). **`type` is NOT updatable.**

---

### 23.4 Deactivate Category

```
DELETE /api/v1/settings/financial-categories/:id
```

**Roles**: Owner, Admin

**Response** (204): Sets `is_active = false` (soft delete).

---

## 24. Financial Entries

### 24.1 Create Entry

```
POST /api/v1/financial/entries
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| project_id | string (UUID) | yes | Project to charge |
| task_id | string (UUID) | no | Specific task |
| category_id | string (UUID) | yes | Financial category |
| amount | number | yes | Amount (min 0.01) |
| entry_date | string (YYYY-MM-DD) | yes | Expense date (not future) |
| vendor_name | string | no | Vendor name |
| crew_member_id | string (UUID) | no | Associated crew member |
| subcontractor_id | string (UUID) | no | Associated subcontractor |
| notes | string | no | Notes |

---

### 24.2 List Entries

```
GET /api/v1/financial/entries
```

**Roles**: Owner, Admin, Manager

**Query Parameters**:
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| project_id | string (UUID) | yes | Filter by project |
| task_id | string (UUID) | no | Filter by task |
| category_id | string (UUID) | no | Filter by category |
| date_from | string | no | Start date |
| date_to | string | no | End date |
| page | number | no | Default: 1 |
| limit | number | no | Default: 20, max: 100 |

---

### 24.3 Get Entry

```
GET /api/v1/financial/entries/:id
```

---

### 24.4 Update Entry

```
PATCH /api/v1/financial/entries/:id
```

**Roles**: Owner, Admin, Manager

**Request Body**: All create fields except `project_id` (not updatable — entries cannot move between projects).

---

### 24.5 Delete Entry

```
DELETE /api/v1/financial/entries/:id
```

**Roles**: Owner, Admin, Manager

**Response** (200): Returns confirmation of deletion.

---

## 25. Receipts (Financial)

### 25.1 Upload Receipt

```
POST /api/v1/financial/receipts
```

**Roles**: Owner, Admin, Manager, Bookkeeper, Field

**Content-Type**: `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | yes | Receipt image/PDF (jpg, png, webp, pdf — max 25MB) |
| project_id | string (UUID) | no | Associate with project |
| task_id | string (UUID) | no | Associate with task |
| vendor_name | string | no | Vendor name |
| amount | number | no | Receipt amount |
| receipt_date | string (YYYY-MM-DD) | no | Date on receipt |

**Response** (201):
```json
{
  "id": "receipt-uuid",
  "tenant_id": "tenant-uuid",
  "project_id": "project-uuid",
  "task_id": null,
  "file_id": "file-uuid",
  "file_url": "/public/tenant-uuid/images/receipt-uuid.jpg",
  "file_type": "photo",
  "vendor_name": "Home Depot",
  "amount": 342.50,
  "receipt_date": "2026-04-10",
  "is_categorized": false,
  "financial_entry_id": null,
  "ocr_status": "not_processed",
  "created_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z"
}
```

---

### 25.2 List Receipts

```
GET /api/v1/financial/receipts
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| project_id | string (UUID) | Filter by project |
| task_id | string (UUID) | Filter by task |
| is_categorized | boolean | true=linked to entry, false=unlinked |
| page | number | Default: 1 |
| limit | number | Default: 20, max: 100 |

---

### 25.3 Get Receipt

```
GET /api/v1/financial/receipts/:id
```

---

### 25.4 Link Receipt to Financial Entry

```
PATCH /api/v1/financial/receipts/:id/link
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| financial_entry_id | string (UUID) | yes | Financial entry to link |

**Business Rules**:
- Transactional: sets `receipt.is_categorized = true` and `entry.has_receipt = true`
- Prevents duplicate linking

---

### 25.5 Update Receipt

```
PATCH /api/v1/financial/receipts/:id
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| vendor_name | string or null | Vendor name |
| amount | number or null | Amount |
| receipt_date | string or null | Receipt date |

Note: File, OCR data, and categorization status are NOT updatable via this endpoint.

---

## 26. Crew Hour Logs (Financial)

### 26.1 Log Hours

```
POST /api/v1/financial/crew-hours
```

**Roles**: Owner, Admin, Manager

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| crew_member_id | string (UUID) | yes | Crew member |
| project_id | string (UUID) | yes | Project |
| task_id | string (UUID) | no | Specific task |
| log_date | string (YYYY-MM-DD) | yes | Work date |
| hours_regular | number | yes | Regular hours (min 0.01) |
| hours_overtime | number | no | OT hours (default: 0) |
| notes | string | no | Notes |

---

### 26.2 List Hours

```
GET /api/v1/financial/crew-hours
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| project_id | string (UUID) | Filter by project |
| crew_member_id | string (UUID) | Filter by crew member |
| date_from | string | Start date |
| date_to | string | End date |
| page | number | Default: 1 |
| limit | number | Default: 20, max: 100 |

---

### 26.3 Update Hours

```
PATCH /api/v1/financial/crew-hours/:id
```

**Roles**: Owner, Admin

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| task_id | string (UUID) | Change task association |
| log_date | string | Update date |
| hours_regular | number | Update regular hours |
| hours_overtime | number | Update OT hours |
| notes | string | Update notes |

---

## 27. Crew Payments (Financial)

### 27.1 Create Payment

```
POST /api/v1/financial/crew-payments
```

**Roles**: Owner, Admin, Bookkeeper

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| crew_member_id | string (UUID) | yes | Crew member |
| project_id | string (UUID) | no | Associated project |
| amount | number | yes | Payment amount (min 0.01) |
| payment_date | string (YYYY-MM-DD) | yes | Date of payment (not future) |
| payment_method | enum | yes | `cash`, `check`, `bank_transfer`, `venmo`, `zelle` |
| reference_number | string | no | Check number, transaction ID |
| period_start_date | string (YYYY-MM-DD) | no | Pay period start |
| period_end_date | string (YYYY-MM-DD) | no | Pay period end |
| hours_paid | number | no | Hours covered by this payment |
| notes | string | no | Notes |

---

### 27.2 List Payments

```
GET /api/v1/financial/crew-payments
```

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**: `project_id`, `crew_member_id`, `page`, `limit`

---

### 27.3 Crew Payment History

```
GET /api/v1/crew/:crewMemberId/payment-history
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Query Parameters**: `page`, `limit`

**Response** (200): Paginated list of payments for a specific crew member, ordered by `payment_date DESC`.

---

## 28. Subcontractor Invoices (Financial)

### 28.1 Create Invoice

```
POST /api/v1/financial/subcontractor-invoices
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Content-Type**: `multipart/form-data` (if uploading file) or `application/json`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| subcontractor_id | string (UUID) | yes | Subcontractor |
| task_id | string (UUID) | yes | Task this invoice covers |
| project_id | string (UUID) | yes | Project |
| amount | number | yes | Invoice amount (min 0.01) |
| invoice_number | string | no | Invoice number (unique per tenant) |
| invoice_date | string (YYYY-MM-DD) | no | Invoice date |
| notes | string | no | Notes |
| file | File | no | Invoice document |

**Response** (201):
```json
{
  "id": "invoice-uuid",
  "subcontractor_id": "sub-uuid",
  "task_id": "task-uuid",
  "project_id": "project-uuid",
  "invoice_number": "INV-2026-001",
  "invoice_date": "2026-04-15",
  "amount": 3200.00,
  "status": "pending",
  "notes": null,
  "file_id": "file-uuid",
  "file_url": "/public/tenant-uuid/files/invoice.pdf",
  "file_name": "ace_electric_invoice.pdf",
  "created_by_user_id": "user-uuid",
  "created_at": "2026-03-16T10:00:00.000Z"
}
```

---

### 28.2 List Invoices

```
GET /api/v1/financial/subcontractor-invoices
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| subcontractor_id | string (UUID) | Filter by subcontractor |
| task_id | string (UUID) | Filter by task |
| project_id | string (UUID) | Filter by project |
| status | string | `pending`, `approved`, `paid` |
| page | number | Default: 1 |
| limit | number | Default: 20, max: 100 |

---

### 28.3 Update Invoice

```
PATCH /api/v1/financial/subcontractor-invoices/:id
```

**Roles**: Owner, Admin, Bookkeeper

**Request Body**:
| Field | Type | Description |
|-------|------|-------------|
| status | enum | Forward-only: `pending → approved → paid` |
| amount | number | Only editable when status is `pending` |
| notes | string | Notes |

**Status Transition Rules**:
```
pending  → approved (cannot skip to paid)
approved → paid
paid     → (terminal)
```

**Error**: 400 if attempting backward transition or skipping steps.

---

### 28.4 Task Invoices

```
GET /api/v1/projects/:projectId/tasks/:taskId/invoices
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Response** (200): Array of invoices for the task.

---

### 28.5 Subcontractor Invoices

```
GET /api/v1/subcontractors/:id/invoices
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Response** (200): Array of all invoices for the subcontractor.

---

## 29. Subcontractor Payments (Financial)

### 29.1 Create Payment

```
POST /api/v1/financial/subcontractor-payments
```

**Roles**: Owner, Admin, Bookkeeper

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| subcontractor_id | string (UUID) | yes | Subcontractor |
| project_id | string (UUID) | no | Associated project |
| amount | number | yes | Payment amount (min 0.01) |
| payment_date | string (YYYY-MM-DD) | yes | Date (not future) |
| payment_method | enum | yes | `cash`, `check`, `bank_transfer`, `venmo`, `zelle` |
| reference_number | string | no | Reference number |
| notes | string | no | Notes |

---

### 29.2 List Payments

```
GET /api/v1/financial/subcontractor-payments
```

**Roles**: Owner, Admin, Bookkeeper

**Query Parameters**: `project_id`, `subcontractor_id`, `page`, `limit`

---

### 29.3 Subcontractor Payment History

```
GET /api/v1/subcontractors/:subcontractorId/payment-history
```

**Roles**: Owner, Admin, Manager, Bookkeeper

---

### 29.4 Subcontractor Payment Summary

```
GET /api/v1/subcontractors/:id/payment-summary
```

**Roles**: Owner, Admin, Manager, Bookkeeper

**Response** (200):
```json
{
  "subcontractor_id": "sub-uuid",
  "total_invoiced": 15000.00,
  "total_paid": 10000.00,
  "total_pending": 3000.00,
  "total_approved": 2000.00,
  "invoices_count": 5,
  "payments_count": 3
}
```

---

## 30. Project Financial Summary

```
GET /api/v1/projects/:projectId/financial-summary
```

**Roles**: Owner, Admin, Manager

**Response** (200):
```json
{
  "project_id": "project-uuid",
  "contract_value": 85000.00,
  "estimated_cost": 45000.00,
  "total_costs": 22450.75,
  "cost_by_category": {
    "labor": 12000.00,
    "material": 6500.00,
    "subcontractor": 3200.00,
    "equipment": 750.75,
    "other": 0.00
  },
  "total_receipts": 15,
  "categorized_receipts": 12,
  "margin": 62549.25,
  "margin_percent": 73.59
}
```

---

## 31. Dashboard

### 31.1 Dashboard Data

```
GET /api/v1/projects/dashboard
```

**Roles**: Owner, Admin, Manager

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter projects by status |
| assigned_pm_user_id | string (UUID) | Filter by PM |
| date_from | string (YYYY-MM-DD) | Projects starting from |
| date_to | string (YYYY-MM-DD) | Projects starting before |

**Response** (200):
```json
{
  "total_projects": 45,
  "status_distribution": {
    "planned": 8,
    "in_progress": 22,
    "on_hold": 5,
    "completed": 9,
    "canceled": 1
  },
  "active_projects": 22,
  "delayed_tasks_count": 7,
  "projects_with_delays": 4,
  "overdue_tasks_count": 3,
  "upcoming_deadlines": [
    {
      "project_id": "project-uuid",
      "project_name": "Kitchen Remodel",
      "target_completion_date": "2026-04-30",
      "days_remaining": 14,
      "progress_percent": 78.50
    }
  ],
  "recent_activity": [
    {
      "id": "activity-uuid",
      "project_id": "project-uuid",
      "activity_type": "task_completed",
      "description": "Task 'Install cabinets' marked as done",
      "created_at": "2026-03-16T09:30:00.000Z"
    }
  ]
}
```

---

### 31.2 Dashboard Gantt (Multi-Project)

```
GET /api/v1/projects/dashboard/gantt
```

**Roles**: Owner, Admin, Manager

**Query Parameters**:
| Param | Type | Description |
|-------|------|-------------|
| status | string | Filter by project status |
| assigned_pm_user_id | string (UUID) | Filter by PM |
| search | string | Search project name/number |
| page | number | Default: 1 |
| limit | number | Default: 20, max: 100 |

**Response** (200): Paginated list of projects with task counts and delay information for Gantt overview rendering.

---

### 31.3 Delay Dashboard

```
GET /api/v1/projects/dashboard/delays
```

**Roles**: Owner, Admin, Manager

**Response** (200): Per-project delayed task counts.

---

## 32. Gantt Data

### 32.1 Single Project Gantt

```
GET /api/v1/projects/:id/gantt
```

**Roles**: Owner, Admin, Manager

**Response** (200):
```json
{
  "project": {
    "id": "project-uuid",
    "name": "Kitchen Remodel",
    "start_date": "2026-04-01",
    "target_completion_date": "2026-06-15",
    "progress_percent": 35.71
  },
  "tasks": [
    {
      "id": "task-uuid",
      "title": "Demo existing cabinets",
      "status": "done",
      "estimated_start_date": "2026-04-01",
      "estimated_end_date": "2026-04-02",
      "actual_start_date": "2026-04-01",
      "actual_end_date": "2026-04-02",
      "is_delayed": false,
      "order_index": 1,
      "assignees": [
        { "type": "crew_member", "name": "Carlos Rodriguez" }
      ],
      "dependencies": [
        { "depends_on_task_id": "other-task-uuid", "dependency_type": "finish_to_start" }
      ],
      "dependents": [
        { "task_id": "next-task-uuid", "dependency_type": "finish_to_start" }
      ]
    }
  ]
}
```

---

## 33. Portal Authentication

**Base Path**: `/api/v1/portal/auth`

These endpoints use **separate portal JWT** — not staff JWT.

### 33.1 Portal Login

```
POST /api/v1/portal/auth/login
```

**Auth**: None (public)

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tenant_slug | string | yes | Tenant subdomain slug |
| email | string | yes | Customer email |
| password | string | yes | Password |

**Response** (200):
```json
{
  "token": "eyJ...portal-jwt",
  "customer_slug": "jane-doe",
  "must_change_password": true,
  "lead": {
    "id": "lead-uuid",
    "first_name": "Jane",
    "last_name": "Doe"
  }
}
```

**Error Responses**:
| Code | Message |
|------|---------|
| 401 | Invalid email or password |
| 401 | Account is deactivated |

---

### 33.2 Forgot Password

```
POST /api/v1/portal/auth/forgot-password
```

**Auth**: None (public)

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| tenant_slug | string | yes | Tenant subdomain |
| email | string | yes | Customer email |

**Response** (200): Always returns success (prevents email enumeration):
```json
{
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Business Rules**:
- Reset token: 32-byte hex string
- Expires: 1 hour
- Queues email (non-blocking)

---

### 33.3 Reset Password

```
POST /api/v1/portal/auth/reset-password
```

**Auth**: None (public)

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| token | string | yes | Reset token from email |
| new_password | string | yes | New password (min 8 chars, must include uppercase, lowercase, digit, special char) |

**Error Responses**:
| Code | Message |
|------|---------|
| 400 | Invalid or expired reset token |
| 400 | Password does not meet complexity requirements |

---

### 33.4 Change Password

```
POST /api/v1/portal/auth/change-password
```

**Auth**: Portal JWT (PortalAuthGuard)

**Request Body**:
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| old_password | string | yes | Current password |
| new_password | string | yes | New password (min 8, complexity requirements) |

**Business Rules**:
- Sets `must_change_password = false` after successful change
- New password must differ from old password

---

## 34. Portal Projects

**Base Path**: `/api/v1/portal/:customerSlug`

All portal endpoints require **Portal JWT** via PortalAuthGuard. The `customerSlug` in the URL must match the token holder.

**CRITICAL**: Portal endpoints NEVER return: cost data, crew details, financial entries, internal notes, subcontractor data, margins.

### 34.1 List Customer Projects

```
GET /api/v1/portal/:customerSlug/projects
```

**Auth**: Portal JWT

**Query Parameters**: `page` (default 1), `limit` (default 20, max 100)

**Response** (200):
```json
{
  "data": [
    {
      "id": "project-uuid",
      "project_number": "PRJ-2026-0042",
      "name": "Kitchen Remodel - 123 Main St",
      "status": "in_progress",
      "start_date": "2026-04-01",
      "target_completion_date": "2026-06-15",
      "progress_percent": 35.71
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "totalPages": 1 }
}
```

Only returns projects where `portal_enabled = true` and `lead_id` matches the portal account.

---

### 34.2 Project Detail

```
GET /api/v1/portal/:customerSlug/projects/:id
```

**Auth**: Portal JWT

**Response** (200):
```json
{
  "id": "project-uuid",
  "project_number": "PRJ-2026-0042",
  "name": "Kitchen Remodel",
  "status": "in_progress",
  "start_date": "2026-04-01",
  "target_completion_date": "2026-06-15",
  "progress_percent": 35.71,
  "tasks": [
    {
      "title": "Demo existing cabinets",
      "status": "done"
    },
    {
      "title": "Install new cabinets",
      "status": "in_progress"
    }
  ],
  "permits": [
    {
      "permit_type": "Building",
      "status": "approved"
    }
  ]
}
```

**Excluded fields**: description, notes, contract_value, estimated_cost, crew assignments, financial data.

---

### 34.3 Public Logs

```
GET /api/v1/portal/:customerSlug/projects/:id/logs
```

**Auth**: Portal JWT

**Query Parameters**: `page`, `limit`

**Response** (200): Paginated list of logs where `is_public = true` only. Includes author name and public attachments. No internal notes or private entries.

---

### 34.4 Public Photos

```
GET /api/v1/portal/:customerSlug/projects/:id/photos
```

**Auth**: Portal JWT

**Query Parameters**: `page`, `limit`

**Response** (200): Paginated list of photos where `is_public = true` only. Includes file URLs, captions, and dates. No internal metadata.

---

## Appendix A: Enum Reference

| Enum | Values |
|------|--------|
| project_status | `planned`, `in_progress`, `on_hold`, `completed`, `canceled` |
| project_task_status | `not_started`, `in_progress`, `blocked`, `done` |
| project_task_category | `labor`, `material`, `subcontractor`, `equipment`, `other` |
| task_assignee_type | `crew_member`, `subcontractor`, `user` |
| task_dependency_type | `finish_to_start`, `start_to_start`, `finish_to_finish` |
| payment_method | `cash`, `check`, `bank_transfer`, `venmo`, `zelle` |
| subcontractor_compliance_status | `valid`, `expiring_soon`, `expired`, `unknown` |
| subcontractor_document_type | `insurance`, `agreement`, `coi`, `contract`, `license`, `other` |
| project_document_type | `contract`, `permit`, `blueprint`, `agreement`, `photo`, `other` |
| log_attachment_file_type | `photo`, `pdf`, `document` |
| calendar_sync_status | `pending`, `synced`, `failed`, `local_only` |
| permit_status | `not_required`, `pending_application`, `submitted`, `approved`, `active`, `failed`, `closed` |
| inspection_result | `pass`, `fail`, `conditional`, `pending` |
| punch_list_status | `open`, `in_progress`, `resolved` |
| invoice_status | `pending`, `approved`, `paid` |
| financial_entry_type | `expense`, `income` |
| financial_category_type | `labor`, `material`, `subcontractor`, `equipment`, `other` |
| hour_log_source | `manual`, `clockin_system` |

---

## Appendix B: File Storage

### Architecture
- Files stored at: `/var/www/lead360.app/uploads/public/{tenant_id}/{folder}/{uuid}.{ext}`
- Served by Nginx at: `/public/{tenant_id}/{folder}/{uuid}.{ext}`
- Images: `/public/{tenant_id}/images/{uuid}.{ext}`
- Documents: `/public/{tenant_id}/files/{uuid}.{ext}`

### Rendering in Frontend
- For images: `<img src={file_url} />`
- For documents: `<a href={file_url} download>` or open in new tab
- The `file_url` from API responses is the direct path — no additional API call needed
- **NEVER use S3 or cloud storage** — all files are local Nginx

### Upload Pattern
All file uploads use `multipart/form-data` with the `file` field containing the binary. Additional metadata fields are sent as form fields alongside the file.

---

## Appendix C: Pagination Defaults

| Parameter | Default | Min | Max |
|-----------|---------|-----|-----|
| page | 1 | 1 | — |
| limit | 20 | 1 | 100 |

Formula: `skip = (page - 1) * limit`, `totalPages = ceil(total / limit)`

---

## Appendix D: Delay Computation

A task is considered **delayed** (`is_delayed = true`) when ALL of these conditions are met:
- `status` is NOT `done` (completed tasks are never flagged as delayed)
- AND one of:
  - `actual_end_date > estimated_end_date` (finished late, but status not yet marked done)
  - `estimated_end_date < today` AND `actual_end_date` is null (overdue — past deadline, not finished)

A task is **NOT delayed** when:
- `status = "done"` (completed tasks are always `is_delayed = false`, regardless of dates)
- No `estimated_end_date` set (no deadline to miss)
- Deadline has not passed yet

Delay status is computed on every read — never stored statically.

---

## Appendix E: Sensitive Field Masking

| Field | Mask Format |
|-------|-------------|
| SSN | `***-**-1234` (last 4 visible) |
| ITIN | `***-**-1234` (last 4 visible) |
| Bank account | `****1234` (last 4 visible) |
| Bank routing | `****1234` (last 4 visible) |
| DL number | `****5678` (last 4 visible) |

Encrypted at rest using AES-256-GCM via EncryptionService. Standard responses return masked values. Use reveal endpoints (`GET /crew/:id/reveal/:field` or `GET /subcontractors/:id/reveal/:field`) for full values — Owner/Admin only, audit logged.

---

*End of Project Management Module REST API Documentation*
*Total Endpoints Documented: 150+*
*Coverage: 100% of implemented and exposed endpoints*
