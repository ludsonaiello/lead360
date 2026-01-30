# Sprint 3: Pricing, Discounts & Draw Schedule

**Agent**: Frontend Developer 3  
**Duration**: 6 days  
**Prerequisites**: Sprint 1-2 complete  
**Read First**: `QUOTE_FRONTEND_GLOBAL_INSTRUCTIONS.md`

---

## YOUR DOCUMENTATION

**API Sections to Read**:
- `api/documentation/quotes_REST_API.md` - Discount Rules (8 endpoints)
- `api/documentation/quotes_REST_API.md` - Profitability Analysis (2 endpoints)
- `api/documentation/quotes_REST_API.md` - Draw Schedule (4 endpoints)

Total: 14 endpoints

---

## YOUR MISSION

Build financial management:
- Discount rules (percentage and fixed amount)
- Discount preview calculator
- Profitability validation and analysis
- Draw schedule (payment milestones)

---

## COMPONENTS TO BUILD

### Within Quote Detail Page

1. **Discount Rules Section**
   - List active discounts in order
   - Drag-and-drop reordering
   - Display: type, value, reason, calculated amount
   - Total discount summary
   - Add/edit/delete actions

2. **Add/Edit Discount Modal**
   - Type selector (percentage or fixed)
   - Value input (with appropriate mask)
   - Reason field
   - Preview calculator showing impact
   - Save/cancel

3. **Discount Preview Panel**
   - Before/after comparison
   - Margin impact indicator
   - Warning if margin too low

4. **Profitability Widget**
   - Overall margin percentage
   - Color-coded status (green/yellow/red)
   - Profit amount
   - Link to detailed analysis

5. **Profitability Analysis Modal**
   - Margin by cost category
   - Item-by-item breakdown
   - Threshold warnings
   - Recommendations

6. **Draw Schedule Builder**
   - Table of payment entries
   - Fields: draw number, description, percentage, amount (calculated)
   - Add/remove rows
   - Validation: percentages must sum to 100%
   - Visual running total indicator

---

## KEY REQUIREMENTS

### Discount Rule Order
Read API documentation on discount calculation:
- Order matters (discounts compound)
- Sequential application
- Reordering changes final price

Show warning to users about compound calculation.

### Discount Preview
Must show:
- Current subtotal
- Current total discount
- New discount impact
- Resulting subtotal
- Margin before/after
- Visual indicator if margin unsafe

### Profitability Thresholds
API documentation defines threshold levels:
- Fetch from quote settings
- Compare quote margin to thresholds
- Display appropriate color coding and warnings

### Draw Schedule Validation
Critical validation from API:
- Percentages must sum to exactly 100.00%
- Draw numbers must be sequential (1, 2, 3...)
- Each entry requires description

Implement real-time validation:
- Show running total
- Highlight if not 100%
- Disable save if invalid

---

## TESTING CHECKLIST

Test with both accounts:
- [ ] Add percentage discount
- [ ] Add fixed amount discount
- [ ] Add multiple discounts (verify compound calculation)
- [ ] Preview discount before saving
- [ ] Reorder discounts (verify totals change)
- [ ] Edit discount
- [ ] Delete discount
- [ ] View profitability widget
- [ ] View detailed profitability analysis
- [ ] Test with high margin quote (green)
- [ ] Test with low margin quote (red)
- [ ] Create draw schedule (3 entries summing to 100%)
- [ ] Test draw schedule validation (99% total - must error)
- [ ] Test draw schedule validation (101% total - must error)
- [ ] Edit draw schedule
- [ ] Delete draw entry
- [ ] Delete entire draw schedule

---

## COMPLETION CRITERIA

Sprint 3 complete when:
- All 14 endpoints have working UI
- Discount rules work (add, edit, delete, reorder)
- Discount preview accurate
- Profitability dashboard displays correctly
- Profitability analysis shows breakdown
- Draw schedule builder functional
- Draw schedule validation enforces 100% rule
- All endpoints tested with both accounts
- All calculations display accurately

---

**Next Sprint**: Developer 4 builds approval workflow, version history, and change orders.