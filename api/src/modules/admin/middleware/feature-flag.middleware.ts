import {
  Injectable,
  NestMiddleware,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { FeatureFlagService } from '../services/feature-flag.service';

/**
 * Feature Flag Middleware
 *
 * Checks feature flags before processing tenant requests.
 * Blocks requests to disabled features globally.
 *
 * Applied globally to check specific features based on route patterns.
 */
@Injectable()
export class FeatureFlagMiddleware implements NestMiddleware {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    // Skip admin routes (admins can access everything)
    if (req.path.startsWith('/admin') || req.path.startsWith('/api/v1/admin')) {
      return next();
    }

    try {
      // Check file storage feature flag
      if (req.path.startsWith('/files') || req.path.startsWith('/api/v1/files')) {
        const fileStorageEnabled = await this.featureFlagService.isEnabled('file_storage');
        if (!fileStorageEnabled) {
          throw new ServiceUnavailableException(
            'File storage is currently disabled. Please contact support.',
          );
        }
      }

      // Check user registration feature flag
      if (
        (req.path.startsWith('/auth/register') || req.path.startsWith('/api/v1/auth/register')) &&
        req.method === 'POST'
      ) {
        const registrationEnabled = await this.featureFlagService.isEnabled('user_registration');
        if (!registrationEnabled) {
          throw new ServiceUnavailableException(
            'New user registration is currently closed. Please try again later.',
          );
        }
      }

      // Check background jobs feature flag (for job-related endpoints)
      if (req.path.startsWith('/jobs') || req.path.startsWith('/api/v1/jobs')) {
        const jobsEnabled = await this.featureFlagService.isEnabled('background_jobs');
        if (!jobsEnabled) {
          throw new ServiceUnavailableException(
            'Background job processing is currently disabled.',
          );
        }
      }

      // Check API access feature flag (global kill switch)
      const apiAccessEnabled = await this.featureFlagService.isEnabled('api_access');
      if (!apiAccessEnabled) {
        throw new ServiceUnavailableException(
          'API access is currently disabled for maintenance. Please try again later.',
        );
      }

      next();
    } catch (error) {
      // If it's already a ServiceUnavailableException, re-throw it
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      // For other errors, log and allow request to proceed (fail-open for availability)
      console.error('Feature flag check failed:', error.message);
      next();
    }
  }
}
