import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { Request, Response } from 'express';
import {
  ErrorResponse,
  ValidationError,
} from '../interfaces/error-response.interface';
import {
  ErrorCode,
  getErrorCodeFromMessage,
} from '../enums/error-codes.enum';
import { randomBytes } from 'crypto';

/**
 * HTTP Exception Filter
 *
 * Specialized filter for HttpException instances.
 * Handles validation errors from class-validator with detailed field-level errors.
 *
 * This filter runs BEFORE GlobalExceptionFilter and provides
 * better formatting for validation errors.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Generate unique request ID
    const requestId = this.generateRequestId();

    // Check if this is a validation error (class-validator)
    const isValidationError =
      exception instanceof BadRequestException &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse &&
      Array.isArray((exceptionResponse as any).message);

    let errorResponse: ErrorResponse;

    if (isValidationError) {
      // Handle validation errors with detailed field information
      errorResponse = this.buildValidationErrorResponse(
        statusCode,
        exceptionResponse,
        request,
        requestId,
      );
    } else {
      // Handle standard HTTP exceptions
      errorResponse = this.buildStandardErrorResponse(
        statusCode,
        exceptionResponse,
        request,
        requestId,
      );
    }

    // Log the error
    this.logError(errorResponse, request);

    // Set CORS headers (critical for error responses)
    this.setCorsHeaders(response, request);

    // Send response
    response.status(statusCode).json(errorResponse);
  }

  /**
   * Build error response for validation errors
   */
  private buildValidationErrorResponse(
    statusCode: number,
    exceptionResponse: any,
    request: Request,
    requestId: string,
  ): ErrorResponse {
    const validationMessages = exceptionResponse.message as any[];
    const validationErrors: ValidationError[] = [];

    // Parse class-validator error messages
    validationMessages.forEach((item) => {
      if (typeof item === 'string') {
        // Simple string message
        validationErrors.push({
          field: 'unknown',
          message: item,
        });
      } else if (typeof item === 'object' && item.property) {
        // Structured validation error from class-validator
        const constraints = item.constraints || {};
        const messages = Object.values(constraints);

        validationErrors.push({
          field: item.property,
          message: messages[0] as string,
          constraints,
          value: this.shouldIncludeValue(item.property) ? item.value : undefined,
        });
      }
    });

    return {
      statusCode,
      errorCode: ErrorCode.VALIDATION_FAILED,
      message: 'Validation failed',
      error: 'Bad Request',
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      validationErrors,
    };
  }

  /**
   * Build error response for standard HTTP exceptions
   */
  private buildStandardErrorResponse(
    statusCode: number,
    exceptionResponse: any,
    request: Request,
    requestId: string,
  ): ErrorResponse {
    let message: string;

    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      const responseMessage = exceptionResponse.message;
      message = Array.isArray(responseMessage)
        ? responseMessage.join(', ')
        : responseMessage;
    } else {
      message = 'An error occurred';
    }

    // Map message to error code
    const errorCode = getErrorCodeFromMessage(message);

    return {
      statusCode,
      errorCode,
      message,
      error: this.getHttpErrorName(statusCode),
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };
  }

  /**
   * Determine if field value should be included in response
   * (exclude sensitive fields like passwords)
   */
  private shouldIncludeValue(fieldName: string): boolean {
    const sensitiveFields = [
      'password',
      'currentPassword',
      'newPassword',
      'confirmPassword',
      'token',
      'secret',
      'apiKey',
      'refreshToken',
      'accessToken',
    ];

    return !sensitiveFields.includes(fieldName);
  }

  /**
   * Get HTTP error name from status code
   */
  private getHttpErrorName(statusCode: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      409: 'Conflict',
      422: 'Unprocessable Entity',
      500: 'Internal Server Error',
    };

    return errorNames[statusCode] || 'Error';
  }

  /**
   * Generate unique request ID using crypto.randomBytes
   */
  private generateRequestId(): string {
    return `req_${randomBytes(8).toString('hex')}`;
  }

  /**
   * Set CORS headers on error responses
   * This is critical - without these headers, browsers will block error responses
   */
  private setCorsHeaders(response: Response, request: Request): void {
    const origin = request.get('origin');
    const allowedOrigins = [
      'https://app.lead360.app',
      'http://localhost:3000',
    ];

    // Check if origin is allowed (exact match or subdomain match)
    const isAllowed =
      origin &&
      (allowedOrigins.includes(origin) || /\.lead360\.app$/.test(origin));

    if (isAllowed) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      );
      response.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization',
      );
    }
  }

  /**
   * Log error with context
   */
  private logError(errorResponse: ErrorResponse, request: Request): void {
    const logContext = {
      requestId: errorResponse.requestId,
      statusCode: errorResponse.statusCode,
      errorCode: errorResponse.errorCode,
      method: request.method,
      path: request.url,
      ip: request.ip,
      userAgent: request.get('user-agent'),
      userId: (request as any).user?.id,
      tenantId: (request as any).tenant_id,
    };

    // Log based on severity
    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `[${errorResponse.errorCode}] ${errorResponse.message}`,
        JSON.stringify(logContext),
      );
    } else if (errorResponse.statusCode >= 400) {
      this.logger.warn(
        `[${errorResponse.errorCode}] ${errorResponse.message}`,
        JSON.stringify(logContext),
      );
    }
  }
}
