# Sprint 1: Provider Management & System Health

**Agent Role**: Senior Backend Integration Specialist
**Status**: Ready for Implementation
**Endpoints**: 11 total (5 provider + 6 health)
**Estimated Complexity**: High

---

## Mission

You are a senior backend integration specialist responsible for implementing the foundation of the Twilio Admin interface. Your expertise in system health monitoring and provider configuration will ensure robust, production-ready components that would make Google, Amazon, and Apple developers jealous.

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

### Existing Patterns to Follow
- **UI Components**: `/app/src/components/ui/` - Use Button, Modal, Input, Card, LoadingSpinner, Badge
- **API Client**: `/app/src/lib/api/axios.ts` - Already configured with auth interceptors
- **Error Handling**: `/app/src/lib/utils/errors.ts` - Use getUserFriendlyError
- **Admin Pages Example**: `/app/src/app/(dashboard)/admin/communications/providers/page.tsx`

---

## API Endpoints to Integrate

### Provider Management (5 endpoints)

#### 1. GET `/admin/communication/twilio/provider`
**Purpose**: Get current system provider status
**Auth**: SystemAdmin required
**Response**:
```json
{
  "provider_key": "twilio_system",
  "provider_name": "Twilio System Provider",
  "provider_type": "sms",
  "is_active": true,
  "created_at": "2026-02-06T10:30:00.000Z",
  "updated_at": "2026-02-06T10:30:00.000Z"
}
```
**Error**: 404 if not configured

#### 2. POST `/admin/communication/twilio/provider`
**Purpose**: Register system provider
**Auth**: SystemAdmin required
**Request**:
```json
{
  "account_sid": "AC1234567890abcdef1234567890abcd",
  "auth_token": "your_auth_token_here"
}
```
**Validation**:
- `account_sid`: Pattern `^AC[a-z0-9]{32}$`
- `auth_token`: Required, non-empty
**Response**: Same as GET
**Errors**: 400 (validation), 409 (already exists)

#### 3. PATCH `/admin/communication/twilio/provider`
**Purpose**: Update provider credentials
**Auth**: SystemAdmin required
**Request**: Same as POST
**Response**: `{ "message": "System provider updated successfully" }`
**Errors**: 400 (validation), 404 (not found)

#### 4. POST `/admin/communication/twilio/provider/test`
**Purpose**: Test provider connectivity
**Auth**: SystemAdmin required
**Request**: None
**Response**:
```json
{
  "status": "HEALTHY",
  "response_time_ms": 245,
  "message": "System provider connectivity test successful",
  "account_sid": "AC1234567890abcdef1234567890abcd",
  "tested_at": "2026-02-06T14:22:15.000Z"
}
```
**Status Values**: HEALTHY, DEGRADED, DOWN

#### 5. GET `/admin/communication/twilio/available-numbers`
**Purpose**: Get available phone numbers from Twilio
**Auth**: SystemAdmin required
**Query Params**:
- `area_code` (optional): Filter by area code
- `limit` (optional): Max results (default: 20, max: 50)
**Response**:
```json
{
  "available_numbers": [
    {
      "phone_number": "+14155551234",
      "friendly_name": "(415) 555-1234",
      "capabilities": { "voice": true, "SMS": true, "MMS": true },
      "address_requirements": "none",
      "beta": false,
      "iso_country": "US",
      "region": "CA",
      "locality": "San Francisco"
    }
  ],
  "count": 20
}
```

### System Health (6 endpoints)

#### 6. GET `/admin/communication/health`
**Purpose**: Get overall system health
**Auth**: SystemAdmin required
**Response**:
```json
{
  "overall_status": "HEALTHY",
  "checked_at": "2026-02-06T15:30:00.000Z",
  "components": {
    "twilio_api": {
      "status": "HEALTHY",
      "response_time_ms": 156,
      "message": "Twilio API connectivity is healthy"
    },
    "webhooks": {
      "status": "HEALTHY",
      "response_time_ms": 45,
      "message": "Webhook endpoint is accessible"
    },
    "transcription_providers": {
      "status": "HEALTHY",
      "providers": {
        "openai_whisper": {
          "status": "HEALTHY",
          "response_time_ms": 230
        }
      }
    }
  }
}
```

#### 7. POST `/admin/communication/health/twilio-test`
**Purpose**: Test Twilio API connectivity
**Request**: `{ "tenant_id": "tenant-uuid-456" }` (use "system" for system-level)
**Response**: Same format as provider test

#### 8. POST `/admin/communication/health/webhooks-test`
**Purpose**: Test webhook delivery
**Request**: None
**Response**: Same format as provider test

