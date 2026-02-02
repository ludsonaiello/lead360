# Change Order REST API Documentation

**Version**: 3.0 (Complete Field-Level Reference from Source Code)
**Last Updated**: January 31, 2026
**Base URL**: `https://api.lead360.app/api/v1`

**SOURCE OF TRUTH**: Every property, type, validation rule, and example in this document is extracted directly from the source code files listed in each section. Nothing is guessed or assumed.

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Prisma Schema (Database Model)](#prisma-schema-database-model)
4. [Data Transfer Objects (DTOs) - Complete Field Reference](#data-transfer-objects-dtos---complete-field-reference)
5. [API Endpoints - Complete Reference](#api-endpoints---complete-reference)
6. [Service Business Logic - Exact Implementation](#service-business-logic---exact-implementation)
7. [Error Handling - Complete Reference](#error-handling---complete-reference)
8. [Frontend TypeScript Types (Correct)](#frontend-typescript-types-correct)
9. [Frontend API Client (Correct)](#frontend-api-client-correct)
10. [Frontend Type Discrepancy Report](#frontend-type-discrepancy-report)
11. [Workflow Examples](#workflow-examples)
12. [Integration with Existing Quote Features](#integration-with-existing-quote-features)

---

## Overview

The Change Order API manages modifications to approved quotes. Change orders are implemented as **quote records** with a `parent_quote_id` foreign key pointing to the original approved quote.

### Source Files

| File | Path | Purpose |
|------|------|---------|
| Controller | `api/src/modules/quotes/controllers/change-order.controller.ts` | HTTP endpoint definitions, guards, decorators |
| Service | `api/src/modules/quotes/services/change-order.service.ts` | Business logic, database operations |
| DTO Index | `api/src/modules/quotes/dto/change-order/index.ts` | Barrel export of all DTOs |
| CreateChangeOrderDto | `api/src/modules/quotes/dto/change-order/create-change-order.dto.ts` | Create request body |
| ChangeOrderResponseDto | `api/src/modules/quotes/dto/change-order/change-order-response.dto.ts` | Create/Approve/Reject response |
| ChangeOrderSummaryDto | `api/src/modules/quotes/dto/change-order/change-order-summary.dto.ts` | Lightweight summary (lists) |
| ParentQuoteTotalsDto | `api/src/modules/quotes/dto/change-order/parent-quote-totals.dto.ts` | Aggregated parent totals |
| ApproveChangeOrderDto | `api/src/modules/quotes/dto/change-order/approve-change-order.dto.ts` | Approve request body |
| RejectChangeOrderDto | `api/src/modules/quotes/dto/change-order/reject-change-order.dto.ts` | Reject request body |
| ListChangeOrdersResponseDto | `api/src/modules/quotes/dto/change-order/list-change-orders-response.dto.ts` | List response wrapper |
| ChangeOrderImpactDto | `api/src/modules/quotes/dto/change-order/change-order-impact.dto.ts` | Impact/History DTOs (not exported from index) |
| JobsiteAddressDto | `api/src/modules/quotes/dto/quote/jobsite-address.dto.ts` | Nested address object |
| Prisma Schema | `api/prisma/schema.prisma` (line 1444-1513) | Database model definition |

### Key Concepts

- A change order IS a quote record where `parent_quote_id IS NOT NULL`
- Change order numbers use the prefix `CO-` (e.g., `CO-2026-0001`)
- Change orders inherit customer, vendor, and jobsite from the parent quote unless overridden
- Only approved change orders count toward the revised project total
- Parent quotes with change orders cannot be deleted (`ON DELETE RESTRICT`)

---

## Authentication & Authorization

All endpoints require JWT Bearer token authentication.

```
Authorization: Bearer {jwt-token}
```

`tenant_id` and `user_id` are extracted from the JWT token server-side:

```typescript
// Source: change-order.controller.ts (every endpoint)
const tenantId = req.user.tenant_id;
const userId = req.user.user_id;
```

### RBAC Roles by Endpoint

| Endpoint | Allowed Roles | Source |
|----------|--------------|--------|
| POST `/quotes/:parentQuoteId/change-orders` | Owner, Admin, Manager, Sales | `@Roles('Owner', 'Admin', 'Manager', 'Sales')` line 54 |
| GET `/quotes/:parentQuoteId/change-orders` | Owner, Admin, Manager, Sales, Field | `@Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')` line 76 |
| GET `/quotes/:quoteId/with-change-orders` | Owner, Admin, Manager, Sales, Field | `@Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')` line 95 |
| POST `/change-orders/:id/approve` | Owner, Admin, Manager | `@Roles('Owner', 'Admin', 'Manager')` line 114 |
| POST `/change-orders/:id/reject` | Owner, Admin, Manager | `@Roles('Owner', 'Admin', 'Manager')` line 136 |
| POST `/change-orders/:id/link-to-project` | Owner, Admin, Manager | `@Roles('Owner', 'Admin', 'Manager')` line 158 |
| GET `/quotes/:parentQuoteId/change-orders/history` | Owner, Admin, Manager, Sales, Field | `@Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')` line 170 |

Guards applied to controller class (line 47):
```typescript
@UseGuards(JwtAuthGuard, RolesGuard)
```

---

## Prisma Schema (Database Model)

**Source**: `api/prisma/schema.prisma` lines 1444-1513

### `quote` Model - Change Order Relevant Fields

| Column | Prisma Type | DB Type | Default | Nullable | Description |
|--------|-------------|---------|---------|----------|-------------|
| `id` | `String` | `VarChar(36)` | - | NO | UUID primary key |
| `tenant_id` | `String` | `VarChar(36)` | - | NO | Tenant isolation FK |
| `quote_number` | `String` | `VarChar(50)` | - | NO | `CO-YYYY-####` format for change orders |
| `title` | `String` | `VarChar(200)` | - | NO | Change order title |
| `status` | `quote_status` | ENUM | `draft` | NO | Status enum |
| `lead_id` | `String?` | `VarChar(36)` | - | YES | Inherited from parent quote |
| `vendor_id` | `String?` | `VarChar(36)` | - | YES | Inherited or overridden |
| `jobsite_address_id` | `String` | `VarChar(36)` | - | NO | Inherited or overridden |
| `parent_quote_id` | `String?` | `VarChar(36)` | - | YES | **THE change order identifier** - FK to parent quote |
| `po_number` | `String?` | `VarChar(100)` | - | YES | Purchase order number |
| `private_notes` | `String?` | `Text` | - | YES | Used to store CO description |
| `use_default_settings` | `Boolean` | - | `true` | NO | Whether to use tenant defaults |
| `custom_profit_percent` | `Decimal?` | `Decimal(5,2)` | - | YES | Custom profit % override |
| `custom_overhead_percent` | `Decimal?` | `Decimal(5,2)` | - | YES | Custom overhead % override |
| `custom_contingency_percent` | `Decimal?` | `Decimal(5,2)` | - | YES | Custom contingency % override |
| `custom_tax_rate` | `Decimal?` | `Decimal(5,2)` | - | YES | Custom tax rate override |
| `custom_terms` | `String?` | `Text` | - | YES | Custom terms |
| `custom_payment_instructions` | `String?` | `Text` | - | YES | Custom payment instructions |
| `expiration_days` | `Int?` | - | - | YES | Days until expiration |
| `expires_at` | `DateTime?` | - | - | YES | Calculated expiration date |
| `active_version_number` | `Decimal` | `Decimal(4,2)` | `1.0` | NO | Current version |
| `subtotal` | `Decimal` | `Decimal(12,2)` | `0` | NO | CO subtotal |
| `tax_amount` | `Decimal` | `Decimal(12,2)` | `0` | NO | CO tax amount |
| `discount_amount` | `Decimal` | `Decimal(12,2)` | `0` | NO | CO discount amount |
| `total` | `Decimal` | `Decimal(12,2)` | `0` | NO | CO total |
| `active_template_id` | `String?` | `VarChar(36)` | - | YES | PDF template |
| `is_archived` | `Boolean` | - | `false` | NO | Archive flag |
| `created_by_user_id` | `String?` | `VarChar(36)` | - | YES | Creator user FK |
| `created_at` | `DateTime` | - | `now()` | NO | Creation timestamp |
| `updated_at` | `DateTime` | - | `@updatedAt` | NO | Last update timestamp |
| `latest_pdf_file_id` | `String?` | `VarChar(36)` | - | YES | Cached PDF file FK |
| `pdf_content_hash` | `String?` | `VarChar(64)` | - | YES | PDF cache hash |
| `pdf_last_generated_at` | `DateTime?` | - | - | YES | PDF generation timestamp |
| `pdf_generation_params` | `Json?` | - | - | YES | PDF generation parameters |

### Relations

```prisma
// Self-referential relation for change orders (line 1481, 1500)
parent_quote    quote?    @relation("change_order_parent", fields: [parent_quote_id], references: [id], onDelete: Restrict)
change_orders   quote[]   @relation("change_order_parent")
```

### Indexes

```prisma
@@index([tenant_id, parent_quote_id])  // line 1509 - Fast CO lookup by parent
@@unique([tenant_id, quote_number])     // line 1502 - Unique CO number per tenant
```

### `quote_status` Enum

**Source**: `api/prisma/schema.prisma` lines 1855-1870

```prisma
enum quote_status {
  draft
  pending_approval
  ready
  sent
  delivered
  read
  opened
  downloaded
  approved
  started
  concluded
  denied
  lost
  email_failed
}
```

**14 total values**. All are valid statuses for a change order.

---

## Data Transfer Objects (DTOs) - Complete Field Reference

### 1. CreateChangeOrderDto

**Source**: `api/src/modules/quotes/dto/change-order/create-change-order.dto.ts`
**Used by**: `POST /quotes/:parentQuoteId/change-orders`
**Imports**: `IsString, IsOptional, IsNumber, IsUUID, ValidateNested, Min, Max` from `class-validator`, `Type` from `class-transformer`, `JobsiteAddressDto` from `../quote/jobsite-address.dto`

| # | Property | TypeScript Type | Required | Decorator Validators | Min | Max | Description | Example Value |
|---|----------|----------------|----------|---------------------|-----|-----|-------------|---------------|
| 1 | `title` | `string` | **YES** | `@IsString()` | - | - | Change order title | `"Additional foundation repairs"` |
| 2 | `description` | `string \| undefined` | NO | `@IsOptional()`, `@IsString()` | - | - | Detailed description of changes | `"Customer requested upgraded materials for deck"` |
| 3 | `jobsite_address` | `JobsiteAddressDto \| undefined` | NO | `@IsOptional()`, `@ValidateNested()`, `@Type(() => JobsiteAddressDto)` | - | - | Override jobsite address (defaults to parent quote address) | See JobsiteAddressDto |
| 4 | `vendor_id` | `string \| undefined` | NO | `@IsOptional()`, `@IsUUID()` | - | - | Override vendor UUID (defaults to parent quote vendor) | `"123e4567-e89b-12d3-a456-426614174000"` |
| 5 | `expiration_days` | `number \| undefined` | NO | `@IsOptional()`, `@IsNumber()`, `@Min(1)`, `@Max(365)` | 1 | 365 | Expiration days (defaults to 30 in service) | `30` |
| 6 | `custom_profit_percent` | `number \| undefined` | NO | `@IsOptional()`, `@IsNumber()`, `@Min(0)`, `@Max(100)` | 0 | 100 | Custom profit percentage (overrides parent quote setting) | `20.0` |
| 7 | `custom_overhead_percent` | `number \| undefined` | NO | `@IsOptional()`, `@IsNumber()`, `@Min(0)`, `@Max(100)` | 0 | 100 | Custom overhead percentage (overrides parent quote setting) | `15.0` |
| 8 | `custom_contingency_percent` | `number \| undefined` | NO | `@IsOptional()`, `@IsNumber()`, `@Min(0)`, `@Max(100)` | 0 | 100 | Custom contingency percentage (overrides parent quote setting) | `5.0` |

**Total fields: 8** (1 required, 7 optional)

---

### 2. JobsiteAddressDto (Nested in CreateChangeOrderDto)

**Source**: `api/src/modules/quotes/dto/quote/jobsite-address.dto.ts`
**Imports**: `IsString, IsNumber, IsOptional, Length, Matches` from `class-validator`

| # | Property | TypeScript Type | Required | Decorator Validators | Constraints | Description | Example Value |
|---|----------|----------------|----------|---------------------|-------------|-------------|---------------|
| 1 | `address_line1` | `string` | **YES** | `@IsString()`, `@Length(1, 255)` | Length 1-255 | Street address line 1 | `"123 Main St"` |
| 2 | `address_line2` | `string \| undefined` | NO | `@IsString()`, `@IsOptional()`, `@Length(1, 255)` | Length 1-255 | Street address line 2 | `"Suite 100"` |
| 3 | `city` | `string \| undefined` | NO | `@IsString()`, `@IsOptional()`, `@Length(1, 100)` | Length 1-100 | City name | `"Boston"` |
| 4 | `state` | `string \| undefined` | NO | `@IsString()`, `@IsOptional()`, `@Length(2, 2)` | Exactly 2 chars | State code | `"MA"` |
| 5 | `zip_code` | `string` | **YES** | `@IsString()`, `@Matches(/^\d{5}(-\d{4})?$/)` | Regex: 5 digits or 5+4 | ZIP code | `"02101"` or `"02101-1234"` |
| 6 | `latitude` | `number \| undefined` | NO | `@IsNumber()`, `@IsOptional()` | - | Latitude coordinate | `42.3601` |
| 7 | `longitude` | `number \| undefined` | NO | `@IsNumber()`, `@IsOptional()` | - | Longitude coordinate | `-71.0589` |

**Total fields: 7** (2 required, 5 optional)

---

### 3. ChangeOrderResponseDto

**Source**: `api/src/modules/quotes/dto/change-order/change-order-response.dto.ts`
**Used by**: Create, Approve, and Reject endpoint responses
**Imports**: `ApiProperty, ApiPropertyOptional` from `@nestjs/swagger`

| # | Property | TypeScript Type | Always Present | Swagger Decorator | Description | Example Value |
|---|----------|----------------|----------------|-------------------|-------------|---------------|
| 1 | `id` | `string` | YES | `@ApiProperty` | Change order UUID (36-char) | `"123e4567-e89b-12d3-a456-426614174000"` |
| 2 | `quote_number` | `string` | YES | `@ApiProperty` | Change order number with CO- prefix | `"CO-2026-0001"` |
| 3 | `title` | `string` | YES | `@ApiProperty` | Change order title | `"Additional foundation work"` |
| 4 | `status` | `string` | YES | `@ApiProperty` with `enum` | Change order status (see enum below) | `"draft"` |
| 5 | `parent_quote_id` | `string` | YES | `@ApiProperty` | Parent quote UUID | `"987e6543-e89b-12d3-a456-426614174111"` |
| 6 | `parent_quote_number` | `string` | YES | `@ApiProperty` | Parent quote number | `"Q-2026-0123"` |
| 7 | `parent_original_total` | `number` | YES | `@ApiProperty` | Parent quote original total (float) | `45000.00` |
| 8 | `subtotal` | `number` | YES | `@ApiProperty` | Change order subtotal (float) | `3200.00` |
| 9 | `tax_amount` | `number` | YES | `@ApiProperty` | Tax amount (float) | `256.00` |
| 10 | `discount_amount` | `number` | YES | `@ApiProperty` | Discount amount (float) | `0.00` |
| 11 | `total` | `number` | YES | `@ApiProperty` | Change order total (float) | `3456.00` |
| 12 | `created_at` | `string` | YES | `@ApiProperty` | ISO 8601 timestamp | `"2026-01-30T10:30:00.000Z"` |
| 13 | `updated_at` | `string` | YES | `@ApiProperty` | ISO 8601 timestamp | `"2026-01-30T12:45:00.000Z"` |
| 14 | `approved_at` | `string \| undefined` | **NO** | `@ApiPropertyOptional` | ISO 8601 timestamp, only present when status is `"approved"` | `"2026-01-31T08:00:00.000Z"` |

**Total fields: 14** (13 always present, 1 conditional)

**Status enum values declared in DTO** (line 30):
```
['draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded', 'approved', 'denied', 'started', 'concluded']
```

**How values are populated from service** (`change-order.service.ts` lines 213-227):
```typescript
{
  id: changeOrder.id,                                                    // From DB insert
  quote_number: changeOrder.quote_number,                                // Generated CO-YYYY-####
  title: changeOrder.title,                                              // From dto.title
  status: changeOrder.status,                                            // Always 'draft' on create
  parent_quote_id: parentQuoteId,                                        // From path param
  parent_quote_number: parentQuote.quote_number,                         // From DB lookup
  parent_original_total: parseFloat(parentQuote.total?.toString() || '0'), // Decimal → float
  subtotal: parseFloat(changeOrder.subtotal?.toString() || '0'),         // Decimal → float (0.00 on create)
  tax_amount: parseFloat(changeOrder.tax_amount?.toString() || '0'),     // Decimal → float (0.00 on create)
  discount_amount: parseFloat(changeOrder.discount_amount?.toString() || '0'), // Decimal → float (0.00 on create)
  total: parseFloat(changeOrder.total?.toString() || '0'),               // Decimal → float (0.00 on create)
  created_at: changeOrder.created_at.toISOString(),                      // DateTime → ISO string
  updated_at: changeOrder.updated_at.toISOString(),                      // DateTime → ISO string
  // approved_at: NOT SET on create (undefined)
}
```

**How values are populated on approve** (`change-order.service.ts` lines 496-511):
```typescript
{
  // ... same as above, plus:
  approved_at: updated.updated_at.toISOString(),  // Set to updated_at timestamp
}
```

**How values are populated on reject** (`change-order.service.ts` lines 596-610):
```typescript
{
  // ... same as create, NO approved_at field
}
```

---

### 4. ChangeOrderSummaryDto

**Source**: `api/src/modules/quotes/dto/change-order/change-order-summary.dto.ts`
**Used by**: Arrays inside `ListChangeOrdersResponseDto` and `ParentQuoteTotalsDto`
**Imports**: `ApiProperty, ApiPropertyOptional` from `@nestjs/swagger`

| # | Property | TypeScript Type | Always Present | Swagger Decorator | Description | Example Value |
|---|----------|----------------|----------------|-------------------|-------------|---------------|
| 1 | `id` | `string` | YES | `@ApiProperty` | Change order UUID | `"123e4567-e89b-12d3-a456-426614174000"` |
| 2 | `quote_number` | `string` | YES | `@ApiProperty` | Change order number | `"CO-2026-0001"` |
| 3 | `title` | `string` | YES | `@ApiProperty` | Change order title | `"Additional foundation work"` |
| 4 | `status` | `string` | YES | `@ApiProperty` with `enum` | Status (same 12 values as ChangeOrderResponseDto) | `"draft"` |
| 5 | `total` | `number` | YES | `@ApiProperty` | Change order total (float) | `3456.00` |
| 6 | `created_at` | `string` | YES | `@ApiProperty` | ISO 8601 timestamp | `"2026-01-30T10:30:00.000Z"` |
| 7 | `approved_at` | `string \| undefined` | **NO** | `@ApiPropertyOptional` | Only present when `status === 'approved'` | `"2026-01-31T08:00:00.000Z"` |

**Total fields: 7** (6 always present, 1 conditional)

**How values are mapped from service** (`change-order.service.ts` lines 294-302):
```typescript
{
  id: co.id,
  quote_number: co.quote_number,
  title: co.title || '',                      // Falls back to empty string if null
  status: co.status,
  total: parseFloat(co.total?.toString() || '0'),  // Decimal → float
  created_at: co.created_at.toISOString(),
  approved_at: co.status === 'approved' ? co.updated_at.toISOString() : undefined,
  // ^ IMPORTANT: approved_at uses updated_at timestamp, not a dedicated column
}
```

---

### 5. ParentQuoteTotalsDto

**Source**: `api/src/modules/quotes/dto/change-order/parent-quote-totals.dto.ts`
**Used by**: `GET /quotes/:quoteId/with-change-orders`
**Imports**: `ApiProperty` from `@nestjs/swagger`, `Type` from `class-transformer`, `ChangeOrderSummaryDto`

| # | Property | TypeScript Type | Always Present | Description | Example Value |
|---|----------|----------------|----------------|-------------|---------------|
| 1 | `parent_quote_id` | `string` | YES | Parent quote UUID | `"987e6543-e89b-12d3-a456-426614174111"` |
| 2 | `parent_quote_number` | `string` | YES | Parent quote number | `"Q-2026-0123"` |
| 3 | `original_total` | `number` | YES | Original quote total before any change orders (float) | `45000.00` |
| 4 | `approved_change_orders_total` | `number` | YES | Sum of all approved CO totals (float) | `8500.00` |
| 5 | `pending_change_orders_total` | `number` | YES | Sum of all pending CO totals (float) | `2000.00` |
| 6 | `revised_total` | `number` | YES | `original_total + approved_change_orders_total` (float) | `53500.00` |
| 7 | `approved_co_count` | `number` | YES | Count of approved change orders (integer) | `3` |
| 8 | `pending_co_count` | `number` | YES | Count of pending change orders (integer) | `1` |
| 9 | `change_orders` | `ChangeOrderSummaryDto[]` | YES | Array of ALL change orders (approved, pending, AND rejected) | `[...]` |

**Total fields: 9** (all always present)

**Calculation logic from service** (`change-order.service.ts` lines 365-403):

```typescript
// Approved COs: status === 'approved'
const approvedCOs = changeOrders.filter((co) => co.status === 'approved');

// Pending statuses array (line 367):
const pendingStatuses = ['draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded'];
const pendingCOs = changeOrders.filter((co) => pendingStatuses.includes(co.status));

// Totals (lines 371-380):
const originalTotal = parseFloat(parentQuote.total?.toString() || '0');
const approvedChangeOrdersTotal = approvedCOs.reduce(
  (sum, co) => sum + parseFloat(co.total?.toString() || '0'), 0
);
const pendingChangeOrdersTotal = pendingCOs.reduce(
  (sum, co) => sum + parseFloat(co.total?.toString() || '0'), 0
);
const revisedTotal = originalTotal + approvedChangeOrdersTotal;
// NOTE: revisedTotal does NOT include pending COs

// Counts:
approved_co_count = approvedCOs.length;
pending_co_count = pendingCOs.length;
// NOTE: There is NO rejected_co_count in this DTO
```

**Key behaviors**:
- Rejected COs (`status === 'denied'`) are **NOT** counted in `approved_co_count` or `pending_co_count`
- Rejected COs **ARE** included in the `change_orders` array
- `revised_total = original_total + approved_change_orders_total` (rejected and pending excluded)
- If no change orders exist: all counts = `0`, all totals = `0`, `change_orders = []`

---

### 6. ListChangeOrdersResponseDto

**Source**: `api/src/modules/quotes/dto/change-order/list-change-orders-response.dto.ts`
**Used by**: `GET /quotes/:parentQuoteId/change-orders`
**Imports**: `ApiProperty` from `@nestjs/swagger`, `Type` from `class-transformer`, `ChangeOrderSummaryDto`

| # | Property | TypeScript Type | Always Present | Description | Example Value |
|---|----------|----------------|----------------|-------------|---------------|
| 1 | `parent_quote_id` | `string` | YES | Parent quote UUID | `"987e6543-e89b-12d3-a456-426614174111"` |
| 2 | `parent_quote_number` | `string` | YES | Parent quote number | `"Q-2026-0123"` |
| 3 | `change_orders` | `ChangeOrderSummaryDto[]` | YES | Array of change order summaries | `[...]` |
| 4 | `summary` | `object` | YES | Summary statistics object | See sub-fields |
| 4a | `summary.total_count` | `number` | YES | Total number of all change orders | `5` |
| 4b | `summary.approved_count` | `number` | YES | Change orders with `status === 'approved'` | `3` |
| 4c | `summary.pending_count` | `number` | YES | Change orders with status in pending statuses | `1` |
| 4d | `summary.rejected_count` | `number` | YES | Change orders with `status === 'denied'` | `1` |

**Total fields: 4 top-level** (with 4 nested in `summary`)

**Summary calculation from service** (`change-order.service.ts` lines 288-313):

```typescript
// Approved: exactly 'approved' (line 288)
const approvedCount = changeOrders.filter((co) => co.status === 'approved').length;

// Pending statuses (line 289-290):
const pendingStatuses = ['draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded'];
const pendingCount = changeOrders.filter((co) => pendingStatuses.includes(co.status)).length;

// Rejected: exactly 'denied' (line 291)
const rejectedCount = changeOrders.filter((co) => co.status === 'denied').length;

// Total: all change orders
summary.total_count = changeOrders.length;
```

**Key note**: `total_count` may NOT equal `approved_count + pending_count + rejected_count` if there are COs with statuses like `started`, `concluded`, `lost`, or `email_failed` (these are not counted in any of the three categories).

---

### 7. ApproveChangeOrderDto

**Source**: `api/src/modules/quotes/dto/change-order/approve-change-order.dto.ts`
**Used by**: `POST /change-orders/:id/approve`
**Imports**: `ApiPropertyOptional` from `@nestjs/swagger`, `IsString, IsOptional` from `class-validator`

| # | Property | TypeScript Type | Required | Decorator Validators | Description | Example Value |
|---|----------|----------------|----------|---------------------|-------------|---------------|
| 1 | `notes` | `string \| undefined` | NO | `@IsOptional()`, `@IsString()` | Optional approval notes (stored in audit log and version) | `"Approved by project owner - proceed with additional work"` |

**Total fields: 1** (optional)

**Where `notes` is used in service** (`change-order.service.ts`):
- Line 469: Version description: `dto?.notes || 'Change order approved'`
- Line 488: Audit log metadata_json: `notes: dto?.notes`

An empty body `{}` is valid for this endpoint.

---

### 8. RejectChangeOrderDto

**Source**: `api/src/modules/quotes/dto/change-order/reject-change-order.dto.ts`
**Used by**: `POST /change-orders/:id/reject`
**Imports**: `ApiProperty` from `@nestjs/swagger`, `IsString, MinLength` from `class-validator`

| # | Property | TypeScript Type | Required | Decorator Validators | Constraint | Description | Example Value |
|---|----------|----------------|----------|---------------------|------------|-------------|---------------|
| 1 | `reason` | `string` | **YES** | `@IsString()`, `@MinLength(10, { message: 'Rejection reason must be at least 10 characters' })` | Min 10 chars | Required rejection reason | `"Customer declined additional cost - staying with original scope"` |

**Total fields: 1** (required)

**Where `reason` is used in service** (`change-order.service.ts`):
- Line 570: Version description: `"Change order rejected: ${dto.reason}"`
- Line 583: Audit log description: `"Rejected change order ${changeOrder.quote_number}: ${dto.reason}"`
- Line 588: Audit log metadata_json: `rejection_reason: dto.reason`

**IMPORTANT**: The rejection reason is stored in the **audit log and version history**, NOT in the change order record itself. There is no `rejection_reason` column on the `quote` table.

---

### 9. ChangeOrderImpactDto (NOT exported from index)

**Source**: `api/src/modules/quotes/dto/change-order/change-order-impact.dto.ts`
**Note**: This DTO is defined but **NOT exported from `index.ts`** and **NOT imported in the controller or service**. It exists as a reference/future-use DTO.

| # | Property | TypeScript Type | Description | Example Value |
|---|----------|----------------|-------------|---------------|
| 1 | `parent_quote_id` | `string` | Parent quote ID | `"123e4567-e89b-12d3-a456-426614174000"` |
| 2 | `original_total` | `number` | Original quote total | `50000.00` |
| 3 | `change_orders_total` | `number` | Sum of approved change orders | `7500.00` |
| 4 | `revised_total` | `number` | Revised project total | `57500.00` |
| 5 | `change_order_count` | `number` | Number of change orders | `3` |
| 6 | `approved_count` | `number` | Number of approved change orders | `2` |
| 7 | `pending_count` | `number` | Number of pending change orders | `1` |

**Total fields: 7** (none currently used in endpoints)

---

### 10. ChangeOrderHistoryEventDto (NOT exported from index)

**Source**: `api/src/modules/quotes/dto/change-order/change-order-impact.dto.ts` (lines 36-54)
**Note**: Defined but **NOT exported from `index.ts`**. The history endpoint returns an untyped object instead.

| # | Property | TypeScript Type | Description | Example Value |
|---|----------|----------------|-------------|---------------|
| 1 | `id` | `string` | Event ID (CO UUID) | `"123e4567-e89b-12d3-a456-426614174000"` |
| 2 | `event_type` | `string` | Event type enum | `"change_order_created"` |
| 3 | `change_order_number` | `string` | Change order number | `"CO-2024-001"` |
| 4 | `description` | `string` | Description | `"Change order created for additional work"` |
| 5 | `amount` | `number` | Amount | `5000.00` |
| 6 | `timestamp` | `string` | ISO 8601 timestamp | `"2024-01-20T10:30:00.000Z"` |

---

### 11. ChangeOrderHistoryResponseDto (NOT exported from index)

**Source**: `api/src/modules/quotes/dto/change-order/change-order-impact.dto.ts` (lines 61-67)
**Note**: Defined but **NOT exported from `index.ts`**. The history endpoint returns an untyped object instead.

| # | Property | TypeScript Type | Description |
|---|----------|----------------|-------------|
| 1 | `timeline` | `ChangeOrderHistoryEventDto[]` | Array of history events |
| 2 | `parent_quote_id` | `string` | Parent quote ID |

---

## API Endpoints - Complete Reference

### Endpoint 1: Create Change Order

**Source**: `change-order.controller.ts` lines 53-73

```
POST /api/v1/quotes/:parentQuoteId/change-orders
```

| Attribute | Value |
|-----------|-------|
| HTTP Method | `POST` |
| Route | `quotes/:parentQuoteId/change-orders` |
| HTTP Status | `201 Created` (`@HttpCode(HttpStatus.CREATED)`) |
| RBAC | `Owner, Admin, Manager, Sales` |
| Path Param | `parentQuoteId` - UUID (validated by `ParseUUIDPipe`) |
| Request Body | `CreateChangeOrderDto` |
| Response Type | `ChangeOrderResponseDto` |
| Swagger Tag | `Quotes - Change Orders` |

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `parentQuoteId` | `string` | `ParseUUIDPipe` (must be valid UUID) | Parent quote UUID |

#### Request Body: CreateChangeOrderDto

**Minimal request** (only required field):
```json
{
  "title": "Additional foundation repairs"
}
```

**Full request** (all 8 fields):
```json
{
  "title": "Additional foundation repairs",
  "description": "Customer requested deeper excavation due to soil conditions",
  "jobsite_address": {
    "address_line1": "456 Oak Avenue",
    "address_line2": "Building B",
    "city": "Cambridge",
    "state": "MA",
    "zip_code": "02139",
    "latitude": 42.3736,
    "longitude": -71.1097
  },
  "vendor_id": "a1b2c3d4-e5f6-4789-a012-3456789abcde",
  "expiration_days": 45,
  "custom_profit_percent": 22.5,
  "custom_overhead_percent": 18.0,
  "custom_contingency_percent": 7.0
}
```

#### Response: 201 Created (ChangeOrderResponseDto - 14 fields)

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "quote_number": "CO-2026-0001",
  "title": "Additional foundation repairs",
  "status": "draft",
  "parent_quote_id": "987e6543-e89b-12d3-a456-426614174111",
  "parent_quote_number": "Q-2026-0123",
  "parent_original_total": 45000.00,
  "subtotal": 0.00,
  "tax_amount": 0.00,
  "discount_amount": 0.00,
  "total": 0.00,
  "created_at": "2026-01-30T10:30:00.000Z",
  "updated_at": "2026-01-30T10:30:00.000Z"
}
```

**Notes**:
- `status` is always `"draft"` on creation (hardcoded in service line 167)
- `subtotal`, `tax_amount`, `discount_amount`, `total` are all `0.00` on creation (no items yet)
- `approved_at` is NOT present (undefined) on creation
- `quote_number` is auto-generated as `CO-YYYY-####` (service lines 64-78)

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Parent quote status not in `['approved', 'started', 'concluded']` | `"Parent quote must be approved, started, or concluded to create change order. Current status: {status}"` |
| 400 | Invalid UUID format in path | `"Validation failed (uuid is expected)"` |
| 400 | Missing `title` field | `["title should not be empty", "title must be a string"]` |
| 400 | `expiration_days` < 1 or > 365 | `["expiration_days must not be less than 1"]` or `["expiration_days must not be greater than 365"]` |
| 400 | `custom_profit_percent` < 0 or > 100 | `["custom_profit_percent must not be less than 0"]` or `["custom_profit_percent must not be greater than 100"]` |
| 400 | Invalid `vendor_id` UUID format | `["vendor_id must be a UUID"]` |
| 400 | Invalid zip code format | `["Invalid ZIP code format"]` |
| 404 | Parent quote not found for tenant | `"Parent quote {parentQuoteId} not found"` |
| 404 | Override vendor not found or inactive | `"Vendor not found or inactive"` |

#### cURL Example

```bash
curl -X POST https://api.lead360.app/api/v1/quotes/987e6543-e89b-12d3-a456-426614174111/change-orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Additional foundation repairs",
    "description": "Customer requested deeper excavation",
    "expiration_days": 30,
    "custom_profit_percent": 20.0
  }'
```

---

### Endpoint 2: List Change Orders

**Source**: `change-order.controller.ts` lines 75-92

```
GET /api/v1/quotes/:parentQuoteId/change-orders
```

| Attribute | Value |
|-----------|-------|
| HTTP Method | `GET` |
| Route | `quotes/:parentQuoteId/change-orders` |
| HTTP Status | `200 OK` |
| RBAC | `Owner, Admin, Manager, Sales, Field` |
| Path Param | `parentQuoteId` - UUID |
| Query Params | **None** (no query params in controller) |
| Response Type | `ListChangeOrdersResponseDto` |

**Note**: The service method accepts an optional `status` parameter (line 242), but the controller does NOT expose it as a `@Query()` parameter. Status filtering is not available through the API.

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `parentQuoteId` | `string` | `ParseUUIDPipe` | Parent quote UUID |

#### Response: 200 OK (ListChangeOrdersResponseDto - 4 top-level fields)

```json
{
  "parent_quote_id": "987e6543-e89b-12d3-a456-426614174111",
  "parent_quote_number": "Q-2026-0123",
  "change_orders": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "quote_number": "CO-2026-0001",
      "title": "Additional foundation work",
      "status": "approved",
      "total": 3456.00,
      "created_at": "2026-01-30T10:30:00.000Z",
      "approved_at": "2026-01-31T08:00:00.000Z"
    },
    {
      "id": "234e5678-e89b-12d3-a456-426614174001",
      "quote_number": "CO-2026-0002",
      "title": "Upgraded deck materials",
      "status": "draft",
      "total": 2100.00,
      "created_at": "2026-01-31T14:00:00.000Z"
    }
  ],
  "summary": {
    "total_count": 2,
    "approved_count": 1,
    "pending_count": 1,
    "rejected_count": 0
  }
}
```

**Field behaviors**:
- `change_orders` array is **empty `[]`** if no change orders exist (never null)
- `change_orders` are sorted by `created_at` **descending** (newest first) - service line 274
- `approved_at` only present on items where `status === 'approved'`
- `summary.pending_count` includes statuses: `draft`, `pending_approval`, `ready`, `sent`, `delivered`, `read`, `opened`, `downloaded`
- `summary.rejected_count` counts `status === 'denied'` only

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 404 | Parent quote not found | `"Parent quote {parentQuoteId} not found"` |

#### cURL Example

```bash
curl -X GET https://api.lead360.app/api/v1/quotes/987e6543-e89b-12d3-a456-426614174111/change-orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Endpoint 3: Get Parent Quote with Aggregated Totals

**Source**: `change-order.controller.ts` lines 94-111

```
GET /api/v1/quotes/:quoteId/with-change-orders
```

| Attribute | Value |
|-----------|-------|
| HTTP Method | `GET` |
| Route | `quotes/:quoteId/with-change-orders` |
| HTTP Status | `200 OK` |
| RBAC | `Owner, Admin, Manager, Sales, Field` |
| Path Param | `quoteId` - UUID (note: param name is `quoteId` not `parentQuoteId`) |
| Query Params | **None** |
| Response Type | `ParentQuoteTotalsDto` |

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `quoteId` | `string` | `ParseUUIDPipe` | Parent quote UUID |

#### Response: 200 OK (ParentQuoteTotalsDto - 9 fields)

```json
{
  "parent_quote_id": "987e6543-e89b-12d3-a456-426614174111",
  "parent_quote_number": "Q-2026-0123",
  "original_total": 45000.00,
  "approved_change_orders_total": 8500.00,
  "pending_change_orders_total": 2100.00,
  "revised_total": 53500.00,
  "approved_co_count": 3,
  "pending_co_count": 1,
  "change_orders": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "quote_number": "CO-2026-0001",
      "title": "Additional foundation work",
      "status": "approved",
      "total": 3456.00,
      "created_at": "2026-01-30T10:30:00.000Z",
      "approved_at": "2026-01-31T08:00:00.000Z"
    }
  ]
}
```

**Calculation rules** (exact from service):
- `revised_total = original_total + approved_change_orders_total`
- Rejected COs excluded from all totals
- Pending COs tracked separately in `pending_change_orders_total` but NOT added to `revised_total`
- `change_orders` array sorted by `created_at` descending (service line 361)
- If no COs exist: counts = 0, totals = 0, `change_orders = []`, `revised_total = original_total`

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 404 | Quote not found | `"Parent quote {parentQuoteId} not found"` |

#### cURL Example

```bash
curl -X GET https://api.lead360.app/api/v1/quotes/987e6543-e89b-12d3-a456-426614174111/with-change-orders \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### Endpoint 4: Approve Change Order

**Source**: `change-order.controller.ts` lines 113-133

```
POST /api/v1/change-orders/:id/approve
```

| Attribute | Value |
|-----------|-------|
| HTTP Method | `POST` |
| Route | `change-orders/:id/approve` |
| HTTP Status | `200 OK` |
| RBAC | `Owner, Admin, Manager` (Sales and Field CANNOT approve) |
| Path Param | `id` - Change order UUID |
| Request Body | `ApproveChangeOrderDto` (all fields optional, empty `{}` is valid) |
| Response Type | `ChangeOrderResponseDto` |

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `id` | `string` | `ParseUUIDPipe` | Change order UUID |

#### Request Body: ApproveChangeOrderDto (1 optional field)

```json
{
  "notes": "Approved by project owner - proceed with additional work"
}
```

Or empty:
```json
{}
```

#### Valid Statuses for Approval

The change order must have one of these statuses to be approved (service line 452):
```typescript
const validStatuses = ['ready', 'sent', 'delivered', 'read', 'opened', 'downloaded'];
```

**CANNOT approve from**: `draft`, `pending_approval`, `approved`, `denied`, `started`, `concluded`, `lost`, `email_failed`

#### Response: 200 OK (ChangeOrderResponseDto - 14 fields, `approved_at` NOW present)

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "quote_number": "CO-2026-0001",
  "title": "Additional foundation work",
  "status": "approved",
  "parent_quote_id": "987e6543-e89b-12d3-a456-426614174111",
  "parent_quote_number": "Q-2026-0123",
  "parent_original_total": 45000.00,
  "subtotal": 3200.00,
  "tax_amount": 256.00,
  "discount_amount": 0.00,
  "total": 3456.00,
  "created_at": "2026-01-30T10:30:00.000Z",
  "updated_at": "2026-01-31T08:00:00.000Z",
  "approved_at": "2026-01-31T08:00:00.000Z"
}
```

**Note**: `approved_at` equals `updated_at` (both are the same value from `updated.updated_at`, service line 510).

#### Side Effects

1. **Status change**: `status` set to `'approved'` (line 460)
2. **Version snapshot**: New version created with description = `dto?.notes || 'Change order approved'` (lines 466-472)
3. **Audit log**: Entry created with `action_type: 'updated'`, metadata includes CO number, parent info, total, notes, status (lines 475-491)

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Status not in valid list | `"Change order must be in ready or sent status to approve. Current status: {status}"` |
| 400 | Not a change order (no parent_quote_id) | `"This quote is not a change order"` |
| 404 | Change order not found | `"Change order {changeOrderId} not found"` |
| 404 | Parent quote not found | `"Parent quote not found"` |

#### cURL Example

```bash
curl -X POST https://api.lead360.app/api/v1/change-orders/123e4567-e89b-12d3-a456-426614174000/approve \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes": "Approved by project owner"}'
```

---

### Endpoint 5: Reject Change Order

**Source**: `change-order.controller.ts` lines 135-155

```
POST /api/v1/change-orders/:id/reject
```

| Attribute | Value |
|-----------|-------|
| HTTP Method | `POST` |
| Route | `change-orders/:id/reject` |
| HTTP Status | `200 OK` |
| RBAC | `Owner, Admin, Manager` (Sales and Field CANNOT reject) |
| Path Param | `id` - Change order UUID |
| Request Body | `RejectChangeOrderDto` (`reason` is REQUIRED) |
| Response Type | `ChangeOrderResponseDto` |

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `id` | `string` | `ParseUUIDPipe` | Change order UUID |

#### Request Body: RejectChangeOrderDto (1 required field)

```json
{
  "reason": "Customer declined additional cost - staying with original scope"
}
```

**IMPORTANT**: `reason` must be at least 10 characters.

#### Status Validation for Rejection

**CRITICAL DIFFERENCE from Approve**: The reject service method does **NOT validate status**. It only validates:
1. Change order exists and belongs to tenant (line 532-546)
2. Has `parent_quote_id` (is a change order) (line 552)
3. Has parent_quote (parent exists) (line 557)

This means a change order in **ANY status** (including `draft`) can be rejected. This differs from approve which requires specific statuses.

#### Response: 200 OK (ChangeOrderResponseDto - 13 fields, NO `approved_at`)

```json
{
  "id": "234e5678-e89b-12d3-a456-426614174001",
  "quote_number": "CO-2026-0002",
  "title": "Upgraded deck materials",
  "status": "denied",
  "parent_quote_id": "987e6543-e89b-12d3-a456-426614174111",
  "parent_quote_number": "Q-2026-0123",
  "parent_original_total": 45000.00,
  "subtotal": 2000.00,
  "tax_amount": 100.00,
  "discount_amount": 0.00,
  "total": 2100.00,
  "created_at": "2026-01-31T14:00:00.000Z",
  "updated_at": "2026-01-31T16:00:00.000Z"
}
```

**Note**: `approved_at` is NOT present (undefined).

#### Side Effects

1. **Status change**: `status` set to `'denied'` (line 561-563)
2. **Version snapshot**: Description = `"Change order rejected: {reason}"` (lines 567-573)
3. **Audit log**: Entry created with `description: "Rejected change order {number}: {reason}"`, metadata includes `rejection_reason: dto.reason` (lines 576-591)

#### Where Rejection Reason is Stored

The rejection reason is **NOT** stored on the quote record. It is stored in:
- **quote_version.change_summary**: `"Change order rejected: {reason}"`
- **audit_log.description**: `"Rejected change order {number}: {reason}"`
- **audit_log.metadata_json.rejection_reason**: `dto.reason`

To retrieve the rejection reason, you must query the audit log or version history.

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 400 | Not a change order | `"This quote is not a change order"` |
| 400 | `reason` missing or too short | `["Rejection reason must be at least 10 characters"]` |
| 400 | `reason` not a string | `["reason must be a string"]` |
| 404 | Change order not found | `"Change order {changeOrderId} not found"` |
| 404 | Parent quote not found | `"Parent quote not found"` |

#### cURL Example

```bash
curl -X POST https://api.lead360.app/api/v1/change-orders/234e5678-e89b-12d3-a456-426614174001/reject \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Customer declined additional cost - staying with original scope"}'
```

---

### Endpoint 6: Link Change Order to Project (Placeholder)

**Source**: `change-order.controller.ts` lines 157-167

```
POST /api/v1/change-orders/:id/link-to-project
```

| Attribute | Value |
|-----------|-------|
| HTTP Method | `POST` |
| Route | `change-orders/:id/link-to-project` |
| HTTP Status | `200 OK` |
| RBAC | `Owner, Admin, Manager` |
| Path Param | `id` - Change order UUID |
| Request Body | **None expected** (no DTO in controller) |
| Response Type | Untyped object |

#### Response: 200 OK (Hardcoded placeholder)

```json
{
  "message": "Project integration not yet available",
  "planned_for": "Phase 2"
}
```

| Field | Type | Value | Description |
|-------|------|-------|-------------|
| `message` | `string` | `"Project integration not yet available"` | Static message |
| `planned_for` | `string` | `"Phase 2"` | Planned implementation phase |

**Source**: `change-order.service.ts` lines 621-626

This endpoint always returns the same static response regardless of input. It does not validate the change order exists.

---

### Endpoint 7: Get Change Order History Timeline

**Source**: `change-order.controller.ts` lines 169-212

```
GET /api/v1/quotes/:parentQuoteId/change-orders/history
```

| Attribute | Value |
|-----------|-------|
| HTTP Method | `GET` |
| Route | `quotes/:parentQuoteId/change-orders/history` |
| HTTP Status | `200 OK` |
| RBAC | `Owner, Admin, Manager, Sales, Field` |
| Path Param | `parentQuoteId` - UUID |
| Query Params | **None** |
| Response Type | Untyped object (inline schema in Swagger) |

#### Path Parameters

| Parameter | Type | Validation | Description |
|-----------|------|------------|-------------|
| `parentQuoteId` | `string` | `ParseUUIDPipe` | Parent quote UUID |

#### Response: 200 OK (Untyped - 4 top-level fields)

| # | Field | Type | Always Present | Description | Example |
|---|-------|------|----------------|-------------|---------|
| 1 | `timeline` | `array` | YES | Array of event objects (sorted ascending by timestamp) | `[...]` |
| 2 | `parent_quote_id` | `string` | YES | Parent quote UUID | `"987e6543-..."` |
| 3 | `parent_quote_number` | `string` | YES | Parent quote number | `"Q-2026-0123"` |
| 4 | `total_events` | `number` | YES | Count of events in timeline | `3` |

#### Timeline Event Object Fields

| # | Field | Type | Always Present | Description | Example |
|---|-------|------|----------------|-------------|---------|
| 1 | `id` | `string` | YES | Change order UUID | `"123e4567-..."` |
| 2 | `event_type` | `string` | YES | Event classification (see enum) | `"change_order_approved"` |
| 3 | `change_order_number` | `string` | YES | CO number (from `quote_number`) | `"CO-2026-0001"` |
| 4 | `description` | `string` | YES | CO title (from `title`) | `"Additional foundation work"` |
| 5 | `amount` | `number` | YES | CO total (from `total`) | `3456.00` |
| 6 | `timestamp` | `string` | YES | CO created_at (from `created_at`) | `"2026-01-30T10:30:00.000Z"` |
| 7 | `status` | `string` | YES | Current CO status | `"approved"` |

**Event type determination logic** (`change-order.service.ts` lines 640-643):
```typescript
event_type: co.status === 'approved' ? 'change_order_approved' :
            co.status === 'denied' ? 'change_order_rejected' :
            'change_order_created'
```

| Event Type Value | Condition |
|------------------|-----------|
| `"change_order_approved"` | `status === 'approved'` |
| `"change_order_rejected"` | `status === 'denied'` |
| `"change_order_created"` | Any other status |

**Sorting**: Timeline is sorted by `timestamp` **ascending** (oldest first) - service line 651.

#### Full Response Example

```json
{
  "timeline": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "event_type": "change_order_approved",
      "change_order_number": "CO-2026-0001",
      "description": "Additional foundation work",
      "amount": 3456.00,
      "timestamp": "2026-01-30T10:30:00.000Z",
      "status": "approved"
    },
    {
      "id": "234e5678-e89b-12d3-a456-426614174001",
      "event_type": "change_order_created",
      "change_order_number": "CO-2026-0002",
      "description": "Upgraded deck materials",
      "amount": 2100.00,
      "timestamp": "2026-01-31T14:00:00.000Z",
      "status": "draft"
    },
    {
      "id": "345e6789-e89b-12d3-a456-426614174002",
      "event_type": "change_order_rejected",
      "change_order_number": "CO-2026-0003",
      "description": "Premium landscaping",
      "amount": 5000.00,
      "timestamp": "2026-01-31T16:00:00.000Z",
      "status": "denied"
    }
  ],
  "parent_quote_id": "987e6543-e89b-12d3-a456-426614174111",
  "parent_quote_number": "Q-2026-0123",
  "total_events": 3
}
```

#### Error Responses

| Status | Condition | Message |
|--------|-----------|---------|
| 404 | Parent quote not found | `"Parent quote {parentQuoteId} not found"` |

#### cURL Example

```bash
curl -X GET https://api.lead360.app/api/v1/quotes/987e6543-e89b-12d3-a456-426614174111/change-orders/history \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## Service Business Logic - Exact Implementation

### Change Order Number Generation

**Source**: `change-order.service.ts` lines 64-78

```typescript
private async generateChangeOrderNumber(tenantId: string, transaction: any): Promise<string> {
  const year = new Date().getFullYear();
  const existingCOs = await transaction.quote.count({
    where: {
      tenant_id: tenantId,
      quote_number: { startsWith: `CO-${year}-` },
    },
  });
  const sequence = existingCOs + 1;
  const paddedSequence = String(sequence).padStart(4, '0');
  return `CO-${year}-${paddedSequence}`;
}
```

**Format**: `CO-{4-digit-year}-{4-digit-padded-sequence}`
**Examples**: `CO-2026-0001`, `CO-2026-0002`, ..., `CO-2026-9999`
**Scope**: Per tenant, per year

### Create Change Order - Full Process

**Source**: `change-order.service.ts` lines 89-229

Steps executed inside a Prisma transaction:

1. **Validate parent quote exists** (lines 97-102)
   - Query: `quote.findFirst({ where: { id: parentQuoteId, tenant_id: tenantId } })`
   - Throws `NotFoundException` if not found

2. **Validate parent status** (lines 109-114)
   - Valid statuses: `['approved', 'started', 'concluded']`
   - Throws `BadRequestException` if invalid

3. **Generate CO number** (line 117)
   - Calls `generateChangeOrderNumber(tenantId, tx)`

4. **Calculate expiration** (lines 120-122)
   - Default: `dto.expiration_days || 30`
   - Expiration date: `new Date() + expirationDays`

5. **Handle jobsite address** (lines 125-142)
   - If `dto.jobsite_address` provided: creates new `quote_jobsite_address` record
   - If not provided: inherits `parentQuote.jobsite_address_id`

6. **Handle vendor** (lines 145-158)
   - If `dto.vendor_id` provided: validates vendor exists, belongs to tenant, and `is_active: true`
   - If not provided: inherits `parentQuote.vendor_id`

7. **Create quote record** (lines 161-182)
   - Sets `parent_quote_id: parentQuoteId` (the FK that makes it a change order)
   - Sets `private_notes: dto.description || null` (description stored in private_notes)
   - Sets `use_default_settings`: `false` if ANY custom percent is provided, `true` otherwise
   - Custom percents: uses provided values or falls back to parent's values via `??` operator

8. **Create initial version** (lines 185-191)
   - Version 1.0, description: `'Initial change order version'`

9. **Create audit log** (lines 194-208)
   - `entity_type: 'quote'`, `action_type: 'created'`
   - `metadata_json` contains: `parent_quote_id`, `parent_quote_number`, `change_order_number`, `title`

10. **Return ChangeOrderResponseDto** (lines 213-227)

### Approve Change Order - Full Process

**Source**: `change-order.service.ts` lines 415-513

Steps executed inside a Prisma transaction:

1. **Fetch change order with parent** (lines 423-437)
   - Uses `include: { parent_quote: { select: { id, quote_number, total } } }`

2. **Validate exists** (lines 439-441) → `NotFoundException`

3. **Validate is change order** (lines 443-445) → `BadRequestException` if `parent_quote_id` is null

4. **Validate parent exists** (lines 447-449) → `NotFoundException`

5. **Validate status** (lines 452-457)
   - Must be in: `['ready', 'sent', 'delivered', 'read', 'opened', 'downloaded']`
   - Throws `BadRequestException` if not

6. **Update status** (lines 460-462) → `status: 'approved'`

7. **Create version snapshot** (lines 466-472) → version 1.0

8. **Create audit log** (lines 475-491)

9. **Return ChangeOrderResponseDto with approved_at** (lines 496-511)

### Reject Change Order - Full Process

**Source**: `change-order.service.ts` lines 524-612

Steps executed inside a Prisma transaction:

1. **Fetch change order with parent** (lines 532-546)

2. **Validate exists** (lines 548-550)

3. **Validate is change order** (lines 552-554) → `parent_quote_id` not null

4. **Validate parent exists** (lines 556-558)

5. **NO STATUS VALIDATION** - any status can be rejected

6. **Update status** (lines 561-563) → `status: 'denied'`

7. **Create version snapshot** (lines 567-573) → description includes reason

8. **Create audit log** (lines 576-591) → includes rejection_reason in metadata

9. **Return ChangeOrderResponseDto without approved_at** (lines 596-610)

### Pending Statuses Array

Used in multiple places in the service. The exact array (lines 289, 367):

```typescript
const pendingStatuses = ['draft', 'pending_approval', 'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded'];
```

**8 statuses** are considered "pending". This explicitly excludes: `approved`, `denied`, `started`, `concluded`, `lost`, `email_failed`.

---

## Error Handling - Complete Reference

### Standard Error Response Format

All errors follow the NestJS standard format:

```typescript
{
  statusCode: number;      // HTTP status code
  message: string | string[];  // Single message or array of validation messages
  error: string;           // Error type name
}
```

### Complete Error Catalog

| # | Status | Error Type | Trigger | Exact Message | Source Line |
|---|--------|-----------|---------|---------------|-------------|
| 1 | 400 | Bad Request | Invalid UUID in path param | `"Validation failed (uuid is expected)"` | ParseUUIDPipe |
| 2 | 400 | Bad Request | Missing `title` | `["title should not be empty", "title must be a string"]` | class-validator |
| 3 | 400 | Bad Request | `title` not string | `["title must be a string"]` | class-validator |
| 4 | 400 | Bad Request | `description` not string | `["description must be a string"]` | class-validator |
| 5 | 400 | Bad Request | `vendor_id` not UUID | `["vendor_id must be a UUID"]` | class-validator |
| 6 | 400 | Bad Request | `expiration_days` < 1 | `["expiration_days must not be less than 1"]` | @Min(1) |
| 7 | 400 | Bad Request | `expiration_days` > 365 | `["expiration_days must not be greater than 365"]` | @Max(365) |
| 8 | 400 | Bad Request | `custom_profit_percent` < 0 | `["custom_profit_percent must not be less than 0"]` | @Min(0) |
| 9 | 400 | Bad Request | `custom_profit_percent` > 100 | `["custom_profit_percent must not be greater than 100"]` | @Max(100) |
| 10 | 400 | Bad Request | `custom_overhead_percent` < 0 | `["custom_overhead_percent must not be less than 0"]` | @Min(0) |
| 11 | 400 | Bad Request | `custom_overhead_percent` > 100 | `["custom_overhead_percent must not be greater than 100"]` | @Max(100) |
| 12 | 400 | Bad Request | `custom_contingency_percent` < 0 | `["custom_contingency_percent must not be less than 0"]` | @Min(0) |
| 13 | 400 | Bad Request | `custom_contingency_percent` > 100 | `["custom_contingency_percent must not be greater than 100"]` | @Max(100) |
| 14 | 400 | Bad Request | `address_line1` empty | `["address_line1 should not be empty"]` | @Length(1, 255) |
| 15 | 400 | Bad Request | `zip_code` invalid format | `["Invalid ZIP code format"]` | @Matches regex |
| 16 | 400 | Bad Request | `state` wrong length | `["state must be longer than or equal to 2 characters"]` | @Length(2, 2) |
| 17 | 400 | Bad Request | Parent quote invalid status | `"Parent quote must be approved, started, or concluded to create change order. Current status: {status}"` | service:112 |
| 18 | 400 | Bad Request | Not a change order (approve/reject) | `"This quote is not a change order"` | service:444,553 |
| 19 | 400 | Bad Request | Invalid status for approval | `"Change order must be in ready or sent status to approve. Current status: {status}"` | service:454 |
| 20 | 400 | Bad Request | Rejection reason missing | `["reason should not be empty", "reason must be a string"]` | class-validator |
| 21 | 400 | Bad Request | Rejection reason < 10 chars | `["Rejection reason must be at least 10 characters"]` | @MinLength(10) |
| 22 | 401 | Unauthorized | Missing/invalid JWT | `"Unauthorized"` | JwtAuthGuard |
| 23 | 403 | Forbidden | Role not allowed | `"Forbidden resource"` | RolesGuard |
| 24 | 404 | Not Found | Parent quote not found | `"Parent quote {id} not found"` | service:105,257,342 |
| 25 | 404 | Not Found | Change order not found | `"Change order {id} not found"` | service:440,549 |
| 26 | 404 | Not Found | Vendor not found/inactive | `"Vendor not found or inactive"` | service:156 |
| 27 | 404 | Not Found | Parent quote not found (approve) | `"Parent quote not found"` | service:448,558 |

---

## Frontend TypeScript Types (Correct)

These types match the **actual backend DTOs and service return values exactly**. Use these instead of the outdated types in `app/src/lib/api/change-orders.ts`.

```typescript
/**
 * Change Order Types - CORRECT as of January 31, 2026
 *
 * Source: api/src/modules/quotes/dto/change-order/*.ts
 * Source: api/src/modules/quotes/services/change-order.service.ts
 * Source: api/src/modules/quotes/controllers/change-order.controller.ts
 */

// ============================================================================
// Enums & Constants
// ============================================================================

/**
 * All possible quote/change order statuses
 * Source: api/prisma/schema.prisma enum quote_status (lines 1855-1870)
 * 14 values total
 */
export type QuoteStatus =
  | 'draft'
  | 'pending_approval'
  | 'ready'
  | 'sent'
  | 'delivered'
  | 'read'
  | 'opened'
  | 'downloaded'
  | 'approved'
  | 'started'
  | 'concluded'
  | 'denied'
  | 'lost'
  | 'email_failed';

/**
 * Statuses considered "pending" by the service
 * Source: change-order.service.ts lines 289, 367
 */
export const PENDING_STATUSES: QuoteStatus[] = [
  'draft', 'pending_approval', 'ready', 'sent',
  'delivered', 'read', 'opened', 'downloaded',
];

/**
 * Statuses that allow approval
 * Source: change-order.service.ts line 452
 */
export const APPROVABLE_STATUSES: QuoteStatus[] = [
  'ready', 'sent', 'delivered', 'read', 'opened', 'downloaded',
];

/**
 * Statuses that allow creating a change order from a parent quote
 * Source: change-order.service.ts line 109
 */
export const PARENT_VALID_STATUSES: QuoteStatus[] = [
  'approved', 'started', 'concluded',
];

/**
 * History event types
 * Source: change-order.service.ts lines 640-643
 */
export type ChangeOrderEventType =
  | 'change_order_created'
  | 'change_order_approved'
  | 'change_order_rejected';

// ============================================================================
// Request DTOs (What the frontend SENDS)
// ============================================================================

/**
 * Jobsite address (nested in CreateChangeOrderDto)
 * Source: api/src/modules/quotes/dto/quote/jobsite-address.dto.ts
 * 7 fields (2 required, 5 optional)
 */
export interface JobsiteAddressDto {
  /** REQUIRED. Street address line 1. Length: 1-255 chars. */
  address_line1: string;
  /** Optional. Street address line 2. Length: 1-255 chars. */
  address_line2?: string;
  /** Optional. City name. Length: 1-100 chars. */
  city?: string;
  /** Optional. State code. Exactly 2 chars (e.g. "MA"). */
  state?: string;
  /** REQUIRED. ZIP code. Format: /^\d{5}(-\d{4})?$/ (e.g. "02101" or "02101-1234"). */
  zip_code: string;
  /** Optional. Latitude coordinate. */
  latitude?: number;
  /** Optional. Longitude coordinate. */
  longitude?: number;
}

/**
 * Create change order request body
 * Source: api/src/modules/quotes/dto/change-order/create-change-order.dto.ts
 * 8 fields (1 required, 7 optional)
 */
export interface CreateChangeOrderDto {
  /** REQUIRED. Change order title. */
  title: string;
  /** Optional. Detailed description. Stored in quote.private_notes column. */
  description?: string;
  /** Optional. Override jobsite address. If omitted, inherits from parent quote. */
  jobsite_address?: JobsiteAddressDto;
  /** Optional. Override vendor UUID. Must be valid, active vendor. If omitted, inherits from parent. */
  vendor_id?: string;
  /** Optional. Expiration days. Min: 1, Max: 365. Default: 30 (set in service). */
  expiration_days?: number;
  /** Optional. Custom profit %. Min: 0, Max: 100. If omitted, inherits from parent. */
  custom_profit_percent?: number;
  /** Optional. Custom overhead %. Min: 0, Max: 100. If omitted, inherits from parent. */
  custom_overhead_percent?: number;
  /** Optional. Custom contingency %. Min: 0, Max: 100. If omitted, inherits from parent. */
  custom_contingency_percent?: number;
}

/**
 * Approve change order request body
 * Source: api/src/modules/quotes/dto/change-order/approve-change-order.dto.ts
 * 1 field (optional). Empty body {} is valid.
 */
export interface ApproveChangeOrderDto {
  /** Optional. Approval notes. Stored in version snapshot and audit log. */
  notes?: string;
}

/**
 * Reject change order request body
 * Source: api/src/modules/quotes/dto/change-order/reject-change-order.dto.ts
 * 1 field (REQUIRED).
 */
export interface RejectChangeOrderDto {
  /** REQUIRED. Rejection reason. Min length: 10 chars. Stored in version and audit log (NOT on quote record). */
  reason: string;
}

// ============================================================================
// Response DTOs (What the frontend RECEIVES)
// ============================================================================

/**
 * Full change order response
 * Source: api/src/modules/quotes/dto/change-order/change-order-response.dto.ts
 * Used by: POST create, POST approve, POST reject
 * 14 fields (13 always present, 1 conditional)
 */
export interface ChangeOrderResponseDto {
  /** Change order UUID (36 chars). */
  id: string;
  /** Change order number. Format: "CO-YYYY-####" (e.g. "CO-2026-0001"). */
  quote_number: string;
  /** Change order title. */
  title: string;
  /** Current status. Always "draft" on create, "approved" after approve, "denied" after reject. */
  status: QuoteStatus;
  /** Parent quote UUID. */
  parent_quote_id: string;
  /** Parent quote number (e.g. "Q-2026-0123"). */
  parent_quote_number: string;
  /** Parent quote's total amount (Decimal→float). */
  parent_original_total: number;
  /** Change order subtotal (Decimal→float). 0.00 on create (no items). */
  subtotal: number;
  /** Tax amount (Decimal→float). 0.00 on create. */
  tax_amount: number;
  /** Discount amount (Decimal→float). 0.00 on create. */
  discount_amount: number;
  /** Change order total (Decimal→float). 0.00 on create. */
  total: number;
  /** Creation timestamp. ISO 8601 format. */
  created_at: string;
  /** Last update timestamp. ISO 8601 format. */
  updated_at: string;
  /** Approval timestamp. ONLY present when status === "approved". Equals updated_at value. */
  approved_at?: string;
}

/**
 * Lightweight change order summary
 * Source: api/src/modules/quotes/dto/change-order/change-order-summary.dto.ts
 * Used in: ListChangeOrdersResponseDto.change_orders[], ParentQuoteTotalsDto.change_orders[]
 * 7 fields (6 always present, 1 conditional)
 */
export interface ChangeOrderSummaryDto {
  /** Change order UUID. */
  id: string;
  /** Change order number ("CO-YYYY-####"). */
  quote_number: string;
  /** Change order title. Falls back to "" if null in DB. */
  title: string;
  /** Current status. */
  status: QuoteStatus;
  /** Change order total (Decimal→float). */
  total: number;
  /** Creation timestamp. ISO 8601. */
  created_at: string;
  /** Approval timestamp. ONLY present when status === "approved". Uses updated_at value from DB. */
  approved_at?: string;
}

/**
 * Parent quote totals with aggregated change order data
 * Source: api/src/modules/quotes/dto/change-order/parent-quote-totals.dto.ts
 * Used by: GET /quotes/:quoteId/with-change-orders
 * 9 fields (all always present)
 */
export interface ParentQuoteTotalsDto {
  /** Parent quote UUID. */
  parent_quote_id: string;
  /** Parent quote number. */
  parent_quote_number: string;
  /** Original quote total before any change orders. */
  original_total: number;
  /** Sum of totals from approved COs only. */
  approved_change_orders_total: number;
  /** Sum of totals from pending COs (8 pending statuses). */
  pending_change_orders_total: number;
  /** original_total + approved_change_orders_total. Does NOT include pending. */
  revised_total: number;
  /** Count of COs with status === "approved". */
  approved_co_count: number;
  /** Count of COs with status in pending statuses array. */
  pending_co_count: number;
  /** ALL change orders (including rejected). Sorted by created_at DESC. */
  change_orders: ChangeOrderSummaryDto[];
}

/**
 * List change orders response
 * Source: api/src/modules/quotes/dto/change-order/list-change-orders-response.dto.ts
 * Used by: GET /quotes/:parentQuoteId/change-orders
 * 4 top-level fields
 */
export interface ListChangeOrdersResponseDto {
  /** Parent quote UUID. */
  parent_quote_id: string;
  /** Parent quote number. */
  parent_quote_number: string;
  /** Array of change order summaries. Sorted by created_at DESC. Empty [] if none exist. */
  change_orders: ChangeOrderSummaryDto[];
  /** Summary statistics. */
  summary: {
    /** Total number of all change orders. */
    total_count: number;
    /** Count with status === "approved". */
    approved_count: number;
    /** Count with status in pending statuses (8 statuses). */
    pending_count: number;
    /** Count with status === "denied". */
    rejected_count: number;
  };
}

/**
 * History timeline event
 * Source: change-order.service.ts lines 638-648 (inline object, not a DTO class)
 * 7 fields (all always present)
 */
export interface ChangeOrderHistoryEvent {
  /** Change order UUID. */
  id: string;
  /** Event classification: "change_order_created" | "change_order_approved" | "change_order_rejected". */
  event_type: ChangeOrderEventType;
  /** Change order number (from quote_number). */
  change_order_number: string;
  /** Change order title (from title). */
  description: string;
  /** Change order total (from total). */
  amount: number;
  /** Change order created_at timestamp. ISO 8601. */
  timestamp: string;
  /** Current change order status. */
  status: QuoteStatus;
}

/**
 * History timeline response
 * Source: change-order.service.ts lines 653-658 (inline object, not a DTO class)
 * 4 fields (all always present)
 */
export interface ChangeOrderHistoryResponseDto {
  /** Array of events. Sorted by timestamp ASCENDING (oldest first). Empty [] if no COs. */
  timeline: ChangeOrderHistoryEvent[];
  /** Parent quote UUID. */
  parent_quote_id: string;
  /** Parent quote number. */
  parent_quote_number: string;
  /** Total number of events. */
  total_events: number;
}

/**
 * Link to project response (placeholder)
 * Source: change-order.service.ts lines 622-625
 * 2 fields (static values)
 */
export interface LinkToProjectResponse {
  /** Always "Project integration not yet available". */
  message: string;
  /** Always "Phase 2". */
  planned_for: string;
}

// ============================================================================
// Error Response
// ============================================================================

/**
 * Standard NestJS error response
 * Source: NestJS framework
 */
export interface ApiErrorResponse {
  /** HTTP status code (400, 401, 403, 404, 500). */
  statusCode: number;
  /** Error message string OR array of validation error strings. */
  message: string | string[];
  /** Error type name ("Bad Request", "Not Found", "Unauthorized", "Forbidden"). */
  error: string;
}
```

---

## Frontend API Client (Correct)

Correct API client matching actual backend endpoints and response types:

```typescript
/**
 * Change Order API Client - CORRECT as of January 31, 2026
 *
 * Source of truth: api/src/modules/quotes/controllers/change-order.controller.ts
 * All endpoints, methods, paths, and return types verified against source code.
 */

import { apiClient } from './axios';
import type {
  CreateChangeOrderDto,
  ApproveChangeOrderDto,
  RejectChangeOrderDto,
  ChangeOrderResponseDto,
  ListChangeOrdersResponseDto,
  ParentQuoteTotalsDto,
  ChangeOrderHistoryResponseDto,
  LinkToProjectResponse,
} from '../types/change-orders';

// ============================================================================
// Endpoint 1: Create Change Order
// POST /quotes/:parentQuoteId/change-orders
// Controller: ChangeOrderController.createChangeOrder()
// RBAC: Owner, Admin, Manager, Sales
// Returns: 201 Created
// ============================================================================
export const createChangeOrder = async (
  parentQuoteId: string,
  dto: CreateChangeOrderDto
): Promise<ChangeOrderResponseDto> => {
  const { data } = await apiClient.post<ChangeOrderResponseDto>(
    `/quotes/${parentQuoteId}/change-orders`,
    dto
  );
  return data;
};

// ============================================================================
// Endpoint 2: List Change Orders
// GET /quotes/:parentQuoteId/change-orders
// Controller: ChangeOrderController.listChangeOrders()
// RBAC: Owner, Admin, Manager, Sales, Field
// Returns: 200 OK
// ============================================================================
export const listChangeOrders = async (
  parentQuoteId: string
): Promise<ListChangeOrdersResponseDto> => {
  const { data } = await apiClient.get<ListChangeOrdersResponseDto>(
    `/quotes/${parentQuoteId}/change-orders`
  );
  return data;
};

// ============================================================================
// Endpoint 3: Get Parent Quote with Aggregated Totals
// GET /quotes/:quoteId/with-change-orders
// Controller: ChangeOrderController.getParentQuoteTotals()
// RBAC: Owner, Admin, Manager, Sales, Field
// Returns: 200 OK
// ============================================================================
export const getParentQuoteTotals = async (
  quoteId: string
): Promise<ParentQuoteTotalsDto> => {
  const { data } = await apiClient.get<ParentQuoteTotalsDto>(
    `/quotes/${quoteId}/with-change-orders`
  );
  return data;
};

// ============================================================================
// Endpoint 4: Approve Change Order
// POST /change-orders/:id/approve
// Controller: ChangeOrderController.approveChangeOrder()
// RBAC: Owner, Admin, Manager (NOT Sales, NOT Field)
// Returns: 200 OK
// ============================================================================
export const approveChangeOrder = async (
  changeOrderId: string,
  dto?: ApproveChangeOrderDto
): Promise<ChangeOrderResponseDto> => {
  const { data } = await apiClient.post<ChangeOrderResponseDto>(
    `/change-orders/${changeOrderId}/approve`,
    dto || {}
  );
  return data;
};

// ============================================================================
// Endpoint 5: Reject Change Order
// POST /change-orders/:id/reject
// Controller: ChangeOrderController.rejectChangeOrder()
// RBAC: Owner, Admin, Manager (NOT Sales, NOT Field)
// Returns: 200 OK
// ============================================================================
export const rejectChangeOrder = async (
  changeOrderId: string,
  dto: RejectChangeOrderDto
): Promise<ChangeOrderResponseDto> => {
  const { data } = await apiClient.post<ChangeOrderResponseDto>(
    `/change-orders/${changeOrderId}/reject`,
    dto
  );
  return data;
};

// ============================================================================
// Endpoint 6: Link to Project (Placeholder)
// POST /change-orders/:id/link-to-project
// Controller: ChangeOrderController.linkToProject()
// RBAC: Owner, Admin, Manager
// Returns: 200 OK (static response)
// ============================================================================
export const linkToProject = async (
  changeOrderId: string
): Promise<LinkToProjectResponse> => {
  const { data } = await apiClient.post<LinkToProjectResponse>(
    `/change-orders/${changeOrderId}/link-to-project`
  );
  return data;
};

// ============================================================================
// Endpoint 7: Get Change Order History
// GET /quotes/:parentQuoteId/change-orders/history
// Controller: ChangeOrderController.getHistory()
// RBAC: Owner, Admin, Manager, Sales, Field
// Returns: 200 OK
// ============================================================================
export const getChangeOrderHistory = async (
  parentQuoteId: string
): Promise<ChangeOrderHistoryResponseDto> => {
  const { data } = await apiClient.get<ChangeOrderHistoryResponseDto>(
    `/quotes/${parentQuoteId}/change-orders/history`
  );
  return data;
};
```

---

## Frontend Type Discrepancy Report

**CRITICAL**: The current frontend API client at `app/src/lib/api/change-orders.ts` has significant type mismatches with the actual backend. This section documents every discrepancy.

### 1. ChangeOrderStatus Type

| Property | Frontend (WRONG) | Backend (CORRECT) |
|----------|------------------|-------------------|
| Type name | `ChangeOrderStatus` | `QuoteStatus` (same enum as regular quotes) |
| Values | `'pending' \| 'approved' \| 'rejected'` (3 values) | 14 values from `quote_status` Prisma enum |
| `'pending'` | Used as a status | Does NOT exist. Pending COs have specific statuses: `draft`, `pending_approval`, `ready`, etc. |
| `'rejected'` | Used as a status | Backend uses `'denied'` not `'rejected'` |

### 2. ChangeOrder Interface

| Frontend Property | Exists in Backend? | Correct Backend Property |
|-------------------|-------------------|------------------------|
| `change_order_number` | **NO** | `quote_number` (CO-YYYY-#### format) |
| `child_quote_id` | **NO** | The change order IS the quote (use `id`) |
| `amount_change` | **NO** | Not a field. Use `total` for CO amount |
| `new_total` | **NO** | Use `ParentQuoteTotalsDto.revised_total` |
| `approved_by` | **NO** | Not in response. Stored in audit log only |
| `rejected_by` | **NO** | Not in response. Stored in audit log only |
| `rejection_reason` | **NO** | Not in response. Stored in audit log `metadata_json.rejection_reason` |
| `approved_at` | Partially correct | Correct but only present when `status === 'approved'` |
| `rejected_at` | **NO** | Not a field. Use `updated_at` when `status === 'denied'` |

### 3. ChangeOrdersResponse Interface

| Frontend | Backend |
|----------|---------|
| `{ change_orders: ChangeOrder[], total_count: number }` | `ListChangeOrdersResponseDto` with `parent_quote_id`, `parent_quote_number`, `change_orders: ChangeOrderSummaryDto[]`, `summary: { total_count, approved_count, pending_count, rejected_count }` |

### 4. TotalImpact Interface

| Frontend Property | Backend Property |
|-------------------|-----------------|
| `original_total` | `original_total` (correct) |
| `total_approved_changes` | `approved_change_orders_total` |
| `total_pending_changes` | `pending_change_orders_total` |
| `net_change` | Does NOT exist. Calculate: `approved_change_orders_total` |
| `new_total` | `revised_total` |
| `change_orders_count.approved` | `approved_co_count` |
| `change_orders_count.pending` | `pending_co_count` |
| `change_orders_count.rejected` | Does NOT exist in `ParentQuoteTotalsDto` |
| `change_orders_count.total` | Does NOT exist. Calculate: `change_orders.length` |

### 5. API Function Mismatches

| Frontend Function | Frontend Endpoint | Backend Endpoint | Issue |
|-------------------|-------------------|------------------|-------|
| `getTotalImpact()` | `GET /quotes/:id/change-orders/total-impact` | Does NOT exist | Should use `GET /quotes/:id/with-change-orders` |
| `approveChangeOrder()` | No request body | Accepts `ApproveChangeOrderDto` body with optional `notes` | Missing body parameter |
| - | No reject function | `POST /change-orders/:id/reject` | Missing entirely |
| `getChangeOrders()` | Returns `ChangeOrdersResponse` | Returns `ListChangeOrdersResponseDto` | Different response shape |

### 6. CreateChangeOrderDto Mismatch

| Frontend | Backend |
|----------|---------|
| `{ title: string, description?: string }` (2 fields) | 8 fields: `title`, `description`, `jobsite_address`, `vendor_id`, `expiration_days`, `custom_profit_percent`, `custom_overhead_percent`, `custom_contingency_percent` |

### 7. Response Type Mismatches

| Frontend | Backend |
|----------|---------|
| `CreateChangeOrderResponse` (6 fields) | `ChangeOrderResponseDto` (14 fields) |
| `ApproveChangeOrderResponse` (3 fields: `change_order`, `parent_quote_updated`, `message`) | `ChangeOrderResponseDto` (14 fields, flat object) |

### 8. Helper Functions Based on Wrong Types

These frontend helpers reference non-existent properties and will fail:

| Helper | Issue |
|--------|-------|
| `canEditChangeOrder(co)` | Checks `co.status === 'pending'` - `'pending'` is not a valid status |
| `canApproveChangeOrder(co)` | Same issue |
| `getStatusLabel()` | Only maps 3 statuses, backend has 14 |
| `getStatusColorClass()` | Only maps 3 statuses |
| `formatAmountChange()` | Uses `amount_change` property that doesn't exist |
| `getChangeDirectionText()` | Uses `amount_change` property that doesn't exist |
| `groupByStatus()` | Groups by `pending/approved/rejected` - should use actual status values |

---

## Workflow Examples

### Complete Workflow: Create → Add Items → Send → Approve → View Totals

```typescript
// Step 1: Create change order
const co = await createChangeOrder('parent-quote-uuid', {
  title: 'Additional foundation work',
  description: 'Deeper excavation required due to soil conditions',
  expiration_days: 30,
});
// co.status === 'draft'
// co.total === 0.00
// co.quote_number === 'CO-2026-0001'

// Step 2: Add items (use Quote Items API - CO is a quote)
// POST /api/v1/quotes/{co.id}/items
// The change order ID is used as the quote ID for item endpoints

// Step 3: Send to customer (use Quote Email API)
// POST /api/v1/quotes/{co.id}/send-email
// Status changes: draft → sent

// Step 4: Approve
const approved = await approveChangeOrder(co.id, {
  notes: 'Approved by project owner',
});
// approved.status === 'approved'
// approved.approved_at === '2026-01-31T08:00:00.000Z'

// Step 5: View parent totals
const totals = await getParentQuoteTotals('parent-quote-uuid');
// totals.original_total === 45000.00
// totals.approved_change_orders_total === 3456.00
// totals.revised_total === 48456.00

// Step 6: View history
const history = await getChangeOrderHistory('parent-quote-uuid');
// history.timeline[0].event_type === 'change_order_approved'
// history.total_events === 1
```

### Rejection Workflow

```typescript
const rejected = await rejectChangeOrder('co-uuid', {
  reason: 'Customer declined the additional cost - staying with original scope',
  // reason MUST be >= 10 characters
});
// rejected.status === 'denied'
// rejected.approved_at === undefined (not present)
// Rejection reason is NOT in the response - it's in the audit log
```

### Error Handling Pattern

```typescript
try {
  const co = await createChangeOrder('parent-uuid', { title: 'Test' });
} catch (error) {
  // error.message could be:
  // - "Parent quote {id} not found" (404)
  // - "Parent quote must be approved, started, or concluded..." (400)
  // - "title should not be empty, title must be a string" (400 validation)
}

try {
  await rejectChangeOrder('co-uuid', { reason: 'short' });
} catch (error) {
  // error.message: "Rejection reason must be at least 10 characters"
}

try {
  await approveChangeOrder('co-uuid');
} catch (error) {
  // error.message could be:
  // - "Change order must be in ready or sent status to approve. Current status: draft"
  // - "This quote is not a change order"
}
```

---

## Integration with Existing Quote Features

Change orders ARE quotes (same DB table), so they use all existing quote infrastructure:

| Feature | Endpoint Pattern | Works with COs? | Notes |
|---------|-----------------|-----------------|-------|
| Quote Items | `POST/GET/PATCH/DELETE /quotes/{co.id}/items` | YES | Use CO's `id` as `quoteId` |
| Quote Groups | `POST/GET/PATCH/DELETE /quotes/{co.id}/groups` | YES | Organize CO items into groups |
| Bundles | `POST /quotes/{co.id}/bundles/{bundleId}/apply` | YES | Apply bundles to COs |
| Pricing | Auto-calculated | YES | Same pricing engine |
| PDF | `POST /quotes/{co.id}/pdf` | YES | Generates CO PDF |
| Public Access | `POST /quotes/{co.id}/public-access` | YES | Generate public URL |
| Email | `POST /quotes/{co.id}/send-email` | YES | Send CO to customer |
| Versioning | Auto-managed | YES | Versions created on approve/reject |
| Attachments | `POST/GET/DELETE /quotes/{co.id}/attachments` | YES | Attach files to CO |
| View Analytics | `GET /quotes/{co.id}/analytics` | YES | Track CO views |
| Discount Rules | `POST/GET /quotes/{co.id}/discount-rules` | YES | Apply discounts to CO |
| Draw Schedule | `POST/GET /quotes/{co.id}/draw-schedule` | YES | Payment milestones |

### How to Identify a Change Order

```typescript
// A quote is a change order if:
quote.parent_quote_id !== null

// Change order numbers start with "CO-":
quote.quote_number.startsWith('CO-')  // e.g., "CO-2026-0001"
```

---

## Swagger Documentation

Interactive API docs available at:
```
https://api.lead360.app/api/docs
```

Filter by tag: **"Quotes - Change Orders"**

All 7 endpoints are documented with:
- `@ApiTags('Quotes - Change Orders')` (controller line 44)
- `@ApiBearerAuth()` (controller line 45)
- Individual `@ApiOperation`, `@ApiParam`, `@ApiResponse` decorators per endpoint

---

**End of Change Order REST API Documentation - Version 3.0**
**Total DTOs documented: 11** (8 exported, 3 internal)
**Total endpoints documented: 7**
**Total response fields documented: 66+**
**Total error scenarios documented: 27**
