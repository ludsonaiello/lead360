# Sprint 2: Cross-Tenant Communication Monitoring

**Agent Role**: Senior Data Visualization & Monitoring Specialist
**Status**: Ready for Implementation
**Endpoints**: 6 total
**Estimated Complexity**: High (Large datasets, complex filtering)

---

## Mission

You are a senior data visualization and monitoring specialist responsible for building comprehensive cross-tenant communication monitoring interfaces. Your expertise in handling large datasets, advanced filtering, and pagination will create powerful monitoring tools that provide platform administrators with complete visibility across all tenant communications.

## Prerequisites

### Authentication
- **Email**: `ludsonaiello@gmail.com`
- **Password**: `978@F32c`
- **Role**: SystemAdmin
- Test authentication before starting implementation

### Review Required Documentation
1. `/var/www/lead360.app/documentation/FRONTEND_AGENT.md` - Your role and standards
2. `/var/www/lead360.app/CLAUDE.md` - Project coordination
3. `/var/www/lead360.app/api/documentation/communication_twillio_admin_REST_API.md` - API reference
4. `/var/www/lead360.app/app/documentation/twillio/admin/sprint-1-provider-management.md` - Previous sprint context

### Existing Patterns to Follow
- **Tables**: `/app/src/app/(dashboard)/admin/tenants/page.tsx` - Reference for data tables with filters
- **Pagination**: Use `PaginationControls` component from `/app/src/components/ui/`
- **Filters**: Similar pattern to communications history page
- **Modals**: Use existing Modal components for detail views

---

## API Endpoints to Integrate

### Cross-Tenant Oversight (6 endpoints)

#### 1. GET `/admin/communication/calls`
**Purpose**: Get all voice calls across all tenants
**Auth**: SystemAdmin required
**Query Parameters**:
- `tenant_id` (optional, UUID): Filter by tenant
- `status` (optional, enum): initiated, ringing, in_progress, completed, failed, no_answer, busy, canceled
- `direction` (optional): inbound, outbound
- `start_date` (optional, ISO 8601): Filter calls after this date
- `end_date` (optional, ISO 8601): Filter calls before this date
- `page` (optional, integer): Page number (default: 1)
- `limit` (optional, integer): Results per page (default: 20, max: 100)

**Response**:
```json
{
  "data": [
    {
      "id": "call-uuid-123",
      "tenant_id": "tenant-uuid-456",
      "tenant": {
        "id": "tenant-uuid-456",
        "company_name": "Acme Roofing",
        "subdomain": "acme"
      },
      "lead_id": "lead-uuid-789",
      "lead": {
        "id": "lead-uuid-789",
        "first_name": "John",
        "last_name": "Doe",
        "phones": [{ "phone_number": "+14155551234", "is_primary": true }]
      },
      "twilio_call_sid": "CA1234567890abcdef1234567890abcd",
      "direction": "inbound",
      "from_number": "+14155551234",
      "to_number": "+14155559999",
      "status": "completed",
      "call_type": "customer_call",
      "initiated_by": null,
      "initiated_by_user": null,
      "recording_url": "https://api.twilio.com/recording/RE123",
      "recording_duration_seconds": 120,
      "recording_status": "transcribed",
      "transcription": {
        "id": "trans-uuid-111",
        "status": "completed",
        "transcription_provider": "openai_whisper"
      },
      "cost": "0.0250",
      "started_at": "2026-02-06T10:00:00.000Z",
      "ended_at": "2026-02-06T10:02:00.000Z",
      "created_at": "2026-02-06T10:00:00.000Z",
      "updated_at": "2026-02-06T10:02:30.000Z"
    }
  ],
  "pagination": {
    "total": 1523,
    "page": 1,
    "limit": 20,
    "pages": 77,
    "has_next": true,
    "has_prev": false
  }
}
```

#### 2. GET `/admin/communication/sms`
**Purpose**: Get all SMS messages across all tenants
**Auth**: SystemAdmin required
**Query Parameters**: Same as calls endpoint plus:
- `channel` (optional): "sms" (auto-filtered for this endpoint)

