# Leads/Customer Module - Feature Contract

**Module**: Leads/Customer Management  
**Sprint**: 1  
**Priority**: High (Core CRM functionality)  
**Status**: Ready for Development  
**Version**: 1.0  
**Date**: January 2026

---

## Executive Summary

The Leads/Customer module is the core CRM functionality of Lead360. It manages the complete lifecycle of potential customers from initial contact (lead) through conversion to paying customer. The module supports multiple lead sources (manual entry, external webhooks, future AI integration), comprehensive contact management with multiple emails/phones/addresses, Google Maps address validation, service request tracking, and a complete activity history.

**Key Features:**
- Multi-source lead capture (manual, webhook, future AI)
- Multiple contacts per lead (emails, phones, addresses)
- Google Maps API address validation
- Status pipeline: Lead → Prospect → Customer/Lost
- Service request management
- Activity log and internal notes
- Fast actions: Call, SMS, Email
- Multi-tenant isolation with tenant-specific phone uniqueness

---

## Business Context

### Problem Statement

Service businesses need to efficiently capture, track, and convert leads from multiple sources while maintaining detailed contact information and service requirements. The system must support various lead entry methods, prevent duplicate leads within a tenant, track the customer journey, and maintain a complete history of interactions.

### Success Criteria

**For Tenant Users:**
- Capture leads in <30 seconds (manual entry)
- View complete lead history at a glance
- Quick actions (call, email, SMS) accessible
- No duplicate leads within tenant
- Clear status visibility (Lead/Prospect/Customer/Lost)

**For External Systems:**
- Webhook accepts leads with <2s response time
- API key authentication prevents unauthorized access
- Flexible extra fields for service-specific data

**For Platform:**
- Complete multi-tenant data isolation
- Phone uniqueness per tenant (not global)
- Same person can exist in multiple tenants as separate leads
- Google Maps API integration for address validation
- Audit trail for all lead changes

---

## Data Model

### Primary Entities

#### 1. Lead (Primary Entity)

**Table**: `lead`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | UUID | Yes | PK | Unique lead identifier |
| tenant_id | UUID | Yes | FK, Indexed | Tenant ownership |
| first_name | VARCHAR(100) | Yes | - | Lead's first name |
| last_name | VARCHAR(100) | Yes | - | Lead's last name |
| language_spoken | VARCHAR(10) | Yes | Default: 'EN' | Language preference (EN, ES, PT, etc.) |
| accept_sms | BOOLEAN | Yes | Default: false | SMS opt-in status |
| preferred_communication | ENUM | Yes | Default: 'email' | email, phone, sms |
| status | ENUM | Yes | Default: 'lead' | lead, prospect, customer, lost |
| source | ENUM | Yes | - | manual, webhook, ai_phone, ai_sms |
| external_source_id | VARCHAR(255) | No | Indexed | ID from external system (if webhook) |
| created_at | TIMESTAMP | Yes | - | When lead was created |
| updated_at | TIMESTAMP | Yes | - | Last update timestamp |
| created_by_user_id | UUID | No | FK | User who created (null for webhooks) |
| lost_reason | TEXT | No | - | Reason if status = 'lost' |
| lost_at | TIMESTAMP | No | - | When marked as lost |

**Indexes:**
- `(tenant_id, status)` - Fast status filtering
- `(tenant_id, created_at DESC)` - Recent leads
- `(tenant_id, external_source_id)` - Webhook deduplication
- `(tenant_id, updated_at DESC)` - Recently updated

---

#### 2. Lead Email (1:Many)

**Table**: `lead_email`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | UUID | Yes | PK | Unique email record |
| lead_id | UUID | Yes | FK (CASCADE) | Parent lead |
| email | VARCHAR(255) | Yes | Email format | Email address |
| is_primary | BOOLEAN | Yes | Default: false | Primary email flag |
| created_at | TIMESTAMP | Yes | - | When added |

**Indexes:**
- `(lead_id)` - Get all emails for lead
- `(lead_id, is_primary)` - Get primary email

**Constraints:**
- Only ONE email per lead can have `is_primary = true`
- Email format validation

---

#### 3. Lead Phone (1:Many)

**Table**: `lead_phone`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | UUID | Yes | PK | Unique phone record |
| lead_id | UUID | Yes | FK (CASCADE) | Parent lead |
| phone | VARCHAR(20) | Yes | Phone format | Phone number (digits only) |
| phone_type | ENUM | Yes | Default: 'mobile' | mobile, home, work |
| is_primary | BOOLEAN | Yes | Default: false | Primary phone flag |
| created_at | TIMESTAMP | Yes | - | When added |

