# Frontend Module: Admin Panel

**Module Name**: Platform Admin Dashboard & Management  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/admin-panel-contract.md`  
**Backend Module**: `/documentation/backend/module-admin-panel.md`  
**Agent**: Frontend Specialist  
**Status**: Ready for Development (AFTER backend complete)

---

## Overview

This module implements a **stunning**, **mobile-responsive** admin panel with animated dashboard, tenant management with impersonation, system settings, real-time alerts, and data export. Focus on polish, performance, and user experience.

**CRITICAL**: Do NOT start until backend Admin Panel module is 100% complete and API documentation is available.

**Read First**:
- `/documentation/contracts/admin-panel-contract.md` (admin panel requirements)
- `/documentation/backend/module-admin-panel.md` (API endpoints)
- Backend API documentation (Swagger)

---

## Technology Stack

**Required Libraries**:
- **Charts**: recharts (animated charts)
- **Animations**: framer-motion (micro-animations)
- **Numbers**: react-countup (animated counters)
- **Forms**: react-hook-form + zod
- **Dates**: date-fns or dayjs
- **UI**: @headlessui/react (modals, dropdowns)
- **Icons**: lucide-react
- **Tables**: @tanstack/react-table (sortable, filterable)
- **Export**: file-saver (download files)

---

## Project Structure

```
app/
├── (dashboard)/
│   ├── admin/
│   │   ├── dashboard/
│   │   │   └── page.tsx (main dashboard)
│   │   ├── tenants/
│   │   │   ├── page.tsx (tenant list)
│   │   │   ├── [id]/
│   │   │   │   └── page.tsx (tenant details)
│   │   │   └── create/
│   │   │       └── page.tsx (create tenant)
│   │   ├── users/
│   │   │   └── page.tsx (user list)
│   │   ├── settings/
│   │   │   └── page.tsx (system settings)
│   │   ├── alerts/
│   │   │   └── page.tsx (alerts list)
│   │   ├── exports/
│   │   │   └── page.tsx (data export)
│   │   ├── jobs/
│   │   │   └── [...] (already exists from Background Jobs module)
│   │   └── files/
│   │       └── [...] (already exists from File Storage module)
│   └── layout.tsx (existing dashboard layout)
├── components/
│   ├── admin/
│   │   ├── dashboard/
│   │   │   ├── MetricCard.tsx
│   │   │   ├── TenantGrowthChart.tsx
│   │   │   ├── UserSignupsChart.tsx
│   │   │   ├── JobTrendsChart.tsx
│   │   │   ├── DistributionChart.tsx
│   │   │   ├── ActivityFeed.tsx
│   │   │   ├── QuickActionsBar.tsx
│   │   │   └── SystemHealthCard.tsx
│   │   ├── tenants/
│   │   │   ├── TenantTable.tsx
│   │   │   ├── TenantFilters.tsx
│   │   │   ├── TenantDetailsCard.tsx
│   │   │   ├── TenantUsersTab.tsx
│   │   │   ├── TenantActivityTab.tsx
│   │   │   ├── TenantActionsMenu.tsx
│   │   │   ├── CreateTenantForm.tsx
│   │   │   ├── ImpersonationModal.tsx
│   │   │   ├── SuspendTenantModal.tsx
│   │   │   └── DeleteTenantModal.tsx
│   │   ├── users/
│   │   │   ├── UserTable.tsx
│   │   │   ├── UserFilters.tsx
│   │   │   ├── UserDetailModal.tsx
│   │   │   └── ForceResetPasswordModal.tsx
│   │   ├── settings/
│   │   │   ├── FeatureFlagCard.tsx
│   │   │   ├── MaintenanceModeCard.tsx
│   │   │   ├── GlobalSettingsForm.tsx
│   │   │   └── SettingsSection.tsx
│   │   ├── alerts/
│   │   │   ├── AlertsBell.tsx
│   │   │   ├── AlertsDropdown.tsx
│   │   │   ├── AlertItem.tsx
│   │   │   └── AlertsList.tsx
│   │   ├── exports/
│   │   │   ├── ExportForm.tsx
│   │   │   ├── ExportHistory.tsx
│   │   │   └── ExportFilters.tsx
│   │   └── shared/
│   │       ├── LoadingSkeleton.tsx
│   │       ├── EmptyState.tsx
│   │       ├── ConfirmationModal.tsx
│   │       └── ImpersonationBanner.tsx
│   └── ui/
├── lib/
│   ├── api/
│   │   ├── admin-dashboard.ts
│   │   ├── admin-tenants.ts
│   │   ├── admin-users.ts
│   │   ├── admin-settings.ts
│   │   ├── admin-alerts.ts
│   │   └── admin-exports.ts
│   ├── hooks/
│   │   ├── useAdminDashboard.ts
│   │   ├── useAdminTenants.ts
│   │   ├── useAdminUsers.ts
│   │   ├── useImpersonation.ts
│   │   ├── useFeatureFlags.ts
│   │   └── useAdminAlerts.ts
│   ├── utils/
│   │   ├── chart-helpers.ts
│   │   ├── export-helpers.ts
│   │   └── admin-helpers.ts
│   └── types/
│       └── admin.ts
```

---

## Design System

### **Color Palette** (Using Existing Dashboard Theme)

Keep existing visual identity:
- Primary: Your existing brand color
- Success: Green (#10b981)
- Warning: Yellow (#f59e0b)
- Error: Red (#ef4444)
- Info: Blue (#3b82f6)

**Glass Morphism Accent** (for metric cards):
- Background: rgba(255, 255, 255, 0.05)
- Border: rgba(255, 255, 255, 0.1)
- Backdrop blur: 10px

---

### **Typography**

Use existing font stack:
- Headings: font-semibold
- Body: font-normal
- Metrics: font-bold, text-3xl

---

## Dashboard Components

### **MetricCard Component**

**Location**: `components/admin/dashboard/MetricCard.tsx`

**Purpose**: Display single metric with growth indicator and sparkline

**Props**:
- title (string)
- value (number)
- growth (object: { count, percentage, trend })
- sparklineData (array of numbers)
- icon (ReactNode)
- status ('healthy' | 'warning' | 'critical', optional)

**Layout**:
```
┌─────────────────────────────────────┐
│ 📊 Active Tenants            [Icon] │
│                                     │
│ 245                         ↗ +5.1% │
│ +12 this month                      │
│                                     │
│ [Sparkline Chart] ▁▂▃▅▇▇▇▇         │
└─────────────────────────────────────┘
```

**Features**:
- **Animated counter**: Count up from 0 to actual value (react-countup)
- **Sparkline**: Mini line chart (recharts LineChart)
- **Growth badge**: Color-coded (green up, red down)
- **Hover effect**: Scale 1.02, shadow increase
- **Glass morphism**: Subtle background blur
- **Loading skeleton**: Shimmer effect while loading

**Implementation**:
```tsx
<motion.div
  whileHover={{ scale: 1.02 }}
  className="glass-card p-6"
