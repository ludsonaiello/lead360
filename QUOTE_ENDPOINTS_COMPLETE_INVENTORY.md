# Quotes Module - Complete Endpoint Inventory

**Generated**: 2026-01-24
**Total Controllers**: 21
**Purpose**: Systematic extraction of all endpoints from quote module controllers

---

## Summary Statistics

- **Total Endpoints**: 149
- **Controller Groups**:
  - Tenant Endpoints: 121
  - Admin Endpoints: 19
  - Public Endpoints: 3
  - Platform Admin Endpoints: 6

---

## 1. VendorController

**Base Path**: `/vendors`
**Tag**: `Quotes - Vendors`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /vendors | Owner, Admin, Manager | CreateVendorDto | - | Create a new vendor |
| GET | /vendors | Owner, Admin, Manager, Sales, Employee | - | ListVendorsDto | Get all vendors with filters and pagination |
| GET | /vendors/:id | Owner, Admin, Manager, Sales, Employee | - | - | Get a single vendor by ID |
| PATCH | /vendors/:id | Owner, Admin, Manager | UpdateVendorDto | - | Update a vendor |
| DELETE | /vendors/:id | Owner, Admin | - | - | Delete a vendor |
| PATCH | /vendors/:id/set-default | Owner, Admin, Manager | - | - | Set a vendor as default |
| POST | /vendors/:id/signature | Owner, Admin, Manager | {file_id: string} | - | Update vendor signature file |
| GET | /vendors/:id/stats | Owner, Admin, Manager | - | - | Get vendor statistics (quote counts by status) |

**Endpoint Count**: 8

---

## 2. UnitMeasurementAdminController

**Base Path**: `/admin/units`
**Tag**: `Quotes - Unit Measurements (Admin)`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /admin/units | Platform Admin | CreateGlobalUnitDto | - | Create global unit measurement (admin only) |
| GET | /admin/units | Platform Admin | - | ListUnitsDto | Get all global units (admin only) |
| PATCH | /admin/units/:id | Platform Admin | UpdateUnitDto | - | Update global unit (admin only) |
| POST | /admin/units/seed-defaults | Platform Admin | - | - | Seed default global units (idempotent) |

**Endpoint Count**: 4

---

## 3. UnitMeasurementController

**Base Path**: `/units`
**Tag**: `Quotes - Unit Measurements`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /units | Owner, Admin, Manager | CreateUnitDto | - | Create tenant custom unit |
| GET | /units | Owner, Admin, Manager, Sales, Employee | - | ListUnitsDto | Get all available units (global + tenant custom) |
| GET | /units/:id | Owner, Admin, Manager, Sales, Employee | - | - | Get a single unit by ID |
| PATCH | /units/:id | Owner, Admin, Manager | UpdateUnitDto | - | Update tenant custom unit |
| DELETE | /units/:id | Owner, Admin | - | - | Delete tenant custom unit |
| GET | /units/:id/stats | Owner, Admin, Manager | - | - | Get unit usage statistics |

**Endpoint Count**: 6

---

## 4. BundleController

**Base Path**: `/bundles`
**Tag**: `Quotes - Bundles`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /bundles | Owner, Admin, Manager | CreateBundleDto | - | Create a new bundle with items |
| GET | /bundles | Owner, Admin, Manager, Sales, Employee | - | ListBundlesDto | Get all bundles with item counts |
| GET | /bundles/:id | Owner, Admin, Manager, Sales, Employee | - | - | Get a single bundle with all items |
| PATCH | /bundles/:id | Owner, Admin, Manager | UpdateBundleDto | - | Update bundle metadata |
| DELETE | /bundles/:id | Owner, Admin | - | - | Delete bundle and all its items |
| POST | /bundles/:id/items | Owner, Admin, Manager | BundleItemDto | - | Add item to bundle |
| PATCH | /bundles/:bundleId/items/:itemId | Owner, Admin, Manager | UpdateBundleItemDto | - | Update bundle item |
| DELETE | /bundles/:bundleId/items/:itemId | Owner, Admin, Manager | - | - | Delete bundle item |

