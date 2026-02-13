# Sprint 1: Foundation & Infrastructure

**Developer**: Developer 1
**Dependencies**: None
**Duration**: 1 sprint

---

## 🎯 Sprint Goal

Set up the foundational infrastructure for the Twilio tenant frontend module, including:
- Directory structure
- API client functions (22 tenant-facing endpoints)
- TypeScript type definitions
- Test API connectivity with live backend

---

## 📋 Prerequisites

### Test Credentials (CRITICAL - Use for ALL API testing)
- **API Base URL**: `http://localhost:8000/api/v1`
- **Test Email**: `contact@honeydo4you.com`
- **Test Password**: `978@F32c`

### Required Reading
1. **Backend API Documentation**: `/var/www/lead360.app/api/documentation/communication_twillio_REST_API.md`
   - Read sections: SMS Configuration, WhatsApp Configuration, Call Management, IVR Configuration, Office Bypass
   - Total endpoints to integrate: 22 (excludes webhooks)

2. **Existing Frontend Patterns**: Explore these files to understand patterns:
   - `/var/www/lead360.app/app/src/lib/api/communication.ts` - API client pattern
   - `/var/www/lead360.app/app/src/lib/types/communication.ts` - Type definition pattern
   - `/var/www/lead360.app/app/src/app/(dashboard)/communications/settings/page.tsx` - Page component pattern

3. **Component Library**: Review available components in:
   - `/var/www/lead360.app/app/src/components/ui/` - Base UI components
   - `/var/www/lead360.app/app/src/components/communication/` - Communication-specific components

---

## 🏗️ Tasks

### Task 1: Create Directory Structure

Create the following directories and placeholder files:

```bash
# Create main directory structure
mkdir -p /var/www/lead360.app/app/src/app/\(dashboard\)/communications/twilio
mkdir -p /var/www/lead360.app/app/src/components/twilio
mkdir -p /var/www/lead360.app/app/src/components/twilio/modals

# Create placeholder page files (will be implemented in later sprints)
touch /var/www/lead360.app/app/src/app/\(dashboard\)/communications/twilio/page.tsx
touch /var/www/lead360.app/app/src/app/\(dashboard\)/communications/twilio/sms/page.tsx
touch /var/www/lead360.app/app/src/app/\(dashboard\)/communications/twilio/whatsapp/page.tsx
touch /var/www/lead360.app/app/src/app/\(dashboard\)/communications/twilio/calls/page.tsx
touch /var/www/lead360.app/app/src/app/\(dashboard\)/communications/twilio/ivr/page.tsx
touch /var/www/lead360.app/app/src/app/\(dashboard\)/communications/twilio/whitelist/page.tsx
```

**Directory Structure:**
```
app/src/
├── app/(dashboard)/communications/twilio/
│   ├── page.tsx                     # Dashboard overview (Sprint 9)
│   ├── sms/page.tsx                 # SMS config (Sprint 2)
│   ├── whatsapp/page.tsx            # WhatsApp config (Sprint 3)
│   ├── calls/page.tsx               # Call history (Sprint 4)
│   ├── ivr/page.tsx                 # IVR config (Sprint 6-7)
│   └── whitelist/page.tsx           # Office bypass (Sprint 8)
├── components/twilio/
│   ├── modals/                      # Modal components
│   └── [component files TBD]        # Reusable components
└── lib/
    ├── api/twilio-tenant.ts         # API client (THIS SPRINT)
    └── types/twilio-tenant.ts       # Type definitions (THIS SPRINT)
```

---

### Task 2: Create TypeScript Type Definitions

**File**: `/var/www/lead360.app/app/src/lib/types/twilio-tenant.ts`

Create comprehensive TypeScript interfaces for all API request/response types.

**⚠️ CRITICAL**: Before defining types, test each API endpoint using the test credentials to verify the EXACT response structure.

#### Testing Protocol:
1. Login to get JWT token:
```bash
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@honeydo4you.com",
    "password": "978@F32c"
  }'

# Copy the returned token
```

2. Test each GET endpoint to verify response structure:
```bash
# Example: Get SMS config
curl -X GET "http://localhost:8000/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# If response differs from documentation, STOP and report to human
```

#### Type Definitions to Create:

```typescript
// ============================================
// SMS Configuration Types
// ============================================

export interface SMSConfig {
  id: string;
  tenant_id: string;
  provider_id: string;
  from_phone: string;
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSMSConfigRequest {
  provider_id: string;
  account_sid: string;
  auth_token: string;
  from_phone: string;
  webhook_secret?: string;
}

export interface UpdateSMSConfigRequest {
  account_sid?: string;
  auth_token?: string;
  from_phone?: string;
  webhook_secret?: string;
  is_active?: boolean;
}

export interface TestSMSConfigResponse {
  success: boolean;
  message: string;
  twilio_message_sid: string;
  from: string;
  to: string;
}

// ============================================
// WhatsApp Configuration Types
// ============================================

export interface WhatsAppConfig {
  id: string;
  tenant_id: string;
  provider_id: string;
  from_phone: string; // Will have "whatsapp:" prefix
  is_active: boolean;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateWhatsAppConfigRequest {
  provider_id: string;
  account_sid: string;
  auth_token: string;
  from_phone: string;
  webhook_secret?: string;
}

export interface UpdateWhatsAppConfigRequest {
  account_sid?: string;
  auth_token?: string;
  from_phone?: string;
  webhook_secret?: string;
  is_active?: boolean;
}

export interface TestWhatsAppConfigResponse {
  success: boolean;
  message: string;
  twilio_message_sid: string;
  from: string;
  to: string;
}

// ============================================
// Call Management Types
// ============================================

export type CallDirection = 'inbound' | 'outbound';
export type CallStatus =
  | 'initiated'
  | 'ringing'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'no_answer'
  | 'busy'
  | 'canceled';
export type CallType =
  | 'customer_call'
  | 'office_bypass_call'
  | 'ivr_routed_call';
export type RecordingStatus =
  | 'pending'
  | 'available'
  | 'processing_transcription'
  | 'transcribed'
  | 'failed';

export interface CallRecord {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  twilio_call_sid: string;
  direction: CallDirection;
  from_number: string;
  to_number: string;
  status: CallStatus;
  call_type: CallType;
  call_reason: string | null;
  recording_url: string | null;
  recording_duration_seconds: number | null;
  recording_status: RecordingStatus;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  lead?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
  } | null;
  initiated_by_user?: {
    id: string;
    first_name: string;
    last_name: string;
  } | null;
}

export interface InitiateCallRequest {
  lead_id: string;
  user_phone_number: string;
  call_reason?: string;
}

export interface InitiateCallResponse {
  success: boolean;
  call_record_id: string;
  twilio_call_sid: string;
  message: string;
}

export interface CallHistoryResponse {
  data: CallRecord[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface CallRecordingResponse {
  url: string;
  duration_seconds: number;
  transcription_available: boolean;
}

// ============================================
// IVR Configuration Types
// ============================================

export type IVRActionType =
  | 'route_to_number'
  | 'route_to_default'
  | 'trigger_webhook'
  | 'voicemail';

export interface IVRMenuOption {
  digit: string; // "0" to "9"
  action: IVRActionType;
  label: string;
  config: {
    phone_number?: string; // For route_to_number
    webhook_url?: string; // For trigger_webhook
    max_duration_seconds?: number; // For voicemail
  };
}

export interface IVRDefaultAction {
  action: IVRActionType;
  config: {
    phone_number?: string;
    webhook_url?: string;
    max_duration_seconds?: number;
  };
}

export interface IVRConfig {
  id: string;
  tenant_id: string;
  twilio_config_id: string | null;
  ivr_enabled: boolean;
  greeting_message: string;
  menu_options: IVRMenuOption[];
  default_action: IVRDefaultAction;
  timeout_seconds: number;
  max_retries: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface CreateOrUpdateIVRConfigRequest {
  ivr_enabled: boolean;
  greeting_message: string;
  menu_options: IVRMenuOption[];
  default_action: IVRDefaultAction;
  timeout_seconds: number;
  max_retries: number;
}

// ============================================
// Office Bypass Whitelist Types
// ============================================

export interface OfficeWhitelistEntry {
  id: string;
  tenant_id: string;
  phone_number: string;
  label: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface AddPhoneToWhitelistRequest {
  phone_number: string;
  label: string;
}

export interface UpdateWhitelistLabelRequest {
  label: string;
}

// ============================================
// Common Error Response Type
// ============================================

export interface APIError {
  statusCode: number;
  message: string;
  error?: string;
  errors?: Array<{
    field: string;
    message: string;
  }>;
}
```

