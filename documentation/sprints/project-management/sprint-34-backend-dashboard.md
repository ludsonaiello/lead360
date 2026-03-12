# Sprint 34 — Project Dashboard Data Endpoints

## Sprint Goal
Deliver project dashboard data endpoints providing status distribution, active project counts, delayed task counts, and filterable project summaries for the management dashboard.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 16 must be complete (reason: delay detection exists)
- Sprint 08 must be complete (reason: ProjectService exists)
- Sprint 07b must be complete (reason: project_activity entity and ProjectActivityService exist)

## Codebase Reference
- ProjectService, ProjectTaskService
- FinancialEntryService (optional — for financial summary per project)
- **ProjectActivityService**: `api/src/modules/projects/services/project-activity.service.ts` — for recent_activity feed

## Tasks

### Task 34.1 — ProjectDashboardService + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: High

**ProjectDashboardService methods**:
1. **getDashboardData(tenantId, filters: { status?, assigned_pm_user_id?, date_from?, date_to? })** — Returns aggregated dashboard data.
2. **getProjectsWithSummary(tenantId, query: { status?, pm?, search?, page?, limit? })** — Paginated project list with task counts and financial summary.

**Controller** — add to existing project controller or create dashboard controller:
| Method | Path | Roles |
|--------|------|-------|
| GET | /projects/dashboard | Owner, Admin, Manager |
| GET | /projects/dashboard/gantt | Owner, Admin, Manager |

**Dashboard response** (GET /projects/dashboard):
```json
{
  "total_projects": 25,
  "status_distribution": {
    "planned": 5,
    "in_progress": 12,
    "on_hold": 3,
    "completed": 4,
    "canceled": 1
  },
  "active_projects": 15,
  "delayed_tasks_count": 8,
  "projects_with_delays": 4,
  "overdue_tasks_count": 3,
  "upcoming_deadlines": [
    { "project_id": "uuid", "project_name": "Kitchen Remodel", "target_completion_date": "2026-04-15", "days_remaining": 5 }
  ],
  "recent_activity": []
  // recent_activity: array — read from project_activity table via ProjectActivityService.getTenantRecentActivity(tenantId, 10).
  // Fields: { activity_type, project_id, project_name, description, user_id, user_name, created_at }
  // Query:
  // SELECT project_activity.*, project.name AS project_name, user.first_name, user.last_name
  // FROM project_activity
  // JOIN project ON project_activity.project_id = project.id
  // LEFT JOIN user ON project_activity.user_id = user.id
  // WHERE project_activity.tenant_id = :tenantId
  // ORDER BY project_activity.created_at DESC
  // LIMIT 10
}
```

**Business Rules**:
- All queries scoped to tenant_id
- Dashboard aggregates across all projects for the tenant
- Filters: status, assigned PM, date range
- Delayed task count uses is_delayed computation

Unit tests, integration tests, REST docs at `api/documentation/project_dashboard_REST_API.md`.

**Acceptance Criteria**:
- [ ] Dashboard endpoint returns correct aggregations
- [ ] Filters working
- [ ] Tests and docs complete

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Dashboard data endpoint operational
- [ ] Status distribution, delay counts, upcoming deadlines
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Dashboard at /api/v1/projects/dashboard
- Returns aggregated counts, not individual records
