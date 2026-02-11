# Sprint 3: Usage Tracking & Billing Dashboard

**Agent Role**: Senior FinTech & Analytics Specialist
**Status**: Ready for Implementation
**Endpoints**: 8 total
**Estimated Complexity**: High (Financial data, complex calculations)

---

## Mission

You are a senior FinTech and analytics specialist responsible for building comprehensive usage tracking and billing dashboards. Your expertise in financial data visualization, cost tracking, and usage analytics will create powerful tools for platform-wide billing management that meet enterprise-grade standards.

## Prerequisites

### Authentication
- **Email**: `ludsonaiello@gmail.com`
- **Password**: `978@F32c`
- **Role**: SystemAdmin

### Review Required Documentation
1. `/var/www/lead360.app/documentation/FRONTEND_AGENT.md`
2. `/var/www/lead360.app/CLAUDE.md`
3. `/var/www/lead360.app/api/documentation/communication_twillio_admin_REST_API.md`
4. Previous sprints: sprint-1 and sprint-2 documentation

### Libraries/Tools
- **recharts**: For usage trends visualization
- **date-fns**: For date manipulation
- **papaparse**: For CSV export (if used)

---

## API Endpoints to Integrate

### Usage Tracking & Billing (8 endpoints)

#### 1. POST `/admin/communication/usage/sync`
**Purpose**: Trigger usage sync from Twilio API for all tenants
**Auth**: SystemAdmin required
**Request**: None
**Response**:
```json
{
  "message": "Usage sync initiated for all tenants"
}
```
**Notes**:
- Asynchronous operation (runs in background)
- May take several minutes
- Normally runs automatically at 2:00 AM daily

#### 2. POST `/admin/communication/usage/sync/:tenantId`
**Purpose**: Sync usage for specific tenant
**Auth**: SystemAdmin required
**Path Parameters**:
- `tenantId` (UUID): Tenant ID
**Response**:
```json
{
  "message": "Usage synced for tenant tenant-uuid-456"
}
```
**Notes**: Syncs last 30 days by default

#### 3. GET `/admin/communication/usage/tenants`
**Purpose**: Get usage summary for all tenants
**Auth**: SystemAdmin required
**Query Parameters**:
- `start_date` (optional, ISO 8601): Period start (default: first day of current month)
- `end_date` (optional, ISO 8601): Period end (default: current date)
**Response**:
```json
{
  "period": {
    "start_date": "2026-02-01T00:00:00.000Z",
    "end_date": "2026-02-06T23:59:59.999Z"
  },
  "platform_totals": {
    "total_tenants": 45,
    "calls": {
      "count": 15230,
      "minutes": 45690,
      "cost": "1827.60"
    },
    "sms": {
      "count": 32500,
      "cost": "2437.50"
    },
    "recordings": {
      "count": 12100,
      "storage_mb": 3025,
      "cost": "121.00"
    },
    "transcriptions": {
      "count": 9800,
      "cost": "980.00"
    }
  },
  "total_cost": "5366.10"
}
```

#### 4. GET `/admin/communication/usage/tenants/:id`
**Purpose**: Get detailed usage for specific tenant
**Auth**: SystemAdmin required
**Path Parameters**:
- `id` (UUID): Tenant ID
**Query Parameters**:
- `month` (optional, string): Month in YYYY-MM format (default: current month)
**Response**:
```json
{
  "tenant_id": "tenant-uuid-456",
  "tenant_name": "Acme Roofing",
  "month": "2026-02",
  "usage_breakdown": {
    "calls": {
      "count": 850,
      "minutes": 2550,
      "cost": "102.00"
    },
    "sms": {
      "count": 1200,
      "cost": "90.00"
    },
    "recordings": {
      "count": 720,
      "storage_mb": 180,
      "cost": "7.20"
    },
    "transcriptions": {
      "count": 650,
      "cost": "65.00"
    }
  },
  "total_cost": "264.20",
  "synced_at": "2026-02-06T02:00:15.000Z"
}
```

#### 5. GET `/admin/communication/usage/system`
**Purpose**: Get system-wide usage aggregation
**Auth**: SystemAdmin required
**Query Parameters**: Same as endpoint 3
**Response**: Same format as endpoint 3 (duplicate endpoint for compatibility)

