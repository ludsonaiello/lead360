# Voice AI Frontend - Sprint 2: Credentials Management (ADMIN)

**Sprint Type**: Admin Interface
**Route**: `/admin/voice-ai/credentials`
**Permission**: Platform Admin (`is_platform_admin: true`)
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 314-461)

---

## 🎯 YOU ARE A MASTERPIECE DEVELOPER

Google, Amazon, and Apple developers are jealous of your work.

### ⚠️ CRITICAL RULES - NO EXCEPTIONS

```
🚫 ZERO TOLERANCE POLICY:

1. NO GUESSING - Review Prisma schema, existing modules, REST API docs
2. MANDATORY ENDPOINT VERIFICATION - Test endpoints BEFORE coding
3. SERVER: http://localhost:8000 (DEV mode, npm run start:dev)
4. If server not running: ASK HUMAN - DO NOT start it yourself
5. NEVER use pm2
6. BACKEND CODE OFF-LIMITS:
   - If you find backend errors/API mismatches: STOP + ASK HUMAN
   - DO NOT edit api/ folder
7. IMPLEMENT ALL FIELDS - No shortcuts
8. COMPLETE ERROR HANDLING - All scenarios covered
9. USE EXISTING COMPONENTS - No duplicates
10. CODE REVIEW - Line by line before submitting
```

---

## 🔐 SECURITY CRITICAL - READ CAREFULLY

**THIS SPRINT HANDLES ENCRYPTED API KEYS**

### Security Requirements

1. **NEVER display actual credential values**
   - Only show masked_api_key (e.g., "sk-p...xyz")
   - Plain API key only returned once on creation (backend never stores it)

2. **Password input for credentials**
   - Use type="password" for API key input
   - Mask characters while typing
   - Option to toggle visibility (eye icon)

3. **Encryption handled by backend**
   - Frontend sends plain key
   - Backend encrypts with AES-256-GCM
   - Frontend never stores unencrypted keys

4. **Test connection feature**
   - Validates stored credential by calling provider API
   - Returns success/failure
   - Does not expose the key value

---

## 📋 Test Credentials

**Admin User**: ludsonaiello@gmail.com / 978@F32c
**Tenant User**: contact@honeydo4you.com / 978@F32c

---

## 📚 Required Reading

1. **Voice AI REST API** - `api/documentation/voice_ai_REST_API.md` (Lines 314-461)
2. **Prisma Schema** - `api/prisma/schema.prisma` (voice_ai_credentials model)
3. **Existing Admin Patterns** - `app/src/app/(dashboard)/admin/rbac/`
4. **UI Components** - `app/src/components/ui/`

---

## 🔍 Step 1: Endpoint Verification (MANDATORY)

Test these endpoints BEFORE coding:

```bash
# 1. List all credentials (masked)
curl -X GET http://localhost:8000/api/v1/system/voice-ai/credentials \
  -H "Authorization: Bearer <admin_token>"

# Expected response:
# [
#   {
#     "id": "uuid",
#     "provider_id": "uuid",
#     "masked_api_key": "sk-p...xyz",
#     "additional_config": null,
#     "created_at": "2026-02-22T...",
#     "updated_at": "2026-02-22T...",
#     "updated_by": "uuid"
#   }
# ]

# 2. Create/update credential (upsert)
curl -X PUT http://localhost:8000/api/v1/system/voice-ai/credentials/<provider_id> \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "api_key": "dg_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "additional_config": "{\"region\":\"us-west-1\"}"
  }'

# 3. Delete credential
curl -X DELETE http://localhost:8000/api/v1/system/voice-ai/credentials/<provider_id> \
  -H "Authorization: Bearer <admin_token>"

# 4. Test credential
curl -X POST http://localhost:8000/api/v1/system/voice-ai/credentials/<provider_id>/test \
  -H "Authorization: Bearer <admin_token>"

# Expected response (success):
# { "success": true, "message": "Connection successful" }
# OR (failure):
# { "success": false, "message": "Authentication failed: Invalid API key" }
```

**Verification Checklist**:
- [ ] GET returns masked keys only (never plain text)
- [ ] PUT accepts api_key and additional_config
- [ ] PUT returns masked_api_key in response
- [ ] DELETE removes credential
- [ ] POST /test validates without exposing key
- [ ] 401/403 for non-admin users
- [ ] 404 if provider not found
- [ ] If ANY mismatch: STOP and ask human

---

## 🏗️ Implementation Structure

### File Structure

```
admin/voice-ai/
├── credentials/
│   └── page.tsx                    # Main credentials page
```

### Component Structure

```
voice-ai/admin/
├── credentials/
│   ├── CredentialsList.tsx         # Credentials table
│   ├── CredentialForm.tsx          # Add/update credential form
│   ├── TestConnectionButton.tsx    # Test credential button
│   └── DeleteCredentialModal.tsx   # Confirmation modal
```

---

## 📦 Data Model (voice_ai_credentials)

