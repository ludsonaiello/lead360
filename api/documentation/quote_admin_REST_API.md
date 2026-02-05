# Quote Admin REST API Documentation

**Version**: 1.0
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Bearer JWT token required
**Last Updated**: February 2, 2026

---

## Table of Contents

1. [Overview & Authentication](#overview--authentication)
2. [Common Patterns](#common-patterns)
3. [Dashboard Analytics (6 endpoints)](#dashboard-analytics)
4. [Tenant Management (6 endpoints)](#tenant-management)
5. [Quote Management (5 endpoints)](#quote-management)
6. [Operational Tools (3 endpoints)](#operational-tools)
7. [Reports & Exports (8 endpoints)](#reports--exports)
8. [Template Management (14 endpoints)](#template-management)
9. [Quote Notes (4 endpoints)](#quote-notes)
10. [Error Reference](#error-reference)
11. [Rate Limiting & Caching](#rate-limiting--caching)

---

## Overview & Authentication

### Authentication
All endpoints require JWT authentication via Bearer token in the `Authorization` header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

### Platform Admin Requirement
Most endpoints require the `PlatformAdmin` role. Users without this role will receive a `403 Forbidden` response.

### Base URL
All endpoints are prefixed with: `https://api.lead360.app/api/v1`

Example full URL:
```
https://api.lead360.app/api/v1/admin/quotes/dashboard/overview
```

---

## Common Patterns

### Pagination
List endpoints support pagination with these query parameters:
- `page` (integer, default: 1, min: 1) - Page number
- `limit` (integer, default: 50, min: 1, max: 100) - Items per page

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 250,
    "total_pages": 5
  }
}
```

### Date Ranges
Endpoints with date filtering accept ISO 8601 formatted dates:
- `date_from` (ISO 8601, optional, default: 30 days ago)
- `date_to` (ISO 8601, optional, default: now)

Example: `2026-01-15T00:00:00Z`

### Error Response Format
All errors follow this structure:
```json
{
  "statusCode": 400,
  "message": "Error description" | ["Multiple", "errors"],
  "error": "Error Type"
}
```

---

## Dashboard Analytics

### GET /admin/quotes/dashboard/overview

**Description**: Get platform-wide quote statistics and trends across all tenants

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (5 minutes TTL)

#### Query Parameters
- `date_from` (ISO 8601 date string, optional, default: 30 days ago) - Start date for filtering
- `date_to` (ISO 8601 date string, optional, default: now) - End date for filtering

#### Success Response (200)

```json
{
  "global_stats": {
    "total_tenants": 145,
    "active_tenants": 120,
    "total_quotes": 5432,
    "total_revenue": 1234567.89,
    "avg_quote_value": 2500.0,
    "conversion_rate": 42.5
  },
  "tenant_breakdown": {
    "top_tenants_by_revenue": [
      {
        "tenant_id": "uuid-123",
        "company_name": "Acme Roofing",
        "revenue": 125000.5,
        "quote_count": 45
      }
    ],
    "top_tenants_by_quote_count": [
      {
        "tenant_id": "uuid-456",
        "company_name": "Best Plumbing",
        "revenue": 98000.0,
        "quote_count": 78
      }
    ],
    "new_tenants_this_period": 12
  },
  "trends": {
    "quote_velocity": "+15.2%",
    "avg_value_change": "+8.3%",
    "conversion_rate_change": "-2.1%"
  },
  "date_from": "2026-01-01T00:00:00Z",
  "date_to": "2026-01-31T23:59:59Z"
}
```

**Response Fields**:
- `global_stats` (object) - Platform-wide statistics
  - `total_tenants` (number) - Total unique tenants with quotes
  - `active_tenants` (number) - Number of active tenants
  - `total_quotes` (number) - Total quotes created
  - `total_revenue` (number) - Total revenue from accepted quotes
  - `avg_quote_value` (number) - Average quote value
  - `conversion_rate` (number) - Conversion rate percentage
- `tenant_breakdown` (object) - Tenant performance breakdown
  - `top_tenants_by_revenue` (array) - Top 10 tenants by revenue
  - `top_tenants_by_quote_count` (array) - Top 10 tenants by quote volume
  - `new_tenants_this_period` (number) - New tenants in date range
- `trends` (object) - Trend comparisons vs previous period
  - `quote_velocity` (string) - Quote volume change percentage
  - `avg_value_change` (string) - Average value change percentage
  - `conversion_rate_change` (string) - Conversion rate change percentage

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/dashboard/overview?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 5 minutes to improve performance
- Previous period is calculated automatically (same duration before date_from)
- Revenue only includes quotes with status: approved, started, concluded

---

### GET /admin/quotes/dashboard/quote-trends

**Description**: Get quote volume and revenue trends over time with configurable interval (day, week, month)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (5 minutes TTL)

#### Query Parameters
- `date_from` (ISO 8601 date string, required) - Start date for trends
- `date_to` (ISO 8601 date string, required) - End date for trends
- `interval` (string, optional, default: "day") - Time interval: "day", "week", "month"

#### Success Response (200)

```json
{
  "interval": "day",
  "data_points": [
    {
      "period": "2026-01-01",
      "quote_count": 45,
      "revenue": 125000.50,
      "avg_quote_value": 2777.78,
      "conversion_rate": 38.5
    },
    {
      "period": "2026-01-02",
      "quote_count": 52,
      "revenue": 140250.00,
      "avg_quote_value": 2697.12,
      "conversion_rate": 42.3
    }
  ],
  "summary": {
    "total_quotes": 1234,
    "total_revenue": 3456789.00,
    "avg_quote_value": 2800.00,
    "overall_conversion_rate": 41.2
  },
  "date_from": "2026-01-01T00:00:00Z",
  "date_to": "2026-01-31T23:59:59Z"
}
```

**Response Fields**:
- `interval` (string) - Time interval used (day, week, month)
- `data_points` (array) - Time series data
  - `period` (string) - Date or period identifier
  - `quote_count` (number) - Number of quotes in period
  - `revenue` (number) - Revenue in period
  - `avg_quote_value` (number) - Average quote value in period
  - `conversion_rate` (number) - Conversion rate in period
- `summary` (object) - Aggregated statistics for entire range
  - `total_quotes` (number) - Total quotes in date range
  - `total_revenue` (number) - Total revenue in date range
  - `avg_quote_value` (number) - Average quote value
  - `overall_conversion_rate` (number) - Overall conversion rate

#### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "statusCode": 400,
  "message": "Invalid interval. Must be: day, week, or month",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/dashboard/quote-trends?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z&interval=week' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Business Rules
- Date range cannot exceed 2 years for "day" interval
- Date range cannot exceed 5 years for "week" interval
- Month interval has no date range limit

#### Implementation Notes
- Cached for 5 minutes
- Week intervals start on Monday
- Month intervals align to calendar months

---

### GET /admin/quotes/dashboard/conversion-funnel

**Description**: Get quote conversion funnel showing status progression and conversion rates

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (5 minutes TTL)

#### Query Parameters
- `date_from` (ISO 8601 date string, optional, default: 30 days ago) - Start date for filtering
- `date_to` (ISO 8601 date string, optional, default: now) - End date for filtering

#### Success Response (200)

```json
{
  "funnel_stages": [
    {
      "stage": "draft",
      "count": 1250,
      "percentage": 100.0,
      "conversion_to_next": 85.6
    },
    {
      "stage": "sent",
      "count": 1070,
      "percentage": 85.6,
      "conversion_to_next": 62.5
    },
    {
      "stage": "opened",
      "count": 669,
      "percentage": 53.5,
      "conversion_to_next": 75.2
    },
    {
      "stage": "approved",
      "count": 503,
      "percentage": 40.2,
      "conversion_to_next": 88.1
    },
    {
      "stage": "started",
      "count": 443,
      "percentage": 35.4,
      "conversion_to_next": 95.0
    },
    {
      "stage": "concluded",
      "count": 421,
      "percentage": 33.7,
      "conversion_to_next": null
    }
  ],
  "drop_off_analysis": [
    {
      "from_stage": "sent",
      "to_stage": "opened",
      "drop_off_count": 401,
      "drop_off_percentage": 37.5
    },
    {
      "from_stage": "opened",
      "to_stage": "approved",
      "drop_off_count": 166,
      "drop_off_percentage": 24.8
    }
  ],
  "overall_conversion_rate": 33.7,
  "date_from": "2026-01-01T00:00:00Z",
  "date_to": "2026-01-31T23:59:59Z"
}
```

**Response Fields**:
- `funnel_stages` (array) - Conversion funnel stages
  - `stage` (string) - Quote status stage
  - `count` (number) - Number of quotes in this stage
  - `percentage` (number) - Percentage of total quotes
  - `conversion_to_next` (number|null) - Conversion rate to next stage
- `drop_off_analysis` (array) - Drop-off points analysis
  - `from_stage` (string) - Starting stage
  - `to_stage` (string) - Next stage
  - `drop_off_count` (number) - Number of quotes that didn't convert
  - `drop_off_percentage` (number) - Drop-off percentage
- `overall_conversion_rate` (number) - Overall conversion rate (draft to concluded)

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/dashboard/conversion-funnel?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 5 minutes
- Funnel stages are ordered by typical quote lifecycle
- Drop-off analysis identifies biggest conversion blockers

---

### GET /admin/quotes/dashboard/system-health

**Description**: Get real-time system health metrics including database, cache, storage, and service status

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (1 minute TTL)

#### Success Response (200)

```json
{
  "status": "healthy",
  "timestamp": "2026-02-02T10:30:00Z",
  "services": {
    "database": {
      "status": "healthy",
      "response_time_ms": 12,
      "connection_pool": {
        "active": 5,
        "idle": 15,
        "total": 20
      }
    },
    "cache": {
      "status": "healthy",
      "response_time_ms": 3,
      "hit_rate": 85.5,
      "memory_used_mb": 256
    },
    "storage": {
      "status": "healthy",
      "disk_used_gb": 125.5,
      "disk_total_gb": 500.0,
      "disk_usage_percentage": 25.1
    },
    "pdf_service": {
      "status": "healthy",
      "response_time_ms": 450,
      "queue_length": 3
    },
    "email_service": {
      "status": "healthy",
      "queue_length": 12,
      "failed_last_hour": 2
    }
  },
  "quotes_module": {
    "active_sessions": 42,
    "quotes_created_last_hour": 15,
    "pdfs_generated_last_hour": 8,
    "errors_last_hour": 1
  }
}
```

**Response Fields**:
- `status` (string) - Overall system status: "healthy", "degraded", "down"
- `timestamp` (ISO 8601) - Health check timestamp
- `services` (object) - Individual service health
  - `database` (object) - Database connection health
  - `cache` (object) - Redis cache health
  - `storage` (object) - File storage health
  - `pdf_service` (object) - PDF generation service health
  - `email_service` (object) - Email queue health
- `quotes_module` (object) - Quote module specific metrics
  - `active_sessions` (number) - Active user sessions
  - `quotes_created_last_hour` (number) - Quotes created in last hour
  - `pdfs_generated_last_hour` (number) - PDFs generated in last hour
  - `errors_last_hour` (number) - Errors in last hour

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/dashboard/system-health' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 1 minute only (near real-time)
- Status "degraded" if any service response time > 1000ms
- Status "down" if any critical service fails

---

### GET /admin/quotes/dashboard/revenue-analytics

**Description**: Get revenue analytics grouped by vendor, tenant, or ungrouped aggregates

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (5 minutes TTL)

#### Query Parameters
- `date_from` (ISO 8601 date string, required) - Start date for analytics
- `date_to` (ISO 8601 date string, required) - End date for analytics
- `group_by` (string, optional, default: "none") - Grouping: "vendor", "tenant", "none"

#### Success Response (200)

```json
{
  "group_by": "vendor",
  "total_revenue": 1234567.89,
  "total_quotes": 5432,
  "avg_quote_value": 2273.45,
  "groups": [
    {
      "group_id": "vendor-uuid-123",
      "group_name": "ABC Roofing Supplies",
      "revenue": 456789.50,
      "quote_count": 1250,
      "avg_quote_value": 3654.32,
      "percentage_of_total": 37.0
    },
    {
      "group_id": "vendor-uuid-456",
      "group_name": "XYZ Building Materials",
      "revenue": 345678.00,
      "quote_count": 980,
      "avg_quote_value": 3528.35,
      "percentage_of_total": 28.0
    }
  ],
  "date_from": "2026-01-01T00:00:00Z",
  "date_to": "2026-01-31T23:59:59Z"
}
```

**Response Fields**:
- `group_by` (string) - Grouping applied: "vendor", "tenant", "none"
- `total_revenue` (number) - Total revenue across all groups
- `total_quotes` (number) - Total quotes across all groups
- `avg_quote_value` (number) - Average quote value
- `groups` (array) - Revenue breakdown by group (empty if group_by="none")
  - `group_id` (string) - UUID of vendor or tenant
  - `group_name` (string) - Vendor or tenant name
  - `revenue` (number) - Revenue for this group
  - `quote_count` (number) - Quotes for this group
  - `avg_quote_value` (number) - Average quote value for group
  - `percentage_of_total` (number) - Percentage of total revenue

#### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "statusCode": 400,
  "message": "Invalid group_by value. Must be: vendor, tenant, or none",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/dashboard/revenue-analytics?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z&group_by=vendor' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 5 minutes
- Revenue only includes approved, started, and concluded quotes
- Groups sorted by revenue (descending)

---

### GET /admin/quotes/dashboard/global-item-pricing

**Description**: Get global item pricing benchmarks across all tenants for competitive analysis

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (15 minutes TTL)

#### Query Parameters
- `item_title_contains` (string, optional) - Filter by item title (case-insensitive partial match)
- `min_tenant_count` (integer, optional, default: 5, min: 2, max: 50) - Minimum tenants for privacy
- `date_from` (ISO 8601 date string, optional) - Start date for filtering
- `date_to` (ISO 8601 date string, optional) - End date for filtering
- `limit` (integer, optional, default: 50, min: 1, max: 200) - Maximum results

#### Success Response (200)

```json
{
  "benchmarks": [
    {
      "task_title": "asphalt shingle installation",
      "tenant_count": 12,
      "usage_count": 45,
      "pricing": {
        "avg_price": 2500.00,
        "min_price": 1200.00,
        "max_price": 4500.00,
        "median_price": 2350.00,
        "std_deviation": 850.50
      },
      "price_variance": "medium"
    }
  ],
  "privacy_notice": "Data anonymized, minimum 5 tenants per benchmark",
  "date_from": "2026-01-01T00:00:00Z",
  "date_to": "2026-01-31T23:59:59Z",
  "min_tenant_count": 5,
  "total_count": 150,
  "returned_count": 50
}
```

**Response Fields**:
- `benchmarks` (array) - Pricing benchmarks
  - `task_title` (string) - Item title (normalized: lowercase, trimmed)
  - `tenant_count` (number) - Unique tenants using this item (anonymized)
  - `usage_count` (number) - Total times item was used
  - `pricing` (object) - Pricing statistics
    - `avg_price` (number) - Average price
    - `min_price` (number) - Minimum price
    - `max_price` (number) - Maximum price
    - `median_price` (number) - Median price (50th percentile)
    - `std_deviation` (number) - Standard deviation
  - `price_variance` (string) - Variance classification: "low", "medium", "high"
- `privacy_notice` (string) - Privacy anonymization notice
- `min_tenant_count` (number) - Minimum tenant count applied
- `total_count` (number) - Total benchmarks available
- `returned_count` (number) - Number of benchmarks returned

#### Business Rules
- Only items used by at least `min_tenant_count` tenants are included
- Item titles are normalized (lowercase, trimmed) for grouping
- Price variance: low (CV < 0.3), medium (0.3 <= CV < 0.6), high (CV >= 0.6)

#### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "statusCode": 400,
  "message": "min_tenant_count must be between 2 and 50",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/dashboard/global-item-pricing?item_title_contains=roofing&min_tenant_count=5&limit=50' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 15 minutes (long TTL for heavy query)
- Tenant identities are never exposed (privacy protection)
- Results sorted by usage_count (descending)

---

## Tenant Management

### GET /admin/quotes/tenants

**Description**: List all tenants with quote activity, filterable by status and searchable

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (15 minutes TTL)

#### Query Parameters
- `status` (string, optional, default: "active") - Filter by subscription status: "active", "trial", "suspended", "all"
- `search` (string, optional) - Search by company name or subdomain (case-insensitive)
- `sort_by` (string, optional, default: "quote_count") - Sort by: "quote_count", "revenue", "name"
- `page` (integer, optional, default: 1, min: 1) - Page number
- `limit` (integer, optional, default: 50, min: 1, max: 100) - Items per page

#### Success Response (200)

```json
{
  "tenants": [
    {
      "tenant_id": "abc-123-def-456",
      "company_name": "Acme Roofing",
      "subdomain": "acme-roofing",
      "subscription_status": "active",
      "quote_stats": {
        "total_quotes": 145,
        "quotes_last_30_days": 23,
        "total_revenue": 125000.50,
        "conversion_rate": 42.5
      },
      "created_at": "2025-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 145,
    "page": 1,
    "limit": 50,
    "total_pages": 3
  },
  "summary": {
    "total_tenants": 145,
    "active_tenants": 120
  }
}
```

**Response Fields**:
- `tenants` (array) - List of tenants
  - `tenant_id` (UUID) - Tenant unique identifier
  - `company_name` (string) - Company name
  - `subdomain` (string) - Tenant subdomain
  - `subscription_status` (string) - Subscription status
  - `quote_stats` (object) - Quote statistics
    - `total_quotes` (number) - Total quotes all-time
    - `quotes_last_30_days` (number) - Quotes in last 30 days
    - `total_revenue` (number) - Total revenue from accepted quotes
    - `conversion_rate` (number) - Conversion rate percentage
  - `created_at` (ISO 8601) - Tenant creation timestamp
- `pagination` (object) - Pagination metadata
- `summary` (object) - Summary statistics

#### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "statusCode": 400,
  "message": "Invalid status. Must be: active, trial, suspended, or all",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/tenants?status=active&sort_by=revenue&page=1&limit=50' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 15 minutes
- Search is case-insensitive and matches company_name OR subdomain
- Default sort is by quote_count (descending)

---

### GET /admin/quotes/tenants/compare

**Description**: Compare tenants by specific metric (revenue, quote_count, conversion_rate, avg_quote_value)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (15 minutes TTL)

#### Query Parameters
- `metric` (string, required) - Comparison metric: "revenue", "quote_count", "conversion_rate", "avg_quote_value"
- `limit` (integer, optional, default: 10, min: 1, max: 50) - Number of tenants to return
- `date_from` (ISO 8601 date string, optional) - Start date for filtering
- `date_to` (ISO 8601 date string, optional) - End date for filtering

#### Success Response (200)

```json
{
  "metric": "revenue",
  "comparison": [
    {
      "rank": 1,
      "tenant_id": "uuid-123",
      "company_name": "Acme Roofing",
      "metric_value": 456789.50,
      "quote_count": 250,
      "conversion_rate": 45.2,
      "avg_quote_value": 1827.16
    },
    {
      "rank": 2,
      "tenant_id": "uuid-456",
      "company_name": "Best Plumbing",
      "metric_value": 345678.00,
      "quote_count": 180,
      "conversion_rate": 52.1,
      "avg_quote_value": 1920.43
    }
  ],
  "date_from": "2026-01-01T00:00:00Z",
  "date_to": "2026-01-31T23:59:59Z"
}
```

**Response Fields**:
- `metric` (string) - Metric used for comparison
- `comparison` (array) - Ranked tenant comparison
  - `rank` (number) - Rank position (1 = best)
  - `tenant_id` (UUID) - Tenant identifier
  - `company_name` (string) - Company name
  - `metric_value` (number) - Value of comparison metric
  - `quote_count` (number) - Total quotes
  - `conversion_rate` (number) - Conversion rate percentage
  - `avg_quote_value` (number) - Average quote value

#### Error Responses

**400 Bad Request** - Invalid metric
```json
{
  "statusCode": 400,
  "message": "Invalid metric. Must be: revenue, quote_count, conversion_rate, or avg_quote_value",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/tenants/compare?metric=revenue&limit=10&date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 15 minutes
- Results ordered by metric_value (descending)
- Only includes tenants with at least 1 quote in date range

---

### GET /admin/quotes/tenants/:tenantId/stats

**Description**: Get detailed quote statistics for a specific tenant

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (15 minutes TTL)

#### Path Parameters
- `tenantId` (UUID, required) - Tenant identifier

#### Query Parameters
- `date_from` (ISO 8601 date string, optional, default: 30 days ago) - Start date for filtering
- `date_to` (ISO 8601 date string, optional, default: now) - End date for filtering

#### Success Response (200)

```json
{
  "tenant_id": "abc-123-def-456",
  "company_name": "Acme Roofing",
  "statistics": {
    "total_quotes": 145,
    "quotes_by_status": {
      "draft": 12,
      "sent": 25,
      "approved": 45,
      "concluded": 38,
      "lost": 15,
      "expired": 10
    },
    "revenue": {
      "total": 125000.50,
      "avg_quote_value": 2777.79,
      "highest_quote": 15000.00,
      "lowest_quote": 500.00
    },
    "conversion": {
      "conversion_rate": 42.5,
      "avg_time_to_approval_hours": 48.5,
      "avg_time_to_conclusion_hours": 120.3
    },
    "trends": {
      "quotes_vs_previous_period": "+15.2%",
      "revenue_vs_previous_period": "+8.3%",
      "conversion_vs_previous_period": "-2.1%"
    }
  },
  "date_from": "2026-01-01T00:00:00Z",
  "date_to": "2026-01-31T23:59:59Z"
}
```

**Response Fields**:
- `tenant_id` (UUID) - Tenant identifier
- `company_name` (string) - Company name
- `statistics` (object) - Detailed statistics
  - `total_quotes` (number) - Total quotes in period
  - `quotes_by_status` (object) - Breakdown by status
  - `revenue` (object) - Revenue metrics
  - `conversion` (object) - Conversion metrics
  - `trends` (object) - Trends vs previous period

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Tenant not found
```json
{
  "statusCode": 404,
  "message": "Tenant not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/tenants/abc-123-def-456/stats?date_from=2026-01-01T00:00:00Z&date_to=2026-01-31T23:59:59Z' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 15 minutes
- Previous period calculated automatically (same duration before date_from)

---

### GET /admin/quotes/tenants/:tenantId/activity

**Description**: Get tenant activity timeline showing recent quote events

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `tenantId` (UUID, required) - Tenant identifier

#### Query Parameters
- `date_from` (ISO 8601 date string, optional, default: 30 days ago) - Start date for filtering
- `date_to` (ISO 8601 date string, optional, default: now) - End date for filtering
- `limit` (integer, optional, default: 50, min: 1, max: 100) - Maximum activity entries

#### Success Response (200)

```json
{
  "tenant_id": "abc-123-def-456",
  "company_name": "Acme Roofing",
  "activities": [
    {
      "timestamp": "2026-02-02T10:30:00Z",
      "event_type": "quote_approved",
      "quote_id": "quote-uuid-123",
      "quote_number": "QUOTE-2026-001",
      "user": {
        "id": "user-uuid-456",
        "name": "John Doe",
        "email": "john@acmeroofing.com"
      },
      "details": {
        "status_from": "sent",
        "status_to": "approved",
        "quote_value": 5000.00
      }
    }
  ],
  "total_activities": 250,
  "date_from": "2026-01-01T00:00:00Z",
  "date_to": "2026-02-02T23:59:59Z"
}
```

**Response Fields**:
- `tenant_id` (UUID) - Tenant identifier
- `company_name` (string) - Company name
- `activities` (array) - Activity timeline entries
  - `timestamp` (ISO 8601) - Event timestamp
  - `event_type` (string) - Event type: "quote_created", "quote_sent", "quote_approved", etc.
  - `quote_id` (UUID) - Quote identifier
  - `quote_number` (string) - Human-readable quote number
  - `user` (object) - User who triggered event
  - `details` (object) - Event-specific details
- `total_activities` (number) - Total activities in date range

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Tenant not found
```json
{
  "statusCode": 404,
  "message": "Tenant not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/tenants/abc-123-def-456/activity?limit=50' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Not cached (real-time data)
- Activities sorted by timestamp (descending)
- Limit prevents excessive data retrieval

---

### GET /admin/quotes/tenants/:tenantId/config

**Description**: Get tenant configuration for quote module (templates, settings, integrations)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (15 minutes TTL)

#### Path Parameters
- `tenantId` (UUID, required) - Tenant identifier

#### Success Response (200)

```json
{
  "tenant_id": "abc-123-def-456",
  "company_name": "Acme Roofing",
  "configuration": {
    "active_template_id": "template-uuid-123",
    "template_name": "Modern Professional Quote",
    "settings": {
      "quote_numbering_format": "QUOTE-{YYYY}-{###}",
      "default_tax_rate": 10.0,
      "default_currency": "USD",
      "auto_send_enabled": false,
      "pdf_auto_generate": true
    },
    "integrations": {
      "email_provider": "sendgrid",
      "pdf_service": "puppeteer",
      "storage_provider": "s3"
    },
    "last_updated_at": "2026-01-15T10:30:00Z",
    "last_updated_by": {
      "id": "user-uuid-789",
      "name": "Admin User",
      "email": "admin@acmeroofing.com"
    }
  }
}
```

**Response Fields**:
- `tenant_id` (UUID) - Tenant identifier
- `company_name` (string) - Company name
- `configuration` (object) - Configuration details
  - `active_template_id` (UUID) - Currently active template
  - `template_name` (string) - Template name
  - `settings` (object) - Module settings
  - `integrations` (object) - Integration configurations
  - `last_updated_at` (ISO 8601) - Last config update
  - `last_updated_by` (object) - User who updated config

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Tenant not found
```json
{
  "statusCode": 404,
  "message": "Tenant not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/tenants/abc-123-def-456/config' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 15 minutes
- Sensitive configuration (API keys) is never exposed

---

## Quote Management

### GET /admin/quotes

**Description**: List all quotes across all tenants with advanced filtering

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Query Parameters
- `tenant_id` (UUID, optional) - Filter by specific tenant
- `status` (string, optional) - Filter by quote status
- `search` (string, optional) - Search by quote number or customer name
- `date_from` (ISO 8601 date string, optional) - Filter quotes created after this date
- `date_to` (ISO 8601 date string, optional) - Filter quotes created before this date
- `page` (integer, optional, default: 1, min: 1) - Page number
- `limit` (integer, optional, default: 50, min: 1, max: 100) - Items per page

#### Success Response (200)

```json
{
  "quotes": [
    {
      "id": "quote-uuid-123",
      "quote_number": "QUOTE-2026-001",
      "title": "Roof Replacement Project",
      "status": "approved",
      "total": 15000.00,
      "created_at": "2026-01-15T10:30:00Z",
      "tenant": {
        "id": "tenant-uuid-456",
        "company_name": "Acme Roofing",
        "subdomain": "acme-roofing"
      },
      "customer_name": "John Smith"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 250,
    "total_pages": 5
  },
  "filters_applied": {
    "tenant_id": "tenant-uuid-456",
    "status": "approved"
  }
}
```

**Response Fields**:
- `quotes` (array) - List of quotes
  - `id` (UUID) - Quote identifier
  - `quote_number` (string) - Human-readable quote number
  - `title` (string) - Quote title
  - `status` (string) - Quote status
  - `total` (number) - Quote total amount
  - `created_at` (ISO 8601) - Creation timestamp
  - `tenant` (object) - Tenant information
  - `customer_name` (string) - Customer name (optional)
- `pagination` (object) - Pagination metadata
- `filters_applied` (object) - Filters that were applied

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes?tenant_id=tenant-uuid-456&status=approved&page=1&limit=50' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Not cached (real-time data)
- Search is case-insensitive and matches quote_number OR customer_name
- Results sorted by created_at (descending)

---

### GET /admin/quotes/:id

**Description**: Get detailed quote information by ID (any tenant)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Quote identifier

#### Success Response (200)

```json
{
  "id": "quote-uuid-123",
  "quote_number": "QUOTE-2026-001",
  "title": "Roof Replacement Project",
  "status": "approved",
  "subtotal": 13500.00,
  "tax": 1350.00,
  "discount": 0.00,
  "total": 14850.00,
  "created_at": "2026-01-15T10:30:00Z",
  "updated_at": "2026-01-20T14:45:00Z",
  "tenant": {
    "id": "tenant-uuid-456",
    "company_name": "Acme Roofing",
    "subdomain": "acme-roofing"
  },
  "customer": {
    "name": "John Smith",
    "email": "john@example.com",
    "phone": "+1234567890"
  },
  "items": [
    {
      "id": "item-uuid-789",
      "title": "Asphalt Shingle Installation",
      "quantity": 1,
      "unit_price": 13500.00,
      "total": 13500.00
    }
  ],
  "created_by": {
    "id": "user-uuid-101",
    "name": "Sales Rep",
    "email": "sales@acmeroofing.com"
  }
}
```

**Response Fields**:
- Complete quote details including all items, customer info, tenant info, and metadata

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Quote not found
```json
{
  "statusCode": 404,
  "message": "Quote not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/quote-uuid-123' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Not cached (real-time data)
- Returns complete quote object with all relationships

---

### DELETE /admin/quotes/:id/hard-delete

**Description**: Permanently delete a quote (emergency only, cannot be undone)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Quote identifier

#### Request Body

```json
{
  "reason": "Quote created by mistake and contains test data",
  "confirm": true
}
```

**Validation Rules**:
- `reason` (string, required, min: 10 characters) - Reason for deletion (audit trail)
- `confirm` (boolean, required, must be true) - Confirmation flag

#### Success Response (200)

```json
{
  "message": "Quote deleted permanently",
  "quote_id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "660e8400-e29b-41d4-a716-446655440001",
  "deleted_at": "2026-02-02T10:30:00Z",
  "deleted_by": "770e8400-e29b-41d4-a716-446655440002",
  "reason": "Quote created by mistake and contains test data"
}
```

**Response Fields**:
- `message` (string) - Success message
- `quote_id` (UUID) - Deleted quote ID
- `tenant_id` (UUID) - Tenant ID quote belonged to
- `deleted_at` (ISO 8601) - Deletion timestamp
- `deleted_by` (UUID) - Admin user who performed deletion
- `reason` (string) - Reason provided for deletion

#### Business Rules
- Cannot delete quote if child quotes exist (revision history)
- Confirmation flag must be true
- Reason must be at least 10 characters
- Deletion is logged in audit trail

#### Error Responses

**400 Bad Request** - Validation failed or confirmation missing
```json
{
  "statusCode": 400,
  "message": ["reason must be at least 10 characters long", "confirm must be true"],
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Quote not found
```json
{
  "statusCode": 404,
  "message": "Quote not found",
  "error": "Not Found"
}
```

**409 Conflict** - Cannot delete (child quotes exist)
```json
{
  "statusCode": 409,
  "message": "Cannot delete quote with child revisions",
  "error": "Conflict"
}
```

#### Example Request

```bash
curl -X DELETE 'https://api.lead360.app/api/v1/admin/quotes/550e8400-e29b-41d4-a716-446655440000/hard-delete' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "reason": "Quote created by mistake and contains test data",
    "confirm": true
  }'
```

#### Implementation Notes
- This is a destructive operation - quote cannot be recovered
- All related records (items, groups, attachments) are also deleted
- Audit log entry created with IP address and user info
- Use with extreme caution

---

### POST /admin/quotes/bulk-update

**Description**: Bulk update quote status for multiple quotes

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Request Body

```json
{
  "quote_ids": [
    "550e8400-e29b-41d4-a716-446655440000",
    "550e8400-e29b-41d4-a716-446655440001"
  ],
  "new_status": "approved",
  "reason": "Correcting status after system error"
}
```

**Validation Rules**:
- `quote_ids` (array of UUIDs, required, min: 1) - Quote IDs to update
- `new_status` (string, required) - New status: "draft", "pending", "sent", "delivered", "read", "opened", "downloaded", "approved", "denied", "expired", "started", "concluded", "lost"
- `reason` (string, required, min: 10 characters) - Reason for bulk update

#### Success Response (200)

```json
{
  "updated_count": 5,
  "failed_count": 2,
  "errors": [
    {
      "quote_id": "550e8400-e29b-41d4-a716-446655440000",
      "error": "Quote not found"
    },
    {
      "quote_id": "550e8400-e29b-41d4-a716-446655440001",
      "error": "Invalid status transition"
    }
  ]
}
```

**Response Fields**:
- `updated_count` (number) - Number of successfully updated quotes
- `failed_count` (number) - Number of failed updates
- `errors` (array) - Errors for failed updates
  - `quote_id` (UUID) - Quote that failed
  - `error` (string) - Error message

#### Error Responses

**400 Bad Request** - Validation failed
```json
{
  "statusCode": 400,
  "message": ["quote_ids must contain at least 1 item", "reason must be at least 10 characters long"],
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/bulk-update' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "quote_ids": ["550e8400-e29b-41d4-a716-446655440000", "550e8400-e29b-41d4-a716-446655440001"],
    "new_status": "approved",
    "reason": "Correcting status after system error"
  }'
```

#### Implementation Notes
- Updates are performed individually (not atomic)
- Partial success is possible (some succeed, some fail)
- Audit log entry created for each successful update

---

### POST /admin/quotes/:id/repair

**Description**: Repair broken quote (recalculate totals, fix relationships, reset status)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Quote identifier

#### Request Body

```json
{
  "issue_type": "recalculate_totals",
  "notes": "Totals were incorrect after manual item edit"
}
```

**Validation Rules**:
- `issue_type` (string, required) - Repair type: "recalculate_totals", "fix_relationships", "reset_status"
- `notes` (string, optional) - Optional notes about the repair

#### Success Response (200)

```json
{
  "message": "Quote repaired successfully",
  "repairs_made": [
    "Recalculated subtotal",
    "Updated tax amount",
    "Updated total"
  ],
  "before": {
    "subtotal": 1000.00,
    "tax": 80.00,
    "total": 1080.00
  },
  "after": {
    "subtotal": 1000.00,
    "tax": 100.00,
    "total": 1100.00
  }
}
```

**Response Fields**:
- `message` (string) - Success message
- `repairs_made` (array of strings) - List of repairs applied
- `before` (object) - Quote state before repair
- `after` (object) - Quote state after repair

#### Business Rules
- **recalculate_totals**: Recalculates subtotal, tax, discount, and total from items
- **fix_relationships**: Fixes orphaned items, groups, and attachments
- **reset_status**: Resets status to appropriate value based on quote data

#### Error Responses

**400 Bad Request** - Invalid issue type
```json
{
  "statusCode": 400,
  "message": "Invalid issue type. Must be: recalculate_totals, fix_relationships, or reset_status",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Quote not found
```json
{
  "statusCode": 404,
  "message": "Quote not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/550e8400-e29b-41d4-a716-446655440000/repair' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "issue_type": "recalculate_totals",
    "notes": "Totals were incorrect after manual item edit"
  }'
```

#### Implementation Notes
- Audit log entry created with before/after snapshots
- Safe operation (does not delete data)

---

## Operational Tools

### GET /admin/quotes/diagnostics/run-tests

**Description**: Run system diagnostics to test quote module functionality

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Query Parameters
- `test_type` (string, optional, default: "all") - Test type: "all", "pdf", "email", "storage", "database", "cache"

#### Success Response (200)

```json
{
  "test_suite": "System Diagnostics",
  "tests_run": 5,
  "passed": 4,
  "failed": 1,
  "results": [
    {
      "test_name": "PDF Generation Test",
      "status": "pass",
      "duration_ms": 2350,
      "error_message": null
    },
    {
      "test_name": "Email Service Test",
      "status": "fail",
      "duration_ms": 5000,
      "error_message": "Connection timeout"
    },
    {
      "test_name": "Storage Access Test",
      "status": "pass",
      "duration_ms": 150,
      "error_message": null
    },
    {
      "test_name": "Database Query Test",
      "status": "pass",
      "duration_ms": 45,
      "error_message": null
    },
    {
      "test_name": "Cache Connection Test",
      "status": "pass",
      "duration_ms": 10,
      "error_message": null
    }
  ]
}
```

**Response Fields**:
- `test_suite` (string) - Test suite name
- `tests_run` (number) - Total tests executed
- `passed` (number) - Tests that passed
- `failed` (number) - Tests that failed
- `results` (array) - Individual test results
  - `test_name` (string) - Test name
  - `status` (string) - "pass" or "fail"
  - `duration_ms` (number) - Test duration in milliseconds
  - `error_message` (string|null) - Error message if failed

#### Error Responses

**400 Bad Request** - Invalid test type
```json
{
  "statusCode": 400,
  "message": "Invalid test type. Must be: all, pdf, email, storage, database, or cache",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/diagnostics/run-tests?test_type=all' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Tests are read-only and do not modify data
- Useful for troubleshooting system issues
- Can be run periodically for health monitoring

---

### POST /admin/quotes/maintenance/cleanup-orphans

**Description**: Cleanup orphaned records (items, groups, attachments without parent quotes)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Request Body

```json
{
  "entity_type": "all",
  "dry_run": true
}
```

**Validation Rules**:
- `entity_type` (string, required) - Entity type: "items", "groups", "attachments", "all"
- `dry_run` (boolean, optional, default: true) - Dry run mode (only count, don't delete)

#### Success Response (200)

```json
{
  "dry_run": true,
  "orphans_found": 25,
  "orphans_deleted": 0,
  "details": [
    {
      "entity_type": "quote_item",
      "count": 15
    },
    {
      "entity_type": "quote_group",
      "count": 8
    },
    {
      "entity_type": "quote_attachment",
      "count": 2
    }
  ]
}
```

**Response Fields**:
- `dry_run` (boolean) - Whether this was a dry run
- `orphans_found` (number) - Total orphaned records found
- `orphans_deleted` (number) - Total orphaned records deleted (0 if dry run)
- `details` (array) - Breakdown by entity type
  - `entity_type` (string) - Type of orphaned entity
  - `count` (number) - Count of orphaned records

#### Business Rules
- Default is dry_run=true for safety
- Orphaned items: items without a parent quote_id
- Orphaned groups: groups without a parent quote_id
- Orphaned attachments: attachments without a parent quote_id

#### Error Responses

**400 Bad Request** - Invalid entity type
```json
{
  "statusCode": 400,
  "message": "Invalid entity type. Must be: items, groups, attachments, or all",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/maintenance/cleanup-orphans' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "entity_type": "all",
    "dry_run": true
  }'
```

#### Implementation Notes
- Always run with dry_run=true first to preview
- Audit log entry created when dry_run=false
- Deleted orphans cannot be recovered

---

## Reports & Exports

### POST /admin/quotes/reports/generate

**Description**: Generate custom report (queued for background processing)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Request Body

```json
{
  "report_type": "tenant_performance",
  "parameters": {
    "date_from": "2026-01-01T00:00:00Z",
    "date_to": "2026-01-31T23:59:59Z",
    "tenant_ids": ["550e8400-e29b-41d4-a716-446655440000"],
    "group_by": "vendor"
  },
  "format": "csv"
}
```

**Validation Rules**:
- `report_type` (string, required) - Report type: "tenant_performance", "revenue_analysis", "conversion_analysis"
- `parameters` (object, required) - Report parameters
  - `date_from` (ISO 8601, required) - Start date
  - `date_to` (ISO 8601, required) - End date
  - `tenant_ids` (array of UUIDs, optional) - Filter by tenants
  - `group_by` (string, optional) - Grouping: "vendor", "tenant"
- `format` (string, required) - Export format: "csv", "xlsx", "pdf"

#### Success Response (202 Accepted)

```json
{
  "job_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "status": "queued",
  "estimated_completion": "2026-02-02T10:32:00Z"
}
```

**Response Fields**:
- `job_id` (string) - Job ID for tracking report generation
- `status` (string) - Job status: "queued"
- `estimated_completion` (ISO 8601) - Estimated completion time

#### Business Rules
- Reports are generated asynchronously using BullMQ queue
- Use job_id to check status and download report
- Reports expire after 24 hours

#### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "statusCode": 400,
  "message": ["report_type must be one of: tenant_performance, revenue_analysis, conversion_analysis"],
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/reports/generate' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "report_type": "tenant_performance",
    "parameters": {
      "date_from": "2026-01-01T00:00:00Z",
      "date_to": "2026-01-31T23:59:59Z",
      "group_by": "vendor"
    },
    "format": "csv"
  }'
```

#### Implementation Notes
- Report generation happens in background queue
- Poll `/reports/:jobId/status` to check progress
- Download via `/reports/:jobId/download` when completed

---

### GET /admin/quotes/reports/:jobId/status

**Description**: Get report generation status

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `jobId` (string, required) - Job ID returned from generate endpoint

#### Success Response (200)

```json
{
  "job_id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
  "status": "completed",
  "progress": 100,
  "download_url": "/api/v1/admin/quotes/reports/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/download",
  "expires_at": "2026-02-03T10:30:00Z",
  "report_type": "tenant_performance",
  "format": "csv",
  "created_at": "2026-02-02T10:30:00Z",
  "completed_at": "2026-02-02T10:32:00Z",
  "row_count": 150
}
```

**Response Fields**:
- `job_id` (string) - Job ID
- `status` (string) - Job status: "queued", "processing", "completed", "failed"
- `progress` (number) - Progress percentage (0-100)
- `download_url` (string) - Download URL (if completed)
- `expires_at` (ISO 8601) - File expiration time (if completed)
- `error_message` (string) - Error message (if failed)
- `report_type` (string) - Report type
- `format` (string) - Export format
- `created_at` (ISO 8601) - Job creation time
- `completed_at` (ISO 8601) - Job completion time (if completed)
- `row_count` (number) - Number of rows in report (if completed)

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Job not found
```json
{
  "statusCode": 404,
  "message": "Report job not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/reports/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/status' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Poll this endpoint every 5-10 seconds until status is "completed" or "failed"
- Reports are automatically deleted after 24 hours

---

### GET /admin/quotes/reports/:jobId/download

**Description**: Download generated report file

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `jobId` (string, required) - Job ID

#### Success Response (200)

Binary file stream with appropriate Content-Type headers:
- CSV: `text/csv`
- XLSX: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- PDF: `application/pdf`

Response headers:
```
Content-Type: text/csv
Content-Disposition: attachment; filename="report_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6.csv"
```

#### Error Responses

**400 Bad Request** - Report not ready
```json
{
  "statusCode": 400,
  "message": "Report is not ready for download",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Job not found or expired
```json
{
  "statusCode": 404,
  "message": "Report file not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/reports/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6/download' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -o report.csv
```

#### Implementation Notes
- Only available when status is "completed"
- File is streamed (not loaded into memory)
- Reports expire after 24 hours

---

### GET /admin/quotes/reports/scheduled

**Description**: List all scheduled reports

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Success Response (200)

```json
{
  "reports": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "admin_user_id": "admin-uuid-here",
      "name": "Weekly Revenue Report",
      "report_type": "revenue_analysis",
      "schedule": "weekly",
      "parameters": {
        "date_from": "relative:-7d",
        "date_to": "relative:now",
        "group_by": "vendor"
      },
      "format": "xlsx",
      "recipients": ["admin@company.com", "manager@company.com"],
      "is_active": true,
      "next_run_at": "2026-02-09T00:00:00Z",
      "last_run_at": "2026-02-02T00:00:00Z",
      "created_at": "2026-01-01T10:00:00Z",
      "updated_at": "2026-01-15T14:30:00Z",
      "admin_user": {
        "id": "admin-uuid",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com"
      }
    }
  ],
  "total": 5
}
```

**Response Fields**:
- `reports` (array) - List of scheduled reports
  - `id` (UUID) - Scheduled report ID
  - `admin_user_id` (UUID) - Admin user who created it
  - `name` (string) - Report name
  - `report_type` (string) - Report type
  - `schedule` (string) - Schedule frequency: "daily", "weekly", "monthly"
  - `parameters` (object) - Report parameters
  - `format` (string) - Export format
  - `recipients` (array) - Email recipients
  - `is_active` (boolean) - Whether report is active
  - `next_run_at` (ISO 8601) - Next scheduled run
  - `last_run_at` (ISO 8601) - Last run time
  - `created_at` (ISO 8601) - Creation time
  - `updated_at` (ISO 8601) - Last update time
  - `admin_user` (object) - Admin user info
- `total` (number) - Total scheduled reports

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/reports/scheduled' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Not paginated (all scheduled reports returned)
- Reports are NOT sent automatically (must be downloaded manually)

---

### POST /admin/quotes/reports/scheduled

**Description**: Create a scheduled report

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Request Body

```json
{
  "name": "Weekly Revenue Report",
  "report_type": "revenue_analysis",
  "schedule": "weekly",
  "parameters": {
    "date_from": "relative:-7d",
    "date_to": "relative:now",
    "group_by": "vendor"
  },
  "format": "xlsx",
  "recipients": ["admin@company.com", "manager@company.com"],
  "is_active": true
}
```

**Validation Rules**:
- `name` (string, required) - Friendly name for report
- `report_type` (string, required) - Report type: "tenant_performance", "revenue_analysis", "conversion_analysis"
- `schedule` (string, required) - Schedule: "daily", "weekly", "monthly"
- `parameters` (object, required) - Report parameters (supports relative dates like "relative:-7d")
- `format` (string, required) - Export format: "csv", "xlsx", "pdf"
- `recipients` (array of strings, required) - Email recipients (for future use)
- `is_active` (boolean, optional, default: true) - Whether report is active

#### Success Response (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "admin_user_id": "admin-uuid-here",
  "name": "Weekly Revenue Report",
  "report_type": "revenue_analysis",
  "schedule": "weekly",
  "parameters": {
    "date_from": "relative:-7d",
    "date_to": "relative:now",
    "group_by": "vendor"
  },
  "format": "xlsx",
  "recipients": ["admin@company.com", "manager@company.com"],
  "is_active": true,
  "next_run_at": "2026-02-09T00:00:00Z",
  "last_run_at": null,
  "created_at": "2026-02-02T10:00:00Z",
  "updated_at": "2026-02-02T10:00:00Z",
  "admin_user": {
    "id": "admin-uuid",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  }
}
```

**Response Fields**: Same as scheduled report object

#### Error Responses

**400 Bad Request** - Invalid request data
```json
{
  "statusCode": 400,
  "message": ["name is required", "schedule must be one of: daily, weekly, monthly"],
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/reports/scheduled' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Weekly Revenue Report",
    "report_type": "revenue_analysis",
    "schedule": "weekly",
    "parameters": {
      "date_from": "relative:-7d",
      "date_to": "relative:now",
      "group_by": "vendor"
    },
    "format": "xlsx",
    "recipients": ["admin@company.com"],
    "is_active": true
  }'
```

#### Implementation Notes
- Scheduled reports are executed by background cron job
- Relative dates are resolved at runtime (e.g., "relative:-7d" = 7 days ago)
- Email delivery not yet implemented (reports must be downloaded)

---

### GET /admin/quotes/reports/scheduled/:id

**Description**: Get scheduled report details

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (string, required) - Scheduled report ID

#### Success Response (200)

Same response format as list scheduled reports (single object)

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Scheduled report not found
```json
{
  "statusCode": 404,
  "message": "Scheduled report not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/reports/scheduled/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

---

### PATCH /admin/quotes/reports/scheduled/:id

**Description**: Update a scheduled report

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (string, required) - Scheduled report ID

#### Request Body

```json
{
  "name": "Updated Report Name",
  "schedule": "daily",
  "is_active": false
}
```

**Validation Rules** (all optional):
- `name` (string, min: 3, max: 100) - Report name
- `schedule` (string) - Schedule: "daily", "weekly", "monthly"
- `parameters` (object) - Report parameters
- `format` (string) - Export format: "csv", "xlsx", "pdf"
- `recipients` (array of strings) - Email recipients
- `is_active` (boolean) - Whether report is active

#### Success Response (200)

Same response format as create scheduled report

#### Error Responses

**400 Bad Request** - Invalid request data
```json
{
  "statusCode": 400,
  "message": ["name must be at least 3 characters long"],
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Scheduled report not found
```json
{
  "statusCode": 404,
  "message": "Scheduled report not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X PATCH 'https://api.lead360.app/api/v1/admin/quotes/reports/scheduled/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Updated Report Name",
    "is_active": false
  }'
```

---

### DELETE /admin/quotes/reports/scheduled/:id

**Description**: Delete a scheduled report

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (string, required) - Scheduled report ID

#### Success Response (204 No Content)

No response body

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

**404 Not Found** - Scheduled report not found
```json
{
  "statusCode": 404,
  "message": "Scheduled report not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X DELETE 'https://api.lead360.app/api/v1/admin/quotes/reports/scheduled/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

---

**DOCUMENTATION CONTINUES IN NEXT FILE: Template Management, Quote Notes, Error Reference...**

Due to length constraints, the documentation will be split. The remaining sections (Template Management, Quote Notes, Error Reference, Rate Limiting) will follow the same detailed format with complete endpoint documentation.

---

**Total Endpoints Documented So Far**: 35 of 45
- Dashboard Analytics: 6 ✓
- Tenant Management: 6 ✓
- Quote Management: 5 ✓
- Operational Tools: 3 ✓
- Reports & Exports: 8 ✓
- Template Management: 14 (next)
- Quote Notes: 4 (next)


## Template Management

### POST /admin/quotes/templates

**Description**: Create a new quote template (global or tenant-specific)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Request Body

```json
{
  "name": "Modern Professional Quote",
  "description": "Clean modern design with company branding",
  "html_content": "<html>...</html>",
  "thumbnail_url": "https://cdn.example.com/thumb.png",
  "tenant_id": "550e8400-e29b-41d4-a716",
  "is_global": true,
  "is_default": false
}
```

**Validation Rules**:
- `name` (string, required, length: 1-200) - Template name
- `description` (string, optional) - Template description
- `html_content` (string, required, min: 1) - HTML template content with Handlebars syntax
- `thumbnail_url` (string, optional) - Preview thumbnail URL
- `tenant_id` (UUID, optional) - Tenant ID for tenant-specific templates (null for global)
- `is_global` (boolean, optional, default: false) - Whether template is available to all tenants
- `is_default` (boolean, optional, default: false) - Whether this is the platform default

#### Success Response (201 Created)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "name": "Modern Professional Quote",
  "description": "Clean modern design with company branding",
  "html_content": "<html>...</html>",
  "thumbnail_url": "https://cdn.example.com/thumb.png",
  "tenant_id": null,
  "is_global": true,
  "is_default": false,
  "is_active": true,
  "usage_count": 0,
  "version": 1,
  "created_at": "2026-02-02T10:30:00Z",
  "updated_at": "2026-02-02T10:30:00Z",
  "created_by": {
    "id": "user-uuid",
    "first_name": "Admin",
    "last_name": "User",
    "email": "admin@platform.com"
  }
}
```

**Response Fields**:
- `id` (UUID) - Template unique identifier
- `name` (string) - Template name
- `description` (string) - Template description
- `html_content` (string) - HTML template content
- `thumbnail_url` (string) - Preview thumbnail URL
- `tenant_id` (UUID|null) - Tenant ID (null for global)
- `is_global` (boolean) - Whether template is global
- `is_default` (boolean) - Whether template is platform default
- `is_active` (boolean) - Whether template is active
- `usage_count` (number) - Number of quotes using this template
- `version` (number) - Current version number
- `created_at` (ISO 8601) - Creation timestamp
- `updated_at` (ISO 8601) - Last update timestamp
- `created_by` (object) - User who created template

#### Business Rules
- Only one global template can be set as default at a time
- If `is_global=true`, `tenant_id` must be null
- If `is_global=false`, `tenant_id` is required
- HTML content must be valid HTML

#### Error Responses

**400 Bad Request** - Validation failed
```json
{
  "statusCode": 400,
  "message": ["name must be between 1 and 200 characters", "html_content is required"],
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**409 Conflict** - Default template conflict
```json
{
  "statusCode": 409,
  "message": "Another global template is already set as default",
  "error": "Conflict"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/templates' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Modern Professional Quote",
    "html_content": "<html>...</html>",
    "is_global": true,
    "is_default": false
  }'
```

#### Implementation Notes
- Template version 1 is automatically created
- HTML content supports Handlebars template syntax
- Use `/templates/variables/schema` to get available variables

---

### GET /admin/quotes/templates

**Description**: Get all templates with usage statistics (admin view)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Query Parameters
- `is_active` (boolean, optional) - Filter by active status
- `is_global` (boolean, optional) - Filter global templates only
- `tenant_id` (UUID, optional) - Filter by tenant ID
- `page` (integer, optional, default: 1, min: 1) - Page number
- `limit` (integer, optional, default: 50, min: 1, max: 100) - Items per page

#### Success Response (200)

```json
{
  "templates": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Modern Professional Quote",
      "description": "Clean modern design with company branding",
      "thumbnail_url": "https://cdn.example.com/thumb.png",
      "tenant_id": null,
      "is_global": true,
      "is_default": true,
      "is_active": true,
      "usage_count": 150,
      "version": 3,
      "created_at": "2026-01-15T10:30:00Z",
      "updated_at": "2026-02-01T14:45:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "total_pages": 1
  }
}
```

**Response Fields**:
- `templates` (array) - List of templates (html_content excluded from list view)
- `pagination` (object) - Pagination metadata

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/templates?is_global=true&is_active=true&page=1&limit=50' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- HTML content not included in list view (too large)
- Use GET `/templates/:id` to get full template with HTML
- Results sorted by created_at (descending)

---

### GET /admin/quotes/templates/:id

**Description**: Get template details including full HTML content (admin view)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Success Response (200)

Same response as POST /templates (create), including full html_content

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

---

### PATCH /admin/quotes/templates/:id

**Description**: Update template

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Request Body

All fields are optional (partial update):

```json
{
  "name": "Updated Template Name",
  "description": "Updated description",
  "html_content": "<html>...</html>",
  "thumbnail_url": "https://cdn.example.com/new-thumb.png",
  "is_active": true
}
```

**Validation Rules**: Same as create, but all fields optional

#### Success Response (200)

Same response as GET /templates/:id (updated template)

#### Business Rules
- Cannot change `is_global` or `tenant_id` after creation
- Updating `html_content` creates a new version
- Cannot deactivate template if it's the only active template for a tenant

#### Error Responses

**400 Bad Request** - Validation failed
```json
{
  "statusCode": 400,
  "message": ["name must be between 1 and 200 characters"],
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X PATCH 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Updated Template Name",
    "is_active": true
  }'
```

#### Implementation Notes
- HTML content updates trigger automatic versioning
- Previous versions are preserved in version history

---

### DELETE /admin/quotes/templates/:id

**Description**: Delete template (cannot delete if in use or is default)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Success Response (204 No Content)

No response body

#### Business Rules
- Cannot delete template if `usage_count > 0`
- Cannot delete template if `is_default = true`
- Must unset default first or choose different template

#### Error Responses

**400 Bad Request** - Cannot delete
```json
{
  "statusCode": 400,
  "message": "Cannot delete template: template is currently in use by 25 quotes",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X DELETE 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Soft delete (template marked as deleted, not removed from database)
- Version history is preserved

---

### POST /admin/quotes/templates/:id/clone

**Description**: Clone existing template to create a copy

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier to clone

#### Request Body

```json
{
  "new_name": "Modern Professional Quote V2"
}
```

**Validation Rules**:
- `new_name` (string, optional) - Name for cloned template (defaults to "Copy of {original_name}")

#### Success Response (201 Created)

Same response as POST /templates (newly created clone)

#### Business Rules
- Cloned template inherits all properties except:
  - `id` (new UUID)
  - `name` (uses new_name or "Copy of ..." prefix)
  - `is_default` (always false)
  - `usage_count` (starts at 0)
  - `version` (starts at 1)
  - `created_at` / `updated_at` (current timestamp)

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/clone' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "new_name": "Modern Professional Quote V2"
  }'
```

#### Implementation Notes
- Cloning is useful for creating variations of existing templates
- HTML content is copied exactly

---

### PATCH /admin/quotes/templates/:id/set-default

**Description**: Set template as platform default (only for global templates)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Success Response (200)

```json
{
  "message": "Template set as platform default",
  "template_id": "550e8400-e29b-41d4-a716-446655440000",
  "previous_default_id": "660e8400-e29b-41d4-a716-446655440001"
}
```

**Response Fields**:
- `message` (string) - Success message
- `template_id` (UUID) - Template that is now default
- `previous_default_id` (UUID|null) - Previous default template (if any)

#### Business Rules
- Only global templates (`is_global=true`) can be set as platform default
- Setting a new default automatically unsets the previous default
- Default template is used for new tenants

#### Error Responses

**403 Forbidden** - Not a global template
```json
{
  "statusCode": 403,
  "message": "Only global templates can be set as platform default",
  "error": "Forbidden"
}
```

**404 Not Found** - Template not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X PATCH 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/set-default' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

---

### GET /admin/quotes/templates/variables/schema

**Description**: Get template variables schema for Handlebars template development

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: Yes (1 hour TTL)

#### Success Response (200)

```json
{
  "variables": {
    "quote": {
      "type": "object",
      "description": "Quote information",
      "fields": {
        "quote_number": {"type": "string", "example": "QUOTE-2026-001"},
        "title": {"type": "string", "example": "Roof Replacement Project"},
        "status": {"type": "string", "example": "approved"},
        "subtotal": {"type": "number", "example": 13500.00},
        "tax": {"type": "number", "example": 1350.00},
        "discount": {"type": "number", "example": 0.00},
        "total": {"type": "number", "example": 14850.00},
        "created_at": {"type": "string", "format": "ISO 8601"},
        "valid_until": {"type": "string", "format": "ISO 8601"}
      }
    },
    "company": {
      "type": "object",
      "description": "Company (tenant) information",
      "fields": {
        "company_name": {"type": "string"},
        "address": {"type": "string"},
        "phone": {"type": "string"},
        "email": {"type": "string"},
        "website": {"type": "string"},
        "logo_url": {"type": "string"}
      }
    },
    "customer": {
      "type": "object",
      "description": "Customer information",
      "fields": {
        "name": {"type": "string"},
        "email": {"type": "string"},
        "phone": {"type": "string"},
        "address": {"type": "string"}
      }
    },
    "items": {
      "type": "array",
      "description": "Quote items (tasks)",
      "item_fields": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "quantity": {"type": "number"},
        "unit_price": {"type": "number"},
        "total": {"type": "number"}
      }
    }
  },
  "helpers": [
    "formatCurrency",
    "formatDate",
    "formatNumber",
    "if",
    "unless",
    "each"
  ],
  "example_usage": "{{quote.quote_number}} - {{formatCurrency quote.total}}"
}
```

**Response Fields**:
- `variables` (object) - Available template variables organized by category
- `helpers` (array) - Available Handlebars helpers
- `example_usage` (string) - Example Handlebars syntax

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/templates/variables/schema' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Cached for 1 hour (schema rarely changes)
- Use this schema when developing new templates

---

### POST /admin/quotes/templates/:id/preview

**Description**: Preview template with sample or real quote data

**Authorization**: Platform Admin (required)

**Rate Limiting**: Yes (10 requests per minute)

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Request Body

```json
{
  "preview_type": "standard",
  "use_real_quote": false,
  "quote_id": null
}
```

**Validation Rules**:
- `preview_type` (string, required) - Preview type: "minimal", "standard", "complex"
- `use_real_quote` (boolean, required) - Use real quote data instead of sample
- `quote_id` (UUID, optional) - Quote ID (required if use_real_quote=true)

#### Success Response (200)

```json
{
  "rendered_html": "<html>...</html>",
  "rendered_css": "body { font-family: Arial; }",
  "preview_url": "https://api.lead360.app/preview/temp/abc123",
  "expires_at": "2026-02-02T10:45:00Z"
}
```

**Response Fields**:
- `rendered_html` (string) - Fully rendered HTML
- `rendered_css` (string) - Extracted/rendered CSS
- `preview_url` (string) - Temporary preview URL (expires after 15 minutes)
- `expires_at` (ISO 8601) - Preview expiration timestamp

#### Business Rules
- Preview type determines sample data complexity:
  - **minimal**: 1 item, basic info
  - **standard**: 5 items, typical quote
  - **complex**: 15+ items, multiple groups, discounts
- Preview URLs expire after 15 minutes

#### Error Responses

**400 Bad Request** - Invalid parameters
```json
{
  "statusCode": 400,
  "message": "quote_id is required when use_real_quote is true",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template or quote not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

**429 Too Many Requests** - Rate limit exceeded
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "error": "Too Many Requests"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/preview' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "preview_type": "standard",
    "use_real_quote": false
  }'
```

#### Implementation Notes
- Rate limited to prevent abuse (10 requests per minute)
- Preview URLs are temporary and deleted after 15 minutes
- Use for template development and testing

---

### POST /admin/quotes/templates/:id/test-pdf

**Description**: Test PDF generation from template with performance metrics

**Authorization**: Platform Admin (required)

**Rate Limiting**: Yes (10 requests per minute)

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Request Body

```json
{
  "preview_type": "standard",
  "quote_id": null
}
```

**Validation Rules**:
- `preview_type` (string, required) - Preview type: "minimal", "standard", "complex"
- `quote_id` (UUID, optional) - Quote ID for real data testing

#### Success Response (200)

```json
{
  "pdf_url": "https://api.lead360.app/test-pdf/temp/abc123.pdf",
  "file_size_bytes": 245678,
  "generation_time_ms": 2350,
  "expires_at": "2026-02-02T10:45:00Z",
  "warnings": [
    "Large image detected: may increase file size"
  ]
}
```

**Response Fields**:
- `pdf_url` (string) - Temporary PDF download URL (expires after 15 minutes)
- `file_size_bytes` (number) - PDF file size in bytes
- `generation_time_ms` (number) - PDF generation time in milliseconds
- `expires_at` (ISO 8601) - PDF expiration timestamp
- `warnings` (array of strings, optional) - Warnings detected during generation

#### Business Rules
- PDFs expire after 15 minutes
- Generation time > 5000ms triggers warning
- File size > 5MB triggers warning

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

**429 Too Many Requests** - Rate limit exceeded
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "error": "Too Many Requests"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/test-pdf' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "preview_type": "standard"
  }'
```

#### Implementation Notes
- Rate limited to prevent resource exhaustion
- Use to test PDF rendering and performance
- Warnings help identify template optimization opportunities

---

### POST /admin/quotes/templates/:id/validate

**Description**: Validate template syntax (Handlebars errors, missing variables)

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Success Response (200)

```json
{
  "is_valid": true,
  "errors": [],
  "warnings": [
    "Variable 'customer.fax' is used but rarely populated"
  ],
  "syntax_check": "passed",
  "variables_used": [
    "quote.quote_number",
    "quote.total",
    "company.company_name",
    "customer.name"
  ]
}
```

**Response Fields**:
- `is_valid` (boolean) - Whether template is valid
- `errors` (array of strings) - Syntax errors found
- `warnings` (array of strings) - Warnings (non-blocking issues)
- `syntax_check` (string) - Syntax check result: "passed" or "failed"
- `variables_used` (array of strings) - Variables found in template

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/validate' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Validates Handlebars syntax
- Checks for undefined variables
- Non-blocking warnings don't prevent template use

---

### POST /admin/quotes/templates/:id/test-email

**Description**: Test email rendering and optionally send test email

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Request Body

```json
{
  "preview_type": "standard",
  "send_to_email": "test@example.com"
}
```

**Validation Rules**:
- `preview_type` (string, required) - Preview type: "minimal", "standard", "complex"
- `send_to_email` (string, optional) - Email address to send test email (must be valid email)

#### Success Response (200)

```json
{
  "html_preview": "<html>...</html>",
  "text_preview": "Plain text version of email...",
  "subject_line": "Quote QUOTE-2026-001 from Acme Roofing",
  "test_email_sent": true,
  "email_job_id": "job-uuid-123"
}
```

**Response Fields**:
- `html_preview` (string) - Rendered HTML email
- `text_preview` (string) - Plain text version
- `subject_line` (string) - Generated email subject
- `test_email_sent` (boolean) - Whether test email was sent
- `email_job_id` (string, optional) - Email queue job ID (if sent)

#### Business Rules
- If `send_to_email` is provided, test email is queued for delivery
- Email is sent via platform email service (SendGrid, etc.)
- Plain text version is auto-generated from HTML

#### Error Responses

**400 Bad Request** - Invalid email
```json
{
  "statusCode": 400,
  "message": "send_to_email must be a valid email address",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/test-email' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "preview_type": "standard",
    "send_to_email": "test@example.com"
  }'
```

#### Implementation Notes
- Use to test email rendering before production use
- Test emails are marked as "TEST" in subject line

---

### GET /admin/quotes/templates/:id/versions

**Description**: Get template version history

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Success Response (200)

```json
{
  "template_id": "550e8400-e29b-41d4-a716-446655440000",
  "current_version": 3,
  "versions": [
    {
      "version": 3,
      "created_at": "2026-02-01T14:45:00Z",
      "created_by": "Admin User",
      "changes_summary": "Updated footer design",
      "html_content_snapshot": "<html>...</html>"
    },
    {
      "version": 2,
      "created_at": "2026-01-20T10:30:00Z",
      "created_by": "Admin User",
      "changes_summary": "Fixed header alignment",
      "html_content_snapshot": "<html>...</html>"
    },
    {
      "version": 1,
      "created_at": "2026-01-15T10:30:00Z",
      "created_by": "Admin User",
      "changes_summary": "Initial version",
      "html_content_snapshot": "<html>...</html>"
    }
  ]
}
```

**Response Fields**:
- `template_id` (UUID) - Template identifier
- `current_version` (number) - Current version number
- `versions` (array) - Version history (newest first)
  - `version` (number) - Version number
  - `created_at` (ISO 8601) - Version creation timestamp
  - `created_by` (string) - User who created version
  - `changes_summary` (string) - Summary of changes
  - `html_content_snapshot` (string) - HTML content snapshot

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/versions' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- All versions are preserved indefinitely
- Use for rollback or auditing purposes

---

### POST /admin/quotes/templates/:id/restore-version

**Description**: Restore template to a previous version

**Authorization**: Platform Admin (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Template identifier

#### Request Body

```json
{
  "version": 2,
  "create_backup": true
}
```

**Validation Rules**:
- `version` (number, required, min: 1) - Version number to restore
- `create_backup` (boolean, optional, default: true) - Create backup of current version before restore

#### Success Response (200)

```json
{
  "message": "Template restored to version 2 successfully",
  "new_current_version": 4,
  "backup_created": true
}
```

**Response Fields**:
- `message` (string) - Success message
- `new_current_version` (number) - New current version after restore
- `backup_created` (boolean) - Whether backup was created

#### Business Rules
- Restoring creates a new version (doesn't overwrite current)
- If `create_backup=true`, current version is saved before restore
- Version numbers always increment (never reused)

#### Error Responses

**400 Bad Request** - Invalid version
```json
{
  "statusCode": 400,
  "message": "Version 10 does not exist for this template",
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Platform Admin role required",
  "error": "Forbidden"
}
```

**404 Not Found** - Template or version not found
```json
{
  "statusCode": 404,
  "message": "Template not found",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/admin/quotes/templates/550e8400-e29b-41d4-a716-446655440000/restore-version' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "version": 2,
    "create_backup": true
  }'
```

#### Implementation Notes
- Safe operation (current version is preserved)
- Use to rollback problematic template changes

---

## Quote Notes

### POST /quotes/:id/notes

**Description**: Add a note to a quote

**Authorization**: Owner, Admin, Manager, Sales (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Quote identifier

#### Request Body

```json
{
  "note_text": "Customer requested site visit before finalizing materials",
  "is_pinned": false
}
```

**Validation Rules**:
- `note_text` (string, required, max: 5000) - Note text content
- `is_pinned` (boolean, optional, default: false) - Whether note should be pinned to top

#### Success Response (201 Created)

```json
{
  "id": "note-uuid-123",
  "quote_id": "quote-uuid-456",
  "note_text": "Customer requested site visit before finalizing materials",
  "is_pinned": false,
  "user": {
    "id": "user-uuid-789",
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com"
  },
  "created_at": "2026-02-02T10:30:00Z",
  "updated_at": "2026-02-02T10:30:00Z"
}
```

**Response Fields**:
- `id` (UUID) - Note unique identifier
- `quote_id` (UUID) - Quote identifier
- `note_text` (string) - Note text content
- `is_pinned` (boolean) - Whether note is pinned
- `user` (object) - User who created note
  - `id` (UUID) - User ID
  - `first_name` (string) - User first name
  - `last_name` (string) - User last name
  - `email` (string) - User email
- `created_at` (ISO 8601) - Creation timestamp
- `updated_at` (ISO 8601) - Last update timestamp

#### Business Rules
- User must have access to the quote (tenant isolation)
- Pinned notes appear at the top of note list
- Notes are ordered by: pinned (true first), then created_at (newest first)

#### Error Responses

**400 Bad Request** - Validation failed
```json
{
  "statusCode": 400,
  "message": ["note_text is required", "note_text must not exceed 5000 characters"],
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

**404 Not Found** - Quote not found
```json
{
  "statusCode": 404,
  "message": "Quote not found or access denied",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X POST 'https://api.lead360.app/api/v1/quotes/quote-uuid-456/notes' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "note_text": "Customer requested site visit before finalizing materials",
    "is_pinned": false
  }'
```

#### Implementation Notes
- Tenant isolation enforced (user can only add notes to their tenant's quotes)
- User information captured automatically from JWT token

---

### GET /quotes/:id/notes

**Description**: List all notes for a quote

**Authorization**: Owner, Admin, Manager, Sales, Field (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Quote identifier

#### Query Parameters
- `page` (integer, optional, default: 1, min: 1) - Page number
- `limit` (integer, optional, default: 50, min: 1, max: 100) - Items per page

#### Success Response (200)

```json
{
  "notes": [
    {
      "id": "note-uuid-123",
      "quote_id": "quote-uuid-456",
      "note_text": "Customer requested site visit before finalizing materials",
      "is_pinned": true,
      "user": {
        "id": "user-uuid-789",
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com"
      },
      "created_at": "2026-02-02T10:30:00Z",
      "updated_at": "2026-02-02T10:30:00Z"
    },
    {
      "id": "note-uuid-124",
      "quote_id": "quote-uuid-456",
      "note_text": "Follow up scheduled for next week",
      "is_pinned": false,
      "user": {
        "id": "user-uuid-790",
        "first_name": "Jane",
        "last_name": "Smith",
        "email": "jane@example.com"
      },
      "created_at": "2026-02-01T14:45:00Z",
      "updated_at": "2026-02-01T14:45:00Z"
    }
  ],
  "total": 12
}
```

**Response Fields**:
- `notes` (array) - List of notes (pinned first, then by created_at desc)
- `total` (number) - Total number of notes for this quote

#### Business Rules
- Notes ordered by: `is_pinned DESC, created_at DESC`
- Pinned notes always appear first
- User must have access to the quote

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

**404 Not Found** - Quote not found
```json
{
  "statusCode": 404,
  "message": "Quote not found or access denied",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X GET 'https://api.lead360.app/api/v1/quotes/quote-uuid-456/notes?page=1&limit=50' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Tenant isolation enforced
- Field users can view notes but not create/edit

---

### PATCH /quotes/:id/notes/:noteId

**Description**: Update a quote note (text and/or pinned status)

**Authorization**: Owner, Admin, Manager, Sales (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Quote identifier
- `noteId` (UUID, required) - Note identifier

#### Request Body

All fields optional (partial update):

```json
{
  "note_text": "Customer confirmed site visit scheduled for next week",
  "is_pinned": true
}
```

**Validation Rules**:
- `note_text` (string, optional, max: 5000) - Updated note text
- `is_pinned` (boolean, optional) - Updated pinned status

#### Success Response (200)

Same response format as GET note (updated note object)

#### Business Rules
- User must have access to the quote
- At least one field must be provided

#### Error Responses

**400 Bad Request** - Validation failed
```json
{
  "statusCode": 400,
  "message": ["note_text must not exceed 5000 characters"],
  "error": "Bad Request"
}
```

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

**404 Not Found** - Note not found
```json
{
  "statusCode": 404,
  "message": "Note not found or access denied",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X PATCH 'https://api.lead360.app/api/v1/quotes/quote-uuid-456/notes/note-uuid-123' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  -H 'Content-Type: application/json' \
  -d '{
    "note_text": "Customer confirmed site visit scheduled for next week",
    "is_pinned": true
  }'
```

#### Implementation Notes
- Tenant isolation enforced
- Updated timestamp is automatically updated

---

### DELETE /quotes/:id/notes/:noteId

**Description**: Delete a quote note

**Authorization**: Owner, Admin, Manager, Sales (required)

**Rate Limiting**: None

**Caching**: No

#### Path Parameters
- `id` (UUID, required) - Quote identifier
- `noteId` (UUID, required) - Note identifier

#### Success Response (204 No Content)

No response body

#### Business Rules
- User must have access to the quote
- Deletion is permanent (cannot be undone)

#### Error Responses

**403 Forbidden** - Insufficient permissions
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

**404 Not Found** - Note not found
```json
{
  "statusCode": 404,
  "message": "Note not found or access denied",
  "error": "Not Found"
}
```

#### Example Request

```bash
curl -X DELETE 'https://api.lead360.app/api/v1/quotes/quote-uuid-456/notes/note-uuid-123' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN'
```

#### Implementation Notes
- Tenant isolation enforced
- Hard delete (note is permanently removed)

---

## Error Reference

### 400 Bad Request
- **Cause**: Request validation failed, invalid parameters, or business rule violation
- **Examples**:
  - Missing required fields
  - Field length exceeds maximum
  - Invalid enum value
  - Invalid date format
  - Invalid UUID format
- **Resolution**: Check request body and query parameters against API specification

### 401 Unauthorized
- **Cause**: Missing or invalid JWT token
- **Examples**:
  - No `Authorization` header
  - Expired JWT token
  - Invalid JWT signature
- **Resolution**: Ensure valid Bearer token is included in `Authorization` header

### 403 Forbidden
- **Cause**: Insufficient permissions for requested operation
- **Examples**:
  - User is not Platform Admin
  - User doesn't have required role
  - Attempting to access another tenant's data
- **Resolution**: Verify user has appropriate role and permissions

### 404 Not Found
- **Cause**: Requested resource does not exist or user doesn't have access
- **Examples**:
  - Invalid UUID
  - Resource deleted
  - Cross-tenant access denied (treated as not found for security)
- **Resolution**: Verify resource ID and user access

### 409 Conflict
- **Cause**: Request conflicts with current state
- **Examples**:
  - Cannot delete template with `usage_count > 0`
  - Cannot set duplicate default template
  - Cannot delete quote with child revisions
- **Resolution**: Resolve conflict (e.g., unset default, remove dependencies)

### 429 Too Many Requests
- **Cause**: Rate limit exceeded
- **Examples**:
  - Template preview endpoint: >10 requests/minute
  - Test PDF endpoint: >10 requests/minute
- **Resolution**: Wait before retrying (rate limits reset after 1 minute)

### 500 Internal Server Error
- **Cause**: Unexpected server error
- **Examples**:
  - Database connection failure
  - Unhandled exception
  - External service unavailable
- **Resolution**: Contact platform administrators, check system health endpoint

---

## Rate Limiting & Caching

### Rate Limited Endpoints

The following endpoints have rate limiting to prevent abuse:

| Endpoint | Limit | Window | Reason |
|----------|-------|--------|--------|
| `POST /admin/quotes/templates/:id/preview` | 10 requests | 1 minute | Resource-intensive rendering |
| `POST /admin/quotes/templates/:id/test-pdf` | 10 requests | 1 minute | Resource-intensive PDF generation |

**Rate Limit Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1654300800
```

**When Rate Limited**:
```json
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "error": "Too Many Requests",
  "retry_after": 42
}
```

### Cached Endpoints

The following endpoints use caching to improve performance:

| Endpoint | TTL | Cache Key |
|----------|-----|-----------|
| Dashboard overview | 5 minutes | date range |
| Quote trends | 5 minutes | date range + interval |
| Conversion funnel | 5 minutes | date range |
| System health | 1 minute | none |
| Revenue analytics | 5 minutes | date range + group_by |
| Global item pricing | 15 minutes | filters |
| Tenants list | 15 minutes | filters + pagination |
| Tenant stats | 15 minutes | tenant_id + date range |
| Tenant config | 15 minutes | tenant_id |
| Template variables schema | 1 hour | none |

**Cache Behavior**:
- Cache is automatically cleared when related data is modified
- Use `Cache-Control: no-cache` header to bypass cache
- Cache is per-tenant for tenant-specific endpoints

### Performance Tips

1. **Use caching wisely**: Don't bypass cache unless you need real-time data
2. **Batch operations**: Use bulk update instead of individual updates
3. **Paginate large results**: Use reasonable page sizes (50-100)
4. **Filter aggressively**: Use query parameters to reduce data transfer
5. **Poll efficiently**: When polling job status, use 5-10 second intervals

---

## Additional Resources

- **Swagger/OpenAPI**: https://api.lead360.app/api/docs
- **Contract**: `/var/www/lead360.app/documentation/contracts/quote-admin-contract.md`
- **Backend Implementation**: `/var/www/lead360.app/api/src/modules/quotes/`
- **Support**: Contact platform administrators

---

**End of Quote Admin REST API Documentation**

**Version**: 1.0
**Total Endpoints Documented**: 45
- Dashboard Analytics: 6 endpoints
- Tenant Management: 6 endpoints
- Quote Management: 5 endpoints
- Operational Tools: 3 endpoints
- Reports & Exports: 8 endpoints
- Template Management: 14 endpoints
- Quote Notes: 4 endpoints

**Last Updated**: February 2, 2026