>
  <div className="flex justify-between items-start mb-4">
    <h3 className="text-sm text-gray-400">{title}</h3>
    <div className="text-gray-400">{icon}</div>
  </div>
  
  <div className="flex items-baseline gap-3 mb-2">
    <CountUp
      end={value}
      duration={1}
      className="text-3xl font-bold"
    />
    {growth && (
      <Badge color={growth.trend === 'up' ? 'green' : 'red'}>
        {growth.trend === 'up' ? '↗' : '↘'} {growth.percentage}%
      </Badge>
    )}
  </div>
  
  <p className="text-sm text-gray-400 mb-4">
    {growth.count > 0 ? '+' : ''}{growth.count} this month
  </p>
  
  <ResponsiveContainer width="100%" height={40}>
    <LineChart data={sparklineData}>
      <Line
        type="monotone"
        dataKey="value"
        stroke="#10b981"
        strokeWidth={2}
        dot={false}
        animationDuration={800}
      />
    </LineChart>
  </ResponsiveContainer>
</motion.div>
```

---

### **TenantGrowthChart Component**

**Location**: `components/admin/dashboard/TenantGrowthChart.tsx`

**Purpose**: Line chart showing tenant growth over 90 days

**Props**:
- data (array of { date, new_tenants, cumulative })

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ Tenant Growth (Last 90 Days)                           │
│                                                         │
│ 300 ┤                                        ╭──────   │
│     │                              ╭────────╯          │
│ 250 ┤                    ╭────────╯                    │
│     │          ╭────────╯                              │
│ 200 ┤ ╭───────╯                                        │
│     └───────────────────────────────────────────────   │
│     Jan      Feb      Mar      Apr      May            │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **Dual lines**: New tenants per day (area) + Cumulative (line)
- **Gradient fill**: Area chart with gradient
- **Animated**: Draw from left to right (0.8s ease-out)
- **Tooltip**: Hover shows exact values
- **Responsive**: Full width, adjusts to container

**Implementation**:
```tsx
<ResponsiveContainer width="100%" height={300}>
  <AreaChart data={data}>
    <defs>
      <linearGradient id="tenantGradient" x1="0" y1="0" x2="0" y2="1">
        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
      </linearGradient>
    </defs>
    <XAxis dataKey="date" />
    <YAxis />
    <Tooltip />
    <Area
      type="monotone"
      dataKey="new_tenants"
      stroke="#3b82f6"
      fill="url(#tenantGradient)"
      animationDuration={800}
    />
    <Line
      type="monotone"
      dataKey="cumulative"
      stroke="#10b981"
      strokeWidth={2}
      animationDuration={800}
    />
  </AreaChart>
