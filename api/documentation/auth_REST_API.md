# Authentication REST API Documentation

**Module**: Authentication
**Version**: 1.0
**Base URL**: `/api/v1/auth`
**Last Updated**: January 2026

---

## Overview

This API provides authentication and session management for the Lead360 platform. It includes user registration, login/logout, password management, and session handling.

**Swagger UI**: Available at `/api/docs` when the server is running.

---

## Authentication

Most endpoints require authentication via JWT Bearer token.

**Header Format**:
```
Authorization: Bearer <access_token>
```

**Token Types**:
- **Access Token**: Short-lived (24 hours), used for API authentication
- **Refresh Token**: Long-lived (7-30 days), used to obtain new access tokens

---

## Endpoints

### 1. Register User

**POST** `/auth/register`

Creates a new user account and tenant.

**Authentication**: None required

**Request Body**:
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

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| email | string | Yes | Valid email, max 255 chars | User's email (normalized to lowercase) |
| password | string | Yes | 8-72 chars, uppercase, lowercase, special char | User password |
| first_name | string | Yes | 1-100 chars | First name |
| last_name | string | Yes | 1-100 chars | Last name |
| phone | string | No | E.164 format (e.g., +15551234567) | Phone number |
| tenant_subdomain | string | Yes | 3-63 chars, alphanumeric + hyphens, lowercase | Subdomain for tenant |
| company_name | string | Yes | 2-200 chars | Company name |

**Success Response (201 Created)**:
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

**Error Responses**:
- `400 Bad Request`: Validation failed
- `409 Conflict`: Email already registered or subdomain taken

---

### 2. Login

**POST** `/auth/login`

Authenticates user and returns access/refresh tokens.

**Authentication**: None required

