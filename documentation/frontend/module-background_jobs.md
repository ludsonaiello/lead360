# Frontend Module: Background Jobs

**Module Name**: Background Jobs & Email Queue System  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/background-jobs-contract.md`  
**Backend Module**: `/documentation/backend/module-background-jobs.md`  
**Agent**: Frontend Specialist  
**Status**: Ready for Development (AFTER backend complete)

---

## Overview

This module implements job monitoring dashboards, scheduled job management, and platform SMTP configuration UI. You will build admin tools for managing background jobs and system email settings.

**Sprint 0 Scope**:
- Job monitoring (all jobs across all tenants)
- Scheduled jobs management (configurable cron)
- Platform SMTP settings (simple form)

**Deferred to Communication Module** (Sprint 1+):
- Multiple email provider UI
- Tenant email configuration
- Email templates management
- SMS/Twilio configuration

**CRITICAL**: Do NOT start until backend Background Jobs module is 100% complete and API documentation is available.

**Read First**:
- `/documentation/contracts/background-jobs-contract.md` (job queue requirements)
- `/documentation/backend/module-background-jobs.md` (API endpoints)
- Backend API documentation (Swagger)

---

## Technology Stack

**Required Libraries**:
- react-hook-form + zod (forms)
- date-fns or dayjs (date handling)
- react-datepicker (date range picker)
- @headlessui/react (modals, dropdowns)
- lucide-react (icons)
- recharts (queue health charts)
- cron-parser (parse cron expressions for display)

---

## Project Structure

```
app/
├── (admin)/
│   ├── jobs/
│   │   ├── page.tsx (job monitoring dashboard)
│   │   ├── [id]/
│   │   │   └── page.tsx (job details)
│   │   ├── schedules/
│   │   │   └── page.tsx (scheduled jobs management)
│   │   ├── email-settings/
│   │   │   └── page.tsx (platform SMTP settings - simple form)
│   │   └── failed/
│   │       └── page.tsx (failed jobs queue)
│   └── layout.tsx
├── components/
│   ├── jobs/
│   │   ├── JobList.tsx
│   │   ├── JobFilters.tsx
│   │   ├── JobDetailModal.tsx
│   │   ├── JobStatusBadge.tsx
│   │   ├── QueueHealthCard.tsx
│   │   ├── ScheduledJobCard.tsx
│   │   ├── ScheduleEditor.tsx
│   │   ├── SmtpSettingsForm.tsx (simplified - SMTP only)
│   │   ├── TestEmailModal.tsx
│   │   ├── RetryJobConfirmation.tsx
│   │   └── EmptyJobState.tsx
│   └── ui/
├── lib/
│   ├── api/
│   │   ├── jobs.ts
│   │   ├── scheduled-jobs.ts
│   │   └── email-settings.ts (platform SMTP only)
│   ├── hooks/
│   │   ├── useJobs.ts
│   │   ├── useScheduledJobs.ts
│   │   └── useEmailSettings.ts (platform only)
│   ├── utils/
│   │   ├── cron-helpers.ts (cron to readable)
│   │   └── job-helpers.ts (format status, duration, etc.)
│   └── types/
│       └── jobs.ts
```

---

## TypeScript Interfaces

**Location**: `lib/types/jobs.ts`

Define interfaces for:
- Job (job record)
- ScheduledJob (scheduled job)
- EmailSettings (platform/tenant config)
- QueueHealth (metrics)
- JobFilters (filter parameters)

Developer will create based on API documentation.

---

## API Clients

### **Jobs API**

**Location**: `lib/api/jobs.ts`

**Methods**:
1. **getJobs(filters, pagination)** - GET /admin/jobs
2. **getJob(id)** - GET /admin/jobs/:id
3. **retryJob(id)** - POST /admin/jobs/:id/retry
4. **deleteJob(id)** - DELETE /admin/jobs/:id
5. **getFailedJobs()** - GET /admin/jobs/failed
6. **retryAllFailed()** - POST /admin/jobs/failed/retry-all
7. **clearFailed()** - DELETE /admin/jobs/failed/clear
8. **getQueueHealth()** - GET /admin/jobs/health

---

### **Scheduled Jobs API**

**Location**: `lib/api/scheduled-jobs.ts`

**Methods**:
1. **getSchedules()** - GET /admin/jobs/schedules
2. **getSchedule(id)** - GET /admin/jobs/schedules/:id
3. **createSchedule(data)** - POST /admin/jobs/schedules
4. **updateSchedule(id, data)** - PATCH /admin/jobs/schedules/:id
5. **deleteSchedule(id)** - DELETE /admin/jobs/schedules/:id
6. **triggerSchedule(id)** - POST /admin/jobs/schedules/:id/trigger
7. **getScheduleHistory(id)** - GET /admin/jobs/schedules/:id/history

---

### **Email Settings API**

**Location**: `lib/api/email-settings.ts`

**Methods**:
1. **getPlatformEmailSettings()** - GET /admin/jobs/email-settings
2. **updatePlatformEmailSettings(data)** - PATCH /admin/jobs/email-settings
3. **testPlatformEmail(toEmail)** - POST /admin/jobs/email-settings/test
4. **getTenantEmailSettings()** - GET /settings/email
5. **updateTenantEmailSettings(data)** - PATCH /settings/email
6. **testTenantEmail(toEmail)** - POST /settings/email/test
7. **getVerificationStatus()** - GET /settings/email/verification-status

---

## Custom Hooks

### **useJobs()**

**Location**: `lib/hooks/useJobs.ts`

**Purpose**: Manage job list with filters and polling

**Usage**:
```typescript
const {
  jobs,
  pagination,
  filters,
  isLoading,
  error,
  setFilters,
  nextPage,
  previousPage,
  refresh
} = useJobs({ autoRefresh: true, refreshInterval: 5000 });
```

**Returns**:
- jobs (Job[])
- pagination (current page, total pages)
- filters (current filter state)
- isLoading (boolean)
- error (Error or null)
- setFilters (function)
- nextPage, previousPage (pagination)
- refresh (manual refresh)

**Implementation Logic**:
- Fetch jobs from API with filters
- Auto-refresh every 5 seconds (optional)
- Update URL query params

---

### **useScheduledJobs()**

**Location**: `lib/hooks/useScheduledJobs.ts`

**Purpose**: Manage scheduled jobs

**Usage**:
```typescript
const {
  schedules,
  isLoading,
  error,
  triggerJob,
  enableJob,
  disableJob,
  updateSchedule,
  refresh
} = useScheduledJobs();
```

---

### **useEmailSettings()**

**Location**: `lib/hooks/useEmailSettings.ts`

**Purpose**: Manage email settings (platform or tenant)

**Usage**:
```typescript
const {
  settings,
  isLoading,
  error,
  updateSettings,
  testEmail,
  isTesting
} = useEmailSettings('platform'); // or 'tenant'
```

---

## Main Components

### **JobList Component**

**Location**: `components/jobs/JobList.tsx`

**Purpose**: Display jobs in table format

**Props**:
- jobs (Job[])
- isLoading (boolean)
- onRowClick (function - opens detail modal)

**Layout**:
```
┌──────────────────────────────────────────────────────────────┐
│ Job Type     │ Status  │ Started    │ Duration │ Actions    │
├──────────────┼─────────┼────────────┼──────────┼────────────┤
│ SendEmailJob │ ✓ Done  │ 10:30 AM   │ 2.3s     │ [View]     │
│ ExpiryCheck  │ ✓ Done  │ 6:00 AM    │ 45.2s    │ [View]     │
│ SendEmailJob │ ✗ Failed│ 5:45 AM    │ 10.1s    │ [Retry]    │
└──────────────┴─────────┴────────────┴──────────┴────────────┘
```

**Columns**:
1. **Job Type**: Formatted name (SendEmailJob → "Send Email")
2. **Status**: Badge with icon (✓ Completed, ⏳ Active, ✗ Failed, ⏸ Pending)
3. **Tenant**: Tenant name (if applicable)
4. **Started**: Relative time ("2 hours ago")
5. **Duration**: Execution time (2.3s, 1.2m)
6. **Actions**: View details, Retry (if failed)

**Features**:
- Click row → Open detail modal
- Sortable columns
- Loading: Skeleton rows
- Empty: "No jobs found"

---

### **JobFilters Component**

**Location**: `components/jobs/JobFilters.tsx`

**Purpose**: Filter controls for job list

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ [Status ▾] [Job Type ▾] [Tenant ▾] [Date Range]   [Reset]  │
└─────────────────────────────────────────────────────────────┘
```

