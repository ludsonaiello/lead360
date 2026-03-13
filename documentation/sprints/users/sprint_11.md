# Sprint 11 — API Documentation
**Module:** users
**File:** ./documentation/sprints/users/sprint_11.md
**Type:** Backend — Documentation
**Depends On:** Sprint 8 (all endpoints implemented and tested)
**Gate:** NONE — Documentation is the final sprint. Once written, this module is ready for frontend development.
**Estimated Complexity:** Low

---

## Objective

Generate complete API documentation for the Users module at `api/documentation/users_REST_API.md`. This is a mandatory deliverable — the frontend developer agent reads this file and this file alone to implement the UI. It must document 100% of endpoints with no gaps. Every field, every status code, every error message must be included.

This sprint writes a static markdown file. No code is written. No server is started.

---

## Pre-Sprint Checklist
- [ ] Sprint 8 gate verified (all endpoints implemented and returning correct status codes)
- [ ] Read `src/modules/users/controllers/users.controller.ts` (full file from Sprint 7)
- [ ] Read `src/modules/admin/controllers/tenant-management.controller.ts` (for admin endpoints)
- [ ] Read `src/modules/admin/controllers/user-management.controller.ts` (for admin deactivate/view)
- [ ] Confirm all endpoint paths and HTTP methods are exactly as implemented
- [ ] Check if `api/documentation/` directory exists: `ls /var/www/lead360.app/api/documentation/`

---

## Dev Server

This sprint does NOT require the dev server. Skip the Dev Server block.

If you need to verify an endpoint response shape, start the server briefly:
```bash
cd /var/www/lead360.app/api && npm run start:dev
# Wait for health check to pass, test, then shut down
```

---

## Tasks

### Task 1 — Create API Documentation File

**What:** Create `api/documentation/users_REST_API.md` with the full content below.

Verify and correct every field name, path, and status code against the actual implementation before saving. If any implementation detail differs from what is written below, use the actual implementation values.

---

**File to create:** `/var/www/lead360.app/api/documentation/users_REST_API.md`

---

```markdown
# Users Module — REST API Documentation
**Lead360 Platform**
**Base URL:** `https://api.lead360.app/api/v1`
**Authentication:** All endpoints require `Authorization: Bearer {access_token}` unless marked `[PUBLIC]`
**Module Path:** `api/src/modules/users`

---

