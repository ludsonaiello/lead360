# Leads Module - REST API Documentation

**Version**: 1.0
**Last Updated**: January 2026
**Base URL**: `https://api.lead360.app/api/v1`

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Leads Management](#leads-management)
4. [Contact Management](#contact-management)
5. [Service Requests](#service-requests)
6. [Webhook Integration](#webhook-integration)
7. [Error Responses](#error-responses)
8. [Business Rules](#business-rules)

---

## Overview

The Leads Module provides comprehensive CRM functionality for managing leads/customers with:
- Full contact information (emails, phones, addresses)
- Google Maps address validation (MANDATORY - all addresses require lat/lng)
- Multi-tenant phone uniqueness enforcement
- Service request tracking
- Activity timeline
- Internal notes
- Public webhook endpoint for external lead capture
- Subdomain-based tenant isolation

**Total Endpoints**: 29
- Leads: 8 endpoints
- Emails: 3 endpoints
- Phones: 3 endpoints
- Addresses: 3 endpoints
- Notes: 4 endpoints
- Activities: 1 endpoint
- Service Requests: 4 endpoints
- Webhook (Public): 1 endpoint
- Webhook Keys: 3 endpoints

---

## Authentication

### JWT Authentication (Protected Endpoints)

**Header**: `Authorization: Bearer {jwt_token}`

All endpoints except `/public/leads/webhook` require JWT authentication.

### Webhook API Key Authentication (Public Webhook)

**Header**: `X-API-Key: {webhook_api_key}` OR `Authorization: Bearer {webhook_api_key}`

Only for `/public/leads/webhook` endpoint.

---

## Leads Management

### 1. Create Lead

Create a new lead with nested contacts and service request.

**Endpoint**: `POST /leads`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body**:
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "language_spoken": "EN",
  "accept_sms": false,
  "preferred_communication": "email",
  "source": "website",
  "external_source_id": "form_12345",
  "emails": [
    {
      "email": "john.doe@example.com",
      "is_primary": true
    }
  ],
  "phones": [
    {
      "phone": "(555) 123-4567",
      "phone_type": "mobile",
      "is_primary": true
    }
  ],
  "addresses": [
    {
      "address_line1": "123 Main St",
      "address_line2": "Suite 100",
      "city": "Boston",
      "state": "MA",
      "zip_code": "02101",
      "latitude": 42.3601,
      "longitude": -71.0589,
      "address_type": "service",
      "is_primary": true
    }
  ],
  "service_request": {
    "service_type": "Roof Repair",
    "service_description": "Leak in roof, water damage visible",
    "urgency": "high",
    "estimated_value": 1500.00
  }
}
```

**Field Details**:
- `first_name` (string, required): 1-100 characters
- `last_name` (string, required): 1-100 characters
- `language_spoken` (string, optional): Default "EN", 2-10 characters
- `accept_sms` (boolean, optional): Default false
- `preferred_communication` (enum, optional): "email" | "phone" | "sms", default "email"
- `source` (enum, required): "website" | "referral" | "phone_call" | "walk_in" | "social_media" | "email" | "webhook" | "other"
- `external_source_id` (string, optional): For deduplication, 1-255 characters
- `emails` (array, required if no phones): At least 1 email OR 1 phone required. Each email has `email` (string) and `is_primary` (boolean) fields only. **NO email_type field**.
- `phones` (array, required if no emails): At least 1 email OR 1 phone required. Phone numbers are sanitized to 10 digits (all non-digits removed). Must be exactly 10 digits after sanitization.
- `addresses` (array, required): At least 1 address required, Google Maps validated. Coordinates returned as Decimal strings for precision.
- `service_request` (object, optional): Service request details

**Address Validation**:
- If `latitude` and `longitude` provided → Uses coordinates, validates city/state if missing via reverse geocoding
- If `latitude` and `longitude` missing → Forward geocodes address using Google Maps API
- If `city` or `state` missing → Auto-fills from Google Maps
- **MANDATORY**: All addresses must have valid lat/lng after validation

**Response** (201 Created):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "language_spoken": "EN",
  "accept_sms": false,
  "preferred_communication": "email",
  "status": "lead",
  "source": "website",
  "external_source_id": "form_12345",
  "created_at": "2026-01-17T12:00:00Z",
  "updated_at": "2026-01-17T12:00:00Z",
  "created_by_user_id": "uuid",
  "lost_reason": null,
  "lost_at": null,
  "emails": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "email": "john.doe@example.com",
      "is_primary": true,
      "created_at": "2026-01-17T12:00:00Z"
    }
  ],
  "phones": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "phone": "5551234567",
      "phone_type": "mobile",
      "is_primary": true,
      "created_at": "2026-01-17T12:00:00Z"
    }
  ],
  "addresses": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "address_line1": "123 Main St",
      "address_line2": "Suite 100",
      "city": "Boston",
      "state": "MA",
      "zip_code": "02101",
      "latitude": "42.36010000",
      "longitude": "-71.05890000",
      "google_place_id": "ChIJGzE9DS1l44kRoOhiASS_fHg",
      "address_type": "service",
      "is_primary": true,
      "created_at": "2026-01-17T12:00:00Z"
    }
  ],
  "service_requests": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "lead_address_id": "uuid",
      "service_name": "Roof Repair",
      "service_type": "Roof Repair",
      "service_description": "Leak in roof, water damage visible",
      "time_demand": "high",
      "status": "new",
      "extra_data": {
        "estimated_value": 1500.00
      },
      "created_at": "2026-01-17T12:00:00Z"
    }
  ]
}
```

**Error Responses**:
- `400 Bad Request`: Invalid data, missing required fields, or validation errors
- `409 Conflict`: Phone number already exists for this tenant
- `422 Unprocessable Entity`: Address validation failed (Google Maps)

---

### 2. List Leads

Get all leads with filters and pagination.

**Endpoint**: `GET /leads`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales, Employee)

**Query Parameters**:
- `page` (number, optional): Page number (1-indexed), default 1
- `limit` (number, optional): Items per page (1-100), default 50
- `status` (string, optional): Filter by status ("lead" | "prospect" | "customer" | "lost")
- `source` (string, optional): Filter by source
- `search` (string, optional): Search by name, email, or phone

**Example Request**:
```
GET /leads?page=1&limit=50&status=lead&search=john
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "status": "lead",
      "source": "website",
      "created_at": "2026-01-17T12:00:00Z",
      "emails": [
        {
          "id": "uuid",
          "email": "john.doe@example.com",
          "is_primary": true
        }
      ],
      "phones": [
        {
          "id": "uuid",
          "phone": "5551234567",
          "phone_type": "mobile",
          "is_primary": true
        }
      ],
      "addresses": [
        {
          "id": "uuid",
          "address_line1": "123 Main St",
          "city": "Boston",
          "state": "MA",
          "latitude": "42.36010000",
          "longitude": "-71.05890000",
          "is_primary": true
        }
      ],
      "service_requests": []
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 150,
    "totalPages": 3
  }
}
```

---

### 3. Get Lead by ID

Get a single lead with all relations.

**Endpoint**: `GET /leads/:id`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales, Employee)

**Path Parameters**:
- `id` (UUID, required): Lead UUID

**Response** (200 OK):
```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "first_name": "John",
  "last_name": "Doe",
  "language_spoken": "EN",
  "accept_sms": false,
  "preferred_communication": "email",
  "status": "lead",
  "source": "website",
  "external_source_id": "form_12345",
  "created_by_user_id": "uuid",
  "lost_reason": null,
  "lost_at": null,
  "created_at": "2026-01-17T12:00:00Z",
  "updated_at": "2026-01-17T12:00:00Z",
  "deleted_at": null,
  "emails": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "email": "john.doe@example.com",
      "is_primary": true,
      "created_at": "2026-01-17T12:00:00Z"
    },
    {
      "id": "uuid",
      "lead_id": "uuid",
      "email": "john.doe@work.com",
      "is_primary": false,
      "created_at": "2026-01-17T12:30:00Z"
    }
  ],
  "phones": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "phone": "5551234567",
      "phone_type": "mobile",
      "is_primary": true,
      "created_at": "2026-01-17T12:00:00Z"
    },
    {
      "id": "uuid",
      "lead_id": "uuid",
      "phone": "5559876543",
      "phone_type": "work",
      "is_primary": false,
      "created_at": "2026-01-17T12:30:00Z"
    }
  ],
  "addresses": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "address_line1": "123 Main St",
      "address_line2": "Suite 100",
      "city": "Boston",
      "state": "MA",
      "zip_code": "02101",
      "latitude": "42.36010000",
      "longitude": "-71.05890000",
      "google_place_id": "ChIJGzE9DS1l44kRoOhiASS_fHg",
      "address_type": "service",
      "is_primary": true,
      "created_at": "2026-01-17T12:00:00Z"
    }
  ],
  "service_requests": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "lead_address_id": "uuid",
      "service_name": "Roof Repair",
      "service_type": "Roof Repair",
      "service_description": "Leak in roof, water damage visible",
      "time_demand": "high",
      "status": "new",
      "extra_data": {
        "estimated_value": 1500.00
      },
      "created_at": "2026-01-17T12:00:00Z"
    }
  ],
  "created_by_user": {
    "id": "uuid",
    "first_name": "Admin",
    "last_name": "User",
    "email": "admin@example.com"
  }
}
```

**Error Responses**:
- `404 Not Found`: Lead not found or access denied

---

### 4. Update Lead

Update lead basic information.

**Endpoint**: `PATCH /leads/:id`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body** (all fields optional):
```json
{
  "first_name": "John",
  "last_name": "Doe",
  "language_spoken": "ES",
  "accept_sms": true,
  "preferred_communication": "sms"
}
```

**Response** (200 OK): Updated lead object

---

### 5. Update Lead Status

Update lead status with validation.

**Endpoint**: `PATCH /leads/:id/status`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body**:
```json
{
  "status": "prospect",
  "lost_reason": "Went with competitor"
}
```

**Field Details**:
- `status` (enum, required): "lead" | "prospect" | "customer" | "lost"
- `lost_reason` (string, required if status="lost"): 1-500 characters

**Status Transition Rules**:
- lead → prospect → customer (normal progression)
- lead → lost (mark as lost)
- prospect → lost (mark as lost)
- lost → lead (reactivation)
- customer status is **immutable** (cannot change once set)

**Response** (200 OK): Updated lead with status change
```json
{
  "id": "uuid",
  "status": "lost",
  "lost_reason": "Went with competitor",
  "lost_at": "2026-01-17T12:00:00Z",
  "updated_at": "2026-01-17T12:00:00Z"
}
```

**Note**: When status is set to "lost", the `lost_at` timestamp is automatically set to the current date/time.

**Error Responses**:
- `400 Bad Request`: Invalid status transition or missing `lost_reason` when status="lost"

---

### 6. Delete Lead

Hard delete a lead (cascades to all related entities).

**Endpoint**: `DELETE /leads/:id`
**Authentication**: JWT (Roles: Owner, Admin)

**Response**: `204 No Content`

**Error Responses**:
- `404 Not Found`: Lead not found

---

### 7. Get Lead Statistics

Get dashboard statistics for leads.

**Endpoint**: `GET /leads/stats`
**Authentication**: JWT (Roles: Owner, Admin, Manager)

**Response** (200 OK):
```json
{
  "total": 150,
  "by_status": {
    "lead": 80,
    "prospect": 40,
    "customer": 25,
    "lost": 5
  },
  "by_source": {
    "website": 60,
    "referral": 30,
    "webhook": 40,
    "phone_call": 20
  },
  "recent": [
    {
      "id": "uuid",
      "first_name": "John",
      "last_name": "Doe",
      "status": "lead",
      "source": "website",
      "created_at": "2026-01-17T12:00:00Z"
    }
  ]
}
```

---

## Contact Management

### Email Management

#### 8. Add Email

**Endpoint**: `POST /leads/:id/emails`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body**:
```json
{
  "email": "john.doe@work.com",
  "is_primary": false
}
```

**Field Details**:
- `email` (string, required): Valid email format, 1-255 characters
- `is_primary` (boolean, optional): Default false. **NO email_type field exists**.

**Response** (201 Created):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "email": "john.doe@work.com",
  "is_primary": false,
  "created_at": "2026-01-17T12:00:00Z"
}
```

**Business Rules**:
- If `is_primary=true`, unsets other primary emails
- If this is the first email, auto-sets `is_primary=true`
- Email format validation

---

#### 9. Update Email

**Endpoint**: `PATCH /leads/:id/emails/:emailId`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body** (all fields optional):
```json
{
  "email": "john.updated@example.com",
  "is_primary": true
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "email": "john.updated@example.com",
  "is_primary": true,
  "created_at": "2026-01-17T12:00:00Z"
}
```

---

#### 10. Delete Email

**Endpoint**: `DELETE /leads/:id/emails/:emailId`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Response**: `204 No Content`

**Business Rules**:
- Cannot delete if this is the last contact method (must have at least 1 email OR 1 phone)
- If deleted email was primary, auto-sets another email as primary

---

### Phone Management

#### 11. Add Phone

**Endpoint**: `POST /leads/:id/phones`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body**:
```json
{
  "phone": "(555) 987-6543",
  "phone_type": "work",
  "is_primary": false
}
```

**Field Details**:
- `phone` (string, required): 10 digits (any format accepted, sanitized to digits only). Examples: "(555) 987-6543" or "555-987-6543" or "5559876543" all become "5559876543"
- `phone_type` (enum, optional): "mobile" | "home" | "work" | "other", default "mobile"
- `is_primary` (boolean, optional): Default false

**Response** (201 Created):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "phone": "5559876543",
  "phone_type": "work",
  "is_primary": false,
  "created_at": "2026-01-17T12:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid phone format (must be exactly 10 digits after sanitization)
- `409 Conflict`: Phone number already exists for this tenant (**tenant-scoped uniqueness**)

**Business Rules**:
- Phone numbers are unique **per tenant** (not globally)
- Uniqueness check: Joins `lead_phone → lead → filter by tenant_id`
- Phone is automatically sanitized to 10 digits (all non-digits removed)
- Must be exactly 10 digits after sanitization
- If `is_primary=true`, unsets other primary phones
- If this is the first phone, auto-sets `is_primary=true`

---

#### 12. Update Phone

**Endpoint**: `PATCH /leads/:id/phones/:phoneId`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body** (all fields optional):
```json
{
  "phone": "5551112222",
  "phone_type": "home",
  "is_primary": true
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "phone": "5551112222",
  "phone_type": "home",
  "is_primary": true,
  "created_at": "2026-01-17T12:00:00Z"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid phone format (must be exactly 10 digits after sanitization)
- `409 Conflict`: New phone number already exists for this tenant

---

#### 13. Delete Phone

**Endpoint**: `DELETE /leads/:id/phones/:phoneId`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Response**: `204 No Content`

**Business Rules**:
- Cannot delete if this is the last contact method (must have at least 1 email OR 1 phone)
- If deleted phone was primary, auto-sets another phone as primary

---

### Address Management

#### 14. Add Address

**Endpoint**: `POST /leads/:id/addresses`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body**:
```json
{
  "address_line1": "456 Oak Ave",
  "address_line2": "Apt 2B",
  "city": "Cambridge",
  "state": "MA",
  "zip_code": "02139",
  "latitude": 42.3736,
  "longitude": -71.1097,
  "address_type": "billing",
  "is_primary": false
}
```

**Field Details**:
- `address_line1` (string, required): 1-255 characters
- `address_line2` (string, optional): 1-255 characters
- `city` (string, optional): Auto-filled by Google Maps if not provided
- `state` (string, optional): 2-letter code, auto-filled if not provided
- `zip_code` (string, required): 5 or 9 digits
- `latitude` (number, optional in request): If provided, saves Google Maps API call. **REQUIRED in response** - returned as Decimal string for precision.
- `longitude` (number, optional in request): If provided, saves Google Maps API call. **REQUIRED in response** - returned as Decimal string for precision.
- `address_type` (enum, optional): "service" | "billing" | "mailing" | "other", default "service"
- `is_primary` (boolean, optional): Primary for this address type

**Google Maps Validation** (MANDATORY):
- All addresses MUST have lat/lng coordinates
- 3 validation modes:
  1. Frontend provides lat/lng → Skips Google API call (performance optimization)
  2. Lat/lng missing → Geocodes address to get coordinates
  3. City/state missing → Reverse geocodes or auto-fills

**Response** (201 Created):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "address_line1": "456 Oak Ave",
  "address_line2": "Apt 2B",
  "city": "Cambridge",
  "state": "MA",
  "zip_code": "02139",
  "latitude": "42.37360000",
  "longitude": "-71.10970000",
  "google_place_id": "ChIJAbCdEfGh44kRxYz_1A2B3cD",
  "address_type": "billing",
  "is_primary": false,
  "created_at": "2026-01-17T12:00:00Z"
}
```

**Note**: Coordinates are stored as Decimal(10,8) and Decimal(11,8) and returned as strings for precision.

**Error Responses**:
- `422 Unprocessable Entity`: Address validation failed (Google Maps error)

---

#### 15. Update Address

**Endpoint**: `PATCH /leads/:id/addresses/:addressId`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body** (all fields optional):
```json
{
  "address_line1": "789 Pine Rd",
  "address_line2": "Unit 5C",
  "city": "Somerville",
  "state": "MA",
  "zip_code": "02143",
  "address_type": "mailing",
  "is_primary": true
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "address_line1": "789 Pine Rd",
  "address_line2": "Unit 5C",
  "city": "Somerville",
  "state": "MA",
  "zip_code": "02143",
  "latitude": "42.38760000",
  "longitude": "-71.09920000",
  "google_place_id": "ChIJXyZ9EfGh44kRxYz_1A2B3cD",
  "address_type": "mailing",
  "is_primary": true,
  "created_at": "2026-01-17T12:00:00Z"
}
```

**Business Rules**:
- If address components change, re-validates with Google Maps
- Coordinates automatically updated via Google Maps API

---

#### 16. Delete Address

**Endpoint**: `DELETE /leads/:id/addresses/:addressId`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Response**: `204 No Content`

**Error Responses**:
- `400 Bad Request`: Cannot delete address linked to service requests

---

### Notes Management

#### 17. Add Note

**Endpoint**: `POST /leads/:id/notes`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales, Employee)

**Request Body**:
```json
{
  "note_text": "Customer called to ask about pricing. Follow up next week.",
  "is_pinned": false
}
```

**Field Details**:
- `note_text` (string, required): 1-5000 characters
- `is_pinned` (boolean, optional): Pin note to top, default false

**Response** (201 Created):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "note_text": "Customer called to ask about pricing. Follow up next week.",
  "is_pinned": false,
  "user_id": "uuid",
  "created_at": "2026-01-17T12:00:00Z",
  "user": {
    "id": "uuid",
    "first_name": "Admin",
    "last_name": "User",
    "email": "admin@example.com"
  }
}
```

**Note**: `user_id` field (NOT `performed_by_user_id`) identifies who created the note.

---

#### 18. Update Note

**Endpoint**: `PATCH /leads/:id/notes/:noteId`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales, Employee)

**Request Body** (all fields optional):
```json
{
  "note_text": "Updated note text",
  "is_pinned": true
}
```

**Response** (200 OK):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "note_text": "Updated note text",
  "is_pinned": true,
  "user_id": "uuid",
  "created_at": "2026-01-17T12:00:00Z",
  "user": {
    "id": "uuid",
    "first_name": "Admin",
    "last_name": "User",
    "email": "admin@example.com"
  }
}
```

---

#### 19. Delete Note

**Endpoint**: `DELETE /leads/:id/notes/:noteId`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales, Employee)

**Response**: `204 No Content`

---

#### 20. List Notes

Get all notes for a lead (pinned first, newest first).

**Endpoint**: `GET /leads/:id/notes`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales, Employee)

**Query Parameters**:
- `page` (number, optional): Page number, default 1
- `limit` (number, optional): Items per page, default 50

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "note_text": "Customer called...",
      "is_pinned": true,
      "created_at": "2026-01-17T12:00:00Z",
      "user": {
        "id": "uuid",
        "first_name": "Admin",
        "last_name": "User",
        "email": "admin@example.com"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "totalPages": 1
  }
}
```

