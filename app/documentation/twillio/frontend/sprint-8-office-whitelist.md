# Sprint 8: Office Whitelist Management

**Developer**: Developer 8
**Dependencies**: Sprint 1 (API client, types)
**Duration**: 1 sprint

---

## 🎯 Sprint Goal

Build office bypass whitelist management interface. Whitelisted phone numbers bypass IVR and can make outbound calls using company's phone number. Simple CRUD with modals.

---

## 📋 Test Credentials

- **API Base URL**: `http://localhost:8000/api/v1`
- **Test Email**: `contact@honeydo4you.com`
- **Test Password**: `978@F32c`

---

## 📚 Backend API Endpoints

**Test ALL endpoints with curl BEFORE implementation.**

### 1. List All Whitelisted Numbers
**`GET /api/v1/communication/twilio/office-whitelist`**

Response (200 OK): Array of OfficeWhitelistEntry
```
[
  {
    id: string (uuid),
    tenant_id: string (uuid),
    phone_number: string (E.164),
    label: string,
    status: "active" | "inactive",
    created_at: string,
    updated_at: string
  }
]
```

Sorted by most recent first.

**RBAC**: Owner, Admin, Manager (Manager read-only)

### 2. Add Phone to Whitelist
**`POST /api/v1/communication/twilio/office-whitelist`**

Request Body:
```
{
  phone_number: string (E.164, required),
  label: string (required, 1-100 chars)
}
```

Response (201 Created): Returns created OfficeWhitelistEntry

**Validation**:
- Phone must be E.164 format
- Label 1-100 characters

**Error**:
- 409 Conflict: "This phone number is already whitelisted"

**RBAC**: Owner, Admin only

### 3. Update Whitelist Entry Label
**`PATCH /api/v1/communication/twilio/office-whitelist/:id`**

Request Body:
```
{
  label: string (required, 1-100 chars)
}
```

Response (200 OK): Returns updated OfficeWhitelistEntry

**Note**: Phone number cannot be changed. To change number, delete and re-add.

**RBAC**: Owner, Admin only

### 4. Remove from Whitelist (Soft Delete)
**`DELETE /api/v1/communication/twilio/office-whitelist/:id`**

Response (200 OK): Returns entry with `status: "inactive"`

**RBAC**: Owner, Admin only

---

## 🏗️ Required Implementation

### Page: `/app/src/app/(dashboard)/communications/twilio/whitelist/page.tsx`

**Layout**:

1. **Header**:
   - Title: "Office Bypass Whitelist"
   - Description: "Whitelisted phone numbers bypass IVR and can make outbound calls"
   - "Add Phone Number" button (Owner/Admin only)

2. **Whitelist Table** (or cards on mobile):
   - Columns: Phone Number, Label, Status, Created Date, Actions
   - Show both active and inactive entries
   - Sort by: Most recent first
   - Status badge: Active (green), Inactive (gray)
   - Actions: Edit Label, Remove (Owner/Admin only)
   - Empty state if no entries

3. **Table Features**:
   - Search by phone number or label
   - Filter by status (All, Active, Inactive)
   - Phone numbers formatted nicely (+1 (978) 123-4567)

4. **Empty State**:
   - Icon: Shield or Phone
   - Title: "No Whitelisted Numbers"
   - Description: "Add phone numbers to bypass IVR and enable office outbound calling"
   - Button: "Add Phone Number"

**RBAC**:
- View: Owner, Admin, Manager
- Add/Edit/Remove: Owner, Admin only
- Manager: Read-only view

---

## 🎯 Modal Components

### Component: `/app/src/components/twilio/modals/AddPhoneWhitelistModal.tsx`

**Purpose**: Add new phone to whitelist

**Form Fields**:
1. **Phone Number**: PhoneInput component (E.164 format, required)
2. **Label**: Text input (1-100 chars, required)
   - Placeholder: "e.g., John Doe - Sales Manager's Mobile"
   - Help text: "Descriptive label to identify this phone number"

**Validation**:
- Phone required and E.164 format
- Label required, 1-100 characters

**Error Handling**:
- 409 Conflict: "This phone number is already whitelisted"
- Display error inline in modal

**Success**:
- Close modal
- Toast: "Phone number added to whitelist"
- Refresh list

### Component: `/app/src/components/twilio/modals/EditWhitelistLabelModal.tsx`

**Purpose**: Edit label only (phone cannot be changed)

**Form Fields**:
1. **Phone Number**: Display only (read-only, formatted)
2. **Label**: Text input (pre-filled, 1-100 chars, required)

