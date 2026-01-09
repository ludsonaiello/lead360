# Feature Contract: Background Jobs

**Feature Name**: Background Jobs & Email Queue System  
**Module**: Infrastructure  
**Sprint**: Sprint 0 - Platform Foundation  
**Status**: Draft

---

## Purpose

**What problem does this solve?**

Provides unified infrastructure for asynchronous task execution, scheduled jobs, and email delivery. Centralizes all background processing into a manageable, monitorable system with dual email configuration (platform-level and tenant-level).

**Who is this for?**

- **Platform Admin**: Configure platform email settings, monitor all jobs, manage schedules
- **Tenant Owners**: Configure business email settings for customer communications
- **Developers**: Queue background tasks from any module
- **System**: Execute scheduled tasks (expiry checks, cleanup, partition creation)
- **Use Cases**: 
  - Send activation emails asynchronously
  - Check license/insurance expiry daily
  - Clean up old data nightly
  - Send quote emails from tenant's email provider
  - Generate reports in background
  - Create ZIP files for bulk downloads

---

## Scope

### **In Scope**

- ✅ BullMQ job queue system (Redis-based)
- ✅ Basic SMTP email sending (system emails only)
- ✅ Platform SMTP configuration (Admin panel)
- ✅ Job monitoring dashboard (Platform Admin)
- ✅ Scheduled jobs management (configurable schedules)
- ✅ Job retry logic (exponential backoff)
- ✅ Dead letter queue (failed jobs)
- ✅ Email queue (for system emails)
- ✅ Job history (last 100 runs per job type)
- ✅ Job retention policy (30 days)
- ✅ Queue health monitoring
- ✅ Manual job triggers
- ✅ Enable/disable scheduled jobs
- ✅ Migration of existing cron jobs
- ✅ System email templates (activation, password reset, expiry alerts)
- ✅ Audit logging (all job executions)

### **Out of Scope** (Future Modules)

- ❌ **Business emails** (quotes, invoices) - **Communication Module (Sprint 1+)**
- ❌ **Multiple email providers** (AWS SES, SendGrid, Brevo) - **Communication Module**
- ❌ **Tenant email configuration** - **Communication Module**
- ❌ **SMS/Twilio integration** - **Communication Module**
- ❌ **Incoming webhooks** (SMS, calls) - **Communication Module**
- ❌ **Email customization per tenant** - **Communication Module**
- ❌ Real-time job streaming (Phase 2 - WebSocket updates)
- ❌ Job analytics/reporting (Phase 2 - trends, performance metrics)
- ❌ Custom job scheduler UI (Phase 2 - visual cron editor)
- ❌ Job dependencies/workflows (Phase 2 - DAG execution)
- ❌ Multi-tenant job isolation in Redis (single queue for all tenants)
- ❌ Email open/click tracking (Phase 2)
- ❌ Email A/B testing (Phase 2)

**Note**: A comprehensive **Communication/Notification Module** will be designed in Sprint 1+ to handle:
- Business customer communications (quotes, invoices, project updates)
- Multiple email providers (tenant choice)
- SMS integration (Twilio)
- Phone call handling (Twilio)
- Communication history and logging
- Tenant-specific email/SMS configuration
- Incoming webhooks (replies, status updates)

---

## Dependencies

### **Requires (must be complete first)**

- [x] Authentication module (send activation emails)
- [x] Tenant module (send expiry alerts)
- [x] RBAC module (permission checks)
- [x] Audit Log module (log job executions)
- [x] File Storage module (file retention job)

### **Blocks (must complete before)**

- Quotes module (send quote emails)
- Invoices module (send invoice emails)
- Reports module (background report generation)

### **External Dependencies**

- Redis (required for BullMQ)
- Email provider credentials (AWS SES, SendGrid, Brevo, or SMTP)

---

## Platform Email System (SMTP Only)

### **Purpose**

Send **system emails only** using simple SMTP configuration:

**System Emails** (Sprint 0):
- Password reset emails
- Account activation emails  
- License/insurance expiry alerts
- Platform notifications
- Admin alerts

**Sends From**: `noreply@lead360.com` or `support@lead360.com`

**Configuration**: Platform Admin configures SMTP settings once

