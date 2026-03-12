# Sprint 31 — Customer Portal Authentication

## Sprint Goal
Deliver the portal_account entity with email login, bcrypt password hashing, password reset flow, separate portal JWT issuance, and customer_slug generation.

## Phase
BACKEND

## Module
Project Management

## Gate Status
NONE

## Prerequisites
- Sprint 08 must be complete (reason: ProjectService creates portal accounts during project creation from quote)

## Codebase Reference
- Module path: `api/src/modules/projects/` (or a new `api/src/modules/portal/`)
- Lead model for customer name resolution
- Tenant model for subdomain

## Tasks

### Task 31.1 — Add portal_account model to Prisma schema + migration
**Type**: Schema + Migration
**Complexity**: Medium

**Field Table — portal_account**:
| Field | Type | Nullable | Default | Notes |
|-------|------|----------|---------|-------|
| id | String @id @db.VarChar(36) | no | @default(uuid()) | PK |
| tenant_id | String @db.VarChar(36) | no | — | FK → tenant |
| lead_id | String @db.VarChar(36) | no | — | FK → lead. One per customer per tenant. |
| email | String @db.VarChar(255) | no | — | Customer email — login credential |
| customer_slug | String @db.VarChar(200) | no | — | URL-safe slug. Unique per tenant. |
| password_hash | String @db.Text | no | — | bcrypt hashed. Never returned in API. |
| must_change_password | Boolean | no | true | @default(true). Set false after first change. |
| last_login_at | DateTime? | yes | null | |
| reset_token | String? @db.VarChar(200) | yes | null | |
| reset_token_expires_at | DateTime? | yes | null | |
| is_active | Boolean | no | true | @default(true) |
| created_at | DateTime | no | @default(now()) | |
| updated_at | DateTime | no | @updatedAt | |

**Indexes**: @@unique([tenant_id, lead_id]), @@unique([tenant_id, email]), @@unique([tenant_id, customer_slug])
**Map**: @@map("portal_account")

**IMPORTANT — Standalone Projects & Portal Access**:
Portal accounts require a linked lead (`lead_id` is required, non-nullable). This means:
- **Standalone projects (is_standalone=true, lead_id=null)** CANNOT have customer portal access
- Portal accounts are only created when a project is created from a quote (which always has a lead)
- The `createFromQuote` flow in Sprint 08 creates the portal account; the `createStandalone` flow does NOT
- If a standalone project later needs portal access, a lead must first be linked to the project

**Relations**:
- tenant: `tenant @relation(fields: [tenant_id], references: [id], onDelete: Cascade)`
- lead: `lead @relation(fields: [lead_id], references: [id], onDelete: Cascade)`
- Add reverse relations: `portal_account portal_account?` to lead model, `portal_accounts portal_account[]` to tenant model

Run migration.

**Acceptance Criteria**: portal_account table exists with unique constraints
**Blocker**: NONE

---

### Task 31.2 — PortalAuthService + Controller + Tests + Docs
**Type**: Service + Controller + Test + Documentation
**Complexity**: High

**PortalAuthService methods**:
1. **createPortalAccount(tenantId, leadId)** — Fetch lead (name, primary email). Generate customer_slug from first_name + last_name (lowercase, hyphens, deduplicate per tenant). Generate temporary password. Hash with bcrypt. Create portal_account with must_change_password=true. Queue welcome email (or log for now). Return { customer_slug, temporary_password }.
2. **login(tenantId, email, password)** — Validate credentials. Issue portal JWT (separate from staff JWT) with payload: { portal_account_id, tenant_id, lead_id, customer_slug }. Update last_login_at. Return { token, customer_slug, must_change_password }.
3. **changePassword(portalAccountId, oldPassword, newPassword)** — Validate old password. Hash new. Set must_change_password=false.
4. **requestPasswordReset(tenantId, email)** — Generate reset_token, set expiry (1 hour). Queue reset email.
5. **resetPassword(token, newPassword)** — Validate token not expired. Hash new password. Clear token.

**Slug generation**:
```
generateSlug(firstName, lastName, tenantId): string {
  let base = `${firstName}-${lastName}`.toLowerCase().replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-');
  let slug = base;
  let counter = 2;
  while (await exists(tenantId, slug)) {
    slug = `${base}-${counter}`;
    counter++;
  }
  return slug;
}
```

**Portal JWT**: Use a separate JWT secret (PORTAL_JWT_SECRET env var) or prefix claims with portal_ to distinguish from staff tokens. Expiry: 30 days.

**PortalAuthGuard**: Create a new guard that validates portal JWTs (separate from JwtAuthGuard).

**Controller** — `@Controller('api/v1/portal/auth')`:
| Method | Path | Auth |
|--------|------|------|
| POST | /portal/auth/login | Public |
| POST | /portal/auth/forgot-password | Public |
| POST | /portal/auth/reset-password | Public |
| POST | /portal/auth/change-password | Portal token |

**Login response**:
```json
{
  "token": "portal-jwt-token",
  "customer_slug": "john-smith",
  "must_change_password": true,
  "lead": { "first_name": "John", "last_name": "Smith" }
}
```

**Business Rules**:
- Portal JWT is NOT a staff JWT — separate auth mechanism
- customer_slug unique per tenant with auto-increment on collision
- must_change_password = true on first login
- Reset token expires in 1 hour
- Portal token payload: { portal_account_id, tenant_id, lead_id, customer_slug }

**Integration with ProjectService**: Update Sprint 08's createFromQuote to call createPortalAccount after project creation.

Unit tests, integration tests, REST docs at `api/documentation/portal_auth_REST_API.md`.

**Acceptance Criteria**:
- [ ] Portal account created with slug
- [ ] Login returns portal JWT
- [ ] Password change/reset working
- [ ] Portal guard validates portal tokens
- [ ] Tests and docs complete

**Blocker**: Task 31.1

---

## Sprint Acceptance Criteria
- [ ] Portal authentication system complete
- [ ] Separate JWT from staff auth
- [ ] Slug generation with deduplication
- [ ] Tests and docs complete

## Gate Marker
NONE

## Handoff Notes
- Portal auth at /api/v1/portal/auth/
- PortalAuthGuard created for portal-only endpoints
- customer_slug in portal URL: /{customer_slug}/projects/
- Portal account auto-created on project creation from quote
