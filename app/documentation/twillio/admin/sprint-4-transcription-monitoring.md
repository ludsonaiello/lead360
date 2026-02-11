# Sprint 4: Transcription Monitoring & Management

**Agent Role**: Senior AI/ML Operations Specialist
**Expertise**: ML model monitoring, failure analysis, automated retry systems, provider performance tracking
**API Endpoints Covered**: 4 endpoints
**Quality Standard**: Google/Amazon/Apple level production code

---

## Overview

This sprint implements comprehensive transcription monitoring and management capabilities for the Twilio Admin interface. The focus is on identifying failed transcriptions, understanding failure patterns, managing retry workflows, and monitoring transcription provider performance.

**Admin Test Credentials**:
- **Email**: ludsonaiello@gmail.com
- **Password**: 978@F32c

**CRITICAL**: If any API endpoint returns 404, wrong path, or unexpected errors, STOP immediately and request human intervention. DO NOT attempt alternative endpoints or loop.

---

## Sprint Objectives

1. Build transcription failure monitoring dashboard
2. Implement individual and bulk retry functionality
3. Create transcription detail view with full context
4. Display transcription provider statistics and performance
5. Enable filtering and search capabilities
6. Provide admin tools for transcription troubleshooting

---

## API Endpoints (4 Total)

### Transcription Monitoring

1. **GET** `/transcriptions/failed` - Get all failed transcriptions
2. **GET** `/transcriptions/:id` - Get detailed transcription information
3. **POST** `/transcriptions/:id/retry` - Retry a failed transcription
4. **GET** `/transcription-providers` - Get all transcription providers with statistics

---

## Pages to Build

### 4.1 Transcriptions Dashboard
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/transcriptions/page.tsx`

#### Features

**Primary Focus**: Failed transcriptions management
- List all failed transcriptions with error details
- Display transcription provider statistics
- Show overall success rates and metrics
- Retry individual failed transcriptions
- Bulk retry multiple failed transcriptions
- Filter by provider, status, date range
- Search by call SID or transcription ID
- Link to detailed transcription view
- Link to related call records

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ Transcriptions Dashboard                                │
├─────────────────────────────────────────────────────────┤
│ [Provider Stats Cards - Row 1]                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│ │Provider 1│ │Provider 2│ │Provider 3│ │Overall   │   │
│ │99.2% ✓   │ │98.7% ✓   │ │95.1% ⚠   │ │98.5% ✓   │   │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
├─────────────────────────────────────────────────────────┤
│ Failed Transcriptions                                   │
│ [Filters] Provider: [All ▾] Status: [Failed ▾]         │
│ Search: [____________] [🔍] [Retry All Selected]        │
├─────────────────────────────────────────────────────────┤
│ ☐ Call SID    │ Provider  │ Error        │ Created    │ │
│ ☐ AC123...    │ Deepgram  │ Audio too... │ 2h ago  [↻]│ │
│ ☐ AC456...    │ Whisper   │ Timeout      │ 5h ago  [↻]│ │
│ ☐ AC789...    │ Deepgram  │ Invalid...   │ 1d ago  [↻]│ │
└─────────────────────────────────────────────────────────┘
```

**State Management**:
```typescript
const [failedTranscriptions, setFailedTranscriptions] = useState<FailedTranscription[]>([]);
const [providers, setProviders] = useState<TranscriptionProvider[]>([]);
const [loading, setLoading] = useState(true);
const [retrying, setRetrying] = useState<Record<string, boolean>>({});
const [selectedIds, setSelectedIds] = useState<string[]>([]);
const [filters, setFilters] = useState({
  provider: '',
  search: '',
});
```

**Components Needed**:
- `TranscriptionProviderCard.tsx` - Provider statistics card
- `FailedTranscriptionsTable.tsx` - Table with failed transcriptions
- `RetryTranscriptionButton.tsx` - Retry button with loading state
- `BulkRetryButton.tsx` - Bulk action button
- `TranscriptionFilters.tsx` - Filter controls

**API Endpoints**:
- GET `/transcriptions/failed` - Load failed transcriptions
- GET `/transcription-providers` - Load provider stats
- POST `/transcriptions/:id/retry` - Retry individual transcription

---

### 4.2 Transcription Detail Page
**Path**: `/app/src/app/(dashboard)/admin/communications/twilio/transcriptions/[id]/page.tsx`

#### Features