```typescript
interface VoiceAICredential {
  id: string;                        // UUID
  provider_id: string;               // FK to provider
  masked_api_key: string;            // Display only (e.g., "sk-p...xyz")
  additional_config: string | null;  // JSON object as string
  created_at: Date;
  updated_at: Date;
  updated_by: string;                // User ID who last updated
}
```

**Plain API Key**:
- Only exposed during creation/update (frontend input)
- NEVER returned by backend (encrypted immediately)
- NEVER stored in frontend state after submission

---

## 🎨 UI Components

- **Button** - Save, test, delete actions
- **Input** - Password input for API key (type="password")
- **Textarea** - additional_config (JSON editor)
- **Modal** - Delete confirmation, test results
- **Badge** - Provider type, status
- **LoadingSpinner** - Loading states
- **Card** - Credential display
- **Table** - Credentials list

---

## 🔐 RBAC Implementation

```typescript
import { ProtectedRoute } from '@/components/rbac/shared/ProtectedRoute';

export default function CredentialsPage() {
  return (
    <ProtectedRoute requiredPermission="platform_admin">
      {/* Page content */}
    </ProtectedRoute>
  );
}
```

---

## 📋 Implementation Tasks

### 1. Credentials List Page (`credentials/page.tsx`)

**Features**:
- [ ] Display all providers with credential status
- [ ] Show which providers have credentials (has_credentials: true/false)
- [ ] Show masked API keys for providers with credentials
- [ ] "Add Credential" button for providers without credentials
- [ ] "Update Credential" button for providers with credentials
- [ ] "Test Connection" button (with loading state)
- [ ] "Delete Credential" button
- [ ] Loading spinner while fetching
- [ ] Error modal if fetch fails

**Table Columns**:
| Provider | Type | Display Name | Credential Status | Masked Key | Actions |
|----------|------|--------------|-------------------|------------|---------|
| deepgram | STT | Deepgram | ✅ Set | sk-p...xyz | [Test] [Update] [Delete] |
| openai | LLM | OpenAI | ❌ Not Set | - | [Add Credential] |

**API Integration**:

```typescript
// Fetch all credentials
const fetchCredentials = async () => {
  const response = await fetch('/api/v1/system/voice-ai/credentials', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error('Failed to fetch credentials');
  return response.json();
};

// You'll also need to fetch providers to show which ones don't have credentials
const fetchProviders = async () => {
  const response = await fetch('/api/v1/system/voice-ai/providers', {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) throw new Error('Failed to fetch providers');
  return response.json();
};

// Merge providers with credentials to show status
const mergedData = providers.map(provider => {
  const credential = credentials.find(c => c.provider_id === provider.id);
  return {
    ...provider,
    has_credential: !!credential,
    masked_api_key: credential?.masked_api_key || null,
    credential_id: credential?.id || null,
  };
});
```

---

### 2. Credential Form Component (`CredentialForm.tsx`)

**Form Fields**:

#### Required Fields
- [ ] **api_key** (Input, type="password", min 10 chars)
  - Label: "API Key"
  - Placeholder: "Enter provider API key"
  - Helper: "This will be encrypted before storage. Never shared or displayed after saving."
  - Toggle visibility button (eye icon)

#### Optional Fields
- [ ] **additional_config** (Textarea or JSON editor)
  - Label: "Additional Configuration (JSON)"
  - Placeholder: `{"region":"us-west-1","model":"whisper-1"}`
  - Validation: Must be valid JSON string

**Validation** (Zod):

```typescript
import { z } from 'zod';

const credentialFormSchema = z.object({
  api_key: z.string().min(10, 'API key must be at least 10 characters'),
  additional_config: z.string().optional().nullable().refine(
    (val) => !val || isValidJSON(val),
    'Must be valid JSON'
  ),
});
```

**Form Submission**:

```typescript
const onSubmit = async (data: FormData) => {
  setSubmitting(true);
  try {
    const response = await fetch(`/api/v1/system/voice-ai/credentials/${providerId}`, {
      method: 'PUT', // Always PUT (upsert)
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to save credential');
    }

    const result = await response.json();
    // Show success modal with masked key
    // Clear form (security - don't keep plain key in memory)
  } catch (error) {
    // Show error modal
  } finally {
    setSubmitting(false);
  }
};
```

**SECURITY**: After successful submission, clear the API key input immediately. Do not store plain key in state.

---

### 3. Test Connection Button

**Features**:
- [ ] Button with loading state
- [ ] Calls POST /test endpoint
- [ ] Shows success modal with provider name on success
- [ ] Shows error modal with error message on failure
- [ ] Disabled if no credential exists

**Test Logic**:

```typescript
const handleTestConnection = async (providerId: string) => {
  setTesting(true);
  try {
    const response = await fetch(
      `/api/v1/system/voice-ai/credentials/${providerId}/test`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    const result = await response.json();

    if (result.success) {
      // Show success modal
      setTestResult({ success: true, message: result.message });
    } else {
      // Show error modal
      setTestResult({ success: false, message: result.message });
    }
  } catch (error) {
    setTestResult({
      success: false,
      message: 'Connection test failed: ' + error.message
    });
  } finally {
    setTesting(false);
  }
};
```

