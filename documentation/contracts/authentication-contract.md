# Feature Contract: Authentication System

**Feature Name**: Authentication & User Management  
**Module**: Authentication  
**Sprint**: Sprint 0 - Platform Foundation  
**Status**: Draft

---

## Purpose

**What problem does this solve?**

Provides secure user authentication and session management for the Lead360 platform. Enables users to register, log in, manage passwords, and maintain secure sessions across multiple devices. Foundation for all protected API endpoints and user-specific features.

**Who is this for?**

- **Primary Users**: All platform users (tenant admins, employees, platform admins)
- **Use Cases**: 
  - User registration and onboarding
  - Secure login/logout across devices
  - Password reset and recovery
  - Session management and token refresh

---

## Scope

### **In Scope**

- ✅ User registration (self-service for tenant admins)
- ✅ Admin-created user accounts (platform admin can create users)
- ✅ Email/password login
- ✅ JWT-based authentication (access + refresh tokens)
- ✅ Multiple concurrent sessions (same user, multiple devices)
- ✅ Password reset via email
- ✅ Token refresh mechanism
- ✅ "Keep me logged in" option (extended refresh token)
- ✅ Logout (single session and all sessions)
- ✅ Password strength requirements
- ✅ Account activation via email
- ✅ Database schema prepared for MFA (not implemented yet)
- ✅ Database schema prepared for social login (not implemented yet)

### **Out of Scope**

- ❌ Multi-Factor Authentication (MFA) - Post-MVP, but schema ready
- ❌ Social login (Google, Facebook) - Post-MVP, but schema ready
- ❌ Biometric authentication - Future consideration
- ❌ Account lockout after failed attempts - Post-MVP
- ❌ Password history/rotation - Post-MVP
- ❌ Single Sign-On (SSO) - Future consideration

---

## Dependencies

### **Requires (must be complete first)**

- [ ] Database initialized (Prisma + MySQL)
- [ ] Email service configured (for password reset, activation)
- [ ] JWT secret configured in environment
- [ ] bcrypt library for password hashing
- [ ] Token signing/verification utilities

### **Blocks (must complete before)**

- Admin Panel (requires auth to protect admin routes)
- RBAC (requires user authentication)
- Multi-tenant resolution (requires authenticated users)
- All business modules (Leads, Quotes, etc.)

---

## Data Model

### **Database Tables**

#### **Table: user**

**Purpose**: Stores all user accounts across all tenants

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | uuid | Yes | Primary key | - | uuid() |
| tenant_id | uuid | Yes | Tenant identifier (null for platform admins) | - | - |
| email | string(255) | Yes | User email (login identifier) | Valid email format, unique per tenant | - |
| password_hash | string(255) | Yes | Bcrypt hashed password | - | - |
| first_name | string(100) | Yes | User first name | 1-100 chars | - |
| last_name | string(100) | Yes | User last name | 1-100 chars | - |
| phone | string(20) | No | User phone number | E.164 format | null |
| is_active | boolean | Yes | Account active status | - | false |
| is_platform_admin | boolean | Yes | Platform admin flag | - | false |
| email_verified | boolean | Yes | Email verification status | - | false |
| email_verified_at | timestamp | No | When email was verified | - | null |
| activation_token | string(255) | No | Email activation token | - | null |
| activation_token_expires | timestamp | No | Token expiry | - | null |
| password_reset_token | string(255) | No | Password reset token | - | null |
| password_reset_expires | timestamp | No | Reset token expiry | - | null |
| last_login_at | timestamp | No | Last successful login | - | null |
| mfa_enabled | boolean | Yes | MFA enabled flag (future) | - | false |
| mfa_secret | string(255) | No | MFA secret (future) | - | null |
| oauth_provider | string(50) | No | Social login provider (future) | google, facebook | null |
| oauth_provider_id | string(255) | No | Provider user ID (future) | - | null |
| created_at | timestamp | Yes | Creation time | - | now() |
| updated_at | timestamp | Yes | Last update | - | now() |
| deleted_at | timestamp | No | Soft delete timestamp | - | null |

**Indexes**:
- Primary: `id`
- Unique: `(email, tenant_id)` (email unique per tenant, allows same email across tenants)
- Index: `(tenant_id, is_active)`
- Index: `(email)` (for login lookups)
- Index: `(activation_token)` (for activation)
- Index: `(password_reset_token)` (for reset)
- Index: `(oauth_provider, oauth_provider_id)` (for future social login)

**Relationships**:
- Belongs to: `tenant` (nullable for platform admins)
- Has many: `user_role` (junction table for RBAC)
- Has many: `refresh_token` (active sessions)
- Has many: `audit_log` (user actions)

**Business Rules**:
- Email must be unique within a tenant (case-insensitive)
- Password must be hashed with bcrypt (cost factor 10)
- Platform admins have `tenant_id = null` and `is_platform_admin = true`
- Soft delete: Set `deleted_at` instead of hard delete
- Cannot delete user with active projects/quotes (enforce in service layer)

---

#### **Table: refresh_token**

**Purpose**: Stores refresh tokens for session management (supports multiple devices)

**Columns**:

| Column | Type | Required | Description | Validation | Default |
|--------|------|----------|-------------|------------|---------|
| id | uuid | Yes | Primary key | - | uuid() |
| user_id | uuid | Yes | User identifier | - | - |
| token_hash | string(255) | Yes | Hashed refresh token | - | - |
| device_name | string(255) | No | Device identifier (e.g., "Chrome on MacOS") | - | null |
| ip_address | string(45) | No | IP address at creation | IPv4 or IPv6 | null |
| user_agent | string(500) | No | User agent string | - | null |
| expires_at | timestamp | Yes | Token expiration | - | 7 days from creation |
| created_at | timestamp | Yes | Creation time | - | now() |
| revoked_at | timestamp | No | Manual revocation timestamp | - | null |

