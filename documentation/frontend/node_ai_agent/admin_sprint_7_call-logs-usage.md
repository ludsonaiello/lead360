# Voice AI Frontend - Sprint 7: Call Logs & Usage Reports (ADMIN)

**Sprint Type**: Admin Interface
**Route**: `/admin/voice-ai/reports`
**Permission**: Platform Admin
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 961-1053)

---

## 🎯 MASTERPIECE DEVELOPER

### ⚠️ CRITICAL RULES

1-7: NO GUESSING | VERIFY ENDPOINTS | localhost:8000 | ASK HUMAN | NO BACKEND EDITS | ALL FIELDS | ERROR HANDLING

---

## 📋 Test Credentials

Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## 🔍 Endpoint Verification

```bash
# GET cross-tenant call logs
curl -X GET "http://localhost:8000/api/v1/system/voice-ai/call-logs?tenantId=<id>&from=2026-02-01&to=2026-02-28&outcome=lead_created&page=1&limit=20" \
  -H "Authorization: Bearer <token>"

# GET usage report
curl -X GET "http://localhost:8000/api/v1/system/voice-ai/usage-report?year=2026&month=2" \
  -H "Authorization: Bearer <token>"
```

---

## 📦 Data Models

```typescript
interface CallLog {
  id: string;
  tenant_id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  direction: 'inbound' | 'outbound';
  status: 'completed' | 'failed' | 'in_progress' | 'transferred';
  outcome: 'lead_created' | 'transferred' | 'abandoned' | 'completed' | null;
  is_overage: boolean;
  duration_seconds: number;
  transcript_summary: string | null;
  full_transcript: string | null;
  actions_taken: string | null;
  lead_id: string | null;
  stt_provider_id: string | null;
  llm_provider_id: string | null;
  tts_provider_id: string | null;
  started_at: Date;
  ended_at: Date | null;
  created_at: Date;
}

interface UsageReport {
  year: number;
  month: number;
  total_calls: number;
  total_stt_seconds: number;
  total_estimated_cost: number;
  by_tenant: Array<{
    tenant_id: string;
    tenant_name: string;
    total_calls: number;
    total_stt_seconds: number;
    estimated_cost: number;
  }>;
}
```

---

## 🏗️ Implementation

### Files

```
admin/voice-ai/
├── reports/
│   ├── page.tsx                    # Main reports page
│   ├── call-logs/
│   │   └── page.tsx                # Call logs with filters
│   └── usage/
│       └── page.tsx                # Usage analytics
```

### Components

```
voice-ai/admin/
├── reports/
│   ├── CallLogsTable.tsx           # Paginated logs table
│   ├── CallLogFilters.tsx          # Filter controls
│   ├── CallDetailModal.tsx         # Full transcript modal
│   ├── UsageDashboard.tsx          # Usage KPIs
│   ├── UsageChart.tsx              # Usage trends chart
│   └── TenantBreakdown.tsx         # Per-tenant usage table
```

---

## 📋 Implementation Tasks

### 1. Call Logs Page

**Filters**:
- [ ] **tenantId** (Dropdown, all tenants)
- [ ] **from** (Date picker, start date)
- [ ] **to** (Date picker, end date)
- [ ] **outcome** (Select: lead_created, transferred, abandoned)
- [ ] **status** (Select: completed, failed, in_progress, transferred)
- [ ] **page** (Pagination controls)
- [ ] **limit** (Items per page: 20, 50, 100)

**Table Columns**:
| Timestamp | Tenant | Caller | Status | Outcome | Duration | Actions |
|-----------|--------|--------|--------|---------|----------|---------|
| 2026-02-22 14:30 | Mr Patch | +1555... | Completed | Lead Created | 2m 30s | [View Details] |

**Features**:
- [ ] Pagination (page/limit)
- [ ] Export to CSV button
- [ ] "View Details" opens modal with full transcript
- [ ] Overage badge (if is_overage = true)
- [ ] Lead link (if lead_id exists)

