# Subcontractor REST API Documentation

**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required on all endpoints
**Content-Type**: `application/json` (except document upload: `multipart/form-data`)

---

## Table of Contents

1. [Create Subcontractor](#1-create-subcontractor)
2. [List Subcontractors](#2-list-subcontractors)
3. [Get Subcontractor Detail](#3-get-subcontractor-detail)
4. [Update Subcontractor](#4-update-subcontractor)
5. [Soft Delete Subcontractor](#5-soft-delete-subcontractor)
6. [Reveal Bank Field](#6-reveal-bank-field)
7. [Add Contact](#7-add-contact)
8. [List Contacts](#8-list-contacts)
9. [Remove Contact](#9-remove-contact)
10. [Upload Document](#10-upload-document)
11. [List Documents](#11-list-documents)
12. [Delete Document](#12-delete-document)
13. [Compliance Status Logic](#compliance-status-logic)
14. [Enums Reference](#enums-reference)

---

## Compliance Status Logic

Compliance status is **recomputed on every read** based on `insurance_expiry_date`:

| Condition | Status |
|-----------|--------|
| `insurance_expiry_date` is null | `unknown` |
| Expiry date is in the past | `expired` |
| Expiry date is within 30 days | `expiring_soon` |
| Expiry date is more than 30 days out | `valid` |

The stored DB column is updated on create/update for filtering, but the response always contains the freshly computed value.

---

## Enums Reference

### payment_method
`cash` | `check` | `bank_transfer` | `venmo` | `zelle`

### subcontractor_document_type
`insurance` | `agreement` | `coi` | `contract` | `license` | `other`

### compliance_status (computed)
`valid` | `expiring_soon` | `expired` | `unknown`

### Document Type → File Category Mapping
| Document Type | File Category |
|--------------|---------------|
| insurance | insurance |
| coi | insurance |
| contract | contract |
| agreement | contract |
| license | license |
| other | misc |

---

## 1. Create Subcontractor

**POST** `/subcontractors`

**Roles**: Owner, Admin, Manager

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| business_name | string | **Yes** | min 1, max 200 | Business name |
| trade_specialty | string | No | max 200 | Trade specialty |
| email | string | No | valid email, max 255 | Email address |
| website | string | No | max 500 | Website URL |
| insurance_provider | string | No | max 200 | Insurance provider name |
| insurance_policy_number | string | No | max 100 | Policy number |
| insurance_expiry_date | string | No | ISO date (YYYY-MM-DD) | Insurance expiry date |
| coi_on_file | boolean | No | default: false | COI on file |
| default_payment_method | string | No | enum: payment_method | Default payment method |
| bank_name | string | No | max 200 | Bank name |
| bank_routing_number | string | No | plain text (encrypted) | Bank routing number |
| bank_account_number | string | No | plain text (encrypted) | Bank account number |
| venmo_handle | string | No | max 100 | Venmo handle |
| zelle_contact | string | No | max 100 | Zelle contact |
| notes | string | No | — | General notes |

### Request Example

```json
{
  "business_name": "ABC Electrical",
  "trade_specialty": "Electrical",
  "email": "info@abc-electrical.com",
  "website": "https://abc-electrical.com",
  "insurance_provider": "State Farm",
  "insurance_policy_number": "POL-12345",
  "insurance_expiry_date": "2027-06-15",
  "coi_on_file": true,
  "default_payment_method": "check",
  "bank_name": "Chase",
  "bank_routing_number": "021000021",
  "bank_account_number": "123456789012",
  "notes": "Reliable electrician"
}
```

### Response (201 Created)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
  "business_name": "ABC Electrical",
  "trade_specialty": "Electrical",
  "email": "info@abc-electrical.com",
  "website": "https://abc-electrical.com",
  "insurance_provider": "State Farm",
  "insurance_policy_number": "POL-12345",
  "insurance_expiry_date": "2027-06-15",
  "coi_on_file": true,
  "compliance_status": "valid",
  "default_payment_method": "check",
  "bank_name": "Chase",
  "bank_routing_masked": "****0021",
  "has_bank_routing": true,
  "bank_account_masked": "****9012",
  "has_bank_account": true,
  "venmo_handle": null,
  "zelle_contact": null,
  "notes": "Reliable electrician",
  "is_active": true,
  "contacts": [],
  "documents": [],
  "created_at": "2026-03-12T10:30:00.000Z",
  "updated_at": "2026-03-12T10:30:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error (missing/invalid fields) |
| 401 | Unauthorized (missing or invalid JWT) |
| 403 | Forbidden (insufficient role) |

---

## 2. List Subcontractors

**GET** `/subcontractors`

**Roles**: Owner, Admin, Manager

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number (min 1) |
| limit | number | 20 | Items per page (max 100) |
| is_active | boolean | — | Filter by active status |
| compliance_status | string | — | Filter: valid, expiring_soon, expired, unknown |
| search | string | — | Search in business_name, trade_specialty, email |

### Request Example

```
GET /api/v1/subcontractors?page=1&limit=20&is_active=true&compliance_status=valid&search=electrical
```

### Response (200 OK)

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
      "business_name": "ABC Electrical",
      "trade_specialty": "Electrical",
      "email": "info@abc-electrical.com",
      "website": "https://abc-electrical.com",
      "insurance_provider": "State Farm",
      "insurance_policy_number": "POL-12345",
      "insurance_expiry_date": "2027-06-15",
      "coi_on_file": true,
      "compliance_status": "valid",
      "default_payment_method": "check",
      "bank_name": "Chase",
      "bank_routing_masked": "****0021",
      "has_bank_routing": true,
      "bank_account_masked": "****9012",
      "has_bank_account": true,
      "venmo_handle": null,
      "zelle_contact": null,
      "notes": "Reliable electrician",
      "is_active": true,
      "created_at": "2026-03-12T10:30:00.000Z",
      "updated_at": "2026-03-12T10:30:00.000Z"
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

**Note**: The list endpoint does NOT include `contacts` or `documents` arrays for performance. Use the detail endpoint (GET /:id) for the full response.

---

## 3. Get Subcontractor Detail

**GET** `/subcontractors/:id`

**Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |

### Response (200 OK)

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
  "business_name": "ABC Electrical",
  "trade_specialty": "Electrical",
  "email": "info@abc-electrical.com",
  "website": "https://abc-electrical.com",
  "insurance_provider": "State Farm",
  "insurance_policy_number": "POL-12345",
  "insurance_expiry_date": "2027-06-15",
  "coi_on_file": true,
  "compliance_status": "valid",
  "default_payment_method": "check",
  "bank_name": "Chase",
  "bank_routing_masked": "****0021",
  "has_bank_routing": true,
  "bank_account_masked": "****9012",
  "has_bank_account": true,
  "venmo_handle": null,
  "zelle_contact": null,
  "notes": "Reliable electrician",
  "is_active": true,
  "contacts": [
    {
      "id": "c1c2c3c4-c5c6-7890-abcd-ef1234567890",
      "contact_name": "Mike Johnson",
      "phone": "555-0101",
      "role": "Owner",
      "email": "mike@abc-electrical.com",
      "is_primary": true,
      "created_at": "2026-03-12T10:30:00.000Z"
    }
  ],
  "documents": [
    {
      "id": "d1d2d3d4-d5d6-7890-abcd-ef1234567890",
      "file_url": "/public/tenant-uuid/files/file-uuid.pdf",
      "file_name": "coi-2026.pdf",
      "document_type": "coi",
      "description": "Certificate of Insurance 2026",
      "created_at": "2026-03-12T10:30:00.000Z"
    }
  ],
  "created_at": "2026-03-12T10:30:00.000Z",
  "updated_at": "2026-03-12T10:30:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Subcontractor not found (or belongs to different tenant) |

---

## 4. Update Subcontractor

**PATCH** `/subcontractors/:id`

**Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |

### Request Body

All fields from Create are accepted (all optional). Additionally:

| Field | Type | Description |
|-------|------|-------------|
| is_active | boolean | Activate/deactivate subcontractor |

Only provided fields are updated. Bank fields are re-encrypted if provided. Compliance status is recomputed.

### Request Example

```json
{
  "trade_specialty": "Electrical & HVAC",
  "insurance_expiry_date": "2028-01-01",
  "bank_routing_number": "099999999"
}
```

### Response (200 OK)

Full subcontractor response (same shape as GET /:id, including contacts and documents).

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Subcontractor not found |

---

## 5. Soft Delete Subcontractor

**DELETE** `/subcontractors/:id`

**Roles**: Owner, Admin

Sets `is_active = false`. Does not hard-delete the record.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |

### Response (200 OK)

```json
{
  "message": "Subcontractor deactivated"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden (Manager cannot delete) |
| 404 | Subcontractor not found |

---

## 6. Reveal Bank Field

**GET** `/subcontractors/:id/reveal/:field`

**Roles**: Owner, Admin **only**

Decrypts and returns the raw bank field value. This action is **audit logged** with action type `accessed`.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |
| field | string | `bank_routing` or `bank_account` |

### Response (200 OK)

```json
{
  "field": "bank_routing",
  "value": "021000021"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid field name (not bank_routing or bank_account) |
| 401 | Unauthorized |
| 403 | Forbidden (Manager cannot reveal) |
| 404 | Subcontractor not found, or field has no stored value |

---

## 7. Add Contact

**POST** `/subcontractors/:id/contacts`

**Roles**: Owner, Admin, Manager

If `is_primary = true`, all other contacts for this subcontractor are set to `is_primary = false`.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |

### Request Body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| contact_name | string | **Yes** | min 1, max 200 | Contact name |
| phone | string | **Yes** | min 1, max 20 | Phone number |
| role | string | No | max 100 | Role/title |
| email | string | No | valid email, max 255 | Email |
| is_primary | boolean | No | default: false | Primary contact |

### Request Example

```json
{
  "contact_name": "Mike Johnson",
  "phone": "555-0101",
  "role": "Owner",
  "email": "mike@abc-electrical.com",
  "is_primary": true
}
```

### Response (201 Created)

```json
{
  "id": "c1c2c3c4-c5c6-7890-abcd-ef1234567890",
  "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
  "subcontractor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "contact_name": "Mike Johnson",
  "phone": "555-0101",
  "role": "Owner",
  "email": "mike@abc-electrical.com",
  "is_primary": true,
  "created_at": "2026-03-12T10:30:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Subcontractor not found |

---

## 8. List Contacts

**GET** `/subcontractors/:id/contacts`

**Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |

### Response (200 OK)

```json
[
  {
    "id": "c1c2c3c4-c5c6-7890-abcd-ef1234567890",
    "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
    "subcontractor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "contact_name": "Mike Johnson",
    "phone": "555-0101",
    "role": "Owner",
    "email": "mike@abc-electrical.com",
    "is_primary": true,
    "created_at": "2026-03-12T10:30:00.000Z"
  }
]
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Subcontractor not found |

---

## 9. Remove Contact

**DELETE** `/subcontractors/:id/contacts/:contactId`

**Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |
| contactId | UUID | Contact ID |

### Response (200 OK)

```json
{
  "message": "Contact removed"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Contact not found |

---

## 10. Upload Document

**POST** `/subcontractors/:id/documents`

**Roles**: Owner, Admin, Manager

**Content-Type**: `multipart/form-data`

Uses `FileInterceptor('file')`. Files are uploaded via the platform's FilesService and stored at:
```
/public/{tenant_id}/files/{uuid}.{ext}
```

The URL is served directly by Nginx (no backend proxy).

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |

### Form Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | **Yes** | The file to upload |
| document_type | string | **Yes** | Enum: insurance, agreement, coi, contract, license, other |
| description | string | No | max 500, description of the document |

### Request Example (multipart/form-data)

```
POST /api/v1/subcontractors/{id}/documents
Content-Type: multipart/form-data

file: [binary file data]
document_type: coi
description: Certificate of Insurance 2026
```

### Response (201 Created)

```json
{
  "id": "d1d2d3d4-d5d6-7890-abcd-ef1234567890",
  "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
  "subcontractor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "file_id": "f1f2f3f4-f5f6-7890-abcd-ef1234567890",
  "file_url": "/public/t1t2t3t4-t5t6-7890-abcd-ef1234567890/files/f1f2f3f4.pdf",
  "file_name": "coi-2026.pdf",
  "document_type": "coi",
  "description": "Certificate of Insurance 2026",
  "uploaded_by_user_id": "u1u2u3u4-u5u6-7890-abcd-ef1234567890",
  "created_at": "2026-03-12T10:30:00.000Z"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid file type, file too large, or validation error |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Subcontractor not found |

---

## 11. List Documents

**GET** `/subcontractors/:id/documents`

**Roles**: Owner, Admin, Manager

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |

### Response (200 OK)

```json
[
  {
    "id": "d1d2d3d4-d5d6-7890-abcd-ef1234567890",
    "tenant_id": "t1t2t3t4-t5t6-7890-abcd-ef1234567890",
    "subcontractor_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "file_id": "f1f2f3f4-f5f6-7890-abcd-ef1234567890",
    "file_url": "/public/tenant-uuid/files/file-uuid.pdf",
    "file_name": "coi-2026.pdf",
    "document_type": "coi",
    "description": "Certificate of Insurance 2026",
    "uploaded_by_user_id": "u1u2u3u4-u5u6-7890-abcd-ef1234567890",
    "created_at": "2026-03-12T10:30:00.000Z"
  }
]
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Subcontractor not found |

---

## 12. Delete Document

**DELETE** `/subcontractors/:id/documents/:documentId`

**Roles**: Owner, Admin

Deletes the document record **and** the underlying file from storage. Audit logged.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Subcontractor ID |
| documentId | UUID | Document ID |

### Response (200 OK)

```json
{
  "message": "Document deleted"
}
```

### Error Responses

| Status | Description |
|--------|-------------|
| 401 | Unauthorized |
| 403 | Forbidden (Manager cannot delete documents) |
| 404 | Document not found |

---

## Response Shape Summary

### Subcontractor (Full — from GET /:id, POST, PATCH)

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Subcontractor ID |
| tenant_id | string (UUID) | Tenant ID |
| business_name | string | Business name |
| trade_specialty | string | null | Trade specialty |
| email | string | null | Email |
| website | string | null | Website URL |
| insurance_provider | string | null | Insurance provider |
| insurance_policy_number | string | null | Policy number |
| insurance_expiry_date | string | null | ISO date (YYYY-MM-DD) |
| coi_on_file | boolean | COI on file |
| compliance_status | string | Computed: valid, expiring_soon, expired, unknown |
| default_payment_method | string | null | Payment method enum |
| bank_name | string | null | Bank name |
| bank_routing_masked | string | null | Last 4 digits: ****XXXX |
| has_bank_routing | boolean | Whether routing number exists |
| bank_account_masked | string | null | Last 4 digits: ****XXXX |
| has_bank_account | boolean | Whether account number exists |
| venmo_handle | string | null | Venmo handle |
| zelle_contact | string | null | Zelle contact |
| notes | string | null | Notes |
| is_active | boolean | Active status |
| contacts | array | Contacts (detail/create/update only) |
| documents | array | Documents (detail/create/update only) |
| created_at | string (ISO) | Created timestamp |
| updated_at | string (ISO) | Updated timestamp |

### Subcontractor (List — from GET /)

Same as above **without** `contacts` and `documents` arrays.

### Contact

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Contact ID |
| contact_name | string | Name |
| phone | string | Phone number |
| role | string | null | Role/title |
| email | string | null | Email |
| is_primary | boolean | Primary contact flag |
| created_at | string (ISO) | Created timestamp |

### Document

| Field | Type | Description |
|-------|------|-------------|
| id | string (UUID) | Document ID |
| file_url | string | Nginx-served file URL |
| file_name | string | Original filename |
| document_type | string | Document type enum |
| description | string | null | Description |
| created_at | string (ISO) | Created timestamp |

---

## Security Notes

- **Bank fields** (routing, account) are encrypted with AES-256-GCM before storage
- **Masked values** show only last 4 characters in all list/detail responses
- **Reveal endpoint** requires Owner/Admin role and is audit logged
- **Tenant isolation** enforced on every query — cross-tenant access returns 404
- **Soft delete** preserves the record for audit trail
