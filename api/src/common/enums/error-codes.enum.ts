/**
 * Standardized Error Codes for Lead360 Platform
 *
 * These error codes allow the frontend to handle specific error scenarios
 * programmatically without parsing error messages.
 *
 * Convention:
 * - Use UPPER_SNAKE_CASE
 * - Prefix with module name (AUTH_, TENANT_, VALIDATION_, etc.)
 * - Keep codes descriptive but concise
 */

export enum ErrorCode {
  // ============================================================================
  // AUTHENTICATION & AUTHORIZATION (AUTH_*)
  // ============================================================================

  /** Invalid email or password combination */
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',

  /** Account exists but is not activated yet */
  AUTH_ACCOUNT_NOT_ACTIVATED = 'AUTH_ACCOUNT_NOT_ACTIVATED',

  /** Account exists but email is not verified */
  AUTH_EMAIL_NOT_VERIFIED = 'AUTH_EMAIL_NOT_VERIFIED',

  /** User not found or inactive */
  AUTH_USER_NOT_FOUND = 'AUTH_USER_NOT_FOUND',

  /** JWT token is missing from request */
  AUTH_TOKEN_MISSING = 'AUTH_TOKEN_MISSING',

  /** JWT token is invalid or expired */
  AUTH_TOKEN_INVALID = 'AUTH_TOKEN_INVALID',

  /** Refresh token is invalid or expired */
  AUTH_REFRESH_TOKEN_INVALID = 'AUTH_REFRESH_TOKEN_INVALID',

  /** Password reset token is invalid or expired */
  AUTH_RESET_TOKEN_INVALID = 'AUTH_RESET_TOKEN_INVALID',

  /** Account activation token is invalid or expired */
  AUTH_ACTIVATION_TOKEN_INVALID = 'AUTH_ACTIVATION_TOKEN_INVALID',

  /** Current password provided is incorrect */
  AUTH_CURRENT_PASSWORD_INCORRECT = 'AUTH_CURRENT_PASSWORD_INCORRECT',

  /** New password must be different from current password */
  AUTH_PASSWORD_SAME_AS_CURRENT = 'AUTH_PASSWORD_SAME_AS_CURRENT',

  /** User lacks required roles/permissions for this action */
  AUTH_INSUFFICIENT_PERMISSIONS = 'AUTH_INSUFFICIENT_PERMISSIONS',

  /** User is not authenticated */
  AUTH_NOT_AUTHENTICATED = 'AUTH_NOT_AUTHENTICATED',

  /** Session not found */
  AUTH_SESSION_NOT_FOUND = 'AUTH_SESSION_NOT_FOUND',

  // ============================================================================
  // RESOURCE CONFLICTS (CONFLICT_*)
  // ============================================================================

  /** Email address is already registered */
  CONFLICT_EMAIL_EXISTS = 'CONFLICT_EMAIL_EXISTS',

  /** Subdomain is already taken by another tenant */
  CONFLICT_SUBDOMAIN_EXISTS = 'CONFLICT_SUBDOMAIN_EXISTS',

  /** EIN is already registered to another tenant */
  CONFLICT_EIN_EXISTS = 'CONFLICT_EIN_EXISTS',

  /** Account is already activated */
  CONFLICT_ACCOUNT_ALREADY_ACTIVATED = 'CONFLICT_ACCOUNT_ALREADY_ACTIVATED',

  // ============================================================================
  // TENANT & MULTI-TENANCY (TENANT_*)
  // ============================================================================

  /** Tenant not found by subdomain or ID */
  TENANT_NOT_FOUND = 'TENANT_NOT_FOUND',

  /** Tenant account is inactive/suspended */
  TENANT_INACTIVE = 'TENANT_INACTIVE',

  /** Subdomain is reserved by the system */
  TENANT_SUBDOMAIN_RESERVED = 'TENANT_SUBDOMAIN_RESERVED',

  /** Tenant address not found */
  TENANT_ADDRESS_NOT_FOUND = 'TENANT_ADDRESS_NOT_FOUND',

  /** Legal address cannot be a PO Box */
  TENANT_ADDRESS_LEGAL_NO_PO_BOX = 'TENANT_ADDRESS_LEGAL_NO_PO_BOX',

  // ============================================================================
  // VALIDATION ERRORS (VALIDATION_*)
  // ============================================================================

  /** Request body validation failed (DTO validation) */
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  /** Invalid input format or type */
  VALIDATION_INVALID_INPUT = 'VALIDATION_INVALID_INPUT',

  /** Required field is missing */
  VALIDATION_REQUIRED_FIELD = 'VALIDATION_REQUIRED_FIELD',

