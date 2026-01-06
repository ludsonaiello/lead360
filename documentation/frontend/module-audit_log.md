# Frontend Module: Audit Log

**Module Name**: Audit Log  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/audit-log-contract.md`  
**Backend Module**: `/documentation/backend/module-audit-log.md`  
**Agent**: Frontend Specialist  
**Status**: Ready for Development (AFTER backend complete)

---

## Overview

This module implements audit log viewing, filtering, and export functionality for tenant users and Platform Admin. You will build a searchable, filterable log viewer with before/after comparison and compliance export features.

**CRITICAL**: Do NOT start until backend Audit Log module is 100% complete and API documentation is available.

**Read First**:
- `/documentation/contracts/audit-log-contract.md` (logging requirements)
- `/documentation/backend/module-audit-log.md` (API endpoints)
- Backend API documentation (Swagger)

---

## Technology Stack

**Required Libraries**:
- react-hook-form + zod (for filter forms)
- date-fns or dayjs (date handling)
- react-day-picker or react-datepicker (date range picker)
- @headlessui/react (modals, dropdowns)
- lucide-react (icons)
- json-diff-kit (JSON diff visualization - optional)
- papaparse (CSV parsing for export)

---

## Project Structure

```
app/
├── (dashboard)/
│   ├── settings/
│   │   ├── audit-log/
│   │   │   └── page.tsx (tenant audit viewer)
│   │   ├── users/
│   │   │   └── [id]/
│   │   │       └── activity/
│   │   │           └── page.tsx (user activity)
│   │   └── layout.tsx
│   └── layout.tsx
├── (admin)/
│   ├── audit-logs/
│   │   └── page.tsx (Platform Admin audit viewer)
│   └── tenants/
│       └── [id]/
│           └── audit/
│               └── page.tsx (tenant-specific audit for admin)
├── components/
│   ├── audit/
│   │   ├── AuditLogTable.tsx
│   │   ├── AuditLogFilters.tsx
│   │   ├── AuditLogDetailModal.tsx
│   │   ├── BeforeAfterDiff.tsx
│   │   ├── ExportAuditModal.tsx
│   │   ├── ActionTypeBadge.tsx
│   │   ├── StatusBadge.tsx
│   │   └── EmptyAuditState.tsx
│   └── ui/
├── lib/
│   ├── api/
│   │   └── audit.ts
│   ├── hooks/
│   │   ├── useAuditLogs.ts
│   │   └── useAuditExport.ts
│   ├── utils/
│   │   ├── formatters.ts (format dates, JSON, etc.)
│   │   └── audit-helpers.ts
│   └── types/
│       └── audit.ts
```

---

## TypeScript Interfaces

**Location**: `lib/types/audit.ts`

Define interfaces for:
- AuditLog (full log entry)
- AuditLogFilters (filter parameters)
- AuditLogPagination (pagination data)
- AuditLogExportOptions (export configuration)

Developer will create based on API documentation.

---

## API Client

**Location**: `lib/api/audit.ts`

**Methods to Implement**:

1. **getAuditLogs(filters, pagination)** - GET /audit-logs
2. **getAuditLog(id)** - GET /audit-logs/:id
3. **exportAuditLogs(filters, format)** - GET /audit-logs/export
4. **getUserAuditLogs(userId, filters, pagination)** - GET /users/:userId/audit-logs
5. **getTenantAuditLogs(tenantId, filters, pagination)** - GET /tenants/:tenantId/audit-logs (Platform Admin)

---

## Custom Hooks

### **useAuditLogs()**

**Location**: `lib/hooks/useAuditLogs.ts`

**Purpose**: Fetch and manage audit logs with filters and pagination

**Usage**:
```typescript
const {
  logs,
  pagination,
  filters,
  isLoading,
  error,
  setFilters,
  nextPage,
  previousPage,
  refresh
} = useAuditLogs();
```

**Returns**:
- logs (array of AuditLog)
- pagination (current page, total pages, total count)
- filters (current filter state)
- isLoading (boolean)
- error (Error object or null)
- setFilters (function to update filters)
- nextPage (function)
- previousPage (function)
- refresh (function to reload current page)

**Implementation Logic**:
1. Manage filter state (date range, action type, entity type, etc.)
2. Manage pagination state (current page, limit)
3. Fetch logs from API when filters or page changes
4. Debounce search input (wait 500ms after typing)
5. Update URL query params to make filters shareable

---

### **useAuditExport()**

**Location**: `lib/hooks/useAuditExport.ts`

**Purpose**: Handle audit log export

**Usage**:
```typescript
const { exportLogs, isExporting, error } = useAuditExport();

