# Sprint 3: WhatsApp Configuration Management

**Developer**: Developer 3
**Dependencies**: Sprint 1 (API client, types), Sprint 2 (SMS patterns to reuse)
**Duration**: 1 sprint

---

## 🎯 Sprint Goal

Implement full CRUD functionality for WhatsApp provider configuration, nearly identical to Sprint 2 but with WhatsApp-specific considerations:
- View active WhatsApp configuration
- Create new WhatsApp configuration with Twilio credentials
- Edit existing WhatsApp configuration
- Deactivate WhatsApp configuration
- Test WhatsApp configuration (send test message)
- Handle `whatsapp:` prefix automatically
- RBAC enforcement (Owner/Admin only for CRUD)

---

## 📋 Prerequisites

### Test Credentials
- **API Base URL**: `http://localhost:8000/api/v1`
- **Test Email**: `contact@honeydo4you.com`
- **Test Password**: `978@F32c`

### Required Files
- Sprint 1: `/app/src/lib/api/twilio-tenant.ts`, `/app/src/lib/types/twilio-tenant.ts`
- Sprint 2: Review SMS implementation for patterns to reuse

### Required Reading
1. **Backend API Documentation**: Read WhatsApp Configuration section (lines 459-732)
2. **Sprint 2 Documentation**: This sprint follows the EXACT same pattern as Sprint 2
3. **WhatsApp-Specific Notes**:
   - Phone numbers automatically prefixed with `whatsapp:` by backend
   - Requires approved WhatsApp Business Account with Twilio
   - First messages to new contacts may require template approval

---

## 🔑 Key Differences from SMS

| Aspect | SMS | WhatsApp |
|--------|-----|----------|
| Phone Format | `+19781234567` | `whatsapp:+19781234567` |
| Provider Type | `twilio_sms` | `twilio_whatsapp` |
| Special Requirements | None | Requires WhatsApp Business Account approval |
| Test Message | Plain SMS | WhatsApp message (may require template) |

**Important**: The `whatsapp:` prefix is added automatically by the backend if not present in the request. Your UI should accept both formats but display with the prefix.

---

## 🏗️ Tasks

### Task 1: Test WhatsApp API Endpoints (CRITICAL FIRST STEP)

```bash
# 1. Login to get token
TOKEN=$(curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | jq -r '.access_token')

# 2. Get WhatsApp config (expect 404 if none exists)
curl -X GET "http://localhost:8000/api/v1/communication/twilio/whatsapp-config" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# Expected Response (if config exists):
# {
#   "id": "uuid",
#   "tenant_id": "uuid",
#   "provider_id": "uuid",
#   "from_phone": "whatsapp:+19781234567",  <-- Note the whatsapp: prefix
#   "is_active": true,
#   "is_verified": true,
#   "created_at": "2026-02-05T10:00:00.000Z",
#   "updated_at": "2026-02-05T10:00:00.000Z"
# }

# Expected Response (if no config):
# {
#   "statusCode": 404,
#   "message": "No active WhatsApp configuration found for this tenant",
#   "error": "Not Found"
# }

# 3. Get provider_id for Twilio WhatsApp
curl -X GET "http://localhost:8000/api/v1/communication/providers" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.[] | select(.name == "Twilio WhatsApp")'

# 4. Create WhatsApp config (ONLY if you have real Twilio WhatsApp credentials)
curl -X POST "http://localhost:8000/api/v1/communication/twilio/whatsapp-config" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "PROVIDER_ID_FROM_STEP_3",
    "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "auth_token": "your_real_auth_token_here",
    "from_phone": "+19781234567"
  }' \
  | jq '.'

# ⚠️ Note: Backend will automatically add "whatsapp:" prefix to from_phone

# 5. Test WhatsApp config (sends actual test WhatsApp message)
curl -X POST "http://localhost:8000/api/v1/communication/twilio/whatsapp-config/CONFIG_ID/test" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# Expected Response:
# {
#   "success": true,
#   "message": "Test WhatsApp message sent successfully",
#   "twilio_message_sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
#   "from": "whatsapp:+19781234567",
#   "to": "whatsapp:+19781234567"
# }

# 6. Update WhatsApp config
curl -X PATCH "http://localhost:8000/api/v1/communication/twilio/whatsapp-config/CONFIG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"from_phone": "+19781234568"}' \
  | jq '.'

# 7. Deactivate WhatsApp config
curl -X DELETE "http://localhost:8000/api/v1/communication/twilio/whatsapp-config/CONFIG_ID" \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'
```

