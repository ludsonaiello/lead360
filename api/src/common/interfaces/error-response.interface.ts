import { ErrorCode } from '../enums/error-codes.enum';

/**
 * Standardized Error Response Interface
 *
 * All API errors return this consistent format to make
 * frontend error handling predictable and reliable.
 */
export interface ErrorResponse {
  /**
   * HTTP status code (400, 401, 403, 404, 409, 500, etc.)
   */
  statusCode: number;

  /**
   * Machine-readable error code for programmatic handling
   * @example "AUTH_INVALID_CREDENTIALS", "TENANT_NOT_FOUND"
   */
  errorCode: ErrorCode;

  /**
   * Human-readable error message (can be shown to user)
   * @example "Invalid email or password"
   */
  message: string;

  /**
   * HTTP error name (Bad Request, Unauthorized, etc.)
   */
  error: string;

  /**
   * ISO 8601 timestamp when the error occurred
   * @example "2026-01-02T10:30:00.000Z"
   */
  timestamp: string;

  /**
   * API endpoint path that caused the error
   * @example "/api/v1/auth/login"
   */
  path: string;

  /**
   * Unique request ID for tracking/debugging
   * @example "req_abc123def456"
   */
  requestId: string;

  /**
   * Validation errors (only present for 400 validation errors)
   */
  validationErrors?: ValidationError[];
}

/**
 * Validation Error Detail
 *
 * Used when DTO validation fails to show which fields
 * have issues and what the constraints are.
 */
export interface ValidationError {
  /**
   * Field name that failed validation
   * @example "email", "password", "phone"
   */
  field: string;

  /**
   * Human-readable error message for this field
   * @example "Email must be a valid email address"
   */
  message: string;

  /**
   * Validation constraints that failed
   * @example { "isEmail": "email must be an email" }
   */
  constraints?: Record<string, string>;

  /**
   * The value that was rejected (omitted for sensitive fields like passwords)
   */
  value?: any;
}
