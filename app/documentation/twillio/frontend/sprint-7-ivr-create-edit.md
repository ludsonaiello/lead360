# Sprint 7: IVR Configuration (Part 2 - Create/Edit)

**Developer**: Developer 7
**Dependencies**: Sprint 1 (API client, types), Sprint 6 (IVR view)
**Duration**: 1 sprint

---

## 🎯 Sprint Goal

Build the IVR configuration creation and editing interface. This is a **COMPLEX FORM** - use a dedicated PAGE, NOT a modal. Includes menu option builder with add/remove/reorder functionality.

---

## 📋 Test Credentials

- **API Base URL**: `http://localhost:8000/api/v1`
- **Test Email**: `contact@honeydo4you.com`
- **Test Password**: `978@F32c`

---

## 📚 Backend API Endpoints

**Test ALL endpoints with curl BEFORE implementation.**

### 1. Create or Update IVR Configuration (Upsert)
**`POST /api/v1/communication/twilio/ivr`**

Request Body:
```
{
  ivr_enabled: boolean (required),
  greeting_message: string (required, 5-500 chars),
  menu_options: IVRMenuOption[] (required, 1-10 items),
  default_action: IVRDefaultAction (required),
  timeout_seconds: number (required, 5-60),
  max_retries: number (required, 1-5)
}
```

**Validation Rules**:
- Each digit must be unique (0-9)
- Max 10 menu options
- Greeting message: 5-500 characters
- Phone numbers: E.164 format
- Webhook URLs: HTTPS only
- Voicemail duration: 60-300 seconds

Response (201 Created): Returns full IVR config (same as GET)

**RBAC**: Owner, Admin only

### 2. Disable IVR Configuration
**`DELETE /api/v1/communication/twilio/ivr`**

Response (200 OK): Returns IVR config with `ivr_enabled: false` and `status: "inactive"`

**RBAC**: Owner, Admin only

---

## 🏗️ Required Implementation

### Page: `/app/src/app/(dashboard)/communications/twilio/ivr/edit/page.tsx`

**Purpose**: Single page for both create AND edit (upsert pattern)

**Page Structure**:

1. **Header**:
   - Title: "Configure IVR" or "Edit IVR Configuration"
   - Breadcrumbs: Communications > Twilio > IVR > Edit
   - Cancel button (returns to Sprint 6 view page)

2. **Form Sections** (use multi-step or accordion layout):

   **Section 1: IVR Status**
   - Toggle: Enable/Disable IVR
   - Description: "Enable to activate IVR menu for incoming calls"

   **Section 2: Greeting Message**
   - Textarea input (5-500 characters)
   - Character counter (real-time)
   - Estimated speaking time (150 words/min)
   - Help text: "This message will be spoken before presenting menu options"

   **Section 3: Menu Options Builder**
   - List of menu options (draggable for reordering)
   - Each option shows: Digit, Action Type, Label, Config
   - "Add Menu Option" button (max 10)
   - Remove button on each option
   - Digit selector (0-9, must be unique)
   - Action type dropdown:
     - Route to Phone Number
     - Voicemail
     - Trigger Webhook
     - Route to Default
   - Label input
   - Action-specific config:
     - If route_to_number: Phone input (E.164)
     - If voicemail: Duration input (60-300 seconds)
     - If trigger_webhook: URL input (HTTPS only)
     - If route_to_default: No config needed

   **Section 4: Default Action**
   - Action type dropdown (same as menu options)
   - Action-specific config inputs
   - Help text: "Action taken if no input or timeout"

   **Section 5: Advanced Settings**
   - Timeout seconds: Number input (5-60)
   - Max retries: Number input (1-5)
   - Help text for each

3. **Footer Actions**:
   - Cancel button (confirm if dirty)
   - Save Configuration button (validates and submits)

**Form State Management**:
- Track dirty state (unsaved changes)
- Warn before leaving page if dirty
- Real-time validation
- Show validation errors inline

---

## 🎯 Menu Option Builder Requirements

### Add Menu Option
- Click "Add Menu Option" button
- New option added to list with defaults:
  - Digit: Next available (0-9)
  - Action: route_to_number
  - Label: Empty
  - Config: Empty

### Remove Menu Option
- X button on each option
- Confirm before removing (optional)
- Minimum 1 option required

