/**
 * Error Handling Utilities
 * Handles standardized error responses from Lead360 API
 * Updated to support new error code system (January 2026)
 */

/**
 * Backend Error Response Format
 * Matches the standardized format from backend ERROR_HANDLING.md
 */
export interface ErrorResponse {
  statusCode: number;
  errorCode: string;
  message: string;
  error: string;
  timestamp: string;
  path: string;
  requestId: string;
  validationErrors?: ValidationError[];
}

export interface ValidationError {
  field: string;
  message: string;
  constraints?: Record<string, string>;
  value?: any;
}

/**
 * Legacy error format (for backwards compatibility)
 */
export interface ApiError {
  status: number;
  message: string;
  error?: string;
  data?: any;
}

type ErrorContext =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'reset-password'
  | 'activate'
  | 'change-password'
  | 'profile'
  | 'subdomain';

/**
 * Get user-friendly error message based on error code and context
 * Uses new errorCode field from backend for precise error handling
 */
export function getUserFriendlyError(error: any, context?: ErrorContext): string {
  // Handle axios-like error objects
  if (error?.response) {
    const status = error.response.status;
    const data = error.response.data;
    return getMessageForError(status, data, context);
  }

  // Handle our custom error format
  if (error?.status) {
    return getMessageForError(error.status, error.data || error, context);
  }

  // Handle error strings
  if (typeof error === 'string') {
    return error;
  }

  // Handle Error objects
  if (error instanceof Error) {
    return error.message;
  }

  // Fallback
  return 'Something went wrong. Please try again.';
}

/**
 * Get error message using error code priority:
 * 1. Error code mapping (most specific)
 * 2. Backend message (if user-friendly)
 * 3. Context-specific fallback
 * 4. Generic status code fallback
 */
function getMessageForError(status: number, data: any, context?: ErrorContext): string {
  // PRIORITY 1: Use error code for precise handling
  if (data?.errorCode) {
    const codeMessage = getMessageForErrorCode(data.errorCode, context);
    if (codeMessage) {
      return codeMessage;
    }
  }

  // PRIORITY 2: Use backend message if available and user-friendly
  if (data?.message && isUserFriendlyMessage(data.message)) {
    return Array.isArray(data.message) ? data.message.join(', ') : data.message;
  }

  // PRIORITY 3: Context-specific messages
  const contextMessages = getContextualMessage(status, context);
  if (contextMessages) {
    return contextMessages;
  }

  // PRIORITY 4: Generic status code messages
  return getGenericMessageForStatus(status);
}

/**
 * Error code to user message mapping
 * Based on ERROR_HANDLING.md specification
 */
function getMessageForErrorCode(errorCode: string, context?: ErrorContext): string | null {
  const errorCodeMap: Record<string, string> = {
    // Authentication & Authorization
    AUTH_INVALID_CREDENTIALS: 'Invalid email or password. Please check your credentials and try again.',
    AUTH_ACCOUNT_NOT_ACTIVATED:
      'Your account is not activated yet. Please check your email for the activation link.',
    AUTH_EMAIL_NOT_VERIFIED: 'Please verify your email address. Check your email for the verification link.',
    AUTH_USER_NOT_FOUND: 'User not found. Please check your credentials.',
    AUTH_TOKEN_INVALID: 'Your session has expired. Please log in again.',
    AUTH_REFRESH_TOKEN_INVALID: 'Your session has expired. Please log in again.',
    AUTH_RESET_TOKEN_INVALID: 'Your password reset link is invalid or has expired. Please request a new one.',
    AUTH_ACTIVATION_TOKEN_INVALID: 'Your activation link is invalid or has expired. Please request a new one.',
    AUTH_CURRENT_PASSWORD_INCORRECT: 'Your current password is incorrect. Please try again.',
    AUTH_PASSWORD_SAME_AS_CURRENT: 'Your new password must be different from your current password.',
    AUTH_INSUFFICIENT_PERMISSIONS: 'You don\'t have permission to perform this action.',
    AUTH_NOT_AUTHENTICATED: 'You are not logged in. Please log in to continue.',
    AUTH_SESSION_NOT_FOUND: 'Your session has expired. Please log in again.',

    // Resource Conflicts
    CONFLICT_EMAIL_EXISTS: 'This email is already registered. Please log in or use a different email.',
    CONFLICT_SUBDOMAIN_EXISTS: 'This subdomain is already taken. Please choose another one.',
    CONFLICT_EIN_EXISTS: 'This EIN is already registered to another business.',
    CONFLICT_ACCOUNT_ALREADY_ACTIVATED: 'Your account is already activated. You can log in now.',

    // Tenant & Multi-Tenancy
    TENANT_NOT_FOUND: 'Business not found.',
    TENANT_INACTIVE: 'This business account is currently inactive. Please contact support.',
    TENANT_SUBDOMAIN_RESERVED: 'This subdomain is reserved and cannot be used. Please choose another one.',
    TENANT_ADDRESS_NOT_FOUND: 'Address not found.',
    TENANT_ADDRESS_LEGAL_NO_PO_BOX: 'Legal address cannot be a PO Box. Please enter a physical address.',

    // Validation
    VALIDATION_FAILED: 'Please check all fields and correct any errors.',
    VALIDATION_INVALID_INPUT: 'The information you provided is invalid. Please check your input.',
    VALIDATION_REQUIRED_FIELD: 'Please fill in all required fields.',
    VALIDATION_NO_FIELDS_TO_UPDATE: 'No changes were made. Please update at least one field.',

    // Server Errors
    SERVER_INTERNAL_ERROR: 'Our server encountered an error. Please try again in a few moments.',
    SERVER_DATABASE_ERROR: 'A database error occurred. Please try again in a few moments.',
    SERVER_EXTERNAL_SERVICE_ERROR: 'An external service is currently unavailable. Please try again later.',
  };

  return errorCodeMap[errorCode] || null;
}

