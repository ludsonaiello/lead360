# Quote Module - Admin System Feature Contract

**Module**: Quote Module Admin System  
**Purpose**: Platform-level management and analytics for quotes across all tenants  
**Scope**: Global resource management, cross-tenant analytics, template system, operational tools

---

## 1. OVERVIEW

The Admin System provides platform administrators with tools to:
- Manage global resources (templates, unit measurements)
- Monitor platform-wide quote activity
- Analyze tenant performance
- Manage system configuration
- Provide operational support

---

## 2. USER ROLES

### Platform Admin
- Full access to all admin features
- Can view data across all tenants
- Can create/modify global resources
- Can perform emergency operations

### Support Admin
- Read-only access to analytics
- Tenant impersonation capability
- Diagnostic tools access
- Cannot modify global configuration

---

## 3. FEATURE MODULES

### Module 1: Template Management System ⭐ PRIORITY

**Purpose**: Create, manage, and distribute quote templates across platform

#### 3.1 Template CRUD
**Status**: ✅ IMPLEMENTED (8 endpoints)

**Capabilities**:
- Create global templates (available to all tenants)
- Create tenant-specific templates (for specific tenant)
- Update template design and structure
- Delete templates (with usage protection)
- Clone existing templates
- View template usage statistics

**Business Rules**:
- Global templates: `tenant_id = NULL`
- Tenant-specific templates: `tenant_id = specific UUID`
- Cannot delete template if `usage_count > 0`
- Cannot delete default template
- Only one default template globally
- Template cloning creates non-default copy

**Data Model**:
- Template ID, name, description
- Template type: PDF, Email, Web
- Is global, is default flags
- HTML content, CSS styles
- Template variables mapping
- Usage count
- Created by, created at

#### 3.2 Template Builder/Visual Editor ⭐ HIGH PRIORITY
**Status**: ⚠️ NEEDS FRONTEND IMPLEMENTATION

**Capabilities**:
- Drag-and-drop template editor
- Visual component library:
  - Header section (company logo, contact info)
  - Quote details section (number, date, customer info)
  - Items table (configurable columns)
  - Totals section (subtotal, tax, discount, total)
  - Terms and conditions section
  - Signature section
  - Custom text blocks
  - Image blocks
  - QR code blocks
- Live preview (desktop, mobile, PDF)
- Template variable insertion
- Styling controls (colors, fonts, spacing)
- Layout presets (professional, modern, classic)

**Template Variables Available**:
- Company: `{{company.name}}`, `{{company.logo}}`, `{{company.address}}`
- Quote: `{{quote.number}}`, `{{quote.title}}`, `{{quote.date}}`
- Customer: `{{customer.name}}`, `{{customer.email}}`, `{{customer.phone}}`
- Items: Loop over `{{items}}` with `{{item.title}}`, `{{item.quantity}}`
- Totals: `{{subtotal}}`, `{{tax}}`, `{{discount}}`, `{{total}}`
- Vendor: `{{vendor.name}}`, `{{vendor.signature}}`
- Conditional blocks: `{{#if has_discount}}...{{/if}}`

**Technical Requirements**:
- Rich text editor (TinyMCE, Quill, or similar)
- Template syntax: Handlebars or similar
- CSS framework: Tailwind or Bootstrap classes
- Export formats: PDF-ready HTML
- Version control for templates

#### 3.3 Template Testing & Preview
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Capabilities**:
- Preview with sample data
- Preview with real quote data
- Test PDF generation
- Test email rendering
- Mobile preview
- Browser compatibility check

**Sample Data Sets**:
- Minimal quote (few items)
- Complex quote (many items, groups, discounts)
- Quote with attachments
- Quote with custom fields

---

### Module 2: Global Unit Measurements
**Status**: ✅ IMPLEMENTED (4 admin endpoints)

**Capabilities**:
- Create global units available to all tenants
- Update global unit definitions
- View usage statistics across platform
- Seed default units
- Cannot delete units in use

**Default Units** (Seeded):
- Each
- Square Foot
- Linear Foot
- Hour
- Cubic Yard
- Ton
- Gallon
- Pound
- Box
- Bundle

**Business Rules**:
- Global units: `tenant_id = NULL`, `is_global = true`
- Tenants see global + their custom units
- Tenants cannot edit/delete global units
- Cannot delete unit with `usage_count > 0`
- Usage tracked across: quote_item, item_library, quote_bundle_item

---

### Module 3: Cross-Tenant Analytics Dashboard
**Status**: ⚠️ NEEDS IMPLEMENTATION (Phase 6 placeholders exist)

**Capabilities**:

#### 3.1 Platform Overview Dashboard
- Total quotes across all tenants
- Total revenue (sum of all accepted quotes)
- Platform-wide conversion rate
- Active tenant count
- Quote volume trends (daily, weekly, monthly)
- Revenue trends
- Top performing tenants (by revenue, volume)

