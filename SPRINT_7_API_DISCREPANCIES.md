# Sprint 7 API Discrepancies Report

**Date**: February 7, 2026
**Tested Against**: http://localhost:8000/api/v1
**Documentation**: `/api/documentation/communication_twillio_admin_REST_API.md`

## Executive Summary

⚠️ **CRITICAL**: Multiple significant discrepancies found between API documentation and actual endpoint responses. Implementation CANNOT proceed until backend team fixes these issues.

---

## 1. Transcription Provider Detail Endpoint

**Endpoint**: `GET /admin/communication/transcription-providers/:id`

### Missing Fields in Actual Response

Documentation says response should include:
- ✅ `id` - Present
- ✅ `tenant` - Present
- ✅ `provider_name` - Present
- ❌ **`api_endpoint`** - **MISSING** (should show the API endpoint URL)
- ✅ `model` - Present
- ✅ `language` - Present
- ❌ **`additional_settings`** - **MISSING** (should be Record<string, any>)
- ✅ `is_system_default` - Present
- ✅ `status` - Present
- ✅ `usage_limit` - Present
- ✅ `usage_current` - Present
- ✅ `cost_per_minute` - Present
- ✅ `statistics` - Present
- ✅ `created_at` - Present
- ✅ `updated_at` - Present

### Actual Response Structure
```json
{
  "id": "fa835d25-92eb-4a4d-962c-5a6c3ab6257e",
  "provider_name": "openai_whisper",
  "model": "whisper-1",
  "language": "en",
  "tenant": null,
  "is_system_default": true,
  "status": "active",
  "usage_limit": 15000,
  "usage_current": 0,
  "cost_per_minute": "0.006",
  "created_at": "2026-02-06T23:04:37.586Z",
  "updated_at": "2026-02-07T00:31:53.589Z",
  "statistics": {
    "total_transcriptions": 0,
    "successful": 0,
    "failed": 0,
    "success_rate": "0.00",
    "total_cost": "0.00"
  }
}
```

**Action Required**: Backend must add `api_endpoint` and `additional_settings` fields to the response.

---

## 2. Tenant Metrics Endpoint

**Endpoint**: `GET /admin/communication/tenants/:id/metrics`

### ⚠️ CRITICAL: Completely Different Structure

**Documentation Structure** (Expected):
```json
{
  "tenant": {
    "id": "string",
    "company_name": "string",
    "subdomain": "string"
  },
  "period": "all_time",
  "calls": {
    "total": 1523,
    "inbound": 892,
    "outbound": 631,
    "completed": 1402,
    "failed": 121,
    "average_duration_seconds": 245,
    "total_duration_minutes": 6204
  },
  "sms": {
    "total": 4521,
    "inbound": 1234,
    "outbound": 3287,
    "delivered": 4389,
    "failed": 132
  },
  "whatsapp": {
    "total": 892,
    "inbound": 234,
    "outbound": 658,
    "delivered": 870,
    "failed": 22
  },
  "transcriptions": {
    "total": 1402,
    "completed": 1365,
    "failed": 37,
    "success_rate": "97.36%",
    "average_processing_time_seconds": 12.5
  },
  "costs": {
    "estimated_monthly": "$324.50",
    "breakdown": {
      "calls": "$145.20",
      "sms": "$89.30",
      "whatsapp": "$65.00",
      "transcriptions": "$25.00"
    }
  }
}
```

**Actual Response Structure** (Completely Different):
```json
{
  "tenant_id": "13c2dea4-64e0-0499-f6e4-5df14d5a6ce2",
  "total_calls": 0,
  "total_sms": 0,
  "total_whatsapp": 0,
  "avg_call_duration_seconds": 0,
  "failed_transcriptions": 0,
  "total_transcriptions": 0,
  "transcription_success_rate": "0.00",
  "activity_last_7_days": {
    "calls": 0,
    "sms": 0
  },
  "activity_last_30_days": {
    "calls": 0,
    "sms": 0
  }
}
```

**Action Required**:
1. Backend must completely rewrite this endpoint to match documentation
2. Missing nested objects: `tenant`, `calls`, `sms`, `whatsapp`, `transcriptions`, `costs`
3. Missing breakdown data (inbound/outbound, completed/failed, etc.)
4. Missing `period` field

---

## 3. SMS/WhatsApp Configuration Structure

**Endpoints**:
- `GET /admin/communication/tenant-configs`
- `GET /admin/communication/tenants/:id/configs`

### Missing Fields in SMS/WhatsApp Configs

