# 🎯 QUOTE TEMPLATE BUILDER - COMPLETE FEATURE SPECIFICATION

**Priority**: 🔴 **CRITICAL - START IMMEDIATELY**  
**Sprint**: Current Sprint (ASAP)  
**Module**: Quote Management  
**Complexity**: HIGH  

---

## 📋 FEATURE CONTRACT

### **Purpose**

Enable Platform Admins and Tenant Admins to create, customize, and manage professional quote PDF templates using a visual drag-and-drop builder with comprehensive variable support, section libraries, and automatic layout capabilities.

---

### **Scope**

#### **IN SCOPE**

1. **Visual Template Builder**
   - Drag-and-drop interface
   - WYSIWYG editor
   - Live preview
   - Variable insertion
   - Section library

2. **Template Management**
   - Create templates (global or tenant-specific)
   - Clone templates
   - Edit templates
   - Delete templates
   - Set active template per tenant

3. **Variable System**
   - 65+ variables organized by category
   - Tenant branding (colors, logo)
   - Customer/Lead data
   - Quote data
   - Items/Groups loops
   - Draw schedule loops
   - Attachments with grid layouts
   - QR codes
   - Vendor data
   - Special variables (page breaks, page numbers)

4. **Section Library**
   - Pre-built sections (customer block, items table, terms)
   - Platform Admin can create custom sections
   - Sections use existing variables
   - Drag sections into template

5. **Layout Features**
   - Multi-page support (cover, intro, items, final)
   - Header/footer (optional, repeats on all pages)
   - Page numbers (optional)
   - Manual page breaks
   - Grid layouts for images (2x2, 4x4, 6x6, 1x1 full)

6. **Template Permissions**
   - Platform Admin: Create global + tenant-specific templates
   - Tenant Admin: Create/clone/customize tenant templates
   - All roles: View available templates

#### **OUT OF SCOPE**