</ResponsiveContainer>
```

---

### **DistributionChart Component**

**Location**: `components/admin/dashboard/DistributionChart.tsx`

**Purpose**: Pie/Donut chart for distribution data

**Props**:
- data (array of { name, value, color })
- title (string)
- type ('pie' | 'donut')

**Layout**:
```
┌────────────────────────────────────────┐
│ Tenants by Industry                    │
│                                        │
│       ╭─────╮                          │
│    ╭──┤     │──╮                       │
│   │   │  ●  │   │    Painting  45%    │
│   │   │     │   │    Gutter    30%    │
│    ╰──┤     │──╯     Cleaning  15%    │
│       ╰─────╯        Other     10%    │
└────────────────────────────────────────┘
```

**Features**:
- **Animated**: Grow from center (0.8s ease-out)
- **Interactive**: Hover highlights segment
- **Legend**: Shows percentages
- **Colors**: Auto-assigned or custom

---

### **ActivityFeed Component**

**Location**: `components/admin/dashboard/ActivityFeed.tsx`

**Purpose**: Show last 10 actions in real-time

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ Recent Activity                                         │
│                                                         │
│ ● New tenant: ABC Painting signed up                   │
│   2 minutes ago                                         │
│                                                         │
│ ● User registered: john@example.com joined XYZ LLC     │
│   5 minutes ago                                         │
│                                                         │
│ ● Job failed: SendEmailJob failed after 3 attempts     │
│   10 minutes ago                                        │
│                                                         │
│ [View All Activity →]                                  │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **Real-time**: Auto-refresh every 30 seconds
- **Color-coded**: Green (created), Red (failed), Blue (updated)
- **Relative time**: "2 minutes ago" (updates live)
- **Clickable**: Links to relevant page
- **Scrollable**: Max 10 items, scroll for more

---

### **QuickActionsBar Component**

**Location**: `components/admin/dashboard/QuickActionsBar.tsx`

**Purpose**: Quick access to common admin actions

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ [+ Create Tenant] [👀 Jobs] [❌ Failed Jobs]          │
│ [🔧 System Health] [📋 Activity]                      │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **Icon buttons**: Descriptive icons + text
- **Hover animation**: Scale 1.05
- **Responsive**: Stack vertically on mobile

---

## Tenant Management Components

### **TenantTable Component**

**Location**: `components/admin/tenants/TenantTable.tsx`

**Purpose**: Sortable, filterable table of all tenants

**Columns**:
1. Subdomain (link)
2. Business Name
3. Status (badge)
4. Owner (name + email)
5. Users (count)
6. Created (date)
7. Last Active (relative time)
8. Actions (dropdown)

**Features**:
- **Sortable**: Click column header to sort
- **Filterable**: Search, status filter, date range
- **Pagination**: 50 per page
- **Bulk actions**: Checkbox selection
- **Row hover**: Highlight on hover
- **Mobile**: Transforms to cards on mobile

**Desktop**:
```
┌──────────────────────────────────────────────────────────┐
│ [☐] Subdomain  Business   Status Owner  Users Created   │
├──────────────────────────────────────────────────────────┤
│ [☐] abc-paint  ABC Paint  ✓ Active John 12  Jan 5      │
│ [☐] xyz-llc    XYZ LLC    ⏸ Susp.  Jane  5   Jan 3      │
└──────────────────────────────────────────────────────────┘
```

**Mobile** (transforms to cards):
```
┌──────────────────────────────────────┐
│ ABC Painting                          │
│ abc-painting                          │
│ Status: ✓ Active                     │
│ Owner: John Doe (john@abc.com)       │
│ Users: 12 | Created: Jan 5, 2025     │
│ [View] [Actions ▾]                   │
└──────────────────────────────────────┘
```

---

### **CreateTenantForm Component**

**Location**: `components/admin/tenants/CreateTenantForm.tsx`

**Purpose**: Multi-step form to create tenant manually

**Steps**:
1. Business Information
2. Owner Information
3. Initial Settings
4. Review

**Layout** (Step 1):
```
┌────────────────────────────────────────────────────────┐
│ Create Tenant                                           │
│ ● Business Info  ○ Owner Info  ○ Settings  ○ Review   │
│                                                         │
│ Business Information                                    │
│                                                         │
│ Business Name *                                         │
│ [ABC Painting Company                ]                 │
│                                                         │
│ Subdomain *                                            │
│ [abc-painting                        ].lead360.com     │
│ ✓ Available                                            │
│                                                         │
│ Industry (optional)                                     │
│ [Painting ▾                          ]                 │
│                                                         │
│ [Cancel] [Next →]                                      │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **Step indicator**: Progress bar
- **Real-time validation**: Subdomain availability check
- **Auto-generate**: Subdomain from business name
- **Review step**: Confirm all details before submit
- **Loading state**: Submit button shows spinner

