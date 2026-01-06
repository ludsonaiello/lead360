# Feature Contract: Audit Log

**Feature Name**: Audit Log (Activity Tracking)  
**Module**: Security & Compliance  
**Sprint**: Sprint 0 - Platform Foundation  
**Status**: Draft

---

## Purpose

**What problem does this solve?**

Provides an immutable, searchable record of all system actions for security, compliance, debugging, and tenant isolation validation. Every critical action in the platform is logged with full context for audit trails and forensic analysis.

**Who is this for?**

- **Primary Users**: Platform Admin (system-wide audit), Tenant Owners/Admins (tenant-specific audit)
- **Compliance Officers**: Export logs for SOC 2, GDPR, HIPAA audits
- **Developers**: Debug issues, trace data changes
- **Security Teams**: Investigate suspicious activity, validate tenant isolation
- **Use Cases**: 
  - "Who changed this business address and when?"
  - "Show me all failed login attempts for this user"
  - "Export all activity for Tenant X in Q4 2024 for compliance audit"
  - "Who deleted this quote and can we restore it?"
  - "Trace all actions performed by Platform Admin on Tenant Y"

---

## Scope

### **In Scope**

- ✅ Immutable audit log (cannot edit or delete entries)
- ✅ Comprehensive action tracking (auth, tenant, RBAC, files, admin actions)
- ✅ Before/after snapshots (JSON diff for data changes)
- ✅ Actor tracking (who performed action)
- ✅ Tenant isolation (tenant-specific logs)
- ✅ IP address and user agent tracking
- ✅ Success/failure status with error messages
- ✅ Searchable and filterable logs
- ✅ Export functionality (CSV, JSON for compliance)
- ✅ Retention policy (configurable, default 7 years)
- ✅ Date-based partitioning (monthly partitions for performance)
- ✅ Async logging (non-blocking, queued)
- ✅ Metadata field (additional context as JSON)
- ✅ Platform-wide and tenant-specific views

### **Out of Scope**

- ❌ Real-time log streaming (Phase 2 - WebSocket live feed)
- ❌ Log alerting/notifications (Phase 2 - "Alert me when X happens")
- ❌ Log analytics/reporting (Phase 2 - trends, patterns, dashboards)
- ❌ Log retention automation (Phase 2 - auto-archive to cold storage)
- ❌ SIEM integration (Phase 3 - Splunk, Datadog, etc.)
- ❌ Video audit trails (Phase 3 - screen recordings)

---

## Dependencies

### **Requires (must be complete first)**

- [x] Authentication module (user tracking)
- [x] Tenant module (tenant isolation)
- [x] RBAC module (permission tracking)

### **Blocks (must complete before)**

- File Storage (log file operations)
- Background Jobs (log job executions)
- Admin Panel (log admin actions)
- All business modules (log business actions)

---

## Data Model

### **Tables Required**

1. **audit_log** - Main audit log table (partitioned by month)
2. **audit_log_retention_policy** - Retention rules per entity type (optional)

**Partitioning Strategy**: Monthly partitions for performance (audit_log_2025_01, audit_log_2025_02, etc.)

---

## What Gets Logged

### **Authentication Events**

| Event | Action Type | Entity Type | Logged Data |
|-------|-------------|-------------|-------------|
| User registration | created | user | Email, subdomain, IP |
| Login success | accessed | auth_session | User ID, IP, user agent |
| Login failed | failed | auth_attempt | Email, IP, error reason |
| Logout | deleted | auth_session | User ID, session ID |
| Logout all devices | deleted | auth_session | User ID, session count |
| Password changed | updated | user | User ID (password NOT logged) |
| Password reset requested | created | password_reset_token | Email, IP |
| Password reset completed | updated | user | User ID |
| Email activation | updated | user | User ID, activation token |
| Session revoked | deleted | auth_session | User ID, session ID, device info |

---

### **Tenant Management Events**

| Event | Action Type | Entity Type | Logged Data |
|-------|-------------|-------------|-------------|
| Business profile created | created | tenant | All profile data |
| Business info updated | updated | tenant | Before/after JSON |
| Address added | created | tenant_address | Address details |
| Address updated | updated | tenant_address | Before/after JSON |
| Address deleted | deleted | tenant_address | Deleted address data |
| License added | created | tenant_license | License details |
| License updated | updated | tenant_license | Before/after JSON |
| License deleted | deleted | tenant_license | Deleted license data |
| Insurance updated | updated | tenant_insurance | Before/after JSON |
| Payment terms updated | updated | tenant_payment_terms | Before/after JSON |
| Business hours updated | updated | tenant_business_hours | Before/after JSON |
| Service area added | created | tenant_service_area | Area details |
| Branding updated | updated | tenant | Logo path, colors |
| Subscription changed | updated | tenant_subscription | Old plan, new plan |

