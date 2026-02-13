# 🚨 CRITICAL: Webhook Setup Instructions (MUST ADD)

**Status**: Missing from current sprint plan
**Priority**: HIGH - Without this, Twilio won't work!

---

## The Problem

After all 10 sprints complete, users will configure SMS/WhatsApp/Calls but **won't know the webhook URLs** to configure in their Twilio account.

**Without webhooks configured in Twilio**:
- ❌ Inbound SMS won't arrive
- ❌ Inbound calls won't route
- ❌ Call recordings won't save
- ❌ WhatsApp messages won't arrive
- ❌ IVR won't work

**This is a blocker for production use!**

---

## The Webhook URLs

Users need these URLs to configure in their Twilio account:

```
SMS Inbound:       https://{subdomain}.lead360.app/api/twilio/sms/inbound
Call Inbound:      https://{subdomain}.lead360.app/api/twilio/call/inbound
Call Status:       https://{subdomain}.lead360.app/api/twilio/call/status
Recording Ready:   https://{subdomain}.lead360.app/api/twilio/recording/ready
IVR Input:         https://{subdomain}.lead360.app/api/twilio/ivr/input
WhatsApp Inbound:  https://{subdomain}.lead360.app/api/twilio/sms/inbound (same as SMS)
```

Where `{subdomain}` = tenant's subdomain (e.g., `acme`, `honeydo4you`)

---

## Solution: Add WebhookInstructions Component

### Component: `/app/src/components/twilio/WebhookInstructions.tsx`

**Purpose**: Reusable component showing webhook URLs + setup instructions

**Props**:
```typescript
interface WebhookInstructionsProps {
  provider: 'SMS' | 'WhatsApp' | 'Calls';
  webhookUrls: {
    smsInbound?: string;
    callInbound?: string;
    callStatus?: string;
    recordingReady?: string;
    ivrInput?: string;
  };
}
```

**UI Layout**:

1. **Collapsible Card** (accordion):
   - Header: "📋 Twilio Webhook Setup Required"
   - Subtitle: "Configure these URLs in your Twilio account to receive inbound messages/calls"
   - Expand/collapse button

2. **Webhook URLs Section**:
   - Each URL in a code box (monospace font)
   - Copy button next to each URL (with success feedback)
   - Visual indicator when copied

3. **Setup Instructions** (step-by-step):

   **For SMS/WhatsApp**:
   ```
   Step 1: Log in to your Twilio Console (console.twilio.com)
   Step 2: Navigate to Phone Numbers → Active Numbers
   Step 3: Click on your phone number ({from_phone from config})
   Step 4: Scroll to "Messaging" section
   Step 5: Set "A MESSAGE COMES IN" to:
           - Webhook
           - URL: {smsInbound webhook URL}
           - HTTP POST
   Step 6: Click "Save"
   ```

   **For Calls**:
   ```
   Step 1: Log in to your Twilio Console
   Step 2: Navigate to Phone Numbers → Active Numbers
   Step 3: Click on your phone number ({from_phone from config})
   Step 4: Scroll to "Voice & Fax" section
   Step 5: Set "A CALL COMES IN" to:
           - Webhook
           - URL: {callInbound webhook URL}
           - HTTP POST
   Step 6: Set "CALL STATUS CHANGES" to:
           - Webhook
           - URL: {callStatus webhook URL}
           - HTTP POST
   Step 7: Click "Save"
   ```

   **For Call Recordings**:
   ```
   Step 1: In the same Voice & Fax section
   Step 2: Set "RECORDING STATUS CALLBACK" to:
           - URL: {recordingReady webhook URL}
           - HTTP POST
   ```

4. **Visual Design**:
   - Info card (blue background in light mode, dark blue in dark mode)
   - Icon: Link or webhook icon
   - Expandable by default on first visit (can use localStorage to remember state)
   - Print-friendly (for users who want to print instructions)

