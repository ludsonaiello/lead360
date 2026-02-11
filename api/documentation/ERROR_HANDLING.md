# Error Handling Documentation - Lead360 API

**Version**: 1.0
**Last Updated**: January 2026

---

## Overview

The Lead360 API uses a **standardized error response format** across all endpoints. This ensures consistent, predictable error handling on the frontend and makes debugging easier.

All errors return:
- ✅ Consistent JSON structure
- ✅ Machine-readable error codes
- ✅ Human-readable messages
- ✅ Request tracking IDs
- ✅ Detailed validation errors (when applicable)

---

## Error Response Format

### Standard Error Response

```json
{
  "statusCode": 401,
  "errorCode": "AUTH_INVALID_CREDENTIALS",
  "message": "Invalid email or password",
  "error": "Unauthorized",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "path": "/api/v1/auth/login",
  "requestId": "req_abc123def456"
}
```

### Validation Error Response

When DTO validation fails (e.g., invalid email format, missing required fields):

```json
{
  "statusCode": 400,
  "errorCode": "VALIDATION_FAILED",
  "message": "Validation failed",
  "error": "Bad Request",
  "timestamp": "2026-01-02T10:30:00.000Z",
  "path": "/api/v1/auth/register",
  "requestId": "req_xyz789ghi012",
  "validationErrors": [
    {
      "field": "email",
      "message": "Invalid email format",
      "constraints": {
        "isEmail": "email must be an email"
      }
    },
    {
      "field": "password",
      "message": "Password must contain at least one uppercase letter, one lowercase letter, and one special character",
      "constraints": {
        "matches": "password must match ..."
      }
    }
  ]
}
```

---

## Error Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `statusCode` | `number` | HTTP status code (400, 401, 403, 404, 409, 500, etc.) |
| `errorCode` | `string` | Machine-readable error code for programmatic handling |
| `message` | `string` | Human-readable error message (safe to display to user) |
| `error` | `string` | HTTP error name (Bad Request, Unauthorized, etc.) |
| `timestamp` | `string` | ISO 8601 timestamp when error occurred |
| `path` | `string` | API endpoint that caused the error |
| `requestId` | `string` | Unique request ID for tracking/debugging |
| `validationErrors` | `array` | (Optional) Detailed validation errors for each field |

---

## Error Codes

### Authentication & Authorization (`AUTH_*`)

| Error Code | HTTP Status | Message | When It Occurs |
|------------|-------------|---------|----------------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password | Login with wrong credentials |
| `AUTH_ACCOUNT_NOT_ACTIVATED` | 403 | Account is not activated. Please check your email for the activation link. | Login before activating account |
| `AUTH_EMAIL_NOT_VERIFIED` | 403 | Email is not verified. Please check your email for the verification link. | Login before verifying email |
| `AUTH_USER_NOT_FOUND` | 401 | User not found | User doesn't exist or is inactive |
| `AUTH_TOKEN_INVALID` | 401 | Invalid or expired token | JWT token is invalid |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Invalid or expired refresh token | Refresh token is invalid |
| `AUTH_RESET_TOKEN_INVALID` | 400 | Invalid or expired reset token | Password reset token invalid |
| `AUTH_ACTIVATION_TOKEN_INVALID` | 400 | Invalid or expired activation token | Account activation token invalid |
| `AUTH_CURRENT_PASSWORD_INCORRECT` | 400 | Current password is incorrect | Wrong current password when changing |
| `AUTH_PASSWORD_SAME_AS_CURRENT` | 400 | New password must be different from current password | New password same as current |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | Access denied. Required roles: ... | User lacks required roles |
| `AUTH_NOT_AUTHENTICATED` | 401 | User not authenticated | No JWT token provided |
| `AUTH_SESSION_NOT_FOUND` | 404 | Session not found | Session doesn't exist |

### Resource Conflicts (`CONFLICT_*`)

| Error Code | HTTP Status | Message | When It Occurs |
|------------|-------------|---------|----------------|
| `CONFLICT_EMAIL_EXISTS` | 409 | Email is already registered | Registration with existing email |
| `CONFLICT_SUBDOMAIN_EXISTS` | 409 | Subdomain is already taken | Registration with taken subdomain |
| `CONFLICT_EIN_EXISTS` | 409 | EIN ... is already registered to another tenant | Duplicate EIN |
| `CONFLICT_ACCOUNT_ALREADY_ACTIVATED` | 409 | Account is already activated | Activating already-active account |

### Tenant & Multi-Tenancy (`TENANT_*`)

