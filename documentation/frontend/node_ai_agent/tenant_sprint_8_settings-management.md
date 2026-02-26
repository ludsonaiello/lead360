# Voice AI Frontend - Sprint 8: Tenant Settings Management (TENANT)

**Sprint Type**: Tenant Interface
**Route**: `/(dashboard)/voice-ai/settings`
**Permission**: Owner, Admin, Manager (view); Owner, Admin (edit)
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 1058-1186)

---

## 🎯 MASTERPIECE DEVELOPER

### ⚠️ CRITICAL RULES

1-7: NO GUESSING | VERIFY ENDPOINTS | localhost:8000 | ASK HUMAN | NO BACKEND EDITS | ALL FIELDS | ERROR HANDLING

---

## 📋 Test Credentials

**Tenant Owner**: `contact@honeydo4you.com` / `978@F32c`

---

## 🔍 Endpoint Verification

```bash
# GET tenant settings
curl -X GET http://localhost:8000/api/v1/voice-ai/settings \
  -H "Authorization: Bearer <tenant_token>"

# PUT tenant settings
curl -X PUT http://localhost:8000/api/v1/voice-ai/settings \
  -H "Authorization: Bearer <tenant_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "is_enabled": true,
    "enabled_languages": ["en", "es"],
    "custom_greeting": "Thank you for calling!",
    "booking_enabled": true,
    "lead_creation_enabled": true,
    "transfer_enabled": true
  }'
```

---

## 📦 Data Model

```typescript
interface TenantVoiceAISettings {
  id: string;
  tenant_id: string;
  is_enabled: boolean;
  default_language: string;
  enabled_languages: string;           // JSON array as string (API format)
  custom_greeting: string | null;
  custom_instructions: string | null;
  after_hours_behavior: string | null;
  booking_enabled: boolean;
  lead_creation_enabled: boolean;
  transfer_enabled: boolean;
  default_transfer_number: string | null;
  default_transfer_number_id: string | null;
  max_call_duration_seconds: number | null;
  // Admin-set fields (view-only)
  monthly_minutes_override: number | null;
  admin_notes: string | null;
  created_at: Date;
  updated_at: Date;
}
```

**IMPORTANT**: `enabled_languages` in the API is a JSON string (e.g., `"[\"en\",\"es\"]"`), but the frontend SENDS it as an actual array: `["en","es"]`.

---

## 🏗️ Implementation

### Files

```
(dashboard)/voice-ai/
├── settings/
│   └── page.tsx                    # Tenant settings page
```

### Components

```
voice-ai/tenant/
├── settings/
│   ├── VoiceAISettingsForm.tsx     # Main settings form
│   ├── LanguageSelector.tsx        # Multi-select for languages
│   ├── ToolToggles.tsx             # Booking/leads/transfer toggles
│   └── PlanUpgradeNotice.tsx       # Show if plan doesn't include Voice AI
```

---

## 📋 Implementation Tasks

### 1. Settings Page

**Plan Entitlement Check**:
- [ ] Fetch settings (GET /settings)
- [ ] If `plan_includes_voice_ai = false`:
  - Display upgrade notice: "Your current plan does not include Voice AI. Upgrade to enable."
  - Show "Upgrade Plan" CTA button
  - Disable form (read-only or hidden)

**Form Sections**:

#### Section 1: Enable/Disable
- [ ] **is_enabled** (Toggle switch)
  - Label: "Enable Voice AI Agent"
  - Disabled if plan doesn't include Voice AI
  - On toggle: Show confirmation if disabling

#### Section 2: Languages
- [ ] **enabled_languages** (MultiSelect - actual array `["en","es"]`)
  - Options: English (en), Spanish (es), Portuguese (pt), etc.
  - Display as tags/chips
  - Required: At least 1 language selected

#### Section 3: Custom Messaging
- [ ] **custom_greeting** (Textarea, max 500 chars, nullable)
  - Placeholder: "Thank you for calling {business_name}! How can I help you today?"
  - Helper: "Use {business_name} as placeholder. Leave empty to use global default."
  - Clear button to set null (revert to default)

- [ ] **custom_instructions** (Textarea, max 2000 chars, nullable)
  - Placeholder: "Always ask if it is an emergency. Mention we serve the Miami area."
  - Helper: "Additional instructions for the agent. Leave empty if not needed."
  - Clear button to set null

#### Section 4: Tool Toggles
- [ ] **booking_enabled** (Toggle switch)
  - Label: "Allow agent to book appointments"

- [ ] **lead_creation_enabled** (Toggle switch)
  - Label: "Allow agent to create leads"