**⚠️ MANDATORY**: Document test results. If ANY response doesn't match documentation, STOP and report.

---

### Task 2: Create WhatsApp Configuration Page

**File**: `/app/src/app/(dashboard)/communications/twilio/whatsapp/page.tsx`

**⚡ REUSE PATTERN**: This is almost identical to SMS page from Sprint 2. Copy the SMS page and make these changes:

1. Replace "SMS" with "WhatsApp" in all text
2. Update API calls:
   - `getActiveSMSConfig()` → `getActiveWhatsAppConfig()`
   - `deactivateSMSConfig()` → `deactivateWhatsAppConfig()`
   - `testSMSConfig()` → `testWhatsAppConfig()`
3. Update modal imports:
   - `CreateSMSConfigModal` → `CreateWhatsAppConfigModal`
   - `EditSMSConfigModal` → `EditWhatsAppConfigModal`
4. Update type:
   - `SMSConfig` → `WhatsAppConfig`
5. Add WhatsApp-specific notice about Business Account requirement

**Changes from SMS Page**:
```typescript
// Add this notice after the configuration card:
<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
  <div className="flex gap-3">
    <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
    <div>
      <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100">
        WhatsApp Business Account Required
      </h4>
      <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
        WhatsApp messaging requires an approved WhatsApp Business Account with Twilio.
        First messages to new contacts may require pre-approved message templates.
      </p>
    </div>
  </div>
</div>
```

---

### Task 3: Create WhatsApp Configuration Modal

**File**: `/app/src/components/twilio/modals/CreateWhatsAppConfigModal.tsx`

**⚡ REUSE PATTERN**: Copy Sprint 2's `CreateSMSConfigModal.tsx` and make these changes:

1. Replace all "SMS" with "WhatsApp"
2. Update API call: `createSMSConfig()` → `createWhatsAppConfig()`
3. Update types: `CreateSMSConfigRequest` → `CreateWhatsAppConfigRequest`
4. Update provider lookup to find "Twilio WhatsApp" instead of "Twilio SMS"
5. Add note about `whatsapp:` prefix being added automatically
6. Add WhatsApp Business Account requirement notice

**Additional Help Text**:
```typescript
<PhoneInput
  label="WhatsApp-Enabled Phone Number"
  value={formData.from_phone}
  onChange={(value) => setFormData({ ...formData, from_phone: value })}
  error={errors.from_phone}
  required
  helpText="Your Twilio WhatsApp-enabled phone number (e.g., +19781234567). The 'whatsapp:' prefix will be added automatically."
/>
```

**Additional Notice**:
```typescript
<div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
  <p className="text-xs text-blue-800 dark:text-blue-200">
    <strong>Requirements:</strong> This phone number must be associated with an approved WhatsApp Business Account in your Twilio account.
  </p>
</div>
```

---

### Task 4: Create Edit WhatsApp Configuration Modal

**File**: `/app/src/components/twilio/modals/EditWhatsAppConfigModal.tsx`

**⚡ REUSE PATTERN**: Copy Sprint 2's `EditSMSConfigModal.tsx` and make these changes:

1. Replace all "SMS" with "WhatsApp"
2. Update API call: `updateSMSConfig()` → `updateWhatsAppConfig()`
3. Update types:
   - `SMSConfig` → `WhatsAppConfig`
   - `UpdateSMSConfigRequest` → `UpdateWhatsAppConfigRequest`
