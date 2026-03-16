# Project Completion REST API

**Module**: Project Management — Completion Checklist & Punch List
**Base URL**: `/api/v1/projects/:projectId/completion`
**Authentication**: Bearer JWT required on all endpoints
**RBAC**: Owner, Admin, Manager

---

## Overview

The completion checklist workflow allows project managers to:
1. **Start a completion checklist** (optionally from a pre-defined template)
2. **Track individual item completion** (e.g., "Final inspection passed")
3. **Add manual items** not in the original template
4. **Manage punch list deficiencies** (items that must be resolved before completion)
5. **Finalize project completion** once all required items and punch list are resolved

**Business Rules**:
- One active checklist per project (HTTP 409 if duplicate)
- All required checklist items must be completed before project can be marked complete
- All punch list items must be resolved (`status = 'resolved'`) before completion
- Punch list items are separate from checklist items
- All queries enforce `tenant_id` isolation

---

## Endpoints

### 1. GET /projects/:projectId/completion

**Description**: Get the current completion checklist with all items and punch list.

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project ID |

**Response** `200 OK`:
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "template_id": "uuid | null",
  "completed_at": "2026-06-14T10:00:00.000Z | null",
  "created_at": "2026-06-10T10:00:00.000Z",
  "items": [
    {
      "id": "uuid",
      "title": "Final inspection passed",
      "is_required": true,
      "is_completed": true,
      "completed_at": "2026-06-14T10:00:00.000Z",
      "completed_by_user_id": "uuid",
      "notes": "Passed by Inspector Smith",
      "order_index": 0,
      "template_item_id": "uuid | null"
    },
    {
      "id": "uuid",
      "title": "Customer walkthrough",
      "is_required": true,
      "is_completed": false,
      "completed_at": null,
      "completed_by_user_id": null,
      "notes": null,
      "order_index": 1,
      "template_item_id": "uuid | null"
    }
  ],
  "punch_list": [
    {
      "id": "uuid",
      "title": "Touch up paint on trim",
      "description": "Paint chipping on north-side window trim",
      "status": "open",
      "assigned_to_crew": {
        "id": "uuid",
        "first_name": "Mike",
        "last_name": "Johnson"
      },
      "resolved_at": null,
      "reported_by_user_id": "uuid",
      "resolved_by_user_id": null,
      "created_at": "2026-06-12T08:00:00.000Z"
    }
  ]
}
```

**Error Responses**:
| Status | Description |
|--------|-------------|
| 401 | Unauthorized — missing or invalid JWT |
| 403 | Forbidden — role not allowed |
| 404 | Project not found, or no checklist exists for this project |

---

### 2. POST /projects/:projectId/completion

**Description**: Start a completion checklist for the project. Optionally copies items from a template.

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project ID |

**Request Body**:
```json
{
  "template_id": "uuid"  // optional — omit for empty checklist
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| template_id | UUID | No | Valid UUID, must exist within tenant | Template to copy items from |

**Response** `201 Created`:
Same shape as GET response above. If template_id provided, items are pre-populated from the template.

**Error Responses**:
| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden — role not allowed |
| 404 | Project not found, or template not found |
| 409 | A completion checklist already exists for this project |

---

### 3. PATCH /projects/:projectId/completion/items/:itemId

**Description**: Mark a checklist item as completed.

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project ID |
| itemId | UUID | Yes | Checklist item ID |

**Request Body**:
```json
{
  "notes": "Passed by Inspector Smith on 2026-06-14"  // optional
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| notes | String | No | Any text | Optional completion notes |

**Response** `200 OK`:
Full checklist response (same as GET). The targeted item will have `is_completed: true`, `completed_at` set, and `completed_by_user_id` set.

**Side Effects**:
- If all **required** items are now completed, `checklist.completed_at` is automatically set.
- Audit log entry created.

**Error Responses**:
| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Project, checklist, or item not found |

---

### 4. POST /projects/:projectId/completion/items

**Description**: Add a manual checklist item (not from template).

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project ID |

**Request Body**:
```json
{
  "title": "Customer walkthrough completed",
  "is_required": true,
  "order_index": 5
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| title | String | Yes | 1–300 chars | Item title |
| is_required | Boolean | No | — | Default: `true` |
| order_index | Integer | Yes | >= 0 | Display order |

**Response** `201 Created`:
Full checklist response (same as GET).

**Error Responses**:
| Status | Description |
|--------|-------------|
| 400 | Validation error (missing title, invalid order_index) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Project or checklist not found |

---

### 5. POST /projects/:projectId/completion/punch-list

**Description**: Add a punch list item (deficiency that must be resolved before project completion).

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project ID |

**Request Body**:
```json
{
  "title": "Touch up paint on trim",
  "description": "Paint chipping on north-side window trim, needs scraping and two coats",
  "assigned_to_crew_id": "uuid"
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| title | String | Yes | 1–300 chars | Deficiency title |
| description | String | No | Any text | Detailed description |
| assigned_to_crew_id | UUID | No | Valid UUID | Crew member to assign |

**Response** `201 Created`:
Full checklist response (same as GET). New punch list item will have `status: "open"`.

**Error Responses**:
| Status | Description |
|--------|-------------|
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Project or checklist not found |

---

### 6. PATCH /projects/:projectId/completion/punch-list/:itemId

**Description**: Update a punch list item's status, description, or assignment.

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project ID |
| itemId | UUID | Yes | Punch list item ID |

**Request Body**:
```json
{
  "status": "resolved",
  "description": "Paint fully stripped and recoated with primer + two finish coats",
  "assigned_to_crew_id": "uuid"
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| status | String | No | `"open"`, `"in_progress"`, `"resolved"` | New status |
| description | String | No | Any text | Updated description |
| assigned_to_crew_id | UUID | No | Valid UUID | Re-assign to different crew |

**Side Effects**:
- When `status` → `"resolved"`: `resolved_at` and `resolved_by_user_id` are auto-set.
- When re-opening from `"resolved"`: `resolved_at` and `resolved_by_user_id` are cleared.
- Audit log entry created.

**Response** `200 OK`:
Full checklist response (same as GET).

**Error Responses**:
| Status | Description |
|--------|-------------|
| 400 | Validation error (invalid status value) |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Project, checklist, or punch list item not found |

---

### 7. POST /projects/:projectId/complete

**Description**: Finalize project completion. Validates all required checklist items are completed and all punch list items are resolved.

**Path Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | UUID | Yes | Project ID |

**Request Body**: None

**Response** `200 OK`:
```json
{
  "project_id": "uuid",
  "status": "completed",
  "actual_completion_date": "2026-06-15T00:00:00.000Z",
  "checklist_completed_at": "2026-06-14T10:00:00.000Z"
}
```

**Validation Error Response** `409 Conflict`:
```json
{
  "message": "Cannot complete project: outstanding items remain",
  "incomplete_checklist_items": [
    { "id": "uuid", "title": "Customer walkthrough" }
  ],
  "unresolved_punch_list_items": [
    { "id": "uuid", "title": "Touch up paint on trim", "status": "open" }
  ]
}
```

**Error Responses**:
| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Project not found |
| 409 | Cannot complete — no checklist exists, or outstanding items remain |

---

## Data Models

### project_completion_checklist

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | No | auto | Primary key |
| tenant_id | UUID | No | — | Tenant isolation FK |
| project_id | UUID | No | — | FK → project |
| template_id | UUID | Yes | null | FK → completion_checklist_template |
| completed_at | DateTime | Yes | null | Set when all required items done |
| created_by_user_id | UUID | Yes | null | FK → user |
| created_at | DateTime | No | now() | — |

**Unique constraint**: `[tenant_id, project_id]` — one checklist per project per tenant.

### project_completion_checklist_item

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | No | auto | Primary key |
| tenant_id | UUID | No | — | Tenant isolation FK |
| checklist_id | UUID | No | — | FK → project_completion_checklist |
| title | VARCHAR(300) | No | — | Item title |
| is_required | Boolean | No | — | Must be completed for project finish |
| is_completed | Boolean | No | false | Completion status |
| completed_at | DateTime | Yes | null | When completed |
| completed_by_user_id | UUID | Yes | null | FK → user |
| notes | Text | Yes | null | Completion notes |
| template_item_id | UUID | Yes | null | FK → template item (null if manual) |
| order_index | Int | No | — | Display order |
| updated_at | DateTime | No | auto | — |

### punch_list_item

| Field | Type | Nullable | Default | Description |
|-------|------|----------|---------|-------------|
| id | UUID | No | auto | Primary key |
| tenant_id | UUID | No | — | Tenant isolation FK |
| checklist_id | UUID | No | — | FK → project_completion_checklist |
| project_id | UUID | No | — | FK → project |
| title | VARCHAR(300) | No | — | Deficiency title |
| description | Text | Yes | null | Detailed description |
| status | Enum | No | open | `open`, `in_progress`, `resolved` |
| assigned_to_crew_id | UUID | Yes | null | FK → crew_member |
| resolved_at | DateTime | Yes | null | Auto-set on resolve |
| reported_by_user_id | UUID | Yes | null | FK → user |
| resolved_by_user_id | UUID | Yes | null | FK → user |
| created_at | DateTime | No | now() | — |
| updated_at | DateTime | No | auto | — |

---

## Typical Workflow

```
1. POST /projects/:id/completion { template_id: "..." }    → Start checklist
2. GET  /projects/:id/completion                             → View state
3. PATCH /projects/:id/completion/items/:itemId { notes }   → Complete items one by one
4. POST /projects/:id/completion/punch-list { title }       → Report deficiencies
5. PATCH /projects/:id/completion/punch-list/:id { status: "resolved" }
6. POST /projects/:id/complete                               → Finalize project
```
