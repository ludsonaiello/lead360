# Users Module — REST API Documentation
**Lead360 Platform**
**STATUS: VERIFIED BY DOCUMENTATION AGENT — 2026-03-16**
**Base URL:** `https://api.lead360.app/api/v1`
**Authentication:** All endpoints require `Authorization: Bearer {access_token}` unless marked `[PUBLIC]`
**Module Path:** `api/src/modules/users` (tenant-scoped) + `api/src/modules/admin` (platform-level)

---

## Table of Contents
1. [JWT Payload Shape](#jwt-payload)
2. [User Management — Tenant-Scoped](#user-management)
3. [Invite Flow — Unauthenticated](#invite-flow)
4. [Self-Service — Any Authenticated User](#self-service)
5. [Superadmin — Platform-Level User Management](#superadmin-users)
6. [Superadmin — Tenant-Scoped User Management](#superadmin-tenant-users)
7. [Common Error Responses](#errors)
8. [RBAC Matrix](#rbac)
9. [Supporting Endpoints — Role Listing](#supporting-endpoints--role-listing)
10. [Pagination Notes](#pagination)
11. [Membership Status Values](#membership-status)
12. [Business Rules Reference](#business-rules)
13. [Known Deviations](#deviations)

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
| `tenant_id` | string UUID \| null | Tenant ID from active membership (null for platform admins without a membership) |
| `membershipId` | string UUID \| null | Active membership ID (`user_tenant_membership.id`) — null for platform admins without a membership |
| `roles` | string[] | Single-element array: role name from active membership |
| `is_platform_admin` | boolean | True only for platform superadmins |
| `jti` | string UUID | Unique token ID — used for immediate revocation on deactivation via Redis blocklist |
| `iat` | number | Issued at (Unix timestamp, seconds) |
| `exp` | number | Expires at (Unix timestamp, seconds) — 24 hours after issuance |

**Token Lifetimes:**
- Access token: 24 hours
- Refresh token: 7 days (30 days with `remember_me`)
- Invite token: 72 hours

---

## User Management — Tenant-Scoped {#user-management}

All endpoints are tenant-scoped. The `tenant_id` is derived from the JWT — never sent by the client.
Required roles: **Owner** or **Admin** (unless noted).
**Controller:** `api/src/modules/users/controllers/users.controller.ts`
**Service:** `api/src/modules/users/services/users.service.ts`

---

### POST /api/v1/users/invite

**Description:** Invite a new user to the current tenant. Creates a user record if one doesn't exist (BR-12), creates an INVITED membership, and sends an email with a 72-hour invite link.
**Auth:** Required — Owner or Admin
**HTTP:** `201 Created`
**DTO:** `InviteUserDto`

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
| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | Yes | Valid email format (`@IsEmail()`). Auto-lowercased and trimmed via `@Transform()`. |
| `role_id` | string UUID | Yes | Must be a valid UUID (`@IsUUID()`). Must reference an existing role in the database. |
| `first_name` | string | Yes | Non-empty (`@IsNotEmpty()`). Max 100 chars (`@MaxLength(100)`). |
| `last_name` | string | Yes | Non-empty (`@IsNotEmpty()`). Max 100 chars (`@MaxLength(100)`). |

**Example Request:**
```bash
curl -X POST https://api.lead360.app/api/v1/users/invite \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "first_name": "Jane",
    "last_name": "Doe",
    "role_id": "16c25ba5-887c-48b4-8fb7-ba3327196fbf"
  }'
```

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

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `id` | string UUID | The newly created `user_tenant_membership.id` |
| `user_id` | string UUID | The `user.id` (may be newly created or existing) |
| `email` | string | Email (lowercased) |
| `first_name` | string | First name |
| `last_name` | string | Last name |
| `role` | object | `{ id: string, name: string }` — the assigned role |
| `status` | string | Always `"INVITED"` |
| `created_at` | string (ISO 8601) | Timestamp |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Validation error (missing field, invalid email, invalid UUID) | Array of field-level errors |
| 401 | Missing or invalid token | `Unauthorized` |
| 403 | Token valid but role is not Owner or Admin | `Forbidden resource` |
| 404 | `role_id` does not reference an existing role | `Role not found.` |
| 409 | Email already has an ACTIVE membership in this tenant | `This email already has an active membership in this organization.` |

**Side Effects:**
- If the email doesn't have a `user` record yet, one is created with `is_active: false` and empty `password_hash`
- An invite email is sent via `SendEmailService.sendTemplated()` with template key `user-invite`
- The invite link format is: `{FRONTEND_URL}/invite/{64-char-hex-token}`
- Audit log entry created with `entityType: UserMembership`, `action: created`

---

### GET /api/v1/users

**Description:** List all user memberships in the current tenant (paginated). Soft-deleted users are excluded (BR-07).
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`
**DTO:** `ListUsersQueryDto`

**Query Parameters:**
| Parameter | Type | Default | Rules | Description |
|---|---|---|---|---|
| `page` | integer | `1` | Min: 1 (`@IsInt()`, `@Min(1)`) | Page number |
| `limit` | integer | `20` | Min: 1, Max: 100 (`@IsInt()`, `@Min(1)`, `@Max(100)`) | Page size |
| `status` | enum string | (all) | One of: `INVITED`, `ACTIVE`, `INACTIVE` (`@IsEnum()`) | Filter by membership status |
| `role_id` | string UUID | (all) | Valid UUID (`@IsUUID()`) | Filter by role UUID |

**Example Request:**
```bash
curl "https://api.lead360.app/api/v1/users?page=1&limit=20&status=ACTIVE" \
  -H "Authorization: Bearer <token>"
```

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

**Response `data[]` Item Fields:**
| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string UUID | No | Membership UUID (`user_tenant_membership.id`) |
| `user_id` | string UUID | No | User UUID (`user.id`) |
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `email` | string | No | User's email |
| `phone` | string \| null | Yes | User's phone number |
| `avatar_url` | string \| null | Yes | Always `null` currently (user table has no avatar_url column) |
| `role` | object | No | `{ id: string, name: string }` |
| `status` | string | No | `"INVITED"` \| `"ACTIVE"` \| `"INACTIVE"` |
| `joined_at` | string (ISO 8601) \| null | Yes | When membership became ACTIVE |
| `left_at` | string (ISO 8601) \| null | Yes | When membership became INACTIVE |
| `invited_by` | object \| null | Yes | `{ id: string, first_name: string, last_name: string }` — who sent the invite |
| `created_at` | string (ISO 8601) | No | Membership creation timestamp |

**Response `meta` Fields:**
| Field | Type | Description |
|---|---|---|
| `total` | number | Total matching records |
| `page` | number | Current page |
| `limit` | number | Page size |
| `total_pages` | number | Calculated as `ceil(total / limit)` |

**Notes:**
- Users from other tenants never appear in this response
- Soft-deleted users are excluded via `user.deleted_at = null` filter
- Ordered by `created_at DESC`

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 401 | Missing or invalid token | `Unauthorized` |
| 403 | Insufficient role (not Owner or Admin) | `Forbidden resource` |

---

### GET /api/v1/users/:id

**Description:** Get a single user membership by its membership UUID.
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`
**Path param:** `:id` = `user_tenant_membership.id` (NOT `user.id`)

**Example Request:**
```bash
curl https://api.lead360.app/api/v1/users/63fc200b-e2d3-4ad2-9b0f-b0e63cfb4235 \
  -H "Authorization: Bearer <token>"
```

**Response 200:** Same shape as a single item from `GET /users` data array (see field table above).

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 401 | Missing or invalid token | `Unauthorized` |
| 403 | Insufficient role (not Owner or Admin) | `Forbidden resource` |
| 404 | Membership ID not found in this tenant | `User membership not found in this organization.` |

---

### PATCH /api/v1/users/:id/role

**Description:** Change the role of a user membership.
**Auth:** Required — Owner or Admin (Admin cannot change Owner's role — BR-09)
**HTTP:** `200 OK`
**Path param:** `:id` = `user_tenant_membership.id`
**DTO:** `UpdateUserRoleDto`

**Request Body:**
```json
{ "role_id": "uuid-of-new-role" }
```

**Field Validation:**
| Field | Type | Required | Rules |
|---|---|---|---|
| `role_id` | string UUID | Yes | Must be a valid UUID (`@IsUUID()`). Must reference an existing role. |

**Example Request:**
```bash
curl -X PATCH https://api.lead360.app/api/v1/users/63fc200b-e2d3-4ad2-9b0f-b0e63cfb4235/role \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"role_id": "16c25ba5-887c-48b4-8fb7-ba3327196fbf"}'
```

**Response 200:** Same shape as `GET /users/:id` (updated membership with new role).

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 401 | Missing or invalid token | `Unauthorized` |
| 403 | Admin attempting to change an Owner's role (BR-09) | `Only an Owner or platform administrator can change the role of an Owner.` |
| 404 | Membership not found | `Membership not found.` |
| 404 | `role_id` not found | `Role not found.` |

**Side Effects:**
- Role change is audit-logged with `entityType: UserMembership`, `action: updated`, and before/after state containing old and new role names (BR-08)

---

### PATCH /api/v1/users/:id/deactivate

**Description:** Deactivate a user membership. Immediately invalidates their current JWT via Redis blocklist (they are logged out within one request cycle).
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`
**Path param:** `:id` = `user_tenant_membership.id`
**DTO:** `DeactivateUserDto`

**Request Body (optional):**
```json
{ "reason": "Left the company" }
```

**Field Validation:**
| Field | Type | Required | Rules |
|---|---|---|---|
| `reason` | string | No | Max 500 chars (`@MaxLength(500)`). Logged in audit trail description. |

**Example Request:**
```bash
curl -X PATCH https://api.lead360.app/api/v1/users/63fc200b-e2d3-4ad2-9b0f-b0e63cfb4235/deactivate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Employee terminated"}'
```

**Response 200:**
```json
{
  "id": "membership-uuid",
  "status": "INACTIVE",
  "left_at": "2026-03-13T14:30:00.000Z"
}
```

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `id` | string UUID | Membership UUID |
| `status` | string | Always `"INACTIVE"` |
| `left_at` | string (ISO 8601) | Deactivation timestamp |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Attempting to deactivate the last active Owner (BR-10) | `Tenant must have at least one active Owner.` |
| 401 | Missing or invalid token | `Unauthorized` |
| 403 | Insufficient role (not Owner or Admin) | `Forbidden resource` |
| 404 | Membership not found or not currently ACTIVE | `Active membership not found.` |

**Side Effects (in this order):**
1. Inside a DB transaction: membership status set to `INACTIVE`, `left_at` set to now; user `is_active` set to `false`
2. After transaction: `TokenBlocklistService.blockUserTokens(userId)` pushes active JWT `jti` to Redis blocklist
3. Audit log entry created with before/after status and optional reason in description
4. Subsequent requests from the deactivated user return `401 Token has been revoked.`

**Important:** The last-owner check (BR-10) runs inside the same transaction as the deactivation to prevent TOCTOU race conditions.

---

### PATCH /api/v1/users/:id/reactivate

**Description:** Reactivate an inactive user membership.
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`
**Path param:** `:id` = `user_tenant_membership.id`

**Request Body:** None required.

**Example Request:**
```bash
curl -X PATCH https://api.lead360.app/api/v1/users/63fc200b-e2d3-4ad2-9b0f-b0e63cfb4235/reactivate \
  -H "Authorization: Bearer <token>"
```

**Response 200:**
```json
{
  "id": "membership-uuid",
  "status": "ACTIVE",
  "joined_at": "2026-03-13T15:00:00.000Z"
}
```

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `id` | string UUID | Membership UUID |
| `status` | string | Always `"ACTIVE"` |
| `joined_at` | string (ISO 8601) | Reactivation timestamp |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 401 | Missing or invalid token | `Unauthorized` |
| 403 | Insufficient role (not Owner or Admin) | `Forbidden resource` |
| 404 | Membership not found or not currently INACTIVE | `Inactive membership not found.` |
| 409 | User is currently ACTIVE in another organization (BR-02, BR-03) | `User is currently active in another organization.` |

**Side Effects:**
- Inside a DB transaction: membership `status` set to `ACTIVE`, `joined_at` set to now, `left_at` set to `null`; user `is_active` set to `true`
- Audit log entry created with before/after status

---

### DELETE /api/v1/users/:id

**Description:** Delete a user membership (and potentially the user record). **Owner role only.**
Soft delete if the user has audit log history or FK references (BR-06, BR-07). Hard delete otherwise.
**Auth:** Required — Owner only
**HTTP:** `204 No Content`
**Path param:** `:id` = `user_tenant_membership.id`

**Example Request:**
```bash
curl -X DELETE https://api.lead360.app/api/v1/users/63fc200b-e2d3-4ad2-9b0f-b0e63cfb4235 \
  -H "Authorization: Bearer <token>"
```

**Response 204:** Empty body.

**Behavior (decision tree):**
1. First checks `audit_log` for entries where `actor_user_id = user_id`
2. If audit log entries exist → **soft delete**: sets `user.deleted_at`, `user.is_active = false`, membership `status = INACTIVE`, `left_at = now`
3. If no audit log entries → attempts **hard delete** inside a transaction: deletes all memberships, then deletes user record
4. If hard delete fails with Prisma error `P2003` (FK constraint) or `P2014` → falls back to **soft delete** (same as step 2)

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 401 | Missing or invalid token | `Unauthorized` |
| 403 | Non-Owner role attempting delete | `Forbidden resource` |
| 404 | Membership not found | `Membership not found.` |

**Side Effects:**
- Audit log entry created with `entityType: User`, `action: deleted`
- Soft-deleted users display as `[Deactivated User]` in historical records (frontend convention)
- Soft-deleted users are excluded from `GET /users` list queries (BR-07)

---

## Invite Flow — Unauthenticated {#invite-flow}

These endpoints do NOT require authentication (`[PUBLIC]`).
Decorated with `@Public()` in the controller — JwtAuthGuard skips authentication.

---

### GET /api/v1/users/invite/:token `[PUBLIC]`

**Description:** Validate an invite token and return invite metadata for display on the accept page.
**Auth:** None required
**HTTP:** `200 OK`
**Path param:** `:token` = 64-character hex string (from the invite email link)

**How the token works:**
- The raw token is a 64-char hex string generated via `randomBytes(32).toString('hex')`
- Before database lookup, the raw token is hashed via `SHA-256` → 64-char hex hash
- The database stores only the hash in `user_tenant_membership.invite_token_hash` (has `@unique` constraint)
- Lookup is O(1) via the unique index

**Example Request:**
```bash
curl https://api.lead360.app/api/v1/users/invite/a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2
```

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

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `tenant_name` | string | Company name of the tenant (`tenant.company_name`) |
| `role_name` | string | Name of the assigned role (`role.name`) |
| `invited_by_name` | string | Full name of the inviter (`"FirstName LastName"`) or `"Unknown"` if inviter record not found |
| `email` | string | Email address the invite was sent to |
| `expires_at` | string (ISO 8601) | Token expiration timestamp (72 hours from creation) |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 404 | Token hash not found in database | `Invalid invite token.` |
| 409 | Token already accepted (`invite_accepted_at` is set). Checked BEFORE expiry. | `This invite link has already been used.` |
| 410 | Token expired (past `invite_token_expires_at`) | `This invite link has expired.` |

**Error Priority:** Already-used (409) is checked before expired (410) — so a used+expired token returns 409, not 410.

---

### POST /api/v1/users/invite/:token/accept `[PUBLIC]`

**Description:** Accept an invite. Sets the user's password, activates the membership, and returns a JWT pair for immediate login.
**Auth:** None required
**HTTP:** `201 Created`
**Path param:** `:token` = 64-character hex string
**DTO:** `AcceptInviteDto`

**Request Body:**
```json
{ "password": "MyP@ssw0rd1" }
```

**Password Complexity Rules (all must be satisfied):**
- Minimum 8 characters
- At least 1 uppercase letter (A-Z)
- At least 1 lowercase letter (a-z)
- At least 1 number (0-9)
- At least 1 special character (any non-alphanumeric character)

**Regex used for validation:**
```
^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$
```

**Field Validation:**
| Field | Type | Required | Rules |
|---|---|---|---|
| `password` | string | Yes | `@IsString()`, `@MinLength(8)`, `@Matches()` with regex above |

**Example Request:**
```bash
curl -X POST https://api.lead360.app/api/v1/users/invite/a1b2c3d4e5f6.../accept \
  -H "Content-Type: application/json" \
  -d '{"password": "SecurePass123!"}'
```

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

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `access_token` | string | JWT access token (24h expiry) — use for `Authorization: Bearer` |
| `refresh_token` | string | JWT refresh token (7d expiry) — use with `POST /auth/refresh` |
| `user` | object | `{ id, first_name, last_name, email }` |
| `user.id` | string UUID | User ID |
| `user.first_name` | string | User's first name |
| `user.last_name` | string | User's last name |
| `user.email` | string | User's email |
| `tenant` | object | `{ id, company_name }` |
| `tenant.id` | string UUID | Tenant ID |
| `tenant.company_name` | string | Company name |
| `role` | string | Role name (e.g., `"Employee"`, `"Admin"`, `"Owner"`) |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Password fails complexity rules | `Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character` |
| 404 | Token not found | `Invalid invite token.` |
| 409 | Token already accepted | `This invite link has already been used.` |
| 409 | User is currently active in another organization (BR-02) | `User is currently active in another organization.` |
| 410 | Token expired | `This invite link has expired.` |

**Side Effects (in order):**
1. Validates token hash, checks already-used (409 before 410), checks expiry
2. Checks BR-02: no other ACTIVE membership exists for this user
3. Hashes password with bcrypt (10 rounds)
4. Inside a DB transaction:
   - Membership: `invite_accepted_at` set, `status = ACTIVE`, `joined_at` set, `invite_token_hash` cleared to `null`
   - User: `password_hash` set, `is_active = true`, `email_verified = true`, `email_verified_at` set
5. Audit log entry created
6. JWT pair issued via `AuthService.issueTokensForMembership()`

**Important:** The token is single-use. On successful acceptance, `invite_token_hash` is set to `null` — the token can never be looked up again.

---

## Self-Service — Any Authenticated User {#self-service}

Any user with a valid JWT can access these endpoints, regardless of role.

---

### GET /api/v1/users/me

**Description:** Get own profile and current active membership.
**Auth:** Required (any role)
**HTTP:** `200 OK`

**Example Request:**
```bash
curl https://api.lead360.app/api/v1/users/me \
  -H "Authorization: Bearer <token>"
```

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

**Response Fields:**
| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string UUID | No | User ID |
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `email` | string | No | User's email |
| `phone` | string \| null | Yes | User's phone number |
| `avatar_url` | string \| null | Yes | Always `null` currently |
| `membership` | object | No | Active membership details |
| `membership.id` | string UUID | No | Membership ID |
| `membership.tenant_id` | string UUID | No | Tenant ID |
| `membership.role` | object | No | `{ id: string, name: string }` |
| `membership.status` | string | No | Membership status (typically `"ACTIVE"`) |
| `membership.joined_at` | string (ISO 8601) \| null | Yes | When membership became active |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Platform admin without an active membership | `No active membership found. Platform admins without a membership cannot access this endpoint.` |
| 401 | Missing or invalid JWT | `Unauthorized` |

---

### PATCH /api/v1/users/me

**Description:** Update own profile fields.
**Auth:** Required (any role)
**HTTP:** `200 OK`
**DTO:** `UpdateMeDto`

**Request Body (all fields optional):**
```json
{
  "first_name": "Jane",
  "last_name": "Doe-Smith",
  "phone": "+1 (555) 999-9999"
}
```

**Field Validation:**
| Field | Type | Required | Rules | Actually Saved |
|---|---|---|---|---|
| `first_name` | string | No | Max 100 chars (`@MaxLength(100)`) | Yes |
| `last_name` | string | No | Max 100 chars (`@MaxLength(100)`) | Yes |
| `phone` | string | No | Max 20 chars (`@MaxLength(20)`) | Yes |
| `avatar_url` | string | No | Must be a valid URL (`@IsUrl()`) | **No** — accepted by DTO but NOT persisted by the service (see [Deviations](#deviations)) |

**Example Request:**
```bash
curl -X PATCH https://api.lead360.app/api/v1/users/me \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "Updated Name", "phone": "+1 (555) 111-2222"}'
```

**Response 200:**
```json
{ "message": "Profile updated." }
```

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Validation error (e.g., invalid URL for avatar_url) | Array of field-level errors |
| 401 | Missing or invalid JWT | `Unauthorized` |

---

### PATCH /api/v1/users/me/password

**Description:** Change own password. Requires current password for verification.
**Auth:** Required (any role)
**HTTP:** `200 OK`
**DTO:** `ChangePasswordDto`

**Request Body:**
```json
{
  "current_password": "OldP@ssw0rd1",
  "new_password": "NewP@ssw0rd1"
}
```

**Field Validation:**
| Field | Type | Required | Rules |
|---|---|---|---|
| `current_password` | string | Yes | `@IsString()`, `@MinLength(1)`. Used for verification against stored bcrypt hash. |
| `new_password` | string | Yes | `@IsString()`, `@MinLength(8)`, `@Matches()` with regex: `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$` |

**Example Request:**
```bash
curl -X PATCH https://api.lead360.app/api/v1/users/me/password \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"current_password": "OldPass123!", "new_password": "NewPass456!"}'
```

**Response 200:**
```json
{ "message": "Password updated." }
```

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | `current_password` is incorrect | `Current password is incorrect.` |
| 400 | `new_password` fails complexity rules | `Password must contain at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character` |
| 401 | Missing or invalid JWT | `Unauthorized` |
| 404 | User not found (edge case — user record deleted between auth and execution) | `User not found.` |

---

## Superadmin — Platform-Level User Management {#superadmin-users}

**Requires:** Platform admin account (`is_platform_admin = true`). Protected by `PlatformAdminGuard`.
**Route prefix:** `/api/v1/admin/users`
**Controller:** `api/src/modules/admin/controllers/user-management.controller.ts`

These endpoints operate on `user.id` (NOT `user_tenant_membership.id`) and work cross-tenant.

---

### GET /api/v1/admin/users

**Description:** List all users across all tenants with filters and pagination.
**Auth:** Platform admin only
**HTTP:** `200 OK`

**Query Parameters:**
| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | `1` | Page number |
| `limit` | integer | `20` | Page size (max: 100) |
| `tenant_id` | string UUID | (all) | Filter by tenant — finds users with ACTIVE membership in this tenant |
| `role` | string | (all) | Filter by role name (matches via `user_role` table) |
| `status` | string | (exclude deleted) | One of: `active`, `inactive`, `deleted`. Default excludes deleted users. |
| `last_login_from` | string (ISO date) | (none) | Filter: last login >= this date |
| `last_login_to` | string (ISO date) | (none) | Filter: last login <= this date |
| `search` | string | (none) | Search in email, first_name, or last_name (contains match) |

**Example Request:**
```bash
curl "https://api.lead360.app/api/v1/admin/users?page=1&limit=20&status=active&search=john" \
  -H "Authorization: Bearer <platform_admin_token>"
```

**Response 200:**
```json
{
  "data": [
    {
      "id": "user-uuid",
      "email": "john@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "is_active": true,
      "is_platform_admin": false,
      "tenant_id": "tenant-uuid",
      "tenant_subdomain": "acme-corp",
      "tenant_company_name": "Acme Corp",
      "roles": ["Owner"],
      "last_login_at": "2026-03-16T01:30:00.000Z",
      "created_at": "2026-01-05T18:52:29.539Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "total_pages": 3
  }
}
```

**Response `data[]` Item Fields:**
| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string UUID | No | User ID (`user.id`) |
| `email` | string | No | User's email |
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `is_active` | boolean | No | Whether user is active |
| `is_platform_admin` | boolean | No | Whether user is a platform admin |
| `tenant_id` | string UUID \| undefined | Yes | Tenant ID from active membership (absent if no active membership) |
| `tenant_subdomain` | string \| undefined | Yes | Tenant subdomain (absent if no active membership) |
| `tenant_company_name` | string \| undefined | Yes | Tenant company name (absent if no active membership) |
| `roles` | string[] | No | Array of role names from `user_role` table (may be empty) |
| `last_login_at` | string (ISO 8601) \| null | Yes | Last login timestamp |
| `created_at` | string (ISO 8601) | No | User creation timestamp |

**Note:** This endpoint uses `pagination` (not `meta`) as the pagination key — different from tenant-scoped endpoints.

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Not a platform admin | `Forbidden resource` |

---

### GET /api/v1/admin/users/:id

**Description:** View a user's details including active membership, tenant, and roles.
**Auth:** Platform admin only
**HTTP:** `200 OK`
**Path param:** `:id` = `user.id` (validated as UUID via `ParseUUIDPipe`)

**Example Request:**
```bash
curl https://api.lead360.app/api/v1/admin/users/32cd6d0d-1823-4033-8aa8-9513dda9cf59 \
  -H "Authorization: Bearer <platform_admin_token>"
```

**Response 200:**
```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+1 (555) 555-5555",
  "is_active": true,
  "is_platform_admin": false,
  "email_verified": true,
  "tenant_id": "tenant-uuid",
  "tenant": {
    "id": "tenant-uuid",
    "subdomain": "acme-corp",
    "company_name": "Acme Corp"
  },
  "roles": [
    {
      "id": "role-uuid",
      "name": "Owner",
      "description": "Full access to all features",
      "assigned_at": "2026-01-05T18:52:29.539Z"
    }
  ],
  "last_login_at": "2026-03-16T01:30:00.000Z",
  "created_at": "2026-01-05T18:52:29.539Z",
  "updated_at": "2026-03-16T01:30:00.000Z"
}
```

**Response Fields:**
| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string UUID | No | User ID |
| `email` | string | No | User's email |
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `phone` | string \| null | Yes | User's phone |
| `is_active` | boolean | No | Active status |
| `is_platform_admin` | boolean | No | Platform admin flag |
| `email_verified` | boolean | No | Email verification status |
| `tenant_id` | string UUID \| undefined | Yes | From active membership's tenant (absent if no active membership) |
| `tenant` | object \| null | Yes | `{ id, subdomain, company_name }` from active membership (null if none) |
| `roles` | array[object] | No | Array of `{ id, name, description, assigned_at }` from `user_role` table |
| `roles[].id` | string UUID | No | Role ID |
| `roles[].name` | string | No | Role name (e.g., `"Owner"`, `"Admin"`, `"Employee"`) |
| `roles[].description` | string \| null | Yes | Role description |
| `roles[].assigned_at` | string (ISO 8601) | No | When the role was assigned (`user_role.created_at`) |
| `last_login_at` | string (ISO 8601) \| null | Yes | Last login timestamp |
| `created_at` | string (ISO 8601) | No | Account creation timestamp |
| `updated_at` | string (ISO 8601) | No | Last update timestamp |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Invalid UUID format | `Validation failed (uuid is expected)` |
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Not a platform admin | `Forbidden resource` |
| 404 | User not found | `User not found` |

---

### POST /api/v1/admin/users/:id/reset-password

**Description:** Force a password reset for a user. Sends a password reset email via the auth module's existing forgot-password flow.
**Auth:** Platform admin only
**HTTP:** `200 OK`
**Path param:** `:id` = `user.id` (validated as UUID via `ParseUUIDPipe`)

**Request Body:** None required.

**Example Request:**
```bash
curl -X POST https://api.lead360.app/api/v1/admin/users/32cd6d0d-1823-4033-8aa8-9513dda9cf59/reset-password \
  -H "Authorization: Bearer <platform_admin_token>"
```

**Response 200:**
```json
{
  "message": "Password reset email sent successfully",
  "email": "user@example.com"
}
```

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `message` | string | Confirmation message |
| `email` | string | The email address the reset link was sent to |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Invalid UUID format | `Validation failed (uuid is expected)` |
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Not a platform admin | `Forbidden resource` |
| 404 | User not found | `User not found` |

**Side Effects:**
- Triggers `AuthService.forgotPassword()` which generates a password reset token (1h expiry) and sends a reset email
- Audit log entry created

---

### POST /api/v1/admin/users/:id/deactivate

### PATCH /api/v1/admin/users/:id/deactivate

**Description:** Platform-level user deactivation. Sets `is_active = false` on the user and blocks their JWT token. Available as both POST (legacy) and PATCH (contract) — both call the same internal logic.
**Auth:** Platform admin only
**HTTP:** `200 OK`
**Path param:** `:id` = `user.id` (validated as UUID via `ParseUUIDPipe`)

**Request Body:** None required.

**Example Request:**
```bash
curl -X PATCH "https://api.lead360.app/api/v1/admin/users/32cd6d0d-1823-4033-8aa8-9513dda9cf59/deactivate" \
  -H "Authorization: Bearer <platform_admin_token>"
```

**Response 200:**
```json
{
  "message": "User deactivated successfully",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "is_active": false
  }
}
```

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `message` | string | Confirmation message |
| `user` | object | Updated user summary |
| `user.id` | string UUID | User ID |
| `user.email` | string | User's email |
| `user.is_active` | boolean | Always `false` |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Invalid UUID format | `Validation failed (uuid is expected)` |
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Not a platform admin | `Forbidden resource` |
| 404 | User not found | `User not found` |
| 409 | User is already inactive | `User is already inactive` |

**Side Effects (in order):**
1. `user.is_active` set to `false`
2. Active JWT token pushed to Redis blocklist via `TokenBlocklistService.blockUserTokens()` (BR-13)
3. All refresh tokens deleted from database (`refresh_token` table)
4. Audit log entry created with before/after state

---

### POST /api/v1/admin/users/:id/activate

**Description:** Platform-level user activation. Sets `is_active = true` on the user.
**Auth:** Platform admin only
**HTTP:** `200 OK`
**Path param:** `:id` = `user.id` (validated as UUID via `ParseUUIDPipe`)

**Request Body:** None required.

**Example Request:**
```bash
curl -X POST "https://api.lead360.app/api/v1/admin/users/32cd6d0d-1823-4033-8aa8-9513dda9cf59/activate" \
  -H "Authorization: Bearer <platform_admin_token>"
```

**Response 200:**
```json
{
  "message": "User activated successfully",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "is_active": true
  }
}
```

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `message` | string | Confirmation message |
| `user` | object | Updated user summary |
| `user.id` | string UUID | User ID |
| `user.email` | string | User's email |
| `user.is_active` | boolean | Always `true` |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Invalid UUID format | `Validation failed (uuid is expected)` |
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Not a platform admin | `Forbidden resource` |
| 404 | User not found | `User not found` |
| 409 | User is already active | `User is already active` |

**Side Effects:**
- Audit log entry created with before/after state

---

### DELETE /api/v1/admin/users/:id

**Description:** Platform-level user soft delete. Sets `deleted_at` timestamp and deactivates the user.
**Auth:** Platform admin only
**HTTP:** `200 OK` (NOTE: returns 200, not 204)
**Path param:** `:id` = `user.id` (validated as UUID via `ParseUUIDPipe`)

**Request Body:** None required.

**Example Request:**
```bash
curl -X DELETE "https://api.lead360.app/api/v1/admin/users/32cd6d0d-1823-4033-8aa8-9513dda9cf59" \
  -H "Authorization: Bearer <platform_admin_token>"
```

**Response 200:**
```json
{
  "message": "User deleted successfully",
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "deleted_at": "2026-03-16T14:00:00.000Z"
  }
}
```

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `message` | string | Confirmation message |
| `user` | object | Deleted user summary |
| `user.id` | string UUID | User ID |
| `user.email` | string | User's email |
| `user.deleted_at` | string (ISO 8601) | Soft deletion timestamp |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Invalid UUID format | `Validation failed (uuid is expected)` |
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Not a platform admin | `Forbidden resource` |
| 404 | User not found | `User not found` |
| 409 | User is already deleted | `User is already deleted` |

**Side Effects:**
- `user.deleted_at` set to current timestamp
- `user.is_active` set to `false`
- All refresh tokens deleted from database
- Audit log entry created

---

## Superadmin — Tenant-Scoped User Management {#superadmin-tenant-users}

**Requires:** Platform admin account (`is_platform_admin = true`). Protected by `PlatformAdminGuard`.
**Route prefix:** `/api/v1/admin/tenants`
**Controller:** `api/src/modules/admin/controllers/tenant-management.controller.ts`

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
**DTO:** `ListUsersQueryDto` (same as tenant-scoped `GET /users`)

**Query Parameters:** Same as `GET /api/v1/users` (page, limit, status, role_id) — see field table in that section.

**Example Request:**
```bash
curl "https://api.lead360.app/api/v1/admin/tenants/13c2dea4-64e0-4f8a-9c3b-abc123/users?page=1&limit=20&status=ACTIVE" \
  -H "Authorization: Bearer <platform_admin_token>"
```

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

**Response `data[]` Item Fields:**
| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string UUID | No | Membership UUID |
| `user_id` | string UUID | No | User UUID |
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `email` | string | No | User's email |
| `phone` | string \| null | Yes | User's phone |
| `role` | object | No | `{ id: string, name: string }` |
| `status` | string | No | `"INVITED"` \| `"ACTIVE"` \| `"INACTIVE"` |
| `joined_at` | string (ISO 8601) \| null | Yes | When membership became active |
| `left_at` | string (ISO 8601) \| null | Yes | When membership became inactive |
| `invited_by` | object \| null | Yes | `{ id, first_name, last_name }` |
| `created_at` | string (ISO 8601) | No | Membership creation timestamp |

**Note:** Unlike tenant-scoped `GET /users`, this endpoint does NOT include `avatar_url` in the response and does NOT filter out soft-deleted users.

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Not a platform admin | `Forbidden resource` |
| 404 | Tenant not found | `Tenant not found.` |

---

### POST /api/v1/admin/tenants/:tenantId/users

**Description:** Create a user + active membership directly, bypassing the invite flow. If the email already exists as a user, only the membership is created. Enforces BR-02 (single active membership).
**Auth:** Platform admin only
**HTTP:** `201 Created`
**Path param:** `:tenantId` = `tenant.id`
**DTO:** `CreateUserAdminDto`

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
| Field | Type | Required | Rules |
|---|---|---|---|
| `email` | string | Yes | Valid email format (`@IsEmail()`). Auto-lowercased and trimmed via `@Transform()`. |
| `first_name` | string | Yes | Non-empty (`@IsNotEmpty()`). Max 100 chars (`@MaxLength(100)`). |
| `last_name` | string | Yes | Non-empty (`@IsNotEmpty()`). Max 100 chars (`@MaxLength(100)`). |
| `role_id` | string UUID | Yes | Valid UUID (`@IsUUID()`). Must reference an existing role. |
| `password` | string | Yes | Min 8 chars (`@MinLength(8)`). Must match complexity regex: `^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$`. Only used if user doesn't already exist. |
| `phone` | string | No | Max 20 chars (`@MaxLength(20)`). |

**Example Request:**
```bash
curl -X POST "https://api.lead360.app/api/v1/admin/tenants/13c2dea4-64e0-4f8a-9c3b-abc123/users" \
  -H "Authorization: Bearer <platform_admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "first_name": "Admin",
    "last_name": "Test",
    "role_id": "6719529c-16f9-404a-87be-2d9e1c0838bd",
    "password": "TestP@ss123"
  }'
```

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

**Response Fields:**
| Field | Type | Description |
|---|---|---|
| `id` | string UUID | Membership UUID |
| `user_id` | string UUID | User UUID (may be newly created or existing) |
| `email` | string | User's email |
| `first_name` | string | User's first name |
| `last_name` | string | User's last name |
| `role` | object | `{ id: string, name: string }` |
| `status` | string | Always `"ACTIVE"` |
| `joined_at` | string (ISO 8601) \| null | When membership was activated |
| `created_at` | string (ISO 8601) | Membership creation timestamp |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 400 | Validation error (missing fields, password complexity) | Array of field-level errors |
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Not a platform admin | `Forbidden resource` |
| 404 | Tenant not found | `Tenant not found.` |
| 404 | Role not found | `Role not found.` |
| 409 | Email already has ACTIVE membership in this tenant | `This email already has an active membership in this tenant.` |
| 409 | User is currently active in another org (BR-02) | `User is currently active in another organization.` |

**Side Effects:**
- If the email doesn't have a `user` record yet, one is created with `is_active: true`, `email_verified: true`, and the provided password (bcrypt hashed)
- If the email already has a `user` record, the existing user is linked to a new ACTIVE membership (password not changed)
- Audit log entry created

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

**Validation errors (400) — array of messages:**
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "role_id must be a UUID"],
  "error": "Bad Request"
}
```

**401 — Token revoked (after deactivation):**
```json
{
  "statusCode": 401,
  "message": "Token has been revoked.",
  "error": "Unauthorized"
}
```

**401 — Missing or invalid token:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized"
}
```

**403 — Insufficient role:**
```json
{
  "statusCode": 403,
  "message": "Forbidden resource",
  "error": "Forbidden"
}
```

---

## RBAC Matrix {#rbac}

### Tenant-Scoped Endpoints (`/api/v1/users/*`)

| Action | Owner | Admin | Estimator | PM | Bookkeeper | Employee | Read-only |
|---|---|---|---|---|---|---|---|
| Invite user | Yes | Yes | No | No | No | No | No |
| List users | Yes | Yes | No | No | No | No | No |
| View user | Yes | Yes | No | No | No | No | No |
| Change role | Yes | Yes* | No | No | No | No | No |
| Deactivate | Yes | Yes | No | No | No | No | No |
| Reactivate | Yes | Yes | No | No | No | No | No |
| Delete | Yes | No | No | No | No | No | No |
| Own profile (GET/PATCH /me) | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Change password (/me/password) | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Accept invite | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC |
| Validate invite | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC | PUBLIC |

*Admin cannot change the role of an Owner (BR-09).

### Platform-Level Endpoints (`/api/v1/admin/*`)

| Action | Platform Admin | Any Other Role |
|---|---|---|
| List all users | Yes | No |
| View user details | Yes | No |
| Force password reset | Yes | No |
| Deactivate user | Yes | No |
| Activate user | Yes | No |
| Delete user | Yes | No |
| List tenant users | Yes | No |
| Create user in tenant | Yes | No |

---

## Supporting Endpoints — Role Listing

The invite and role-change flows require a list of available roles. This endpoint provides it.

### GET /api/v1/rbac/roles

**Description:** List all active roles for use in dropdowns (invite user, change role).
**Auth:** Required — Owner or Admin
**HTTP:** `200 OK`
**Controller:** `api/src/modules/rbac/controllers/roles.controller.ts`

**Example Request:**
```bash
curl https://api.lead360.app/api/v1/rbac/roles \
  -H "Authorization: Bearer <token>"
```

**Response 200:**
```json
[
  { "id": "uuid", "name": "Admin", "description": "Administrative access to all features except billing and subscription" },
  { "id": "uuid", "name": "Bookkeeper", "description": "Manage all financial operations including invoices, payments, and expenses" },
  { "id": "uuid", "name": "Employee", "description": "Limited access for field workers - clock in/out and view assigned tasks" },
  { "id": "uuid", "name": "Estimator", "description": "Create and manage quotes, estimates, and service requests" },
  { "id": "uuid", "name": "Owner", "description": "Full access to all features including billing and subscription management" },
  { "id": "uuid", "name": "Project Manager", "description": "Manage active projects, tasks, and schedules" },
  { "id": "uuid", "name": "Read-only", "description": "View-only access for stakeholders, investors, or auditors" }
]
```

**Response Array Item Fields:**
| Field | Type | Nullable | Description |
|---|---|---|---|
| `id` | string UUID | No | Role ID — use this as `role_id` in invite and role-change |
| `name` | string | No | Role display name |
| `description` | string \| null | Yes | Role description |

**Errors:**
| Code | Condition | Error Message |
|---|---|---|
| 401 | Missing or invalid JWT | `Unauthorized` |
| 403 | Role is not Owner or Admin | `Access denied. Required roles: Owner, Admin` |

**Notes:**
- Returns system roles first (Owner, Admin, etc.), then custom roles alphabetically
- Only active, non-deleted roles are returned
- This endpoint does NOT expose permissions, templates, or any internal RBAC data
- Roles are global (not per-tenant) — all tenants see the same role list

---

## Pagination Notes {#pagination}

### Tenant-Scoped List Endpoints

All tenant-scoped list endpoints return:
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

### Platform Admin List Users (`GET /admin/users`)

Uses `pagination` key instead of `meta`:
```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

---

## Membership Status Values {#membership-status}

| Status | Description |
|---|---|
| `INVITED` | Invite sent, user has not accepted yet. Membership is pending. |
| `ACTIVE` | User has accepted the invite (or was directly created). Fully authenticated. |
| `INACTIVE` | User was deactivated. Cannot log in. JWT is revoked. |

Only one `ACTIVE` membership can exist per user globally across all tenants (BR-02).

---

## Business Rules Reference {#business-rules}

| Rule | Description | Enforced In |
|------|-------------|-------------|
| BR-02 | A user can only have ONE active membership across all tenants at any time | `acceptInvite()`, `reactivateUser()`, `createUserInTenant()` |
| BR-03 | Reactivation blocked if user has active membership elsewhere | `reactivateUser()` |
| BR-04 | Deactivation immediately revokes JWT via Redis blocklist | `deactivateUser()` |
| BR-05 | Invite tokens are single-use (consumed on acceptance, hash cleared to null) | `acceptInvite()` |
| BR-06 | Users with FK references (audit_log or any other table) are soft-deleted; otherwise hard-deleted | `deleteUser()` |
| BR-07 | Soft-deleted users are excluded from tenant-scoped list queries (`user.deleted_at = null` filter) | `listUsers()` |
| BR-08 | Every role change is audit-logged with before/after state containing role names | `changeRole()` |
| BR-09 | Only Owners or platform admins can change an Owner's role. Admin attempting this gets 403. | `changeRole()` |
| BR-10 | Cannot deactivate the last active Owner in a tenant. Checked inside DB transaction to prevent race conditions. | `deactivateUser()` |
| BR-12 | Inviting an existing email links to the existing user record — never creates a duplicate user | `inviteUser()` |
| BR-13 | Platform-level deactivation blocks JWT via Redis blocklist + deletes all refresh tokens | `performDeactivation()` (admin controller) |

---

## Known Deviations {#deviations}

### DEV-01: `avatar_url` in PATCH /users/me — Accepted but Not Persisted

**DTO accepts:** `avatar_url` field with `@IsUrl()` validation
**Service does:** Ignores the field — only saves `first_name`, `last_name`, `phone`
**Root cause:** The `user` table in Prisma schema has no `avatar_url` column
**Impact on frontend:** Do NOT send `avatar_url` in PATCH /users/me — it will pass validation but will not be saved. The field always returns `null` in all responses.
**Code location:** `api/src/modules/users/services/users.service.ts:649-656`

### DEV-02: Admin Tenant Users Endpoint Does Not Filter Soft-Deleted Users

**Endpoint:** `GET /api/v1/admin/tenants/:tenantId/users`
**Tenant-scoped `GET /users` does:** Filters by `user.deleted_at = null`
**Admin endpoint does:** No such filter — returns ALL memberships including those of soft-deleted users
**Impact on frontend:** The admin view may show memberships for deleted users. Frontend should handle this gracefully.
**Code location:** `api/src/modules/admin/services/tenant-management.service.ts:1260-1330`

### DEV-03: Admin Endpoints Use Deprecated `user_role` Table for Roles

**Endpoints:** `GET /admin/users` and `GET /admin/users/:id`
**Expected:** Should resolve roles from `user_tenant_membership` + `role` table
**Actual:** Resolves roles from deprecated `user_role` table (`user_role_user_role_user_idTouser`)
**Impact on frontend:** The `roles` array may show stale or missing roles for users who only have `user_tenant_membership` records (no `user_role` entries). Platform admin views should treat the `roles` field as potentially incomplete.
**Code location:** `api/src/modules/admin/controllers/user-management.controller.ts:203-209`

---

## Complete Endpoint Reference (Quick Lookup)

| # | Method | Path | Auth | Roles | Description |
|---|---|---|---|---|---|
| 1 | POST | `/api/v1/users/invite` | JWT | Owner, Admin | Invite user to tenant |
| 2 | GET | `/api/v1/users/invite/:token` | PUBLIC | — | Validate invite token |
| 3 | POST | `/api/v1/users/invite/:token/accept` | PUBLIC | — | Accept invite, set password, get JWT |
| 4 | GET | `/api/v1/users/me` | JWT | Any | Get own profile + membership |
| 5 | PATCH | `/api/v1/users/me` | JWT | Any | Update own profile |
| 6 | PATCH | `/api/v1/users/me/password` | JWT | Any | Change own password |
| 7 | GET | `/api/v1/users` | JWT | Owner, Admin | List tenant users (paginated) |
| 8 | GET | `/api/v1/users/:id` | JWT | Owner, Admin | Get single membership |
| 9 | PATCH | `/api/v1/users/:id/role` | JWT | Owner, Admin | Change user role |
| 10 | PATCH | `/api/v1/users/:id/deactivate` | JWT | Owner, Admin | Deactivate user + revoke JWT |
| 11 | PATCH | `/api/v1/users/:id/reactivate` | JWT | Owner, Admin | Reactivate inactive user |
| 12 | DELETE | `/api/v1/users/:id` | JWT | Owner | Delete user (soft/hard) |
| 13 | GET | `/api/v1/admin/users` | JWT | Platform Admin | List ALL users cross-tenant |
| 14 | GET | `/api/v1/admin/users/:id` | JWT | Platform Admin | Get user details |
| 15 | POST | `/api/v1/admin/users/:id/reset-password` | JWT | Platform Admin | Force password reset |
| 16 | POST | `/api/v1/admin/users/:id/deactivate` | JWT | Platform Admin | Deactivate user (POST) |
| 17 | PATCH | `/api/v1/admin/users/:id/deactivate` | JWT | Platform Admin | Deactivate user (PATCH) |
| 18 | POST | `/api/v1/admin/users/:id/activate` | JWT | Platform Admin | Activate user |
| 19 | DELETE | `/api/v1/admin/users/:id` | JWT | Platform Admin | Soft delete user |
| 20 | GET | `/api/v1/admin/tenants/:tenantId/users` | JWT | Platform Admin | List users in specific tenant |
| 21 | POST | `/api/v1/admin/tenants/:tenantId/users` | JWT | Platform Admin | Create user (bypass invite) |
