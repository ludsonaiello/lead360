# Sprint 6: IVR Configuration (Part 1 - View/List)

**Developer**: Developer 6
**Dependencies**: Sprint 1 (API client, types)
**Duration**: 1 sprint

---

## 🎯 Sprint Goal

Build the IVR configuration display page showing current IVR settings, menu options, greeting message, and status. This is READ-ONLY - Sprint 7 will handle create/edit.

---

## 📋 Test Credentials

- **API Base URL**: `http://localhost:8000/api/v1`
- **Test Email**: `contact@honeydo4you.com`
- **Test Password**: `978@F32c`

---

## 📚 Backend API Endpoint

**Test endpoint with curl BEFORE implementation.**

### Get IVR Configuration
**`GET /api/v1/communication/twilio/ivr`**

Response (200 OK):
```
{
  id: string (uuid),
  tenant_id: string (uuid),
  twilio_config_id: string | null,
  ivr_enabled: boolean,
  greeting_message: string,
  menu_options: IVRMenuOption[],
  default_action: IVRDefaultAction,
  timeout_seconds: number,
  max_retries: number,
  status: "active" | "inactive",
  created_at: string,
  updated_at: string
}
```

**IVRMenuOption Structure**:
```
{
  digit: string ("0"-"9"),
  action: "route_to_number" | "route_to_default" | "trigger_webhook" | "voicemail",
  label: string,
  config: {
    phone_number?: string,
    webhook_url?: string,
    max_duration_seconds?: number
  }
}
```

**IVRDefaultAction Structure**:
```
{
  action: "route_to_number" | "route_to_default" | "trigger_webhook" | "voicemail",
  config: { ... same as menu option }
}
```

**Error Response**:
- 404: "IVR configuration not found for this tenant"

**RBAC**: Owner, Admin, Manager (Sales and Employee CANNOT view)

---

## 🏗️ Required Implementation

### Page: `/app/src/app/(dashboard)/communications/twilio/ivr/page.tsx`

**Layout Requirements**:

1. **Header**:
   - Title: "IVR Configuration"
   - Description: "Interactive Voice Response menu settings"
   - Action buttons:
     - "Configure IVR" (if no config exists) - Redirects to Sprint 7 create page
     - "Edit Configuration" (if config exists) - Redirects to Sprint 7 edit page
     - "Disable IVR" (if config exists and enabled) - Confirmation modal

2. **Status Card** (if config exists):
   - IVR Enabled/Disabled toggle display (read-only for now)
   - Status badge (Active/Inactive)
   - Created/Updated timestamps

3. **Greeting Message Card**:
   - Display greeting message text
   - Character count
   - Estimated speaking time (assume 150 words per minute)

4. **Menu Options Visual**:
   - Card for each menu option
   - Display format:
     ```
     Press [1] → [Action Type] → [Label]
     Config: [Action-specific details]
     ```
   - Color-coded by action type:
     - route_to_number: Blue
     - voicemail: Green
     - trigger_webhook: Purple
     - route_to_default: Gray

5. **Default Action Card**:
   - Shows action if no input or timeout
   - Same format as menu options
   - Highlighted as "Default/Fallback"

6. **Settings Card**:
   - Timeout: X seconds
   - Max Retries: X attempts
   - Display with icons

7. **Empty State** (if no config):
   - Icon: Phone with menu
   - Title: "No IVR Configuration"
   - Description: "Set up an Interactive Voice Response menu to route incoming calls"
   - Button: "Configure IVR" (Owner/Admin only)

**RBAC Controls**:
- View: Owner, Admin, Manager
- Edit/Create buttons: Only Owner, Admin
- Hide action buttons for Manager (read-only view)

---

## 🎨 Visual Design Requirements

### Menu Option Display Format

Each menu option should be displayed as a card:

**Header**:
- Digit badge (large, colored)
- Action type label
- Option label

**Body**:
- Action-specific config details formatted nicely

**Example Layout**:
```
╔══════════════════════════════════╗
║  [1]  Route to Phone Number      ║
║  Sales Department                ║
║  ─────────────────────────────   ║
║  Phone: +1 (978) 123-4567        ║
╚══════════════════════════════════╝
```

