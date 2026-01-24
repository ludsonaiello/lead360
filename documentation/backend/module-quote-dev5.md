# Backend Developer 5: Public Access, PDF Generation & Analytics

**Module**: Quote Management System  
**Phase**: External Access & Reporting  
**Timeline**: 1.5 weeks  
**Complexity**: High (Integration-heavy, customer-facing)  
**Dependencies**: Backend Developers 1, 2, 3, AND 4 MUST be complete  
**Your Role**: Build external access and analytics systems

---

## 🎯 YOUR MISSION

You are responsible for making quotes accessible to customers and providing analytics to users. You build the bridge between internal quote management and external customer interaction.

**You will create**:
- Public URL generation with password protection
- View tracking and analytics (who viewed, when, how long)
- PDF generation using templates (HTML → PDF with tenant branding)
- QR code generation for attachment URLs
- Email sending integration (use communication module)
- SMS notification readiness (infrastructure, not active)
- Tenant dashboard (stats, charts, analytics)
- Admin dashboard (global stats, all tenants)
- Advanced search functionality
- Change order system (after quote approval)
- Status automation (auto-change to "read" on view, lead to "customer" on approval)

**You will NOT**:
- Build quote CRUD (that's Developer 3, already done)
- Build pricing calculations (that's Developer 4, already done)
- Build templates (that's Developer 2, already done)
- Build frontend (that's Frontend team)

---

## 📋 WHAT YOU MUST DELIVER

### Deliverables Checklist

- [ ] Public URL system (4 endpoints with password protection)
- [ ] View tracking (4 endpoints with analytics)
- [ ] PDF generation (2 endpoints using templates)
- [ ] QR code generation service
- [ ] Email sending (2 endpoints using communication module)
- [ ] SMS notification infrastructure (1 endpoint, not active)
- [ ] Tenant dashboard (8 endpoints with stats/charts)
- [ ] Admin dashboard (6 endpoints, platform admin only)
- [ ] Advanced search (4 endpoints with filters)
- [ ] Change order system (6 endpoints)
- [ ] Status automation logic
- [ ] 100% API documentation in REST_API file
- [ ] All DTOs with validation
- [ ] Service layer with integration logic
- [ ] Handoff document for Frontend team

### Files You Will Create/Modify

```
/var/www/lead360.app/api/src/modules/quotes/
├── quotes.module.ts (MODIFY - add final services/controllers)
├── controllers/
│   ├── quote-public.controller.ts (CREATE - no auth required)
│   ├── quote-pdf.controller.ts (CREATE)
│   ├── quote-analytics.controller.ts (CREATE)
│   ├── quote-dashboard.controller.ts (CREATE)
│   ├── quote-admin.controller.ts (CREATE - platform admin)
│   ├── quote-search.controller.ts (CREATE)
│   └── change-order.controller.ts (CREATE)
├── services/
│   ├── quote-public-access.service.ts (CREATE)
│   ├── quote-view-tracking.service.ts (CREATE)
│   ├── quote-pdf-generator.service.ts (CREATE - THE BIG ONE)
│   ├── qr-code-generator.service.ts (CREATE)
│   ├── quote-email.service.ts (CREATE)
│   ├── quote-analytics.service.ts (CREATE)
│   ├── quote-dashboard.service.ts (CREATE)
│   ├── quote-search.service.ts (CREATE)
│   └── change-order.service.ts (CREATE)
├── dto/
│   ├── public/ (CREATE)
│   ├── pdf/ (CREATE)
│   ├── analytics/ (CREATE)
│   ├── dashboard/ (CREATE)
│   ├── search/ (CREATE)
│   └── change-order/ (CREATE)
└── guards/
    └── public-access.guard.ts (CREATE - validates tokens)

/var/www/lead360.app/api/documentation/
├── quotes_REST_API_DEV5.md (CREATE - 100% docs)
└── quotes_HANDOFF_DEV5.md (CREATE - handoff to Frontend)
```

---

## 🏗️ MODULE 1: PUBLIC URL SYSTEM

### Purpose

Generate shareable URLs that allow customers to view quotes without logging in. URLs can be password-protected for security. Track all views for analytics.

### Critical Business Rules

**URL Generation**:
- Format: `https://{tenant-subdomain}.lead360.app/quotes/{token}`
- Token: Random 32-character string (cryptographically secure)
- Token must be unique globally (not just per tenant)
- One active token per quote (creating new token deactivates old)
- URLs only work when quote status is "sent" or "read"

**Password Protection**:
- Optional password (tenant decides)
- Password stored as bcrypt hash (never plain text)
- Password hint allowed (displayed on prompt)
- Failed attempts: 3 strikes = 15 minute lockout per IP
- Lockout tracked per IP + token combination

**Access Control**:
- No authentication required (public endpoint)
- Token validates access
- Password validates if set
- Status must be "sent" or "read" (not draft, not approved)
- Archived quotes not accessible

**View Tracking**:
- Log every view (timestamp, IP, duration)
- First view changes status from "sent" to "read" (automatic)
- Track unique viewers by IP (anonymize after 90 days for GDPR)
- Calculate time on page (if possible)

**Security**:
- Rate limiting: 10 requests per minute per IP
- Token expiration: Optional (quote expiration date)
- Disable URL when quote archived
- No SQL injection via token lookup

### Endpoints Required

#### 1. Generate Public URL
```
POST /api/v1/quotes/:id/public-access
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- password (optional, string, min 8 chars)
- password_hint (optional, string, max 255 chars)
- expires_at (optional, datetime, defaults to quote.expires_at)

**Validation**:
- Quote must belong to tenant
- Quote status must be "ready" or "sent"
- If password provided, min 8 characters
- Password hint optional but recommended if password set

**Business Logic**:
1. Generate cryptographically secure random token (32 chars)
2. Check token uniqueness globally (retry if collision)
3. If password provided, hash with bcrypt (10 rounds)
4. Deactivate any existing public access token for this quote
5. Create quote_public_access record
6. Change quote status to "sent" if currently "ready"
7. Update quote version (+0.1)
8. Return full URL

**Response**:
```json
{
  "quote_id": "uuid",
  "public_url": "https://acme-painting.lead360.app/quotes/abc123def456ghi789jkl012mno345pq",
  "token": "abc123def456ghi789jkl012mno345pq",
  "password_protected": true,
  "password_hint": "Company name + year",
  "expires_at": "2024-02-15T10:00:00Z",
  "created_at": "2024-01-15T10:00:00Z"
}
```

**Errors**:
- 400: Quote status not ready/sent
- 400: Password too weak

---

#### 2. Get Public Quote (Customer View - NO AUTH)
```
GET /public/quotes/:token
Auth: NONE (public endpoint)
```

**Request Headers**:
- X-Password (optional, if quote is password-protected)

**Validation**:
- Token exists and is active
- Quote status is "sent" or "read" (not draft, approved, denied, lost)
- If password required: Validate X-Password header
- Check rate limiting (10 req/min per IP)
- Check lockout status (IP + token)

**Business Logic**:
1. Lookup token in quote_public_access table
2. Verify is_active = true
3. Fetch quote (verify not archived)
4. Verify status in ["sent", "read"]
5. If password required:
   - Validate password from header
   - If invalid: Increment failed attempts
   - If 3+ failures: Lock for 15 minutes
   - If locked: Return 429 Too Many Requests
6. If first view (no logs for this token): Change quote.status to "read"
7. Log view (create quote_view_log record)
8. Return complete quote data

**Response**: Complete quote object with:
- All quote fields (except private_notes)
- Customer/lead info
- Vendor info (with signature URL)
- Jobsite address
- All items (ordered by order_index)
- All groups (with items)
- Complete pricing breakdown (from Dev 4's calculator)
- Photos (all types with URLs)
- Attachment URLs with QR codes
- Draw schedule (if exists)
- Terms and conditions
- Payment instructions
- Signature areas (vendor signature image, customer signature area)

**Excluded from response**:
- Private notes (quote level and item level)
- Internal approval history
- Version history
- Created by user info
- Cost breakdown (show prices only, not costs)

**Errors**:
- 404: Token not found or inactive
- 403: Incorrect password
- 429: Too many failed attempts (locked out)
- 410: Quote expired or no longer available

---

#### 3. Validate Password (Check Before Showing Quote)
```
POST /public/quotes/:token/validate-password
Auth: NONE (public endpoint)
```

**Request Body**:
- password (required, string)

**Business Logic**:
- Check if password correct
- Do NOT increment failed attempts (this is just validation)
- Return boolean result

**Response**:
```json
{
  "valid": true,
  "hint": "Company name + year"
}
```

---

#### 4. Deactivate Public URL
```
DELETE /api/v1/quotes/:id/public-access
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
- Set is_active = false on quote_public_access record
- URL becomes inaccessible immediately
- View logs preserved (don't delete)

**Response**: 204 No Content

---

## 🏗️ MODULE 2: VIEW TRACKING & ANALYTICS

### Purpose

Track who views quotes, when they view them, and for how long. Provide analytics on quote engagement.

### Critical Business Rules

**View Logging**:
- Log every access to public URL
- Capture: timestamp, IP address, duration, device type, referrer
- First view triggers status change (sent → read)
- Anonymize IP after 90 days (GDPR compliance)
- Calculate unique viewers (count distinct IPs)

**Duration Tracking**:
- Start time: When quote loaded
- End time: When browser sends beacon/unload event
- Duration: End - Start (in seconds)
- If no end event: Estimate from average

**Device Detection**:
- Parse User-Agent header
- Categorize: desktop, mobile, tablet, unknown
- Store device type for analytics

**Privacy**:
- IP addresses anonymized after 90 days
- No personally identifiable information stored
- Comply with GDPR/privacy regulations

### Endpoints Required

#### 1. Log Quote View (Called by Frontend)
```
POST /public/quotes/:token/view
Auth: NONE (public endpoint)
```

**Request Body**:
- duration_seconds (optional, integer, time spent on page)

**Business Logic**:
- Extract IP from request (req.ip)
- Parse User-Agent for device type
- Extract referrer from headers
- Create quote_view_log record
- If first view: Change quote status to "read"

**Response**: 204 No Content

---

#### 2. Get View Analytics
```
GET /api/v1/quotes/:id/views/analytics
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
- Count total views
- Count unique viewers (distinct IPs)
- Calculate average view duration
- Group views by date (last 30 days)
- Breakdown by device type
- Identify repeat viewers (IPs with multiple views)

**Response**:
```json
{
  "quote_id": "uuid",
  "total_views": 15,
  "unique_viewers": 8,
  "average_duration_seconds": 245,
  "first_viewed_at": "2024-01-15T14:30:00Z",
  "last_viewed_at": "2024-01-20T09:15:00Z",
  "views_by_date": [
    { "date": "2024-01-15", "count": 5 },
    { "date": "2024-01-16", "count": 3 },
    { "date": "2024-01-20", "count": 7 }
  ],
  "views_by_device": {
    "desktop": 10,
    "mobile": 4,
    "tablet": 1
  },
  "engagement_score": 85
}
```

---

#### 3. Get View History
```
GET /api/v1/quotes/:id/views/history
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Query Parameters**:
- page, limit

**Business Logic**:
- Fetch all view logs for quote
- Order by viewed_at DESC (newest first)
- Anonymize IPs if > 90 days old
- Include device type, duration, referrer

**Response**: Paginated view logs

---

#### 4. Anonymize Old View Logs (Scheduled Job)
```
POST /api/v1/admin/quotes/anonymize-views
Auth: JWT required (internal job)
Roles: System
```

**Purpose**: Run nightly to comply with GDPR

**Business Logic**:
- Find all quote_view_log records > 90 days old
- Set ip_address = "anonymized"
- Preserve all other data

**Response**: Count of anonymized records

---

## 🏗️ MODULE 3: PDF GENERATION SYSTEM

### Purpose

Generate professional PDF documents from quotes using HTML templates. Apply tenant branding, inject quote data, and create downloadable PDFs.

### Critical Business Rules

**PDF Generation Process**:
1. Fetch quote with all data (items, groups, photos, etc.)
2. Fetch tenant's active template (or platform default)
3. Calculate all pricing (use Dev 4's calculator)
4. Inject data into template (Handlebars rendering)
5. Generate QR codes for attachment URLs
6. Apply tenant branding (colors, logo)
7. Render HTML to PDF
8. Save PDF to file storage
9. Return download URL

**Template Variables** (from Dev 2):
- All quote data available
- Handlebars syntax: `{{quote.title}}`, `{{customer.name}}`, etc.
- Loops: `{{#each items}}...{{/each}}`
- Conditionals: `{{#if warranty}}...{{/if}}`

**Image Handling**:
- Cover photo: Positioned in template cover area (if template supports)
- Full page photos: One photo per page at end
- Grid photos: Multiple per page based on grid_layout (2, 4, or 6)
- All images stored in file storage module (use file_id references)
- Vendor signature: Embedded in signature area
- QR codes: Generated on-the-fly, embedded in PDF

**PDF Storage**:
- Store in file storage module (category = "quote_pdf")
- One PDF per quote (regenerate on changes)
- Previous PDFs archived (version history)
- Presigned URL for download (expires in 1 hour)

**Branding**:
- Tenant primary color → Template color variables
- Tenant secondary color → Accent colors
- Tenant logo → Header/footer images
- Custom fonts (if template supports)

### Endpoints Required

#### 1. Generate PDF
```
POST /api/v1/quotes/:id/generate-pdf
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
1. Fetch quote with all relationships
2. Run pricing calculator (get complete breakdown)
3. Fetch tenant's active template (or default)
4. Fetch tenant branding (logo, colors)
5. Fetch all images (cover, full page, grid)
6. Generate QR codes for attachment URLs
7. Inject all data into template HTML
8. Replace template variables (Handlebars)
9. Replace color placeholders ({{tenant.primary_color}})
10. Render HTML to PDF (use library like Puppeteer or similar)
11. Save PDF to file storage
12. Update quote.pdf_file_id
13. Return download URL

**Response**:
```json
{
  "quote_id": "uuid",
  "pdf_url": "https://storage.lead360.app/quotes/quote-uuid.pdf?signature=...",
  "file_id": "uuid",
  "generated_at": "2024-01-15T10:00:00Z",
  "file_size_bytes": 2547896,
  "pages": 8
}
```

**Errors**:
- 400: Quote not ready (missing data)
- 500: PDF generation failed

---

#### 2. Download PDF
```
GET /api/v1/quotes/:id/download-pdf
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Business Logic**:
- Fetch quote.pdf_file_id
- If no PDF exists: Generate on-the-fly
- Get presigned download URL from file storage
- Redirect to presigned URL OR stream PDF directly

**Response**: PDF file download (Content-Type: application/pdf)

---

### PDF Generation Service Architecture

**QuotePdfGeneratorService**:

**Key Methods**:
1. `generatePdf(quoteId)` → PDF file
2. `injectDataIntoTemplate(template, quoteData)` → HTML string
3. `applyBranding(html, tenantBranding)` → HTML string
4. `renderHtmlToPdf(html)` → PDF buffer
5. `generateQrCode(url)` → QR code image buffer
6. `embedImages(html, images)` → HTML with embedded images

**Template Rendering**:
- Use Handlebars library to compile template
- Inject complete quote data object
- Support all Handlebars helpers (loops, conditionals)
- Handle missing variables gracefully (don't crash PDF)

**HTML to PDF Conversion**:
- Recommended: Puppeteer (headless Chrome)
- Alternative: wkhtmltopdf, PDFKit
- Settings: A4 page size, margins, print background colors
- Handle page breaks appropriately

**QR Code Generation**:
- Use library like `qrcode` or similar
- Generate QR code image for each attachment URL
- Embed in PDF at end (one QR code per attachment)
- Size: 200x200px recommended

**Image Embedding**:
- Fetch images from file storage (presigned URLs)
- Convert to base64 for embedding (or use URLs if supported)
- Cover photo: Insert in template cover area
- Full page photos: One per page (full bleed)
- Grid photos: Layout based on grid_layout setting

---

## 🏗️ MODULE 4: EMAIL & SMS INTEGRATION

### Purpose

Send quotes to customers via email with PDF attached. Prepare infrastructure for SMS notifications (not active in Phase 1).

### Critical Business Rules

**Email Sending**:
- Use existing communication module (already built)
- Template: "send-quote" (Handlebars template in communication system)
- Variables: All quote data available to template
- Attachment: PDF automatically attached
- Include public URL in email body
- Track email opens (if provider supports)
- After sending: Change quote status to "sent"

**SMS Notification** (Infrastructure Only):
- Endpoint defined but not active
- Will use Twilio module (Phase 2)
- Message: "Check your email for quote from {company}"
- Include shortened URL
- Only send if customer has phone number

**Sending Rules**:
- Can only send if quote status is "ready"
- Must have customer email (required)
- Phone optional (for SMS)
- Generate PDF before sending (if not exists)
- Generate public URL before sending (if not exists)
- Log sending action in audit trail

### Endpoints Required

#### 1. Send Quote via Email
```
POST /api/v1/quotes/:id/send-email
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- recipient_email (optional, defaults to customer email)
- cc_emails (optional, array of additional recipients)
- subject (optional, defaults to template subject)
- custom_message (optional, additional message in email body)
- include_pdf (optional, boolean, default true)

**Validation**:
- Quote status must be "ready"
- Recipient email required (from body or customer record)
- Valid email format

**Business Logic**:
1. Verify quote is ready
2. Generate PDF if doesn't exist
3. Generate public URL if doesn't exist
4. Prepare email data:
   - To: recipient_email
   - CC: cc_emails
   - Subject: From template or custom
   - Body: Render "send-quote" template with quote data
   - Attachments: PDF file
5. Call EmailService from communication module
6. Change quote status to "sent"
7. Update quote version (+1.0 - status change)
8. Log email sent in audit trail
9. Return confirmation

**Response**:
```json
{
  "quote_id": "uuid",
  "email_sent": true,
  "recipient": "customer@example.com",
  "cc_recipients": ["manager@company.com"],
  "pdf_attached": true,
  "public_url_included": true,
  "sent_at": "2024-01-15T10:00:00Z",
  "quote_status": "sent"
}
```

**Errors**:
- 400: Quote not ready
- 400: No recipient email
- 500: Email sending failed

---

#### 2. Send Quote via SMS (Infrastructure Only)
```
POST /api/v1/quotes/:id/send-sms
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- phone_number (optional, defaults to customer phone)
- custom_message (optional)

**Business Logic** (Phase 1 - Not Active):
1. Verify quote ready
2. Generate public URL if doesn't exist
3. Prepare SMS message
4. Return error: "SMS sending not yet available"
5. In Phase 2: Call Twilio service to send

**Response**:
```json
{
  "error": "SMS sending not yet available",
  "planned_for": "Phase 2"
}
```

---

## 🏗️ MODULE 5: TENANT DASHBOARD & ANALYTICS

### Purpose

Provide comprehensive analytics and statistics for tenants to track quote performance, revenue pipeline, and conversion rates.

### Critical Business Rules

**Dashboard Metrics**:
- Total quotes (count by status)
- Total revenue by status
- Average quote value
- Conversion rate (approved / sent × 100)
- Quote velocity (this period vs last period)
- Top items/tasks by usage
- Win/loss analysis

**Time Ranges**:
- Default: Last 30 days
- Options: Last 7 days, last 30 days, last 90 days, this year, custom range
- Compare to previous period

**Filtering**:
- By status
- By vendor
- By tags
- By date range
- By customer/city

**Charts/Visualizations**:
- Quotes over time (line chart)
- Revenue by status (bar chart)
- Conversion funnel (sent → read → approved)
- Top 10 items by usage (bar chart)
- Win/loss reasons (pie chart)

### Endpoints Required

#### 1. Get Dashboard Overview
```
GET /api/v1/quotes/dashboard/overview
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Query Parameters**:
- date_from (optional, default: 30 days ago)
- date_to (optional, default: now)
- compare_to_previous (optional, boolean, default true)

**Business Logic**:
- Filter by tenant_id
- Count quotes by status
- Sum revenue by status
- Calculate averages
- Calculate conversion rate
- Compare to previous period if requested

**Response**:
```json
{
  "period": {
    "from": "2023-12-15",
    "to": "2024-01-15"
  },
  "totals": {
    "quotes_count": 150,
    "quotes_count_change": 25,
    "total_revenue": 2500000.00,
    "total_revenue_change": 350000.00,
    "average_quote_value": 16666.67,
    "average_quote_value_change": 1234.56
  },
  "by_status": {
    "draft": { "count": 20, "revenue": 250000.00, "percentage": 13.3 },
    "sent": { "count": 40, "revenue": 600000.00, "percentage": 26.7 },
    "approved": { "count": 50, "revenue": 1200000.00, "percentage": 33.3 },
    "denied": { "count": 25, "revenue": 300000.00, "percentage": 16.7 },
    "lost": { "count": 15, "revenue": 150000.00, "percentage": 10.0 }
  },
  "conversion": {
    "sent": 90,
    "read": 75,
    "approved": 50,
    "conversion_rate": 55.6,
    "conversion_rate_change": 5.2
  },
  "velocity": {
    "quotes_this_period": 150,
    "quotes_previous_period": 120,
    "change_percent": 25.0
  }
}
```

---

#### 2. Get Quotes Over Time
```
GET /api/v1/quotes/dashboard/quotes-over-time
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Query Parameters**:
- date_from, date_to
- interval (optional, enum: 'day', 'week', 'month', default 'day')

**Business Logic**:
- Group quotes by created_at
- Aggregate by interval
- Return time series data

**Response**:
```json
{
  "interval": "day",
  "data": [
    { "date": "2024-01-01", "count": 5, "revenue": 75000.00 },
    { "date": "2024-01-02", "count": 8, "revenue": 120000.00 },
    { "date": "2024-01-03", "count": 6, "revenue": 90000.00 }
  ]
}
```

---

#### 3. Get Top Items
```
GET /api/v1/quotes/dashboard/top-items
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Query Parameters**:
- date_from, date_to
- limit (optional, default 10, max 50)

**Business Logic**:
- Count usage of each unique item title
- Calculate total revenue per item
- Calculate average price per item
- Sort by usage count or revenue

**Response**:
```json
{
  "top_items": [
    {
      "title": "Bathroom Tile Installation",
      "usage_count": 45,
      "total_revenue": 337500.00,
      "average_price": 7500.00
    },
    {
      "title": "Kitchen Cabinet Refacing",
      "usage_count": 38,
      "total_revenue": 456000.00,
      "average_price": 12000.00
    }
  ]
}
```

---

#### 4. Get Win/Loss Analysis
```
GET /api/v1/quotes/dashboard/win-loss-analysis
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Query Parameters**:
- date_from, date_to

**Business Logic**:
- Fetch all denied and lost quotes in period
- Extract loss reasons (from private_notes or separate field)
- Group by reason
- Count occurrences
- Calculate percentage of total losses

**Response**:
```json
{
  "total_losses": 40,
  "reasons": [
    {
      "reason": "Price too high",
      "count": 18,
      "percentage": 45.0,
      "average_amount_lost": 15000.00
    },
    {
      "reason": "Lost to competitor",
      "count": 12,
      "percentage": 30.0,
      "competitor_names": ["ABC Contracting", "XYZ Services"]
    },
    {
      "reason": "Customer went different direction",
      "count": 10,
      "percentage": 25.0
    }
  ]
}
```

---

#### 5. Get Conversion Funnel
```
GET /api/v1/quotes/dashboard/conversion-funnel
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Query Parameters**:
- date_from, date_to

**Business Logic**:
- Count quotes at each stage: sent → read → approved
- Calculate drop-off at each stage
- Calculate conversion rate

**Response**:
```json
{
  "funnel": [
    { "stage": "sent", "count": 100, "percentage": 100.0 },
    { "stage": "read", "count": 80, "percentage": 80.0, "drop_off": 20.0 },
    { "stage": "approved", "count": 50, "percentage": 50.0, "drop_off": 30.0 }
  ],
  "overall_conversion_rate": 50.0
}
```

---

#### 6. Get Revenue by Vendor
```
GET /api/v1/quotes/dashboard/revenue-by-vendor
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Query Parameters**:
- date_from, date_to

**Business Logic**:
- Group quotes by vendor_id
- Sum revenue per vendor
- Calculate conversion rate per vendor

**Response**:
```json
{
  "vendors": [
    {
      "vendor_id": "uuid",
      "vendor_name": "ABC Contracting",
      "quotes_count": 45,
      "total_revenue": 750000.00,
      "conversion_rate": 55.6
    }
  ]
}
```

---

#### 7. Get Average Pricing by Task
```
GET /api/v1/quotes/dashboard/avg-pricing-by-task
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Query Parameters**:
- date_from, date_to

**Business Logic**:
- Group items by title (task name)
- Calculate average price per unit
- Calculate price range (min/max)
- Calculate median price

**Response**:
```json
{
  "tasks": [
    {
      "title": "Bathroom Tile Installation",
      "unit": "sq ft",
      "avg_price_per_unit": 8.25,
      "min_price": 6.50,
      "max_price": 12.00,
      "median_price": 8.00,
      "usage_count": 45
    }
  ]
}
```

---

#### 8. Export Dashboard Data
```
POST /api/v1/quotes/dashboard/export
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body**:
- format (required, enum: 'csv', 'xlsx', 'pdf')
- date_from, date_to
- include_sections (optional, array: ['overview', 'items', 'funnel', etc.])

**Business Logic**:
- Gather all requested data
- Format as CSV/Excel/PDF
- Save to file storage
- Return download URL

**Response**:
```json
{
  "file_url": "https://storage.lead360.app/exports/dashboard-2024-01-15.xlsx",
  "format": "xlsx",
  "generated_at": "2024-01-15T10:00:00Z"
}
```

---

## 🏗️ MODULE 6: ADMIN DASHBOARD (Platform Admin)

### Purpose

Provide platform administrators with global analytics across all tenants. View all quotes, aggregate stats, and manage the system.

### Critical Business Rules

**Admin Permissions**:
- Platform Admin role ONLY
- Can view all quotes across all tenants
- Can delete quotes (emergency only)
- Cannot edit quotes
- Can view global statistics
- Can manage global templates (already done by Dev 2)
- Can manage global units (already done by Dev 2)

**Global Analytics**:
- Total quotes across all tenants
- Total revenue across all tenants
- Quotes by status (all tenants)
- Top 10 tenants by quote count
- Top 10 tenants by revenue
- Average quote value globally
- Item pricing trends (global avg pricing per task)

**Filtering**:
- By tenant (view specific tenant's quotes)
- By date range
- By status
- By service type (derived from items)

### Endpoints Required

#### 1. Get Global Overview (Admin Dashboard)
```
GET /api/v1/admin/quotes/dashboard/overview
Auth: JWT required
Roles: Platform Admin ONLY
```

**Query Parameters**:
- date_from, date_to

**Business Logic**:
- Aggregate across ALL tenants
- Count total quotes
- Sum total revenue
- Calculate averages
- Identify top performers

**Response**:
```json
{
  "global_stats": {
    "total_quotes": 15000,
    "total_revenue": 250000000.00,
    "average_quote_value": 16666.67,
    "active_tenants": 500
  },
  "by_status": {
    "draft": 2000,
    "sent": 4000,
    "approved": 6000,
    "denied": 2000,
    "lost": 1000
  },
  "top_tenants": [
    {
      "tenant_id": "uuid",
      "tenant_name": "ABC Painting",
      "quotes_count": 250,
      "total_revenue": 3750000.00
    }
  ]
}
```

---

#### 2. List All Quotes (Admin)
```
GET /api/v1/admin/quotes
Auth: JWT required
Roles: Platform Admin ONLY
```

**Query Parameters**:
- tenant_id (optional, filter by specific tenant)
- status (optional)
- date_from, date_to
- search (search across all tenants)
- page, limit

**Business Logic**:
- Query quotes across all tenants (no tenant_id filter unless specified)
- Include tenant name in results
- Support all filters

**Response**: Paginated quote list with tenant info

---

#### 3. Get Quote by ID (Admin)
```
GET /api/v1/admin/quotes/:id
Auth: JWT required
Roles: Platform Admin ONLY
```

**Business Logic**:
- Fetch quote regardless of tenant
- Include all data (including private notes for admin visibility)

**Response**: Complete quote object

---

#### 4. Delete Quote (Admin - Emergency Only)
```
DELETE /api/v1/admin/quotes/:id
Auth: JWT required
Roles: Platform Admin ONLY
```

**Request Body**:
- reason (required, text, why deleting)
- confirm (required, boolean, must be true)

**Business Logic**:
- Hard delete quote and all related data
- Log deletion in audit trail
- Notify tenant (email)
- Require confirmation (destructive action)

**Response**: 204 No Content

**Errors**:
- 400: Confirmation required

---

#### 5. Get Global Item Pricing
```
GET /api/v1/admin/quotes/dashboard/global-item-pricing
Auth: JWT required
Roles: Platform Admin ONLY
```

**Purpose**: See average pricing per task across all tenants

**Business Logic**:
- Group items by title across all tenants
- Calculate global average price per unit
- Calculate price range (min/max)
- Calculate standard deviation (price variance)
- Identify outliers (prices > 2 std dev from mean)

**Response**:
```json
{
  "global_pricing": [
    {
      "title": "Bathroom Tile Installation",
      "unit": "sq ft",
      "global_avg_price": 8.25,
      "min_price": 4.00,
      "max_price": 15.00,
      "std_deviation": 2.35,
      "usage_count": 1250,
      "tenant_count": 125
    }
  ]
}
```

---

#### 6. Get Tenant Performance Comparison
```
GET /api/v1/admin/quotes/dashboard/tenant-comparison
Auth: JWT required
Roles: Platform Admin ONLY
```

**Query Parameters**:
- metric (enum: 'quote_count', 'revenue', 'conversion_rate', 'avg_quote_value')
- limit (default 10, max 100)
- date_from, date_to

**Business Logic**:
- Rank tenants by chosen metric
- Return top performers

**Response**:
```json
{
  "metric": "revenue",
  "period": "2024-01-01 to 2024-01-31",
  "tenants": [
    {
      "rank": 1,
      "tenant_id": "uuid",
      "tenant_name": "ABC Painting",
      "value": 500000.00,
      "quotes_count": 50
    }
  ]
}
```

---

## 🏗️ MODULE 7: ADVANCED SEARCH

### Purpose

Powerful search functionality across all quote fields, items, customers, and tags.

### Critical Business Rules

**Search Scope** (already implemented by Dev 3, you enhance):
- Quote number (exact or partial)
- Title (partial, case-insensitive)
- Customer name (first/last, partial)
- City (jobsite address)
- Item titles (search in quote_item.title)
- Tags (search in quote_tag.name)
- Status
- Date ranges
- Amount ranges

**Search Performance**:
- Use database indexes effectively
- Limit results (pagination required)
- Search should be fast (<500ms)

**Result Ranking**:
- Exact matches first (quote number)
- Title matches
- Customer matches
- Item/tag matches
- Older quotes last

### Endpoints Required

#### 1. Advanced Search
```
GET /api/v1/quotes/search/advanced
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- q (general search query - searches across all fields)
- quote_number (exact or partial match)
- title (partial match)
- customer_name (partial match)
- city (partial match)
- item_title (partial match - searches in items)
- tags (array of tag names)
- status (array of statuses)
- vendor_id (filter by vendor)
- amount_min (minimum quote total)
- amount_max (maximum quote total)
- date_from (created_at >= date)
- date_to (created_at <= date)
- page, limit
- sort_by (enum: 'relevance', 'date', 'amount', default 'relevance')
- sort_order (asc/desc)

**Business Logic**:
- Build dynamic query based on provided filters
- Filter by tenant_id from JWT
- Use OR conditions for multi-field search
- Rank results by relevance if sort_by='relevance'
- Include highlighting (show why result matched)

**Response**:
```json
{
  "results": [
    {
      "quote_id": "uuid",
      "quote_number": "Q-2024-001",
      "title": "Kitchen Remodel",
      "customer_name": "John Doe",
      "status": "sent",
      "total": 15000.00,
      "created_at": "2024-01-15T10:00:00Z",
      "match_highlights": {
        "title": "Kitchen <mark>Remodel</mark>",
        "item": "Cabinet <mark>installation</mark>"
      }
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "per_page": 50
  }
}
```

---

#### 2. Search Suggestions (Autocomplete)
```
GET /api/v1/quotes/search/suggestions
Auth: JWT required
Roles: All authenticated users
```

**Query Parameters**:
- q (required, search query, min 2 chars)
- field (optional, enum: 'customer', 'item', 'tag', 'all')
- limit (default 10, max 20)

**Business Logic**:
- Return autocomplete suggestions as user types
- Search in specified field(s)
- Return unique values only
- Order by usage frequency

**Response**:
```json
{
  "suggestions": [
    { "type": "customer", "value": "John Doe", "count": 5 },
    { "type": "item", "value": "Kitchen Cabinets", "count": 12 },
    { "type": "tag", "value": "Kitchen", "count": 25 }
  ]
}
```

---

#### 3. Saved Searches
```
POST /api/v1/quotes/search/save
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Request Body**:
- name (required, search name)
- filters (required, object with all search parameters)

**Business Logic**:
- Save search criteria for reuse
- User can quickly re-run saved searches

**Response**: Created saved search object

---

#### 4. Get Saved Searches
```
GET /api/v1/quotes/search/saved
Auth: JWT required
Roles: All authenticated users
```

**Response**: Array of user's saved searches

---

## 🏗️ MODULE 8: CHANGE ORDER SYSTEM

### Purpose

After a quote is approved, changes may be needed. Change orders track additional work or modifications using the same structure as quotes.

### Critical Business Rules

**Change Order Creation**:
- Only available after quote status = "approved"
- Links to parent quote
- Uses same item structure as quotes
- Has its own pricing (separate from parent quote)
- Can be positive (additional work) or negative (credits)

**Change Order Workflow**:
1. Quote approved → Can create change orders
2. Change order created (status = draft)
3. Change order priced and sent to customer
4. Customer approves change order
5. Change order added to project cost

**Change Order Structure**:
- Essentially a mini-quote
- Has items, groups, pricing
- Has its own status (draft, sent, approved, denied)
- Links to parent quote via parent_quote_id

### Endpoints Required

#### 1. Create Change Order
```
POST /api/v1/quotes/:parentQuoteId/change-orders
Auth: JWT required
Roles: Owner, Admin, Manager, Sales
```

**Request Body**:
- title (required, e.g., "Change Order #1 - Additional Work")
- description (optional, what changed)
- reason (required, why change order needed)

**Validation**:
- Parent quote must be approved
- Parent quote must belong to tenant

**Business Logic**:
1. Verify parent quote status = "approved"
2. Create new quote record with:
   - Same customer/lead as parent
   - Same vendor as parent
   - Same jobsite address as parent
   - Title from request
   - Status = "draft"
   - Type = "change_order" (new field or flag)
   - parent_quote_id = parentQuoteId
3. Copy tenant settings from parent
4. Return new change order

**Response**: Created change order object

---

#### 2. List Change Orders
```
GET /api/v1/quotes/:parentQuoteId/change-orders
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Fetch all quotes where parent_quote_id = parentQuoteId
- Include totals and status
- Order by created_at

**Response**: Array of change orders

---

#### 3. Get Change Order Total Impact
```
GET /api/v1/quotes/:parentQuoteId/change-orders/total-impact
Auth: JWT required
Roles: All authenticated users
```

**Business Logic**:
- Sum all approved change order totals
- Add to parent quote total
- Show original vs revised total

**Response**:
```json
{
  "parent_quote_id": "uuid",
  "original_total": 15000.00,
  "change_orders_total": 2500.00,
  "revised_total": 17500.00,
  "change_orders_count": 3
}
```

---

#### 4. Approve Change Order
```
POST /api/v1/change-orders/:id/approve
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Business Logic**:
- Change status to "approved"
- Update parent quote's revised total
- Create version record

**Response**: Approved change order

---

#### 5. Link Change Order to Project (Placeholder)
```
POST /api/v1/change-orders/:id/link-to-project
Auth: JWT required
Roles: Owner, Admin, Manager
```

**Purpose**: When project module exists, link change order

**Business Logic** (Phase 1 - Placeholder):
- Return success
- In Phase 2: Actually link to project record

**Response**: Success message

---

#### 6. Get Change Order History
```
GET /api/v1/quotes/:parentQuoteId/change-orders/history
Auth: JWT required
Roles: All authenticated users
```

**Purpose**: Timeline of all changes to approved quote

**Business Logic**:
- Fetch all change orders for parent
- Include version history
- Show cumulative impact over time

**Response**: Timeline of changes

---

## 🔗 SERVICE INTEGRATION

### Existing Services You MUST Use

**Communication Module** (Email):
- Use EmailService to send quotes
- Template name: "send-quote"
- Pass complete quote data as variables
- Attach PDF file
- Track email status if available

**File Storage Module**:
- Store PDFs: category = "quote_pdf"
- Store QR codes: category = "quote_qr_code"
- Get presigned URLs for downloads
- Handle file uploads/downloads

**Pricing Calculator** (from Dev 4):
- Use PricingCalculatorService for all pricing
- Get complete breakdown for PDF
- Calculate totals for dashboard

**Quote Template Service** (from Dev 2):
- Fetch active template for tenant
- Get platform default if tenant has none
- Access template HTML content

**Google Maps** (for address in PDF):
- Already validated by Dev 3
- Use stored lat/lng if needed

### PDF Generation Libraries

**Recommended Stack**:
1. **Handlebars** - Template rendering
2. **Puppeteer** - HTML to PDF conversion
3. **qrcode** - QR code generation
4. **sharp** - Image processing (if needed)

**Alternative Options**:
- wkhtmltopdf (lighter than Puppeteer)
- PDFKit (programmatic PDF creation)
- pdfmake (declarative PDF)

**Choose based on**:
- Server resources (Puppeteer is heavy)
- Template complexity
- Performance requirements

---

## 📝 STATUS AUTOMATION LOGIC

### Automatic Status Changes

**You must implement these automatic triggers**:

1. **Draft → Sent**:
   - Trigger: Email sent OR public URL generated
   - Action: Update quote.status to "sent"

2. **Sent → Read**:
   - Trigger: First public URL view logged
   - Action: Update quote.status to "read"
   - Run once per quote (first view only)

3. **Read/Sent → Approved** (when ready):
   - Trigger: Customer approval (future - Dev 6 or Phase 2)
   - Action: Update quote.status to "approved"
   - Also update lead.status to "customer"

4. **Ready → Sent**:
   - Trigger: Email sent
   - Action: Change from "ready" to "sent"

**Implementation**: Use service events or direct updates in relevant endpoints

---

## ✅ VALIDATION RULES

### Public URL Validation

- Token must be unique globally
- Token length = 32 characters
- Password: min 8 chars if provided
- Password hint: max 255 chars
- Token only active if quote status in ["sent", "read"]

### Email Validation

- Recipient email required
- Valid email format
- Quote must be "ready" or "sent"
- PDF must exist or be generated

### PDF Validation

- Quote must have at least 1 item
- All images must be accessible
- Template must exist
- Tenant branding available

### Dashboard Validation

- Date ranges: max 1 year span
- Pagination: max 100 per page
- Valid date formats (ISO 8601)

---

## 🎯 SUCCESS CRITERIA

You are done when:

- [ ] All 46 endpoints implemented and tested
- [ ] Public URL system working (generate, access, password protect)
- [ ] View tracking functional (log views, calculate analytics)
- [ ] PDF generation working (template + data → PDF)
- [ ] QR codes generated correctly
- [ ] Email sending integrated (using communication module)
- [ ] SMS infrastructure ready (endpoint exists, not active)
- [ ] Tenant dashboard showing real data
- [ ] Admin dashboard showing global data
- [ ] Advanced search working with all filters
- [ ] Change order system functional
- [ ] Status automation working (sent → read on view)
- [ ] All images embedded correctly in PDF
- [ ] PDF matches template design
- [ ] 100% API documentation complete
- [ ] Multi-tenant isolation verified
- [ ] No TypeScript errors
- [ ] Server runs without errors
- [ ] Frontend team has everything needed to start

---

## 📝 API DOCUMENTATION REQUIREMENTS

Create `/api/documentation/quotes_REST_API_DEV5.md` with:

**For EACH endpoint** (46 total):
1. Complete specification
2. Request/response schemas
3. Validation rules
4. Business logic
5. Integration points (email, PDF, file storage)
6. Error scenarios
7. Examples

**Additional Documentation**:
- PDF generation process (step-by-step)
- Template variable injection
- QR code embedding
- Email integration
- View tracking logic
- Dashboard metrics calculations
- Status automation triggers

---

## 📋 HANDOFF DOCUMENT

Create `/api/documentation/quotes_HANDOFF_DEV5.md` with:

**What You Completed**:
- Endpoints implemented (46 total)
- Services created (9 services)
- PDF generation system
- Analytics dashboards
- Public access system

**Integration Points**:
- Communication module (email)
- File storage module (PDFs, QR codes)
- Pricing calculator (Dev 4)
- Templates (Dev 2)

**Frontend Readiness**:
- [ ] All backend endpoints ready
- [ ] Public quote view accessible
- [ ] PDF downloadable
- [ ] Dashboards have data
- [ ] Search functional
- [ ] Admin panel ready

**PDF Generation**:
- Library used (Puppeteer/other)
- Template rendering approach
- Image embedding method
- QR code generation
- Performance benchmarks

**Known Issues/Limitations**:
- SMS not active (Phase 2)
- Any PDF generation issues
- Performance considerations

---

## ⚠️ COMMON MISTAKES TO AVOID

1. **Public endpoint security**: Validate tokens carefully, rate limit
2. **Password hashing**: ALWAYS use bcrypt, never plain text
3. **PDF performance**: PDF generation is slow, consider async
4. **Image embedding**: Test with large images, handle failures
5. **QR code size**: Keep reasonable (200x200px)
6. **Email failures**: Handle gracefully, don't block quote sending
7. **View tracking**: Don't double-count same session
8. **Dashboard performance**: Use indexes, consider caching
9. **Status automation**: Don't create loops (sent → read → sent)
10. **Tenant isolation**: Admin endpoints must check role
11. **PDF template errors**: Handle missing variables gracefully
12. **File storage**: Always use presigned URLs, set expiration

---

## 🚀 YOU'RE READY

You are completing the backend for the Quote module. Your work enables customers to view quotes and users to analyze performance.

**Your work enables**:
- Customers: View professional quotes online
- Users: Send quotes via email
- Managers: Analyze quote performance
- Admins: Monitor system-wide metrics
- Frontend: Build complete UI

**This is the final backend piece:**
- Public-facing features
- Customer interaction
- Business intelligence
- System administration
- External integrations

**Test thoroughly. Handle errors gracefully. Make it production-ready.**

**When complete, notify Backend Reviewer for final backend approval. Then Frontend team can begin!**

---

**Status**: 📋 **READY FOR IMPLEMENTATION**