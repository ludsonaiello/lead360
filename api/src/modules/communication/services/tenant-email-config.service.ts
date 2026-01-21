import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { CommunicationProviderService } from './communication-provider.service';
import { EmailSenderService } from './email-sender.service';
import { UpdateTenantEmailConfigDto, CreateTenantEmailConfigDto } from '../dto/email-config.dto';
import { randomUUID } from 'crypto';

/**
 * Tenant Email Config Service
 *
 * Manages tenant-specific email configurations (MULTI-PROVIDER SUPPORT).
 * Each tenant can configure multiple email providers and switch between them.
 *
 * Features:
 * - Multiple provider configurations per tenant
 * - Active/inactive provider switching
 * - Provider-agnostic configuration (SMTP, SendGrid, Amazon SES, Brevo)
 * - Encrypted credential storage
 * - Test email functionality
 * - Automatic verification status tracking
 */
@Injectable()
export class TenantEmailConfigService {
  private readonly logger = new Logger(TenantEmailConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly providerService: CommunicationProviderService,
    private readonly emailSender: EmailSenderService,
  ) {}

  /**
   * List all email provider configurations for tenant
   */
  async listProviderConfigs(tenantId: string) {
    const configs = await this.prisma.tenant_email_config.findMany({
      where: { tenant_id: tenantId },
      include: {
        provider: {
          select: {
            id: true,
            provider_key: true,
            provider_name: true,
            provider_type: true,
          },
        },
      },
      orderBy: [
        { is_active: 'desc' }, // Active first
        { created_at: 'desc' },
      ],
    });

    // Hide credentials in list view
    return configs.map(config => {
      const { credentials, ...safeConfig } = config;
      return safeConfig;
    });
  }

