# Voice AI Frontend - Sprint 5: Tenant Management & Overrides (ADMIN)

**Sprint Type**: Admin Interface
**Route**: `/admin/voice-ai/tenants`
**Permission**: Platform Admin
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 834-958)

---

## 🎯 MASTERPIECE DEVELOPER

### ⚠️ CRITICAL RULES

1. NO GUESSING | 2. ENDPOINT VERIFICATION FIRST | 3. SERVER: localhost:8000 | 4. ASK HUMAN if server not running | 5. NEVER edit backend | 6. ALL FIELDS | 7. COMPLETE ERROR HANDLING

---

## 📋 Test Credentials

Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## 🔍 Endpoint Verification

```bash
# GET tenants list with pagination/search
curl -X GET "http://localhost:8000/api/v1/system/voice-ai/tenants?page=1&limit=20&search=honey" \
  -H "Authorization: Bearer <token>"

# PATCH tenant override
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/tenants/<tenant_id>/override \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "force_enabled": true,
    "monthly_minutes_override": 500,
    "admin_notes": "VIP customer - extra quota"
  }'
```

---

## 📦 Data Model

```typescript
interface TenantVoiceAISummary {
  tenant_id: string;
  company_name: string;
  plan_name: string;
  voice_ai_included_in_plan: boolean;
  is_enabled: boolean;
  minutes_included: number;
  minutes_used: number;
  has_admin_override: boolean;
}

interface TenantOverrideDto {
  force_enabled?: boolean | null;              // null = remove override
  monthly_minutes_override?: number | null;    // null = revert to plan default
  stt_provider_override_id?: string | null;
  llm_provider_override_id?: string | null;
  tts_provider_override_id?: string | null;
  admin_notes?: string | null;
}
```

---

## 🏗️ Implementation

### Files

```
admin/voice-ai/
├── tenants/
│   └── page.tsx                    # Tenants list with overrides
```

### Components

```
voice-ai/admin/
├── tenants/
│   ├── TenantsList.tsx             # Table with pagination
│   ├── TenantUsageBar.tsx          # Visual usage indicator
│   ├── TenantOverrideModal.tsx     # Edit overrides modal
│   └── TenantOverrideForm.tsx      # Override form
```

---

## 📋 Implementation Tasks

### 1. Tenants List Page

**Features**:
- [ ] Paginated table (GET /tenants?page=&limit=)
- [ ] Search by company name
- [ ] Display tenant summary data
- [ ] Usage progress bars
- [ ] Admin override badge (if has_admin_override)
- [ ] "Override Settings" button per tenant

**Table Columns**:
| Company | Plan | In Plan | Enabled | Minutes (Used/Limit) | Usage % | Actions |
|---------|------|---------|---------|----------------------|---------|---------|
| Honeydo4You | Professional | ✅ | ✅ | 120/500 | [=====>---] 24% | [Override] |
| MDX Roofing | Básico | ✅ | ❌ | 0/100 | [----------] 0% | [Override] |

**Search Bar**:
```
[Search by company name...]              [Search]

Page 1 of 5 (showing 20 of 87 tenants)    [< Prev] [Next >]
```

---

### 2. Override Modal

**Form Sections**:

#### Infrastructure Overrides
- [ ] **force_enabled** (3-state: True, False, or Null)
  - Display: Radio buttons or select
  - Options: "Force Enable", "Force Disable", "Let Tenant Control (remove override)"

- [ ] **monthly_minutes_override** (Number input or null)
  - Checkbox: "Override monthly minutes"
  - If checked: Show number input
  - If unchecked: Set to null (revert to plan default)

- [ ] **stt_provider_override_id** (Dropdown or null)
  - Populated from providers where type='STT'
  - Option to clear (set null)

- [ ] **llm_provider_override_id** (Dropdown or null)
- [ ] **tts_provider_override_id** (Dropdown or null)

#### Admin Notes
- [ ] **admin_notes** (Textarea, nullable)
  - Internal notes visible only to admins
  - Example: "VIP customer, extra quota approved"

#### View-Only Info (Inherited from tenant settings)
Display these fields as read-only:
- Enabled languages
- Custom greeting
- Custom instructions
- Tool toggles (booking, leads, transfer)
- Transfer numbers count

---

## 🎨 Nullable Semantics

**IMPORTANT**: Setting a field to `null` removes the override and reverts to default.

Examples:
- `force_enabled = null` → Tenant controls enable/disable themselves
- `force_enabled = true` → Force enable (tenant cannot disable)
- `force_enabled = false` → Force disable (tenant cannot enable)

- `monthly_minutes_override = null` → Use plan default (e.g., 500 from "Professional" plan)
- `monthly_minutes_override = 1000` → Override to 1000 minutes

---

## 🔄 Form Submission

```typescript
const onSubmit = async (tenantId: string, data) => {
  setSubmitting(true);
  try {
    const response = await fetch(`/api/v1/system/voice-ai/tenants/${tenantId}/override`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) throw new Error('Failed to update override');

    // Success - close modal, refresh list
  } catch (error) {
    // Show error modal
  } finally {
    setSubmitting(false);
  }
};
```

---

## ⚠️ Error Handling

- 400: Validation (minutes_override must not be less than 0)
- 404: Tenant not found

---

## ✅ Acceptance Criteria

- ✅ Endpoints verified
- ✅ Tenant list with pagination works
- ✅ Search filters tenants by company name
- ✅ Usage bars display correctly
- ✅ Override modal opens with current values
- ✅ Can set/remove force_enabled override
- ✅ Can set/remove minutes override
- ✅ Can set/remove provider overrides
- ✅ Nullable semantics work (null = remove override)
- ✅ Admin notes save
- ✅ View-only tenant settings displayed
- ✅ RBAC protection
- ✅ Mobile responsive

---

**If backend issues: STOP + ASK HUMAN.**

---

**End of Sprint 5**