4. Handle `whatsapp:` prefix in phone number display

---

### Task 5: Add WhatsApp-Specific Error Handling

WhatsApp has a specific error response when test fails. Add this error handling in the test function:

```typescript
const handleTest = async () => {
  if (!config) return;

  try {
    setTesting(true);
    const result = await testWhatsAppConfig(config.id);
    toast.success(result.message);
  } catch (error: any) {
    const message = error.response?.data?.message || 'Failed to send test WhatsApp message';
    const hint = error.response?.data?.hint;

    if (hint) {
      toast.error(`${message}\n\n${hint}`, { duration: 5000 });
    } else {
      toast.error(message);
    }
  } finally {
    setTesting(false);
  }
};
```

Expected error response from backend:
```json
{
  "statusCode": 400,
  "message": "WhatsApp test failed: Unable to create record",
  "error": "TWILIO_ERROR",
  "hint": "Ensure your Twilio WhatsApp Business Account is approved and the phone number is configured correctly."
}
```

---

## ✅ Sprint 3 Completion Checklist

### API Testing
- [ ] All 5 WhatsApp endpoints tested with curl
- [ ] Request/response structures verified
- [ ] `whatsapp:` prefix confirmed in responses
- [ ] Error responses tested (404, 400, 409, 403)
- [ ] RBAC tested
- [ ] Any discrepancies documented and reported

### Page Implementation
- [ ] WhatsApp configuration page displays correctly
- [ ] All states work (loading, empty, configured)
- [ ] Phone numbers display with `whatsapp:` prefix
- [ ] WhatsApp Business Account notice displays
- [ ] Status badges display correctly

### Create Modal
- [ ] Modal works correctly
- [ ] Form validation works
- [ ] Phone number accepts input without `whatsapp:` prefix
- [ ] Submit creates configuration successfully
- [ ] Business Account notice displays
- [ ] Error handling works (specific to WhatsApp)

### Edit Modal
- [ ] Modal pre-fills correctly (with `whatsapp:` prefix in phone)
- [ ] Partial update works
- [ ] Success callback refreshes page

### Test Feature
- [ ] "Send Test WhatsApp" button only shows for active configs
- [ ] Test sends actual WhatsApp message (if real credentials)
- [ ] Error shows hint text for WhatsApp-specific issues
- [ ] Success toast shows Twilio Message SID

### Deactivate Feature
- [ ] Confirmation modal shows
- [ ] Deactivation works
- [ ] Page refreshes

### RBAC
- [ ] Edit/Create/Delete buttons hidden for non-Owner/Admin
- [ ] API enforces permissions

### Mobile & Dark Mode
- [ ] Responsive on 375px viewport
- [ ] Dark mode works correctly

---

## 📤 Deliverables

1. **WhatsApp Configuration Page**: `/app/src/app/(dashboard)/communications/twilio/whatsapp/page.tsx`
2. **Create Modal**: `/app/src/components/twilio/modals/CreateWhatsAppConfigModal.tsx`
3. **Edit Modal**: `/app/src/components/twilio/modals/EditWhatsAppConfigModal.tsx`
4. **API Testing Report**: Document showing all endpoints tested

---

## 🚦 Next Sprint

**Sprint 4: Call History & Playback**
- Different pattern (list view with pagination, not single config)
- Recording playback functionality
- Filters and search

---

## ⚠️ Critical Reminders

1. **Test API FIRST**: Verify all endpoints before UI coding
2. **WhatsApp prefix**: Backend adds it automatically, display it in UI
3. **Business Account**: Remind users about WhatsApp Business Account requirement
4. **Reuse Sprint 2**: 90% of code is identical to SMS, copy and modify
5. **Error hints**: WhatsApp errors include helpful hint text, display it

---

**Sprint 3 Status**: Ready to Start (after Sprint 1-2 complete)
**Estimated Duration**: 1 week (faster than Sprint 2 due to code reuse)
**Blockers**: Sprint 1-2 must be complete
