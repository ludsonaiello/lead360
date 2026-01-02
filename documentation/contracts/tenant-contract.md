# Feature Contract: Tenant Management & Multi-Tenant Resolution

**Feature Name**: Tenant Management & Multi-Tenant Resolution  
**Module**: Multi-Tenancy Core  
**Sprint**: Sprint 0 - Platform Foundation  
**Status**: Draft

---

## Purpose

**What problem does this solve?**

Provides complete business profile management for service companies using the Lead360 platform. Stores all legal, financial, and operational data required to generate invoices, quotes, receipts, and legal documents. Implements subdomain-based tenant resolution for multi-tenant isolation.

**Who is this for?**

- **Primary Users**: Tenant Owners, Platform Admins
- **Use Cases**: 
  - Complete business setup and profile management
  - Legal document generation (invoices, quotes, contracts)
  - Multi-tenant data isolation
  - Subscription and billing management

---

## Scope

### **In Scope**

- ✅ Complete tenant business profile (legal, tax, contact, financial data)
- ✅ Multiple business addresses (legal, billing, service, mailing)
- ✅ Multiple professional licenses (expandable list managed by admin)
- ✅ Insurance and bonding tracking with expiry alerts
- ✅ Payment terms (customizable per tenant, overridable per quote)
- ✅ Branding (logo, colors for quotes/invoices/portal)
- ✅ Business hours (standard weekly + custom dates/holidays)
- ✅ Service areas (cities, ZIP codes, radius-based with coordinates)
- ✅ Multiple estimator/vendor signatures per tenant
- ✅ Subscription tier management (Free, Basic, Pro, Enterprise)
- ✅ Feature flags per plan (module access control)
- ✅ Subdomain-based tenant resolution
- ✅ Tenant isolation middleware

### **Out of Scope**

- ❌ DUNS number tracking
- ❌ International businesses (U.S. only for MVP)
- ❌ Multi-language support
- ❌ Advanced service area mapping UI (Google Maps integration is post-MVP)
- ❌ Automated insurance renewal
- ❌ Payment processing integration (Stripe/PayPal - separate module)

---

## Dependencies

### **Requires (must be complete first)**

- [ ] Authentication module (user management)
- [ ] Database initialized
- [ ] File storage service (for logo uploads)
- [ ] Email service (for expiry alerts)

### **Blocks (must complete before)**

- RBAC (requires tenant_id assignment)
- Leads module (requires tenant isolation)
- Quotes module (requires tenant branding, payment terms)
- Invoices module (requires tenant legal/financial data)
- All business modules

---

## Data Model

### **Core Tables Required**

1. **tenant**
   - Primary business profile
   - Legal and tax information
   - Contact information
   - Branding settings
   - Subscription status

2. **tenant_address**
   - Multiple addresses per tenant
   - Types: legal, billing, service, mailing, office
   - Support for PO boxes
   - Full U.S. address format

3. **tenant_license**
   - Professional licenses (multiple per tenant)
   - License type from admin-managed list
   - Expiry tracking
   - Document upload reference

4. **license_type**
   - Admin-managed list of license types
   - Examples: General Contractor, Electrical, Plumbing, HVAC, Roofing
   - Allows platform admin to add new types

5. **tenant_insurance**
   - General liability insurance
   - Workers' compensation insurance
   - Expiry tracking
   - Policy details

6. **tenant_payment_terms**
   - Default payment terms (JSON structure)
   - Multiple terms per tenant
   - Used as default for quotes (can be overridden)

7. **tenant_business_hours**
   - Standard weekly hours
   - Two time slots per day (morning + afternoon with break)
   - Timezone-aware

8. **tenant_custom_hours**
   - Holidays and special closures
   - Custom operating hours for specific dates

9. **tenant_service_area**
   - Service coverage areas
   - Types: city, zipcode, radius
   - Latitude/longitude for all types (for AI agent processing)

10. **user_signature**
    - Estimator/vendor signatures
    - PNG upload per user
    - Used on quotes and contracts

11. **subscription_plan**
    - Admin-managed subscription tiers
    - Feature flags configuration
    - User limits
    - Pricing

---

## Business Entity & Legal Information

### **Required Fields**

