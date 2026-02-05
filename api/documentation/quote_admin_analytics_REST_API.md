# Quote Admin Analytics REST API Documentation

**Version**: 1.0
**Base URL**: `https://api.lead360.app/api/v1`
**Last Updated**: February 2026

---

## Overview

This document describes the **Platform Admin Analytics API** for the Quote Module. These endpoints provide cross-tenant analytics, dashboard metrics, and system health monitoring exclusively for Platform Administrators.

### Key Features
- **Cross-tenant data aggregation** - Access quotes from all tenants
- **Real-time system health** - Monitor API, PDF generation, email delivery, and database performance
- **Revenue analytics** - Track revenue by vendor or tenant
- **Conversion funnel** - Analyze quote progression through stages
- **Time-series trends** - View quote volume and revenue over time

---

## Authentication

All endpoints require:
- **Bearer Token**: JWT token in Authorization header
- **Platform Admin Role**: User must have `is_platform_admin: true` flag

### Example Authorization Header
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Error Responses

#### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

#### 403 Forbidden (Non-Platform Admin)
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required"
}
```

---

## Endpoints

### 1. Dashboard Overview

Get platform-wide quote statistics, top tenants, and trend analysis.

**Endpoint**: `GET /admin/quotes/dashboard/overview`

**Query Parameters** (all optional):

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `date_from` | string (ISO 8601) | Start date for analysis period | `2024-01-01T00:00:00.000Z` |
| `date_to` | string (ISO 8601) | End date for analysis period | `2024-01-31T23:59:59.999Z` |

**Default**: Last 30 days if no dates provided

**Request Example**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/dashboard/overview?date_from=2024-01-01T00:00:00.000Z&date_to=2024-01-31T23:59:59.999Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "global_stats": {
    "total_tenants": 145,
    "active_tenants": 120,
    "total_quotes": 5432,
    "total_revenue": 1234567.89,
    "avg_quote_value": 2500.00,
    "conversion_rate": 42.5
  },
  "tenant_breakdown": {
    "top_tenants_by_revenue": [
      {
        "tenant_id": "550e8400-e29b-41d4-a716-446655440000",
        "company_name": "Acme Roofing",
        "revenue": 125000.50,
        "quote_count": 45
      },
      {
        "tenant_id": "550e8400-e29b-41d4-a716-446655440001",
        "company_name": "Beta Construction",
        "revenue": 98500.25,
        "quote_count": 38
      }
    ],
    "top_tenants_by_quote_count": [
      {
        "tenant_id": "550e8400-e29b-41d4-a716-446655440002",
        "company_name": "Gamma Repairs",
        "revenue": 75000.00,
        "quote_count": 52
      }
    ],
    "new_tenants_this_period": 12
  },
  "trends": {
    "quote_velocity": "+15.2%",
    "avg_value_change": "+8.3%",
    "conversion_rate_change": "-2.1%"
  },
  "date_from": "2024-01-01T00:00:00.000Z",
  "date_to": "2024-01-31T23:59:59.999Z"
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `global_stats.total_tenants` | number | Total number of tenants in the system |
| `global_stats.active_tenants` | number | Number of active tenants (is_active = true) |
| `global_stats.total_quotes` | number | Total quotes created in the period |
| `global_stats.total_revenue` | number | Total revenue from accepted quotes |
| `global_stats.avg_quote_value` | number | Average quote value (total_revenue / accepted_quotes) |
| `global_stats.conversion_rate` | number | Percentage of accepted quotes vs total quotes |
| `tenant_breakdown.top_tenants_by_revenue` | array | Top 10 tenants sorted by revenue (descending) |
| `tenant_breakdown.top_tenants_by_quote_count` | array | Top 10 tenants sorted by quote count (descending) |
| `tenant_breakdown.new_tenants_this_period` | number | Tenants created in the analysis period |
| `trends.quote_velocity` | string | Percentage change in quote count vs previous period |
| `trends.avg_value_change` | string | Percentage change in avg quote value vs previous period |
| `trends.conversion_rate_change` | string | Percentage change in conversion rate vs previous period |

**Cache**: 5 minutes

---

### 2. Quote Trends

Get time-series data for quote volume and revenue with configurable intervals.

**Endpoint**: `GET /admin/quotes/dashboard/quote-trends`

**Query Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `date_from` | string (ISO 8601) | Yes | Start date | `2024-01-01T00:00:00.000Z` |
| `date_to` | string (ISO 8601) | Yes | End date | `2024-01-31T23:59:59.999Z` |
| `interval` | enum | No | Grouping interval: `day`, `week`, `month` | `day` |

**Default interval**: `day`

**Request Example**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/dashboard/quote-trends?date_from=2024-01-01T00:00:00.000Z&date_to=2024-01-31T23:59:59.999Z&interval=week" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "data_points": [
    {
      "date": "2024-01-15",
      "count": 45,
      "revenue": 125000.50
    },
    {
      "date": "2024-01-16",
      "count": 52,
      "revenue": 138500.25
    }
  ],
  "interval": "day",
  "summary": {
    "total_quotes": 543,
    "total_revenue": 1250000.00,
    "avg_per_interval": 27.15
  },
  "date_from": "2024-01-01T00:00:00.000Z",
  "date_to": "2024-01-31T23:59:59.999Z"
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `data_points` | array | Time-series data points |
| `data_points[].date` | string | Date key (format depends on interval) |
| `data_points[].count` | number | Number of quotes created on this date |
| `data_points[].revenue` | number | Revenue from accepted quotes on this date |
| `interval` | string | Interval used for grouping (`day`, `week`, `month`) |
| `summary.total_quotes` | number | Total quotes across all periods |
| `summary.total_revenue` | number | Total revenue across all periods |
| `summary.avg_per_interval` | number | Average quotes per interval period |

**Date Format by Interval**:
- `day`: `YYYY-MM-DD` (e.g., `2024-01-15`)
- `week`: `YYYY-WW` (e.g., `2024-03` for week 3 of 2024)
- `month`: `YYYY-MM` (e.g., `2024-01`)

**Validation Errors** (400 Bad Request):

```json
{
  "statusCode": 400,
  "message": [
    "date_from must be a valid ISO 8601 date string",
    "date_to is required"
  ],
  "error": "Bad Request"
}
```

**Cache**: 5 minutes

---

### 3. Conversion Funnel

Analyze quote progression through funnel stages with conversion rates.

**Endpoint**: `GET /admin/quotes/dashboard/conversion-funnel`

**Query Parameters** (all optional):

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `date_from` | string (ISO 8601) | Start date for analysis period | `2024-01-01T00:00:00.000Z` |
| `date_to` | string (ISO 8601) | End date for analysis period | `2024-01-31T23:59:59.999Z` |

**Default**: Last 30 days if no dates provided

**Request Example**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/dashboard/conversion-funnel" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "funnel_stages": [
    {
      "stage": "created",
      "count": 1000,
      "percentage": 100.0
    },
    {
      "stage": "sent",
      "count": 850,
      "percentage": 85.0
    },
    {
      "stage": "viewed",
      "count": 650,
      "percentage": 65.0
    },
    {
      "stage": "accepted",
      "count": 425,
      "percentage": 42.5
    }
  ],
  "conversion_rates": {
    "sent_to_viewed": 76.5,
    "viewed_to_accepted": 65.4,
    "overall": 50.0
  },
  "date_from": "2024-01-01T00:00:00.000Z",
  "date_to": "2024-01-31T23:59:59.999Z"
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `funnel_stages` | array | Funnel stages with counts and percentages |
| `funnel_stages[].stage` | string | Stage name: `created`, `sent`, `viewed`, `accepted` |
| `funnel_stages[].count` | number | Number of quotes at this stage |
| `funnel_stages[].percentage` | number | Percentage relative to total created (0-100) |
| `conversion_rates.sent_to_viewed` | number | Conversion rate from sent to viewed (0-100) |
| `conversion_rates.viewed_to_accepted` | number | Conversion rate from viewed to accepted (0-100) |
| `conversion_rates.overall` | number | Overall conversion rate (accepted / sent) (0-100) |

**Funnel Stage Definitions**:
- **Created**: All quotes (any status)
- **Sent**: Status in `('sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'started', 'concluded', 'denied', 'lost')`
- **Viewed**: Status in `('read', 'opened', 'downloaded', 'approved', 'started', 'concluded', 'denied', 'lost')`
- **Accepted**: Status in `('approved', 'started', 'concluded')`

**Cache**: 5 minutes

---

### 4. System Health

Get real-time system health metrics for API, PDF generation, email delivery, and database.

**Endpoint**: `GET /admin/quotes/dashboard/system-health`

**Query Parameters**: None

**Request Example**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/dashboard/system-health" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "api_health": {
    "avg_response_time_ms": 125.5,
    "error_rate": 0.02,
    "requests_last_hour": 1543
  },
  "pdf_generation": {
    "queue_size": 5,
    "avg_generation_time_ms": 2350.25,
    "success_rate": 98.5
  },
  "email_delivery": {
    "queue_size": 12,
    "success_rate": 99.2,
    "failed_last_24h": 3
  },
  "database": {
    "query_performance": "good",
    "connection_pool_usage": 45.2
  },
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `api_health.avg_response_time_ms` | number | Average API response time in milliseconds (proxy from audit log) |
| `api_health.error_rate` | number | Error rate (0-1 range, e.g., 0.02 = 2%) |
| `api_health.requests_last_hour` | number | Number of API requests in the last hour |
| `pdf_generation.queue_size` | number | Number of pending PDF generation jobs |
| `pdf_generation.avg_generation_time_ms` | number | Average PDF generation time in milliseconds |
| `pdf_generation.success_rate` | number | PDF generation success rate percentage (0-100) |
| `email_delivery.queue_size` | number | Number of pending emails in queue |
| `email_delivery.success_rate` | number | Email delivery success rate percentage (0-100) |
| `email_delivery.failed_last_24h` | number | Number of failed emails in last 24 hours |
| `database.query_performance` | string | Database performance status: `excellent`, `good`, `fair`, `degraded`, `error` |
| `database.connection_pool_usage` | number | Database connection pool usage percentage (0-100) |
| `timestamp` | string (ISO 8601) | Timestamp of health check |