---

### **RBAC Events**

| Event | Action Type | Entity Type | Logged Data |
|-------|-------------|-------------|-------------|
| Role created | created | role | Role name, description |
| Role updated | updated | role | Before/after JSON |
| Role deleted | deleted | role | Deleted role data |
| Role cloned | created | role | Source role, new role |
| Permission added to role | created | role_permission | Role ID, permission ID |
| Permission removed from role | deleted | role_permission | Role ID, permission ID |
| Role assigned to user | created | user_role | User ID, role ID, assigner |
| Role removed from user | deleted | user_role | User ID, role ID, remover |
| Batch role assignment | created | user_role | User IDs, role IDs |
| Module created | created | module | Module details |
| Module updated | updated | module | Before/after JSON |
| Permission created | created | permission | Permission details |
| Permission updated | updated | permission | Before/after JSON |

---

### **User Management Events**

| Event | Action Type | Entity Type | Logged Data |
|-------|-------------|-------------|-------------|
| User invited | created | user | Email, roles, inviter |
| User created | created | user | Email, roles, creator |
| User profile updated | updated | user | Before/after JSON (no password) |
| User deactivated | updated | user | User ID, deactivator |
| User reactivated | updated | user | User ID, reactivator |
| User deleted | deleted | user | User data (soft delete) |

---

### **File Storage Events** (Future Module)

| Event | Action Type | Entity Type | Logged Data |
|-------|-------------|-------------|-------------|
| File uploaded | created | file | Filename, size, type, path |
| File downloaded | accessed | file | File ID, downloader |
| File deleted | deleted | file | File data |

---

### **Admin Actions** (Platform Admin)

| Event | Action Type | Entity Type | Logged Data |
|-------|-------------|-------------|-------------|
| Tenant suspended | updated | tenant | Tenant ID, reason |
| Tenant activated | updated | tenant | Tenant ID |
| Subscription plan changed | updated | tenant | Old plan, new plan |
| License type created | created | license_type | Type details |
| Subscription plan created | created | subscription_plan | Plan details |

---

### **Failed Actions** (Security Critical)

| Event | Action Type | Entity Type | Logged Data |
|-------|-------------|-------------|-------------|
| Unauthorized access attempt | failed | api_request | User ID, endpoint, IP |
| Invalid token | failed | auth_attempt | Token (partial), IP |
| Permission denied | failed | api_request | User ID, endpoint, required permission |
| Tenant isolation violation | failed | api_request | User ID, attempted tenant ID |

---

## Log Entry Structure

### **Core Fields**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| id | UUID | Yes | Unique log entry ID |
| created_at | Timestamp | Yes | When action occurred (precise to millisecond) |
| actor_user_id | UUID | No | Who performed action (null for system actions) |
| actor_type | Enum | Yes | user, system, platform_admin, cron_job |
| tenant_id | UUID | No | Which tenant (null for platform-level actions) |
| action_type | Enum | Yes | created, updated, deleted, accessed, failed |
| entity_type | String | Yes | user, tenant, role, file, etc. |
| entity_id | UUID | No | Which specific record |
| description | Text | Yes | Human-readable description |
| before_json | JSONB | No | Snapshot before change (for updates/deletes) |
| after_json | JSONB | No | Snapshot after change (for creates/updates) |
| metadata_json | JSONB | No | Additional context (IP, user agent, custom data) |
| ip_address | String | No | Actor's IP address |
| user_agent | Text | No | Actor's user agent (browser/device) |
| status | Enum | Yes | success, failure |
| error_message | Text | No | Error details (if status=failure) |

### **Metadata JSON Examples**

**Login Event**:
```json
{
  "device": "Chrome on MacOS",
  "location": "Boston, MA, US",
  "session_id": "uuid",
  "remember_me": true
}
```

**Permission Denied**:
```json
{
  "endpoint": "/api/invoices/create",
  "method": "POST",
  "required_permission": "invoices:create",
  "user_roles": ["Employee"],
  "http_status": 403
}
```

**Subscription Change**:
```json
{
  "old_plan": "Basic",
  "new_plan": "Pro",
  "changed_by": "Platform Admin",
  "reason": "Upgrade request"
}
```

---

## API Specification

