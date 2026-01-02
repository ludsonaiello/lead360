# Tenant Module REST API Documentation

**Version**: 1.0
**Last Updated**: January 2026
**Base URL**: `https://api.lead360.app/api/v1/tenants`

---

## Overview

The Tenant Module provides comprehensive multi-tenant management capabilities for the Lead360 platform. This API allows tenants to manage their business profile, addresses, licenses, insurance, payment terms, business hours, and service areas.

**Key Features**:
- Complete tenant profile management (~50 business fields)
- Multiple business addresses with type categorization
- Professional license tracking with expiry monitoring
- General Liability and Workers Compensation insurance management
- Customizable payment milestone structures
- Business hours with lunch break support
- Holiday/special date custom hours
- Service area coverage with radius calculations
- Subscription plan management with feature flags

---

## Authentication

All endpoints require JWT authentication via Bearer token (except where noted).

**Header**:
```
Authorization: Bearer <access_token>
```

**Tenant Resolution**:
Tenant ID is automatically resolved from subdomain via middleware. All requests must be made to the tenant's subdomain:
```
https://{subdomain}.lead360.app
```

---

## Role-Based Access Control (RBAC)

| Endpoint Type | Allowed Roles |
|---------------|---------------|
| Read (GET) | All authenticated users |
| Create/Update/Delete | Owner, Admin |

---

## Table of Contents

