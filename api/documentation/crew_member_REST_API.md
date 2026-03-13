# Crew Member REST API Documentation

**Module**: Project Management
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT required on all endpoints
**Tenant Isolation**: All queries filter by `tenant_id` from JWT — never accepts `tenant_id` from client

---

## Endpoints Overview

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| POST | `/api/v1/crew` | Owner, Admin, Manager | Create crew member |
| GET | `/api/v1/crew` | Owner, Admin, Manager | List crew members (paginated) |
| GET | `/api/v1/crew/:id` | Owner, Admin, Manager | Get crew member detail (masked) |
| GET | `/api/v1/crew/:id/reveal/:field` | Owner, Admin | Reveal sensitive field (audit logged) |
| PATCH | `/api/v1/crew/:id` | Owner, Admin, Manager | Update crew member |
| DELETE | `/api/v1/crew/:id` | Owner, Admin | Soft delete (set is_active = false) |
| POST | `/api/v1/crew/:id/photo` | Owner, Admin, Manager | Upload profile photo |
| DELETE | `/api/v1/crew/:id/photo` | Owner, Admin | Delete profile photo (hard delete) |

---

## Sensitive Field Handling

### Encrypted Fields (stored encrypted at rest)
- `ssn` → stored as `ssn_encrypted`
- `itin` → stored as `itin_encrypted`
- `drivers_license_number` → stored as `drivers_license_number_encrypted`
- `bank_routing_number` → stored as `bank_routing_encrypted`
- `bank_account_number` → stored as `bank_account_encrypted`

### Masking Rules (all read responses)
- SSN: `***-**-{last4}` (e.g., `***-**-6789`)
- ITIN: `***-**-{last4}`
- Drivers License: `****{last4}` (e.g., `****5678`)
- Bank Routing: `****{last4}`
- Bank Account: `****{last4}`

### Boolean Indicators
Each encrypted field has a companion `has_{field}` boolean:
- `has_ssn`: true/false
- `has_itin`: true/false
- `has_drivers_license_number`: true/false
- `has_bank_routing`: true/false
- `has_bank_account`: true/false

---

## 1. Create Crew Member

**POST** `/api/v1/crew`

**Roles**: Owner, Admin, Manager

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| first_name | string | Yes | max 100 | First name |
| last_name | string | Yes | max 100 | Last name |
| email | string | No | valid email, max 255 | Email address |
| phone | string | No | max 20 | Phone number |
| address_line1 | string | No | max 200 | Street address |
| address_line2 | string | No | max 100 | Address line 2 |
| address_city | string | No | max 100 | City |
| address_state | string | No | exactly 2 chars, uppercase | State code |
| address_zip | string | No | max 10 | ZIP code |
| date_of_birth | string | No | ISO date (YYYY-MM-DD) | Date of birth |
| ssn | string | No | XXX-XX-XXXX or XXXXXXXXX | SSN (encrypted before storage) |
| itin | string | No | XXX-XX-XXXX or XXXXXXXXX | ITIN (encrypted before storage) |
| has_drivers_license | boolean | No | | Has drivers license |
| drivers_license_number | string | No | | DL number (encrypted before storage) |
| default_hourly_rate | number | No | > 0, max 2 decimals | Hourly rate |
| weekly_hours_schedule | integer | No | 1-168 | Weekly hours |
| overtime_enabled | boolean | No | default false | Overtime enabled |
| overtime_rate_multiplier | number | No | > 1 | Overtime multiplier |
| default_payment_method | enum | No | cash, check, bank_transfer, venmo, zelle | Payment method |
| bank_name | string | No | max 200 | Bank name |
| bank_routing_number | string | No | | Routing number (encrypted) |
| bank_account_number | string | No | | Account number (encrypted) |
| venmo_handle | string | No | max 100 | Venmo handle |
| zelle_contact | string | No | max 100 | Zelle contact |
| notes | string | No | | Free-text notes |