#### 9. POST `/admin/communication/health/transcription-test`
**Purpose**: Test transcription provider
**Request**: None
**Response**: Same format as provider test with providers array

#### 10. GET `/admin/communication/health/provider-response-times`
**Purpose**: Get performance metrics (last 24 hours)
**Response**:
```json
{
  "period": {
    "start": "2026-02-05T16:30:00.000Z",
    "end": "2026-02-06T16:30:00.000Z"
  },
  "twilio_api": {
    "avg_response_time_ms": 178,
    "max_response_time_ms": 456,
    "min_response_time_ms": 89,
    "total_requests": 15230
  },
  "transcription_providers": {
    "openai_whisper": {
      "avg_response_time_ms": 2340,
      "max_response_time_ms": 5680,
      "min_response_time_ms": 1120,
      "total_requests": 950
    }
  }
}
```

#### 11. GET `/admin/communication/alerts`
**Purpose**: Get system alerts
**Query Params**:
- `acknowledged` (optional): boolean
- `severity` (optional): LOW/MEDIUM/HIGH/CRITICAL
- `page` (optional): page number
- `limit` (optional): results per page
**Response**: Paginated list with:
```json
{
  "data": [
    {
      "id": "alert-uuid-123",
      "type": "FAILED_TRANSCRIPTION",
      "severity": "MEDIUM",
      "message": "15 transcriptions failed in the last hour",
      "details": { ... },
      "acknowledged": false,
      "acknowledged_by": null,
      "acknowledged_at": null,
      "created_at": "2026-02-06T14:00:00.000Z"
    }
  ],
  "pagination": { ... }
}
```

---

## Pages to Build

### Page 1: Provider Settings
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/provider/page.tsx`

**Required Features**:
1. Display current provider status (if configured)
2. Show account SID (partially masked: `AC***************abcd`)
3. "Register Provider" button (if not configured)
4. "Update Credentials" button (if configured)
5. "Test Connectivity" button with real-time status display
6. "View Available Numbers" section with area code filter
7. Modal for register/update with form validation
8. Success/error feedback via modals (NO system prompts)

**UI Component Structure**:
```tsx
<div className="space-y-6">
  {/* Header */}
  <div className="flex items-center justify-between">
    <h1>Twilio Provider Settings</h1>
  </div>

  {/* Current Status Card */}
  {provider ? (
    <ProviderCard
      provider={provider}
      onUpdate={handleShowUpdateModal}
      onTest={handleTestConnectivity}
    />
  ) : (
    <EmptyStateCard onRegister={handleShowRegisterModal} />
  )}

  {/* Test Results */}
  {testResult && <TestResultBanner result={testResult} />}

  {/* Available Numbers Section */}
  <AvailableNumbersSection />

  {/* Modals */}
  <RegisterProviderModal
    isOpen={showRegisterModal}
    onClose={() => setShowRegisterModal(false)}
    onSuccess={handleProviderRegistered}
  />

  <UpdateProviderModal
    isOpen={showUpdateModal}
    onClose={() => setShowUpdateModal(false)}
    onSuccess={handleProviderUpdated}
  />
</div>
```

**State Management**:
```typescript
const [provider, setProvider] = useState<SystemProvider | null>(null);
const [loading, setLoading] = useState(true);
const [showRegisterModal, setShowRegisterModal] = useState(false);
const [showUpdateModal, setShowUpdateModal] = useState(false);
const [testing, setTesting] = useState(false);
const [testResult, setTestResult] = useState<ConnectivityTestResult | null>(null);
const [availableNumbers, setAvailableNumbers] = useState<AvailableNumber[]>([]);
const [areaCode, setAreaCode] = useState('');
```

### Page 2: System Health Dashboard
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/health/page.tsx`

**Required Features**:
1. Overall health status badge (color-coded)
2. Component-level health cards (Twilio API, Webhooks, Transcription)
3. Response time metrics chart (last 24 hours)
4. System alerts list (unacknowledged first)
5. Manual test buttons for each component
6. Auto-refresh every 30 seconds

**UI Component Structure**:
```tsx
<div className="space-y-6">
  {/* Overall Status Banner */}
  <OverallHealthBanner status={health?.overall_status} />

  {/* Component Health Grid */}
  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
    <ComponentHealthCard
      title="Twilio API"
      component={health?.components.twilio_api}
      onTest={handleTestTwilio}
    />
    <ComponentHealthCard
      title="Webhooks"
      component={health?.components.webhooks}
      onTest={handleTestWebhooks}
    />
    <ComponentHealthCard
      title="Transcription"
      component={health?.components.transcription_providers}
      onTest={handleTestTranscription}
    />
  </div>

  {/* Performance Metrics */}
  <ResponseTimeChart metrics={responseMetrics} />

  {/* System Alerts */}
  <SystemAlertsSection alerts={alerts} />
</div>
```