1. Template versioning (templates don't version)
2. Retroactive PDF regeneration (quotes store rendered PDF)
3. Real-time collaborative editing
4. Custom fonts (use system fonts only)
5. Advanced CSS editing (use visual controls only)
6. Template marketplace
7. Template import/export (Phase 2)

---

### **User Roles & Permissions**

| Role | Create Global | Create Tenant-Specific | Edit Own Templates | Clone Templates | Set Active Template | Delete Templates |
|------|---------------|------------------------|-------------------|-----------------|---------------------|------------------|
| **Platform Admin** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Any | ✅ Any Tenant | ✅ If Not In Use |
| **Tenant Admin** | ❌ No | ✅ Yes (Own Tenant) | ✅ Yes | ✅ Global + Own | ✅ Own Tenant | ✅ If Not In Use |
| **Manager** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |
| **Sales** | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No | ❌ No |

---

### **Data Ownership**

| Entity | Owner | Multi-Tenant Isolation |
|--------|-------|----------------------|
| **Global Template** | Platform | `tenant_id = NULL`, `is_global = true` |
| **Tenant Template** | Tenant | `tenant_id = <UUID>`, `is_global = false` |
| **Section Library** | Platform | `tenant_id = NULL` |
| **Template Variables** | System | Hardcoded schema (not stored) |

---

## 🔧 BACKEND ENHANCEMENTS

### **New Endpoints Required**

#### **1. Variables Endpoint (Enhanced)**

**Current Endpoint**: `GET /admin/quotes/templates/variables/schema`  
**Enhancement**: Return variables **grouped by category** for UI consumption

**Response Structure**:
```json
{
  "categories": {
    "tenant_branding": {
      "label": "Company Branding",
      "description": "Company logo, colors, contact info",
      "variables": [
        {
          "key": "tenant.company_name",
          "label": "Company Name",
          "type": "string",
          "example": "Acme Painting Co.",
          "required": true
        },
        {
          "key": "tenant.logo_url",
          "label": "Company Logo",
          "type": "image",
          "example": "https://cdn.example.com/logo.png",
          "required": false
        },
        {
          "key": "tenant.primary_color",
          "label": "Primary Brand Color",
          "type": "color",
          "example": "#3498db",
          "required": true
        }
      ]
    },
    "quote_data": { /* ... */ },
    "customer_data": { /* ... */ },
    "items_groups": { /* ... */ },
    "draw_schedule": { /* ... */ },
    "attachments": { /* ... */ },
    "totals": { /* ... */ },
    "vendor": { /* ... */ },
    "special": { /* ... */ }
  }
}
```

**New Variables to Add**:
- `tenant.primary_color`
- `tenant.secondary_color`
- `tenant.accent_color` (tertiary)
- `tenant.logo_url` (resolved from `logo_file_id`)
- `page_break` (special Handlebars helper)
- `page_number` (special variable)
- `total_pages` (special variable)
- `qr_codes` (array for multiple QR codes)

---

#### **2. Section Library Endpoints**

**Purpose**: Platform Admin can create reusable template sections

##### **A. List Sections**
- **Endpoint**: `GET /admin/quotes/template-sections`
- **RBAC**: Platform Admin
- **Returns**: All available sections (name, description, html_content, category)

##### **B. Create Section**
- **Endpoint**: `POST /admin/quotes/template-sections`
- **RBAC**: Platform Admin
- **Request Body**:
  - `name` (string, required)
  - `description` (string, optional)
  - `category` (enum: customer_block, items_table, terms_block, custom)
  - `html_content` (string, required) - HTML using Handlebars variables
  - `thumbnail_url` (string, optional)

##### **C. Update Section**
- **Endpoint**: `PATCH /admin/quotes/template-sections/:id`
- **RBAC**: Platform Admin

##### **D. Delete Section**
- **Endpoint**: `DELETE /admin/quotes/template-sections/:id`
- **RBAC**: Platform Admin
- **Validation**: Cannot delete if used in templates (unless forced)

##### **E. Preview Section**
- **Endpoint**: `POST /admin/quotes/template-sections/:id/preview`
- **RBAC**: Platform Admin
- **Request Body**: `sample_data` (JSON with variable values)
- **Returns**: Rendered HTML preview

---

#### **3. Template Preview Endpoint**

- **Endpoint**: `POST /admin/quotes/templates/:id/preview`
- **RBAC**: Platform Admin, Tenant Admin (own templates)
- **Request Body**: 
  - `quote_id` (optional) - Use real quote data
  - `sample_data` (optional) - Use mock data
- **Returns**: Rendered HTML (not PDF) for live preview

---

#### **4. Template Validation Endpoint**

- **Endpoint**: `POST /admin/quotes/templates/validate`
- **RBAC**: Platform Admin, Tenant Admin
- **Request Body**: `html_content` (string)
- **Returns**: 
  - `valid` (boolean)
  - `errors` (array of syntax errors)
  - `warnings` (array of missing variables)
  - `variables_used` (array of detected variables)

---

#### **5. Grid Layout Helper (Backend Logic)**

**Purpose**: Automatically arrange attachments in grids

**Grid Configurations**:
- `1x1` (full) - One image, full width
- `2x2` - Four images in 2 rows, 2 columns
- `4x4` - Sixteen images in 4 rows, 4 columns
- `6x6` - Thirty-six images in 6 rows, 6 columns

**Handlebars Helper**:
```handlebars
{{#grid_layout attachments layout="2x2"}}
  <img src="{{this.url}}" alt="{{this.filename}}" />
{{/grid_layout}}
```

**Backend Responsibility**:
- Register custom Handlebars helper `grid_layout`
- Accept `layout` parameter (2x2, 4x4, 6x6, 1x1)
- Generate appropriate HTML with CSS classes
- Handle missing images (show placeholder)

---

#### **6. Enhanced Template Permissions**

**New Field**: `template.created_for_tenant_id`

**Rules**:
- Platform Admin creating tenant-specific template: Set `created_for_tenant_id = <tenant_id>`
- Tenant Admin creating template: Set `created_for_tenant_id = <own_tenant_id>`
- Global templates: `created_for_tenant_id = NULL`, `is_global = true`

**Visibility Logic**:
- Tenant sees: Global templates + templates where `created_for_tenant_id = <tenant_id>`
- Platform Admin sees: All templates

---

### **New Database Tables**

#### **template_section**

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(36) PK | UUID |
| `name` | VARCHAR(200) | Section name |
| `description` | TEXT | Optional description |
| `category` | ENUM | customer_block, items_table, terms_block, custom |
| `html_content` | LONGTEXT | Handlebars HTML |
| `thumbnail_url` | VARCHAR(500) | Preview image |
| `is_active` | BOOLEAN | Active status |
| `order_index` | INT | Display order |
| `created_by_user_id` | VARCHAR(36) FK | Creator (Platform Admin) |
| `created_at` | DATETIME | Creation timestamp |
| `updated_at` | DATETIME | Last update |

**Indexes**:
- `@@index([category, is_active])`
- `@@index([order_index])`

---

### **Enhanced quote_template Table**

**Add Fields**:
- `created_for_tenant_id` (VARCHAR(36), nullable) - Tenant this template was created for
- `has_header` (BOOLEAN, default false) - Template includes header
- `has_footer` (BOOLEAN, default false) - Template includes footer
- `has_page_numbers` (BOOLEAN, default false) - Show page numbers
- `header_html` (TEXT, nullable) - Header HTML
- `footer_html` (TEXT, nullable) - Footer HTML

---

## 🎨 FRONTEND IMPLEMENTATION

### **New Pages Required**

#### **1. Template Builder Page**

**Route**: `/admin/templates/builder/:id?`  
**Permissions**: Platform Admin, Tenant Admin  
**Purpose**: Visual editor for creating/editing templates

**Layout**:
```
[Header: Template Builder] [Save Draft] [Preview] [Publish]

[Left Sidebar: Section Library]
  - Search sections
  - Category filter
  - Drag section to canvas

[Center: Canvas]
  - WYSIWYG editor
  - Drop zones for sections
  - Click to edit text/variables
  - Live preview mode toggle

[Right Sidebar: Variable Browser]
  - Search variables
  - Category accordion
  - Click to insert at cursor
  - Preview variable output
```

**Functionality**:
- Drag sections from library
- Click to insert variables
- Edit text inline
- Format text (bold, italic, size)
- Add page breaks
- Configure header/footer
- Live preview
- Save draft
- Publish template

---

#### **2. Template Management Page**

**Route**: `/admin/templates`  
**Permissions**: Platform Admin, Tenant Admin  
**Purpose**: List all templates, create new, set active

**Layout**:
```
[Header: Quote Templates] [Create Template]

[Filter Bar]
  - Global / Tenant-specific toggle
  - Active / Inactive toggle
  - Search by name

[Template Grid]
  - Template cards (thumbnail, name, description)
  - Actions: Edit, Clone, Delete, Preview
  - Active badge
  - Set Active button
```

---

#### **3. Section Library Management Page**

**Route**: `/admin/template-sections`  
**Permissions**: Platform Admin only  
**Purpose**: Manage reusable sections

**Layout**:
```
[Header: Template Sections] [Create Section]

[Section List]
  - Section cards (preview, name, category)
  - Actions: Edit, Delete, Preview
```

---

### **New Components Required**

#### **1. TemplateCanvas Component**

**Purpose**: Main editing area with drop zones

**Features**:
- Drag-and-drop sections
- Inline text editing
- Variable insertion at cursor
- Undo/redo
- Zoom controls

---

#### **2. SectionLibrary Component**

**Purpose**: Left sidebar with draggable sections

**Features**:
- Search/filter sections
- Category grouping
- Drag to canvas
- Preview on hover

---

#### **3. VariableBrowser Component**

**Purpose**: Right sidebar with variable list

**Features**:
- Search variables
- Category accordion (tenant_branding, quote_data, etc.)
- Click to insert
- Copy variable syntax
- Preview output

---

#### **4. GridLayoutConfigurator Component**

**Purpose**: Configure image grid layouts

**Features**:
- Select grid type (2x2, 4x4, 6x6, 1x1)
- Preview grid with sample images
- Insert grid helper syntax

---

#### **5. HeaderFooterEditor Component**

**Purpose**: Configure repeating header/footer

**Features**:
- Toggle header/footer on/off
- Edit header HTML
- Edit footer HTML
- Variable insertion
- Preview on sample pages

---

#### **6. PageBreakInserter Component**

**Purpose**: Insert manual page breaks

**Features**:
- Click to insert at cursor
- Visual indicator on canvas
- Remove page break

---

### **User Flows**

#### **Flow 1: Platform Admin Creates Tenant-Specific Template**

1. Platform Admin logs in
2. Navigates to `/admin/templates`
3. Clicks "Create Template"
4. Modal opens: "Create Template"
   - Name: [input]
   - Description: [textarea]
   - Type: [Radio: Global / Tenant-Specific]
   - If Tenant-Specific: [Tenant Selector Dropdown]
5. Clicks "Create"
6. Redirects to `/admin/templates/builder/:new_id`
7. Drags "Customer Info Block" from Section Library
8. Drags "Items Table" section
9. Clicks "Insert Variable" → Selects `tenant.logo_url`
10. Logo inserted at cursor
11. Clicks "Preview"
12. Live preview shows rendered template with sample data
13. Clicks "Publish"
14. Success modal: "Template published!"
15. Redirects to `/admin/templates`

---

#### **Flow 2: Tenant Admin Clones and Customizes Global Template**

1. Tenant Admin logs in
2. Navigates to `/admin/templates`
3. Sees global template "Modern Professional Quote"
4. Clicks "Clone"
5. Modal: "Clone Template"
   - New Name: "Modern Professional Quote - Custom"
6. Clicks "Clone"
7. Redirects to `/admin/templates/builder/:cloned_id`
8. Template opens with all sections from original
9. Admin changes colors to match tenant branding
10. Admin adds custom footer text
11. Clicks "Save Draft"
12. Success message: "Draft saved"
13. Clicks "Publish"
14. Template now available for tenant
15. Admin clicks "Set Active"
16. Confirmation: "Set this template as active for all new quotes?"
17. Clicks "Confirm"
18. Success: "Active template updated"

---

#### **Flow 3: Adding Grid Layout for Attachments**

1. User in Template Builder
2. Clicks "Insert Grid Layout" button
3. Modal: "Configure Image Grid"
   - Grid Type: [Dropdown: 2x2, 4x4, 6x6, 1x1 Full]
   - Select: 2x2
4. Preview shows 4 sample images in 2x2 grid
5. Clicks "Insert"
6. Grid helper syntax inserted:
   ```handlebars
   {{#grid_layout attachments layout="2x2"}}
     <img src="{{this.url}}" alt="{{this.filename}}" />
   {{/grid_layout}}
   ```
7. User sees visual grid indicator on canvas

---

### **Edge Cases & Validation**

#### **Edge Case 1: Tenant Tries to Edit Global Template**

**Scenario**: Tenant Admin clicks "Edit" on global template

**Expected Behavior**:
- Error modal: "You cannot edit global templates. Clone this template to customize it."
- Buttons: [Cancel] [Clone Template]

---

#### **Edge Case 2: Delete Template In Use**

**Scenario**: Platform Admin tries to delete template used by 15 quotes

**Expected Behavior**:
- Error modal: "Cannot delete template. It is used in 15 quote(s). You can set it to inactive instead."
- Buttons: [Cancel] [Set Inactive]

---

#### **Edge Case 3: Invalid Handlebars Syntax**

**Scenario**: User types invalid variable syntax `{{invalid.var}}`

**Expected Behavior**:
- Real-time validation shows warning icon
- Tooltip: "Variable 'invalid.var' does not exist. View available variables in the right panel."
- Can still save as draft
- Cannot publish until fixed

---

#### **Edge Case 4: Missing Required Variables**

**Scenario**: Template missing `{{quote.number}}`

**Expected Behavior**:
- Validation on publish warns: "Your template is missing the quote number. This is recommended."
- Buttons: [Cancel] [Publish Anyway]

---

#### **Edge Case 5: Grid Layout with Insufficient Images**

**Scenario**: Template uses 4x4 grid but quote only has 3 attachments

**Expected Behavior**:
- Backend renders 3 images with empty placeholders
- Or: Scales down to 2x2 automatically
- Or: Shows 3 images with blank spaces (configurable)

---

## 📊 VARIABLE SYSTEM - COMPLETE REFERENCE

### **Category: Tenant Branding**

| Variable | Type | Description | Example | Required |
|----------|------|-------------|---------|----------|
| `tenant.company_name` | string | Company name | "Acme Painting Co." | ✅ |
| `tenant.logo_url` | image | Company logo URL | "https://cdn.../logo.png" | ❌ |
| `tenant.primary_color` | color | Primary brand color | "#3498db" | ✅ |
| `tenant.secondary_color` | color | Secondary brand color | "#2c3e50" | ✅ |
| `tenant.accent_color` | color | Accent/tertiary color | "#e74c3c" | ✅ |
| `tenant.phone` | string | Company phone | "(555) 123-4567" | ❌ |
| `tenant.email` | string | Company email | "info@acme.com" | ❌ |
| `tenant.website` | string | Company website | "www.acme.com" | ❌ |
| `tenant.address.line1` | string | Address line 1 | "123 Main St" | ❌ |
| `tenant.address.city` | string | City | "Los Angeles" | ❌ |
| `tenant.address.state` | string | State | "CA" | ❌ |
| `tenant.address.zip` | string | Zip code | "90210" | ❌ |

---

### **Category: Quote Data**

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `quote.number` | string | Quote number | "Q-2026-0001" |
| `quote.title` | string | Quote title | "Kitchen Renovation" |
| `quote.status` | string | Status | "sent" |
| `quote.created_at` | date | Created date | "2026-01-15" |
| `quote.expires_at` | date | Expiration date | "2026-02-15" |
| `quote.description` | text | Description | "Complete kitchen remodel" |
| `quote.terms` | text | Terms & conditions | "Payment due upon completion" |
| `quote.payment_instructions` | text | Payment instructions | "Check or cash accepted" |

---

### **Category: Customer/Lead Data**

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `customer.full_name` | string | Full name | "John Smith" |
| `customer.first_name` | string | First name | "John" |
| `customer.last_name` | string | Last name | "Smith" |
| `customer.email` | string | Email | "john@example.com" |
| `customer.phone` | string | Phone | "(555) 987-6543" |
| `customer.address.*` | object | Address fields | (Same as tenant) |

---

### **Category: Items & Groups (Loop)**

```handlebars
{{#each groups}}
  <h3>{{this.name}}</h3>
  <p>{{this.description}}</p>
  
  {{#each this.items}}
    <tr>
      <td>{{this.title}}</td>
      <td>{{this.quantity}}</td>
      <td>{{this.unit}}</td>
      <td>{{this.unit_price}}</td>
      <td>{{this.total_price}}</td>
    </tr>
  {{/each}}
  
  <p>Group Subtotal: {{this.subtotal}}</p>
{{/each}}
```

---

### **Category: Draw Schedule (Loop)**

```handlebars
{{#each draw_schedule}}
  <tr>
    <td>{{this.sequence_number}}</td>
    <td>{{this.description}}</td>
    <td>{{this.percentage}}%</td>
    <td>${{this.amount}}</td>
    <td>{{this.due_date}}</td>
  </tr>
{{/each}}
```

---

### **Category: Attachments with Grid Layout**

```handlebars
{{#grid_layout attachments layout="2x2"}}
  <img src="{{this.url}}" alt="{{this.filename}}" />
{{/grid_layout}}
```

**Grid Options**: `2x2`, `4x4`, `6x6`, `1x1`

---

### **Category: Totals**

| Variable | Type | Description | Example |
|----------|------|-------------|---------|
| `totals.subtotal` | currency | Subtotal | "$12,500.00" |
| `totals.profit_amount` | currency | Profit | "$2,500.00" |
| `totals.overhead_amount` | currency | Overhead | "$1,250.00" |
| `totals.discount_amount` | currency | Discount | "$500.00" |
| `totals.tax_amount` | currency | Tax | "$750.00" |
| `totals.total` | currency | Total | "$16,375.00" |

---

### **Category: Vendor**

| Variable | Type | Description |
|----------|------|-------------|
| `vendor.name` | string | Vendor name |
| `vendor.email` | string | Vendor email |
| `vendor.phone` | string | Vendor phone |
| `vendor.signature_url` | image | Signature image |

---

### **Category: Special Variables**

| Variable | Type | Description | Usage |
|----------|------|-------------|-------|
| `{{page_break}}` | helper | Force new page | `{{page_break}}` |
| `{{page_number}}` | number | Current page | `Page {{page_number}}` |
| `{{total_pages}}` | number | Total pages | `of {{total_pages}}` |

---

## ✅ ACCEPTANCE CRITERIA

### **Template Builder**

- [ ] Platform Admin can create global templates
- [ ] Platform Admin can create tenant-specific templates for any tenant
- [ ] Tenant Admin can create templates for own tenant only
- [ ] Tenant Admin can clone global templates
- [ ] Visual editor supports drag-and-drop sections
- [ ] Variable browser shows all 65+ variables grouped by category
- [ ] Click to insert variable at cursor position
- [ ] Live preview shows rendered template with sample data
- [ ] Save draft preserves work in progress
- [ ] Publish makes template available for use

### **Section Library**

- [ ] Platform Admin can create custom sections
- [ ] Sections use Handlebars variables
- [ ] Sections organized by category
- [ ] Drag section to canvas inserts HTML
- [ ] Preview section with sample data

### **Grid Layouts**

- [ ] Grid helper supports 2x2, 4x4, 6x6, 1x1 layouts
- [ ] Automatically arranges attachments in grid
- [ ] Handles insufficient images (placeholders or scaling)
- [ ] Grid renders correctly in PDF

### **Header/Footer**

- [ ] Optional header/footer configuration
- [ ] Header/footer repeats on all pages
- [ ] Supports variables in header/footer
- [ ] Preview shows header/footer on sample pages

### **Page Breaks & Numbers**

- [ ] Manual page break insertion
- [ ] Page numbers display correctly
- [ ] Total pages calculated accurately
- [ ] Page breaks render in PDF

### **Variables**

- [ ] All 65+ variables documented
- [ ] Variables grouped by category in UI
- [ ] Search/filter variables
- [ ] Variables render correctly in PDF
- [ ] Missing variables show warning (not error)

### **Validation**

- [ ] Invalid Handlebars syntax shows error
- [ ] Missing recommended variables show warning
- [ ] Cannot publish with syntax errors
- [ ] Can save draft with warnings

### **Permissions**

- [ ] Platform Admin sees all templates
- [ ] Tenant Admin sees global + own tenant templates
- [ ] Cannot edit global template (must clone)
- [ ] Cannot delete template in use

---

## 🚀 IMPLEMENTATION PRIORITY

### **Phase 1: Backend Core (Week 1)**

1. Enhanced variables endpoint (grouped by category)
2. Section library CRUD endpoints
3. Template preview endpoint
4. Template validation endpoint
5. Grid layout Handlebars helper
6. Enhanced template permissions logic

### **Phase 2: Frontend Core (Week 2)**

1. Template management page
2. Template builder page (basic)
3. Variable browser component
4. Section library component (viewing only)

### **Phase 3: Advanced Features (Week 3)**

1. Drag-and-drop functionality
2. WYSIWYG editing
3. Live preview
4. Grid layout configurator
5. Header/footer editor
6. Page break insertion

### **Phase 4: Polish & Testing (Week 4)**

1. Section library management page
2. Validation UI
3. Error handling
4. Mobile responsiveness
5. Integration testing
6. User acceptance testing

---

## 🎯 SUCCESS METRICS

1. **Platform Admin can create template in < 15 minutes**
2. **Tenant Admin can clone and customize in < 10 minutes**
3. **All 65+ variables accessible via UI**
4. **Grid layouts render correctly 100% of time**
5. **Zero syntax errors in published templates**
6. **Templates generate PDFs within 5 seconds**

---

## 📝 OPEN QUESTIONS

None - All questions answered.

---

## 🔄 DEPENDENCIES

### **Existing Systems**

- Quote PDF Generator Service (uses templates)
- File Storage Service (logo, signatures)
- Tenant Branding (colors from tenant table)
- Quote data structure (items, groups, draw schedule)

### **Must Be Complete Before**

- None - Can start immediately

### **Blocks Future Work**

- Sprint 5: PDF Templates + Branding
- Sprint 6: Customer Portal (needs templates)

---

## ⚠️ RISKS & MITIGATIONS

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| WYSIWYG editor complexity | High | Medium | Use proven library (TinyMCE, Quill) |
| Handlebars security (XSS) | High | Low | Sanitize all user input, escape HTML |
| Grid layout rendering issues | Medium | Medium | Extensive testing with sample images |
| Performance (large templates) | Medium | Low | Limit template size, optimize rendering |
| User error (breaking syntax) | Low | High | Real-time validation, syntax highlighting |

---

# 🎉 READY TO BUILD

**This document provides**:
- ✅ Complete feature specification
- ✅ All requirements structured
- ✅ Backend API definitions
- ✅ Frontend component requirements
- ✅ User flows documented
- ✅ Edge cases identified
- ✅ Validation rules defined
- ✅ Acceptance criteria clear

**Next Steps**:
1. Backend team implements Phase 1 (Week 1)
2. Frontend team implements Phase 2 (Week 2)
3. Both teams collaborate on Phase 3 (Week 3)
4. Testing & polish Phase 4 (Week 4)

**Estimated Timeline**: 4 weeks  
**Team Size**: 10 developers (5 backend, 5 frontend) + 2 reviewers  

---

**Questions? Clarifications needed? Ready to start?** 🚀