**Response**: Similar structure to calls, but with communication events:
```json
{
  "data": [
    {
      "id": "event-uuid-123",
      "tenant_id": "tenant-uuid-456",
      "tenant": { ... },
      "channel": "sms",
      "direction": "outbound",
      "provider_id": "provider-uuid-789",
      "provider": {
        "id": "provider-uuid-789",
        "provider_name": "Twilio",
        "provider_type": "sms"
      },
      "status": "delivered",
      "to_phone": "+14155551234",
      "from_phone": "+14155559999",
      "text_body": "Your appointment is scheduled for tomorrow at 10am.",
      "provider_message_id": "SM1234567890abcdef1234567890abcd",
      "sent_at": "2026-02-06T09:00:00.000Z",
      "delivered_at": "2026-02-06T09:00:02.000Z",
      "created_at": "2026-02-06T09:00:00.000Z",
      "created_by_user": {
        "id": "user-uuid-111",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane@acmeroofing.com"
      }
    }
  ],
  "pagination": { ... }
}
```

#### 3. GET `/admin/communication/whatsapp`
**Purpose**: Get all WhatsApp messages across all tenants
**Auth**: SystemAdmin required
**Query Parameters**: Same as SMS
**Response**: Same structure as SMS with `channel: "whatsapp"`

#### 4. GET `/admin/communication/tenant-configs`
**Purpose**: Get all tenant communication configurations
**Auth**: SystemAdmin required
**Response**:
```json
{
  "sms_configs": [
    {
      "id": "config-uuid-123",
      "tenant_id": "tenant-uuid-456",
      "tenant": {
        "id": "tenant-uuid-456",
        "company_name": "Acme Roofing",
        "subdomain": "acme"
      },
      "provider_id": "provider-uuid-789",
      "from_phone": "+14155559999",
      "is_active": true,
      "is_verified": true,
      "created_at": "2026-01-15T10:00:00.000Z",
      "updated_at": "2026-01-15T10:00:00.000Z"
    }
  ],
  "whatsapp_configs": [ ... ],
  "ivr_configs": [ ... ]
}
```

#### 5. GET `/admin/communication/tenants/:id/configs`
**Purpose**: Get specific tenant's communication configurations
**Auth**: SystemAdmin required
**Path Parameters**:
- `id` (UUID): Tenant ID
**Response**: Same structure as endpoint 4, but filtered for tenant

#### 6. GET `/admin/communication/tenants/:id/metrics`
**Purpose**: Get communication metrics for specific tenant
**Auth**: SystemAdmin required
**Path Parameters**:
- `id` (UUID): Tenant ID
**Response**:
```json
{
  "tenant_id": "tenant-uuid-456",
  "tenant_name": "Acme Roofing",
  "metrics": {
    "calls": {
      "total": 1250,
      "inbound": 850,
      "outbound": 400,
      "completed": 1100,
      "failed": 50,
      "no_answer": 100,
      "avg_duration_seconds": 180,
      "total_duration_minutes": 3750
    },
    "sms": {
      "total": 3500,
      "inbound": 1200,
      "outbound": 2300,
      "delivered": 3400,
      "failed": 100
    },
    "whatsapp": {
      "total": 850,
      "inbound": 300,
      "outbound": 550,
      "delivered": 820,
      "failed": 30
    },
    "transcriptions": {
      "total": 950,
      "completed": 920,
      "failed": 30,
      "success_rate": "96.84%"
    }
  },
  "generated_at": "2026-02-06T15:00:00.000Z"
}
```

---

## Pages to Build

### Page 1: All Calls Monitoring
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/calls/page.tsx`

**Required Features**:
1. Paginated table/list of all calls
2. Advanced filter bar:
   - Tenant selector (searchable dropdown)
   - Status dropdown
   - Direction dropdown
   - Date range picker
3. Search by phone number
4. Call detail modal
5. Export to CSV button
6. Real-time status updates (optional auto-refresh)

**UI Structure**:
```tsx
<div className="space-y-6">
  {/* Header with Export */}
  <div className="flex items-center justify-between">
    <h1>All Calls Monitoring</h1>
    <Button onClick={handleExportCSV} loading={exporting}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  </div>

  {/* Filter Bar */}
  <CallFilters
    filters={filters}
    onChange={setFilters}
    onReset={handleResetFilters}
  />

  {/* Results Summary */}
  <div className="text-sm text-gray-600">
    Showing {data.length} of {pagination.total} calls
  </div>

  {/* Calls Table/Grid */}
  {loading ? (
    <LoadingSpinner size="lg" centered />
  ) : data.length === 0 ? (
    <EmptyState
      icon={Phone}
      title="No calls found"
      description="Try adjusting your filters"
    />
  ) : (
    <>
      <CallsTable
        calls={data}
        onViewDetails={handleViewDetails}
      />
      <PaginationControls
        currentPage={filters.page}
        totalPages={pagination.pages}
        onNext={() => setFilters({ ...filters, page: filters.page + 1 })}
        onPrevious={() => setFilters({ ...filters, page: filters.page - 1 })}
      />
    </>
  )}

  {/* Detail Modal */}
  <CallDetailModal
    isOpen={!!selectedCall}
    call={selectedCall}
    onClose={() => setSelectedCall(null)}
  />