**Indexes**:
- Primary: `id`
- Index: `(user_id, expires_at)`
- Index: `(token_hash)` (for lookup)
- Index: `(user_id, revoked_at)` (for active sessions query)

**Relationships**:
- Belongs to: `user`

**Business Rules**:
- Token hash stored (never plain text)
- Expired tokens should be cleaned up periodically (background job)
- Revoked tokens cannot be used
- User can have multiple active refresh tokens (multiple devices)

---

### **Enums**

#### **OAuthProvider** (Future)

Values:
- `google`: Google OAuth
- `facebook`: Facebook/Meta OAuth
- `apple`: Apple Sign In (potential future)

---

## API Specification

### **Endpoints Overview**

| Method | Endpoint | Description | Auth | Roles |
|--------|----------|-------------|------|-------|
| POST | /auth/register | Self-service registration | No | - |
| POST | /auth/login | Login (email + password) | No | - |
| POST | /auth/logout | Logout current session | Yes | All |
| POST | /auth/logout-all | Logout all sessions | Yes | All |
| POST | /auth/refresh | Refresh access token | No* | - |
| POST | /auth/forgot-password | Request password reset | No | - |
| POST | /auth/reset-password | Reset password with token | No | - |
| POST | /auth/activate | Activate account with token | No | - |
| POST | /auth/resend-activation | Resend activation email | No | - |
| GET | /auth/me | Get current user profile | Yes | All |
| PATCH | /auth/me | Update current user profile | Yes | All |
| PATCH | /auth/change-password | Change password (authenticated) | Yes | All |
| GET | /auth/sessions | List active sessions | Yes | All |
| DELETE | /auth/sessions/:id | Revoke specific session | Yes | All |

*Refresh endpoint uses refresh token in Authorization header, not JWT access token

---

### **Endpoint Details**

#### **1. Register User**

**POST** `/auth/register`

**Purpose**: Self-service registration for tenant admin users

**Request Body Schema**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| email | string | Yes | Valid email, unique per tenant | User email |
| password | string | Yes | 8+ chars, uppercase, lowercase, special char | User password |
| first_name | string | Yes | 1-100 chars | First name |
| last_name | string | Yes | 1-100 chars | Last name |
| phone | string | No | E.164 format | Phone number |
| tenant_subdomain | string | Yes | 3-63 chars, alphanumeric + hyphens | Tenant subdomain |
| company_name | string | Yes | 2-200 chars | Company name (for tenant creation) |

**Request Example**:
```json
{
  "email": "john@example.com",
  "password": "MySecure@Pass123",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+15551234567",
  "tenant_subdomain": "acme-roofing",
  "company_name": "Acme Roofing LLC"
}
```

**Success Response (201)**:
```json
{
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "is_active": false,
    "email_verified": false
  },
  "tenant": {
    "id": "uuid",
    "subdomain": "acme-roofing",
    "company_name": "Acme Roofing LLC"
  },
  "message": "Registration successful. Please check your email to activate your account."
}
```

**Business Logic**:
1. Validate email uniqueness (per tenant)
2. Validate password strength
3. Create tenant record (if subdomain available)
4. Hash password with bcrypt
5. Create user with `is_active = false`
6. Generate activation token (expires in 24 hours)
7. Send activation email
8. Return success (user cannot login until activated)

**Error Responses**:
- 400: Validation failed (invalid email, weak password, etc.)
- 409: Email already registered or subdomain taken
- 500: Server error (email send failed, etc.)

---

#### **2. Login**

**POST** `/auth/login`

**Purpose**: Authenticate user and issue tokens

**Request Body Schema**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| email | string | Yes | Valid email | User email |
| password | string | Yes | - | User password |
| remember_me | boolean | No | - | Extend refresh token to 30 days |

**Request Example**:
```json
{
  "email": "john@example.com",
  "password": "MySecure@Pass123",
  "remember_me": true
}
```

