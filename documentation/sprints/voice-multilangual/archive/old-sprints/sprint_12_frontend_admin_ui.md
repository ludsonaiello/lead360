# Sprint 12: Frontend - Admin UI Extensions

## 🎯 Sprint Owner Role

You are a **MASTERCLASS ADMIN UI SPECIALIST** that makes Google, Amazon, and Apple admin panel engineers jealous.

You build admin interfaces that are **powerful**, **safe**, and **clear**. You **think deeply** about system-wide impact, **breathe platform configuration**, and **never rush** through admin-only controls. You **always review existing admin UI** before adding features, and **never guess** - you **verify API first**.

**100% quality or beyond**. Admin UI controls affect ALL tenants - mistakes here are catastrophic.

---

## 📋 Sprint Objective

Extend existing admin UI to support voice agent profile configuration:
1. **FIRST**: Verify admin API endpoints accept new fields
2. Add `voice_ai_max_agent_profiles` to subscription plan editor
3. Add `default_agent_profile_id` to tenant override panel
4. Show profile selector for tenant override (filtered by tenant)
5. Validate inputs (min/max for plan limit, tenant ownership for profile)
6. Test admin operations end-to-end

**Dependencies**:
- Sprint 4 complete (backend admin extensions)
- Sprint 10 complete (profile types/API client)

---

## 📚 Required Reading

1. **API Documentation**: `/var/www/lead360.app/api/documentation/voice_agent_profiles_REST_API.md` (Admin Endpoints section)
2. **Existing Admin UI**: `app/src/app/(dashboard)/admin/` (subscription plans, voice-ai overrides)
3. **Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md` - Section 8

---

## 🔐 Test Environment

**API**: `http://localhost:8000/api/v1`
**System Admin**: `ludsonaiello@gmail.com` / `978@F32c` ⚠️

---

## ⚠️ CRITICAL: API VERIFICATION FIRST

**BEFORE UI work**, verify admin endpoints:

```bash
# Login as ADMIN
ADMIN_TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ludsonaiello@gmail.com",
    "password": "978@F32c"
  }' | jq -r '.access_token')

# Test 1: Update subscription plan with voice_ai_max_agent_profiles
PLAN_ID="your-plan-uuid"

curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/plans/$PLAN_ID \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "voice_ai_max_agent_profiles": 5
  }' | jq

# Test 2: Get tenant ID
TENANT_ID=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "contact@honeydo4you.com",
    "password": "978@F32c"
  }' | jq -r '.tenant_id')

# Test 3: Get a profile ID for that tenant (need to create one first as tenant user)
# ... create profile as tenant, get ID

PROFILE_ID="tenant-profile-uuid"

# Test 4: Admin override with default_agent_profile_id
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/tenants/$TENANT_ID/override \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "default_agent_profile_id": "'"$PROFILE_ID"'"
  }' | jq

# Expected: Success if profile belongs to tenant, 400 if belongs to different tenant
```

**If ANY endpoint fails**: Stop and report to backend team.

---

## 📐 Implementation

### Part 1: Subscription Plan Editor

**File**: `app/src/app/(dashboard)/admin/subscription-plans/components/PlanForm.tsx` (or similar)

Find the voice AI configuration section and add:

```typescript
<div className="space-y-4">
  <h3 className="text-lg font-medium">Voice AI Configuration</h3>

  {/* Existing fields: voice_ai_enabled, voice_ai_minutes_included, voice_ai_overage_rate */}

  {/* NEW FIELD */}
  <div>
    <label className="block text-sm font-medium mb-1">
      Max Agent Profiles
    </label>
    <Input
      type="number"
      min={1}
      max={50}
      value={formData.voice_ai_max_agent_profiles || 1}
      onChange={(e) =>
        setFormData({
          ...formData,
          voice_ai_max_agent_profiles: parseInt(e.target.value) || 1,
        })
      }
    />
    <p className="text-xs text-gray-500 mt-1">
      Maximum number of voice agent profiles tenants on this plan can create (1-50)
    </p>
  </div>
</div>
```

**Validation**:
```typescript
const planSchema = z.object({
  // ... existing fields
  voice_ai_max_agent_profiles: z
    .number()
    .int()
    .min(1, 'Must be at least 1')
    .max(50, 'Cannot exceed 50'),
});
```