**Auto-Refresh Implementation**:
```typescript
useEffect(() => {
  fetchHealthData();

  const interval = setInterval(() => {
    fetchHealthData();
  }, 30000); // 30 seconds

  return () => clearInterval(interval);
}, []);
```

---

## Components to Create

### Component 1: ProviderCard
**Path**: `/app/src/components/admin/twilio/ProviderCard.tsx`

**Props**:
```typescript
interface ProviderCardProps {
  provider: SystemProvider;
  onUpdate: () => void;
  onTest: () => void;
}
```

**Features**:
- Display provider info with masked account SID
- Status badge (Active/Inactive)
- Created/Updated timestamps
- Action buttons: "Update Credentials", "Test Connectivity"

### Component 2: RegisterProviderModal
**Path**: `/app/src/components/admin/twilio/RegisterProviderModal.tsx`

**Props**:
```typescript
interface RegisterProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (provider: SystemProvider) => void;
}
```

**Features**:
- Form with account_sid and auth_token inputs
- Real-time validation
- Loading state during submission
- Error display (inline for validation, modal for API errors)
- Success feedback via modal

**Validation Logic**:
```typescript
const validate = (): boolean => {
  const errors: Record<string, string> = {};

  if (!accountSid.trim()) {
    errors.account_sid = 'Account SID is required';
  } else if (!/^AC[a-z0-9]{32}$/.test(accountSid)) {
    errors.account_sid = 'Invalid Account SID format (must start with AC and be 34 characters)';
  }

  if (!authToken.trim()) {
    errors.auth_token = 'Auth Token is required';
  }

  setErrors(errors);
  return Object.keys(errors).length === 0;
};
```

### Component 3: SystemHealthCard
**Path**: `/app/src/components/admin/twilio/SystemHealthCard.tsx`

**Features**:
- Component name and status badge
- Response time display
- Status message
- Test button
- Loading state during test

### Component 4: ResponseTimeChart
**Path**: `/app/src/components/admin/twilio/ResponseTimeChart.tsx`

**Uses**: `recharts` library

**Chart Type**: Line chart showing avg/max/min response times

**Implementation**:
```typescript
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export function ResponseTimeChart({ metrics }: { metrics: ResponseTimeMetrics }) {
  const chartData = [
    { name: 'Twilio API', avg: metrics.twilio_api.avg_response_time_ms, max: metrics.twilio_api.max_response_time_ms, min: metrics.twilio_api.min_response_time_ms },
    // Add transcription providers...
  ];

  return (
    <Card className="p-6">
      <h3 className="text-lg font-semibold mb-4">Response Time Metrics (24h)</h3>
      <LineChart width={800} height={300} data={chartData}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis label={{ value: 'Response Time (ms)', angle: -90 }} />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="avg" stroke="#3b82f6" name="Average" />
        <Line type="monotone" dataKey="max" stroke="#ef4444" name="Max" />
        <Line type="monotone" dataKey="min" stroke="#10b981" name="Min" />
      </LineChart>
    </Card>
  );
}
```

### Component 5: SystemAlertCard
**Path**: `/app/src/components/admin/twilio/SystemAlertCard.tsx`

**Features**:
- Alert type and severity badge
- Message display
- Timestamp
- Acknowledgement status
- Details expansion

---

## API Client Implementation

**File**: `/app/src/lib/api/twilio-admin.ts`