</div>
```

**State Management**:
```typescript
const [filters, setFilters] = useState<CallFilters>({
  tenant_id: '',
  status: '',
  direction: '',
  start_date: '',
  end_date: '',
  page: 1,
  limit: 20,
});
const [data, setData] = useState<CallRecord[]>([]);
const [pagination, setPagination] = useState<PaginationInfo>({});
const [loading, setLoading] = useState(false);
const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);
const [exporting, setExporting] = useState(false);

// Fetch data when filters change
useEffect(() => {
  fetchCalls();
}, [filters]);

const fetchCalls = async () => {
  try {
    setLoading(true);
    const response = await getAllCalls(filters);
    setData(response.data);
    setPagination(response.pagination);
  } catch (error) {
    handleApiError(error, 'Failed to load calls');
  } finally {
    setLoading(false);
  }
};
```

### Page 2: Messages Monitoring (SMS/WhatsApp)
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/messages/page.tsx`

**Required Features**:
1. Tabbed interface: "SMS" and "WhatsApp"
2. Same filter bar as calls
3. Message preview in cards/table
4. Message detail modal with full content
5. Delivery status tracking
6. Export functionality

**UI Structure**:
```tsx
<div className="space-y-6">
  {/* Header */}
  <div className="flex items-center justify-between">
    <h1>Messages Monitoring</h1>
    <Button onClick={handleExportCSV} loading={exporting}>
      <Download className="h-4 w-4 mr-2" />
      Export CSV
    </Button>
  </div>

  {/* Tabs */}
  <Tabs
    tabs={[
      { id: 'sms', label: 'SMS Messages' },
      { id: 'whatsapp', label: 'WhatsApp Messages' }
    ]}
    activeTab={activeTab}
    onChange={setActiveTab}
  />

  {/* Filter Bar */}
  <MessageFilters
    filters={filters}
    onChange={setFilters}
    onReset={handleResetFilters}
  />

  {/* Messages Grid/List */}
  {loading ? (
    <LoadingSpinner size="lg" centered />
  ) : (
    <>
      <MessagesGrid
        messages={data}
        onViewDetails={handleViewDetails}
      />
      <PaginationControls {...paginationProps} />
    </>
  )}

  {/* Detail Modal */}
  <MessageDetailModal
    isOpen={!!selectedMessage}
    message={selectedMessage}
    onClose={() => setSelectedMessage(null)}
  />
</div>
```

**Tab Logic**:
```typescript
const [activeTab, setActiveTab] = useState<'sms' | 'whatsapp'>('sms');

// Fetch appropriate data based on active tab
useEffect(() => {
  if (activeTab === 'sms') {
    fetchSMS();
  } else {
    fetchWhatsApp();
  }
}, [activeTab, filters]);
```

