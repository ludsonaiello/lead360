# Background Jobs Frontend Module - Development Handoff

**Module**: Background Jobs & Email Queue System
**Status**: Infrastructure Complete - UI Components Required
**Developer**: Next Frontend Developer
**Date**: January 2026

---

## Executive Summary

The **foundation** of the Background Jobs frontend module is **100% complete**:

✅ **TypeScript Types** - All interfaces matching backend API
✅ **API Client Functions** - All 24 endpoints implemented
✅ **Utility Helpers** - Cron and job formatting functions
✅ **Custom Hooks** - Data management hooks (useJobs, useScheduledJobs, useEmailSettings)

**What's Next**: Build UI components and pages using the established infrastructure.

---

## Completed Work

### 1. TypeScript Types (`/src/lib/types/jobs.ts`)

All types match the backend API exactly:

- **Job Types**: `Job`, `JobDetail`, `JobLog`, `EmailQueue`, `JobStatus`
- **Scheduled Job Types**: `ScheduledJob`, `ScheduledJobHistory`
- **Email Settings Types**: `EmailSettings`, `SmtpEncryption`
- **Email Template Types**: `EmailTemplate`, `CreateEmailTemplateDto`
- **Queue Health Types**: `QueueHealth`, `QueueMetrics`
- **API Response Types**: `JobListResponse`, `ApiError`

### 2. API Client (`/src/lib/api/jobs.ts`)

**24 API endpoints** implemented:

#### Job Management (8 endpoints)
- `getJobs(filters)` - List jobs with pagination
- `getJobDetail(id)` - Get job with logs
- `retryJob(id)` - Retry failed job
- `deleteJob(id)` - Delete job
- `getFailedJobs(filters)` - List failed jobs
- `retryAllFailedJobs()` - Retry all failed
- `clearAllFailedJobs()` - Clear all failed
- `getQueueHealth()` - Get queue metrics

#### Scheduled Jobs (7 endpoints)
- `getScheduledJobs(page, limit)` - List schedules
- `getScheduledJob(id)` - Get schedule details
- `createScheduledJob(data)` - Create schedule
- `updateScheduledJob(id, data)` - Update schedule
- `deleteScheduledJob(id)` - Delete schedule
- `triggerScheduledJob(id)` - Manual trigger
- `getScheduledJobHistory(id, limit)` - Get history

#### Email Settings (3 endpoints)
- `getEmailSettings()` - Get SMTP config
- `updateEmailSettings(data)` - Update SMTP
- `sendTestEmail(data)` - Test email

#### Email Templates (6 endpoints)
- `getEmailTemplates(params)` - List templates
- `getEmailTemplate(key)` - Get template
- `createEmailTemplate(data)` - Create template
- `updateEmailTemplate(key, data)` - Update template
- `deleteEmailTemplate(key)` - Delete template
- `previewEmailTemplate(key, data)` - Preview with variables

### 3. Utility Functions

**Cron Helpers** (`/src/lib/utils/cron-helpers.ts`):
- `cronToReadable(cron)` - Convert "0 6 * * *" to "Daily at 6:00 AM"
- `isValidCron(cron)` - Validate cron expression
- `getCronPresets()` - Get common presets

**Job Helpers** (`/src/lib/utils/job-helpers.ts`):
- `formatDuration(ms)` - Format milliseconds to "2.3s", "1.1m", etc.
- `formatJobType(type)` - Convert "send-email" to "Send Email"
- `getStatusColor(status)` - Get Tailwind color classes
- `getStatusIcon(status)` - Get status icons
- `getLogLevelColor(level)` - Get log level colors
- `formatRelativeTime(date)` - "2 hours ago"
- `formatAbsoluteTime(date)` - "Jan 5, 2026 at 10:30 AM"
- `getPriorityLabel(priority)` - Get priority label
- `getPriorityColor(priority)` - Get priority colors

### 4. Custom Hooks

**useJobs** (`/src/lib/hooks/useJobs.ts`):
- Manages job list with filters and pagination
- Auto-refresh support (5-second intervals)
- Filter management (status, job_type, tenant_id, dates)
- Pagination controls (nextPage, previousPage, goToPage)
- Manual refresh
- Failed-only mode

**useScheduledJobs** (`/src/lib/hooks/useScheduledJobs.ts`):
- Manages scheduled jobs CRUD
- Enable/disable jobs
- Trigger jobs manually
- Update schedules
- Delete jobs
- Automatic toast notifications