**Indexes:**
- `(lead_id)` - Get all phones for lead
- `(lead_id, is_primary)` - Get primary phone
- **`UNIQUE (tenant_id_from_lead, phone)`** - Phone unique per tenant

**Constraints:**
- Only ONE phone per lead can have `is_primary = true`
- Phone must be digits only (no formatting characters)
- Phone unique per tenant (CRITICAL: not globally unique)

**Note**: This is a junction table but phone uniqueness is scoped to tenant. A query like:
```sql
SELECT lead_id FROM lead_phone lp 
JOIN lead l ON lp.lead_id = l.id 
WHERE l.tenant_id = ? AND lp.phone = ?
```
Should return at most 1 result per tenant.

---

#### 4. Lead Address (1:Many)

**Table**: `lead_address`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | UUID | Yes | PK | Unique address record |
| lead_id | UUID | Yes | FK (CASCADE) | Parent lead |
| address_line1 | VARCHAR(255) | Yes | - | Street address |
| address_line2 | VARCHAR(255) | No | - | Apt, suite, unit |
| city | VARCHAR(100) | Yes | - | City |
| state | VARCHAR(2) | Yes | - | State code (US) |
| zip_code | VARCHAR(10) | Yes | - | ZIP code |
| country | VARCHAR(2) | Yes | Default: 'US' | Country code |
| latitude | DECIMAL(10,8) | **Yes** | **REQUIRED** | **Google Maps lat (MANDATORY for routing/service areas)** |
| longitude | DECIMAL(11,8) | **Yes** | **REQUIRED** | **Google Maps lng (MANDATORY for routing/service areas)** |
| google_place_id | VARCHAR(255) | No | - | Google Place ID |
| is_primary | BOOLEAN | Yes | Default: false | Primary address flag |
| address_type | ENUM | Yes | Default: 'service' | service, billing, mailing |
| created_at | TIMESTAMP | Yes | - | When added |

**Indexes:**
- `(lead_id)` - Get all addresses for lead
- `(lead_id, is_primary)` - Get primary address
- `(lead_id, address_type)` - Get service addresses

**Constraints:**
- Only ONE address per lead can have `is_primary = true` per address_type
- **Google Maps API validation MANDATORY before saving**
- **Lat/lng are REQUIRED** - addresses cannot be saved without coordinates
- **Backend behavior:**
  - If lat/lng provided (frontend): Validates components, uses provided coordinates
  - If lat/lng missing (webhook/AI): Auto-geocodes address to fetch coordinates
  - If city/state missing: Auto-fetches from Google Maps API
  - If address invalid: Returns 422 error (no silent failures)

---

#### 5. Service Request (1:Many)

**Table**: `service_request`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | UUID | Yes | PK | Unique request ID |
| tenant_id | UUID | Yes | FK, Indexed | Tenant ownership |
| lead_id | UUID | Yes | FK (CASCADE) | Parent lead |
| lead_address_id | UUID | No | FK (SET NULL) | Service address |
| service_name | VARCHAR(100) | Yes | - | Service requested |
| service_type | VARCHAR(100) | No | - | Service category |
| time_demand | ENUM | Yes | Default: 'flexible' | now, week, month, flexible |
| description | TEXT | No | - | Customer notes/description |
| extra_data | JSON | No | - | Flexible extra fields |
| status | ENUM | Yes | Default: 'new' | new, quoted, approved, declined, completed |
| created_at | TIMESTAMP | Yes | - | When requested |
| updated_at | TIMESTAMP | Yes | - | Last update |

**Indexes:**
- `(tenant_id, lead_id)` - Get all requests for lead
- `(tenant_id, status)` - Filter by status
- `(tenant_id, created_at DESC)` - Recent requests

---

#### 6. Lead Note (Internal Comments)

**Table**: `lead_note`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | UUID | Yes | PK | Unique note ID |
| lead_id | UUID | Yes | FK (CASCADE) | Parent lead |
| user_id | UUID | Yes | FK (SET NULL) | User who created |
| note_text | TEXT | Yes | - | Note content |
| is_pinned | BOOLEAN | Yes | Default: false | Pin to top |
| created_at | TIMESTAMP | Yes | - | When created |
| updated_at | TIMESTAMP | Yes | - | Last edit |

