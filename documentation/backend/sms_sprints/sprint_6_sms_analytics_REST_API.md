# Sprint 6: SMS Analytics Dashboard - REST API Documentation

**Module**: Communication
**Feature**: SMS Analytics & Reporting
**Sprint**: 6
**Priority**: 🟢 MEDIUM
**Status**: ✅ PRODUCTION READY
**Last Updated**: February 13, 2026

---

## Overview

The SMS Analytics API provides comprehensive analytics and reporting capabilities for SMS communications. This feature enables:
- Summary metrics (sent, delivered, failed, delivery rate, cost)
- Daily trend analysis
- Failure breakdown by error code
- Top recipient identification

### Key Features

✅ **Comprehensive Metrics**: Track all SMS performance indicators
✅ **Date Range Filtering**: Flexible date range selection (default: last 30 days)
✅ **Multi-tenant Isolated**: Strict tenant boundary enforcement
✅ **Cost Tracking**: Real-time cost aggregation from provider metadata
✅ **Failure Analysis**: Error code breakdown for troubleshooting
✅ **Lead Enrichment**: Top recipients linked to Lead profiles
✅ **Admin Cross-Tenant**: SystemAdmin can view analytics across all tenants

---

## Base URL

```
https://api.lead360.app/api/v1/communication/sms/analytics
```

**Admin Base URL**:
```
https://api.lead360.app/api/v1/admin/communication/sms/analytics
```

---

## Authentication

All endpoints require:
- **JWT Bearer Token** in `Authorization` header
- Valid tenant membership
- Appropriate role permissions

```http
Authorization: Bearer <your_jwt_token>
```

---

## Tenant Endpoints

### 1. Get SMS Analytics Summary

Get summary metrics for SMS communications (sent, delivered, failed, delivery rate, cost, unique recipients, opt-outs).

**Endpoint**: `GET /communication/sms/analytics/summary`

**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start_date` | `string` | ❌ No | 30 days ago | Start date (ISO 8601: YYYY-MM-DD) |
| `end_date` | `string` | ❌ No | Today | End date (ISO 8601: YYYY-MM-DD) |

**Example Request**:

```http
GET /communication/sms/analytics/summary?start_date=2026-01-01&end_date=2026-02-13
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

```json
{
  "total_sent": 1523,
  "total_delivered": 1495,
  "total_failed": 28,
  "delivery_rate": 98.16,
  "total_cost": 45.69,
  "unique_recipients": 342,
  "opt_out_count": 15
}
```

**Response Schema**:

| Field | Type | Description |
|-------|------|-------------|
| `total_sent` | `number` | Total SMS messages sent (includes delivered) |
| `total_delivered` | `number` | Total SMS messages successfully delivered |
| `total_failed` | `number` | Total SMS messages that failed |
| `delivery_rate` | `number` | Delivery rate percentage (0-100) |
| `total_cost` | `number` | Total cost in dollars (from provider metadata) |
| `unique_recipients` | `number` | Number of unique phone numbers |
| `opt_out_count` | `number` | Number of leads who opted out of SMS |

**Error Responses**:

| Status | Description | Example |
|--------|-------------|---------|
| `400` | Invalid date format | `{"message": "Invalid start_date format. Use ISO 8601 format"}` |
| `400` | Invalid date range | `{"message": "start_date must be before or equal to end_date"}` |
| `401` | Unauthorized | `{"message": "Unauthorized"}` |
| `403` | Insufficient permissions | `{"message": "Forbidden"}` |

---

### 2. Get SMS Daily Trends

Get daily breakdown of SMS metrics showing sent, delivered, and failed counts per day.

**Endpoint**: `GET /communication/sms/analytics/trends`

**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start_date` | `string` | ❌ No | 30 days ago | Start date (ISO 8601: YYYY-MM-DD) |
| `end_date` | `string` | ❌ No | Today | End date (ISO 8601: YYYY-MM-DD) |

**Example Request**:

```http
GET /communication/sms/analytics/trends?start_date=2026-02-01&end_date=2026-02-13
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

```json
[
  {
    "date": "2026-02-01",
    "sent_count": 45,
    "delivered_count": 43,
    "failed_count": 2
  },
  {
    "date": "2026-02-02",
    "sent_count": 52,
    "delivered_count": 51,
    "failed_count": 1
  },
  {
    "date": "2026-02-03",
    "sent_count": 38,
    "delivered_count": 37,
    "failed_count": 1
  }
]
```