#### 3.2 Tenant Comparison
- Rank tenants by metrics:
  - Quote volume
  - Total revenue
  - Conversion rate
  - Average quote value
  - Growth rate
- Filter by date range
- Export comparison reports

#### 3.3 Pricing Benchmarks (Anonymized)
- Average pricing for common items/tasks
- Price ranges (min, max, median)
- Standard deviation
- Tenant count per task
- Regional pricing variations (if location data available)

**Privacy Requirements**:
- All data anonymized
- No tenant-identifying information in aggregates
- Minimum tenant threshold (e.g., 5 tenants) for benchmark publication

#### 3.4 System Health Metrics
- API response times
- Error rates by endpoint
- PDF generation queue status
- Email delivery success rates
- Database query performance
- Storage usage

---

### Module 4: Tenant Management
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Capabilities**:

#### 4.1 Tenant Overview
- List all tenants using quote module
- Search tenants by name, subdomain
- Filter by subscription status
- View per-tenant statistics:
  - Total quotes
  - Quote volume (last 30 days)
  - Revenue
  - Conversion rate
  - Active users
  - Storage usage

#### 4.2 Tenant Details View
- Quote activity timeline
- Top quoted items
- Conversion funnel
- User activity
- Template usage
- Feature adoption

#### 4.3 Tenant Configuration
- View tenant quote settings
- View active template
- View custom units
- View approval thresholds
- Feature flags (if implemented)

**Note**: Modifications should be rare; tenants manage own settings

---

### Module 5: Operational Tools
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Capabilities**:

#### 5.1 Emergency Operations
- Hard delete quote (with mandatory reason)
- Bulk status updates
- Data repair tools
- Orphaned record cleanup

**Audit Requirements**:
- All operations logged
- Reason field mandatory
- Confirmation required
- Notification sent to tenant

#### 5.2 Support Tools
- View quote as tenant user (read-only)
- Impersonate tenant (with full audit logging)
- Search quotes globally (cross-tenant)
- Export tenant data for analysis

#### 5.3 Diagnostics
- Test PDF generation
- Test email delivery
- Validate Google Maps API
- Check file storage connectivity
- Database health check

---

### Module 6: Reports & Exports
**Status**: ⚠️ NEEDS IMPLEMENTATION

**Capabilities**:
- Export platform dashboard data (CSV, XLSX, PDF)
- Schedule automated reports
- Custom report builder
- Tenant comparison exports
- Pricing benchmark exports
- Audit log exports

**Report Types**:
- Executive summary (weekly, monthly)
- Tenant performance report
- System health report
- Revenue analysis
- Usage report (for billing)

---

## 4. API ENDPOINTS SUMMARY

**Contract Version**: 1.1 (Updated February 2026)
**Implementation Status**: ✅ Backend Complete - 45 endpoints implemented
**API Documentation**: See `/api/documentation/quote_admin_REST_API.md` for complete reference

### ✅ IMPLEMENTED (Backend Complete)

**Template Management** (14 endpoints - EXCEEDS CONTRACT):
- `POST /admin/quotes/templates` - Create template
- `GET /admin/quotes/templates` - List all templates
- `GET /admin/quotes/templates/:id` - Get template details
- `PATCH /admin/quotes/templates/:id` - Update template
- `DELETE /admin/quotes/templates/:id` - Delete template
- `POST /admin/quotes/templates/:id/clone` - Clone template
- `PATCH /admin/quotes/templates/:id/set-default` - Set as default (BONUS)
- `GET /admin/quotes/templates/variables/schema` - Get variables schema
- `POST /admin/quotes/templates/:id/preview` - Preview with sample data (BONUS)
- `POST /admin/quotes/templates/:id/test-pdf` - Test PDF generation (BONUS)
- `POST /admin/quotes/templates/:id/validate` - Validate syntax (BONUS)
- `POST /admin/quotes/templates/:id/test-email` - Test email rendering (BONUS)
- `GET /admin/quotes/templates/:id/versions` - Get version history (BONUS)
- `POST /admin/quotes/templates/:id/restore-version` - Restore version (BONUS)

**Cross-Tenant Analytics & Dashboard** (8 endpoints - ✅ COMPLETE):
- `GET /admin/quotes/dashboard/overview` - Platform-wide statistics
- `GET /admin/quotes/dashboard/quote-trends` - Quote volume trends (BONUS)
- `GET /admin/quotes/dashboard/conversion-funnel` - Conversion funnel (BONUS)
- `GET /admin/quotes/dashboard/system-health` - System health metrics
- `GET /admin/quotes/dashboard/revenue-analytics` - Revenue breakdown (BONUS)
- `GET /admin/quotes/dashboard/global-item-pricing` - Pricing benchmarks
- `GET /admin/quotes` - List all quotes (cross-tenant)
- `DELETE /admin/quotes/:id/hard-delete` - Emergency hard delete