---

### Activities

#### 21. Get Activities

Get activity timeline for a lead.

**Endpoint**: `GET /leads/:id/activities`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales, Employee)

**Query Parameters**:
- `page` (number, optional): Page number, default 1
- `limit` (number, optional): Items per page, default 50

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "activity_type": "status_changed",
      "description": "Status changed: lead → prospect",
      "user_id": "uuid",
      "metadata": {
        "old_status": "lead",
        "new_status": "prospect"
      },
      "created_at": "2026-01-17T12:00:00Z",
      "user": {
        "id": "uuid",
        "first_name": "Admin",
        "last_name": "User",
        "email": "admin@example.com"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "totalPages": 1
  }
}
```

**Note**: `user_id` field (NOT `performed_by_user_id`) identifies who performed the activity. The `user` object provides full user details.

**Activity Types**:
- `created`, `updated`, `status_changed`
- `email_added`, `email_updated`, `email_deleted`
- `phone_added`, `phone_updated`, `phone_deleted`
- `address_added`, `address_updated`, `address_deleted`
- `note_added`, `note_updated`, `note_deleted`
- `service_request_created`, `service_request_updated`
- `converted_to_customer`, `marked_as_lost`, `reactivated`

---

## Service Requests

### 22. Create Service Request

**Endpoint**: `POST /service-requests/leads/:leadId?addressId={addressId}`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Query Parameters**:
- `addressId` (UUID, required): Address ID where service will be performed

**Request Body**:
```json
{
  "service_name": "Roof Repair",
  "service_type": "Roofing",
  "service_description": "Leak in roof, water damage visible in ceiling",
  "requested_date": "2026-02-15",
  "urgency": "high",
  "estimated_value": 1500.00,
  "notes": "Customer prefers morning appointments"
}
```

**Field Details**:
- `service_name` (string, required): 1-100 characters - Main service description
- `service_type` (string, optional): 1-100 characters - Service category
- `service_description` (string, required): 1-2000 characters - Detailed description
- `requested_date` (date, optional): ISO 8601 format
- `urgency` (enum, optional): "low" | "medium" | "high" | "emergency", default "medium" (stored as `time_demand` in response)
- `estimated_value` (number, optional): 0-9999999.99 (stored in `extra_data` JSON)
- `notes` (string, optional): 1-2000 characters (stored in `extra_data` JSON)

**Response** (201 Created):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "lead_address_id": "uuid",
  "service_name": "Roof Repair",
  "service_type": "Roofing",
  "service_description": "Leak in roof, water damage visible in ceiling",
  "time_demand": "high",
  "status": "new",
  "extra_data": {
    "requested_date": "2026-02-15",
    "estimated_value": 1500.00,
    "notes": "Customer prefers morning appointments"
  },
  "created_at": "2026-01-17T12:00:00Z",
  "lead_address": {
    "id": "uuid",
    "address_line1": "123 Main St",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101",
    "latitude": "42.36010000",
    "longitude": "-71.05890000"
  }
}
```

