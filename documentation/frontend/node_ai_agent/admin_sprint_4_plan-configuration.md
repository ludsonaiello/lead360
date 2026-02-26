# Voice AI Frontend - Sprint 4: Plan Configuration (ADMIN)

**Sprint Type**: Admin Interface
**Route**: `/admin/voice-ai/plans`
**Permission**: Platform Admin
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 628-728)

---

## 🎯 MASTERPIECE DEVELOPER

### ⚠️ CRITICAL RULES

1. NO GUESSING 2. ENDPOINT VERIFICATION FIRST
3. SERVER: localhost:8000
4. ASK HUMAN if server not running
5. NEVER edit backend
6. ALL FIELDS
7. COMPLETE ERROR HANDLING

---

## 📋 Test Credentials

Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## 🔍 Endpoint Verification

```bash
# GET all plans with voice AI config
curl -X GET http://localhost:8000/api/v1/system/voice-ai/plans \
  -H "Authorization: Bearer <token>"

# PATCH plan voice AI settings
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/plans/<plan_id>/voice \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "voice_ai_enabled": true,
    "voice_ai_minutes_included": 200,
    "voice_ai_overage_rate": 0.10
  }'
```

**Verify response schemas match docs. If not: STOP + ASK HUMAN.**

---

## 📦 Data Model

```typescript
interface SubscriptionPlan {
  id: string;
  name: string;
  description: string;
  monthly_price: string;
  annual_price: string;
  is_active: boolean;
  voice_ai_enabled: boolean;
  voice_ai_minutes_included: number | null;
  voice_ai_overage_rate: number | null;  // null = block calls when quota exceeded
}
```

---

## 🏗️ Implementation

### File Structure

```
admin/voice-ai/
├── plans/
│   └── page.tsx                    # Plans configuration page
```

### Components

```
voice-ai/admin/
├── plans/
│   ├── PlansList.tsx               # Plans table
│   ├── PlanVoiceConfigModal.tsx    # Edit voice AI config modal
│   └── PlanVoiceConfigForm.tsx     # Form for voice settings
```

---

## 📋 Implementation Tasks

### 1. Plans List Page

**Layout**: Table with all subscription plans and their Voice AI configuration.

**Table Columns**:
| Plan Name | Monthly Price | Voice AI Enabled | Minutes Included | Overage Rate | Actions |
|-----------|---------------|------------------|------------------|--------------|---------|
| Básico | $180 | ✅ Yes | 100 | Block (null) | [Edit Voice AI] |
| Professional | $700 | ✅ Yes | 500 | $0.10/min | [Edit Voice AI] |
| Enterprise | Custom | ❌ No | - | - | [Edit Voice AI] |

**Features**:
- [ ] Display all plans (GET /api/v1/system/voice-ai/plans)
- [ ] Show Voice AI status (enabled/disabled badge)
- [ ] Show minutes included (or "-" if disabled)
- [ ] Show overage rate (or "Block" if null, or "-" if disabled)
- [ ] "Edit Voice AI" button opens modal
- [ ] Loading spinner while fetching

---

### 2. Edit Voice AI Config Modal

**Form Fields**:

#### Required Fields
- [ ] **voice_ai_enabled** (Toggle switch)
  - Label: "Enable Voice AI for this plan"

#### Conditional Fields (shown only if enabled)
- [ ] **voice_ai_minutes_included** (Number input, min 0)
  - Label: "Monthly Minutes Included"
  - Helper: "0 = no included minutes"

- [ ] **voice_ai_overage_rate** (Number input, min 0, or null)
  - Label: "Overage Rate (USD per minute)"
  - Helper: "Leave empty to block calls when quota exceeded"
  - Nullable checkbox or special handling

**Nullable Semantics**:
- `voice_ai_overage_rate = null` → Block calls when quota exceeded
- `voice_ai_overage_rate = 0.10` → Charge $0.10 per minute for overages

**Display Logic**:
```
If voice_ai_enabled = false:
  → Hide minutes_included and overage_rate fields
  → Display: "Voice AI is disabled for this plan"

If voice_ai_enabled = true:
  → Show minutes_included input
  → Show overage_rate input with nullable option
```

---

## 🎨 Form Validation

```typescript
const planVoiceConfigSchema = z.object({
  voice_ai_enabled: z.boolean(),
  voice_ai_minutes_included: z.number().min(0).int().optional().nullable(),
  voice_ai_overage_rate: z.number().min(0).optional().nullable(),
});
```

---

## 🔄 Form Submission

```typescript
const onSubmit = async (planId: string, data) => {
  setSubmitting(true);
  try {
    const response = await fetch(`/api/v1/system/voice-ai/plans/${planId}/voice`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Failed to update plan');

    const result = await response.json();
    // Show success modal
    // Refresh plans list
  } catch (error) {
    // Show error modal
  } finally {
    setSubmitting(false);
  }
};
```

---

## 🎨 UI Design

### Modal Layout

```
Configure Voice AI for "Básico" Plan
────────────────────────────────────────────────

Enable Voice AI
[Toggle: ON]

Monthly Minutes Included *
[100_____] minutes

Overage Rate
[0.10____] USD per minute
☐ Block calls when quota exceeded (set to null)

⚠️ If "Block" is checked, overage_rate will be null and calls
   will be blocked when quota is exceeded.

                                [Cancel] [Save Changes]
```

---

## ⚠️ Error Handling

- 400: Validation errors
- 401/403: Unauthorized
- 404: Plan not found

---

## ✅ Acceptance Criteria

- ✅ Endpoints verified
- ✅ Plans list displays all plans with Voice AI config
- ✅ Edit modal opens with current values
- ✅ Toggle switch enables/disables Voice AI
- ✅ Minutes included input works (min 0)
- ✅ Overage rate input works (nullable)
- ✅ Null overage rate = "Block" display in table
- ✅ Save updates plan successfully
- ✅ RBAC protection
- ✅ Mobile responsive
- ✅ Dark mode

---

**If backend issues: STOP + ASK HUMAN.**

---

**End of Sprint 4**