  /**
   * Get active email provider configuration
   */
  async getActiveProvider(tenantId: string) {
    const config = await this.prisma.tenant_email_config.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        provider: true,
      },
    });

    if (!config) {
      throw new NotFoundException(
        'No active email provider configured. Please add and activate a provider in Communication Settings.',
      );
    }

    return config;
  }

  /**
   * Get single provider configuration by ID (with decrypted credentials)
   */
  async getProviderConfig(tenantId: string, configId: string) {
    const config = await this.prisma.tenant_email_config.findFirst({
      where: {
        id: configId,
        tenant_id: tenantId,
      },
      include: {
        provider: {
          select: {
            id: true,
            provider_key: true,
            provider_name: true,
            provider_type: true,
          },
        },
      },
    });

    if (!config) {
      throw new NotFoundException('Email provider configuration not found');
    }

    // Decrypt credentials for frontend display/editing
    let decryptedCredentials = {};
    if (config.credentials) {
      try {
        const encryptedString =
          typeof config.credentials === 'string'
            ? config.credentials
            : JSON.stringify(config.credentials);
        const decryptedString = this.encryption.decrypt(encryptedString);
        decryptedCredentials = JSON.parse(decryptedString);
      } catch (error) {
        this.logger.error(`Failed to decrypt credentials: ${error.message}`);
      }
    }

    const { credentials: encryptedCreds, ...safeConfig } = config;

    return {
      ...safeConfig,
      credentials: decryptedCredentials,
    };
  }

  /**
   * Create a new provider configuration
   */
  async createProviderConfig(
    tenantId: string,
    dto: CreateTenantEmailConfigDto,
    userId: string,
  ) {
    // 1. Validate provider exists and is active
    const provider = await this.providerService.getProviderById(dto.provider_id);

    if (!provider.is_active) {
      throw new BadRequestException(
        `Provider ${provider.provider_name} is not active`,
      );
    }

    if (provider.provider_type !== 'email') {
      throw new BadRequestException(
        `Provider ${provider.provider_name} is not an email provider`,
      );
    }

    // 2. Check if provider config already exists for this tenant
    const existing = await this.prisma.tenant_email_config.findFirst({
      where: {
        tenant_id: tenantId,
        provider_id: dto.provider_id,
      },
    });

    if (existing) {
      throw new BadRequestException(
        `${provider.provider_name} is already configured for this tenant. Use the update endpoint to modify it.`,
      );
    }

    // 3. Validate credentials against provider's JSON Schema
    const validation = await this.providerService.validateProviderSettings(
      provider,
      dto.credentials,
      dto.provider_config,
    );

    if (!validation.valid) {
      throw new BadRequestException({
        message: 'Invalid provider credentials or configuration',
        errors: validation.errors,
      });
    }

    // 4. Encrypt credentials
    const encryptedCredentials = this.encryption.encrypt(
      JSON.stringify(dto.credentials),
    );

    // 5. If setting as active, deactivate other providers
    if (dto.is_active) {
      await this.deactivateAllProviders(tenantId);
    }

    // 6. Create new configuration
    const config = await this.prisma.tenant_email_config.create({
      data: {
        id: randomUUID(),
        tenant_id: tenantId,
        provider_id: dto.provider_id,
        credentials: encryptedCredentials,
        provider_config: dto.provider_config || {},
        from_email: dto.from_email,
        from_name: dto.from_name,
        reply_to_email: dto.reply_to_email,
        webhook_secret: dto.webhook_secret,
        is_active: dto.is_active || false,
        is_verified: false,
      },
      include: {
        provider: {
          select: {
            provider_key: true,
            provider_name: true,
          },
        },
      },
    });

    this.logger.log(
      `Tenant email config created for tenant ${tenantId} by user ${userId}: ${provider.provider_name}`,
    );

    const { credentials, ...safeConfig } = config;
    return safeConfig;
  }

  /**
   * Update existing provider configuration
   */
  async updateProviderConfig(
    tenantId: string,
    configId: string,
    dto: UpdateTenantEmailConfigDto,
    userId: string,
  ) {
    // 1. Find existing config
    const existing = await this.prisma.tenant_email_config.findFirst({
      where: { id: configId, tenant_id: tenantId },
      include: { provider: true },
    });

    if (!existing) {
      throw new NotFoundException('Email provider configuration not found');
    }

    // 2. If changing provider, validate it
    if (dto.provider_id && dto.provider_id !== existing.provider_id) {
      const newProvider = await this.providerService.getProviderById(dto.provider_id);

      if (!newProvider.is_active) {
        throw new BadRequestException(
          `Provider ${newProvider.provider_name} is not active`,
        );
      }

      if (newProvider.provider_type !== 'email') {
        throw new BadRequestException(
          `Provider ${newProvider.provider_name} is not an email provider`,
        );
      }
    }

    // Get updated provider info for validation
    const provider = dto.provider_id
      ? await this.providerService.getProviderById(dto.provider_id)
      : existing.provider;

    // 3. Validate credentials if provided
    if (dto.credentials) {
      const existingConfig = existing.provider_config
        ? (typeof existing.provider_config === 'string'
            ? JSON.parse(existing.provider_config)
            : existing.provider_config)
        : {};

      const validation = await this.providerService.validateProviderSettings(
        provider,
        dto.credentials,
        dto.provider_config || existingConfig,
      );

      if (!validation.valid) {
        throw new BadRequestException({
          message: 'Invalid provider credentials or configuration',
          errors: validation.errors,
        });
      }
    }

    // 4. Encrypt new credentials if provided
    let encryptedCredentials = existing.credentials;
    if (dto.credentials) {
      encryptedCredentials = this.encryption.encrypt(
        JSON.stringify(dto.credentials),
      );
    }

    // 5. If setting as active, deactivate other providers
    if (dto.is_active && !existing.is_active) {
      await this.deactivateAllProviders(tenantId);
    }

    // 6. Update configuration
    const updateData: any = {
      from_email: dto.from_email ?? existing.from_email,
      from_name: dto.from_name ?? existing.from_name,
      reply_to_email: dto.reply_to_email ?? existing.reply_to_email,
      webhook_secret: dto.webhook_secret ?? existing.webhook_secret,
      is_active: dto.is_active ?? existing.is_active,
      is_verified: dto.credentials ? false : existing.is_verified, // Reset verification if credentials changed
    };

    if (dto.provider_id) {
      updateData.provider_id = dto.provider_id;
    }

    if (dto.credentials) {
      updateData.credentials = encryptedCredentials as any;
    }

    if (dto.provider_config !== undefined) {
      updateData.provider_config = dto.provider_config as any;
    }

    const config = await this.prisma.tenant_email_config.update({
      where: { id: configId },
      data: updateData,
      include: {
        provider: {
          select: {
            provider_key: true,
            provider_name: true,
          },
        },
      },
    });

    this.logger.log(
      `Tenant email config updated for tenant ${tenantId} by user ${userId}: ${provider.provider_name}`,
    );

    const { credentials, ...safeConfig } = config;
    return safeConfig;
  }

  /**
   * Set a provider as active (deactivates all others)
   */
  async setActiveProvider(tenantId: string, configId: string, userId: string) {
    // Verify config belongs to tenant
    const config = await this.prisma.tenant_email_config.findFirst({
      where: { id: configId, tenant_id: tenantId },
      include: { provider: true },
    });

    if (!config) {
      throw new NotFoundException('Email provider configuration not found');
    }

    // Deactivate all providers for this tenant
    await this.deactivateAllProviders(tenantId);

    // Activate selected provider
    const updated = await this.prisma.tenant_email_config.update({
      where: { id: configId },
      data: { is_active: true },
      include: {
        provider: {
          select: {
            provider_key: true,
            provider_name: true,
          },
        },
      },
    });

    this.logger.log(
      `Provider activated for tenant ${tenantId} by user ${userId}: ${config.provider.provider_name}`,
    );

    const { credentials, ...safeConfig } = updated;
    return safeConfig;
  }

  /**
   * Delete provider configuration
   */
  async deleteProviderConfig(tenantId: string, configId: string, userId: string) {
    const config = await this.prisma.tenant_email_config.findFirst({
      where: { id: configId, tenant_id: tenantId },
      include: { provider: true },
    });

    if (!config) {
      throw new NotFoundException('Email provider configuration not found');
    }

    // Allow deletion even if active (tenant might not use email)
    await this.prisma.tenant_email_config.delete({
      where: { id: configId },
    });

    this.logger.log(
      `Provider deleted for tenant ${tenantId} by user ${userId}: ${config.provider.provider_name}`,
    );

    return { success: true, message: 'Provider configuration deleted' };
  }

  /**
   * Send test email to verify configuration
   */
  async sendTestEmail(
    tenantId: string,
    configId: string,
    toEmail: string,
    userId: string,
  ) {
    const config = await this.prisma.tenant_email_config.findFirst({
      where: { id: configId, tenant_id: tenantId },
      include: {
        provider: true,
        tenant: true,
      },
    });

    if (!config) {
      throw new NotFoundException('Email provider configuration not found');
    }

    try {
      // Send test email
      const result = await this.emailSender.send(
        config.provider,
        config.credentials,
        config.provider_config,
        {
          to: toEmail,
          from_email: config.from_email,
          from_name: config.from_name,
          reply_to: config.reply_to_email || undefined,
          subject: `Test Email from ${config.tenant.company_name}`,
          html_body: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: #4CAF50; color: white; padding: 20px; text-align: center; }
                .content { padding: 20px; background: #f9f9f9; }
                .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                .success { color: #4CAF50; font-weight: bold; }
                .info-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                .info-table td { padding: 8px; border-bottom: 1px solid #ddd; }
                .info-table td:first-child { font-weight: bold; width: 150px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>✅ Test Email Successful</h1>
                </div>
                <div class="content">
                  <p class="success">Your email configuration is working correctly!</p>
                  <p>This is a test email sent from your Lead360 communication system.</p>

                  <table class="info-table">
                    <tr>
                      <td>Business:</td>
                      <td>${config.tenant.company_name}</td>
                    </tr>
                    <tr>
                      <td>Provider:</td>
                      <td>${config.provider.provider_name}</td>
                    </tr>
                    <tr>
                      <td>From Email:</td>
                      <td>${config.from_email}</td>
                    </tr>
                    <tr>
                      <td>From Name:</td>
                      <td>${config.from_name}</td>
                    </tr>
                    <tr>
                      <td>Sent At:</td>
                      <td>${new Date().toLocaleString()}</td>
                    </tr>
                  </table>

                  <p>You can now send emails to your customers using this configuration.</p>
                </div>
                <div class="footer">
                  <p>Powered by Lead360 Communication System</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text_body: `Test Email Successful\n\nYour email configuration is working correctly!\n\nBusiness: ${config.tenant.company_name}\nProvider: ${config.provider.provider_name}\nFrom: ${config.from_name} <${config.from_email}>\nSent: ${new Date().toLocaleString()}\n\nPowered by Lead360`,
        },
      );

      // Mark configuration as verified
      await this.prisma.tenant_email_config.update({
        where: { id: configId },
        data: { is_verified: true },
      });

      this.logger.log(
        `Test email sent successfully for tenant ${tenantId} to ${toEmail} via ${config.provider.provider_name}`,
      );

      return {
        success: true,
        message: 'Test email sent successfully. Configuration verified.',
        provider_response: {
          messageId: result.messageId,
          provider: config.provider.provider_name,
        },
      };
    } catch (error) {
      this.logger.error(
        `Test email failed for tenant ${tenantId}: ${error.message}`,
        error.stack,
      );

      // Mark as unverified on failure
      await this.prisma.tenant_email_config.update({
        where: { id: configId },
        data: { is_verified: false },
      });

      throw new BadRequestException({
        message: 'Failed to send test email',
        error: error.message,
        provider: config.provider.provider_name,
      });
    }
  }

  /**
   * Helper: Deactivate all providers for tenant
   */
  private async deactivateAllProviders(tenantId: string) {
    await this.prisma.tenant_email_config.updateMany({
      where: { tenant_id: tenantId, is_active: true },
      data: { is_active: false },
    });
  }

  /**
   * @deprecated Use getActiveProvider() instead
   * Kept for backward compatibility
   */
  async get(tenantId: string) {
    const config = await this.getActiveProvider(tenantId);
    // Decrypt credentials
    let decryptedCredentials = {};
    if (config.credentials) {
      try {
        const encryptedString =
          typeof config.credentials === 'string'
            ? config.credentials
            : JSON.stringify(config.credentials);
        const decryptedString = this.encryption.decrypt(encryptedString);
        decryptedCredentials = JSON.parse(decryptedString);
      } catch (error) {
        this.logger.error(`Failed to decrypt credentials: ${error.message}`);
      }
    }

    const { credentials: encryptedCreds, ...safeConfig } = config;
    return {
      ...safeConfig,
      credentials: decryptedCredentials,
    };
  }

  /**
   * @deprecated Use createProviderConfig() or updateProviderConfig() instead
   * Kept for backward compatibility
   */
  async createOrUpdate(
    tenantId: string,
    dto: UpdateTenantEmailConfigDto,
    userId: string,
  ) {
    // Check if ANY config exists for this tenant
    const existing = await this.prisma.tenant_email_config.findFirst({
      where: { tenant_id: tenantId, provider_id: dto.provider_id },
    });

    if (existing) {
      // Update existing
      return this.updateProviderConfig(tenantId, existing.id, dto, userId);
    } else {
      // Create new - construct CreateTenantEmailConfigDto with all required fields
      const createDto: CreateTenantEmailConfigDto = {
        provider_id: dto.provider_id!,
        credentials: dto.credentials!,
        provider_config: dto.provider_config,
        from_email: dto.from_email!,
        from_name: dto.from_name!,
        reply_to_email: dto.reply_to_email,
        webhook_secret: dto.webhook_secret,
        is_active: true, // First provider is always active
      };
      return this.createProviderConfig(tenantId, createDto, userId);
    }
  }
}
