# Quote Module Admin - Global Frontend Instructions

**Project**: Lead360 Quote Module Admin UI  
**Your Role**: Frontend Developer  
**Access Level**: Platform Admin interface  
**Technology**: Next.js/React for admin portal

---

## CRITICAL CONTEXT

You are building the ADMIN INTERFACE for Platform Administrators.

**Key Differences from Tenant UI**:
- Separate admin portal (different from tenant interface)
- Different branding and theme
- Desktop-first (mobile secondary)
- Cross-tenant data visibility
- Higher security requirements
- Different navigation structure

---

## MANDATORY READING

1. **Feature Contract**: `ADMIN_FEATURE_CONTRACT.md`
2. **Global Instructions**: `QUOTE_FRONTEND_GLOBAL_INSTRUCTIONS.md` (still applies)
3. **API Documentation**: `api/documentation/quotes_REST_API.md` (Admin Endpoints section)

---

## AUTHENTICATION

**Admin API**: `http://localhost:8000`

**Platform Admin Credentials**:
```
Email: admin@lead360.app
Password: [set in test environment]
```

**Important**: Separate login from tenant users

---

## UI/UX STANDARDS

### Design Principles
- Professional, clean, data-focused
- Desktop-optimized (1920x1080 primary)
- Tablet acceptable (1024x768)
- Mobile not required

### Admin Theme
- Dark mode optional (nice to have)
- Data density higher than tenant UI
- More technical terminology acceptable
- Performance metrics visible

### Navigation Structure
```
Sidebar (left):
├── Dashboard
├── Templates
│   ├── Template Library
│   └── Template Builder
├── Global Resources
│   └── Unit Measurements
├── Analytics
│   ├── Platform Overview
│   ├── Tenant Comparison
│   └── Pricing Benchmarks
├── Tenants
│   ├── Tenant List
│   └── Tenant Details
├── Operations
│   ├── Emergency Tools
│   ├── Diagnostics
│   └── Support Tools
└── Reports
    ├── Generate Report
    └── Scheduled Reports

Top Bar:
├── Search (global)
├── Notifications
├── Admin User Menu
└── Logout
```

---

## COMPONENT STANDARDS

### Layout
- Sidebar navigation (persistent)
- Top bar (global actions)
- Main content area (with breadcrumbs)
- Page title and description
- Action buttons (top right)

### Tables
- Sortable columns (all)
- Search/filter (where applicable)
- Pagination (default 50 items)
- Row actions (dropdown menu)
- Bulk selection (where applicable)
- Export to CSV button

### Charts
- Use Recharts library
- Interactive tooltips
- Legend when needed
- Responsive sizing
- Download as PNG option

### Forms
- Full-width on desktop
- Multi-column layouts where appropriate
- Clear section headers
- Inline validation
- Help text for complex fields

### Modals
- Confirmation dialogs for destructive actions
- Forms for quick actions
- Not for complex multi-step processes

---

## ADMIN-SPECIFIC FEATURES

### Cross-Tenant Data Display
When showing data from multiple tenants:
```
Table row:
[Quote #] | [Tenant Name] | [Customer] | [Amount] | [Status] | [Actions]
```

Always include tenant identifier.

### Audit Trail Display
For operations that modify data:
- Show "Modified by" with admin name
- Show timestamp
- Show reason (if provided)
- Link to full audit log

### Tenant Selector
When filtering by tenant:
- Searchable dropdown
- Show: company name + subdomain
- "All Tenants" option
- Recently viewed tenants at top

---

## DATA VISUALIZATION REQUIREMENTS

### Dashboard Charts
- **Line Charts**: Quote volume over time, revenue trends
- **Bar Charts**: Tenant comparison, top items
- **Pie Charts**: Quote status distribution
- **Funnel Charts**: Conversion funnel
- **Sparklines**: Inline metrics (quote count, revenue)

### Chart Interactions
- Click to drill down
- Hover for details
- Legend toggle
- Date range selector
- Export chart data

---

## TEMPLATE BUILDER REQUIREMENTS ⭐

**Critical Component**: This is the most complex UI component