exportLogs({ format: 'csv', filters: currentFilters });
```

**Returns**:
- exportLogs (function to trigger export)
- isExporting (boolean)
- error (Error object or null)

**Implementation Logic**:
1. Call export API endpoint
2. Trigger browser download
3. Handle errors (too many results, etc.)

---

## Main Components

### **AuditLogTable Component**

**Location**: `components/audit/AuditLogTable.tsx`

**Purpose**: Display audit logs in table format

**Props**:
- logs (AuditLog[])
- isLoading (boolean)
- onRowClick (function - opens detail modal)
- emptyMessage (string, optional)

**Layout**:
```
[Table]
┌─────────────┬────────────┬───────┬────────────┬─────────────┬────────┐
│ Timestamp   │ Actor      │ Action│ Entity     │ Description │ Status │
├─────────────┼────────────┼───────┼────────────┼─────────────┼────────┤
│ Jan 5, 10am │ John Doe   │ ●Created│ Quote    │ Created...  │ ✓      │
│ Jan 5, 9am  │ Jane Smith │ ●Updated│ Tenant   │ Updated...  │ ✓      │
│ Jan 4, 3pm  │ Bob Jones  │ ✕Failed │ Auth     │ Login...    │ ✕      │
└─────────────┴────────────┴───────┴────────────┴─────────────┴────────┘
```

**Columns**:
1. **Timestamp**: Formatted date/time (relative: "2 hours ago" + absolute on hover)
2. **Actor**: User name (with avatar if available), "System" for system actions
3. **Action**: Badge with icon (created=green, updated=blue, deleted=red, failed=red)
4. **Entity Type**: Formatted entity type (tenant → "Business Profile", user → "User")
5. **Description**: Truncated description (max 80 chars, full text on hover)
6. **Status**: Success (checkmark) or Failure (X icon)

**Behavior**:
- Clickable rows (cursor pointer)
- Click row → Open detail modal
- Hover row → Highlight
- Loading state: Skeleton rows
- Empty state: "No audit logs found" with icon

**Responsive**:
- Desktop: Full table
- Mobile: Card layout (stack columns vertically)

---

### **AuditLogFilters Component**

**Location**: `components/audit/AuditLogFilters.tsx`

**Purpose**: Filter controls for audit logs

**Props**:
- filters (current filter state)
- onChange (function to update filters)
- onReset (function to clear filters)

**Layout**:
```
[Filter Bar]
┌─────────────────────────────────────────────────────────────────────┐
│ [Date Range Picker] [Action Type ▾] [Entity Type ▾] [Status ▾]     │
│ [Search Description...                                 ] [Reset]    │
└─────────────────────────────────────────────────────────────────────┘
```

**Filter Fields**:

1. **Date Range Picker**:
   - Preset options: Today, Last 7 Days, Last 30 Days, Last 90 Days, Custom Range
   - Custom range: Start date + End date
   - Default: Last 7 days

2. **Action Type Dropdown**:
   - Options: All, Created, Updated, Deleted, Accessed, Failed
   - Multi-select (can select multiple action types)

3. **Entity Type Dropdown**:
   - Options: All, User, Tenant, Role, Permission, File, Auth Session, etc.
   - Single select

4. **Status Dropdown**:
   - Options: All, Success, Failure
   - Single select

5. **Search Field**:
   - Placeholder: "Search description..."
   - Debounced input (500ms)
   - Searches description field

6. **Reset Button**:
   - Clears all filters to defaults
   - Tooltip: "Reset filters"

**Behavior**:
- Filters update immediately on change
- Search debounced (wait 500ms after typing)
- Show active filter count badge (e.g., "3 filters active")
- Mobile: Collapse filters into modal or accordion

---

### **AuditLogDetailModal Component**

**Location**: `components/audit/AuditLogDetailModal.tsx`

**Purpose**: Show full details of single log entry with before/after comparison

**Props**:
- isOpen (boolean)
- onClose (function)
- logId (string)

**Layout**:
```
[Modal Header: "Audit Log Detail"]

