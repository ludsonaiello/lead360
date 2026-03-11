# Integration Handoff Table
## Lead360 — Project Management Module ↔ Financial Module (Project-Scoped)

**Version**: 1.0  
**Authority**: This document is the binding interface contract between the Project Management Module and the Financial Module (Project-Scoped). All agents treat it as law. Deviations require human approval and a version update to this document.

---

## PURPOSE

This table defines exactly:
1. What each module owns
2. What each module exposes to the other
3. At which sprint gate the switch must occur
4. What must exist before the next module sprint can continue

---

## MODULE OWNERSHIP MAP

| Entity | Owned By | Consumed By |
|--------|----------|-------------|
| `project` | Project Module | Financial Module (reads for summary) |
| `project_task` | Project Module | Financial Module (links costs) |
| `crew_member` | Project Module | Financial Module (payment records) |
| `subcontractor` | Project Module | Financial Module (payment records, invoices) |
| `project_log` | Project Module | Portal (public read) |
| `project_document` | Project Module | Portal (public read if flagged) |
| `project_photo` | Project Module | Portal (public read if flagged) |
| `permit` | Project Module | — |
| `inspection` | Project Module | — |
| `task_dependency` | Project Module | — |
| `project_template` | Project Module | — |
| `completion_checklist` | Project Module | — |
| `punch_list_item` | Project Module | — |
| `financial_entry` | Financial Module | Project Module (reads for summary display) |
| `financial_category` | Financial Module | Project Module (used when logging task costs) |
| `task_cost_entry` | Financial Module | Project Module (displays in task detail) |
| `receipt` | Financial Module | Project Module (displays in task detail) |
| `crew_payment_record` | Financial Module | Project Module (displays in crew profile) |
| `subcontractor_payment_record` | Financial Module | Project Module (displays in sub profile) |
| `subcontractor_task_invoice` | Financial Module | Project Module (displays in task detail) |

---

## FINANCIAL GATE DEFINITIONS

### GATE 1 — Financial Entry Model + Cost Categories

**Trigger**: Project Module needs to log costs on tasks  
**What Financial Module must deliver before Project Module continues**:

| Entity | Fields Required |
|--------|----------------|
| `financial_category` | id, tenant_id, name, type (labor/material/subcontractor/equipment/other), is_active |
| `financial_entry` | id, tenant_id, project_id (nullable FK), task_id (nullable FK), amount, category_id, type (income/expense), date, notes, created_by_user_id |

**Services Financial Module must export**:
- `FinancialCategoryService.findAllForTenant(tenantId)` — returns active categories
- `FinancialEntryService.createEntry(tenantId, dto)` — creates a financial entry linked to project/task
- `FinancialEntryService.getProjectSummary(tenantId, projectId)` — returns cost totals by category

**Project Module sprint that is blocked until Gate 1 is open**: Task cost logging sprint

---

### GATE 2 — Receipt Entity + Task-Cost Linking

**Trigger**: Project Module needs receipt capture on tasks  
**What Financial Module must deliver**:

| Entity | Fields Required |
|--------|----------------|
| `receipt` | id, tenant_id, financial_entry_id, file_url, file_name, amount, vendor_name, receipt_date, category_id, ocr_raw (nullable), ocr_status (pending/complete/failed), notes |

**Services Financial Module must export**:
- `ReceiptService.attachToEntry(tenantId, financialEntryId, fileUrl, dto)` — links receipt to existing financial entry
- `ReceiptService.createStandalone(tenantId, projectId, taskId, fileUrl, dto)` — creates entry + receipt in one operation

**Project Module sprint that is blocked until Gate 2 is open**: Receipt capture per task sprint

---

### GATE 3 — Crew Payment Records + Subcontractor Payment Records

**Trigger**: Project Module crew and subcontractor profiles need financial history  
**What Financial Module must deliver**:

| Entity | Fields Required |
|--------|----------------|
| `crew_payment_record` | id, tenant_id, crew_member_id, amount, payment_date, payment_method (cash/check/bank_transfer/venmo/zelle), reference_number (nullable), notes (nullable), created_by_user_id |
| `subcontractor_payment_record` | id, tenant_id, subcontractor_id, project_id (nullable), amount, payment_date, payment_method, reference_number (nullable), notes (nullable), created_by_user_id |
| `subcontractor_task_invoice` | id, tenant_id, subcontractor_id, task_id, project_id, amount, invoice_number (nullable), invoice_date, status (pending/approved/paid), notes (nullable), file_url (nullable) |

**Services Financial Module must export**:
- `CrewPaymentService.create(tenantId, crewMemberId, dto)` — records a payment to crew member
- `CrewPaymentService.getHistory(tenantId, crewMemberId)` — returns payment history
- `SubcontractorPaymentService.create(tenantId, subcontractorId, dto)` — records payment
- `SubcontractorPaymentService.getHistory(tenantId, subcontractorId)` — returns payment history
- `SubcontractorInvoiceService.createForTask(tenantId, taskId, subcontractorId, dto)` — creates invoice linked to task

**Project Module sprint that is blocked until Gate 3 is open**: Crew financial profile sprint, Subcontractor financial profile sprint

