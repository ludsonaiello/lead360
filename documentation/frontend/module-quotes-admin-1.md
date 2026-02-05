# Admin Frontend Dev 1: Layout, Dashboard & Navigation

**Developer**: Frontend Developer 1  
**Duration**: 7 days  
**Prerequisites**: Read `ADMIN_FRONTEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Build the admin portal foundation:
- Admin layout and navigation
- Platform dashboard
- Global search
- User menu and settings

---

## COMPONENTS TO BUILD

### 1. Admin Layout (`/admin/layout.tsx`)

**Structure**:
```
<AdminLayout>
  <Sidebar /> (left, persistent)
  <MainContent>
    <TopBar />
    <Breadcrumbs />
    <PageContent>{children}</PageContent>
  </MainContent>
</AdminLayout>
```

**Sidebar Navigation**:
- Dashboard (icon + text)
- Templates (expandable)
- Global Resources (expandable)
- Analytics (expandable)
- Tenants
- Operations (expandable)
- Reports (expandable)

Active state highlighting, collapsible on tablet.

---

### 2. Platform Dashboard (`/admin/dashboard`)

**API Endpoint**: `GET /admin/quotes/dashboard/overview`

**Layout Sections**:
1. **KPI Cards** (row of 4-6 cards):
   - Total Quotes
   - Active Tenants
   - Total Revenue
   - Conversion Rate
   - Avg Quote Value
   - Quote Velocity (trend)

2. **Charts** (2 columns):
   - Left: Quote Volume Trend (line chart)
   - Right: Quote Status Distribution (pie chart)

3. **Top Tenants** (table):
   - Rank, Tenant Name, Quote Count, Revenue, Conversion Rate

**Date Range Selector**:
- Presets: Last 7 days, Last 30 days, Last 90 days, This year, Custom
- Apply button
- Refresh button

---

### 3. Quote Volume Trends Chart

**API Endpoint**: `GET /admin/quotes/dashboard/quote-trends`

**Chart Type**: Line chart (Recharts)

**Data**:
- X-axis: Date (by day, week, or month)
- Y-axis: Quote count
- Second Y-axis: Revenue (optional)

**Interactions**:
- Hover tooltip shows exact values
- Click to drill down (future)
- Download as PNG

---

### 4. Conversion Funnel Chart

**API Endpoint**: `GET /admin/quotes/dashboard/conversion-funnel`

**Chart Type**: Funnel chart

**Stages**:
1. Created
2. Sent
3. Viewed
4. Accepted

Show count and percentage at each stage.

---

### 5. Top Bar Component

**Elements**:
- Global search input
- Notification bell (badge count)
- Admin user avatar
- User menu dropdown

**User Menu**:
- Admin Profile
- Settings
- Documentation
- Logout

---

### 6. Global Search

**Functionality**:
- Search across quotes (all tenants)
- Search tenants
- Search templates
- Keyboard shortcut: Cmd/Ctrl + K

**Search Results**:
- Grouped by type
- Show tenant name for quotes
- Click to navigate

---

### 7. System Health Widget

**API Endpoint**: `GET /admin/quotes/dashboard/system-health`

**Display**:
- API Health (green/yellow/red status)
- PDF Queue Size
- Email Queue Size
- Database Performance

Expandable for details.

---

## STATE MANAGEMENT

Use React Context or Zustand:
- Current date range
- Dashboard data
- Refresh trigger
- User preferences

---

## TESTING REQUIREMENTS

Test:
- Dashboard loads with data
- Date range selection updates charts
- Navigation works
- Search finds results
- User menu actions work
- Responsive layout (desktop + tablet)

---

## DELIVERABLES

1. Admin layout component
2. Dashboard page with all sections
3. Navigation sidebar
4. Top bar and search
5. Chart components
6. KPI cards
7. System health widget
8. Tests

---

## COMPLETION CRITERIA

- Layout renders correctly
- Dashboard displays all sections
- Charts render with real data
- Navigation functional
- Search works
- Responsive design
- Tests pass