**Note**: Field name is `lead_address_id` (NOT `address_id`). The `time_demand` field in response corresponds to `urgency` in request.

---

### 23. List All Service Requests

**Endpoint**: `GET /service-requests`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales, Employee)

**Query Parameters**:
- `status` (string, optional): Filter by status - "new" | "pending" | "scheduled" | "completed" | "cancelled"
- `urgency` (string, optional): Filter by urgency - "low" | "medium" | "high" | "emergency"
- `service_type` (string, optional): Search by service type
- `page` (number, optional): Page number, default 1
- `limit` (number, optional): Items per page, default 50

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": "uuid",
      "lead_id": "uuid",
      "lead_address_id": "uuid",
      "service_name": "Roof Repair",
      "service_type": "Roofing",
      "service_description": "Leak in roof",
      "time_demand": "high",
      "status": "new",
      "extra_data": {
        "requested_date": "2026-02-15",
        "estimated_value": 1500.00
      },
      "created_at": "2026-01-17T12:00:00Z",
      "lead_address": {
        "id": "uuid",
        "address_line1": "123 Main St",
        "city": "Boston",
        "state": "MA",
        "latitude": "42.36010000",
        "longitude": "-71.05890000"
      }
    }
  ],
  "meta": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "totalPages": 1
  }
}
```

**Note**: Response includes `service_name` + `service_type` fields, `time_demand` (not `urgency`), and `lead_address` nested object.

---

### 24. Get Service Request

**Endpoint**: `GET /service-requests/:id`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales, Employee)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "lead_address_id": "uuid",
  "service_name": "Roof Repair",
  "service_type": "Roofing",
  "service_description": "Leak in roof, water damage visible in ceiling",
  "time_demand": "high",
  "status": "new",
  "extra_data": {
    "requested_date": "2026-02-15",
    "estimated_value": 1500.00,
    "notes": "Customer prefers morning appointments"
  },
  "created_at": "2026-01-17T12:00:00Z",
  "updated_at": "2026-01-17T12:00:00Z",
  "lead_address": {
    "id": "uuid",
    "address_line1": "123 Main St",
    "address_line2": "Suite 100",
    "city": "Boston",
    "state": "MA",
    "zip_code": "02101",
    "latitude": "42.36010000",
    "longitude": "-71.05890000",
    "address_type": "service"
  }
}
```