**Legal Identity**:
- Legal business name (required, official registered name)
- DBA name (optional, "doing business as")
- Business entity type (required, enum: Sole Proprietorship, LLC, Corporation, Partnership, DBA)
- State of registration (required, U.S. state)
- Date of incorporation/registration (optional)

**Tax Identification**:
- EIN (Employer Identification Number) - REQUIRED
  - Format: 12-3456789
  - Validation: 9 digits, formatted
- State Tax ID (optional)
- Sales Tax Permit Number (optional)

### **Validation Rules**

1. **Legal Business Name**
   - Required
   - 2-200 characters
   - Cannot be changed without admin approval (audit trail)

2. **EIN**
   - Required
   - Format: XX-XXXXXXX (9 digits)
   - Unique across platform (one EIN per tenant)
   - Validation: Must be valid EIN format

3. **Business Entity Type**
   - Required
   - Enum values only
   - Cannot be empty

4. **State of Registration**
   - Required
   - Valid U.S. state code (2-letter)

---

## Address Management

### **Address Types**

Each tenant can have multiple addresses of these types:
- **Legal Address**: Official registered business address
- **Billing Address**: Where invoices and payments are sent
- **Service Address**: Where business operates from
- **Mailing Address**: For correspondence
- **Office Address**: Physical office location

### **Address Fields** (Standard U.S. Format)

- Address Line 1 (required)
- Address Line 2 (optional)
- City (required)
- State (required, 2-letter code)
- ZIP Code (required, 5-digit or ZIP+4 format)
- Country (default: "USA", read-only for MVP)
- Is PO Box (boolean flag)

### **Business Rules**

1. **Legal Address Required**: Every tenant must have at least one legal address
2. **Default Address**: First address created becomes default
3. **PO Box Restrictions**: Legal address cannot be PO Box only
4. **Address Validation**: Validate U.S. ZIP code format (5 digits or 9 digits)
5. **Multiple Addresses**: Tenant can have multiple addresses of same type

---

## Contact Information

### **Business Contact Fields**

**Phone Numbers**:
- Primary Contact Phone (required, business main line)
- Secondary Phone (optional, mobile/alternate)

**Email Addresses**:
- Primary Contact Email (required, main business email)
- Support Email (optional, customer support)
- Billing Email (optional, for invoices and payments)

**Web & Social**:
- Website URL (optional)
- Instagram URL (optional)
- Facebook URL (optional)
- TikTok URL (optional)
- YouTube URL (optional)

### **Validation Rules**

1. **Phone Format**: U.S. phone format (10 digits), displayed as (555) 123-4567
2. **Email Format**: Valid email addresses
3. **URL Format**: Valid HTTP/HTTPS URLs
4. **Primary Email Required**: Cannot be empty
5. **Social URLs Optional**: All social media links are optional

---

## Financial & Payment Information

### **Bank Account Details** (Optional but Recommended)

For receiving ACH/wire payments:
- Bank Name
- Routing Number (9 digits)
- Account Number
- Account Type (Checking, Savings)

**Venmo Account** (Optional):
- Venmo Username
- Venmo QR Code (upload)

### **Payment Terms Structure**

Tenants can define default payment terms as structured data (JSON):

**Structure**:
- Array of payment milestones
- Each milestone has:
  - Sequence number (order)
  - Type (percentage or fixed amount)
  - Amount (percentage value or dollar amount)
  - Description (what triggers this payment)

**Examples**:
```
Term 1: 50% - Upfront deposit
Term 2: 25% - Upon permit approval
Term 3: 25% - Upon project completion

OR

Term 1: $5,000 - Material deposit
Term 2: $10,000 - Midpoint inspection
Term 3: Balance - Final completion
```

**Usage**:
- Default payment terms applied to all new quotes
- Can be overridden per quote
- Stored as JSON for flexibility

### **Invoice Settings**

- Invoice Prefix (default: "INV", customizable)
- Next Invoice Number (auto-increment, editable by admin)
- Invoice Footer Text (default text, overridable per invoice)
- Payment Instructions (default text, overridable per invoice)

### **Quote Settings**

