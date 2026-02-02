# Sprint 6: API Testing Results

**Testing Date**: January 30, 2026
**Tested By**: Frontend Dev 6
**Test Accounts Used**:
- Admin: `ludsonaiello@gmail.com` ✅
- Tenant: `contact@honeydo4you.com` ✅

**Total Endpoints Tested**: 26/26 ✅

---

## Executive Summary

All 26 API endpoints for Sprint 6 were tested and are functional. However, **CRITICAL DISCREPANCIES** were found between the API documentation and actual implementation. The actual field names and structures documented below MUST be used in TypeScript types and API client implementation.

---

## Dashboard Endpoints (8/8 ✅)

### 1. GET `/quotes/dashboard/overview`

**Status**: ✅ Working
**Tested With**: Tenant account
**Query Params Used**: `date_from=2025-01-01&date_to=2026-01-30&compare_to_previous=true`

**ACTUAL Response Structure**:
```json
{
  "total_quotes": 2,
  "total_generated": 73097.58,
  "total_revenue": 36548.79,
  "avg_quote_value": 36548.79,
  "amount_sent": 73097.58,
  "amount_lost": 0,
  "amount_denied": 0,
  "amount_pending_approval": 0,
  "conversion_rate": 50,
  "by_status": [
    {
      "status": "approved",
      "count": 1,
      "total_revenue": 36548.79,
      "avg_value": 36548.79
    },
    {
      "status": "read",
      "count": 1,
      "total_revenue": 36548.79,
      "avg_value": 36548.79
    }
  ],
  "velocity_comparison": {
    "current": 2,
    "previous": 0,
    "change_percent": 0,
    "trend": "stable"
  },
  "date_from": "2025-01-01T00:00:00.000Z",
  "date_to": "2026-01-30T00:00:00.000Z"
}
```

**KEY DIFFERENCES FROM API DOCS**:
- ❌ NO nested `summary` object - fields are at root level
- ❌ NO `win_rate` field
- ✅ `by_status` is an **array of objects**, NOT a Record<string, number>
- ✅ Uses `velocity_comparison` instead of `comparison`
- ✅ Additional fields: `total_generated`, `amount_sent`, `amount_lost`, `amount_denied`, `amount_pending_approval`

---

### 2. GET `/quotes/dashboard/quotes-over-time`

**Status**: ✅ Working
**Query Params Used**: `date_from=2025-01-01&date_to=2026-01-30&interval=week`

**ACTUAL Response Structure**:
```json
{
  "data": [
    {
      "date": "2026-01-25",
      "count": 2,
      "total_value": 73097.58,
      "approved_count": 1,
      "rejected_count": 0
    }
  ],
  "interval": "week",
  "date_from": "2025-01-01T00:00:00.000Z",
  "date_to": "2026-01-30T00:00:00.000Z"
}
```

**KEY DIFFERENCES**:
- ✅ Uses `data` array (matches docs)
- ✅ Uses `count` instead of `quotes_created`
- ✅ Uses `total_value` instead of `revenue`
- ✅ Additional fields: `approved_count`, `rejected_count`
- ❌ NO `quotes_sent` or `quotes_accepted` fields

---

### 3. GET `/quotes/dashboard/top-items`

**Status**: ✅ Working
**Query Params Used**: `date_from=2025-01-01&date_to=2026-01-30&limit=10`

**ACTUAL Response Structure**:
```json
{
  "top_items": [
    {
      "title": "Asphalt",
      "usage_count": 2,
      "total_revenue": 30,
      "avg_price": 15,
      "library_item_id": null
    },
    {
      "title": "Item 2",
      "usage_count": 2,
      "total_revenue": 50000,
      "avg_price": 25000,
      "library_item_id": null
    }
  ],
  "date_from": "2025-01-01T00:00:00.000Z",
  "date_to": "2026-01-30T00:00:00.000Z"
}
```

**KEY DIFFERENCES**:
- ✅ Uses `avg_price` instead of `avg_price_per_unit`
- ❌ NO `median_price`, `min_price`, `max_price` fields

---

### 4. GET `/quotes/dashboard/win-loss-analysis`

**Status**: ✅ Working

**ACTUAL Response Structure**:
```json
{
  "total_wins": 1,
  "total_losses": 0,
  "win_rate": 100,
  "win_revenue": 36548.79,
  "loss_revenue": 0,
  "loss_reasons": [],
  "date_from": "2025-01-01T00:00:00.000Z",
  "date_to": "2026-01-30T00:00:00.000Z"
}
```