- [ ] **transfer_enabled** (Toggle switch)
  - Label: "Allow agent to transfer calls to human operators"

#### Section 5: Call Settings
- [ ] **default_transfer_number** (Phone input, E.164 format, nullable)
  - Label: "Default Transfer Number"
  - Helper: "Fallback number if transfer is enabled but no specific number selected"
  - Validation: E.164 format `/^\+[1-9]\d{1,14}$/`
  - Clear button to set null

- [ ] **max_call_duration_seconds** (Number input, 60-3600, nullable)
  - Label: "Maximum Call Duration (seconds)"
  - Helper: "Leave empty to use global default"
  - Clear button to set null (revert to global)

---

## 🎨 Form Validation

```typescript
import { z } from 'zod';

const settingsSchema = z.object({
  is_enabled: z.boolean(),
  enabled_languages: z.array(z.string()).min(1, 'Select at least one language'),
  custom_greeting: z.string().max(500).nullable().optional(),
  custom_instructions: z.string().max(2000).nullable().optional(),
  booking_enabled: z.boolean(),
  lead_creation_enabled: z.boolean(),
  transfer_enabled: z.boolean(),
  default_transfer_number: z.string()
    .regex(/^\+[1-9]\d{1,14}$/, 'Must be E.164 format (+15551234567)')
    .nullable()
    .optional(),
  max_call_duration_seconds: z.number().min(60).max(3600).nullable().optional(),
});
```

---

## 🔄 Form Submission

```typescript
const onSubmit = async (data) => {
  setSubmitting(true);
  try {
    const response = await fetch('/api/v1/voice-ai/settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const result = await response.json();
    // Show success modal
  } catch (error) {
    if (error.message.includes('plan does not include')) {
      // Show upgrade modal
    } else {
      // Show error modal
    }
  } finally {
    setSubmitting(false);
  }
};
```

---

## 🎨 Design Guidelines

### Settings Page Layout

```
Voice AI Settings
─────────────────────────────────────────────────

⚠️ Your plan includes 500 minutes per month.
   Current usage: 120 minutes (24%)

Enable Voice AI Agent
[Toggle: ON]

Languages
Select languages the agent should support:
[Multi-select: English ✓, Spanish ✓, Portuguese]

Custom Greeting (Optional)
Thank you for calling {business_name}! How can I help you today?
[________________________________________________]
[________________________________________________]
ⓘ Use {business_name} as placeholder. Leave empty for default.

Custom Instructions (Optional)
Always ask if it is an emergency. Mention we serve Miami area.
[________________________________________________]
[________________________________________________]

Agent Capabilities
☑ Allow booking appointments
☑ Allow lead creation
☑ Allow call transfers

Call Settings
Default Transfer Number (Optional)
[+15551234567___________________] [Clear]

Maximum Call Duration (Optional)
[600_____] seconds    [Clear (use default)]

                              [Cancel] [Save Settings]
```

---

## ⚠️ Error Handling

### Error Scenarios

1. **Plan doesn't include Voice AI** (403)
   - Display: "Subscription plan does not include Voice AI"
   - Show upgrade CTA

2. **Validation errors** (400)
   - Display field-specific errors
   - E.164 format error
   - Language array empty error

3. **Nullable field handling**
   - If user clears custom_greeting: Send `null`
   - If user clears max_call_duration_seconds: Send `null`

---

## 🔐 RBAC Implementation

```typescript
import { ProtectedRoute } from '@/components/rbac/shared/ProtectedRoute';

export default function VoiceAISettingsPage() {
  const { user } = useAuth();

  // View: Owner, Admin, Manager
  // Edit: Owner, Admin only

  const canEdit = user?.role === 'Owner' || user?.role === 'Admin';

  return (
    <ProtectedRoute requiredRole={['Owner', 'Admin', 'Manager']}>
      <VoiceAISettingsForm readOnly={!canEdit} />
    </ProtectedRoute>
  );
}
```

---

## ✅ Acceptance Criteria

- ✅ Endpoints verified
- ✅ Settings load correctly (or null if never configured)
- ✅ Plan entitlement check works (shows upgrade notice if not included)
- ✅ Enable/disable toggle works
- ✅ Language multi-select works (sends array)
- ✅ Custom greeting/instructions save (nullable)
- ✅ Tool toggles save
- ✅ E.164 phone validation works
- ✅ Max duration input works (nullable)
- ✅ Clear buttons set fields to null
- ✅ RBAC works (Owner/Admin edit, Manager read-only)
- ✅ Mobile responsive
- ✅ Dark mode

---

**If backend issues: STOP + ASK HUMAN.**

---

**End of Sprint 8** (First Tenant Sprint)