**Indexes:**
- `(lead_id, created_at DESC)` - Get notes chronologically
- `(lead_id, is_pinned DESC, created_at DESC)` - Pinned first

---

#### 7. Lead Activity Log

**Table**: `lead_activity`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | UUID | Yes | PK | Unique activity ID |
| lead_id | UUID | Yes | FK (CASCADE) | Parent lead |
| user_id | UUID | No | FK (SET NULL) | User who performed action |
| activity_type | ENUM | Yes | - | status_change, email_sent, call_made, sms_sent, note_added, created, updated |
| description | VARCHAR(500) | Yes | - | Human-readable description |
| metadata | JSON | No | - | Additional data |
| created_at | TIMESTAMP | Yes | - | When activity occurred |

**Indexes:**
- `(lead_id, created_at DESC)` - Activity timeline

**Example Metadata:**
```json
{
  "old_status": "lead",
  "new_status": "prospect",
  "reason": "Qualified via phone call"
}
```

---

#### 8. Webhook API Key (Authentication)

**Table**: `webhook_api_key`

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| id | UUID | Yes | PK | Unique key ID |
| tenant_id | UUID | Yes | FK, Indexed | Tenant ownership |
| key_name | VARCHAR(100) | Yes | - | Friendly name |
| api_key | VARCHAR(64) | Yes | Unique, Indexed | Hashed API key |
| api_secret | VARCHAR(128) | Yes | - | Hashed secret |
| is_active | BOOLEAN | Yes | Default: true | Key enabled/disabled |
| allowed_sources | JSON | No | - | Source whitelist (optional) |
| rate_limit | INT | Yes | Default: 100 | Requests per hour |
| last_used_at | TIMESTAMP | No | - | Last successful request |
| created_at | TIMESTAMP | Yes | - | When created |
| created_by_user_id | UUID | Yes | FK | User who created |

**Indexes:**
- `(api_key)` - Fast key lookup
- `(tenant_id, is_active)` - Active keys for tenant

**Security:**
- API key and secret stored as bcrypt hashes
- Keys rotatable
- Rate limiting per key

---

## API Specifications

### Authentication

**All tenant-facing endpoints:**
- Require JWT authentication
- Tenant context derived from JWT (no `tenant_id` in request body)

**Webhook endpoint:**
- Public endpoint (no JWT)
- Authentication via `X-API-Key` and `X-API-Secret` headers
- Tenant derived from subdomain or key mapping

---

### REST Endpoints

#### 1. Create Lead (Manual Entry)

**Endpoint**: `POST /api/v1/leads`  
**Auth**: JWT Required  
**Permission**: `leads:create`

**Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Smith",
  "language_spoken": "EN",
  "accept_sms": true,
  "preferred_communication": "email",
  "emails": [
    { "email": "john@example.com", "is_primary": true }
  ],
  "phones": [
    { "phone": "9788968047", "phone_type": "mobile", "is_primary": true }
  ],
  "addresses": [
    {
      "address_line1": "123 Main St",
      "address_line2": "Apt 4",
      "city": "Boston",
      "state": "MA",
      "zip_code": "02101",
      "address_type": "service",
      "is_primary": true
    }
  ],
  "service_request": {
    "service_name": "Bathroom Remodeling",
    "service_type": "Remodeling",
    "time_demand": "month",
    "description": "Need full bathroom renovation",
    "extra_data": {
      "square_footage": 80,
      "budget_range": "10000-15000"
    }
  },
  "initial_note": "Lead from website contact form"
}
```

**Response**: `201 Created`
```json
{
  "id": "lead-uuid",
  "tenant_id": "tenant-uuid",
  "first_name": "John",
  "last_name": "Smith",
  "language_spoken": "EN",
  "accept_sms": true,
  "preferred_communication": "email",
  "status": "lead",
  "source": "manual",
  "emails": [
    {
      "id": "email-uuid",
      "email": "john@example.com",
      "is_primary": true,
      "created_at": "2026-01-16T12:00:00Z"
    }
  ],
  "phones": [
    {
      "id": "phone-uuid",
      "phone": "9788968047",
      "phone_type": "mobile",
      "is_primary": true,
      "created_at": "2026-01-16T12:00:00Z"
    }
  ],
  "addresses": [
    {
      "id": "address-uuid",
      "address_line1": "123 Main St",
      "address_line2": "Apt 4",
      "city": "Boston",
      "state": "MA",
      "zip_code": "02101",
      "country": "US",
      "latitude": 42.360081,
      "longitude": -71.058884,
      "google_place_id": "ChIJ...",
      "is_primary": true,
      "address_type": "service",
      "created_at": "2026-01-16T12:00:00Z"
    }
  ],
  "service_requests": [
    {
      "id": "request-uuid",
      "service_name": "Bathroom Remodeling",
      "service_type": "Remodeling",
      "time_demand": "month",
      "description": "Need full bathroom renovation",
      "extra_data": { "square_footage": 80, "budget_range": "10000-15000" },
      "status": "new",
      "created_at": "2026-01-16T12:00:00Z"
    }
  ],
  "created_at": "2026-01-16T12:00:00Z",
  "updated_at": "2026-01-16T12:00:00Z",
  "created_by_user_id": "user-uuid"
}
```

**Validation Rules:**
- `first_name` and `last_name` required
- At least ONE email OR phone required
- If address provided, must validate with Google Maps API
- Phone must be digits only, 10 digits (US format)
- Phone must be unique within tenant (return 409 if duplicate)
- Email must be valid format

**Error Responses:**
- `400`: Validation failed (missing required fields, invalid format)
- `409`: Phone number already exists for another lead in this tenant
- `422`: Google Maps API validation failed for address

---

#### 2. Create Lead via Webhook (External Form)

**Endpoint**: `POST /api/v1/public/leads/webhook`  
**Auth**: API Key + Secret (Headers)  
**Rate Limit**: 100 requests/hour per key  
**Public**: Yes (no JWT, subdomain-based tenant resolution)

**Headers**:
```
X-API-Key: abc123...
X-API-Secret: secret456...
```

**Request Body**:
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "5551234567",
  "language_spoken": "EN",
  "accept_sms": false,
  "address": {
    "address_line1": "456 Oak Ave",
    "zip_code": "02139"
    // Optional: city, state, latitude, longitude
    // Backend auto-fetches missing data from Google Maps
  },
  "service_request": {
    "service_name": "Gutter Cleaning",
    "time_demand": "week",
    "description": "Gutters are clogged, need cleaning ASAP",
    "extra_data": {
      "house_stories": 2,
      "gutter_length_feet": 120
    }
  },
  "external_source_id": "form_submission_12345",
  "extra_data": {
    "form_name": "Contact Us",
    "referral_source": "Google Ads"
  }
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "lead_id": "lead-uuid",
  "message": "Lead created successfully"
}
```

**Behavior:**
- Tenant resolved from subdomain (e.g., `acmeplumbing.lead360.app`)
- If `external_source_id` provided, check for duplicate (return existing lead if found)
- Phone uniqueness checked within tenant
- Email becomes primary if single email provided
- Phone becomes primary if single phone provided
- **Address validation (MANDATORY):**
  - Webhook can send partial address (just address_line1 + zip_code)
  - Backend auto-fetches city, state, lat, lng from Google Maps API
  - Lat/lng are REQUIRED - returns 422 if address validation fails
  - No silent failures - coordinates are mandatory for routing/service areas
- Service request auto-created if provided
- Source set to `webhook`
- Activity log created: "Lead created via webhook"

**Error Responses:**
- `401`: Invalid or missing API key/secret
- `403`: API key disabled or rate limit exceeded
- `409`: Phone already exists for tenant (returns existing lead_id)
- `422`: Invalid phone format, missing required fields, or address validation failed

---

#### 3. List Leads (Paginated)

**Endpoint**: `GET /api/v1/leads`  
**Auth**: JWT Required  
**Permission**: `leads:view`

**Query Parameters**:
```
?page=1
&limit=20
&status=lead,prospect
&search=John
&source=manual,webhook
&created_after=2026-01-01
&created_before=2026-01-31
&sort_by=created_at
&sort_order=desc
```

**Response**: `200 OK`
```json
{
  "data": [
    {
      "id": "lead-uuid",
      "first_name": "John",
      "last_name": "Smith",
      "status": "lead",
      "source": "manual",
      "primary_email": "john@example.com",
      "primary_phone": "9788968047",
      "primary_address": "123 Main St, Boston, MA 02101",
      "service_requests_count": 1,
      "quotes_count": 0,
      "created_at": "2026-01-16T12:00:00Z",
      "updated_at": "2026-01-16T12:00:00Z"
    }
  ],
  "meta": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "pages": 8
  }
}
```