### Page 3: Tenant Communication Overview
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/tenants/page.tsx`

**Required Features**:
1. List of all tenants with communication stats
2. Search by tenant name
3. Configuration summary cards
4. Link to detailed tenant view
5. Quick metrics display

**UI Structure**:
```tsx
<div className="space-y-6">
  {/* Header */}
  <h1>Tenant Communication Overview</h1>

  {/* Search */}
  <Input
    placeholder="Search tenants..."
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    leftIcon={Search}
  />

  {/* Tenant Cards Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
    {filteredTenants.map(tenant => (
      <TenantConfigCard
        key={tenant.tenant_id}
        tenant={tenant}
        onViewDetails={() => router.push(`/admin/communications/twilio/tenants/${tenant.tenant_id}`)}
      />
    ))}
  </div>
</div>
```

### Page 4: Tenant Communication Detail
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/tenants/[id]/page.tsx`

**Required Features**:
1. Tenant information header
2. Configuration details (SMS, WhatsApp, IVR)
3. Comprehensive metrics breakdown
4. Charts for call/SMS trends
5. Success rates display

**UI Structure**:
```tsx
<div className="space-y-6">
  {/* Breadcrumb */}
  <Breadcrumb
    items={[
      { label: 'Tenants', href: '/admin/communications/twilio/tenants' },
      { label: tenantName, current: true }
    ]}
  />

  {/* Tenant Header */}
  <div className="bg-white dark:bg-gray-800 rounded-lg p-6">
    <h1 className="text-2xl font-bold">{tenantName}</h1>
    <p className="text-gray-600">Tenant ID: {tenantId}</p>
  </div>

  {/* Configurations */}
  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <ConfigCard title="SMS Configuration" config={configs.sms_configs[0]} />
    <ConfigCard title="WhatsApp Configuration" config={configs.whatsapp_configs[0]} />
    <ConfigCard title="IVR Configuration" config={configs.ivr_configs[0]} />
  </div>

  {/* Metrics Grid */}
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
    <MetricCard
      title="Total Calls"
      value={metrics.calls.total}
      subtext={`${metrics.calls.completed} completed`}
      icon={Phone}
    />
    <MetricCard
      title="SMS Messages"
      value={metrics.sms.total}
      subtext={`${metrics.sms.delivered} delivered`}
      icon={MessageSquare}
    />
    <MetricCard
      title="WhatsApp"
      value={metrics.whatsapp.total}
      subtext={`${metrics.whatsapp.delivered} delivered`}
      icon={MessageCircle}
    />
    <MetricCard
      title="Transcriptions"
      value={metrics.transcriptions.total}
      subtext={`${metrics.transcriptions.success_rate} success rate`}
      icon={FileText}
    />
  </div>

  {/* Detailed Breakdown */}
  <Card className="p-6">
    <h2 className="text-xl font-semibold mb-4">Communication Breakdown</h2>
    <TenantMetricsTable metrics={metrics} />
  </Card>
