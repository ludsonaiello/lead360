# Quote Module - Feature Contract

**Document Type**: Master Feature Contract  
**Module**: Quote Management System  
**Status**: Draft - Awaiting Approval  
**Version**: 1.0  
**Date**: January 22, 2026  
**Complexity**: Very High (Largest module in platform)

---

## 📋 DOCUMENT PURPOSE

This contract defines the complete scope, data model, business rules, and requirements for the Quote Management System. This is the authoritative source of truth for all developers working on this module.

**This contract answers**:
- WHAT needs to be built
- WHY each feature exists
- WHAT the business rules are
- WHAT the data relationships are
- WHAT the user workflows are

**This contract does NOT contain**:
- Code examples
- Implementation details
- Technology choices (developers decide)
- "How to code it" instructions

---

## 🎯 MODULE PURPOSE

### Business Problem
Service businesses need to create detailed, professional quotes that:
- Calculate complex pricing (costs, markup, profit, overhead, taxes)
- Present professionally with company branding
- Track customer interactions and conversions
- Provide approval workflows for quality control
- Enable easy reuse of common items and templates
- Convert to projects and invoices when approved

### User Needs

**For Estimators**:
- Create quotes quickly using saved items and templates
- Calculate pricing automatically with margin protection
- Clone similar quotes to save time
- Get approval before sending expensive quotes

**For Managers**:
- Approve quotes before they go to customers
- Track quote pipeline and conversion rates
- Ensure profitability on all quotes
- Analyze pricing trends

**For Business Owners**:
- Maintain consistent branding
- Control quote templates globally
- View revenue pipeline
- Protect profit margins

**For Customers**:
- View professional quotes online
- See detailed breakdown of costs
- Understand payment options
- Digitally approve quotes

---

## 📊 SCOPE DEFINITION

### In Scope ✅

**Core Quote Functionality**:
- Create quotes manually or from leads
- Multi-vendor system (N vendors per tenant)
- Item-based pricing with cost breakdown
- Grouped items with subtotals
- Drag & drop item/group ordering
- Item library for reuse
- Quote cloning and duplication
- Version history with comparison
- Change orders after approval

**Pricing & Calculations**:
- Cost per item: Material + Labor + Equipment + Subcontract + Other
- Profit, overhead, contingency calculations
- Item-level overrides (markup, discount, tax)
- Quote-level discount rules
- Tax calculations
- Draw schedule with percentage/fixed amount
- Real-time profitability warnings

**Template System**:
- Admin creates global templates (all tenants)
- Admin creates tenant-specific templates
- Visual HTML/CSS template editor
- Handlebars variable system
- Image placeholders
- Tenant selects active template
- Tenants cannot create templates (Phase 1)

**Media & Attachments**:
- Cover photo (single)
- Full-page photos (multiple, one per page)
- Grid photos (2, 4, or 6 per page)
- Attachment URLs with auto-generated QR codes
- Vendor signature image

**Workflow & Status**:
- Status pipeline: Draft → Ready → Sent → Read → Approved → Denied → Lost
- Internal approval workflow (multi-level)
- Approval thresholds by quote value
- Status change triggers (lead → prospect, quote → project)

**Sharing & Access**:
- Public URL generation with optional password
- View tracking (IP, timestamp, duration)
- Auto-status change to "Read" on first view
- Email sending integration
- SMS notification readiness (infrastructure only)
- PDF download and server storage

**Organization & Search**:
- Custom tags per tenant (multi-select)
- Search by customer, city, tag, status, date, item name
- Filter by multiple criteria
- Pagination

**Analytics & Dashboards**:
- Tenant dashboard: quotes by status, revenue, conversion rate
- Admin dashboard: global stats, filter by tenant
- Average pricing per task/item
- Quote velocity tracking
- Loss reason analysis

**Bundle/Package System**:
- Tenants create custom bundles
- Bundle = pre-configured group of items
- Bundle pricing with optional discounts

**Payment Options**:
- Payment terms display
- Draw schedule configuration
- Foundation for financing module

**Warranty Tiers**:
- Optional warranty per item
- Multiple warranty levels
- Price impact tracking

### Out of Scope ❌