## Table of Contents
1. [JWT Payload Shape](#jwt-payload)
2. [User Management — Tenant-Scoped](#user-management)
3. [Invite Flow — Unauthenticated](#invite-flow)
4. [Self-Service — Any Authenticated User](#self-service)
5. [Superadmin — Platform-Level](#superadmin)
6. [Common Error Responses](#errors)
7. [RBAC Matrix](#rbac)

---

## JWT Payload Shape {#jwt-payload}

Every access token issued by the platform carries this payload (decode with jwt.io):

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "tenant_id": "tenant-uuid",
  "membershipId": "membership-uuid",
  "roles": ["Owner"],
  "is_platform_admin": false,
  "jti": "uuid-v4",
  "iat": 1710000000,
  "exp": 1710086400
}
```

**Fields:**
| Field | Type | Description |
|---|---|---|
| `sub` | string UUID | User ID (`user.id`) |
| `email` | string | User email |
| `tenant_id` | string UUID | Tenant ID from active membership |
| `membershipId` | string UUID | Active membership ID (`user_tenant_membership.id`) |
| `roles` | string[] | Single-element array: role name from active membership |
| `is_platform_admin` | boolean | True only for platform superadmins |
| `jti` | string UUID | Unique token ID — used for immediate revocation on deactivation |
| `iat` | number | Issued at (Unix timestamp, seconds) |
| `exp` | number | Expires at (Unix timestamp, seconds) — 24 hours after issuance |

---

## User Management — Tenant-Scoped {#user-management}

All endpoints are tenant-scoped. The `tenant_id` is derived from the JWT — never sent by the client.
Required roles: **Owner** or **Admin** (unless noted).

---

### POST /api/v1/users/invite

**Description:** Invite a new user to the current tenant. Sends an email with a 72-hour invite link.
**Auth:** Required — Owner or Admin
**HTTP:** `201 Created`

**Request Body:**
```json
{
  "email": "jane.doe@example.com",
  "role_id": "uuid-of-role",
  "first_name": "Jane",
  "last_name": "Doe"
}
```

**Field Validation:**
| Field | Type | Rules |
|---|---|---|
| `email` | string | Valid email format. Normalized to lowercase. Required. |
| `role_id` | string UUID | Must reference an existing role. Required. |
| `first_name` | string | Max 100 chars. Required. |
| `last_name` | string | Max 100 chars. Required. |

**Response 201:**
```json
{
  "id": "membership-uuid",
  "user_id": "user-uuid",
  "email": "jane.doe@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "role": { "id": "role-uuid", "name": "Employee" },
  "status": "INVITED",
  "created_at": "2026-03-13T12:00:00.000Z"
}
```

**Errors:**
| Code | When |
|---|---|
| 400 | Validation error (missing field, invalid email, invalid UUID) |
| 401 | Missing or invalid token |
| 403 | Token valid but role is not Owner or Admin |
| 404 | role_id does not reference an existing role |
| 409 | Email already has an ACTIVE membership in this tenant |

---

### GET /api/v1/users

**Description:** List all user memberships in the current tenant (paginated).
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Page size. Max: `100` |
| `status` | string | (all) | Filter by membership status: `INVITED`, `ACTIVE`, `INACTIVE` |
| `role_id` | string UUID | (all) | Filter by role UUID |

**Response 200:**
```json
{
  "data": [
    {
      "id": "membership-uuid",
      "user_id": "user-uuid",
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane.doe@example.com",
      "phone": "+1 (555) 555-5555",
      "avatar_url": null,
      "role": { "id": "role-uuid", "name": "Employee" },
      "status": "ACTIVE",
      "joined_at": "2026-03-01T09:00:00.000Z",
      "left_at": null,
      "invited_by": {
        "id": "inviter-uuid",
        "first_name": "John",
        "last_name": "Smith"
      },
      "created_at": "2026-02-28T10:00:00.000Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

**Notes:**
- Users from other tenants never appear in this response
- Soft-deleted users are excluded
- Ordered by `created_at DESC`

---

### GET /api/v1/users/:id

**Description:** Get a single user membership by its membership UUID.
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`
**Path param:** `:id` = `user_tenant_membership.id` (NOT `user.id`)

**Response 200:** Same shape as a single item from `GET /users` data array.

**Errors:**
| Code | When |
|---|---|
| 404 | Membership ID not found in this tenant |

---

### PATCH /api/v1/users/:id/role

**Description:** Change the role of a user membership.
**Auth:** Required — Owner or Admin (Admin cannot change Owner's role — BR-09)
**HTTP:** `200 OK`

**Request Body:**
```json
{ "role_id": "uuid-of-new-role" }
```

**Response 200:** Same shape as `GET /users/:id` (updated membership).

**Errors:**
| Code | When |
|---|---|
| 403 | Admin attempting to change an Owner's role (BR-09) |
| 404 | Membership not found OR role_id not found |

---

### PATCH /api/v1/users/:id/deactivate

**Description:** Deactivate a user membership. Immediately invalidates their current JWT (they are logged out within one request cycle).
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`

**Request Body (optional):**
```json
{ "reason": "Left the company" }
```

**Response 200:**
```json
{
  "id": "membership-uuid",
  "status": "INACTIVE",
  "left_at": "2026-03-13T14:30:00.000Z"
}
```

**Errors:**
| Code | When |
|---|---|
| 400 | Attempting to deactivate the last active Owner in the tenant (BR-10). Error: `Tenant must have at least one active Owner.` |
| 404 | Membership not found or not currently ACTIVE |

**Important:** After deactivation, any request made with the deactivated user's JWT returns `401 Token has been revoked.` (BR-04, BR-13).

---

### PATCH /api/v1/users/:id/reactivate

**Description:** Reactivate an inactive user membership.
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`

**Request Body:** None required.

**Response 200:**
```json
{
  "id": "membership-uuid",
  "status": "ACTIVE",
  "joined_at": "2026-03-13T15:00:00.000Z"
}
```

**Errors:**
| Code | When |
|---|---|
| 404 | Membership not found or not currently INACTIVE |
| 409 | User is currently ACTIVE in another organization (BR-02, BR-03). Error: `User is currently active in another organization.` |

---

### DELETE /api/v1/users/:id

**Description:** Delete a user membership (and potentially the user record). **Owner role only.**
Soft delete if the user has audit log history (BR-06, BR-07). Hard delete otherwise.
**Auth:** Required — Owner only
**HTTP:** `204 No Content`

**Response 204:** Empty body.

**Behavior:**
- If `audit_log` contains entries with `actor_user_id = user_id`: soft delete only (`user.deleted_at` set, membership set to `INACTIVE`). User displays as `[Deactivated User]` in historical records.
- If no audit history: hard delete (`user` record and all memberships permanently removed).

**Errors:**
| Code | When |
|---|---|
| 403 | Non-Owner role attempting delete |
| 404 | Membership not found |

---

## Invite Flow — Unauthenticated {#invite-flow}

These endpoints do NOT require authentication (`[PUBLIC]`).

---

### GET /api/v1/users/invite/:token `[PUBLIC]`

**Description:** Validate an invite token and return invite metadata for display on the accept page.
**Auth:** None required
**HTTP:** `200 OK`
**Path param:** `:token` = 64-character hex string (from the invite email link)

**Response 200:**
```json
{
  "tenant_name": "Acme Corp",
  "role_name": "Employee",
  "invited_by_name": "John Smith",
  "email": "jane.doe@example.com",
  "expires_at": "2026-03-16T12:00:00.000Z"
}
```

**Errors:**
| Code | When |
|---|---|
| 404 | Token not found / does not match any pending invite |
| 409 | Token already accepted (`invite_accepted_at` is set) |
| 410 | Token expired (past `invite_token_expires_at`) |

---

### POST /api/v1/users/invite/:token/accept `[PUBLIC]`

**Description:** Accept an invite. Sets the user's password, activates the membership, and returns a JWT for immediate login.
**Auth:** None required
**HTTP:** `201 Created`
**Path param:** `:token` = 64-character hex string

**Request Body:**
```json
{ "password": "MyP@ssw0rd1" }
```

**Password Rules:**
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (any non-alphanumeric)

**Response 201:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user-uuid",
    "first_name": "Jane",
    "last_name": "Doe",
    "email": "jane.doe@example.com"
  },
  "tenant": {
    "id": "tenant-uuid",
    "company_name": "Acme Corp"
  },
  "role": "Employee"
}
```

**Errors:**
| Code | When |
|---|---|
| 400 | Password fails complexity rules |
| 404 | Token not found |
| 409 | Token already accepted OR user is currently active in another organization (BR-02) |
| 410 | Token expired |

**Note:** The token is single-use. `invite_accepted_at` is set immediately upon first call, regardless of outcome after that point (BR-05).

---

## Self-Service — Any Authenticated User {#self-service}

Any user with a valid JWT can access these endpoints, regardless of role.

---

### GET /api/v1/users/me

**Description:** Get own profile and current active membership.
**Auth:** Required (any role)
**HTTP:** `200 OK`

**Response 200:**
```json
{
  "id": "user-uuid",
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane.doe@example.com",
  "phone": "+1 (555) 555-5555",
  "avatar_url": null,
  "membership": {
    "id": "membership-uuid",
    "tenant_id": "tenant-uuid",
    "role": { "id": "role-uuid", "name": "Employee" },
    "status": "ACTIVE",
    "joined_at": "2026-03-01T09:00:00.000Z"
  }
}
```

---

### PATCH /api/v1/users/me

**Description:** Update own profile fields.
**Auth:** Required (any role)
**HTTP:** `200 OK`

**Request Body (all fields optional):**
```json
{
  "first_name": "Jane",
  "last_name": "Doe-Smith",
  "phone": "+1 (555) 999-9999",
  "avatar_url": "https://cdn.example.com/avatars/jane.jpg"
}
```

**Response 200:**
```json
{ "message": "Profile updated." }
```

---

### PATCH /api/v1/users/me/password

**Description:** Change own password. Requires current password for verification.
**Auth:** Required (any role)
**HTTP:** `200 OK`

**Request Body:**
```json
{
  "current_password": "OldP@ssw0rd1",
  "new_password": "NewP@ssw0rd1"
}
```

**Response 200:**
```json
{ "message": "Password updated." }
```

**Errors:**
| Code | When |
|---|---|
| 400 | `current_password` is incorrect OR `new_password` fails complexity rules |

---

## Superadmin — Platform-Level {#superadmin}

**Requires:** Platform admin account (`is_platform_admin = true`). Protected by `PlatformAdminGuard`.
**Route prefix:** `/api/v1/admin`

---

### POST /api/v1/admin/tenants

**Description:** Create a new tenant. (Existing endpoint — unchanged by Users module.)
**Auth:** Platform admin only
**HTTP:** `201 Created`

*(Full documentation for this endpoint exists separately — see tenant module docs. No change from Users module sprint.)*

---

### GET /api/v1/admin/tenants

**Description:** List all tenants. (Existing endpoint — unchanged.)
**Auth:** Platform admin only
**HTTP:** `200 OK`

*(See tenant module docs. No change from Users module sprint.)*

---

### GET /api/v1/admin/tenants/:tenantId/users

**Description:** List all user memberships in a specific tenant. Not tenant-scoped from JWT — the tenant is specified in the path.
**Auth:** Platform admin only
**HTTP:** `200 OK`

**Path param:** `:tenantId` = `tenant.id`

**Query Parameters:** Same as `GET /api/v1/users` (page, limit, status, role_id)

**Response 200:** Same envelope as `GET /api/v1/users`:
```json
{
  "data": [
    {
      "id": "membership-uuid",
      "user_id": "user-uuid",
      "first_name": "Jane",
      "last_name": "Doe",
      "email": "jane.doe@example.com",
      "phone": null,
      "role": { "id": "role-uuid", "name": "Employee" },
      "status": "ACTIVE",
      "joined_at": "2026-03-01T09:00:00.000Z",
      "left_at": null,
      "invited_by": null,
      "created_at": "2026-02-28T10:00:00.000Z"
    }
  ],
  "meta": { "total": 3, "page": 1, "limit": 20, "total_pages": 1 }
}
```

**Errors:**
| Code | When |
|---|---|
| 404 | Tenant not found |

---

### POST /api/v1/admin/tenants/:tenantId/users

**Description:** Create a user + active membership directly, bypassing the invite flow.
**Auth:** Platform admin only
**HTTP:** `201 Created`

**Path param:** `:tenantId` = `tenant.id`

**Request Body:**
```json
{
  "email": "newuser@example.com",
  "first_name": "New",
  "last_name": "User",
  "role_id": "uuid-of-role",
  "password": "Initial@Pass1",
  "phone": "+1 (555) 000-0000"
}
```

**Field Validation:**
| Field | Type | Rules |
|---|---|---|
| `email` | string | Valid email format. Required. |
| `first_name` | string | Max 100 chars. Required. |
| `last_name` | string | Max 100 chars. Required. |
| `role_id` | string UUID | Must reference an existing role. Required. |
| `password` | string | Complexity rules: min 8 chars, 1 upper, 1 lower, 1 number, 1 special. Required. |
| `phone` | string | Max 20 chars. Optional. |

**Response 201:**
```json
{
  "id": "membership-uuid",
  "user_id": "user-uuid",
  "email": "newuser@example.com",
  "first_name": "New",
  "last_name": "User",
  "role": { "id": "role-uuid", "name": "Employee" },
  "status": "ACTIVE",
  "joined_at": "2026-03-13T12:00:00.000Z",
  "created_at": "2026-03-13T12:00:00.000Z"
}
```

**Errors:**
| Code | When |
|---|---|
| 404 | Tenant or role not found |
| 409 | Email already has ACTIVE membership in this tenant OR user is currently active in another org |

---

### GET /api/v1/admin/users/:userId

**Description:** View a user's details across all tenants.
**Auth:** Platform admin only
**HTTP:** `200 OK`

*(This endpoint existed before the Users module sprint. Verify implementation returns user record with all memberships.)*

---

### PATCH /api/v1/admin/users/:userId/deactivate

**Description:** Platform-level user deactivation. Sets `is_active = false` on the user and blocks their JWT token.
**Auth:** Platform admin only
**HTTP:** `200 OK`

**Note:** This endpoint may have been implemented as `POST` before the Users module sprint. Use the HTTP method that is actually implemented.

**Important:** After this sprint, the deactivation implementation MUST call `tokenBlocklist.blockUserTokens(userId)` to immediately revoke the user's active JWT (BR-13).

---

## Common Error Responses {#errors}

All errors follow this format:
```json
{
  "statusCode": 404,
  "message": "User membership not found in this organization.",
  "error": "Not Found"
}
```

**Validation errors (400):**
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "role_id must be a UUID"],
  "error": "Bad Request"
}
```

**401 — Token revoked:**
```json
{
  "statusCode": 401,
  "message": "Token has been revoked.",
  "error": "Unauthorized"
}
```

---

## RBAC Matrix {#rbac}

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
| Accept invite | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC |

*Admin cannot change the role of an Owner.

---

## Pagination Notes

All list endpoints return the same envelope:
```json
{
  "data": [],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "total_pages": 5
  }
}
```

Default page size: 20. Maximum: 100.

---

## Membership Status Values

| Status | Description |
|---|---|
| `INVITED` | Invite sent, user has not accepted yet. Membership is pending. |
| `ACTIVE` | User has accepted the invite (or was directly created). Fully authenticated. |
| `INACTIVE` | User was deactivated. Cannot log in. JWT is revoked. |

Only one `ACTIVE` membership can exist per user globally across all tenants.
```

---

### Task 2 — Verify File is Complete

**What:** After creating the file, review it against the actual implemented endpoints:

```bash
# Confirm the file exists
ls -la /var/www/lead360.app/api/documentation/users_REST_API.md

# Count endpoint sections (should be 13+ endpoints documented)
grep -c "^### " /var/www/lead360.app/api/documentation/users_REST_API.md
```

If any endpoint is implemented but not documented, add it. If any field in the actual response differs from what is documented, update the doc.

---

## Acceptance Criteria
- [ ] `api/documentation/users_REST_API.md` exists with all content
- [ ] All 13 user-module endpoints are documented: POST /invite, GET /invite/:token, POST /invite/:token/accept, GET /, GET /:id, PATCH /:id/role, PATCH /:id/deactivate, PATCH /:id/reactivate, DELETE /:id, GET /me, PATCH /me, PATCH /me/password, plus admin endpoints
- [ ] JWT payload shape is documented with all fields including `membershipId` and `jti`
- [ ] Every endpoint documents: HTTP method, path, auth requirement, request body (all fields + types + validation), response body (all fields + types), all error status codes with trigger conditions
- [ ] Password complexity rules are documented
- [ ] Membership status values (INVITED, ACTIVE, INACTIVE) are explained
- [ ] RBAC matrix is present and accurate (matches implementation)
- [ ] No frontend code modified

---

## Gate Marker
**NONE** — This is the final backend sprint for the Users module.

---

## Handoff Notes
- **Backend is complete.** All endpoints are implemented, tested, and documented.
- **Frontend developer:** Read `api/documentation/users_REST_API.md` as the primary reference. Read `documentation/contracts/user-contract.md` for UI requirements.
- **Frontend routes to build:**
  - `app/src/app/(dashboard)/settings/users/page.tsx` — Users list page (Owner/Admin only)
  - `app/src/app/(auth)/invite/[token]/page.tsx` — Public invite acceptance page
  - Add "Users" link to sidebar navigation (visible to Owner/Admin roles only)
- **Known integration points:**
  - Auth context provides `membershipId` and `roles` — use these for RBAC checks on the frontend
  - Deactivation causes immediate 401 on next request — the frontend must handle 401 gracefully (logout + redirect to login)
  - Invite link format: `{FRONTEND_URL}/invite/{64-char-hex-token}`