  /** No fields provided for update operation */
  VALIDATION_NO_FIELDS_TO_UPDATE = 'VALIDATION_NO_FIELDS_TO_UPDATE',

  // ============================================================================
  // RESOURCE NOT FOUND (NOT_FOUND_*)
  // ============================================================================

  /** Generic resource not found */
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // ============================================================================
  // FILE MANAGEMENT (FILE_*)
  // ============================================================================

  /** Invalid file type for upload */
  FILE_INVALID_TYPE = 'FILE_INVALID_TYPE',

  /** File size exceeds maximum allowed limit */
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',

  /** File not found */
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',

  /** File upload operation failed */
  FILE_UPLOAD_FAILED = 'FILE_UPLOAD_FAILED',

  // ============================================================================
  // SERVER ERRORS (SERVER_*)
  // ============================================================================

  /** Unexpected internal server error */
  SERVER_INTERNAL_ERROR = 'SERVER_INTERNAL_ERROR',

  /** Database operation failed */
  SERVER_DATABASE_ERROR = 'SERVER_DATABASE_ERROR',

  /** External service/API failed */
  SERVER_EXTERNAL_SERVICE_ERROR = 'SERVER_EXTERNAL_SERVICE_ERROR',
}

/**
 * Maps HTTP exception messages to error codes
 *
 * This mapping allows automatic error code assignment based on
 * exception messages thrown in services.
 */
export const ERROR_MESSAGE_TO_CODE_MAP: Record<string, ErrorCode> = {
  // Auth errors
  'Invalid email or password': ErrorCode.AUTH_INVALID_CREDENTIALS,
  'Account is not activated. Please check your email for the activation link.':
    ErrorCode.AUTH_ACCOUNT_NOT_ACTIVATED,
  'Email is not verified. Please check your email for the verification link.':
    ErrorCode.AUTH_EMAIL_NOT_VERIFIED,
  'User not found': ErrorCode.AUTH_USER_NOT_FOUND,
  'User not found or inactive': ErrorCode.AUTH_USER_NOT_FOUND,
  'Invalid or expired reset token': ErrorCode.AUTH_RESET_TOKEN_INVALID,
  'Invalid or expired activation token':
    ErrorCode.AUTH_ACTIVATION_TOKEN_INVALID,
  'Current password is incorrect': ErrorCode.AUTH_CURRENT_PASSWORD_INCORRECT,
  'New password must be different from current password':
    ErrorCode.AUTH_PASSWORD_SAME_AS_CURRENT,
  'User not authenticated': ErrorCode.AUTH_NOT_AUTHENTICATED,
  'Session not found': ErrorCode.AUTH_SESSION_NOT_FOUND,
  'Invalid or expired refresh token': ErrorCode.AUTH_REFRESH_TOKEN_INVALID,

  // Conflict errors
  'Email is already registered': ErrorCode.CONFLICT_EMAIL_EXISTS,
  'Subdomain is already taken': ErrorCode.CONFLICT_SUBDOMAIN_EXISTS,
  'Account is already activated': ErrorCode.CONFLICT_ACCOUNT_ALREADY_ACTIVATED,

  // Tenant errors
  'Tenant not found': ErrorCode.TENANT_NOT_FOUND,
  'Tenant account is inactive': ErrorCode.TENANT_INACTIVE,
  'Address not found': ErrorCode.TENANT_ADDRESS_NOT_FOUND,
  'Legal address cannot be a PO Box': ErrorCode.TENANT_ADDRESS_LEGAL_NO_PO_BOX,

  // Validation errors
  'No fields to update': ErrorCode.VALIDATION_NO_FIELDS_TO_UPDATE,

  // File errors
  'File not found': ErrorCode.FILE_NOT_FOUND,
};

/**
 * Get error code from exception message
 *
 * @param message - Exception message
 * @returns Error code enum value
 */
export function getErrorCodeFromMessage(message: string): ErrorCode {
  // Check for exact match
  if (ERROR_MESSAGE_TO_CODE_MAP[message]) {
    return ERROR_MESSAGE_TO_CODE_MAP[message];
  }

  // Check for partial matches (e.g., "EIN 12-3456789 is already registered...")
  if (message.includes('is already registered to another tenant')) {
    return ErrorCode.CONFLICT_EIN_EXISTS;
  }

  if (message.includes('Tenant with subdomain')) {
    return ErrorCode.TENANT_NOT_FOUND;
  }

  if (message.includes('Access denied. Required roles:')) {
    return ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS;
  }

  // Generic pattern matching for "not found" errors
  if (message.toLowerCase().includes('not found')) {
    return ErrorCode.RESOURCE_NOT_FOUND;
  }

  // Default fallback
  return ErrorCode.SERVER_INTERNAL_ERROR;
}