- Quote Prefix (default: "Q-", customizable)
- Next Quote Number (auto-increment)
- Default Quote Validity Period (default: 30 days, tenant can customize)
- Default Terms & Conditions (global, editable per quote)
- Default Quote Footer Text (global, editable per quote)
- Require Signature (boolean, always yes for MVP)

---

## Branding & Visual Identity

### **Logo**

- File upload: PNG, JPG, WEBP
- Max file size: 5MB
- Recommended dimensions: 500x200px
- Used on: Invoices, Quotes, Customer Portal
- upload it to ./uploads/public/[tenant]/images/filename

### **Brand Colors**

- Primary Brand Color (hex code, required)
- Secondary Brand Color (hex code, required)
- Accent Color (hex code, required)
- Used on: Customer portal, quote/invoice headers

### **Font**

- Default font is system-chosen (not user-customizable for MVP)
- Ensures consistency and readability

---

## Professional Licenses

### **License Types**

Admin-managed list stored in `license_type` table. Platform admin can add/edit license types.

**Initial List**:
- General Contractor License
- Electrical Contractor License
- Plumbing Contractor License
- HVAC Contractor License
- Roofing Contractor License
- Landscaping License
- Pest Control License
- Home Improvement License
- Business License
- Other (custom entry)

### **License Storage** (Per Tenant)

Each tenant can have multiple licenses:
- License Type (from admin list or "Other")
- License Number
- Issuing State
- Issue Date
- Expiry Date
- Document Upload (PDF/image of license) - ./uploads/public/[tenant]/files/filename

### **Business Rules**

1. **Multiple Licenses**: Tenant can have multiple licenses
2. **Expiry Tracking**: System alerts tenant before expiry
3. **No Enforcement**: Expired license shows warning but doesn't block operations
4. **Custom Types**: If "Other" selected, tenant enters custom license name

---

## Insurance & Bonding

### **General Liability Insurance**

- Insurance Provider Name
- Policy Number
- Coverage Amount (dollar value)
- Effective Date
- Expiry Date
- Policy Document Upload - ./uploads/public/[tenant]/files/filename

### **Workers' Compensation Insurance**

- Insurance Provider Name
- Policy Number
- Coverage Amount
- Effective Date
- Expiry Date
- Policy Document Upload - ./uploads/public/[tenant]/files/filename

### **Expiry Alerts**

System sends email alerts to tenant at:
- 30 days before expiry
- 15 days before expiry
- 7 days before expiry
- 1 day before expiry

**Warning Display**:
- If insurance expired, show warning banner on dashboard
- Show warning when creating quotes (but do not prevent)
- Visual indicator in tenant profile

### **Business Rules**

1. **Optional Fields**: Insurance is optional (not all businesses require it)
2. **No Blocking**: Expired insurance shows warnings but doesn't prevent operations
3. **Alert Preferences**: Tenant can configure who receives alerts (owner, admin)

---

## Business Hours

### **Standard Weekly Hours**

Each day of the week can have:
- Closed (boolean flag)
- First time slot (open, close)
- Second time slot (optional, for lunch break)

**Example**:
- Monday: 8:00 AM - 11:30 AM, 1:00 PM - 7:00 PM
- Tuesday: 8:00 AM - 5:00 PM (single slot)
- Saturday: Closed

**Default**:
- Monday-Friday: 8:00 AM - 5:00 PM (single slot)
- Saturday-Sunday: Closed

### **Custom Hours (Holidays/Special Dates)**

Tenant can define specific dates with custom hours:
- Date
- Reason (e.g., "Christmas", "Vacation", "Special Event")
- Closed (boolean)
- Custom Open/Close times (if not closed)

**Examples**:
- December 25, 2025: Closed (Christmas)
- July 4, 2025: Open 8:00 AM - 12:00 PM (Holiday hours)

### **Timezone**

- Automatically detected from legal address (ZIP code → timezone)
- Tenant can override if needed
- All hours stored in tenant's timezone

---

## Service Areas

### **Service Area Types**

Tenants define where they provide services:

1. **By City**
   - City name
   - State
   - Latitude/Longitude (for distance calculations)

2. **By ZIP Code**
   - ZIP code
   - Latitude/Longitude (for distance calculations)