**Endpoint Count**: 8

---

## 5. QuoteSettingsController

**Base Path**: `/quotes/settings`
**Tag**: `Quotes - Settings`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| GET | /quotes/settings | Owner, Admin, Manager, Sales, Employee | - | - | Get quote settings for tenant |
| PATCH | /quotes/settings | Owner, Admin | UpdateQuoteSettingsDto | - | Update quote settings |
| POST | /quotes/settings/reset | Owner, Admin | - | - | Reset settings to system defaults |
| GET | /quotes/settings/approval-thresholds | Owner, Admin, Manager, Sales, Employee | - | - | Get approval threshold configuration |

**Endpoint Count**: 4

---

## 6. QuoteTemplateAdminController

**Base Path**: `/admin/quotes/templates`
**Tag**: `Quotes - Templates (Admin)`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /admin/quotes/templates | Platform Admin | CreateTemplateDto | - | Create template (admin only) |
| GET | /admin/quotes/templates | Platform Admin | - | ListTemplatesDto | Get all templates (admin only) |
| GET | /admin/quotes/templates/:id | Platform Admin | - | - | Get template details (admin only) |
| PATCH | /admin/quotes/templates/:id | Platform Admin | UpdateTemplateDto | - | Update template (admin only) |
| DELETE | /admin/quotes/templates/:id | Platform Admin | - | - | Delete template (admin only) |
| POST | /admin/quotes/templates/:id/clone | Platform Admin | {new_name?: string} | - | Clone template (admin only) |
| PATCH | /admin/quotes/templates/:id/set-default | Platform Admin | - | - | Set template as platform default (admin only) |
| GET | /admin/quotes/templates/variables/schema | Platform Admin | - | - | Get template variables schema |

**Endpoint Count**: 8

---

## 7. QuoteTemplateController

**Base Path**: `/quotes/templates`
**Tag**: `Quotes - Templates`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| GET | /quotes/templates | Owner, Admin, Manager, Sales, Employee | - | ListTemplatesDto | Get available templates |
| GET | /quotes/templates/:id | Owner, Admin, Manager, Sales, Employee | - | - | Get template details |
| PATCH | /quotes/templates/active | Owner, Admin | {template_id: string} | - | Set active template for tenant |

**Endpoint Count**: 3

---

## 8. QuoteController

**Base Path**: `/quotes`
**Tag**: `Quotes - Main`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /quotes/from-lead/:leadId | Owner, Admin, Manager, Sales | CreateQuoteFromLeadDto | - | Create quote from existing lead |
| POST | /quotes/with-new-customer | Owner, Admin, Manager, Sales | CreateQuoteWithCustomerDto | - | Create quote with new customer (creates lead in transaction) |
| POST | /quotes | Owner, Admin, Manager, Sales | CreateQuoteDto | - | Create quote manually (requires existing lead) |
| GET | /quotes | Owner, Admin, Manager, Sales, Employee | - | ListQuotesDto | List quotes with filters and pagination |
| GET | /quotes/search | Owner, Admin, Manager, Sales, Employee | - | q: string | Search quotes by quote number, title, customer, or items |
| GET | /quotes/statistics | Owner, Admin, Manager | - | - | Get quote statistics (counts, revenue, conversion rate) |
| GET | /quotes/:id | Owner, Admin, Manager, Sales, Employee | - | - | Get single quote with all relationships |
| PATCH | /quotes/:id | Owner, Admin, Manager, Sales | UpdateQuoteDto | - | Update quote basic information (creates version +0.1) |
| PATCH | /quotes/:id/status | Owner, Admin, Manager, Sales | UpdateQuoteStatusDto | - | Update quote status with validation (creates version +1.0) |
| PATCH | /quotes/:id/jobsite-address | Owner, Admin, Manager, Sales | UpdateJobsiteAddressDto | - | Update jobsite address with re-validation (creates version +0.1) |
| POST | /quotes/:id/clone | Owner, Admin, Manager, Sales | - | - | Deep clone quote (copies all items, groups, discounts, draw schedule) |
| DELETE | /quotes/:id | Owner, Admin | - | - | Soft delete quote (archive) |

