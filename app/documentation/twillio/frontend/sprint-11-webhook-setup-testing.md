# Sprint 11: Webhook Setup, Display & End-to-End Testing

**Developer**: Developer 11
**Dependencies**: Sprint 1-10 (all features complete)
**Duration**: 1 sprint

---

## 🎯 Sprint Goal

Implement webhook URL display component, test end-to-end webhook routing from Twilio to backend, and verify tenant isolation in webhook handlers. **Learn from existing email webhook patterns** to ensure consistency.

---

## 📋 Test Credentials

- **API Base URL**: `http://localhost:8000/api/v1`
- **Test Email**: `contact@honeydo4you.com`
- **Test Password**: `978@F32c`
- **Test Twilio Account**: (Use real Twilio credentials for testing)

---

## 🔍 FIRST: Study Existing Email Webhook Patterns

**CRITICAL**: Before implementing anything, understand how email webhooks/routes already work.

### Research Tasks:

1. **Find existing email webhook implementation**:
   - Search codebase for email webhook routes
   - Check: `/app/src/app/(dashboard)/communications/` for email webhook URL display
   - Look for: How is tenant subdomain obtained?
   - Look for: How are webhook URLs displayed to users?

2. **Backend webhook routing**:
   - Check: `/api/src/modules/communication/` for webhook handlers
   - Understand: How does tenant resolution work in webhook handlers?
   - Verify: Is tenant extracted from subdomain? From request headers? From URL path?

3. **Document findings**:
   - How is `tenant_subdomain` obtained in frontend?
   - From API response? From user context? From `window.location`?
   - What API endpoint returns tenant subdomain (if any)?
   - How do email webhooks handle tenant routing?

**Test existing email webhooks**:
```bash
# Find how email provider webhooks are configured
# Check if there's a GET endpoint that returns webhook URLs
# Example: GET /api/v1/communication/providers/:id/webhooks
```

---

## 📚 Backend Webhook Endpoints (Reference)

These webhook handlers exist in backend (called BY Twilio, not by frontend):

```
POST /api/twilio/sms/inbound          - SMS message received
POST /api/twilio/call/inbound         - Inbound call
POST /api/twilio/call/status          - Call status update
POST /api/twilio/recording/ready      - Recording available
POST /api/twilio/ivr/input            - IVR digit pressed
```

**Question to Answer**: How does backend know which tenant the webhook is for?
- Option A: Subdomain in URL (e.g., `https://acme.lead360.app/api/twilio/sms/inbound`)
- Option B: Custom header
- Option C: Query parameter
- Option D: Tenant phone number lookup

**Study the backend code or test with curl to understand this!**

---

## 🔑 Critical: Get Tenant Subdomain from API

**DO NOT hardcode or extract from `window.location`** - Get from API/user context.

### Option 1: From User Auth Context

If user object includes tenant subdomain:
```typescript
const { user } = useAuth();
const subdomain = user.tenant?.subdomain; // From API
```

### Option 2: From Dedicated API Endpoint

Check if this endpoint exists (or similar):
```bash
GET /api/v1/tenant/current
GET /api/v1/tenant/me
GET /api/v1/auth/me
```

Response might include:
```json
{
  "tenant": {
    "id": "uuid",
    "name": "Acme Corp",
    "subdomain": "acme",  // <-- This is what we need
    "domain": "acme.lead360.app"
  }
}
```

### Task: Find or Request Endpoint

**If endpoint doesn't exist**, you may need to:
1. Check existing user/auth endpoints for tenant data
2. Request backend team to add `subdomain` to user response
3. Document what you found and what's needed

**Test**:
```bash
TOKEN="your_jwt_token"
curl -X GET "http://localhost:8000/api/v1/auth/me" \
  -H "Authorization: Bearer $TOKEN" | jq '.tenant.subdomain'
```

---

## 🏗️ Required Implementation

### Component: `/app/src/components/twilio/WebhookSetupCard.tsx`

**Purpose**: Display webhook URLs and Twilio configuration instructions

**Props**:
```typescript
interface WebhookSetupCardProps {
  type: 'sms' | 'whatsapp' | 'calls' | 'ivr' | 'all';
  phoneNumber?: string; // Show which phone number to configure
  tenantSubdomain: string; // From API, NOT hardcoded
}
```

**Features**:
1. **Webhook URLs Section**:
   - Generate URLs based on `tenantSubdomain` prop
   - Each URL with copy button (clipboard API)
   - Success feedback on copy ("Copied!")

