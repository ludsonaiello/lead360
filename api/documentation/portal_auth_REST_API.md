# Portal Authentication — REST API Documentation

**Module**: Portal
**Sprint**: 31
**Base URL**: `https://api.lead360.app/api/v1`
**Authentication**: Portal JWT (separate from staff JWT)

---

## Overview

The Customer Portal Authentication system provides a separate authentication mechanism for customers (leads converted to projects). Portal accounts are auto-created when a project is created from a quote. Customers log in via their tenant's subdomain portal using email + password.

**Key architectural decisions:**
- Portal JWT uses a **separate secret** (`PORTAL_JWT_SECRET`) — completely isolated from staff JWTs
- Portal tokens are **not interchangeable** with staff tokens
- Tenant context is resolved from `tenant_slug` (subdomain) on public endpoints
- Portal token expiry: **30 days**
- Reset token expiry: **1 hour**

---

## Endpoints

### 1. POST /portal/auth/login

**Description**: Authenticate a customer and receive a portal JWT token.

**Authentication**: None (public)

**Request Body**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `tenant_slug` | string | Yes | Non-empty | Tenant subdomain (e.g., `acmeplumbing`) |
| `email` | string | Yes | Valid email | Portal account email |
| `password` | string | Yes | Min 1 char | Portal account password |

**Request Example**:
```json
POST /api/v1/portal/auth/login
Content-Type: application/json

{
  "tenant_slug": "acmeplumbing",
  "email": "john@example.com",
  "password": "MyP@ssw0rd"
}
```

