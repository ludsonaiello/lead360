import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { EncryptionService } from '../../../../core/encryption/encryption.service';
import { AuditLoggerService } from '../../../audit/services/audit-logger.service';
import { TwilioProviderManagementService } from './twilio-provider-management.service';
import { v4 as uuidv4 } from 'uuid';
import twilio from 'twilio';
import {
  CreateTenantSmsConfigDto,
  UpdateTenantSmsConfigDto,
  CreateTenantWhatsAppConfigDto,
  UpdateTenantWhatsAppConfigDto,
} from '../../dto/admin/tenant-assistance.dto';

/**
 * TenantAssistanceService
 *
 * Allows platform admins to configure tenant communication settings on their behalf.
 * Critical for customer support scenarios where tenants need assistance with setup.
 *
 * Responsibilities:
 * - Create/update SMS configurations for tenants
 * - Create/update WhatsApp configurations for tenants
 * - Test tenant configurations
 * - Validate credentials before saving
 * - Complete audit trail of all admin actions
 *
 * Security:
 * - All credentials encrypted at rest
 * - All operations require SystemAdmin role (enforced at controller level)
 * - Every action audit logged with admin user ID
 * - Validates tenant exists before operations
 *
 * Use Cases:
 * - Support team helping tenant configure Twilio
 * - Admin allocating system phone numbers to tenants
 * - Troubleshooting tenant configuration issues
 *
 * @class TenantAssistanceService
 * @since Sprint 11
 */
@Injectable()
export class TenantAssistanceService {
  private readonly logger = new Logger(TenantAssistanceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
    private readonly auditLogger: AuditLoggerService,
    private readonly twilioProviderManagement: TwilioProviderManagementService,
  ) {}

  /**
   * Create SMS configuration for tenant (on behalf)
   *
   * Creates a new SMS configuration for a tenant. Can use:
   * - System provider (Model B) - uses platform's Twilio account
   * - Custom provider (Model A) - uses tenant's own Twilio credentials
   *
   * @param tenantId - Tenant ID
   * @param dto - SMS configuration data
   * @param adminUserId - Admin user creating the config
   * @returns Promise<TenantSmsConfigResult>
   */
  async createSmsConfigForTenant(
    tenantId: string,
    dto: CreateTenantSmsConfigDto,
    adminUserId: string,
  ): Promise<TenantSmsConfigResult> {
    this.logger.log(`Admin ${adminUserId} creating SMS config for tenant ${tenantId}`);

    try {
      const providerType = dto.provider_type || 'system';

      // Verify tenant exists
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      // Check if tenant already has SMS config
      const existingConfig = await this.prisma.tenant_sms_config.findFirst({
        where: { tenant_id: tenantId },
      });

      if (existingConfig) {
        throw new ConflictException(
          `Tenant ${tenant.company_name} already has SMS configuration. Use update instead.`,
        );
      }

      // Get system provider for Model B
      const systemProvider = providerType === 'system'
        ? await this.twilioProviderManagement.getSystemProviderStatus()
        : null;

      if (providerType === 'system' && !systemProvider?.configured) {
        throw new BadRequestException(
          'System Twilio provider not configured. Cannot create Model B configuration.',
        );
      }

      // Prepare credentials
      let credentials: string;

      if (providerType === 'system') {
        // Model B - use system provider, minimal credentials needed
        credentials = this.encryptionService.encrypt(
          JSON.stringify({
            provider_type: 'system',
            from_phone: dto.from_phone,
          }),
        );
      } else {
        // Model A - validate and encrypt custom credentials
        if (!dto.account_sid || !dto.auth_token) {
          throw new BadRequestException(
            'Custom provider requires account_sid and auth_token',
          );
        }

        // Validate Twilio credentials
        const isValid = await this.validateTwilioCredentials(
          dto.account_sid,
          dto.auth_token,
        );

        if (!isValid) {
          throw new BadRequestException(
            'Invalid Twilio credentials. Could not authenticate with Twilio API.',
          );
        }

        credentials = this.encryptionService.encrypt(
          JSON.stringify({
            account_sid: dto.account_sid,
            auth_token: dto.auth_token,
            from_phone: dto.from_phone,
          }),
        );
      }

      // Get provider ID (system Twilio provider)
      const provider = await this.prisma.communication_provider.findUnique({
        where: { provider_key: 'twilio' },
      });

      if (!provider) {
        throw new BadRequestException('Twilio provider not registered in system');
      }

      // Create SMS configuration
      const config = await this.prisma.tenant_sms_config.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          provider_id: provider.id,
          credentials,
          from_phone: dto.from_phone,
          is_active: true,
          is_verified: providerType === 'system', // Auto-verify system configs
        },
        include: {
          tenant: {
            select: {
              id: true,
              company_name: true,
              subdomain: true,
            },
          },
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant_sms_config',
        entity_id: config.id,
        action_type: 'created',
        description: `Admin created SMS config for tenant ${tenant.company_name}`,
        after_json: {
          provider_type: providerType,
          from_phone: dto.from_phone,
          is_active: config.is_active,
        },
        status: 'success',
      });