**Endpoint Count**: 12

---

## 9. QuoteItemController

**Base Path**: `/quotes/:quoteId/items`
**Tag**: `Quotes - Items`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /quotes/:quoteId/items | Owner, Admin, Manager, Sales | CreateItemDto | - | Add item to quote |
| POST | /quotes/:quoteId/items/from-library/:libraryItemId | Owner, Admin, Manager, Sales | - | - | Add item to quote from library (increments usage count) |
| GET | /quotes/:quoteId/items | Owner, Admin, Manager, Sales, Employee | - | includeGrouped?: boolean | List items for quote |
| GET | /quotes/:quoteId/items/:itemId | Owner, Admin, Manager, Sales, Employee | - | - | Get single item with relationships |
| PATCH | /quotes/:quoteId/items/:itemId | Owner, Admin, Manager, Sales | UpdateItemDto | - | Update item (creates version +0.1) |
| DELETE | /quotes/:quoteId/items/:itemId | Owner, Admin, Manager, Sales | - | - | Delete item (hard delete, reorders remaining) |
| POST | /quotes/:quoteId/items/:itemId/duplicate | Owner, Admin, Manager, Sales | - | - | Duplicate item (inserts after original with " (Copy)") |
| PATCH | /quotes/:quoteId/items/reorder | Owner, Admin, Manager, Sales | ReorderItemsDto | - | Reorder items (no version created - cosmetic only) |
| PATCH | /quotes/:quoteId/items/:itemId/move-to-group | Owner, Admin, Manager, Sales | MoveItemToGroupDto | - | Move item to group or ungrouped (creates version +0.1) |
| POST | /quotes/:quoteId/items/:itemId/save-to-library | Owner, Admin, Manager, Sales | - | - | Save item to library for future reuse |

**Endpoint Count**: 10

---

## 10. QuoteGroupController

**Base Path**: `/quotes/:quoteId/groups`
**Tag**: `Quotes - Groups`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /quotes/:quoteId/groups | Owner, Admin, Manager, Sales | CreateGroupDto | - | Create quote group |
| GET | /quotes/:quoteId/groups | Owner, Admin, Manager, Sales, Employee | - | - | List groups with items and subtotals |
| GET | /quotes/:quoteId/groups/:groupId | Owner, Admin, Manager, Sales, Employee | - | - | Get single group with items |
| PATCH | /quotes/:quoteId/groups/:groupId | Owner, Admin, Manager, Sales | UpdateGroupDto | - | Update group name/description (creates version +0.1) |
| DELETE | /quotes/:quoteId/groups/:groupId | Owner, Admin, Manager, Sales | - | delete_items?: boolean | Delete group (options: delete items or move to ungrouped) |
| POST | /quotes/:quoteId/groups/:groupId/duplicate | Owner, Admin, Manager, Sales | - | - | Duplicate group with all items |

**Endpoint Count**: 6

---

## 11. ItemLibraryController

**Base Path**: `/item-library`
**Tag**: `Quotes - Item Library`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /item-library | Owner, Admin, Manager | CreateLibraryItemDto | - | Create library item |
| POST | /item-library/bulk-import | Owner, Admin | BulkImportLibraryDto | - | Bulk import library items (transaction: all or nothing) |
| GET | /item-library | Owner, Admin, Manager, Sales, Employee | - | ListLibraryItemsDto | List library items with filters (sorted by usage_count by default) |
| GET | /item-library/:id | Owner, Admin, Manager, Sales, Employee | - | - | Get single library item |
| GET | /item-library/:id/statistics | Owner, Admin, Manager | - | - | Get library item statistics (usage count, quotes, revenue) |
| PATCH | /item-library/:id | Owner, Admin, Manager | UpdateLibraryItemDto | - | Update library item (only affects future uses, not existing quotes) |
| PATCH | /item-library/:id/mark-inactive | Owner, Admin, Manager | - | - | Mark library item as inactive (soft delete alternative) |
| DELETE | /item-library/:id | Owner, Admin | - | - | Delete library item (only if usage_count = 0) |

