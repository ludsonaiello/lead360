# Voice AI Frontend - Sprint 9: Transfer Numbers Management (TENANT)

**Sprint Type**: Tenant Interface
**Route**: `/(dashboard)/voice-ai/transfer-numbers`
**Permission**: Owner, Admin, Manager (view); Owner, Admin (create/edit/delete)
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 1188-1467)

---

## 🎯 MASTERPIECE DEVELOPER

### ⚠️ CRITICAL RULES

1-7: NO GUESSING | VERIFY ENDPOINTS | localhost:8000 | ASK HUMAN | NO BACKEND EDITS | ALL FIELDS | ERROR HANDLING

---

## 📋 Test Credentials

Tenant Owner: `contact@honeydo4you.com` / `978@F32c`

---

## 🔍 Endpoint Verification

```bash
# GET transfer numbers
curl -X GET http://localhost:8000/api/v1/voice-ai/transfer-numbers \
  -H "Authorization: Bearer <tenant_token>"

# POST create
curl -X POST http://localhost:8000/api/v1/voice-ai/transfer-numbers \
  -H "Authorization: Bearer <tenant_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Sales Team",
    "phone_number": "+13055551234",
    "transfer_type": "primary"
  }'

# PATCH update
curl -X PATCH http://localhost:8000/api/v1/voice-ai/transfer-numbers/<id> \
  -H "Authorization: Bearer <tenant_token>" \
  -H "Content-Type: application/json" \
  -d '{"is_default": true}'

# PATCH reorder
curl -X PATCH http://localhost:8000/api/v1/voice-ai/transfer-numbers/reorder \
  -H "Authorization: Bearer <tenant_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "uuid1", "display_order": 0},
      {"id": "uuid2", "display_order": 1}
    ]
  }'

# DELETE (soft delete)
curl -X DELETE http://localhost:8000/api/v1/voice-ai/transfer-numbers/<id> \
  -H "Authorization: Bearer <tenant_token>"
```

---

## 📦 Data Model

```typescript
interface TransferNumber {
  id: string;
  tenant_id: string;
  label: string;                                  // max 100 chars
  phone_number: string;                           // E.164 format
  transfer_type: 'primary' | 'overflow' | 'after_hours' | 'emergency';
  description: string | null;                     // max 200 chars
  is_default: boolean;
  is_active: boolean;
  display_order: number;
  available_hours: string | null;                 // JSON object as string
  created_at: Date;
  updated_at: Date;
}
```

---

## 🏗️ Implementation

### Files

```
(dashboard)/voice-ai/
├── transfer-numbers/
│   └── page.tsx                    # Transfer numbers list + CRUD
```

### Components

```
voice-ai/tenant/
├── transfer-numbers/
│   ├── TransferNumbersList.tsx     # List with drag-drop reorder
│   ├── TransferNumberCard.tsx      # Card display
│   ├── TransferNumberModal.tsx     # Create/edit modal
│   ├── TransferNumberForm.tsx      # Form component
│   ├── DeleteConfirmModal.tsx      # Delete confirmation
│   └── AvailableHoursEditor.tsx    # Time windows JSON editor
```

---

## 📋 Implementation Tasks

### 1. Transfer Numbers List

**Features**:
- [ ] Display all transfer numbers (GET /transfer-numbers)
- [ ] Ordered by display_order ASC
- [ ] Drag-and-drop reordering (or up/down buttons)
- [ ] Create button (max 10 limit - show warning if limit reached)
- [ ] Edit button per number
- [ ] Delete button per number (soft delete)
- [ ] Default transfer number badge
- [ ] Transfer type badge

**Card Layout**:
```
┌──────────────────────────────────────────────────────┐
│ Sales Team                               [DEFAULT]   │
│ 📞 +1 (305) 555-1234              [Primary]          │
│ Main sales line for customer inquiries               │
│ Available: Mon-Fri 9:00-17:00                        │
│                                                       │
│ [↑] [↓] [Edit] [Delete]                              │
└──────────────────────────────────────────────────────┘
```

**Reorder Implementation**:

Option 1: Drag-and-drop (using react-beautiful-dnd or similar)
```typescript
const handleReorder = async (items) => {
  const reorderData = items.map((item, index) => ({
    id: item.id,
    display_order: index,
  }));

  await fetch('/api/v1/voice-ai/transfer-numbers/reorder', {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: reorderData }),
  });
};
```