</div>
```

---

## Components to Create

### Component 1: CallFilters
**Path**: `/app/src/components/admin/twilio/CallFilters.tsx`

**Props**:
```typescript
interface CallFiltersProps {
  filters: CallFilters;
  onChange: (filters: CallFilters) => void;
  onReset: () => void;
}
```

**Features**:
- Tenant selector (searchable)
- Status dropdown
- Direction dropdown
- Date range picker
- Reset button

**Implementation**:
```tsx
export function CallFilters({ filters, onChange, onReset }: CallFiltersProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Tenant Selector */}
        <Select
          label="Tenant"
          value={filters.tenant_id}
          onChange={(value) => onChange({ ...filters, tenant_id: value })}
          options={tenantOptions}
          searchable
        />

        {/* Status */}
        <Select
          label="Status"
          value={filters.status}
          onChange={(value) => onChange({ ...filters, status: value })}
          options={statusOptions}
        />

        {/* Direction */}
        <Select
          label="Direction"
          value={filters.direction}
          onChange={(value) => onChange({ ...filters, direction: value })}
          options={[
            { value: '', label: 'All Directions' },
            { value: 'inbound', label: 'Inbound' },
            { value: 'outbound', label: 'Outbound' }
          ]}
        />

        {/* Date Range */}
        <DateRangePicker
          label="Date Range"
          startDate={filters.start_date}
          endDate={filters.end_date}
          onChange={(start, end) => onChange({
            ...filters,
            start_date: start,
            end_date: end
          })}
        />
      </div>

      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={onReset}>
          Reset Filters
        </Button>
      </div>
    </div>
  );
}
```

### Component 2: CallsTable
**Path**: `/app/src/components/admin/twilio/CallsTable.tsx`

**Features**:
- Responsive table/card layout
- Status badges
- Duration display
- Tenant name
- Click to view details

**Desktop Table Structure**:
```tsx
<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
  <thead>
    <tr>
      <th>Date/Time</th>
      <th>Tenant</th>
      <th>From</th>
      <th>To</th>
      <th>Direction</th>
      <th>Status</th>
      <th>Duration</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {calls.map(call => (
      <tr key={call.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
        <td>{formatDateTime(call.created_at)}</td>
        <td>{call.tenant?.company_name}</td>
        <td>{formatPhone(call.from_number)}</td>
        <td>{formatPhone(call.to_number)}</td>
        <td><DirectionBadge direction={call.direction} /></td>
        <td><StatusBadge status={call.status} /></td>
        <td>{formatDuration(call.recording_duration_seconds)}</td>
        <td>
          <Button variant="ghost" size="sm" onClick={() => onViewDetails(call)}>
            View
          </Button>
        </td>
      </tr>
    ))}
  </tbody>
</table>
```

**Mobile Card Structure**:
```tsx
<div className="lg:hidden space-y-4">
  {calls.map(call => (
    <Card key={call.id} className="p-4" onClick={() => onViewDetails(call)}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="font-semibold">{call.tenant?.company_name}</div>
          <div className="text-sm text-gray-600">{formatDateTime(call.created_at)}</div>
        </div>
        <StatusBadge status={call.status} />
      </div>
      <div className="space-y-1 text-sm">
        <div>From: {formatPhone(call.from_number)}</div>
        <div>To: {formatPhone(call.to_number)}</div>
        <div>Duration: {formatDuration(call.recording_duration_seconds)}</div>
      </div>
    </Card>
  ))}
</div>
```

### Component 3: CallDetailModal
**Path**: `/app/src/components/admin/twilio/CallDetailModal.tsx`

**Features**:
- Complete call information
- Recording playback (if available)
- Transcription display (if available)
- Lead information with link
- Tenant information
- Call metadata (cost, timestamps)

**Implementation**:
```tsx
export function CallDetailModal({ isOpen, call, onClose }: CallDetailModalProps) {
  if (!call) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <h2 className="text-xl font-bold mb-4">Call Details</h2>

        {/* Status Banner */}
        <div className="mb-4">
          <StatusBadge status={call.status} size="lg" />
        </div>

        {/* Call Info Grid */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <DetailItem label="Direction" value={<DirectionBadge direction={call.direction} />} />
          <DetailItem label="Call Type" value={call.call_type} />
          <DetailItem label="From" value={formatPhone(call.from_number)} />
          <DetailItem label="To" value={formatPhone(call.to_number)} />
          <DetailItem label="Started" value={formatDateTime(call.started_at)} />
          <DetailItem label="Ended" value={formatDateTime(call.ended_at)} />
          <DetailItem label="Duration" value={formatDuration(call.recording_duration_seconds)} />
          <DetailItem label="Cost" value={formatCurrency(call.cost)} />
        </div>

        {/* Tenant Info */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">Tenant</h3>
          <Link href={`/admin/tenants/${call.tenant_id}`} className="text-blue-600 hover:underline">
            {call.tenant?.company_name} ({call.tenant?.subdomain})
          </Link>
        </div>

        {/* Lead Info */}
        {call.lead && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Lead</h3>
            <Link href={`/leads/${call.lead_id}`} className="text-blue-600 hover:underline">
              {call.lead.first_name} {call.lead.last_name}
            </Link>
          </div>
        )}

        {/* Recording */}
        {call.recording_url && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Recording</h3>
            <audio controls className="w-full">
              <source src={call.recording_url} type="audio/mpeg" />
            </audio>
          </div>
        )}

        {/* Transcription */}
        {call.transcription && (
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Transcription</h3>
            <div className="bg-gray-50 dark:bg-gray-900 rounded p-4">
              <TranscriptionStatus transcription={call.transcription} />
            </div>
          </div>
        )}
      </ModalContent>

      <ModalActions>
        <Button variant="secondary" onClick={onClose}>Close</Button>
      </ModalActions>
    </Modal>
  );
}
```

### Component 4: TenantConfigCard
**Path**: `/app/src/components/admin/twilio/TenantConfigCard.tsx`

**Features**:
- Tenant name and subdomain
- Configuration summary
- Quick metrics
- View details button

### Component 5: TenantMetricsTable
**Path**: `/app/src/components/admin/twilio/TenantMetricsTable.tsx`

**Features**:
- Comprehensive metrics breakdown
- Success rates
- Visual indicators (progress bars)

---

## API Client Functions

**File**: `/app/src/lib/api/twilio-admin.ts` (add to existing)

```typescript
// Cross-Tenant Monitoring
export async function getAllCalls(params: CallFilters): Promise<PaginatedResponse<CallRecord>> {
  const { data } = await apiClient.get('/admin/communication/calls', { params });
  return data;
}

export async function getAllSMS(params: MessageFilters): Promise<PaginatedResponse<CommunicationEvent>> {
  const { data } = await apiClient.get('/admin/communication/sms', { params });
  return data;
}

