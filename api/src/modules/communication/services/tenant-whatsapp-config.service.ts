import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { CreateTenantWhatsAppConfigDto } from '../dto/whatsapp-config/create-tenant-whatsapp-config.dto';
import { UpdateTenantWhatsAppConfigDto } from '../dto/whatsapp-config/update-tenant-whatsapp-config.dto';
import twilio from 'twilio';

/**
 * Tenant WhatsApp Configuration Service
 *
 * Manages tenant-specific WhatsApp configurations for Twilio.
 * Provides secure credential storage, validation, and testing capabilities.
 *
 * Features:
 * - Encrypted credential storage
 * - Twilio credential validation before storage
 * - Test WhatsApp message functionality
 * - Active/inactive configuration management
 * - Complete audit trail
 *
 * Security:
 * - All credentials encrypted at rest using AES-256-GCM
 * - Credentials NEVER exposed in API responses
 * - Multi-tenant isolation enforced at database level
 * - Twilio credential validation prevents invalid configurations
 *
 * WhatsApp-Specific Notes:
 * - Phone numbers use 'whatsapp:' prefix (e.g., 'whatsapp:+19781234567')
 * - Requires approved WhatsApp Business Account with Twilio
 * - Message templates may be required for first messages (per WhatsApp rules)
 */