Option 2: Up/down buttons (simpler)
```typescript
const moveUp = (index) => {
  if (index === 0) return;
  const newOrder = [...transferNumbers];
  [newOrder[index], newOrder[index - 1]] = [newOrder[index - 1], newOrder[index]];
  submitReorder(newOrder);
};
```

---

### 2. Create/Edit Transfer Number Modal

**Form Fields**:

#### Required Fields
- [ ] **label** (Input, max 100 chars)
  - Placeholder: "Sales Team, After Hours, Emergency"

- [ ] **phone_number** (Phone input, E.164 format)
  - Use MaskedInput or react-phone-number-input
  - Validation: `/^\+[1-9]\d{7,14}$/`

#### Optional Fields
- [ ] **transfer_type** (Select)
  - Options: Primary, Overflow, After Hours, Emergency
  - Default: "primary"

- [ ] **description** (Textarea, max 200 chars)
  - Placeholder: "When to use this transfer number"

- [ ] **is_default** (Checkbox or toggle)
  - Label: "Set as default transfer number"
  - Note: Only one can be default (backend enforces)

- [ ] **available_hours** (JSON editor or custom time picker, nullable)
  - Complex field - JSON object as string
  - Format: `{"mon":[["09:00","17:00"]],"tue":[["09:00","17:00"]]}`
  - Helper: "Leave empty if always available"
  - Consider a visual time range picker UI

- [ ] **display_order** (Number input, min 0)
  - Default: 0 (lowest = highest priority)

**Max Limit Check**:
- Before showing create modal, check count
- If count >= 10: Show error "Maximum of 10 transfer numbers reached"

---

## 🎨 Form Validation

```typescript
const transferNumberSchema = z.object({
  label: z.string().min(1).max(100),
  phone_number: z.string().regex(/^\+[1-9]\d{7,14}$/, 'Must be E.164 format'),
  transfer_type: z.enum(['primary', 'overflow', 'after_hours', 'emergency']).default('primary'),
  description: z.string().max(200).optional().nullable(),
  is_default: z.boolean().default(false),
  available_hours: z.string().refine(isValidJSON, 'Must be valid JSON').optional().nullable(),
  display_order: z.number().min(0).int().default(0),
});
```

---

## 🔄 Form Submission

```typescript
const onCreate = async (data) => {
  setSubmitting(true);
  try {
    const response = await fetch('/api/v1/voice-ai/transfer-numbers', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json();
      if (error.message.includes('Maximum of 10')) {
        // Show max limit error modal
      }
      throw new Error(error.message);
    }

    const result = await response.json();
    // Close modal, refresh list
  } catch (error) {
    // Show error modal
  } finally {
    setSubmitting(false);
  }
};

const onUpdate = async (id, data) => {
  // Similar to onCreate but PATCH /:id
};
```

---

### 3. Delete Confirmation Modal

**Confirmation Message**:
```
Delete Transfer Number?
───────────────────────────────────────

Delete "Sales Team" (+1 305 555-1234)?

⚠️ This will soft-delete the transfer number.
   It will no longer appear in the agent's available transfers.

                              [Cancel] [Delete]
```

**Delete Logic**:
```typescript
const handleDelete = async (id) => {
  setDeleting(true);
  try {
    const response = await fetch(`/api/v1/voice-ai/transfer-numbers/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to delete');

    // Success - refresh list
  } catch (error) {
    // Show error modal
  } finally {
    setDeleting(false);
  }
};
```

---

## ⚠️ Error Handling

- 400: Validation errors (E.164 format, max 10 limit)
- 403: Insufficient role (Manager cannot create/edit)
- 404: Transfer number not found or belongs to different tenant

---

## 🔐 RBAC Implementation

```typescript
const { user } = useAuth();
const canEdit = user?.role === 'Owner' || user?.role === 'Admin';

// Show create/edit/delete buttons only if canEdit
```

---

## ✅ Acceptance Criteria

- ✅ Endpoints verified
- ✅ Transfer numbers list displays ordered by display_order
- ✅ Create transfer number works (all fields)
- ✅ Edit transfer number works
- ✅ Delete transfer number works (soft delete)
- ✅ Reorder works (drag-drop or up/down buttons)
- ✅ Max 10 limit enforced (show error if exceeded)
- ✅ is_default toggle works (only one default)
- ✅ E.164 phone validation works
- ✅ available_hours JSON editor works (nullable)
- ✅ RBAC works (Owner/Admin edit, Manager read-only)
- ✅ Default badge displays
- ✅ Transfer type badge displays
- ✅ Mobile responsive
- ✅ Dark mode

---

**If backend issues: STOP + ASK HUMAN.**

---

**End of Sprint 9**