1. [Tenant Profile](#tenant-profile)
2. [Addresses](#addresses)
3. [Licenses](#licenses)
4. [Insurance](#insurance)
5. [Payment Terms](#payment-terms)
6. [Business Hours](#business-hours)
7. [Custom Hours (Holidays)](#custom-hours)
8. [Service Areas](#service-areas)
9. [Admin Endpoints (Platform Admin Only)](#admin-endpoints)
10. [Error Responses](#error-responses)

---

## Tenant Profile

### Get Current Tenant Profile

Retrieve complete tenant profile including all relations.

**Endpoint**: `GET /api/v1/tenants/current`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "subdomain": "acme-roofing",
  "company_name": "ACME Roofing Inc",
  "is_active": true,

  // LEGAL & TAX INFORMATION
  "legal_business_name": "ACME Roofing Incorporated",
  "dba_name": "ACME Roofing",
  "business_entity_type": "llc",
  "state_of_registration": "CA",
  "date_of_incorporation": "2010-01-15T00:00:00Z",
  "ein": "12-3456789",
  "state_tax_id": "CA-123456",
  "sales_tax_permit": "ST-789012",

  // CONTACT INFORMATION
  "primary_contact_phone": "5551234567",
  "secondary_phone": "5551234568",
  "primary_contact_email": "info@acmeroofing.com",
  "support_email": "support@acmeroofing.com",
  "billing_email": "billing@acmeroofing.com",
  "website_url": "https://acmeroofing.com",
  "instagram_url": "https://instagram.com/acmeroofing",
  "facebook_url": "https://facebook.com/acmeroofing",
  "tiktok_url": null,
  "youtube_url": "https://youtube.com/acmeroofing",

  // FINANCIAL & PAYMENT INFORMATION
  "bank_name": "Wells Fargo",
  "routing_number": "121000248",
  "account_number": "****1234",
  "account_type": "checking",
  "venmo_username": "@acmeroofing",
  "venmo_qr_code_file_id": "file-uuid-venmo",

  // BRANDING
  "logo_file_id": "file-uuid-logo",
  "primary_brand_color": "#007BFF",
  "secondary_brand_color": "#6C757D",
  "accent_color": "#28A745",

  // INVOICE & QUOTE SETTINGS
  "invoice_prefix": "INV",
  "next_invoice_number": 1001,
  "quote_prefix": "Q-",
  "next_quote_number": 501,
  "default_quote_validity_days": 30,
  "default_quote_terms": "Payment due upon completion. All materials and labor guaranteed.",
  "default_quote_footer": "Thank you for your business!",
  "default_invoice_footer": "Payment is due within 30 days of invoice date.",
  "default_payment_instructions": "Please make checks payable to ACME Roofing Inc.",

  // OPERATIONAL
  "timezone": "America/Los_Angeles",

  // SUBSCRIPTION MANAGEMENT
  "subscription_plan_id": "uuid",
  "subscription_status": "active",
  "trial_end_date": null,
  "billing_cycle": "monthly",
  "next_billing_date": "2024-02-01T00:00:00Z",

  "subscription_plan": {
    "id": "uuid",
    "name": "Professional",
    "monthly_price": 99.99,
    "annual_price": 999.99,
    "max_users": 10,
    "max_quotes_per_month": 100,
    "max_storage_gb": 50,
    "feature_flags": {
      "leads_module": true,
      "quotes_module": true,
      "invoices_module": true,
      "scheduling_module": true,
      "reporting_module": true
    },
    "is_active": true,
    "is_default": false,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },

  // RELATIONS
  "addresses": [...],
  "licenses": [...],
  "insurance": {...},
  "payment_terms": {...},
  "business_hours": {...},
  "custom_hours": [...],
  "service_areas": [...],

  // TIMESTAMPS
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "deleted_at": null
}
```

---

### Update Current Tenant Profile

Update tenant profile fields (protected fields excluded).

**Endpoint**: `PATCH /api/v1/tenants/current`

**Authorization**: Required (Owner, Admin only)

**Request Body**:
```json
{
  "company_name": "ACME Roofing Inc",
  "primary_contact_phone": "(555) 123-4567",
  "primary_contact_email": "info@acmeroofing.com",
  "office_phone": "(555) 123-4568",
  "tax_rate": 7.25
}
```

**Protected Fields** (cannot be updated via this endpoint):
- `subdomain`
- `ein`
- `legal_business_name`
- `business_entity_type`

**Response** (200 OK):
```json
{
  "id": "uuid",
  "subdomain": "acme-roofing",
  "company_name": "ACME Roofing Inc",
  ...
}
```

**Error Responses**:
- `400 Bad Request` - Invalid field values
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions
- `409 Conflict` - EIN already exists (if updated by admin)

---

### Update Tenant Branding

Update visual branding settings.

**Endpoint**: `PATCH /api/v1/tenants/current/branding`

**Authorization**: Required (Owner, Admin only)

**Request Body**:
```json
{
  "primary_color": "#007BFF",
  "secondary_color": "#6C757D",
  "logo_file_id": "file-uuid-123",
  "company_website": "https://acmeroofing.com",
  "tagline": "Quality roofing since 1995"
}
```

**Field Validations**:
- `primary_color`, `secondary_color`: Hex format (`#RRGGBB`)
- `company_website`: Valid URL
- `tagline`: Max 200 characters

**Response** (200 OK):
```json
{
  "id": "uuid",
  "primary_color": "#007BFF",
  ...
}
```

---

### Upload Tenant Logo

Upload a logo image for the tenant. Accepted formats: PNG, JPG, JPEG, SVG (max 5MB).

**Endpoint**: `POST /api/v1/tenants/current/logo`

**Authorization**: Required (Owner, Admin only)

**Content-Type**: `multipart/form-data`

**Request Body**:
- `file` (required): Logo image file

**File Validations**:
- **Formats**: PNG, JPG, JPEG, SVG
- **Max Size**: 5MB
- **Storage Location**: `./uploads/public/{tenant}/images/`

**Example using cURL**:
```bash
curl -X POST https://api.lead360.app/api/v1/tenants/current/logo \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/logo.png"
```

**Example using FormData (JavaScript)**:
```javascript
const formData = new FormData();
formData.append('file', logoFile);

fetch('https://api.lead360.app/api/v1/tenants/current/logo', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`
  },
  body: formData
});
```

**Response** (200 OK):
```json
{
  "url": "/public/acme-roofing/images/logo-uuid.png"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid file type or size exceeds 5MB
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions (requires Owner or Admin role)

**Notes**:
- The uploaded logo is automatically set as the tenant's `logo_file_id`
- Previous logo files are NOT automatically deleted
- The returned URL is relative to the uploads directory
- Files are stored with a UUID prefix to prevent naming conflicts

---

### Get Tenant Statistics

Get dashboard statistics for the tenant.

**Endpoint**: `GET /api/v1/tenants/current/statistics`

**Authorization**: Required (Owner, Admin only)

**Response** (200 OK):
```json
{
  "users": 5,
  "addresses": 3,
  "licenses": 2,
  "expiring_licenses": 1,
  "insurance_expiring_soon": {
    "gl": false,
    "wc": true
  }
}
```

---

### Check Subdomain Availability

Check if a subdomain is available for registration (public endpoint).

**Endpoint**: `GET /api/v1/tenants/check-subdomain`

**Authorization**: NOT required (public)

**Query Parameters**:
- `subdomain` (required): Subdomain to check (string, 3-63 chars)

**Example**: `GET /api/v1/tenants/check-subdomain?subdomain=acme-roofing`

**Response** (200 OK):
```json
{
  "available": false,
  "reason": "This subdomain is already taken"
}
```

OR

```json
{
  "available": true
}
```

**Reserved Subdomains** (always unavailable):
`www`, `app`, `api`, `admin`, `mail`, `ftp`, `smtp`, `pop`, `imap`, `webmail`, `email`, `portal`, `dashboard`, `billing`, `support`, `help`, `docs`, `blog`, `cdn`, `static`, `assets`, `files`, `upload`, `downloads`

---

## Addresses

### Get All Addresses

Retrieve all addresses for the tenant.

**Endpoint**: `GET /api/v1/tenants/current/addresses`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "address_type": "legal",
    "line1": "123 Main Street",
    "line2": "Suite 100",
    "city": "Los Angeles",
    "state": "CA",
    "zip_code": "90210",
    "country": "USA",
    "lat": 34.0522,
    "long": -118.2437,
    "is_po_box": false,
    "is_default": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### Create Address

Create a new address for the tenant.

**Endpoint**: `POST /api/v1/tenants/current/addresses`

**Authorization**: Required (Owner, Admin only)

**Request Body**:
```json
{
  "address_type": "legal",
  "line1": "123 Main Street",
  "line2": "Suite 100",
  "city": "Los Angeles",
  "state": "CA",
  "zip_code": "90210",
  "lat": 34.0522,
  "long": -118.2437,
  "is_po_box": false,
  "is_default": true
}
```

**Field Validations**:
- `address_type`: Enum (`legal`, `billing`, `service`, `mailing`, `office`)
- `state`: 2-letter uppercase code
- `zip_code`: 5 digits or ZIP+4 format
- `lat`: -90 to 90
- `long`: -180 to 180

**Business Rules**:
- Legal address **cannot** be a PO Box
- First address of a type is auto-set as default
- Setting `is_default: true` un-sets other defaults of same type

**Response** (201 Created):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "address_type": "legal",
  ...
}
```

**Error Responses**:
- `400 Bad Request` - Legal address cannot be PO Box
- `400 Bad Request` - Invalid ZIP code format

---

### Get Address by ID

Retrieve a specific address.

**Endpoint**: `GET /api/v1/tenants/current/addresses/:id`

**Authorization**: Required (All roles)

**Path Parameters**:
- `id`: Address UUID

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "address_type": "legal",
  ...
}
```

**Error Responses**:
- `404 Not Found` - Address not found or belongs to different tenant

---

### Update Address

Update an existing address.

**Endpoint**: `PATCH /api/v1/tenants/current/addresses/:id`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: Address UUID

**Request Body** (all fields optional):
```json
{
  "line1": "456 New Street",
  "city": "San Francisco",
  "is_default": true
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

---

### Delete Address

Delete an address.

**Endpoint**: `DELETE /api/v1/tenants/current/addresses/:id`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: Address UUID

**Response** (204 No Content)

**Business Rules**:
- Cannot delete last legal address
- If deleting default address, next address of same type becomes default

**Error Responses**:
- `403 Forbidden` - Cannot delete last legal address

---

### Set Address as Default

Set an address as the default for its type.

**Endpoint**: `PATCH /api/v1/tenants/current/addresses/:id/set-default`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: Address UUID

**Response** (200 OK):
```json
{
  "message": "Address set as default successfully"
}
```

---

## Licenses

### Get All Licenses

Retrieve all professional licenses for the tenant.

**Endpoint**: `GET /api/v1/tenants/current/licenses`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "license_type_id": "uuid",
    "custom_license_type": null,
    "license_number": "LIC-123456",
    "issuing_state": "CA",
    "issue_date": "2020-01-15",
    "expiry_date": "2025-01-15",
    "document_file_id": "file-uuid",
    "license_type": {
      "id": "uuid",
      "name": "General Contractor License",
      "description": "Required for general construction work"
    },
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### Create License

Create a new professional license.

**Endpoint**: `POST /api/v1/tenants/current/licenses`

**Authorization**: Required (Owner, Admin only)

**Request Body**:
```json
{
  "license_type_id": "uuid",
  "custom_license_type": null,
  "license_number": "LIC-123456",
  "issuing_state": "CA",
  "issue_date": "2020-01-15",
  "expiry_date": "2025-01-15",
  "document_file_id": "file-uuid"
}
```

**Field Validations**:
- `license_type_id` OR `custom_license_type` required (mutually exclusive)
- `issuing_state`: 2-letter uppercase code
- `issue_date`, `expiry_date`: ISO 8601 date strings

**Response** (201 Created):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

---

### Get License by ID

Retrieve a specific license.

**Endpoint**: `GET /api/v1/tenants/current/licenses/:id`

**Authorization**: Required (All roles)

**Path Parameters**:
- `id`: License UUID

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

---

### Update License

Update an existing license.

**Endpoint**: `PATCH /api/v1/tenants/current/licenses/:id`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: License UUID

**Request Body** (all fields optional):
```json
{
  "expiry_date": "2026-01-15",
  "document_file_id": "new-file-uuid"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

---

### Delete License

Delete a license.

**Endpoint**: `DELETE /api/v1/tenants/current/licenses/:id`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: License UUID

**Response** (204 No Content)

---

### Get License Status

Get expiry status of a license.

**Endpoint**: `GET /api/v1/tenants/current/licenses/:id/status`

**Authorization**: Required (All roles)

**Path Parameters**:
- `id`: License UUID

**Response** (200 OK):
```json
{
  "license": { ... },
  "status": "expiring_soon",
  "days_until_expiry": 15
}
```

**Status Values**:
- `expired`: Already expired
- `expiring_soon`: Expiring within 30 days
- `valid`: More than 30 days until expiry

---

## Insurance

### Get Insurance Information

Retrieve insurance information for the tenant (GL and WC).

**Endpoint**: `GET /api/v1/tenants/current/insurance`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",

  "gl_insurance_provider": "State Farm",
  "gl_policy_number": "GL-123456",
  "gl_coverage_amount": 1000000,
  "gl_effective_date": "2024-01-01",
  "gl_expiry_date": "2025-01-01",
  "gl_document_file_id": "file-uuid",

  "wc_insurance_provider": "Hartford",
  "wc_policy_number": "WC-789012",
  "wc_coverage_amount": 500000,
  "wc_effective_date": "2024-01-01",
  "wc_expiry_date": "2025-01-01",
  "wc_document_file_id": "file-uuid",

  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T00:00:00Z"
}
```

**Note**: If no insurance record exists, an empty record is auto-created.

---

### Update Insurance Information

Update General Liability and/or Workers Compensation insurance.

**Endpoint**: `PATCH /api/v1/tenants/current/insurance`

**Authorization**: Required (Owner, Admin only)

**Request Body** (all fields optional):
```json
{
  "gl_insurance_provider": "State Farm",
  "gl_policy_number": "GL-123456",
  "gl_coverage_amount": 1000000,
  "gl_effective_date": "2024-01-01",
  "gl_expiry_date": "2025-01-01",
  "gl_document_file_id": "file-uuid",

  "wc_insurance_provider": "Hartford",
  "wc_policy_number": "WC-789012",
  "wc_coverage_amount": 500000,
  "wc_effective_date": "2024-01-01",
  "wc_expiry_date": "2025-01-01",
  "wc_document_file_id": "file-uuid"
}
```

**Field Validations**:
- `*_coverage_amount`: Number >= 0
- `*_effective_date`, `*_expiry_date`: ISO 8601 date strings

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

---

### Get Insurance Status

Get expiry status for both GL and WC insurance.

**Endpoint**: `GET /api/v1/tenants/current/insurance/status`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
{
  "insurance": { ... },
  "gl_status": {
    "status": "valid",
    "days_until_expiry": 120
  },
  "wc_status": {
    "status": "expiring_soon",
    "days_until_expiry": 15
  }
}
```

**Status Values**: `expired`, `expiring_soon`, `valid`, or `null` (if not set)

---

### Check Insurance Coverage

Check if both GL and WC insurance are currently valid.

**Endpoint**: `GET /api/v1/tenants/current/insurance/coverage`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
{
  "gl_covered": true,
  "wc_covered": false,
  "all_covered": false
}
```

---

## Payment Terms

### Get Payment Terms

Retrieve payment milestone structure for the tenant.

**Endpoint**: `GET /api/v1/tenants/current/payment-terms`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "terms": [
    {
      "sequence": 1,
      "type": "percentage",
      "amount": 50,
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
  ],
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T00:00:00Z"
}
```

**Note**: If no payment terms exist, default (100% upfront) is auto-created.

---

### Update Payment Terms

Update payment milestone structure.

**Endpoint**: `PATCH /api/v1/tenants/current/payment-terms`

**Authorization**: Required (Owner, Admin only)

**Request Body**:
```json
{
  "terms": [
    {
      "sequence": 1,
      "type": "percentage",
      "amount": 50,
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
}
```

**Field Validations**:
- `sequence`: Sequential integers starting from 1 (1, 2, 3, ...)
- `type`: Enum (`percentage`, `fixed`)
- `amount`: Number 0-100 (for percentage) or >= 0 (for fixed)
- `description`: String, max 255 chars

**Validation Rules**:
- Sequence numbers must be sequential (1, 2, 3, ...) - enforced strictly
- Percentage terms summing to 100% is recommended (warning if not, but not error)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "terms": [...],
  "validation": {
    "percentage_sum": 100,
    "percentage_warning": null
  }
}
```

OR (with warning):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "terms": [...],
  "validation": {
    "percentage_sum": 95,
    "percentage_warning": "Warning: Percentage terms sum to 95%, not 100%. This may cause calculation issues."
  }
}
```

**Error Responses**:
- `400 Bad Request` - Sequence numbers not sequential

---

### Get Payment Term Templates

Get pre-defined payment term templates (for UI convenience).

**Endpoint**: `GET /api/v1/tenants/payment-terms/templates`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
{
  "50_25_25": [
    {
      "sequence": 1,
      "type": "percentage",
      "amount": 50,
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
  ],
  "33_33_34": [...],
  "100_upfront": [...]
}
```

---

## Business Hours

### Get Business Hours

Retrieve weekly business hours for the tenant.

**Endpoint**: `GET /api/v1/tenants/current/business-hours`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",

  "monday_closed": false,
  "monday_open1": "09:00",
  "monday_close1": "17:00",
  "monday_open2": null,
  "monday_close2": null,

  "tuesday_closed": false,
  "tuesday_open1": "09:00",
  "tuesday_close1": "17:00",
  "tuesday_open2": null,
  "tuesday_close2": null,

  "wednesday_closed": false,
  "wednesday_open1": "09:00",
  "wednesday_close1": "17:00",
  "wednesday_open2": null,
  "wednesday_close2": null,

  "thursday_closed": false,
  "thursday_open1": "09:00",
  "thursday_close1": "17:00",
  "thursday_open2": null,
  "thursday_close2": null,

  "friday_closed": false,
  "friday_open1": "09:00",
  "friday_close1": "17:00",
  "friday_open2": null,
  "friday_close2": null,

  "saturday_closed": true,
  "saturday_open1": null,
  "saturday_close1": null,
  "saturday_open2": null,
  "saturday_close2": null,

  "sunday_closed": true,
  "sunday_open1": null,
  "sunday_close1": null,
  "sunday_open2": null,
  "sunday_close2": null,

  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Note**: If no business hours exist, default (Mon-Fri 9-5) is auto-created.

**Time Format**: HH:MM (24-hour)

**Field Structure**:
- `{day}_closed`: Boolean (true = closed, false = open)
- `{day}_open1`: String (first opening time, HH:MM format)
- `{day}_close1`: String (first closing time, HH:MM format)
- `{day}_open2`: String (second shift opening - optional for lunch breaks)
- `{day}_close2`: String (second shift closing - optional for lunch breaks)
- Days: monday, tuesday, wednesday, thursday, friday, saturday, sunday

**Split Shift Support**:
- `open1`/`close1`: Morning shift
- `open2`/`close2`: Afternoon shift (optional, for lunch breaks)

---

### Update Business Hours

Update weekly business hours.

**Endpoint**: `PATCH /api/v1/tenants/current/business-hours`

**Authorization**: Required (Owner, Admin only)

**Request Body** (all fields optional):
```json
{
  "monday_closed": false,
  "monday_open1": "08:00",
  "monday_close1": "12:00",
  "monday_open2": "13:00",
  "monday_close2": "17:00",

  "saturday_closed": false,
  "saturday_open1": "09:00",
  "saturday_close1": "13:00"
}
```

**Field Validations**:
- Time format: `HH:MM` (24-hour)
- Time logic validation:
  - `open1 < close1`
  - `close1 < open2` (if open2 provided)
  - `open2 < close2` (if open2 provided)
- If day is `open: true`, `open1` and `close1` are required

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

**Error Responses**:
- `400 Bad Request` - Invalid time format
- `400 Bad Request` - Opening time must be before closing time
- `400 Bad Request` - Closing time 1 must be before opening time 2 (lunch break required)

---

## Custom Hours

### Get All Custom Hours

Retrieve all custom hours (holidays, special dates) for the tenant.

**Endpoint**: `GET /api/v1/tenants/current/custom-hours`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "date": "2024-12-25",
    "label": "Christmas Day",
    "is_closed": true,
    "open1": null,
    "close1": null,
    "open2": null,
    "close2": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "date": "2024-12-24",
    "label": "Christmas Eve",
    "is_closed": false,
    "open1": "09:00",
    "close1": "14:00",
    "open2": null,
    "close2": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### Create Custom Hours

Create custom hours for a special date (holiday, etc.).

**Endpoint**: `POST /api/v1/tenants/current/custom-hours`

**Authorization**: Required (Owner, Admin only)

**Request Body**:
```json
{
  "date": "2024-12-25",
  "label": "Christmas Day",
  "is_closed": true,
  "open1": null,
  "close1": null,
  "open2": null,
  "close2": null
}
```

OR (if not closed):
```json
{
  "date": "2024-12-24",
  "label": "Christmas Eve",
  "is_closed": false,
  "open1": "09:00",
  "close1": "14:00"
}
```

**Field Validations**:
- `date`: ISO 8601 date string
- `label`: String, max 100 chars
- If `is_closed: false`, `open1` and `close1` are required
- Same time logic validation as business hours

**Response** (201 Created):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

**Error Responses**:
- `400 Bad Request` - Custom hours already exist for this date (use update instead)

---

### Update Custom Hours

Update existing custom hours.

**Endpoint**: `PATCH /api/v1/tenants/current/custom-hours/:id`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: Custom hours UUID

**Request Body** (all fields optional):
```json
{
  "label": "Christmas Eve (Half Day)",
  "open1": "09:00",
  "close1": "12:00"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

---

### Delete Custom Hours

Delete custom hours.

**Endpoint**: `DELETE /api/v1/tenants/current/custom-hours/:id`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: Custom hours UUID

**Response** (204 No Content)

---

## Service Areas

### Get All Service Areas

Retrieve all service areas for the tenant.

**Endpoint**: `GET /api/v1/tenants/current/service-areas`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "area_type": "radius",
    "city": null,
    "state": null,
    "zipcode": null,
    "center_lat": 34.0522,
    "center_long": -118.2437,
    "radius_miles": 25,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "area_type": "city",
    "city": "Los Angeles",
    "state": "CA",
    "zipcode": null,
    "center_lat": null,
    "center_long": null,
    "radius_miles": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### Create Service Area

Create a new service area.

**Endpoint**: `POST /api/v1/tenants/current/service-areas`

**Authorization**: Required (Owner, Admin only)

**Request Body** (type: radius):
```json
{
  "area_type": "radius",
  "center_lat": 34.0522,
  "center_long": -118.2437,
  "radius_miles": 25
}
```

OR (type: city):
```json
{
  "area_type": "city",
  "city": "Los Angeles",
  "state": "CA"
}
```

OR (type: zipcode):
```json
{
  "area_type": "zipcode",
  "zipcode": "90210"
}
```

**Field Validations**:
- `area_type`: Enum (`city`, `zipcode`, `radius`)
- **If `radius`**: `center_lat`, `center_long`, `radius_miles` required
- **If `city`**: `city`, `state` required
- **If `zipcode`**: `zipcode` required
- `state`: 2-letter uppercase code
- `zipcode`: 5 digits or ZIP+4 format
- `center_lat`: -90 to 90
- `center_long`: -180 to 180
- `radius_miles`: 1 to 500

**Response** (201 Created):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

**Error Responses**:
- `400 Bad Request` - Missing required fields for area type

---

### Get Service Area by ID

Retrieve a specific service area.

**Endpoint**: `GET /api/v1/tenants/current/service-areas/:id`

**Authorization**: Required (All roles)

**Path Parameters**:
- `id`: Service area UUID

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

---

### Update Service Area

Update an existing service area.

**Endpoint**: `PATCH /api/v1/tenants/current/service-areas/:id`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: Service area UUID

**Request Body** (all fields optional):
```json
{
  "radius_miles": 30
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  ...
}
```

---

### Delete Service Area

Delete a service area.

**Endpoint**: `DELETE /api/v1/tenants/current/service-areas/:id`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: Service area UUID

**Response** (204 No Content)

---

### Check Service Coverage

Check if a location (lat, long) is covered by tenant's service areas.

**Endpoint**: `GET /api/v1/tenants/current/service-areas/check-coverage`

**Authorization**: Required (All roles)

**Query Parameters**:
- `lat` (required): Latitude (number, -90 to 90)
- `long` (required): Longitude (number, -180 to 180)

**Example**: `GET /api/v1/tenants/current/service-areas/check-coverage?lat=34.0522&long=-118.2437`

**Response** (200 OK):
```json
{
  "is_covered": true,
  "covering_areas": [
    {
      "id": "uuid",
      "area_type": "radius",
      "center_lat": 34.0522,
      "center_long": -118.2437,
      "radius_miles": 25,
      "distance_miles": 12.3
    }
  ]
}
```

**Note**: Distance calculation uses Haversine formula for radius-based areas.

---

## Admin Endpoints

**Base URL**: `https://api.lead360.app/api/v1/admin`

**CRITICAL SECURITY**: All admin endpoints require **Platform Admin** role. These endpoints bypass tenant resolution middleware and can access ALL tenant data across the platform.

**Use Cases**:
- Platform administrators managing all tenants
- System-level configuration (license types, subscription plans)
- Tenant lifecycle management (suspend, activate, change subscription)
- Platform analytics and reporting

---

### Tenant Management (Admin)

#### List All Tenants

Get paginated list of all tenants across the platform with search and filtering.

**Endpoint**: `GET /api/v1/admin/tenants`

**Authorization**: Platform Admin ONLY

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | integer | No | Page number (default: 1) |
| `limit` | integer | No | Items per page (default: 20) |
| `search` | string | No | Search by company name, subdomain, or legal name |
| `status` | string | No | Filter by subscription status (active, trial, suspended, etc.) |

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "subdomain": "acme-plumbing",
      "company_name": "ACME Plumbing",
      "legal_business_name": "ACME Plumbing LLC",
      "ein": "12-3456789",
      "is_active": true,
      "subscription_status": "active",
      "subscription_plan_id": "plan-uuid",
      "subscription_plan": {
        "id": "plan-uuid",
        "name": "Professional",
        "monthly_price": 99.99
      },
      "_count": {
        "users": 5,
        "addresses": 3,
        "licenses": 2
      },
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```

**Example Requests**:
```bash
# Get all tenants (page 1)
GET /api/v1/admin/tenants

# Search for tenants
GET /api/v1/admin/tenants?search=plumbing

# Filter by status
GET /api/v1/admin/tenants?status=active

# Paginate
GET /api/v1/admin/tenants?page=2&limit=50
```

---

#### Get Tenant Details (Admin)

Get detailed information about a specific tenant.

**Endpoint**: `GET /api/v1/admin/tenants/:id`

**Authorization**: Platform Admin ONLY

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Tenant ID |

**Response** (200 OK):
```json
{
  "id": "uuid",
  "subdomain": "acme-plumbing",
  "company_name": "ACME Plumbing",
  "legal_business_name": "ACME Plumbing LLC",
  "business_entity_type": "llc",
  "ein": "12-3456789",
  "state_of_registration": "CA",
  "subscription_status": "active",
  "subscription_plan": {
    "id": "plan-uuid",
    "name": "Professional"
  },
  "is_active": true,
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2025-01-20T14:22:00Z"
}
```

---

#### Create Tenant (Admin)

Create a new tenant (admin-only registration bypass).

**Endpoint**: `POST /api/v1/admin/tenants`

**Authorization**: Platform Admin ONLY

**Request Body**: Same as regular tenant creation (see Tenant Profile section)

**Response** (201 Created): Same as regular tenant creation

---

#### Update Tenant Subscription Plan

Change a tenant's subscription plan.

**Endpoint**: `PATCH /api/v1/admin/tenants/:id/subscription`

**Authorization**: Platform Admin ONLY

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Tenant ID |

**Request Body**:
```json
{
  "subscription_plan_id": "new-plan-uuid"
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "subdomain": "acme-plumbing",
  "subscription_plan_id": "new-plan-uuid",
  "subscription_status": "active",
  "updated_at": "2025-01-20T15:00:00Z"
}
```

**Audit Log**: Creates audit log entry for subscription change

---

#### Suspend or Activate Tenant

Suspend or reactivate a tenant account.

**Endpoint**: `PATCH /api/v1/admin/tenants/:id/status`

**Authorization**: Platform Admin ONLY

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Tenant ID |

**Request Body**:
```json
{
  "action": "suspend",  // or "activate"
  "reason": "Payment failure"  // Required for suspend, optional for activate
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "subdomain": "acme-plumbing",
  "is_active": false,
  "subscription_status": "suspended",
  "updated_at": "2025-01-20T15:10:00Z"
}
```

**Validation**:
- `action` must be either "suspend" or "activate"
- `reason` is required when suspending

**Audit Log**: Creates audit log entry with suspend/activate reason

---

### License Types Management (Admin)

#### List All License Types

Get all platform-wide license types.

**Endpoint**: `GET /api/v1/admin/license-types`

**Authorization**: Platform Admin ONLY

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `include_inactive` | boolean | No | Include inactive license types (default: false) |

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "name": "General Contractor",
    "description": "General Contractor License",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "name": "Electrical Contractor",
    "description": "Electrical Contractor License",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

#### Create License Type

Create a new platform-wide license type.

**Endpoint**: `POST /api/v1/admin/license-types`

**Authorization**: Platform Admin ONLY

**Request Body**:
```json
{
  "name": "Plumbing Contractor",
  "description": "Plumbing Contractor License"
}
```

**Validation**:
- `name`: Required, 1-100 characters, must be unique
- `description`: Optional, max 500 characters

**Response** (201 Created):
```json
{
  "id": "new-uuid",
  "name": "Plumbing Contractor",
  "description": "Plumbing Contractor License",
  "is_active": true,
  "created_at": "2025-01-20T16:00:00Z"
}
```

**Errors**:
- 409 Conflict if license type name already exists

**Audit Log**: Creates audit log entry with tenant_id = null (system-level)

---

#### Update License Type

Update an existing license type.

**Endpoint**: `PATCH /api/v1/admin/license-types/:id`

**Authorization**: Platform Admin ONLY

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | License type ID |

**Request Body**:
```json
{
  "name": "Updated Name",  // Optional
  "description": "Updated description"  // Optional
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "Updated Name",
  "description": "Updated description",
  "is_active": true,
  "updated_at": "2025-01-20T16:15:00Z"
}
```

**Errors**:
- 409 Conflict if new name already exists
- 404 Not Found if license type doesn't exist

---

#### Deactivate License Type

Deactivate a license type (soft delete - prevents new usage).

**Endpoint**: `PATCH /api/v1/admin/license-types/:id/deactivate`

**Authorization**: Platform Admin ONLY

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | License type ID |

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "General Contractor",
  "is_active": false,
  "updated_at": "2025-01-20T16:20:00Z"
}
```

**Note**: Existing tenant licenses using this type are NOT affected. New tenant licenses cannot use inactive types.

---

#### Reactivate License Type

Reactivate a previously deactivated license type.

**Endpoint**: `PATCH /api/v1/admin/license-types/:id/reactivate`

**Authorization**: Platform Admin ONLY

**Response** (200 OK): Same as deactivate, with `is_active: true`

---

#### Get License Type Usage Statistics

Get statistics on how many tenants are using a license type.

**Endpoint**: `GET /api/v1/admin/license-types/:id/usage`

**Authorization**: Platform Admin ONLY

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | License type ID |

**Response** (200 OK):
```json
{
  "license_type": {
    "id": "uuid",
    "name": "General Contractor",
    "is_active": true
  },
  "tenants_using": 45
}
```

**Use Case**: Check usage before deactivating a license type

---

### Subscription Plans Management (Admin)

#### List All Subscription Plans

Get all platform-wide subscription plans.

**Endpoint**: `GET /api/v1/admin/subscription-plans`

**Authorization**: Platform Admin ONLY

**Query Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `include_inactive` | boolean | No | Include inactive plans (default: false) |

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "name": "Professional",
    "monthly_price": 99.99,
    "annual_price": 999.99,
    "max_users": 10,
    "feature_flags": {
      "leads_module": true,
      "estimates_module": true,
      "invoices_module": true,
      "scheduling_module": false
    },
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

#### Create Subscription Plan

Create a new subscription plan.

**Endpoint**: `POST /api/v1/admin/subscription-plans`

**Authorization**: Platform Admin ONLY

**Request Body**:
```json
{
  "name": "Enterprise",
  "monthly_price": 199.99,
  "annual_price": 1999.99,
  "max_users": 50,
  "feature_flags": {
    "leads_module": true,
    "estimates_module": true,
    "invoices_module": true,
    "scheduling_module": true,
    "analytics_module": true
  }
}
```

**Validation**:
- `name`: Required, unique, 1-100 characters
- `monthly_price`: Required, decimal(10,2), >= 0
- `annual_price`: Required, decimal(10,2), >= 0
- `max_users`: Required, integer, > 0
- `feature_flags`: Required, JSON object with boolean values

**Response** (201 Created):
```json
{
  "id": "new-uuid",
  "name": "Enterprise",
  "monthly_price": 199.99,
  "annual_price": 1999.99,
  "max_users": 50,
  "feature_flags": { ... },
  "is_active": true,
  "created_at": "2025-01-20T17:00:00Z"
}
```

---

#### Update Subscription Plan

Update an existing subscription plan.

**Endpoint**: `PATCH /api/v1/admin/subscription-plans/:id`

**Authorization**: Platform Admin ONLY

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Subscription plan ID |

**Request Body**: Same as create, all fields optional

**Response** (200 OK): Updated subscription plan object

**Note**: Updating a plan affects all tenants currently using it

---

#### Get Tenants Using Plan

Get list of tenants subscribed to a specific plan.

**Endpoint**: `GET /api/v1/admin/subscription-plans/:id/tenants`

**Authorization**: Platform Admin ONLY

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Subscription plan ID |

**Response** (200 OK):
```json
[
  {
    "id": "tenant-uuid",
    "subdomain": "acme-plumbing",
    "company_name": "ACME Plumbing",
    "subscription_status": "active",
    "created_at": "2024-06-15T10:00:00Z"
  }
]
```

**Use Case**: Check tenants before modifying or deleting a plan

---

### Platform Dashboard & Analytics

#### Get Platform-Wide Statistics

Get high-level statistics for the entire platform.

**Endpoint**: `GET /api/v1/admin/dashboard/stats`

**Authorization**: Platform Admin ONLY

**Response** (200 OK):
```json
{
  "tenants": {
    "total": 150,
    "active": 120,
    "trial": 25,
    "suspended": 5
  },
  "users": {
    "total": 750
  }
}
```

**Use Case**: Platform health monitoring, executive dashboards

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request

Invalid input data or validation failure.

```json
{
  "statusCode": 400,
  "message": [
    "subdomain must match /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/ regular expression",
    "EIN must be in format XX-XXXXXXX (9 digits)"
  ],
  "error": "Bad Request"
}
```

### 401 Unauthorized

Missing or invalid authentication token.

```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}
```

### 403 Forbidden

Insufficient permissions or feature not included in subscription plan.

```json
{
  "statusCode": 403,
  "message": "Your subscription plan does not include access to the 'quotes_module' feature. Please upgrade your plan to access this functionality.",
  "error": "Forbidden"
}
```

OR

```json
{
  "statusCode": 403,
  "message": "Cannot delete the last legal address. Please add another legal address before deleting this one.",
  "error": "Forbidden"
}
```

### 404 Not Found

Resource not found or belongs to different tenant.

```json
{
  "statusCode": 404,
  "message": "Tenant not found. Please check your subdomain.",
  "error": "Not Found"
}
```

OR

```json
{
  "statusCode": 404,
  "message": "Address not found",
  "error": "Not Found"
}
```

### 409 Conflict

Unique constraint violation (e.g., subdomain/EIN already exists).

```json
{
  "statusCode": 409,
  "message": "Subdomain is already taken",
  "error": "Conflict"
}
```

OR

```json
{
  "statusCode": 409,
  "message": "EIN 12-3456789 is already registered to another tenant",
  "error": "Conflict"
}
```

### 500 Internal Server Error

Unexpected server error.

```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial API documentation - 100% endpoint coverage |

---

**End of Tenant Module API Documentation**

For questions or issues, contact the backend development team or open an issue in the project repository.