**Filters:**
- `status`: Comma-separated status values
- `source`: Comma-separated source values
- `search`: Searches first_name, last_name, emails, phones
- Date range filters for created_at

---

#### 4. Get Single Lead (Full Details)

**Endpoint**: `GET /api/v1/leads/:id`  
**Auth**: JWT Required  
**Permission**: `leads:view`

**Response**: `200 OK`
```json
{
  "id": "lead-uuid",
  "tenant_id": "tenant-uuid",
  "first_name": "John",
  "last_name": "Smith",
  "language_spoken": "EN",
  "accept_sms": true,
  "preferred_communication": "email",
  "status": "prospect",
  "source": "manual",
  "external_source_id": null,
  "created_at": "2026-01-16T12:00:00Z",
  "updated_at": "2026-01-16T15:30:00Z",
  "created_by_user_id": "user-uuid",
  "lost_reason": null,
  "lost_at": null,
  "emails": [
    {
      "id": "email-uuid",
      "email": "john@example.com",
      "is_primary": true,
      "created_at": "2026-01-16T12:00:00Z"
    }
  ],
  "phones": [
    {
      "id": "phone-uuid",
      "phone": "9788968047",
      "phone_type": "mobile",
      "is_primary": true,
      "created_at": "2026-01-16T12:00:00Z"
    }
  ],
  "addresses": [
    {
      "id": "address-uuid",
      "address_line1": "123 Main St",
      "address_line2": "Apt 4",
      "city": "Boston",
      "state": "MA",
      "zip_code": "02101",
      "country": "US",
      "latitude": 42.360081,
      "longitude": -71.058884,
      "google_place_id": "ChIJ...",
      "is_primary": true,
      "address_type": "service",
      "created_at": "2026-01-16T12:00:00Z"
    }
  ],
  "service_requests": [
    {
      "id": "request-uuid",
      "service_name": "Bathroom Remodeling",
      "service_type": "Remodeling",
      "time_demand": "month",
      "description": "Need full bathroom renovation",
      "extra_data": { "square_footage": 80 },
      "status": "quoted",
      "created_at": "2026-01-16T12:00:00Z",
      "updated_at": "2026-01-16T14:00:00Z"
    }
  ],
  "notes": [
    {
      "id": "note-uuid",
      "user_id": "user-uuid",
      "user_name": "Alice Johnson",
      "note_text": "Called lead, very interested. Scheduled site visit.",
      "is_pinned": true,
      "created_at": "2026-01-16T13:00:00Z",
      "updated_at": "2026-01-16T13:00:00Z"
    }
  ],
  "activities": [
    {
      "id": "activity-uuid",
      "activity_type": "status_change",
      "description": "Status changed from 'lead' to 'prospect'",
      "user_name": "Alice Johnson",
      "metadata": { "old_status": "lead", "new_status": "prospect" },
      "created_at": "2026-01-16T15:30:00Z"
    },
    {
      "id": "activity-uuid-2",
      "activity_type": "created",
      "description": "Lead created",
      "user_name": "Bob Smith",
      "metadata": { "source": "manual" },
      "created_at": "2026-01-16T12:00:00Z"
    }
  ]
}
```

---

#### 5. Update Lead

**Endpoint**: `PATCH /api/v1/leads/:id`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Request Body** (all fields optional):
```json
{
  "first_name": "Jonathan",
  "last_name": "Smith",
  "language_spoken": "ES",
  "accept_sms": false,
  "preferred_communication": "phone",
  "lost_reason": "Not interested anymore"
}
```

**Response**: `200 OK` (returns full lead object)

**Validation:**
- Cannot update `status` via this endpoint (use status endpoint)
- Cannot update `tenant_id`, `source`, `created_at`, `created_by_user_id`
- Activity log created for update

---

#### 6. Update Lead Status

**Endpoint**: `PATCH /api/v1/leads/:id/status`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Request Body**:
```json
{
  "status": "prospect",
  "reason": "Qualified via phone call, ready for quote"
}
```

**Valid Status Transitions**:
- `lead` → `prospect`, `lost`
- `prospect` → `customer`, `lost`
- `customer` → N/A (cannot change from customer)
- `lost` → `lead` (re-activation allowed)

**Response**: `200 OK`
```json
{
  "id": "lead-uuid",
  "status": "prospect",
  "updated_at": "2026-01-16T15:30:00Z"
}
```