### Reorder Menu Options
- Drag handle on each option
- Reorder visually (doesn't affect digit assignment)
- Use react-beautiful-dnd or similar library

### Digit Management
- Dropdown to select digit (0-9)
- Show only available digits (not used by other options)
- Validation: No duplicate digits

### Action Type Selection
- Dropdown with 4 options
- When changed, show/hide relevant config fields
- Validate config based on action type

---

## ✅ Validation Rules (Frontend)

**Greeting Message**:
- Required
- Min 5 characters
- Max 500 characters

**Menu Options**:
- Min 1 option
- Max 10 options
- Each digit must be unique
- Each label required (1-100 chars)
- Phone numbers: E.164 format validation
- Webhook URLs: Must start with https://
- Voicemail duration: 60-300 seconds

**Default Action**:
- Required
- Config required based on action type

**Timeout Seconds**:
- Required
- Min 5, Max 60

**Max Retries**:
- Required
- Min 1, Max 5

**Show Errors**:
- Inline validation on blur
- Summary at top of form on submit
- Highlight invalid fields

---

## 🎨 UX Considerations

**Loading Existing Config** (Edit Mode):
- Fetch config on page load
- Pre-fill all fields
- Show loading state while fetching
- Handle 404 (no config) - redirect to create mode

**Dirty State Warning**:
- Track form changes
- Warn before navigation if unsaved changes
- "You have unsaved changes. Leave page?" confirmation

**Success Flow**:
- Submit form
- Show loading state: "Saving configuration..."
- On success: Toast "IVR configuration saved successfully"
- Redirect to Sprint 6 view page

**Error Handling**:
- 400: Show validation errors inline
- Specific error: "Duplicate digits found: 1"
- Network error: "Failed to save. Please try again."
- Keep user on page with errors visible

---

## 🛠️ Recommended Libraries

- **Form Management**: React Hook Form (existing pattern)
- **Drag & Drop**: react-beautiful-dnd or dnd-kit
- **Validation**: Zod (existing pattern)

---

## ✅ Sprint 7 Completion Checklist

### API Testing
- [ ] Create/update IVR endpoint tested with curl
- [ ] Request body validated (all required fields)
- [ ] Response structure matches documentation
- [ ] Duplicate digit validation tested (backend returns 400)
- [ ] Delete IVR endpoint tested
- [ ] RBAC tested (Sales gets 403)

### Page Implementation
- [ ] IVR edit page renders correctly
- [ ] Header with breadcrumbs and cancel button
- [ ] Form sections organized clearly
- [ ] IVR enable/disable toggle works
- [ ] Greeting message input with character counter
- [ ] Estimated speaking time calculated
- [ ] Menu options builder functional
- [ ] Default action selector works
- [ ] Advanced settings inputs work
- [ ] Footer actions positioned correctly

### Menu Option Builder
- [ ] Add menu option button works
- [ ] Remove menu option button works
- [ ] Minimum 1 option enforced
- [ ] Maximum 10 options enforced
- [ ] Reorder functionality works (drag & drop)
- [ ] Digit selector shows only available digits
- [ ] Action type dropdown works
- [ ] Action-specific config fields show/hide correctly
- [ ] Phone input validates E.164 format
- [ ] Webhook URL validates HTTPS
- [ ] Voicemail duration validates range (60-300)

### Form Validation
- [ ] All required fields validated
- [ ] Inline validation on blur
- [ ] Submit validation shows errors
- [ ] Error summary at top of form
- [ ] Duplicate digit detection
- [ ] Character limits enforced
- [ ] Numeric range validation works

### UX & State Management
- [ ] Dirty state tracking works
- [ ] Navigation warning shows if unsaved changes
- [ ] Loading state on form submit
- [ ] Success toast shows
- [ ] Redirect to view page after save
- [ ] Error messages display inline
- [ ] Form resets after successful save

### Edit Mode
- [ ] Existing config loads on page load
- [ ] All fields pre-filled correctly
- [ ] Menu options loaded in order
- [ ] Default action loaded correctly
- [ ] Save updates existing config (upsert works)

### Create Mode
- [ ] Empty form for new config
- [ ] Default values set appropriately
- [ ] Save creates new config (upsert works)

### RBAC
- [ ] Page only accessible to Owner, Admin
- [ ] Manager/Sales/Employee get 403 or redirect

### Mobile Responsiveness
- [ ] Form works on mobile (375px)
- [ ] Sections stack vertically
- [ ] Drag & drop works on mobile (or disabled gracefully)
- [ ] Inputs sized appropriately

### Dark Mode
- [ ] All form elements support dark mode

---

## 📤 Deliverables

1. IVR edit/create page
2. Menu option builder component
3. Form validation with Zod schema
4. Drag & drop reordering
5. API testing report

---

## 🚦 Next Sprint

**Sprint 8: Office Whitelist Management**
- Phone number whitelist CRUD
- Simpler than IVR (can use modals)
- E.164 validation

---

## ⚠️ Critical Requirements

1. **Test API endpoints FIRST** - Verify upsert pattern works
2. **NOT A MODAL** - Too complex, use dedicated page
3. **Unique Digits** - Frontend prevents duplicates, backend validates
4. **HTTPS Webhooks** - Validate webhook URLs are HTTPS only
5. **E.164 Phones** - Validate phone number format
6. **Dirty State** - Warn before leaving with unsaved changes
7. **Upsert Pattern** - Same endpoint for create and update
8. **Validation** - Both frontend AND backend validation
9. **Max 10 Options** - Enforce limit

---

**Sprint 7 Status**: Ready to Start (after Sprint 6 complete)
**Estimated Duration**: 1 week (most complex sprint)
