import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ErrorResponse } from '../interfaces/error-response.interface';
import {
  ErrorCode,
  getErrorCodeFromMessage,
} from '../enums/error-codes.enum';
import { randomBytes } from 'crypto';

/**
 * Global Exception Filter
 *
 * Catches ALL unhandled exceptions (both HTTP and unexpected errors)
 * and returns a standardized error response format.
 *
 * Features:
 * - Consistent error response format
 * - Automatic error code mapping
 * - Request tracking with unique IDs
 * - Comprehensive error logging
 * - Security (doesn't expose internal errors in production)
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate unique request ID for tracking
    const requestId = this.generateRequestId();

    // Determine status code and error details
    const { statusCode, message, error, errorCode } =
      this.parseException(exception);

    // Build standardized error response
    const errorResponse: ErrorResponse = {
      statusCode,
      errorCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
    };

    // Log the error with context
    this.logError(exception, errorResponse, request);

    // Set CORS headers (critical for error responses)
    this.setCorsHeaders(response, request);

    // Send response
    response.status(statusCode).json(errorResponse);
  }

  /**
   * Parse exception to extract status, message, and error code
   */
  private parseException(exception: unknown): {
    statusCode: number;
    message: string;
    error: string;
    errorCode: ErrorCode;
  } {
    // Handle HttpException (NestJS exceptions)
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let errorCode: ErrorCode;

      // Extract message from exception response
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        'message' in exceptionResponse
      ) {
        const responseMessage = (exceptionResponse as any).message;
        message = Array.isArray(responseMessage)
          ? responseMessage.join(', ')
          : responseMessage;
      } else {
        message = 'An error occurred';
      }

      // Map message to error code
      errorCode = getErrorCodeFromMessage(message);

      return {
        statusCode: status,
        message,
        error: this.getHttpErrorName(status),
        errorCode,
      };
    }

    // Handle unexpected errors (500)
    this.logger.error(
      'Unexpected error caught by global filter:',
      exception instanceof Error ? exception.stack : exception,
    );

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message:
        process.env.NODE_ENV === 'production'
          ? 'Internal server error'
          : exception instanceof Error
            ? exception.message
            : 'An unexpected error occurred',
      error: 'Internal Server Error',
      errorCode: ErrorCode.SERVER_INTERNAL_ERROR,
    };
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
      502: 'Bad Gateway',
      503: 'Service Unavailable',
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
  private logError(
    exception: unknown,
    errorResponse: ErrorResponse,
    request: Request,
  ): void {
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

    // Log level based on status code
    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `[${errorResponse.errorCode}] ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : exception,
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