/**
 * Get contextual error messages (legacy support)
 * Fallback for when error codes aren't available
 */
function getContextualMessage(status: number, context?: ErrorContext): string | null {
  if (!context) return null;

  const contextMap: Record<string, Record<number, string>> = {
    login: {
      400: 'Please enter a valid email and password.',
      401: 'Invalid email or password. Please check your credentials and try again.',
      403: 'Your account is not activated yet. Please check your email for the activation link.',
      429: 'Too many login attempts. Please wait a few minutes before trying again.',
    },
    register: {
      400: 'Please check all fields. Make sure your password meets the requirements.',
      409: 'This email is already registered. Please log in or use a different email.',
      422: 'Please fill out all required fields correctly.',
    },
    'forgot-password': {
      400: 'Please enter a valid email address.',
      404: 'If an account exists with this email, you will receive a password reset link shortly.',
      429: 'Too many requests. Please wait a few minutes before trying again.',
    },
    'reset-password': {
      400: 'Your password reset link is invalid or has expired. Please request a new one.',
      422: 'Please make sure your password meets all requirements.',
    },
    activate: {
      400: 'Your activation link is invalid or has expired. Please request a new one.',
      404: 'Your activation link is invalid. Please contact support if you need help.',
      410: 'This account has already been activated. You can log in now.',
    },
    'change-password': {
      400: 'Please make sure your new password meets all requirements.',
      401: 'Your current password is incorrect. Please try again.',
      422: 'Please make sure your new password meets all requirements.',
    },
    profile: {
      400: 'Please check all fields and try again.',
      422: 'Please fill out all required fields correctly.',
    },
    subdomain: {
      400: 'Please enter a valid subdomain (letters, numbers, and hyphens only).',
      409: 'This subdomain is already taken. Please choose another one.',
    },
  };

  return contextMap[context]?.[status] || null;
}

/**
 * Generic status code messages (final fallback)
 */
function getGenericMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'The information you provided is invalid. Please check your input and try again.';

    case 401:
      return 'Your session has expired. Please log in again.';

    case 403:
      return 'You don\'t have permission to perform this action.';

    case 404:
      return 'The requested information could not be found.';

    case 409:
      return 'This action conflicts with existing data. Please try again.';

    case 422:
      return 'The information you provided couldn\'t be processed. Please check all fields and try again.';

    case 429:
      return 'Too many attempts. Please wait a few minutes before trying again.';

    case 500:
      return 'Our server encountered an error. Please try again in a few moments.';

    case 502:
    case 503:
    case 504:
      return 'Our service is temporarily unavailable. Please try again in a few moments.';

    case 0:
      return 'Unable to connect. Please check your internet connection and try again.';

    default:
      return 'Something went wrong. Please try again.';
  }
}

/**
 * Check if a message is user-friendly (not technical jargon)
 */
function isUserFriendlyMessage(message: string): boolean {
  // Messages that are too technical
  const technicalPatterns = [
    /validation failed/i,
    /internal server error/i,
    /syntax error/i,
    /undefined/i,
    /null reference/i,
    /stack trace/i,
    /exception/i,
    /error code/i,
  ];

  // If message contains technical patterns, it's not user-friendly
  return !technicalPatterns.some((pattern) => pattern.test(message));
}

/**
 * Extract validation errors from API response
 * Updated to handle new validationErrors format
 */
export function getValidationErrors(error: any): Record<string, string> | null {
  const errors: Record<string, string> = {};

  // New format: validationErrors array
  const data = error?.response?.data || error?.data || error;
  if (data?.validationErrors && Array.isArray(data.validationErrors)) {
    data.validationErrors.forEach((validationError: ValidationError) => {
      errors[validationError.field] = validationError.message;
    });
  }

  // Legacy format: errors object
  else if (data?.errors && typeof data.errors === 'object') {
    Object.keys(data.errors).forEach((field) => {
      const messages = data.errors[field];
      if (Array.isArray(messages)) {
        errors[field] = messages[0]; // Take first error message
      } else if (typeof messages === 'string') {
        errors[field] = messages;
      }
    });
  }

  return Object.keys(errors).length > 0 ? errors : null;
}