---

## DATA INTERFACES

### Project Module → Financial Module

When Project Module calls Financial Module services, it always passes:

```
tenantId: string (UUID)          — always first parameter
projectId: string (UUID)         — for project-linked entries
taskId: string (UUID)            — for task-linked entries
```

Financial Module MUST validate that `projectId` and `taskId` belong to `tenantId` before creating any entry.

---

### Financial Module → Project Module

Financial Module exposes read-only summary data to Project Module for display purposes:

**Project Cost Summary** (used in project detail header and dashboard):
```
{
  total_contract_value: number,      // from quote total
  total_actual_cost: number,         // sum of all task_cost_entries
  cost_by_category: {
    labor: number,
    material: number,
    subcontractor: number,
    equipment: number,
    other: number
  },
  total_payments_out: number,        // crew + subcontractor payments
  margin_estimated: number,          // contract_value - estimated_costs
  margin_actual: number              // contract_value - actual_costs (when financial module active)
}
```

**Task Cost Summary** (used in task detail):
```
{
  task_id: string,
  total_cost: number,
  entries: [
    {
      id: string,
      category: string,
      amount: number,
      date: string,
      notes: string,
      has_receipt: boolean,
      receipt_url: string | null
    }
  ]
}
```

---

## EXISTING MODULE INTERFACES

Both new modules must integrate with these existing platform modules. Read these before building:

### Communications Module (existing)
**Used for**: SMS from task, SMS timeline on lead/customer profile  
**How to call**: Import `CommunicationsService`, call `sendSms(tenantId, from, to, body, metadata)`  
**Metadata must include**: `{ source: 'project_task', project_id, task_id }` — this ensures SMS appears on task timeline AND lead timeline  

### Quote Module (existing)
**Used for**: Reading quote data on project creation, locking quote from deletion  
**How to call**: Import `QuoteService`, call `lockQuote(tenantId, quoteId)` and `getQuoteWithItems(tenantId, quoteId)`  
**Quote lock rule**: When project is created, call `lockQuote()` — this sets `deletion_locked = true` on the quote  

### Leads Module (existing)
**Used for**: Updating lead status to 'customer' when project is created  
**How to call**: Import `LeadsService`, call `updateStatus(tenantId, leadId, userId, { status: 'customer' })`  
**Note**: This is already partially implemented in `quote.service.ts` for `approved` status — verify existing behavior before duplicating  

### Google Calendar Module (existing / in progress)
**Used for**: Creating calendar events from tasks  
**How to call**: Import existing calendar service — verify current interface before building task calendar integration  
**Sync requirement**: Event must be stored in both Google Calendar AND internal calendar table  

### Auth Module (existing)
**Used for**: JWT guard, role guard, tenant extraction  
**Never re-implement**: Always use existing `JwtAuthGuard`, `RolesGuard`, `@TenantId()` decorator  

### Audit Module (existing)
**Used for**: Audit logging on all write operations  
**How to call**: Import `AuditLogger`, follow existing pattern in any existing service  

---

## PORTAL TOKEN ARCHITECTURE

Customer portal auth is separate from business app auth. The portal token system:

**URL structure**:
```
Customer Public Hub:  https://{tenant_subdomain}.lead360.app/public/{customer_slug}/
Quote view:           .../public/{customer_slug}/quote/{token}
Project portal home:  .../public/{customer_slug}/projects/
Project detail:       .../public/{customer_slug}/projects/{id}
```

**`customer_slug`**: URL-safe slug generated from customer name at portal account creation. Stored on `portal_account.customer_slug`. Example: "john-smith", "acme-roofing-llc".

**Token creation**: When project is created from accepted quote, a `portal_access_token` is generated for the customer  
**Token storage**: Stored in `customer_portal_session` table, linked to `lead_id` (not project — one login per customer across all projects)  
**Token validation**: Portal endpoints validate token → get tenant_id and lead_id → scope all data to that customer's projects within that tenant  
**Security rules**:
- Portal token NEVER grants access to business app endpoints
- Portal token is NOT a JWT — it is a separate auth mechanism
- Portal token is scoped to one customer (lead_id) and one tenant (tenant_id)
- Portal session has configurable expiry (default: 30 days with activity reset)

**Static file access**: Files under `/public/{tenant_id}/` are served by Nginx without any token. The portal does not need to proxy images or documents — the URL from the database is the display URL.

---

## NAMING CONVENTIONS FOR NEW ENTITIES

All new database tables use these conventions:

| Module | Table Prefix |
|--------|-------------|
| Project Management | `project_` |
| Crew | `crew_` |
| Subcontractor | `subcontractor_` |
| Financial (Project-Scoped) | `financial_` or entity name directly (`receipt`, `cost_entry`) |
| Customer Portal | `portal_` |
| Permit/Inspection | `permit_`, `inspection_` |

---

## CHANGE CONTROL

Any change to this document must be:
1. Approved by the human operator (Ludson)
2. Versioned (increment version number)
3. Communicated to all active agents before they continue work
4. Logged in the DEVIATION_LOG.md

---

**End of Integration Handoff Table**  
**All agents: treat this as immutable unless a new version is issued.**