---

### **ImpersonationModal Component**

**Location**: `components/admin/tenants/ImpersonationModal.tsx`

**Purpose**: Select user to impersonate

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ Login as Tenant User                            [Close]│
│                                                         │
│ Select user to impersonate:                            │
│                                                         │
│ ○ John Doe (john@abc.com) - Owner                     │
│ ○ Jane Smith (jane@abc.com) - Admin                   │
│ ○ Bob Johnson (bob@abc.com) - Bookkeeper              │
│                                                         │
│ ⚠️ Warning: All actions will be tracked in audit log  │
│                                                         │
│ [Cancel] [Login as Selected User]                     │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **User list**: Radio buttons
- **Warning**: Clear notice about tracking
- **Confirmation**: Two-step process (select → confirm)

**After Impersonation**:
- **Banner**: Fixed top banner
- **Content**: "⚠️ Impersonating John Doe | [Exit Impersonation]"
- **Color**: Yellow background, prominent
- **Always visible**: Sticks to top on scroll

---

## System Settings Components

### **FeatureFlagCard Component**

**Location**: `components/admin/settings/FeatureFlagCard.tsx`

**Purpose**: Display and toggle single feature flag

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ [✓] File Storage                              [Toggle] │
│     Allow tenants to upload files                      │
│     Last updated: Jan 5, 2025 by Admin                │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **Toggle switch**: Instant update (no save button)
- **Confirmation**: Critical flags (User Registration, Maintenance Mode) show confirmation modal
- **Visual feedback**: Checkmark animates on toggle
- **Loading**: Disable toggle while updating