**Storage**: `platform_email_config` table (single row)

---

### **SMTP Configuration**

**Required Fields**:
- Host (e.g., smtp.gmail.com)
- Port (e.g., 587)
- Encryption (TLS or SSL)
- Username
- Password
- From Email (noreply@lead360.com)
- From Name (Lead360)

**Examples**:

**Gmail**:
- Host: smtp.gmail.com
- Port: 587
- Encryption: TLS
- Username: your-email@gmail.com
- Password: App-specific password (not Gmail password)

**Outlook/Office 365**:
- Host: smtp.office365.com
- Port: 587
- Encryption: TLS
- Username: your-email@outlook.com
- Password: Account password

**Custom SMTP**:
- Host: mail.yourdomain.com
- Port: 587 or 465
- Encryption: TLS or SSL
- Username: smtp-username
- Password: smtp-password

---

### **Business/Customer Emails** (Out of Scope for Sprint 0)

**NOT included in this module**:
- Quote emails to customers
- Invoice emails
- Payment reminders
- Project updates
- Customer communications

**These will be handled by**: Communication/Notification Module (Sprint 1+)

**Why separate**:
- Business emails need tenant-specific configuration
- Customers should see emails from tenant's domain (e.g., john@abcpainting.com)
- Need multiple provider support (not all tenants use same email provider)
- Need SMS/Twilio integration for comprehensive customer communication
- More complex requirements (templates, tracking, webhooks)

---

## Data Model

### **Tables Required**

1. **job** - Job queue records
2. **job_log** - Job execution history
3. **scheduled_job** - Cron-like scheduled jobs (configurable)
4. **platform_email_config** - SMTP settings for system emails (single row)
5. **email_template** - System email templates only
6. **email_queue** - Email delivery tracking

---

## Job Types

### **Scheduled Jobs** (Cron-like)

| Job Name | Purpose | Default Schedule | Configurable |
|----------|---------|------------------|--------------|
| ExpiryCheckJob | Check license/insurance expiry | Daily at 6:00 AM | Yes |
| DataCleanupJob | Purge old tokens, sessions | Daily at 2:00 AM | Yes |
| PartitionCreatorJob | Create monthly audit log partitions | Monthly on 1st at 00:00 | Yes |
| FileRetentionJob | Delete old files (soft deleted >90 days) | Daily at 3:00 AM | Yes |
| JobRetentionJob | Clean old job records (>30 days) | Daily at 4:00 AM | Yes |

**All schedules stored in database, configurable via admin panel**

---

### **Background Jobs** (Queue-based)

| Job Name | Purpose | Triggered By | Priority |
|----------|---------|--------------|----------|
| SendEmailJob | Send single email | Any module | High |
| BulkEmailJob | Send multiple emails | System | Normal |
| ReportGenerationJob | Generate large reports | User request | Normal |
| FileProcessingJob | Optimize images, generate thumbnails | File upload | High |
| ZipCreatorJob | Create ZIP for bulk download | User request | Normal |
| ExpiryAlertJob | Send expiry alert email | ExpiryCheckJob | High |

---

## Email Queue System

### **Email Templates**

**System Templates Only** (Platform Admin manages):

| Template | Purpose | Variables |
|----------|---------|-----------|
| activation-email | Account activation | {name}, {activation_link}, {subdomain} |
| password-reset | Password reset | {name}, {reset_link}, {expires_in} |
| password-changed | Password changed notification | {name}, {ip_address}, {timestamp} |
| expiry-alert-license | License expiring soon | {license_type}, {expires_at}, {days_left} |
| expiry-alert-insurance | Insurance expiring soon | {insurance_type}, {expires_at}, {days_left} |
| welcome-email | Welcome to Lead360 | {name}, {subdomain}, {login_link} |

**Business Templates** (Moved to Communication Module):
- Quote emails → Communication Module (Sprint 1+)
- Invoice emails → Communication Module (Sprint 1+)
- Payment reminders → Communication Module (Sprint 1+)
- Project updates → Communication Module (Sprint 1+)

---

### **Email Sending Flow** (System Emails Only)

**1. Queue Email**:
```
module calls EmailService.send({
  to: 'user@example.com',
  template: 'password-reset',
  context: { name: 'John', reset_link: '...' }
})
```

