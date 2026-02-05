# Admin Backend Dev 2: Tenant Management & Comparison

**Developer**: Backend Developer 2  
**Duration**: 7 days  
**Prerequisites**: Read `ADMIN_BACKEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Build tenant management and comparison tools:
- List tenants using quote module
- Per-tenant statistics
- Tenant comparison and ranking
- Tenant activity monitoring

---

## API ENDPOINTS TO IMPLEMENT

### List Tenants with Quote Activity
**Endpoint**: `GET /admin/tenants/quotes`

**Query Parameters**:
- `status`: `active` | `trial` | `suspended` | `all` (default: active)
- `search`: Filter by company name or subdomain
- `sort_by`: `quote_count` | `revenue` | `name` (default: quote_count)
- `page`, `limit` (pagination)

**Response**:
```
{
  tenants: [
    {
      tenant_id: string,
      company_name: string,
      subdomain: string,
      subscription_status: string,
      quote_stats: {
        total_quotes: number,
        quotes_last_30_days: number,
        total_revenue: decimal,
        conversion_rate: decimal
      },
      created_at: string
    },
    ...
  ],
  pagination: { total, page, limit },
  summary: {
    total_tenants: number,
    active_tenants: number
  }
}
```

**Business Logic**:
- Join tenant with quote aggregates
- Filter by subscription status
- Search by company_name or subdomain (case-insensitive)
- Calculate stats per tenant
- Paginate results

---

### Get Tenant Quote Statistics
**Endpoint**: `GET /admin/tenants/:tenantId/quote-stats`

**Path Parameters**:
- `tenantId` (UUID, required)

**Query Parameters**:
- `date_from`, `date_to` (optional)

**Response**:
```
{
  tenant_id: string,
  tenant_name: string,
  period: { from: string, to: string },
  statistics: {
    total_quotes: number,
    quotes_by_status: {
      draft: number,
      sent: number,
      accepted: number,
      rejected: number
    },
    revenue: {
      total: decimal,
      average_per_quote: decimal
    },
    conversion_rate: decimal,
    avg_quote_value: decimal,
    top_items: [
      { title: string, usage_count: number, avg_price: decimal }
    ]
  },
  trends: {
    quote_volume_change: string,
    revenue_change: string
  }
}
```

**Business Logic**:
- Validate tenant exists
- Aggregate quotes for specific tenant
- Calculate conversion rate
- Find top 10 quoted items
- Compare to previous period for trends

---

### Compare Tenants by Metric
**Endpoint**: `GET /admin/tenants/compare`

**Query Parameters**:
- `metric`: `quote_count` | `revenue` | `conversion_rate` | `avg_quote_value`
- `limit`: Number of tenants to return (default: 10, max: 50)
- `date_from`, `date_to` (optional)

**Response**:
```
{
  metric: string,
  date_range: { from: string, to: string },
  rankings: [
    {
      rank: number,
      tenant_id: string,
      tenant_name: string,
      value: number,
      supplementary: {
        quote_count: number,
        conversion_rate: decimal,
        avg_quote_value: decimal
      }
    },
    ...
  ],
  summary: {
    total_tenants: number,
    metric_average: decimal,
    metric_median: decimal
  }
}
```

**Business Logic**:
- Calculate specified metric per tenant
- Rank tenants (highest to lowest)
- Include supplementary metrics for context
- Calculate platform-wide average and median

---

### Tenant Activity Timeline
**Endpoint**: `GET /admin/tenants/:tenantId/activity`

**Path Parameters**:
- `tenantId` (UUID, required)

**Query Parameters**:
- `date_from`, `date_to` (optional)
- `limit` (default: 50, max: 200)

**Response**:
```
{
  tenant_id: string,
  tenant_name: string,
  activities: [
    {
      timestamp: string,
      event_type: string,
      description: string,
      user: { name: string },
      metadata: object
    },
    ...
  ],
  summary: {
    total_events: number,
    most_active_user: string,
    busiest_day: string
  }
}
```

**Event Types**:
- Quote created
- Quote sent
- Quote accepted/rejected
- Template changed
- User added
- Settings updated

**Data Source**: Audit log table

---

### Tenant Configuration Overview
**Endpoint**: `GET /admin/tenants/:tenantId/configuration`

**Response**:
```
{
  tenant_id: string,
  tenant_name: string,
  quote_configuration: {
    active_template_id: string,
    active_template_name: string,
    default_profit_margin: decimal,
    default_overhead: decimal,
    quote_expiration_days: number,
    approval_thresholds: array
  },
  custom_resources: {
    custom_units: number,
    custom_templates: number
  },
  feature_flags: {
    quotes_enabled: boolean,
    approval_workflow_enabled: boolean
  }
}
```

**Business Logic**:
- Fetch tenant record
- Join quote settings
- Count custom resources
- Include feature flags (if system supports)

**Note**: Read-only; modifications done by tenant

---

## SERVICE LAYER

Create `AdminTenantService`:

**Methods**:
- `listTenantsWithQuoteActivity(filters, pagination)`
- `getTenantQuoteStatistics(tenantId, dateFrom?, dateTo?)`
- `compareTenantsByMetric(metric, limit, dateRange?)`
- `getTenantActivityTimeline(tenantId, dateFrom?, dateTo?, limit)`
- `getTenantConfiguration(tenantId)`

**Helper Methods**:
- `calculateTenantMetrics(tenantId, dateRange)`
- `rankTenants(metric, tenants)`
- `getTopItemsForTenant(tenantId, limit)`

---

## CACHING STRATEGY

**Cache Keys**:
- `admin:tenant:stats:{tenantId}:{dateRange}`
- `admin:tenant:compare:{metric}:{dateRange}`

**TTL**: 15 minutes (tenant data less volatile)

---

## TESTING REQUIREMENTS

### Unit Tests
- Test metric calculation
- Test ranking logic
- Test activity filtering

### Integration Tests
- Test with 100+ tenants
- Test tenant search
- Test pagination
- Test Platform Admin access
- Test non-existent tenant handling

### Performance Tests
- Tenant list loads in <2 seconds
- Statistics query <1 second per tenant

---

## DELIVERABLES

1. `AdminTenantController` (5 endpoints)
2. `AdminTenantService`
3. DTOs for filters and responses
4. Swagger documentation
5. Unit and integration tests
6. Caching implementation

---

## COMPLETION CRITERIA

- All 5 endpoints functional
- Tenant comparison accurate
- Activity timeline complete
- Performance acceptable
- Tests pass
- Documentation complete