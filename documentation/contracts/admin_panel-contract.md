# Feature Contract: Admin Panel

**Feature Name**: Platform Admin Dashboard & Management  
**Module**: Administration  
**Sprint**: Sprint 0 - Platform Foundation  
**Status**: Draft

---

## Purpose

**What problem does this solve?**

Provides Platform Admins with a comprehensive, visually stunning dashboard to monitor system health, manage tenants, configure platform settings, and access powerful administrative tools. Enables efficient platform management and support operations.

**Who is this for?**

- **Platform Admin**: Monitor everything, manage tenants, configure system
- **Support Team**: Impersonate tenants, troubleshoot issues
- **Leadership**: View business metrics, growth trends
- **Use Cases**: 
  - Monitor system health and job performance
  - Create enterprise demo accounts
  - Support tenant issues (login as user)
  - Suspend problematic tenants
  - View business growth metrics
  - Export data for analysis
  - Schedule maintenance windows
  - Manage feature flags

---

## Scope

### **In Scope**

- ✅ Stunning dashboard (balanced: business + system metrics)
- ✅ Real-time metrics (auto-refresh every 30 seconds)
- ✅ Tenant management (list, view, create, edit, suspend, activate, delete)
- ✅ "Login as Tenant" (impersonation without password for support)
- ✅ User management across all tenants
- ✅ System settings (feature flags, maintenance mode, global configs)
- ✅ Feature flag management (enable/disable features globally)
- ✅ Maintenance mode (scheduled downtime with custom message)
- ✅ In-app notifications (bell icon with count)
- ✅ Email alerts (real-time for critical events)
- ✅ Daily stats email (morning summary report)
- ✅ Data export (tenants, users, audit logs - CSV/PDF with filters)
- ✅ Analytics charts (time-based growth, distribution)
- ✅ Job monitoring integration (link to Background Jobs module)
- ✅ File storage monitoring (usage, limits)
- ✅ Recent activity feed
- ✅ Quick actions bar
- ✅ Mobile responsive (works on phone/tablet)
- ✅ Polished animations (loading skeletons, hover effects, chart animations)
- ✅ Audit logging (all admin actions)

### **Out of Scope**

- ❌ **Billing management UI** (module not ready - Sprint 1+)
- ❌ **Global search** (not needed)
- ❌ WebSocket live metrics (auto-refresh instead)
- ❌ Multi-factor authentication for Platform Admin (Phase 2)
- ❌ Role-based admin permissions (single Platform Admin role for now)
- ❌ Custom reporting builder (Phase 2)
- ❌ Tenant white-labeling settings (Phase 2)

**Note**: Billing module UI will be added in Sprint 1+ when billing system is ready.

---

## Dependencies

### **Requires (must be complete first)**

- [x] Authentication module (admin identification)
- [x] Tenant module (tenant management)
- [x] RBAC module (Platform Admin role)
- [x] Audit Log module (log admin actions)
- [x] Background Jobs module (job monitoring)
- [x] File Storage module (storage metrics)

### **Blocks (must complete before)**

- Billing module (when ready, integrate billing UI)
- Communication module (when ready, show communication metrics)

---

## Architecture Integration

### **Existing System** (CRITICAL!)

**Admin panel integrates with existing dashboard**:
- ✅ Same login system (identifies Platform Admin automatically)
- ✅ Uses existing `app/(dashboard)/admin` structure
- ✅ Admin menu already exists
- ✅ Shares all UI components, layouts, utilities
- ✅ Same authentication flow

**Routes** (All under `/admin`):
- `/admin/dashboard` - Main dashboard
- `/admin/tenants` - Tenant management
- `/admin/tenants/:id` - Tenant details
- `/admin/tenants/create` - Create tenant
- `/admin/users` - User management
- `/admin/settings` - System settings
- `/admin/alerts` - Alerts & notifications
- `/admin/exports` - Data export
- `/admin/jobs` - Background jobs (already exists)
- `/admin/files` - File storage (already exists)

**NO separate admin app** - Everything integrated into existing dashboard with admin-specific routes!

---

## Dashboard Metrics (Balanced)

### **Primary Metrics** (Top Cards)