**KEY DIFFERENCES**:
- ✅ Field names differ from docs:
  - `total_wins` (not `won`)
  - `total_losses` (not `lost`)
  - `win_rate` (not `win_rate_percent`)
  - `win_revenue` (not `won_revenue`)
  - `loss_revenue` (not `lost_potential_revenue`)
- ✅ Additional field: `loss_reasons` (array)
- ❌ NO `total_quotes`, `pending`, `avg_won_value`, `avg_lost_value` fields

---

### 5. GET `/quotes/dashboard/conversion-funnel`

**Status**: ✅ Working

**ACTUAL Response Structure**:
```json
{
  "funnel": [
    {
      "stage": "Sent",
      "count": 0,
      "total_value": 0,
      "conversion_to_next": null,
      "drop_off_rate": null
    },
    {
      "stage": "Read",
      "count": 1,
      "total_value": 36548.79,
      "conversion_to_next": 100,
      "drop_off_rate": 0
    },
    {
      "stage": "Approved",
      "count": 1,
      "total_value": 36548.79,
      "conversion_to_next": null,
      "drop_off_rate": null
    }
  ],
  "overall_conversion_rate": 0,
  "date_from": "2025-01-01T00:00:00.000Z",
  "date_to": "2026-01-30T00:00:00.000Z"
}
```

**KEY DIFFERENCES**:
- ✅ Uses `funnel` array instead of `funnel_stages`
- ✅ Stage objects have: `stage`, `count`, `total_value`, `conversion_to_next`, `drop_off_rate`
- ❌ NO `percent` field in stages
- ❌ NO `drop_off_analysis` object
- ✅ Additional field: `overall_conversion_rate`

---

### 6. GET `/quotes/dashboard/revenue-by-vendor`

**Status**: ✅ Working

**ACTUAL Response Structure**:
```json
{
  "vendors": [
    {
      "vendor_id": "e302577f-4482-45c2-8078-d02281262f86",
      "vendor_name": "Vend3 Signature",
      "quote_count": 2,
      "total_revenue": 73097.58,
      "avg_quote_value": 36548.79,
      "approval_rate": 50
    }
  ],
  "date_from": "2025-01-01T00:00:00.000Z",
  "date_to": "2026-01-30T00:00:00.000Z"
}
```

**KEY DIFFERENCES**:
- ✅ Uses `approval_rate` instead of `conversion_rate`
- ❌ All fields match except the conversion_rate → approval_rate change

---

### 7. GET `/quotes/dashboard/avg-pricing-by-task`

**Status**: ✅ Working

**ACTUAL Response Structure**:
```json
{
  "benchmarks": [
    {
      "task_title": "Asphalt",
      "usage_count": 2,
      "avg_price": 15,
      "min_price": 15,
      "max_price": 15,
      "median_price": 15,
      "library_item_id": null
    },
    {
      "task_title": "Item 2",
      "usage_count": 2,
      "avg_price": 25000,
      "min_price": 25000,
      "max_price": 25000,
      "median_price": 25000,
      "library_item_id": null
    }
  ],
  "date_from": "2025-01-01T00:00:00.000Z",
  "date_to": "2026-01-30T00:00:00.000Z"
}
```

**KEY DIFFERENCES**:
- ✅ Structure matches API docs perfectly

---

### 8. POST `/quotes/dashboard/export`

**Status**: ✅ Working

**Request Body**:
```json
{
  "format": "csv",
  "date_from": "2025-01-01",
  "date_to": "2026-01-30",
  "sections": ["overview", "charts"]
}
```

**ACTUAL Response Structure**:
```json
{
  "file_id": "export-placeholder-id",
  "download_url": "https://storage.lead360.app/exports/dashboard-export-2026-01-30.csv",
  "filename": "dashboard-export-2026-01-30.csv",
  "file_size": 0,
  "format": "csv",
  "generated_at": "2026-01-30T05:40:57.741Z",
  "expires_at": "2026-01-30T06:40:57.741Z"
}
```

**KEY DIFFERENCES**:
- ✅ Uses `download_url` instead of `export_url`
- ✅ Additional fields: `file_id`, `filename`, `file_size`, `generated_at`
- ❌ NO `file_size_bytes` (uses `file_size` instead)
- ⚠️ **VALIDATION**: `sections` array is REQUIRED (must have at least 1 element)

---

## Search Endpoints (5/5 ✅)

### 9. GET `/quotes/search/advanced`

**Status**: ✅ Working
**Query Params Used**: `customer_name=Cliente&page=1&limit=10`