**Filters**:
1. **Status Dropdown**: All, Pending, Active, Completed, Failed
2. **Job Type Dropdown**: All, SendEmailJob, ExpiryCheckJob, etc.
3. **Tenant Dropdown**: All, [Searchable tenant list]
4. **Date Range Picker**: All Time, Today, Last 7 Days, Last 30 Days, Custom
5. **Reset Button**: Clear all filters

---

### **JobDetailModal Component**

**Location**: `components/jobs/JobDetailModal.tsx`

**Purpose**: Show full job details including logs

**Props**:
- isOpen (boolean)
- onClose (function)
- jobId (string)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ [Close X]                                                    │
│                                                              │
│ Job: Send Email                                             │
│ Status: ✓ Completed                                         │
│ Tenant: ABC Painting                                        │
│                                                              │
│ Created: Jan 5, 2025 at 10:30:00 AM                        │
│ Started: Jan 5, 2025 at 10:30:01 AM                        │
│ Completed: Jan 5, 2025 at 10:30:03 AM                      │
│ Duration: 2.3 seconds                                       │
│ Attempts: 1 / 3                                             │
│                                                              │
│ [Tabs: Details | Logs | Payload | Result]                  │
│                                                              │
│ [Tab: Logs]                                                 │
│ ┌───────────────────────────────────────────────────────┐  │
│ │ 10:30:01 [INFO] Rendering email template             │  │
│ │ 10:30:02 [INFO] Sending via AWS SES                   │  │
│ │ 10:30:03 [INFO] Email sent successfully               │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                              │
│ [Retry] [Delete]                                            │
└─────────────────────────────────────────────────────────────┘
```

**Tabs**:
1. **Details**: Job metadata (status, timestamps, duration, attempts)
2. **Logs**: Execution logs (timestamped, level-colored)
3. **Payload**: Job input (formatted JSON)
4. **Result**: Job output (formatted JSON)

**Actions** (if failed):
- Retry: Retry failed job
- Delete: Remove job record

---

### **QueueHealthCard Component**

**Location**: `components/jobs/QueueHealthCard.tsx`

**Purpose**: Display queue health metrics

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Queue Health                                                 │
│                                                              │
│ ● Redis: Connected                                          │
│ ● Workers: 5 active                                         │
│                                                              │
│ Jobs:                                                        │
│ ● Active: 12                                                │
│ ● Pending: 45                                               │
│ ● Completed (24h): 1,234                                    │
│ ● Failed (24h): 3                                           │
│                                                              │
│ Oldest Pending: 30 minutes ago                              │
│ Last Processed: 2 seconds ago                               │
│                                                              │
│ [View Failed Jobs]                                          │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Auto-refresh every 5 seconds
- Color-coded status (green=healthy, yellow=warning, red=unhealthy)
- Chart: Jobs over time (recharts line chart)

---

### **ScheduledJobCard Component**

**Location**: `components/jobs/ScheduledJobCard.tsx`

**Purpose**: Display single scheduled job

**Props**:
- schedule (ScheduledJob)
- onEdit (function)
- onTrigger (function)
- onToggle (function - enable/disable)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ ✅ License & Insurance Expiry Check                         │
│                                                              │
│ Schedule: Daily at 6:00 AM (America/New_York)              │
│ Next run: Tomorrow at 6:00 AM                               │
│                                                              │
│ Last run: Today at 6:00 AM                                  │
│ Status: ✓ Completed (45.2s)                                 │
│                                                              │
│ [Edit Schedule] [Run Now] [Disable] [View History]         │
└─────────────────────────────────────────────────────────────┘
```

