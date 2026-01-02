# Feature Contract Template

**Feature Name**: [Feature Name]  
**Module**: [Module Name]  
**Sprint**: [Sprint Number]  
**Status**: Draft | Ready for Development | In Development | Complete

---

## Purpose

**What problem does this solve?**

[2-3 sentences explaining the business value and user need]

**Who is this for?**

- **Primary Users**: [e.g., Estimators, Project Managers, Customers]
- **Use Cases**: [List 2-3 main use cases]

---

## Scope

### **In Scope**

[List what IS included in this feature]

- ✅ Feature/functionality 1
- ✅ Feature/functionality 2
- ✅ Feature/functionality 3

### **Out of Scope**

[List what is NOT included - prevents scope creep]

- ❌ Feature/functionality 1 (future phase)
- ❌ Feature/functionality 2 (out of scope)
- ❌ Feature/functionality 3 (not needed)

---

## Dependencies

### **Requires (must be complete first)**

- [ ] Feature/Module X
- [ ] Feature/Module Y
- [ ] External Integration Z

### **Blocks (must complete before)**

- Module/Feature A (depends on this)
- Module/Feature B (depends on this)

---

## Data Model

### **Database Tables**

List all tables this feature requires.

#### **Table: {table_name}**

**Purpose**: [What this table stores]

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | uuid | Yes | Primary key | - | uuid() |
| tenant_id | uuid | Yes | Tenant identifier | - | - |
| [column_name] | [type] | [Yes/No] | [Description] | [Rules] | [Default] |
| created_at | timestamp | Yes | Creation time | - | now() |
| updated_at | timestamp | Yes | Last update | - | now() |

**Indexes**:
- Primary: `id`
- Composite: `(tenant_id, created_at)`
- Composite: `(tenant_id, status)`
- Other: [List any other indexes]

**Relationships**:
- Belongs to: [Parent table(s)]
- Has many: [Child table(s)]
- Many to many: [Related tables via junction]

**Business Rules**:
- Rule 1: [Description]
- Rule 2: [Description]

---

### **Enums**

#### **EnumName**

```typescript
enum Status {
  NEW = 'NEW',
  QUALIFIED = 'QUALIFIED',
  UNQUALIFIED = 'UNQUALIFIED',
  CONVERTED = 'CONVERTED',
  LOST = 'LOST',
}
```

**Values**:
- `NEW`: [Description]
- `QUALIFIED`: [Description]
- etc.

---

## API Specification

### **Endpoints Overview**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /api/v1/{resource} | List all | Yes | All |
| POST | /api/v1/{resource} | Create | Yes | Owner, Admin, Role |
| GET | /api/v1/{resource}/:id | Get single | Yes | All |
| PATCH | /api/v1/{resource}/:id | Update | Yes | Owner, Admin |
| DELETE | /api/v1/{resource}/:id | Delete | Yes | Owner, Admin |

---

### **Endpoint Details**

#### **1. List {Resource}**

**GET** `/api/v1/{resource}`

**Query Parameters**:
- `page` (integer, default: 1): Page number
- `limit` (integer, default: 20, max: 100): Items per page
- `status` (string, optional): Filter by status
- `search` (string, optional): Text search
- `sort` (string, default: created_at:desc): Sort field:direction

**Request Example**:
```bash
GET /api/v1/leads?page=1&limit=20&status=QUALIFIED&sort=created_at:desc
Authorization: Bearer {token}
```

**Success Response (200)**:
```json
{
  "data": [
    {
      "id": "uuid",
      "field1": "value",
      "field2": "value",
      "created_at": "ISO8601",
      "updated_at": "ISO8601"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

**Error Responses**:
- 401: Unauthorized (no/invalid token)
- 400: Bad Request (invalid parameters)

---

#### **2. Create {Resource}**

**POST** `/api/v1/{resource}`

**Request Body Schema**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| field1 | string | Yes | 2-100 chars | Description |
| field2 | string | Yes | Valid format | Description |
| field3 | string | No | - | Description |

**Request Example**:
```json
{
  "field1": "value",
  "field2": "value",
  "field3": "value"
}
```

**Success Response (201)**:
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "field1": "value",
  "field2": "value",
  "field3": "value",
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

**Error Responses**:
- 400: Validation failed
- 401: Unauthorized
- 403: Forbidden (insufficient role)
- 409: Conflict (duplicate)

---

#### **3. Get {Resource} by ID**

[Repeat pattern for each endpoint]

---

## Business Rules

### **Validation Rules**

1. **Rule Name**: [Description]
   - **When**: [Condition]
   - **Action**: [What happens]
   - **Error**: [Error message if violated]

2. **Rule Name**: [Description]
   - **When**: [Condition]
   - **Action**: [What happens]
   - **Error**: [Error message if violated]

### **State Transitions**

**Status Flow**:
```
NEW → QUALIFIED → CONVERTED
NEW → UNQUALIFIED → LOST
```

**Allowed Transitions**:
- NEW can become: QUALIFIED, UNQUALIFIED
- QUALIFIED can become: CONVERTED, LOST
- UNQUALIFIED can become: LOST
- CONVERTED: Terminal state (cannot change)
- LOST: Terminal state (cannot change)

**Who Can Transition**:
- NEW → QUALIFIED: Estimator, Admin, Owner
- QUALIFIED → CONVERTED: System (on quote acceptance)

---

## UI Requirements

### **Pages Required**

#### **1. {Resource} List Page**

**Route**: `/resource`

**Purpose**: Display paginated, searchable, filterable list of resources

**Layout**:
```
[Header: "Resources"]
[Search Bar] [Filter: Status ▼] [+ Create Resource Button]