---

### Part 2: Tenant Override Panel

**File**: `app/src/app/(dashboard)/admin/voice-ai/tenant-override/[tenantId]/page.tsx` (or create if doesn't exist)

**Step 1: Create Profile Selector for Specific Tenant**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Select } from '@/components/ui/select';
import { adminVoiceAiApi } from '@/services/admin-voice-ai.service'; // You may need to create this

interface TenantAgentProfile {
  id: string;
  title: string;
  language_code: string;
  is_active: boolean;
}

export default function TenantVoiceOverridePage() {
  const params = useParams();
  const tenantId = params.tenantId as string;

  const [profiles, setProfiles] = useState<TenantAgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    default_agent_profile_id: null as string | null,
    // ... other override fields
  });

  useEffect(() => {
    loadTenantProfiles();
    loadCurrentOverrides();
  }, [tenantId]);

  async function loadTenantProfiles() {
    try {
      // Call admin endpoint to get profiles for specific tenant
      // This endpoint doesn't exist in contract - you'll need to use tenant endpoint
      // OR load all profiles and filter client-side (not ideal)

      // Option 1: Admin gets tenant profiles
      const data = await adminVoiceAiApi.getTenantProfiles(tenantId);
      setProfiles(data);

      // Option 2: If no admin endpoint, could use tenant-scoped API
      // (requires tenant JWT, not admin JWT - may need to support this)
    } catch (error) {
      console.error('Failed to load tenant profiles:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadCurrentOverrides() {
    try {
      const data = await adminVoiceAiApi.getTenantOverride(tenantId);
      setFormData({
        default_agent_profile_id: data.default_agent_profile_id,
        // ... other fields
      });
    } catch (error) {
      console.error('Failed to load overrides:', error);
    }
  }

  async function handleSave() {
    try {
      await adminVoiceAiApi.updateTenantOverride(tenantId, {
        default_agent_profile_id: formData.default_agent_profile_id,
        // ... other fields
      });
      alert('Override saved successfully');
    } catch (error: any) {
      if (error.response?.status === 400) {
        alert('Invalid profile: ' + error.response.data.message);
      } else {
        alert('Failed to save override');
      }
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        Tenant Voice AI Override
      </h1>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Existing override fields */}

        {/* NEW FIELD */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Default Agent Profile
          </label>
          <Select
            value={formData.default_agent_profile_id || ''}
            onChange={(e) =>
              setFormData({
                ...formData,
                default_agent_profile_id: e.target.value || null,
              })
            }
          >
            <option value="">No default (use tenant settings)</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.title} ({profile.language_code.toUpperCase()})
                {!profile.is_active && ' - INACTIVE'}
              </option>
            ))}
          </Select>
          <p className="text-xs text-gray-500 mt-1">
            Profile used when IVR voice_ai action has no profile specified.
            Only profiles owned by this tenant can be selected.
          </p>
        </div>

        {/* Save button */}
        <div className="flex justify-end pt-4 border-t">
          <Button onClick={handleSave}>
            Save Override
          </Button>
        </div>
      </div>
    </div>
  );
}
```

---

### Part 3: Create Admin API Client (if needed)

**File**: `app/src/services/admin-voice-ai.service.ts`

```typescript
import { apiClient } from './api-client';