**Query Performance Thresholds**:
- **Excellent**: < 100ms average response time
- **Good**: 100-200ms average response time
- **Fair**: 200-500ms average response time
- **Degraded**: 500-1000ms average response time
- **Error**: > 1000ms or database unreachable

**Cache**: 1 minute (shorter TTL for real-time monitoring)

---

### 5. Revenue Analytics

Get revenue analytics grouped by vendor or tenant with trend analysis.

**Endpoint**: `GET /admin/quotes/dashboard/revenue-analytics`

**Query Parameters**:

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `date_from` | string (ISO 8601) | Yes | Start date | `2024-01-01T00:00:00.000Z` |
| `date_to` | string (ISO 8601) | Yes | End date | `2024-01-31T23:59:59.999Z` |
| `group_by` | enum | No | Grouping: `vendor` or `tenant` | `vendor` |

**Default group_by**: `vendor`

**Request Example**:
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/dashboard/revenue-analytics?date_from=2024-01-01T00:00:00.000Z&date_to=2024-01-31T23:59:59.999Z&group_by=tenant" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Success Response** (200 OK):
```json
{
  "total_revenue": 1234567.89,
  "revenue_by_group": [
    {
      "group_id": "550e8400-e29b-41d4-a716-446655440000",
      "group_name": "ABC Roofing",
      "revenue": 125000.50,
      "quote_count": 45
    },
    {
      "group_id": "550e8400-e29b-41d4-a716-446655440001",
      "group_name": "XYZ Construction",
      "revenue": 98500.25,
      "quote_count": 38
    }
  ],
  "top_revenue_sources": [
    {
      "group_id": "550e8400-e29b-41d4-a716-446655440000",
      "group_name": "ABC Roofing",
      "revenue": 125000.50,
      "quote_count": 45
    }
  ],
  "revenue_trend": [
    {
      "date": "2024-01-15",
      "revenue": 12500.00
    },
    {
      "date": "2024-01-16",
      "revenue": 13800.50
    }
  ],
  "date_from": "2024-01-01T00:00:00.000Z",
  "date_to": "2024-01-31T23:59:59.999Z"
}
```

