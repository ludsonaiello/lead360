# Clock-In Address REST API

**Module:** `time-clock` — Clock-In Addresses
**Base URL:** `https://api.lead360.app/api/v1`
**Local Base URL:** `http://localhost:8000/api/v1`
**Sprint:** 5 (Clock-In Addresses CRUD + Import Endpoints + GeofenceService)

All endpoints in this module require a valid JWT bearer token.
All endpoints are restricted to the `Owner` and `Admin` roles.
All queries are scoped to the authenticated user's `tenant_id` — tenant isolation is enforced server-side.

---

## Authentication & Authorization

```
Authorization: Bearer <jwt-access-token>
```

| Guard | Purpose |
|-------|---------|
| `JwtAuthGuard` | Validates JWT; rejects expired/invalid tokens |
| `RolesGuard` | Enforces `@Roles('Owner', 'Admin')` on every endpoint |

**Common error responses:**
- `401 Unauthorized` — missing/invalid token
- `403 Forbidden` — authenticated user lacks the required role
- `404 Not Found` — resource does not exist or belongs to another tenant

---

## Shared Objects

### `ClockinAddress` (response object)

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `id` | `string (uuid)` | no | Primary key |
| `tenant_id` | `string (uuid)` | no | Owning tenant |
| `project_id` | `string (uuid)` | yes | Linked project (if any) |
| `label` | `string` | no | Human-readable label (1–100 chars) |
| `address_line1` | `string` | no | Street line 1 (Google-normalized on create) |
| `address_line2` | `string` | yes | Apt/suite |
| `city` | `string` | no | City (Google-normalized on create) |
| `state` | `string (2)` | no | US state abbreviation |
| `zip_code` | `string` | no | ZIP code |
| `latitude` | `string (decimal 10,8)` | no | Geocoded latitude |
| `longitude` | `string (decimal 11,8)` | no | Geocoded longitude |
| `radius_meters` | `integer` | no | Geofence radius (25–5000, default 100) |
| `is_active` | `boolean` | no | Whether the address is active (soft-delete flag) |
| `source` | `'manual' \| 'imported_from_quote' \| 'imported_from_lead'` | no | How the address was created |
| `source_address_id` | `string (uuid)` | yes | FK back to origin quote/lead address |
| `created_by_user_id` | `string (uuid)` | no | User who created the record |
| `created_at` | `ISO-8601 datetime` | no | Creation timestamp |
| `updated_at` | `ISO-8601 datetime` | no | Last-update timestamp |
| `project` | `{ id: string; name: string } \| null` | yes | Project relation (included in all responses) |

Latitude/longitude are serialized as decimal strings (Prisma `Decimal` → JSON string).

### Pagination envelope

```json
{
  "data": [ ClockinAddress, ... ],
  "meta": {
    "total": 42,
    "page": 1,
    "limit": 20,
    "totalPages": 3
  }
}
```

### Error envelope

```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Clock-in address not found",
  "error": "Not Found",
  "timestamp": "2026-04-12T22:55:34.896Z",
  "path": "/api/v1/time-clock/addresses/...",
  "requestId": "req_77c2bc7500d5c8cb"
}
```

---

## 1. List Clock-In Addresses

**`GET /api/v1/time-clock/addresses`**

Returns a paginated list of clock-in addresses for the current tenant.

**Required roles:** `Owner`, `Admin`

### Query parameters

| Name | Type | Default | Description |
|------|------|---------|-------------|
| `page` | integer ≥ 1 | `1` | Page number (1-based) |
| `limit` | integer 1–100 | `20` | Items per page |
| `is_active` | boolean | *unset* | Filter by active status (`true` or `false`) |
| `project_id` | uuid | *unset* | Filter by linked project |
| `search` | string (≤ 255) | *unset* | Case-sensitive `contains` match on `label` |

### Response `200 OK`