```typescript
import { apiClient } from './axios';
import type {
  SystemProvider,
  RegisterProviderDto,
  UpdateProviderDto,
  ConnectivityTestResult,
  AvailableNumbersResponse,
  SystemHealthResponse,
  TestResult,
  ResponseTimeMetrics,
  SystemAlert,
  AlertsQuery,
  PaginatedResponse,
} from '../types/twilio-admin';

// Provider Management
export async function getSystemProvider(): Promise<SystemProvider> {
  const { data } = await apiClient.get('/admin/communication/twilio/provider');
  return data;
}

export async function registerSystemProvider(dto: RegisterProviderDto): Promise<SystemProvider> {
  const { data } = await apiClient.post('/admin/communication/twilio/provider', dto);
  return data;
}

export async function updateSystemProvider(dto: UpdateProviderDto): Promise<{ message: string }> {
  const { data } = await apiClient.patch('/admin/communication/twilio/provider', dto);
  return data;
}

export async function testSystemProvider(): Promise<ConnectivityTestResult> {
  const { data } = await apiClient.post('/admin/communication/twilio/provider/test');
  return data;
}

export async function getAvailableNumbers(params?: {
  area_code?: string;
  limit?: number;
}): Promise<AvailableNumbersResponse> {
  const { data } = await apiClient.get('/admin/communication/twilio/available-numbers', { params });
  return data;
}

// System Health
export async function getSystemHealth(): Promise<SystemHealthResponse> {
  const { data } = await apiClient.get('/admin/communication/health');
  return data;
}

export async function testTwilioConnectivity(tenantId: string): Promise<TestResult> {
  const { data } = await apiClient.post('/admin/communication/health/twilio-test', { tenant_id: tenantId });
  return data;
}

export async function testWebhooks(): Promise<TestResult> {
  const { data } = await apiClient.post('/admin/communication/health/webhooks-test');
  return data;
}

export async function testTranscriptionProvider(): Promise<TestResult> {
  const { data } = await apiClient.post('/admin/communication/health/transcription-test');
  return data;
}

export async function getProviderResponseTimes(): Promise<ResponseTimeMetrics> {
  const { data } = await apiClient.get('/admin/communication/health/provider-response-times');
  return data;
}

export async function getSystemAlerts(params?: AlertsQuery): Promise<PaginatedResponse<SystemAlert>> {
  const { data } = await apiClient.get('/admin/communication/alerts', { params });
  return data;
}
```

---

## TypeScript Types

**File**: `/app/src/lib/types/twilio-admin.ts`

```typescript
export interface SystemProvider {
  provider_key: string;
  provider_name: string;
  provider_type: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RegisterProviderDto {
  account_sid: string;
  auth_token: string;
}

export interface UpdateProviderDto extends RegisterProviderDto {}

export interface ConnectivityTestResult {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  response_time_ms: number;
  message: string;
  account_sid?: string;
  tested_at: string;
}

export interface AvailableNumbersResponse {
  available_numbers: AvailableNumber[];
  count: number;
}

export interface AvailableNumber {
  phone_number: string;
  friendly_name: string;
  capabilities: {
    voice: boolean;
    SMS: boolean;
    MMS: boolean;
  };
  address_requirements: string;
  beta: boolean;
  iso_country: string;
  region?: string;
  locality?: string;
}

export interface SystemHealthResponse {
  overall_status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  checked_at: string;
  components: {
    twilio_api: ComponentHealth;
    webhooks: ComponentHealth;
    transcription_providers: TranscriptionHealth;
  };
}

export interface ComponentHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  response_time_ms: number;
  message: string;
}

export interface TranscriptionHealth {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  providers: Record<string, ComponentHealth>;
}

export interface TestResult {
  status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  response_time_ms?: number;
  message: string;
  tested_at: string;
  providers_tested?: string[];
}

export interface SystemAlert {
  id: string;
  type: 'SYSTEM_HEALTH' | 'FAILED_TRANSCRIPTION' | 'QUOTA_EXCEEDED' | 'HIGH_USAGE';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details?: any;
  acknowledged: boolean;
  acknowledged_by?: any;
  acknowledged_at?: string;
  created_at: string;
}

export interface AlertsQuery {
  acknowledged?: boolean;
  severity?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  page?: number;
  limit?: number;
}

export interface ResponseTimeMetrics {
  period: {
    start: string;
    end: string;
  };
  twilio_api: ProviderMetrics;
  transcription_providers: Record<string, ProviderMetrics>;
}

export interface ProviderMetrics {
  avg_response_time_ms: number;
  max_response_time_ms: number;
  min_response_time_ms: number;
  total_requests: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}
```

---

## Error Handling Protocol

### Critical Rule: STOP on API Errors

If you encounter ANY of these issues:
1. **404 Not Found** - Wrong endpoint path
2. **401 Unauthorized** - Despite using admin credentials
3. **403 Forbidden** - Despite SystemAdmin role
4. **500 Internal Server Error** - Persistent failures
5. **Unexpected Response Format** - Response doesn't match docs

**DO THIS**:
1. STOP execution immediately
2. Log the complete error response:
   ```typescript
   console.error('STOP: API Error Detected', {
     endpoint: error.response?.config?.url,
     method: error.response?.config?.method,
     status: error.response?.status,
     data: error.response?.data,
     expected: 'Expected response format from documentation'
   });
   ```
3. Show error modal to user with message: "API integration error - development team has been notified"
4. Create a detailed error report
5. Request human intervention

