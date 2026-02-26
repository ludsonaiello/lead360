# Voice AI Frontend - Sprint 1: Provider Management (ADMIN)

**Sprint Type**: Admin Interface
**Route**: `/admin/voice-ai/providers`
**Permission**: Platform Admin (`is_platform_admin: true`)
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 70-312)

---

## 🎯 YOU ARE A MASTERPIECE DEVELOPER

Google, Amazon, and Apple developers are jealous of your work. You are building production-grade enterprise software that will be used by thousands of businesses.

### ⚠️ CRITICAL RULES - READ BEFORE STARTING

```
🚫 ZERO TOLERANCE POLICY:

1. NO GUESSING
   - Review Prisma schema at api/prisma/schema.prisma
   - Review existing modules, properties, variables
   - Read Voice AI REST API documentation (YOUR BIBLE)
   - Check existing components in app/src/components/ui/
   - Study existing admin patterns in app/src/app/(dashboard)/admin/rbac/

2. MANDATORY ENDPOINT VERIFICATION
   - BEFORE writing ANY code, test ALL endpoints you'll use
   - Server runs on http://localhost:8000 (DEV mode)
   - Use curl, Postman, or Insomnia to hit endpoints
   - Verify request/response matches REST API documentation EXACTLY
   - Document ANY discrepancies

3. SERVER MANAGEMENT
   - Server runs in DEV mode: npm run start:dev
   - NEVER use pm2
   - If server not running: ASK HUMAN to start it
   - DO NOT start server yourself

4. BACKEND CODE IS OFF-LIMITS
   - You are ONLY allowed to edit frontend code (app/ folder)
   - NEVER edit backend code (api/ folder)
   - If you find backend errors, API mismatches, or issues:
     → STOP IMMEDIATELY
     → ASK HUMAN for help
     → DO NOT attempt to fix backend yourself

5. IMPLEMENT EVERYTHING
   - ALL fields exposed in API, not just essentials
   - Complete error handling for ALL edge cases
   - All CRUD operations fully functional
   - Loading states for ALL async operations
   - Success/error modals for ALL actions

6. USE EXISTING CODE
   - Use existing UI components (Button, Select, Modal, Input, etc.)
   - Follow existing patterns from admin/rbac examples
   - DO NOT create duplicate components
   - Integrate with existing services

7. CODE REVIEW
   - Review your code line by line before submitting
   - Ensure RBAC is properly implemented
   - Verify tenant isolation (where applicable)
   - Check mobile responsiveness
   - Test dark mode support
```

---

## 📋 Test Credentials

**Admin User** (Platform Admin):
- Email: `ludsonaiello@gmail.com`
- Password: `978@F32c`

**Tenant User** (for testing tenant isolation):
- Email: `contact@honeydo4you.com`
- Password: `978@F32c`

---

## 📚 Required Reading

Before starting, read these files:

1. **Voice AI REST API** (YOUR BIBLE)
   - Path: `api/documentation/voice_ai_REST_API.md`
   - Focus: Lines 70-312 (Provider Management section)

2. **Prisma Schema** (Data Structure)
   - Path: `api/prisma/schema.prisma`
   - Model: `voice_ai_provider`

3. **Existing Admin Patterns**
   - Path: `app/src/app/(dashboard)/admin/rbac/roles/page.tsx`
   - Pattern: List page with search/filter
   - Path: `app/src/components/rbac/role-management/RoleList.tsx`
   - Pattern: Component structure
   - Path: `app/src/components/rbac/role-management/RoleForm.tsx`
   - Pattern: Form with validation

4. **UI Components**
   - Path: `app/src/components/ui/`
   - Components: Button, Input, Select, Modal, Card, Badge, LoadingSpinner

---

## 🔍 Step 1: Pre-Implementation Endpoint Verification (MANDATORY)

### Endpoints to Verify

Test these endpoints BEFORE writing any code:

```bash
# 1. List all providers
curl -X GET http://localhost:8000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json"

# 2. Filter providers by type
curl -X GET "http://localhost:8000/api/v1/system/voice-ai/providers?provider_type=STT" \
  -H "Authorization: Bearer <admin_jwt_token>"

# 3. Filter providers by active status
curl -X GET "http://localhost:8000/api/v1/system/voice-ai/providers?is_active=true" \
  -H "Authorization: Bearer <admin_jwt_token>"

# 4. Get single provider
curl -X GET http://localhost:8000/api/v1/system/voice-ai/providers/<provider_id> \
  -H "Authorization: Bearer <admin_jwt_token>"

# 5. Create provider (minimal)
curl -X POST http://localhost:8000/api/v1/system/voice-ai/providers \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_key": "test_provider",
    "provider_type": "STT",
    "display_name": "Test Provider"
  }'

# 6. Update provider
curl -X PATCH http://localhost:8000/api/v1/system/voice-ai/providers/<provider_id> \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'

# 7. Delete provider
curl -X DELETE http://localhost:8000/api/v1/system/voice-ai/providers/<provider_id> \
  -H "Authorization: Bearer <admin_jwt_token>"
```