**Full Transcription Context**:
- Complete transcription information
- Associated call details with link
- Tenant information with link
- Lead information with link (if available)
- Transcription text display (if completed)
- Language detection results
- Confidence score visualization
- Processing duration and cost
- Provider information
- Error details (if failed)
- Retry button with confirmation
- Status timeline

**UI Layout**:
```
┌─────────────────────────────────────────────────────────┐
│ ← Back to Transcriptions                                │
│ Transcription Details                                   │
├─────────────────────────────────────────────────────────┤
│ Status: [Failed ❌]        Provider: Deepgram           │
│ Created: Jan 15, 2026 14:32   Cost: $0.12              │
├─────────────────────────────────────────────────────────┤
│ Call Information                                        │
│ Call SID: AC1234567890abcdef  [View Call →]            │
│ Recording Duration: 3m 45s                              │
│ Recording URL: https://...                              │
├─────────────────────────────────────────────────────────┤
│ Tenant & Lead                                           │
│ Tenant: Acme Roofing  [View Tenant →]                  │
│ Lead: John Doe  [View Lead →]                          │
├─────────────────────────────────────────────────────────┤
│ Transcription Result                                    │
│ ┌─────────────────────────────────────────────────┐   │
│ │ [Transcription text would appear here if        │   │
│ │  completed. Shows error message if failed.]     │   │
│ │                                                  │   │
│ │ Error: Audio quality too low for transcription  │   │
│ └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│ Processing Details                                      │
│ Language Detected: en-US                                │
│ Confidence Score: N/A (failed)                          │
│ Processing Duration: 2.3 seconds                        │
├─────────────────────────────────────────────────────────┤
│ [Retry Transcription]                                   │
└─────────────────────────────────────────────────────────┘
```

**State Management**:
```typescript
const [transcription, setTranscription] = useState<TranscriptionDetail | null>(null);
const [loading, setLoading] = useState(true);
const [retrying, setRetrying] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Components Needed**:
- `TranscriptionDetailCard.tsx` - Main detail display
- `TranscriptionTextDisplay.tsx` - Text viewer with formatting
- `CallInfoCard.tsx` - Associated call information
- `ConfidenceScoreGauge.tsx` - Visual confidence indicator
- `TranscriptionStatusBadge.tsx` - Status indicator
- `RetryConfirmationModal.tsx` - Confirmation dialog

**API Endpoints**:
- GET `/transcriptions/:id` - Load transcription details
- POST `/transcriptions/:id/retry` - Retry transcription

---

## File Structure

```
app/src/
├── app/(dashboard)/admin/communications/twilio/
│   └── transcriptions/
│       ├── page.tsx                          # Transcriptions dashboard
│       └── [id]/
│           └── page.tsx                      # Transcription detail
│
├── components/admin/twilio/
│   ├── TranscriptionProviderCard.tsx         # Provider stats card
│   ├── FailedTranscriptionsTable.tsx         # Failed list table
│   ├── TranscriptionDetailCard.tsx           # Detail display
│   ├── TranscriptionTextDisplay.tsx          # Text viewer
│   ├── RetryTranscriptionButton.tsx          # Individual retry button
│   ├── BulkRetryButton.tsx                   # Bulk retry action
│   ├── TranscriptionFilters.tsx              # Filter component
│   ├── CallInfoCard.tsx                      # Call information
│   ├── ConfidenceScoreGauge.tsx             # Score visualization
│   ├── TranscriptionStatusBadge.tsx          # Status badge
│   └── RetryConfirmationModal.tsx            # Confirmation modal
│
├── lib/api/
│   └── twilio-admin.ts                       # API client functions
│
└── lib/types/
    └── twilio-admin.ts                       # TypeScript interfaces
```

---

## Implementation Details

### API Client Functions

**File**: `/app/src/lib/api/twilio-admin.ts`

Add the following functions:

```typescript
import { apiClient } from './axios';

// Transcription Monitoring
export async function getFailedTranscriptions(): Promise<FailedTranscriptionsResponse> {
  try {
    const { data } = await apiClient.get('/admin/communication/transcriptions/failed');
    return data;
  } catch (error) {
    console.error('[getFailedTranscriptions] Error:', error);
    throw error;
  }
}

export async function getTranscriptionDetails(id: string): Promise<TranscriptionDetail> {
  try {
    const { data } = await apiClient.get(`/admin/communication/transcriptions/${id}`);
    return data;
  } catch (error) {
    console.error(`[getTranscriptionDetails] Error for ID ${id}:`, error);
    throw error;
  }
}

