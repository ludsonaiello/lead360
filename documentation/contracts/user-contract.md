# Feature Contract — Users Module
**Lead360 Platform**
**Version:** 1.0
**Status:** Ready for Sprint Planning
**Module Path:** `api/src/modules/users`
**Frontend Route:** `app/src/app/(dashboard)/settings/users`

---

## 1. Purpose

Enable full user lifecycle management for the Lead360 platform:

- Tenant Owners and Admins can invite, manage, deactivate, and remove users within their own tenant
- A single global user identity (email) can move between tenants over time without data corruption
- System Admins (platform-level) can create tenants and manage users cross-tenant
- The Auth module resolves the correct tenant context at login from a structured membership record
- All user management actions are audit-logged

---

## 2. Scope

### In Scope
- User invite flow (email → token → accept → activate)
- User listing, role assignment, deactivation, reactivation, soft/hard delete
- Self-service profile and password management
- Superadmin endpoints for tenant and user management
- Redis-based JWT token blocklist for immediate invalidation on deactivation
- Schema migration: introduce `user_tenant_membership` table, remove `tenant_id` from `user`
- Auth module update: resolve active membership at login instead of reading `user.tenant_id`
- Frontend: Settings → Users page (Owner/Admin only)
- Frontend: Sidebar navigation entry for Users under Settings

### Out of Scope
- Vendor role (deferred)
- Multi-role per user per tenant (one role per membership)
- SSO / OAuth login (future)
- Multi-business simultaneous access (future)
- Billing / subscription management (separate module)

---

## 3. Business Rules

| ID | Rule |
|---|---|
| BR-01 | `user.email` is globally unique across the entire platform. One `user` record per email, forever. |
| BR-02 | Only one `user_tenant_membership` with `status = ACTIVE` may exist per `user_id` at any time. Enforced at the service layer before any activation. Error: `User is currently active in another organization.` |
| BR-03 | Reactivating a user is blocked if any other `ACTIVE` membership exists for that `user_id`. |
| BR-04 | Deactivation sets membership `status = INACTIVE`, records `left_at = now()`, and immediately pushes the user's JWT `jti` to the Redis blocklist. |
| BR-05 | Invite tokens expire 72 hours after issuance. They are single-use — marked `USED` on first accept attempt regardless of outcome. Expired tokens return HTTP 410. |
| BR-06 | Before hard-deleting a user, the service checks for any `actor_user_id` reference in `audit_log` or any FK reference in any other table. If found → soft delete only (`deleted_at` set). Hard delete is blocked at the service layer. |
| BR-07 | Soft-deleted users are never shown by name in UI but their `user_id` FK is preserved in all historical records. Display label: `[Deactivated User]`. |
| BR-08 | Every role change is written to `audit_log` with `action_type: ROLE_CHANGE`, `before_json: { role }`, `after_json: { role }`, `actor_user_id`. |
| BR-09 | An Admin cannot change the role of an Owner. Only another Owner or a SuperAdmin can. Enforced at service layer. |
| BR-10 | The last active Owner in a tenant cannot be deactivated or demoted. Error: `Tenant must have at least one active Owner.` |
| BR-11 | User history on Tenant A is never visible in Tenant B context. All data tables carry their own `tenant_id`. The `actor_user_id` in `audit_log` is only queryable within the tenant scope it was written under. |
| BR-12 | If an invite is sent to an email that already has a `user` record, the system links the existing user to the new membership — it does NOT create a new `user` record. |
| BR-13 | JWT guard must check the Redis blocklist on every authenticated request before allowing access. Blocked token returns HTTP 401 with message: `Token has been revoked.` |

---

## 4. Schema Changes

### 4.1 Modify `user` table

**Remove:**
```
tenant_id   String?   @db.VarChar(36)
tenant      tenant?   @relation(fields: [tenant_id], references: [id])
```

**Add:**
```
email   @unique   (add unique constraint — currently missing)
```

**Impact assessment:** `user.tenant_id` is only read by `auth.service.ts` at login to resolve tenant context. No other module queries `user.tenant_id` — all other tables carry their own `tenant_id` column for isolation. The auth module must be updated to resolve tenant from `user_tenant_membership` instead.

