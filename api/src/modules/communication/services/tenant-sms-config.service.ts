import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { CreateTenantSmsConfigDto } from '../dto/sms-config/create-tenant-sms-config.dto';
import { UpdateTenantSmsConfigDto } from '../dto/sms-config/update-tenant-sms-config.dto';
import twilio from 'twilio';

/**
 * Tenant SMS Configuration Service
 *
 * Manages tenant-specific SMS configurations for Twilio.
 * Provides secure credential storage, validation, and testing capabilities.
 *
 * Features:
 * - Encrypted credential storage
 * - Twilio credential validation before storage
 * - Test SMS functionality
 * - Active/inactive configuration management
 * - Complete audit trail
 *
 * Security:
 * - All credentials encrypted at rest using AES-256-GCM
 * - Credentials NEVER exposed in API responses
 * - Multi-tenant isolation enforced at database level
 * - Twilio credential validation prevents invalid configurations
 */
@Injectable()
export class TenantSmsConfigService {
  private readonly logger = new Logger(TenantSmsConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Create SMS configuration for tenant
   * Validates Twilio credentials and encrypts before storage
   *
   * @param tenantId - Tenant UUID
   * @param dto - SMS configuration data
   * @returns Created configuration (without credentials)
   * @throws ConflictException if active config already exists
   * @throws BadRequestException if credentials are invalid
   */
  async create(tenantId: string, dto: CreateTenantSmsConfigDto) {
    // 1. Check if active config already exists
    const existing = await this.prisma.tenant_sms_config.findFirst({
      where: { tenant_id: tenantId, is_active: true },
    });

    if (existing) {
      throw new ConflictException(
        'Active SMS configuration already exists. Deactivate existing config first.',
      );
    }

    // 2. Validate Twilio credentials
    await this.validateTwilioCredentials(
      dto.account_sid,
      dto.auth_token,
      dto.from_phone,
    );

    // 3. Encrypt credentials
    const encryptedCredentials = this.encryption.encrypt(
      JSON.stringify({
        account_sid: dto.account_sid,
        auth_token: dto.auth_token,
        from_phone: dto.from_phone,
      }),
    );

    // 4. Create configuration
    const config = await this.prisma.tenant_sms_config.create({
      data: {
        tenant_id: tenantId,
        provider_id: dto.provider_id,
        credentials: encryptedCredentials,
        from_phone: dto.from_phone,
        is_active: true,
        is_verified: true, // Set to true after successful validation
        webhook_secret: dto.webhook_secret,
      },
      include: {
        provider: true,
        tenant: {
          select: {
            company_name: true,
          },
        },
      },
    });

    this.logger.log(
      `SMS configuration created for tenant ${tenantId} (${config.tenant.company_name})`,
    );

    // Never expose credentials in response
    const { credentials, ...safeConfig } = config;
    return safeConfig;
  }

  /**
   * Get active SMS configuration for tenant
   *
   * @param tenantId - Tenant UUID
   * @returns Active SMS configuration (without credentials)
   * @throws NotFoundException if no active configuration exists
   */
  async findByTenantId(tenantId: string) {
    const config = await this.prisma.tenant_sms_config.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        provider: true,
        tenant: {
          select: {
            company_name: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException(
        'No active SMS configuration found for this tenant',
      );
    }

    // DO NOT return decrypted credentials in API response
    const { credentials, ...safeConfig } = config;
    return safeConfig;
  }

  /**
   * Get decrypted credentials for internal use only
   * NEVER expose this data through API endpoints
   *
   * @param tenantId - Tenant UUID
   * @returns Decrypted Twilio credentials
   * @throws NotFoundException if no active configuration exists
   */
  async getDecryptedCredentials(tenantId: string): Promise<{
    account_sid: string;
    auth_token: string;
    from_phone: string;
  }> {
    const config = await this.prisma.tenant_sms_config.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!config) {
      throw new NotFoundException('No active SMS configuration found');
    }

    try {
      const decryptedString = this.encryption.decrypt(config.credentials);
      const credentials = JSON.parse(decryptedString);
      return credentials;
    } catch (error) {
      this.logger.error(
        `Failed to decrypt SMS credentials for tenant ${tenantId}: ${error.message}`,
      );
      throw new BadRequestException(
        'Failed to decrypt SMS credentials. Configuration may be corrupted.',
      );
    }
  }

  /**
   * Update SMS configuration
   *
   * @param tenantId - Tenant UUID
   * @param configId - Configuration UUID
   * @param dto - Update data
   * @returns Updated configuration (without credentials)
   * @throws NotFoundException if configuration not found
   * @throws BadRequestException if new credentials are invalid
   */
  async update(
    tenantId: string,
    configId: string,
    dto: UpdateTenantSmsConfigDto,
  ) {
    // Verify config belongs to tenant
    const config = await this.prisma.tenant_sms_config.findFirst({
      where: {
        id: configId,
        tenant_id: tenantId,
      },
    });

    if (!config) {
      throw new NotFoundException('SMS configuration not found');
    }

    // If credentials are being updated, validate and encrypt
    let updatedCredentials = config.credentials;
    if (dto.account_sid || dto.auth_token || dto.from_phone) {
      // Merge with existing credentials
      const existing = JSON.parse(this.encryption.decrypt(config.credentials));
      const updated = {
        account_sid: dto.account_sid || existing.account_sid,
        auth_token: dto.auth_token || existing.auth_token,
        from_phone: dto.from_phone || existing.from_phone,
      };

      // Validate new credentials
      await this.validateTwilioCredentials(
        updated.account_sid,
        updated.auth_token,
        updated.from_phone,
      );

      updatedCredentials = this.encryption.encrypt(JSON.stringify(updated));
    }

    const updatedConfig = await this.prisma.tenant_sms_config.update({
      where: { id: configId },
      data: {
        credentials: updatedCredentials,
        from_phone: dto.from_phone || config.from_phone,
        webhook_secret:
          dto.webhook_secret !== undefined
            ? dto.webhook_secret
            : config.webhook_secret,
        is_active:
          dto.is_active !== undefined ? dto.is_active : config.is_active,
        is_verified:
          dto.account_sid || dto.auth_token || dto.from_phone
            ? true
            : config.is_verified, // Re-verify if credentials changed
      },
      include: {
        provider: true,
      },
    });

    this.logger.log(
      `SMS configuration updated for tenant ${tenantId} (config ${configId})`,
    );

    const { credentials, ...safeConfig } = updatedConfig;
    return safeConfig;
  }

  /**
   * Delete (deactivate) SMS configuration
   *
   * @param tenantId - Tenant UUID
   * @param configId - Configuration UUID
   * @returns Deactivated configuration
   * @throws NotFoundException if configuration not found
   */
  async delete(tenantId: string, configId: string) {
    const config = await this.prisma.tenant_sms_config.findFirst({
      where: {
        id: configId,
        tenant_id: tenantId,
      },
    });

    if (!config) {
      throw new NotFoundException('SMS configuration not found');
    }

    // Soft delete (set is_active = false)
    const deactivated = await this.prisma.tenant_sms_config.update({
      where: { id: configId },
      data: { is_active: false },
    });

    this.logger.log(
      `SMS configuration deactivated for tenant ${tenantId} (config ${configId})`,
    );

    const { credentials, ...safeConfig } = deactivated;
    return safeConfig;
  }

  /**
   * Test SMS configuration by sending test message
   *
   * @param tenantId - Tenant UUID
   * @param configId - Configuration UUID
   * @returns Test result with Twilio message SID
   * @throws NotFoundException if configuration not found
   * @throws BadRequestException if test fails
   */
  async testConnection(tenantId: string, configId: string) {
    const config = await this.prisma.tenant_sms_config.findFirst({
      where: {
        id: configId,
        tenant_id: tenantId,
      },
      include: {
        tenant: {
          select: {
            company_name: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('SMS configuration not found');
    }

    const credentials = JSON.parse(this.encryption.decrypt(config.credentials));

    try {
      const client = twilio(credentials.account_sid, credentials.auth_token);

      // Send test SMS to the from_phone number (sends to self)
      const message = await client.messages.create({
        body: `Test message from Lead360 (${config.tenant.company_name}). Your SMS configuration is working correctly.`,
        from: credentials.from_phone,
        to: credentials.from_phone, // Send to self for testing
      });

      this.logger.log(
        `Test SMS sent successfully for tenant ${tenantId} - Message SID: ${message.sid}`,
      );

      // Mark as verified
      await this.prisma.tenant_sms_config.update({
        where: { id: configId },
        data: { is_verified: true },
      });

      return {
        success: true,
        message: 'Test SMS sent successfully',
        twilio_message_sid: message.sid,
        from: credentials.from_phone,
        to: credentials.from_phone,
      };
    } catch (error) {
      this.logger.error(
        `SMS test failed for tenant ${tenantId}: ${error.message}`,
      );

      // Mark as unverified
      await this.prisma.tenant_sms_config.update({
        where: { id: configId },
        data: { is_verified: false },
      });

      throw new BadRequestException({
        message: `SMS test failed: ${error.message}`,
        error: error.code || 'TWILIO_ERROR',
      });
    }
  }

  /**
   * Validate Twilio credentials by making test API call
   *
   * @param accountSid - Twilio Account SID
   * @param authToken - Twilio Auth Token
   * @param fromPhone - Twilio phone number
   * @throws BadRequestException if validation fails
   */
  private async validateTwilioCredentials(
    accountSid: string,
    authToken: string,
    fromPhone: string,
  ): Promise<void> {
    // Validate format
    if (!accountSid.match(/^AC[a-z0-9]{32}$/i)) {
      throw new BadRequestException(
        'Invalid Twilio Account SID format. Must start with "AC" followed by 32 alphanumeric characters.',
      );
    }

    if (!fromPhone.startsWith('+')) {
      throw new BadRequestException(
        'Phone number must be in E.164 format (starting with +). Example: +19781234567',
      );
    }

    // Validate E.164 format
    if (!fromPhone.match(/^\+[1-9]\d{1,14}$/)) {
      throw new BadRequestException(
        'Invalid phone number format. Must be in E.164 format with country code. Example: +19781234567',
      );
    }

    // Test credentials by fetching account details
    try {
      const client = twilio(accountSid, authToken);
      await client.api.accounts(accountSid).fetch();
      this.logger.log('Twilio credentials validated successfully');
    } catch (error) {
      this.logger.error(
        `Twilio credential validation failed: ${error.message}`,
      );
      throw new BadRequestException(
        'Invalid Twilio credentials. Please check your Account SID and Auth Token.',
      );
    }
  }
}