5. **Get Tenant Subdomain**:
   ```typescript
   const getTenantSubdomain = () => {
     // Option 1: From window location
     const hostname = window.location.hostname;
     const subdomain = hostname.split('.')[0];
     return subdomain;

     // Option 2: From user auth context (if available)
     // const { user } = useAuth();
     // return user.tenant.subdomain;
   };

   const subdomain = getTenantSubdomain();
   const webhookUrls = {
     smsInbound: `https://${subdomain}.lead360.app/api/twilio/sms/inbound`,
     callInbound: `https://${subdomain}.lead360.app/api/twilio/call/inbound`,
     // ... etc
   };
   ```

---

## Where to Add This Component

### Sprint 2 (SMS Configuration)
**Add to**: `/app/src/app/(dashboard)/communications/twilio/sms/page.tsx`

**Location**: After the SMS configuration card

**Show When**: Config exists (`config !== null`)

**Code**:
```typescript
{config && (
  <WebhookInstructions
    provider="SMS"
    webhookUrls={{
      smsInbound: `https://${subdomain}.lead360.app/api/twilio/sms/inbound`
    }}
  />
)}
```

### Sprint 3 (WhatsApp Configuration)
**Add to**: `/app/src/app/(dashboard)/communications/twilio/whatsapp/page.tsx`

**Same pattern as SMS**

### Sprint 4 (Call Configuration - if dedicated page exists)
Or add to Sprint 9 dashboard with all webhook URLs

### Sprint 9 (Dashboard Overview)
**Add consolidated webhook section** showing ALL webhook URLs in one place:

```typescript
<Card>
  <h3>Webhook Configuration</h3>
  <p>Configure these webhook URLs in your Twilio account</p>

  <WebhookInstructions
    provider="All"
    webhookUrls={{
      smsInbound: `https://${subdomain}.lead360.app/api/twilio/sms/inbound`,
      callInbound: `https://${subdomain}.lead360.app/api/twilio/call/inbound`,
      callStatus: `https://${subdomain}.lead360.app/api/twilio/call/status`,
      recordingReady: `https://${subdomain}.lead360.app/api/twilio/recording/ready`,
      ivrInput: `https://${subdomain}.lead360.app/api/twilio/ivr/input`
    }}
  />
</Card>
```

---

## Updated Sprint 2 Deliverables

Add to Sprint 2:
- [ ] Create `WebhookInstructions` component (reusable)
- [ ] Add webhook instructions to SMS config page
- [ ] Copy buttons work for URLs
- [ ] Instructions are clear and step-by-step
- [ ] Subdomain extraction works correctly
- [ ] Component is mobile responsive
- [ ] Print-friendly styling

**Reuse this component** in Sprint 3, 4 (or 9)

---

## Testing

**Verify**:
1. Webhook URLs show correct subdomain
2. Copy buttons copy to clipboard
3. Instructions match Twilio console UI
4. URLs are correct format
5. Component expands/collapses
6. Mobile responsive
7. Dark mode works
8. Can print instructions

**Manual Test**:
1. Create SMS config
2. See webhook instructions
3. Copy SMS inbound URL
4. Log in to Twilio console
5. Configure webhook
6. Send test SMS to Twilio number
7. Verify SMS arrives in Lead360

---

## Priority

**Add this to Sprint 2 immediately** - it's a critical blocker for production use.

Without this, users will:
1. Configure SMS/WhatsApp/Calls ✅
2. Test and see it doesn't work ❌
3. Not know why ❌
4. Contact support ❌
5. Frustration and low adoption ❌

**With this**:
1. Configure SMS/WhatsApp/Calls ✅
2. See webhook instructions ✅
3. Configure in Twilio ✅
4. Everything works ✅
5. Happy users ✅

---

## Example UI Mockup

```
┌─────────────────────────────────────────────────┐
│ SMS Configuration                               │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ 📱 Twilio SMS Provider                  │   │
│ │ Phone: +1 (978) 123-4567                │   │
│ │ Status: Active | Verified               │   │
│ └─────────────────────────────────────────┘   │
│                                                 │
│ ┌─────────────────────────────────────────┐   │
│ │ 📋 Webhook Setup Required            [▼]│   │
│ │─────────────────────────────────────────│   │
│ │ Configure this URL in Twilio Console:   │   │
│ │                                         │   │
│ │ SMS Inbound Webhook:                    │   │
│ │ ┌─────────────────────────────────┐    │   │
│ │ │ https://acme.lead360.app/api... │[📋]│   │
│ │ └─────────────────────────────────┘    │   │
│ │                                         │   │
│ │ Setup Instructions:                     │   │
│ │ 1. Log in to Twilio Console             │   │
│ │ 2. Go to Phone Numbers → Active Numbers │   │
│ │ 3. Click +1 (978) 123-4567              │   │
│ │ 4. Under "Messaging"...                 │   │
│ └─────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

---

**ACTION REQUIRED**: Add `WebhookInstructions` component to Sprint 2 documentation and implementation.