### 4.2 Create `user_tenant_membership` table (NEW)

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | String UUID | PK | |
| `user_id` | String FK → user.id | NOT NULL | |
| `tenant_id` | String FK → tenant.id | NOT NULL | |
| `role_id` | String FK → role.id | NOT NULL | One role per membership |
| `status` | Enum | NOT NULL | `INVITED`, `ACTIVE`, `INACTIVE` |
| `invite_token_hash` | String? | UNIQUE when set | SHA-256 hash of raw token (enables O(1) indexed lookup) |
| `invite_token_expires_at` | DateTime? | | 72h from creation |
| `invite_accepted_at` | DateTime? | | Set on token accept |
| `invited_by_user_id` | String? FK → user.id | | Who sent the invite |
| `joined_at` | DateTime? | | Set when ACTIVE |
| `left_at` | DateTime? | | Set when INACTIVE |
| `created_at` | DateTime | default now() | |
| `updated_at` | DateTime | @updatedAt | |

**Required indexes:**
- `@@index([user_id, status])` — enforce and query one ACTIVE per user
- `@@index([tenant_id, status])` — list active users per tenant
- `@@index([tenant_id, role_id])` — role-filtered listing
- `@@unique([invite_token_hash])` — token lookup at accept

### 4.3 Deprecate `user_role` table

The existing `user_role` table (fields: `user_id`, `role_id`, `tenant_id`, `assigned_by_user_id`) is superseded by `user_tenant_membership`. It must be:
- Migrated: data backfilled into `user_tenant_membership` where applicable
- Retained as-is for now (not dropped) to avoid FK cascade risks
- Marked deprecated in schema comments

---

## 5. Auth Module Update (Required)

**File:** `api/src/modules/auth/auth.service.ts`

**Current behavior at login:** Query `user` by email → read `user.tenant_id` → embed in JWT.

**New behavior at login:**
1. Query `user` by email → validate password
2. Query `user_tenant_membership` where `user_id = user.id AND status = ACTIVE`
3. If no ACTIVE membership → return `403 No active tenant membership`
4. Embed `tenantId`, `roleId` (resolved to role name), `membershipId` into JWT payload
5. JWT payload shape after change:

```
{
  userId: string,
  tenantId: string,       // from active membership
  membershipId: string,   // new field
  roles: string[],        // role name from role table via membership.role_id
  email: string,
  iat: number,
  exp: number,
  jti: string             // unique token ID — required for blocklist
}
```

**Note:** `jti` (JWT ID) must be added to all issued tokens. The JWT guard must read `jti` from the token and check `blocked_token:{jti}` in Redis before passing auth.

---

## 6. Redis Token Blocklist (New Infrastructure)

**Purpose:** Immediate JWT invalidation on user deactivation without shortening all token lifetimes.

**Behavior:**
- On deactivation: store key `blocked_token:{jti}` in Redis with TTL = remaining seconds of token expiry
- On every authenticated request: `JwtAuthGuard` checks Redis for `blocked_token:{jti}`
- If found: return `401 Token has been revoked`

**Redis client:** Already available in platform (used by BullMQ). No new dependency.

**Key format:** `blocked_token:{jti}` — string value `"1"`, TTL set to remaining token lifetime in seconds.

---

## 7. API Endpoints

### 7.1 User Management — Tenant-Scoped

All require `JwtAuthGuard`. Role-restricted as noted.

| Method | Path | Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/users/invite` | Owner, Admin | Create INVITED membership, send invite email |
| `GET` | `/api/v1/users` | Owner, Admin | List all memberships in tenant (paginated) |
| `GET` | `/api/v1/users/:id` | Owner, Admin | Get single user + membership detail |
| `PATCH` | `/api/v1/users/:id/role` | Owner, Admin | Update role on membership |
| `PATCH` | `/api/v1/users/:id/deactivate` | Owner, Admin | Deactivate + immediate JWT invalidation |
| `PATCH` | `/api/v1/users/:id/reactivate` | Owner, Admin | Reactivate if no other ACTIVE membership |
| `DELETE` | `/api/v1/users/:id` | Owner only | Soft or hard delete based on history check |

### 7.2 Invite Flow — Unauthenticated

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/users/invite/:token` | Validate token; return tenant name, role, inviter name, expiry |
| `POST` | `/api/v1/users/invite/:token/accept` | Match or create user, set password, activate membership, issue JWT |

### 7.3 Self-Service — Any Authenticated User

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/users/me` | Own profile + current membership + role |
| `PATCH` | `/api/v1/users/me` | Update first_name, last_name, phone, avatar_url |
| `PATCH` | `/api/v1/users/me/password` | Change password (requires current_password) |

### 7.4 Superadmin — Platform-Level

All require `SuperAdminGuard`. Route prefix: `/api/v1/admin`

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/v1/admin/tenants` | Create new tenant |
| `GET` | `/api/v1/admin/tenants` | List all tenants (paginated) |
| `GET` | `/api/v1/admin/tenants/:tenantId/users` | List users in a specific tenant |
| `POST` | `/api/v1/admin/tenants/:tenantId/users` | Create user + membership directly (bypasses invite) |
| `PATCH` | `/api/v1/admin/users/:userId/deactivate` | Platform-level deactivation |
| `GET` | `/api/v1/admin/users/:userId` | View user across all tenants |