#### 6. GET `/admin/communication/usage/export`
**Purpose**: Export usage report as CSV
**Auth**: SystemAdmin required
**Query Parameters**: Same as endpoint 3
**Response** (Current implementation):
```json
{
  "message": "CSV export is a planned future enhancement. Please use GET /usage/system or /usage/tenants/:id endpoints and export the JSON response client-side for now.",
  "alternative_endpoints": [
    "/admin/communication/usage/system",
    "/admin/communication/usage/tenants/:id",
    "/admin/communication/usage/tenants"
  ],
  "status": "planned_future_enhancement"
}
```
**Notes**: This is a future enhancement - UI should show "Coming Soon"

#### 7. GET `/admin/communication/costs/tenants/:id`
**Purpose**: Get cost estimation for tenant
**Auth**: SystemAdmin required
**Path Parameters**:
- `id` (UUID): Tenant ID
**Query Parameters**:
- `month` (REQUIRED, string): Month in YYYY-MM format
**Response**:
```json
{
  "tenant_id": "tenant-uuid-456",
  "tenant_name": "Acme Roofing",
  "month": "2026-02",
  "cost_estimate": {
    "calls": "102.00",
    "sms": "90.00",
    "recordings": "7.20",
    "transcriptions": "65.00",
    "total": "264.20"
  },
  "estimated_at": "2026-02-06T15:00:00.000Z"
}
```

#### 8. GET `/admin/communication/metrics/top-tenants`
**Purpose**: Get top tenants by communication volume
**Auth**: SystemAdmin required
**Query Parameters**:
- `limit` (optional, integer): Number of top tenants (default: 10)
**Response**:
```json
{
  "top_tenants": [
    {
      "tenant_id": "tenant-uuid-123",
      "tenant_name": "Acme Roofing",
      "subdomain": "acme",
      "total_communications": 5250,
      "calls": 850,
      "sms": 3200,
      "whatsapp": 1200,
      "rank": 1
    }
  ],
  "generated_at": "2026-02-06T17:15:00.000Z"
}
```

---

## Pages to Build

### Page 1: Usage Dashboard
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/usage/page.tsx`

**Required Features**:
1. Platform-wide usage overview with cost breakdown
2. Date range selector (default: current month)
3. Usage trends chart (calls, SMS, costs over time)
4. Top tenants by usage table
5. "Sync Now" button to trigger manual sync
6. Category breakdown with visual indicators
7. Total cost display (prominent)

**UI Structure**:
```tsx
<div className="space-y-6">
  {/* Header with Sync Button */}
  <div className="flex items-center justify-between">
    <h1 className="text-2xl font-bold">Usage & Billing Dashboard</h1>
    <Button
      onClick={handleSyncAll}
      loading={syncing}
      leftIcon={<RefreshCw className={syncing ? 'animate-spin' : ''} />}
    >
      Sync Now
    </Button>
  </div>

  {/* Date Range Selector */}
  <div className="flex items-center gap-4">
    <DateRangePicker
      startDate={dateRange.start_date}
      endDate={dateRange.end_date}
      onChange={handleDateRangeChange}
    />
    <Button variant="secondary" onClick={handleCurrentMonth}>
      Current Month
    </Button>
  </div>

  {/* Total Cost Card (Prominent) */}
  <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-8">
    <div className="text-lg opacity-90">Total Platform Cost</div>
    <div className="text-5xl font-bold mt-2">
      {formatCurrency(usageData?.total_cost || 0)}
    </div>
    <div className="text-sm opacity-75 mt-2">
      {format(new Date(dateRange.start_date), 'MMM dd')} - {format(new Date(dateRange.end_date), 'MMM dd, yyyy')}
    </div>
  </Card>

  {/* Usage Breakdown Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <UsageCategoryCard
      title="Voice Calls"
      icon={Phone}
      count={usageData?.platform_totals.calls.count}
      minutes={usageData?.platform_totals.calls.minutes}
      cost={usageData?.platform_totals.calls.cost}
    />
    <UsageCategoryCard
      title="SMS Messages"
      icon={MessageSquare}
      count={usageData?.platform_totals.sms.count}
      cost={usageData?.platform_totals.sms.cost}
    />
    <UsageCategoryCard
      title="Recordings"
      icon={Mic}
      count={usageData?.platform_totals.recordings.count}
      storage={`${usageData?.platform_totals.recordings.storage_mb} MB`}
      cost={usageData?.platform_totals.recordings.cost}
    />
    <UsageCategoryCard
      title="Transcriptions"
      icon={FileText}
      count={usageData?.platform_totals.transcriptions.count}
      cost={usageData?.platform_totals.transcriptions.cost}
    />
  </div>

  {/* Usage Trends Chart */}
  <Card className="p-6">
    <h2 className="text-lg font-semibold mb-4">Usage Trends</h2>
    <UsageTrendsChart data={trendsData} />
  </Card>

  {/* Top Tenants Table */}
  <Card className="p-6">
    <h2 className="text-lg font-semibold mb-4">Top Tenants by Usage</h2>
    <TopTenantsTable tenants={topTenants} onViewDetails={handleViewTenantUsage} />
  </Card>