---

### 25. Update Service Request

**Endpoint**: `PATCH /service-requests/:id`
**Authentication**: JWT (Roles: Owner, Admin, Manager, Sales)

**Request Body** (all fields optional):
```json
{
  "service_name": "Roof Repair - Updated",
  "service_type": "Roofing",
  "service_description": "Updated description with more details",
  "urgency": "emergency",
  "status": "scheduled"
}
```

**Field Details**:
- `service_name` (string, optional): 1-100 characters
- `service_type` (string, optional): 1-100 characters
- `service_description` (string, optional): 1-2000 characters
- `urgency` (enum, optional): "low" | "medium" | "high" | "emergency" (updates `time_demand` field)
- `status` (enum, optional): "new" | "pending" | "scheduled" | "completed" | "cancelled"

**Response** (200 OK):
```json
{
  "id": "uuid",
  "lead_id": "uuid",
  "lead_address_id": "uuid",
  "service_name": "Roof Repair - Updated",
  "service_type": "Roofing",
  "service_description": "Updated description with more details",
  "time_demand": "emergency",
  "status": "scheduled",
  "extra_data": {
    "requested_date": "2026-02-15",
    "estimated_value": 1500.00
  },
  "created_at": "2026-01-17T12:00:00Z",
  "updated_at": "2026-01-17T13:00:00Z"
}
```