**useEmailSettings** (`/src/lib/hooks/useEmailSettings.ts`):
- Manages SMTP configuration
- Update settings
- Send test emails
- Loading states (isLoading, isSaving, isTesting)
- Automatic toast notifications

---

## Remaining Work: UI Components & Pages

### PHASE 1: Core UI Components (Priority: Critical)

#### 1. Job Status Badge Component
**File**: `/src/components/jobs/JobStatusBadge.tsx`

```tsx
interface JobStatusBadgeProps {
  status: JobStatus;
  showIcon?: boolean;
}
```

**Features**:
- Use `getStatusColor()` for colors
- Use `getStatusIcon()` for icon
- Support dark mode

---

#### 2. Job List Component
**File**: `/src/components/jobs/JobList.tsx`

```tsx
interface JobListProps {
  jobs: Job[];
  isLoading: boolean;
  onJobClick: (job: Job) => void;
}
```

**Features**:
- Responsive table (mobile: cards, desktop: table)
- Columns: Job Type, Status, Tenant, Started, Duration, Actions
- Skeleton loading state
- Empty state
- Click row → Open JobDetailModal
- Retry button for failed jobs
- Use `formatDuration()`, `formatJobType()`, `formatRelativeTime()`

---

#### 3. Job Filters Component
**File**: `/src/components/jobs/JobFilters.tsx`

```tsx
interface JobFiltersProps {
  filters: JobFilters;
  onFilterChange: (filters: JobFilters) => void;
  onReset: () => void;
}
```

**Features**:
- Status dropdown (All, Pending, Processing, Completed, Failed)
- Job Type dropdown (All, + dynamic list)
- Tenant dropdown (searchable)
- Date range picker (use existing DateRangePicker component)
- Reset button

---

#### 4. Job Detail Modal
**File**: `/src/components/jobs/JobDetailModal.tsx`

```tsx
interface JobDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobId: string;
}
```

**Features**:
- Use `Modal` component from `@/components/ui/Modal`
- Tabs: Details, Logs, Payload, Result
- Details tab: Status, timestamps, duration, attempts
- Logs tab: Color-coded log levels, timestamps
- Payload tab: Formatted JSON
- Result tab: Formatted JSON
- Retry/Delete buttons (if failed)
- Use `useEffect` to fetch job details with `getJobDetail()`

---

#### 5. Queue Health Card
**File**: `/src/components/jobs/QueueHealthCard.tsx`

```tsx
interface QueueHealthCardProps {
  autoRefresh?: boolean;
  refreshInterval?: number;
}
```

**Features**:
- Use `Card` component from `@/components/ui/Card`
- Display queue metrics (waiting, active, completed, failed)
- Database metrics
- Color-coded status (green=healthy, yellow=warning, red=unhealthy)
- Auto-refresh every 5 seconds
- Show last update time

---

### PHASE 2: Scheduled Jobs Components

#### 6. Scheduled Job Card
**File**: `/src/components/jobs/ScheduledJobCard.tsx`

```tsx
interface ScheduledJobCardProps {
  schedule: ScheduledJob;
  onEdit: (schedule: ScheduledJob) => void;
  onTrigger: (id: string) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onViewHistory: (id: string) => void;
}
```

**Features**:
- Use `Card` component
- Show enabled/disabled state (toggle switch)
- Show schedule in readable format (use `cronToReadable()`)
- Show next run time, last run time
- Action buttons: Edit, Run Now, View History
- Green border if enabled, gray if disabled

---

#### 7. Schedule Editor Component
**File**: `/src/components/jobs/ScheduleEditor.tsx`

```tsx
interface ScheduleEditorProps {
  schedule: ScheduledJob | null;
  onSave: (data: UpdateScheduledJobDto) => void;
  onCancel: () => void;
}
```

**Features**:
- Use react-hook-form + zod validation
- Visual schedule picker:
  - Daily at [time]
  - Weekly on [day] at [time]
  - Monthly on [date] at [time]
  - Custom cron expression
- Timezone dropdown
- Max retries input
- Timeout input
- Preview: "Runs daily at 6:00 AM" (use `cronToReadable()`)
- Validate cron with `isValidCron()`

---

### PHASE 3: Email Settings Components