**Response Schema**:

Array of daily trend objects:

| Field | Type | Description |
|-------|------|-------------|
| `date` | `string` | Date (YYYY-MM-DD) |
| `sent_count` | `number` | SMS messages sent on this day |
| `delivered_count` | `number` | SMS messages delivered on this day |
| `failed_count` | `number` | SMS messages failed on this day |

**Notes**:
- Days with no SMS activity may be omitted from the response
- Results are sorted by date ascending

**Error Responses**:

Same as Summary endpoint.

---

### 3. Get SMS Failure Breakdown

Get breakdown of SMS failures by error code, sorted by count (descending). Helps identify common failure patterns.

**Endpoint**: `GET /communication/sms/analytics/failures`

**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start_date` | `string` | ❌ No | 30 days ago | Start date (ISO 8601: YYYY-MM-DD) |
| `end_date` | `string` | ❌ No | Today | End date (ISO 8601: YYYY-MM-DD) |

**Example Request**:

```http
GET /communication/sms/analytics/failures?start_date=2026-01-01&end_date=2026-02-13
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

```json
[
  {
    "error_code": "21211",
    "count": 15
  },
  {
    "error_code": "21614",
    "count": 8
  },
  {
    "error_code": "30003",
    "count": 5
  },
  {
    "error_code": "unknown",
    "count": 2
  }
]
```

**Response Schema**:

Array of error breakdown objects:

| Field | Type | Description |
|-------|------|-------------|
| `error_code` | `string` | Error code from SMS provider (e.g., Twilio error codes) |
| `count` | `number` | Number of failures with this error code |

**Common Twilio Error Codes**:

| Code | Description |
|------|-------------|
| `21211` | Invalid phone number |
| `21614` | Number cannot receive SMS |
| `30003` | Unreachable destination handset |
| `30005` | Unknown destination handset |
| `30006` | Landline or unreachable carrier |
| `unknown` | No error code provided |

**Notes**:
- Results are sorted by count descending (most common errors first)
- If no failures exist, returns empty array `[]`

**Error Responses**:

Same as Summary endpoint.

---

### 4. Get Top SMS Recipients

Get the most frequently SMS'd phone numbers with associated Lead information. Useful for identifying high-engagement leads.

**Endpoint**: `GET /communication/sms/analytics/top-recipients`

**RBAC**: `Owner`, `Admin`, `Manager`

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `start_date` | `string` | ❌ No | 30 days ago | Start date (ISO 8601: YYYY-MM-DD) |
| `end_date` | `string` | ❌ No | Today | End date (ISO 8601: YYYY-MM-DD) |
| `limit` | `number` | ❌ No | 10 | Maximum recipients to return (1-100) |

**Example Request**:

```http
GET /communication/sms/analytics/top-recipients?start_date=2026-01-01&end_date=2026-02-13&limit=5
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

```json
[
  {
    "to_phone": "+15551234567",
    "sms_count": 23,
    "lead": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "first_name": "John",
      "last_name": "Doe"
    }
  },
  {
    "to_phone": "+15559876543",
    "sms_count": 18,
    "lead": {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "first_name": "Jane",
      "last_name": "Smith"
    }
  },
  {
    "to_phone": "+15555551234",
    "sms_count": 15,
    "lead": null
  }
]
```

**Response Schema**:

Array of top recipient objects:

| Field | Type | Description |
|-------|------|-------------|
| `to_phone` | `string` | Recipient phone number (E.164 format) |
| `sms_count` | `number` | Number of SMS messages sent to this number |
| `lead` | `object \| null` | Associated Lead information (null if not found) |
| `lead.id` | `string` | Lead UUID |
| `lead.first_name` | `string` | Lead first name |
| `lead.last_name` | `string` | Lead last name |

**Notes**:
- Recipients are sorted by `sms_count` descending
- Lead information is enriched from the `lead_phone` table
- Phone numbers without matching Leads will have `lead: null`

**Error Responses**:

| Status | Description | Example |
|--------|-------------|---------|
| `400` | Invalid date format | `{"message": "Invalid start_date format. Use ISO 8601 format"}` |
| `400` | Invalid limit | `{"message": "Invalid limit. Must be a number between 1 and 100"}` |
| `401` | Unauthorized | `{"message": "Unauthorized"}` |
| `403` | Insufficient permissions | `{"message": "Forbidden"}` |

---

## Admin Endpoints (Cross-Tenant)

All admin endpoints require `SystemAdmin` role.

### 5. Get SMS Analytics Summary (Admin)

Get summary metrics across all tenants or for a specific tenant.

**Endpoint**: `GET /admin/communication/sms/analytics/summary`

**RBAC**: `SystemAdmin` only

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tenant_id` | `string` | ❌ No | All tenants | Filter by specific tenant UUID |
| `start_date` | `string` | ❌ No | 30 days ago | Start date (ISO 8601: YYYY-MM-DD) |
| `end_date` | `string` | ❌ No | Today | End date (ISO 8601: YYYY-MM-DD) |

