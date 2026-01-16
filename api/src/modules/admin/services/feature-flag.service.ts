import {
  Injectable,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

interface FeatureFlagCache {
  [flagKey: string]: {
    isEnabled: boolean;
    timestamp: number;
  };
}

@Injectable()
export class FeatureFlagService {
  private readonly logger = new Logger(FeatureFlagService.name);
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private cache: FeatureFlagCache = {};

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Check if feature flag is enabled (with caching)
   */
  async isEnabled(flagKey: string): Promise<boolean> {
    try {
      // Check cache first
      const cached = this.cache[flagKey];
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
        return cached.isEnabled;
      }

      // Cache miss or expired - fetch from database
      const flag = await this.prisma.feature_flag.findUnique({
        where: { flag_key: flagKey },
        select: { is_enabled: true },
      });

      if (!flag) {
        this.logger.warn(`Feature flag not found: ${flagKey}`);
        return false; // Default to disabled if flag doesn't exist
      }

      // Update cache
      this.cache[flagKey] = {
        isEnabled: flag.is_enabled,
        timestamp: Date.now(),
      };

      return flag.is_enabled;
    } catch (error) {
      this.logger.error(`Failed to check feature flag ${flagKey}: ${error.message}`, error.stack);
      return false; // Fail safely - default to disabled
    }
  }

  /**
   * Toggle feature flag on/off
   */
  async toggleFlag(flagKey: string, adminUserId: string) {
    try {
      const flag = await this.prisma.feature_flag.findUnique({
        where: { flag_key: flagKey },
      });

      if (!flag) {
        throw new NotFoundException(`Feature flag '${flagKey}' not found`);
      }

      const beforeState = { is_enabled: flag.is_enabled };
      const newState = !flag.is_enabled;

      // Update flag
      const updatedFlag = await this.prisma.feature_flag.update({
        where: { flag_key: flagKey },
        data: {
          is_enabled: newState,
          updated_at: new Date(),
          updated_by_user_id: adminUserId,
        },
      });

      // Invalidate cache for this flag
      delete this.cache[flagKey];

      // Audit log
      await this.auditLogger.log({
        tenant_id: undefined, // Platform-level action
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'feature_flag',
        entity_id: flag.id,
        action_type: 'updated',
        description: `Feature flag '${flagKey}' toggled from ${beforeState.is_enabled} to ${newState}`,
        before_json: beforeState,
        after_json: { is_enabled: newState },
        status: 'success',
      });

      this.logger.log(`Feature flag '${flagKey}' toggled to ${newState} by admin ${adminUserId}`);

      return updatedFlag;
    } catch (error) {
      this.logger.error(`Failed to toggle feature flag: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get all feature flags
   */
  async listFlags() {
    try {
      const flags = await this.prisma.feature_flag.findMany({
        orderBy: { flag_key: 'asc' },
        include: {
          updated_by_user: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      });

      return flags.map((flag) => ({
        id: flag.id,
        flag_key: flag.flag_key,
        name: flag.name,
        description: flag.description,
        is_enabled: flag.is_enabled,
        updated_at: flag.updated_at,
        updated_by: flag.updated_by_user
          ? {
              id: flag.updated_by_user.id,
              email: flag.updated_by_user.email,
              name: `${flag.updated_by_user.first_name} ${flag.updated_by_user.last_name}`,
            }
          : null,
      }));
    } catch (error) {
      this.logger.error(`Failed to list feature flags: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update feature flag settings
   */
  async updateFlag(flagKey: string, updateDto: any, adminUserId: string) {
    try {
      const flag = await this.prisma.feature_flag.findUnique({
        where: { flag_key: flagKey },
      });

      if (!flag) {
        throw new NotFoundException(`Feature flag '${flagKey}' not found`);
      }

      const beforeState = {
        name: flag.name,
        description: flag.description,
        is_enabled: flag.is_enabled,
      };

      // Update flag
      const updatedFlag = await this.prisma.feature_flag.update({
        where: { flag_key: flagKey },
        data: {
          ...(updateDto.name !== undefined && { name: updateDto.name }),
          ...(updateDto.description !== undefined && { description: updateDto.description }),
          ...(updateDto.is_enabled !== undefined && { is_enabled: updateDto.is_enabled }),
          updated_at: new Date(),
          updated_by_user_id: adminUserId,
        },
      });

      // Invalidate cache for this flag
      delete this.cache[flagKey];

      // Audit log
      await this.auditLogger.log({
        tenant_id: undefined, // Platform-level action
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'feature_flag',
        entity_id: flag.id,
        action_type: 'updated',
        description: `Feature flag '${flagKey}' updated`,
        before_json: beforeState,
        after_json: {
          name: updatedFlag.name,
          description: updatedFlag.description,
          is_enabled: updatedFlag.is_enabled,
        },
        status: 'success',
      });

      this.logger.log(`Feature flag '${flagKey}' updated by admin ${adminUserId}`);

      return updatedFlag;
    } catch (error) {
      this.logger.error(`Failed to update feature flag: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Clear entire cache (utility method for testing or manual cache invalidation)
   */
  clearCache() {
    this.cache = {};
    this.logger.log('Feature flag cache cleared');
  }
}