2. **Twilio Console Instructions**:
   - Collapsible accordion (expanded by default)
   - Step-by-step guide with screenshots (optional)
   - Specific to webhook type (SMS vs Calls vs WhatsApp)

3. **Testing Section**:
   - "Test Webhook" button (sends test request to verify routing)
   - Shows last webhook received timestamp (if available from API)
   - Webhook event log (recent 5 events)

**Webhook URLs Generated**:
```typescript
const webhookUrls = {
  smsInbound: `https://${tenantSubdomain}.lead360.app/api/twilio/sms/inbound`,
  callInbound: `https://${tenantSubdomain}.lead360.app/api/twilio/call/inbound`,
  callStatus: `https://${tenantSubdomain}.lead360.app/api/twilio/call/status`,
  recordingReady: `https://${tenantSubdomain}.lead360.app/api/twilio/recording/ready`,
  ivrInput: `https://${tenantSubdomain}.lead360.app/api/twilio/ivr/input`,
};
```

**Visual Design**:
- Card with blue info background
- Icon: Link or webhook symbol
- URLs in monospace code blocks
- Copy buttons with hover state
- Collapsible sections for detailed instructions

---

## 📄 Add Component to Existing Pages

### 1. SMS Configuration Page
**File**: `/app/src/app/(dashboard)/communications/twilio/sms/page.tsx`

**Add after config card**:
```typescript
{config && (
  <WebhookSetupCard
    type="sms"
    phoneNumber={config.from_phone}
    tenantSubdomain={tenantSubdomain} // From API/context
  />
)}
```

### 2. WhatsApp Configuration Page
**File**: `/app/src/app/(dashboard)/communications/twilio/whatsapp/page.tsx`

**Same pattern as SMS**

### 3. Dashboard Overview Page
**File**: `/app/src/app/(dashboard)/communications/twilio/page.tsx`

**Add consolidated webhook section**:
```typescript
{(smsConfig || whatsappConfig || ivrConfig) && (
  <WebhookSetupCard
    type="all"
    tenantSubdomain={tenantSubdomain}
  />
)}
```

---

## 🧪 End-to-End Testing Protocol

**CRITICAL**: Test the complete webhook flow, not just URL display.

### Test 1: SMS Webhook Flow

1. **Setup**:
   - Create SMS config in Lead360
   - Get webhook URL from UI
   - Copy SMS inbound URL
   - Log in to Twilio Console
   - Configure webhook on phone number

2. **Test Inbound SMS**:
   - Send SMS to Twilio number from your phone
   - Verify webhook is called (check backend logs)
   - Verify tenant is resolved correctly (check which tenant received it)
   - Verify SMS appears in communication history (if implemented)
   - Verify lead matching/creation works

3. **Verify**:
   ```bash
   # Check backend logs for webhook hit
   tail -f /var/www/lead360.app/logs/api_access.log | grep "twilio/sms/inbound"

   # Should show:
   # POST /api/twilio/sms/inbound - 200 OK
   # With correct tenant context
   ```

### Test 2: Call Webhook Flow

1. **Setup**:
   - Get call webhook URLs from UI
   - Configure in Twilio Console:
     - Call Inbound webhook
     - Call Status webhook
     - Recording Ready webhook

2. **Test Inbound Call**:
   - Call Twilio number from your phone
   - Verify call webhook hit
   - Verify tenant resolved correctly
   - Verify call record created
   - Verify IVR plays (if configured)
   - Answer call, speak for 30 seconds, hang up
   - Wait for recording webhook
   - Verify recording saved to correct tenant

3. **Verify**:
   - Check call appears in call history (Sprint 4 page)
   - Check recording is playable
   - Check transcription queued (if enabled)

### Test 3: WhatsApp Webhook Flow

1. **Setup**:
   - Configure WhatsApp webhook
   - Send WhatsApp message to Twilio number

2. **Verify**:
   - Webhook hit
   - Tenant resolved
   - Message recorded

### Test 4: Multi-Tenant Isolation

**CRITICAL TEST**: Verify tenant isolation in webhooks

1. **Setup Two Tenants**:
   - Tenant A: `acme.lead360.app`
   - Tenant B: `honeydo4you.lead360.app`

2. **Send SMS to Tenant A's number**:
   - Verify: SMS only appears in Tenant A's account
   - Verify: SMS does NOT appear in Tenant B's account

3. **Send SMS to Tenant B's number**:
   - Verify: SMS only appears in Tenant B's account
   - Verify: SMS does NOT appear in Tenant A's account

**If cross-tenant data leaks, this is a CRITICAL security issue - STOP and report!**

---

## 🔍 Webhook Event Log (Optional Enhancement)

**If backend supports it**, add webhook event log display:

### Check for API Endpoint:
```bash
GET /api/v1/communication/twilio/webhook-events?page=1&limit=10
```

**If exists**, display recent webhook events:
- Timestamp
- Event type (sms.inbound, call.status, etc.)
- Status (success, failed)
- Twilio SID
- Error message (if failed)

This helps users debug webhook issues.

---

## ✅ Sprint 11 Completion Checklist

### Research & Understanding
- [ ] Studied existing email webhook patterns
- [ ] Understand how tenant subdomain is obtained (API endpoint documented)
- [ ] Understand how backend resolves tenant in webhooks
- [ ] Documented tenant routing mechanism

### API Integration
- [ ] Found or requested endpoint for tenant subdomain
- [ ] Tested endpoint returns correct subdomain
- [ ] Verified subdomain NOT hardcoded or extracted from URL
- [ ] All webhook URLs use subdomain from API/context

### Component Implementation
- [ ] WebhookSetupCard component created
- [ ] Copy buttons work (clipboard API)
- [ ] URLs generated correctly with tenant subdomain
- [ ] Twilio console instructions clear and accurate
- [ ] Collapsible sections work
- [ ] Mobile responsive
- [ ] Dark mode compatible

### Page Integration
- [ ] Added to SMS configuration page
- [ ] Added to WhatsApp configuration page
- [ ] Added to dashboard overview page
- [ ] Shows only when config exists
- [ ] Subdomain passed from user/tenant context

### End-to-End Testing
- [ ] SMS webhook flow tested (send SMS → verify received)
- [ ] Call webhook flow tested (make call → verify recorded)
- [ ] Recording webhook tested (call → recording saved)
- [ ] WhatsApp webhook tested (if available)
- [ ] Multi-tenant isolation verified (CRITICAL)
- [ ] Cross-tenant leak test PASSED

### Documentation
- [ ] Documented how tenant subdomain is obtained
- [ ] Documented tenant routing mechanism
- [ ] Documented any backend changes needed
- [ ] Created troubleshooting guide for common webhook issues

---

## 📤 Deliverables

1. **WebhookSetupCard component** with copy buttons and instructions
2. **Integration** into SMS, WhatsApp, and dashboard pages
3. **End-to-end test report** showing all webhook flows working
4. **Multi-tenant isolation verification** report
5. **Documentation** of tenant subdomain source and routing mechanism
6. **Troubleshooting guide** for webhook configuration issues

---

## 🚦 After Sprint 11

**Project is 100% complete**:
- ✅ All 22 API endpoints integrated
- ✅ All 7 pages functional
- ✅ Webhooks configured and tested
- ✅ Multi-tenant isolation verified
- ✅ Production-ready

---

## ⚠️ Critical Requirements

1. **Tenant Subdomain Source**: MUST come from API, NOT hardcoded or extracted from URL
2. **Multi-Tenant Testing**: MUST verify webhooks route to correct tenant
3. **Security**: MUST test cross-tenant isolation (no data leaks)
4. **Backend Coordination**: If tenant routing doesn't work, backend changes may be needed
5. **Real Testing**: Use real Twilio account and send real SMS/calls
6. **Document Findings**: Document how tenant routing works for future reference

---

## 🐛 Common Issues to Check

### Issue 1: Tenant Not Resolved in Webhook
**Symptom**: Webhook returns 400/404, logs show "tenant not found"
**Debug**: Check how backend extracts tenant from webhook request
**Solution**: Ensure subdomain routing configured correctly in Nginx

### Issue 2: Cross-Tenant Data Leak
**Symptom**: SMS sent to Tenant A appears in Tenant B
**Debug**: Check tenant_id filtering in webhook handler
**Solution**: STOP - report critical security issue

### Issue 3: Recording Not Saved
**Symptom**: Call completes but recording webhook not received
**Debug**: Check Twilio Console webhook configuration
**Solution**: Verify "Recording Status Callback" URL configured

### Issue 4: Subdomain Wrong/Missing
**Symptom**: Webhook URLs show wrong subdomain
**Debug**: Check where subdomain comes from (API response?)
**Solution**: Verify API endpoint returns correct tenant.subdomain

---

**Sprint 11 Status**: Ready to Start (after Sprint 10 complete)
**Estimated Duration**: 1 week (includes extensive testing)
**Critical**: This sprint validates the entire Twilio integration works end-to-end