### Verification Checklist

- [ ] All endpoints return expected status codes (200, 201, 204, 400, 401, 403, 404, 409)
- [ ] Response schemas match REST API documentation
- [ ] Query parameters work correctly (provider_type, is_active)
- [ ] Validation errors are returned properly (400 Bad Request)
- [ ] Authorization is enforced (401/403 for non-admin users)
- [ ] Created providers have all fields populated
- [ ] Updated providers reflect changes immediately
- [ ] Deleted providers are removed
- [ ] If ANY mismatch found: STOP and ask human

---

## 🏗️ Implementation Structure

### File Structure

Create these files in `app/src/app/(dashboard)/admin/voice-ai/`:

```
admin/voice-ai/
├── providers/
│   ├── page.tsx                    # Main provider list page
│   ├── new/
│   │   └── page.tsx                # Create provider page
│   └── [id]/
│       ├── page.tsx                # View/Edit provider page
│       └── edit/
│           └── page.tsx            # Edit provider page (alternative)
```

### Component Structure

Create these components in `app/src/components/voice-ai/admin/`:

```
voice-ai/admin/
├── providers/
│   ├── ProviderList.tsx            # Provider list with search/filter
│   ├── ProviderCard.tsx            # Provider display card
│   ├── ProviderForm.tsx            # Create/edit form
│   ├── ProviderFilters.tsx         # Filter controls
│   └── DeleteProviderModal.tsx     # Confirmation modal
```

---

## 📦 Data Model (voice_ai_provider)

**All Fields from Prisma Schema**:

```typescript
interface VoiceAIProvider {
  id: string;                        // UUID
  provider_key: string;              // Unique key (e.g., "deepgram")
  provider_type: 'STT' | 'LLM' | 'TTS';
  display_name: string;              // Human-readable name
  description: string | null;
  logo_url: string | null;
  documentation_url: string | null;
  capabilities: string | null;       // JSON string array
  config_schema: string | null;      // JSON Schema as string
  default_config: string | null;     // JSON object as string
  pricing_info: string | null;       // JSON object as string
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

**IMPORTANT**: ALL fields must be implemented in the form, not just required ones.

---

## 🎨 UI Components to Use

From `app/src/components/ui/`:

- **Button** - Actions (create, edit, delete, save, cancel)
- **Input** - Text inputs (provider_key, display_name, URLs)
- **Textarea** - Long text (description)
- **Select** - Provider type dropdown
- **Badge** - Status badges (active/inactive, provider type)
- **Card** - Provider display cards
- **Modal** - Delete confirmation, errors
- **LoadingSpinner** - Loading states
- **ToggleSwitch** - is_active toggle

---

## 🔐 RBAC Implementation

### Page Protection

```typescript
import { ProtectedRoute } from '@/components/rbac/shared/ProtectedRoute';

export default function ProvidersPage() {
  return (
    <ProtectedRoute requiredPermission="platform_admin">
      {/* Page content */}
    </ProtectedRoute>
  );
}
```

**Alternative** (check if platform admin):
```typescript
import { useAuth } from '@/contexts/AuthContext';