3. **By Radius**
   - Center point (latitude, longitude)
   - Radius (miles)
   - Description (e.g., "25 miles from Boston office")

### **Multiple Service Areas**

Tenant can define unlimited service areas (mix of cities, ZIP codes, and radii).

**Examples**:
- Service Area 1: Boston, MA (city)
- Service Area 2: 02101, 02139, 02144 (ZIP codes)
- Service Area 3: 25-mile radius from office (lat/lng + radius)

### **Why Latitude/Longitude for All Types**

Even city and ZIP code areas store coordinates to support:
- AI caller agent (distance calculations)
- Lead qualification (is customer in service area?)
- Route optimization
- Map visualizations (future)

### **Business Rules**

1. **At Least One Area**: Tenant must define at least one service area
2. **Searchable**: Service areas must be searchable by city, ZIP, or coordinates
3. **Expandable**: Tenant can add/remove areas anytime

---

## Estimator/Vendor Signatures

### **Signature Storage**

Each user can have:
- Signature Image (PNG upload)
- Signature metadata (name, title, phone, email)

**Usage**:
- When creating quote, system uses signature of logged-in user
- Signature appears on quote PDF
- Multiple estimators can have different signatures

### **Business Rules**

1. **Per-User Signatures**: Each estimator has their own signature
2. **Optional**: Signature upload is optional
3. **Default Behavior**: If no signature uploaded, show typed name
4. **Company Signature**: Tenant can also have a company signature (separate from user)

---

## Subscription & Plans

### **Subscription Plans** (Admin-Managed)

Platform admin creates and manages subscription tiers:
- Plan Name (Free, Basic, Pro, Enterprise, Custom)
- Monthly Price
- Annual Price (discounted)
- Max Users Allowed
- Feature Flags (which modules are enabled)

**Default Plans** (Initial Setup):
- **Free**: 1 user, basic features
- **Basic**: 3 users, core features
- **Pro**: 10 users, advanced features
- **Enterprise**: Unlimited users, all features

### **Feature Flags**

Each plan has boolean flags for module access:
- Leads Module
- Quotes Module
- Projects Module
- Invoices Module
- Finance Module
- AI Quote Agent
- AI Voice Agent
- Customer Portal
- Reporting Module
- API Access

**Customization**:
- Platform admin can enable/disable features per plan
- Admin can create custom plans with specific feature combinations

### **Subscription Status**

Each tenant has:
- Subscription Plan (assigned by admin or self-selected)
- Subscription Status (trial, active, suspended, cancelled)
- Trial End Date (if in trial)
- Billing Cycle (monthly, annual)
- Next Billing Date

### **User Limits**

- Max users defined by subscription plan
- System prevents adding users beyond limit
- Admin can override limit manually

### **Project/Quote Limits**

For MVP, all plans have:
- **Unlimited projects**
- **Unlimited quotes**

(This keeps things simple and avoids complex limit enforcement)

---

## Multi-Tenant Resolution

### **Subdomain-Based Routing**

**How It Works**:
- Each tenant has a unique subdomain (slug)
- Example: `acme-roofing.lead360.com`
- Subdomain extracted from HTTP request
- Subdomain maps to tenant_id
- All database queries filtered by tenant_id

### **Subdomain Rules**

1. **Uniqueness**: Subdomain must be globally unique
2. **Format**: 3-63 characters, alphanumeric + hyphens, lowercase
3. **Reserved Subdomains**: Cannot use: `www`, `app`, `api`, `admin`, `mail`, `ftp`
4. **Immutability**: Once set, subdomain cannot be changed (without admin approval)

### **Tenant Resolution Middleware**

**Request Flow**:
1. User visits `acme-roofing.lead360.com`
2. Middleware extracts subdomain: `acme-roofing`
3. Lookup tenant by subdomain
4. If found: Inject `tenant_id` into request context
5. If not found: Show "Tenant not found" error
6. All subsequent DB queries auto-filter by `tenant_id`

### **Special Cases**

- **www.lead360.com**: Marketing site (no tenant)
- **app.lead360.com**: Login/registration page (no tenant yet)
- **api.lead360.com**: API endpoints (tenant from JWT token)
- **admin.lead360.com**: Platform admin panel (no tenant filtering)