---

## 8. Request / Response Shapes

### POST `/api/v1/users/invite`
**Request:**
```json
{
  "email": "string (valid email, required)",
  "role_id": "string UUID (required)",
  "first_name": "string (required)",
  "last_name": "string (required)"
}
```
**Response 201:**
```json
{
  "id": "membership-uuid",
  "user_id": "user-uuid",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": { "id": "uuid", "name": "Employee" },
  "status": "INVITED",
  "created_at": "ISO datetime"
}
```
**Errors:** 409 if email already has ACTIVE membership in this tenant | 400 validation

### GET `/api/v1/users`
**Query params:** `page` (default 1), `limit` (default 20, max 100), `status` (INVITED|ACTIVE|INACTIVE), `role_id`
**Response 200:**
```json
{
  "data": [
    {
      "id": "membership-uuid",
      "user_id": "user-uuid",
      "first_name": "string",
      "last_name": "string",
      "email": "string",
      "phone": "string | null",
      "avatar_url": "string | null",
      "role": { "id": "uuid", "name": "string" },
      "status": "ACTIVE",
      "joined_at": "ISO datetime | null",
      "left_at": "ISO datetime | null",
      "invited_by": { "id": "uuid", "first_name": "string", "last_name": "string" }
    }
  ],
  "meta": { "total": 10, "page": 1, "limit": 20, "total_pages": 1 }
}
```

### PATCH `/api/v1/users/:id/deactivate`
**Request body:** `{ "reason": "string (optional)" }`
**Response 200:**
```json
{
  "id": "membership-uuid",
  "status": "INACTIVE",
  "left_at": "ISO datetime"
}
```
**Errors:** 400 if last active Owner | 404 if membership not found in tenant

### PATCH `/api/v1/users/:id/reactivate`
**Response 200:** same shape as deactivate with `status: "ACTIVE"`
**Errors:** 409 if user has ACTIVE membership in another tenant | 404 if not found

### GET `/api/v1/users/invite/:token`
**Response 200:**
```json
{
  "tenant_name": "string",
  "role_name": "string",
  "invited_by_name": "string",
  "email": "string",
  "expires_at": "ISO datetime"
}
```
**Errors:** 404 if token not found | 410 if expired | 409 if already used

### POST `/api/v1/users/invite/:token/accept`
**Request:**
```json
{
  "password": "string (min 8 chars, 1 upper, 1 lower, 1 number, 1 special)"
}
```
**Response 201:**
```json
{
  "access_token": "JWT string",
  "refresh_token": "string",
  "user": { "id": "uuid", "first_name": "string", "last_name": "string", "email": "string" },
  "tenant": { "id": "uuid", "company_name": "string" },
  "role": "string"
}
```

### GET `/api/v1/users/me`
**Response 200:**
```json
{
  "id": "user-uuid",
  "first_name": "string",
  "last_name": "string",
  "email": "string",
  "phone": "string | null",
  "avatar_url": "string | null",
  "membership": {
    "id": "membership-uuid",
    "tenant_id": "string",
    "role": { "id": "uuid", "name": "string" },
    "status": "ACTIVE",
    "joined_at": "ISO datetime"
  }
}
```

---

## 9. RBAC Matrix

| Action | Owner | Admin | Estimator | PM | Bookkeeper | Employee | Read-only |
|---|---|---|---|---|---|---|---|
| Invite user | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| List users | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| View user | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Change role | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ |
| Deactivate | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Reactivate | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Own profile | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

\* Admin cannot change Owner's role.

---

## 10. Audit Log Requirements

Every user management action must call `AuditLoggerService.logTenantChange()`:

| Action | `entity_type` | `action_type` | before/after |
|---|---|---|---|
| User invited | `UserMembership` | `INVITED` | after: `{ email, role, status }` |
| Invite accepted | `UserMembership` | `ACTIVATED` | after: `{ status: ACTIVE, joined_at }` |
| Role changed | `UserMembership` | `ROLE_CHANGE` | before: `{ role }`, after: `{ role }` |
| User deactivated | `UserMembership` | `DEACTIVATED` | before: `{ status: ACTIVE }`, after: `{ status: INACTIVE }` |
| User reactivated | `UserMembership` | `REACTIVATED` | before: `{ status: INACTIVE }`, after: `{ status: ACTIVE }` |
| User deleted (soft) | `User` | `SOFT_DELETED` | before: `{ email }` |
| User deleted (hard) | `User` | `HARD_DELETED` | before: `{ email }` |