**Example Request (All Tenants)**:

```http
GET /admin/communication/sms/analytics/summary?start_date=2026-01-01&end_date=2026-02-13
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Example Request (Specific Tenant)**:

```http
GET /admin/communication/sms/analytics/summary?tenant_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890&start_date=2026-01-01
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

```json
{
  "total_sent": 15234,
  "total_delivered": 14952,
  "total_failed": 282,
  "delivery_rate": 98.15,
  "total_cost": 456.78,
  "unique_recipients": 3421,
  "opt_out_count": 152,
  "tenant_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
}
```

**Response Schema**:

Same as tenant summary endpoint, with optional `tenant_id` field:

| Field | Type | Description |
|-------|------|-------------|
| `tenant_id` | `string` | Tenant UUID (only present if filtered by tenant) |
| ... | ... | All other fields same as tenant endpoint |

**Error Responses**:

Same as tenant endpoints, plus:

| Status | Description | Example |
|--------|-------------|---------|
| `403` | Not SystemAdmin | `{"message": "Forbidden. SystemAdmin role required"}` |

---

### 6. Get SMS Daily Trends (Admin)

Get daily breakdown for all tenants or specific tenant.

**Endpoint**: `GET /admin/communication/sms/analytics/trends`

**RBAC**: `SystemAdmin` only

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tenant_id` | `string` | ✅ Yes | - | Tenant UUID filter (required for now) |
| `start_date` | `string` | ❌ No | 30 days ago | Start date (ISO 8601: YYYY-MM-DD) |
| `end_date` | `string` | ❌ No | Today | End date (ISO 8601: YYYY-MM-DD) |

**Example Request**:

```http
GET /admin/communication/sms/analytics/trends?tenant_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890&start_date=2026-02-01
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

Same format as tenant trends endpoint.

**Notes**:
- Currently requires `tenant_id` parameter
- Cross-tenant trend aggregation not yet implemented

---

### 7. Get SMS Failure Breakdown (Admin)

Get failure breakdown for all tenants or specific tenant.

**Endpoint**: `GET /admin/communication/sms/analytics/failures`

**RBAC**: `SystemAdmin` only

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tenant_id` | `string` | ✅ Yes | - | Tenant UUID filter (required for now) |
| `start_date` | `string` | ❌ No | 30 days ago | Start date (ISO 8601: YYYY-MM-DD) |
| `end_date` | `string` | ❌ No | Today | End date (ISO 8601: YYYY-MM-DD) |

**Example Request**:

```http
GET /admin/communication/sms/analytics/failures?tenant_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890&start_date=2026-01-01
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

Same format as tenant failure breakdown endpoint.

**Notes**:
- Currently requires `tenant_id` parameter
- Cross-tenant failure aggregation not yet implemented

---

### 8. Get Top SMS Recipients (Admin)

Get top recipients for all tenants or specific tenant.

**Endpoint**: `GET /admin/communication/sms/analytics/top-recipients`

**RBAC**: `SystemAdmin` only

**Query Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `tenant_id` | `string` | ✅ Yes | - | Tenant UUID filter (required for now) |
| `start_date` | `string` | ❌ No | 30 days ago | Start date (ISO 8601: YYYY-MM-DD) |
| `end_date` | `string` | ❌ No | Today | End date (ISO 8601: YYYY-MM-DD) |
| `limit` | `number` | ❌ No | 10 | Maximum recipients to return (1-100) |

**Example Request**:

```http
GET /admin/communication/sms/analytics/top-recipients?tenant_id=a1b2c3d4-e5f6-7890-abcd-ef1234567890&limit=10
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):

Same format as tenant top recipients endpoint.

**Notes**:
- Currently requires `tenant_id` parameter
- Cross-tenant recipient aggregation not yet implemented

---

## Data Model

### Communication Event Status Values

| Status | Description |
|--------|-------------|
| `pending` | Message queued, not yet sent |
| `sent` | Message sent to provider |
| `delivered` | Message delivered to recipient |
| `failed` | Message delivery failed |
| `bounced` | Message bounced back |

### SMS Cost Calculation

Cost is extracted from `provider_metadata.price` field in the `communication_event` table. This is populated by Twilio webhook updates with actual cost per message.

Example `provider_metadata`:
```json
{
  "price": "0.0075",
  "price_unit": "USD",
  "errorCode": null,
  "errorMessage": null
}
```

---

## Testing Guide

### Test 1: Get Summary (Default Date Range)

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/sms/analytics/summary" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: Summary for last 30 days

---

### Test 2: Get Summary (Custom Date Range)

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/sms/analytics/summary?start_date=2026-01-01&end_date=2026-02-13" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: Summary for specified range

---

### Test 3: Get Trends

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/sms/analytics/trends?start_date=2026-02-01&end_date=2026-02-13" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: Daily breakdown array

---

### Test 4: Get Failure Breakdown

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/sms/analytics/failures?start_date=2026-01-01&end_date=2026-02-13" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: Array of error codes with counts

---

### Test 5: Get Top Recipients

```bash
curl -X GET "https://api.lead360.app/api/v1/communication/sms/analytics/top-recipients?limit=5" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected**: Top 5 recipients with lead data

---

### Test 6: Admin Cross-Tenant Summary

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/communication/sms/analytics/summary" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Expected**: Summary across all tenants (SystemAdmin only)

---

### Test 7: Multi-Tenant Isolation

1. Get JWT for Tenant A
2. Request summary
3. Verify only Tenant A's data returned
4. Get JWT for Tenant B
5. Request summary
6. Verify only Tenant B's data returned (different from Tenant A)

**Expected**: Complete data isolation between tenants

---

## Performance Considerations

### Optimizations

1. **Indexed Queries**: All queries use existing indexes on `tenant_id`, `channel`, and `created_at`
2. **Raw SQL for Trends**: Uses `$queryRaw` with aggregations for efficient date grouping
3. **Parallel Queries**: Summary endpoint runs 3 queries in parallel (`Promise.all`)
4. **Limited Results**: Top recipients endpoint enforces max limit of 100

### Expected Query Times

- Summary: < 200ms (p95)
- Trends: < 300ms (p95)
- Failures: < 150ms (p95)
- Top Recipients: < 400ms (p95) - includes lead enrichment

---

## Future Enhancements

**Phase 2** (Future Sprint):
- Admin cross-tenant aggregated trends (not requiring `tenant_id`)
- Admin cross-tenant failure breakdown
- Admin cross-tenant top recipients
- Cost breakdown by tenant (admin only)
- Delivery rate by phone carrier
- Geographic distribution of recipients
- Real-time dashboard updates (WebSocket)
- Export analytics to CSV/Excel
- Scheduled email reports
- Comparison with previous period

---

## Troubleshooting

### Issue: Empty summary (all zeros)

**Cause**: No SMS sent in date range, or wrong tenant

**Solution**:
1. Verify date range includes SMS activity
2. Check tenant_id in JWT matches tenant with SMS data
3. Query `communication_event` table directly:
   ```sql
   SELECT COUNT(*) FROM communication_event
   WHERE tenant_id = 'YOUR_TENANT_ID'
   AND channel = 'sms'
   AND created_at >= '2026-01-01';
   ```

---

### Issue: Cost is always 0

**Cause**: Provider metadata not populated with cost

**Solution**:
1. Verify Twilio webhooks are configured and working
2. Check `provider_metadata` field in `communication_event` table
3. Ensure webhook updates include cost information

---

### Issue: Top recipients missing leads

**Cause**: Phone number doesn't match `lead_phone` table

**Solution**:
1. Verify phone number format consistency (E.164)
2. Check if Lead has phone number in `lead_phone` table
3. Phone number might belong to non-Lead recipient

---

## Support

For issues or questions, contact:
- Backend Team: #backend-support
- Analytics Questions: #data-analytics
- Bug Reports: File GitHub issue with tag `analytics`

---

**END OF API DOCUMENTATION**