```json
{
  "data": [
    {
      "id": "f8fe05cb-60b5-443f-889d-1c3b46c3f5d6",
      "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
      "project_id": null,
      "label": "Sprint 5 Test Office",
      "address_line1": "1600 Amphitheatre Parkway",
      "address_line2": null,
      "city": "Mountain View",
      "state": "CA",
      "zip_code": "94043",
      "latitude": "37.42248640",
      "longitude": "-122.08559620",
      "radius_meters": 150,
      "is_active": true,
      "source": "manual",
      "source_address_id": null,
      "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
      "created_at": "2026-04-12T22:55:46.402Z",
      "updated_at": "2026-04-12T22:55:46.402Z",
      "project": null
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

### Errors

| Status | When |
|--------|------|
| `400` | Invalid query parameter (bad enum, non-integer, out of range) |
| `401` | Missing or invalid JWT |
| `403` | Authenticated user is not Owner/Admin |

### Example

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8000/api/v1/time-clock/addresses?page=1&limit=20&is_active=true&search=Office"
```

---

## 2. Create Clock-In Address

**`POST /api/v1/time-clock/addresses`**

Creates a new clock-in address. The address is geocoded via `GoogleMapsService.validateAddress()`. The normalized `address_line1`, `city`, `state`, `zip_code`, `latitude`, and `longitude` returned by Google are persisted. `address_line2` is stored as supplied.

**Required roles:** `Owner`, `Admin`

### Request body

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `label` | string | **yes** | 1–100 chars | Human-readable label |
| `address_line1` | string | **yes** | 1–255 chars | Street line 1 |
| `address_line2` | string | no | ≤ 255 chars | Apt/suite |
| `city` | string | no | ≤ 100 chars | City (Google will resolve if omitted) |
| `state` | string | no | ≤ 2 chars | US state abbreviation |
| `zip_code` | string | **yes** | 1–10 chars | ZIP code |
| `latitude` | number | no | US bounds | Optional — if provided with `longitude`, Google is called only for normalization |
| `longitude` | number | no | US bounds | Optional — paired with `latitude` |
| `radius_meters` | integer | no | 25–5000, default `100` | Geofence radius |
| `project_id` | uuid | no | must belong to current tenant | Link to a project |

**Never accept `tenant_id`, `created_by_user_id`, `id`, `created_at`, `updated_at`, `source`, or `source_address_id` from the client.**

### Response `201 Created`

Returns the created `ClockinAddress` with the `project` relation included. `source` is always `"manual"`.

```json
{
  "id": "f8fe05cb-60b5-443f-889d-1c3b46c3f5d6",
  "tenant_id": "14a34ab2-6f6f-4e41-9bea-c444a304557e",
  "project_id": null,
  "label": "Sprint 5 Test Office",
  "address_line1": "1600 Amphitheatre Parkway",
  "address_line2": null,
  "city": "Mountain View",
  "state": "CA",
  "zip_code": "94043",
  "latitude": "37.42248640",
  "longitude": "-122.08559620",
  "radius_meters": 150,
  "is_active": true,
  "source": "manual",
  "source_address_id": null,
  "created_by_user_id": "32cd6d0d-1823-4033-8aa8-9513dda9cf59",
  "created_at": "2026-04-12T22:55:46.402Z",
  "updated_at": "2026-04-12T22:55:46.402Z",
  "project": null
}
```

### Errors

| Status | When |
|--------|------|
| `400` | DTO validation failed (missing required field, out-of-range radius, etc.) |
| `401` | Missing or invalid JWT |
| `403` | User is not Owner/Admin |
| `404` | `project_id` provided but project not found for this tenant |
| `422` | Google Maps could not validate / geocode the address |

### Example

```bash
curl -X POST "http://localhost:8000/api/v1/time-clock/addresses" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "label": "Main Office",
    "address_line1": "1600 Amphitheatre Parkway",
    "city": "Mountain View",
    "state": "CA",
    "zip_code": "94043",
    "radius_meters": 150
  }'
```

---

## 3. Get Clock-In Address by ID

**`GET /api/v1/time-clock/addresses/:id`**

Returns a single clock-in address scoped to the current tenant.

**Required roles:** `Owner`, `Admin`

### Path parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | uuid | Clock-in address ID |

### Response `200 OK`

Returns a `ClockinAddress` (with `project` relation included).

### Errors

| Status | When |
|--------|------|
| `401` | Missing or invalid JWT |
| `403` | User is not Owner/Admin |
| `404` | Address does not exist or belongs to another tenant |

---

## 4. Update Clock-In Address