**Documentation**: Add JSDoc comments to all interfaces explaining each field.

---

### Task 3: Create API Client Functions

**File**: `/var/www/lead360.app/app/src/lib/api/twilio-tenant.ts`

Create API client functions for all 22 tenant-facing endpoints.

**⚠️ CRITICAL BEFORE CODING**: Test EVERY endpoint using curl with the test credentials to verify:
1. Request body structure matches documentation
2. Response structure matches documentation
3. Status codes match documentation
4. Error responses match documentation

**If ANY discrepancies are found, STOP immediately and report to human.**

#### Testing Checklist (Complete Before Implementation):

```bash
# Get JWT token first
TOKEN="YOUR_TOKEN_HERE"

# SMS Configuration Endpoints (5)
curl -X GET "http://localhost:8000/api/v1/communication/twilio/sms-config" -H "Authorization: Bearer $TOKEN"
curl -X POST "http://localhost:8000/api/v1/communication/twilio/sms-config" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'
curl -X PATCH "http://localhost:8000/api/v1/communication/twilio/sms-config/:id" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'
curl -X DELETE "http://localhost:8000/api/v1/communication/twilio/sms-config/:id" -H "Authorization: Bearer $TOKEN"
curl -X POST "http://localhost:8000/api/v1/communication/twilio/sms-config/:id/test" -H "Authorization: Bearer $TOKEN"

# WhatsApp Configuration Endpoints (5)
curl -X GET "http://localhost:8000/api/v1/communication/twilio/whatsapp-config" -H "Authorization: Bearer $TOKEN"
curl -X POST "http://localhost:8000/api/v1/communication/twilio/whatsapp-config" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'
curl -X PATCH "http://localhost:8000/api/v1/communication/twilio/whatsapp-config/:id" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'
curl -X DELETE "http://localhost:8000/api/v1/communication/twilio/whatsapp-config/:id" -H "Authorization: Bearer $TOKEN"
curl -X POST "http://localhost:8000/api/v1/communication/twilio/whatsapp-config/:id/test" -H "Authorization: Bearer $TOKEN"

# Call Management Endpoints (4)
curl -X POST "http://localhost:8000/api/v1/communication/twilio/calls/initiate" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'
curl -X GET "http://localhost:8000/api/v1/communication/twilio/call-history?page=1&limit=20" -H "Authorization: Bearer $TOKEN"
curl -X GET "http://localhost:8000/api/v1/communication/twilio/calls/:id" -H "Authorization: Bearer $TOKEN"
curl -X GET "http://localhost:8000/api/v1/communication/twilio/calls/:id/recording" -H "Authorization: Bearer $TOKEN"

# IVR Configuration Endpoints (3)
curl -X GET "http://localhost:8000/api/v1/communication/twilio/ivr" -H "Authorization: Bearer $TOKEN"
curl -X POST "http://localhost:8000/api/v1/communication/twilio/ivr" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'
curl -X DELETE "http://localhost:8000/api/v1/communication/twilio/ivr" -H "Authorization: Bearer $TOKEN"

# Office Bypass Endpoints (4)
curl -X GET "http://localhost:8000/api/v1/communication/twilio/office-whitelist" -H "Authorization: Bearer $TOKEN"
curl -X POST "http://localhost:8000/api/v1/communication/twilio/office-whitelist" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'
curl -X PATCH "http://localhost:8000/api/v1/communication/twilio/office-whitelist/:id" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{...}'
curl -X DELETE "http://localhost:8000/api/v1/communication/twilio/office-whitelist/:id" -H "Authorization: Bearer $TOKEN"
```

#### API Client Implementation:

```typescript
import axios from './axios';
import type {
  // SMS
  SMSConfig,
  CreateSMSConfigRequest,
  UpdateSMSConfigRequest,
  TestSMSConfigResponse,
  // WhatsApp
  WhatsAppConfig,
  CreateWhatsAppConfigRequest,
  UpdateWhatsAppConfigRequest,
  TestWhatsAppConfigResponse,
  // Calls
  CallRecord,
  InitiateCallRequest,
  InitiateCallResponse,
  CallHistoryResponse,
  CallRecordingResponse,
  // IVR
  IVRConfig,
  CreateOrUpdateIVRConfigRequest,
  // Whitelist
  OfficeWhitelistEntry,
  AddPhoneToWhitelistRequest,
  UpdateWhitelistLabelRequest,
} from '@/lib/types/twilio-tenant';

// ============================================
// SMS Configuration API
// ============================================

/**
 * Get active SMS configuration for tenant
 */
export async function getActiveSMSConfig(): Promise<SMSConfig> {
  const response = await axios.get<SMSConfig>('/communication/twilio/sms-config');
  return response.data;
}

/**
 * Create new SMS configuration
 */
export async function createSMSConfig(data: CreateSMSConfigRequest): Promise<SMSConfig> {
  const response = await axios.post<SMSConfig>('/communication/twilio/sms-config', data);
  return response.data;
}

/**
 * Update existing SMS configuration
 */
export async function updateSMSConfig(
  id: string,
  data: UpdateSMSConfigRequest
): Promise<SMSConfig> {
  const response = await axios.patch<SMSConfig>(
    `/communication/twilio/sms-config/${id}`,
    data
  );
  return response.data;
}

/**
 * Deactivate SMS configuration (soft delete)
 */
export async function deactivateSMSConfig(id: string): Promise<SMSConfig> {
  const response = await axios.delete<SMSConfig>(`/communication/twilio/sms-config/${id}`);
  return response.data;
}

/**
 * Send test SMS to verify configuration
 */
export async function testSMSConfig(id: string): Promise<TestSMSConfigResponse> {
  const response = await axios.post<TestSMSConfigResponse>(
    `/communication/twilio/sms-config/${id}/test`
  );
  return response.data;
}

// ============================================
// WhatsApp Configuration API
// ============================================

/**
 * Get active WhatsApp configuration for tenant
 */
export async function getActiveWhatsAppConfig(): Promise<WhatsAppConfig> {
  const response = await axios.get<WhatsAppConfig>('/communication/twilio/whatsapp-config');
  return response.data;
}

/**
 * Create new WhatsApp configuration
 */
export async function createWhatsAppConfig(
  data: CreateWhatsAppConfigRequest
): Promise<WhatsAppConfig> {
  const response = await axios.post<WhatsAppConfig>(
    '/communication/twilio/whatsapp-config',
    data
  );
  return response.data;
}

/**
 * Update existing WhatsApp configuration
 */
export async function updateWhatsAppConfig(
  id: string,
  data: UpdateWhatsAppConfigRequest
): Promise<WhatsAppConfig> {
  const response = await axios.patch<WhatsAppConfig>(
    `/communication/twilio/whatsapp-config/${id}`,
    data
  );
  return response.data;
}

/**
 * Deactivate WhatsApp configuration (soft delete)
 */
export async function deactivateWhatsAppConfig(id: string): Promise<WhatsAppConfig> {
  const response = await axios.delete<WhatsAppConfig>(
    `/communication/twilio/whatsapp-config/${id}`
  );
  return response.data;
}

/**
 * Send test WhatsApp message to verify configuration
 */
export async function testWhatsAppConfig(id: string): Promise<TestWhatsAppConfigResponse> {
  const response = await axios.post<TestWhatsAppConfigResponse>(
    `/communication/twilio/whatsapp-config/${id}/test`
  );
  return response.data;
}

// ============================================
// Call Management API
// ============================================

/**
 * Initiate outbound call to a Lead
 */
export async function initiateCall(data: InitiateCallRequest): Promise<InitiateCallResponse> {
  const response = await axios.post<InitiateCallResponse>(
    '/communication/twilio/calls/initiate',
    data
  );
  return response.data;
}

/**
 * Get paginated call history for tenant
 */
export async function getCallHistory(params: {
  page?: number;
  limit?: number;
}): Promise<CallHistoryResponse> {
  const response = await axios.get<CallHistoryResponse>(
    '/communication/twilio/call-history',
    { params }
  );
  return response.data;
}

/**
 * Get call details by ID
 */
export async function getCallById(id: string): Promise<CallRecord> {
  const response = await axios.get<CallRecord>(`/communication/twilio/calls/${id}`);
  return response.data;
}

/**
 * Get recording URL for a call
 */
export async function getCallRecording(id: string): Promise<CallRecordingResponse> {
  const response = await axios.get<CallRecordingResponse>(
    `/communication/twilio/calls/${id}/recording`
  );
  return response.data;
}

// ============================================
// IVR Configuration API
// ============================================

/**
 * Get IVR configuration for tenant
 */
export async function getIVRConfig(): Promise<IVRConfig> {
  const response = await axios.get<IVRConfig>('/communication/twilio/ivr');
  return response.data;
}

/**
 * Create or update IVR configuration (upsert)
 */
export async function createOrUpdateIVRConfig(
  data: CreateOrUpdateIVRConfigRequest
): Promise<IVRConfig> {
  const response = await axios.post<IVRConfig>('/communication/twilio/ivr', data);
  return response.data;
}

/**
 * Disable IVR configuration (soft delete)
 */
export async function disableIVRConfig(): Promise<IVRConfig> {
  const response = await axios.delete<IVRConfig>('/communication/twilio/ivr');
  return response.data;
}

// ============================================
// Office Bypass Whitelist API
// ============================================

/**
 * Get all whitelisted phone numbers for tenant
 */
export async function getOfficeWhitelist(): Promise<OfficeWhitelistEntry[]> {
  const response = await axios.get<OfficeWhitelistEntry[]>(
    '/communication/twilio/office-whitelist'
  );
  return response.data;
}

/**
 * Add phone number to whitelist
 */
export async function addPhoneToWhitelist(
  data: AddPhoneToWhitelistRequest
): Promise<OfficeWhitelistEntry> {
  const response = await axios.post<OfficeWhitelistEntry>(
    '/communication/twilio/office-whitelist',
    data
  );
  return response.data;
}

/**
 * Update whitelist entry label
 */
export async function updateWhitelistLabel(
  id: string,
  data: UpdateWhitelistLabelRequest
): Promise<OfficeWhitelistEntry> {
  const response = await axios.patch<OfficeWhitelistEntry>(
    `/communication/twilio/office-whitelist/${id}`,
    data
  );
  return response.data;
}

/**
 * Remove phone number from whitelist (soft delete)
 */
export async function removeFromWhitelist(id: string): Promise<OfficeWhitelistEntry> {
  const response = await axios.delete<OfficeWhitelistEntry>(
    `/communication/twilio/office-whitelist/${id}`
  );
  return response.data;
}
```