**Field Descriptions**:

| Field | Type | Description |
|-------|------|-------------|
| `total_revenue` | number | Total revenue across all groups and period |
| `revenue_by_group` | array | Revenue grouped by vendor or tenant (all groups) |
| `revenue_by_group[].group_id` | string (UUID) | Vendor or tenant ID |
| `revenue_by_group[].group_name` | string | Vendor business_name or tenant company_name |
| `revenue_by_group[].revenue` | number | Total revenue for this group |
| `revenue_by_group[].quote_count` | number | Number of accepted quotes for this group |
| `top_revenue_sources` | array | Top 10 revenue sources (sorted descending) |
| `revenue_trend` | array | Daily revenue trend over the period |
| `revenue_trend[].date` | string | Date in YYYY-MM-DD format |
| `revenue_trend[].revenue` | number | Revenue for this date |

**Grouping Behavior**:
- **vendor**: Groups revenue by vendor (for multi-vendor tenants)
- **tenant**: Groups revenue by tenant (cross-tenant comparison)

**Revenue Calculation**:
- Only includes **accepted quotes** (status in `approved`, `started`, `concluded`)
- Uses `quote.total` field for revenue amount

**Cache**: 5 minutes

---

## Common Validation Rules

All endpoints enforce the following validation rules:

### Date Range Validation

