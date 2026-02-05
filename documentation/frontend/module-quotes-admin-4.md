# Admin Frontend Dev 4: Analytics & Reporting UI

**Developer**: Frontend Developer 4  
**Duration**: 7 days  
**Prerequisites**: Read `ADMIN_FRONTEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Build analytics and reporting interfaces:
- Tenant comparison tools
- Pricing benchmarks
- Revenue analytics
- Report generation
- Report scheduling

---

## PAGES TO BUILD

### 1. Tenant Comparison (`/admin/analytics/tenants`)

**API Endpoint**: `GET /admin/tenants/compare`

**Layout**:
- Metric selector: Quote Count, Revenue, Conversion Rate, Avg Quote Value
- Limit selector: Top 10, 20, 50
- Date range selector
- Apply button

**Results Table**:
- Rank, Tenant Name, Metric Value, Quote Count, Revenue, Conversion Rate
- Sortable columns
- Export to CSV button

**Visualization**:
- Bar chart showing top tenants
- Hover for details

---

### 2. Pricing Benchmarks (`/admin/analytics/pricing`)

**API Endpoint**: `GET /admin/quotes/pricing/benchmarks`

**Filters**:
- Search by item title
- Date range
- Minimum tenant count (default: 5)

**Results Table**:
- Task Title, Tenant Count, Usage Count, Avg Price, Min Price, Max Price, Median, Variance

**Price Distribution Chart** (per item):
- Box plot or histogram
- Shows price range and distribution

**Privacy Notice**: "Data anonymized. Minimum 5 tenants per benchmark."

---

### 3. Revenue Analytics (`/admin/analytics/revenue`)

**API Endpoint**: `GET /admin/quotes/dashboard/revenue-analytics`

**Metrics**:
- Total revenue (big number)
- Revenue by vendor (table)
- Revenue by tenant (table)
- Revenue trend chart (line chart over time)

**Filters**:
- Date range
- Group by: Vendor, Tenant, None

**Export**: CSV, XLSX, PDF

---

### 4. Report Generator (`/admin/reports/generate`)

**API Endpoint**: `POST /admin/reports/generate`

**Form**:

**Report Type** (select):
- Tenant Performance
- Revenue Analysis
- Conversion Analysis

**Parameters** (dynamic based on type):
- Date range (from/to)
- Tenant filter (multi-select or "All")
- Group by (if applicable)

**Format** (radio):
- CSV
- XLSX
- PDF

**Generate Button**: Queues job

**Response**:
- "Report queued. Job ID: XXX"
- Link to: `/admin/reports/:jobId/status`

---

### 5. Report Status Page (`/admin/reports/:jobId/status`)

**API Endpoint**: `GET /admin/reports/:jobId/status`

**Display**:
- Job ID
- Report type
- Status badge (Queued, Processing, Completed, Failed)
- Progress bar (if processing)
- Estimated completion time

**When Completed**:
- Download button
- File size
- Expiration time
- "Delete Report" button

**Auto-refresh**: Poll every 5 seconds while processing

---

### 6. Scheduled Reports (`/admin/reports/scheduled`)

**API Endpoints**: 
- `GET /admin/reports/scheduled`
- `POST /admin/reports/scheduled`
- `DELETE /admin/reports/scheduled/:id`

**List View**:
- Report name
- Type
- Schedule (Daily, Weekly, Monthly)
- Next run time
- Recipients (email addresses)
- Active/Inactive toggle
- Actions: Edit, Delete, Run Now

**Create Scheduled Report Form**:
- Name (e.g., "Weekly Tenant Performance")
- Report type (select)
- Schedule (dropdown)
- Report parameters
- Format
- Recipients (email list)
- Active toggle
- Save button

---

## CHARTS TO BUILD

### Bar Chart Component
**Use Case**: Tenant comparison, revenue by vendor

**Features**:
- Horizontal or vertical bars
- Color-coded
- Interactive tooltips
- Click to drill down (optional)

### Line Chart Component
**Use Case**: Revenue trends, quote volume over time

**Features**:
- Multiple series (if needed)
- Legend
- Grid lines
- Zoom/pan (optional)

### Box Plot Component
**Use Case**: Pricing distribution

**Features**:
- Shows min, max, median, quartiles
- Outliers marked
- Hover for exact values

---

## EXPORT FUNCTIONALITY

### Export Button Component

**Triggers**:
- CSV export (instant download)
- XLSX export (instant download)
- PDF export (may queue job if large)

**Implementation**:
- CSV: Generate client-side, download
- XLSX: Generate client-side (use library like xlsx)
- PDF: Call backend API endpoint

---

## POLLING IMPLEMENTATION

For report status page:

```typescript
useEffect(() => {
  if (status === 'processing' || status === 'queued') {
    const interval = setInterval(async () => {
      const updated = await fetchReportStatus(jobId);
      setStatus(updated.status);
      if (updated.status === 'completed' || updated.status === 'failed') {
        clearInterval(interval);
      }
    }, 5000);
    return () => clearInterval(interval);
  }
}, [status, jobId]);
```

---

## TESTING REQUIREMENTS

Test:
- Tenant comparison with different metrics
- Pricing benchmarks display
- Revenue analytics charts
- Report generation (all types and formats)
- Report status polling
- Scheduled report creation
- Export functionality (CSV, XLSX, PDF)

---

## DELIVERABLES

1. Tenant comparison page
2. Pricing benchmarks page
3. Revenue analytics page
4. Report generator page
5. Report status page
6. Scheduled reports page
7. Chart components
8. Export utilities
9. Tests

---

## COMPLETION CRITERIA

- All analytics pages functional
- Charts render with real data
- Report generation works
- Polling updates status correctly
- Exports download correctly
- Scheduled reports can be created
- Tests pass