**States**:
- Enabled (green border, checkmark)
- Disabled (gray, no checkmark)

**Actions**:
- Edit Schedule: Open ScheduleEditor modal
- Run Now: Trigger job immediately
- Enable/Disable: Toggle is_enabled
- View History: Show last 100 runs

---

### **ScheduleEditor Component**

**Location**: `components/jobs/ScheduleEditor.tsx`

**Purpose**: Edit scheduled job configuration

**Props**:
- schedule (ScheduledJob)
- onSave (function)
- onCancel (function)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Edit Schedule: Expiry Check Job                             │
│                                                              │
│ Schedule:                                                    │
│ ○ Daily at [06:00 ▾]                                        │
│ ○ Weekly on [Monday ▾] at [06:00 ▾]                        │
│ ○ Monthly on [1st ▾] at [06:00 ▾]                          │
│ ○ Custom: [0 6 * * *       ] (cron expression)             │
│                                                              │
│ Timezone: [America/New_York ▾]                              │
│                                                              │
│ Advanced:                                                    │
│ Max Retries: [3      ]                                      │
│ Timeout (seconds): [300   ]                                 │
│                                                              │
│ [Cancel] [Save]                                             │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Visual schedule picker (easy mode)
- Cron expression input (advanced mode)
- Live preview: "Runs daily at 6:00 AM"
- Timezone selector (all timezones)
- Validation: Invalid cron expression error

