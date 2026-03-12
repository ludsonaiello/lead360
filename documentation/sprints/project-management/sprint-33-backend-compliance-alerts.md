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
- **Notification System (VERIFIED — EXISTS in CommunicationModule)**:
  - Queue: `communication-notifications` (BullMQ)
  - To create notifications, inject the BullMQ queue and add a job:
    ```typescript
    @InjectQueue('communication-notifications') private notificationQueue: Queue

    await this.notificationQueue.add('create-notification', {
      event_type: 'subcontractor_compliance',
      tenant_id: tenantId,
      data: { business_name: sub.business_name, status: 'expired', expiry_date: sub.insurance_expiry_date },
      entity_type: 'subcontractor',
      entity_id: sub.id,
    });
    ```
  - The NotificationProcessor resolves recipients from notification_rule records for `event_type='subcontractor_compliance'`
  - Seed a default notification_rule for event_type 'subcontractor_compliance' with recipient_type 'owner' and notify_in_app=true for each tenant

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

**Notification creation**: Use the `communication-notifications` BullMQ queue (see Codebase Reference above). Queue one job per subcontractor per notification type.

**Admin Job Management**: Register this job in the admin panel's job management system:
- Follow the pattern at `api/src/modules/admin/jobs/notification-cleanup.job.ts`
- Register as a repeatable BullMQ job with cron: `'0 7 * * *'` (7 AM UTC daily)
- Queue name: `project-tasks` (same queue as Sprint 16's delay check job)
- Job options: `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: true }`
- Implement multi-tenant batch processing: query all active tenants, process each in sequence, continue on error

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