---

## API Specification

### **Endpoints Overview**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | /tenants | Create tenant (registration) | No | - |
| GET | /tenants/:id | Get tenant profile | Yes | Owner, Admin |
| PATCH | /tenants/:id | Update tenant profile | Yes | Owner, Admin |
| GET | /tenants/:id/addresses | List addresses | Yes | All |
| POST | /tenants/:id/addresses | Add address | Yes | Owner, Admin |
| PATCH | /tenants/:id/addresses/:addressId | Update address | Yes | Owner, Admin |
| DELETE | /tenants/:id/addresses/:addressId | Delete address | Yes | Owner, Admin |
| GET | /tenants/:id/licenses | List licenses | Yes | All |
| POST | /tenants/:id/licenses | Add license | Yes | Owner, Admin |
| PATCH | /tenants/:id/licenses/:licenseId | Update license | Yes | Owner, Admin |
| DELETE | /tenants/:id/licenses/:licenseId | Delete license | Yes | Owner, Admin |
| GET | /tenants/:id/insurance | Get insurance info | Yes | Owner, Admin, Bookkeeper |
| PATCH | /tenants/:id/insurance | Update insurance | Yes | Owner, Admin |
| GET | /tenants/:id/business-hours | Get business hours | Yes | All |
| PATCH | /tenants/:id/business-hours | Update business hours | Yes | Owner, Admin |
| GET | /tenants/:id/custom-hours | List custom hours | Yes | All |
| POST | /tenants/:id/custom-hours | Add custom hours | Yes | Owner, Admin |
| DELETE | /tenants/:id/custom-hours/:id | Delete custom hours | Yes | Owner, Admin |
| GET | /tenants/:id/service-areas | List service areas | Yes | All |
| POST | /tenants/:id/service-areas | Add service area | Yes | Owner, Admin |
| DELETE | /tenants/:id/service-areas/:id | Delete service area | Yes | Owner, Admin |
| GET | /tenants/:id/payment-terms | Get default payment terms | Yes | Owner, Admin, Estimator |
| PATCH | /tenants/:id/payment-terms | Update payment terms | Yes | Owner, Admin |
| PATCH | /tenants/:id/branding | Update branding | Yes | Owner, Admin |
| POST | /tenants/:id/logo | Upload logo | Yes | Owner, Admin |

**Admin-Only Endpoints**:
| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /admin/tenants | List all tenants | Yes | Platform Admin |
| POST | /admin/tenants | Create tenant | Yes | Platform Admin |
| PATCH | /admin/tenants/:id/subscription | Update subscription | Yes | Platform Admin |
| PATCH | /admin/tenants/:id/status | Update status | Yes | Platform Admin |
| GET | /admin/license-types | List license types | Yes | Platform Admin |
| POST | /admin/license-types | Add license type | Yes | Platform Admin |
| PATCH | /admin/license-types/:id | Update license type | Yes | Platform Admin |
| GET | /admin/subscription-plans | List plans | Yes | Platform Admin |
| POST | /admin/subscription-plans | Create plan | Yes | Platform Admin |
| PATCH | /admin/subscription-plans/:id | Update plan | Yes | Platform Admin |

---

## Business Rules

### **Tenant Creation**

1. **Subdomain Validation**
   - Check uniqueness before creating
   - Validate format (alphanumeric + hyphens)
   - Convert to lowercase
   - Reject reserved subdomains

2. **Required Data on Creation**
   - Legal business name
   - Business entity type
   - EIN
   - At least one address (legal)
   - Primary contact email
   - Primary contact phone
   - Owner user (created during registration)

3. **Default Values**
   - Subscription status: "trial"
   - Trial end date: 14 days from creation
   - Subscription plan: "Free"
   - Invoice prefix: "INV"
   - Quote prefix: "Q-"
   - Invoice/quote counters: Start at 1

### **Tenant Profile Updates**

1. **Protected Fields** (Require Admin Approval)
   - Legal business name
   - Subdomain
   - EIN
   - Business entity type

2. **Freely Editable Fields**
   - All contact information
   - Addresses
   - Branding
   - Payment terms
   - Business hours

### **Address Management**