### Layout
```
┌─────────────────────────────────────────────────────┐
│ Template Builder - [Template Name]                 │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│ Component│      Canvas              │  Properties   │
│ Library  │      (Preview)           │  Panel        │
│          │                          │               │
│ Sections │                          │ Component     │
│ □ Header │                          │ Settings:     │
│ □ Items  │                          │               │
│ □ Totals │   [Drop components      │ • Position    │
│ □ Footer │    here]                │ • Style       │
│          │                          │ • Content     │
│ Blocks   │                          │               │
│ ⊞ Text   │                          │               │
│ ⊞ Image  │                          │               │
│ ⊞ Table  │                          │               │
│          │                          │               │
├──────────┴──────────────────────────┴───────────────┤
│ [Device: Desktop ▼] [Preview] [Save] [Test PDF]    │
└─────────────────────────────────────────────────────┘
```

### Drag-and-Drop
- Drag from component library to canvas
- Reorder components on canvas
- Visual drop zones
- Snap to grid (optional)

### Component Library
**Pre-built Sections**:
- Header (logo, company info, quote number)
- Customer Details
- Items Table
- Group Headers
- Totals Summary
- Terms & Conditions
- Signature Block
- Footer

**Basic Blocks**:
- Text Block (rich text editor)
- Image Block (upload or URL)
- Table (custom columns)
- Spacer
- Divider Line
- QR Code

### Properties Panel
When component selected:
- **Content Tab**: Edit text, variables, data binding
- **Style Tab**: Colors, fonts, spacing, borders
- **Layout Tab**: Width, height, alignment, padding

### Variables
Variable insertion via dropdown or autocomplete:
```
{{company.name}}
{{quote.number}}
{{customer.name}}
{{items}} (loop)
```

### Preview Modes
- Desktop preview
- Mobile preview (how it looks on phone)
- PDF preview (as it will be generated)
- Live preview (updates as you edit)

### Testing
- "Test with Sample Data" button
- "Test with Real Quote" (select quote)
- "Generate PDF" button

---

## SECURITY REQUIREMENTS

### Action Confirmations
Require confirmation for:
- Hard delete operations
- Bulk updates
- Emergency operations
- Template deletion

**Confirmation Pattern**:
```
Modal:
"Are you sure you want to [action]?"
Reason: [text input - required]
Type "DELETE" to confirm: [text input]
[Cancel] [Confirm]
```

### Audit Visibility
Show audit trail where relevant:
- "Last modified by [Admin Name] on [Date]"
- Link to full audit log
- Reason for change (if recorded)

---

## PERFORMANCE REQUIREMENTS

### Loading States
- Skeleton loaders for tables
- Spinner for charts
- Progress bar for large exports
- "Loading..." text for simple operations

### Data Refresh
- Manual refresh button
- Auto-refresh option (every 30s, 1m, 5m)
- Last updated timestamp
- Refresh icon animates during refresh

### Caching
- Dashboard data cached client-side (5 min)
- Template list cached (10 min)
- Tenant list cached (15 min)

---

## ERROR HANDLING

### Error Display
- Toast notifications for simple errors
- Error page for critical failures
- Inline field errors for forms
- Fallback UI for component failures

### Error Types
- **403 Forbidden**: Show "Platform Admin access required"
- **404 Not Found**: Show "Resource not found"
- **500 Server Error**: Show "System error - please contact support"
- **Network Error**: Show "Connection lost - retrying..."

---

## TESTING REQUIREMENTS

### Functional Testing
Test with Platform Admin account:
- All features accessible
- Cross-tenant queries work
- Data displays correctly
- Actions complete successfully

Test with non-admin account:
- Admin routes blocked
- Proper error messages

### Browser Testing
- Chrome (primary)
- Firefox (secondary)
- Safari (secondary)
- Edge (acceptable)

### Performance Testing
- Dashboard loads in <3 seconds
- Tables with 100+ rows perform well
- Charts render smoothly
- No memory leaks

---

## DELIVERABLES

Each developer must deliver:
1. React components for assigned features
2. API integration (using admin endpoints)
3. Responsive layouts (desktop + tablet)
4. Error handling
5. Loading states
6. Tests (component + integration)
7. Documentation

---

## COMPLETION CRITERIA

Feature complete when:
- All assigned UI components built
- All admin API endpoints integrated
- Platform Admin access enforced
- Data displays correctly
- Actions work end-to-end
- Error handling complete
- Tests pass
- Code reviewed and approved

---

**Remember**: Admin UI is for platform management. Prioritize functionality and data visibility over visual polish.