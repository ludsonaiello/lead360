# Tenant Module REST API Documentation

**Version**: 1.0
**Last Updated**: January 2026
**Base URL**: `https://api.lead360.app/api/v1/tenants`

---

## Overview

The Tenant Module provides comprehensive multi-tenant management capabilities for the Lead360 platform. This API allows tenants to manage their business profile, addresses, licenses, insurance, payment terms, business hours, and service areas.

**Key Features**:
- Complete tenant profile management (~55 business fields)
- Multiple business addresses with type categorization
- Professional license tracking with expiry monitoring
- General Liability and Workers Compensation insurance management
- Customizable payment milestone structures
- Business hours with lunch break support
- Holiday/special date custom hours
- Service area coverage with radius calculations
- Service management with relational master list
- Business settings (sales tax, default quote percentages)
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

## File Metadata

**IMPORTANT**: All file-related fields (`logo_file_id`, `document_file_id`, `gl_document_file_id`, `wc_document_file_id`, `venmo_qr_code_file_id`) include full file metadata in API responses.

**File Metadata Object**:
```json
{
  "file_id": "uuid",
  "original_filename": "example.pdf",
  "mime_type": "application/pdf",
  "size_bytes": 2048576,
  "created_at": "2024-01-01T10:00:00Z"
}
```

**Benefits**:
- No extra API calls needed to get file information
- Display original filenames instead of UUIDs
- Show file type icons based on MIME type
- Format file sizes (e.g., "2.1 MB")
- Build download URLs immediately