---

## Webhook Integration

### 26. Webhook Endpoint (PUBLIC)

Receive lead from external sources.

**Endpoint**: `POST /public/leads/webhook`
**Authentication**: Webhook API Key (X-API-Key header)
**Subdomain Required**: `https://{tenant-subdomain}.lead360.app/api/v1/public/leads/webhook`

**Headers**:
- `X-API-Key: {your_webhook_api_key}` OR `Authorization: Bearer {key}`
- `Content-Type: application/json`

**Request Body**:
```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "email": "jane.smith@example.com",
  "phone": "(555) 111-2222",
  "address_line1": "789 Elm St",
  "zip_code": "02110",
  "city": "Boston",
  "state": "MA",
  "service_type": "HVAC Repair",
  "service_description": "Air conditioner not working",
  "external_source_id": "form_submission_67890"
}
```

**Field Details**:
- `first_name` (string, required): 1-100 characters
- `last_name` (string, required): 1-100 characters
- `email` (string, optional): Valid email format. At least email OR phone required. **NO email_type field**.
- `phone` (string, optional): Any format accepted, sanitized to 10 digits. At least email OR phone required.
- `address_line1` (string, required): 1-255 characters
- `zip_code` (string, required): Minimum required for Google Maps geocoding
- `city` (string, optional): Auto-filled by Google Maps if not provided
- `state` (string, optional): Auto-filled by Google Maps if not provided
- `service_type` (string, optional): Maps to `service_name` and `service_type` in service request
- `service_description` (string, optional): Service request description
- `external_source_id` (string, optional): For deduplication, 1-255 characters