**Success Response (200)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400,
  "user": {
    "id": "uuid",
    "email": "john@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "tenant_id": "uuid",
    "roles": ["Owner"]
  }
}
```

**JWT Access Token Payload**:
```json
{
  "sub": "user-uuid",
  "email": "john@example.com",
  "tenant_id": "tenant-uuid",
  "roles": ["Owner"],
  "is_platform_admin": false,
  "iat": 1642329600,
  "exp": 1642416000
}
```

**Business Logic**:
1. Find user by email
2. Verify password with bcrypt
3. Check `is_active = true` and `email_verified = true`
4. Generate access token (expires in 24 hours)
5. Generate refresh token (expires in 7 days, or 30 days if `remember_me = true`)
6. Store refresh token hash in database
7. Update `last_login_at`
8. Return tokens and user profile

**Error Responses**:
- 401: Invalid credentials
- 403: Account not activated or inactive
- 429: Too many login attempts (future - rate limiting)

---

#### **3. Refresh Access Token**

**POST** `/auth/refresh`

**Purpose**: Issue new access token using refresh token

**Request Headers**:
```
Authorization: Bearer {refresh_token}
```

**Success Response (200)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

**Business Logic**:
1. Extract refresh token from Authorization header
2. Verify token signature
3. Check token not expired
4. Check token not revoked in database
5. Generate new access token (same payload as original)
6. Return new access token (refresh token remains valid)

**Error Responses**:
- 401: Invalid or expired refresh token
- 403: Refresh token revoked

---

#### **4. Logout (Current Session)**

**POST** `/auth/logout`

**Purpose**: Revoke current refresh token (logout current device)

**Request Headers**:
```
Authorization: Bearer {access_token}
```

**Success Response (200)**:
```json
{
  "message": "Logged out successfully"
}
```

**Business Logic**:
1. Extract user ID from JWT access token
2. Find refresh token associated with current session (via token hash)
3. Set `revoked_at = now()`
4. Return success

**Error Responses**:
- 401: Unauthorized (invalid token)

---

#### **5. Logout All Sessions**

**POST** `/auth/logout-all`

**Purpose**: Revoke all refresh tokens for user (logout all devices)

**Request Headers**:
```
Authorization: Bearer {access_token}
```

**Success Response (200)**:
```json
{
  "message": "Logged out from all devices successfully",
  "sessions_revoked": 3
}
```

**Business Logic**:
1. Extract user ID from JWT access token
2. Find all active refresh tokens for user
3. Set `revoked_at = now()` for all
4. Return count of revoked sessions

**Error Responses**:
- 401: Unauthorized (invalid token)

---

#### **6. Forgot Password**

**POST** `/auth/forgot-password`

**Purpose**: Request password reset email

**Request Body Schema**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| email | string | Yes | Valid email | User email |

**Request Example**:
```json
{
  "email": "john@example.com"
}
```

**Success Response (200)**:
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Business Logic**:
1. Find user by email (case-insensitive)
2. If user exists and is active:
   - Generate password reset token (random, secure)
   - Set `password_reset_token` and `password_reset_expires = now() + 1 hour`
   - Send password reset email with link: `https://app.lead360.com/reset-password?token={token}`
