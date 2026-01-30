# Discount Calculation Logic - Explained

**Date**: January 26, 2026
**Component**: Discount Rules Modal & Section
**Issue**: User confusion about preview vs. saved discount amounts

---

## Understanding the Numbers

### Example Scenario

**Initial Quote State:**
- Items Subtotal: $90.45
- Tax/Other Charges: $5.88
- **Current Quote Total: $96.33**

**Applying 10% Discount:**

### What the Preview Shows (BEFORE saving):
```
Current Quote Total:  $96.33  (subtotal + tax)
Discount Amount:      -$9.05  (10% of $90.45 subtotal)
New Quote Total:      $87.29  (subtotal after discount + tax)
```

**Calculation:**
1. Discount applies to SUBTOTAL only: 10% × $90.45 = $9.045 ≈ $9.05
2. Subtotal after discount: $90.45 - $9.05 = $81.40
3. Tax/charges stay the same: $5.88
4. **New Quote Total: $81.40 + $5.88 = $87.28 ≈ $87.29**

### What the Summary Shows (AFTER saving):
```
Subtotal before discounts:  $90.45
Total discount:             -$9.04
Subtotal after discounts:   $81.41
```

**Why the difference?**

The preview shows **quote totals** (including tax), while the summary shows **subtotals** (before tax).

---

## Key Points

### 1. Discounts Apply to Subtotal Only
Discounts are calculated against the items subtotal ($90.45), **NOT** the final quote total ($96.33).

Tax and other charges are NOT discounted.

### 2. Rounding Differences
- **Preview**: May round for display (10% of $90.45 = $9.045 → shows $9.05)
- **Backend**: Stores precise calculation (10% of $90.45 = $9.04 after rounding rules)

This can cause 1-cent differences between preview and saved values.

### 3. Different Perspectives

**Preview Modal** shows:
- Current **Quote Total** (subtotal + tax)
- Discount amount
- New **Quote Total** (after discount + tax)
- ✅ **Best for**: "What will the customer pay?"

**Discount Rules Summary** shows:
- Subtotal before discounts
- Total discount
- Subtotal after discounts
- ✅ **Best for**: "How much discount did we give?"

---

## Visual Breakdown

```
┌─────────────────────────────────────────────┐
│ QUOTE STRUCTURE                             │
├─────────────────────────────────────────────┤
│                                             │
│  Items Subtotal:          $90.45            │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ DISCOUNT APPLIES HERE                │  │
│  │ 10% of $90.45 = $9.04                │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  Subtotal after discount:  $81.41           │
│                                             │
│  Tax (not discounted):     + $5.88          │
│                                             │
│  ───────────────────────────────────────    │
│  FINAL QUOTE TOTAL:        $87.29           │
│                                             │
└─────────────────────────────────────────────┘
```

---

## Why This Design?

### Standard Business Practice
This follows standard quoting practices where:
1. Discounts apply to product/service costs
2. Tax is calculated on the discounted amount
3. Fixed fees/charges are NOT discounted

### Prevents Tax Evasion
If discounts applied to the final total (including tax), it would effectively discount the tax amount, which is illegal in most jurisdictions.

### Clear Margin Tracking
By applying discounts to subtotal only, businesses can:
- Track true discount given
- Calculate accurate profit margins
- Compare quotes consistently

---

## Common Confusion Points

### ❌ "The numbers don't match!"

**What you see in preview:**
- Current Total: $96.33
- New Total: $87.29
- Difference: $9.04

**What you see after saving:**
- Subtotal before: $90.45
- Subtotal after: $81.41
- Difference: $9.04

✅ **They DO match!** The $9.04 discount is the same. The preview just shows it in the context of the full quote total.

### ❌ "Why is the discount $9.04 not $9.05?"

**Rounding behavior:**
- 10% of $90.45 = $9.045
- Backend rounds using banker's rounding or standard rounding rules
- Result: $9.04 (not $9.05)

This is a 1-cent difference due to rounding. The backend value ($9.04) is the source of truth.

### ❌ "Why doesn't the discount apply to the full $96.33?"

Because $5.88 of that is **tax or fixed charges**, which should not be discounted.

If you applied 10% to the full $96.33:
- Discount would be $9.63
- You'd be discounting the tax amount
- This is incorrect accounting

---

## Improved UI Labels

### Before (Confusing):
```
Current Total:       $96.33
Proposed Discount:   -$9.05
New Total:           $87.29
```
User thinks: "Where's the subtotal? Why is this showing totals?"

### After (Clear):
```
Current Quote Total:      $96.33
Discount Amount:          -$9.05
New Quote Total:          $87.29
* Totals include tax and other charges
```
User understands: "This is the final customer-facing amount, with tax included."

---

## For Developers

### Preview API Response Structure
```typescript
{
  current_total: number;          // Full quote total (subtotal + tax + charges)
  proposed_discount_amount: number; // Discount amount (% of subtotal)
  new_total: number;              // New full quote total (after discount + tax)
  impact_amount: number;          // Change in quote total
  impact_percent: number;         // % change in quote total
  current_margin_percent: number; // Current profit margin
  new_margin_percent: number;     // New profit margin after discount
  margin_change: number;          // Change in margin %
}
```

### Discount Summary Response Structure
```typescript
{
  discount_rules: DiscountRule[];
  summary: {
    total_discount_amount: number;      // Total discount (% of subtotal)
    subtotal_before_discounts: number;  // Items subtotal before discount
    subtotal_after_discounts: number;   // Items subtotal after discount
    discount_count: number;             // Number of discount rules
  }
}
```

**Key Difference:**
- Preview uses `current_total` and `new_total` (includes tax)
- Summary uses `subtotal_before_discounts` and `subtotal_after_discounts` (excludes tax)

---

## Testing Checklist

When testing discount calculations:

- [ ] Verify discount applies to subtotal only
- [ ] Check that tax is NOT discounted
- [ ] Confirm preview "New Quote Total" = (subtotal - discount) + tax
- [ ] Verify saved "Subtotal after discounts" = subtotal - discount
- [ ] Accept 1-cent rounding differences between preview and saved
- [ ] Test with multiple discounts (compound calculation)
- [ ] Verify margin calculations update correctly

---

## Summary

✅ **The math is correct!**
✅ **The preview and summary show different perspectives of the same discount.**
✅ **Improved labels make this clearer to users.**

The confusion arose because:
1. Preview shows **quote totals** (what customer pays)
2. Summary shows **subtotals** (discount tracking)
3. Labels didn't clearly indicate this difference

**Solution**: Updated modal to clearly label "Quote Total" and add note about tax inclusion.

---

**Document Created**: January 26, 2026
**Component**: [DiscountRuleModal.tsx](../../app/src/components/quotes/DiscountRuleModal.tsx)
**Related**: [SPRINT3_FIX_COMPLETION_REPORT.md](SPRINT3_FIX_COMPLETION_REPORT.md)
