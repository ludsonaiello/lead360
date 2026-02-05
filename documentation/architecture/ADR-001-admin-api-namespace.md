# ADR-001: Admin API Namespace Strategy for Quote Module

**Status**: Accepted
**Date**: February 2, 2026
**Decision Makers**: Backend Development Team, Lead Architect
**Affects**: Quote Admin API, Frontend Development, API Documentation

---

## Context

The Quote Admin system provides platform-level management capabilities for administrators, including template management, cross-tenant analytics, tenant management, operational tools, and reporting.

During implementation, a decision was required regarding the URL namespace structure for admin endpoints. Two primary options emerged:

### Option A: Flat Admin Namespace
```
/admin/tenants/*
/admin/reports/*
/admin/diagnostics/*
/admin/quotes/templates/*
/admin/quotes/dashboard/*
```

### Option B: Module-Scoped Namespace (Chosen)
```
/admin/quotes/tenants/*
/admin/quotes/reports/*
/admin/quotes/diagnostics/*
/admin/quotes/templates/*
/admin/quotes/dashboard/*
```

---

## Decision

**We have decided to use Option B: Module-Scoped Namespace** where all admin endpoints for the quote module are prefixed with `/admin/quotes/*`.

---

## Rationale

### 1. **Module Cohesion** ⭐ PRIMARY REASON
- All quote-related admin functionality is grouped under a single namespace
- Clear ownership: Quote module owns everything under `/admin/quotes/*`
- Easier to understand API surface area at a glance
- Reduces ambiguity about which module handles which endpoint

### 2. **Routing Simplicity**
- Single route prefix in NestJS: `@Controller('admin/quotes')`
- Simplified middleware and guard configuration
- Easier to apply module-specific rate limiting or logging
- Less routing configuration in API gateway/reverse proxy

### 3. **Scalability for Future Modules**
- Other modules can follow the same pattern:
  - `/admin/invoices/*` for invoice admin features
  - `/admin/projects/*` for project admin features
  - `/admin/users/*` for user admin features
- Prevents namespace collision as platform grows
- Clear separation of concerns across modules

### 4. **Documentation Organization**
- API documentation naturally organized by module
- Swagger/OpenAPI tags map cleanly to route prefixes
- Frontend developers can quickly identify quote-related endpoints
- Easier to generate module-specific SDK clients

### 5. **Security & Access Control**
- Module-level access control is easier to implement
- Can add quote-specific admin permissions in the future
- Audit logging can be scoped to module
- Easier to track which module an admin action affects

---

## Consequences

### Positive

✅ **Clear Module Boundaries**: No ambiguity about endpoint ownership
✅ **Future-Proof**: Pattern scales as platform adds more modules
✅ **Simpler Routing**: One controller handles all quote admin endpoints
✅ **Better Organization**: Documentation and code structure align
✅ **Reduced Conflicts**: No risk of path collision with other modules

### Negative

⚠️ **Path Length**: URLs are slightly longer (`/admin/quotes/tenants` vs `/admin/tenants`)
⚠️ **Contract Mismatch**: Original contract specified flat namespace
⚠️ **Frontend Changes**: Frontend must use updated paths

### Mitigation

- **Contract Updated to v1.1**: Reflects actual implementation
- **Comprehensive Documentation**: All paths clearly documented in `/api/documentation/quote_admin_REST_API.md`
- **Communication**: Frontend team notified of path structure
- **Path Length**: Minimal impact on performance or usability

---

## Implementation Notes

### Controllers Affected
1. **QuoteAdminController**: `/admin/quotes` (27 endpoints)
2. **QuoteTemplateAdminController**: `/admin/quotes/templates` (14 endpoints)
3. **QuoteNotesController**: `/quotes` (4 endpoints - not admin-only)

### Example Endpoints
```
GET  /admin/quotes/dashboard/overview
GET  /admin/quotes/tenants
POST /admin/quotes/reports/generate
GET  /admin/quotes/templates
POST /admin/quotes/templates/:id/preview
```

### Authorization
All `/admin/quotes/*` endpoints require:
- JWT authentication (`@UseGuards(JwtAuthGuard)`)
- Platform Admin role (`@Roles('PlatformAdmin')`)
- Some endpoints have additional rate limiting

---

## Alternatives Considered

### Alternative 1: Flat Admin Namespace
**Rejected**: Would cause confusion as platform grows. Which module owns `/admin/tenants`? Quote module, user module, or tenant management module?

### Alternative 2: Hybrid Approach
Example: `/admin/quotes/templates` but `/admin/tenants` (shared)
**Rejected**: Inconsistent pattern creates confusion. Better to be explicit about ownership.

### Alternative 3: Separate Admin API
Example: `https://admin-api.lead360.app/quotes/tenants`
**Rejected**: Adds infrastructure complexity. Single API with namespaces is simpler.

---

## Related Documents

- **API Documentation**: `/api/documentation/quote_admin_REST_API.md`
- **Contract v1.1**: `/documentation/contracts/quote-admin-contract.md`
- **Backend Instructions**: `/documentation/backend/module-quote-admin-*.md`
- **Frontend Instructions**: `/documentation/frontend/module-quotes-admin-*.md`

---

## Review History

| Date | Reviewer | Decision | Notes |
|------|----------|----------|-------|
| 2026-02-02 | Backend Team | Approved | Implemented in code |
| 2026-02-02 | Lead Architect | Approved | Updated contract to v1.1 |
| 2026-02-02 | Frontend Team | Acknowledged | Will use updated paths |

---

## Future Considerations

1. **API Versioning**: If we introduce breaking changes, consider `/api/v2/admin/quotes/*`
2. **GraphQL Alternative**: May want to offer GraphQL endpoint for complex queries
3. **Module Federation**: If quote module becomes standalone service, paths still work
4. **OpenAPI Spec**: Maintain swagger docs with consistent tagging

---

**Status**: This decision is **ACCEPTED** and reflected in the current implementation.

---

**Document Version**: 1.0
**Last Updated**: February 2, 2026
**Next Review**: Upon major API version change or module restructuring
