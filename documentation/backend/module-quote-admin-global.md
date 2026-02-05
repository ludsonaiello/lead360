# Quote Module Admin - Global Backend Instructions

**Project**: Lead360 Quote Module Admin System  
**Your Role**: Backend Developer  
**Access Level**: Platform Admin endpoints  
**Restriction**: Admin endpoints ONLY - do not modify tenant-facing quote endpoints

---

## CRITICAL CONTEXT

You are building ADMIN endpoints for PLATFORM ADMINISTRATORS to manage the quote system across ALL tenants.

**Key Differences from Tenant Endpoints**:
- Admin can view data across multiple tenants
- Admin endpoints under `/admin/` prefix
- Require `Platform Admin` role (RBAC)
- Cross-tenant queries allowed but MUST be logged
- Different security considerations

---

## MANDATORY READING

1. **Feature Contract**: `ADMIN_FEATURE_CONTRACT.md`
2. **Existing Admin API**: `api/documentation/quotes_REST_API.md` (Admin Endpoints section)
3. **Multi-Tenant Rules**: `multi-tenant-rules.md`
4. **Security Rules**: `security-rules.md`

---

## EXISTING ADMIN ENDPOINTS (DO NOT MODIFY)

These are ALREADY IMPLEMENTED by previous developers:

**Template Management** (8 endpoints at `/admin/quotes/templates`):
- Create, read, update, delete templates
- Clone templates
- Usage statistics
- Template variables

**Unit Measurements** (4 endpoints at `/admin/units`):
- Create, read, update global units
- Seed defaults

**DO NOT TOUCH THESE**. Focus on new features only.

---

## YOUR ENDPOINTS

All admin endpoints must:

### URL Structure
- Prefix: `/admin/quotes/` or `/admin/tenants/` or `/admin/reports/`
- Example: `GET /admin/quotes/dashboard/overview`

### Authentication & Authorization
```typescript
@Controller('admin/quotes/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Platform Admin')
export class AdminDashboardController { }
```

**CRITICAL**: Every endpoint requires:
1. JWT authentication
2. Platform Admin role check
3. Audit logging for mutations

### Audit Logging
For ALL data modifications:
```typescript
await this.auditService.log({
  actor_user_id: adminUserId,
  action: 'ADMIN_DELETE_QUOTE',
  entity_type: 'quote',
  entity_id: quoteId,
  tenant_id: quote.tenant_id,
  metadata: { reason: deleteReason },
});
```

---

## CROSS-TENANT QUERIES

Admin can query across tenants, but:

**Pattern for Cross-Tenant Reads**:
```typescript
// Get all quotes across all tenants
const quotes = await this.prisma.quote.findMany({
  // NO tenant_id filter - intentionally cross-tenant
  where: {
    status: 'sent',
    created_at: { gte: dateFrom, lte: dateTo },
  },
  include: {
    tenant: { select: { id: true, company_name: true } },
  },
});
```

**Security Requirements**:
1. Log all cross-tenant queries
2. Include tenant info in responses
3. Never expose sensitive tenant data in aggregates
4. Anonymize data for benchmarks

---

## DATA PRIVACY & ANONYMIZATION

When aggregating across tenants:

**Anonymous Benchmarks**:
- Never include tenant names in pricing benchmarks
- Require minimum 5 tenants for any aggregate
- Use statistical methods (median, percentiles)
- No outlier identification by tenant

**Tenant Identification**:
- OK: "Top 10 tenants by revenue" (ranked list)
- NOT OK: "Tenant X pays $Y for item Z" (individual pricing exposure)

---

## PERFORMANCE CONSIDERATIONS

Admin queries can be expensive:

### Caching Strategy
- Cache dashboard data (5 minute TTL)
- Cache tenant statistics (15 minute TTL)
- No caching for real-time diagnostics

### Pagination
- All list endpoints require pagination
- Max page size: 100 items
- Default page size: 50 items

### Async Operations
- Large exports → queue with BullMQ
- Complex reports → background job
- Return job ID, poll for completion

---

## API RESPONSE FORMATS

### Success Response
```json
{
  "data": { ... },
  "meta": {
    "tenant_count": 145,
    "date_range": { "from": "...", "to": "..." },
    "cached": true,
    "cache_expires_at": "..."
  }
}
```

### Error Response
```json
{
  "statusCode": 403,
  "message": "Platform Admin privileges required",
  "error": "Forbidden"
}
```

---

## TESTING REQUIREMENTS

### Test Admin Account
Use Platform Admin credentials (from environment):
- Email: `admin@lead360.app`
- Password: Set in test environment

### Test Scenarios
1. Endpoint accessible to Platform Admin
2. Endpoint blocked for non-admin users
3. Cross-tenant data returned correctly
4. Tenant isolation not violated (data not mixed)
5. Audit log created for mutations
6. Performance acceptable (load test with 1000+ tenants)

---

## SWAGGER DOCUMENTATION

Tag your endpoints:
```typescript
@ApiTags('Admin - Quote Analytics')
@ApiOperation({ 
  summary: 'Get platform dashboard overview',
  description: 'Returns aggregate statistics across all tenants'
})
@ApiResponse({ status: 200, description: 'Dashboard data retrieved' })
@ApiResponse({ status: 403, description: 'Platform Admin required' })
```

---

## DELIVERABLES

Each developer must deliver:
1. NestJS controller(s) for assigned endpoints
2. Service layer with business logic
3. DTOs with validation
4. Swagger documentation
5. Unit tests (service layer)
6. Integration tests (controller)
7. Audit logging implementation
8. Performance testing results

---

## COMPLETION CRITERIA

Feature complete when:
- All assigned endpoints implemented
- All endpoints require Platform Admin role
- Cross-tenant queries work correctly
- Audit logging functional
- Documentation complete
- Tests pass
- Performance acceptable (<3s for dashboards)
- Code reviewed and approved

---

**Remember**: Admin endpoints are powerful. Security and audit logging are MANDATORY.