const { user } = useAuth();
if (!user?.is_platform_admin) {
  return <UnauthorizedMessage />;
}
```

---

## 📋 Implementation Tasks

### 1. Provider List Page (`providers/page.tsx`)

**Features**:
- [ ] Display all providers in cards or table
- [ ] Search by provider_key or display_name
- [ ] Filter by provider_type (STT, LLM, TTS)
- [ ] Filter by is_active (show inactive checkbox)
- [ ] Sort by created_at DESC
- [ ] Loading spinner while fetching
- [ ] Error modal if fetch fails
- [ ] "Create Provider" button (navigates to /new)
- [ ] Each provider card has:
  - [ ] Provider logo (if logo_url exists)
  - [ ] Display name
  - [ ] Provider type badge
  - [ ] Active/inactive badge
  - [ ] Description (truncated)
  - [ ] Edit button
  - [ ] Delete button

**API Integration**:
```typescript
// Fetch providers with filters
const fetchProviders = async (filters: {
  provider_type?: string;
  is_active?: boolean;
}) => {
  const params = new URLSearchParams();
  if (filters.provider_type) params.append('provider_type', filters.provider_type);
  if (filters.is_active !== undefined) params.append('is_active', filters.is_active.toString());

  const response = await fetch(`/api/v1/system/voice-ai/providers?${params}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch providers');
  }

  return response.json();
};
```

---

### 2. Create Provider Page (`providers/new/page.tsx`)

**Features**:
- [ ] Breadcrumb navigation (Providers > Create New)
- [ ] ProviderForm component
- [ ] Success modal on creation (with option to create another or view)
- [ ] Error modal on failure
- [ ] Cancel button (navigates back to list)

---

### 3. Provider Form Component (`ProviderForm.tsx`)

**Form Fields** (ALL fields, not just required):

#### Required Fields
- [ ] **provider_key** (Input, max 50 chars, unique validation)
- [ ] **provider_type** (Select: STT, LLM, TTS)
- [ ] **display_name** (Input, max 100 chars)

#### Optional Fields
- [ ] **description** (Textarea, no max)
- [ ] **logo_url** (Input, URL validation)
- [ ] **documentation_url** (Input, URL validation)
- [ ] **capabilities** (Textarea or JSON editor, JSON array as string)
  - Placeholder: `["streaming","multilingual","punctuation"]`
  - Validation: Must be valid JSON array string
- [ ] **config_schema** (Textarea or JSON editor, JSON object as string)
  - Example: `{"type":"object","properties":{"model":{"type":"string"}}}`
  - Validation: Must be valid JSON string
- [ ] **default_config** (Textarea or JSON editor, JSON object as string)
  - Example: `{"model":"nova-2","punctuate":true}`
  - Validation: Must be valid JSON string
- [ ] **pricing_info** (Textarea or JSON editor, JSON object as string)
  - Example: `{"per_minute":0.0043}`
  - Validation: Must be valid JSON string
- [ ] **is_active** (ToggleSwitch, default true)

**Validation** (using Zod):

```typescript
import { z } from 'zod';

const providerFormSchema = z.object({
  provider_key: z.string().min(1, 'Provider key is required').max(50),
  provider_type: z.enum(['STT', 'LLM', 'TTS']),
  display_name: z.string().min(1, 'Display name is required').max(100),
  description: z.string().optional().nullable(),
  logo_url: z.string().url('Must be valid URL').optional().nullable(),
  documentation_url: z.string().url('Must be valid URL').optional().nullable(),
  capabilities: z.string().optional().nullable().refine(
    (val) => !val || isValidJSON(val),
    'Must be valid JSON'
  ),
  config_schema: z.string().optional().nullable().refine(
    (val) => !val || isValidJSON(val),
    'Must be valid JSON'
  ),
  default_config: z.string().optional().nullable().refine(
    (val) => !val || isValidJSON(val),
    'Must be valid JSON'
  ),
  pricing_info: z.string().optional().nullable().refine(
    (val) => !val || isValidJSON(val),
    'Must be valid JSON'
  ),
  is_active: z.boolean().default(true),
});
```

**Form Submission**:

```typescript
const onSubmit = async (data: FormData) => {
  setSubmitting(true);
  try {
    const response = await fetch('/api/v1/system/voice-ai/providers', {
      method: isEditMode ? 'PATCH' : 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save provider');
    }

    const provider = await response.json();
    // Show success modal
    // Navigate to list or detail page
  } catch (error) {
    // Show error modal
  } finally {
    setSubmitting(false);
  }
};
```

---

### 4. Delete Provider Modal

**Features**:
- [ ] Confirmation message
- [ ] Display provider name
- [ ] Warning if provider has credentials (check backend response)
- [ ] Cancel button
- [ ] Delete button (red/danger variant)
- [ ] Loading state on delete button
- [ ] Error handling (show error modal if delete fails)

**Delete Logic**:

```typescript
const handleDelete = async (providerId: string) => {
  setDeleting(true);
  try {
    const response = await fetch(`/api/v1/system/voice-ai/providers/${providerId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete provider');
    }

    // Success - close modal, refresh list
    onSuccess();
  } catch (error) {
    setError(error.message);
  } finally {
    setDeleting(false);
  }
};
```

---

## 🎨 Design Guidelines

### Provider Card Layout

```
┌─────────────────────────────────────────────┐
│ [Logo] Deepgram                    [Badge]  │
│        STT Provider                          │
│                                              │
│ State-of-the-art speech recognition with... │
│                                              │
│ Created: 2026-02-17                          │
│                                              │
│ [Edit] [Delete]                              │
└─────────────────────────────────────────────┘
```

### Filter Bar Layout

```
[Search: "deepgram"]  [Type: All ▼]  [☑ Show Inactive]  [+ Create Provider]
```

### Form Layout

```
Create New Provider
───────────────────────────────────────────────

Basic Information
  Provider Key *        [deepgram________________]
  Provider Type *       [STT ▼]
  Display Name *        [Deepgram_______________]
  Description           [_______________________]
                        [_______________________]