### **Endpoints Overview**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| GET | /audit-logs | List audit logs (filtered) | Yes | Owner, Admin, Platform Admin |
| GET | /audit-logs/:id | Get single log entry | Yes | Owner, Admin, Platform Admin |
| GET | /audit-logs/export | Export filtered logs | Yes | Owner, Admin, Platform Admin |
| GET | /users/:userId/audit-logs | User's activity history | Yes | Owner, Admin, Platform Admin |
| GET | /tenants/:tenantId/audit-logs | Tenant's activity history | Yes | Platform Admin |

**Note**: No POST, PATCH, DELETE endpoints - logs are immutable. Only created internally by system.

---

### **Endpoint Details**

#### **1. List Audit Logs**

**GET** `/audit-logs`

**Purpose**: Get paginated list of audit logs with filters

**Query Parameters**:
- `page` (integer, default: 1)
- `limit` (integer, default: 50, max: 200)
- `start_date` (ISO datetime, filter: created_at >= start_date)
- `end_date` (ISO datetime, filter: created_at <= end_date)
- `actor_user_id` (UUID, filter by who performed action)
- `action_type` (created/updated/deleted/accessed/failed)
- `entity_type` (user/tenant/role/file/etc.)
- `entity_id` (UUID, filter by specific record)
- `status` (success/failure)
- `search` (text search in description field)

**Success Response (200)**:
```json
{
  "logs": [
    {
      "id": "uuid",
      "created_at": "2025-01-05T10:30:45.123Z",
      "actor_user_id": "uuid",
      "actor_name": "John Doe",
      "actor_type": "user",
      "tenant_id": "uuid",
      "tenant_name": "ABC Painting",
      "action_type": "updated",
      "entity_type": "tenant",
      "entity_id": "uuid",
      "description": "Updated business profile - legal name changed",
      "status": "success",
      "ip_address": "192.168.1.1",
      "user_agent": "Mozilla/5.0..."
    },
    // ... more logs
  ],
  "pagination": {
    "current_page": 1,
    "total_pages": 15,
    "total_count": 742,
    "limit": 50
  }
}
```

**Business Logic**:
- Tenant users (Owner/Admin): Only see logs for their tenant
- Platform Admin: See all logs across all tenants
- Results sorted by created_at DESC (newest first)
- Pagination required (never return all logs)
- Filters are AND logic (all must match)

---

#### **2. Get Single Log Entry**

**GET** `/audit-logs/:id`

**Purpose**: Get full details of specific log entry including before/after JSON

**Success Response (200)**:
```json
{
  "id": "uuid",
  "created_at": "2025-01-05T10:30:45.123Z",
  "actor_user_id": "uuid",
  "actor_name": "John Doe",
  "actor_email": "john@example.com",
  "actor_type": "user",
  "tenant_id": "uuid",
  "tenant_name": "ABC Painting",
  "tenant_subdomain": "abc-painting",
  "action_type": "updated",
  "entity_type": "tenant",
  "entity_id": "uuid",
  "description": "Updated business profile - legal name changed",
  "before_json": {
    "legal_name": "ABC Painting Inc",
    "dba_name": "ABC Paint"
  },
  "after_json": {
    "legal_name": "ABC Painting LLC",
    "dba_name": "ABC Paint"
  },
  "metadata_json": {
    "fields_changed": ["legal_name"],
    "change_reason": "Legal entity conversion"
  },
  "ip_address": "192.168.1.1",
  "user_agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)...",
  "status": "success"
}
```

**Business Logic**:
- Tenant users: Can only view logs for their tenant
- Platform Admin: Can view any log
- If log doesn't belong to user's tenant: 403 Forbidden

---

#### **3. Export Audit Logs**

**GET** `/audit-logs/export`

**Purpose**: Export filtered audit logs to CSV or JSON for compliance reports

**Query Parameters**:
- Same filters as list endpoint
- `format` (csv or json, default: csv)

**Success Response (200)**:
- Content-Type: text/csv or application/json
- Filename: `audit-log-{tenant_subdomain}-{start_date}-{end_date}.{format}`

**CSV Headers**:
```
Timestamp,Actor,Tenant,Action,Entity Type,Entity ID,Description,Status,IP Address
```

**Business Logic**:
- Apply same filters as list endpoint
- No pagination (export all matching results)
- Limit: Max 10,000 rows per export (prevent memory issues)
- If >10,000: Return error "Too many results, narrow date range"
- Tenant users: Only export their tenant's logs
- Platform Admin: Can export any tenant or all tenants

---

#### **4. User Activity History**

**GET** `/users/:userId/audit-logs`

**Purpose**: Get all actions performed by specific user