| Error Code | HTTP Status | Message | When It Occurs |
|------------|-------------|---------|----------------|
| `TENANT_NOT_FOUND` | 404 | Tenant not found | Tenant doesn't exist by subdomain/ID |
| `TENANT_INACTIVE` | 403 | Tenant account is inactive | Tenant is suspended/inactive |
| `TENANT_SUBDOMAIN_RESERVED` | 400 | This subdomain is reserved and cannot be used | Reserved subdomain like `www`, `api` |
| `TENANT_ADDRESS_NOT_FOUND` | 404 | Address not found | Address doesn't exist |
| `TENANT_ADDRESS_LEGAL_NO_PO_BOX` | 400 | Legal address cannot be a PO Box | Business rule violation |

### Validation (`VALIDATION_*`)

| Error Code | HTTP Status | Message | When It Occurs |
|------------|-------------|---------|----------------|
| `VALIDATION_FAILED` | 400 | Validation failed | DTO validation failed (see `validationErrors`) |
| `VALIDATION_INVALID_INPUT` | 400 | Invalid input format or type | Invalid data type |
| `VALIDATION_REQUIRED_FIELD` | 400 | Required field is missing | Missing required field |
| `VALIDATION_NO_FIELDS_TO_UPDATE` | 400 | No fields to update | Update request with no data |

### Resource Not Found (`RESOURCE_*`)

| Error Code | HTTP Status | Message | When It Occurs |
|------------|-------------|---------|----------------|
| `RESOURCE_NOT_FOUND` | 404 | [Resource name] not found | Generic fallback for any resource not found |

**Pattern Matching**: The system automatically maps any error message containing "not found" to `RESOURCE_NOT_FOUND` if no specific error code is matched.

**Examples**:
- `"Communication event not found"` → `RESOURCE_NOT_FOUND`
- `"Phone number not found"` → `RESOURCE_NOT_FOUND`
- `"Provider not found"` → `RESOURCE_NOT_FOUND`
- `"Webhook not found"` → `RESOURCE_NOT_FOUND`

**Specific NOT FOUND Codes**: Some resources have specific error codes instead of the generic one:
- `TENANT_NOT_FOUND` - For tenant lookups
- `TENANT_ADDRESS_NOT_FOUND` - For tenant addresses
- `AUTH_SESSION_NOT_FOUND` - For user sessions
- `AUTH_USER_NOT_FOUND` - For user lookups
- `FILE_NOT_FOUND` - For file operations

**Response Example**:
```json
{
  "statusCode": 404,
  "errorCode": "RESOURCE_NOT_FOUND",
  "message": "Communication event not found",
  "error": "Not Found",
  "timestamp": "2026-02-11T10:30:00.000Z",
  "path": "/api/v1/admin/communication/events/abc123",
  "requestId": "req_xyz789def456"
}
```

### File Management (`FILE_*`)

| Error Code | HTTP Status | Message | When It Occurs |
|------------|-------------|---------|----------------|
| `FILE_INVALID_TYPE` | 400 | Invalid file type for upload | Unsupported file type |
| `FILE_TOO_LARGE` | 400 | File size exceeds maximum allowed limit | File exceeds size limit |
| `FILE_NOT_FOUND` | 404 | File not found | File doesn't exist |
| `FILE_UPLOAD_FAILED` | 500 | File upload operation failed | Upload failed |

### Server Errors (`SERVER_*`)

| Error Code | HTTP Status | Message | When It Occurs |
|------------|-------------|---------|----------------|
| `SERVER_INTERNAL_ERROR` | 500 | Internal server error | Unexpected server error |
| `SERVER_DATABASE_ERROR` | 500 | Database operation failed | Database error |
| `SERVER_EXTERNAL_SERVICE_ERROR` | 500 | External service/API failed | External API failure |

---

## Frontend Integration

### TypeScript Interface

```typescript
interface ErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId: string;
  validationErrors?: ValidationError[];
}

interface ValidationError {
  field: string;
  message: string;
  constraints?: Record<string, string>;
  value?: any;
}
```

### React/Next.js Example