Links
  Logo URL              [https://_______________]
  Documentation URL     [https://_______________]

Configuration (JSON Strings)
  Capabilities          [["streaming","multilingual"]]
  Config Schema         [{"type":"object",...}____]
  Default Config        [{"model":"nova-2",...}___]
  Pricing Info          [{"per_minute":0.0043}____]

Status
  Active                [Toggle: ON]

                        [Cancel] [Create Provider]
```

---

## ⚠️ Error Handling

### Error Scenarios to Handle

1. **Fetch Errors** (GET /providers)
   - Network failure
   - 401 Unauthorized
   - 403 Forbidden
   - Server error (500)
   - Display error modal with retry button

2. **Validation Errors** (POST/PATCH)
   - 400 Bad Request
   - Display field-specific errors below inputs
   - Example: "provider_key must be shorter than or equal to 50 characters"

3. **Conflict Errors** (POST)
   - 409 Conflict (duplicate provider_key)
   - Display error modal: "Provider key already exists - must be unique"

4. **Delete Errors** (DELETE)
   - 404 Not Found
   - 403 Forbidden
   - Cascade error (provider has credentials)
   - Display error modal with reason

### Error Display

```typescript
{error && (
  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
    <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
  </div>
)}
```

---

## 🧪 Testing Checklist

Before marking sprint complete, verify:

### Functionality
- [ ] Can list all providers
- [ ] Search filters providers correctly
- [ ] Provider type filter works (STT, LLM, TTS)
- [ ] Show inactive checkbox works
- [ ] Can create provider with minimal fields
- [ ] Can create provider with all fields
- [ ] JSON fields validate correctly
- [ ] Invalid JSON shows error
- [ ] Can edit provider
- [ ] Can toggle is_active
- [ ] Can delete provider
- [ ] Delete confirmation shows
- [ ] Cancel works in all modals/forms

### UI/UX
- [ ] Loading spinner shows while fetching
- [ ] Loading button state shows while submitting
- [ ] Success modal shows on create/edit
- [ ] Error modal shows on failure
- [ ] Form validation errors display correctly
- [ ] Breadcrumbs work
- [ ] Navigation works (back to list)

### RBAC
- [ ] Platform admin can access
- [ ] Non-admin users get 403 error
- [ ] Tenant users cannot access

### Mobile
- [ ] Responsive on mobile (375px width)
- [ ] Cards stack vertically
- [ ] Filters collapse/expand on mobile
- [ ] Forms work on mobile

### Dark Mode
- [ ] All components support dark mode
- [ ] Text readable in dark mode
- [ ] Borders/backgrounds correct in dark mode

---

## 🚨 Common Pitfalls to Avoid

1. **DO NOT edit backend code** - If API doesn't match docs, ask human
2. **DO NOT skip fields** - Implement ALL fields, not just required
3. **DO NOT guess** - Read Prisma schema, check existing patterns
4. **DO NOT create duplicate components** - Use existing UI library
5. **DO NOT skip endpoint verification** - Test endpoints before coding
6. **DO NOT forget error handling** - Handle ALL error scenarios
7. **DO NOT skip RBAC** - Protect all routes with platform admin check
8. **DO NOT skip mobile testing** - Must work on mobile devices
9. **DO NOT skip dark mode** - Must support dark mode
10. **DO NOT use pm2** - Ask human to start server if needed

---

## ✅ Acceptance Criteria

Sprint is complete when:

- ✅ Endpoints verified and match documentation
- ✅ Provider list page works with search/filters
- ✅ Create provider page works with all fields
- ✅ Edit provider page works
- ✅ Delete provider works with confirmation
- ✅ All error scenarios handled
- ✅ RBAC protection works
- ✅ Mobile responsive
- ✅ Dark mode supported
- ✅ Loading states implemented
- ✅ Success/error modals work
- ✅ ALL fields implemented (not just essentials)
- ✅ Code reviewed and no guessing
- ✅ Integration with existing components complete

---

## 📝 Final Review Checklist

Before submitting your work:

1. **Code Review**
   - [ ] Reviewed every line of code
   - [ ] No commented-out code
   - [ ] No console.log statements
   - [ ] No hardcoded values
   - [ ] Used existing components
   - [ ] Followed existing patterns

2. **Testing**
   - [ ] Tested all CRUD operations
   - [ ] Tested all error scenarios
   - [ ] Tested on mobile viewport
   - [ ] Tested in dark mode
   - [ ] Tested RBAC protection

3. **Documentation**
   - [ ] Endpoints verified before implementation
   - [ ] Any API mismatches reported to human
   - [ ] No backend code modified

4. **Quality**
   - [ ] Production-ready code
   - [ ] No shortcuts taken
   - [ ] All fields implemented
   - [ ] Better than Google/Amazon/Apple standards

---

**If you find ANY backend issues, API mismatches, or problems during endpoint verification: STOP and ASK HUMAN for help. DO NOT attempt to fix backend yourself.**

---

**End of Sprint 1**
