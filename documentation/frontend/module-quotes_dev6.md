# Sprint 6: Dashboard, Search & Metadata

**Agent**: Frontend Developer 6  
**Duration**: 7 days  
**Prerequisites**: Sprint 1-5 complete  
**Read First**: `QUOTE_FRONTEND_GLOBAL_INSTRUCTIONS.md`

---

## YOUR DOCUMENTATION

**API Sections to Read**:
- `api/documentation/quotes_REST_API.md` - Dashboard (8 endpoints)
- `api/documentation/quotes_REST_API.md` - Search (5 endpoints)
- `api/documentation/quotes_REST_API.md` - Quote Tags (8 endpoints)
- `api/documentation/quotes_REST_API.md` - Warranty Tiers (5 endpoints)

Total: 26 endpoints

---

## YOUR MISSION

Build analytics, search, and metadata:
- Comprehensive dashboard with charts and KPIs
- Advanced search and saved searches
- Tag system for quote organization
- Warranty tier management

---

## COMPONENTS TO BUILD

### Dashboard

1. **Dashboard Page** (`/quotes/dashboard`)
   - Overview KPI cards (total quotes, win rate, revenue, pipeline)
   - Date range selector with presets
   - Charts section (see API docs for chart types):
     - Quotes over time (line chart)
     - Win/loss analysis (pie chart)
     - Conversion funnel (funnel chart)
     - Revenue by vendor (bar chart)
     - Top items (table)
     - Average pricing by task (table)
   - Export dashboard data button

2. **Date Range Selector**
   - Preset options: Last 7 days, Last 30 days, Last 90 days, This year, Custom
   - Custom date picker (from/to)
   - Apply button

3. **Export Dashboard Modal**
   - Format selector: CSV, XLSX, PDF
   - Export button with loading state
   - Download result

### Search

4. **Advanced Search Modal**
   - Multiple filter fields (check API docs):
     - Quote number
     - Customer name
     - Status (multi-select)
     - Vendor (multi-select)
     - Amount range (min/max)
     - Date range (created, updated)
     - Tags (multi-select)
     - Has approval pending
   - Search button
   - Save search option

5. **Search Autocomplete** (global search bar)
   - Real-time suggestions as user types
   - Debounced API calls
   - Display suggestions: quote number, customer, title
   - Navigate to quote on select

6. **Saved Searches Manager** (`/quotes/saved-searches`)
   - List saved searches
   - Quick execute buttons
   - Edit saved search
   - Delete saved search
   - Set default search

### Tags

7. **Tag Management Page** (`/settings/tags`)
   - List all tags
   - Search tags
   - Create tag button
   - Tag cards display: name, color, usage count
   - Actions: edit, delete (if usage_count = 0)

8. **Create/Edit Tag Modal**
   - Tag name field
   - Color picker (custom hex or presets)
   - Active/inactive toggle
   - Save/cancel buttons

9. **Tag Assignment** (on quote detail)
   - Display assigned tags as colored pills
   - "Add Tags" button
   - Tag selector modal:
     - Searchable multi-select
     - Show only unassigned tags
     - "Create New Tag" inline option
     - Selected tags shown as pills (removable)
   - Remove tag button per tag

### Warranty Tiers

10. **Warranty Tier Management** (`/settings/warranty-tiers`)
    - List all warranty tiers
    - Create tier button
    - Tier cards display: name, price type, duration, usage count
    - Actions: edit, delete (if usage_count = 0)

11. **Create/Edit Warranty Tier Modal**
    - Tier name
    - Price type selector: fixed or percentage (radio buttons)
    - Price amount (money mask if fixed, percentage mask if percentage)
    - Duration (months, 1-600)
    - Description (optional)
    - Active/inactive toggle
    - Save/cancel

12. **Warranty Tier Selector** (in item form)
    - Optional dropdown
    - Searchable
    - Display: name, price, duration
    - Show calculated warranty cost based on item price
    - "None" option

---

## KEY REQUIREMENTS

### Dashboard Charts
Use recharts library for all visualizations:
- Line charts for time series
- Pie charts for distributions
- Bar charts for comparisons
- Funnel charts for conversion

Read API documentation for exact data structures returned.

### Search Autocomplete
Must implement:
- Debounce (300ms)
- Minimum 2 characters to search
- Display up to 10 suggestions
- Keyboard navigation (arrow keys, enter)
- Clear button

### Tag System
Key features from API:
- Case-insensitive name uniqueness per tenant
- Custom colors (hex format #RRGGBB)
- Usage count tracking
- Cannot delete tags with usage_count > 0
- Inactive status (soft delete alternative)

### Tag Multi-Select Behavior
Critical UX requirement:
- Show assigned tags as removable pills
- Selected tags removed from dropdown list
- Search filters remaining unassigned tags
- "Create New Tag" creates and assigns immediately

### Warranty Tier Types
Two price types (from API):
1. fixed: Dollar amount (e.g., $199.99)
2. percentage: Percent of item price (e.g., 15%)

UI must show calculated cost based on type:
- Fixed: Shows fixed amount
- Percentage: Calculates from item total (item_total × percentage)

### Warranty Duration
API validation: 1-600 months (1-50 years)
- Display in months and years
- Input validation

---

## TESTING CHECKLIST

Test with both accounts:
- [ ] Load dashboard with default date range
- [ ] Change date range (test each preset)
- [ ] View each chart type
- [ ] Export dashboard as CSV
- [ ] Export dashboard as XLSX
- [ ] Export dashboard as PDF
- [ ] Advanced search with multiple filters
- [ ] Save search
- [ ] Load saved search
- [ ] Delete saved search
- [ ] Search autocomplete (type 2+ chars)
- [ ] Create tag with custom color
- [ ] Create tag with preset color
- [ ] Assign single tag to quote
- [ ] Assign multiple tags to quote
- [ ] Remove tag from quote
- [ ] Search tags in assignment modal
- [ ] Create new tag inline (during assignment)
- [ ] Edit tag
- [ ] Mark tag inactive
- [ ] Delete tag (test error if usage_count > 0)
- [ ] Create warranty tier (fixed price)
- [ ] Create warranty tier (percentage)
- [ ] Assign warranty tier to item
- [ ] View calculated warranty cost (percentage type)
- [ ] Edit warranty tier
- [ ] Mark warranty tier inactive
- [ ] Delete warranty tier (test error if in use)

---

## COMPLETION CRITERIA

Sprint 6 complete when:
- All 26 endpoints have working UI
- Dashboard displays all charts and KPIs
- Date range filtering works
- Export functionality works
- Advanced search functional
- Search autocomplete works with debounce
- Saved searches work
- Tag management CRUD functional
- Tag assignment works (multi-select with dynamic filtering)
- Warranty tier management CRUD functional
- Warranty tier calculator accurate
- All endpoints tested with both accounts
- Charts render correctly with real data

---

**Module Complete**: All 170+ endpoints now have functional UI. QA review next.