export async function retryTranscription(id: string): Promise<{ message: string }> {
  try {
    const { data } = await apiClient.post(`/admin/communication/transcriptions/${id}/retry`);
    return data;
  } catch (error) {
    console.error(`[retryTranscription] Error for ID ${id}:`, error);
    throw error;
  }
}

export async function getTranscriptionProviders(): Promise<TranscriptionProvidersResponse> {
  try {
    const { data } = await apiClient.get('/admin/communication/transcription-providers');
    return data;
  } catch (error) {
    console.error('[getTranscriptionProviders] Error:', error);
    throw error;
  }
}

// Bulk retry utility (calls individual retry in sequence)
export async function bulkRetryTranscriptions(ids: string[]): Promise<{
  succeeded: string[];
  failed: { id: string; error: string }[];
}> {
  const results = { succeeded: [] as string[], failed: [] as { id: string; error: string }[] };

  for (const id of ids) {
    try {
      await retryTranscription(id);
      results.succeeded.push(id);
    } catch (error: any) {
      results.failed.push({ id, error: error?.message || 'Unknown error' });
    }
  }

  return results;
}
```

---

### TypeScript Interfaces

**File**: `/app/src/lib/types/twilio-admin.ts`

Add the following interfaces:

```typescript
// Transcription Types

export interface FailedTranscriptionsResponse {
  failed_transcriptions: FailedTranscription[];
  count: number;
}

export interface FailedTranscription {
  id: string;
  tenant_id: string;
  call_record_id: string;
  transcription_provider: string;
  status: 'failed';
  error_message: string;
  created_at: string;
  call_details: {
    twilio_call_sid: string;
    recording_url: string;
    recording_duration_seconds: number;
  };
}

export interface TranscriptionDetail {
  id: string;
  tenant: {
    id: string;
    name: string;
    subdomain: string;
  };
  call: {
    id: string;
    twilio_call_sid: string;
    direction: 'inbound' | 'outbound';
    from_number: string;
    to_number: string;
    recording_url: string;
    recording_duration_seconds: number;
    started_at: string;
  };
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    primary_phone: string;
  };
  transcription_provider: string;
  status: 'completed' | 'failed' | 'queued' | 'processing';
  transcription_text?: string;
  language_detected?: string;
  confidence_score?: string;
  processing_duration_seconds?: number;
  cost?: string;
  error_message?: string;
  created_at: string;
  completed_at?: string;
  updated_at: string;
}

export interface TranscriptionProvidersResponse {
  providers: TranscriptionProvider[];
  total_count: number;
}

export interface TranscriptionProvider {
  id: string;
  provider_name: string;
  tenant?: {
    id: string;
    name: string;
  };
  is_system_default: boolean;
  status: 'active' | 'inactive' | 'error';
  usage_limit: number;
  usage_current: number;
  cost_per_minute: string;
  statistics: {
    total_transcriptions: number;
    successful: number;
    failed: number;
    success_rate: string;
  };
  created_at: string;
  updated_at: string;
}
```

---

### Example Component Implementations

#### TranscriptionProviderCard.tsx

```typescript
'use client';

import { TranscriptionProvider } from '@/lib/types/twilio-admin';
import { formatCurrency } from '@/lib/utils/currency-formatter';

interface TranscriptionProviderCardProps {
  provider: TranscriptionProvider;
}