---

### **MaintenanceModeCard Component**

**Location**: `components/admin/settings/MaintenanceModeCard.tsx`

**Purpose**: Configure maintenance mode

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ Maintenance Mode                                        │
│                                                         │
│ Status: [○ Disabled ● Enabled]                         │
│                                                         │
│ Mode:                                                   │
│ ○ Immediate - Start now                               │
│ ● Scheduled - Set time window                         │
│                                                         │
│ Schedule:                                              │
│ Start: [Jan 10, 2025 02:00 AM ▾]                      │
│ End:   [Jan 10, 2025 06:00 AM ▾]                      │
│                                                         │
│ Message:                                               │
│ [Lead360 is undergoing maintenance...    ]            │
│                                                         │
│ Allowed IPs: (your team can still access)             │
│ [203.0.113.1, 203.0.113.2               ]            │
│                                                         │
│ [Cancel] [Save & Activate]                            │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **DateTime picker**: react-datepicker
- **Preview**: Show maintenance page preview
- **Validation**: End time must be after start time

---

### **GlobalSettingsForm Component**

**Location**: `components/admin/settings/GlobalSettingsForm.tsx`

**Purpose**: Update all global system settings

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ Global Settings                                         │
│                                                         │
│ File Storage                                           │
│ ├─ Max File Upload Size: [10  ] MB                    │
│ └─ Max Storage Per Tenant: [500 ] GB                  │
│                                                         │
│ Security                                               │
│ ├─ Session Timeout: [30  ] minutes                    │
│ ├─ Password Reset Expiry: [24  ] hours                │
│ ├─ Max Failed Login Attempts: [5   ]                  │
│ └─ Lockout Duration: [15  ] minutes                   │
│                                                         │
│ Data Retention                                         │
│ ├─ Job Retention: [30  ] days                         │
│ └─ Audit Log Retention: [90  ] days                   │
│                                                         │
│ [Cancel] [Save Settings]                               │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **Grouped sections**: Collapsible accordions
- **Input validation**: Min/max values, required fields
- **Dirty check**: Prompt if unsaved changes
- **Success toast**: "Settings saved successfully!"

---

## Alerts Components

### **AlertsBell Component**

**Location**: `components/admin/alerts/AlertsBell.tsx`

**Purpose**: Bell icon in header with unread count

**Layout**:
```
[Header]  [🔔 3]  [Profile ▾]
```

**Features**:
- **Badge**: Red badge with unread count
- **Animation**: Bell shakes on new notification
- **Click**: Opens AlertsDropdown

---

### **AlertsDropdown Component**

**Location**: `components/admin/alerts/AlertsDropdown.tsx`

**Purpose**: Dropdown showing recent notifications

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ Notifications                      [Mark All as Read]  │
├────────────────────────────────────────────────────────┤
│ ● New tenant: ABC Painting signed up                   │
│   5 minutes ago                               [×]      │
│                                                         │
│ ⚠ Storage limit: XYZ LLC at 90% (450 GB / 500 GB)    │
│   2 hours ago                                 [×]      │
│                                                         │
│ ⚠ Job spike: 15% failure rate in last hour           │
│   1 hour ago                                  [×]      │
├────────────────────────────────────────────────────────┤
│ [View All Notifications →]                             │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **Max 10 items**: Show most recent
- **Click**: Navigate to relevant page
- **Delete**: × button removes notification
- **Mark all**: Batch action
- **Auto-refresh**: Every 30 seconds

---

## Export Components

### **ExportForm Component**

**Location**: `components/admin/exports/ExportForm.tsx`

**Purpose**: Configure and generate export