**Null Values**: If no file is uploaded, the `*_file_id` will be `null` and the corresponding `*_file` object will also be `null`.

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
9. [Services](#services)
10. [Admin Endpoints (Platform Admin Only)](#admin-endpoints)
11. [Error Responses](#error-responses)

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
  "venmo_qr_code_file": {
    "file_id": "file-uuid-venmo",
    "original_filename": "venmo-qr.png",
    "mime_type": "image/png",
    "size_bytes": 12345,
    "created_at": "2024-01-15T10:35:00Z"
  },

  // BRANDING
  "logo_file_id": "file-uuid-logo",
  "logo_file": {
    "file_id": "file-uuid-logo",
    "original_filename": "acme-logo.png",
    "mime_type": "image/png",
    "size_bytes": 45678,
    "created_at": "2024-01-15T10:30:00Z"
  },
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

  // BUSINESS SETTINGS
  "sales_tax_rate": 6.25,
  "default_profit_margin": 15.0,
  "default_overhead_rate": 12.5,
  "default_contingency_rate": 5.0,

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

**Request Body** (all fields optional):
```json
{
  "company_name": "ACME Roofing Inc",
  "primary_contact_phone": "(555) 123-4567",
  "primary_contact_email": "info@acmeroofing.com",
  "sales_tax_rate": 6.25,
  "services_offered": ["Roofing", "Gutter", "Siding"],
  "default_profit_margin": 15.0,
  "default_overhead_rate": 12.5,
  "default_contingency_rate": 5.0
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
  "primary_brand_color": "#007BFF",
  "secondary_brand_color": "#6C757D",
  "accent_color": "#28A745",
  "logo_file_id": "file-uuid-123",
  "company_website": "https://acmeroofing.com",
  "tagline": "Quality roofing since 1995"
}
```

**Field Validations**:
- `primary_brand_color`, `secondary_brand_color`, `accent_color`: Hex format (`#RRGGBB`)
- `company_website`: Valid URL
- `tagline`: Max 200 characters
- All fields are optional

**Response** (200 OK):
```json
{
  "id": "uuid",
  "primary_brand_color": "#007BFF",
  "secondary_brand_color": "#6C757D",
  "accent_color": "#28A745",
  "logo_file_id": "file-uuid-123",
  "company_website": "https://acmeroofing.com",
  "tagline": "Quality roofing since 1995"
}
```

---

### Update Business Settings

Update business configuration settings including sales tax and default quote calculations.

**Endpoint**: `PATCH /api/v1/tenants/current`

**Authorization**: Required (Owner, Admin only)

**Request Body** (all fields optional):
```json
{
  "sales_tax_rate": 6.25,
  "default_profit_margin": 15.0,
  "default_overhead_rate": 12.5,
  "default_contingency_rate": 5.0
}
```

**Field Descriptions**:
- `sales_tax_rate`: Sales tax percentage (0-99.999%)
  - Applied to invoices and quotes
  - Example: 6.25 = 6.25% sales tax

- `default_profit_margin`: Default profit margin percentage for quotes (0-999.99%)
  - Applied as default when creating new quotes
  - Example: 15.0 = 15% profit margin

- `default_overhead_rate`: Default overhead rate percentage for quotes (0-999.99%)
  - Covers business operating costs
  - Example: 12.5 = 12.5% overhead

- `default_contingency_rate`: Default contingency rate percentage for quotes (0-999.99%)
  - Buffer for unexpected costs
  - Example: 5.0 = 5% contingency

**Validations**:
- `sales_tax_rate`: Must be between 0 and 99.999
- `default_profit_margin`: Must be between 0 and 999.99
- `default_overhead_rate`: Must be between 0 and 999.99
- `default_contingency_rate`: Must be between 0 and 999.99

**Response** (200 OK):
```json
{
  "id": "uuid",
  "sales_tax_rate": 6.25,
  "default_profit_margin": 15.0,
  "default_overhead_rate": 12.5,
  "default_contingency_rate": 5.0,
  ...
}
```

**Use Cases**:
- **Sales Tax**: Automatically calculate tax on invoices based on local regulations
- **Default Quote Percentages**: Streamline quote creation with pre-configured profit, overhead, and contingency rates

**Error Responses**:
- `400 Bad Request` - Invalid percentage values
  ```json
  {
    "statusCode": 400,
    "message": [
      "sales_tax_rate must not be greater than 99.999"
    ],
    "error": "Bad Request"
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
- **Storage Location**: `${UPLOADS_PATH}/{tenant}/images/` (configured via environment variable)

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
  "file_id": "550e8400-e29b-41d4-a716-446655440000",
  "url": "/public/acme-roofing/images/logo-550e8400-e29b-41d4-a716-446655440000.png",
  "metadata": {
    "original_filename": "company-logo.png",
    "mime_type": "image/png",
    "size_bytes": 45678,
    "storage_path": "/var/www/lead360.app/app/uploads/public/acme-roofing/images/logo-550e8400-e29b-41d4-a716-446655440000.png"
  }
}
```

**Response Fields**:
- `file_id`: Unique identifier for the file record
- `url`: Relative URL path to access the logo
- `metadata.original_filename`: Original name of the uploaded file
- `metadata.mime_type`: MIME type of the image (image/png, image/jpeg, image/svg+xml)
- `metadata.size_bytes`: File size in bytes
- `metadata.storage_path`: Absolute path where the file is stored on the server

**Error Responses**:
- `400 Bad Request` - Invalid file type or size exceeds 5MB
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions (requires Owner or Admin role)

**Notes**:
- The uploaded logo is automatically set as the tenant's `logo_file_id`
- Previous logo files are **automatically deleted** (hard delete from filesystem and database)
- The returned URL is relative to the uploads directory
- Files are stored with a UUID prefix to prevent naming conflicts
- File metadata is stored in the database for tracking purposes

---

### 6. Delete Tenant Logo

Delete the tenant's logo image (hard delete from filesystem and database).

**Endpoint**: `DELETE /api/v1/tenants/current/logo`

**Authorization**: Required (Owner, Admin only)

**Example using cURL**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/tenants/current/logo \
  -H "Authorization: Bearer <token>"
```

**Response** (200 OK):
```json
{
  "message": "Logo deleted successfully"
}
```

**Error Responses**:
- `400 Bad Request` - Tenant does not have a logo
- `401 Unauthorized` - Missing/invalid token
- `403 Forbidden` - Insufficient permissions (requires Owner or Admin role)

**Notes**:
- Permanently deletes the logo file from both filesystem and database
- Sets `logo_file_id` to null in the tenant record
- Creates an audit log entry for the deletion

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
    "document_file": {
      "file_id": "file-uuid",
      "original_filename": "contractor-license-ca.pdf",
      "mime_type": "application/pdf",
      "size_bytes": 2048576,
      "created_at": "2024-01-02T14:30:00Z"
    },
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

### Get All License Types

Retrieve all active license types available for selection (dropdown/autocomplete).

**Endpoint**: `GET /api/v1/tenants/license-types`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "name": "General Contractor License",
    "description": "Required for general construction work"
  },
  {
    "id": "uuid",
    "name": "Plumbing License",
    "description": "Required for plumbing work"
  },
  {
    "id": "uuid",
    "name": "Electrical License",
    "description": "Required for electrical work"
  }
]
```

**Notes**:
- Returns only active license types (`is_active = true`)
- Results are sorted alphabetically by name
- This is a **global reference table** (not tenant-specific)
- Used for dropdown/select options when creating licenses
- If the desired license type is not in the list, users can select "Other" and use `custom_license_type` field

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

Delete a license and all associated files (**cascading hard delete**).

**Endpoint**: `DELETE /api/v1/tenants/current/licenses/:id`

**Authorization**: Required (Owner, Admin only)

**Path Parameters**:
- `id`: License UUID

**Response** (200 OK):
```json
{
  "message": "License deleted successfully"
}
```

**Important Notes**:
- **Cascading Delete**: When a license is deleted, any associated document file is **permanently deleted** from both the filesystem and database
- This is a **hard delete** operation - the license and its files cannot be recovered
- An audit log entry is created tracking the deletion, including the deleted file ID if applicable

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

### Upload License Document

Upload a document (PDF, PNG, JPG) for a specific license.

**Endpoint**: `POST /api/v1/tenants/current/licenses/:id/document`

**Authorization**: Requires `Owner` or `Admin` role

**Content-Type**: `multipart/form-data`

**URL Parameters**:
- `id` (required) - License ID (UUID)

**Request Body**:
```
file: <binary> (required) - License document (PDF, PNG, JPG - max 10MB)
```

**Example Request** (cURL):
```bash
curl -X POST https://api.lead360.app/api/v1/tenants/current/licenses/{license-id}/document \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/license.pdf"
```

**Success Response** (200 OK):
```json
{
  "message": "Document uploaded successfully",
  "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "/public/tenant-uuid/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf"
}
```

**Notes**:
- If license already has a document, the old one is **permanently deleted** (hard delete)
- File is validated for type (PDF, PNG, JPG, JPEG only) and size (max 10MB)
- Creates audit log entry for document upload
- Updates `document_file_id` field on license record

**Error Responses**:
- `400 Bad Request` - Invalid file type or size
- `404 Not Found` - License not found or belongs to different tenant
- `403 Forbidden` - Insufficient permissions

---

### Delete License Document

Delete the document attached to a license (**permanent hard delete**).

**Endpoint**: `DELETE /api/v1/tenants/current/licenses/:id/document`

**Authorization**: Requires `Owner` or `Admin` role

**URL Parameters**:
- `id` (required) - License ID (UUID)

**Example Request**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/tenants/current/licenses/{license-id}/document \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Success Response** (204 No Content)

**Notes**:
- File is permanently deleted from filesystem immediately
- Database record is hard deleted
- Sets `document_file_id = null` on license record
- Creates audit log entry

**Error Responses**:
- `400 Bad Request` - License does not have a document
- `404 Not Found` - License not found
- `403 Forbidden` - Insufficient permissions

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
  "gl_document_file": {
    "file_id": "file-uuid",
    "original_filename": "general-liability-certificate.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 1536000,
    "created_at": "2024-01-01T09:15:00Z"
  },

  "wc_insurance_provider": "Hartford",
  "wc_policy_number": "WC-789012",
  "wc_coverage_amount": 500000,
  "wc_effective_date": "2024-01-01",
  "wc_expiry_date": "2025-01-01",
  "wc_document_file_id": "file-uuid",
  "wc_document_file": {
    "file_id": "file-uuid",
    "original_filename": "workers-comp-policy.pdf",
    "mime_type": "application/pdf",
    "size_bytes": 2097152,
    "created_at": "2024-01-01T09:20:00Z"
  },

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

### Upload General Liability (GL) Insurance Document

Upload a document for GL insurance.

**Endpoint**: `POST /api/v1/tenants/current/insurance/gl-document`

**Authorization**: Requires `Owner` or `Admin` role

**Content-Type**: `multipart/form-data`

**Request Body**:
```
file: <binary> (required) - GL insurance document (PDF, PNG, JPG - max 10MB)
```

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/tenants/current/insurance/gl-document \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/gl-insurance.pdf"
```

**Success Response** (200 OK):
```json
{
  "message": "GL document uploaded successfully",
  "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "/public/tenant-uuid/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf"
}
```

**Notes**:
- Replaces existing GL document if present (old file permanently deleted)
- Updates `gl_document_file_id` on insurance record
- Creates audit log entry

---

### Upload Workers Compensation (WC) Insurance Document

Upload a document for WC insurance.

**Endpoint**: `POST /api/v1/tenants/current/insurance/wc-document`

**Authorization**: Requires `Owner` or `Admin` role

**Content-Type**: `multipart/form-data`

**Request Body**:
```
file: <binary> (required) - WC insurance document (PDF, PNG, JPG - max 10MB)
```

**Example Request**:
```bash
curl -X POST https://api.lead360.app/api/v1/tenants/current/insurance/wc-document \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/wc-insurance.pdf"
```

**Success Response** (200 OK):
```json
{
  "message": "WC document uploaded successfully",
  "file_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "url": "/public/tenant-uuid/files/a1b2c3d4-e5f6-7890-abcd-ef1234567890.pdf"
}
```

**Notes**:
- Replaces existing WC document if present (old file permanently deleted)
- Updates `wc_document_file_id` on insurance record
- Creates audit log entry

---

### Delete GL Insurance Document

Delete the GL insurance document (**permanent hard delete**).

**Endpoint**: `DELETE /api/v1/tenants/current/insurance/gl-document`

**Authorization**: Requires `Owner` or `Admin` role

**Success Response** (204 No Content)

**Notes**:
- Permanently deletes file from filesystem and database
- Sets `gl_document_file_id = null`
- Creates audit log entry

---

### Delete WC Insurance Document

Delete the WC insurance document (**permanent hard delete**).

**Endpoint**: `DELETE /api/v1/tenants/current/insurance/wc-document`

**Authorization**: Requires `Owner` or `Admin` role

**Success Response** (204 No Content)

**Notes**:
- Permanently deletes file from filesystem and database
- Sets `wc_document_file_id = null`
- Creates audit log entry

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
    "reason": "Christmas Day",
    "closed": true,
    "open_time1": null,
    "close_time1": null,
    "open_time2": null,
    "close_time2": null,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "date": "2024-12-24",
    "reason": "Christmas Eve",
    "closed": false,
    "open_time1": "09:00",
    "close_time1": "14:00",
    "open_time2": null,
    "close_time2": null,
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

**Request Body** (Closed day):
```json
{
  "date": "2024-12-25",
  "reason": "Christmas Day",
  "closed": true,
  "open_time1": null,
  "close_time1": null,
  "open_time2": null,
  "close_time2": null
}
```

**Request Body** (Half day - single shift):
```json
{
  "date": "2024-12-24",
  "reason": "Christmas Eve - Half Day",
  "closed": false,
  "open_time1": "09:00",
  "close_time1": "14:00",
  "open_time2": null,
  "close_time2": null
}
```

**Request Body** (With lunch break - two shifts):
```json
{
  "date": "2024-07-04",
  "reason": "Independence Day - Modified Hours",
  "closed": false,
  "open_time1": "09:00",
  "close_time1": "12:00",
  "open_time2": "13:00",
  "close_time2": "17:00"
}
```

**Field Validations**:
- `date`: ISO 8601 date string (required) - Automatically sanitized to DateTime with 12:00 PM UTC
- `reason`: String, 1-255 chars (required) - NOT "label"
- `closed`: Boolean (required) - NOT "is_closed"
- `open_time1`: HH:MM format (optional) - First shift opening
- `close_time1`: HH:MM format (optional) - First shift closing
- `open_time2`: HH:MM format (optional) - Second shift opening (after lunch)
- `close_time2`: HH:MM format (optional) - Second shift closing
- Times use 24-hour format
- Supports lunch breaks just like regular business hours

**Important Notes**:
- Date strings are automatically sanitized using `@SanitizeDate()` decorator
- Input "2024-12-25" is converted to "2024-12-25T12:00:00.000Z" (noon UTC) for saving
- Database stores dates as DATE type (no time component)
- API responses return dates as `YYYY-MM-DD` format (e.g., "2024-12-25")
- Same sanitization pattern used in licenses and insurance dates

**Response** (201 Created):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "date": "2024-12-25",
  "reason": "Christmas Day",
  "closed": true,
  "open_time1": null,
  "close_time1": null,
  "open_time2": null,
  "close_time2": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request` - Invalid field values or validation errors
  - First shift opening and closing times are required when not closed
  - Opening time must be before closing time
  - First shift closing time must be before second shift opening time
- `409 Conflict` - Custom hours already exist for this date (use update instead)

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
  "date": "2024-12-24",
  "reason": "Christmas Eve (Half Day)",
  "closed": false,
  "open_time1": "09:00",
  "close_time1": "12:00",
  "open_time2": null,
  "close_time2": null
}
```

**Field Validations** (same as create):
- `date`: ISO 8601 date string - Automatically sanitized to DateTime with 12:00 PM UTC
- `reason`: String, 1-255 chars - NOT "label"
- `closed`: Boolean - NOT "is_closed"
- `open_time1`, `close_time1`, `open_time2`, `close_time2`: HH:MM format (24-hour)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "date": "2024-12-24",
  "reason": "Christmas Eve (Half Day)",
  "closed": false,
  "open_time1": "09:00",
  "close_time1": "12:00",
  "open_time2": null,
  "close_time2": null,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T10:30:00Z"
}
```

**Note**: The `date` field is returned as `YYYY-MM-DD` (date only, no time component).

**Error Responses**:
- `400 Bad Request` - Invalid field values or validation errors
  - First shift opening and closing times are required when not closed
  - Opening time must be before closing time
  - First shift closing time must be before second shift opening time
- `404 Not Found` - Custom hours not found
- `409 Conflict` - Custom hours already exist for the new date (if date was changed)

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

**Field Name Mapping**: The API uses different field names for requests vs responses:

| Request (DTO) | Response (Database) | Description |
|---------------|---------------------|-------------|
| `area_type` | `type` | Service area type (`city`, `zipcode`, `radius`, `state`) |
| `center_lat` | `latitude` | Geographic latitude |
| `center_long` | `longitude` | Geographic longitude |
| `city` | `city_name` | City name (optional) |
| `zipcode` | `zipcode` | ZIP code (optional) |
| N/A | `value` | Human-readable identifier (auto-generated) |
| N/A | `entire_state` | Boolean - true if covering entire state (default: false) |

**The `value` field** (auto-generated):
- **City type**: Stores city name (e.g., "Los Angeles")
- **Zipcode type**: Stores ZIP code (e.g., "90210")
- **Radius type**: Stores full description (e.g., "Los Angeles, CA (25 mile radius)")
- **State type**: Stores state code (e.g., "CA")

**The `entire_state` field**:
- Automatically set to `true` when `type = "state"`
- Set to `false` for all other types

---

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
    "type": "radius",
    "value": "Los Angeles, CA (25 mile radius)",
    "latitude": 34.0522,
    "longitude": -118.2437,
    "radius_miles": 25,
    "state": "CA",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "type": "city",
    "value": "Los Angeles",
    "latitude": 34.0522,
    "longitude": -118.2437,
    "radius_miles": null,
    "state": "CA",
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "type": "zipcode",
    "value": "90210",
    "latitude": 34.0901,
    "longitude": -118.4065,
    "radius_miles": null,
    "state": null,
    "city_name": null,
    "zipcode": "90210",
    "entire_state": false,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "tenant_id": "uuid",
    "type": "state",
    "value": "CA",
    "latitude": 36.7783,
    "longitude": -119.4179,
    "radius_miles": null,
    "state": "CA",
    "city_name": null,
    "zipcode": null,
    "entire_state": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

**Response Field Mapping** (database → API response):
- `type`: Service area type (`city`, `zipcode`, `radius`, `state`)
- `value`: Human-readable identifier (auto-generated)
  - For `city`: City name (e.g., "Los Angeles")
  - For `zipcode`: ZIP code (e.g., "90210")
  - For `radius`: Full description (e.g., "Los Angeles, CA (25 mile radius)")
  - For `state`: State code (e.g., "CA")
- `latitude`, `longitude`: Geographic coordinates (always populated)
- `radius_miles`: Radius in miles (only for `radius` type, null otherwise)
- `state`: State code (2 letters, optional)
- `city_name`: City name (optional, stored separately)
- `zipcode`: ZIP code (optional, stored separately)
- `entire_state`: Boolean - true for state-wide coverage

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

OR (type: state):
```json
{
  "area_type": "state",
  "state": "CA"
}
```

**Field Validations**:
- `area_type`: Enum (`city`, `zipcode`, `radius`, `state`)
- **If `radius`**: `center_lat`, `center_long`, `radius_miles` required
- **If `city`**: `city`, `state` required
- **If `zipcode`**: `zipcode` required
- **If `state`**: `state` required (entire state coverage)
- `state`: 2-letter uppercase code
- `zipcode`: 5 digits or ZIP+4 format
- `center_lat`: -90 to 90
- `center_long`: -180 to 180
- `radius_miles`: 1 to 500

**Duplicate Validation Rules**:

The API prevents duplicate service areas per tenant based on type-specific criteria:

1. **CITY type**: Cannot have duplicate city + state combination
   - ❌ Cannot create two "Los Angeles, CA" (type: city)
   - ✅ Can have "Los Angeles, CA" (type: city) AND "90210" (type: zipcode) with city "Los Angeles"

2. **ZIPCODE type**: Cannot have duplicate ZIP codes
   - ❌ Cannot create two "90210" (type: zipcode)
   - ✅ Can have "90210" (type: zipcode) AND "Los Angeles, CA" (type: city) with zipcode "90210"

3. **STATE type**: Cannot have duplicate entire state coverage
   - ❌ Cannot create two "CA" (type: state, entire_state: true)
   - ✅ Can have "CA" (type: state) AND "Los Angeles, CA" (type: city)

4. **RADIUS type**: Cannot have duplicate radius with same center and radius
   - ❌ Cannot create two radius areas with lat: 34.0522, long: -118.2437, radius: 25 miles
   - ✅ Can have same coordinates with different radius (25 miles vs 30 miles)

**Key Rule**: Different types with the same identifying values are allowed. Duplicates are only prevented within the same type for the same tenant.

**Response** (201 Created):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "type": "radius",
  "value": "Los Angeles, CA (25 mile radius)",
  "latitude": 34.0522,
  "longitude": -118.2437,
  "radius_miles": 25,
  "state": "CA",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Important**: Request uses DTO field names (`area_type`, `center_lat`, `center_long`, `city`, `zipcode`), but response uses database field names (`type`, `latitude`, `longitude`, `value`).

**Error Responses**:
- `400 Bad Request` - Missing required fields for area type
  ```json
  {
    "statusCode": 400,
    "message": "City and state are required for city-based service areas",
    "error": "Bad Request"
  }
  ```
- `409 Conflict` - Duplicate service area detected
  ```json
  {
    "statusCode": 409,
    "message": "Service area already exists for city \"Los Angeles, CA\"",
    "error": "Conflict"
  }
  ```

  Other duplicate error messages:
  - `"Service area already exists for ZIP code \"90210\""`
  - `"Service area already exists for entire state \"CA\""`
  - `"Service area already exists for this location and radius"`

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
  "type": "city",
  "value": "Los Angeles",
  "latitude": 34.0522,
  "longitude": -118.2437,
  "radius_miles": null,
  "state": "CA",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
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
  "area_type": "radius",
  "center_lat": 34.0522,
  "center_long": -118.2437,
  "radius_miles": 30,
  "city": "Los Angeles",
  "state": "CA",
  "zipcode": null
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "type": "radius",
  "value": "Los Angeles, CA (30 mile radius)",
  "latitude": 34.0522,
  "longitude": -118.2437,
  "radius_miles": 30,
  "state": "CA",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T10:30:00Z"
}
```

**Note**: The `value` field is automatically updated based on changes to `area_type`, `city`, `state`, `zipcode`, or `radius_miles`.

**Error Responses**:
- `400 Bad Request` - Missing required fields for area type
- `404 Not Found` - Service area not found
  ```json
  {
    "statusCode": 404,
    "message": "Service area not found",
    "error": "Not Found"
  }
  ```
- `409 Conflict` - Duplicate service area detected (same validation as create)
  ```json
  {
    "statusCode": 409,
    "message": "Service area already exists for city \"Los Angeles, CA\"",
    "error": "Conflict"
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
      "type": "radius",
      "value": "Los Angeles, CA (25 mile radius)",
      "latitude": 34.0522,
      "longitude": -118.2437,
      "radius_miles": 25,
      "distance_miles": 12.3
    }
  ]
}
```

**Note**: Distance calculation uses Haversine formula for radius-based areas.

---

## Services

Services represent the types of work a tenant business offers (e.g., "Roofing", "Gutter", "Plumbing"). Services are managed centrally by platform admins and assigned to tenants.

**Architecture**:
- **Service** table: Master list of available services (managed by platform admin)
- **TenantService** table: Junction table linking tenants to services
- Tenants can only assign services from the approved master list

---

### Get All Available Services

Get all active services that can be assigned to tenants.

**Endpoint**: `GET /api/v1/tenants/current/services`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "name": "Roofing",
    "slug": "roofing",
    "description": "Residential and commercial roofing services",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid",
    "name": "Gutter",
    "slug": "gutter",
    "description": "Gutter installation and repair",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### Get Tenant's Assigned Services

Get the services currently assigned to the tenant.

**Endpoint**: `GET /api/v1/tenants/current/assigned-services`

**Authorization**: Required (All roles)

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "name": "Roofing",
    "slug": "roofing",
    "description": "Residential and commercial roofing services",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### Assign Services to Tenant

Assign services to the tenant (replaces all existing assignments).

**Endpoint**: `POST /api/v1/tenants/current/assign-services`

**Authorization**: Required (Owner, Admin only)

**Request Body**:
```json
{
  "service_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

**Field Validations**:
- `service_ids`: Array of service UUIDs (0-50 items)
- All service IDs must exist and be active

**Response** (200 OK):
```json
[
  {
    "id": "uuid-1",
    "name": "Roofing",
    "slug": "roofing",
    "description": "Residential and commercial roofing services",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": "uuid-2",
    "name": "Gutter",
    "slug": "gutter",
    "description": "Gutter installation and repair",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

**Error Responses**:
- `400 Bad Request` - Invalid service IDs or inactive services
  ```json
  {
    "statusCode": 400,
    "message": "Some service IDs are invalid or inactive: uuid-999",
    "error": "Bad Request"
  }
  ```

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

### Service Management (Admin)

Manage the master list of services that can be assigned to tenants.

---

#### Get All Services (Admin)

List all services (including inactive).

**Endpoint**: `GET /api/v1/admin/services`

**Query Parameters**:
- `include_inactive` (optional): Include inactive services (default: false)

**Example**: `GET /api/v1/admin/services?include_inactive=true`

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "name": "Roofing",
    "slug": "roofing",
    "description": "Residential and commercial roofing services",
    "is_active": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

---

#### Create Service (Admin)

Create a new service in the master list.

**Endpoint**: `POST /api/v1/admin/services`

**Request Body**:
```json
{
  "name": "HVAC",
  "description": "Heating, ventilation, and air conditioning services",
  "slug": "hvac"
}
```

**Field Validations**:
- `name` (required): Service name (1-100 chars, must be unique)
- `description` (optional): Service description (1-500 chars)
- `slug` (optional): URL-friendly slug (auto-generated if not provided)

**Response** (201 Created):
```json
{
  "id": "uuid",
  "name": "HVAC",
  "slug": "hvac",
  "description": "Heating, ventilation, and air conditioning services",
  "is_active": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

**Error Responses**:
- `409 Conflict` - Service name or slug already exists

---

#### Update Service (Admin)

Update an existing service.

**Endpoint**: `PATCH /api/v1/admin/services/:id`

**Request Body** (all fields optional):
```json
{
  "name": "HVAC Systems",
  "description": "Complete HVAC installation and repair",
  "is_active": false
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "name": "HVAC Systems",
  "slug": "hvac-systems",
  "description": "Complete HVAC installation and repair",
  "is_active": false,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-02T10:00:00Z"
}
```

---

#### Delete Service (Admin)

Delete a service (only if not assigned to any tenants).

**Endpoint**: `POST /api/v1/admin/services/:id/delete`

**Response** (200 OK):
```json
{
  "message": "Service deleted successfully"
}
```

**Error Responses**:
- `400 Bad Request` - Service is assigned to tenants (deactivate instead)
  ```json
  {
    "statusCode": 400,
    "message": "Cannot delete service. It is currently assigned to 5 tenant(s). Please deactivate instead.",
    "error": "Bad Request"
  }
  ```
- `404 Not Found` - Service not found

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

Unique constraint violation or duplicate resource (e.g., subdomain/EIN already exists, duplicate service area, duplicate custom hours).

**Tenant Registration**:
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

**Service Areas**:
```json
{
  "statusCode": 409,
  "message": "Service area already exists for city \"Los Angeles, CA\"",
  "error": "Conflict"
}
```

Other service area duplicate messages:
- `"Service area already exists for ZIP code \"90210\""`
- `"Service area already exists for entire state \"CA\""`
- `"Service area already exists for this location and radius"`

**Custom Hours**:
```json
{
  "statusCode": 409,
  "message": "Custom hours already exist for this date. Please use update instead.",
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