---

### **SmtpSettingsForm Component**

**Location**: `components/jobs/SmtpSettingsForm.tsx`

**Purpose**: Configure platform SMTP settings

**Props**:
- settings (SmtpSettings)
- onSave (function)

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Platform Email Settings (SMTP)                               │
│                                                              │
│ SMTP Host:                                                   │
│ [smtp.gmail.com      ]                                      │
│                                                              │
│ Port:                                                        │
│ [587                 ]                                      │
│                                                              │
│ Encryption:                                                  │
│ ● TLS  ○ SSL                                                │
│                                                              │
│ Username:                                                    │
│ [noreply@lead360.com ]                                      │
│                                                              │
│ Password:                                                    │
│ [********************] [👁 Show]                            │
│                                                              │
│ From Email:                                                  │
│ [noreply@lead360.com ]                                      │
│                                                              │
│ From Name:                                                   │
│ [Lead360             ]                                      │
│                                                              │
│ [Test Email] [Save Settings]                                │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Simple SMTP form (no provider selection)
- Password field (show/hide toggle)
- Test email button (opens TestEmailModal)
- Save button (validates + submits)
- Help text with Gmail/Outlook examples

---

### **TestEmailModal Component**

**Location**: `components/jobs/TestEmailModal.tsx`

**Purpose**: Send test email to verify settings

**Props**:
- isOpen (boolean)
- onClose (function)
- onSend (function)
- type ('platform' | 'tenant')

**Layout**:
```
┌─────────────────────────────────────────────────────────────┐
│ Send Test Email                                              │
│                                                              │
│ To Email:                                                    │
│ [admin@example.com       ]                                  │
│                                                              │
│ This will send a test email using your current settings.    │
│                                                              │
│ [Cancel] [Send Test Email]                                  │
│                                                              │
│ [If sent:]                                                   │
│ ✓ Test email sent successfully!                            │
│ Check your inbox at admin@example.com                       │
└─────────────────────────────────────────────────────────────┘
```

**Flow**:
1. User enters email address
2. Click "Send Test Email"
3. API call to test endpoint
4. Show success or error message
5. If success: "Check your inbox"
6. If error: Show error details

---

## Pages

### **Job Monitoring Dashboard**

**Route**: `/admin/jobs`

**Access**: Platform Admin only

**Purpose**: Monitor all background jobs

**Layout**:
```
[Header: "Background Jobs"]

[QueueHealthCard]

[JobFilters]

[JobList]

[Pagination]

[If failed jobs exist:]
[Alert: "3 failed jobs in queue" [View Failed Jobs]]
```

**Features**:
- Auto-refresh every 5 seconds
- Filter jobs by status, type, tenant, date
- View job details (modal)
- Retry failed jobs
- Queue health monitoring

---

### **Failed Jobs Queue**

**Route**: `/admin/jobs/failed`

**Access**: Platform Admin only

**Purpose**: Manage failed jobs

**Layout**:
```
[Header: "Failed Jobs"]
[Subtitle: "Jobs that failed after 3 retry attempts"]

[Actions: [Retry All] [Clear Queue]]

[JobList - filtered to failed only]
```

**Features**:
- List all failed jobs
- Retry individual job
- Retry all failed jobs
- Clear failed queue (delete all)

---

### **Scheduled Jobs Management**

**Route**: `/admin/jobs/schedules`

**Access**: Platform Admin only

**Purpose**: Manage scheduled jobs

**Layout**:
```
[Header: "Scheduled Jobs"]

┌─────────────────────────────────────────────────────────────┐
│ [ScheduledJobCard - Expiry Check Job]                       │
│ [ScheduledJobCard - Data Cleanup Job]                       │
│ [ScheduledJobCard - Partition Creator]                      │
│ [ScheduledJobCard - File Retention]                         │
│ [ScheduledJobCard - Job Retention]                          │
└─────────────────────────────────────────────────────────────┘

[+ Add Scheduled Job]
```