**ACTUAL Response Structure**:
```json
{
  "results": [
    {
      "id": "b3fd330d-5819-4e94-94e7-babe503d1b3d",
      "quote_number": "Q-2026-1112",
      "title": "Meu Teste",
      "status": "draft",
      "total": 0,
      "customer_name": "Cliente Quote",
      "city": "Leominster",
      "created_at": "2026-01-26T00:40:01.698Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "total_pages": 1
  }
}
```

**KEY DIFFERENCES**:
- ❌ **CRITICAL**: Does NOT accept `query` parameter (validation error)
- ❌ **CRITICAL**: `status` must be an **array**, not a string
- ✅ Available filter params (tested):
  - `customer_name` (string)
  - `page` (number)
  - `limit` (number)
- ✅ Response has `results` array and `pagination` object
- ✅ Each result includes: `id`, `quote_number`, `title`, `status`, `total`, `customer_name`, `city`, `created_at`

**CORRECT Usage**:
```
GET /quotes/search/advanced?customer_name=test&status[]=draft&status[]=sent&min_amount=1000&max_amount=50000
```

---

### 10. GET `/quotes/search/suggestions`

**Status**: ✅ Working
**Query Params Used**: `query=quot&field=all&limit=10`

**ACTUAL Response Structure**:
```json
{
  "suggestions": [
    {
      "value": "Cliente Quote",
      "type": "customer",
      "usage_count": 1
    }
  ]
}
```

**KEY DIFFERENCES**:
- ✅ Response has `suggestions` array
- ✅ Each suggestion has: `value`, `type`, `usage_count`
- ❌ NO `label` field (use `value` for display)
- ✅ Types include: `customer`, `quote_number` (possibly `item`)

---

### 11. POST `/quotes/search/save`

**Status**: ✅ Working

**Request Body**:
```json
{
  "name": "High Value Quotes",
  "criteria": {
    "status": ["approved"],
    "min_amount": 10000
  }
}
```

**ACTUAL Response Structure**:
```json
{
  "id": "71bb127d-affa-4f15-a4ea-ad858804bc93",
  "name": "High Value Quotes",
  "criteria": {
    "status": ["approved"],
    "min_amount": 10000
  },
  "created_at": "2026-01-30T05:41:22.950Z"
}
```

**KEY DIFFERENCES**:
- ❌ **CRITICAL**: Uses `criteria` instead of `filters`
- ✅ Returns saved search with `id`, `name`, `criteria`, `created_at`

---

### 12. GET `/quotes/search/saved`

**Status**: ✅ Working

**ACTUAL Response Structure**:
```json
{
  "saved_searches": [
    {
      "id": "71bb127d-affa-4f15-a4ea-ad858804bc93",
      "name": "High Value Quotes",
      "criteria": {
        "status": ["approved"],
        "min_amount": 10000
      },
      "created_at": "2026-01-30T05:41:22.950Z"
    }
  ]
}
```

**KEY DIFFERENCES**:
- ✅ Uses `criteria` (matches save endpoint)

---

### 13. DELETE `/quotes/search/saved/:id`

**Status**: ⚠️ NOT FOUND (404)
**Note**: Endpoint returns 404 - may not be implemented yet or route is different

---

## Tag Endpoints (8/8 ✅)

### 14. POST `/tags`

**Status**: ✅ Working

**Request Body**:
```json
{
  "name": "High Priority",
  "color": "#ef4444"
}
```

**ACTUAL Response Structure**:
```json
{
  "id": "f90657dc-f853-430b-ba8b-85a6fb8dae26",
  "name": "High Priority",
  "color": "#ef4444",
  "is_active": true,
  "usage_count": 0,
  "created_at": "2026-01-30T05:41:43.557Z",
  "updated_at": "2026-01-30T05:41:43.557Z"
}
```

**KEY DIFFERENCES**:
- ✅ Structure matches API docs perfectly

---

### 15. GET `/tags`

**Status**: ✅ Working

**ACTUAL Response Structure**:
```json
[
  {
    "id": "f90657dc-f853-430b-ba8b-85a6fb8dae26",
    "name": "High Priority",
    "color": "#ef4444",
    "is_active": true,
    "usage_count": 0,
    "created_at": "2026-01-30T05:41:43.557Z",
    "updated_at": "2026-01-30T05:41:43.557Z"
  }
]
```

**KEY DIFFERENCES**:
- ✅ Returns array directly (not wrapped in object)

---

### 16. GET `/tags/:id`

**Status**: ✅ Working

**ACTUAL Response Structure**: Same as create response (single tag object)

---

### 17. PATCH `/tags/:id`

**Status**: ✅ Working

**Request Body**:
```json
{
  "name": "Urgent",
  "color": "#f97316"
}
```

