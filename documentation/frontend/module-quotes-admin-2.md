# Admin Frontend Dev 2: Template Management UI

**Developer**: Frontend Developer 2  
**Duration**: 6 days  
**Prerequisites**: Read `ADMIN_FRONTEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Build template management interface:
- Template library (list view)
- Template CRUD operations
- Template metadata editor
- Usage statistics display

---

## PAGES TO BUILD

### 1. Template Library (`/admin/templates`)

**API Endpoint**: `GET /admin/quotes/templates`

**Layout**:
- Search bar (filter by name)
- Filter: Type (PDF, Email, Web), Scope (Global, Tenant-specific), Status (Active, Inactive)
- Sort: Name, Usage Count, Created Date
- Grid or table view toggle

**Template Card/Row**:
- Template thumbnail (preview)
- Name, description
- Type badge, Global badge (if global)
- Usage count
- Default badge (if default)
- Actions: Edit, Clone, Delete, Set as Default

**Empty State**: "No templates yet. Create your first template."

---

### 2. Create Template Page (`/admin/templates/new`)

**API Endpoint**: `POST /admin/quotes/templates`

**Form Sections**:

**Basic Info**:
- Template name (required)
- Description (textarea)
- Template type: PDF, Email, Web (radio)

**Scope**:
- Global (available to all tenants)
- Tenant-specific (select tenant from dropdown)

**Initial Content**:
- Start from blank
- Start from existing template (clone selector)
- Use preset (select from library)

**Actions**:
- Save as Draft
- Save and Edit in Builder
- Cancel

---

### 3. Edit Template Metadata (`/admin/templates/:id/edit`)

**API Endpoint**: `PATCH /admin/quotes/templates/:id`

**Form**:
- Name (editable)
- Description (editable)
- Type (read-only after creation)
- Scope (read-only)
- Is Active toggle
- Is Default toggle (with warning if changing)

**Danger Zone**:
- Delete template button (with confirmation)

**Usage Stats Display**:
- Currently used by X tenants
- Used in Y quotes total
- Last used: [date]

**Version History**:
- Link to version history (if implemented by Backend Dev 5)

---

### 4. Template Details View (`/admin/templates/:id`)

**API Endpoint**: `GET /admin/quotes/templates/:id`

**Tabs**:

**Overview Tab**:
- Template info
- Preview (iframe or screenshot)
- Usage statistics

**Settings Tab**:
- Edit metadata form

**Version History Tab**:
- List of versions
- Compare versions
- Restore version

**Testing Tab**:
- Preview with sample data
- Test PDF generation
- Test email rendering
- Validate syntax

---

### 5. Clone Template Modal

**API Endpoint**: `POST /admin/quotes/templates/:id/clone`

**Form**:
- New template name (pre-filled with "Copy of...")
- Description (copied from original)
- Make global toggle
- Clone button

---

### 6. Delete Template Confirmation

**Checks**:
- If usage_count > 0: Show error "Cannot delete template in use by X tenants"
- If is_default: Show error "Cannot delete default template. Set another template as default first."

**Confirmation Modal**:
```
Delete Template "[Name]"?

This action cannot be undone.

Type "DELETE" to confirm: [input]

[Cancel] [Delete Template]
```

---

### 7. Set Default Template

**API Endpoint**: `PATCH /admin/quotes/templates/:id` (set is_default = true)

**Warning Modal**:
```
Set "[Name]" as Default Template?

This will replace the current default template.
All new quotes will use this template unless tenants
have selected a custom template.

[Cancel] [Set as Default]
```

---

### 8. Template Usage Statistics Page

**API Endpoint**: `GET /admin/quotes/templates/:id/usage-count`

**Display**:
- Chart: Usage over time
- Table: Tenants using this template
  - Tenant name
  - Quote count using template
  - Last used date
- Export usage report button

---

## COMPONENTS TO BUILD

**TemplateCard** (grid view):
- Thumbnail image
- Name, description (truncated)
- Badges
- Actions menu

**TemplateRow** (table view):
- Columns: Name, Type, Scope, Usage, Status, Created, Actions

**TemplatePreview**:
- Iframe showing rendered template
- Device selector (desktop, tablet, mobile)
- Zoom controls

**UsageStatsWidget**:
- Count display
- Trend indicator
- "View Details" link

---

## STATE MANAGEMENT

- Template list
- Filter/sort state
- Selected template
- Form data

---

## TESTING REQUIREMENTS

Test:
- List templates (with filters)
- Create new template
- Edit template metadata
- Clone template
- Delete template (with usage protection)
- Set default template
- View usage statistics

---

## DELIVERABLES

1. Template library page
2. Create template page
3. Edit template page
4. Template details page
5. Clone/delete modals
6. Template cards and rows
7. Preview component
8. Tests

---

## COMPLETION CRITERIA

- Template list works
- CRUD operations functional
- Usage stats display
- Default template management
- Deletion protection works
- Tests pass