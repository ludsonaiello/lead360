# Sprint 28 — Task-Level Financial Entries + Project Cost Summary

## Sprint Goal
Integrate FinancialEntryService into the task context, enabling cost entry creation from task views and providing project-level financial summaries combining contract value with actual costs.

## Phase
BACKEND

## Module
Project Management

## Gate Status
REQUIRES_FINANCIAL_GATE_1_COMPLETE

## Prerequisites
- Sprint 06 must be complete (Gate 1 open: FinancialEntryService exists)
- Sprint 11 must be complete (Gate 2 open: ReceiptService exists)
- Sprint 13 must be complete (reason: ProjectTaskService exists)

## Codebase Reference
- FinancialEntryService from FinancialModule
- ReceiptService from FinancialModule
- ProjectService from Sprint 08

## Tasks

### Task 28.1 — Task-level financial integration endpoints
**Type**: Controller + Service
**Complexity**: Medium

**Add endpoints** to ProjectTaskController (or a new TaskFinancialController):

| Method | Path | Roles |
|--------|------|-------|
| POST | /projects/:projectId/tasks/:taskId/costs | Owner, Admin, Manager, Bookkeeper |
| GET | /projects/:projectId/tasks/:taskId/costs | Owner, Admin, Manager, Bookkeeper |
| POST | /projects/:projectId/tasks/:taskId/receipts | Owner, Admin, Manager, Bookkeeper, Field |
| GET | /projects/:projectId/tasks/:taskId/receipts | Owner, Admin, Manager, Bookkeeper |

These endpoints delegate to FinancialEntryService and ReceiptService, pre-filling project_id and task_id from the URL params.

**Enhanced project financial summary** (update existing endpoint from Sprint 08):
GET /projects/:id/summary now returns:
```json
{
  "project_id": "uuid",
  "contract_value": 45000.00,
  "estimated_cost": 32000.00,
  "total_actual_cost": 12500.00,
  "cost_by_category": {
    "labor": 5000.00,
    "material": 4500.00,
    "subcontractor": 2000.00,
    "equipment": 800.00,
    "other": 200.00
  },
  "entry_count": 15,
  "receipt_count": 8,
  "margin_estimated": 13000.00,
  "margin_actual": 32500.00
}
```

**Business Rules**:
- Task cost entries use FinancialEntryService.createEntry with task_id pre-filled
- Receipt upload uses ReceiptService.uploadReceipt with task_id pre-filled
- Project summary combines contract_value + estimated_cost from project with actual costs from FinancialEntryService
- All queries include where: { tenant_id }

Unit tests, integration tests, update project REST docs.

**Acceptance Criteria**:
- [ ] Task-level cost entry creation working
- [ ] Task-level receipt upload working
- [ ] Enhanced project summary with margins
- [ ] Tests and docs complete

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Financial entries created from task context
- [ ] Receipts uploaded from task context
- [ ] Project financial summary with margins
- [ ] Tests complete

## Gate Marker
NONE

## Handoff Notes
- Task costs at /api/v1/projects/:projectId/tasks/:taskId/costs
- Task receipts at /api/v1/projects/:projectId/tasks/:taskId/receipts
- Enhanced summary at /api/v1/projects/:id/summary