**Testing**: After creating these functions, test each one programmatically:
```typescript
// Create a test file: app/src/lib/api/twilio-tenant.test.ts
// Run each function and verify it returns the expected data structure
```

---

### Task 4: Create Placeholder Pages

Create basic placeholder pages for all Twilio routes. These will be implemented in later sprints.

**Pattern to Follow**: Look at `/var/www/lead360.app/app/src/app/(dashboard)/communications/settings/page.tsx`

#### Placeholder Page Template:

```typescript
// app/src/app/(dashboard)/communications/twilio/page.tsx
'use client';

import React from 'react';

export default function TwilioDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Twilio Communication Settings
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Configure SMS, WhatsApp, Calls, IVR, and Office Bypass settings
        </p>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          🚧 This page is under construction (Sprint 9)
        </p>
      </div>
    </div>
  );
}
```

Create similar placeholder pages for:
- `/sms/page.tsx` - "SMS Configuration (Sprint 2)"
- `/whatsapp/page.tsx` - "WhatsApp Configuration (Sprint 3)"
- `/calls/page.tsx` - "Call History (Sprint 4)"
- `/ivr/page.tsx` - "IVR Configuration (Sprint 6-7)"
- `/whitelist/page.tsx` - "Office Bypass Whitelist (Sprint 8)"

---

### Task 5: Test API Connectivity

Create a test page to verify all API endpoints are accessible.

**File**: `app/src/app/(dashboard)/communications/twilio/api-test/page.tsx`