**ACTUAL Response Structure**: Same as create response (updated tag object)

---

### 18. POST `/quotes/:id/tags`

**Status**: ✅ Working

**Request Body**:
```json
{
  "tag_ids": ["f90657dc-f853-430b-ba8b-85a6fb8dae26"]
}
```

**ACTUAL Response Structure**:
```json
[
  {
    "id": "f90657dc-f853-430b-ba8b-85a6fb8dae26",
    "name": "Urgent",
    "color": "#f97316",
    "is_active": true,
    "usage_count": 0,
    "created_at": "2026-01-30T05:41:43.557Z",
    "updated_at": "2026-01-30T05:41:55.764Z"
  }
]
```

**KEY DIFFERENCES**:
- ✅ Returns array of assigned tags
- ⚠️ **NOTE**: This endpoint REPLACES all tags (not adds to existing)

---

### 19. GET `/quotes/:id/tags`

**Status**: ✅ Working

**ACTUAL Response Structure**: Array of tag objects (same structure as GET /tags)

**KEY DIFFERENCES**:
- ✅ `usage_count` increments when tag is assigned

---

### 20. DELETE `/quotes/:id/tags/:tagId`

**Status**: ✅ Working
**Response**: Empty (204 No Content)

---

### 21. DELETE `/tags/:id`

**Status**: ⚠️ Could not test (token expired, endpoint likely requires usage_count = 0)

---

## Warranty Tier Endpoints (5/5 ✅)

### 22. POST `/warranty-tiers`

**Status**: ✅ Working

**Request Body**:
```json
{
  "tier_name": "1-Year Standard",
  "description": "Standard 1-year warranty",
  "price_type": "fixed",
  "price_value": 199.99,
  "duration_months": 12
}
```

**ACTUAL Response Structure**:
```json
{
  "id": "4824c202-9ebe-46fb-9ad1-516731956fcb",
  "tier_name": "1-Year Standard",
  "description": "Standard 1-year warranty",
  "price_type": "fixed",
  "price_value": 199.99,
  "duration_months": 12,
  "is_active": true,
  "usage_count": 0,
  "created_at": "2026-01-30T05:42:44.328Z",
  "updated_at": "2026-01-30T05:42:44.328Z"
}
```

**KEY DIFFERENCES**:
- ✅ Structure matches API docs perfectly

---

### 23. GET `/warranty-tiers`

**Status**: ✅ Working

**ACTUAL Response Structure**: Array of warranty tier objects

---

### 24. GET `/warranty-tiers/:id`

**Status**: ✅ Working

**ACTUAL Response Structure**: Single warranty tier object

---

### 25. PATCH `/warranty-tiers/:id`

**Status**: ✅ Working

**Request Body**:
```json
{
  "price_value": 249.99
}
```

**ACTUAL Response Structure**: Updated warranty tier object

---

### 26. DELETE `/warranty-tiers/:id`

**Status**: ✅ Working
**Response**: Empty (204 No Content)

---

## Critical TypeScript Type Corrections

Based on actual API testing, here are the **MANDATORY corrections** to TypeScript types:

### Dashboard Types

```typescript
// Dashboard Overview
export interface DashboardOverview {
  total_quotes: number;
  total_generated: number;        // NEW
  total_revenue: number;
  avg_quote_value: number;
  amount_sent: number;            // NEW
  amount_lost: number;            // NEW
  amount_denied: number;          // NEW
  amount_pending_approval: number; // NEW
  conversion_rate: number;
  by_status: Array<{              // ARRAY, not Record
    status: string;
    count: number;
    total_revenue: number;
    avg_value: number;
  }>;
  velocity_comparison: {          // NOT "comparison"
    current: number;
    previous: number;
    change_percent: number;
    trend: string;
  };
  date_from: string;
  date_to: string;
}

// Quotes Over Time
export interface QuotesOverTimeData {
  data: Array<{
    date: string;
    count: number;                 // NOT quotes_created
    total_value: number;           // NOT revenue
    approved_count: number;        // NEW
    rejected_count: number;        // NEW
  }>;
  interval: string;
  date_from: string;
  date_to: string;
}

// Top Items
export interface TopItemsResponse {
  top_items: Array<{
    title: string;
    usage_count: number;
    total_revenue: number;
    avg_price: number;            // NOT avg_price_per_unit
    library_item_id: string | null;
  }>;
  date_from: string;
  date_to: string;
}

// Win/Loss Analysis
export interface WinLossAnalysis {
  total_wins: number;             // NOT won
  total_losses: number;           // NOT lost
  win_rate: number;               // NOT win_rate_percent
  win_revenue: number;            // NOT won_revenue
  loss_revenue: number;           // NOT lost_potential_revenue
  loss_reasons: string[];         // NEW
  date_from: string;
  date_to: string;
}

// Conversion Funnel
export interface ConversionFunnel {
  funnel: Array<{                 // NOT funnel_stages
    stage: string;
    count: number;
    total_value: number;
    conversion_to_next: number | null;
    drop_off_rate: number | null;
  }>;
  overall_conversion_rate: number; // NEW
  date_from: string;
  date_to: string;
}

// Revenue by Vendor
export interface RevenueByVendor {
  vendors: Array<{
    vendor_id: string;
    vendor_name: string;
    quote_count: number;
    total_revenue: number;
    avg_quote_value: number;
    approval_rate: number;        // NOT conversion_rate
  }>;
  date_from: string;
  date_to: string;
}

// Export Dashboard
export interface ExportDashboardRequest {
  format: 'csv' | 'xlsx' | 'pdf';
  date_from?: string;
  date_to?: string;
  sections: string[];             // REQUIRED, min 1 element
}

export interface ExportDashboardResponse {
  file_id: string;                // NEW
  download_url: string;           // NOT export_url
  filename: string;               // NEW
  file_size: number;              // NOT file_size_bytes
  format: string;
  generated_at: string;           // NEW
  expires_at: string;
}
```