**2. Job Created**:
- Insert into job queue (BullMQ)
- Priority: High for all system emails

**3. Worker Processes**:
- Get platform SMTP config
- Render template with variables (Handlebars)
- Send via SMTP (Nodemailer)
- Update email_queue status (sent/failed)
- If failed: Retry with exponential backoff (3 attempts)

**4. Audit Log**:
- Log email sent
- Log email failed (with error)

---

## Job Monitoring Dashboard

### **Platform Admin Dashboard** (`/admin/jobs`)

**Key Metrics**:
- Active jobs (currently processing)
- Pending jobs (in queue)
- Completed jobs (last 24 hours)
- Failed jobs (last 24 hours)
- Queue health (Redis connection, worker status)

**Job List**:
- Filter by: Status, Job Type, Date Range, Tenant
- Sort by: Created At, Duration, Status
- Actions: View Details, Retry, Delete

**Failed Jobs Queue**:
- List all failed jobs
- Retry individual job
- Retry all failed jobs
- Clear failed queue

---

### **Scheduled Jobs Management** (`/admin/jobs/schedules`)

**Features**:
- List all scheduled jobs
- Enable/disable job
- Edit schedule (cron expression or UI picker)
- Manually trigger job (run now)
- View last 100 runs
- View next run time

**Schedule Configuration**:
- Job name
- Enabled (boolean)
- Schedule (cron expression)
- Timezone
- Max retries
- Timeout

---

## Email Settings

### **Platform SMTP Settings** (`/admin/jobs/email-settings`)

**Platform Admin Configures** (One-time setup):

**SMTP Configuration**:
- Host (smtp.gmail.com, smtp.office365.com, etc.)
- Port (587 for TLS, 465 for SSL)
- Encryption (TLS or SSL)
- Username (email address or SMTP username)
- Password (app-specific password or SMTP password)
- From Email (noreply@lead360.com)
- From Name (Lead360)

**Test Email**: Send test email to verify SMTP settings work

**Examples**:

**Gmail**:
```
Host: smtp.gmail.com
Port: 587
Encryption: TLS
Username: your-email@gmail.com
Password: [16-character app password from Google]
```

**Office 365**:
```
Host: smtp.office365.com
Port: 587
Encryption: TLS
Username: your-email@outlook.com
Password: [Your account password]
```

**Custom**:
```
Host: mail.yourdomain.com
Port: 587 or 465
Encryption: TLS or SSL
Username: smtp-user
Password: smtp-pass
```

---

### **Tenant Email Settings** (Moved to Communication Module)

**Not included in Sprint 0**:
- Tenant-specific email configuration
- Business email sending (quotes, invoices)
- Multiple provider support (AWS SES, SendGrid, Brevo)
- Domain verification
- Email signatures

**Will be available in**: Communication/Notification Module (Sprint 1+)

---

## API Specification

### **Endpoints Overview**

**Job Management** (Platform Admin):
- GET /admin/jobs
- GET /admin/jobs/:id
- POST /admin/jobs/:id/retry
- DELETE /admin/jobs/:id
- GET /admin/jobs/failed
- POST /admin/jobs/failed/retry-all
- DELETE /admin/jobs/failed/clear

**Scheduled Jobs** (Platform Admin):
- GET /admin/jobs/schedules
- GET /admin/jobs/schedules/:id
- POST /admin/jobs/schedules
- PATCH /admin/jobs/schedules/:id
- DELETE /admin/jobs/schedules/:id
- POST /admin/jobs/schedules/:id/trigger
- GET /admin/jobs/schedules/:id/history

**Email Settings - Platform SMTP** (Platform Admin):
- GET /admin/jobs/email-settings
- PATCH /admin/jobs/email-settings
- POST /admin/jobs/email-settings/test

**Queue Health** (Platform Admin):
- GET /admin/jobs/health

**Email Queue** (Platform Admin):
- GET /admin/jobs/emails
- GET /admin/jobs/emails/:id
- POST /admin/jobs/emails/:id/retry

---

### **Endpoint Details**

#### **1. List Jobs**

**GET** `/admin/jobs`