```typescript
import { ErrorResponse } from '@/types/api';

async function handleLogin(email: string, password: string) {
  try {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      const error: ErrorResponse = await response.json();

      // Handle specific error codes
      switch (error.errorCode) {
        case 'AUTH_INVALID_CREDENTIALS':
          toast.error('Invalid email or password');
          break;

        case 'AUTH_ACCOUNT_NOT_ACTIVATED':
          toast.error('Please activate your account. Check your email.');
          navigate('/resend-activation');
          break;

        case 'AUTH_EMAIL_NOT_VERIFIED':
          toast.error('Please verify your email address');
          navigate('/resend-verification');
          break;

        case 'VALIDATION_FAILED':
          // Show field-specific errors
          error.validationErrors?.forEach(({ field, message }) => {
            toast.error(`${field}: ${message}`);
          });
          break;

        case 'RESOURCE_NOT_FOUND':
          // Generic not found error
          toast.error(error.message); // Shows specific resource name
          // Optionally redirect or show empty state
          break;

        case 'TENANT_NOT_FOUND':
        case 'AUTH_SESSION_NOT_FOUND':
          // Specific not found errors - handle differently if needed
          toast.error(error.message);
          break;

        default:
          toast.error(error.message);
      }

      // Log request ID for debugging
      console.error(`Request ID: ${error.requestId}`);

      throw error;
    }

    return await response.json();
  } catch (error) {
    console.error('Login failed:', error);
    throw error;
  }
}
```

### Axios Interceptor Example

```typescript
import axios from 'axios';
import { ErrorResponse } from '@/types/api';

const api = axios.create({
  baseURL: 'https://api.lead360.app/api/v1',
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const errorData: ErrorResponse = error.response.data;

      // Log for debugging
      console.error(`[${errorData.errorCode}] ${errorData.message}`, {
        requestId: errorData.requestId,
        path: errorData.path,
      });

      // Handle authentication errors globally
      if (errorData.errorCode === 'AUTH_NOT_AUTHENTICATED') {
        // Redirect to login
        window.location.href = '/login';
      }

      // Handle validation errors
      if (errorData.errorCode === 'VALIDATION_FAILED') {
        const fieldErrors = errorData.validationErrors?.reduce(
          (acc, { field, message }) => {
            acc[field] = message;
            return acc;
          },
          {} as Record<string, string>,
        );
        return Promise.reject({ fieldErrors, errorData });
      }
    }

    return Promise.reject(error);
  },
);

export default api;
```

---

## Backend Usage

### Throwing Errors in Services

**Use standard NestJS exceptions** with descriptive messages. The exception filters will automatically map them to error codes.

```typescript
import {
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

// Authentication errors (401)
throw new UnauthorizedException('Invalid email or password');

// Authorization errors (403)
throw new ForbiddenException('Account is not activated. Please check your email for the activation link.');

// Not found errors (404)
throw new NotFoundException('Tenant not found'); // Maps to TENANT_NOT_FOUND
throw new NotFoundException('Communication event not found'); // Maps to RESOURCE_NOT_FOUND (generic)
throw new NotFoundException('Provider not found'); // Maps to RESOURCE_NOT_FOUND (generic)

// Conflict errors (409)
throw new ConflictException('Email is already registered');

// Bad request errors (400)
throw new BadRequestException('Invalid or expired reset token');
```

### Automatic Error Code Mapping

The system uses **intelligent pattern matching** to automatically map exception messages to error codes. This happens in the global exception filter.

**Mapping Priority**:
1. **Exact Message Match** - Checks `ERROR_MESSAGE_TO_CODE_MAP` for exact message
2. **Partial Pattern Matching** - Checks for known patterns:
   - Messages containing `"is already registered to another tenant"` → `CONFLICT_EIN_EXISTS`
   - Messages containing `"Tenant with subdomain"` → `TENANT_NOT_FOUND`
   - Messages containing `"Access denied. Required roles:"` → `AUTH_INSUFFICIENT_PERMISSIONS`
   - Messages containing `"not found"` (case-insensitive) → `RESOURCE_NOT_FOUND`
3. **Default Fallback** - If no match found → `SERVER_INTERNAL_ERROR`

**Example**:
```typescript
// In service:
throw new NotFoundException('Communication event not found');

// Exception filter automatically:
// 1. Checks exact match - not found
// 2. Checks pattern match - finds "not found" → maps to RESOURCE_NOT_FOUND
// 3. Returns error response with errorCode: "RESOURCE_NOT_FOUND"
```

**Benefits**:
- ✅ New resources automatically get proper error codes (no mapping needed)
- ✅ Consistent 404 handling across all modules
- ✅ Frontend can handle `RESOURCE_NOT_FOUND` generically
- ✅ Specific resources can still have specific codes (e.g., `TENANT_NOT_FOUND`)

### Adding New Error Codes

1. **Add error code to enum** (`api/src/common/enums/error-codes.enum.ts`):

```typescript
export enum ErrorCode {
  // ... existing codes

  /** New error code description */
  MY_NEW_ERROR_CODE = 'MY_NEW_ERROR_CODE',
}
```

2. **Add message mapping** (same file):

```typescript
export const ERROR_MESSAGE_TO_CODE_MAP: Record<string, ErrorCode> = {
  // ... existing mappings

  'My new error message': ErrorCode.MY_NEW_ERROR_CODE,
};
```

