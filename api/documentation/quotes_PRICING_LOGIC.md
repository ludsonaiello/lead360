# Quote Pricing Calculation Logic

**Version**: 1.0
**Last Updated**: January 2026
**Module**: Quotes
**Service**: QuotePricingService

---

## Overview

This document provides a comprehensive explanation of how quote financial totals are calculated in the Lead360 platform. All calculations use the `Decimal` type for precision and follow a specific order of operations.

---

## Financial Fields Stored in Database

The `quote` table stores 4 key financial fields:

| Field | Type | Description |
|-------|------|-------------|
| `subtotal` | DECIMAL(12,2) | Subtotal **before discounts** (includes profit, overhead, contingency markups) |
| `tax_amount` | DECIMAL(12,2) | Calculated tax amount (subtotal after discounts × tax rate) |
| `discount_amount` | DECIMAL(12,2) | Total discount amount from all discount rules |
| `total` | DECIMAL(12,2) | Final total (subtotal - discount_amount + tax_amount) |

**Important**: All values are stored with 2 decimal places for monetary precision.

---

## Order of Operations

Quote financial calculations follow this exact sequence:

```
1. Calculate Item Subtotal
   ↓
2. Apply Profit Markup (compounding)
   ↓
3. Apply Overhead Markup (compounding)
   ↓
4. Apply Contingency Markup (compounding)
   ↓
5. Calculate Subtotal Before Discounts → stored in quote.subtotal
   ↓
6. Apply Discount Rules (percentage first, then fixed amount)
   ↓
7. Calculate Total Discount Amount → stored in quote.discount_amount
   ↓
8. Calculate Subtotal After Discounts
   ↓
9. Calculate Tax Amount → stored in quote.tax_amount
   ↓
10. Calculate Final Total → stored in quote.total
```

---

## Detailed Calculation Formulas

### 1. Item Subtotal

**Formula**:
```
Item Subtotal = SUM(all quote_item.total_cost)
```

**Notes**:
- Only includes items where `is_deleted = false`
- Each item's `total_cost` is calculated as:
  ```
  total_cost = (material_cost + labor_cost + equipment_cost + subcontract_cost + other_cost) × quantity
  ```

**Example**:
```
Item 1: total_cost = $500
Item 2: total_cost = $300
Item 3: total_cost = $200
---
Item Subtotal = $1000
```

---

### 2-4. Markup Application (Profit, Overhead, Contingency)

**Formulas** (compounding):
```
Profit Amount = Item Subtotal × (Profit % ÷ 100)

Overhead Amount = (Item Subtotal + Profit Amount) × (Overhead % ÷ 100)

Contingency Amount = (Item Subtotal + Profit + Overhead) × (Contingency % ÷ 100)

Subtotal Before Discounts = Item Subtotal + Profit + Overhead + Contingency
```

**Percentage Resolution** (priority order):
1. Quote custom percentage (`custom_profit_percent`, `custom_overhead_percent`, `custom_contingency_percent`)
2. Tenant default percentage (`default_profit_margin`, `default_overhead_rate`, `default_contingency_rate`)
3. System default percentage (20%, 10%, 5%)

**Example** (20% profit, 10% overhead, 5% contingency):
```
Item Subtotal:        $1000.00
Profit (20%):         $  200.00  (1000 × 0.20)
Subtotal + Profit:    $1200.00
Overhead (10%):       $  120.00  (1200 × 0.10)
Subtotal + O + P:     $1320.00
Contingency (5%):     $   66.00  (1320 × 0.05)
---
Subtotal Before Discounts: $1386.00
```

**Note**: Markups are **compounding** - each applies to the running subtotal, not the original item subtotal.

---

### 5-7. Discount Application

**Discount Rules**:
- Stored in `quote_discount_rule` table
- Each rule has:
  - `rule_type`: 'percentage' or 'fixed_amount'
  - `value`: Discount value (percentage 0-100 or dollar amount)
  - `order_index`: Order of application
  - `reason`: Audit trail description

**Application Order**:
1. Sort all rules by `order_index`
2. Apply all **percentage** discounts first (in order)
3. Then apply all **fixed amount** discounts (in order)

**Formula** (running calculation):
```
For each percentage discount:
  Discount Amount = Current Subtotal × (Value ÷ 100)
  Current Subtotal = Current Subtotal - Discount Amount

For each fixed amount discount:
  Discount Amount = Value
  Current Subtotal = Current Subtotal - Discount Amount

Total Discount Amount = SUM(all discount amounts)
Subtotal After Discounts = Subtotal Before Discounts - Total Discount Amount
```

**Example** (10% discount, then $50 fixed discount):
```
Subtotal Before Discounts:  $1386.00

Discount 1 (10%):           $  138.60  (1386 × 0.10)
After Discount 1:           $1247.40

Discount 2 ($50 fixed):     $   50.00
After Discount 2:           $1197.40

Total Discount Amount:      $  188.60
Subtotal After Discounts:   $1197.40
```