@Injectable()
export class TenantWhatsAppConfigService {
  private readonly logger = new Logger(TenantWhatsAppConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Create WhatsApp configuration for tenant
   * Validates Twilio credentials and encrypts before storage
   *
   * @param tenantId - Tenant UUID
   * @param dto - WhatsApp configuration data
   * @returns Created configuration (without credentials)
   * @throws ConflictException if active config already exists
   * @throws BadRequestException if credentials are invalid
   */
  async create(tenantId: string, dto: CreateTenantWhatsAppConfigDto) {
    // 1. Check if active config already exists
    const existing = await this.prisma.tenant_whatsapp_config.findFirst({
      where: { tenant_id: tenantId, is_active: true },
    });

    if (existing) {
      throw new ConflictException(
        'Active WhatsApp configuration already exists. Deactivate existing config first.',
      );
    }

    // 2. Validate Twilio credentials
    await this.validateTwilioCredentials(
      dto.account_sid,
      dto.auth_token,
      dto.from_phone,
    );

    // 3. Encrypt credentials (store WhatsApp number with prefix)
    const whatsappNumber = dto.from_phone.startsWith('whatsapp:')
      ? dto.from_phone
      : `whatsapp:${dto.from_phone}`;

    const encryptedCredentials = this.encryption.encrypt(
      JSON.stringify({
        account_sid: dto.account_sid,
        auth_token: dto.auth_token,
        from_phone: whatsappNumber,
      }),
    );

    // 4. Create configuration
    const config = await this.prisma.tenant_whatsapp_config.create({
      data: {
        tenant_id: tenantId,
        provider_id: dto.provider_id,
        credentials: encryptedCredentials,
        from_phone: whatsappNumber,
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
      `WhatsApp configuration created for tenant ${tenantId} (${config.tenant.company_name})`,
    );

    // Never expose credentials in response
    const { credentials, ...safeConfig } = config;
    return safeConfig;
  }

  /**
   * Get active WhatsApp configuration for tenant
   *
   * @param tenantId - Tenant UUID
   * @returns Active WhatsApp configuration (without credentials)
   * @throws NotFoundException if no active configuration exists
   */
  async findByTenantId(tenantId: string) {
    const config = await this.prisma.tenant_whatsapp_config.findFirst({
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
        'No active WhatsApp configuration found for this tenant',
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
    const config = await this.prisma.tenant_whatsapp_config.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!config) {
      throw new NotFoundException('No active WhatsApp configuration found');
    }

    try {
      const decryptedString = this.encryption.decrypt(config.credentials);
      const credentials = JSON.parse(decryptedString);
      return credentials;
    } catch (error) {
      this.logger.error(
        `Failed to decrypt WhatsApp credentials for tenant ${tenantId}: ${error.message}`,
      );
      throw new BadRequestException(
        'Failed to decrypt WhatsApp credentials. Configuration may be corrupted.',
      );
    }
  }

  /**
   * Update WhatsApp configuration
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
    dto: UpdateTenantWhatsAppConfigDto,
  ) {
    // Verify config belongs to tenant
    const config = await this.prisma.tenant_whatsapp_config.findFirst({
      where: {
        id: configId,
        tenant_id: tenantId,
      },
    });

    if (!config) {
      throw new NotFoundException('WhatsApp configuration not found');
    }

    // If credentials are being updated, validate and encrypt
    let updatedCredentials = config.credentials;
    if (dto.account_sid || dto.auth_token || dto.from_phone) {
      // Merge with existing credentials
      const existing = JSON.parse(this.encryption.decrypt(config.credentials));

      // Ensure WhatsApp prefix
      let whatsappNumber = dto.from_phone || existing.from_phone;
      if (dto.from_phone && !dto.from_phone.startsWith('whatsapp:')) {
        whatsappNumber = `whatsapp:${dto.from_phone}`;
      }

      const updated = {
        account_sid: dto.account_sid || existing.account_sid,
        auth_token: dto.auth_token || existing.auth_token,
        from_phone: whatsappNumber,
      };

      // Validate new credentials
      await this.validateTwilioCredentials(
        updated.account_sid,
        updated.auth_token,
        updated.from_phone,
      );

      updatedCredentials = this.encryption.encrypt(JSON.stringify(updated));
    }

    const updatedConfig = await this.prisma.tenant_whatsapp_config.update({
      where: { id: configId },
      data: {
        credentials: updatedCredentials,
        from_phone: dto.from_phone
          ? dto.from_phone.startsWith('whatsapp:')
            ? dto.from_phone
            : `whatsapp:${dto.from_phone}`
          : config.from_phone,
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
      `WhatsApp configuration updated for tenant ${tenantId} (config ${configId})`,
    );

    const { credentials, ...safeConfig } = updatedConfig;
    return safeConfig;
  }

  /**
   * Delete (deactivate) WhatsApp configuration
   *
   * @param tenantId - Tenant UUID
   * @param configId - Configuration UUID
   * @returns Deactivated configuration
   * @throws NotFoundException if configuration not found
   */
  async delete(tenantId: string, configId: string) {
    const config = await this.prisma.tenant_whatsapp_config.findFirst({
      where: {
        id: configId,
        tenant_id: tenantId,
      },
    });

    if (!config) {
      throw new NotFoundException('WhatsApp configuration not found');
    }

    // Soft delete (set is_active = false)
    const deactivated = await this.prisma.tenant_whatsapp_config.update({
      where: { id: configId },
      data: { is_active: false },
    });

    this.logger.log(
      `WhatsApp configuration deactivated for tenant ${tenantId} (config ${configId})`,
    );

    const { credentials, ...safeConfig } = deactivated;
    return safeConfig;
  }

  /**
   * Test WhatsApp configuration by sending test message
   *
   * @param tenantId - Tenant UUID
   * @param configId - Configuration UUID
   * @returns Test result with Twilio message SID
   * @throws NotFoundException if configuration not found
   * @throws BadRequestException if test fails
   */
  async testConnection(tenantId: string, configId: string) {
    const config = await this.prisma.tenant_whatsapp_config.findFirst({
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
      throw new NotFoundException('WhatsApp configuration not found');
    }

    const credentials = JSON.parse(this.encryption.decrypt(config.credentials));

    try {
      const client = twilio(credentials.account_sid, credentials.auth_token);

      // Send test WhatsApp message to the from_phone number (sends to self)
      const message = await client.messages.create({
        body: `Test WhatsApp message from Lead360 (${config.tenant.company_name}). Your WhatsApp configuration is working correctly! ✅`,
        from: credentials.from_phone,
        to: credentials.from_phone, // Send to self for testing
      });

      this.logger.log(
        `Test WhatsApp message sent successfully for tenant ${tenantId} - Message SID: ${message.sid}`,
      );

      // Mark as verified
      await this.prisma.tenant_whatsapp_config.update({
        where: { id: configId },
        data: { is_verified: true },
      });

      return {
        success: true,
        message: 'Test WhatsApp message sent successfully',
        twilio_message_sid: message.sid,
        from: credentials.from_phone,
        to: credentials.from_phone,
      };
    } catch (error) {
      this.logger.error(
        `WhatsApp test failed for tenant ${tenantId}: ${error.message}`,
      );

      // Mark as unverified
      await this.prisma.tenant_whatsapp_config.update({
        where: { id: configId },
        data: { is_verified: false },
      });

      throw new BadRequestException({
        message: `WhatsApp test failed: ${error.message}`,
        error: error.code || 'TWILIO_ERROR',
        hint: 'Ensure your Twilio WhatsApp Business Account is approved and the phone number is configured correctly.',
      });
    }
  }

  /**
   * Validate Twilio credentials by making test API call
   *
   * @param accountSid - Twilio Account SID
   * @param authToken - Twilio Auth Token
   * @param fromPhone - Twilio WhatsApp number (with or without 'whatsapp:' prefix)
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

    // Remove 'whatsapp:' prefix for validation
    const phoneNumber = fromPhone.replace(/^whatsapp:/, '');

    if (!phoneNumber.startsWith('+')) {
      throw new BadRequestException(
        'Phone number must be in E.164 format (starting with +). Example: +19781234567 or whatsapp:+19781234567',
      );
    }

    // Validate E.164 format
    if (!phoneNumber.match(/^\+[1-9]\d{1,14}$/)) {
      throw new BadRequestException(
        'Invalid phone number format. Must be in E.164 format with country code. Example: +19781234567',
      );
    }

    // Test credentials by fetching account details
    try {
      const client = twilio(accountSid, authToken);
      await client.api.accounts(accountSid).fetch();
      this.logger.log('Twilio WhatsApp credentials validated successfully');
    } catch (error) {
      this.logger.error(
        `Twilio WhatsApp credential validation failed: ${error.message}`,
      );
      throw new BadRequestException(
        'Invalid Twilio credentials. Please check your Account SID and Auth Token.',
      );
    }
  }
}