      this.logger.log(`SMS config created successfully for tenant ${tenantId}`);

      return {
        config_id: config.id,
        tenant_id: config.tenant_id,
        tenant_name: config.tenant.company_name,
        from_phone: config.from_phone,
        status: config.is_active ? 'active' : 'inactive',
        verified: config.is_verified,
        provider_type: providerType,
        created_by_admin: adminUserId,
      };
    } catch (error) {
      this.logger.error('Failed to create SMS config for tenant:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to create SMS configuration');
    }
  }

  /**
   * Update SMS configuration for tenant (on behalf)
   *
   * Updates an existing SMS configuration. Can update:
   * - Phone number
   * - Credentials (for custom providers)
   * - Active status
   *
   * @param tenantId - Tenant ID
   * @param configId - Config ID
   * @param dto - Update data
   * @param adminUserId - Admin user updating the config
   * @returns Promise<TenantSmsConfigResult>
   */
  async updateSmsConfigForTenant(
    tenantId: string,
    configId: string,
    dto: UpdateTenantSmsConfigDto,
    adminUserId: string,
  ): Promise<TenantSmsConfigResult> {
    this.logger.log(`Admin ${adminUserId} updating SMS config ${configId} for tenant ${tenantId}`);

    try {
      // Verify config exists and belongs to tenant
      const existingConfig = await this.prisma.tenant_sms_config.findFirst({
        where: {
          id: configId,
          tenant_id: tenantId,
        },
        include: {
          tenant: true,
        },
      });

      if (!existingConfig) {
        throw new NotFoundException(
          `SMS config ${configId} not found for tenant ${tenantId}`,
        );
      }

      // Prepare update data
      const updateData: any = {};

      if (dto.from_phone !== undefined) {
        updateData.from_phone = dto.from_phone;
      }

      if (dto.is_active !== undefined) {
        updateData.is_active = dto.is_active;
      }

      // If updating credentials
      if (dto.account_sid || dto.auth_token) {
        // Decrypt existing credentials to merge
        const existingCreds = JSON.parse(
          this.encryptionService.decrypt(existingConfig.credentials),
        );

        // Validate new credentials if provided
        const newAccountSid = dto.account_sid || existingCreds.account_sid;
        const newAuthToken = dto.auth_token || existingCreds.auth_token;

        if (existingCreds.provider_type !== 'system') {
          const isValid = await this.validateTwilioCredentials(
            newAccountSid,
            newAuthToken,
          );

          if (!isValid) {
            throw new BadRequestException('Invalid Twilio credentials');
          }
        }

        // Re-encrypt with updates
        updateData.credentials = this.encryptionService.encrypt(
          JSON.stringify({
            ...existingCreds,
            account_sid: newAccountSid,
            auth_token: newAuthToken,
            from_phone: dto.from_phone || existingCreds.from_phone,
          }),
        );

        updateData.is_verified = true;
      }

      // Update configuration
      const updated = await this.prisma.tenant_sms_config.update({
        where: { id: configId },
        data: updateData,
        include: {
          tenant: {
            select: {
              id: true,
              company_name: true,
              subdomain: true,
            },
          },
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant_sms_config',
        entity_id: configId,
        action_type: 'updated',
        description: `Admin updated SMS config for tenant ${existingConfig.tenant.company_name}`,
        before_json: {
          from_phone: existingConfig.from_phone,
          is_active: existingConfig.is_active,
        },
        after_json: updateData,
        status: 'success',
      });

      this.logger.log(`SMS config ${configId} updated successfully`);

      return {
        config_id: updated.id,
        tenant_id: updated.tenant_id,
        tenant_name: updated.tenant.company_name,
        from_phone: updated.from_phone,
        status: updated.is_active ? 'active' : 'inactive',
        verified: updated.is_verified,
        provider_type: 'custom', // Can't determine from encrypted data
        created_by_admin: adminUserId,
      };
    } catch (error) {
      this.logger.error('Failed to update SMS config:', error.message);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to update SMS configuration');
    }
  }

  /**
   * Create WhatsApp configuration for tenant (on behalf)
   *
   * Creates WhatsApp configuration for tenant using Twilio WhatsApp Business API.
   *
   * @param tenantId - Tenant ID
   * @param dto - WhatsApp configuration data
   * @param adminUserId - Admin user creating the config
   * @returns Promise<TenantWhatsAppConfigResult>
   */
  async createWhatsAppConfigForTenant(
    tenantId: string,
    dto: CreateTenantWhatsAppConfigDto,
    adminUserId: string,
  ): Promise<TenantWhatsAppConfigResult> {
    this.logger.log(`Admin ${adminUserId} creating WhatsApp config for tenant ${tenantId}`);

    try {
      const providerType = dto.provider_type || 'system';

      // Verify tenant exists
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      if (!tenant) {
        throw new NotFoundException(`Tenant ${tenantId} not found`);
      }

      // Check if tenant already has WhatsApp config
      const existingConfig = await this.prisma.tenant_whatsapp_config.findFirst({
        where: { tenant_id: tenantId },
      });

      if (existingConfig) {
        throw new ConflictException(
          `Tenant ${tenant.company_name} already has WhatsApp configuration. Use update instead.`,
        );
      }

      // Get system provider for Model B
      const systemProvider = providerType === 'system'
        ? await this.twilioProviderManagement.getSystemProviderStatus()
        : null;

      if (providerType === 'system' && !systemProvider?.configured) {
        throw new BadRequestException(
          'System Twilio provider not configured. Cannot create Model B configuration.',
        );
      }

      // Prepare credentials
      let credentials: string;

      if (providerType === 'system') {
        // Model B - use system provider
        credentials = this.encryptionService.encrypt(
          JSON.stringify({
            provider_type: 'system',
            from_phone: dto.from_phone,
          }),
        );
      } else {
        // Model A - validate and encrypt custom credentials
        if (!dto.account_sid || !dto.auth_token) {
          throw new BadRequestException(
            'Custom provider requires account_sid and auth_token',
          );
        }

        // Validate Twilio credentials
        const isValid = await this.validateTwilioCredentials(
          dto.account_sid,
          dto.auth_token,
        );

        if (!isValid) {
          throw new BadRequestException(
            'Invalid Twilio credentials. Could not authenticate with Twilio API.',
          );
        }

        credentials = this.encryptionService.encrypt(
          JSON.stringify({
            account_sid: dto.account_sid,
            auth_token: dto.auth_token,
            from_phone: dto.from_phone,
          }),
        );
      }

      // Get provider ID (system Twilio provider)
      const provider = await this.prisma.communication_provider.findUnique({
        where: { provider_key: 'twilio' },
      });

      if (!provider) {
        throw new BadRequestException('Twilio provider not registered in system');
      }

      // Create WhatsApp configuration
      const config = await this.prisma.tenant_whatsapp_config.create({
        data: {
          id: uuidv4(),
          tenant_id: tenantId,
          provider_id: provider.id,
          credentials,
          from_phone: dto.from_phone,
          is_active: true,
          is_verified: providerType === 'system', // Auto-verify system configs
        },
        include: {
          tenant: {
            select: {
              id: true,
              company_name: true,
              subdomain: true,
            },
          },
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant_whatsapp_config',
        entity_id: config.id,
        action_type: 'created',
        description: `Admin created WhatsApp config for tenant ${tenant.company_name}`,
        after_json: {
          provider_type: providerType,
          from_phone: dto.from_phone,
          is_active: config.is_active,
        },
        status: 'success',
      });

      this.logger.log(`WhatsApp config created successfully for tenant ${tenantId}`);

      return {
        config_id: config.id,
        tenant_id: config.tenant_id,
        tenant_name: config.tenant.company_name,
        from_phone: config.from_phone,
        status: config.is_active ? 'active' : 'inactive',
        verified: config.is_verified,
        provider_type: providerType,
        created_by_admin: adminUserId,
      };
    } catch (error) {
      this.logger.error('Failed to create WhatsApp config for tenant:', error.message);
      this.logger.error('Error stack:', error.stack);

      if (
        error instanceof NotFoundException ||
        error instanceof ConflictException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to create WhatsApp configuration');
    }
  }

  /**
   * Update WhatsApp configuration for tenant (on behalf)
   *
   * @param tenantId - Tenant ID
   * @param configId - Config ID
   * @param dto - Update data
   * @param adminUserId - Admin user updating
   * @returns Promise<TenantWhatsAppConfigResult>
   */
  async updateWhatsAppConfigForTenant(
    tenantId: string,
    configId: string,
    dto: UpdateTenantWhatsAppConfigDto,
    adminUserId: string,
  ): Promise<TenantWhatsAppConfigResult> {
    this.logger.log(`Admin ${adminUserId} updating WhatsApp config ${configId}`);

    try {
      const existingConfig = await this.prisma.tenant_whatsapp_config.findFirst({
        where: {
          id: configId,
          tenant_id: tenantId,
        },
        include: { tenant: true },
      });

      if (!existingConfig) {
        throw new NotFoundException(`WhatsApp config ${configId} not found`);
      }

      const updateData: any = {};

      if (dto.from_phone !== undefined) {
        updateData.from_phone = dto.from_phone;
      }

      if (dto.is_active !== undefined) {
        updateData.is_active = dto.is_active;
      }

      if (dto.account_sid || dto.auth_token) {
        const existingCreds = JSON.parse(
          this.encryptionService.decrypt(existingConfig.credentials),
        );

        const newAccountSid = dto.account_sid || existingCreds.account_sid;
        const newAuthToken = dto.auth_token || existingCreds.auth_token;

        if (existingCreds.provider_type !== 'system') {
          const isValid = await this.validateTwilioCredentials(
            newAccountSid,
            newAuthToken,
          );

          if (!isValid) {
            throw new BadRequestException('Invalid Twilio credentials');
          }
        }

        updateData.credentials = this.encryptionService.encrypt(
          JSON.stringify({
            ...existingCreds,
            account_sid: newAccountSid,
            auth_token: newAuthToken,
            from_phone: dto.from_phone || existingCreds.from_phone,
          }),
        );

        updateData.is_verified = true;
      }

      const updated = await this.prisma.tenant_whatsapp_config.update({
        where: { id: configId },
        data: updateData,
        include: {
          tenant: {
            select: {
              id: true,
              company_name: true,
              subdomain: true,
            },
          },
        },
      });

      // Audit log
      await this.auditLogger.log({
        tenant_id: tenantId,
        actor_user_id: adminUserId,
        actor_type: 'platform_admin',
        entity_type: 'tenant_whatsapp_config',
        entity_id: configId,
        action_type: 'updated',
        description: `Admin updated WhatsApp config for tenant ${existingConfig.tenant.company_name}`,
        before_json: {
          from_phone: existingConfig.from_phone,
          is_active: existingConfig.is_active,
        },
        after_json: updateData,
        status: 'success',
      });

      return {
        config_id: updated.id,
        tenant_id: updated.tenant_id,
        tenant_name: updated.tenant.company_name,
        from_phone: updated.from_phone,
        status: updated.is_active ? 'active' : 'inactive',
        verified: updated.is_verified,
        provider_type: 'custom',
        created_by_admin: adminUserId,
      };
    } catch (error) {
      this.logger.error('Failed to update WhatsApp config:', error.message);

      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }

      throw new BadRequestException('Failed to update WhatsApp configuration');
    }
  }

  /**
   * Test SMS configuration
   *
   * Sends a test SMS to verify configuration is working.
   *
   * @param tenantId - Tenant ID
   * @param configId - Config ID (optional, uses active config if not provided)
   * @returns Promise<TestResult>
   */
  async testSmsConfig(tenantId: string, configId?: string): Promise<TestResult> {
    this.logger.log(`Testing SMS config for tenant ${tenantId}`);

    try {
      const config = configId
        ? await this.prisma.tenant_sms_config.findFirst({
            where: { id: configId, tenant_id: tenantId },
          })
        : await this.prisma.tenant_sms_config.findFirst({
            where: { tenant_id: tenantId, is_active: true },
          });

      if (!config) {
        throw new NotFoundException('SMS configuration not found');
      }

      // Get tenant for company name
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      // Get provider to check if system or tenant-specific
      const provider = await this.prisma.communication_provider.findUnique({
        where: { id: config.provider_id },
      });

      if (!provider) {
        throw new NotFoundException('Communication provider not found');
      }

      // Decrypt credentials (stored in config)
      const configCreds = JSON.parse(
        this.encryptionService.decrypt(config.credentials),
      );

      const accountSid = configCreds.account_sid;
      const authToken = configCreds.auth_token;

      // Initialize Twilio client
      const client = twilio(accountSid, authToken);

      // Send REAL test SMS
      const testMessage = await client.messages.create({
        body: `Test SMS from Lead360 for ${tenant?.company_name || 'your tenant'}. Configuration is working correctly! ✓`,
        from: config.from_phone,
        to: config.from_phone, // Send to self for testing
      });

      this.logger.log(
        `Test SMS sent successfully: ${testMessage.sid} (status: ${testMessage.status})`,
      );

      return {
        test_status: 'success',
        message: `Test SMS sent successfully from ${config.from_phone}. Message SID: ${testMessage.sid}`,
        config_verified: true,
      };
    } catch (error) {
      this.logger.error('SMS config test failed:', error.message);

      if (error instanceof NotFoundException) {
        throw error;
      }

      return {
        test_status: 'failed',
        message: `SMS test failed: ${error.message}`,
        config_verified: false,
      };
    }
  }

  /**
   * Test WhatsApp configuration
   *
   * Sends a test WhatsApp message to verify configuration.
   *
   * @param tenantId - Tenant ID
   * @param configId - Config ID (optional)
   * @returns Promise<TestResult>
   */
  async testWhatsAppConfig(tenantId: string, configId?: string): Promise<TestResult> {
    this.logger.log(`Testing WhatsApp config for tenant ${tenantId}`);

    try {
      const config = configId
        ? await this.prisma.tenant_whatsapp_config.findFirst({
            where: { id: configId, tenant_id: tenantId },
          })
        : await this.prisma.tenant_whatsapp_config.findFirst({
            where: { tenant_id: tenantId, is_active: true },
          });

      if (!config) {
        throw new NotFoundException('WhatsApp configuration not found');
      }

      // Get tenant for company name
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });

      // Get provider to check if system or tenant-specific
      const provider = await this.prisma.communication_provider.findUnique({
        where: { id: config.provider_id },
      });

      if (!provider) {
        throw new NotFoundException('Communication provider not found');
      }

      // Decrypt credentials (stored in config)
      const configCreds = JSON.parse(
        this.encryptionService.decrypt(config.credentials),
      );

      const accountSid = configCreds.account_sid;
      const authToken = configCreds.auth_token;

      // Initialize Twilio client
      const client = twilio(accountSid, authToken);

      // Send REAL test WhatsApp message
      const testMessage = await client.messages.create({
        body: `Test WhatsApp message from Lead360 for ${tenant?.company_name || 'your tenant'}. Configuration is working correctly! ✓`,
        from: `whatsapp:${config.from_phone}`,
        to: `whatsapp:${config.from_phone}`, // Send to self for testing
      });

      this.logger.log(
        `Test WhatsApp message sent successfully: ${testMessage.sid} (status: ${testMessage.status})`,
      );

      return {
        test_status: 'success',
        message: `Test WhatsApp message sent successfully from ${config.from_phone}. Message SID: ${testMessage.sid}`,
        config_verified: true,
      };
    } catch (error) {
      this.logger.error('WhatsApp config test failed:', error.message);

      if (error instanceof NotFoundException) {
        throw error;
      }

      return {
        test_status: 'failed',
        message: `WhatsApp test failed: ${error.message}`,
        config_verified: false,
      };
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Validate Twilio credentials
   */
  private async validateTwilioCredentials(
    accountSid: string,
    authToken: string,
  ): Promise<boolean> {
    try {
      const client = twilio(accountSid, authToken);
      await client.api.accounts(accountSid).fetch();
      return true;
    } catch (error) {
      this.logger.warn('Twilio credential validation failed:', error.message);
      return false;
    }
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface TenantSmsConfigResult {
  config_id: string;
  tenant_id: string;
  tenant_name: string;
  from_phone: string;
  status: 'active' | 'inactive';
  verified: boolean;
  provider_type: 'system' | 'custom';
  created_by_admin: string;
}

export interface TenantWhatsAppConfigResult {
  config_id: string;
  tenant_id: string;
  tenant_name: string;
  from_phone: string;
  status: 'active' | 'inactive';
  verified: boolean;
  provider_type: 'system' | 'custom';
  created_by_admin: string;
}

export interface TestResult {
  test_status: 'success' | 'failed';
  message: string;
  config_verified: boolean;
}