**Tenant Management** (6 endpoints - ✅ COMPLETE):
- `GET /admin/quotes/tenants` - List tenants with quote activity
- `GET /admin/quotes/tenants/compare` - Compare tenants by metric (BONUS)
- `GET /admin/quotes/tenants/:tenantId/stats` - Tenant quote statistics
- `GET /admin/quotes/tenants/:tenantId/activity` - Activity timeline
- `GET /admin/quotes/tenants/:tenantId/config` - Tenant configuration
- *(Note: Paths use `/admin/quotes/tenants/*` namespace for module cohesion)*

**Operational Tools** (5 endpoints - ✅ COMPLETE):
- `POST /admin/quotes/:id/repair` - Repair broken quote
- `POST /admin/quotes/bulk-update` - Bulk status updates
- `GET /admin/quotes/diagnostics/run-tests` - Run system diagnostics
- `POST /admin/quotes/maintenance/cleanup-orphans` - Cleanup orphans (BONUS)
- *(Note: Tenant impersonation not implemented)*

**Reports & Exports** (8 endpoints - ✅ COMPLETE):
- `POST /admin/quotes/reports/generate` - Generate async report
- `GET /admin/quotes/reports/:jobId/status` - Check report status (BONUS)
- `GET /admin/quotes/reports/:jobId/download` - Download report (BONUS)
- `GET /admin/quotes/reports/scheduled` - List scheduled reports
- `POST /admin/quotes/reports/scheduled` - Create scheduled report (BONUS)
- `GET /admin/quotes/reports/scheduled/:id` - Get scheduled report (BONUS)
- `PATCH /admin/quotes/reports/scheduled/:id` - Update scheduled (BONUS)
- `DELETE /admin/quotes/reports/scheduled/:id` - Delete scheduled (BONUS)
- *(Note: Paths use `/admin/quotes/reports/*` namespace)*

**Quote Notes** (4 endpoints - ✅ ADDITIONAL FEATURE):
- `POST /quotes/:id/notes` - Create note (Role-based access)
- `GET /quotes/:id/notes` - List notes
- `PATCH /quotes/:id/notes/:noteId` - Update note
- `DELETE /quotes/:id/notes/:noteId` - Delete note

### ⚠️ NOT IN QUOTE MODULE (Separate Controller)

**Unit Measurements** (4 endpoints):
- `POST /admin/units` - Create global unit
- `GET /admin/units` - List global units
- `PATCH /admin/units/:id` - Update global unit
- `POST /admin/units/seed-defaults` - Seed default units
- *(Note: Likely in separate UnitsController outside quotes module)*

### 📋 Path Namespace Decision

**ADR-001**: Admin endpoints use `/admin/quotes/*` namespace for module cohesion and clearer ownership. See `documentation/architecture/ADR-001-admin-api-namespace.md` for rationale.

---

## 5. UI REQUIREMENTS

### 5.1 Admin Dashboard Layout
- Sidebar navigation (modules)
- Top bar (user info, notifications, logout)
- Main content area
- Responsive design (desktop primary, tablet acceptable)

**Navigation Structure**:
- Dashboard (overview)
- Templates
  - Template Library
  - Create Template
  - Template Builder
- Global Resources
  - Unit Measurements
- Analytics
  - Platform Overview
  - Tenant Comparison
  - Pricing Benchmarks
- Tenants
  - Tenant List
  - Tenant Details
- Operations
  - Emergency Tools
  - Diagnostics
  - Support Tools
- Reports
  - Generate Report
  - Scheduled Reports

### 5.2 Template Builder UI Requirements ⭐
- Split-pane layout: Components (left) | Canvas (center) | Properties (right)
- Drag-and-drop from component library to canvas
- Click to select component
- Properties panel shows editable properties
- Live preview toggle
- Device preview (desktop, tablet, mobile)
- Undo/redo capability
- Save draft functionality
- Template name and metadata editor
- Variable insertion helper
- Style editor (colors, fonts, spacing)
- Export/download capability

### 5.3 Data Visualization
- Charts library: Recharts or Chart.js
- Chart types needed:
  - Line charts (trends over time)
  - Bar charts (comparisons)
  - Pie charts (distributions)
  - Funnel charts (conversion)
  - Sparklines (inline metrics)
- Interactive tooltips
- Downloadable charts

### 5.4 Table Requirements
- Sortable columns
- Searchable/filterable
- Pagination
- Row selection
- Bulk actions
- Export to CSV/XLSX
- Responsive (card view on mobile)

---

## 6. SECURITY & ACCESS CONTROL