---

### 4. Delete Credential Modal

**Features**:
- [ ] Confirmation message
- [ ] Display provider name
- [ ] Warning: "This will remove the stored API key. The provider will no longer be usable."
- [ ] Cancel button
- [ ] Delete button (red/danger variant)
- [ ] Loading state on delete button

**Delete Logic**:

```typescript
const handleDelete = async (providerId: string) => {
  setDeleting(true);
  try {
    const response = await fetch(
      `/api/v1/system/voice-ai/credentials/${providerId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to delete credential');
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

### Credentials Table Layout

```
Provider Credentials
────────────────────────────────────────────────────────────────────

[Search providers...]                          [Refresh]

┌────────────────────────────────────────────────────────────────┐
│ Provider     │ Type │ Name      │ Status    │ Masked Key    │   │
├────────────────────────────────────────────────────────────────┤
│ deepgram     │ STT  │ Deepgram  │ ✅ Set    │ dg_t...2345   │ [Test] [Update] [Delete] │
│ openai       │ LLM  │ OpenAI    │ ❌ Not Set │ -             │ [Add Credential]          │
│ cartesia     │ TTS  │ Cartesia  │ ✅ Set    │ ****Kg7X      │ [Test] [Update] [Delete] │
└────────────────────────────────────────────────────────────────┘
```

### Add/Update Credential Modal

```
Add Credential for Deepgram (STT)
──────────────────────────────────────────────

API Key *
[●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●] [👁]

⚠️ This will be encrypted before storage. Never shared or displayed.

Additional Configuration (Optional)
{"region":"us-west-1","model":"whisper-1"}
[_______________________________________________]
[_______________________________________________]

                                [Cancel] [Save Credential]
```

### Test Connection Modal (Success)

```
Connection Successful ✅
───────────────────────────────────

Deepgram API key is valid and working.

                                [Close]
```

### Test Connection Modal (Error)

```
Connection Failed ❌
───────────────────────────────────

Authentication failed: Invalid API key

Please check your API key and try again.

                                [Close]
```

---

## ⚠️ Error Handling

### Error Scenarios

1. **Fetch Errors**
   - Network failure
   - 401/403 Unauthorized
   - Display error modal with retry

2. **Validation Errors** (400)
   - "api_key must be longer than or equal to 10 characters"
   - Display below API key input

3. **Not Found** (404)
   - "Provider not found"
   - Display error modal

4. **Test Connection Failures**
   - Invalid API key
   - Network error to provider
   - Provider API down
   - Display result in modal

---

## 🧪 Testing Checklist

### Functionality
- [ ] Can list all providers with credential status
- [ ] Can add credential to provider without one
- [ ] Can update existing credential
- [ ] Can delete credential
- [ ] Test connection succeeds for valid key
- [ ] Test connection fails for invalid key
- [ ] API key input is masked (type="password")
- [ ] Toggle visibility works (eye icon)
- [ ] additional_config validates JSON
- [ ] Invalid JSON shows error

### Security
- [ ] Plain API keys never displayed after save
- [ ] Only masked keys shown in table
- [ ] API key cleared from form after submit
- [ ] No plain keys in browser console/network tab (except during submit)

### UI/UX
- [ ] Loading spinner while fetching
- [ ] Loading state on buttons (test, save, delete)
- [ ] Success modal on save
- [ ] Error modal on failure
- [ ] Test result modal shows
- [ ] Delete confirmation shows

### RBAC
- [ ] Platform admin can access
- [ ] Non-admin users get 403

### Mobile
- [ ] Table responsive on mobile
- [ ] Form works on mobile
- [ ] Modals work on mobile

### Dark Mode
- [ ] All components support dark mode

---

## 🚨 Common Pitfalls

1. **DO NOT display plain API keys** - Only masked versions
2. **DO NOT store plain keys in state** - Clear after submit
3. **DO NOT skip test connection** - Critical for validating credentials
4. **DO NOT edit backend** - If issues, ask human
5. **DO NOT skip endpoint verification** - Test first
6. **DO NOT forget error handling** - All scenarios
7. **DO NOT skip RBAC** - Platform admin only
8. **DO NOT use pm2** - Ask human for server

---

## ✅ Acceptance Criteria

- ✅ Endpoints verified and match documentation
- ✅ Credentials list shows all providers with status
- ✅ Add credential works (password input, encrypted)
- ✅ Update credential works
- ✅ Delete credential works with confirmation
- ✅ Test connection works (success/failure modals)
- ✅ Only masked keys displayed (NEVER plain text)
- ✅ All error scenarios handled
- ✅ RBAC protection works
- ✅ Mobile responsive
- ✅ Dark mode supported
- ✅ Security requirements met
- ✅ Code reviewed

---

**SECURITY REMINDER**: This sprint handles sensitive API keys. Never log, display, or store plain keys in frontend. Always use masked versions for display.

**If you find backend issues or API mismatches: STOP and ASK HUMAN. DO NOT edit backend code.**

---

**End of Sprint 2**
