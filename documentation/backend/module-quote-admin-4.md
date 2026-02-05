# Admin Backend Dev 4: Reporting & Pricing Benchmarks

**Developer**: Backend Developer 4  
**Duration**: 7 days  
**Prerequisites**: Read `ADMIN_BACKEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Build reporting and pricing analysis:
- Global pricing benchmarks (anonymized)
- Report generation and export
- Custom report builder
- Scheduled reports

---

## API ENDPOINTS TO IMPLEMENT

### Global Pricing Benchmarks
**Endpoint**: `GET /admin/quotes/pricing/benchmarks`

**Query Parameters**:
- `item_title_contains` (search filter)
- `min_tenant_count` (default: 5, for privacy)
- `date_from`, `date_to` (optional)
- `limit` (default: 50)

**Response**:
```
{
  benchmarks: [
    {
      task_title: string,
      tenant_count: number,
      usage_count: number,
      pricing: {
        avg_price: decimal,
        min_price: decimal,
        max_price: decimal,
        median_price: decimal,
        std_deviation: decimal
      },
      price_variance: "low" | "medium" | "high"
    }
  ],
  privacy_notice: "Data anonymized, minimum 5 tenants per benchmark"
}
```

**Business Logic**:
- Group items by normalized title (case-insensitive, trim)
- Calculate statistics across tenants
- Only include if tenant_count >= min_tenant_count (privacy)
- Calculate price variance (based on std deviation)
- No tenant identification in results

---

### Generate Custom Report
**Endpoint**: `POST /admin/reports/generate`

**Request Body**:
```
{
  report_type: "tenant_performance" | "revenue_analysis" | "conversion_analysis",
  parameters: {
    date_from: string,
    date_to: string,
    tenant_ids: array | null,
    group_by: string | null
  },
  format: "csv" | "xlsx" | "pdf"
}
```

**Response**:
```
{
  job_id: string,
  status: "queued",
  estimated_completion: string
}
```

**Process**:
- Queue report generation job (BullMQ)
- Generate report asynchronously
- Store file in temporary storage
- Return download URL when complete

---

### Get Report Status
**Endpoint**: `GET /admin/reports/:jobId/status`

**Response**:
```
{
  job_id: string,
  status: "queued" | "processing" | "completed" | "failed",
  progress: number,
  download_url: string | null,
  expires_at: string | null,
  error_message: string | null
}
```

---

### Download Report
**Endpoint**: `GET /admin/reports/:jobId/download`

**Response**: File download (CSV, XLSX, or PDF)

**Business Logic**:
- Validate job belongs to admin user
- Check file exists and not expired
- Stream file to client
- Set appropriate content-type header

---

### List Scheduled Reports
**Endpoint**: `GET /admin/reports/scheduled`

**Response**:
```
{
  scheduled_reports: [
    {
      id: string,
      name: string,
      report_type: string,
      schedule: "daily" | "weekly" | "monthly",
      next_run: string,
      recipients: array,
      is_active: boolean
    }
  ]
}
```

---

### Create Scheduled Report
**Endpoint**: `POST /admin/reports/scheduled`

**Request Body**:
```
{
  name: string,
  report_type: string,
  schedule: "daily" | "weekly" | "monthly",
  parameters: object,
  format: string,
  recipients: [email addresses],
  is_active: boolean
}
```

**Process**:
- Create scheduled job in BullMQ
- Store configuration in database
- Execute at scheduled intervals

---

## REPORT TYPES

### Tenant Performance Report
- Metrics per tenant
- Quote volume
- Revenue
- Conversion rates
- Trends

### Revenue Analysis Report
- Revenue by vendor
- Revenue by item category
- Revenue trends over time
- Top revenue-generating items

### Conversion Analysis Report
- Funnel metrics
- Drop-off analysis
- Time-to-conversion
- Conversion by tenant

---

## SERVICE LAYER

Create `AdminReportingService`:

**Methods**:
- `generatePricingBenchmarks(filters)`
- `queueReportGeneration(reportType, parameters, format, adminUserId)`
- `getReportStatus(jobId)`
- `generateTenantPerformanceReport(params)`
- `generateRevenueAnalysisReport(params)`
- `generateConversionAnalysisReport(params)`
- `exportToCSV(data)`
- `exportToXLSX(data)`
- `exportToPDF(data)`

---

## DATA ANONYMIZATION

**Privacy Requirements**:
- Never expose individual tenant pricing
- Minimum threshold: 5 tenants per benchmark
- Aggregate statistics only
- No outlier identification by tenant

---

## BACKGROUND JOBS

Use BullMQ for report generation:

**Job Types**:
- `generate-report` (one-time)
- `scheduled-report` (recurring)

**Job Data**:
- Report type
- Parameters
- Format
- Admin user ID
- Tenant filters

---

## TESTING REQUIREMENTS

### Unit Tests
- Test pricing benchmark calculation
- Test anonymization logic
- Test report generation
- Test CSV/XLSX/PDF export

### Integration Tests
- Generate each report type
- Test large datasets (1000+ quotes)
- Test scheduled report execution
- Test file download

---

## DELIVERABLES

1. `AdminReportingController` (6 endpoints)
2. `AdminReportingService`
3. Report generation jobs
4. Export utilities (CSV, XLSX, PDF)
5. Scheduled report system
6. Tests
7. Documentation

---

## COMPLETION CRITERIA

- All 6 endpoints functional
- Pricing benchmarks accurate and anonymized
- Report generation works
- Exports generate correctly
- Scheduled reports execute
- Tests pass