┌─────────────────────────────────────────────────────────────┐
│ [Close X]                                                    │
│                                                              │
│ Action: ●Updated                                             │
│ Entity: Business Profile (tenant/uuid)                      │
│ Actor: John Doe (john@example.com)                          │
│ Timestamp: January 5, 2025 at 10:30:45 AM                   │
│ IP Address: 192.168.1.1                                     │
│ User Agent: Chrome on MacOS                                 │
│ Status: ✓ Success                                            │
│                                                              │
│ Description:                                                 │
│ Updated business profile - legal name changed               │
│                                                              │
│ [Tabs: Changes | Metadata | Raw JSON]                       │
│                                                              │
│ [Tab: Changes]                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Before              │ After                             │ │
│ ├─────────────────────┼───────────────────────────────────┤ │
│ │ legal_name:         │ legal_name:                       │ │
│ │ "ABC Painting Inc"  │ "ABC Painting LLC"                │ │
│ │                     │                                   │ │
│ │ dba_name:           │ dba_name:                         │ │
│ │ "ABC Paint"         │ "ABC Paint" (unchanged)           │ │
│ └─────────────────────┴───────────────────────────────────┘ │
│                                                              │
│ [Copy JSON] [Download JSON]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Tabs**:

1. **Changes Tab** (Default):
   - Show before/after comparison
   - Highlight changed fields (green for additions, red for deletions, yellow for changes)
   - Use diff library for visual comparison
   - If no before_json or after_json: Show "No changes to display"

2. **Metadata Tab**:
   - Display metadata_json in readable format
   - Key-value pairs
   - Example: Device, Location, Session ID, etc.

3. **Raw JSON Tab**:
   - Show full JSON (before_json, after_json, metadata_json)
   - Formatted with syntax highlighting
   - Copy button

**Behavior**:
- Fetch full log details on open (if not already loaded)
- Loading state while fetching
- Copy buttons: Copy to clipboard + toast notification
- Download buttons: Download as JSON file

---

### **BeforeAfterDiff Component**

**Location**: `components/audit/BeforeAfterDiff.tsx`

**Purpose**: Visual diff of before/after JSON

**Props**:
- before (object or null)
- after (object or null)

**Rendering**:
- Side-by-side comparison (desktop)
- Stacked comparison (mobile)
- Color coding:
  - Green: Added fields/values
  - Red: Removed fields/values
  - Yellow: Changed values
  - Gray: Unchanged values

**Options**:
- Toggle: Show only changed fields (hide unchanged)
- Expand/collapse nested objects

---

### **ExportAuditModal Component**

**Location**: `components/audit/ExportAuditModal.tsx`

**Purpose**: Modal for exporting audit logs

**Props**:
- isOpen (boolean)
- onClose (function)
- currentFilters (object - pre-fill export with current filters)

**Layout**:
```
[Modal Header: "Export Audit Logs"]

Format:
○ CSV
○ JSON

Filters: (inherited from current view)
- Date Range: Last 7 days
- Action Type: All
- Status: All

Estimated Rows: 245

[Cancel] [Export]
```

**Behavior**:
1. User clicks "Export" button on main page
2. Modal opens with current filters applied
3. User selects format (CSV or JSON)
4. User can modify filters in modal (optional)
5. Show estimated row count (call API for count)
6. Click "Export"
7. If > 10,000 rows: Show error "Too many results, narrow date range"
8. If <= 10,000: Trigger download
9. Show loading indicator during export
10. Success: Close modal, show toast "Export successful"

---

### **Action Type and Status Badges**

**ActionTypeBadge Component**:
- created: Green badge with plus icon
- updated: Blue badge with edit icon
- deleted: Red badge with trash icon
- accessed: Gray badge with eye icon
- failed: Red badge with X icon

**StatusBadge Component**:
- success: Green checkmark
- failure: Red X