### Request Example

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+19781234567",
  "address_line1": "123 Main St",
  "address_city": "Boston",
  "address_state": "MA",
  "address_zip": "02101",
  "date_of_birth": "1990-01-15",
  "ssn": "123-45-6789",
  "has_drivers_license": true,
  "drivers_license_number": "S12345678",
  "default_hourly_rate": 25.00,
  "weekly_hours_schedule": 40,
  "overtime_enabled": true,
  "overtime_rate_multiplier": 1.50,
  "default_payment_method": "bank_transfer",
  "bank_name": "Bank of America",
  "bank_routing_number": "021000021",
  "bank_account_number": "123456789012",
  "venmo_handle": "@johndoe",
  "zelle_contact": "john@email.com",
  "notes": "Experienced framer"
}
```

### Response (201 Created)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t-uuid-001",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+19781234567",
  "address_line1": "123 Main St",
  "address_line2": null,
  "address_city": "Boston",
  "address_state": "MA",
  "address_zip": "02101",
  "date_of_birth": "1990-01-15",
  "ssn_masked": "***-**-6789",
  "has_ssn": true,
  "itin_masked": null,
  "has_itin": false,
  "has_drivers_license": true,
  "drivers_license_masked": "****5678",
  "has_drivers_license_number": true,
  "default_hourly_rate": 25.00,
  "weekly_hours_schedule": 40,
  "overtime_enabled": true,
  "overtime_rate_multiplier": 1.50,
  "default_payment_method": "bank_transfer",
  "bank_name": "Bank of America",
  "bank_routing_masked": "****0021",
  "has_bank_routing": true,
  "bank_account_masked": "****9012",
  "has_bank_account": true,
  "venmo_handle": "@johndoe",
  "zelle_contact": "john@email.com",
  "profile_photo_url": null,
  "notes": "Experienced framer",
  "is_active": true,
  "created_by_user_id": "user-uuid-001",
  "created_at": "2026-01-15T10:30:00.000Z",
  "updated_at": "2026-01-15T10:30:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error (missing required fields, invalid formats) |
| 401 | Missing or invalid JWT |
| 403 | Role not authorized (e.g., Employee role) |

---

## 2. List Crew Members

**GET** `/api/v1/crew`

**Roles**: Owner, Admin, Manager

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| page | number | 1 | Page number (1-indexed) |
| limit | number | 20 | Items per page (max 100) |
| is_active | boolean | (all) | Filter by active status |
| search | string | | Search across first_name, last_name, email, phone |

### Request Example

```
GET /api/v1/crew?page=1&limit=20&is_active=true&search=John
```

### Response (200 OK)

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t-uuid-001",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+19781234567",
      "address_line1": "123 Main St",
      "address_line2": null,
      "address_city": "Boston",
      "address_state": "MA",
      "address_zip": "02101",
      "date_of_birth": "1990-01-15",
      "ssn_masked": "***-**-6789",
      "has_ssn": true,
      "itin_masked": null,
      "has_itin": false,
      "has_drivers_license": true,
      "drivers_license_masked": "****5678",
      "has_drivers_license_number": true,
      "default_hourly_rate": 25.00,
      "weekly_hours_schedule": 40,
      "overtime_enabled": true,
      "overtime_rate_multiplier": 1.50,
      "default_payment_method": "bank_transfer",
      "bank_name": "Bank of America",
      "bank_routing_masked": "****0021",
      "has_bank_routing": true,
      "bank_account_masked": "****9012",
      "has_bank_account": true,
      "venmo_handle": "@johndoe",
      "zelle_contact": "john@email.com",
      "profile_photo_url": "/public/t-uuid-001/images/photo-uuid.webp",
      "notes": "Experienced framer",
      "is_active": true,
      "created_by_user_id": "user-uuid-001",
      "created_at": "2026-01-15T10:30:00.000Z",
      "updated_at": "2026-01-15T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 25,
    "page": 1,
    "limit": 20,
    "totalPages": 2
  }
}
```

---

## 3. Get Crew Member Detail

**GET** `/api/v1/crew/:id`

**Roles**: Owner, Admin, Manager

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| id | UUID | Crew member ID |

### Response (200 OK)

Same shape as single item in list response (see Section 1 response example).

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT |
| 403 | Role not authorized |
| 404 | Crew member not found (or belongs to different tenant) |

---

## 4. Reveal Sensitive Field

**GET** `/api/v1/crew/:id/reveal/:field`

**Roles**: Owner, Admin **only** (Manager cannot reveal)

**Audit Logged**: Every reveal creates an audit log entry with `action_type: 'accessed'`.

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| id | UUID | Crew member ID |
| field | string | One of: `ssn`, `itin`, `drivers_license_number`, `bank_routing`, `bank_account` |

### Request Example

```
GET /api/v1/crew/a1b2c3d4-e5f6-7890-abcd-ef1234567890/reveal/ssn
```

### Response (200 OK)

```json
{
  "field": "ssn",
  "value": "123-45-6789"
}
```

### Audit Log Entry Created

