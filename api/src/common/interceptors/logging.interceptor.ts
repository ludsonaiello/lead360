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
  private readonly logger = new Logger('RAW_REQUEST');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();

    // Only log PATCH /tenants/current
    if (request.method === 'PATCH' && request.url.includes('/tenants/current')) {
      this.logger.warn('========== RAW REQUEST BODY (BEFORE VALIDATION) ==========');
      this.logger.log(`URL: ${request.url}`);
      this.logger.log(`Method: ${request.method}`);
      this.logger.log('Body (RAW):');
      this.logger.log(JSON.stringify(request.body, null, 2));
      this.logger.log('Field breakdown:');
      for (const [key, value] of Object.entries(request.body || {})) {
        this.logger.log(`  ${key}: "${value}" (type: ${typeof value}, length: ${String(value).length})`);
      }
      this.logger.warn('===========================================================');
    }

    return next.handle();
  }
}