---

## Pages

### **Tenant Audit Log Page**

**Route**: `/settings/audit-log`

**Access**: Owner, Admin only

**Purpose**: Tenant users view their own audit logs

**Layout**:
```
[Header: "Audit Log"]
[Subtitle: "Track all changes and actions in your account"]

[AuditLogFilters]

[AuditLogTable]

[Pagination Controls]

[Export Button]
```

**Features**:
- Auto-filters to current tenant (backend enforces)
- Cannot see other tenants' logs
- Export limited to their tenant

---

### **User Activity Page**

**Route**: `/settings/users/:id/activity`

**Access**: Owner, Admin only

**Purpose**: View all actions performed by specific user

**Layout**:
```
[Breadcrumb: Settings > Users > John Doe > Activity]

[Header: "Activity Log - John Doe"]

[AuditLogFilters] (simplified - no actor filter)

[AuditLogTable] (pre-filtered by this user)

[Pagination]
```

**Features**:
- Pre-filtered by actor_user_id
- Shows what this user has done
- Useful for investigating user actions

---

### **Platform Admin: System-Wide Audit Log**

**Route**: `/admin/audit-logs`

**Access**: Platform Admin only

**Purpose**: View all logs across all tenants

**Layout**:
```
[Header: "System Audit Log"]

[Additional Filter: Tenant Selector (searchable dropdown)]

[AuditLogFilters]

[AuditLogTable] (includes tenant column)

[Pagination]

[Export Button]
```

**Features**:
- Can see all tenants' logs
- Tenant selector dropdown (search by subdomain or legal name)
- Additional column: Tenant name
- Export can include all tenants or specific tenant

---

### **Platform Admin: Tenant-Specific Audit**

**Route**: `/admin/tenants/:id/audit`

**Access**: Platform Admin only

**Purpose**: View audit logs for specific tenant

**Layout**:
```
[Breadcrumb: Admin > Tenants > ABC Painting > Audit Log]

[Header: "Audit Log - ABC Painting"]

[AuditLogFilters]

[AuditLogTable]

[Pagination]
```

**Features**:
- Pre-filtered to specific tenant
- Same as tenant's own view, but accessible by Platform Admin

---

## Formatting and Display

### **Date/Time Formatting**

**Relative Time** (for recent logs):
- < 1 min: "Just now"
- < 1 hour: "X minutes ago"
- < 24 hours: "X hours ago"
- < 7 days: "X days ago"

**Absolute Time** (for older logs):
- Format: "Jan 5, 2025 at 10:30 AM"
- Tooltip: Full ISO timestamp

### **Actor Display**

**User Actor**:
- Name: "John Doe"
- Avatar: Show user avatar if available
- Hover: Tooltip with email

**System Actor**:
- Text: "System"
- Icon: Gear or robot icon
- No avatar

**Platform Admin**:
- Name: "Platform Admin"
- Badge: "ADMIN" badge
- Different color (purple)

---

## Error Handling

**Common Errors**:

1. **403 Forbidden** (accessing other tenant's logs):
   - Redirect to 403 page
   - Message: "You don't have permission to view these logs"

2. **Export > 10,000 rows**:
   - Error modal: "Too many results to export. Please narrow your date range or add more filters."
   - Suggest: "Try exporting one month at a time"

3. **No logs found**:
   - Empty state: Icon + "No audit logs found"
   - Suggestion: "Try adjusting your filters"

4. **API error**:
   - Error toast: "Failed to load audit logs. Please try again."
   - Retry button

---

## Testing Requirements

### **Component Tests** (>70% coverage)

1. **AuditLogTable**
   - ✅ Renders logs correctly
   - ✅ Shows loading skeleton
   - ✅ Shows empty state
   - ✅ Clicking row opens detail modal

2. **AuditLogFilters**
   - ✅ All filter controls render
   - ✅ Changing filters triggers onChange
   - ✅ Reset button clears filters
   - ✅ Search input debounced

3. **AuditLogDetailModal**
   - ✅ Fetches log details on open
   - ✅ Displays before/after diff
   - ✅ Shows metadata
   - ✅ Copy JSON button works

4. **BeforeAfterDiff**
   - ✅ Highlights changed fields
   - ✅ Shows additions in green
   - ✅ Shows deletions in red
   - ✅ Handles null before/after

5. **ExportAuditModal**
   - ✅ Estimates row count
   - ✅ Triggers export on submit
   - ✅ Shows error if > 10,000 rows

---

### **Integration Tests (E2E)**

1. **View Audit Logs**
   - ✅ Owner navigates to Audit Log page
   - ✅ Logs load and display
   - ✅ Can paginate through logs
   - ✅ Can click log to see details

2. **Apply Filters**
   - ✅ Select date range
   - ✅ Select action type
   - ✅ Table updates with filtered results
   - ✅ URL updates with query params

3. **Export Logs**
   - ✅ Click Export button
   - ✅ Select CSV format
   - ✅ File downloads
   - ✅ CSV contains correct data

4. **Tenant Isolation**
   - ✅ Tenant A cannot access Tenant B logs (403)
   - ✅ Platform Admin can access all logs

5. **User Activity**
   - ✅ Navigate to user activity page
   - ✅ Logs pre-filtered by user
   - ✅ Shows only actions by that user

---

## Completion Checklist

- [ ] All TypeScript interfaces defined
- [ ] Audit API client implemented (all methods)
- [ ] useAuditLogs hook implemented
- [ ] useAuditExport hook implemented
- [ ] AuditLogTable component
- [ ] AuditLogFilters component
- [ ] AuditLogDetailModal component
- [ ] BeforeAfterDiff component
- [ ] ExportAuditModal component
- [ ] ActionTypeBadge and StatusBadge components
- [ ] Tenant audit log page
- [ ] User activity page
- [ ] Platform Admin audit log page
- [ ] Platform Admin tenant audit page
- [ ] Date/time formatting
- [ ] Actor display with avatars
- [ ] Export functionality (CSV + JSON)
- [ ] Error handling (all error states)
- [ ] Loading states
- [ ] Empty states
- [ ] Component tests >70% coverage
- [ ] E2E tests passing
- [ ] No TypeScript errors
- [ ] No console errors

---

## Modern UI/UX Checklist

- [ ] Loading skeletons (not just spinners)
- [ ] Smooth transitions between states
- [ ] Debounced search (500ms)
- [ ] Relative timestamps with absolute on hover
- [ ] Color-coded action types and status
- [ ] Clickable rows with hover effect
- [ ] Modal for log details (not separate page)
- [ ] Visual JSON diff (highlighted changes)
- [ ] Export modal (not inline)
- [ ] Success toasts for exports
- [ ] Error modals (not alerts)
- [ ] Empty states with helpful messages
- [ ] Mobile responsive (table → cards)
- [ ] Keyboard accessible (tab navigation)
- [ ] Aria labels for screen readers

---

## Performance Considerations

**Pagination**:
- Always paginate (never load all logs)
- Default page size: 50
- Max page size: 200

**Debounced Search**:
- Wait 500ms after user stops typing
- Don't trigger API call on every keystroke

**Lazy Loading**:
- Load log details only when modal opens
- Don't preload all details

**Caching** (Optional):
- Cache current page for 1 minute
- Don't refetch if user returns to same page
- Invalidate cache on new log creation (if real-time updates added)

---

## Common Pitfalls to Avoid

1. **Don't fetch all logs** - Always paginate
2. **Don't show raw JSON by default** - Use formatted diff view
3. **Don't forget tenant isolation** - Critical security requirement
4. **Don't skip loading states** - Logs can take time to load
5. **Don't ignore mobile** - Table must be responsive
6. **Don't export without limit check** - Verify row count first
7. **Don't hardcode date formats** - Use library (date-fns)
8. **Don't forget empty states** - Helpful when no logs found

---

## Accessibility Requirements

- [ ] All interactive elements keyboard accessible
- [ ] Screen reader friendly (aria-labels)
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators visible
- [ ] Table has proper semantic HTML
- [ ] Modal can be closed with Escape key
- [ ] Form labels associated with inputs

---

**End of Frontend Module Documentation**

Audit log viewer is critical for compliance and transparency. UI must be clear, searchable, and easy to export for audits.