**Layout**:
```
┌────────────────────────────────────────────────────────┐
│ Export Data                                             │
│                                                         │
│ Export Type:                                           │
│ ● Tenants  ○ Users  ○ Audit Logs                      │
│                                                         │
│ Format:                                                │
│ ● CSV  ○ PDF                                          │
│                                                         │
│ Filters:                                               │
│ Status: [All ▾]                                        │
│ Date Range: [Last 30 Days ▾]                          │
│                                                         │
│ Estimated rows: 245 tenants                           │
│                                                         │
│ [Download CSV]                                         │
│                                                         │
│ ⓘ Large exports may take a few minutes                │
└────────────────────────────────────────────────────────┘
```

**Features**:
- **Real-time estimate**: Show row count as filters change
- **Progress**: Show progress bar during generation
- **Auto-download**: Download starts when ready
- **Error handling**: Show error if export fails

---

## Loading Skeletons

**Replace all spinners with content-aware skeletons**:

### **MetricCard Skeleton**:
```
┌─────────────────────────────────┐
│ [████████     ]                 │
│                                 │
│ [████         ]     [███]      │
│ [███████      ]                 │
│                                 │
│ [▁▂▃▅▇▇▇▇]                     │
└─────────────────────────────────┘
```

### **Table Skeleton**:
```
┌──────────────────────────────────────┐
│ [████] [████] [████] [████] [████]  │
├──────────────────────────────────────┤
│ [███]  [███]  [███]  [███]  [███]   │
│ [████] [████] [████] [████] [████]  │
│ [███]  [███]  [███]  [███]  [███]   │
└──────────────────────────────────────┘
```

**Implementation**:
```tsx
<div className="animate-pulse">
  <div className="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
  <div className="h-8 bg-gray-700 rounded w-1/2 mb-2"></div>
  <div className="h-3 bg-gray-700 rounded w-2/3"></div>
</div>
```

---

## Micro-Animations

### **Hover Effects**:
```tsx
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
>
  Create Tenant
</motion.button>
```

### **Card Lift**:
```tsx
<motion.div
  whileHover={{ 
    y: -2,
    boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)"
  }}
>
  {children}
</motion.div>
```

### **Icon Bounce**:
```tsx
<motion.div
  whileHover={{ 
    rotate: [0, -10, 10, -10, 0],
    transition: { duration: 0.5 }
  }}
>
  🔔
</motion.div>
```

---

## Mobile Responsive Design

### **Breakpoints**:
```tsx
// Tailwind config
screens: {
  'sm': '640px',
  'md': '768px',
  'lg': '1024px',
  'xl': '1280px',
}
```

### **Dashboard Layout**:

**Desktop** (>1024px):
- 3-column grid for metric cards
- Charts side-by-side (2 columns)
- Activity feed in sidebar

**Tablet** (768px-1024px):
- 2-column grid for metric cards
- Charts stack vertically
- Activity feed below charts

**Mobile** (<768px):
- Single column
- Metric cards stack
- Charts full-width, scrollable
- Hamburger menu

### **Table → Cards**:

**Desktop**: Table with all columns

**Mobile**: Transform to cards:
```
┌──────────────────────────────┐
│ ABC Painting                  │
│ abc-painting                  │
│ ✓ Active                      │
│ Owner: John Doe               │
│ 12 users | Jan 5, 2025        │
│ [View] [Actions ▾]           │
└──────────────────────────────┘
```

### **Touch-Friendly**:
- Min button height: 44px
- Increase padding on mobile
- Swipe gestures for navigation
- Bottom navigation bar on mobile

---

## Pages

### **Admin Dashboard** (`/admin/dashboard`)

**Layout**:
```
[Header with AlertsBell]

[QuickActionsBar]

[6 MetricCards in 3-column grid]

[Charts Section]
├─ [TenantGrowthChart] [UserSignupsChart]
└─ [JobTrendsChart] [DistributionChart]

[ActivityFeed in sidebar OR below on mobile]
```

**Auto-refresh**: Every 30 seconds (metrics only, not charts)

---

### **Tenant List** (`/admin/tenants`)

**Layout**:
```
[Header: "Tenants"]

[Actions Bar]
├─ [+ Create Tenant] [Export] [Bulk Actions]

[TenantFilters]

[TenantTable]

[Pagination]
```

