# Sprint 5: Initiate Outbound Calls

**Developer**: Developer 5
**Dependencies**: Sprint 1 (API client, types), Sprint 4 (call history)
**Duration**: 1 sprint

---

## 🎯 Sprint Goal

Enable users to initiate outbound calls to Leads directly from the Lead detail page. System calls user's phone first, then bridges to Lead when answered.

---

## 📋 Test Credentials

- **API Base URL**: `http://localhost:8000/api/v1`
- **Test Email**: `contact@honeydo4you.com`
- **Test Password**: `978@F32c`

---

## 📚 Backend API Endpoint

**Test endpoint with curl BEFORE implementation.**

### Initiate Outbound Call
**`POST /api/v1/communication/twilio/calls/initiate`**

Request Body:
```
{
  lead_id: string (uuid, required),
  user_phone_number: string (E.164 format, required),
  call_reason: string (optional)
}
```

Response (201 Created):
```
{
  success: boolean,
  call_record_id: string (uuid),
  twilio_call_sid: string,
  message: string
}
```

**Call Flow**:
1. User clicks "Call Lead" button
2. Modal opens requesting user's phone number
3. User enters phone + optional reason
4. System calls user's phone FIRST
5. User answers → system bridges to Lead
6. Call begins with automatic recording

**RBAC**: Owner, Admin, Manager, Sales (Employee CANNOT initiate calls)

**Validation**:
- Lead must have a phone number (400 error if missing)
- User phone must be E.164 format
- Lead must exist (404 if not found)

**Error Responses**:
- 400: Lead has no phone number / Invalid phone format
- 404: Lead not found
- 403: Insufficient permissions

---

## 🏗️ Required Implementation

### 1. Integration with Lead Pages

**Locations to Add "Call Lead" Button**:
- Lead detail page: `/app/src/app/(dashboard)/leads/[id]/page.tsx`
- Lead list page (optional): `/app/src/app/(dashboard)/leads/page.tsx` (in action menu)

**Button Requirements**:
- Only visible for roles: Owner, Admin, Manager, Sales
- Only enabled if Lead has a phone number
- Disabled state if no phone: Show tooltip "Lead has no phone number"
- Icon: Phone icon (lucide-react)
- Text: "Call Lead"

### 2. Component: `/app/src/components/twilio/InitiateCallModal.tsx`

**Purpose**: Modal to initiate call with user phone input

**Form Fields**:
1. **Lead Name** (read-only, display only)
2. **Lead Phone** (read-only, display only)
3. **Your Phone Number** (PhoneInput, E.164 format, required)
4. **Call Reason** (Textarea, optional, max 500 chars)

**Validation**:
- User phone required and E.164 format
- Call reason optional, max 500 characters

**UX Flow**:
1. Modal opens with Lead info displayed
2. User enters their phone number
3. User optionally enters call reason
4. User clicks "Initiate Call"
5. Loading state: "Calling your phone..."
6. Success: Show message "Calling your phone. Please answer to connect to the Lead."
7. Modal auto-closes after 2 seconds
8. Toast notification with call record ID
9. Redirect to call history page (optional)

