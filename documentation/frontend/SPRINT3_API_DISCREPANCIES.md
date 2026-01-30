# Sprint 3 API Testing - Discrepancies Found

**Date**: January 26, 2026
**Tested By**: Frontend Development Agent
**Backend Version**: 1.0

## Summary

Tested all 14 Sprint 3 endpoints and found **significant discrepancies** between the REST API documentation (`quotes_REST_API.md`) and the actual backend implementation. This document details all findings.

---

## Test Results

### ✅ WORKING ENDPOINTS (13/14)

1. **POST /quotes/:quoteId/discount-rules** - Create percentage discount ✓
2. **POST /quotes/:quoteId/discount-rules** - Create fixed amount discount ✓
3. **GET /quotes/:quoteId/discount-rules** - List discount rules ✓
4. **GET /quotes/:quoteId/discount-rules/:ruleId** - Get single rule ✓
5. **PATCH /quotes/:quoteId/discount-rules/:ruleId** - Update rule ✓
6. **DELETE /quotes/:quoteId/discount-rules/:ruleId** - Delete rule ✓
7. **POST /quotes/:quoteId/discount-rules/preview** - Preview impact ✓
8. **GET /quotes/:quoteId/profitability/validate** - Validate profitability ✓
9. **GET /quotes/:quoteId/profitability/analysis** - Analyze margins ✓
10. **POST /quotes/:quoteId/draw-schedule** - Create schedule ✓
11. **GET /quotes/:quoteId/draw-schedule** - Get schedule ✓
12. **PATCH /quotes/:quoteId/draw-schedule** - Update schedule ✓
13. **DELETE /quotes/:quoteId/draw-schedule** - Delete schedule ✓

### ❌ BROKEN ENDPOINTS (1/14)

14. **PATCH /quotes/:quoteId/discount-rules/reorder** - Reorder rules ❌
    - **Error**: `property discount_rules should not exist`
    - **Attempted**: Both `rule_orders` (from docs) and `discount_rules` (from DTO)
    - **Status**: Backend validation issue - needs investigation

---

## Critical Discrepancies

### 1. Discount Rules - List Response Structure

**Documentation says:**
```typescript
{
  discount_rules: DiscountRule[];
  total_discount: number;
  subtotal_before_discount: number;
  subtotal_after_discount: number;
}
```

**Actual API returns:**
```json
{
  "discount_rules": [...],
  "summary": {
    "total_discount_amount": 59.04,
    "subtotal_before_discounts": 90.45,
    "subtotal_after_discounts": 31.41,
    "discount_count": 2
  }
}
```

**Impact**: Types must use nested `summary` object with different property names.

---

### 2. Discount Rules - Preview Response Structure

**Documentation says:**
```typescript
{
  current_subtotal: number;
  current_discount: number;
  current_total: number;
  new_discount_amount: number;
  new_subtotal_after_discount: number;
  new_total: number;
  margin_before: number;
  margin_after: number;
  margin_impact: number;
}
```

**Actual API returns:**
```json
{
  "current_total": 28.63,
  "proposed_discount_amount": 18.09,
  "new_total": 74.11,
  "impact_amount": -45.48,
  "impact_percent": -158.85,
  "current_margin_percent": -127.03,
  "new_margin_percent": 12.29,
  "margin_change": 139.33
}
```

**Impact**: Completely different property names. No `current_discount` or `new_discount_amount`.

---

### 3. Discount Rules - Reorder DTO

**Documentation says:**
```json
{
  "rule_orders": [
    {"rule_id": "uuid", "order_index": 1}
  ]
}
```

**Backend DTO expects:**
```typescript
{
  discount_rules: [
    {id: "uuid", new_order_index: number}
  ]
}
```

**Both fail with validation error!**

**Impact**: Endpoint is non-functional. Backend investigation required.

---

### 4. Profitability - Validation Response Structure

**Documentation says:**
```typescript
{
  is_profitable: boolean;
  margin_percent: number;
  profit_amount: number;
  warnings: string[];
  thresholds: {
    minimum_margin: number;
    target_margin: number;
  };
}
```

**Actual API returns:**
```json
{
  "quote_id": "uuid",
  "is_valid": true,
  "can_send": true,
  "margin_percent": 20.62,
  "warning_level": "yellow",
  "thresholds": {
    "target": 25,
    "minimum": 15,
    "hard_floor": 10
  },
  "financial_summary": {
    "total_cost": 65,
    "total_revenue": 81.88,
    "gross_profit": 16.88,
    "discount_amount": 13.57,
    "tax_amount": 5,
    "subtotal_before_discount": 90.45
  },
  "warnings": [...],
  "recommendations": [...]
}
```