**Features**:
- List all scheduled jobs
- Edit schedule (ScheduleEditor modal)
- Enable/disable job (toggle)
- Trigger job manually (Run Now)
- View job history (last 100 runs)

---

### **Job History Page** (for scheduled job)

**Route**: `/admin/jobs/schedules/:id/history`

**Access**: Platform Admin only

**Purpose**: View execution history for scheduled job

**Layout**:
```
[Header: "History: Expiry Check Job"]

[Chart: Success/Fail over time]

[Table: Last 100 runs]
┌──────────────┬─────────┬──────────┬─────────────┐
│ Run Time     │ Status  │ Duration │ Actions     │
├──────────────┼─────────┼──────────┼─────────────┤
│ Today 6:00am │ ✓ Done  │ 45.2s    │ [View Logs] │
│ Jan 5 6:00am │ ✓ Done  │ 43.1s    │ [View Logs] │
│ Jan 4 6:00am │ ✗ Failed│ 10.5s    │ [View Logs] │
└──────────────┴─────────┴──────────┴─────────────┘
```

---

### **Platform SMTP Settings**

**Route**: `/admin/jobs/email-settings`

**Access**: Platform Admin only

**Purpose**: Configure platform SMTP for system emails

**Layout**:
```
[Header: "Platform Email Settings"]
[Subtitle: "Configure SMTP for system emails (password resets, activations, alerts)"]

[SmtpSettingsForm]

[Help Section]
┌─────────────────────────────────────────────────────────────┐
│ Common SMTP Settings:                                        │
│                                                              │
│ Gmail:                                                       │
│ - Host: smtp.gmail.com                                      │
│ - Port: 587 (TLS)                                           │
│ - Password: Use app-specific password (not Gmail password) │
│                                                              │
│ Office 365:                                                  │
│ - Host: smtp.office365.com                                  │
│ - Port: 587 (TLS)                                           │
│ - Password: Account password                                │
└─────────────────────────────────────────────────────────────┘
```

**Features**:
- Simple SMTP configuration form
- Test email (send to admin)
- Save settings
- Help text with examples

---

## Utility Functions

### **Cron Helpers**

**Location**: `lib/utils/cron-helpers.ts`

**Functions**:

1. **cronToReadable(cron: string): string**
   - Converts cron expression to human-readable
   - Example: "0 6 * * *" → "Daily at 6:00 AM"
   - Example: "0 0 1 * *" → "Monthly on the 1st at 00:00"

2. **calculateNextRun(cron: string, timezone: string): Date**
   - Calculate next execution time
   - Uses cron-parser library

---

### **Job Helpers**

**Location**: `lib/utils/job-helpers.ts`

**Functions**:

1. **formatDuration(ms: number): string**
   - 2300 → "2.3s"
   - 65000 → "1.1m"
   - 3600000 → "1.0h"

2. **formatJobType(jobType: string): string**
   - "SendEmailJob" → "Send Email"
   - "ExpiryCheckJob" → "Expiry Check"

3. **getStatusColor(status: string): string**
   - pending → "yellow"
   - active → "blue"
   - completed → "green"
   - failed → "red"

---

## Error Handling

**Common Errors**:

1. **403 Forbidden** (non-admin accessing jobs dashboard):
   - Redirect to 403 page

2. **Test email failed**:
   - Show error modal with provider error message
   - Suggest checking credentials

3. **Retry job failed**:
   - Show error toast
   - Suggest checking job details for error

4. **Save email settings failed**:
   - Show validation errors
   - Highlight invalid fields

---

## Testing Requirements

### **Component Tests** (>70% coverage)

1. **JobList**
   - ✅ Renders jobs
   - ✅ Shows loading skeleton
   - ✅ Shows empty state
   - ✅ Clicking row opens modal

2. **JobFilters**
   - ✅ All filters render
   - ✅ Changing filters updates list
   - ✅ Reset clears filters

3. **QueueHealthCard**
   - ✅ Displays metrics
   - ✅ Auto-refreshes
   - ✅ Shows health status

4. **ScheduledJobCard**
   - ✅ Displays schedule
   - ✅ Trigger job works
   - ✅ Enable/disable toggle works