| Rule | HTTP Status | Error Message |
|------|-------------|---------------|
| `date_from` after `date_to` | 400 | `date_from must be before date_to` |
| `date_to` in the future | 400 | `date_to cannot be in the future` |
| Date range exceeds 365 days | 400 | `Date range cannot exceed 365 days` |
| Invalid date format | 400 | `date_from must be a valid ISO 8601 date string` |

**Example Error Response** (400 Bad Request):
```json
{
  "statusCode": 400,
  "message": "Date range cannot exceed 365 days",
  "error": "Bad Request"
}
```

---

## Error Handling

### HTTP Status Codes

| Status Code | Description |
|-------------|-------------|
| 200 | Success - Data returned |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid JWT token |
| 403 | Forbidden - User is not Platform Admin |
| 500 | Internal Server Error - Server-side error |

### Error Response Format

```json
{
  "statusCode": 400,
  "message": "Detailed error message or array of validation errors",
  "error": "Bad Request"
}
```

### Common Error Scenarios

1. **Missing Authorization Header**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

2. **Non-Platform Admin User**
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required"
}
```

3. **Invalid Date Range**
```json
{
  "statusCode": 400,
  "message": "Date range cannot exceed 365 days",
  "error": "Bad Request"
}
```

4. **Server Error**
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

---

## Caching Strategy

All analytics endpoints use Redis caching for performance optimization:

| Endpoint | Cache Key Pattern | TTL |
|----------|-------------------|-----|
| Dashboard Overview | `admin:dashboard:overview:{dateFrom}:{dateTo}` | 5 minutes |
| Quote Trends | `admin:dashboard:trends:{interval}:{dateFrom}:{dateTo}` | 5 minutes |
| Conversion Funnel | `admin:dashboard:funnel:{dateFrom}:{dateTo}` | 5 minutes |
| System Health | `admin:system:health` | 1 minute |
| Revenue Analytics | `admin:dashboard:revenue:{groupBy}:{dateFrom}:{dateTo}` | 5 minutes |

**Cache Behavior**:
- Cache hits return data in < 50ms
- Cache misses compute data and cache for subsequent requests
- Cache failures gracefully degrade (log warning, continue without cache)

---

## Performance Considerations

### Response Time Targets

| Endpoint | Target (p95) | Notes |
|----------|--------------|-------|
| Dashboard Overview | < 3 seconds | 10,000+ quotes |
| Quote Trends | < 2 seconds | Optimized with raw SQL |
| Conversion Funnel | < 2 seconds | Simple aggregation |
| System Health | < 1 second | Real-time metrics |
| Revenue Analytics | < 3 seconds | Complex grouping |

### Optimization Techniques

1. **Redis Caching**: 5-minute TTL reduces database load by 95%+
2. **Field Selection**: Uses `select` clause to minimize data transfer
3. **Raw SQL**: Uses `$queryRaw` for complex time-series aggregations
4. **Indexed Queries**: Leverages indexes on `tenant_id`, `status`, `created_at`
5. **Parallel Queries**: Uses `Promise.all` for independent queries

---

## Security

### Multi-Tenant Isolation

**IMPORTANT**: These endpoints intentionally **bypass** tenant isolation to provide cross-tenant analytics for Platform Admins.

- No `tenant_id` filter applied to queries
- Data from ALL tenants is aggregated
- Only Platform Admins can access (enforced by `@Roles('PlatformAdmin')` guard)

### RBAC Enforcement

1. **JWT Authentication**: All endpoints require valid JWT token
2. **Platform Admin Role**: User must have `is_platform_admin: true` flag
3. **Defensive Check**: Each endpoint verifies `req.user.is_platform_admin`
4. **Audit Logging**: Optional (not required for read-only analytics)

---

## Testing

### Manual Testing

1. **Obtain Platform Admin Token**
```bash
curl -X POST "https://api.lead360.app/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "platformadmin@example.com",
    "password": "your-password"
  }'