</div>
```

**State Management**:
```typescript
const [dateRange, setDateRange] = useState({
  start_date: startOfMonth(new Date()).toISOString(),
  end_date: new Date().toISOString(),
});
const [usageData, setUsageData] = useState<UsageSummaryResponse | null>(null);
const [topTenants, setTopTenants] = useState<TopTenant[]>([]);
const [syncing, setSyncing] = useState(false);
const [loading, setLoading] = useState(false);

useEffect(() => {
  fetchUsageData();
  fetchTopTenants();
}, [dateRange]);

const handleSyncAll = async () => {
  try {
    setSyncing(true);
    await triggerUsageSync();
    toast.success('Usage sync initiated. This may take several minutes.');
    // Refresh data after a delay
    setTimeout(() => {
      fetchUsageData();
    }, 5000);
  } catch (error) {
    handleApiError(error, 'Failed to trigger sync');
  } finally {
    setSyncing(false);
  }
};
```

### Page 2: Tenant Usage Detail
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/usage/tenants/[id]/page.tsx`

**Required Features**:
1. Month selector
2. Detailed usage breakdown by category
3. Cost summary cards
4. Historical usage chart (if data available)
5. "Sync Tenant Usage" button
6. Last synced timestamp
7. Comparison with previous month (if available)

**UI Structure**:
```tsx
<div className="space-y-6">
  {/* Breadcrumb */}
  <Breadcrumb
    items={[
      { label: 'Usage & Billing', href: '/admin/communications/twilio/usage' },
      { label: tenantName, current: true }
    ]}
  />

  {/* Header with Sync */}
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold">{tenantName}</h1>
      <p className="text-gray-600">
        Last synced: {formatDateTime(usageData?.synced_at)}
      </p>
    </div>
    <Button
      onClick={handleSyncTenant}
      loading={syncing}
      leftIcon={<RefreshCw className={syncing ? 'animate-spin' : ''} />}
    >
      Sync This Tenant
    </Button>
  </div>

  {/* Month Selector */}
  <div className="flex items-center gap-4">
    <Select
      label="Select Month"
      value={selectedMonth}
      onChange={setSelectedMonth}
      options={monthOptions}
    />
  </div>

  {/* Total Cost Card */}
  <Card className="bg-gradient-to-r from-indigo-500 to-indigo-600 text-white p-6">
    <div className="text-sm opacity-90">Total Cost for {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}</div>
    <div className="text-4xl font-bold mt-2">
      {formatCurrency(usageData?.total_cost || 0)}
    </div>
  </Card>

  {/* Usage Breakdown Cards */}
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
    {/* Calls */}
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Phone className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold">Voice Calls</h3>
            <p className="text-2xl font-bold">{usageData?.usage_breakdown.calls.count}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Minutes</div>
          <div className="text-xl font-semibold">{usageData?.usage_breakdown.calls.minutes}</div>
        </div>
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Cost</span>
          <span className="text-xl font-bold text-blue-600">
            {formatCurrency(usageData?.usage_breakdown.calls.cost || 0)}
          </span>
        </div>
      </div>
    </Card>

    {/* SMS */}
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
            <MessageSquare className="h-6 w-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold">SMS Messages</h3>
            <p className="text-2xl font-bold">{usageData?.usage_breakdown.sms.count}</p>
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Cost</span>
          <span className="text-xl font-bold text-green-600">
            {formatCurrency(usageData?.usage_breakdown.sms.cost || 0)}
          </span>
        </div>
      </div>
    </Card>

    {/* Recordings */}
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
            <Mic className="h-6 w-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold">Recordings</h3>
            <p className="text-2xl font-bold">{usageData?.usage_breakdown.recordings.count}</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600">Storage</div>
          <div className="text-xl font-semibold">{usageData?.usage_breakdown.recordings.storage_mb} MB</div>
        </div>
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Cost</span>
          <span className="text-xl font-bold text-purple-600">
            {formatCurrency(usageData?.usage_breakdown.recordings.cost || 0)}
          </span>
        </div>
      </div>
    </Card>

    {/* Transcriptions */}
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
            <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold">Transcriptions</h3>
            <p className="text-2xl font-bold">{usageData?.usage_breakdown.transcriptions.count}</p>
          </div>
        </div>
      </div>
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <span className="text-gray-600">Cost</span>
          <span className="text-xl font-bold text-orange-600">
            {formatCurrency(usageData?.usage_breakdown.transcriptions.cost || 0)}
          </span>
        </div>
      </div>
    </Card>
  </div>

  {/* Cost Estimation (if available) */}
  {costEstimate && (
    <Card className="p-6 bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
            Month-to-Date Cost Estimate
          </h3>
          <p className="text-yellow-700 dark:text-yellow-300 mt-1">
            Estimated total: {formatCurrency(costEstimate.cost_estimate.total)}
          </p>
          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
            Updated: {formatDateTime(costEstimate.estimated_at)}
          </p>
        </div>
      </div>
    </Card>
  )}
</div>
```