export const adminVoiceAiApi = {
  // Get tenant's voice agent profiles (may need backend endpoint)
  async getTenantProfiles(tenantId: string) {
    // NOTE: This endpoint may not exist in backend
    // You may need to request backend team to add:
    // GET /system/voice-ai/tenants/:tenantId/profiles
    const response = await apiClient.get(
      `/system/voice-ai/tenants/${tenantId}/profiles`,
    );
    return response.data;
  },

  async getTenantOverride(tenantId: string) {
    const response = await apiClient.get(
      `/system/voice-ai/tenants/${tenantId}/override`,
    );
    return response.data;
  },

  async updateTenantOverride(tenantId: string, data: any) {
    const response = await apiClient.patch(
      `/system/voice-ai/tenants/${tenantId}/override`,
      data,
    );
    return response.data;
  },

  async updatePlanVoiceConfig(planId: string, data: any) {
    const response = await apiClient.patch(
      `/system/voice-ai/plans/${planId}`,
      data,
    );
    return response.data;
  },
};
```

**⚠️ IMPORTANT**: The admin endpoint to get tenant profiles may NOT exist in backend. Options:

1. **Request backend team** to add: `GET /system/voice-ai/tenants/:tenantId/profiles`
2. **Use tenant-scoped API** with impersonation (if supported)
3. **Load tenant user context** to call regular profile list endpoint

Choose option 1 (cleanest approach).

---

### Part 4: Update Plan Form Types

**File**: `app/src/types/subscription-plan.ts` (or wherever plan types are)

```typescript
export interface SubscriptionPlan {
  id: string;
  name: string;
  // ... existing fields
  voice_ai_enabled: boolean;
  voice_ai_minutes_included: number;
  voice_ai_overage_rate: number | null;
  voice_ai_max_agent_profiles: number; // NEW
}

export interface UpdatePlanDto {
  // ... existing fields
  voice_ai_max_agent_profiles?: number; // NEW
}
```

---

## ✅ Acceptance Criteria

### API Verification
- ✅ Admin can update plan with `voice_ai_max_agent_profiles`
- ✅ Admin can update tenant override with `default_agent_profile_id`
- ✅ Validation works (400 for invalid profile)
- ✅ Validation works (min 1, max 50 for plan limit)

### UI Implementation

**Plan Editor**:
- ✅ Field added for `voice_ai_max_agent_profiles`
- ✅ Input validates 1-50 range
- ✅ Default value shown (1)
- ✅ Save works, plan updated

**Tenant Override**:
- ✅ Dropdown loads tenant's profiles
- ✅ Shows profile title + language
- ✅ Shows inactive profiles (marked as INACTIVE)
- ✅ "No default" option available
- ✅ Save works, override updated
- ✅ Validation shown (invalid profile)

### Edge Cases
- ✅ Tenant has no profiles → dropdown shows only "No default"
- ✅ Admin sets invalid profile → 400 error shown
- ✅ Plan limit set to 0 → validation error shown

### Testing
- ✅ Updated plan limit to 3 → Success
- ✅ Tenant can now create 3 profiles max
- ✅ Set tenant default profile → Success
- ✅ IVR without profile uses this default
- ✅ Tried to set different tenant's profile → 400 error

---

## 📊 Sprint Completion Report

```markdown
## Sprint 12 Completion: Frontend Admin UI

**Status**: ✅ Complete / ⚠️ Needs Review / ❌ Blocked

### API Verification
- ✅ Plan update endpoint tested with new field
- ✅ Tenant override endpoint tested with new field
- ✅ Validation tested (invalid profile, out of range)

### Files Modified/Created
- ✅ app/src/app/(dashboard)/admin/subscription-plans/components/PlanForm.tsx
- ✅ app/src/app/(dashboard)/admin/voice-ai/tenant-override/[tenantId]/page.tsx
- ✅ app/src/services/admin-voice-ai.service.ts (NEW or updated)
- ✅ app/src/types/subscription-plan.ts

### UI Features
- ✅ Plan editor has max agent profiles field
- ✅ Tenant override has default profile selector
- ✅ Validation works (range, profile ownership)
- ✅ Save works for both

### Manual Testing
- ✅ Updated plan limit → Success
- ✅ Tenant respects new limit
- ✅ Set default profile for tenant → Success
- ✅ Verified fallback behavior (IVR uses default)
- ✅ Tested validation errors

### Backend Gap (if any)
- ⚠️ Missing endpoint: GET /system/voice-ai/tenants/:tenantId/profiles
- ✅ Workaround: [Describe workaround if used]

**Issues Encountered**: [List or write "None"]

**Sprint Owner**: [Name]
**Date**: [Date]
```

---

## 🎯 Remember

- **Admin powers = Big responsibility** - Validate everything
- **System-wide impact** - Changes affect ALL tenants on that plan
- **Verify first** - Always test API before UI
- **Clear labels** - Admin should understand what each field does
- **Audit trail** - Log admin changes if possible

**You are a masterclass developer. Your admin UI will be powerful yet safe!**

🚀 **Ready to give admins fine-grained control over voice profiles!**
