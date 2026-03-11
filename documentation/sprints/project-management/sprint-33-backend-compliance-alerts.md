# Sprint 33 — Subcontractor Insurance Expiry Alert System

## Sprint Goal
Implement a BullMQ scheduled job that scans subcontractor insurance expiry dates, recomputes compliance_status, and creates notifications for tenant owners/admins when insurance is expiring or expired.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 04 must be complete (reason: subcontractor entity with insurance_expiry_date exists)

## Codebase Reference
- SubcontractorService from Sprint 04
- BullMQ: follow existing pattern from `api/src/modules/jobs/`
- Notification model: check if existing notification table exists in schema (verified: `notification` model exists)

## Tasks

### Task 33.1 — Create insurance expiry check job
**Type**: Service (BullMQ processor)
**Complexity**: Medium

**Job**: 'subcontractor-insurance-check'
**Schedule**: Daily at 7:00 AM UTC
**Logic**:
1. Query all tenants with active subscription
2. For each tenant: query all active subcontractors assigned to active projects (via task_assignee)
3. Compute compliance_status for each:
   - expired: insurance_expiry_date < today
   - expiring_soon: insurance_expiry_date within 30 days
4. For each expired or expiring_soon:
   - Create notification for tenant Owner/Admin users
   - Notification type: 'subcontractor_compliance'
   - Message: "Insurance for {business_name} is {expired/expiring on date}"
5. Update compliance_status in database (optional — primarily computed on read)

**Notification creation**: Use existing notification table/service if available, otherwise create notification records directly.

**Business Rules**:
- Only scan subcontractors assigned to active projects
- Don't spam: one notification per subcontractor per day max
- Use existing notification infrastructure
- Job failure should not affect other tenants

Unit tests for compliance check logic. Integration test for the scheduled job.

**Files Expected**:
- api/src/modules/projects/processors/insurance-expiry-check.processor.ts (created)
- api/src/modules/projects/schedulers/insurance-expiry-check.scheduler.ts (created)
- api/src/modules/projects/projects.module.ts (modified — register BullMQ queue)
- api/src/modules/projects/processors/insurance-expiry-check.processor.spec.ts (created)

**Blocker**: NONE

---

## Sprint Acceptance Criteria
- [ ] Scheduled job runs daily
- [ ] Notifications created for expired/expiring insurance
- [ ] One notification per sub per day (no spam)
- [ ] Tests complete

## Gate Marker
NONE

## Handoff Notes
- Job: subcontractor-insurance-check (daily 7 AM UTC)
- Creates notifications in existing notification table
- compliance_status still primarily computed on read (Sprint 04 logic)