**1. Active Tenants**
- Current count (e.g., 245)
- Growth this month (e.g., +12 / +5.1%)
- Trend arrow (up/down)
- Sparkline chart (last 30 days)

**2. Total Users**
- Current count (e.g., 3,421)
- Growth this month (e.g., +187 / +5.8%)
- Trend arrow
- Sparkline chart

**3. Job Success Rate** (24h)
- Percentage (e.g., 97.3%)
- Total jobs (e.g., 12,487)
- Failed count (e.g., 342)
- Status indicator (green >95%, yellow 90-95%, red <90%)

**4. Storage Used**
- Current usage (e.g., 145 GB)
- Limit (e.g., / 500 GB)
- Percentage (e.g., 29%)
- Progress bar

**5. System Health**
- Overall status (green/yellow/red)
- Components: Database, Redis, Job Queue, Email Service
- Uptime (e.g., 99.98%)
- Response time (e.g., 45ms avg)

**6. Recent Activity Feed**
- Last 10 actions (scrollable)
- Tenant created, User registered, Job failed, etc.
- Timestamp (relative: "2 minutes ago")
- Actor (user who did it)

---

### **Analytics Charts**

**Time-based Growth** (Line Charts):
1. **Tenant Growth** (last 90 days)
   - New tenants per day
   - Cumulative total line

2. **User Signups** (last 90 days)
   - New users per day
   - Cumulative total line

3. **Job Execution Trends** (last 7 days)
   - Success vs Failed (stacked area chart)
   - Success rate line

**Distribution Charts** (Pie/Donut):
1. **Tenants by Industry**
   - Painting, Gutter, Cleaning, HVAC, Plumbing, Other
   - Count + percentage

2. **Tenants by Size**
   - Small (1-5 users)
   - Medium (6-20 users)
   - Large (21+ users)

3. **Users by Role**
   - Owner, Admin, Bookkeeper, Estimator, Project Manager, Employee
   - Count + percentage

---

## Tenant Management

### **Tenant List** (`/admin/tenants`)

**Table Columns**:
1. Subdomain (link to tenant details)
2. Business Name
3. Status (Active, Suspended, Pending)
4. Owner (name + email)
5. Users (count)
6. Created (date)
7. Last Active (date)
8. Actions (dropdown)

**Filters**:
- Status (All, Active, Suspended, Pending)
- Created Date Range
- Industry (if tracked)
- Has Users (0 users, 1-5, 6-20, 21+)

**Bulk Actions**:
- Export selected (CSV)
- Suspend selected
- Activate selected

**Search**:
- Search by subdomain, business name, owner email

---

### **Tenant Details** (`/admin/tenants/:id`)

**Information Tabs**:

**1. Overview**
- Business name
- Subdomain
- Status (with toggle: Active/Suspended)
- Owner info (name, email, phone)
- Created date
- Last active date
- Industry (if tracked)
- Total users
- Storage used
- Email config status (configured or using default)

**2. Users**
- List all users for this tenant
- User table (name, email, role, last login, status)
- Actions: View user, Force password reset, Deactivate

**3. Activity**
- Audit log for this tenant (last 100 actions)
- Filter by: Action type, Date range, User

**4. Files**
- File storage metrics
- Total files, Total size
- Link to file gallery (from File Storage module)

**5. Jobs**
- Job execution history for this tenant
- Success rate, Failed count
- Link to full job list (from Background Jobs module)

**Actions** (Top Right):
- 🎭 **Login as Tenant** (impersonation)
- Edit Tenant
- Suspend Tenant
- Activate Tenant (if suspended)
- Delete Tenant (with confirmation)

---

### **Create Tenant** (`/admin/tenants/create`)

**Form Fields**:
1. **Business Information**
   - Business Name (required)
   - Subdomain (required, auto-generated from name, editable)
   - Industry (dropdown, optional)

2. **Owner Information**
   - First Name (required)
   - Last Name (required)
   - Email (required)
   - Phone (optional)
   - Password (required) - Plain text or auto-generate option

3. **Initial Settings** (Optional)
   - Automatically send welcome email (checkbox)
   - Skip email verification (checkbox - useful for demos)