**`PATCH /api/v1/time-clock/addresses/:id`**

Partially updates a clock-in address.

The address is **re-geocoded only** when at least one of the following fields changes: `address_line1`, `city`, `state`, `zip_code`. Updates limited to `label`, `address_line2`, `radius_meters`, `is_active`, or `project_id` do **not** invoke Google Maps.

**Required roles:** `Owner`, `Admin`

### Path parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | uuid | Clock-in address ID |

### Request body (all fields optional)

| Field | Type | Validation |
|-------|------|------------|
| `label` | string | 1–100 chars |
| `address_line1` | string | 1–255 chars |
| `address_line2` | string | ≤ 255 chars |
| `city` | string | ≤ 100 chars |
| `state` | string | ≤ 2 chars |
| `zip_code` | string | ≤ 10 chars |
| `radius_meters` | integer | 25–5000 |
| `is_active` | boolean | — |
| `project_id` | uuid | must belong to current tenant |

### Response `200 OK`

Returns the updated `ClockinAddress` with the `project` relation.

### Errors

| Status | When |
|--------|------|
| `400` | Validation failed |
| `401` | Missing or invalid JWT |
| `403` | User is not Owner/Admin |
| `404` | Address or `project_id` not found for this tenant |
| `422` | Google Maps could not validate / geocode the updated address |

### Example

```bash
curl -X PATCH "http://localhost:8000/api/v1/time-clock/addresses/f8fe05cb-60b5-443f-889d-1c3b46c3f5d6" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "label": "Renamed Office", "radius_meters": 200 }'
```

---

## 5. Soft-Delete Clock-In Address

**`DELETE /api/v1/time-clock/addresses/:id`**

Soft-deletes the clock-in address by setting `is_active = false`. The record is **not removed**. An audit log entry is written.

**Required roles:** `Owner`, `Admin`

### Path parameters

| Name | Type | Description |
|------|------|-------------|
| `id` | uuid | Clock-in address ID |

### Response `200 OK`

```json
{ "message": "Address deactivated successfully" }
```

### Errors

| Status | When |
|--------|------|
| `401` | Missing or invalid JWT |
| `403` | User is not Owner/Admin |
| `404` | Address does not exist or belongs to another tenant |

---

## 6. Import from Quote

**`POST /api/v1/time-clock/addresses/import-from-quote`**

Creates a new clock-in address by copying the jobsite address from a quote owned by the current tenant. No Google Maps call is made — the address is already geocoded on the quote. The new record has:
- `source = "imported_from_quote"`
- `source_address_id = quote.jobsite_address.id`

**Required roles:** `Owner`, `Admin`

### Request body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `quote_id` | uuid | **yes** | Quote must belong to current tenant and have a jobsite address |
| `label` | string | **yes** | 1–100 chars |
| `project_id` | uuid | no | Must belong to current tenant |
| `radius_meters` | integer | no | 25–5000, default `100` |

### Response `201 Created`

Returns the created `ClockinAddress` (with `project` relation).

### Errors

| Status | When |
|--------|------|
| `400` | Validation failed **or** quote has no jobsite address |
| `401` | Missing or invalid JWT |
| `403` | User is not Owner/Admin |
| `404` | Quote (for this tenant) or `project_id` not found |

### Example

```bash
curl -X POST "http://localhost:8000/api/v1/time-clock/addresses/import-from-quote" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "quote_id": "06deab78-8502-4eac-b84c-566e6ada4c18",
    "label": "Quote #1042 Jobsite",
    "radius_meters": 120
  }'
```

---

## 7. Import from Lead

**`POST /api/v1/time-clock/addresses/import-from-lead`**

Creates a new clock-in address by copying a `lead_address`. Because `lead_address` has no `tenant_id` column, tenant ownership is verified by joining through the `lead` relation — if the related lead does not belong to the current tenant, the response is `404`. No Google Maps call is made. The new record has:
- `source = "imported_from_lead"`
- `source_address_id = lead_address.id`

**Required roles:** `Owner`, `Admin`

### Request body

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `lead_address_id` | uuid | **yes** | Parent lead must belong to current tenant |
| `label` | string | **yes** | 1–100 chars |
| `project_id` | uuid | no | Must belong to current tenant |
| `radius_meters` | integer | no | 25–5000, default `100` |