**Notes**:
- Phone is automatically sanitized to 10 digits (all non-digits removed)
- Google Maps auto-geocodes address if lat/lng not provided
- Creates service request if `service_type` or `service_description` provided
- Source is automatically set to "webhook"

**Subdomain-Based Tenant Resolution**:
- Each tenant has unique webhook URL using their subdomain
- Example: `acme-plumbing.lead360.app/api/v1/public/leads/webhook`
- Subdomain identifies tenant automatically
- API key MUST belong to tenant from subdomain (security check)

**Deduplication**:
- If `external_source_id` provided and already exists → `409 Conflict`
- If `phone` provided and already exists for tenant → `409 Conflict`

**Response** (201 Created):
```json
{
  "success": true,
  "lead_id": "uuid",
  "message": "Lead created successfully from webhook"
}
```

**Error Responses**:
- `400 Bad Request`: Invalid request or missing subdomain
- `401 Unauthorized`: Invalid or missing API key
- `403 Forbidden`: API key doesn't match subdomain tenant (security violation)
- `409 Conflict`: Duplicate phone or external_source_id
- `422 Unprocessable Entity`: Address validation failed

---

### 27. Create Webhook API Key

**Endpoint**: `POST /webhook-keys`
**Authentication**: JWT (Roles: Owner, Admin)

