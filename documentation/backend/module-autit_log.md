# Backend Module: Audit Log

**Module Name**: Audit Log  
**Sprint**: Sprint 0 - Platform Foundation  
**Feature Contract**: `/documentation/contracts/audit-log-contract.md`  
**Agent**: Backend Specialist  
**Status**: Ready for Development

---

## Overview

This module implements comprehensive audit logging for all critical system actions. You will build an immutable, searchable log system with async writes, monthly partitioning, and tenant isolation.

**Read First**:
- `/documentation/contracts/audit-log-contract.md` (complete logging requirements)
- `/documentation/shared/security-rules.md` (security requirements)
- `/documentation/shared/api-conventions.md` (REST patterns)

---

## Database Table Structure

### **Tables to Create**

1. **audit_log** - Main audit log table (with monthly partitioning)
2. **audit_log_retention_policy** - Retention rules (optional for advanced setup)

---

## Table Design

### **audit_log Table**

**Purpose**: Store all system actions with full context

**Key Fields**:
- id (UUID, primary key)
- created_at (Timestamp with timezone, precise to millisecond)
- actor_user_id (UUID, foreign key to user, nullable)
- actor_type (ENUM: user, system, platform_admin, cron_job)
- tenant_id (UUID, foreign key to tenant, nullable for platform actions)
- action_type (ENUM: created, updated, deleted, accessed, failed)
- entity_type (VARCHAR(100) - user, tenant, role, file, etc.)
- entity_id (UUID, nullable)
- description (TEXT - human-readable description)
- before_json (JSONB, nullable - snapshot before change)
- after_json (JSONB, nullable - snapshot after change)
- metadata_json (JSONB, nullable - additional context)
- ip_address (VARCHAR(45) - supports IPv6)
- user_agent (TEXT)
- status (ENUM: success, failure)
- error_message (TEXT, nullable)

**Indexes**:
- Primary key on id
- Composite index: (tenant_id, created_at DESC) - most common query
- Index: (actor_user_id, created_at DESC) - user activity
- Index: (entity_type, entity_id) - entity history
- Index: (created_at DESC) - time-based queries
- Index: (status) - filter by success/failure
- GIN index: (metadata_json) - JSON searches (optional)

**Partitioning Strategy**:
- Partition by RANGE on created_at (monthly partitions)
- Partition names: audit_log_2025_01, audit_log_2025_02, etc.
- Auto-create new partition at start of each month (cron job or trigger)
- Each partition is a separate table (improves query performance)

**Business Rules**:
- Immutable: No UPDATE or DELETE operations allowed
- No foreign key constraints (for performance and to allow logging deleted entities)
- created_at defaults to NOW() with millisecond precision
- Soft delete not applicable (logs are never deleted)
- Retention handled by archiving partitions, not deleting rows

**Partition Example Structure**:
```
audit_log (parent table - empty)
├── audit_log_2025_01 (Jan 2025 logs)
├── audit_log_2025_02 (Feb 2025 logs)
├── audit_log_2025_03 (Mar 2025 logs)
└── audit_log_default (catch-all for future dates)
```

**Query Optimization**:
- When querying specific date range, database only scans relevant partitions
- Example: Query for January 2025 logs → Only audit_log_2025_01 scanned
- Dramatically improves performance as table grows

---

### **audit_log_retention_policy Table** (Optional)

**Purpose**: Define retention rules per entity type

**Fields**:
- id (UUID)
- entity_type (VARCHAR(100), unique)
- retention_days (INTEGER - how long to keep)
- archive_to_cold_storage (BOOLEAN)
- created_at, updated_at

**Example Data**:
- entity_type: "user", retention_days: 2557 (7 years), archive: true
- entity_type: "tenant", retention_days: 2557, archive: true
- entity_type: "auth_attempt", retention_days: 90, archive: false

**Usage**: Background job checks retention policy and archives/deletes old logs

---

## NestJS Module Structure

**Directory**:
```
src/modules/audit/
├── audit.module.ts
├── audit.controller.ts
├── audit.service.ts
├── audit-logger.service.ts (writes logs)
├── audit-reader.service.ts (reads logs)
├── decorators/
│   └── audit-log.decorator.ts
├── dto/
│   ├── audit-log-query.dto.ts
│   ├── audit-log-response.dto.ts
│   └── create-audit-log.dto.ts
├── jobs/
│   ├── partition-creator.job.ts
│   └── retention-enforcer.job.ts
└── audit.service.spec.ts
```

---

## Core Service Methods

### **AuditLoggerService** (Writes Logs)

**Purpose**: Create audit log entries asynchronously