**Behavior:**
- If status = `lost`, `lost_reason` and `lost_at` are set
- Activity log created: "Status changed from X to Y"
- If transitioning to `customer`, future features may trigger (project creation, etc.)

**Error Responses:**
- `400`: Invalid status transition
- `422`: Missing `reason` when marking as `lost`

---

#### 7. Delete Lead

**Endpoint**: `DELETE /api/v1/leads/:id`  
**Auth**: JWT Required  
**Permission**: `leads:delete`

**Response**: `204 No Content`

**Behavior:**
- Soft delete: Sets `deleted_at` timestamp (future enhancement)
- Or hard delete with CASCADE on related entities
- Activity log created before deletion

---

#### 8. Add Email to Lead

**Endpoint**: `POST /api/v1/leads/:id/emails`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Request Body**:
```json
{
  "email": "john.work@company.com",
  "is_primary": false
}
```

**Response**: `201 Created`
```json
{
  "id": "email-uuid",
  "email": "john.work@company.com",
  "is_primary": false,
  "created_at": "2026-01-16T16:00:00Z"
}
```

**Validation:**
- Email format validation
- If `is_primary = true`, unset other primary emails for this lead

---

#### 9. Update Email

**Endpoint**: `PATCH /api/v1/leads/:lead_id/emails/:email_id`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Request Body**:
```json
{
  "email": "john.updated@example.com",
  "is_primary": true
}
```

**Response**: `200 OK` (returns updated email object)

---

#### 10. Delete Email

**Endpoint**: `DELETE /api/v1/leads/:lead_id/emails/:email_id`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Response**: `204 No Content`

**Validation:**
- Cannot delete last email if no phone exists (must have at least one contact method)

---

#### 11. Add Phone to Lead

**Endpoint**: `POST /api/v1/leads/:id/phones`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Request Body**:
```json
{
  "phone": "6175551234",
  "phone_type": "work",
  "is_primary": false
}
```

**Response**: `201 Created`

**Validation:**
- Phone must be 10 digits (US format)
- Phone unique within tenant (409 if duplicate)

---

#### 12. Update Phone

**Endpoint**: `PATCH /api/v1/leads/:lead_id/phones/:phone_id`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

---

#### 13. Delete Phone

**Endpoint**: `DELETE /api/v1/leads/:lead_id/phones/:phone_id`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Validation:**
- Cannot delete last phone if no email exists

---

#### 14. Add Address to Lead

**Endpoint**: `POST /api/v1/leads/:id/addresses`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Request Body**:
```json
{
  "address_line1": "789 Pine St",
  "city": "Boston",
  "state": "MA",
  "zip_code": "02115",
  "address_type": "billing",
  "is_primary": false
}
```

**Response**: `201 Created`

**Behavior:**
- Validate address with Google Maps API
- Return lat/lng and google_place_id
- If validation fails, return 422 with error details

---

#### 15-16. Update/Delete Address

Similar patterns to email/phone

---

#### 17. Add Note to Lead

**Endpoint**: `POST /api/v1/leads/:id/notes`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Request Body**:
```json
{
  "note_text": "Follow up next Tuesday at 2pm",
  "is_pinned": false
}
```

**Response**: `201 Created`

---

#### 18-19. Update/Delete Note

Similar patterns

---

#### 20. Get Lead Activities

**Endpoint**: `GET /api/v1/leads/:id/activities`  
**Auth**: JWT Required  
**Permission**: `leads:view`

**Query Parameters**:
```
?page=1
&limit=50
&activity_type=status_change,note_added
```

**Response**: `200 OK` with paginated activities

---

#### 21. Create Service Request for Lead

**Endpoint**: `POST /api/v1/leads/:id/service-requests`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Request Body**:
```json
{
  "lead_address_id": "address-uuid",
  "service_name": "Kitchen Remodeling",
  "service_type": "Remodeling",
  "time_demand": "month",
  "description": "Full kitchen renovation",
  "extra_data": {
    "square_footage": 200,
    "budget_range": "30000-50000"
  }
}
```

**Response**: `201 Created`

---

#### 22. Update Service Request Status

**Endpoint**: `PATCH /api/v1/service-requests/:id/status`  
**Auth**: JWT Required  
**Permission**: `leads:edit`

**Request Body**:
```json
{
  "status": "quoted"
}
```

**Response**: `200 OK`

---

#### 23. Get Lead Statistics (Dashboard Widget)

**Endpoint**: `GET /api/v1/leads/stats`  
**Auth**: JWT Required  
**Permission**: `leads:view`

