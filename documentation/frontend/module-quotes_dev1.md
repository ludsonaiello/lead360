# Sprint 1: Foundation & Core Operations

**Agent**: Frontend Developer 1  
**Duration**: 10 days  
**Read First**: `QUOTE_FRONTEND_GLOBAL_INSTRUCTIONS.md`

---

## YOUR DOCUMENTATION

**API Sections to Read**:
- `api/documentation/quotes_REST_API.md` - Core Quote Operations (12 endpoints)
- `api/documentation/quotes_REST_API.md` - Vendors (8 endpoints)
- `api/documentation/quotes_REST_API.md` - Quote Settings (4 endpoints)

Total: 24 endpoints

---

## YOUR MISSION

Build the foundation:
- Quote CRUD (create, read, update, delete)
- Quote list with filters and search
- Quote detail page structure
- Vendor management
- Quote settings configuration

You establish UI patterns that other developers will follow.

---

## PAGES TO BUILD

1. **Quote List** (`/quotes`)
   - Table/grid of all quotes
   - Filters: status, date range, vendor, search text
   - Pagination
   - Status badges
   - Actions: view, edit, clone, delete

2. **Quote Detail** (`/quotes/:id`)
   - Quote header (number, title, status, customer)
   - Tabbed layout structure
   - Action buttons
   - Empty state for items section

3. **Quote Create** (`/quotes/new`)
   - Multi-step or sectioned form
   - Lead selector (searchable dropdown + inline creation)
   - Quote details (title, vendor, PO, expiration)
   - Jobsite address (Google Maps autocomplete)
   - Profit/overhead percentages

4. **Quote Edit** (`/quotes/:id/edit`)
   - Same as create but pre-populated
   - Handle status-based restrictions

5. **Vendor Management** (`/vendors`)
   - List vendors
   - Search vendors
   - CRUD operations
   - Set default vendor
   - Upload signature

6. **Quote Settings** (`/settings/quotes`)
   - Default percentages (profit, overhead, tax)
   - Quote numbering
   - Expiration defaults
   - Approval thresholds
   - Reset to defaults

---

## SHARED COMPONENTS YOU CREATE

These will be reused by other developers:

1. **StatusBadge** - Color-coded quote status badges
2. **AddressAutocomplete** - Google Maps address input
3. **SearchableSelect** - Dropdown with search
4. **LeadSelector** - Lead dropdown + inline creation
5. **QuoteCard** - Reusable card for quote lists

---

## KEY REQUIREMENTS

### Lead Selection Flow
- User can select existing lead from searchable dropdown
- OR click "Create New Lead" to expand inline form
- After lead selected/created, continue to quote details

### Address Integration
- ALL address fields use Google Maps Places Autocomplete
- Auto-populate: address_line1, city, state, zip_code
- Store latitude and longitude

### Vendor Management
- Phone number with mask
- Address with Google Maps
- Signature file upload
- Set default (unsets previous default automatically)

### Quote Creation Paths
Read API documentation for three creation methods:
1. From existing lead
2. With new customer
3. Manual entry

---

## TESTING CHECKLIST

Test all endpoints with both accounts:
- [ ] Create quote from existing lead
- [ ] Create quote with new customer inline
- [ ] List quotes with each filter
- [ ] Search quotes
- [ ] View quote detail
- [ ] Edit quote
- [ ] Clone quote
- [ ] Delete quote
- [ ] Change quote status
- [ ] Update jobsite address
- [ ] Vendor CRUD operations
- [ ] Set default vendor
- [ ] Upload vendor signature
- [ ] Configure quote settings
- [ ] Reset settings to defaults

---

## COMPLETION CRITERIA

Sprint 1 complete when:
- All 24 endpoints have working UI
- Quote list, detail, create, edit work end-to-end
- Vendor management works
- Settings page functional
- All endpoints tested with both accounts
- Shared components documented for reuse
- Code follows existing patterns

---

**Next Sprint**: Developer 2 builds items, groups, and library on your foundation.