---

### 2. Call Detail Modal

**Display**:
```
Call Details
────────────────────────────────────────────────

Call SID: test-sid-A09-review
Tenant: Mr Patch Asphalt
From: +15551234567
To: +15559999999
Direction: Inbound
Status: Completed
Outcome: Lead Created
Duration: 2m 30s
Is Overage: No

Transcript Summary:
Customer inquired about roofing services...

Full Transcript:
────────────────────────────────────────────────
[2026-02-22 14:30:05] Agent: Hello, thank you for calling...
[2026-02-22 14:30:08] User: Hi, I need a quote for roof repair.
...

Actions Taken:
────────────────────────────────────────────────
✅ Lead created (ID: abc-123)
📞 Transferred to: +15551234567

                                          [Close]
```

---

### 3. Usage Report Page

**KPI Cards**:
```
┌────────────────┐ ┌────────────────┐ ┌────────────────┐
│ Total Calls    │ │ Total Minutes  │ │ Estimated Cost │
│     2,450      │ │     4,850      │ │    $245.67     │
└────────────────┘ └────────────────┘ └────────────────┘
```

**Month/Year Selector**:
- [ ] Year dropdown (2024, 2025, 2026, ...)
- [ ] Month dropdown (1-12)
- [ ] Auto-fetch on change

**Usage Chart**:
- [ ] Line chart showing daily calls/minutes for the month
- [ ] Bar chart for per-tenant breakdown

**Tenant Breakdown Table**:
| Tenant | Calls | Minutes | Estimated Cost |
|--------|-------|---------|----------------|
| Mr Patch Asphalt | 120 | 240 | $48.50 |
| Honeydo4You | 89 | 178 | $35.60 |

**Features**:
- [ ] Export report to CSV/Excel
- [ ] Print-friendly view
- [ ] Year/month filters

---

## 🔄 API Integration

```typescript
// Fetch call logs with filters
const fetchCallLogs = async (filters) => {
  const params = new URLSearchParams();
  if (filters.tenantId) params.append('tenantId', filters.tenantId);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.outcome) params.append('outcome', filters.outcome);
  params.append('page', filters.page.toString());
  params.append('limit', filters.limit.toString());

  const response = await fetch(`/api/v1/system/voice-ai/call-logs?${params}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to fetch call logs');
  return response.json();
};

// Fetch usage report
const fetchUsageReport = async (year, month) => {
  const response = await fetch(
    `/api/v1/system/voice-ai/usage-report?year=${year}&month=${month}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  if (!response.ok) throw new Error('Failed to fetch usage report');
  return response.json();
};
```

---

## 📊 Chart Implementation

Use a chart library like **recharts** or **chart.js**:

```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

<LineChart width={800} height={400} data={dailyUsageData}>
  <CartesianGrid strokeDasharray="3 3" />
  <XAxis dataKey="date" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Line type="monotone" dataKey="calls" stroke="#8884d8" />
  <Line type="monotone" dataKey="minutes" stroke="#82ca9d" />
</LineChart>
```

---

## ⚠️ Error Handling

- Invalid date ranges (from > to)
- No data for selected period
- Pagination errors

---

## ✅ Acceptance Criteria

- ✅ Endpoints verified
- ✅ Call logs table with all filters works
- ✅ Pagination works
- ✅ Call detail modal displays full transcript
- ✅ Lead links work (navigate to lead page)
- ✅ Overage badge displays
- ✅ Export to CSV works
- ✅ Usage report displays with KPIs
- ✅ Month/year selector works
- ✅ Charts render correctly
- ✅ Tenant breakdown table works
- ✅ RBAC protection
- ✅ Mobile responsive

---

**If backend issues: STOP + ASK HUMAN.**

---

**End of Sprint 7** (Last Admin Sprint)