**Response**: `200 OK`
```json
{
  "total_leads": 523,
  "by_status": {
    "lead": 234,
    "prospect": 156,
    "customer": 98,
    "lost": 35
  },
  "by_source": {
    "manual": 312,
    "webhook": 187,
    "ai_phone": 24
  },
  "conversion_rate": 18.7,
  "this_month": {
    "new_leads": 47,
    "conversions": 12
  }
}
```

---

## Business Rules

### Lead Creation

1. **Required Fields**: At least first_name, last_name, and ONE contact method (email or phone)
2. **Phone Uniqueness**: Phone must be unique per tenant (not globally)
3. **Address Validation**: All addresses MUST be validated with Google Maps API. Lat/lng are REQUIRED (see rules 28-33 for details)
4. **Primary Flags**: Only ONE email, phone, and address per type can be primary
5. **Automatic Activity**: Every lead creation logs an activity

### Status Management

6. **Status Pipeline**: lead → prospect → customer/lost
7. **Lost Reason Required**: When marking as lost, reason must be provided
8. **Customer Immutable**: Cannot change status from customer
9. **Re-activation Allowed**: Lost leads can be moved back to lead status

### Contact Information

10. **Contact Methods**: Lead must always have at least ONE email OR phone
11. **Phone Format**: Digits only, 10 digits (US format)
12. **Email Format**: Standard email validation
13. **Primary Selection**: If only one contact exists, auto-set as primary

### Service Requests

14. **Auto-Creation**: If lead created with service_request data, auto-create service request
15. **Address Association**: Service requests can be associated with specific lead address
16. **Quote Association**: Service requests linked to quotes (future feature)

### Webhook Integration

17. **Deduplication**: Use external_source_id to prevent duplicate webhook leads
18. **Rate Limiting**: 100 requests/hour per API key
19. **Tenant Resolution**: Subdomain determines tenant for webhook
20. **Phone Conflict**: If phone exists, return existing lead_id with 409 status

### Multi-Tenant Isolation

21. **Tenant Scoping**: All queries MUST filter by tenant_id
22. **Phone Uniqueness Scope**: Phone unique per tenant, not globally
23. **Cross-Tenant Isolation**: Same person can exist as separate leads in different tenants
24. **Data Access**: Users can only access leads within their tenant

### Activity Logging

25. **Automatic Logging**: All changes to lead logged in activity table
26. **User Attribution**: Activities linked to user who performed action
27. **Webhook Activities**: Webhook-created leads have system attribution

### Google Maps Integration

28. **Address Validation - MANDATORY**: All addresses MUST be validated with Google Maps API before saving. Lat/lng are REQUIRED.
29. **Smart Validation Modes**: 
    - **Frontend Mode**: If lat/lng provided → validates components, uses coordinates (no API call)
    - **Geocoding Mode**: If lat/lng missing → calls Google Maps to fetch city, state, coordinates
    - **Auto-fill Mode**: If city/state missing → fetches from Google Maps API
30. **Coordinates REQUIRED**: Lat/lng are MANDATORY for routing optimization, service area validation, and distance calculations
31. **Validation Failure Handling**: If address validation fails, return 422 error. NO graceful degradation - coordinates are required for core business functions.
32. **Place ID Storage**: Google place_id stored for future reference and enhanced address matching
33. **Webhook Address Handling**: Backend auto-geocodes partial addresses from webhooks (e.g., just address + zipcode → fetches city/state/lat/lng)

---

## Non-Functional Requirements

### Performance

- Lead list page loads in <500ms with 20 items
- Lead details page loads in <300ms
- Webhook endpoint responds in <2s
- Google Maps validation <1s per address

### Security

- All endpoints protected by JWT (except webhook)
- Webhook API keys hashed (bcrypt)
- Rate limiting on webhook endpoint
- Tenant isolation enforced at database level
- RBAC permissions checked on all operations

### Data Integrity

- Phone uniqueness per tenant enforced at DB level
- Cascade deletes for related entities
- Activity log never deleted (audit trail)
- Primary flag constraints enforced

### Scalability

- Supports 100,000+ leads per tenant
- Webhook handles 100+ requests/minute
- Database indexes on all filter fields
- Pagination on all list endpoints

---

## Frontend Requirements

### Pages

1. **Lead List Page** (`/leads`)
   - Table view with pagination
   - Filters: status, source, date range
   - Search: name, email, phone
   - Fast actions: Call, Email, SMS buttons
   - Click row to view details
   - Create lead button