**Phase 1 Exclusions**:
- Tenants creating templates (admin only)
- SMS sending (infrastructure ready, not active)
- Project conversion (creates project record, no project management)
- Invoice generation (creates financial record, no invoice module)
- Real-time collaboration (single user editing)
- AI quote generation (endpoints ready, no AI yet)
- Material price tracking APIs
- Video attachments (URL only)
- Interactive customer pricing (customer cannot modify)

**Future Phases**:
- Advanced AI suggestions
- Supplier integrations
- Real-time material pricing
- Customer self-service modifications
- Multi-currency support

---

## 🗄️ DATA MODEL

### Core Entities

#### 1. Quote (Main Entity)

**Purpose**: The master quote record containing all quote-level information.

**Ownership**: Tenant-scoped (requires tenant_id)

**Key Attributes**:
- Unique identifier
- Quote number (human-readable, auto-generated per tenant)
- Title
- Status (enum: draft, ready, sent, read, approved, denied, lost)
- Relationships to customer/lead, vendor, jobsite address
- Default settings (profit, overhead, contingency, terms, etc.)
- Override flags (use defaults or custom values)
- PO number
- Private notes (global for quote)
- Validity period (expiration date)
- Created by user, timestamps
- Active version reference

**Relationships**:
- Belongs to: Tenant, Customer/Lead, Vendor
- Has many: Items, Groups, Versions, Approvals, View Logs, Tags, Attachments, Photos
- Has one: Jobsite Address

**Business Rules**:
- Quote number must be unique per tenant
- Quote number format: tenant-defined prefix + sequential number
- Cannot delete quote if status is "approved" (must archive)
- Expiration date must be after creation date
- Status transitions must follow allowed flow
- Customer/Lead required (either existing or create new)
- At least one item or group required before status = "ready"

---

#### 2. Quote Version

**Purpose**: Track all changes to quotes over time for audit trail and comparison.

**Ownership**: Tenant-scoped via parent quote

**Key Attributes**:
- Version number (auto-increment per quote)
- Complete snapshot of quote data (JSON)
- Changed by user
- Change summary
- Timestamp

**Relationships**:
- Belongs to: Quote
- References: User (who made changes)

**Business Rules**:
- New version created on every save
- Version 1.0 is initial creation
- Minor versions for small edits (1.1, 1.2)
- Major versions for significant changes (2.0, 3.0)
- Cannot delete versions (audit trail)
- Cannot modify past versions

---

#### 3. Quote Item

**Purpose**: Individual line items in a quote with detailed cost and pricing.

**Ownership**: Tenant-scoped via parent quote

**Key Attributes**:
- Title (required)
- Description (optional, rich text)
- Quantity (required, decimal)
- Unit measurement (required, FK to unit_measurement)
- Order index (for drag & drop sorting)
- Cost breakdown:
  - Material cost per unit
  - Labor cost per unit
  - Equipment cost per unit
  - Subcontract cost per unit
  - Other cost per unit
- Price calculation inputs:
  - Base profit percentage
  - Base overhead percentage
  - Base contingency percentage
- Overrides (optional):
  - Custom markup percentage
  - Custom discount amount or percentage
  - Custom tax rate
- Calculated fields (not stored, computed):
  - Total cost per unit
  - Total cost (quantity × cost per unit)
  - Price per unit (after profit/overhead/contingency)
  - Total price (quantity × price per unit)
- Private notes (not visible to customer)
- Group assignment (optional, FK to quote_group)
- Save to library flag

**Relationships**:
- Belongs to: Quote, Unit Measurement
- Optionally belongs to: Quote Group
- Can reference: Item Library entry

**Business Rules**:
- Quantity must be > 0
- At least one cost field must be > 0
- Unit measurement required
- Cannot have negative costs
- Overrides are optional (use quote defaults if not specified)
- Order index determines display sequence
- When group assigned, must respect group ordering
- If "save to library" checked, create Item Library entry on save

---

#### 4. Quote Group

**Purpose**: Organize related items into logical sections with subtotals.

**Ownership**: Tenant-scoped via parent quote

**Key Attributes**:
- Name (required)
- Description (optional)
- Order index (for drag & drop sorting)
- Calculated subtotal (sum of all items in group)

**Relationships**:
- Belongs to: Quote
- Has many: Quote Items

**Business Rules**:
- Must have at least one item to display
- Subtotal calculated as sum of all item totals in group
- Order index determines display sequence
- Can be empty during draft (validation on status change)
- Can duplicate group (creates copy with all items)