**Purpose**: Get paginated list of jobs with filters

**Query Parameters**:
- page (integer, default: 1)
- limit (integer, default: 50, max: 200)
- status (pending, active, completed, failed)
- job_type (string - filter by job name)
- tenant_id (UUID - filter by tenant)
- start_date (ISO datetime)
- end_date (ISO datetime)

**Success Response (200)**:
```json
{
  "jobs": [
    {
      "id": "uuid",
      "job_type": "SendEmailJob",
      "status": "completed",
      "tenant_id": "uuid",
      "tenant_name": "ABC Painting",
      "created_at": "2025-01-05T10:30:00Z",
      "started_at": "2025-01-05T10:30:01Z",
      "completed_at": "2025-01-05T10:30:03Z",
      "duration_ms": 2000,
      "attempts": 1,
      "max_attempts": 3,
      "error_message": null
    },
    // ... more jobs
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 20,
    "total_count": 987,
    "limit": 50
  }
}
```

---

#### **2. Get Job Details**

**GET** `/admin/jobs/:id`

**Purpose**: Get full details of specific job including logs

**Success Response (200)**:
```json
{
  "id": "uuid",
  "job_type": "SendEmailJob",
  "status": "completed",
  "tenant_id": "uuid",
  "tenant_name": "ABC Painting",
  "payload": {
    "to": "customer@example.com",
    "template": "quote-email",
    "variables": { "quote_number": "123" }
  },
  "result": {
    "message_id": "ses-message-id-123",
    "sent_at": "2025-01-05T10:30:03Z"
  },
  "created_at": "2025-01-05T10:30:00Z",
  "started_at": "2025-01-05T10:30:01Z",
  "completed_at": "2025-01-05T10:30:03Z",
  "duration_ms": 2000,
  "attempts": 1,
  "max_attempts": 3,
  "logs": [
    {
      "timestamp": "2025-01-05T10:30:01Z",
      "level": "info",
      "message": "Rendering email template"
    },
    {
      "timestamp": "2025-01-05T10:30:02Z",
      "level": "info",
      "message": "Sending via AWS SES"
    },
    {
      "timestamp": "2025-01-05T10:30:03Z",
      "level": "info",
      "message": "Email sent successfully"
    }
  ]
}
```

---

#### **3. Retry Failed Job**

**POST** `/admin/jobs/:id/retry`

**Purpose**: Manually retry failed job

**Success Response (200)**:
```json
{
  "message": "Job queued for retry",
  "new_job_id": "uuid"
}
```

---

#### **4. List Scheduled Jobs**

**GET** `/admin/jobs/schedules`

**Purpose**: Get all scheduled jobs

**Success Response (200)**:
```json
{
  "schedules": [
    {
      "id": "uuid",
      "job_type": "ExpiryCheckJob",
      "name": "License & Insurance Expiry Check",
      "description": "Check for expiring licenses and insurance daily",
      "schedule": "0 6 * * *",
      "schedule_readable": "Daily at 6:00 AM",
      "timezone": "America/New_York",
      "is_enabled": true,
      "last_run_at": "2025-01-05T06:00:00Z",
      "last_run_status": "completed",
      "next_run_at": "2025-01-06T06:00:00Z",
      "created_at": "2025-01-01T00:00:00Z"
    },
    // ... more schedules
  ]
}
```

---

#### **5. Update Scheduled Job**

**PATCH** `/admin/jobs/schedules/:id`

**Purpose**: Update schedule configuration

**Request Body**:
```json
{
  "schedule": "0 8 * * *",
  "is_enabled": true,
  "timezone": "America/Los_Angeles"
}
```

**Success Response (200)**:
```json
{
  "id": "uuid",
  "job_type": "ExpiryCheckJob",
  "schedule": "0 8 * * *",
  "schedule_readable": "Daily at 8:00 AM",
  "timezone": "America/Los_Angeles",
  "is_enabled": true,
  "next_run_at": "2025-01-06T08:00:00Z"
}
```

---

#### **6. Trigger Scheduled Job Manually**

**POST** `/admin/jobs/schedules/:id/trigger`

