# Sprint 30 — Subcontractor Task Invoicing Integration

## Sprint Goal
Integrate SubcontractorInvoiceService into the task context for creating and managing subcontractor invoices per task, with status workflow and file upload.

## Phase
BACKEND

## Module
Project Management

## Gate Status
REQUIRES_FINANCIAL_GATE_3_COMPLETE

## Prerequisites
- Sprint 27 must be complete (Gate 3 open: SubcontractorInvoiceService exists)
- Sprint 15 must be complete (reason: subcontractor task assignments exist)

## Codebase Reference
- SubcontractorInvoiceService from FinancialModule (Sprint 27)
- SubcontractorPaymentService from FinancialModule (Sprint 27)

## Tasks

### Task 30.1 — Subcontractor invoicing from task context + payment history on profile
**Type**: Controller + Service
**Complexity**: Medium

**Endpoints** (some may already exist from Sprint 27 — add task-context wrappers):
| Method | Path | Roles |
|--------|------|-------|
| GET | /projects/:projectId/tasks/:taskId/invoices | Owner, Admin, Manager, Bookkeeper |
| GET | /subcontractors/:id/invoices | Owner, Admin, Manager, Bookkeeper |
| GET | /subcontractors/:id/payment-summary | Owner, Admin, Manager, Bookkeeper |

**Subcontractor payment summary** (GET /subcontractors/:id/payment-summary):
```json
{
  "subcontractor_id": "uuid",
  "total_invoiced": 15000.00,
  "total_paid": 10000.00,
  "total_pending": 3000.00,
  "total_approved": 2000.00,
  "invoices_count": 5,
  "payments_count": 3
}
```

**Business Rules**:
- Invoice status: pending → approved → paid (forward only)
- Amount updatable before approved; after approved: Owner/Admin + audit
- File upload uses FilesService (FileCategory: invoice)
- All queries include where: { tenant_id }

Unit tests, integration tests, update subcontractor REST docs.

**Acceptance Criteria**:
- [ ] Task invoices accessible from task context
- [ ] Subcontractor invoice listing working
- [ ] Payment summary endpoint working
- [ ] Tests complete

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Subcontractor invoicing from task context
- [ ] Payment summary for subcontractor profiles
- [ ] Tests complete

## Gate Marker
NONE

## Handoff Notes
- Task invoices at /api/v1/projects/:projectId/tasks/:taskId/invoices
- Sub invoices at /api/v1/subcontractors/:id/invoices
- Sub payment summary at /api/v1/subcontractors/:id/payment-summary