export async function getAllWhatsApp(params: MessageFilters): Promise<PaginatedResponse<CommunicationEvent>> {
  const { data } = await apiClient.get('/admin/communication/whatsapp', { params });
  return data;
}

export async function getAllTenantConfigs(): Promise<TenantConfigsResponse> {
  const { data } = await apiClient.get('/admin/communication/tenant-configs');
  return data;
}

export async function getTenantConfigs(tenantId: string): Promise<TenantConfigsResponse> {
  const { data } = await apiClient.get(`/admin/communication/tenants/${tenantId}/configs`);
  return data;
}

export async function getTenantMetrics(tenantId: string): Promise<TenantMetricsResponse> {
  const { data } = await apiClient.get(`/admin/communication/tenants/${tenantId}/metrics`);
  return data;
}
```

---

## TypeScript Types

**File**: `/app/src/lib/types/twilio-admin.ts` (add to existing)

```typescript
export interface CallRecord {
  id: string;
  tenant_id: string;
  tenant?: TenantInfo;
  lead_id?: string;
  lead?: LeadInfo;
  twilio_call_sid: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  status: string;
  call_type: string;
  initiated_by?: string;
  initiated_by_user?: UserInfo;
  recording_url?: string;
  recording_duration_seconds?: number;
  recording_status: string;
  transcription?: TranscriptionInfo;
  cost?: string;
  started_at?: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CallFilters {
  tenant_id?: string;
  status?: string;
  direction?: 'inbound' | 'outbound';
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}

export interface CommunicationEvent {
  id: string;
  tenant_id?: string;
  tenant?: TenantInfo;
  channel: 'sms' | 'whatsapp';
  direction: 'inbound' | 'outbound';
  provider_id: string;
  provider?: ProviderInfo;
  status: string;
  to_phone?: string;
  from_phone?: string;
  text_body?: string;
  provider_message_id?: string;
  sent_at?: string;
  delivered_at?: string;
  created_at: string;
  created_by_user?: UserInfo;
}

export interface MessageFilters extends CallFilters {
  channel?: 'sms' | 'whatsapp';
}

export interface TenantInfo {
  id: string;
  company_name: string;
  subdomain: string;
}

export interface LeadInfo {
  id: string;
  first_name: string;
  last_name: string;
  phones?: Array<{ phone_number: string; is_primary: boolean }>;
}

export interface UserInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

export interface ProviderInfo {
  id: string;
  provider_name: string;
  provider_type: string;
}

export interface TranscriptionInfo {
  id: string;
  status: string;
  transcription_provider: string;
}

export interface TenantConfigsResponse {
  sms_configs: TenantSMSConfig[];
  whatsapp_configs: TenantWhatsAppConfig[];
  ivr_configs: TenantIVRConfig[];
}

export interface TenantSMSConfig {
  id: string;
  tenant_id: string;
  tenant?: TenantInfo;
  provider_id: string;
  from_phone: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantWhatsAppConfig {
  id: string;
  tenant_id: string;
  tenant?: TenantInfo;
  provider_id: string;
  from_phone: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface TenantIVRConfig {
  id: string;
  tenant_id: string;
  tenant?: TenantInfo;
  ivr_enabled: boolean;
  greeting_message?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface TenantMetricsResponse {
  tenant_id: string;
  tenant_name: string;
  metrics: {
    calls: CallMetrics;
    sms: MessageMetrics;
    whatsapp: MessageMetrics;
    transcriptions: TranscriptionMetrics;
  };
  generated_at: string;
}

export interface CallMetrics {
  total: number;
  inbound: number;
  outbound: number;
  completed: number;
  failed: number;
  no_answer: number;
  avg_duration_seconds: number;
  total_duration_minutes: number;
}

export interface MessageMetrics {
  total: number;
  inbound: number;
  outbound: number;
  delivered: number;
  failed: number;
}

export interface TranscriptionMetrics {
  total: number;
  completed: number;
  failed: number;
  success_rate: string;
}
```

---

## CSV Export Implementation

```typescript
import Papa from 'papaparse';

const handleExportCSV = async () => {
  try {
    setExporting(true);

    // Fetch ALL records (not just current page)
    const response = await getAllCalls({
      ...filters,
      page: 1,
      limit: 10000, // Max limit
    });

    // Transform data for CSV
    const csvData = response.data.map(call => ({
      'Date': formatDateTime(call.created_at),
      'Tenant': call.tenant?.company_name || 'N/A',
      'Direction': call.direction,
      'From': call.from_number,
      'To': call.to_number,
      'Status': call.status,
      'Duration (seconds)': call.recording_duration_seconds || 0,
      'Cost': call.cost || '0.00',
      'Lead': call.lead ? `${call.lead.first_name} ${call.lead.last_name}` : 'N/A',
      'Call SID': call.twilio_call_sid,
    }));

    // Generate CSV
    const csv = Papa.unparse(csvData);

    // Download
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `calls-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();

    toast.success(`Exported ${response.data.length} calls successfully`);
  } catch (error) {
    handleApiError(error, 'Failed to export calls');
  } finally {
    setExporting(false);
  }
};
```

---

## Testing Checklist

### Manual Testing

1. **Calls Monitoring Page**
   - [ ] Page loads with calls list
   - [ ] Pagination works correctly
   - [ ] Filters work:
     - [ ] Tenant filter
     - [ ] Status filter
     - [ ] Direction filter
     - [ ] Date range filter
   - [ ] Reset filters button works
   - [ ] Click call opens detail modal
   - [ ] Modal shows complete information
   - [ ] Recording plays (if available)
   - [ ] Links to tenant/lead work
   - [ ] Export CSV downloads file
   - [ ] Mobile responsive

2. **Messages Monitoring Page**
   - [ ] SMS tab loads messages
   - [ ] WhatsApp tab loads messages
   - [ ] Tab switching works correctly
   - [ ] Filters work for both tabs
   - [ ] Message detail modal shows full content
   - [ ] Delivery status displays correctly
   - [ ] Export works for both tabs
   - [ ] Mobile responsive

3. **Tenant Overview Page**
   - [ ] All tenant configs load
   - [ ] Search filters tenants
   - [ ] Tenant cards show correct info
   - [ ] Click navigates to detail page

4. **Tenant Detail Page**
   - [ ] Breadcrumb navigation works
   - [ ] Configurations display correctly
   - [ ] Metrics load and display
   - [ ] Charts render properly
   - [ ] All numbers formatted correctly

### Error Scenarios
- [ ] Test with no data (empty states)
- [ ] Test with API errors (show modal)
- [ ] Test with 404 (stop and report)
- [ ] Test pagination edge cases
- [ ] Test filter combinations

---

## Acceptance Criteria

### Functional
- [ ] All 6 endpoints integrated
- [ ] Calls monitoring with filtering
- [ ] SMS/WhatsApp monitoring
- [ ] Tenant configuration overview
- [ ] Tenant detail metrics
- [ ] CSV export working
- [ ] Pagination on all lists

### UI/UX
- [ ] Responsive design (mobile/tablet/desktop)
- [ ] Loading states on all async operations
- [ ] Error modals (no system prompts)
- [ ] Success feedback
- [ ] Empty states
- [ ] Detail modals functional
- [ ] Links navigate correctly

### Code Quality
- [ ] TypeScript fully typed
- [ ] API client functions
- [ ] Error handling
- [ ] Reusable components
- [ ] Follows existing patterns

---

## Completion Report Template

```markdown
# Sprint 2 Completion Report: Cross-Tenant Communication Monitoring

**Status**: ✅ Complete
**Date**: [DATE]
**Developer**: [YOUR NAME]

## Implemented Features

### Pages
- [x] All Calls Monitoring
- [x] Messages Monitoring (SMS/WhatsApp)
- [x] Tenant Communication Overview
- [x] Tenant Communication Detail

### Components
- [x] CallFilters
- [x] MessageFilters
- [x] CallsTable
- [x] MessagesGrid
- [x] CallDetailModal
- [x] MessageDetailModal
- [x] TenantConfigCard
- [x] TenantMetricsTable

### API Integration
- [x] All 6 endpoints integrated
- [x] Error handling
- [x] Loading states
- [x] CSV export

### Testing
- [x] Manual testing complete
- [x] All acceptance criteria met
- [x] Mobile responsive verified

## Screenshots
[Add screenshots]

## Known Issues
[List any issues]

## Next Steps
Ready for Sprint 3: Usage Tracking & Billing
```

---

**Make us proud with world-class data visualization and monitoring interfaces!** 🚀