**Request Body**:
```json
{
  "key_name": "Website contact form integration"
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "api_key": "lead360_webhook_abc123def456...",
  "key_id": "uuid",
  "key_name": "Website contact form integration",
  "webhook_url": "https://acme-plumbing.lead360.app/api/v1/public/leads/webhook",
  "created_at": "2026-01-17T12:00:00Z",
  "warning": "SAVE THIS KEY NOW - It will never be shown again. Store it securely."
}
```

**IMPORTANT**: The `api_key` is shown **ONLY ONCE**. Save it immediately.

---

### 28. List Webhook API Keys

**Endpoint**: `GET /webhook-keys`
**Authentication**: JWT (Roles: Owner, Admin, Manager)

**Response** (200 OK):
```json
{
  "webhook_url": "https://acme-plumbing.lead360.app/api/v1/public/leads/webhook",
  "api_keys": [
    {
      "id": "uuid",
      "key_name": "Website contact form",
      "is_active": true,
      "created_at": "2026-01-17T12:00:00Z",
      "last_used_at": "2026-01-17T14:30:00Z",
      "created_by": {
        "id": "uuid",
        "name": "Admin User",
        "email": "admin@example.com"
      }
    }
  ]
}
```

---

### 29. Toggle Webhook API Key

Toggle webhook API key active status (activate or deactivate).

**Endpoint**: `PATCH /webhook-keys/:id/toggle`
**Authentication**: JWT (Roles: Owner, Admin)

**Request Body**: None (toggles current state)

**Response** (200 OK):
```json
{
  "id": "uuid",
  "key_name": "Website contact form",
  "is_active": false,
  "created_at": "2026-01-17T12:00:00Z",
  "last_used_at": "2026-01-17T14:30:00Z"
}
```

**Note**: Deactivated API keys cannot be used for webhook requests. They return `401 Unauthorized` if used.

---

## Error Responses

### Standard Error Format

All errors follow this format:

```json
{
  "statusCode": 400,
  "message": "Error description",
  "error": "Bad Request"
}
```

### HTTP Status Codes

- `200 OK`: Success
- `201 Created`: Resource created
- `204 No Content`: Success with no response body (DELETE operations)
- `400 Bad Request`: Invalid request data, validation errors
  - Missing required fields
  - Invalid phone format (must be 10 digits after sanitization)
  - Invalid email format
  - Empty note text
  - Missing contact methods (at least 1 email OR 1 phone required)
  - Cannot delete last contact method
  - Missing `lost_reason` when status="lost"
- `401 Unauthorized`: Missing or invalid authentication
  - Missing JWT token
  - Invalid or expired JWT token
  - Invalid webhook API key
  - Deactivated webhook API key
- `403 Forbidden`: Insufficient permissions
  - User role not authorized for operation
  - Webhook API key doesn't match subdomain tenant (security violation)
- `404 Not Found`: Resource not found or access denied
  - Lead not found
  - Email/phone/address not found
  - Note not found
  - Service request not found
  - Tenant isolation: Cannot access resources from other tenants
