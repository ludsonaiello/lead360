import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, query, params } = request;

    // Skip health check and static assets
    if (url === '/health' || url.startsWith('/api/docs')) {
      return next.handle();
    }

    // Log all API requests
    this.logger.log(`${method} ${url}`);

    // Log query parameters if present
    if (query && Object.keys(query).length > 0) {
      this.logger.log(`  Query: ${JSON.stringify(query)}`);
    }

    // Log path parameters if present
    if (params && Object.keys(params).length > 0) {
      this.logger.log(`  Params: ${JSON.stringify(params)}`);
    }

    // Log request body for POST, PATCH, PUT (exclude passwords)
    if (['POST', 'PATCH', 'PUT'].includes(method) && body && Object.keys(body).length > 0) {
      const sanitizedBody = { ...body };
      // Hide sensitive fields
      if (sanitizedBody.password) sanitizedBody.password = '***';
      if (sanitizedBody.current_password) sanitizedBody.current_password = '***';
      if (sanitizedBody.new_password) sanitizedBody.new_password = '***';

      this.logger.log(`  Body: ${JSON.stringify(sanitizedBody)}`);
    }

    return next.handle();
  }
}
