# Admin Backend Dev 1: Cross-Tenant Analytics & Dashboard

**Developer**: Backend Developer 1  
**Duration**: 8 days  
**Prerequisites**: Read `ADMIN_BACKEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Build platform-wide analytics and dashboard for quote system:
- Global statistics across all tenants
- Quote volume and revenue trends
- Conversion rate analytics
- System health metrics

---

## API ENDPOINTS TO IMPLEMENT

### Dashboard Overview
**Endpoint**: `GET /admin/quotes/dashboard/overview`  
**Purpose**: Platform-wide statistics

**Query Parameters**:
- `date_from` (ISO date, optional)
- `date_to` (ISO date, optional)

**Response Structure**:
```
{
  global_stats: {
    total_tenants: number,
    active_tenants: number,
    total_quotes: number,
    total_revenue: decimal,
    avg_quote_value: decimal,
    conversion_rate: decimal
  },
  tenant_breakdown: {
    top_tenants_by_revenue: array,
    top_tenants_by_quote_count: array,
    new_tenants_this_period: number
  },
  trends: {
    quote_velocity: string,
    avg_value_change: string,
    conversion_rate_change: string
  }
}
```

**Business Logic**:
- Count distinct tenants with quotes
- Sum revenue from accepted quotes only
- Calculate conversion: accepted / (sent + accepted + viewed)
- Top tenants: return top 10
- Trends: compare to previous period (same date range offset)

**Caching**: 5 minute TTL

---

### Quote Volume Trends
**Endpoint**: `GET /admin/quotes/dashboard/quote-trends`

**Query Parameters**:
- `date_from`, `date_to` (required)
- `interval`: `day` | `week` | `month` (default: day)

**Response**:
```
{
  data_points: [
    { date: string, count: number, revenue: decimal },
    ...
  ],
  interval: string,
  summary: {
    total_quotes: number,
    total_revenue: decimal,
    avg_per_interval: number
  }
}
```

**Business Logic**:
- Group quotes by interval (DATE_TRUNC in PostgreSQL)
- Count quotes per interval
- Sum revenue per interval (accepted quotes only)
- Return time series data for charting

---

### Conversion Funnel
**Endpoint**: `GET /admin/quotes/dashboard/conversion-funnel`

**Query Parameters**:
- `date_from`, `date_to` (optional)

**Response**:
```
{
  funnel_stages: [
    { stage: 'created', count: number, percentage: number },
    { stage: 'sent', count: number, percentage: number },
    { stage: 'viewed', count: number, percentage: number },
    { stage: 'accepted', count: number, percentage: number }
  ],
  conversion_rates: {
    sent_to_viewed: decimal,
    viewed_to_accepted: decimal,
    overall: decimal
  }
}
```

**Business Logic**:
- Count quotes by status
- Calculate drop-off at each stage
- Percentage relative to previous stage
- Overall conversion: accepted / sent

---

### System Health Metrics
**Endpoint**: `GET /admin/quotes/dashboard/system-health`

**Response**:
```
{
  api_health: {
    avg_response_time_ms: number,
    error_rate: decimal,
    requests_last_hour: number
  },
  pdf_generation: {
    queue_size: number,
    avg_generation_time_ms: number,
    success_rate: decimal
  },
  email_delivery: {
    queue_size: number,
    success_rate: decimal,
    failed_last_24h: number
  },
  database: {
    query_performance: string,
    connection_pool_usage: decimal
  }
}
```

**Data Sources**:
- API metrics: From application logs or APM tool
- PDF queue: BullMQ job counts and stats
- Email queue: BullMQ job counts and stats
- Database: Prisma metrics or pg_stat queries

---

### Revenue Analytics
**Endpoint**: `GET /admin/quotes/dashboard/revenue-analytics`

**Query Parameters**:
- `date_from`, `date_to` (required)
- `group_by`: `vendor` | `tenant` | `none` (default: none)

**Response**:
```
{
  total_revenue: decimal,
  revenue_by_group: [
    { group_name: string, revenue: decimal, quote_count: number },
    ...
  ],
  top_revenue_sources: array,
  revenue_trend: array
}
```

**Business Logic**:
- Sum total from accepted quotes
- Group by vendor or tenant if requested
- Calculate trend over time
- Identify top 10 revenue sources

---

## SERVICE LAYER

Create `AdminAnalyticsService`:

**Methods**:
- `getPlatformOverview(dateFrom?, dateTo?)`
- `getQuoteTrends(dateFrom, dateTo, interval)`
- `getConversionFunnel(dateFrom?, dateTo?)`
- `getSystemHealth()`
- `getRevenueAnalytics(dateFrom, dateTo, groupBy?)`

**Helper Methods**:
- `calculateConversionRate(sent, accepted)`
- `calculateTrend(current, previous)`
- `getTopTenants(metric, limit)`

---

## CACHING STRATEGY

Use Redis or in-memory cache:

**Cache Keys**:
- `admin:dashboard:overview:{dateRange}`
- `admin:dashboard:trends:{interval}:{dateRange}`
- `admin:dashboard:funnel:{dateRange}`

**TTL**: 5 minutes for all dashboard data

**Cache Invalidation**: None (let TTL expire)

---

## TESTING REQUIREMENTS

### Unit Tests
- Test conversion rate calculation
- Test trend calculation
- Test grouping logic
- Test date range handling

### Integration Tests
- Test with 100+ tenants
- Test with 1000+ quotes
- Test date range filtering
- Test caching behavior
- Test Platform Admin access only

### Performance Tests
- Dashboard loads in <3 seconds
- Trends query <2 seconds
- Works with 10,000+ quotes

---

## DELIVERABLES

1. `AdminAnalyticsController` (5 endpoints)
2. `AdminAnalyticsService` (business logic)
3. DTOs for query parameters
4. Swagger documentation
5. Unit and integration tests
6. Caching implementation
7. Performance test results

---

## COMPLETION CRITERIA

- All 5 endpoints functional
- Platform Admin role enforced
- Cross-tenant queries work
- Caching implemented
- Performance targets met
- Tests pass
- Documentation complete