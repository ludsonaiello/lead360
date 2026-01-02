# Backend Module: Tenant Management & Multi-Tenant Resolution

**Module Name**: Tenant Management  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/tenant-contract.md`  
**Agent**: Backend Specialist  
**Status**: Ready for Development

---

## Overview

This module implements the complete tenant business profile system and multi-tenant data isolation. You will build the data layer for all tenant information (legal, financial, operational) and the middleware that enforces tenant isolation.

**Read First**:
- `/documentation/contracts/tenant-contract.md` (complete requirements)
- `/documentation/shared/multi-tenant-rules.md` (isolation requirements)
- `/documentation/shared/security-rules.md` (data protection)

---

## Database Tables Structure

### **Table Relationships**

**Core Hierarchy**:
```
tenant (1) → (many) tenant_address
tenant (1) → (many) tenant_license
tenant (1) → (1) tenant_insurance
tenant (1) → (1) tenant_payment_terms
tenant (1) → (1) tenant_business_hours
tenant (1) → (many) tenant_custom_hours
tenant (1) → (many) tenant_service_area
tenant (1) → (many) user
user (1) → (1) user_signature

subscription_plan (1) → (many) tenant
license_type (1) → (many) tenant_license
```

### **Tables to Create**

1. **tenant** - Core business profile
2. **tenant_address** - Multiple addresses (legal, billing, service, mailing)
3. **tenant_license** - Professional licenses
4. **license_type** - Admin-managed license type list
5. **tenant_insurance** - Insurance and bonding info
6. **tenant_payment_terms** - Default payment terms (JSON)
7. **tenant_business_hours** - Standard weekly hours
8. **tenant_custom_hours** - Holidays and special dates
9. **tenant_service_area** - Service coverage areas
10. **user_signature** - Estimator signatures (already have user table)
11. **subscription_plan** - Admin-managed subscription tiers

---

## Key Design Decisions

### **tenant Table**

**Purpose**: Core business profile with legal, tax, contact, and branding information

**Key Fields**:
- subdomain (unique, immutable identifier)
- legal_business_name (required, audit logged on change)
- dba_name (optional)
- business_entity_type (enum: sole_proprietorship, llc, corporation, partnership, dba)
- state_of_registration (2-letter state code)
- ein (required, unique, formatted as XX-XXXXXXX)
- state_tax_id (optional)
- sales_tax_permit (optional)
- primary_contact_phone (required, formatted)
- secondary_phone (optional)
- primary_contact_email (required)
- support_email (optional)
- billing_email (optional)
- website_url (optional)
- instagram_url, facebook_url, tiktok_url, youtube_url (all optional)
- bank_name, routing_number, account_number, account_type (all optional)
- venmo_username, venmo_qr_code_file_id (optional)
- logo_file_id (reference to file storage)
- primary_brand_color, secondary_brand_color, accent_color (hex codes)
- invoice_prefix (default "INV")
- next_invoice_number (auto-increment, starts at 1)
- quote_prefix (default "Q-")
- next_quote_number (auto-increment, starts at 1)
- default_quote_validity_days (default 30)
- default_quote_terms (text)
- default_quote_footer (text)
- default_invoice_footer (text)
- default_payment_instructions (text)
- timezone (auto-detected from address)
- subscription_plan_id (foreign key to subscription_plan)
- subscription_status (enum: trial, active, suspended, cancelled)
- trial_end_date (nullable)
- billing_cycle (enum: monthly, annual)
- next_billing_date (nullable)
- created_at, updated_at, deleted_at (soft delete)

**Indexes**:
- Unique: subdomain
- Unique: ein
- Index: subscription_status
- Index: trial_end_date (for expiry checks)

**Validation Rules**:
- subdomain: 3-63 chars, alphanumeric + hyphens, lowercase, no reserved words
- ein: 9 digits, formatted as XX-XXXXXXX
- email fields: valid email format
- phone fields: 10 digits, stored as digits only, displayed formatted
- urls: valid HTTP/HTTPS format
- brand colors: valid hex codes (#RRGGBB)

---

### **tenant_address Table**

**Purpose**: Store multiple addresses per tenant

**Key Fields**:
- tenant_id (foreign key)
- address_type (enum: legal, billing, service, mailing, office)
- line1 (required)
- line2 (optional)
- city (required)
- state (required, 2-letter code)
- zip_code (required, 5 or 9 digits)
- country (default "USA", read-only)
- lat (required)
- long (required)
- is_po_box (boolean)
- is_default (boolean)
- created_at, updated_at

**Indexes**:
- Composite: (tenant_id, address_type)
- Composite: (tenant_id, is_default)

**Business Logic**:
- At least one legal address required
- Cannot delete last legal address
- Legal address cannot be PO Box only
- Setting is_default=true un-sets other defaults of same type
- ZIP code validation: 5 digits or 5+4 format

---

### **tenant_license Table**

**Purpose**: Store professional licenses

**Key Fields**:
- tenant_id (foreign key)
- license_type_id (foreign key to license_type, nullable if "Other")
- custom_license_type (text, used if license_type_id is null)
- license_number (required)
- issuing_state (2-letter code)
- issue_date (date)
- expiry_date (date, required)
- document_file_id (reference to file storage)
- created_at, updated_at

**Indexes**:
- Composite: (tenant_id, expiry_date) - for expiry queries
- Index: expiry_date - for global expiry alerts

**Business Logic**:
- Multiple licenses per tenant allowed
- If license_type_id is null, custom_license_type must be provided
- Expiry alerts: 30, 15, 7, 1 days before expiry_date
- Expired license shows warning but doesn't block operations

---

### **license_type Table**

**Purpose**: Admin-managed list of license types

**Key Fields**:
- id (primary key)
- name (required, unique - e.g., "General Contractor License")
- description (optional)
- is_active (boolean, default true)
- created_at, updated_at

**Initial Data**:
- General Contractor License
- Electrical Contractor License
- Plumbing Contractor License
- HVAC Contractor License
- Roofing Contractor License
- Landscaping License
- Pest Control License
- Home Improvement License
- Business License

**Business Logic**:
- Platform admin can add/edit/deactivate types
- Inactive types don't appear in dropdown but existing licenses remain valid
- "Other" option allows custom entry (license_type_id = null)

---

### **tenant_insurance Table**

**Purpose**: Store insurance and bonding information

**Key Fields**:
- tenant_id (foreign key, unique - one insurance record per tenant)
- gl_insurance_provider (general liability)
- gl_policy_number
- gl_coverage_amount (decimal)
- gl_effective_date
- gl_expiry_date
- gl_document_file_id
- wc_insurance_provider (workers comp)
- wc_policy_number
- wc_coverage_amount
- wc_effective_date
- wc_expiry_date
- wc_document_file_id
- created_at, updated_at

**Indexes**:
- Index: gl_expiry_date (for alerts)
- Index: wc_expiry_date (for alerts)

**Business Logic**:
- All fields optional (not all businesses have insurance)
- Expiry alerts: 30, 15, 7, 1 days before expiry
- Expired insurance shows dashboard warning
- Expired insurance shows warning on quote creation (but doesn't block)

---

### **tenant_payment_terms Table**

**Purpose**: Store default payment terms structure

**Key Fields**:
- tenant_id (foreign key, unique - one default per tenant)
- terms_json (JSON structure)
- created_at, updated_at

**JSON Structure**:
```
[
  {
    "sequence": 1,
    "type": "percentage", // or "fixed"
    "amount": 50, // percentage value or dollar amount
    "description": "Upfront deposit"
  },
  {
    "sequence": 2,
    "type": "percentage",
    "amount": 25,
    "description": "Upon permit approval"
  },
  {
    "sequence": 3,
    "type": "percentage",
    "amount": 25,
    "description": "Upon completion"
  }
]
```

**Business Logic**:
- JSON structure validated on save
- Must have at least one term
- If type="percentage", total percentages should equal 100 (warning, not error)
- Sequence numbers must be unique and sequential
- Used as default for new quotes (can be overridden per quote)

---

### **tenant_business_hours Table**

**Purpose**: Store standard weekly hours

**Key Fields**:
- tenant_id (foreign key, unique)
- monday_closed (boolean)
- monday_open1, monday_close1 (time)
- monday_open2, monday_close2 (time, nullable - for break)
- tuesday_closed, tuesday_open1, tuesday_close1, tuesday_open2, tuesday_close2
- wednesday_closed, wednesday_open1, wednesday_close1, wednesday_open2, wednesday_close2
- thursday_closed, thursday_open1, thursday_close1, thursday_open2, thursday_close2
- friday_closed, friday_open1, friday_close1, friday_open2, friday_close2
- saturday_closed, saturday_open1, saturday_close1, saturday_open2, saturday_close2
- sunday_closed, sunday_open1, sunday_close1, sunday_open2, sunday_close2
- created_at, updated_at

**Default Values** (on tenant creation):
- Monday-Friday: open1=08:00, close1=17:00, closed=false
- Saturday-Sunday: closed=true

**Business Logic**:
- If day_closed=true, ignore time values
- open2/close2 are optional (for lunch break)
- Validate: open1 < close1 and (if open2 exists) open2 < close2
- Validate: close1 < open2 (break must be after first shift)
- All times stored in tenant's timezone

---

### **tenant_custom_hours Table**

**Purpose**: Store holidays and special operating hours

**Key Fields**:
- tenant_id (foreign key)
- date (date, required)
- reason (text - e.g., "Christmas", "Vacation")
- closed (boolean)
- open_time, close_time (time, nullable if closed=true)
- created_at, updated_at

**Indexes**:
- Composite: (tenant_id, date) - unique

**Business Logic**:
- Multiple custom dates per tenant
- If closed=true, ignore open_time/close_time
- Used to override standard business hours for specific dates
- Future dates can be added for planning

---

### **tenant_service_area Table**

**Purpose**: Store service coverage areas

**Key Fields**:
- tenant_id (foreign key)
- type (enum: city, zipcode, radius)
- value (text - city name, ZIP code, or description)
- latitude (decimal, required)
- longitude (decimal, required)
- radius_miles (decimal, nullable - only for radius type)
- state (text, for city type)
- created_at, updated_at

**Indexes**:
- Composite: (tenant_id, type)
- Index: (latitude, longitude) - for distance queries

**Business Logic**:
- Multiple service areas per tenant (unlimited)
- For type="city": value=city name, state=state code, lat/lng=city center
- For type="zipcode": value=ZIP code, lat/lng=ZIP center
- For type="radius": value=description, lat/lng=center point, radius_miles=coverage
- Lat/lng required for ALL types (for AI agent distance calculations)
- Searchable by city name, ZIP code, or coordinates

---

### **user_signature Table**

**Purpose**: Store estimator signatures (extends user table)

**Key Fields**:
- user_id (foreign key, unique)
- signature_file_id (reference to file storage, PNG)
- signature_name (text - full name for display)
- signature_title (text - e.g., "Lead Estimator")
- signature_phone (text - e.g., "(978)896-8057)
- signature_email (text)
- created_at, updated_at

**Business Logic**:
- One signature per user
- Optional (users can have no signature)
- Used on quotes/contracts when logged-in user creates document
- If no signature, display typed name instead

---

### **subscription_plan Table**

**Purpose**: Admin-managed subscription tiers

**Key Fields**:
- id (primary key)
- name (required, unique - e.g., "Free", "Basic", "Pro", "Enterprise")
- description (optional)
- monthly_price (decimal)
- annual_price (decimal)
- max_users (integer)
- feature_flags (JSON object)
- is_active (boolean)
- is_default (boolean - used for new tenants)
- created_at, updated_at

**Feature Flags JSON Structure**:
```
{
  "leads_module": true,
  "quotes_module": true,
  "projects_module": true,
  "invoices_module": true,
  "finance_module": false,
  "ai_quote_agent": false,
  "ai_voice_agent": false,
  "customer_portal": true,
  "reporting_module": true,
  "api_access": false
}
```

**Initial Plans**:
- Free: $0/month, 1 user, basic features
- Basic: $49/month, 3 users, core features
- Pro: $149/month, 10 users, advanced features
- Enterprise: Custom pricing, unlimited users, all features

**Business Logic**:
- Only one plan can be is_default=true
- Cannot delete plan if tenants are using it
- Feature flags control module visibility and API access
- Max users enforced on user creation

---

## NestJS Module Structure

**Directory**:
```
src/modules/tenant/
├── tenant.module.ts
├── tenant.controller.ts
├── tenant.service.ts
├── services/
│   ├── tenant-address.service.ts
│   ├── tenant-license.service.ts
│   ├── tenant-insurance.service.ts
│   ├── tenant-payment-terms.service.ts
│   ├── tenant-business-hours.service.ts
│   ├── tenant-service-area.service.ts
│   └── subscription.service.ts
├── middleware/
│   └── tenant-resolution.middleware.ts
├── decorators/
│   ├── tenant-id.decorator.ts
│   └── require-feature.decorator.ts
├── guards/
│   └── feature-flag.guard.ts
├── dto/
│   ├── create-tenant.dto.ts
│   ├── update-tenant.dto.ts
│   ├── create-address.dto.ts
│   ├── create-license.dto.ts
│   ├── update-insurance.dto.ts
│   ├── update-payment-terms.dto.ts
│   ├── update-business-hours.dto.ts
│   ├── create-service-area.dto.ts
│   └── (many others...)
└── tenant.service.spec.ts
```

---

## Core Service Methods

### **TenantService**

1. **create(createTenantDto)**
   - Validate subdomain uniqueness
   - Validate EIN uniqueness
   - Create tenant with default values
   - Create default business hours
   - Set subscription status to "trial"
   - Set trial_end_date to 14 days from now
   - Return tenant

2. **findBySubdomain(subdomain)**
   - Lookup tenant by subdomain (case-insensitive)
   - Return tenant with subscription plan
   - Used by tenant resolution middleware

3. **findById(tenantId)**
   - Return tenant with all relations (addresses, licenses, insurance, etc.)
   - Filter by tenant_id (multi-tenant isolation)

4. **update(tenantId, updateTenantDto)**
   - Validate protected fields (legal_name, ein, subdomain require admin approval)
   - Update tenant
   - Audit log if protected field changed
   - Return updated tenant

5. **updateBranding(tenantId, brandingDto)**
   - Update logo_file_id, brand colors
   - Return updated tenant

6. **uploadLogo(tenantId, file)**
   - Upload file to file storage service
   - Update logo_file_id
   - Return file URL

7. **checkSubdomainAvailability(subdomain)**
   - Check if subdomain exists
   - Check if subdomain is reserved (www, app, api, admin, mail, ftp)
   - Return { available: true/false }

---

### **TenantAddressService**

1. **create(tenantId, createAddressDto)**
   - Create address for tenant
   - If first address of type, set is_default=true
   - Validate: Legal address cannot be PO Box only
   - Return address

2. **findAll(tenantId)**
   - Return all addresses for tenant
   - Group by type

3. **update(tenantId, addressId, updateAddressDto)**
   - Validate address belongs to tenant
   - If is_default changed, un-set other defaults of same type
   - Return updated address

4. **delete(tenantId, addressId)**
   - Validate address belongs to tenant
   - If deleting last legal address, throw error
   - If deleting default, reassign default to another address
   - Soft delete

---

### **TenantLicenseService**

1. **create(tenantId, createLicenseDto)**
   - Create license for tenant
   - If license_type_id provided, validate it exists
   - If license_type_id null, require custom_license_type
   - Return license

2. **findAll(tenantId)**
   - Return all licenses for tenant
   - Order by expiry_date

3. **findExpiring(days)**
   - Find all licenses expiring in X days (30, 15, 7, 1)
   - Return list of {tenant, license}
   - Used by background job for alerts

4. **update(tenantId, licenseId, updateLicenseDto)**
   - Validate license belongs to tenant
   - Update license
   - Return updated license

5. **delete(tenantId, licenseId)**
   - Validate license belongs to tenant
   - Soft delete

---

### **TenantInsuranceService**

1. **get(tenantId)**
   - Return insurance record for tenant
   - Create empty record if doesn't exist

2. **update(tenantId, updateInsuranceDto)**
   - Update insurance record
   - Return updated record

3. **findExpiring(days)**
   - Find all GL and WC insurance expiring in X days
   - Return list of {tenant, insurance, type}
   - Used by background job for alerts

---

### **TenantPaymentTermsService**

1. **get(tenantId)**
   - Return payment terms for tenant
   - Create default if doesn't exist

2. **update(tenantId, updatePaymentTermsDto)**
   - Validate JSON structure
   - Check sequences are unique and sequential
   - If type="percentage", warn if total != 100 (don't error)
   - Update terms
   - Return updated terms

---

### **TenantBusinessHoursService**

1. **get(tenantId)**
   - Return business hours for tenant

2. **update(tenantId, updateBusinessHoursDto)**
   - Validate time logic (open < close, break timing)
   - Update hours
   - Return updated hours

3. **getCustomHours(tenantId)**
   - Return all custom hours for tenant
   - Order by date

4. **createCustomHours(tenantId, createCustomHoursDto)**
   - Create custom hours entry
   - Validate: No duplicate dates
   - Return custom hours

5. **deleteCustomHours(tenantId, customHoursId)**
   - Validate belongs to tenant
   - Delete

---

### **TenantServiceAreaService**

1. **findAll(tenantId)**
   - Return all service areas for tenant
   - Group by type

2. **create(tenantId, createServiceAreaDto)**
   - Validate lat/lng required
   - If type="radius", require radius_miles
   - Create service area
   - Return service area

3. **delete(tenantId, serviceAreaId)**
   - Validate belongs to tenant
   - Delete

4. **checkCoverage(latitude, longitude)**
   - Check if coordinates fall within any service area
   - For radius: calculate distance from center
   - For city/zipcode: check if coordinates match area
   - Return { covered: true/false, area }

---

### **SubscriptionService** (Admin Only)

1. **createPlan(createPlanDto)**
   - Create subscription plan
   - If is_default=true, un-set others
   - Return plan

2. **updatePlan(planId, updatePlanDto)**
   - Update plan
   - If is_default changed, un-set others
   - Return updated plan

3. **updateTenantSubscription(tenantId, subscriptionDto)**
   - Update tenant's subscription plan
   - Update trial_end_date if provided
   - Update subscription_status
   - Notify tenant of change
   - Return updated tenant

4. **checkFeatureAccess(tenantId, featureName)**
   - Get tenant's subscription plan
   - Check feature_flags[featureName]
   - Return { allowed: true/false }

---

## Tenant Resolution Middleware

**Purpose**: Extract tenant_id from subdomain and inject into request context

**Implementation Logic**:

1. **Extract subdomain from request**
   - Parse hostname from request
   - Extract subdomain (everything before `.lead360.com`)
   - Handle special cases: www, app, api, admin

2. **Resolve tenant**
   - Call TenantService.findBySubdomain(subdomain)
   - If not found: throw 404 "Tenant not found"
   - If found: inject tenant_id into request context

3. **Special Subdomains**
   - `www.lead360.com` → Skip middleware (marketing site)
   - `app.lead360.com` → Skip middleware (login/registration)
   - `api.lead360.com` → Extract tenant_id from JWT instead
   - `admin.lead360.com` → Skip middleware (platform admin)

4. **Inject tenant context**
   - Set request.tenantId = tenant.id
   - Set request.tenant = tenant (full object)
   - Continue to controller

**Usage**:
- Apply globally to all routes except auth and admin
- Controllers access via @TenantId() decorator

---

## Feature Flag Enforcement

**Decorator**: `@RequireFeature('quotes_module')`

**Guard**: FeatureFlagGuard

**Implementation Logic**:
1. Extract tenant_id from request
2. Get tenant's subscription plan
3. Check feature_flags[featureName]
4. If false: throw 403 "Feature not available on your plan"
5. If true: allow request

**Usage**:
```
@RequireFeature('ai_quote_agent')
@Post('quotes/generate-ai')
async generateAiQuote(...) {
  // Only accessible if tenant's plan has ai_quote_agent enabled
}
```

---

## Validation Rules Summary

**Subdomain**:
- 3-63 characters
- Alphanumeric + hyphens only
- No consecutive hyphens
- Cannot start/end with hyphen
- Lowercase only
- No reserved words: www, app, api, admin, mail, ftp, smtp, pop, imap

**EIN**:
- Exactly 9 digits
- Format: XX-XXXXXXX
- Unique across platform

**Phone**:
- 10 digits (U.S.)
- Stored as digits only
- Displayed as (XXX) XXX-XXXX

**ZIP Code**:
- 5 digits or 9 digits (ZIP+4)
- Format: XXXXX or XXXXX-XXXX

**Email**:
- Standard email validation
- Lowercase normalized

**URL**:
- Valid HTTP/HTTPS format
- Optional http/https prefix

**Hex Color**:
- Format: #RRGGBB
- 6 hex characters after #

---

## Background Jobs

**Job**: Check Expiring Licenses and Insurance

**Schedule**: Daily at 9:00 AM (tenant's timezone)

**Logic**:
1. Find all licenses expiring in 30 days
2. Send alert email if not already sent
3. Repeat for 15, 7, 1 day thresholds
4. Same for GL and WC insurance
5. Mark alerts as sent to avoid duplicates

**Alert Recipients**:
- Owner role
- Admin role
- Configurable per tenant (future)

---

## Audit Logging

**Log These Actions**:
- Tenant created
- Business info updated (especially protected fields)
- Address added/updated/deleted
- License added/updated/deleted
- Insurance updated
- Subscription changed (plan, status, trial date)
- Logo uploaded
- Branding changed

**Audit Fields**:
- actor_user_id
- entity_type = "tenant" (or "tenant_address", "tenant_license", etc.)
- entity_id
- action
- before_json
- after_json
- timestamp

---

## Testing Requirements

**Unit Tests** (>80% coverage):
- Subdomain validation (format, uniqueness, reserved)
- EIN validation (format, uniqueness)
- Address validation (ZIP, required fields, PO Box logic)
- License expiry calculation (30, 15, 7, 1 days)
- Insurance expiry calculation
- Payment terms JSON validation
- Business hours time validation
- Service area coordinate validation
- Feature flag checking

**Integration Tests**:
- Create tenant (full flow)
- Get tenant with all relations
- Update tenant (various fields)
- Add multiple addresses
- Add multiple licenses
- Update insurance
- Configure business hours with breaks
- Add service areas (all types)
- Subdomain resolution (middleware)
- Feature flag enforcement

**Tenant Isolation Tests**:
- Tenant A cannot access Tenant B's addresses
- Tenant A cannot access Tenant B's licenses
- Tenant A cannot update Tenant B's data
- Subdomain resolution returns correct tenant

---

## Completion Checklist

- [ ] All tables created with indexes
- [ ] All service methods implemented
- [ ] Subdomain validation working
- [ ] EIN validation and uniqueness enforced
- [ ] Address management (CRUD, validation)
- [ ] License management (CRUD, expiry tracking)
- [ ] Insurance management (CRUD, expiry tracking)
- [ ] Payment terms (JSON validation)
- [ ] Business hours (standard + custom dates)
- [ ] Service areas (all types with lat/lng)
- [ ] Tenant resolution middleware working
- [ ] Feature flag guard working
- [ ] Background job (expiry alerts) implemented
- [ ] Audit logging implemented
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] Tenant isolation tests passing
- [ ] API documentation complete (Swagger)

---

## Common Pitfalls to Avoid

1. **Don't allow subdomain changes without admin approval** - Breaking change
2. **Don't allow EIN duplicates** - Legal violation
3. **Don't forget to filter by tenant_id** - Security breach
4. **Don't allow deletion of last legal address** - Business rule violation
5. **Don't store phone/ZIP with formatting** - Store digits only, format on display
6. **Don't skip validation on JSON fields** - Invalid data breaks quotes
7. **Don't hardcode timezone** - Auto-detect from address
8. **Don't forget lat/lng for all service areas** - AI agent needs it

---

**End of Backend Module Documentation**

This module is the foundation for multi-tenant isolation and all legal document generation.