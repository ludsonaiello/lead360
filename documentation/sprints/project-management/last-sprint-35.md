# Sprint 35 — Gantt Data Endpoint + Project Financial Summary

## Sprint Goal
Deliver Gantt chart data endpoints that return tasks with dates, dependencies, assignments, and progress for Gantt view rendering, plus a project financial summary endpoint combining all cost data.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 14 must be complete (reason: task dependencies exist)
- Sprint 15 must be complete (reason: task assignments exist)
- Sprint 28 must be complete (reason: financial entry integration exists)

## Codebase Reference
- ProjectTaskService, TaskDependencyService, TaskAssignmentService
- FinancialEntryService

## Tasks

### Task 35.1 — Gantt data endpoints + financial summary
**Type**: Service + Controller + Test + Documentation
**Complexity**: High

**GanttDataService methods**:
1. **getProjectGantt(tenantId, projectId)** — Returns all tasks with dates, dependencies, assignees, and status. Structured for Gantt chart rendering.
2. **getAllProjectsGantt(tenantId, filters: { status?, pm? })** — Returns project-level Gantt data (start/end dates, progress) for multi-project timeline view.

**Endpoints**:
| Method | Path | Roles |
|--------|------|-------|
| GET | /projects/:id/gantt | Owner, Admin, Manager |
| GET | /projects/dashboard/gantt | Owner, Admin, Manager |

**Single project Gantt response** (GET /projects/:id/gantt):
```json
{
  "project": {
    "id": "uuid",
    "name": "Kitchen Remodel",
    "start_date": "2026-04-01",
    "target_completion_date": "2026-06-15",
    "progress_percent": 45.00
  },
  "tasks": [
    {
      "id": "uuid",
      "title": "Demo existing kitchen",
      "status": "done",
      "estimated_start_date": "2026-04-01",
      "estimated_end_date": "2026-04-03",
      "actual_start_date": "2026-04-01",
      "actual_end_date": "2026-04-03",
      "is_delayed": false,
      "order_index": 0,
      "assignees": [
        { "type": "crew_member", "name": "Mike Johnson" }
      ],
      "dependencies": [],
      "dependents": [
        { "task_id": "uuid", "type": "finish_to_start" }
      ]
    },
    {
      "id": "uuid",
      "title": "Rough plumbing",
      "status": "in_progress",
      "estimated_start_date": "2026-04-04",
      "estimated_end_date": "2026-04-06",
      "actual_start_date": "2026-04-05",
      "actual_end_date": null,
      "is_delayed": true,
      "order_index": 1,
      "assignees": [
        { "type": "subcontractor", "name": "ABC Plumbing" }
      ],
      "dependencies": [
        { "depends_on_task_id": "uuid", "type": "finish_to_start" }
      ],
      "dependents": []
    }
  ]
}
```

**Multi-project Gantt response** (GET /projects/dashboard/gantt):
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Kitchen Remodel",
      "project_number": "PRJ-2026-0001",
      "status": "in_progress",
      "start_date": "2026-04-01",
      "target_completion_date": "2026-06-15",
      "progress_percent": 45.00,
      "task_count": 12,
      "completed_task_count": 5,
      "delayed_task_count": 2
    }
  ]
}
```

**Business Rules**:
- All queries scoped to tenant_id
- Gantt includes both estimated and actual dates
- Dependencies include both "depends on" and "depended on by" for arrow rendering
- is_delayed computed on each task

Unit tests, integration tests, REST docs at `api/documentation/gantt_data_REST_API.md`.

**Acceptance Criteria**:
- [ ] Single project Gantt with tasks, dependencies, assignees
- [ ] Multi-project Gantt with progress
- [ ] Tests and docs complete

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Gantt data endpoints operational
- [ ] Dependencies structured for chart rendering
- [ ] All backend sprints complete — ready for frontend

## Gate Marker
STOP — ALL BACKEND SPRINTS COMPLETE. Frontend development can begin (Sprints 36-40).

## Handoff Notes
- Single project Gantt at /api/v1/projects/:id/gantt
- All projects Gantt at /api/v1/projects/dashboard/gantt
- Dashboard at /api/v1/projects/dashboard
- BACKEND IS COMPLETE — 35 backend sprints delivered
- Frontend agents: read ALL api/documentation/*_REST_API.md files before starting
