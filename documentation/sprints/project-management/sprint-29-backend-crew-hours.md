# Sprint 29 — Crew Hour Logging Integration

## Sprint Goal
Integrate CrewHourLogService into the project task context for logging crew hours against tasks, with overtime tracking and crew-level hour summaries.

## Phase
BACKEND

## Module
Project Management

## Gate Status
REQUIRES_FINANCIAL_GATE_3_COMPLETE

## Prerequisites
- Sprint 27 must be complete (Gate 3 open: CrewHourLogService exists)
- Sprint 15 must be complete (reason: task assignments exist — hours logged for assigned crew)

## Codebase Reference
- CrewHourLogService from FinancialModule (Sprint 27)
- TaskAssignmentService from Sprint 15

## Tasks

### Task 29.1 — Crew hour endpoints from task context
**Type**: Controller + Service
**Complexity**: Medium

**Endpoints**:
| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/tasks/:taskId/crew-hours | Owner, Admin, Manager |
| GET | /projects/:projectId/tasks/:taskId/crew-hours | Owner, Admin, Manager |
| GET | /crew/:crewMemberId/hours | Owner, Admin, Manager, Bookkeeper |

The first two delegate to CrewHourLogService with project_id and task_id pre-filled. The third returns a crew member's hour summary across all projects.

**Crew hour summary response** (GET /crew/:crewMemberId/hours):
```json
{
  "crew_member_id": "uuid",
  "total_regular_hours": 160.00,
  "total_overtime_hours": 12.50,
  "total_hours": 172.50,
  "logs_by_project": [
    {
      "project_id": "uuid",
      "project_name": "Kitchen Remodel",
      "regular_hours": 80.00,
      "overtime_hours": 5.00,
      "total_hours": 85.00
    }
  ]
}
```

**Business Rules**:
- Phase 1: source='manual' always
- hours_regular must be > 0
- Overtime logged separately (hours_overtime)
- All queries include where: { tenant_id }

Unit tests, integration tests. Update crew member and task REST docs.

**Acceptance Criteria**:
- [ ] Crew hours logged from task context
- [ ] Crew hour summary endpoint working
- [ ] Tests complete

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Crew hour logging from tasks
- [ ] Crew-level hour summaries
- [ ] Tests complete

## Gate Marker
NONE

## Handoff Notes
- Task crew hours at /api/v1/projects/:projectId/tasks/:taskId/crew-hours
- Crew summary at /api/v1/crew/:crewMemberId/hours