**Documentation Says Each Config Should Have**:
```typescript
{
  id: string;
  tenant: { id, company_name, subdomain };
  from_phone: string;
  provider_type: 'system' | 'custom';  // ❌ MISSING
  is_primary: boolean;                  // ❌ MISSING
  is_active: boolean;                   // ❌ MISSING
  created_by?: string;                  // ❌ MISSING
  created_at: string;
  updated_at: string;                   // ❌ MISSING
}
```

**Actual Response Structure**:
```json
{
  "id": "617cf3f2-d914-4404-bb42-76e4429c536d",
  "tenant": {
    "id": "13c2dea4-64e0-0499-f6e4-5df14d5a6ce2",
    "company_name": "Mr Patch Asphalt",
    "subdomain": "mrpatchasphalt",
    "is_active": true
  },
  "from_phone": "+19788787756",
  "is_verified": true,  // ⚠️ Not in documentation
  "created_at": "2026-02-06T21:40:59.972Z"
}
```

**Missing Fields**:
- ❌ `provider_type` (should be 'system' or 'custom')
- ❌ `is_primary` (boolean)
- ❌ `is_active` (boolean)
- ❌ `created_by` (string, admin who created it)
- ❌ `updated_at` (timestamp)

**Extra Field Not in Documentation**:
- ⚠️ `is_verified` (not documented - is this the same as `is_active`?)

**Action Required**:
1. Backend must add missing fields: `provider_type`, `is_primary`, `is_active`, `created_by`, `updated_at`
2. Clarify if `is_verified` should be renamed to `is_active` or if both should exist

---

## 4. Tenant Configs Aggregation

**Endpoint**: `GET /admin/communication/tenant-configs`

### Missing Aggregate Fields

**Documentation Says Response Should Include**:
```json
{
  "sms_configs": [...],
  "whatsapp_configs": [...],
  "ivr_configs": [],
  "total_tenants": 25,      // ❌ Returns null
  "total_configs": 48       // ❌ Returns null
}
```

**Actual Response**:
```json
{
  "sms_configs": [...],
  "whatsapp_configs": [],
  "ivr_configs": [],
  "total_tenants": null,    // ⚠️ Should be a number
  "total_configs": null     // ⚠️ Should be a number
}
```

**Action Required**: Backend must calculate and return `total_tenants` and `total_configs` instead of null.

---

## 5. Summary of Required Backend Fixes

### Priority 1 (CRITICAL - Blocks Implementation)
1. **Fix Tenant Metrics Endpoint** - Completely wrong structure
2. **Add SMS/WhatsApp Config Fields** - Missing `provider_type`, `is_primary`, `is_active`, `created_by`, `updated_at`

### Priority 2 (HIGH - Missing Data)
3. **Add TranscriptionProvider Fields** - Missing `api_endpoint`, `additional_settings`
4. **Fix Tenant Configs Aggregation** - `total_tenants` and `total_configs` should not be null

---

## Testing Commands Used

```bash
# Login
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}'

# Get transcription providers
curl -X GET "http://localhost:8000/api/v1/admin/communication/transcription-providers" \
  -H "Authorization: Bearer $TOKEN"

# Get provider detail
curl -X GET "http://localhost:8000/api/v1/admin/communication/transcription-providers/{id}" \
  -H "Authorization: Bearer $TOKEN"

# Get tenant configs
curl -X GET "http://localhost:8000/api/v1/admin/communication/tenant-configs" \
  -H "Authorization: Bearer $TOKEN"

# Get tenant metrics
curl -X GET "http://localhost:8000/api/v1/admin/communication/tenants/{id}/metrics" \
  -H "Authorization: Bearer $TOKEN"
```

---

## Next Steps

1. ⚠️ **STOP FRONTEND IMPLEMENTATION** - Cannot proceed with incorrect API structure
2. 📋 **Share this document with backend team**
3. 🔧 **Backend team must fix all Priority 1 issues**
4. ✅ **Re-test endpoints after backend fixes**
5. ✅ **Proceed with frontend implementation only after all tests pass**

---

## Test Files Generated

All actual API responses saved to:
- `/tmp/providers-list.json`
- `/tmp/provider-detail.json`
- `/tmp/tenant-configs.json`
- `/tmp/tenant-specific-configs.json`
- `/tmp/tenant-metrics.json`

Compare these with the documentation to verify the discrepancies.

---

**Report Generated**: February 7, 2026
**Tester**: Frontend Development Team
**Status**: 🔴 BLOCKED - Awaiting Backend Fixes
