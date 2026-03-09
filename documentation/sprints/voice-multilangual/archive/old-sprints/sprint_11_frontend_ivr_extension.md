# Sprint 11: Frontend - IVR Builder Extension (Agent Profile Selection)

## 🎯 Sprint Owner Role

You are a **MASTERCLASS IVR UI SPECIALIST** that makes Google, Amazon, and Apple telephony UI engineers jealous.

You build complex configuration UIs that are **intuitive**, **error-proof**, and **beautiful**. You **think deeply** about user workflows, **breathe conditional form logic**, and **never rush** through nested configuration. You **always review existing IVR UI** before changing anything, and **never guess** - you **verify API first**.

**100% quality or beyond**. IVR configs affect live customer calls - UI mistakes here cause wrong call routing.

---

## 📋 Sprint Objective

Extend the existing IVR builder to support agent profile selection for voice_ai actions:
1. **FIRST**: Verify IVR API accepts `agent_profile_id` in voice_ai config
2. Add agent profile dropdown to voice_ai action configuration
3. Load active profiles from API
4. Handle validation errors (inactive profile, wrong tenant)
5. Show profile details (language, voice) in UI
6. Test end-to-end IVR save with profile

**Dependencies**:
- Sprint 5 complete (backend IVR integration)
- Sprint 10 complete (profile management UI exists)

---

## 📚 Required Reading

1. **API Documentation**:
   - `/var/www/lead360.app/api/documentation/voice_agent_profiles_REST_API.md` (Section: IVR Integration)
   - `/var/www/lead360.app/documentation/user_guides/multi_level_ivr_guide.md`
2. **Existing IVR UI**: `app/src/app/(dashboard)/communication/ivr/` (complete IVR builder)
3. **Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md` - Section 6

---

## 🔐 Test Environment

**API**: `http://localhost:8000/api/v1`
**Credentials**: `contact@honeydo4you.com` / `978@F32c`

---

## ⚠️ CRITICAL: API VERIFICATION FIRST

**BEFORE touching IVR code**, verify backend integration:

```bash
TOKEN="your-jwt-token"

# Step 1: Create a test profile
PROFILE=$(curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "IVR Test Agent",
    "language_code": "es",
    "voice_id": "spanish-voice-id"
  }')

PROFILE_ID=$(echo $PROFILE | jq -r '.id')
echo "Profile ID: $PROFILE_ID"

# Step 2: Create/Update IVR config with agent_profile_id
curl -X POST http://localhost:8000/api/v1/communication/twilio/ivr \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ivr_enabled": true,
    "greeting_message": "Welcome to our service",
    "menu_options": [
      {
        "id": "opt-1",
        "digit": "1",
        "action": "voice_ai",
        "label": "Spanish AI Agent",
        "config": {
          "agent_profile_id": "'"$PROFILE_ID"'"
        }
      }
    ],
    "default_action": {
      "action": "route_to_default",
      "config": {
        "phone_number": "+15551234567"
      }
    }
  }' | jq

# Step 3: Verify IVR config was saved correctly
curl -X GET http://localhost:8000/api/v1/communication/twilio/ivr \
  -H "Authorization: Bearer $TOKEN" | jq '.menu_options[0].config.agent_profile_id'

# Should return the profile ID
```

**Expected**: IVR saves successfully with `agent_profile_id` in config.
**If NOT**: Stop and report to backend team - Sprint 5 not complete.

---

## 📐 Implementation

### Step 1: Extend IVR Config Types

**File**: `app/src/types/ivr.ts` (or wherever IVR types are defined)

```typescript
export interface IvrMenuOptionConfig {
  phone_number?: string;
  webhook_url?: string;
  max_duration_seconds?: number;
  agent_profile_id?: string; // NEW
}

export interface IvrMenuOption {
  id: string;
  digit: string;
  action: IvrActionType;
  label: string;
  config?: IvrMenuOptionConfig;
  submenu?: IvrSubmenu;
}
```