**Note**: Show message: "Phone number cannot be changed. To change, remove this entry and add a new one."

**Success**:
- Close modal
- Toast: "Label updated successfully"
- Refresh list

---

## 🎨 UX Considerations

**Phone Number Formatting**:
- Input: "+19781234567"
- Display in table: "+1 (978) 123-4567"
- Use existing PhoneInput component or formatter

**Label Guidelines**:
- Recommend format: "Name - Role/Purpose"
- Examples:
  - "John Doe - Sales Manager's Mobile"
  - "Office Phone - Front Desk"
  - "Jane Smith - VP of Operations"

**Security Notice**:
Add info card at top of page:
```
"Office bypass allows whitelisted phone numbers to:
- Skip IVR menu when calling in
- Make outbound calls using company's Twilio number

Verify phone number ownership before adding to whitelist. Regularly audit entries."
```

**Duplicate Handling**:
- Backend returns 409 if phone already whitelisted (active)
- If inactive entry exists, backend may reactivate it automatically (check behavior)
- Show clear error message to user

---

## ✅ Sprint 8 Completion Checklist

### API Testing
- [ ] Get whitelist endpoint tested with curl
- [ ] Add phone endpoint tested
- [ ] Update label endpoint tested
- [ ] Remove phone endpoint tested
- [ ] Response structures match documentation
- [ ] Error responses tested (409, 404, 403)
- [ ] RBAC tested (Manager read-only, Sales gets 403)

### Page Implementation
- [ ] Whitelist page renders correctly
- [ ] Header with title and add button
- [ ] Table displays all entries (active + inactive)
- [ ] Phone numbers formatted correctly
- [ ] Labels display correctly
- [ ] Status badges show (active/inactive)
- [ ] Created dates formatted
- [ ] Actions column shows edit/remove (Owner/Admin only)
- [ ] Empty state displays when no entries
- [ ] Loading state works
- [ ] Security notice card displays

### Add Phone Modal
- [ ] Modal opens when clicking "Add Phone Number"
- [ ] Phone input works (PhoneInput component)
- [ ] Label input works
- [ ] Form validation works (E.164, label length)
- [ ] Submit adds phone successfully
- [ ] 409 error handled (already whitelisted)
- [ ] Success toast shows
- [ ] Modal closes and list refreshes

### Edit Label Modal
- [ ] Modal opens when clicking edit action
- [ ] Phone number displays as read-only
- [ ] Label pre-filled with current value
- [ ] Submit updates label successfully
- [ ] Success toast shows
- [ ] Modal closes and list refreshes
- [ ] Note about phone number change displays

### Remove Functionality
- [ ] Remove button shows for each entry (Owner/Admin only)
- [ ] Confirmation modal shows before removal
- [ ] Remove soft-deletes (sets status to inactive)
- [ ] Success toast shows
- [ ] List refreshes showing inactive status

### Search & Filter
- [ ] Search by phone number works
- [ ] Search by label works
- [ ] Filter by status works (All, Active, Inactive)
- [ ] Search and filter combine correctly

### RBAC
- [ ] Page accessible to Owner, Admin, Manager
- [ ] Add/Edit/Remove buttons only visible to Owner, Admin
- [ ] Manager sees read-only view
- [ ] Sales/Employee get 403 or redirect

### Mobile Responsiveness
- [ ] Table converts to cards on mobile
- [ ] Modals work on mobile
- [ ] Phone input works on mobile
- [ ] Actions accessible on mobile

### Dark Mode
- [ ] All components support dark mode

---

## 📤 Deliverables

1. Office whitelist page
2. Add phone modal
3. Edit label modal
4. Remove confirmation modal
5. API testing report

---

## 🚦 Next Sprint

**Sprint 9: Dashboard & Overview**
- Unified Twilio settings overview page
- Status cards for all modules (SMS, WhatsApp, IVR, Calls)
- Quick actions
- Recent activity

---

## ⚠️ Critical Requirements

1. **Test API endpoints FIRST**
2. **E.164 Format** - Validate phone numbers strictly
3. **Label Descriptive** - Guide users to use descriptive labels
4. **Phone Cannot Change** - Edit only allows label change
5. **Soft Delete** - Remove sets status to inactive (data retained)
6. **Security Notice** - Warn users about whitelist implications
7. **Duplicate Handling** - Show clear error for duplicate phones
8. **RBAC** - Manager read-only, Owner/Admin full access
9. **Verify Ownership** - Recommend users verify they own the phone before adding

---

**Sprint 8 Status**: Ready to Start (after Sprint 1 complete)
**Estimated Duration**: 1 week (simpler than IVR)