**Query Parameters**:
- Same filters as list endpoint (date range, action type, etc.)

**Success Response (200)**:
- Same structure as list endpoint
- Pre-filtered by actor_user_id

**Business Logic**:
- Tenant users: Can only view users in their tenant
- Platform Admin: Can view any user
- Useful for "What did this user do?" queries

---

#### **5. Tenant Activity History**

**GET** `/tenants/:tenantId/audit-logs`

**Purpose**: Get all actions in specific tenant (Platform Admin only)

**Success Response (200)**:
- Same structure as list endpoint
- Pre-filtered by tenant_id

**Business Logic**:
- Platform Admin only (403 for tenant users)
- Useful for "What happened in this tenant?" queries

---

## UI Requirements

### **Pages Required**

1. **Audit Log Viewer** (`/settings/audit-log`)
   - For Tenant Owners/Admins: View their tenant's logs
   - Filters, search, pagination
   - Detail modal (view before/after JSON)
   - Export button

2. **Platform Admin: Audit Log Viewer** (`/admin/audit-logs`)
   - For Platform Admin: View all logs across all tenants
   - Additional filter: Tenant selector
   - Same features as tenant viewer

3. **User Activity Page** (`/settings/users/:id/activity`)
   - Shows all actions performed by specific user
   - Embedded audit log viewer (pre-filtered)

---

## User Flows

### **Primary Flow: View Audit Logs**

1. Owner/Admin navigates to Settings → Audit Log
2. Page loads with last 50 logs (default)
3. User applies filters:
   - Date range: Last 7 days
   - Action type: "updated"
   - Entity type: "tenant"
4. Click "Apply Filters"
5. Table refreshes with filtered results
6. User clicks log row
7. Detail modal opens showing full log entry
8. Modal displays before/after JSON diff (visual comparison)
9. User closes modal
10. User clicks "Export" button
11. Modal asks for format (CSV or JSON)
12. User selects CSV
13. File downloads: `audit-log-abc-painting-2024-12-29-2025-01-05.csv`

---

### **Secondary Flow: Investigate User Activity**

1. Admin navigates to Settings → Users
2. Clicks user "John Doe"
3. User detail page shows "Activity" tab
4. Activity tab displays audit logs for this user
5. Shows last 30 days by default
6. Admin sees "Login from new device" event
7. Clicks event → Modal shows IP address and user agent
8. Admin verifies it's legitimate

---

### **Platform Admin Flow: Cross-Tenant Investigation**

1. Platform Admin navigates to Admin → Audit Logs
2. Platform-wide log viewer loads
3. Admin filters by:
   - Tenant: "ABC Painting"
   - Date range: December 1-31, 2024
   - Action type: "deleted"
4. Results show 3 deleted records in that tenant
5. Admin clicks first record
6. Modal shows before_json (what was deleted)
7. Admin sees "Quote #1234" was deleted by user "Jane Smith"
8. Admin can contact tenant to explain

---

## Business Rules

### **Immutability**

1. **No Editing**: Audit logs CANNOT be edited after creation
2. **No Deletion**: Audit logs CANNOT be deleted (even by Platform Admin)
3. **Soft Delete Only**: If database cleanup needed, mark as archived, don't delete
4. **Retention Policy**: Logs older than retention period archived to cold storage (not deleted)

### **Tenant Isolation**

1. **Strict Filtering**: Tenant users ONLY see logs for their tenant
2. **No Cross-Tenant Access**: Even if user knows log ID, cannot access other tenant's logs
3. **Platform Admin Exception**: Platform Admin can access all logs

### **Performance**

1. **Partitioning**: Table partitioned by month (audit_log_2025_01, audit_log_2025_02)
2. **Indexing**: Indexes on tenant_id, actor_user_id, created_at, entity_type
3. **Pagination Required**: Never return all logs (max 200 per page)
4. **Export Limits**: Max 10,000 rows per export

### **Data Retention**

1. **Default Retention**: 7 years (2,557 days)
2. **Configurable**: Platform Admin can set retention per entity type
3. **Archive Strategy**: After retention period, move to cold storage (S3 Glacier)
4. **Never Delete**: Even archived logs can be retrieved if needed

### **Async Logging**

1. **Non-Blocking**: Logging operations MUST NOT block main transaction
2. **Queued**: Use background job queue (BullMQ) to write logs
3. **Best Effort**: If log write fails, don't fail main transaction
4. **Retry Logic**: If queue fails, retry 3 times with exponential backoff

---

## Security & Privacy

### **What NOT to Log**