**Validation**:
- Subdomain must be unique
- Subdomain must be lowercase, alphanumeric + hyphens only
- Email must be valid and unique

**On Submit**:
- Create tenant
- Create owner user
- Send welcome email (if checked)
- Redirect to tenant details page
- Success toast: "Tenant created successfully!"

---

## "Login as Tenant" (Impersonation)

### **Purpose**

Allows Platform Admin to troubleshoot tenant issues by logging in as any tenant user without knowing their password.

### **Flow**

**1. Trigger**:
- Platform Admin clicks "🎭 Login as Tenant" button on tenant details page
- Modal opens: "Select user to impersonate"

**2. User Selection**:
- List all users for this tenant
- Show: Name, Email, Role
- Select user (usually Owner or Admin for testing)

**3. Confirmation**:
- Modal: "Login as [User Name]?"
- Warning: "You will be logged in as this user. All actions will be tracked in the audit log."
- Buttons: [Cancel] [Login as User]

**4. Impersonation Session**:
- Create impersonation token
- Store in session: `impersonated_user_id`, `impersonating_admin_id`
- Redirect to tenant dashboard (`/dashboard` or `/` - tenant's home)
- **Top banner shows**: "⚠️ You are impersonating [User Name] | [Exit Impersonation]"

**5. Limitations During Impersonation**:
- Cannot change user password
- Cannot delete user
- Cannot access admin panel (while impersonating)
- All actions logged with note: "Action performed by Platform Admin [Name] impersonating [User Name]"

**6. Exit Impersonation**:
- Click "Exit Impersonation" button in banner
- Destroy impersonation token
- Redirect back to admin panel (`/admin/dashboard`)
- Success toast: "Exited impersonation mode"

**Security**:
- Impersonation token expires in 1 hour (auto-exit)
- Audit log captures: Who impersonated who, when, actions taken
- Impersonation restricted to Platform Admin role only

---

## User Management (`/admin/users`)

**Purpose**: View and manage ALL users across ALL tenants

**Table Columns**:
1. Name
2. Email
3. Role
4. Tenant (business name + subdomain)
5. Status (Active, Inactive)
6. Last Login (date)
7. Created (date)
8. Actions (dropdown)

**Filters**:
- Role (All, Owner, Admin, Bookkeeper, etc.)
- Status (All, Active, Inactive)
- Tenant (dropdown, searchable)
- Last Login (Last 7 days, Last 30 days, Never logged in)

**Actions**:
- View user details (opens modal)
- Force password reset (sends email)
- Deactivate user
- Activate user
- Delete user (with confirmation)

**Bulk Actions**:
- Export selected (CSV)
- Force password reset (bulk)

---

## System Settings (`/admin/settings`)

### **Feature Flags**

**Purpose**: Enable/disable features globally (all tenants affected)

**List of Feature Flags**:
1. **File Storage** - Allow file uploads
2. **Email Queue** - Allow email sending
3. **Background Jobs** - Allow job scheduling
4. **User Registration** - Allow new tenant signups
5. **API Access** - Allow API requests
6. **Maintenance Mode** - Show maintenance page to all users

**UI**:
```
┌─────────────────────────────────────────────────────────────┐
│ Feature Flags                                                │
│                                                              │
│ [✓] File Storage                                            │
│     Allow tenants to upload files                           │
│     [Toggle]                                                │
│                                                              │
│ [✓] Email Queue                                             │
│     Allow system to send emails                             │
│     [Toggle]                                                │
│                                                              │
│ [✗] User Registration                                       │
│     Allow new tenant signups (closed beta)                  │
│     [Toggle]                                                │
└─────────────────────────────────────────────────────────────┘
```

**Behavior**:
- Toggle instantly updates (no save button)
- Confirmation modal for critical features (User Registration, Maintenance Mode)
- Audit log: "Feature flag [name] [enabled/disabled] by [admin]"

---

### **Maintenance Mode**

**Purpose**: Schedule maintenance windows, show custom message to all users

**Settings**:
1. **Status**: Enabled/Disabled (toggle)
2. **Mode**: Immediate or Scheduled
3. **Start Time** (if scheduled)
4. **End Time** (if scheduled)
5. **Message** (custom message shown to users)
6. **Allowed IPs** (optional - whitelist IPs that can still access, e.g., your team)

**UI**:
```
┌─────────────────────────────────────────────────────────────┐
│ Maintenance Mode                                             │
│                                                              │
│ Status: [○ Disabled  ● Enabled]                             │
│                                                              │
│ Mode: ○ Immediate  ● Scheduled                              │
│                                                              │
│ Start Time: [Jan 10, 2025 02:00 AM ▾]                      │
│ End Time:   [Jan 10, 2025 06:00 AM ▾]                      │
│                                                              │
│ Message:                                                     │
│ [Lead360 is undergoing scheduled maintenance.               │
│  We'll be back online by 6:00 AM EST. Thank you!]          │
│                                                              │
│ Allowed IPs: (optional)                                     │
│ [203.0.113.1, 203.0.113.2]                                  │
│                                                              │
│ [Cancel] [Save & Activate]                                  │
└─────────────────────────────────────────────────────────────┘
```

**Maintenance Page** (Shown to users):
```
┌─────────────────────────────────────────────────────────────┐
│                     🔧 Under Maintenance                     │
│                                                              │
│ Lead360 is undergoing scheduled maintenance.                │
│ We'll be back online by 6:00 AM EST. Thank you!            │
│                                                              │
│ Estimated completion: Jan 10, 2025 at 6:00 AM EST          │
└─────────────────────────────────────────────────────────────┘
```

---

### **Global Settings**

**All Current System Settings**:
1. **Max File Upload Size** (MB, per file)
2. **Max Storage Per Tenant** (GB)
3. **Session Timeout** (minutes)
4. **Password Reset Token Expiry** (hours)
5. **Max Failed Login Attempts** (before lockout)
6. **Account Lockout Duration** (minutes)
7. **Job Retention Days** (how long to keep job records)
8. **Audit Log Retention Days** (how long to keep audit logs)

**UI** (Simple form with sections):
```
┌─────────────────────────────────────────────────────────────┐
│ Global Settings                                              │
│                                                              │
│ [File Storage]                                               │
│ Max File Upload Size: [10      ] MB                         │
│ Max Storage Per Tenant: [500    ] GB                        │
│                                                              │
│ [Security]                                                   │
│ Session Timeout: [30     ] minutes                          │
│ Password Reset Token Expiry: [24     ] hours                │
│ Max Failed Login Attempts: [5      ]                        │
│ Account Lockout Duration: [15     ] minutes                 │
│                                                              │
│ [Data Retention]                                             │
│ Job Retention Days: [30     ] days                          │
│ Audit Log Retention Days: [90     ] days                    │
│                                                              │
│ [Cancel] [Save Settings]                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Alerts & Notifications

### **In-App Notifications** (Bell Icon)

**Location**: Header (top right)

**UI**:
- Bell icon 🔔
- Red badge with count (if unread notifications exist)
- Click → Dropdown opens with notifications

**Notification Types**:
1. **New Tenant Signup**
   - "New tenant: ABC Painting (abc-painting) just signed up!"
   - Link: View tenant details
   - Timestamp: "5 minutes ago"

2. **Tenant Approaching Storage Limit**
   - "ABC Painting is using 450 GB of 500 GB (90%) storage"
   - Link: View tenant details
   - Timestamp: "2 hours ago"

3. **Job Failure Rate Spike**
   - "Job failure rate spiked to 15% in the last hour (12 failed jobs)"
   - Link: View failed jobs
   - Timestamp: "1 hour ago"

4. **System Downtime**
   - "System downtime detected: Database connection failed"
   - Link: View system health
   - Timestamp: "30 minutes ago"

5. **Suspicious Activity**
   - "Failed login attempts spiked: 50 attempts from IP 203.0.113.5"
   - Link: View audit log
   - Timestamp: "10 minutes ago"

**Notification Actions**:
- Mark as read (checkbox)
- Mark all as read (button)
- Delete notification
- View all notifications (opens full page)

---

### **Email Alerts** (Real-time)

**Sent Immediately** to Platform Admin email:
- Critical: System downtime, database failure
- High Priority: Job failure rate spike (>10%), suspicious activity
- Medium Priority: New tenant signup, storage limit approaching

**Email Template**:
```
Subject: [CRITICAL] System Downtime Detected

Hi Platform Admin,

System downtime was detected at 10:30 AM EST.

Component: Database Connection
Error: Connection timeout after 30 seconds
Impact: All tenants affected

View Details: https://lead360.com/admin/settings

This is an automated alert from Lead360.
```

---

### **Daily Stats Email** (Morning Summary)

**Sent Every Morning** at 8:00 AM (configurable timezone):

**Email Content**:
```
Subject: Lead360 Daily Stats - January 10, 2025

Hi Platform Admin,

Here's your daily summary for Lead360:

📊 METRICS
- Active Tenants: 245 (+3 from yesterday)
- Total Users: 3,421 (+12 from yesterday)
- New Signups: 3 tenants, 12 users

✅ JOBS
- Total Jobs: 12,487 (24h)
- Success Rate: 97.3%
- Failed Jobs: 342

💾 STORAGE
- Total Used: 145 GB / 500 GB (29%)
- Top Consumer: ABC Painting (45 GB)

⚠️ ALERTS
- 2 tenants approaching storage limit
- 0 critical system issues

View Full Dashboard: https://lead360.com/admin/dashboard

Have a great day!
Lead360 Platform
```

**Configuration** (in System Settings):
- Enable/Disable daily email
- Email time (timezone-aware)
- Additional recipients (CC)

---

## Data Export

### **Export Page** (`/admin/exports`)

**Purpose**: Export data with advanced filters (CSV/PDF)

**Export Types**:

**1. Tenants Export**
- Format: CSV or PDF
- Columns: Subdomain, Business Name, Status, Owner Name, Owner Email, Users Count, Storage Used, Created Date
- Filters: Status, Created Date Range, Industry, User Count Range
- Estimated rows: "245 tenants match your filters"
- Button: [Download CSV] [Download PDF]

**2. Users Export**
- Format: CSV or PDF
- Columns: Name, Email, Role, Tenant, Status, Last Login, Created Date
- Filters: Role, Status, Tenant, Last Login, Created Date Range
- Estimated rows: "3,421 users match your filters"
- Button: [Download CSV] [Download PDF]

**3. Audit Logs Export**
- Format: CSV or PDF
- Columns: Timestamp, Actor, Action Type, Entity Type, Entity, Description, IP Address
- Filters: Action Type, Entity Type, Tenant, Date Range, Actor
- Estimated rows: "125,487 logs match your filters"
- Warning: "Large exports may take several minutes"
- Button: [Download CSV] [Download PDF]

**Export Process**:
1. User selects filters → Click "Download CSV"
2. Show loading: "Generating export... This may take a few minutes"
3. Queue background job (BulkExportJob)
4. When complete: Auto-download file
5. Success toast: "Export complete! 245 rows exported."

**Export History**:
- Show last 10 exports (filename, type, rows, date, download link)
- Auto-delete exports older than 7 days

---

## Quick Actions Bar

**Location**: Top of dashboard (below metrics cards)

**Actions**:
1. **➕ Create Tenant** → Redirects to `/admin/tenants/create`
2. **👀 View All Jobs** → Redirects to `/admin/jobs`
3. **❌ View Failed Jobs** → Redirects to `/admin/jobs/failed`
4. **🔧 System Health** → Opens system health modal
5. **📋 Recent Activity** → Already visible on dashboard, smooth scroll to activity feed

---

## Mobile Responsive Design

**Breakpoints**:
- Desktop: >1024px (full layout, 3-column grid)
- Tablet: 768px-1024px (2-column grid, condensed tables)
- Mobile: <768px (single column, cards instead of tables)

**Mobile Optimizations**:
- Hamburger menu for navigation
- Metric cards stack vertically
- Charts become full-width, scrollable horizontally if needed
- Tables become cards (vertical layout with labels)
- Filters collapse into modal/drawer
- Touch-friendly buttons (min 44px height)
- Swipe gestures for navigation

---

## Animations & Polish

### **Loading Skeletons**

**Replace spinners with content-aware skeletons**:
- Metric cards: Shimmer rectangles
- Charts: Pulsing graph outlines
- Tables: Shimmer rows
- User avatars: Pulsing circles

**Library**: Use shadcn/ui Skeleton component

---

### **Micro-Animations on Hover**

**Interactive Elements**:
- Buttons: Scale 1.02, slight shadow increase
- Cards: Lift effect (translateY: -2px, shadow increase)
- Table rows: Background color change, subtle scale
- Icons: Rotate, bounce, or fade

**Library**: Tailwind transitions + framer-motion for complex animations

---

### **Chart Animations**

**On Load**:
- Line charts: Draw from left to right (0.8s ease-out)
- Bar charts: Grow from bottom to top (0.6s ease-out)
- Pie charts: Grow from center (0.8s ease-out)
- Numbers: Count up from 0 to actual value (1s)

**Library**: recharts (built-in animations) + react-countup for numbers

---

## API Specification

### **Dashboard Endpoints**

1. **GET /admin/dashboard/metrics** - Get all dashboard metrics
2. **GET /admin/dashboard/charts/tenant-growth** - Tenant growth chart data
3. **GET /admin/dashboard/charts/user-signups** - User signups chart data
4. **GET /admin/dashboard/charts/job-trends** - Job execution trends
5. **GET /admin/dashboard/charts/tenants-by-industry** - Distribution data
6. **GET /admin/dashboard/activity** - Recent activity feed

### **Tenant Management Endpoints**

7. **GET /admin/tenants** - List tenants (with filters, pagination)
8. **GET /admin/tenants/:id** - Get tenant details
9. **POST /admin/tenants** - Create tenant manually
10. **PATCH /admin/tenants/:id** - Update tenant
11. **PATCH /admin/tenants/:id/suspend** - Suspend tenant
12. **PATCH /admin/tenants/:id/activate** - Activate tenant
13. **DELETE /admin/tenants/:id** - Delete tenant
14. **POST /admin/tenants/:id/impersonate** - Impersonate tenant user
15. **POST /admin/impersonation/exit** - Exit impersonation

### **User Management Endpoints**

16. **GET /admin/users** - List all users (with filters, pagination)
17. **GET /admin/users/:id** - Get user details
18. **POST /admin/users/:id/reset-password** - Force password reset
19. **POST /admin/users/:id/deactivate** - Deactivate user
20. **POST /admin/users/:id/activate** - Activate user
21. **DELETE /admin/users/:id** - Delete user

### **System Settings Endpoints**

22. **GET /admin/settings/feature-flags** - Get all feature flags
23. **PATCH /admin/settings/feature-flags/:key** - Toggle feature flag
24. **GET /admin/settings/maintenance** - Get maintenance mode settings
25. **PATCH /admin/settings/maintenance** - Update maintenance mode
26. **GET /admin/settings/global** - Get global settings
27. **PATCH /admin/settings/global** - Update global settings

### **Alerts & Notifications Endpoints**

28. **GET /admin/alerts** - Get in-app notifications
29. **PATCH /admin/alerts/:id/read** - Mark notification as read
30. **POST /admin/alerts/mark-all-read** - Mark all as read
31. **DELETE /admin/alerts/:id** - Delete notification

### **Export Endpoints**

32. **POST /admin/exports/tenants** - Export tenants (CSV/PDF)
33. **POST /admin/exports/users** - Export users (CSV/PDF)
34. **POST /admin/exports/audit-logs** - Export audit logs (CSV/PDF)
35. **GET /admin/exports/history** - Get export history

---

## Testing Requirements

### **Backend Tests**

**Unit Tests**:
- ✅ Calculate dashboard metrics
- ✅ Aggregate chart data
- ✅ Create tenant manually
- ✅ Impersonate user (create session)
- ✅ Exit impersonation
- ✅ Toggle feature flag
- ✅ Update maintenance mode
- ✅ Send email alerts
- ✅ Generate daily stats email
- ✅ Export data (CSV, PDF)

**Integration Tests**:
- ✅ Dashboard loads all metrics correctly
- ✅ Create tenant → Owner user created → Welcome email sent
- ✅ Impersonate user → Actions logged correctly
- ✅ Suspend tenant → Users cannot login
- ✅ Activate tenant → Users can login
- ✅ Feature flag disabled → Feature blocked globally
- ✅ Maintenance mode enabled → Maintenance page shown
- ✅ Alert triggered → In-app notification + email sent

---

### **Frontend Tests**

**Component Tests**:
- ✅ Dashboard renders metrics
- ✅ Charts render correctly
- ✅ Tenant list loads and filters work
- ✅ Create tenant form validates
- ✅ Impersonation flow works
- ✅ Feature flag toggle updates
- ✅ Notifications dropdown renders

**E2E Tests**:
- ✅ Platform Admin logs in → Redirected to `/admin/dashboard`
- ✅ View tenant list → Click tenant → View details
- ✅ Create tenant → Filled form → Tenant created
- ✅ Impersonate user → View as tenant → Exit impersonation
- ✅ Toggle feature flag → Flag updated
- ✅ Export tenants → CSV downloaded

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend**
- [ ] Dashboard metrics endpoints (all 6 metrics)
- [ ] Chart data endpoints (4 charts)
- [ ] Tenant management endpoints (9 endpoints)
- [ ] User management endpoints (6 endpoints)
- [ ] Impersonation system (create session, track actions, exit)
- [ ] Feature flags system (database table, toggle logic)
- [ ] Maintenance mode (middleware, custom page)
- [ ] Alert system (in-app + email)
- [ ] Daily stats email job (scheduled, HTML template)
- [ ] Export system (CSV + PDF with filters)
- [ ] Audit logging (all admin actions)
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation complete

### **Frontend**
- [ ] Stunning dashboard page (6 metrics, 4 charts, activity feed)
- [ ] Tenant list page (table, filters, search, bulk actions)
- [ ] Tenant details page (5 tabs, actions)
- [ ] Create tenant page (form with validation)
- [ ] Impersonation flow (modal, banner, exit)
- [ ] User list page (table, filters, actions)
- [ ] System settings page (feature flags, maintenance, global settings)
- [ ] Alerts UI (bell icon, dropdown, notifications)
- [ ] Export page (3 export types, filters, history)
- [ ] Quick actions bar
- [ ] Mobile responsive (all pages)
- [ ] Loading skeletons (all loading states)
- [ ] Micro-animations (hover effects)
- [ ] Chart animations (count up, draw)
- [ ] Component tests >70% coverage
- [ ] E2E tests passing

### **Integration**
- [ ] Platform Admin redirected to `/admin/dashboard` on login
- [ ] Metrics update on refresh
- [ ] Impersonation works (actions logged correctly)
- [ ] Feature flags affect system globally
- [ ] Maintenance mode blocks tenant access
- [ ] Alerts trigger correctly (in-app + email)
- [ ] Daily stats email sent every morning
- [ ] Exports download correctly

---

## Timeline Estimate

**Backend Development**: 4-5 days
- Dashboard metrics aggregation: 1 day
- Tenant management (CRUD, impersonation): 1 day
- Feature flags + maintenance mode: 0.5 day
- Alert system (in-app + email): 1 day
- Daily stats email job: 0.5 day
- Export system: 0.5 day
- Testing: 0.5 day

**Frontend Development**: 5-6 days
- Stunning dashboard (metrics, charts, animations): 2 days
- Tenant management (list, details, create, actions): 1.5 days
- Impersonation flow: 0.5 day
- System settings (feature flags, maintenance, global): 1 day
- Alerts UI: 0.5 day
- Export UI: 0.5 day
- Mobile responsive + polish: 0.5 day
- Testing: 0.5 day

**Integration & Testing**: 0.5 day

**Total**: 9.5-11.5 days

---

## Notes

- **Integrates with existing dashboard** - Uses `app/(dashboard)/admin` structure
- **No separate admin app** - All admin routes under `/admin`
- **Same login** - Platform Admin identified automatically
- **Mobile responsive** - Must work on phone/tablet
- **Polished animations** - Loading skeletons, hover effects, chart animations
- **Billing UI deferred** - Will add when billing module ready
- **No global search** - Not needed
- **Auto-refresh** - Every 30 seconds, no WebSocket

---

**End of Admin Panel Contract**

This contract must be approved before development begins. Final Sprint 0 module!