3. **Throw exception in service**:

```typescript
throw new BadRequestException('My new error message');
```

The filters will automatically:
- ✅ Map message → error code
- ✅ Add request ID
- ✅ Log error with context
- ✅ Return standardized response

---

## Logging & Debugging

### Error Logs

Errors are automatically logged with context:

```
[WARN] [AUTH_INVALID_CREDENTIALS] Invalid email or password
Context: {"requestId":"req_abc123","statusCode":401,"method":"POST","path":"/api/v1/auth/login","ip":"192.168.1.1","userId":null}
```

### Log Levels

| Status Code Range | Log Level | Example |
|-------------------|-----------|---------|
| 400-499 | `WARN` | Invalid credentials, validation errors |
| 500-599 | `ERROR` | Internal server errors, database failures |

### Finding Errors by Request ID

When a user reports an error, ask for the **Request ID** from the error response. Then search logs:

```bash
grep "req_abc123" logs/api.log
```

---

## Testing Error Handling

### Unit Test Example

```typescript
import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthService', () => {
  it('should throw AUTH_INVALID_CREDENTIALS for invalid password', async () => {
    const service = new AuthService(/* dependencies */);

    await expect(
      service.login({ email: 'test@example.com', password: 'wrong' })
    ).rejects.toThrow(UnauthorizedException);

    await expect(
      service.login({ email: 'test@example.com', password: 'wrong' })
    ).rejects.toThrow('Invalid email or password');
  });
});
```

### E2E Test Example

```typescript
it('/auth/login (POST) - invalid credentials', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .send({ email: 'test@example.com', password: 'wrong' })
    .expect(401);

  expect(response.body).toMatchObject({
    statusCode: 401,
    errorCode: 'AUTH_INVALID_CREDENTIALS',
    message: 'Invalid email or password',
    error: 'Unauthorized',
  });

  expect(response.body).toHaveProperty('requestId');
  expect(response.body).toHaveProperty('timestamp');
  expect(response.body).toHaveProperty('path', '/api/v1/auth/login');
});
```

---

## Best Practices

### ✅ DO

- Use standard NestJS exceptions (`UnauthorizedException`, `NotFoundException`, etc.)
- Provide clear, actionable error messages
- Keep error messages user-friendly (safe to display in UI)
- Use error codes on frontend for conditional logic
- Log request IDs for debugging
- Handle validation errors at field level

### ❌ DON'T

- Don't expose internal error details in production
- Don't return stack traces to clients
- Don't use generic "An error occurred" messages
- Don't parse error messages for logic (use error codes instead)
- Don't include sensitive data in error responses

---

## Security Considerations

### Password Field Exclusion

Sensitive fields (passwords, tokens, secrets) are **automatically excluded** from validation error responses:

```json
{
  "validationErrors": [
    {
      "field": "password",
      "message": "Password must be at least 8 characters",
      // "value" is NOT included for security
    }
  ]
}
```

### Generic Auth Messages

Authentication errors use **generic messages** to avoid confirming user existence:

✅ Good: `"Invalid email or password"` (doesn't confirm if email exists)
❌ Bad: `"Email not found"` or `"Password incorrect"` (reveals info)

### Production Error Messages

In production, unexpected errors return:
```json
{
  "statusCode": 500,
  "errorCode": "SERVER_INTERNAL_ERROR",
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

Internal error details are logged server-side only.

---

## CORS Handling in Error Responses

**CRITICAL**: Exception filters automatically set CORS headers on error responses to prevent CORS-blocked errors in the browser.

Both `HttpExceptionFilter` and `GlobalExceptionFilter` include:
- `Access-Control-Allow-Origin` (matches request origin if allowed)
- `Access-Control-Allow-Credentials: true`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`

**Allowed Origins**:
- `https://app.lead360.app`
- `https://*.lead360.app` (any subdomain)
- `http://localhost:3000` (development)

Without these headers, error responses would be blocked by the browser, resulting in cryptic CORS errors instead of the actual error message.

---

## Summary

✅ **Consistent Format** - All errors follow the same structure
✅ **Machine-Readable** - Error codes for programmatic handling
✅ **Human-Readable** - Clear messages for users
✅ **Traceable** - Request IDs for debugging
✅ **Detailed** - Field-level validation errors
✅ **Secure** - Doesn't expose sensitive data
✅ **Logged** - Automatic error logging with context
✅ **CORS-Safe** - Headers set on all error responses

The error handling system is **production-ready** and requires **zero changes** to existing service code.

---

**Questions?** Check existing error codes in `api/src/common/enums/error-codes.enum.ts` or see examples in `api/src/modules/auth/auth.service.ts`.