- `409 Conflict`: Duplicate resource (tenant-scoped)
  - Phone number already exists for this tenant
  - Duplicate `external_source_id` for this tenant
- `422 Unprocessable Entity`: Business logic validation failed
  - Google Maps address validation failed
  - Invalid coordinates (outside US bounds: lat 24-50, lng -125 to -66)
  - Invalid status transition (e.g., customer → anything)
- `500 Internal Server Error`: Server error

---

## Business Rules

### Multi-Tenant Isolation
- **CRITICAL**: All queries filter by `tenant_id`
- Phone uniqueness is **per tenant**, not global
- Webhook subdomain MUST match API key tenant

### Contact Method Requirements
- Lead MUST have at least 1 email OR 1 phone
- Cannot delete last contact method
- Emails: Only `email` and `is_primary` fields exist. **NO email_type field**.
- Phones: Have `phone`, `phone_type`, and `is_primary` fields

### Phone Format & Sanitization
- Phone numbers are automatically sanitized to 10 digits (all non-digits removed)
- Examples: "(555) 123-4567" → "5551234567", "555-123-4567" → "5551234567"
- Must be exactly 10 digits after sanitization
- Validation error if not exactly 10 digits after sanitization

### Primary Flags
- Only ONE email/phone/address per type can be `is_primary=true`
- If setting new primary, automatically unsets others
- If deleting primary, automatically sets another as primary

### Address Validation
- **MANDATORY**: All addresses require lat/lng coordinates in database (NOT NULL)
- Coordinates optional in request (frontend can provide to skip API call)
- Coordinates REQUIRED in response (always present)
- Google Maps API is called for ALL addresses unless frontend provides lat/lng
- Coordinates returned as Decimal strings for precision (Decimal(10,8) and Decimal(11,8))
- Returns `422` error if address validation fails
- US bounds: latitude 24-50, longitude -125 to -66

### Phone Uniqueness (CRITICAL)
- Phone numbers unique **per tenant** (NOT globally unique)
- Enforced at application level (not database constraint)
- Check via: `lead_phone → lead → filter by tenant_id`
- Same phone can exist in different tenants
- Returns `409 Conflict` if phone exists in same tenant

### Status Transitions
- Valid: lead → prospect → customer
- Valid: lead/prospect → lost (with reason)
- Valid: lost → lead (reactivation)
- **Invalid**: customer → anything (immutable)

### Webhook Security
- Each tenant has unique subdomain URL
- API key MUST belong to tenant from subdomain
- Mismatch = `403 Forbidden` (security violation)
- Rate limit: 100 requests/hour per key per tenant

### Service Request Fields
- Uses `lead_address_id` field (NOT `address_id`) to link to address
- Has both `service_name` (required) and `service_type` (optional) fields
- Request uses `urgency` field, response returns `time_demand` field
- `extra_data` JSON field stores flexible data: `requested_date`, `estimated_value`, `notes`
- Status values: "new" | "pending" | "scheduled" | "completed" | "cancelled"

### Activity & Note Fields
- Both use `user_id` field (NOT `performed_by_user_id`)
- Activity types: created, updated, status_changed, email_added, email_updated, email_deleted, phone_added, phone_updated, phone_deleted, address_added, address_updated, address_deleted, note_added, note_updated, note_deleted, service_request_created, service_request_updated, converted_to_customer, marked_as_lost, reactivated
- Activity `metadata` JSON field stores event details

### Activity Logging
- ALL changes create activity entries
- Types: 20 activity types (see above)
- Includes user info (who performed action)
- Metadata JSON stores details

### Audit Logging
- ALL CREATE/UPDATE/DELETE operations logged
- Before/after states captured
- Async via BullMQ queue (non-blocking)

---

## Examples

### Example 1: Create Lead from Website Form

```bash
curl -X POST https://api.lead360.app/api/v1/leads \
  -H "Authorization: Bearer {jwt_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "source": "website",
    "emails": [{"email": "john@example.com", "is_primary": true}],
    "phones": [{"phone": "5551234567", "phone_type": "mobile", "is_primary": true}],
    "addresses": [{
      "address_line1": "123 Main St",
      "zip_code": "02101",
      "city": "Boston",
      "state": "MA",
      "is_primary": true
    }]
  }'
```

### Example 2: Webhook Lead Submission

```bash
curl -X POST https://acme-plumbing.lead360.app/api/v1/public/leads/webhook \
  -H "X-API-Key: lead360_webhook_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com",
    "phone": "5559876543",
    "address_line1": "456 Oak Ave",
    "zip_code": "02139",
    "service_type": "Plumbing Repair",
    "service_description": "Kitchen sink leak"
  }'
```

---

**End of Documentation**

For questions or issues, contact the development team or refer to the Swagger UI at `https://api.lead360.app/api/docs`.