**Request Body**:
```json
{
  "email": "john@example.com",
  "password": "MySecure@Pass123",
  "remember_me": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| email | string | Yes | User's email |
| password | string | Yes | User's password |
| remember_me | boolean | No | Extend refresh token to 30 days (default: false) |

**Success Response (200 OK)**:
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
    "phone": "+15551234567",
    "tenant_id": "uuid",
    "roles": ["Owner"],
    "is_platform_admin": false,
    "email_verified": true,
    "last_login_at": "2025-01-01T12:00:00.000Z",
    "created_at": "2024-01-01T08:00:00.000Z"
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

**Error Responses**:
- `401 Unauthorized`: Invalid credentials
- `403 Forbidden`: Account not activated or inactive

---

### 3. Refresh Token

**POST** `/auth/refresh`

Refreshes access token using refresh token.

**Authentication**: Bearer token (refresh token)

**Request Headers**:
```
Authorization: Bearer <refresh_token>
```

**Request Body**: None

**Success Response (200 OK)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or expired refresh token

---

### 4. Logout

**POST** `/auth/logout`

Revokes current session's refresh token.

**Authentication**: Bearer token (access token)

**Request Body**: None

**Success Response (200 OK)**:
```json
{
  "message": "Logged out successfully"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token

---

### 5. Logout All Sessions

**POST** `/auth/logout-all`

Revokes all refresh tokens for the user (logout from all devices).

**Authentication**: Bearer token (access token)

**Request Body**: None

**Success Response (200 OK)**:
```json
{
  "message": "Logged out from all devices successfully",
  "sessions_revoked": 3
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token

---

### 6. Forgot Password

**POST** `/auth/forgot-password`

Requests password reset email.

**Authentication**: None required

**Request Body**:
```json
{
  "email": "john@example.com"
}
```

**Success Response (200 OK)**:
```json
{
  "message": "If an account with that email exists, a password reset link has been sent."
}
```

**Note**: Always returns success to prevent email enumeration attacks.

---

### 7. Reset Password

**POST** `/auth/reset-password`

Resets password using token from email.

**Authentication**: None required

**Request Body**:
```json
{
  "token": "abc123...",
  "password": "NewSecure@Pass456"
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| token | string | Yes | - | Reset token from email |
| password | string | Yes | 8-72 chars, uppercase, lowercase, special char | New password |

**Success Response (200 OK)**:
```json
{
  "message": "Password reset successfully. You can now log in with your new password."
}
```

**Error Responses**:
- `400 Bad Request`: Invalid or expired token, or password validation failed

---

### 8. Activate Account

**POST** `/auth/activate`

Activates account using token from registration email.

**Authentication**: None required

**Request Body**:
```json
{
  "token": "xyz789..."
}
```

**Success Response (200 OK)**:
```json
{
  "message": "Account activated successfully. You can now log in."
}
```

**Error Responses**:
- `400 Bad Request`: Invalid or expired token
- `409 Conflict`: Account already activated

---

### 9. Resend Activation Email

**POST** `/auth/resend-activation`

Resends activation email for unactivated accounts.

**Authentication**: None required

**Request Body**:
```json
{
  "email": "john@example.com"
}
```

**Success Response (200 OK)**:
```json
{
  "message": "If an account with that email exists and is not activated, an activation link has been sent."
}
```

**Note**: Always returns success to prevent email enumeration attacks.

---

### 10. Get Current User Profile

**GET** `/auth/me`

Returns the current authenticated user's profile.

**Authentication**: Bearer token (access token)

**Success Response (200 OK)**:
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
  "last_login_at": "2025-01-01T12:00:00.000Z",
  "created_at": "2024-01-01T08:00:00.000Z"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: User not found (account deleted)

---

### 11. Update Current User Profile

**PATCH** `/auth/me`

Updates the current authenticated user's profile.

**Authentication**: Bearer token (access token)

**Request Body**:
```json
{
  "first_name": "Jonathan",
  "last_name": "Doe",
  "phone": "+15559876543"
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| first_name | string | No | 1-100 chars | First name |
| last_name | string | No | 1-100 chars | Last name |
| phone | string | No | E.164 format | Phone number |

**Success Response (200 OK)**:
```json
{
  "id": "uuid",
  "email": "john@example.com",
  "first_name": "Jonathan",
  "last_name": "Doe",
  "phone": "+15559876543",
  "updated_at": "2025-01-01T14:30:00.000Z"
}
```

**Error Responses**:
- `400 Bad Request`: Validation failed or no fields to update
- `401 Unauthorized`: Invalid or missing token

---

### 12. Change Password

**PATCH** `/auth/change-password`

Changes password for authenticated user.

**Authentication**: Bearer token (access token)

**Request Body**:
```json
{
  "current_password": "OldPass@123",
  "new_password": "NewSecure@Pass456"
}
```

| Field | Type | Required | Validation | Description |
|-------|------|----------|------------|-------------|
| current_password | string | Yes | - | Current password |
| new_password | string | Yes | 8-72 chars, uppercase, lowercase, special char | New password |

**Success Response (200 OK)**:
```json
{
  "message": "Password changed successfully"
}
```

**Business Rules**:
- All other sessions are logged out (current session remains active)
- New password must be different from current password

**Error Responses**:
- `400 Bad Request`: Current password incorrect or validation failed
- `401 Unauthorized`: Invalid or missing token

---

### 13. List Active Sessions

**GET** `/auth/sessions`

Lists all active sessions for the current user.

**Authentication**: Bearer token (access token)

**Success Response (200 OK)**:
```json
{
  "sessions": [
    {
      "id": "uuid",
      "device_name": "Chrome on MacOS",
      "ip_address": "192.168.1.100",
      "created_at": "2025-01-01T08:00:00.000Z",
      "expires_at": "2025-01-08T08:00:00.000Z",
      "is_current": true
    },
    {
      "id": "uuid",
      "device_name": "Safari on iPhone",
      "ip_address": "192.168.1.101",
      "created_at": "2024-12-30T10:00:00.000Z",
      "expires_at": "2025-01-06T10:00:00.000Z",
      "is_current": false
    }
  ]
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token

---

### 14. Revoke Specific Session

**DELETE** `/auth/sessions/:id`

Revokes a specific session (logout from that device).

**Authentication**: Bearer token (access token)

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| id | string | Session ID to revoke |

**Success Response (200 OK)**:
```json
{
  "message": "Session revoked successfully"
}
```

**Error Responses**:
- `401 Unauthorized`: Invalid or missing token
- `404 Not Found`: Session not found

---

### 15. Check Subdomain Availability

**GET** `/auth/check-subdomain/:subdomain`

Checks if a subdomain is available for registration.

**Authentication**: None required

**Path Parameters**:
| Parameter | Type | Description |
|-----------|------|-------------|
| subdomain | string | Subdomain to check |

**Success Response (200 OK)**:
```json
{
  "available": true,
  "subdomain": "my-company"
}
```

or

```json
{
  "available": false,
  "subdomain": "acme-roofing"
}
```

---

## Error Response Format

All error responses follow this format:

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "error": "Bad Request"
}
```

For validation errors with details:

```json
{
  "statusCode": 400,
  "message": [
    "password must be at least 8 characters",
    "email must be a valid email"
  ],
  "error": "Bad Request"
}
```

---

## Password Requirements

Passwords must meet the following criteria:
- Minimum 8 characters
- Maximum 72 characters (bcrypt limit)
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one special character (!@#$%^&*()_+-=[]{}|;':",./<>?)

---

## Rate Limiting

**Note**: Rate limiting is planned for future implementation.

Proposed limits:
- Login: 5 attempts per 15 minutes per IP
- Password reset: 3 requests per hour per email
- Registration: 3 requests per hour per IP

---

## Security Considerations

1. **Password Storage**: Passwords are hashed using bcrypt with a cost factor of 10
2. **Token Storage**: Refresh tokens are stored as SHA-256 hashes in the database
3. **Token Expiry**:
   - Access tokens: 24 hours
   - Refresh tokens: 7 days (default) or 30 days (remember me)
4. **Password Reset**: Tokens expire after 1 hour
5. **Account Activation**: Tokens expire after 24 hours
6. **Multi-Tenant Isolation**: All queries are filtered by tenant_id

---

## Audit Logging

The following actions are logged to the audit_log table:
- User registration
- Login (success and failure)
- Logout (single and all sessions)
- Password change
- Password reset request
- Password reset completion
- Account activation
- Profile update
- Session revocation

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| Jan 2026 | 1.0 | Initial release |

---

**End of Authentication API Documentation**