### Page 3: Usage Export (Future Enhancement)
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/usage/export/page.tsx`

**Required Features**:
1. "Coming Soon" banner
2. Information about future CSV export feature
3. Alternative export instructions (use browser to save JSON)
4. Link to usage dashboard

**UI Structure**:
```tsx
<div className="space-y-6">
  <h1 className="text-2xl font-bold">Usage Report Export</h1>

  {/* Coming Soon Card */}
  <Card className="p-8 text-center">
    <div className="flex justify-center mb-4">
      <div className="p-4 bg-blue-100 dark:bg-blue-900 rounded-full">
        <FileDown className="h-12 w-12 text-blue-600 dark:text-blue-400" />
      </div>
    </div>
    <h2 className="text-2xl font-bold mb-2">CSV Export Coming Soon</h2>
    <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
      Direct CSV export functionality is planned for a future release. In the meantime,
      you can export usage data using the alternative methods below.
    </p>

    {/* Alternative Methods */}
    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-6 text-left max-w-2xl mx-auto">
      <h3 className="font-semibold mb-3">Alternative Export Methods:</h3>
      <ul className="space-y-2 text-sm">
        <li className="flex items-start gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>Use the browser's "Save Page As" feature on the usage dashboard</span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>Copy data from tables and paste into spreadsheet applications</span>
        </li>
        <li className="flex items-start gap-2">
          <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span>Use the API directly: GET /admin/communication/usage/tenants</span>
        </li>
      </ul>
    </div>

    <div className="mt-6">
      <Button
        variant="primary"
        onClick={() => router.push('/admin/communications/twilio/usage')}
      >
        Go to Usage Dashboard
      </Button>
    </div>
  </Card>