1. **Legal Address Required**: Cannot delete last legal address
2. **Default Address**: Deleting default address reassigns to another
3. **Billing Fallback**: If no billing address, use legal address

### **License Expiry**

1. **Alert Schedule**: 30, 15, 7, 1 days before expiry
2. **Alert Recipients**: Owner and Admin roles
3. **No Blocking**: Expired license shows warning but doesn't prevent operations
4. **Renewal Tracking**: Track renewal date when updated

### **Insurance Expiry**

1. **Same Alert Schedule**: 30, 15, 7, 1 days before expiry
2. **Dashboard Warning**: Show banner when expired
3. **Quote Warning**: Show warning on quote creation (but allow)

### **Subscription Management**

1. **Trial Period**: 14 days from registration
2. **Trial Expiry**: Tenant suspended if no payment after trial
3. **Suspended Access**: Read-only access (can view but not create)
4. **Cancellation**: Soft delete (data retained for 90 days)
5. **Reactivation**: Admin can reactivate within retention period

### **Feature Flags**

1. **Plan-Based Access**: Features enabled/disabled per plan
2. **Module Hiding**: Disabled modules don't appear in UI
3. **API Enforcement**: API returns 403 if module disabled
4. **Upgrade Prompt**: Show upgrade CTA if feature disabled

---

## UI Requirements

### **Pages Required**

1. **Tenant Profile Page** (`/settings/business`)
   - Tabbed interface:
     - Business Info
     - Addresses
     - Licenses
     - Insurance
     - Financial
     - Branding
     - Business Hours
     - Service Areas

2. **Platform Admin - Tenant Management** (`/admin/tenants`)
   - List all tenants
   - Search/filter
   - View tenant details
   - Edit subscription
   - Suspend/activate

3. **Platform Admin - License Types** (`/admin/license-types`)
   - List license types
   - Add/edit types

4. **Platform Admin - Subscription Plans** (`/admin/subscription-plans`)
   - List plans
   - Create/edit plans
   - Configure feature flags

---

## User Flows

### **Primary Flow: Tenant Registration**

1. User completes auth registration
2. System prompts for business setup
3. User enters:
   - Legal name, DBA, entity type
   - EIN
   - Legal address
   - Contact info
4. System validates subdomain availability
5. System creates tenant with default settings
6. User redirected to dashboard
7. Prompt to complete profile (insurance, licenses, etc.)

### **Secondary Flow: Edit Business Profile**

1. Owner navigates to Settings → Business
2. Tabs: Business Info, Addresses, etc.
3. User edits fields
4. Click "Save Changes"
5. Validation
6. Success toast
7. Audit log entry

### **Admin Flow: Manage Subscription**

1. Admin views tenant in admin panel
2. Click "Edit Subscription"
3. Select plan, set trial end date, adjust limits
4. Save
5. Tenant notified of changes
6. Feature access updated immediately

---

## Security & Permissions

### **RBAC Matrix**

| Action | Owner | Admin | Estimator | PM | Bookkeeper | Employee |
|--------|-------|-------|-----------|----|-----------| ---------|
| View tenant profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit business info | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage addresses | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage licenses | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View insurance | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Edit insurance | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit branding | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Edit payment terms | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| View payment terms | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |

### **Multi-Tenant Isolation**

- ✅ All queries MUST filter by `tenant_id`
- ✅ `tenant_id` injected by middleware (from subdomain or JWT)
- ✅ Never trust `tenant_id` from client
- ✅ Tenant isolation tests required

### **Audit Logging**

**Log These Actions**:
- Tenant created
- Business info updated
- Address added/updated/deleted
- License added/updated/deleted
- Insurance updated
- Subscription changed
- Status changed (trial → active, active → suspended)

---

## Testing Requirements

### **Backend Tests**

**Unit Tests**:
- ✅ Subdomain validation (format, uniqueness, reserved)
- ✅ EIN validation (format, uniqueness)
- ✅ Address validation (required fields, ZIP format)
- ✅ Payment terms JSON structure validation
- ✅ Business hours time validation
- ✅ Service area coordinate validation
- ✅ License expiry calculation
- ✅ Insurance expiry alerts (30, 15, 7, 1 days)