#### 8. SMTP Settings Form
**File**: `/src/components/jobs/SmtpSettingsForm.tsx`

```tsx
interface SmtpSettingsFormProps {
  settings: EmailSettings | null;
  onSave: (data: UpdateEmailSettingsDto) => void;
  onTest: (email: string) => void;
  isSaving: boolean;
  isTesting: boolean;
}
```

**Features**:
- Use react-hook-form + zod
- Fields: host, port, encryption (dropdown: none/tls/ssl), username, password (show/hide toggle), from_email, from_name
- Test Email button → Opens TestEmailModal
- Save button
- Help text with Gmail/Outlook examples
- Use `Input` component from `@/components/ui/Input`

---

#### 9. Test Email Modal
**File**: `/src/components/jobs/TestEmailModal.tsx`

```tsx
interface TestEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (email: string) => Promise<void>;
  isSending: boolean;
}
```

**Features**:
- Use `Modal` component
- Email input field
- Send button
- Success/error messages
- Confirmation: "Test email sent! Check your inbox"

---

#### 10. Email Template List
**File**: `/src/components/jobs/EmailTemplateList.tsx`

```tsx
interface EmailTemplateListProps {
  templates: EmailTemplate[];
  onEdit: (template: EmailTemplate) => void;
  onDelete: (key: string) => void;
  onPreview: (template: EmailTemplate) => void;
}
```

**Features**:
- Responsive grid (cards on mobile, table on desktop)
- Show: template_key, subject, is_system badge
- Actions: Edit, Delete (only if not system), Preview
- Search/filter functionality

---

#### 11. Email Template Editor
**File**: `/src/components/jobs/EmailTemplateEditor.tsx`

```tsx
interface EmailTemplateEditorProps {
  template: EmailTemplate | null;
  onSave: (data: CreateEmailTemplateDto | UpdateEmailTemplateDto) => void;
  onCancel: () => void;
}
```

**Features**:
- Use react-hook-form + zod
- Fields: template_key (disabled if editing), subject, html_body (textarea), text_body (textarea), variables (multi-input), description
- Handlebars syntax guide
- Preview button → Shows PreviewEmailModal
- Save/Cancel buttons

---

### PHASE 4: Pages

#### Page 1: Job Monitoring Dashboard
**File**: `/src/app/(dashboard)/admin/jobs/page.tsx`

**Features**:
- Use `useJobs()` hook with auto-refresh
- QueueHealthCard at top
- JobFilters
- JobList
- PaginationControls (use existing component)
- JobDetailModal (opens on row click)
- Alert if failed jobs exist: "3 failed jobs in queue [View Failed Jobs]"

---

#### Page 2: Failed Jobs Page
**File**: `/src/app/(dashboard)/admin/jobs/failed/page.tsx`

**Features**:
- Use `useJobs({ failedOnly: true })`
- Header: "Failed Jobs" + subtitle
- Bulk actions: [Retry All] [Clear Queue]
- JobList
- PaginationControls

---

#### Page 3: Scheduled Jobs Page
**File**: `/src/app/(dashboard)/admin/jobs/schedules/page.tsx`

**Features**:
- Use `useScheduledJobs()` hook
- Header: "Scheduled Jobs"
- List of ScheduledJobCard components
- [+ Add Scheduled Job] button
- ScheduleEditor modal (for create/edit)

---

#### Page 4: Job History Page
**File**: `/src/app/(dashboard)/admin/jobs/schedules/[id]/history/page.tsx`

**Features**:
- Use `getScheduledJobHistory()` from API
- Header: "History: {schedule.name}"
- Table of last 100 runs
- Columns: Run Time, Status, Duration, Actions (View Logs)
- Chart: Success/fail over time (optional - use recharts)

---

#### Page 5: Platform SMTP Settings Page
**File**: `/src/app/(dashboard)/admin/jobs/email-settings/page.tsx`

**Features**:
- Use `useEmailSettings()` hook
- Header: "Platform Email Settings"
- SmtpSettingsForm
- Help section with Gmail/Outlook examples
- TestEmailModal

---

#### Page 6: Email Templates Page
**File**: `/src/app/(dashboard)/admin/jobs/email-templates/page.tsx`

**Features**:
- Fetch templates with `getEmailTemplates()`
- Header: "Email Templates"
- Search bar
- EmailTemplateList
- [+ Create Template] button
- EmailTemplateEditor modal