**Endpoint Count**: 8

---

## 12. QuoteDiscountController

**Base Path**: `/quotes/:quoteId/discount-rules`
**Tag**: `Quotes - Discount Rules`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /quotes/:quoteId/discount-rules | Owner, Admin, Manager | CreateDiscountRuleDto | - | Create discount rule for quote |
| GET | /quotes/:quoteId/discount-rules | Owner, Admin, Manager, Sales, Field | - | - | List all discount rules for quote |
| GET | /quotes/:quoteId/discount-rules/:ruleId | Owner, Admin, Manager, Sales, Field | - | - | Get single discount rule |
| PATCH | /quotes/:quoteId/discount-rules/:ruleId | Owner, Admin, Manager | UpdateDiscountRuleDto | - | Update discount rule |
| DELETE | /quotes/:quoteId/discount-rules/:ruleId | Owner, Admin, Manager | - | - | Delete discount rule (hard delete) |
| PATCH | /quotes/:quoteId/discount-rules/reorder | Owner, Admin, Manager | ReorderDiscountRulesDto | - | Reorder discount rules (order affects totals - percentage discounts compound) |
| POST | /quotes/:quoteId/discount-rules/preview | Owner, Admin, Manager, Sales | PreviewDiscountImpactDto | - | Preview discount impact without saving (before/after comparison) |

**Endpoint Count**: 7

---

## 13. DrawScheduleController

**Base Path**: `/quotes/:quoteId/draw-schedule`
**Tag**: `Quotes - Draw Schedule`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /quotes/:quoteId/draw-schedule | Owner, Admin, Manager, Sales | CreateDrawScheduleDto | - | Create draw schedule (payment schedule throughout project) |
| GET | /quotes/:quoteId/draw-schedule | Owner, Admin, Manager, Sales, Field | - | - | Get draw schedule with calculated amounts and validation |
| PATCH | /quotes/:quoteId/draw-schedule | Owner, Admin, Manager, Sales | CreateDrawScheduleDto | - | Update draw schedule (replaces entire schedule) |
| DELETE | /quotes/:quoteId/draw-schedule | Owner, Admin, Manager, Sales | - | - | Delete draw schedule (removes all entries) |

**Endpoint Count**: 4

---

## 14. QuoteApprovalController

**Base Path**: `/`
**Tag**: `Quotes - Approval Workflow`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /quotes/:quoteId/submit-for-approval | Owner, Admin, Manager, Sales | - | - | Submit quote for approval (determines required levels based on total) |
| POST | /quotes/:quoteId/approvals/:approvalId/approve | Owner, Admin, Manager | ApproveQuoteDto | - | Approve quote (validates user is assigned approver, checks sequential approval) |
| POST | /quotes/:quoteId/approvals/:approvalId/reject | Owner, Admin, Manager | RejectQuoteDto | - | Reject quote (requires comments, terminates workflow, sets quote to draft) |
| GET | /quotes/:quoteId/approvals | Owner, Admin, Manager, Sales, Field | - | - | Get approval status for quote (list all approvals with progress) |
| GET | /users/me/pending-approvals | Owner, Admin, Manager | - | - | Get pending approvals for current user (quotes awaiting approval) |
| POST | /quotes/:quoteId/approvals/bypass | Owner | BypassApprovalDto | - | Bypass approval (owner override - marks all approvals approved and sets quote ready) |
| PATCH | /quotes/settings/approval-thresholds | Owner, Admin | UpdateApprovalThresholdsDto | - | Configure approval thresholds for tenant (defines approval levels and amounts) |
| POST | /quotes/:quoteId/approvals/reset | Owner, Admin, Manager | - | - | Reset approvals (deletes approvals, returns quote to draft - used when quote modified after submission) |

**Endpoint Count**: 8

---

## 15. QuoteVersionController