5. **EmailSettingsForm**
   - ✅ Provider selection works
   - ✅ Dynamic fields render
   - ✅ Validation works
   - ✅ Test email works

---

### **Integration Tests (E2E)**

1. **View Jobs**
   - ✅ Platform Admin navigates to /admin/jobs
   - ✅ Jobs load and display
   - ✅ Can filter jobs
   - ✅ Can click job to see details

2. **Retry Failed Job**
   - ✅ Navigate to failed jobs
   - ✅ Click retry on job
   - ✅ Job queued for retry
   - ✅ Success toast shown

3. **Manage Scheduled Job**
   - ✅ Navigate to schedules
   - ✅ Edit schedule
   - ✅ Save new schedule
   - ✅ Next run time updated

4. **Configure Email Settings**
   - ✅ Navigate to email settings
   - ✅ Select provider
   - ✅ Enter credentials
   - ✅ Test email
   - ✅ Email received
   - ✅ Save settings

5. **Trigger Manual Job**
   - ✅ Navigate to schedules
   - ✅ Click "Run Now"
   - ✅ Job queued
   - ✅ Job appears in job list

---

## Completion Checklist

- [ ] All TypeScript interfaces defined
- [ ] All API clients implemented (jobs, scheduled-jobs, email-settings)
- [ ] useJobs hook
- [ ] useScheduledJobs hook
- [ ] useEmailSettings hook (platform SMTP only)
- [ ] JobList component
- [ ] JobFilters component
- [ ] JobDetailModal component
- [ ] QueueHealthCard component
- [ ] ScheduledJobCard component
- [ ] ScheduleEditor component
- [ ] SmtpSettingsForm component (simplified)
- [ ] TestEmailModal component
- [ ] Job monitoring dashboard page
- [ ] Failed jobs page
- [ ] Scheduled jobs page
- [ ] Job history page
- [ ] Platform SMTP settings page (simple form)
- [ ] Cron helpers
- [ ] Job helpers
- [ ] Loading states
- [ ] Empty states
- [ ] Error handling
- [ ] Component tests >70% coverage
- [ ] E2E tests passing
- [ ] No TypeScript errors
- [ ] No console errors

---

## Modern UI/UX Checklist

- [ ] Auto-refresh (jobs update every 5 seconds)
- [ ] Loading skeletons (not just spinners)
- [ ] Real-time queue health (live metrics)
- [ ] Visual schedule picker (easy mode + cron mode)
- [ ] Password show/hide toggle
- [ ] Test email confirmation (success toast)
- [ ] Job status badges (color-coded)
- [ ] Duration formatting (2.3s, 1.2m)
- [ ] Relative timestamps ("2 hours ago")
- [ ] Smooth transitions
- [ ] Success toasts (retry, save, test)
- [ ] Error modals (not alerts)
- [ ] Empty states with helpful messages
- [ ] Mobile responsive
- [ ] Keyboard accessible
- [ ] Aria labels

---

## Performance Considerations

**Auto-Refresh**:
- Only on job monitoring dashboard
- Pause when modal open (don't refresh behind modal)
- Stop when user navigates away

**Polling**:
- Jobs: Every 5 seconds
- Queue health: Every 5 seconds
- Scheduled jobs: No polling (static until user refresh)

**Optimization**:
- Don't refresh if no changes
- Use SWR or React Query for caching
- Debounce filter changes

---

## Accessibility Requirements

- [ ] All interactive elements keyboard accessible
- [ ] Screen reader announces job status changes
- [ ] Form labels associated with inputs
- [ ] Modal focus trap
- [ ] Color contrast meets WCAG AA
- [ ] Error messages announced
- [ ] Success toasts announced

---

## Common Pitfalls to Avoid

1. **Don't refresh too frequently** - 5 seconds is good balance
2. **Don't forget loading states** - Jobs can take time to load
3. **Don't skip empty states** - "No jobs" is common
4. **Don't hardcode providers** - Use enums from backend
5. **Don't forget password masking** - API keys should be hidden
6. **Don't skip test email** - Verify settings before save
7. **Don't forget timezone** - Display in user's timezone
8. **Don't forget error handling** - API calls can fail

---

**End of Frontend Module Documentation**

Background jobs UI is critical for monitoring and managing the system. Must be real-time, intuitive, and comprehensive.