2. **Lead Details Page** (`/leads/:id`)
   - Full lead information display
   - Contact methods section (emails, phones, addresses)
   - Service requests section
   - Notes section (add/edit/delete)
   - Activity timeline
   - Fast action buttons: Call, Email, SMS
   - Edit lead button
   - Status change dropdown

3. **Create Lead Page** (`/leads/new`)
   - Multi-section form (NOT multi-step)
   - Basic info section
   - Contact methods section (add multiple emails/phones)
   - Addresses section with Google Maps autocomplete
   - Service request section (optional)
   - Initial note field
   - Submit button

4. **Edit Lead Page** (`/leads/:id/edit`)
   - Same as create, pre-populated

### UI Components

- **NO MODALS** except: alerts, confirms, tiny forms (2-3 fields)
- Use existing components from component library
- Masked inputs for phone: `(978) 896-8047`
- Google Maps autocomplete for addresses
- Status badge with color coding
- Fast action button group (Call, Email, SMS)
- Activity timeline component
- Notes list with add/edit inline

### Mobile Responsiveness

- All pages mobile-optimized
- Fast action buttons easily tappable
- Forms single-column on mobile
- List view optimized for mobile

---

## Testing Requirements

### Backend Tests

**Unit Tests:**
- Phone uniqueness validation per tenant
- Email format validation
- Status transition validation
- Google Maps API integration (mocked)
- Activity log creation on all changes

**Integration Tests:**
- Create lead via manual entry
- Create lead via webhook
- Update lead status with validation
- Add/remove contact methods
- Multi-tenant isolation (same phone in different tenants)

### Frontend Tests

**Component Tests:**
- Lead list renders correctly
- Lead details displays all data
- Create form validates correctly
- Fast action buttons trigger correct actions

**E2E Tests:**
- Complete lead creation flow
- Status change flow
- Add service request flow
- Activity timeline displays correctly

---

## Dependencies

### External Services

1. **Google Maps API**
   - Geocoding API for address validation
   - Places API for autocomplete
   - Maps JavaScript API for frontend
   - Cost: ~$7 per 1000 requests

### Internal Modules

1. **Auth Module**: User authentication and JWT
2. **RBAC Module**: Permission checks
3. **Audit Module**: Activity logging
4. **File Storage**: Future feature for lead attachments

---

## Migration Path

### Phase 1: Core Lead Management (Sprint 1)
- Lead CRUD operations
- Contact methods (email, phone, address)
- Manual entry only
- Google Maps integration
- Status management

### Phase 2: Webhook Integration (Sprint 1)
- Public webhook endpoint
- API key authentication
- External source tracking

### Phase 3: Service Requests (Sprint 1)
- Service request CRUD
- Association with leads

### Phase 4: Activity & Notes (Sprint 1)
- Activity logging
- Internal notes

### Phase 5: Communication Features (Future)
- Click-to-call integration
- SMS sending
- Email sending
- Communication logging

---

## Acceptance Criteria

**Feature is complete when:**

✅ Users can manually create leads with multiple contact methods  
✅ Phone uniqueness enforced per tenant (not globally)  
✅ **Google Maps validates and geocodes ALL addresses**  
✅ **Lat/lng are REQUIRED - addresses fail without coordinates**  
✅ **Webhook handles partial address data (auto-fetches city/state/lat/lng)**  
✅ **Frontend provides lat/lng - backend skips API call (performance)**  
✅ **Invalid addresses return 422 error (no silent failures)**  
✅ Leads can have multiple emails, phones, addresses  
✅ Status pipeline works: lead → prospect → customer/lost  
✅ Service requests auto-created with lead  
✅ Webhook endpoint accepts external leads  
✅ API key authentication works for webhooks  
✅ Activity log tracks all lead changes  
✅ Internal notes can be added/edited  
✅ Frontend displays all lead information clearly  
✅ Fast action buttons present (even if not yet functional)  
✅ Multi-tenant isolation verified with tests  
✅ Same phone number can exist in different tenants  
✅ All API endpoints documented 100%  
✅ Frontend follows no-modal rule (except alerts/confirms)  

---

## Open Questions

None - all requirements clarified.

---

## Approval

**Product Owner**: Ludson Aielli  
**Date**: January 16, 2026  
**Status**: ✅ Approved for Development

---

**End of Feature Contract**