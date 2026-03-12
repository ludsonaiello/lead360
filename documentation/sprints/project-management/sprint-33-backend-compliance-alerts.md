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

**NOTIFICATION INTEGRATION (REQUIRED)**:
Import path: `api/src/modules/communication/services/notifications.service.ts`
Import `CommunicationModule` into `ProjectsModule`.

For each expired or expiring_soon subcontractor, for each Owner/Admin user in the tenant:
Call `NotificationsService.createNotification({
  tenant_id: tenantId,
  user_id: ownerOrAdminUserId,  // Send individually to each Owner/Admin
  type: 'subcontractor_compliance',
  title: 'Insurance Expiry Alert',
  message: \`Insurance for '${subcontractor.business_name}' expires on ${formatDate(subcontractor.insurance_expiry_date)}.\`,
  action_url: \`/subcontractors/${subcontractor.id}\`,
  related_entity_type: 'subcontractor',
  related_entity_id: subcontractor.id
});`

Deduplication rule: before creating notification, check if a notification with `type='subcontractor_compliance'` AND `related_entity_id=subcontractorId` was already created TODAY for this tenant. If yes, skip. Use `created_at >= today_midnight` filter.

**BULLMQ CONFIGURATION SPECIFICATION:**

Queue name: `'project-management'` (shared with Sprint 16 — same queue, different job names)
Queue registration (in `projects.module.ts`):
  `BullModule.registerQueue({ name: 'project-management' })`

Job registration on module startup (OnModuleInit in ProjectsModule):
  Call `ScheduledJobService.registerScheduledJob({
    job_type: 'subcontractor-insurance-check',
    name: 'Subcontractor Insurance Expiry Check',
    description: 'Daily scan for subcontractor insurance expiry. Notifies tenant owners and admins of expired or expiring insurance.',
    schedule: '0 7 * * *',
    timezone: 'UTC',
    max_retries: 3,
    timeout_seconds: 300
  });`
  Use upsert pattern: if job_type already registered, skip (idempotent).

Job options (add to `.add()` call):
  `{ attempts: 3, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 100, removeOnFail: 50 }`

Multi-tenant processing:
  The processor must query ALL active tenants and process each independently.
  If processing fails for one tenant, catch the error, log it, and continue to the next tenant.
  Job failure for one tenant must never stop processing for other tenants.

Admin UI visibility: Once registered, admins can enable/disable the job at `/admin/jobs/schedules` without code changes.

ScheduledJobService import: `api/src/modules/jobs/services/scheduled-job.service.ts`

**Business Rules**:
- Only scan subcontractors assigned to active projects
- Don't spam: one notification per subcontractor per day max (deduplication rule above)
- Use existing notification infrastructure (NotificationsService)
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