**Edge Case**: If total discount exceeds subtotal, discount is **capped at subtotal** to prevent negative values.

---

### 8-9. Tax Calculation

**Formula**:
```
Tax Amount = Subtotal After Discounts × (Tax Rate ÷ 100)
```

**Tax Rate Resolution** (priority order):
1. Tenant `sales_tax_rate` (DECIMAL 5,3 for precision)
2. System default: 0 (no tax)

**Example** (8% tax):
```
Subtotal After Discounts:  $1197.40
Tax Rate:                  8%
Tax Amount:                $   95.79  (1197.40 × 0.08)
```

**Note**: Tax is ALWAYS calculated on the **subtotal after discounts**, not before.

---

### 10. Final Total

**Formula**:
```
Total = Subtotal After Discounts + Tax Amount
```

**Example**:
```
Subtotal After Discounts:  $1197.40
Tax Amount:                $   95.79
---
Total:                     $1293.19
```

---

## Complete Example Walkthrough

**Given**:
- 3 quote items with costs: $500, $300, $200
- Profit: 20%
- Overhead: 10%
- Contingency: 5%
- Discount 1: 10% off
- Discount 2: $50 fixed
- Tax rate: 8%

**Calculation**:

| Step | Description | Calculation | Result |
|------|-------------|-------------|--------|
| 1 | Item Subtotal | 500 + 300 + 200 | $1000.00 |
| 2 | Profit (20%) | 1000 × 0.20 | $200.00 |
| 3 | Overhead (10%) | 1200 × 0.10 | $120.00 |
| 4 | Contingency (5%) | 1320 × 0.05 | $66.00 |
| 5 | **Subtotal Before Discounts** | 1000 + 200 + 120 + 66 | **$1386.00** |
| 6 | Discount 1 (10%) | 1386 × 0.10 | $138.60 |
| 7 | After Discount 1 | 1386 - 138.60 | $1247.40 |
| 8 | Discount 2 ($50) | Fixed | $50.00 |
| 9 | **Subtotal After Discounts** | 1247.40 - 50 | **$1197.40** |
| 10 | **Total Discount Amount** | 138.60 + 50 | **$188.60** |
| 11 | Tax (8%) | 1197.40 × 0.08 | $95.79 |
| 12 | **Tax Amount** | | **$95.79** |
| 13 | **Final Total** | 1197.40 + 95.79 | **$1293.19** |

**Database Values**:
```sql
quote.subtotal = 1386.00
quote.discount_amount = 188.60
quote.tax_amount = 95.79
quote.total = 1293.19
```

---

## When Calculations Are Triggered

The `QuotePricingService.updateQuoteFinancials()` method is called automatically whenever:

1. **Quote Item Operations**:
   - Item created
   - Item updated (quantity, costs, etc.)
   - Item deleted
   - Item duplicated

2. **Quote Group Operations**:
   - Group created with items
   - Items moved between groups

3. **Discount Rule Operations** (when implemented):
   - Discount rule added
   - Discount rule updated
   - Discount rule deleted

4. **Settings Changes** (when implemented):
   - Tenant tax rate updated
   - Quote custom percentages updated (profit/overhead/contingency)

---

## Edge Cases & Handling

### 1. No Items in Quote
**Behavior**: All financial fields set to 0
```
subtotal = 0
discount_amount = 0
tax_amount = 0
total = 0
```

### 2. No Discount Rules
**Behavior**: Skip discount step
```
discount_amount = 0
subtotal_after_discounts = subtotal_before_discounts
```

### 3. No Tax Rate (NULL)
**Behavior**: Set tax to 0
```
tax_amount = 0
total = subtotal_after_discounts
```

### 4. Discount Exceeds Subtotal
**Behavior**: Cap discount at subtotal, log warning
```
total_discount = MIN(calculated_discount, subtotal_before_discounts)
subtotal_after_discounts = MAX(0, subtotal_before_discounts - total_discount)
```

### 5. Custom Percentages NULL
**Behavior**: Fall back to tenant defaults, then system defaults
```
profit = quote.custom_profit_percent
         ?? tenant.default_profit_margin
         ?? 20%
```

---

## Transaction Safety

**Critical**: All financial calculations MUST occur within a database transaction.

**Pattern**:
```typescript
await prisma.$transaction(async (tx) => {
  // 1. Update item
  await tx.quote_item.update({...});

  // 2. Recalculate quote financials (WITHIN SAME TRANSACTION)
  await pricingService.updateQuoteFinancials(quoteId, tx);

  // 3. Create version
  await versionService.createVersion(..., tx);
});
```