---

### **Tenant Details** (`/admin/tenants/:id`)

**Layout**:
```
[Header: "ABC Painting"]
[Subdomain: abc-painting]

[Action Buttons]
├─ [🎭 Login as Tenant] [Edit] [Suspend] [Delete]

[Tabs]
├─ Overview (default)
├─ Users
├─ Activity
├─ Files
└─ Jobs

[Tab Content]
```

---

### **Create Tenant** (`/admin/tenants/create`)

**Layout**:
```
[Header: "Create Tenant"]

[StepIndicator: 1 of 4]

[CreateTenantForm]
```

---

### **System Settings** (`/admin/settings`)

**Layout**:
```
[Header: "System Settings"]

[Tabs]
├─ Feature Flags
├─ Maintenance Mode
└─ Global Settings

[Tab Content]
```

---

## Testing Requirements

### **Component Tests** (>70% coverage)

1. **MetricCard**
   - ✅ Renders value correctly
   - ✅ Counter animates
   - ✅ Growth badge shows correct color

2. **TenantTable**
   - ✅ Renders all tenants
   - ✅ Sorting works
   - ✅ Filters work
   - ✅ Pagination works

3. **CreateTenantForm**
   - ✅ Validation works
   - ✅ Subdomain availability check
   - ✅ Submit creates tenant

4. **ImpersonationModal**
   - ✅ Lists users
   - ✅ Confirmation works
   - ✅ Creates impersonation session

5. **FeatureFlagCard**
   - ✅ Toggle updates flag
   - ✅ Confirmation for critical flags

---

### **E2E Tests**

1. **Dashboard**
   - ✅ Platform Admin logs in → Redirected to `/admin/dashboard`
   - ✅ All metrics load
   - ✅ Charts render

2. **Tenant Management**
   - ✅ View tenants → Click tenant → View details
   - ✅ Create tenant → Form validates → Tenant created
   - ✅ Impersonate user → View as tenant → Actions tracked → Exit

3. **System Settings**
   - ✅ Toggle feature flag → Flag updated
   - ✅ Enable maintenance mode → Tenant users see maintenance page

4. **Alerts**
   - ✅ New alert → Bell shows badge → Click → View notification

---

## Completion Checklist

- [ ] All TypeScript interfaces
- [ ] All API clients
- [ ] All hooks (6 hooks)
- [ ] All dashboard components (8 components)
- [ ] All tenant components (9 components)
- [ ] All user components (4 components)
- [ ] All settings components (4 components)
- [ ] All alert components (4 components)
- [ ] All export components (3 components)
- [ ] All shared components (4 components)
- [ ] Dashboard page (stunning, animated)
- [ ] Tenant list page
- [ ] Tenant details page (5 tabs)
- [ ] Create tenant page (multi-step)
- [ ] User list page
- [ ] System settings page (3 tabs)
- [ ] Alerts page
- [ ] Export page
- [ ] Impersonation banner (top)
- [ ] Loading skeletons (all loading states)
- [ ] Micro-animations (hover, click)
- [ ] Chart animations (count up, draw)
- [ ] Mobile responsive (all pages)
- [ ] Touch-friendly (44px min buttons)
- [ ] Component tests >70%
- [ ] E2E tests passing

---

## Performance Checklist

- [ ] Lazy load charts (react-lazy)
- [ ] Debounce search (500ms)
- [ ] Memoize expensive calculations
- [ ] Virtual scrolling for long lists
- [ ] Code splitting (per page)
- [ ] Optimize images (WebP)
- [ ] Cache API responses (React Query or SWR)

---

## Accessibility Checklist

- [ ] Keyboard navigation (all interactive elements)
- [ ] Screen reader support (ARIA labels)
- [ ] Focus indicators
- [ ] Color contrast WCAG AA
- [ ] Error messages announced
- [ ] Modal focus trap

---

**End of Frontend Module Documentation**

This is the crown jewel of Sprint 0. Make it **stunning**, **fast**, and **bulletproof**! 🚀