[Table/Cards showing resources with columns:]
- Name
- Status
- Created Date
- Actions (View, Edit, Delete)

[Pagination: < 1 2 3 4 5 >]
```

**Functionality**:
- Search by name, phone, email (real-time)
- Filter by status dropdown
- Sort by clicking column headers
- Click row to view details
- Pagination (20 per page default)
- Mobile: Cards instead of table

**Modern UI Requirements**:
- ✅ Search with autocomplete
- ✅ Status filter as toggle/dropdown
- ✅ Loading skeleton on initial load
- ✅ Empty state (when no results)
- ✅ Responsive design (mobile-first)

---

#### **2. Create/Edit {Resource} Form**

**Routes**: 
- `/resource/new` (create)
- `/resource/:id/edit` (edit)

**Purpose**: Multi-step form for creating or editing resource

**Steps** (if >5 fields use multi-step):
- Step 1: Basic Information
- Step 2: Additional Details
- Step 3: Review and Submit

**Fields**:
- Field 1: [Type] (required)
- Field 2: [Type] (optional)
- Field 3: [Type with validation]

**Modern UI Requirements**:
- ✅ Multi-step form (if >5 fields)
- ✅ Progress indicator
- ✅ Masked inputs (phone, money, etc.)
- ✅ Autocomplete for searchable dropdowns
- ✅ Toggle switches for booleans
- ✅ Date pickers for dates
- ✅ Validation errors inline
- ✅ Loading spinner on submit
- ✅ Success modal on complete
- ✅ Error modal on failure
- ✅ Cancel button (confirm if unsaved changes)

**Validation**:
- Client-side: Immediate feedback
- Server-side: Final validation (source of truth)

---

#### **3. {Resource} Detail Page**

**Route**: `/resource/:id`

**Purpose**: View complete details of resource

**Layout**:
```
[Breadcrumb: Resources > {Resource Name}]
[Header: {Resource Name}] [Edit Button] [Delete Button]

[Section: Basic Info]
- Field 1: Value
- Field 2: Value

[Section: Related Data]
- [List of related items]