```json
{
  "action_type": "accessed",
  "entity_type": "crew_member",
  "entity_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "description": "Revealed ssn for crew member a1b2c3d4-...",
  "metadata_json": {
    "field_revealed": "ssn",
    "timestamp": "2026-01-15T10:35:00.000Z"
  }
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid field name (not in allowed list) |
| 401 | Missing or invalid JWT |
| 403 | Forbidden (Manager and below cannot reveal) |
| 404 | Crew member not found, or field has no value (null) |

---

## 5. Update Crew Member

**PATCH** `/api/v1/crew/:id`

**Roles**: Owner, Admin, Manager

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| id | UUID | Crew member ID |

### Request Body

All fields from Create are optional. Additionally:

| Field | Type | Description |
|-------|------|-------------|
| is_active | boolean | Soft-activate/deactivate |

### Request Example

```json
{
  "first_name": "Jonathan",
  "default_hourly_rate": 30.00,
  "is_active": true
}
```

### Response (200 OK)

Same shape as Create response with updated values.

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error |
| 401 | Missing or invalid JWT |
| 403 | Role not authorized |
| 404 | Crew member not found |

---

## 6. Soft Delete Crew Member

**DELETE** `/api/v1/crew/:id`

**Roles**: Owner, Admin

Sets `is_active = false`. Does NOT delete the database row.

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| id | UUID | Crew member ID |

### Response (200 OK)

```json
{
  "message": "Crew member deactivated"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT |
| 403 | Forbidden (Manager cannot delete) |
| 404 | Crew member not found |

---

## 7. Upload Profile Photo

**POST** `/api/v1/crew/:id/photo`

**Roles**: Owner, Admin, Manager

**Content-Type**: `multipart/form-data`

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| id | UUID | Crew member ID |

### Request Body (multipart/form-data)

| Field | Type | Description |
|-------|------|-------------|
| file | File | Image file (JPEG, PNG, WebP) |

### Request Example (cURL)

```bash
curl -X POST https://api.lead360.app/api/v1/crew/{id}/photo \
  -H "Authorization: Bearer {token}" \
  -F "file=@photo.jpg"
```

### Response (201 Created)

Returns the full crew member response with updated `profile_photo_url`:

```json
{
  "id": "a1b2c3d4-...",
  "first_name": "John",
  "last_name": "Doe",
  "profile_photo_url": "/public/t-uuid-001/images/photo-uuid.webp",
  "...": "..."
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid file type or size |
| 401 | Missing or invalid JWT |
| 403 | Role not authorized |
| 404 | Crew member not found |

---

## 8. Delete Profile Photo

**DELETE** `/api/v1/crew/:id/photo`

**Roles**: Owner, Admin

Hard deletes the profile photo from storage and clears the reference.

### Path Parameters

| Param | Type | Description |
|-------|------|-------------|
| id | UUID | Crew member ID |

### Response (200 OK)

```json
{
  "message": "Profile photo deleted"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Missing or invalid JWT |
| 403 | Forbidden (Manager cannot delete photos) |
| 404 | Crew member not found, or no photo exists |

---

## Common Error Response Format

All error responses follow this structure:

```json
{
  "statusCode": 400,
  "message": ["first_name must be longer than or equal to 1 characters"],
  "error": "Bad Request"
}
```

---

## Authentication

All endpoints require a valid JWT Bearer token:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

The `tenant_id` is extracted from the JWT payload server-side. It is never accepted from client input.

---

## RBAC Summary

| Action | Owner | Admin | Manager | Others |
|--------|-------|-------|---------|--------|
| Create | Yes | Yes | Yes | No |
| List | Yes | Yes | Yes | No |
| Get Detail | Yes | Yes | Yes | No |
| Reveal Field | Yes | Yes | **No** | No |
| Update | Yes | Yes | Yes | No |
| Soft Delete | Yes | Yes | **No** | No |
| Upload Photo | Yes | Yes | Yes | No |
| Delete Photo | Yes | Yes | **No** | No |

---

## Notes for Frontend Integration

1. **Sensitive fields** are sent as plain text in POST/PATCH requests (e.g., `ssn: "123-45-6789"`). The backend encrypts them automatically.
2. **Responses always mask** encrypted fields. Use the `reveal` endpoint to show the full value, with explicit user action and confirmation.
3. **Profile photo URL** is returned as a relative path (e.g., `/public/{tenant_id}/images/{uuid}.webp`). It is served directly by Nginx — no API proxy needed.
4. **Search** is case-sensitive and matches partial strings across `first_name`, `last_name`, `email`, and `phone`.
5. **Pagination** follows the standard `{ data: [...], meta: { total, page, limit, totalPages } }` format.
6. **Soft delete** only sets `is_active = false`. The record remains queryable. Use `is_active=true` filter to hide deactivated members in the UI.