</div>
```

---

## Components to Create

### Component 1: UsageCategoryCard
**Path**: `/app/src/components/admin/twilio/UsageCategoryCard.tsx`

**Features**:
- Icon with background color
- Category name
- Count/quantity display
- Additional metric (minutes, storage, etc.)
- Cost display (prominent)

### Component 2: UsageTrendsChart
**Path**: `/app/src/components/admin/twilio/UsageTrendsChart.tsx`

**Uses**: recharts library

**Implementation**:
```tsx
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function UsageTrendsChart({ data }: { data: any[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" />
        <YAxis yAxisId="right" orientation="right" />
        <Tooltip formatter={(value: number, name: string) => {
          if (name === 'cost') return `$${value.toFixed(2)}`;
          return value.toLocaleString();
        }} />
        <Legend />
        <Line yAxisId="left" type="monotone" dataKey="calls" stroke="#3b82f6" name="Calls" />
        <Line yAxisId="left" type="monotone" dataKey="sms" stroke="#10b981" name="SMS" />
        <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#f59e0b" name="Cost ($)" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Component 3: TopTenantsTable
**Path**: `/app/src/components/admin/twilio/TopTenantsTable.tsx`

**Features**:
- Ranking display
- Tenant name with subdomain
- Communication breakdown (calls, SMS, WhatsApp)
- Total count
- Action button to view details

**Implementation**:
```tsx
export function TopTenantsTable({ tenants, onViewDetails }: TopTenantsTableProps) {
  return (
    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
      <thead>
        <tr>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tenant</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Calls</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">SMS</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">WhatsApp</th>
          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
          <th className="px-4 py-3"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
        {tenants.map(tenant => (
          <tr key={tenant.tenant_id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
            <td className="px-4 py-4">
              <Badge variant={tenant.rank <= 3 ? 'blue' : 'gray'}>
                #{tenant.rank}
              </Badge>
            </td>
            <td className="px-4 py-4">
              <div className="font-medium">{tenant.tenant_name}</div>
              <div className="text-sm text-gray-500">{tenant.subdomain}.lead360.app</div>
            </td>
            <td className="px-4 py-4 text-right">{tenant.calls.toLocaleString()}</td>
            <td className="px-4 py-4 text-right">{tenant.sms.toLocaleString()}</td>
            <td className="px-4 py-4 text-right">{tenant.whatsapp.toLocaleString()}</td>
            <td className="px-4 py-4 text-right font-semibold">
              {tenant.total_communications.toLocaleString()}
            </td>
            <td className="px-4 py-4 text-right">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewDetails(tenant.tenant_id)}
              >
                View Details
              </Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### Component 4: SyncUsageButton
**Path**: `/app/src/components/admin/twilio/SyncUsageButton.tsx`

**Reusable button component for triggering sync operations**

---

## API Client Functions

**File**: `/app/src/lib/api/twilio-admin.ts` (add to existing)

```typescript
// Usage Tracking & Billing
export async function triggerUsageSync(): Promise<{ message: string }> {
  const { data } = await apiClient.post('/admin/communication/usage/sync');
  return data;
}

export async function syncTenantUsage(tenantId: string): Promise<{ message: string }> {
  const { data } = await apiClient.post(`/admin/communication/usage/sync/${tenantId}`);
  return data;
}

export async function getUsageSummary(params?: UsageQuery): Promise<UsageSummaryResponse> {
  const { data } = await apiClient.get('/admin/communication/usage/tenants', { params });
  return data;
}

export async function getTenantUsage(
  tenantId: string,
  params?: { month?: string }
): Promise<TenantUsageResponse> {
  const { data } = await apiClient.get(`/admin/communication/usage/tenants/${tenantId}`, { params });
  return data;
}

export async function getSystemWideUsage(params?: UsageQuery): Promise<UsageSummaryResponse> {
  const { data } = await apiClient.get('/admin/communication/usage/system', { params });
  return data;
}

export async function exportUsageReport(params?: UsageQuery): Promise<any> {
  const { data } = await apiClient.get('/admin/communication/usage/export', { params });
  return data;
}

export async function getTenantCostEstimate(
  tenantId: string,
  month: string
): Promise<CostEstimateResponse> {
  const { data } = await apiClient.get(`/admin/communication/costs/tenants/${tenantId}`, {
    params: { month }
  });
  return data;
}

export async function getTopTenants(limit: number = 10): Promise<TopTenantsResponse> {
  const { data } = await apiClient.get('/admin/communication/metrics/top-tenants', {
    params: { limit }
  });
  return data;
}
```

---

## TypeScript Types

**File**: `/app/src/lib/types/twilio-admin.ts` (add to existing)

```typescript
export interface UsageQuery {
  start_date?: string;
  end_date?: string;
  month?: string;
}

export interface UsageSummaryResponse {
  period: {
    start_date: string;
    end_date: string;
  };
  platform_totals: {
    total_tenants: number;
    calls: UsageCategory;
    sms: UsageCategory;
    recordings: UsageCategory;
    transcriptions: UsageCategory;
  };
  total_cost: string;
}

export interface UsageCategory {
  count: number;
  minutes?: number;
  cost: string;
  storage_mb?: number;
}

export interface TenantUsageResponse {
  tenant_id: string;
  tenant_name: string;
  month: string;
  usage_breakdown: {
    calls: UsageCategory;
    sms: UsageCategory;
    recordings: UsageCategory;
    transcriptions: UsageCategory;
  };
  total_cost: string;
  synced_at: string;
}

export interface CostEstimateResponse {
  tenant_id: string;
  tenant_name: string;
  month: string;
  cost_estimate: {
    calls: string;
    sms: string;
    recordings: string;
    transcriptions: string;
    total: string;
  };
  estimated_at: string;
}

export interface TopTenantsResponse {
  top_tenants: TopTenant[];
  generated_at: string;
}

export interface TopTenant {
  tenant_id: string;
  tenant_name: string;
  subdomain: string;
  total_communications: number;
  calls: number;
  sms: number;
  whatsapp: number;
  rank: number;
}
```

---

## Currency Formatting Utility

**File**: `/app/src/lib/utils/currency-formatter.ts`

```typescript
export function formatCurrency(amount: string | number): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export function parseCurrency(formatted: string): number {
  return parseFloat(formatted.replace(/[^0-9.-]+/g, ''));
}
```

---

## Testing Checklist

### Manual Testing

1. **Usage Dashboard**
   - [ ] Page loads with current month data
   - [ ] Date range selector works
   - [ ] "Current Month" button resets to current month
   - [ ] Total cost displays correctly (formatted as currency)
   - [ ] All category cards show correct data
   - [ ] "Sync Now" button triggers sync
   - [ ] Success message appears after sync
   - [ ] Data refreshes after sync
   - [ ] Usage trends chart renders
   - [ ] Top tenants table loads
   - [ ] Click tenant navigates to detail page

2. **Tenant Usage Detail**
   - [ ] Breadcrumb navigation works
   - [ ] Month selector works
   - [ ] Usage breakdown displays all categories
   - [ ] Costs formatted as currency
   - [ ] "Sync This Tenant" button works
   - [ ] Last synced timestamp displays
   - [ ] Cost estimate displays (if available)
   - [ ] All icons and colors correct

3. **Usage Export Page**
   - [ ] "Coming Soon" message displays
   - [ ] Alternative methods listed
   - [ ] Link to usage dashboard works

### Error Scenarios
- [ ] Test with no usage data (empty states)
- [ ] Test sync with API error
- [ ] Test with invalid month format
- [ ] Test with future dates

---

## Acceptance Criteria

### Functional
- [ ] All 8 endpoints integrated
- [ ] Usage dashboard with date filtering
- [ ] Tenant usage detail with month selector
- [ ] Manual sync triggers (all and per-tenant)
- [ ] Top tenants ranking
- [ ] Cost calculations accurate
- [ ] Export page shows "Coming Soon"

### UI/UX
- [ ] Currency formatting ($1,234.56)
- [ ] Number formatting (1,234)
- [ ] Loading states during sync
- [ ] Success/error modals
- [ ] Responsive design
- [ ] Dark mode support
- [ ] Visual indicators (charts, cards)

### Code Quality
- [ ] TypeScript fully typed
- [ ] Currency utility functions
- [ ] Reusable components
- [ ] Error handling
- [ ] Follows financial data best practices

---

## Completion Report Template

```markdown
# Sprint 3 Completion Report: Usage Tracking & Billing

**Status**: ✅ Complete
**Date**: [DATE]
**Developer**: [YOUR NAME]

## Implemented Features

### Pages
- [x] Usage Dashboard
- [x] Tenant Usage Detail
- [x] Usage Export (Coming Soon)

### Components
- [x] UsageCategoryCard
- [x] UsageTrendsChart
- [x] TopTenantsTable
- [x] SyncUsageButton

### API Integration
- [x] All 8 endpoints integrated
- [x] Error handling
- [x] Loading states

### Testing
- [x] Manual testing complete
- [x] Currency formatting verified
- [x] All acceptance criteria met

## Screenshots
[Add screenshots]

## Known Issues
[List any issues]

## Next Steps
Ready for Sprint 4: Transcription Monitoring
```

---

**Build financial dashboards that would make FinTech companies jealous!** 💰🚀