---

#### 5. Item Library

**Purpose**: Reusable catalog of common items for quick quote building.

**Ownership**: Tenant-scoped

**Key Attributes**:
- Title
- Description (template, can be customized per use)
- Default quantity
- Default unit measurement
- Default costs (material, labor, equipment, subcontract, other)
- Usage count (how many times used)
- Last used date
- Tags for categorization

**Relationships**:
- Belongs to: Tenant, Unit Measurement
- Referenced by: Quote Items (soft reference)

**Business Rules**:
- When item added from library, creates new Quote Item (not linked)
- Library item changes do not affect existing quotes
- Can be edited anytime (affects future uses only)
- Can track usage statistics
- Can search by title, description, tags

---

#### 6. Quote Template

**Purpose**: Reusable PDF templates for quote generation with HTML/CSS and variables.

**Ownership**: Global (tenant_id = NULL) OR Tenant-specific (tenant_id set)

**Key Attributes**:
- Name
- Description
- HTML content (complete HTML/CSS)
- Thumbnail URL (preview screenshot)
- Is global flag
- Is active flag
- Is default flag (one per platform)
- Created by user

**Relationships**:
- Optionally belongs to: Tenant (if tenant-specific)
- Created by: User (admin)

**Business Rules**:
- Admin-only creation and editing
- Global templates available to all tenants
- Tenant-specific templates only visible to that tenant
- Tenant selects one active template from available options
- Must have at least one template (platform default)
- Template uses Handlebars syntax for variables
- Must handle missing variables gracefully (don't crash PDF)
- Image placeholders must support dynamic tenant images

---

#### 7. Vendor

**Purpose**: Company representatives who can be assigned to quotes as the vendor/estimator.

**Ownership**: Tenant-scoped

**Key Attributes**:
- Name (required)
- Email
- Phone
- Address (single address, Google Maps validated)
- Signature image (PNG file)
- Is active flag
- Default vendor flag (one per tenant)

**Relationships**:
- Belongs to: Tenant
- Has many: Quotes
- References: File (for signature image)

**Business Rules**:
- Must have at least one active vendor to create quotes
- Signature image required before quote can be sent
- Address must be Google Maps validated
- Phone must be valid format
- Email must be valid format
- Can have one default vendor (auto-selected on new quotes)

---

#### 8. Unit Measurement

**Purpose**: Standardized units for pricing (sq ft, linear ft, hour, each, etc.)

**Ownership**: Global (admin-created) OR Tenant-specific (tenant_id set)

**Key Attributes**:
- Name (e.g., "Square Foot")
- Abbreviation (e.g., "sq ft")
- Is global flag
- Is active flag

**Relationships**:
- Optionally belongs to: Tenant
- Used by: Quote Items, Item Library

**Business Rules**:
- Admin creates global units (available to all)
- Tenants can create custom units (visible only to them)
- Cannot delete unit if used in any quotes
- Must have at least 10 default global units
- Common units: each, hour, sq ft, linear ft, cubic yard, ton, gallon

---

#### 9. Quote Bundle

**Purpose**: Pre-configured packages of items for quick quote building.

**Ownership**: Tenant-scoped

**Key Attributes**:
- Name
- Description
- Is active flag
- Calculated total price
- Optional bundle discount (percentage or fixed)

**Relationships**:
- Belongs to: Tenant
- Has many: Quote Bundle Items

**Business Rules**:
- Must have at least one item
- Bundle price = sum of items minus bundle discount
- When bundle added to quote, creates individual items (not linked)
- Bundle changes do not affect existing quotes
- Can mark bundles as inactive (hide from selection)

---

#### 10. Quote Bundle Item

**Purpose**: Items included in a bundle definition.

**Ownership**: Tenant-scoped via parent bundle

**Key Attributes**:
- Quantity
- Cost values (same structure as Quote Item)
- Order index

**Relationships**:
- Belongs to: Quote Bundle
- References: Item Library (optional)

**Business Rules**:
- Same validation as Quote Items
- Quantity can differ from library default
- Costs can differ from library default

---

#### 11. Quote Approval

**Purpose**: Track approval workflow for quotes requiring manager/owner approval.

**Ownership**: Tenant-scoped via parent quote

**Key Attributes**:
- Approval level (1 = manager, 2 = owner, etc.)
- Approver user
- Status (pending, approved, rejected)
- Comments
- Timestamp

**Relationships**:
- Belongs to: Quote
- References: User (approver)

**Business Rules**:
- Triggered when quote total exceeds tenant-defined threshold
- Multiple levels supported (configurable per tenant)
- Must approve in sequence (level 1 before level 2)
- Rejection returns quote to draft with comments
- Approval allows progression to next level or "ready" status
- Cannot send quote without required approvals

---

#### 12. Quote Discount Rule

**Purpose**: Define quote-level discounts (early payment, volume, seasonal, etc.)

**Ownership**: Tenant-scoped via parent quote

**Key Attributes**:
- Rule type (percentage or fixed amount)
- Value
- Reason/description
- Applied to subtotal or total

**Relationships**:
- Belongs to: Quote

**Business Rules**:
- Multiple discounts can stack
- Percentage discounts calculated before fixed amount
- Cannot exceed 100% discount
- Discount reason required for audit trail

---

#### 13. Quote Tag

**Purpose**: Custom tags for organizing and categorizing quotes.

**Ownership**: Tenant-scoped

**Key Attributes**:
- Name
- Color (hex code)
- Is active flag

**Relationships**:
- Belongs to: Tenant
- Many-to-many with: Quotes (via quote_tag_assignment)

**Business Rules**:
- Case-insensitive unique name per tenant
- Color must be valid hex code
- Can assign multiple tags per quote
- Can filter quotes by tags
- Cannot delete tag if assigned to any quote (mark inactive instead)

---

#### 14. Quote Attachment

**Purpose**: Photos and URL attachments for quotes.

**Ownership**: Tenant-scoped via parent quote

**Key Attributes**:
- Type (cover_photo, full_page_photo, grid_photo, url_attachment)
- File reference (for images)
- URL (for URL attachments)
- Title (for URL attachments)
- Order index
- QR code image reference (auto-generated for URLs)
- Grid layout (2, 4, or 6 per page - for grid_photo type)

**Relationships**:
- Belongs to: Quote
- References: File (for images)

**Business Rules**:
- Cover photo: Maximum 1 per quote
- Full page photos: Multiple allowed, each prints on own page
- Grid photos: Multiple allowed, grouped by grid_layout setting
- URL attachments: Auto-generate QR code on save
- QR code links to URL provided
- Photos appear at end of quote in order: cover → full page → grid
- URL attachments appear after photos with QR codes

---

#### 15. Quote View Log

**Purpose**: Track customer views of public quote URLs for analytics.

**Ownership**: Tenant-scoped via parent quote

**Key Attributes**:
- Viewed at timestamp
- IP address
- View duration (seconds)
- Device type (desktop, mobile, tablet)
- Referrer URL

**Relationships**:
- Belongs to: Quote

**Business Rules**:
- First view triggers status change from "sent" to "read"
- Track each unique view session
- Calculate total views, unique IPs, average duration
- Anonymize IP after 90 days (GDPR compliance)
- Do not track views by authenticated tenant users (only public views)

---

#### 16. Quote Warranty

**Purpose**: Optional warranty tiers that can be added per item.

**Ownership**: Tenant-scoped

**Key Attributes**:
- Tier name (e.g., "1-Year Standard", "5-Year Premium")
- Description
- Price (fixed amount or percentage of item price)
- Duration in months

**Relationships**:
- Belongs to: Tenant
- Can be assigned to: Quote Items

**Business Rules**:
- Multiple tiers allowed per tenant
- Price can be fixed or percentage-based
- Warranty price adds to item total
- Optional for all items
- Cannot delete warranty tier if used in any quote

---

#### 17. Draw Schedule Entry

**Purpose**: Payment schedule breakdown showing when payments are due.

**Ownership**: Tenant-scoped via parent quote

**Key Attributes**:
- Draw number (sequential)
- Description (what this payment covers)
- Calculation type (percentage or fixed amount)
- Value (percentage 0-100 or dollar amount)
- Calculated amount (dollar value)

**Relationships**:
- Belongs to: Quote

**Business Rules**:
- If percentage: sum of all draws must equal 100%
- If fixed amount: sum should equal quote total (warning if not)
- Cannot mix percentage and fixed in same quote
- Auto-calculate remaining percentage/amount
- Common examples: "30% deposit", "50% at start", "20% final payment"

---

## 🔄 BUSINESS RULES & WORKFLOWS

### Quote Creation Workflow

**From Lead (Existing)**:
1. User clicks "Generate Quote" from lead detail page
2. System pre-fills customer data from lead
3. System changes lead status to "prospect"
4. User completes quote details
5. Quote created with status "draft"

**From Lead (New)**:
1. User starts new quote
2. User searches for customer/lead (not found)
3. User enters new customer data in quote form
4. On quote save, system creates new lead with status "prospect"
5. Quote created and linked to new lead

**Manually**:
1. User selects customer/lead from existing records
2. User completes quote details
3. Quote created with status "draft"

---

### Quote Status Flow

**Status Transitions** (enforced):
```
Draft → Ready → Sent → Read → Approved
                              → Denied
                              → Lost
```

**Status Rules**:
- **Draft**: Editable, no validation required
- **Ready**: Must have ≥1 item, customer, vendor, jobsite address, required approvals
- **Sent**: Customer received quote, auto-set when email sent or public URL generated
- **Read**: Auto-set on first public URL view, cannot be manually set
- **Approved**: Customer accepted, triggers project creation
- **Denied**: Customer declined, requires reason
- **Lost**: Quote expired or abandoned, requires reason

**Reverse Transitions**:
- Can move back to "draft" from "ready", "sent", "read" (allows edits)
- Cannot move back from "approved", "denied", "lost" (final states)
- Moving back creates new version

---

### Approval Workflow

**Trigger Conditions**:
- Quote total exceeds tenant-defined threshold (e.g., $10,000)
- Multiple approval levels supported (configurable)
- Thresholds: Level 1 = $10k, Level 2 = $50k, Level 3 = $100k (example)

**Workflow**:
1. User submits quote for approval (status = "pending_approval")
2. System determines required approval levels based on total
3. Notification sent to next approver
4. Approver reviews and either:
   - **Approves**: Moves to next level or "ready" if final
   - **Rejects**: Returns to "draft" with comments
5. User makes changes and resubmits if rejected

**Bypass Rules**:
- Owner role can bypass all approvals
- Approval levels can be disabled per tenant
- Quotes below threshold skip approval

---

### Pricing Calculation Logic

**Item Cost Calculation**:
```
Cost per unit = Material + Labor + Equipment + Subcontract + Other
Total cost = Cost per unit × Quantity
```

**Item Price Calculation**:
```
Base price per unit = Cost per unit × (1 + Profit %) × (1 + Overhead %) × (1 + Contingency %)

If item has markup override:
  Price per unit = Base price × (1 + Markup %)
  
If item has discount override:
  Price per unit = Price per unit - Discount amount
  
If item has custom tax:
  Price per unit = Price per unit × (1 + Tax %)

Total price = Price per unit × Quantity
```

**Group Subtotal**:
```
Group subtotal = Sum of all item total prices in group
```

**Quote Total Calculation**:
```
Items subtotal = Sum of all ungrouped items + Sum of all group subtotals

Profit amount = Items subtotal × Profit %
Overhead amount = (Items subtotal + Profit amount) × Overhead %
Contingency amount = (Items subtotal + Profit + Overhead) × Contingency %

Subtotal before discounts = Items subtotal + Profit + Overhead + Contingency

Apply quote-level discounts:
  - Percentage discounts first
  - Fixed amount discounts second
  
Subtotal after discounts = Subtotal - Total discounts

Tax amount = Subtotal after discounts × Tax rate

Quote total = Subtotal after discounts + Tax amount
```

---

### Profitability Warnings

**Warning Levels**:
- **Yellow**: Margin between 15-20%
- **Red**: Margin below 15%
- **Block**: Margin below configurable minimum (e.g., 10%)

**Margin Calculation**:
```
Total revenue = Quote total
Total cost = Sum of all item costs

Margin % = ((Total revenue - Total cost) / Total revenue) × 100
```

**Warning Display**:
- Real-time calculation as items added/edited
- Visual indicator (color-coded banner)
- Explanation: "This quote has X% margin, which is below your Y% target"
- Manager override required to send low-margin quotes

---

### Version History

**Auto-Versioning Triggers**:
- Every save creates new version
- Version numbering: Major.Minor (e.g., 1.0, 1.1, 2.0)
- Major version: Significant changes (items added/removed, pricing changed >10%)
- Minor version: Small edits (text changes, notes)

**Version Comparison**:
- Side-by-side view of two versions
- Highlight differences: Added (green), Removed (red), Changed (yellow)
- Compare: Items, pricing, terms, totals
- Show who made changes and when

**Version Restoration**:
- Can restore any previous version
- Creates new version (doesn't overwrite current)
- Requires confirmation (warns about data loss)

---

### Clone & Duplicate Rules

**Clone Quote** (creates completely new quote):
- Copies all data: items, groups, settings, photos, attachments
- Assigns new quote ID and number
- Sets status to "draft"
- Title prefixed with "Copy of"
- Not linked to original (independent)
- Does not copy: approvals, view logs, versions

**Duplicate Item** (within same quote):
- Copies item with all properties
- Places below original in sort order
- Title suffixed with "(Copy)"
- Maintains group assignment

**Duplicate Group** (within same quote):
- Copies group and all items within
- Places below original in sort order
- Title suffixed with "(Copy)"

**Save Item to Library**:
- Creates new Item Library entry
- Copies: title, description, costs, unit
- Does not copy: quantity (uses default 1)
- Not linked (library edits don't affect quote)

---

### Public URL Sharing

**URL Generation**:
- Format: `https://{tenant-subdomain}.lead360.app/quotes/{token}`
- Token: Random 32-character string, unique
- Optional password protection (bcrypt hashed)

**Password Protection**:
- If password set: Show password prompt before quote
- 3 failed attempts = lockout for 15 minutes
- Password hint allowed (displayed on prompt)

**View Tracking**:
- Log each view: timestamp, IP, duration
- First view changes status from "sent" to "read"
- Track unique viewers (by IP, anonymize after 90 days)
- Display analytics to tenant: total views, unique viewers, avg duration

**URL Expiration**:
- URL active while quote status is "sent" or "read"
- Disabled if status changes to "approved", "denied", "lost", "draft"
- Can regenerate new URL (invalidates old)

---

### Email & SMS Integration

**Email Sending**:
- Uses Communication module (already built)
- Template: "send-quote" (Handlebars template)
- Variables: All quote data available
- Attachments: PDF automatically attached
- Includes public URL in email body
- Tracks email open (if supported by email provider)

**SMS Notification** (infrastructure only, not active):
- Sends after email: "Check your email for quote from {company}"
- Includes shortened URL to quote
- Only sent if customer has phone number
- Requires Twilio module (Phase 2)

---

### PDF Generation

**Generation Process**:
1. Fetch quote data (all relationships)
2. Fetch tenant's active template
3. Inject data into template variables
4. Apply tenant branding (colors, logo)
5. Render HTML to PDF
6. Generate QR codes for attachment URLs
7. Save PDF to server storage
8. Return PDF URL

**PDF Sections** (template-defined):
- Header with logo and quote number
- Customer and jobsite information
- Vendor information
- Items table (grouped if applicable)
- Price summary breakdown
- Terms and conditions
- Payment instructions
- Draw schedule (if applicable)
- Warranty information (if applicable)
- Photos (cover, full page, grid)
- Attachment URLs with QR codes
- Signature area (vendor + customer)

**PDF Storage**:
- Stored in File Storage module
- One PDF per quote (regenerated on changes)
- Previous PDFs archived (version history)
- Accessible via download link

---

## 📈 ANALYTICS & DASHBOARDS

### Tenant Dashboard

**Stats Cards**:
- Total quotes (count)
- Total revenue (sum of all quotes by status)
- Quotes by status (breakdown with percentages)
- Average quote value
- Conversion rate (approved / sent)
- Quote velocity (quotes created this week vs last week)

**Charts**:
- Quotes over time (line chart, last 12 months)
- Revenue by status (bar chart)
- Top 10 items by usage (bar chart)
- Win/loss reasons (pie chart)

**Filters**:
- Date range
- Status
- Tags
- Vendor
- Customer

---

### Admin Dashboard

**Global Stats**:
- Total quotes across all tenants
- Total revenue across all tenants
- Quotes by status (all tenants combined)
- Average quote value (all tenants)
- Top 10 tenants by quote count
- Top 10 tenants by revenue

**Filters**:
- Tenant selector
- Date range
- Status
- Service type

**Item Analytics**:
- Most used items globally
- Average pricing per item/task
- Price variance by region (if location data available)

---

### Search Functionality

**Search Criteria** (all optional, combinable):
- Customer name (partial match)
- Quote number (exact or partial)
- City (dropdown or autocomplete)
- Tags (multi-select)
- Status (multi-select)
- Date range (created, sent, approved)
- Item/task name (searches item titles in quote)
- Amount range (min/max)

**Search Results**:
- Paginated list (50 per page default)
- Sort options: Date (newest/oldest), Amount (high/low), Customer name (A-Z)
- Quick actions per result: View, Edit, Clone, Delete

---

## 🔐 SECURITY & PERMISSIONS

### RBAC Requirements

**Owner Role**:
- Full access (create, read, update, delete all quotes)
- Approve all quotes (bypass workflow)
- View all analytics
- Manage vendors, bundles, settings

**Admin Role**:
- Full access (create, read, update, delete all quotes)
- Approve quotes up to level 2
- View all analytics
- Manage vendors, bundles, settings

**Manager Role**:
- Create quotes
- Read all quotes
- Update own quotes
- Approve quotes level 1
- View analytics (limited)

**Sales Role**:
- Create quotes
- Read own quotes
- Update own quotes (before sent)
- Cannot approve quotes
- View own analytics only

**Employee Role**:
- Read quotes only
- Cannot create, update, delete
- Cannot approve
- Cannot view analytics

**Platform Admin Role**:
- View all quotes across all tenants
- Delete quotes (emergency only)
- Cannot edit quotes
- Manage global templates
- Manage global unit measurements
- View global analytics

---

## 🚨 VALIDATION RULES

### Quote Validation (Status = Ready)

**Required**:
- [ ] Customer/Lead assigned
- [ ] Vendor assigned
- [ ] Jobsite address present and validated
- [ ] At least 1 item or 1 group with items
- [ ] Quote total > 0
- [ ] All items have valid costs and pricing
- [ ] Expiration date set and in future
- [ ] Required approvals obtained (if applicable)

**Warnings** (can proceed but alert user):
- Margin below target threshold
- No terms or payment instructions
- No photos or attachments
- No draw schedule defined

---

### Item Validation

**Required**:
- [ ] Title (1-200 characters)
- [ ] Quantity > 0
- [ ] Unit measurement selected
- [ ] At least one cost field > 0

**Optional but Recommended**:
- Description
- All cost fields populated

---

## 🎯 USER WORKFLOWS

### Create Quote from Lead

1. User views lead detail page
2. Clicks "Generate Quote" button
3. System opens quote builder with:
   - Customer data pre-filled
   - Lead status changed to "prospect"
4. User selects vendor
5. User enters jobsite address (can differ from customer address)
6. User configures settings (or use defaults)
7. User adds items (manually or from library)
8. User organizes into groups (optional)
9. User adjusts pricing/discounts
10. User adds photos/attachments (optional)
11. User saves draft
12. User submits for approval (if required)
13. Manager approves
14. User changes status to "ready"
15. User sends quote via email
16. System generates public URL
17. Status changes to "sent"

---

### Customer Views Quote

1. Customer receives email with public URL
2. Customer clicks URL
3. System logs view (first view changes status to "read")
4. Customer enters password (if protected)
5. Customer views quote in browser
6. Customer can:
   - View all details
   - See photos and attachments
   - Download PDF
   - Click "Approve" button (if enabled)

---

### Quote Approval

1. Customer clicks "Approve" in web view
2. System shows signature capture interface
3. Customer signs and enters name/date
4. System saves signature
5. Status changes to "approved"
6. System triggers:
   - Project creation (placeholder)
   - Financial record creation (placeholder)
   - Email notification to vendor
   - Lead status change to "customer"

---

## 📋 ACCEPTANCE CRITERIA

### Module Complete When

**Database**:
- [ ] All 16+ tables created with proper indexes
- [ ] All relationships defined correctly
- [ ] Multi-tenant isolation enforced on all tables
- [ ] Migrations run successfully

**Backend API**:
- [ ] All 150+ endpoints implemented
- [ ] 100% API documentation complete
- [ ] All business rules enforced in services
- [ ] Validation comprehensive
- [ ] Error handling complete
- [ ] RBAC permissions enforced

**Frontend**:
- [ ] All pages implemented and mobile-responsive
- [ ] Quote builder fully functional with drag & drop
- [ ] Template system working (admin)
- [ ] Public quote view renders correctly
- [ ] All calculations real-time and accurate
- [ ] Dark mode supported
- [ ] Loading states on all async operations
- [ ] Error handling with user-friendly messages

**Integration**:
- [ ] PDF generation working with templates
- [ ] Email sending working
- [ ] File uploads working
- [ ] Google Maps validation working
- [ ] View tracking functional
- [ ] Dashboards showing real data

**Testing**:
- [ ] All API endpoints tested
- [ ] Pricing calculations verified
- [ ] Approval workflow tested
- [ ] Version history tested
- [ ] Public URL access tested
- [ ] Multi-tenant isolation verified

---

## 📅 ESTIMATED TIMELINE

**Backend Development**: 6-7 weeks (sequential)
**Frontend Development**: 5-6 weeks (sequential after backend)
**Total**: 11-13 weeks

---

## 📊 IMPLEMENTATION STATUS

**Last Updated**: January 2026

### Backend Implementation

| Feature | Status | Notes |
|---------|--------|-------|
| Database Schema (Dev 1) | ✅ Complete | All 20 tables, 9 enums, relationships, indexes |
| Support Services (Dev 2) | ✅ Complete | Vendor, Unit, Bundle, Settings, Template (41 endpoints) |
| Quote CRUD (Dev 3) | ✅ Complete | Quote, Item, Group, Library services implemented |
| **Financial Calculations (Dev 3+)** | ✅ **Complete** | **QuotePricingService implemented with full calculation logic** |
| Discount Rule CRUD | ⏳ Pending | Service needs to call QuotePricingService for recalculations |
| Public Quote Portal | ⏳ Pending | View-only quote access via shareable link |
| PDF Generation | ⏳ Pending | Quote PDF with template system |

### Frontend Implementation

| Feature | Status | Notes |
|---------|--------|-------|
| Quote List & CRUD Pages | ⏳ Pending | Awaiting backend completion |
| Item Management UI | ⏳ Pending | Awaiting backend completion |
| Discount Rule UI | ⏳ Pending | Awaiting backend completion |
| Public Quote View | ⏳ Pending | Customer-facing quote display |
| PDF Preview & Download | ⏳ Pending | Awaiting backend PDF generation |

### Financial Calculations - IMPLEMENTED ✅

**Service**: `QuotePricingService`
**Location**: `/api/src/modules/quotes/services/quote-pricing.service.ts`
**Documentation**: `/api/documentation/quotes_PRICING_LOGIC.md`

**Calculation Features**:
- ✅ Item subtotal calculation (sum of all item costs)
- ✅ Profit/Overhead/Contingency markup application (compounding)
- ✅ Discount rule evaluation (percentage first, then fixed amount)
- ✅ Tax calculation (on subtotal after discounts)
- ✅ Final total calculation
- ✅ Percentage resolution (custom → tenant → system defaults)
- ✅ Automatic recalculation on item changes
- ✅ Transaction-safe updates
- ✅ Decimal precision (no floating-point errors)
- ✅ Comprehensive unit tests (>80% coverage)

**Integration Points**:
- ✅ QuoteItemService (create, update, delete, duplicate)
- ⏳ QuoteDiscountRuleService (when implemented)
- ⏳ QuoteSettingsService (when tenant settings change)

**API Fields Updated**:
- `quote.subtotal` - Subtotal before discounts (with markups)
- `quote.discount_amount` - Total discounts applied
- `quote.tax_amount` - Tax on discounted subtotal
- `quote.total` - Final total (subtotal - discount + tax)

---

## ✅ APPROVAL CHECKPOINT

**This contract requires approval before proceeding to developer instructions.**

**Reviewer Checklist**:
- [ ] All features clearly defined
- [ ] Data model complete and logical
- [ ] Business rules unambiguous
- [ ] Workflows documented
- [ ] Security requirements clear
- [ ] No code examples present (correct)
- [ ] Ready for developer implementation

---

**Status**: ⏸️ **AWAITING APPROVAL**

**Once approved, I will proceed to create Backend Developer 1 instructions (Database Schema & Core Models).**