1. **log(data: CreateAuditLogDto)**
   - Queue audit log write to background job
   - Non-blocking operation
   - Returns immediately (doesn't wait for write)
   - Parameters: action_type, entity_type, entity_id, description, before_json, after_json, metadata_json

2. **logAuth(event, userId, tenantId, status, ipAddress, userAgent, metadata)**
   - Specialized method for auth events
   - Automatically sets entity_type="auth_session" or "auth_attempt"
   - Captures IP and user agent

3. **logTenantChange(action, entityType, entityId, tenantId, actorUserId, before, after, metadata)**
   - Specialized method for tenant changes
   - Automatically captures before/after snapshots

4. **logRBACChange(action, entityType, entityId, tenantId, actorUserId, metadata)**
   - Specialized method for role/permission changes
   - Captures role assignments, permission changes

5. **logFailedAction(entityType, actorUserId, tenantId, errorMessage, metadata)**
   - Specialized method for failed actions
   - Sets status="failure" and action_type="failed"
   - Captures error details

**Implementation Strategy**:
- All log methods queue a job (don't write directly to database)
- Job processor writes to database asynchronously
- If queue fails, fallback to direct database write (best effort)
- Never throw errors that fail main transaction

---

### **AuditReaderService** (Reads Logs)

**Purpose**: Query and retrieve audit logs

1. **findAll(filters, pagination, tenantId?)**
   - Query audit logs with filters
   - Apply tenant isolation (if tenantId provided)
   - Apply pagination (limit, offset)
   - Apply filters (date range, actor, action, entity type, status)
   - Return paginated results

2. **findOne(id, tenantId?)**
   - Fetch single log entry by ID
   - Validate tenant access (if tenantId provided)
   - Return full log details including before/after JSON

3. **findByUser(userId, filters, pagination, tenantId?)**
   - Get all logs for specific user
   - Pre-filter by actor_user_id
   - Apply additional filters and pagination

4. **findByEntity(entityType, entityId, pagination)**
   - Get all logs for specific entity
   - Example: All changes to quote #123
   - Useful for entity history

5. **export(filters, format, tenantId?)**
   - Export filtered logs to CSV or JSON
   - Apply same filters as findAll
   - Limit to 10,000 rows
   - Return file stream or buffer

6. **count(filters, tenantId?)**
   - Count logs matching filters
   - Used for pagination total

---

### **Background Jobs**

#### **AuditLogWriteJob**

**Purpose**: Write queued audit logs to database

**Trigger**: Queued by AuditLoggerService.log()

**Process**:
1. Receive log data from queue
2. Insert into audit_log table
3. If insert fails, retry 3 times with exponential backoff
4. If still fails, log error (but don't crash)

**Batch Processing** (Optional Optimization):
- Instead of writing one log at a time
- Accumulate logs for 1 second
- Write in batches of 100
- Improves performance for high-volume logging

---

#### **PartitionCreatorJob**

**Purpose**: Create new monthly partition before month starts

**Trigger**: Cron (runs 1st of each month at 00:00)

**Process**:
1. Check if next month's partition exists
2. If not, create partition: audit_log_YYYY_MM
3. Set range: created_at >= start_of_month AND created_at < start_of_next_month
4. Create indexes on new partition

**Example**:
- Job runs on Feb 1, 2025
- Creates audit_log_2025_02 partition
- Range: created_at >= '2025-02-01' AND created_at < '2025-03-01'

---

#### **RetentionEnforcerJob**

**Purpose**: Archive or delete logs older than retention period

**Trigger**: Cron (runs monthly on 1st at 02:00)

**Process**:
1. Check retention policy for each entity type
2. Find partitions older than retention period
3. If archive_to_cold_storage=true:
   - Export partition to S3 (compressed)
   - Detach partition from parent table
   - Drop partition table
4. If archive_to_cold_storage=false:
   - Drop partition table directly

**Example**:
- Retention: 7 years (2557 days)
- Today: Jan 1, 2025
- Find partitions before Jan 1, 2018
- Archive audit_log_2017_12 to S3: audit-archive-2017-12.gz
- Drop audit_log_2017_12 partition

---

## Audit Log Decorator

**Purpose**: Automatically log actions with minimal code

**Location**: `decorators/audit-log.decorator.ts`

**Usage**:
```typescript
@AuditLog({
  action: 'created',
  entityType: 'tenant',
  description: 'Created new tenant'
})
async createTenant(data) {
  // Method implementation
}
```

**Decorator Implementation Logic**:
1. Wrap method with try/catch
2. Before method execution: Capture before state (if updating)
3. Execute method
4. After method execution: Capture after state (if creating/updating)
5. Call AuditLoggerService.log() with captured data
6. Extract actor from request context (current user)
7. Extract IP and user agent from request

**Decorator Options**:
- action (created/updated/deleted/accessed)
- entityType (string)
- description (string or function)
- captureRequest (boolean - capture full request body)
- captureResponse (boolean - capture response)
- ignoreErrors (boolean - don't log if method throws error)

**Advanced Usage**:
```typescript
@AuditLog({
  action: 'updated',
  entityType: 'tenant',
  description: (args, result) => `Updated ${result.legal_name}`,
  captureRequest: true
})
async updateTenant(id, updateData) {
  // Method implementation
}
```

---

## API Controller

**Location**: `audit.controller.ts`

**Routes**:

1. **GET /audit-logs**
   - @UseGuards(JwtAuthGuard, RolesGuard)
   - @RequirePermission('audit', 'view')
   - Query params: page, limit, filters
   - Calls AuditReaderService.findAll()
   - Returns paginated results

2. **GET /audit-logs/:id**
   - @UseGuards(JwtAuthGuard, RolesGuard)
   - @RequirePermission('audit', 'view')
   - Calls AuditReaderService.findOne()
   - Returns single log entry

3. **GET /audit-logs/export**
   - @UseGuards(JwtAuthGuard, RolesGuard)
   - @RequirePermission('audit', 'export')
   - Query params: format (csv/json), filters
   - Calls AuditReaderService.export()
   - Returns file stream

4. **GET /users/:userId/audit-logs**
   - @UseGuards(JwtAuthGuard, RolesGuard)
   - @RequirePermission('users', 'view')
   - Calls AuditReaderService.findByUser()
   - Returns paginated results

5. **GET /tenants/:tenantId/audit-logs**
   - @UseGuards(JwtAuthGuard, PlatformAdminGuard)
   - Platform Admin only
   - Calls AuditReaderService.findAll() with tenantId filter
   - Returns paginated results

---

## Tenant Isolation Logic

**Critical**: Tenant users MUST NOT see logs from other tenants

**Implementation**:

1. **Extract tenantId from JWT**:
   - In controller, get current user from request
   - Extract tenantId from user object

2. **Apply tenant filter**:
   - If user is Platform Admin (is_platform_admin=true):
     - No tenant filter (can see all logs)
   - If user is tenant user (Owner/Admin):
     - Add WHERE tenant_id = user.tenant_id to query

3. **Validate log access**:
   - When fetching single log by ID
   - Check if log.tenant_id matches user.tenant_id
   - If not: Throw 403 Forbidden

---

## Integration Points

**Where to Call Audit Logging**:

### **Authentication Module**
- AuthService.register() → log('created', 'user', ...)
- AuthService.login() → log('accessed', 'auth_session', ...)
- AuthService.logout() → log('deleted', 'auth_session', ...)
- AuthService.changePassword() → log('updated', 'user', ...)
- AuthService.resetPassword() → log('updated', 'user', ...)
- Failed login → log('failed', 'auth_attempt', ...)

### **Tenant Module**
- TenantService.create() → log('created', 'tenant', ...)
- TenantService.update() → log('updated', 'tenant', ..., before, after)
- TenantAddressService.create() → log('created', 'tenant_address', ...)
- TenantLicenseService.update() → log('updated', 'tenant_license', ..., before, after)
- etc.

### **RBAC Module**
- RBACService.createRole() → log('created', 'role', ...)
- RBACService.assignRoleToUser() → log('created', 'user_role', ...)
- RBACService.removeRoleFromUser() → log('deleted', 'user_role', ...)
- RBACService.addPermissionToRole() → log('created', 'role_permission', ...)

### **Failed Requests**
- RolesGuard (permission denied) → log('failed', 'api_request', ...)
- TenantResolver (tenant not found) → log('failed', 'api_request', ...)

---

## Validation Rules

**Log Entry Validation**:
- actor_type required (user/system/platform_admin/cron_job)
- action_type required (created/updated/deleted/accessed/failed)
- entity_type required (max 100 chars)
- description required (max 1000 chars)
- before_json must be valid JSON (if provided)
- after_json must be valid JSON (if provided)
- metadata_json must be valid JSON (if provided)
- ip_address must be valid IPv4 or IPv6 (if provided)
- status required (success/failure)

**Query Validation**:
- start_date must be before end_date
- page must be >= 1
- limit must be between 1 and 200
- Export limit max 10,000 rows

---

## Business Logic Requirements

### **Immutability Enforcement**

**Database Level**:
- No UPDATE or DELETE triggers
- No UPDATE or DELETE methods in service
- If modification attempted: Throw error "Audit logs are immutable"

**Application Level**:
- AuditReaderService only has read methods
- No update or delete endpoints in controller

---

### **Async Logging**

**Why Async**:
- Writing logs should not slow down main transaction
- If log write fails, main transaction still succeeds
- High-volume actions (login attempts) don't degrade performance

**Implementation**:
1. Method calls AuditLoggerService.log()
2. log() queues job to BullMQ
3. Method returns immediately
4. Background worker picks up job
5. Worker writes to database
6. If write fails, retry 3 times
7. If still fails, log error (don't crash)

**Fallback Strategy**:
- If queue is down (Redis unavailable)
- Try direct database write (synchronous)
- Log warning "Audit queue unavailable, writing directly"
- Best effort: If direct write fails, log error but don't throw

---

### **Performance Optimization**

**Partitioning**:
- Monthly partitions reduce query scan size
- Queries with date range only scan relevant partitions
- Old partitions can be archived to cold storage

**Indexing**:
- Composite index (tenant_id, created_at) covers most queries
- Separate indexes for user activity, entity history

**Batch Writes**:
- Instead of 100 individual inserts (100 transactions)
- Batch into 1 insert with 100 rows (1 transaction)
- Improves throughput by 10-20x

**Caching** (Optional):
- Cache frequently accessed logs (e.g., last 50 for user)
- Invalidate cache on new log creation
- Cache for 5 minutes max

---

### **Before/After JSON Snapshots**

**What to Capture**:
- For created: after_json = new entity
- For updated: before_json = old state, after_json = new state
- For deleted: before_json = deleted entity

**What to Exclude**:
- Passwords (even hashed)
- Full JWT tokens
- Credit card numbers
- Any PII not needed for audit

**How to Capture**:
- Before update: Fetch entity from database
- After update: Use updated entity
- Store as JSONB (not string)
- JSONB allows querying fields inside JSON

---

## Testing Requirements

### **Unit Tests** (>80% coverage)

1. **AuditLoggerService**
   - ✅ log() queues job
   - ✅ logAuth() creates auth log
   - ✅ logTenantChange() creates tenant log
   - ✅ logFailedAction() sets status=failure

2. **AuditReaderService**
   - ✅ findAll() returns logs with filters
   - ✅ findAll() applies tenant isolation
   - ✅ findOne() returns single log
   - ✅ findOne() validates tenant access
   - ✅ findByUser() filters by actor_user_id
   - ✅ export() generates CSV
   - ✅ export() generates JSON
   - ✅ export() limits to 10,000 rows

3. **Partitioning**
   - ✅ PartitionCreatorJob creates new partition
   - ✅ Logs written to correct partition
   - ✅ Query scans only relevant partitions

4. **Tenant Isolation**
   - ✅ Tenant A cannot see Tenant B logs
   - ✅ Platform Admin can see all logs

---

### **Integration Tests**

1. **End-to-End Logging**
   - ✅ Login creates audit log
   - ✅ Tenant update creates log with before/after
   - ✅ Role assignment creates log
   - ✅ Failed permission check creates log

2. **Async Processing**
   - ✅ Log write is queued
   - ✅ Background worker processes queue
   - ✅ Log appears in database after processing

3. **API Endpoints**
   - ✅ GET /audit-logs returns paginated logs
   - ✅ GET /audit-logs/:id returns single log
   - ✅ GET /audit-logs/export downloads CSV
   - ✅ Tenant user cannot access other tenant logs

---

## Completion Checklist

- [ ] audit_log table created with monthly partitioning
- [ ] Indexes created
- [ ] AuditLoggerService implemented (async logging)
- [ ] AuditReaderService implemented (query/export)
- [ ] AuditLog decorator implemented
- [ ] Background jobs implemented (write, partition creator, retention)
- [ ] API controller implemented (all endpoints)
- [ ] Integration with Auth module
- [ ] Integration with Tenant module
- [ ] Integration with RBAC module
- [ ] Tenant isolation enforced
- [ ] Export to CSV working
- [ ] Export to JSON working
- [ ] Before/after snapshots working
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation complete (Swagger)
- [ ] Performance benchmarks met

---

## Common Pitfalls to Avoid

1. **Don't block main transaction** - Always log asynchronously
2. **Don't log passwords** - Redact sensitive data
3. **Don't skip tenant isolation** - Critical security requirement
4. **Don't allow editing logs** - Immutability is core requirement
5. **Don't forget partitioning** - Performance degrades rapidly without it
6. **Don't log too much** - Balance detail vs. performance
7. **Don't fail main transaction if log fails** - Logging is best-effort
8. **Don't forget IP and user agent** - Required for security investigations

---

## Integration with Other Modules

**Authentication Module**:
- Call AuditLoggerService.logAuth() on login, logout, password change
- Log failed login attempts

**Tenant Module**:
- Call AuditLoggerService.logTenantChange() on all CRUD operations
- Capture before/after snapshots

**RBAC Module**:
- Call AuditLoggerService.logRBACChange() on role/permission changes
- Log role assignments and removals

**All Future Modules**:
- Use @AuditLog decorator on critical methods
- Or call AuditLoggerService.log() directly

---

**End of Backend Module Documentation**

Audit logging is the foundation for security, compliance, and debugging. Must be implemented correctly before proceeding to business modules.