/**
 * Format error for display in modal/toast
 * Enhanced to use error codes for better UX
 */
export function formatErrorForDisplay(
  error: any,
  context?: ErrorContext
): {
  title: string;
  message: string;
  action?: string;
  requestId?: string;
  errorCode?: string;
} {
  const message = getUserFriendlyError(error, context);
  const data = error?.response?.data || error?.data || error;
  const status = error?.status || error?.response?.status || data?.statusCode;
  const errorCode = data?.errorCode;
  const requestId = data?.requestId;

  // Determine title based on error code first, then status
  let title = 'Error';

  if (errorCode) {
    title = getTitleForErrorCode(errorCode, context);
  } else if (status === 401 && context === 'login') {
    title = 'Login Failed';
  } else if (status === 403 && context === 'login') {
    title = 'Account Activation Required';
  } else if (status === 401) {
    title = 'Session Expired';
  } else if (status === 403) {
    title = 'Access Denied';
  } else if (status === 404) {
    title = 'Not Found';
  } else if (status === 409) {
    title = 'Conflict';
  } else if (status === 429) {
    title = 'Too Many Requests';
  } else if (status >= 500) {
    title = 'Server Error';
  } else if (status === 0) {
    title = 'Connection Error';
  } else if (context) {
    title =
      context
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') + ' Error';
  }

  // Determine action button text
  let action = 'Try Again';
  if (status === 401 && context !== 'login') {
    action = 'Log In';
  } else if (status === 403) {
    action = 'Go Back';
  } else if (status === 429) {
    action = 'OK';
  } else if (errorCode === 'AUTH_ACCOUNT_NOT_ACTIVATED') {
    action = 'Resend Activation';
  } else if (errorCode === 'AUTH_EMAIL_NOT_VERIFIED') {
    action = 'Resend Verification';
  }

  return { title, message, action, requestId, errorCode };
}

/**
 * Get appropriate title for error code
 */
function getTitleForErrorCode(errorCode: string, context?: ErrorContext): string {
  // Authentication errors
  if (errorCode.startsWith('AUTH_')) {
    if (errorCode === 'AUTH_INVALID_CREDENTIALS') return 'Login Failed';
    if (errorCode === 'AUTH_ACCOUNT_NOT_ACTIVATED') return 'Account Activation Required';
    if (errorCode === 'AUTH_EMAIL_NOT_VERIFIED') return 'Email Verification Required';
    if (errorCode === 'AUTH_TOKEN_INVALID' || errorCode === 'AUTH_REFRESH_TOKEN_INVALID')
      return 'Session Expired';
    if (errorCode === 'AUTH_RESET_TOKEN_INVALID') return 'Invalid Reset Link';
    if (errorCode === 'AUTH_ACTIVATION_TOKEN_INVALID') return 'Invalid Activation Link';
    if (errorCode === 'AUTH_INSUFFICIENT_PERMISSIONS') return 'Access Denied';
    if (errorCode === 'AUTH_NOT_AUTHENTICATED') return 'Not Logged In';
    return 'Authentication Error';
  }

  // Conflict errors
  if (errorCode.startsWith('CONFLICT_')) {
    if (errorCode === 'CONFLICT_EMAIL_EXISTS') return 'Email Already Registered';
    if (errorCode === 'CONFLICT_SUBDOMAIN_EXISTS') return 'Subdomain Taken';
    if (errorCode === 'CONFLICT_ACCOUNT_ALREADY_ACTIVATED') return 'Already Activated';
    return 'Conflict';
  }

  // Tenant errors
  if (errorCode.startsWith('TENANT_')) {
    if (errorCode === 'TENANT_NOT_FOUND') return 'Business Not Found';
    if (errorCode === 'TENANT_INACTIVE') return 'Business Inactive';
    return 'Business Error';
  }

  // Validation errors
  if (errorCode.startsWith('VALIDATION_')) {
    return 'Validation Error';
  }

  // Server errors
  if (errorCode.startsWith('SERVER_')) {
    return 'Server Error';
  }

  return 'Error';
}

/**
 * Check if error is a specific error code
 * Useful for conditional logic in components
 */
export function isErrorCode(error: any, code: string): boolean {
  const data = error?.response?.data || error?.data || error;
  return data?.errorCode === code;
}

/**
 * Get request ID from error for debugging
 */
export function getRequestId(error: any): string | null {
  const data = error?.response?.data || error?.data || error;
  return data?.requestId || null;
}