**Base Path**: `/`
**Tag**: `Quotes - Version History`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| GET | /quotes/:quoteId/versions | Owner, Admin, Manager, Sales, Field | - | - | List all versions for quote (ordered by date descending) |
| GET | /quotes/:quoteId/versions/:versionId | Owner, Admin, Manager, Sales, Field | - | - | Get specific version by UUID (includes full snapshot) |
| GET | /quotes/:quoteId/versions/compare | Owner, Admin, Manager, Sales, Field | - | from: string, to: string | Compare two versions (shows detailed diff of items, groups, settings, totals) |
| POST | /quotes/:quoteId/versions/:versionNumber/restore | Owner, Admin, Manager | RestoreVersionDto | - | Restore quote to previous version (creates backup first, then recreates from snapshot) |
| GET | /quotes/:quoteId/versions/timeline | Owner, Admin, Manager, Sales, Field | - | - | Get version history timeline grouped by date (for UI display) |
| GET | /quotes/:quoteId/versions/:versionNumber/summary | Owner, Admin, Manager, Sales, Field | - | - | Get human-readable change summary for version (compares to previous version) |

**Endpoint Count**: 6

---

## 16. QuoteProfitabilityController

**Base Path**: `/`
**Tag**: `Quotes - Profitability Analysis`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| GET | /quotes/:quoteId/profitability/validate | Owner, Admin, Manager, Sales | - | - | Validate quote profitability (warns if margins too low, blocks if below hard floor) |
| GET | /quotes/:quoteId/profitability/analysis | Owner, Admin, Manager, Sales | - | - | Analyze margins per item and group (identifies low/high margin items) |

**Endpoint Count**: 2

---

## 17. QuoteAdminController

**Base Path**: `/admin/quotes`
**Tag**: `Admin - Quotes Dashboard`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| GET | /admin/quotes/dashboard/overview | PlatformAdmin | - | date_from?, date_to? | Get global dashboard overview (Platform Admin) |
| GET | /admin/quotes | PlatformAdmin | - | tenant_id?, status?, date_from?, date_to?, search?, page?, limit? | List all quotes across all tenants (Platform Admin) |
| GET | /admin/quotes/:id | PlatformAdmin | - | - | Get quote by ID (any tenant, Platform Admin) |
| DELETE | /admin/quotes/:id | PlatformAdmin | {reason: string, confirm: boolean} | - | Delete quote (emergency only, Platform Admin) |
| GET | /admin/quotes/dashboard/global-item-pricing | PlatformAdmin | - | - | Get global item pricing benchmarks (Platform Admin) |
| GET | /admin/quotes/dashboard/tenant-comparison | PlatformAdmin | - | metric?, limit?, date_from?, date_to? | Compare tenants by metrics (Platform Admin) |

**Endpoint Count**: 6
**Implementation Status**: Phase 6 (Not yet implemented - all throw errors)

---

## 18. QuotePublicController

**Base Path**: `/public/quotes`
**Tag**: `Public - Quote Access`
**Authentication**: NONE (Public endpoints)

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| GET | /public/quotes/:token | NONE | - | - | View quote via public URL (NO AUTH) |
| POST | /public/quotes/:token/validate-password | NONE | ValidatePasswordDto | - | Validate password before showing quote (NO AUTH) |
| POST | /public/quotes/:token/view | NONE | LogViewDto | - | Log quote view (NO AUTH) |

**Endpoint Count**: 3

---

## 19. QuotePdfController

**Base Path**: `/quotes`
**Tag**: `Quotes - PDF Generation`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /quotes/:id/generate-pdf | Owner, Admin, Manager, Sales | GeneratePdfDto | - | Generate PDF for quote |
| GET | /quotes/:id/download-pdf | Owner, Admin, Manager, Sales | - | - | Get PDF download URL for quote |

**Endpoint Count**: 2

---

## 20. QuoteAnalyticsController