---

### Step 2: Create Agent Profile Selector Component

**File**: `app/src/app/(dashboard)/communication/ivr/components/AgentProfileSelector.tsx`

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Select } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { voiceAgentProfilesApi } from '@/services/voice-agent-profiles.service';
import type { VoiceAgentProfile } from '@/types/voice-agent-profile';

interface Props {
  value?: string; // Selected profile ID
  onChange: (profileId: string | undefined) => void;
  error?: string;
}

export function AgentProfileSelector({ value, onChange, error }: Props) {
  const [profiles, setProfiles] = useState<VoiceAgentProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfiles();
  }, []);

  async function loadProfiles() {
    try {
      const data = await voiceAgentProfilesApi.list(true); // Active only
      setProfiles(data);
    } catch (err) {
      console.error('Failed to load profiles:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <Spinner size="sm" />
        <span className="text-sm text-gray-500">Loading profiles...</span>
      </div>
    );
  }

  if (profiles.length === 0) {
    return (
      <div className="text-sm text-yellow-600 bg-yellow-50 p-3 rounded border border-yellow-200">
        <p className="font-medium">No voice agent profiles available</p>
        <p className="mt-1">
          <a
            href="/voice-ai/agent-profiles"
            className="underline hover:text-yellow-700"
            target="_blank"
          >
            Create a profile
          </a>{' '}
          to use language-specific voice agents.
        </p>
      </div>
    );
  }

  const selectedProfile = profiles.find((p) => p.id === value);

  return (
    <div className="space-y-2">
      <Select
        value={value || ''}
        onChange={(e) => onChange(e.target.value || undefined)}
      >
        <option value="">Use default voice settings</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.title} ({profile.language_code.toUpperCase()})
          </option>
        ))}
      </Select>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {selectedProfile && (
        <div className="text-sm bg-blue-50 border border-blue-200 p-3 rounded">
          <div className="font-medium text-blue-900">
            {selectedProfile.title}
          </div>
          <div className="text-blue-700 mt-1 space-y-1">
            <div>Language: <span className="font-mono">{selectedProfile.language_code}</span></div>
            <div>Voice ID: <span className="font-mono text-xs">{selectedProfile.voice_id}</span></div>
            {selectedProfile.custom_greeting && (
              <div className="mt-2 text-xs italic">
                "{selectedProfile.custom_greeting}"
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

### Step 3: Integrate into IVR Action Config Form

**File**: `app/src/app/(dashboard)/communication/ivr/components/IvrActionConfig.tsx` (or similar)

Find where `voice_ai` action is configured and add profile selector:

```typescript
{action === 'voice_ai' && (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium mb-2">
        Voice Agent Profile (Optional)
      </label>
      <AgentProfileSelector
        value={config?.agent_profile_id}
        onChange={(profileId) => {
          onConfigChange({
            ...config,
            agent_profile_id: profileId,
          });
        }}
      />
      <p className="text-xs text-gray-500 mt-2">
        Select a profile to use language-specific voice and greeting.
        Leave empty to use tenant default settings.
      </p>
    </div>
  </div>
)}
```

---

### Step 4: Update IVR Save Logic

**File**: `app/src/app/(dashboard)/communication/ivr/page.tsx` (or wherever IVR is saved)

Ensure `agent_profile_id` is included in the payload when saving:

```typescript
async function saveIvrConfig() {
  try {
    setLoading(true);

    // Build IVR config payload
    const payload = {
      ivr_enabled: enabled,
      greeting_message: greeting,
      menu_options: menuOptions.map((opt) => ({
        id: opt.id,
        digit: opt.digit,
        action: opt.action,
        label: opt.label,
        config: opt.config, // Includes agent_profile_id if set
        submenu: opt.submenu,
      })),
      default_action: defaultAction,
      timeout_seconds: timeout,
      max_retries: maxRetries,
    };

    await ivrApi.createOrUpdate(payload);

    // Show success message
    alert('IVR configuration saved successfully!');
  } catch (error: any) {
    if (error.response?.status === 400) {
      // Handle validation errors (e.g., inactive profile)
      alert(error.response.data.message);
    } else {
      alert('Failed to save IVR configuration');
    }
  } finally {
    setLoading(false);
  }
}
```

---

### Step 5: Display Profile in IVR Preview

**File**: `app/src/app/(dashboard)/communication/ivr/components/IvrPreview.tsx` (if exists)

When showing menu options, display profile info:

```typescript
{option.action === 'voice_ai' && option.config?.agent_profile_id && (
  <div className="mt-2 text-xs bg-purple-50 p-2 rounded">
    <span className="font-medium">Profile:</span> {/* Fetch and show profile title */}
  </div>
)}
```

---

## ✅ Acceptance Criteria

### API Verification
- ✅ Backend accepts `agent_profile_id` in voice_ai config
- ✅ IVR saves successfully with profile ID
- ✅ IVR retrieval returns profile ID in config
- ✅ Validation works (400 for inactive/foreign profile)

### UI Implementation
- ✅ AgentProfileSelector component loads active profiles
- ✅ Dropdown shows profile title + language code
- ✅ Selected profile shows language, voice ID, greeting
- ✅ "Use default" option available (undefined/null profile ID)
- ✅ Empty state shown if no profiles exist (with link to create)
- ✅ Profile selector integrated into voice_ai action config
- ✅ IVR save includes agent_profile_id in payload
- ✅ Validation errors displayed (inactive profile)

### Testing
- ✅ Save IVR with profile → Success
- ✅ Save IVR without profile → Success (backward compatible)
- ✅ Save IVR with inactive profile → 400 error shown
- ✅ IVR preview shows profile info
- ✅ Can switch between profiles and save
- ✅ Can change from profile to "default" and save

### Edge Cases
- ✅ No profiles exist → helpful message shown
- ✅ Profile deleted after IVR saved → IVR still works (graceful fallback)
- ✅ Mobile responsive

---

## 📊 Sprint Completion Report

```markdown
## Sprint 11 Completion: Frontend IVR Extension

**Status**: ✅ Complete / ⚠️ Needs Review / ❌ Blocked

### API Verification
- ✅ Backend IVR endpoint tested with agent_profile_id
- ✅ Save successful: YES / NO
- ✅ Validation tested (inactive profile): YES / NO

### Files Modified/Created
- ✅ app/src/types/ivr.ts (added agent_profile_id to config)
- ✅ app/src/app/(dashboard)/communication/ivr/components/AgentProfileSelector.tsx (NEW)
- ✅ app/src/app/(dashboard)/communication/ivr/components/IvrActionConfig.tsx (integrated selector)
- ✅ app/src/app/(dashboard)/communication/ivr/page.tsx (save logic updated)

### UI Features
- ✅ Profile selector dropdown implemented
- ✅ Profile details shown (language, voice, greeting)
- ✅ Empty state with link to create profile
- ✅ Validation error handling
- ✅ IVR preview updated

### Manual Testing
- ✅ Saved IVR with profile
- ✅ Saved IVR without profile (default)
- ✅ Tested validation (inactive profile)
- ✅ Verified profile info displayed
- ✅ Mobile responsive tested

**Issues Encountered**: [List or write "None"]

**Sprint Owner**: [Name]
**Date**: [Date]
```

---

## 🎯 Remember

- **API FIRST** - Verify backend accepts agent_profile_id before UI work
- **Graceful degradation** - UI works even if no profiles exist
- **Validation** - Show clear errors for inactive/foreign profiles
- **User flow** - Easy to switch between profile and default
- **Preview** - Show what profile will be used in IVR

**You are a masterclass developer. Your IVR extension will be seamless and intuitive!**

🚀 **Ready to enhance the IVR builder with multi-language support!**
