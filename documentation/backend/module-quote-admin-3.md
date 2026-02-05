# Admin Backend Dev 3: Operational Tools & Emergency Operations

**Developer**: Backend Developer 3  
**Duration**: 6 days  
**Prerequisites**: Read `ADMIN_BACKEND_GLOBAL_INSTRUCTIONS.md` and `ADMIN_FEATURE_CONTRACT.md`

---

## YOUR MISSION

Build operational and emergency tools:
- Emergency quote operations (hard delete, repair)
- System diagnostics
- Bulk operations
- Data cleanup tools

---

## API ENDPOINTS TO IMPLEMENT

### Hard Delete Quote (Emergency)
**Endpoint**: `DELETE /admin/quotes/:id/hard-delete`

**Request Body**:
- `reason` (string, required, min 10 chars)
- `confirm` (boolean, must be true)

**Response**:
```
{
  message: "Quote deleted permanently",
  quote_id: string,
  tenant_id: string,
  deleted_at: string,
  deleted_by: string,
  reason: string
}
```

**Business Logic**:
- Validate confirmation flag
- Log audit trail before deletion
- Cascade delete: items, groups, approvals, versions, attachments
- Send notification to tenant owner
- Cannot be undone

**Security**: Audit log mandatory

---

### Bulk Update Quote Status
**Endpoint**: `POST /admin/quotes/bulk-update`

**Request Body**:
- `quote_ids` (array of UUIDs)
- `new_status` (quote status enum)
- `reason` (string, required)

**Response**:
```
{
  updated_count: number,
  failed_count: number,
  errors: array
}
```

**Business Logic**:
- Validate all quote IDs exist
- Update status for each
- Skip quotes that cannot transition (business rules)
- Log each update
- Return summary

---

### Repair Broken Quote
**Endpoint**: `POST /admin/quotes/:id/repair`

**Request Body**:
- `issue_type`: `recalculate_totals` | `fix_relationships` | `reset_status`
- `notes` (string, optional)

**Response**:
```
{
  message: "Quote repaired successfully",
  repairs_made: array,
  before: object,
  after: object
}
```

**Repair Types**:
- Recalculate totals: Re-run pricing service
- Fix relationships: Repair foreign key issues
- Reset status: Force status change

---

### Run System Diagnostics
**Endpoint**: `GET /admin/diagnostics/run-tests`

**Query Parameters**:
- `test_type`: `all` | `pdf` | `email` | `storage` | `database`

**Response**:
```
{
  test_suite: string,
  tests_run: number,
  passed: number,
  failed: number,
  results: [
    {
      test_name: string,
      status: "pass" | "fail",
      duration_ms: number,
      error_message: string | null
    }
  ]
}
```

**Tests to Implement**:
- PDF generation test (generate sample PDF)
- Email delivery test (send test email)
- Storage connectivity test (write/read/delete file)
- Database health check (query performance)
- Google Maps API test (geocode sample address)

---

### Cleanup Orphaned Records
**Endpoint**: `POST /admin/maintenance/cleanup-orphans`

**Request Body**:
- `dry_run` (boolean, default true)
- `entity_type`: `items` | `groups` | `attachments` | `all`

**Response**:
```
{
  dry_run: boolean,
  orphans_found: number,
  orphans_deleted: number,
  details: [
    { entity_type: string, count: number }
  ]
}
```

**Orphan Detection**:
- Items without valid quote_id
- Groups without valid quote_id
- Attachments without valid quote_id or file_id
- Approvals for deleted quotes

---

### List Cross-Tenant Quotes
**Endpoint**: `GET /admin/quotes`

**Query Parameters**:
- `tenant_id` (optional, filter by tenant)
- `status` (optional)
- `search` (quote number, customer name)
- `date_from`, `date_to`
- `page`, `limit`

**Response**:
```
{
  quotes: [
    {
      quote data...
      tenant: { id, company_name, subdomain }
    }
  ],
  pagination: {...},
  filters_applied: {...}
}
```

**Purpose**: Support tool for finding quotes across platform

---

## SERVICE LAYER

Create `AdminOperationsService`:

**Methods**:
- `hardDeleteQuote(quoteId, reason, adminUserId)`
- `bulkUpdateQuoteStatus(quoteIds, newStatus, reason, adminUserId)`
- `repairQuote(quoteId, issueType, notes, adminUserId)`
- `runDiagnostics(testType)`
- `cleanupOrphans(entityType, dryRun)`
- `listQuotesCrossTenant(filters, pagination)`

---

## AUDIT LOGGING

Every operation MUST log:
- Admin user ID
- Action performed
- Entity affected
- Reason (if provided)
- Before/after state
- Timestamp

---

## TESTING REQUIREMENTS

### Unit Tests
- Test hard delete cascade logic
- Test bulk update with mixed valid/invalid IDs
- Test repair operations
- Test orphan detection logic

### Integration Tests
- Execute hard delete (on test data)
- Run bulk update
- Execute diagnostics
- Test dry run vs actual cleanup

---

## DELIVERABLES

1. `AdminOperationsController` (6 endpoints)
2. `AdminOperationsService`
3. Diagnostic test suite
4. Audit logging for all operations
5. Tests
6. Documentation

---

## COMPLETION CRITERIA

- All 6 endpoints functional
- Hard delete works with cascade
- Diagnostics run successfully
- Audit logging complete
- Tests pass