```typescript
'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import * as twilioAPI from '@/lib/api/twilio-tenant';
import { toast } from 'react-hot-toast';

export default function TwilioAPITestPage() {
  const [testing, setTesting] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const testEndpoint = async (
    name: string,
    fn: () => Promise<any>,
    expectError = false
  ) => {
    try {
      const data = await fn();
      const result = {
        name,
        status: 'success',
        data,
      };
      setResults((prev) => [...prev, result]);
      console.log(`✅ ${name}:`, data);
      return result;
    } catch (error: any) {
      const result = {
        name,
        status: expectError ? 'expected-error' : 'error',
        error: error.response?.data || error.message,
      };
      setResults((prev) => [...prev, result]);
      console.log(expectError ? `⚠️ ${name} (expected):` : `❌ ${name}:`, error);
      return result;
    }
  };

  const runAllTests = async () => {
    setTesting(true);
    setResults([]);

    toast.loading('Testing API endpoints...', { id: 'api-test' });

    // SMS Configuration (expect 404 if no config)
    await testEndpoint('Get SMS Config', () => twilioAPI.getActiveSMSConfig(), true);

    // WhatsApp Configuration (expect 404 if no config)
    await testEndpoint('Get WhatsApp Config', () => twilioAPI.getActiveWhatsAppConfig(), true);

    // Call History
    await testEndpoint('Get Call History', () => twilioAPI.getCallHistory({ page: 1, limit: 5 }));

    // IVR Configuration (expect 404 if no config)
    await testEndpoint('Get IVR Config', () => twilioAPI.getIVRConfig(), true);

    // Office Whitelist
    await testEndpoint('Get Office Whitelist', () => twilioAPI.getOfficeWhitelist());

    setTesting(false);
    toast.success('API testing complete!', { id: 'api-test' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Twilio API Connection Test
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Sprint 1: Verify all API endpoints are accessible
        </p>
      </div>

      <Button onClick={runAllTests} loading={testing}>
        Run All Tests
      </Button>

      <div className="space-y-2">
        {results.map((result, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${
              result.status === 'success'
                ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
                : result.status === 'expected-error'
                ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
                : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">
                {result.status === 'success' ? '✅' : result.status === 'expected-error' ? '⚠️' : '❌'}{' '}
                {result.name}
              </span>
              <span className="text-sm">
                {result.status === 'success' ? 'Success' : result.status === 'expected-error' ? 'Expected 404' : 'Error'}
              </span>
            </div>
            {result.data && (
              <pre className="mt-2 text-xs overflow-auto bg-white dark:bg-gray-800 p-2 rounded">
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
            {result.error && (
              <pre className="mt-2 text-xs overflow-auto bg-white dark:bg-gray-800 p-2 rounded">
                {JSON.stringify(result.error, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## ✅ Sprint 1 Completion Checklist

Before marking Sprint 1 as complete, verify:

### API Testing
- [ ] Logged in successfully with test credentials
- [ ] Tested all 22 GET/POST/PATCH/DELETE endpoints with curl
- [ ] Documented any discrepancies between API docs and actual responses
- [ ] If discrepancies found, reported to human and paused development

### Code Quality
- [ ] All TypeScript types defined with JSDoc comments
- [ ] All 22 API client functions created and exported
- [ ] API client functions include error handling
- [ ] Placeholder pages created for all routes
- [ ] API test page works and shows results

### Directory Structure
- [ ] All directories created per specification
- [ ] Files organized logically
- [ ] No console errors when accessing placeholder pages

### Documentation
- [ ] API testing results documented
- [ ] Any API discrepancies documented
- [ ] Next steps for Sprint 2 developer documented

---

## 📤 Deliverables

1. **API Client**: `/app/src/lib/api/twilio-tenant.ts` (22 functions)
2. **Type Definitions**: `/app/src/lib/types/twilio-tenant.ts` (complete interfaces)
3. **Placeholder Pages**: All 6 pages with construction notices
4. **API Test Page**: Working connectivity test page
5. **Testing Report**: Document showing API test results

---

## 🚦 Next Sprint

**Sprint 2: SMS Configuration Management**
- Use the API client functions created in this sprint
- Use the type definitions created in this sprint
- Implement full CRUD for SMS provider configuration
- Build first production-ready Twilio page

---

## ⚠️ Critical Reminders

1. **ALWAYS test API endpoints with curl BEFORE writing code**
2. **STOP and report if API responses don't match documentation**
3. **Use test credentials**: `contact@honeydo4you.com` / `978@F32c`
4. **API Base URL**: `http://localhost:8000/api/v1`
5. **Follow existing patterns** from `/app/src/lib/api/communication.ts`
6. **No shortcuts** - test every single endpoint

---

**Sprint 1 Status**: Ready to Start
**Estimated Duration**: 1 week
**Blockers**: None (no dependencies)