---

## 11. Frontend Requirements

### New Route: `app/src/app/(dashboard)/settings/users/page.tsx`
- Accessible only when authenticated user's role is Owner or Admin
- Redirect to `/forbidden` if accessed by other roles

### Page: Users List
**Displays:** table with columns — Name, Email, Role, Status (badge), Joined Date, Actions
**Actions per row:** Change Role (dropdown), Deactivate/Reactivate (toggle), Delete (Owner only)
**Toolbar:** "Invite User" button (top right)

### Modal: Invite User
**Fields:** Email (text input), First Name, Last Name, Role (dropdown — fetched from `/api/v1/rbac/roles`)
**Submit:** POST `/api/v1/users/invite`
**On success:** close modal, refresh list, show success toast

### Confirmation: Deactivate
Dialog: "This will immediately log [Name] out of the platform. Are you sure?"
**On confirm:** PATCH `/api/v1/users/:id/deactivate`

### Blocked State: Reactivate
If the PATCH `/api/v1/users/:id/reactivate` returns 409: display inline message on the row: "User is currently active in another organization."

### Sidebar Navigation
Add "Users" link under the Settings section in the sidebar.
Visibility: only render for roles Owner and Admin (read from auth context).

### Public Page: Invite Accept
**Route:** `app/src/app/(auth)/invite/[token]/page.tsx` (new, in the auth route group)
**On load:** GET `/api/v1/users/invite/:token` — render tenant name, role, inviter name
**Form:** Password + Confirm Password
**On submit:** POST `/api/v1/users/invite/:token/accept` → store JWT → redirect to `/dashboard`
**Error states:** expired token (410), already used (409), invalid token (404)

---

## 12. Email Notifications

Emails are sent via the existing notification/job queue system.

| Trigger | Template | To |
|---|---|---|
| Invite created | `user-invite` | invitee email |
| Password reset | `password-reset` | user email |

Email must include: invite link (`https://app.lead360.app/invite/{raw_token}`), tenant name, inviter name, role name, expiry note.

---

## 13. Dependencies

| Dependency | Direction | Notes |
|---|---|---|
| `auth` module | Modified | Login flow updated to resolve membership |
| `rbac` module | Upstream | `role` table provides role options for invite |
| `audit` module | Downstream | All actions logged via `AuditLoggerService` |
| `admin` module | Extended | Superadmin endpoints added or extended here |
| Redis | Infrastructure | Token blocklist — already available via BullMQ |
| Email / job queue | Downstream | Invite email dispatched as a job |

---

## 14. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Existing `user.tenant_id` references in auth service not fully updated | Login breaks | Backend sprint explicitly targets auth.service.ts as a task |
| `user_role` table not cleanly deprecated — duplicate role assignments | RBAC resolves wrong role | Migration backfills data; `user_role` marked read-only during transition |
| Redis blocklist not checked in all guards | Deactivated users retain access | JwtAuthGuard update is a gate — no other sprint proceeds without it |
| Invite email not sent due to job queue failure | User never receives invite | Resend invite endpoint available; job failure logged |
| Last-owner check race condition (concurrent deactivations) | Tenant loses all owners | Service uses DB-level transaction for the check-and-deactivate operation |

---

## 15. Acceptance Criteria

- [ ] A tenant Owner can invite a user by email; invitee receives an email with a working link
- [ ] Invite link expires after 72 hours; expired link shows clear error
- [ ] Accepting invite creates (or links) user account and activates membership with correct role
- [ ] Owner and Admin can list all users in their tenant; no users from other tenants appear
- [ ] Role change is reflected immediately on next API call; audit log entry created
- [ ] Deactivated user's JWT is rejected within one request cycle (Redis blocklist active)
- [ ] Deactivated user in Tenant A can be invited to Tenant B; new membership activates cleanly
- [ ] User's history in Tenant A remains intact and correctly attributed after moving to Tenant B
- [ ] Tenant A cannot reactivate a user who is ACTIVE in Tenant B
- [ ] Last Owner in a tenant cannot be deactivated or demoted
- [ ] All management actions appear in audit log with correct before/after state
- [ ] Soft delete preserves all FK references; user displays as `[Deactivated User]` in logs
- [ ] Superadmin can create tenants and users directly
- [ ] Frontend Users page is inaccessible to non-Owner/Admin roles (redirects to `/forbidden`)
- [ ] Invite accept page works end-to-end from email link

---

## 16. Out of Scope (Explicitly Deferred)

- Vendor role
- Multi-role per user per tenant
- SSO / OAuth
- Multi-tenant simultaneous access
- Workforce / Employee Profile link (separate Workforce module sprint — depends on this module completing first)