**Success Response** (200 OK):
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "customer_slug": "john-smith",
  "must_change_password": true,
  "lead": {
    "first_name": "John",
    "last_name": "Smith"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `token` | string | Portal JWT token (30-day expiry) |
| `customer_slug` | string | URL-safe customer identifier |
| `must_change_password` | boolean | `true` on first login (temporary password) |
| `lead` | object\|null | Customer name from lead record |
| `lead.first_name` | string | Customer first name |
| `lead.last_name` | string | Customer last name |

**Portal JWT Payload**:
```json
{
  "sub": "portal-account-uuid",
  "tenant_id": "tenant-uuid",
  "lead_id": "lead-uuid",
  "customer_slug": "john-smith",
  "iat": 1642329600,
  "exp": 1644921600
}
```

**Error Responses**:

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing/invalid fields | `{ "statusCode": 400, "message": "Validation failed", "errors": [...] }` |
| 401 | Invalid tenant, email, or password | `{ "statusCode": 401, "message": "Invalid credentials" }` |

**Notes**:
- Uses generic "Invalid credentials" message for all auth failures to prevent enumeration
- Updates `last_login_at` on successful login

---

### 2. POST /portal/auth/forgot-password

**Description**: Request a password reset email for a portal account.

**Authentication**: None (public)

**Request Body**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `tenant_slug` | string | Yes | Non-empty | Tenant subdomain |
| `email` | string | Yes | Valid email | Portal account email |

**Request Example**:
```json
POST /api/v1/portal/auth/forgot-password
Content-Type: application/json

{
  "tenant_slug": "acmeplumbing",
  "email": "john@example.com"
}
```

**Success Response** (200 OK):
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Error Responses**:

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Missing/invalid fields | `{ "statusCode": 400, "message": "Validation failed", "errors": [...] }` |

**Notes**:
- **Always returns 200** regardless of whether the account exists (prevents email enumeration)
- Reset token expires in **1 hour**
- Queues email with reset link: `https://{subdomain}.lead360.app/public/reset-password?token={token}`

---

### 3. POST /portal/auth/reset-password

**Description**: Reset password using a token received via email.

**Authentication**: None (public)

**Request Body**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `token` | string | Yes | Non-empty | Reset token from email |
| `new_password` | string | Yes | Min 8 chars, uppercase, lowercase, digit, special | New password |

**Request Example**:
```json
POST /api/v1/portal/auth/reset-password
Content-Type: application/json

{
  "token": "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  "new_password": "NewSecure@Pass1"
}
```

**Success Response** (200 OK):
```json
{
  "message": "Password reset successfully. You can now log in with your new password."
}
```

**Error Responses**:

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Invalid or expired token | `{ "statusCode": 400, "message": "Invalid or expired reset token" }` |
| 400 | Password validation failed | `{ "statusCode": 400, "message": "Validation failed", "errors": [...] }` |

**Notes**:
- Clears the reset token after successful use (single-use)
- Sets `must_change_password` to `false`

---

### 4. POST /portal/auth/change-password

**Description**: Change password for the authenticated portal account. Used after first login when `must_change_password` is `true`.

**Authentication**: Portal JWT (Bearer token)

**Request Headers**:
```
Authorization: Bearer {portal-jwt-token}
Content-Type: application/json
```

**Request Body**:
| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| `old_password` | string | Yes | Non-empty | Current password |
| `new_password` | string | Yes | Min 8 chars, uppercase, lowercase, digit, special | New password |

**Request Example**:
```json
POST /api/v1/portal/auth/change-password
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "old_password": "TempP@ss1",
  "new_password": "MyNewSecure@Pass1"
}
```

**Success Response** (200 OK):
```json
{
  "message": "Password changed successfully"
}
```

**Error Responses**:

| Status | Condition | Response |
|--------|-----------|----------|
| 400 | Current password incorrect | `{ "statusCode": 400, "message": "Current password is incorrect" }` |
| 400 | New password same as old | `{ "statusCode": 400, "message": "New password must be different from current password" }` |
| 400 | Password validation failed | `{ "statusCode": 400, "message": "Validation failed", "errors": [...] }` |
| 401 | Missing or invalid portal token | `{ "statusCode": 401, "message": "Unauthorized" }` |
| 404 | Portal account not found | `{ "statusCode": 404, "message": "Portal account not found" }` |

**Notes**:
- Requires a **portal JWT** — staff JWTs are rejected
- Sets `must_change_password` to `false` after successful change
- Old password must be verified before accepting new password

---

## Portal Account Creation (Internal)

Portal accounts are **not** created via API endpoints. They are auto-created internally by `PortalAuthService.createForLead()` during project creation from a quote (`ProjectService.createFromQuote`).

**Business Rules**:
- One portal account per lead per tenant (`@@unique([tenant_id, lead_id])`)
- Idempotent: if account already exists for the lead, skips creation
- **Standalone projects** (no lead) are **never** eligible for portal account creation
- Customer slug is generated from `first_name-last_name` (URL-safe, hyphenated, lowercase)
- Slug collision: appends `-2`, `-3`, etc. per tenant
- Temporary password: 12 characters with uppercase, lowercase, digit, and special character
- `must_change_password` is set to `true` on creation
- Welcome email queued with temporary credentials and portal URL

---

## Password Requirements

All new passwords must meet:
- Minimum 8 characters
- At least 1 uppercase letter
- At least 1 lowercase letter
- At least 1 digit
- At least 1 special character (`@$!%*?&#^()_-+=`)

---

## Security Design

### JWT Isolation
- Portal JWT secret: `PORTAL_JWT_SECRET` (separate from staff `JWT_SECRET`)
- Portal tokens **cannot** authenticate on staff endpoints
- Staff tokens **cannot** authenticate on portal endpoints

### Tenant Isolation
- All portal queries include `tenant_id` filter
- Tenant resolved from `tenant_slug` (subdomain) for public endpoints
- Tenant resolved from JWT `tenant_id` claim for authenticated endpoints

### Anti-Enumeration
- Login: generic "Invalid credentials" for all failures
- Forgot password: always returns success message regardless of account existence

### Token Security
- Portal JWT expiry: 30 days
- Reset token expiry: 1 hour
- Reset tokens are single-use (cleared after consumption)
- Passwords hashed with bcrypt (10 salt rounds)

---

## Database Schema

### portal_account

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| id | VARCHAR(36) | No | uuid() | Primary key |
| tenant_id | VARCHAR(36) | No | — | FK → tenant |
| lead_id | VARCHAR(36) | No | — | FK → lead |
| email | VARCHAR(255) | No | — | Login credential |
| customer_slug | VARCHAR(200) | No | — | URL-safe slug |
| password_hash | TEXT | No | — | bcrypt hash (never returned) |
| must_change_password | BOOLEAN | No | true | Set false after first change |
| last_login_at | DATETIME | Yes | null | Updated on login |
| reset_token | VARCHAR(200) | Yes | null | Password reset token |
| reset_token_expires_at | DATETIME | Yes | null | Reset token expiry |
| is_active | BOOLEAN | No | true | Account active flag |
| created_at | DATETIME | No | now() | Creation timestamp |
| updated_at | DATETIME | No | @updatedAt | Last update timestamp |

**Unique Constraints**:
- `(tenant_id, lead_id)` — one account per lead per tenant
- `(tenant_id, email)` — unique email per tenant
- `(tenant_id, customer_slug)` — unique slug per tenant

**Indexes**:
- `(tenant_id, is_active)` — for active account lookups

---

## Integration Points

### ProjectService.createFromQuote
After project creation from a quote, calls `PortalAuthService.createForLead(tenantId, leadId)` to auto-create the portal account. This is non-blocking — portal account creation failure does not fail project creation.

### Email Templates
- `portal-welcome`: Sent on account creation with temporary password and portal URL
- `portal-password-reset`: Sent on password reset request with reset link

---

## Swagger

All endpoints are documented in Swagger UI at `https://api.lead360.app/api/docs` under the **Portal Authentication** tag.