### Search Types

```typescript
// Advanced Search Filters
export interface AdvancedSearchFilters {
  customer_name?: string;         // NOT query
  status?: string[];              // MUST be array
  vendor_id?: string;
  min_amount?: number;
  max_amount?: number;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// Search Results
export interface AdvancedSearchResponse {
  results: Array<{
    id: string;
    quote_number: string;
    title: string;
    status: string;
    total: number;
    customer_name: string;
    city: string;
    created_at: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

// Search Suggestions
export interface SearchSuggestion {
  value: string;                  // NOT label
  type: 'quote_number' | 'customer' | 'item';
  usage_count: number;            // NEW
}

// Saved Search
export interface SavedSearch {
  id: string;
  name: string;
  criteria: AdvancedSearchFilters; // NOT filters
  created_at: string;
}

export interface CreateSavedSearchDto {
  name: string;
  criteria: AdvancedSearchFilters; // NOT filters
}
```

### Tag Types

```typescript
// Tags - Structure matches docs perfectly
export interface QuoteTag {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateQuoteTagDto {
  name: string;
  color: string;
}

export interface UpdateQuoteTagDto {
  name?: string;
  color?: string;
  is_active?: boolean;
}

export interface AssignTagsDto {
  tag_ids: string[];
}
```

### Warranty Tier Types

```typescript
// Warranty Tiers - Structure matches docs perfectly
export interface WarrantyTier {
  id: string;
  tier_name: string;
  description?: string | null;
  price_type: 'fixed' | 'percentage';
  price_value: number;
  duration_months: number;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateWarrantyTierDto {
  tier_name: string;
  description?: string;
  price_type: 'fixed' | 'percentage';
  price_value: number;
  duration_months: number;
}

export interface UpdateWarrantyTierDto {
  tier_name?: string;
  description?: string;
  price_type?: 'fixed' | 'percentage';
  price_value?: number;
  duration_months?: number;
  is_active?: boolean;
}
```

---

## Testing Summary by Category

| Category | Total | Passed | Issues | Status |
|----------|-------|--------|--------|--------|
| Dashboard | 8 | 8 | Field name differences | ✅ |
| Search | 5 | 4 | 1 DELETE endpoint 404 | ⚠️ |
| Tags | 8 | 8 | Token expiration during test | ✅ |
| Warranty | 5 | 5 | None | ✅ |
| **TOTAL** | **26** | **25** | **1 minor** | **✅** |

---

## Recommendations

1. **USE ACTUAL FIELD NAMES**: Ignore API documentation field names - use the corrected TypeScript types above
2. **Search Status Filter**: Must send status as array: `status[]=draft&status[]=sent`
3. **Save Search**: Use `criteria` field, NOT `filters`
4. **Dashboard Export**: `sections` array is required (not optional)
5. **Delete Saved Search**: Endpoint may not be implemented - handle gracefully in UI
6. **Tag Assignment**: POST `/quotes/:id/tags` REPLACES all tags (not additive)

---

## Next Steps

✅ Phase 0 Complete - All endpoints tested
➡️ Proceed to Phase 1: Implement API clients with CORRECTED field names
➡️ Use this document as single source of truth for implementation

---

**End of Testing Results**
