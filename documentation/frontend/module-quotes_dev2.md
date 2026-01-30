# Sprint 2: Items, Groups & Library

**Agent**: Frontend Developer 2  
**Duration**: 8 days  
**Prerequisites**: Sprint 1 complete  
**Read First**: `QUOTE_FRONTEND_GLOBAL_INSTRUCTIONS.md`

---

## YOUR DOCUMENTATION

**API Sections to Read**:
- `api/documentation/quotes_REST_API.md` - Quote Items (12 endpoints)
- `api/documentation/quotes_REST_API.md` - Quote Groups (8 endpoints)
- `api/documentation/quotes_REST_API.md` - Item Library (10 endpoints)
- `api/documentation/quotes_REST_API.md` - Unit Measurements (6 endpoints)
- `api/documentation/quotes_REST_API.md` - Bundles (8 endpoints)

Total: 44 endpoints

---

## YOUR MISSION

Build quote content management:
- Add/edit/delete items in quotes
- Organize items into groups
- Item library (save, reuse, bulk import)
- Unit measurements (global + custom)
- Bundles (packages of items)

---

## COMPONENTS TO BUILD

### Within Quote Detail Page

1. **Items List Section**
   - Display all items (grouped and ungrouped)
   - Drag-and-drop reordering
   - Collapsible groups
   - Item cost breakdown (expandable)
   - Actions per item: edit, duplicate, move to group, delete
   - Empty state
   - Add buttons: "Add Item", "Add from Library", "Create Group"

2. **Item Form** (modal or page)
   - Title, description
   - Quantity with decimals
   - Unit selector (searchable)
   - Cost breakdown (material, labor, equipment, subcontract, other)
   - Group selector (optional)
   - "Save to Library" option

3. **Add from Library Modal**
   - Search library items
   - Filter and sort
   - Item preview
   - Select to add to quote

4. **Group Management**
   - Create group modal
   - Edit group modal
   - Delete group with options (keep items or delete all)

### New Pages

5. **Item Library** (`/library/items`)
   - List all library items
   - Search and filter
   - CRUD operations
   - Mark inactive
   - Usage statistics
   - Bulk import button

6. **Bulk Import Modal**
   - CSV upload
   - Template download
   - Import progress
   - Results summary with errors

7. **Unit Management** (`/settings/units`)
   - List global units (read-only)
   - List custom tenant units (editable)
   - Create custom unit
   - Edit/delete custom units
   - Usage statistics

8. **Bundle Management** (`/library/bundles`)
   - List bundles
   - Create bundle with items
   - Edit bundle
   - Delete bundle
   - Duplicate bundle

---

## KEY REQUIREMENTS

### Drag-and-Drop Reordering
- Items can be reordered within quote
- Visual feedback during drag
- Updates order_index via API

### Cost Breakdown Display
Read API documentation for cost structure:
- Material, labor, equipment, subcontract, other costs
- Calculated totals (API calculates, UI displays)
- Expandable/collapsible view

### Library Integration
When adding item from library:
- API increments usage_count
- Copies all item data to quote
- Quote item is independent (editing doesn't affect library)

### Unit Measurements
Two types (from API documentation):
- Global units (platform-wide, read-only)
- Custom tenant units (tenant-specific, editable)

Display both in selector with clear labels.

### Bulk Import
- CSV format (check API documentation for schema)
- Validates each row
- Shows success/failure per row
- Allows downloading error report

---

## TESTING CHECKLIST

Test with both accounts:
- [ ] Add item with all cost fields
- [ ] Add item with partial costs
- [ ] Add item from library
- [ ] Edit item (verify totals update)
- [ ] Delete item
- [ ] Duplicate item
- [ ] Reorder items via drag-and-drop
- [ ] Save item to library
- [ ] Create group
- [ ] Add items to group
- [ ] Move item between groups
- [ ] Delete group (both options)
- [ ] Duplicate group
- [ ] Browse library
- [ ] Search library items
- [ ] Edit library item
- [ ] Mark library item inactive
- [ ] Delete library item (test error if in use)
- [ ] Bulk import CSV (10+ items)
- [ ] Create custom unit
- [ ] Use custom unit in item
- [ ] Delete custom unit (test error if in use)
- [ ] Create bundle
- [ ] Add bundle to quote
- [ ] Edit bundle
- [ ] Delete bundle

---

## COMPLETION CRITERIA

Sprint 2 complete when:
- All 44 endpoints have working UI
- Item management works within quotes
- Group organization works
- Library browsing and adding works
- Bulk import functional
- Unit management works
- Bundle management works
- Drag-and-drop reordering functional
- All endpoints tested with both accounts
- Quote totals update correctly after item changes

---

**Next Sprint**: Developer 3 builds pricing, discounts, and draw schedules.