[Section: Activity Timeline]
- [Communication events, status changes]
```

**Functionality**:
- View all fields
- Edit button (if permissions allow)
- Delete button (if permissions allow, with confirmation)
- Related data (addresses, service requests, etc.)
- Activity timeline
- Navigation links (open in new tab support)

---

### **Components Required**

List reusable components needed:

1. **{Resource}Card**: Display resource in card format
   - Props: resource object, onSelect callback
   - Used in: List view (mobile)

2. **{Resource}Form**: Multi-step form component
   - Props: initialData (for edit), onSubmit callback
   - Used in: Create/Edit pages

3. **{Resource}Timeline**: Activity timeline
   - Props: resourceId
   - Used in: Detail page

---

## User Flows

### **Primary Flow: Create {Resource}**

1. User clicks "Create {Resource}" button
2. Multi-step form opens (or navigates to /resource/new)
3. User fills Step 1 (Basic Info)
4. User clicks "Next"
5. User fills Step 2 (Additional Details)
6. User clicks "Next"
7. User reviews Step 3 (Summary)
8. User clicks "Submit"
9. Loading spinner shows
10. API call to POST /api/v1/resource
11. Success:
    - Success modal shows: "{Resource} created successfully!"
    - Redirect to /resource/:id (detail page)
12. Error:
    - Error modal shows with retry option
    - User can fix errors and resubmit

**Error Handling**:
- Validation errors: Show inline on respective fields
- API errors: Show modal with message + retry button
- Network errors: Show modal with retry option

---

### **Secondary Flow: Edit {Resource}**

[Describe edit flow]

---

### **Edge Cases**

1. **What if user navigates away mid-form?**
   - Show "Unsaved changes" confirmation modal
   - Options: "Discard" or "Continue Editing"

2. **What if resource is deleted by another user while viewing?**
   - Show error: "This resource no longer exists"
   - Redirect to list page

3. **What if user lacks permission mid-action?**
   - Show error: "You don't have permission to perform this action"
   - Disable action buttons

---

## Security & Permissions

### **Authentication**

- ✅ All endpoints require JWT authentication
- ❌ Except: [List any public endpoints]

### **RBAC Matrix**

| Action | Owner | Admin | Estimator | PM | Bookkeeper | Employee | Read-only |
|--------|-------|-------|-----------|----|-----------| ---------|-----------|
| Create | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### **Multi-Tenant Isolation**

- ✅ All queries MUST filter by `tenant_id`
- ✅ `tenant_id` extracted from JWT (never from client)
- ✅ Tenant isolation tests required

### **Audit Logging**

**Log These Actions**:
- Create {resource}
- Update {resource}
- Delete {resource}
- [Other critical actions]

**Audit Fields**:
- actor_user_id
- entity_type
- entity_id
- action
- before_json
- after_json
- timestamp
- ip_address

---

## Testing Requirements

### **Backend Tests**

#### **Unit Tests (Services)**
- ✅ Create resource with tenant_id
- ✅ Find all resources (paginated, filtered by tenant)
- ✅ Find resource by ID (tenant-scoped)
- ✅ Update resource (tenant-scoped)
- ✅ Delete resource (tenant-scoped)
- ✅ Business rule: [Specific rule test]

#### **Integration Tests (API)**
- ✅ POST /api/v1/resource (success)
- ✅ POST /api/v1/resource (validation error)
- ✅ GET /api/v1/resource (paginated list)
- ✅ GET /api/v1/resource/:id (success)
- ✅ GET /api/v1/resource/:id (404 if not found)
- ✅ PATCH /api/v1/resource/:id (success)
- ✅ DELETE /api/v1/resource/:id (success)

#### **Tenant Isolation Tests**
- ✅ Cannot list other tenant's resources
- ✅ Cannot view other tenant's resource by ID
- ✅ Cannot update other tenant's resource
- ✅ Cannot delete other tenant's resource

#### **RBAC Tests**
- ✅ Owner can create
- ✅ Employee cannot create
- ✅ [Other role-specific tests]

---

### **Frontend Tests**

#### **Component Tests**
- ✅ {Resource}Card renders correctly
- ✅ {Resource}Card calls onSelect when clicked
- ✅ {Resource}Form validates required fields
- ✅ {Resource}Form submits data correctly
- ✅ {Resource}Form shows error modal on failure

#### **Integration Tests**
- ✅ Create resource flow (end-to-end)
- ✅ Edit resource flow
- ✅ Delete resource flow (with confirmation)

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend**
- [ ] All database tables created with migrations
- [ ] All API endpoints implemented and tested
- [ ] 100% API documentation generated
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] Tenant isolation tests passing
- [ ] RBAC tests passing
- [ ] Swagger documentation complete

### **Frontend**
- [ ] All pages/routes implemented
- [ ] All components built
- [ ] Modern UI elements used (autocomplete, masked inputs, modals)
- [ ] Multi-step forms (if >5 fields)
- [ ] Mobile responsive
- [ ] Loading/error states handled
- [ ] Component tests >70% coverage
- [ ] E2E tests for critical flows passing

### **Integration**
- [ ] Frontend successfully calls all backend endpoints
- [ ] Error handling works (modals, retry)
- [ ] Success feedback works (modals, redirects)
- [ ] Navigation works (links support right-click)

### **Documentation**
- [ ] Backend API docs complete (100% endpoints)
- [ ] README updated (if needed)
- [ ] User documentation (if needed)

---

## Open Questions

[List any unresolved questions or decisions needed]

1. **Question**: [Description]
   - **Options**: A, B, C
   - **Decision needed by**: [Date or person]
   - **Blocker**: Yes/No

2. **Question**: [Description]
   - **Options**: A, B
   - **Decision needed by**: [Date or person]
   - **Blocker**: Yes/No

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| [Description] | High/Medium/Low | High/Medium/Low | [How to mitigate] |
| [Description] | High/Medium/Low | High/Medium/Low | [How to mitigate] |

---

## Timeline Estimate

**Backend Development**: [X days]  
**Frontend Development**: [X days]  
**Integration & Testing**: [X days]  
**Total**: [X days]

**Dependencies may affect timeline.**

---

## Notes

[Any additional context, considerations, or technical details]

---

**End of Feature Contract**

This contract must be approved before development begins.