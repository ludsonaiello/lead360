import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

interface MaintenanceModeCache {
  config: any;
  timestamp: number;
}

@Injectable()
export class MaintenanceModeService {
  private readonly logger = new Logger(MaintenanceModeService.name);
  private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
  private cache: MaintenanceModeCache | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Check if currently in maintenance mode (with caching)
   */
  async isInMaintenanceMode(): Promise<boolean> {
    try {
      const config = await this.getMaintenanceConfig();

      if (!config.is_enabled) {
        return false;
      }

      // If immediate mode, return true
      if (config.mode === 'immediate') {
        return true;
      }

      // If scheduled mode, check time range
      if (config.mode === 'scheduled') {
        const now = new Date();
        const startTime = config.start_time
          ? new Date(config.start_time)
          : null;
        const endTime = config.end_time ? new Date(config.end_time) : null;

        if (startTime && endTime) {
          return now >= startTime && now <= endTime;
        }
      }

      return false;
    } catch (error) {
      this.logger.error(
        `Failed to check maintenance mode: ${error.message}`,
        error.stack,
      );
      return false; // Fail safely - default to not in maintenance
    }
  }

  /**
   * Get current maintenance mode configuration (with caching)
   */
  async getMaintenanceConfig() {
    try {
      // Check cache first
      if (this.cache && Date.now() - this.cache.timestamp < this.CACHE_TTL_MS) {
        return this.cache.config;
      }

      // Cache miss or expired - fetch from database (singleton record)
      const config = await this.prisma.maintenance_mode.findFirst({
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

      if (!config) {
        // If no record exists, create default one
        const defaultConfig = await this.prisma.maintenance_mode.create({
          data: {
            is_enabled: false,
            mode: 'immediate',
            message:
              "Lead360 is undergoing maintenance. We'll be back shortly.",
            updated_at: new Date(),
          },
        });

        this.cache = {
          config: defaultConfig,
          timestamp: Date.now(),
        };

        return defaultConfig;
      }

      // Update cache
      this.cache = {
        config,
        timestamp: Date.now(),
      };

      return config;
    } catch (error) {
      this.logger.error(
        `Failed to get maintenance config: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Update maintenance mode settings
   */
  async updateMaintenanceMode(updateDto: any, adminUserId: string) {
    try {
      // Get current config (singleton)
      const currentConfig = await this.getMaintenanceConfig();

      const beforeState = {
        is_enabled: currentConfig.is_enabled,
        mode: currentConfig.mode,
        start_time: currentConfig.start_time,
        end_time: currentConfig.end_time,
        message: currentConfig.message,
        allowed_ips: currentConfig.allowed_ips,
      };

      // Update maintenance mode
      const updatedConfig = await this.prisma.maintenance_mode.update({
        where: { id: currentConfig.id },
        data: {
          ...(updateDto.is_enabled !== undefined && {
            is_enabled: updateDto.is_enabled,
          }),
          ...(updateDto.mode !== undefined && { mode: updateDto.mode }),
          ...(updateDto.start_time !== undefined && {
            start_time: updateDto.start_time
              ? new Date(updateDto.start_time)
              : null,
          }),
          ...(updateDto.end_time !== undefined && {
            end_time: updateDto.end_time ? new Date(updateDto.end_time) : null,
          }),
          ...(updateDto.message !== undefined && {
            message: updateDto.message,
          }),
          ...(updateDto.allowed_ips !== undefined && {
            allowed_ips: updateDto.allowed_ips,
          }),
          updated_at: new Date(),
          updated_by_user_id: adminUserId,
        },
      });

      // Invalidate cache
      this.cache = null;

      // Audit log
      await this.auditLogger.log({
        tenant_id: undefined, // Platform-level action
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'maintenance_mode',
        entity_id: currentConfig.id,
        action_type: 'updated',
        description: `Maintenance mode ${updatedConfig.is_enabled ? 'enabled' : 'disabled'}`,
        before_json: beforeState,
        after_json: {
          is_enabled: updatedConfig.is_enabled,
          mode: updatedConfig.mode,
          start_time: updatedConfig.start_time,
          end_time: updatedConfig.end_time,
          message: updatedConfig.message,
          allowed_ips: updatedConfig.allowed_ips,
        },
        status: 'success',
      });

      this.logger.log(
        `Maintenance mode ${updatedConfig.is_enabled ? 'enabled' : 'disabled'} by admin ${adminUserId}`,
      );

      return updatedConfig;
    } catch (error) {
      this.logger.error(
        `Failed to update maintenance mode: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Auto-disable maintenance mode (called by background job when scheduled end time is reached)
   */
  async disableMaintenanceMode() {
    try {
      const config = await this.getMaintenanceConfig();

      if (!config.is_enabled) {
        return; // Already disabled
      }

      // Check if scheduled mode and past end time
      if (config.mode === 'scheduled' && config.end_time) {
        const now = new Date();
        const endTime = new Date(config.end_time);

        if (now > endTime) {
          // Auto-disable
          const updatedConfig = await this.prisma.maintenance_mode.update({
            where: { id: config.id },
            data: {
              is_enabled: false,
              updated_at: new Date(),
            },
          });

          // Invalidate cache
          this.cache = null;

          // Audit log (system action)
          await this.auditLogger.log({
            tenant_id: undefined,
            actor_user_id: undefined,
            actor_type: 'system',
            entity_type: 'maintenance_mode',
            entity_id: config.id,
            action_type: 'updated',
            description:
              'Maintenance mode auto-disabled after scheduled end time',
            before_json: { is_enabled: true },
            after_json: { is_enabled: false },
            status: 'success',
          });

          this.logger.log(
            'Maintenance mode auto-disabled after scheduled end time',
          );

          return updatedConfig;
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to auto-disable maintenance mode: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Clear cache (utility method for testing or manual cache invalidation)
   */
  clearCache() {
    this.cache = null;
    this.logger.log('Maintenance mode cache cleared');
  }
}