**DO NOT**:
- Try alternative endpoints
- Loop trying different approaches
- Make assumptions about API structure
- Continue with partial implementations

---

## Testing Checklist

### Manual Testing Steps

1. **Login Test**
   - [ ] Login with admin credentials
   - [ ] Verify SystemAdmin role access
   - [ ] Navigate to provider settings page

2. **Provider Registration Flow**
   - [ ] Click "Register Provider" button
   - [ ] Modal opens with form
   - [ ] Test validation:
     - [ ] Empty fields show errors
     - [ ] Invalid account SID format shows error
     - [ ] Valid input passes validation
   - [ ] Submit with valid credentials
   - [ ] Success modal appears
   - [ ] Provider card displays with correct info
   - [ ] Account SID is masked: `AC***************abcd`

3. **Provider Update Flow**
   - [ ] Click "Update Credentials" button
   - [ ] Confirmation modal appears (warning about impact)
   - [ ] Submit with new credentials
   - [ ] Success feedback shows
   - [ ] Provider info updates

4. **Connectivity Test**
   - [ ] Click "Test Connectivity" button
   - [ ] Loading state shows
   - [ ] Test result displays with:
     - [ ] Status badge (HEALTHY/DEGRADED/DOWN)
     - [ ] Response time
     - [ ] Message
     - [ ] Timestamp
   - [ ] Color-coded based on status

5. **Available Numbers**
   - [ ] Numbers list loads
   - [ ] Area code filter works
   - [ ] Limit parameter works
   - [ ] Number capabilities display correctly

6. **Health Dashboard**
   - [ ] Navigate to health page
   - [ ] Overall status banner shows
   - [ ] All component health cards display
   - [ ] Response time chart renders
   - [ ] System alerts list loads
   - [ ] Auto-refresh works (30s interval)

7. **Component Tests**
   - [ ] Twilio API test button works
   - [ ] Webhooks test button works
   - [ ] Transcription test button works
   - [ ] Test results display correctly

8. **Alerts Filtering**
   - [ ] Filter by acknowledged status
   - [ ] Filter by severity
   - [ ] Pagination works

### Error Scenarios

- [ ] Test with invalid credentials (should show validation error)
- [ ] Test with 404 response (should stop and request help)
- [ ] Test without authentication (should redirect to login)
- [ ] Test network error (should show error modal with retry)

---

## Acceptance Criteria

### Functional Requirements
- [ ] All 11 endpoints integrated and working
- [ ] Provider registration with validation
- [ ] Provider update with confirmation
- [ ] Connectivity testing with real-time results
- [ ] Available numbers listing with filters
- [ ] System health dashboard with auto-refresh
- [ ] Component health testing
- [ ] Response time metrics visualization
- [ ] System alerts with filtering

### UI/UX Requirements
- [ ] Modern, production-ready UI
- [ ] Consistent with existing admin pages
- [ ] All modals (no system prompts)
- [ ] Loading states on all async operations
- [ ] Error feedback via modals
- [ ] Success feedback via modals
- [ ] Mobile-responsive design
- [ ] Dark mode support

### Code Quality
- [ ] Full TypeScript coverage
- [ ] No `any` types
- [ ] Proper error handling
- [ ] API client functions tested
- [ ] Components tested
- [ ] Follows existing patterns

---

## Completion Report Template

When finished, create this report:

```markdown
# Sprint 1 Completion Report: Provider Management & System Health

**Status**: ✅ Complete
**Date**: [DATE]
**Developer**: [YOUR NAME]

## Implemented Features

### Pages
- [x] Provider Settings Page (`/admin/communications/twilio/provider`)
- [x] System Health Dashboard (`/admin/communications/twilio/health`)

### Components
- [x] ProviderCard
- [x] RegisterProviderModal
- [x] UpdateProviderModal
- [x] SystemHealthCard
- [x] ComponentHealthCard
- [x] ResponseTimeChart
- [x] SystemAlertCard

### API Integration
- [x] All 11 endpoints integrated
- [x] Error handling implemented
- [x] Loading states on all operations
- [x] Type-safe with TypeScript

### Testing
- [x] Manual testing completed
- [x] All acceptance criteria met
- [x] Error scenarios tested
- [x] Mobile-responsive verified

## Screenshots
[Add screenshots of key pages]

## Known Issues
[List any issues or limitations]

## Next Steps
Ready for Sprint 2: Cross-Tenant Communication Monitoring
```

---

**Remember**: Your code should be so clean, so well-structured, and so production-ready that developers at Google, Amazon, and Apple would be jealous. Make us proud! 🚀