**Rationale**:
- Prevents partial updates (item saved but totals not recalculated)
- Ensures version snapshots have correct financial data
- Maintains data integrity across related tables

---

## Decimal Precision

**Rule**: All financial calculations use `Decimal` type from Prisma, NEVER JavaScript `Number`.

**Reason**: JavaScript `Number` uses floating-point arithmetic which causes precision errors:
```javascript
// BAD (precision loss)
0.1 + 0.2 === 0.3  // false (0.30000000000000004)

// GOOD (precise)
new Decimal('0.1').add('0.2').toString()  // '0.3'
```

**Implementation**:
```typescript
import { Decimal } from '@prisma/client/runtime/library';

// Calculations
const profit = itemSubtotal.mul(profitPercent).div(100);

// Storage
quote.update({
  data: {
    total: new Decimal(calculatedTotal),
  },
});

// API Response (convert to number for JSON)
return {
  total: Number(quote.total),
};
```

---

## Troubleshooting

### Problem: Quote totals don't update after item change

**Diagnosis**:
1. Check if `updateQuoteFinancials()` is called after item operation
2. Verify operation is within a transaction
3. Check for errors in logs

**Fix**: Ensure `pricingService.updateQuoteFinancials(quoteId, tx)` is called in the transaction.

---

### Problem: Discount not being applied

**Diagnosis**:
1. Check if discount rule exists in `quote_discount_rule` table
2. Verify `order_index` is set correctly
3. Check if discount is percentage or fixed amount
4. Verify `apply_to` field (currently unused, all apply to subtotal)

**Fix**: Ensure discount rule is properly created and linked to quote.

---

### Problem: Tax calculation is wrong

**Diagnosis**:
1. Check `tenant.sales_tax_rate` value
2. Verify tax is calculated on **subtotal after discounts**, not before
3. Check for rounding issues (should use 2 decimal places)

**Fix**: Verify tax rate is correct percentage (e.g., 8.25 for 8.25%, not 0.0825).

---

### Problem: Markups seem incorrect

**Diagnosis**:
1. Verify markups are **compounding**, not additive
2. Check which percentage values are being used (custom vs defaults)
3. Verify profit applies first, then overhead, then contingency

**Debug**:
```typescript
// Enable debug logging
this.logger.debug(`Effective percentages - Profit: ${profitPercent}%, ...`);
```

---

## API Endpoint for Financial Breakdown

**Future Enhancement** (not yet implemented):

```http
GET /api/v1/quotes/:id/financial-breakdown
```

**Response**:
```json
{
  "itemSubtotal": 1000.00,
  "profitAmount": 200.00,
  "overheadAmount": 120.00,
  "contingencyAmount": 66.00,
  "subtotalBeforeDiscounts": 1386.00,
  "discountAmount": 188.60,
  "subtotalAfterDiscounts": 1197.40,
  "taxAmount": 95.79,
  "total": 1293.19,
  "effectivePercentages": {
    "profit": 20,
    "overhead": 10,
    "contingency": 5,
    "taxRate": 8
  },
  "discountBreakdown": [
    {
      "ruleName": "10% discount",
      "ruleType": "percentage",
      "value": 10,
      "discountAmount": 138.60
    },
    {
      "ruleName": "$50 fixed discount",
      "ruleType": "fixed_amount",
      "value": 50,
      "discountAmount": 50.00
    }
  ]
}
```

---

## Testing & Validation

**Unit Tests**: [quote-pricing.service.spec.ts](../src/modules/quotes/services/quote-pricing.service.spec.ts)

**Manual Test Checklist**:
1. ✅ Create quote with 3 items → Verify subtotal = sum of items
2. ✅ Set 20% profit, 10% overhead, 5% contingency → Verify markups applied correctly
3. ✅ Add 15% discount rule → Verify discount calculated and total reduced
4. ✅ Add $100 fixed discount → Verify both discounts stack correctly
5. ✅ Set tenant tax rate to 8.5% → Verify tax calculated correctly
6. ✅ Verify final total = subtotal - discount + tax
7. ✅ Update item quantity → Verify automatic recalculation
8. ✅ Delete item → Verify automatic recalculation
9. ✅ Create quote with no discount rules → Verify discount = 0
10. ✅ Create quote with no tax rate → Verify tax = 0

**Database Validation Query**:
```sql
SELECT
  quote_number,
  subtotal,
  discount_amount,
  tax_amount,
  total,
  (subtotal - discount_amount + tax_amount) as calculated_total,
  CASE
    WHEN ABS(total - (subtotal - discount_amount + tax_amount)) < 0.01
    THEN '✅ CORRECT'
    ELSE '❌ MISMATCH'
  END as validation
FROM quote
WHERE id = 'quote-id';
```

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0 | Jan 2026 | Initial pricing logic documentation | Dev 3+ |

---

**End of Pricing Logic Documentation**