**Purpose**: Run scheduled job immediately (doesn't affect next scheduled run)

**Success Response (202)**:
```json
{
  "message": "Job triggered successfully",
  "job_id": "uuid"
}
```

---

#### **7. Get Platform Email Settings**

**GET** `/admin/jobs/email-settings`

**Purpose**: Get current platform SMTP configuration

**Success Response (200)**:
```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_encryption": "tls",
  "smtp_username": "noreply@lead360.com",
  "smtp_password": "****************", // masked
  "from_email": "noreply@lead360.com",
  "from_name": "Lead360",
  "updated_at": "2025-01-01T00:00:00Z"
}
```

---

#### **8. Update Platform Email Settings**

**PATCH** `/admin/jobs/email-settings`

**Purpose**: Update platform SMTP configuration

**Request Body**:
```json
{
  "smtp_host": "smtp.gmail.com",
  "smtp_port": 587,
  "smtp_encryption": "tls",
  "smtp_username": "noreply@lead360.com",
  "smtp_password": "app-specific-password",
  "from_email": "noreply@lead360.com",
  "from_name": "Lead360"
}
```

**Success Response (200)**:
```json
{
  "message": "SMTP settings updated successfully"
}
```

---

#### **9. Test Platform Email**

**POST** `/admin/jobs/email-settings/test`

**Purpose**: Send test email to verify SMTP configuration

**Request Body**:
```json
{
  "to_email": "admin@example.com"
}
```

**Success Response (200)**:
```json
{
  "message": "Test email sent successfully",
  "email_id": "uuid"
}
```

---

#### **10. Get Queue Health**

**GET** `/admin/jobs/health`

**Purpose**: Get job queue health metrics

**Success Response (200)**:
```json
{
  "queue_status": "healthy",
  "redis_connected": true,
  "workers_active": 5,
  "jobs": {
    "active": 12,
    "pending": 45,
    "completed_24h": 1234,
    "failed_24h": 3
  },
  "oldest_pending_job": {
    "id": "uuid",
    "created_at": "2025-01-05T10:00:00Z",
    "age_seconds": 1800
  },
  "last_processed_job": {
    "id": "uuid",
    "completed_at": "2025-01-05T10:30:00Z"
  }
}
```

---

## Job Retention Policy

**Automatic Cleanup**:
- Successful jobs: Deleted after 30 days
- Failed jobs: Deleted after 30 days
- Scheduled job logs: Keep last 100 runs per job type (delete older)

**JobRetentionJob** (Scheduled daily at 4:00 AM):
1. Find jobs created >30 days ago
2. Delete from job table
3. Audit log: "Job records cleaned up (X records deleted)"

---

## Migration Requirements

**CRITICAL**: Backend developer MUST audit entire codebase and migrate ALL cron jobs to this unified system.

**Existing Jobs to Migrate**:

1. **Audit Log Module**:
   - PartitionCreatorJob (create monthly partitions)
   - RetentionEnforcerJob (archive old logs) - REMOVE, use database partition drop instead

2. **File Storage Module**:
   - FileRetentionJob (hard delete files after 90 days)
   - ZipCleanupJob (delete temporary ZIPs after 24 hours)

3. **Tenant Module**:
   - ExpiryCheckJob (check license/insurance expiry)
   - Send expiry alert emails (new)

4. **Authentication Module**:
   - Email activation (move to email queue)
   - Password reset emails (move to email queue)
   - Session cleanup (add new scheduled job)

**Migration Checklist**:
- [ ] Remove all `@Cron()` decorators from existing code
- [ ] Create scheduled job records in database
- [ ] Move cron logic to job handler classes
- [ ] Test all migrated jobs
- [ ] Update documentation

---

## Business Rules

### **Job Execution**

1. **Retry Logic**: Failed jobs automatically retry 3 times with exponential backoff (1s, 5s, 25s)
2. **Timeout**: Jobs timeout after 5 minutes (configurable per job type)
3. **Concurrency**: Max 10 concurrent workers (configurable)
4. **Priority**: High priority jobs processed first
5. **Dead Letter Queue**: After 3 failed attempts, move to failed queue

### **Email Sending**

1. **Rate Limiting**: Max 50 emails per second (configurable)
2. **Batch Size**: Bulk emails sent in batches of 100
3. **Bounce Handling**: Track bounced emails (future phase)
4. **Unsubscribe**: Include unsubscribe link in business emails (future phase)

### **Schedule Management**

1. **Timezone**: All schedules in tenant's timezone (configurable)
2. **Missed Jobs**: If job missed (server down), run once when server back up
3. **Overlapping**: Don't run same job type concurrently (wait for previous to complete)

---

## Testing Requirements

### **Backend Tests**

**Unit Tests**:
- ✅ Queue job
- ✅ Process job
- ✅ Retry failed job
- ✅ Send email via AWS SES
- ✅ Send email via SendGrid
- ✅ Send email via Brevo
- ✅ Send email via SMTP
- ✅ Render email template
- ✅ Schedule job (cron)
- ✅ Trigger scheduled job
- ✅ Get platform email config
- ✅ Get tenant email config
- ✅ Job retention cleanup

**Integration Tests**:
- ✅ Queue email → Worker sends → Status updated
- ✅ Scheduled job runs at correct time
- ✅ Failed job retries 3 times
- ✅ Platform email uses platform config
- ✅ Business email uses tenant config
- ✅ Job retention deletes old jobs
- ✅ Audit log created for all jobs

---

### **Frontend Tests**

**Component Tests**:
- ✅ Job list table
- ✅ Job detail modal
- ✅ Email settings form
- ✅ Schedule editor

**Integration Tests**:
- ✅ Platform Admin views jobs
- ✅ Platform Admin retries failed job
- ✅ Platform Admin updates email settings
- ✅ Platform Admin triggers scheduled job
- ✅ Tenant Owner updates email settings
- ✅ Tenant Owner tests email

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend**
- [ ] BullMQ queue configured
- [ ] All job tables created
- [ ] Platform email config (4 providers)
- [ ] Tenant email config (4 providers)
- [ ] Email service (send via all 4 providers)
- [ ] Email templates (system + business)
- [ ] Scheduled jobs (configurable, not hardcoded)
- [ ] Job monitoring APIs (all endpoints)
- [ ] Email settings APIs (platform + tenant)
- [ ] Job retention cleanup
- [ ] All existing cron jobs migrated
- [ ] Audit logging (all jobs)
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation complete

### **Frontend**
- [ ] Job monitoring dashboard (Platform Admin)
- [ ] Scheduled jobs management (Platform Admin)
- [ ] Platform email settings page
- [ ] Tenant email settings page
- [ ] Job detail modal
- [ ] Failed jobs retry UI
- [ ] Queue health monitoring
- [ ] Component tests >70% coverage
- [ ] E2E tests passing

### **Integration**
- [ ] All existing jobs migrated and working
- [ ] Platform emails sending correctly
- [ ] Tenant emails sending correctly
- [ ] Scheduled jobs running on schedule
- [ ] Failed jobs retrying automatically
- [ ] Job retention cleanup working

---

## Timeline Estimate

**Backend Development**: 3-4 days
- BullMQ setup (Redis, workers): 1 day
- SMTP email service (Nodemailer, templates): 1 day
- Scheduled jobs (configurable): 0.5 day
- API endpoints (15 endpoints): 1 day
- Migration of existing jobs: 0.5 day
- Testing: 0.5 day

**Frontend Development**: 2-2.5 days
- Job monitoring dashboard: 1 day
- SMTP settings page (simple form): 0.5 day
- Scheduled jobs management: 0.5 day
- Testing: 0.5 day

**Integration & Testing**: 0.5 day

**Total**: 5.5-7 days (simplified from 6.5-8.5 days)

---

## Notes

- **Sprint 0 Scope**: Basic background jobs + system emails only
- **SMTP only**: Simpler setup, one provider for now
- **System emails only**: Password reset, activation, alerts
- **Business emails deferred**: Quotes, invoices → Communication Module (Sprint 1+)
- **All schedules configurable**: No hardcoded cron
- **Migration required**: Audit and migrate all existing cron jobs
- **Redis required**: BullMQ dependency
- **Audit everything**: All job executions logged
- **Communication Module planned**: Will handle business emails, SMS, Twilio, webhooks (requires separate brainstorming session)

---

**End of Background Jobs Contract**

This contract must be approved before development begins.