1. **Passwords**: Never log plaintext passwords (even in before/after JSON)
2. **Tokens**: Never log full JWT tokens or API keys
3. **Credit Card Numbers**: Never log full card numbers (PCI DSS)
4. **SSN/EIN**: Be careful with sensitive identifiers
5. **Private Messages**: Don't log content of private communications

### **What to Redact**

1. **Partial Tokens**: Log last 4 characters only (e.g., "...xyz123")
2. **Email Addresses**: Log for actor, but redact in metadata if sensitive
3. **IP Addresses**: Anonymize if GDPR requires (last octet to 0)

### **Access Control**

1. **Owner/Admin**: Can view tenant logs
2. **Platform Admin**: Can view all logs
3. **Other Roles**: NO access (403 Forbidden)

---

## Testing Requirements

### **Backend Tests**

**Unit Tests**:
- ✅ Create audit log entry
- ✅ Tenant isolation (User A cannot see User B's logs)
- ✅ Filter by date range
- ✅ Filter by action type
- ✅ Filter by entity type
- ✅ Pagination works correctly
- ✅ Export generates valid CSV
- ✅ Export generates valid JSON
- ✅ Platform Admin can see all logs
- ✅ Tenant user cannot see other tenant logs

**Integration Tests**:
- ✅ Login action creates audit log
- ✅ Tenant update creates audit log with before/after
- ✅ Role assignment creates audit log
- ✅ Failed login creates audit log with status=failure
- ✅ Async logging doesn't block main transaction
- ✅ Log write failure doesn't fail main transaction

---

### **Frontend Tests**

**Component Tests**:
- ✅ AuditLogTable renders logs
- ✅ Filters update query parameters
- ✅ Pagination controls work
- ✅ Detail modal shows before/after diff
- ✅ Export button triggers download

**Integration Tests**:
- ✅ Owner can view audit logs
- ✅ Admin can view audit logs
- ✅ Estimator cannot access audit logs (403)
- ✅ Filters apply correctly
- ✅ Export downloads file
- ✅ Platform Admin can filter by tenant

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend**
- [ ] audit_log table created with partitioning
- [ ] All critical actions logged (auth, tenant, RBAC)
- [ ] Before/after JSON snapshots working
- [ ] IP address and user agent captured
- [ ] Async logging implemented (queued)
- [ ] Tenant isolation enforced
- [ ] API endpoints implemented (list, get, export, user history, tenant history)
- [ ] Export to CSV working
- [ ] Export to JSON working
- [ ] Pagination working
- [ ] Filters working (date, actor, action, entity, status)
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] API documentation complete

### **Frontend**
- [ ] Audit log viewer page (tenant users)
- [ ] Audit log viewer page (Platform Admin)
- [ ] Filter UI (date range, dropdowns, search)
- [ ] Detail modal with before/after diff
- [ ] Export button with format selection
- [ ] User activity tab on user detail page
- [ ] Tenant activity page (Platform Admin)
- [ ] Loading states
- [ ] Error handling
- [ ] Component tests >70% coverage
- [ ] E2E tests passing

### **Integration**
- [ ] All logged actions appear in audit viewer
- [ ] Tenant isolation verified
- [ ] Export functionality verified
- [ ] Performance acceptable (list page loads <2 seconds for 10k records)

---

## Performance Benchmarks

**Target Performance**:
- List query (50 results, filtered): <500ms
- Export (1,000 rows): <2 seconds
- Export (10,000 rows): <10 seconds
- Single log detail: <100ms
- Async log write (queued): <50ms

**Optimization Strategies**:
- Monthly partitioning (query only relevant partition)
- Indexes on common filters
- Limit export size (max 10,000)
- Cache frequently accessed logs (5 minutes)

---

## Timeline Estimate

**Backend Development**: 3-4 days
- Table schema and partitioning: 0.5 day
- Logging service (create logs): 0.5 day
- API endpoints (list, get, export): 1 day
- Async logging integration: 0.5 day
- Testing: 1 day

**Frontend Development**: 2-3 days
- Audit log viewer: 1 day
- Filters and search: 0.5 day
- Detail modal (before/after diff): 0.5 day
- Export functionality: 0.5 day
- Testing: 0.5 day

**Integration & Testing**: 0.5 day

**Total**: 5.5-7.5 days

---

## Notes

- Audit log is critical for compliance (SOC 2, GDPR, HIPAA)
- Must be immutable and tamper-proof
- Performance is critical (large tables over time)
- Async logging prevents performance degradation
- Export functionality required for audits
- Clear data retention policy needed

---

**End of Audit Log Contract**