---

## Implementation Guidelines

### 1. Component Patterns

**Use existing shared components**:
- `Modal` from `@/components/ui/Modal`
- `Card` from `@/components/ui/Card`
- `Button` from `@/components/ui/Button`
- `Input` from `@/components/ui/Input`
- `Select` from `@/components/ui/Select`
- `ToggleSwitch` from `@/components/ui/ToggleSwitch`
- `LoadingSpinner` from `@/components/ui/LoadingSpinner`
- `Badge` from `@/components/ui/Badge`
- `PaginationControls` from `@/components/ui/PaginationControls`
- `DateRangePicker` from `@/components/ui/DateRangePicker`

**Follow existing patterns**:
- Check `/src/components/audit/` for similar list/filter/modal patterns
- Check `/src/components/files/` for card-based layouts
- Check `/src/components/rbac/` for CRUD modal patterns

### 2. State Management

**Use custom hooks**:
- `useJobs()` for job lists
- `useScheduledJobs()` for schedules
- `useEmailSettings()` for email config

**Local state for UI**:
- Modal open/close
- Selected items
- Form data (use react-hook-form)

### 3. Error Handling

**Pattern**:
```tsx
try {
  await someApiCall();
  toast.success('Operation successful');
} catch (err: any) {
  toast.error(err.message || 'Operation failed');
}
```

**Never freeze UI**:
- Always reset `isLoading` after error
- Always provide retry option
- Show error in modal, not alert()

### 4. Loading States

**Use LoadingSpinner**:
```tsx
{isLoading ? <LoadingSpinner /> : <ActualContent />}
```

**Use Skeleton loaders** for better UX:
- Job list: Show skeleton rows
- Cards: Show skeleton card layout

### 5. Mobile Responsive

**Mobile-first approach**:
- Tables → Cards on mobile
- Full-width modals on mobile
- Touch-friendly buttons (min 44x44px)
- Test at 375px viewport

### 6. Dark Mode

**All components support dark mode**:
- Use `dark:` Tailwind classes
- Test in both light and dark themes
- Colors already defined in helper functions

---

## Testing Checklist

### Component Tests
- [ ] JobStatusBadge renders correctly
- [ ] JobList shows jobs and handles clicks
- [ ] JobFilters updates filters correctly
- [ ] JobDetailModal fetches and displays job
- [ ] QueueHealthCard shows metrics
- [ ] ScheduledJobCard displays schedule
- [ ] ScheduleEditor validates cron
- [ ] SmtpSettingsForm validates fields
- [ ] TestEmailModal sends email
- [ ] EmailTemplateList displays templates

### Integration Tests
- [ ] Job monitoring dashboard loads
- [ ] Failed jobs page works
- [ ] Scheduled jobs page CRUD operations
- [ ] Job history page displays correctly
- [ ] SMTP settings save and test
- [ ] Email templates CRUD operations

### Mobile Tests
- [ ] All pages responsive at 375px
- [ ] Touch targets adequate
- [ ] No horizontal scroll
- [ ] Modals work on mobile

---

## API Documentation Reference

**Backend API Docs**: `/var/www/lead360.app/api/documentation/background_jobs_REST_API.md`

**All 24 endpoints documented with**:
- Request/response schemas
- Query parameters
- Error responses
- Example payloads

---

## Estimated Time

**Phase 1** (Core Components): 2 days
**Phase 2** (Schedule Components): 1 day
**Phase 3** (Email Components): 1 day
**Phase 4** (Pages): 2 days
**Testing**: 0.5 day

**Total**: ~6.5 days

---

## Notes

- **All infrastructure is production-ready** (types, APIs, hooks, utilities)
- **Follow mobile-first design** - test on small screens
- **Use existing shared components** - maintain UI consistency
- **Auto-refresh for job monitoring** - use 5-second intervals
- **Toast notifications** - use react-hot-toast (already configured)
- **RBAC**: Platform Admin only (ProtectedRoute component)
- **No backend changes needed** - API is 100% complete

---

## Questions or Issues

If you encounter API mismatches or missing functionality:
1. Check backend API docs first
2. Verify endpoint URL and parameters
3. Check network tab in DevTools
4. Report issues to backend team if API doesn't match docs

---

**Developer**: Good luck! The foundation is solid. You're building UI on top of a fully functional backend and API client. 🚀