### Authentication
- Separate admin login (different from tenant login)
- Multi-factor authentication required
- Session timeout: 30 minutes

### Authorization
- Role: Platform Admin (full access)
- Role: Support Admin (read-only + diagnostics)
- RBAC enforced on all endpoints
- Audit all admin actions

### Data Privacy
- Cross-tenant data viewing allowed for Platform Admin
- All cross-tenant access logged
- Anonymized data for benchmarks
- Tenant notification for emergency operations

---

## 7. TECHNICAL CONSTRAINTS

### Backend
- All endpoints under `/admin/` prefix
- Require `Platform Admin` or `Support Admin` role
- Multi-tenant isolation still enforced (but admin can query across tenants)
- Audit logging for all mutations
- Rate limiting on expensive operations

### Frontend
- Separate admin app OR protected admin section
- Different branding from tenant portal
- Desktop-optimized (mobile support secondary)
- Admin-specific theme/styling

### Performance
- Analytics queries cached (5-minute TTL)
- Dashboard data refreshable
- Large exports queued (async processing)
- Pagination required for lists >100 items

---

## 8. SUCCESS METRICS

**Template System**:
- 80%+ tenants using global templates
- <5 support tickets about templates per month
- Template creation time <30 minutes
- PDF generation success rate >99%

**Analytics**:
- Dashboard loads in <3 seconds
- Reports generate in <30 seconds
- 95% data accuracy
- Zero cross-tenant data leaks

**Operational**:
- Emergency operations <1 per week
- Support tool usage tracked
- Diagnostic tests pass >98%

---

## 9. FUTURE ENHANCEMENTS (Post-Launch)

- AI-powered template suggestions
- Automated tenant health monitoring
- Predictive analytics (churn risk, revenue forecast)
- White-label template marketplace
- Tenant self-service template customization
- A/B testing for templates
- Advanced reporting with custom queries

---

## 10. DEPENDENCIES

**External Services**:
- Google Maps API (for geocoding)
- File storage (for template assets)
- Email service (for notifications)
- PDF generation service

**Internal Modules**:
- RBAC system (for Platform Admin role)
- Tenant management system
- Audit logging system
- File storage module

---

## 11. DELIVERY TIMELINE

**Phase 1** (✅ COMPLETE - February 2026):
- ✅ Template CRUD (backend complete - 14 endpoints)
- ✅ Template testing & validation (backend complete)
- ✅ Template versioning (backend complete)
- ✅ Cross-tenant analytics (backend complete - 8 endpoints)
- ✅ Tenant management (backend complete - 6 endpoints)
- ✅ Operational tools (backend complete - 5 endpoints)
- ✅ Reports & exports (backend complete - 8 endpoints)
- ✅ Quote notes (backend complete - 4 endpoints)
- ✅ **Complete API documentation** generated
- ✅ **Security audit** - SQL injection fixed

**Phase 2** (IN PROGRESS - Frontend Development):
- 🔄 Template management UI (needs implementation)
- 🔄 Template builder/visual editor (needs implementation)
- 🔄 Admin dashboard UI (needs implementation)
- 🔄 Analytics visualization (needs implementation)
- 🔄 Tenant management UI (needs implementation)
- 🔄 Reports UI (needs implementation)
- **Status**: Backend APIs ready for integration
- **Blockers**: None - all endpoints documented and tested

**Phase 3** (DEFERRED - Optional Enhancements):
- Unit measurements admin UI
- Tenant impersonation feature
- Advanced diagnostics UI
- Custom query builder

**Phase 4** (FUTURE - Post-MVP):
- AI-powered features
- Predictive analytics
- Template marketplace
- Advanced automation

---

## 12. ACCEPTANCE CRITERIA

### Template System
- [ ] Admin can create global template
- [ ] Admin can use visual builder (drag-and-drop)
- [ ] Admin can preview template with sample data
- [ ] Admin can test PDF generation
- [ ] Tenants see global templates in their list
- [ ] Template variables render correctly
- [ ] Cannot delete template in use
- [ ] Template usage statistics accurate

### Unit Measurements
- [ ] Admin can create global unit
- [ ] Admin can view usage statistics
- [ ] Tenants see global units in selectors
- [ ] Cannot delete unit in use
- [ ] Seed defaults function works

### Analytics (When Implemented)
- [ ] Dashboard loads with accurate data
- [ ] Tenant comparison works
- [ ] Charts render correctly
- [ ] Exports generate successfully
- [ ] Data refresh works

### Security
- [ ] Only Platform Admin can access
- [ ] All actions audited
- [ ] No cross-tenant data leaks
- [ ] Session timeout enforced

---

**Contract Version**: 1.0  
**Last Updated**: January 2026  
**Status**: Foundation implemented, UI and analytics pending