```

2. **Test Dashboard Overview**
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/dashboard/overview" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Test with Date Range**
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/dashboard/quote-trends?date_from=2024-01-01T00:00:00.000Z&date_to=2024-01-31T23:59:59.999Z&interval=week" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Automated Testing

- **Unit Tests**: `admin-analytics.service.spec.ts`
- **Integration Tests**: `admin-analytics.e2e-spec.ts`

Run tests:
```bash
# Unit tests
npm run test admin-analytics.service.spec.ts

# Integration tests
npm run test:e2e admin-analytics.e2e-spec.ts
```

---

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Feb 2026 | Initial release - 5 analytics endpoints | Developer 1 |

---

## Support

For questions or issues:
- **API Issues**: Contact backend team
- **Platform Admin Access**: Contact system administrator
- **Feature Requests**: Create ticket in project management system

---

**End of API Documentation**

---

# Tenant Management Endpoints (Developer 2)

**Added**: February 2026  
**Developer**: Backend Developer 2

## Overview

These endpoints provide tenant-level management, comparison, and monitoring capabilities for Platform Administrators. All endpoints are under `/admin/quotes/tenants/*`.

### Key Features
- **Tenant listing** - View all tenants using the quote module with activity metrics
- **Tenant comparison** - Rank tenants by various metrics
- **Detailed statistics** - Per-tenant quote analytics with trends
- **Activity monitoring** - Real-time audit log tracking
- **Configuration view** - Tenant settings and custom resources

---

## Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/quotes/tenants` | List tenants with quote activity |
| GET | `/admin/quotes/tenants/compare` | Compare tenants by metric |
| GET | `/admin/quotes/tenants/:tenantId/stats` | Get tenant statistics |
| GET | `/admin/quotes/tenants/:tenantId/activity` | Get activity timeline |
| GET | `/admin/quotes/tenants/:tenantId/config` | Get tenant configuration |

---

## 1. List Tenants with Quote Activity

**Endpoint**: `GET /admin/quotes/tenants`

**Description**: Returns a paginated list of tenants with quote activity metrics, supporting filtering, searching, and sorting.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | `active` | Filter by subscription status: `active`, `trial`, `suspended`, `all` |
| `search` | string | No | - | Search by company name or subdomain (case-insensitive) |
| `sort_by` | string | No | `quote_count` | Sort by: `quote_count`, `revenue`, `name` |
| `page` | number | No | 1 | Page number (1-based) |
| `limit` | number | No | 50 | Results per page (min: 1, max: 100) |

### Response Body

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
      "created_at": "2024-01-15T10:30:00.000Z"
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

### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants?status=active&sort_by=revenue&page=1&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Business Logic

- Filters tenants by subscription status (if not 'all')
- Searches company_name OR subdomain using case-insensitive LIKE
- Calculates quote_stats for each tenant:
  - `total_quotes`: All non-archived quotes
  - `quotes_last_30_days`: Quotes created in last 30 days
  - `total_revenue`: Sum of quotes with status `approved`, `started`, `concluded`
  - `conversion_rate`: (accepted quotes / sent quotes) * 100
- Results cached for 15 minutes

### Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 403 | Platform Admin access required |

---

## 2. Compare Tenants by Metric

**Endpoint**: `GET /admin/quotes/tenants/compare`

**Description**: Ranks tenants by a specified metric, providing supplementary metrics and platform-wide statistics.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `metric` | string | **Yes** | - | Metric to rank by: `quote_count`, `revenue`, `conversion_rate`, `avg_quote_value` |
| `limit` | number | No | 10 | Number of top tenants to return (min: 1, max: 50) |
| `date_from` | string | No | 30 days ago | Start date (ISO 8601) |
| `date_to` | string | No | now | End date (ISO 8601) |

### Response Body

```json
{
  "metric": "revenue",
  "date_range": {
    "from": "2024-01-01T00:00:00.000Z",
    "to": "2024-01-31T23:59:59.999Z"
  },
  "rankings": [
    {
      "rank": 1,
      "tenant_id": "abc-123-def-456",
      "tenant_name": "Acme Roofing",
      "value": 125000.50,
      "supplementary": {
        "quote_count": 145,
        "conversion_rate": 42.5,
        "avg_quote_value": 6944.47
      }
    }
  ],
  "summary": {
    "total_tenants": 145,
    "metric_average": 15234.67,
    "metric_median": 12500.00
  }
}
```

### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants/compare?metric=revenue&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Business Logic

- Queries all active tenants with quotes in date range
- Calculates all metrics per tenant
- Sorts by specified metric (descending)
- Assigns ranks (1-based, top = rank 1)
- Limits to top N results
- Calculates platform-wide average and median
- Results cached for 15 minutes

### Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 400 | Invalid metric or parameters |
| 403 | Platform Admin access required |

---

## 3. Get Tenant Quote Statistics

**Endpoint**: `GET /admin/quotes/tenants/:tenantId/stats`

**Description**: Returns detailed quote statistics for a specific tenant, including breakdowns by status, revenue metrics, top items, and trends vs previous period.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | UUID | **Yes** | Tenant UUID |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `date_from` | string | No | 30 days ago | Start date (ISO 8601) |
| `date_to` | string | No | now | End date (ISO 8601) |

### Response Body

```json
{
  "tenant_id": "abc-123-def-456",
  "tenant_name": "Acme Roofing",
  "period": {
    "from": "2024-01-01T00:00:00.000Z",
    "to": "2024-01-31T23:59:59.999Z"
  },
  "statistics": {
    "total_quotes": 145,
    "quotes_by_status": {
      "draft": 12,
      "sent": 34,
      "accepted": 18,
      "rejected": 5
    },
    "revenue": {
      "total": 125000.50,
      "average_per_quote": 6944.47
    },
    "conversion_rate": 42.5,
    "avg_quote_value": 6944.47,
    "top_items": [
      {
        "title": "Roof Installation",
        "usage_count": 45,
        "avg_price": 12500.00
      }
    ]
  },
  "trends": {
    "quote_volume_change": "+15.2%",
    "revenue_change": "+8.3%"
  }
}
```

### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants/abc-123/stats?date_from=2024-01-01T00:00:00.000Z&date_to=2024-01-31T23:59:59.999Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Business Logic

- Validates tenant exists (throws 404 if not found)
- Queries quotes for current period
- Queries quote_item.groupBy for top 10 items
- Calculates previous period (same duration before date_from)
- Queries previous period for trend comparison
- Calculates percentage changes with +/- prefix
- Results cached for 15 minutes

### Status Definitions

- **Sent**: `sent`, `delivered`, `read`, `opened`, `downloaded`, `approved`, `started`, `concluded`, `denied`, `lost`
- **Accepted** (revenue): `approved`, `started`, `concluded`

### Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 403 | Platform Admin access required |
| 404 | Tenant not found |

---

## 4. Get Tenant Activity Timeline

**Endpoint**: `GET /admin/quotes/tenants/:tenantId/activity`

**Description**: Returns activity events from audit logs for a specific tenant, including user activity analysis. **Real-time data - not cached.**

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | UUID | **Yes** | Tenant UUID |

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `date_from` | string | No | 30 days ago | Start date (ISO 8601) |
| `date_to` | string | No | now | End date (ISO 8601) |
| `limit` | number | No | 50 | Max events to return (min: 1, max: 200) |

### Response Body

```json
{
  "tenant_id": "abc-123-def-456",
  "tenant_name": "Acme Roofing",
  "activities": [
    {
      "timestamp": "2024-01-15T10:30:00.000Z",
      "event_type": "quote_created",
      "description": "Quote Q-12345 created for ABC Construction",
      "user": {
        "name": "John Doe"
      },
      "metadata": {
        "quote_id": "uuid-123",
        "quote_number": "Q-12345"
      }
    }
  ],
  "summary": {
    "total_events": 342,
    "most_active_user": "John Doe",
    "busiest_day": "2024-01-15"
  }
}
```

### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants/abc-123/activity?limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Business Logic

- Validates tenant exists
- Queries audit_log table WHERE tenant_id = :tenantId AND entity_type = 'quote'
- Filters by date range
- Orders by created_at DESC
- Parses metadata_json to object
- Calculates summary statistics
- **NOT CACHED** - always returns real-time data

### Event Types

- `quote_created`, `quote_sent`, `quote_accepted`, `quote_rejected`
- `template_changed`, `user_added`, `settings_updated`

### Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 403 | Platform Admin access required |
| 404 | Tenant not found |

---

## 5. Get Tenant Configuration

**Endpoint**: `GET /admin/quotes/tenants/:tenantId/config`

**Description**: Returns configuration overview for a specific tenant, including quote settings, custom resources count, and feature flags.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tenantId` | UUID | **Yes** | Tenant UUID |

### Response Body

```json
{
  "tenant_id": "abc-123-def-456",
  "tenant_name": "Acme Roofing",
  "quote_configuration": {
    "active_template_id": "uuid-123",
    "active_template_name": "Professional Template",
    "default_profit_margin": 15.5,
    "default_overhead": 10.0,
    "quote_expiration_days": 30,
    "approval_thresholds": [
      { "threshold": 10000, "requires_approval": true }
    ]
  },
  "custom_resources": {
    "custom_units": 12,
    "custom_templates": 3
  },
  "feature_flags": {
    "quotes_enabled": true,
    "approval_workflow_enabled": false
  }
}
```

### Example Request

```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants/abc-123/config" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Business Logic

- Queries tenant with relations (active_quote_template, unit_measurements, quote_templates)
- Counts custom units (WHERE tenant_id = :tenantId)
- Counts custom templates (WHERE tenant_id = :tenantId)
- Maps `default_overhead_rate` DB field → `default_overhead` API field
- Handles null template gracefully
- Sets `approval_workflow_enabled` = !!approval_thresholds
- Results cached for 15 minutes

### Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 403 | Platform Admin access required |
| 404 | Tenant not found |

---

## Testing

### Unit Tests

```bash
# Run tenant management service tests
npm run test admin-tenant.service.spec.ts
```

**Test Coverage**: 35 tests covering all methods, edge cases, and error scenarios (>80% coverage)

### Manual Testing Examples

1. **List Active Tenants Sorted by Revenue**
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants?status=active&sort_by=revenue&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

2. **Compare Top 5 Tenants by Conversion Rate**
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants/compare?metric=conversion_rate&limit=5" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Get Tenant Stats for January 2024**
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants/TENANT_ID/stats?date_from=2024-01-01T00:00:00.000Z&date_to=2024-01-31T23:59:59.999Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **Get Recent Activity (Last 100 Events)**
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants/TENANT_ID/activity?limit=100" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

5. **View Tenant Configuration**
```bash
curl -X GET "https://api.lead360.app/api/v1/admin/quotes/tenants/TENANT_ID/config" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## Performance Considerations

### Caching Strategy

| Endpoint | Cached | TTL | Reason |
|----------|--------|-----|--------|
| List tenants | ✅ Yes | 15 min | Tenant data changes infrequently |
| Compare tenants | ✅ Yes | 15 min | Analytics data, not real-time |
| Tenant statistics | ✅ Yes | 15 min | Historical aggregates |
| Activity timeline | ❌ No | - | Real-time audit data required |
| Configuration | ✅ Yes | 15 min | Settings change rarely |

### Expected Performance

- **List tenants**: <2 seconds for 100+ tenants
- **Tenant statistics**: <1 second per tenant
- **Tenant comparison**: <2 seconds for 100+ tenants
- **Activity timeline**: <1 second for 200 events
- **Configuration**: <500ms

### Optimization Tips

- Use pagination for large tenant lists
- Limit date ranges to improve query performance
- Use appropriate `limit` parameter for comparisons
- Cache results are automatically invalidated after TTL

---

## Error Handling

### Common Error Responses

**400 Bad Request** (Invalid date range):
```json
{
  "statusCode": 400,
  "message": "date_from must be before date_to"
}
```

**404 Not Found** (Tenant doesn't exist):
```json
{
  "statusCode": 404,
  "message": "Tenant with ID abc-123 not found"
}
```

### Date Range Validation Rules

- `date_from` must be before `date_to`
- `date_to` cannot be in the future
- Date range cannot exceed 365 days

---

## Changelog

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Feb 2026 | Initial release - 5 analytics endpoints | Developer 1 |
| 1.1 | Feb 2026 | Added 5 tenant management endpoints | Developer 2 |

---

**End of Tenant Management Documentation**