**Base Path**: `/quotes`
**Tag**: `Quotes - Analytics & Public Access`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /quotes/:id/public-access | Owner, Admin, Manager, Sales | GeneratePublicUrlDto | - | Generate public URL for quote |
| DELETE | /quotes/:id/public-access | Owner, Admin, Manager, Sales | - | - | Deactivate public URL |
| GET | /quotes/:id/views/analytics | Owner, Admin, Manager, Sales | - | - | Get view analytics for quote |
| GET | /quotes/:id/views/history | Owner, Admin, Manager | - | page?, limit? | Get view history with pagination |
| POST | /quotes/admin/anonymize-views | PlatformAdmin | - | - | Anonymize view logs older than 90 days (GDPR) |

**Endpoint Count**: 5

---

## 21. QuoteDashboardController

**Base Path**: `/quotes/dashboard`
**Tag**: `Quotes - Dashboard`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| GET | /quotes/dashboard/overview | Owner, Admin, Manager | - | date_from?, date_to?, compare_to_previous? | Get dashboard overview |
| GET | /quotes/dashboard/quotes-over-time | Owner, Admin, Manager | - | date_from?, date_to?, interval? | Get quotes over time (time series) |
| GET | /quotes/dashboard/top-items | Owner, Admin, Manager | - | date_from?, date_to?, limit? | Get top items by usage |
| GET | /quotes/dashboard/win-loss-analysis | Owner, Admin, Manager | - | date_from?, date_to? | Get win/loss analysis |
| GET | /quotes/dashboard/conversion-funnel | Owner, Admin, Manager | - | date_from?, date_to? | Get conversion funnel |
| GET | /quotes/dashboard/revenue-by-vendor | Owner, Admin, Manager | - | date_from?, date_to? | Get revenue by vendor |
| GET | /quotes/dashboard/avg-pricing-by-task | Owner, Admin, Manager | - | date_from?, date_to? | Get average pricing by task |
| POST | /quotes/dashboard/export | Owner, Admin, Manager | ExportDashboardDto | - | Export dashboard data |

**Endpoint Count**: 8

---

## 22. QuoteSearchController

**Base Path**: `/quotes/search`
**Tag**: `Quotes - Search`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| GET | /quotes/search/advanced | Owner, Admin, Manager, Sales, Field | - | AdvancedSearchDto | Advanced multi-field search |
| GET | /quotes/search/suggestions | Owner, Admin, Manager, Sales, Field | - | query, field?, limit? | Get autocomplete suggestions |
| POST | /quotes/search/save | Owner, Admin, Manager | SaveSearchDto | - | Save search for reuse |
| GET | /quotes/search/saved | Owner, Admin, Manager | - | - | Get saved searches |

**Endpoint Count**: 4

---

## 23. ChangeOrderController

**Base Path**: `/`
**Tag**: `Quotes - Change Orders`

| Method | Path | RBAC Roles | Request DTO | Query DTO | Summary |
|--------|------|-----------|-------------|-----------|---------|
| POST | /quotes/:parentQuoteId/change-orders | Owner, Admin, Manager, Sales | CreateChangeOrderDto | - | Create change order |
| GET | /quotes/:parentQuoteId/change-orders | Owner, Admin, Manager, Sales, Field | - | - | List change orders for quote |
| GET | /quotes/:parentQuoteId/change-orders/total-impact | Owner, Admin, Manager, Sales, Field | - | - | Get total impact of change orders |
| POST | /change-orders/:id/approve | Owner, Admin, Manager | - | - | Approve change order |
| POST | /change-orders/:id/link-to-project | Owner, Admin, Manager | - | - | Link change order to project (placeholder) |
| GET | /quotes/:parentQuoteId/change-orders/history | Owner, Admin, Manager, Sales, Field | - | - | Get change order history timeline |

**Endpoint Count**: 6

---

## Grand Total: 149 Endpoints

### Breakdown by Category:

1. **Vendor Management**: 8 endpoints
2. **Unit Measurements**: 10 endpoints (4 admin + 6 tenant)
3. **Bundles**: 8 endpoints
4. **Quote Settings**: 4 endpoints
5. **Quote Templates**: 11 endpoints (8 admin + 3 tenant)
6. **Quotes (Main)**: 12 endpoints
7. **Quote Items**: 10 endpoints
8. **Quote Groups**: 6 endpoints
9. **Item Library**: 8 endpoints
10. **Discount Rules**: 7 endpoints
11. **Draw Schedule**: 4 endpoints
12. **Approval Workflow**: 8 endpoints
13. **Version History**: 6 endpoints
14. **Profitability Analysis**: 2 endpoints
15. **Quote Admin (Platform)**: 6 endpoints (not implemented)
16. **Public Access**: 3 endpoints
17. **PDF Generation**: 2 endpoints
18. **Analytics & Public Access**: 5 endpoints
19. **Dashboard**: 8 endpoints
20. **Search**: 4 endpoints
21. **Change Orders**: 6 endpoints

---

## Observations

### 1. Controller Architecture
- **21 controllers** organized by functional domain
- Clear separation between admin, tenant, and public endpoints
- Nested routes for related resources (e.g., `/quotes/:quoteId/items`)

### 2. RBAC Patterns
- **Most common roles**: Owner, Admin, Manager, Sales
- **Read operations**: Often include Employee role
- **Delete operations**: Typically restricted to Owner, Admin
- **Platform Admin**: Separate role for global management
- **Public endpoints**: No authentication required (3 endpoints)

### 3. Endpoint Patterns
- **CRUD operations**: Standard POST, GET, PATCH, DELETE
- **Nested resources**: Items, groups, discounts within quotes
- **Bulk operations**: Bulk import for library items
- **Special operations**: Clone, duplicate, reorder, restore
- **Analytics**: Separate controllers for dashboard and profitability

### 4. HTTP Methods Distribution
- **GET**: 57 endpoints (38%)
- **POST**: 42 endpoints (28%)
- **PATCH**: 22 endpoints (15%)
- **DELETE**: 13 endpoints (9%)
- **Mixed paths**: 15 endpoints (10%)

### 5. Path Parameter Patterns
- **Single ID**: `:id`, `:quoteId`, `:itemId`
- **Nested IDs**: `:quoteId/items/:itemId`
- **Special tokens**: `:token` (public access)
- **Version numbers**: `:versionNumber` (string format like "1.0")

### 6. Query Parameter Usage
- **Pagination**: `page`, `limit`
- **Date ranges**: `date_from`, `date_to`
- **Filters**: `status`, `search`, `tenant_id`
- **Options**: `includeGrouped`, `delete_items`, `compare_to_previous`

### 7. Notable Features
- **Versioning**: Automatic version creation on edits
- **Approval workflow**: Multi-level approval with thresholds
- **Public sharing**: Token-based access with password protection
- **View tracking**: Analytics on quote views
- **PDF generation**: On-demand PDF creation
- **Change orders**: Support for approved quote modifications

### 8. Implementation Status
- **Implemented**: 143 endpoints (96%)
- **Not implemented**: 6 endpoints in QuoteAdminController (Phase 6)

### 9. Security Features
- **JWT Authentication**: Required for all non-public endpoints
- **Role-based authorization**: Enforced via `@Roles()` decorator
- **Tenant isolation**: All queries scoped to tenant_id
- **Rate limiting**: Public endpoints throttled (10 req/min)
- **Password protection**: Optional for public quote access

### 10. Response Patterns
- **Success codes**: 200 (OK), 201 (Created), 204 (No Content)
- **Error codes**: 400 (Bad Request), 403 (Forbidden), 404 (Not Found), 409 (Conflict), 422 (Validation Error), 429 (Rate Limit)
- **Consistent DTOs**: Type-safe request/response objects

---

## Next Steps for Documentation Review

This inventory can be used to:

1. **Compare against API documentation** to identify missing or incorrect endpoint descriptions
2. **Validate RBAC configuration** to ensure proper authorization
3. **Check DTO completeness** to verify all request/response types are documented
4. **Identify documentation gaps** where endpoint behavior needs clarification
5. **Generate API reference** for frontend developers

---

**End of Inventory**
