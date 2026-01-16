import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';

@Injectable()
export class SystemSettingService {
  private readonly logger = new Logger(SystemSettingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogger: AuditLoggerService,
  ) {}

  /**
   * Get setting value (typed based on data_type)
   */
  async getSetting(key: string): Promise<any> {
    try {
      const setting = await this.prisma.system_setting.findUnique({
        where: { setting_key: key },
      });

      if (!setting) {
        throw new NotFoundException(`Setting '${key}' not found`);
      }

      return this.parseSettingValue(setting.setting_value, setting.data_type);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.logger.error(`Failed to get setting ${key}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Set setting value
   */
  async setSetting(key: string, value: any, adminUserId: string) {
    try {
      const setting = await this.prisma.system_setting.findUnique({
        where: { setting_key: key },
      });

      if (!setting) {
        throw new NotFoundException(`Setting '${key}' not found`);
      }

      // Validate value based on data type
      const stringValue = this.validateAndStringify(value, setting.data_type);

      const beforeState = {
        setting_value: setting.setting_value,
      };

      // Update setting
      const updatedSetting = await this.prisma.system_setting.update({
        where: { setting_key: key },
        data: {
          setting_value: stringValue,
          updated_at: new Date(),
          updated_by_user_id: adminUserId,
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: undefined, // Platform-level action
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'system_setting',
        entity_id: setting.id,
        action_type: 'updated',
        description: `System setting '${key}' updated`,
        before_json: beforeState,
        after_json: { setting_value: stringValue },
        status: 'success',
      });

      this.logger.log(`System setting '${key}' updated by admin ${adminUserId}`);

      return {
        id: updatedSetting.id,
        setting_key: updatedSetting.setting_key,
        setting_value: this.parseSettingValue(updatedSetting.setting_value, updatedSetting.data_type),
        data_type: updatedSetting.data_type,
        description: updatedSetting.description,
        updated_at: updatedSetting.updated_at,
      };
    } catch (error) {
      this.logger.error(`Failed to set setting ${key}: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * List all settings grouped by category
   */
  async listSettings() {
    try {
      const settings = await this.prisma.system_setting.findMany({
        orderBy: { setting_key: 'asc' },
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

      // Group settings by prefix (e.g., 'max_', 'password_', 'account_', 'job_', 'audit_')
      const grouped: Record<string, any[]> = {
        file_storage: [],
        session: [],
        password: [],
        account_security: [],
        job_management: [],
        audit: [],
        other: [],
      };

      settings.forEach((setting) => {
        const settingData = {
          id: setting.id,
          setting_key: setting.setting_key,
          setting_value: this.parseSettingValue(setting.setting_value, setting.data_type),
          data_type: setting.data_type,
          description: setting.description,
          updated_at: setting.updated_at,
          updated_by: setting.updated_by_user
            ? {
                id: setting.updated_by_user.id,
                email: setting.updated_by_user.email,
                name: `${setting.updated_by_user.first_name} ${setting.updated_by_user.last_name}`,
              }
            : null,
        };

        if (setting.setting_key.startsWith('max_file_') || setting.setting_key.startsWith('max_storage_')) {
          grouped.file_storage.push(settingData);
        } else if (setting.setting_key.startsWith('session_')) {
          grouped.session.push(settingData);
        } else if (setting.setting_key.startsWith('password_')) {
          grouped.password.push(settingData);
        } else if (
          setting.setting_key.startsWith('max_failed_') ||
          setting.setting_key.startsWith('account_lockout_')
        ) {
          grouped.account_security.push(settingData);
        } else if (setting.setting_key.startsWith('job_')) {
          grouped.job_management.push(settingData);
        } else if (setting.setting_key.startsWith('audit_')) {
          grouped.audit.push(settingData);
        } else {
          grouped.other.push(settingData);
        }
      });

      return grouped;
    } catch (error) {
      this.logger.error(`Failed to list settings: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Update multiple settings (bulk update)
   */
  async updateSettings(
    settings: Array<{ key: string; value: any }>,
    adminUserId: string,
  ) {
    try {
      const results: Array<{ key: string; success: boolean; result?: any; error?: string }> = [];

      for (const { key, value } of settings) {
        try {
          const result = await this.setSetting(key, value, adminUserId);
          results.push({ key, success: true, result });
        } catch (error) {
          results.push({
            key,
            success: false,
            error: error.message,
          });
          this.logger.error(`Failed to update setting ${key}: ${error.message}`);
        }
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      this.logger.log(
        `Bulk update: ${successCount} succeeded, ${failureCount} failed`,
      );

      return {
        total: settings.length,
        succeeded: successCount,
        failed: failureCount,
        results,
      };
    } catch (error) {
      this.logger.error(`Failed to update settings: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Parse setting value based on data type
   */
  private parseSettingValue(value: string, dataType: string): any {
    switch (dataType) {
      case 'integer':
        return parseInt(value, 10);
      case 'boolean':
        return value === 'true' || value === '1';
      case 'json':
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      case 'string':
      default:
        return value;
    }
  }

  /**
   * Validate and convert value to string for storage
   */
  private validateAndStringify(value: any, dataType: string): string {
    switch (dataType) {
      case 'integer':
        const intValue = parseInt(value, 10);
        if (isNaN(intValue)) {
          throw new BadRequestException(`Value must be a valid integer`);
        }
        return intValue.toString();

      case 'boolean':
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false' && value !== 1 && value !== 0) {
          throw new BadRequestException(`Value must be a boolean`);
        }
        return value === true || value === 'true' || value === 1 ? 'true' : 'false';

      case 'json':
        try {
          return JSON.stringify(value);
        } catch {
          throw new BadRequestException(`Value must be valid JSON`);
        }

      case 'string':
      default:
        return String(value);
    }
  }
}