**Integration Tests**:
- ✅ Create tenant (full registration flow)
- ✅ Get tenant profile (with all relations)
- ✅ Update tenant (business info, addresses, etc.)
- ✅ Add/remove addresses
- ✅ Add/remove licenses
- ✅ Update insurance
- ✅ Upload logo
- ✅ Subdomain resolution (middleware)

**Tenant Isolation Tests**:
- ✅ Tenant A cannot access Tenant B's data
- ✅ Subdomain resolution returns correct tenant
- ✅ Invalid subdomain returns 404

### **Frontend Tests**

**Component Tests**:
- ✅ Business info form validates EIN format
- ✅ Address form validates ZIP code
- ✅ Business hours form allows two time slots
- ✅ License form requires expiry date
- ✅ Branding form allows logo upload

**E2E Tests**:
- ✅ Complete tenant registration flow
- ✅ Edit business profile
- ✅ Add multiple addresses
- ✅ Upload and update logo
- ✅ Configure business hours with breaks
- ✅ Add service areas (city, ZIP, radius)

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend**
- [ ] All tables created
- [ ] Tenant CRUD operations working
- [ ] Address management working (multiple addresses)
- [ ] License management working (multiple licenses, expiry tracking)
- [ ] Insurance management working (expiry alerts configured)
- [ ] Payment terms storage (JSON structure)
- [ ] Business hours storage (standard + custom dates)
- [ ] Service areas storage (with lat/lng)
- [ ] Subdomain resolution middleware working
- [ ] Tenant isolation enforced (all queries filtered)
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] Tenant isolation tests passing
- [ ] API documentation complete

### **Frontend**
- [ ] Business profile page (all tabs)
- [ ] Address management UI
- [ ] License management UI
- [ ] Insurance tracking UI
- [ ] Business hours UI (with break support)
- [ ] Service area management UI
- [ ] Branding settings (logo upload, colors)
- [ ] Admin tenant management
- [ ] Admin license type management
- [ ] Admin subscription plan management
- [ ] Component tests >70% coverage
- [ ] E2E tests passing
- [ ] Mobile responsive

### **Integration**
- [ ] Subdomain routing working
- [ ] Tenant data loads correctly
- [ ] Profile updates save successfully
- [ ] Logo upload works
- [ ] Expiry alerts send correctly
- [ ] Feature flags enforce access

---

## Open Questions

1. **Geocoding API**
   - **Question**: Which service for converting addresses to lat/lng?
   - **Options**: Google Maps API, Mapbox, OpenStreetMap
   - **Decision needed by**: Before service area implementation
   - **Blocker**: No (can use static coordinates for MVP)

2. **Insurance Document Storage**
   - **Question**: Where to store uploaded insurance policy documents?
   - **Options**: S3, file storage service module
   - **Decision needed by**: Before insurance module implementation
   - **Blocker**: No (can defer to file storage module)

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Subdomain conflicts | High | Low | Validate uniqueness, reserve common names |
| EIN uniqueness violations | Medium | Medium | Validate on registration, allow admin override |
| Missing required business data | Medium | Medium | Require minimal data on registration, prompt for completion |
| Insurance expiry not monitored | Medium | Medium | Background job checks daily, sends alerts |
| Geocoding API costs | Low | Medium | Cache coordinates, use free tier initially |

---

## Timeline Estimate

**Backend Development**: 6-8 days
- Tenant model + all related tables: 2 days
- CRUD operations + relationships: 2 days
- Subdomain resolution middleware: 1 day
- Business logic (alerts, validation): 1 day
- Testing: 2 days

**Frontend Development**: 6-8 days
- Tenant profile page (all tabs): 3 days
- Admin panel (tenants, plans, licenses): 2 days
- Forms and validation: 1 day
- Testing: 2 days

**Integration & Testing**: 2 days

**Total**: 14-18 days

---

## Notes

- Tenant model is the foundation for all legal documents (quotes, invoices)
- Complete and accurate business data is critical for compliance
- Expiry tracking prevents legal issues (expired licenses/insurance)
- Multi-tenant isolation is non-negotiable for security
- Feature flags allow flexible monetization and gradual rollout

---

**End of Tenant Management Contract**

This contract must be approved before development begins.