3. Always return success (don't reveal if email exists)

**Error Responses**:
- 429: Too many requests (rate limit)

---

#### **7. Reset Password**

**POST** `/auth/reset-password`

**Purpose**: Reset password using token from email

**Request Body Schema**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| token | string | Yes | - | Reset token from email |
| password | string | Yes | 8+ chars, uppercase, lowercase, special char | New password |

**Request Example**:
```json
{
  "token": "abc123...",
  "password": "NewSecure@Pass456"
}
```

**Success Response (200)**:
```json
{
  "message": "Password reset successfully. You can now log in with your new password."
}
```

**Business Logic**:
1. Find user by `password_reset_token`
2. Check token not expired (`password_reset_expires > now()`)
3. Validate new password strength
4. Hash new password with bcrypt
5. Update user password
6. Clear `password_reset_token` and `password_reset_expires`
7. Revoke all refresh tokens (force re-login on all devices)
8. Send "password changed" notification email
9. Return success

**Error Responses**:
- 400: Invalid or expired token
- 400: Password validation failed

---

#### **8. Activate Account**

**POST** `/auth/activate`

**Purpose**: Activate account using token from registration email

**Request Body Schema**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| token | string | Yes | - | Activation token from email |

**Request Example**:
```json
{
  "token": "xyz789..."
}
```

**Success Response (200)**:
```json
{
  "message": "Account activated successfully. You can now log in."
}
```

**Business Logic**:
1. Find user by `activation_token`
2. Check token not expired (`activation_token_expires > now()`)
3. Set `is_active = true` and `email_verified = true`
4. Set `email_verified_at = now()`
5. Clear `activation_token` and `activation_token_expires`
6. Send "welcome" email
7. Return success

**Error Responses**:
- 400: Invalid or expired token
- 409: Account already activated

---

#### **9. Get Current User Profile**

**GET** `/auth/me`

**Purpose**: Get authenticated user's profile

**Request Headers**:
```
Authorization: Bearer {access_token}
```

**Success Response (200)**:
```json
{
  "id": "uuid",
  "email": "john@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+15551234567",
  "tenant_id": "uuid",
  "roles": ["Owner", "Admin"],
  "is_platform_admin": false,
  "email_verified": true,
  "last_login_at": "2025-01-01T12:00:00Z",
  "created_at": "2024-01-01T08:00:00Z"
}
```

**Business Logic**:
1. Extract user ID from JWT
2. Fetch user from database with roles
3. Return user profile (exclude password_hash, tokens)

**Error Responses**:
- 401: Unauthorized
- 404: User not found (account deleted)

---

#### **10. Update Current User Profile**

**PATCH** `/auth/me`

**Purpose**: Update authenticated user's profile

**Request Body Schema**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| first_name | string | No | 1-100 chars | First name |
| last_name | string | No | 1-100 chars | Last name |
| phone | string | No | E.164 format | Phone number |

**Request Example**:
```json
{
  "first_name": "Jonathan",
  "phone": "+15559876543"
}
```

**Success Response (200)**:
```json
{
  "id": "uuid",
  "email": "john@example.com",
  "first_name": "Jonathan",
  "last_name": "Doe",
  "phone": "+15559876543",
  "updated_at": "2025-01-01T14:30:00Z"
}
```

**Business Logic**:
1. Extract user ID from JWT
2. Validate updated fields
3. Update user record
4. Return updated profile

**Error Responses**:
- 400: Validation failed
- 401: Unauthorized

---

#### **11. Change Password (Authenticated)**

**PATCH** `/auth/change-password`

**Purpose**: Change password while logged in

**Request Body Schema**:

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| current_password | string | Yes | - | Current password |
| new_password | string | Yes | 8+ chars, uppercase, lowercase, special char | New password |

**Request Example**:
```json
{
  "current_password": "OldPass@123",
  "new_password": "NewSecure@Pass456"
}
```

**Success Response (200)**:
```json
{
  "message": "Password changed successfully"
}
```

**Business Logic**:
1. Extract user ID from JWT
2. Verify current password
3. Validate new password strength
4. Check new password different from current
5. Hash new password
6. Update user password
7. Revoke all other refresh tokens (keep current session active)
8. Send "password changed" notification email
9. Return success

**Error Responses**:
- 400: Current password incorrect
- 400: New password validation failed
- 401: Unauthorized

---

#### **12. List Active Sessions**

**GET** `/auth/sessions`

**Purpose**: List all active sessions (devices) for current user

**Request Headers**:
```
Authorization: Bearer {access_token}
```

**Success Response (200)**:
```json
{
  "sessions": [
    {
      "id": "uuid",
      "device_name": "Chrome on MacOS",
      "ip_address": "192.168.1.100",
      "created_at": "2025-01-01T08:00:00Z",
      "expires_at": "2025-01-08T08:00:00Z",
      "is_current": true
    },
    {
      "id": "uuid",
      "device_name": "Safari on iPhone",
      "ip_address": "192.168.1.101",
      "created_at": "2024-12-30T10:00:00Z",
      "expires_at": "2025-01-06T10:00:00Z",
      "is_current": false
    }
  ]
}
```

**Business Logic**:
1. Extract user ID from JWT
2. Fetch all active refresh tokens (not expired, not revoked)
3. Mark current session based on token hash
4. Return list

**Error Responses**:
- 401: Unauthorized

---

#### **13. Revoke Specific Session**

**DELETE** `/auth/sessions/:id`

**Purpose**: Logout a specific device/session

**Request Headers**:
```
Authorization: Bearer {access_token}
```

**Success Response (200)**:
```json
{
  "message": "Session revoked successfully"
}
```

**Business Logic**:
1. Extract user ID from JWT
2. Find refresh token by ID
3. Verify token belongs to current user
4. Set `revoked_at = now()`
5. Return success

**Error Responses**:
- 401: Unauthorized
- 404: Session not found
- 403: Cannot revoke another user's session

---

## Business Rules

### **Validation Rules**

1. **Email Validation**
   - **When**: Registration, login, profile update
   - **Action**: Must be valid email format, lowercase normalized
   - **Error**: "Invalid email format"

2. **Password Strength**
   - **When**: Registration, password reset, password change
   - **Action**: 
     - Minimum 8 characters
     - At least 1 uppercase letter
     - At least 1 lowercase letter
     - At least 1 special character (@, $, !, %, *, ?, &, #, etc.)
     - No requirement for numbers
   - **Error**: "Password must be at least 8 characters and include uppercase, lowercase, and special character"

3. **Email Uniqueness**
   - **When**: Registration
   - **Action**: Email must be unique per tenant (case-insensitive)
   - **Error**: "Email already registered"

4. **Account Activation**
   - **When**: Login
   - **Action**: User must have `is_active = true` and `email_verified = true`
   - **Error**: "Please activate your account by clicking the link in your email"

5. **Token Expiry**
   - **When**: Refresh token use, password reset, account activation
   - **Action**: Check `expires_at > now()`
   - **Error**: "Token expired" (with option to resend)

6. **Platform Admin Rules**
   - **When**: Creating platform admin
   - **Action**: Must have `tenant_id = null` and `is_platform_admin = true`
   - **Error**: N/A (internal logic)

7. **Session Limit**
   - **When**: Login
   - **Action**: No hard limit (multiple devices allowed)
   - **Error**: N/A
   - **Note**: In future, could implement configurable limit per tenant

---

### **State Transitions**

**User Account States**:
```
REGISTERED (is_active=false, email_verified=false)
    ↓
ACTIVATED (is_active=true, email_verified=true)
    ↓
ACTIVE (can login and use system)
    ↓
DEACTIVATED (is_active=false) - can be reactivated by admin
    ↓
DELETED (deleted_at set) - soft deleted, cannot login
```

**Allowed Transitions**:
- REGISTERED → ACTIVATED: Via activation token
- ACTIVATED → DEACTIVATED: Admin action
- DEACTIVATED → ACTIVATED: Admin action
- Any state → DELETED: Admin action (soft delete)

**Who Can Transition**:
- REGISTERED → ACTIVATED: User (via token) or Admin
- ACTIVATED → DEACTIVATED: Admin, Owner
- DEACTIVATED → ACTIVATED: Admin, Owner
- Any → DELETED: Admin, Owner (soft delete only)

---

## UI Requirements

### **Pages Required**

#### **1. Login Page**

**Route**: `/login`

**Purpose**: User login with email/password

**Layout**:
```
[Logo]
[Title: "Welcome Back"]

[Email Input]
[Password Input (with show/hide toggle)]
[Remember Me Checkbox]

[Login Button (full width)]

[Link: "Forgot Password?"]
[Link: "Don't have an account? Sign Up"]
```

**Functionality**:
- Email input (autofocus)
- Password input with show/hide toggle
- "Remember me" checkbox (sets `remember_me = true`)
- Login button (loading spinner on submit)
- Success: Store tokens, redirect to dashboard
- Error: Show error message inline
- Links to forgot password and register

**Modern UI Requirements**:
- ✅ Clean, minimal design
- ✅ Input validation feedback (real-time)
- ✅ Loading spinner on button during API call
- ✅ Error message display (red banner or inline)
- ✅ Mobile responsive
- ✅ Autofocus on email field
- ✅ Enter key submits form

---

#### **2. Register Page**

**Route**: `/register`

**Purpose**: Self-service registration for new tenants

**Layout** (Multi-step form):

**Step 1: Company Information**
```
[Logo]
[Title: "Create Your Account"]
[Progress: 1/3]

[Company Name Input]
[Subdomain Input] (with .lead360.com suffix shown)
  - Real-time availability check

[Next Button]
```

**Step 2: Your Information**
```
[Progress: 2/3]

[First Name Input]
[Last Name Input]
[Email Input]
[Phone Input (masked)]
[Password Input (with strength meter)]
[Confirm Password Input]

[Back Button] [Next Button]
```

**Step 3: Review & Submit**
```
[Progress: 3/3]

[Summary of entered info]
[Checkbox: "I agree to Terms of Service"]

[Back Button] [Create Account Button]
```

**Functionality**:
- Multi-step form (3 steps)
- Progress indicator
- Real-time subdomain availability check
- Phone input with mask (US format)
- Password strength meter (weak/medium/strong)
- Confirm password validation
- Terms checkbox required
- Success: Show success modal, redirect to "Check your email" page
- Error: Show error modal with retry

**Modern UI Requirements**:
- ✅ Multi-step form with progress bar
- ✅ Masked phone input
- ✅ Password strength indicator (visual meter)
- ✅ Real-time subdomain availability (debounced API check)
- ✅ Validation errors inline
- ✅ Success modal: "Account created! Check your email to activate."
- ✅ Mobile responsive

---

#### **3. Forgot Password Page**

**Route**: `/forgot-password`

**Purpose**: Request password reset email

**Layout**:
```
[Logo]
[Title: "Reset Your Password"]
[Subtitle: "Enter your email and we'll send you a reset link"]

[Email Input]

[Send Reset Link Button]

[Link: "Back to Login"]
```

**Functionality**:
- Email input
- Submit button (loading spinner)
- Success: Show success modal "Check your email for reset link"
- Error: Show generic success message (don't reveal if email exists)

**Modern UI Requirements**:
- ✅ Clean, minimal design
- ✅ Success modal (even if email doesn't exist - security)
- ✅ Loading spinner on button
- ✅ Mobile responsive

---

#### **4. Reset Password Page**

**Route**: `/reset-password?token={token}`

**Purpose**: Reset password using token from email

**Layout**:
```
[Logo]
[Title: "Create New Password"]

[New Password Input (with strength meter)]
[Confirm Password Input]

[Reset Password Button]
```

**Functionality**:
- Extract token from URL query param
- Password strength meter
- Confirm password validation
- Submit button (loading spinner)
- Success: Show success modal, redirect to login
- Error: Show error modal (invalid/expired token)

**Modern UI Requirements**:
- ✅ Password strength meter
- ✅ Validation errors inline
- ✅ Success modal: "Password reset! You can now log in."
- ✅ Invalid token: Show error, link to forgot password
- ✅ Mobile responsive

---

#### **5. Account Activation Page**

**Route**: `/activate?token={token}`

**Purpose**: Activate account using token from registration email

**Layout**:
```
[Logo]
[Title: "Activating Your Account..."]
[Loading Spinner]

(On success)
[Success Icon]
[Title: "Account Activated!"]
[Subtitle: "You can now log in to your account"]
[Login Button]

(On error)
[Error Icon]
[Title: "Activation Failed"]
[Subtitle: "Token is invalid or expired"]
[Resend Activation Email Button]
```

**Functionality**:
- Extract token from URL query param
- Auto-submit activation on page load
- Success: Show success message, login button
- Error: Show error, resend activation button

**Modern UI Requirements**:
- ✅ Auto-activate on load
- ✅ Loading state
- ✅ Success/error states
- ✅ Resend activation option
- ✅ Mobile responsive

---

#### **6. Profile Settings Page**

**Route**: `/settings/profile`

**Purpose**: View and update user profile

**Layout**:
```
[Header: "Profile Settings"]

[Section: Personal Information]
- First Name [Input]
- Last Name [Input]
- Email [Display only - not editable]
- Phone [Masked Input]

[Save Changes Button]

[Section: Password]
[Change Password Button] → Opens modal

[Section: Active Sessions]
[List of active sessions with "Logout" button for each]
[Logout All Devices Button]
```

**Functionality**:
- View/edit profile fields
- Change password modal
- List active sessions
- Logout individual sessions
- Logout all devices

**Modern UI Requirements**:
- ✅ Editable fields with save button
- ✅ Change password in modal
- ✅ Session list with device info
- ✅ Confirmation modal for "Logout All"
- ✅ Success/error toasts
- ✅ Mobile responsive

---

### **Components Required**

1. **LoginForm**: Login form component
   - Props: onSubmit callback
   - Used in: Login page

2. **RegisterForm**: Multi-step registration form
   - Props: onSubmit callback
   - Used in: Register page

3. **PasswordStrengthMeter**: Visual password strength indicator
   - Props: password string
   - Used in: Register, Reset Password, Change Password

4. **SessionCard**: Display active session
   - Props: session object, onRevoke callback
   - Used in: Profile Settings

5. **ChangePasswordModal**: Modal for changing password
   - Props: isOpen, onClose, onSubmit
   - Used in: Profile Settings

---

## User Flows

### **Primary Flow: New User Registration**

1. User navigates to `/register`
2. **Step 1**: User enters company name and subdomain
   - Real-time subdomain availability check (debounced)
   - User clicks "Next"
3. **Step 2**: User enters personal information
   - Email, password (with strength meter), name, phone
   - User clicks "Next"
4. **Step 3**: User reviews information
   - User checks "Terms of Service" checkbox
   - User clicks "Create Account"
5. Loading spinner shows
6. API call to POST `/auth/register`
7. Success:
   - Success modal shows: "Account created! Check your email to activate."
   - User is redirected to "Check your email" page
8. User receives activation email
9. User clicks activation link (opens `/activate?token=...`)
10. Account is activated automatically
11. Success page shows with "Login" button
12. User clicks "Login" → redirects to `/login`
13. User logs in with new credentials

**Error Handling**:
- Validation errors: Show inline on respective fields
- Email already exists: Show error "Email already registered"
- Subdomain taken: Show error "Subdomain not available"
- API errors: Show modal with retry option

---

### **Secondary Flow: Login**

1. User navigates to `/login`
2. User enters email and password
3. User optionally checks "Remember me"
4. User clicks "Login"
5. Loading spinner shows
6. API call to POST `/auth/login`
7. Success:
   - Tokens stored (localStorage or httpOnly cookie)
   - User redirected to `/dashboard`
8. Error:
   - Show error message: "Invalid email or password"
   - OR "Please activate your account first"

**Error Handling**:
- Invalid credentials: "Invalid email or password"
- Account not activated: "Please check your email to activate your account"
- Account deactivated: "Your account has been deactivated. Contact support."

---

### **Secondary Flow: Forgot Password**

1. User clicks "Forgot Password?" on login page
2. User navigates to `/forgot-password`
3. User enters email
4. User clicks "Send Reset Link"
5. Loading spinner shows
6. API call to POST `/auth/forgot-password`
7. Success modal shows: "Check your email for password reset link"
8. User receives email
9. User clicks reset link (opens `/reset-password?token=...`)
10. User enters new password (with strength meter)
11. User clicks "Reset Password"
12. API call to POST `/auth/reset-password`
13. Success:
    - Success modal: "Password reset successfully!"
    - User redirected to `/login`
14. User logs in with new password

**Error Handling**:
- Invalid/expired token: Show error with "Request new reset link" button
- Password validation failed: Show inline error

---

### **Secondary Flow: Change Password (While Logged In)**

1. User navigates to `/settings/profile`
2. User clicks "Change Password" button
3. Modal opens
4. User enters current password and new password
5. User clicks "Change Password"
6. API call to PATCH `/auth/change-password`
7. Success:
   - Success toast: "Password changed successfully"
   - Modal closes
   - All other sessions logged out (user stays logged in on current device)
8. User receives "password changed" email notification

**Error Handling**:
- Current password incorrect: "Current password is incorrect"
- New password validation failed: Show inline error

---

### **Edge Cases**

1. **What if user navigates away during registration?**
   - Show "Unsaved changes" confirmation modal
   - Options: "Discard" or "Continue Editing"

2. **What if activation token expires?**
   - Show error: "Activation link expired"
   - Provide "Resend activation email" button

3. **What if user tries to register with existing email?**
   - Show error: "Email already registered. Try logging in or resetting your password."

4. **What if user has multiple sessions and changes password?**
   - All other sessions are logged out
   - Current session remains active
   - User receives email notification

5. **What if refresh token expires while user is active?**
   - Access token expires → API returns 401
   - Frontend attempts token refresh
   - If refresh token also expired → redirect to login
   - Show message: "Your session has expired. Please log in again."

---

## Security & Permissions

### **Authentication**

- ✅ All API endpoints require JWT authentication
- ❌ Except: `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/activate`

### **Password Security**

- Password hashed with bcrypt (cost factor 10)
- Never log passwords (plain or hashed)
- Never return password in API responses
- Password reset tokens are single-use
- Tokens expire after 1 hour (reset) or 24 hours (activation)

### **Token Security**

- JWT signed with HS256 algorithm
- JWT secret stored in environment variable (never in code)
- Access tokens short-lived (24 hours)
- Refresh tokens longer-lived (7 days default, 30 days with "remember me")
- Refresh tokens stored as hash in database
- Revoked tokens cannot be reused
- Password change revokes all refresh tokens (except current session)

### **Multi-Tenant Isolation**

- ✅ All user queries MUST filter by `tenant_id`
- ✅ `tenant_id` extracted from JWT (never from client)
- ✅ Platform admins have `tenant_id = null` (special case)
- ✅ Tenant isolation tests required

### **Rate Limiting**

- Login: 5 attempts per 15 minutes per IP
- Password reset: 3 requests per hour per email
- Registration: 3 requests per hour per IP
- (To be implemented in future sprint)

### **Audit Logging**

**Log These Actions**:
- User registration
- User login (success and failure)
- Password change
- Password reset request
- Password reset completion
- Account activation
- Session logout (single and all)
- Profile update

**Audit Fields**:
- actor_user_id (null for unauthenticated actions)
- entity_type = "user"
- entity_id = user.id
- action (e.g., "login", "password_reset")
- before_json (null for login)
- after_json (null for login)
- metadata_json (IP address, user agent)
- timestamp
- ip_address

---

## Testing Requirements

### **Backend Tests**

#### **Unit Tests (Services)**
- ✅ Register user (success)
- ✅ Register user (email already exists)
- ✅ Register user (weak password)
- ✅ Register user (subdomain taken)
- ✅ Login (success)
- ✅ Login (invalid credentials)
- ✅ Login (account not activated)
- ✅ Refresh token (success)
- ✅ Refresh token (expired)
- ✅ Refresh token (revoked)
- ✅ Logout (current session)
- ✅ Logout all sessions
- ✅ Forgot password (user exists)
- ✅ Forgot password (user doesn't exist - still return success)
- ✅ Reset password (success)
- ✅ Reset password (invalid token)
- ✅ Reset password (expired token)
- ✅ Activate account (success)
- ✅ Activate account (invalid token)
- ✅ Activate account (already activated)
- ✅ Change password (success)
- ✅ Change password (current password incorrect)
- ✅ Password hashing (bcrypt)
- ✅ JWT generation and validation

#### **Integration Tests (API)**
- ✅ POST /auth/register (success)
- ✅ POST /auth/register (validation errors)
- ✅ POST /auth/login (success)
- ✅ POST /auth/login (401 unauthorized)
- ✅ POST /auth/refresh (success)
- ✅ POST /auth/refresh (401 expired)
- ✅ POST /auth/logout (success)
- ✅ POST /auth/logout-all (success)
- ✅ POST /auth/forgot-password (success)
- ✅ POST /auth/reset-password (success)
- ✅ POST /auth/reset-password (400 invalid token)
- ✅ POST /auth/activate (success)
- ✅ POST /auth/activate (400 invalid token)
- ✅ GET /auth/me (success)
- ✅ GET /auth/me (401 unauthorized)
- ✅ PATCH /auth/me (success)
- ✅ PATCH /auth/change-password (success)
- ✅ GET /auth/sessions (success)
- ✅ DELETE /auth/sessions/:id (success)

#### **Tenant Isolation Tests**
- ✅ User from Tenant A cannot access user data from Tenant B
- ✅ Platform admin can access all tenants
- ✅ JWT contains correct tenant_id

#### **Security Tests**
- ✅ Password not returned in API responses
- ✅ Password stored as hash (not plain text)
- ✅ JWT expires after 24 hours
- ✅ Refresh token expires after 7 days (or 30 with remember_me)
- ✅ Revoked refresh token cannot be used
- ✅ Password reset token single-use
- ✅ Password reset token expires after 1 hour
- ✅ Activation token expires after 24 hours

---

### **Frontend Tests**

#### **Component Tests**
- ✅ LoginForm renders correctly
- ✅ LoginForm validates email format
- ✅ LoginForm submits data correctly
- ✅ LoginForm shows error on API failure
- ✅ RegisterForm multi-step navigation works
- ✅ RegisterForm validates password strength
- ✅ RegisterForm checks subdomain availability
- ✅ PasswordStrengthMeter shows correct strength
- ✅ SessionCard renders session info
- ✅ SessionCard calls onRevoke when clicked

#### **Integration Tests (E2E)**
- ✅ Complete registration flow (all steps)
- ✅ Login flow (success)
- ✅ Login flow (invalid credentials)
- ✅ Forgot password flow
- ✅ Reset password flow
- ✅ Account activation flow
- ✅ Change password flow
- ✅ Logout flow
- ✅ Logout all sessions flow
- ✅ Token refresh on expiry

---

## Future Extensibility

### **Multi-Factor Authentication (MFA)**

**Database Schema Already Prepared**:
- `user.mfa_enabled` (boolean)
- `user.mfa_secret` (string, encrypted)

**Implementation Plan (Post-MVP)**:
1. Add MFA setup flow (generate QR code with TOTP secret)
2. Add MFA verification step to login flow
3. Add backup codes generation
4. Add SMS/Email code option (using existing communication infrastructure)
5. Add "Trust this device" option (store device fingerprint)

**API Endpoints (Future)**:
- POST /auth/mfa/setup (generate QR code)
- POST /auth/mfa/verify (verify TOTP code)
- POST /auth/mfa/disable (disable MFA)
- POST /auth/mfa/backup-codes (generate backup codes)
- POST /auth/mfa/sms (send SMS code)
- POST /auth/mfa/email (send email code)

---

### **Social Login (OAuth)**

**Database Schema Already Prepared**:
- `user.oauth_provider` (string: google, facebook)
- `user.oauth_provider_id` (string: provider's user ID)

**Implementation Plan (Post-MVP)**:
1. Integrate OAuth providers (Google, Facebook)
2. Add "Sign in with Google" button on login/register pages
3. OAuth callback handler
4. Link OAuth account to existing email (if email matches)
5. Create new account if email doesn't exist

**API Endpoints (Future)**:
- GET /auth/oauth/google (redirect to Google OAuth)
- GET /auth/oauth/google/callback (handle callback)
- GET /auth/oauth/facebook (redirect to Facebook OAuth)
- GET /auth/oauth/facebook/callback (handle callback)
- POST /auth/oauth/link (link OAuth to existing account)
- DELETE /auth/oauth/unlink (unlink OAuth provider)

**Business Rules**:
- If OAuth email matches existing user → link accounts (require password confirmation)
- If OAuth email doesn't exist → create new account (no password required)
- Users can link multiple OAuth providers to same account
- Users must have at least one auth method (password or OAuth)

---

## Acceptance Criteria

**Feature is complete when**:

### **Backend**
- [ ] All database tables created with migrations
- [ ] All API endpoints implemented and tested
- [ ] Password hashing with bcrypt (cost 10)
- [ ] JWT generation and validation working
- [ ] Refresh token rotation working
- [ ] Email activation flow working
- [ ] Password reset flow working
- [ ] Multiple sessions supported
- [ ] Logout single session working
- [ ] Logout all sessions working
- [ ] Unit tests >80% coverage
- [ ] Integration tests passing
- [ ] Tenant isolation tests passing
- [ ] Security tests passing
- [ ] Swagger documentation complete (all endpoints)

### **Frontend**
- [ ] Login page implemented
- [ ] Register page implemented (multi-step)
- [ ] Forgot password page implemented
- [ ] Reset password page implemented
- [ ] Activate account page implemented
- [ ] Profile settings page implemented
- [ ] Change password modal implemented
- [ ] Session management UI implemented
- [ ] Password strength meter working
- [ ] Subdomain availability check working
- [ ] Mobile responsive (all pages)
- [ ] Loading/error states handled
- [ ] Success/error modals working
- [ ] Component tests >70% coverage
- [ ] E2E tests for critical flows passing

### **Integration**
- [ ] Frontend successfully calls all backend endpoints
- [ ] Token storage working (localStorage or httpOnly cookie)
- [ ] Auto token refresh working
- [ ] Auto redirect to login on 401
- [ ] Error handling works (modals, retry)
- [ ] Success feedback works (modals, toasts, redirects)
- [ ] Email delivery working (activation, reset, notifications)

### **Documentation**
- [ ] Backend API docs complete (100% endpoints)
- [ ] Swagger UI accessible
- [ ] User guide for password reset (if needed)
- [ ] Admin guide for user management (if needed)

---

## Open Questions

1. **Token Storage**
   - **Question**: Should refresh tokens be stored in httpOnly cookie or localStorage?
   - **Options**: 
     - A) httpOnly cookie (more secure, prevents XSS)
     - B) localStorage (simpler, but XSS vulnerable)
   - **Decision needed by**: Before frontend implementation
   - **Blocker**: No
   - **Recommendation**: httpOnly cookie for production security

2. **Email Provider**
   - **Question**: Which email service should we use?
   - **Options**: SendGrid, AWS SES, Mailgun, Postmark
   - **Decision needed by**: Before backend implementation
   - **Blocker**: Yes
   - **Note**: Need API keys and configuration

3. **Rate Limiting**
   - **Question**: Should we implement rate limiting in Sprint 0 or defer?
   - **Options**: 
     - A) Implement basic rate limiting now (Redis-based)
     - B) Defer to Sprint 1
   - **Decision needed by**: Before API implementation
   - **Blocker**: No
   - **Recommendation**: Defer to Sprint 1, but log attempts

4. **Session Device Detection**
   - **Question**: How detailed should device detection be?
   - **Options**: 
     - A) Basic (browser + OS from user-agent)
     - B) Detailed (use library like UAParser)
   - **Decision needed by**: Before backend implementation
   - **Blocker**: No
   - **Recommendation**: Basic for MVP