### Action Type Icons & Colors

Use these for visual differentiation:
- `route_to_number`: Phone icon, Blue
- `voicemail`: Voicemail icon, Green
- `trigger_webhook`: Link icon, Purple
- `route_to_default`: Arrow icon, Gray

### Greeting Message Display

- Text in a card with light background
- Show character count: "120 / 500 characters"
- Show estimated speaking time: "~15 seconds"
- Use monospace or readable font

---

## 🔍 Data Formatting

### Phone Numbers
Format phone numbers for display:
- Input: "+19781234567"
- Display: "+1 (978) 123-4567"

Use existing PhoneInput mask or create formatter utility.

### Duration
Format voicemail duration:
- Input: 180 (seconds)
- Display: "3 minutes"
- Or: "180 seconds (3 min)"

### Webhook URLs
Display full URL with copy button:
```
https://example.com/webhook [Copy]
```

---

## ✅ Sprint 6 Completion Checklist

### API Testing
- [ ] Get IVR config endpoint tested with curl
- [ ] Response structure matches documentation
- [ ] 404 error tested (no config)
- [ ] RBAC tested (Manager can view, Sales gets 403)
- [ ] Menu options array structure verified
- [ ] Default action structure verified

### Page Implementation
- [ ] IVR configuration page renders correctly
- [ ] Header with title and description
- [ ] Status card displays correctly
- [ ] Greeting message card shows text + character count
- [ ] Menu options display in order (digit 0-9)
- [ ] Each menu option shows: digit, action, label, config
- [ ] Default action displays separately
- [ ] Settings card shows timeout and max retries
- [ ] Empty state displays when no config
- [ ] Loading state works

### Visual Design
- [ ] Menu options are visually distinct
- [ ] Color-coding by action type implemented
- [ ] Icons used for action types
- [ ] Cards have proper spacing and hierarchy
- [ ] Greeting message readable
- [ ] Phone numbers formatted nicely
- [ ] Durations formatted (seconds → minutes)

### Action Buttons
- [ ] "Configure IVR" button shows in empty state (Owner/Admin only)
- [ ] "Edit Configuration" button shows when config exists (Owner/Admin only)
- [ ] "Disable IVR" button shows when enabled (Owner/Admin only)
- [ ] Buttons hidden for Manager (read-only view)
- [ ] Buttons redirect to Sprint 7 pages (placeholder for now)

### RBAC
- [ ] Page accessible to Owner, Admin, Manager
- [ ] Sales and Employee get 403 or redirect
- [ ] Action buttons only visible to Owner/Admin
- [ ] Manager sees read-only view

### Mobile Responsiveness
- [ ] Page works on mobile (375px)
- [ ] Menu options stack vertically on mobile
- [ ] Cards resize appropriately
- [ ] Text remains readable

### Dark Mode
- [ ] All components support dark mode
- [ ] Color-coded cards visible in dark mode

---

## 📤 Deliverables

1. IVR configuration display page
2. Menu option card component (reusable)
3. Action type formatter utilities
4. Empty state implementation
5. API testing report

---

## 🚦 Next Sprint

**Sprint 7: IVR Configuration (Part 2 - Create/Edit)**
- Complex form builder for IVR
- Menu option add/remove/reorder
- Validation for unique digits, valid configs
- NOT a modal - dedicated page due to complexity

---

## ⚠️ Critical Requirements

1. **Test API endpoint FIRST** - Verify response structure
2. **Read-Only View** - No editing in this sprint
3. **Visual Clarity** - Menu options must be easy to understand
4. **Action Type Display** - Show action details clearly (phone, webhook, duration)
5. **RBAC** - Manager can view, but cannot edit
6. **Placeholder Buttons** - Edit/Create buttons can link to "#" or show toast "Coming in Sprint 7"
7. **Data Validation** - Verify menu_options is an array, digits are unique

---

**Sprint 6 Status**: Ready to Start (after Sprint 1 complete)
**Estimated Duration**: 1 week