export function TranscriptionProviderCard({ provider }: TranscriptionProviderCardProps) {
  const successRate = parseFloat(provider.statistics.success_rate);
  const isHealthy = successRate >= 98;
  const isDegraded = successRate >= 95 && successRate < 98;

  const statusColor = isHealthy ? 'text-green-600' : isDegraded ? 'text-yellow-600' : 'text-red-600';
  const bgColor = isHealthy ? 'bg-green-50' : isDegraded ? 'bg-yellow-50' : 'bg-red-50';
  const borderColor = isHealthy ? 'border-green-200' : isDegraded ? 'border-yellow-200' : 'border-red-200';

  return (
    <div className={`rounded-lg border ${borderColor} ${bgColor} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {provider.provider_name}
        </h3>
        {provider.is_system_default && (
          <span className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-100 rounded-full">
            System Default
          </span>
        )}
      </div>

      <div className={`text-2xl font-bold ${statusColor} mb-2`}>
        {provider.statistics.success_rate}
      </div>

      <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
        <div className="flex justify-between">
          <span>Total:</span>
          <span className="font-medium">{provider.statistics.total_transcriptions.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Successful:</span>
          <span className="font-medium text-green-600">{provider.statistics.successful.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Failed:</span>
          <span className="font-medium text-red-600">{provider.statistics.failed.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span>Cost/min:</span>
          <span className="font-medium">{formatCurrency(provider.cost_per_minute)}</span>
        </div>
        <div className="flex justify-between">
          <span>Usage:</span>
          <span className="font-medium">
            {provider.usage_current.toLocaleString()} / {provider.usage_limit.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
```

#### RetryTranscriptionButton.tsx

```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { retryTranscription } from '@/lib/api/twilio-admin';

interface RetryTranscriptionButtonProps {
  transcriptionId: string;
  onSuccess?: () => void;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
}

export function RetryTranscriptionButton({
  transcriptionId,
  onSuccess,
  size = 'sm',
  variant = 'secondary',
}: RetryTranscriptionButtonProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await retryTranscription(transcriptionId);
      setShowSuccessModal(true);
      onSuccess?.();
    } catch (error: any) {
      console.error('[RetryTranscriptionButton] Retry failed:', error);
      setErrorMessage(error?.response?.data?.message || 'Failed to retry transcription');
      setShowErrorModal(true);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleRetry}
        disabled={isRetrying}
        size={size}
        variant={variant}
      >
        {isRetrying ? 'Retrying...' : 'Retry'}
      </Button>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        title="Retry Initiated"
      >
        <p className="text-gray-700 dark:text-gray-300">
          Transcription has been queued for retry. It may take a few minutes to process.
        </p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setShowSuccessModal(false)}>
            OK
          </Button>
        </div>
      </Modal>

      {/* Error Modal */}
      <Modal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        title="Retry Failed"
      >
        <p className="text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setShowErrorModal(false)}>
            Close
          </Button>
        </div>
      </Modal>
    </>
  );
}
```

#### FailedTranscriptionsTable.tsx

```typescript
'use client';

import { useState } from 'react';
import { FailedTranscription } from '@/lib/types/twilio-admin';
import { formatDateTime } from '@/lib/utils/date-formatter';
import { RetryTranscriptionButton } from './RetryTranscriptionButton';
import Link from 'next/link';

interface FailedTranscriptionsTableProps {
  transcriptions: FailedTranscription[];
  onRetrySuccess?: () => void;
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

export function FailedTranscriptionsTable({
  transcriptions,
  onRetrySuccess,
  selectedIds,
  onSelectionChange,
}: FailedTranscriptionsTableProps) {
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onSelectionChange(transcriptions.map(t => t.id));
    } else {
      onSelectionChange([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const allSelected = transcriptions.length > 0 && selectedIds.length === transcriptions.length;
  const someSelected = selectedIds.length > 0 && selectedIds.length < transcriptions.length;

  if (transcriptions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">
          No failed transcriptions found. All transcriptions are processing successfully!
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th className="px-4 py-3 text-left">
              <input
                type="checkbox"
                checked={allSelected}
                ref={input => {
                  if (input) input.indeterminate = someSelected;
                }}
                onChange={e => handleSelectAll(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600"
              />
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Call SID
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Provider
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Error Message
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Duration
            </th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Created
            </th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
          {transcriptions.map((transcription) => (
            <tr key={transcription.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(transcription.id)}
                  onChange={e => handleSelectOne(transcription.id, e.target.checked)}
                  className="rounded border-gray-300 dark:border-gray-600"
                />
              </td>
              <td className="px-4 py-3">
                <Link
                  href={`/admin/communications/twilio/transcriptions/${transcription.id}`}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-mono text-sm"
                >
                  {transcription.call_details.twilio_call_sid}
                </Link>
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                {transcription.transcription_provider}
              </td>
              <td className="px-4 py-3 text-sm text-red-600 dark:text-red-400">
                {transcription.error_message}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {transcription.call_details.recording_duration_seconds}s
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                {formatDateTime(transcription.created_at)}
              </td>
              <td className="px-4 py-3 text-right">
                <RetryTranscriptionButton
                  transcriptionId={transcription.id}
                  onSuccess={onRetrySuccess}
                  size="sm"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

---

## Acceptance Criteria

### Functional Requirements
- [ ] Transcriptions dashboard loads with failed transcriptions list
- [ ] Provider statistics cards display with accurate success rates
- [ ] Can retry individual transcription with success feedback
- [ ] Bulk retry works with multiple selections
- [ ] Transcription detail page shows complete information
- [ ] Transcription text displays correctly (when available)
- [ ] Error messages are clear and actionable
- [ ] Links to call, tenant, and lead work correctly
- [ ] Filters work correctly (provider, search)
- [ ] All loading states display appropriately
- [ ] All errors show in modals (no system prompts)

### UI/UX Requirements
- [ ] Provider cards use color coding for health status
- [ ] Success rates displayed as percentages with appropriate colors
- [ ] Failed transcriptions table is sortable
- [ ] Checkbox selection works smoothly
- [ ] Retry buttons show loading state
- [ ] Success/error modals provide clear feedback
- [ ] Mobile responsive (tested on 375px width)
- [ ] Dark mode support throughout
- [ ] Proper empty states when no failures

### Code Quality Requirements
- [ ] All components fully typed (TypeScript)
- [ ] No `any` types without justification
- [ ] Error handling for all API calls
- [ ] Loading states on all async operations
- [ ] Proper component organization
- [ ] Consistent naming conventions
- [ ] API client functions documented

---

## Testing Checklist

### Manual Testing

1. **Dashboard Load**
   - [ ] Navigate to `/admin/communications/twilio/transcriptions`
   - [ ] Verify failed transcriptions list loads
   - [ ] Verify provider statistics cards display
   - [ ] Check loading states appear correctly

2. **Provider Statistics**
   - [ ] Verify success rates calculate correctly
   - [ ] Check color coding (green ≥98%, yellow 95-98%, red <95%)
   - [ ] Verify total/successful/failed counts match
   - [ ] Check system default badge appears correctly

3. **Individual Retry**
   - [ ] Click retry button on a failed transcription
   - [ ] Verify loading state appears
   - [ ] Verify success modal displays
   - [ ] Verify transcription updates after retry

4. **Bulk Retry**
   - [ ] Select multiple transcriptions using checkboxes
   - [ ] Click "Retry All Selected" button
   - [ ] Verify confirmation modal appears
   - [ ] Verify bulk retry processes correctly
   - [ ] Check success/failure reporting

5. **Filters and Search**
   - [ ] Filter by provider and verify results
   - [ ] Search by call SID and verify results
   - [ ] Clear filters and verify reset

6. **Detail Page**
   - [ ] Click on a transcription to view details
   - [ ] Verify all information displays correctly
   - [ ] Test links to call, tenant, lead
   - [ ] Test retry button on detail page
   - [ ] Verify transcription text displays (if available)

7. **Error Handling**
   - [ ] Test with invalid transcription ID
   - [ ] Test retry on already completed transcription
   - [ ] Verify error modals display correctly

8. **Mobile Responsive**
   - [ ] Test dashboard on 375px viewport
   - [ ] Verify table adapts or scrolls horizontally
   - [ ] Test all interactions work on mobile

### API Validation

Use the admin credentials to test each endpoint:
- **Email**: ludsonaiello@gmail.com
- **Password**: 978@F32c

**Test with curl**:
```bash
# Get auth token
TOKEN=$(curl -X POST https://api.lead360.app/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' \
  | jq -r '.access_token')

# Test failed transcriptions
curl https://api.lead360.app/api/admin/communication/transcriptions/failed \
  -H "Authorization: Bearer $TOKEN"

# Test transcription detail (replace with real ID)
curl https://api.lead360.app/api/admin/communication/transcriptions/{id} \
  -H "Authorization: Bearer $TOKEN"

# Test retry (replace with real ID)
curl -X POST https://api.lead360.app/api/admin/communication/transcriptions/{id}/retry \
  -H "Authorization: Bearer $TOKEN"

# Test providers
curl https://api.lead360.app/api/admin/communication/transcription-providers \
  -H "Authorization: Bearer $TOKEN"
```

**CRITICAL**: If any endpoint returns 404, unexpected structure, or persistent errors:
1. STOP immediately
2. Document the exact error response
3. Report to human for investigation
4. DO NOT attempt alternative endpoints

---

## Error Handling Protocol

### When to STOP and Request Human Help

**Immediate Stop Conditions**:
1. **404 Not Found**: API endpoint path is incorrect
2. **401 Unauthorized**: Authentication failing despite correct credentials
3. **403 Forbidden**: Permission denied for SystemAdmin user
4. **500 Internal Server Error**: Persistent backend errors after 2 retries
5. **Unexpected Response Structure**: Response doesn't match documented interfaces
6. **Missing Required Fields**: API requires fields not in documentation

### Error Documentation Template

If you encounter a stop condition, create this report:

```markdown
## API Error Report - Transcription Monitoring

**Endpoint**: [exact URL]
**Method**: [GET/POST/etc]
**Expected**: [what should happen]
**Actual**: [what actually happened]
**Status Code**: [HTTP status]
**Response Body**:
```json
[exact response]
```
**Request Headers**: [include auth header structure]
**Timestamp**: [when error occurred]
**Action Required**: Human investigation needed
```

---

## Completion Report Template

When Sprint 4 is complete, fill out this report:

```markdown
## Sprint 4 Completion Report: Transcription Monitoring

**Status**: ✅ Complete / ⚠️ Needs Review / ❌ Blocked

### Completed Work

**Pages Created**:
- [x] `/admin/communications/twilio/transcriptions` - Dashboard
- [x] `/admin/communications/twilio/transcriptions/[id]` - Detail page

**Components Built**:
- [x] TranscriptionProviderCard - Provider statistics display
- [x] FailedTranscriptionsTable - Failed transcriptions list
- [x] TranscriptionDetailCard - Detail view
- [x] TranscriptionTextDisplay - Text viewer
- [x] RetryTranscriptionButton - Individual retry
- [x] BulkRetryButton - Bulk retry action
- [x] TranscriptionFilters - Filter controls
- [x] CallInfoCard - Associated call info
- [x] ConfidenceScoreGauge - Score visualization
- [x] TranscriptionStatusBadge - Status indicator

**API Integration**:
- [x] GET `/transcriptions/failed` - Integrated & Tested
- [x] GET `/transcriptions/:id` - Integrated & Tested
- [x] POST `/transcriptions/:id/retry` - Integrated & Tested
- [x] GET `/transcription-providers` - Integrated & Tested

**Modern UI Elements**:
- [x] Color-coded provider health cards
- [x] Checkbox selection for bulk actions
- [x] Loading states on all async operations
- [x] Success/error modals for feedback
- [x] Responsive table/card layout
- [x] Link navigation to related records

**Error Handling**:
- [x] All API calls wrapped in try-catch
- [x] Error modals for user feedback
- [x] Loading states prevent double-submission
- [x] Validation before API calls

**Mobile Responsive**:
- [x] Tested on 375px viewport
- [x] Table adapts appropriately
- [x] Touch-friendly buttons and links

**Dark Mode**:
- [x] All components support dark mode
- [x] Tested in both themes

### API Issues Encountered
[List any API documentation issues, unexpected responses, or required human intervention]

### Tests Written
- Component tests: [count]
- Integration tests: [count]
- All tests passing: ✅ / ❌

### Production Ready
**Ready for merge**: ✅ / ❌

### Screenshots/Demo
[Include screenshots or demo GIF showing key functionality]

### Notes
[Any additional notes, known limitations, or follow-up items]
```

---

## Additional Notes

### Performance Considerations

**Failed Transcriptions List**:
- May grow large over time
- Implement pagination (20 items per page)
- Consider adding date range filter to limit results

**Bulk Retry**:
- Process retries in sequence (not parallel)
- Show progress indicator for bulk operations
- Limit bulk selection to 50 items max

**Auto-Refresh**:
- Optional: Poll failed transcriptions every 60 seconds
- Only when dashboard is visible (use visibility API)
- Disable auto-refresh during active interactions

### Security Considerations

**Transcription Text**:
- May contain sensitive customer information
- Ensure proper RBAC checks on backend
- Consider redacting PII in admin view (optional)

**Recording URLs**:
- URLs may be signed/temporary
- Handle expired URLs gracefully
- Display appropriate error if recording unavailable

---

## Dependencies

**Required Components** (should already exist):
- Button component
- Modal component
- Input component
- Select component
- Checkbox component
- LoadingSpinner component

**Required Utilities**:
- formatDateTime (date-fns)
- formatCurrency (Intl.NumberFormat)
- apiClient (axios with auth)

**Required Libraries**:
- date-fns
- axios
- lucide-react (for icons)

---

**Sprint 4 implements comprehensive transcription monitoring and management capabilities, enabling admins to identify failures, understand patterns, and take corrective action efficiently.**