**Impact**:
- Missing: `is_profitable` property (use `is_valid` instead)
- Missing: `profit_amount` property (use `financial_summary.gross_profit`)
- Extra: `quote_id`, `can_send`, `warning_level`, `financial_summary`, `recommendations`
- Threshold properties: `minimum_margin` → `minimum`, `target_margin` → `target`, plus new `hard_floor`

---

### 5. Profitability - Analysis Response Structure

**Documentation says:**
```typescript
{
  overall_margin_percent: number;
  overall_profit_amount: number;
  cost_breakdown: {...};
  revenue_breakdown: {...};
  margin_by_category: Array<{...}>;
  item_analysis: Array<{...}>;
}
```

**Actual API returns:**
```json
{
  "quote_id": "uuid",
  "quote_total": 81.88,
  "overall_margin_percent": 28.14,
  "markup_settings": {
    "profit_percent": 10,
    "overhead_percent": 15,
    "contingency_percent": 10,
    "total_markup_multiplier": 1.3915
  },
  "items_analysis": [...],
  "groups_analysis": [...],
  "low_margin_items": [],
  "high_margin_items": [],
  "summary": {
    "total_items": 2,
    "healthy_items": 2,
    "acceptable_items": 0,
    "low_margin_items": 0,
    "critical_items": 0
  }
}
```

**Impact**:
- Missing: `overall_profit_amount`, `cost_breakdown`, `revenue_breakdown`, `margin_by_category`, `item_analysis`
- Extra: `quote_id`, `quote_total`, `markup_settings`, `groups_analysis`, `low_margin_items`, `high_margin_items`, `summary`
- Property renamed: `item_analysis` → `items_analysis`

**CRITICAL**: The response structure is completely different. Documentation describes a detailed cost breakdown that doesn't exist in the actual response.

---

### 6. Draw Schedule - Entry Structure

**Documentation says:**
```typescript
{
  entries: Array<{
    draw_number: number;
    description: string;
    percentage: number;
    due_on_event: string;
  }>
}
```

**Backend DTO expects:**
```typescript
{
  calculation_type: "percentage" | "fixed_amount";
  entries: Array<{
    draw_number: number;
    description: string;
    value: number;  // NOT "percentage"!
  }>
}
```

**Impact**:
- Missing required field: `calculation_type`
- Property renamed: `percentage` → `value`
- Missing field: `due_on_event` (doesn't exist in backend!)

---

### 7. Draw Schedule - GET Response

**Documentation says:**
```typescript
{
  quote_id: string;
  entries: DrawEntry[];
  total_amount: number;
  is_valid: boolean;
}
```

**Actual API returns:**
```json
{
  "quote_id": "uuid",
  "quote_total": 81.88,
  "calculation_type": "percentage",
  "entries": [
    {
      "id": "uuid",
      "draw_number": 1,
      "description": "...",
      "value": 30,
      "calculated_amount": 24.564,
      "running_total": 24.564,
      "percentage_of_total": 30,
      "created_at": "..."
    }
  ],
  "validation": {
    "is_valid": true,
    "percentage_sum": 100,
    "amount_sum": 81.88,
    "variance": 0,
    "variance_percent": 0
  }
}
```

**Impact**:
- Missing: `total_amount` (use `quote_total` instead)
- Missing: `is_valid` at root level (moved to `validation.is_valid`)
- Extra: `calculation_type`, `validation` object with detailed breakdown
- Entry structure completely different: has `calculated_amount`, `running_total`, `percentage_of_total`

---

## Recommendations

### Immediate Actions Required

1. **Fix Reorder Endpoint** - Backend team must investigate validation issue
2. **Update API Documentation** - All discrepancies above must be corrected
3. **Update Frontend Types** - All TypeScript interfaces must match actual API
4. **Update UI Components** - Adjust to work with correct data structures

### Code Changes Needed

**Files to update:**
1. `/app/src/lib/types/quotes.ts` - Update all Sprint 3 types
2. `/app/src/lib/api/discount-rules.ts` - Fix request/response handling
3. `/app/src/lib/api/profitability.ts` - Fix response types
4. `/app/src/lib/api/draw-schedule.ts` - Fix request/response structures
5. All UI components using these types

---

## Test Account Used

- **Email**: contact@honeydo4you.com
- **Role**: Owner
- **Tenant ID**: 14a34ab2-6f6f-4e41-9bea-c444a304557e
- **Quote ID**: ddeb7a70-e5b3-4bcd-bbc5-0aaf86b484d3

---

## Conclusion

While 13 out of 14 endpoints are functional, the API documentation is **significantly inaccurate**. All frontend code must be updated to match the actual backend implementation, not the documentation.

**Priority**: HIGH - These discrepancies will cause runtime errors if not addressed.