---

## Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Email delivery failures | High | Medium | Use reliable provider (SendGrid, Postmark), implement retry logic, log failures |
| JWT secret compromise | High | Low | Store in environment variable, rotate periodically, use strong random secret |
| Token storage XSS vulnerability | High | Medium | Use httpOnly cookies, implement CSP headers, sanitize all inputs |
| Refresh token theft | Medium | Medium | Short expiry, revoke on password change, IP/device validation (future) |
| Subdomain enumeration | Low | Medium | Rate limit subdomain checks, implement CAPTCHA on registration (future) |
| Password reset abuse | Medium | Low | Rate limit reset requests, log all attempts, implement CAPTCHA (future) |

---

## Timeline Estimate

**Backend Development**: 4-5 days
- Database schema + migrations: 1 day
- Auth service (register, login, logout, refresh): 1.5 days
- Password reset + activation: 1 day
- Session management: 0.5 day
- Testing (unit + integration + security): 1 day

**Frontend Development**: 4-5 days
- Login page: 0.5 day
- Register page (multi-step): 1.5 days
- Forgot/reset password pages: 1 day
- Activate account page: 0.5 day
- Profile settings + session management: 1 day
- Testing (component + E2E): 1 day

**Integration & Testing**: 1-2 days
- Frontend-backend integration: 0.5 day
- End-to-end testing: 0.5 day
- Email testing: 0.5 day
- Bug fixes: 0.5 day

**Total**: 9-12 days

**Dependencies may affect timeline** (email provider setup, environment configuration).

---

## Notes

### **Password Hashing**
- Use bcrypt with cost factor 10 (balances security and performance)
- Never use MD5, SHA1, or plain text
- Consider Argon2 for future (more secure, but newer)

### **JWT Best Practices**
- Keep access tokens short-lived (24 hours max)
- Use refresh tokens for long sessions
- Sign with HS256 (symmetric) for MVP, consider RS256 (asymmetric) for scale
- Include minimal claims (user ID, tenant ID, roles)
- Don't store sensitive data in JWT (it's base64, not encrypted)

### **Email Templates**
- Use branded email templates (tenant logo, colors)
- Include clear call-to-action buttons
- Provide support contact in footer
- Test deliverability before launch

### **GDPR Considerations (Future)**
- Implement "Download my data" endpoint
- Implement "Delete my account" endpoint
- Cookie consent for EU users
- Privacy policy and terms of service links

### **Accessibility**
- All forms should be keyboard navigable
- Labels for all inputs (screen reader friendly)
- Error messages announced to screen readers
- Focus management on modals

---

**End of Authentication Contract**

This contract must be approved before development begins.