**Error Handling**:
- Display error in modal (don't close)
- Show specific error message from backend
- 400: "Lead does not have a phone number"
- 404: "Lead not found"
- Network error: "Failed to initiate call. Please try again."

### 3. Component: `/app/src/components/twilio/CallButton.tsx`

**Purpose**: Reusable "Call Lead" button component

**Props**:
- `leadId` (string)
- `leadName` (string)
- `leadPhone` (string | null)
- `variant` (optional: "primary" | "secondary" | "icon")
- `size` (optional: "sm" | "md" | "lg")

**Features**:
- Opens InitiateCallModal when clicked
- Disabled if no lead phone
- Tooltip if disabled
- Icon + text (or icon only for compact variant)

---

## 🔍 Integration Points

### Lead Detail Page Integration

**Location**: `/app/src/app/(dashboard)/leads/[id]/page.tsx`

**Add Call Button**:
- In header actions (next to Edit, Delete buttons)
- Pass lead.id, lead.first_name + lead.last_name, lead.phone

**Pattern**: Follow existing button placement from Quote/Edit buttons

### Lead List Page Integration (Optional)

**Location**: `/app/src/app/(dashboard)/leads/page.tsx`

**Add to Action Menu**:
- In dropdown action menu for each row
- Between "View" and "Edit" options

---

## 📞 User Experience Flow

**Happy Path**:
1. User viewing Lead "John Doe" with phone "+12025551234"
2. User clicks "Call Lead" button
3. Modal opens showing:
   - Lead: John Doe
   - Lead Phone: +1 (202) 555-1234
   - Your Phone: [Input field]
   - Call Reason: [Textarea]
4. User enters their phone: +19781234567
5. User enters reason: "Following up on quote request"
6. User clicks "Initiate Call"
7. Loading spinner: "Calling your phone..."
8. Success: "Calling your phone. Please answer to connect to John Doe."
9. User's phone rings (Twilio calling)
10. User answers
11. System bridges to Lead's phone
12. Call begins with automatic recording

**Error Paths**:
- Lead has no phone: Button disabled, tooltip shown
- User enters invalid phone: Validation error shown
- Network error: Error modal shown, retry option
- Backend error (400/404): Specific error message displayed

---

## 🎯 Success Indicators

**After Successful Initiation**:
- Toast notification: "Call initiated! Your phone will ring shortly."
- Call record created in database (can verify in Sprint 4 call history)
- User can see call in call history page
- Call status updates in real-time (if polling implemented)

---

## ✅ Sprint 5 Completion Checklist

### API Testing
- [ ] Initiate call endpoint tested with curl
- [ ] Request body validated (all required fields)
- [ ] Response structure matches documentation
- [ ] Error responses tested (400, 404, 403)
- [ ] RBAC tested (Employee gets 403)
- [ ] Actual call flow tested (if real Twilio credentials available)

### Modal Implementation
- [ ] InitiateCallModal renders correctly
- [ ] Lead info displays (name, phone)
- [ ] User phone input works (PhoneInput component)
- [ ] Call reason textarea works
- [ ] Form validation works (E.164 format)
- [ ] Submit initiates call successfully
- [ ] Loading state displays
- [ ] Success message displays
- [ ] Error handling works
- [ ] Modal closes after success

### Button Component
- [ ] CallButton component created
- [ ] Renders correctly (icon + text)
- [ ] Opens modal when clicked
- [ ] Disabled when no lead phone
- [ ] Tooltip shows when disabled
- [ ] Works in all sizes (sm, md, lg)

### Lead Page Integration
- [ ] Call button added to Lead detail page
- [ ] Button positioned correctly in header
- [ ] Only visible for authorized roles
- [ ] Passes correct lead data to modal
- [ ] Works alongside existing actions (Edit, Delete)

### Lead List Integration (Optional)
- [ ] Call action added to dropdown menu
- [ ] Positioned correctly in menu
- [ ] Works for all leads with phones

### UX & Flow
- [ ] User flow smooth and intuitive
- [ ] Loading states clear
- [ ] Success feedback immediate
- [ ] Error messages helpful
- [ ] Modal auto-closes after success
- [ ] Toast notifications work

### RBAC
- [ ] Button visible to Owner, Admin, Manager, Sales
- [ ] Button hidden from Employee
- [ ] Backend enforces permissions

### Mobile Responsiveness
- [ ] Modal works on mobile (full-screen on <640px)
- [ ] Phone input works on mobile
- [ ] Button placement appropriate on mobile

### Dark Mode
- [ ] All components support dark mode

---

## 📤 Deliverables

1. InitiateCallModal component
2. CallButton component
3. Lead detail page integration
4. Lead list page integration (optional)
5. API testing report

---

## 🚦 Next Sprint

**Sprint 6: IVR Configuration (View/List)**
- Display IVR configuration
- Menu options visualization
- Status indicators

---

## ⚠️ Critical Requirements

1. **Test API endpoint FIRST** - Verify request/response structure
2. **E.164 Phone Format** - User phone must be validated (+19781234567)
3. **Call Flow Understanding** - User's phone rings FIRST, not Lead's
4. **RBAC Enforcement** - Employee cannot initiate calls
5. **Error Handling** - Show specific errors (Lead has no phone, Lead not found)
6. **Real Testing** - If possible, test actual call flow with real Twilio account
7. **Integration** - Follow existing Lead page patterns for button placement

---

**Sprint 5 Status**: Ready to Start (after Sprint 1 complete)
**Estimated Duration**: 1 week