### Response `201 Created`

Returns the created `ClockinAddress` (with `project` relation).

### Errors

| Status | When |
|--------|------|
| `400` | Validation failed |
| `401` | Missing or invalid JWT |
| `403` | User is not Owner/Admin |
| `404` | Lead address not found, or parent lead does not belong to current tenant, or `project_id` not found |

### Example

```bash
curl -X POST "http://localhost:8000/api/v1/time-clock/addresses/import-from-lead" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "lead_address_id": "8aa24f29-4f46-4492-8db1-0d1f254f90c6",
    "label": "Lead — John Doe Residence"
  }'
```

---

## Internal Service: `GeofenceService`

Not exposed directly as a REST endpoint in this sprint. Consumed by `ClockSessionService` (Sprint 9) during the clock-in flow.

```ts
import { GeofenceService } from 'src/modules/time-clock/services/geofence.service';

const result = await geofenceService.checkGeofence({
  tenantId,
  latitude: 37.4224864,
  longitude: -122.0855962,
  projectId, // optional
});
```

### Return shape

```ts
{
  geofence_status: 'not_enforced' | 'inside' | 'outside';
  clockin_address_id: string | null;
  nearest_distance_meters: number | null; // integer meters
  flag_reason: string | null;
}
```

### Semantics

| Condition | `geofence_status` | `clockin_address_id` | `nearest_distance_meters` | `flag_reason` |
|-----------|-------------------|----------------------|---------------------------|---------------|
| Tenant has **no active** addresses (or none matching the optional project filter) | `not_enforced` | `null` | `null` | `null` |
| Worker location is within the radius of at least one candidate address | `inside` | ID of the **closest** matching address | rounded meters to that address | `null` |
| Worker is outside every candidate radius | `outside` | `null` | rounded meters to the nearest candidate | `"Outside all configured locations — {N}m from nearest"` |

### Candidate selection

Only rows matching the following are considered:
- `tenant_id = params.tenantId`
- `is_active = true`
- If `projectId` is supplied: `project_id IS NULL` **OR** `project_id = projectId` (global addresses + project-specific addresses)
- If `projectId` is omitted: all active addresses for the tenant

Distance is computed with a private **Haversine** implementation (no external library):

```
R = 6_371_000 m
a = sin²(Δφ/2) + cos φ₁ · cos φ₂ · sin²(Δλ/2)
distance = R · 2 · atan2(√a, √(1−a))
```

Validated against known pairs at sprint time:
- Googleplex → SF City Hall ≈ 48,994 m (expected ~49,000 m)
- Identical coordinates → 0 m
- 1° of latitude → 111,195 m

---

## Audit Logging

Every write operation emits an entry via `AuditLoggerService.logTenantChange()`:

| Endpoint | `action` | `entityType` | Description |
|----------|----------|--------------|-------------|
| `POST /addresses` | `created` | `clockin_address` | `Created clock-in address: {label}` |
| `PATCH /addresses/:id` | `updated` | `clockin_address` | `Updated clock-in address: {label}` |
| `DELETE /addresses/:id` | `updated` | `clockin_address` | `Deactivated clock-in address: {label}` |
| `POST /addresses/import-from-quote` | `created` | `clockin_address` | `Imported clock-in address from quote: {label}` |
| `POST /addresses/import-from-lead` | `created` | `clockin_address` | `Imported clock-in address from lead: {label}` |

---

## Multi-Tenant Isolation Summary

Every query touches the `tenant_id` column (either directly on `clockin_address` / `project` / `quote`, or transitively through the `lead` relation for `lead_address`):

| Resource | Isolation strategy |
|----------|-------------------|
| `clockin_address` | `where: { tenant_id }` on every read/write |
| `project` (for validation) | `where: { id, tenant_id }` |
| `quote` (for import) | `where: { id, tenant_id }` |
| `lead_address` (for import) | `findFirst({ where: { id } })` + **explicit check** `leadAddress.lead.tenant_id === tenantId` (lead_address has no tenant_id column) |

`tenant_id` and `created_by_user_id` are **always** derived from the JWT — never accepted from the request body.
