import {
  Injectable,
  NotFoundException,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { CommunicationProviderService } from './communication-provider.service';
import { EmailSenderService } from './email-sender.service';
import {
  CreatePlatformEmailConfigDto,
  UpdatePlatformEmailConfigDto,
} from '../dto/email-config.dto';
import { randomUUID } from 'crypto';

/**
 * Platform Email Config Service
 *
 * Manages platform-wide email configurations for system emails
 * (password reset, welcome emails, etc.)
 *
 * NOW SUPPORTS MULTI-PROVIDER:
 * - Multiple providers can be configured (SendGrid, Brevo, Amazon SES, SMTP)
 * - Only ONE can be active at a time
 * - Switch between providers easily
 */
@Injectable()
export class PlatformEmailConfigService {
  private readonly logger = new Logger(PlatformEmailConfigService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly providerService: CommunicationProviderService,
    private readonly emailSender: EmailSenderService,
  ) {}

  /**
   * List all platform email configurations
   */
  async listConfigurations() {
    const configs = await this.prisma.platform_email_config.findMany({
      include: {
        provider: {
          select: {
            id: true,
            provider_key: true,
            provider_name: true,
            provider_type: true,
            is_active: true,
          },
        },
      },
      orderBy: [{ is_active: 'desc' }, { created_at: 'desc' }],
    });

    // Hide credentials in list view
    return configs.map(({ credentials, ...config }) => ({
      ...config,
      credentials_configured: !!credentials,
    }));
  }

  /**
   * Get active platform email configuration
   */
  async getActiveConfiguration() {
    const config = await this.prisma.platform_email_config.findFirst({
      where: { is_active: true },
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
      throw new NotFoundException('No active platform email configuration found');
    }

    // Hide credentials
    const { credentials, ...rest } = config;

    return {
      ...rest,
      credentials_configured: !!credentials,
    };
  }

  /**
   * Get specific platform email configuration by ID
   * Returns FULL config including decrypted credentials (Admin only)
   */
  async getConfiguration(configId: string) {
    const config = await this.prisma.platform_email_config.findUnique({
      where: { id: configId },
      include: {
        provider: true,
      },
    });

    if (!config) {
      throw new NotFoundException(`Platform email configuration not found: ${configId}`);
    }

    // Decrypt credentials
    const decryptedCredentials = this.encryption.decrypt(
      config.credentials as string,
    );

    return {
      ...config,
      credentials: JSON.parse(decryptedCredentials),
    };
  }

  /**
   * Create new platform email configuration
   */
  async createConfiguration(dto: CreatePlatformEmailConfigDto, userId: string) {
    // Validate provider exists and is active
    const provider = await this.providerService.getProviderById(dto.provider_id);

    if (!provider.is_active) {
      throw new BadRequestException('Provider is not active');
    }

    // Check if configuration already exists for this provider
    const existing = await this.prisma.platform_email_config.findUnique({
      where: { provider_id: dto.provider_id },
    });

    if (existing) {
      throw new ConflictException(
        `Platform configuration already exists for provider: ${provider.provider_name}`,
      );
    }

    // Validate credentials against provider schema
    const validation = await this.providerService.validateProviderSettings(
      provider,
      dto.credentials,
      dto.provider_config,
    );

    if (!validation.valid) {
      throw new BadRequestException(
        `Invalid credentials: ${JSON.stringify(validation.errors)}`,
      );
    }

    // Encrypt credentials
    const encryptedCredentials = this.encryption.encrypt(
      JSON.stringify(dto.credentials),
    );

    // If this is set as active, deactivate all others
    if (dto.is_active) {
      await this.prisma.platform_email_config.updateMany({
        data: { is_active: false },
      });
    }

    // Create configuration
    const config = await this.prisma.platform_email_config.create({
      data: {
        id: randomUUID(),
        provider_id: dto.provider_id,
        credentials: encryptedCredentials,
        provider_config: dto.provider_config || {},
        from_email: dto.from_email,
        from_name: dto.from_name,
        reply_to_email: dto.reply_to_email,
        webhook_secret: dto.webhook_secret,
        is_active: dto.is_active || false,
      },
      include: {
        provider: {
          select: {
            provider_key: true,
            provider_name: true,
            provider_type: true,
          },
        },
      },
    });

    // Hide credentials in response
    const { credentials, ...rest } = config;

    return {
      ...rest,
      credentials_configured: true,
    };
  }

  /**
   * Update existing platform email configuration
   */
  async updateConfiguration(
    configId: string,
    dto: UpdatePlatformEmailConfigDto,
    userId: string,
  ) {
    const existing = await this.prisma.platform_email_config.findUnique({
      where: { id: configId },
      include: { provider: true },
    });

    if (!existing) {
      throw new NotFoundException(`Platform email configuration not found: ${configId}`);
    }

    // If credentials are being updated, validate them
    let encryptedCredentials = existing.credentials;
    if (dto.credentials) {
      if (!existing.provider) {
        throw new NotFoundException('Provider not found for this configuration');
      }

      const validation = await this.providerService.validateProviderSettings(
        existing.provider,
        dto.credentials,
        dto.provider_config || (existing.provider_config as object) || {},
      );

      if (!validation.valid) {
        throw new BadRequestException(
          `Invalid credentials: ${JSON.stringify(validation.errors)}`,
        );
      }

      encryptedCredentials = this.encryption.encrypt(
        JSON.stringify(dto.credentials),
      );
    }

    // If setting as active, deactivate all others
    if (dto.is_active === true) {
      await this.prisma.platform_email_config.updateMany({
        where: { id: { not: configId } },
        data: { is_active: false },
      });
    }

    // Update configuration
    const updated = await this.prisma.platform_email_config.update({
      where: { id: configId },
      data: {
        credentials: encryptedCredentials as any,
        provider_config: (dto.provider_config ?? existing.provider_config) as any,
        from_email: dto.from_email ?? existing.from_email,
        from_name: dto.from_name ?? existing.from_name,
        reply_to_email: dto.reply_to_email ?? existing.reply_to_email,
        webhook_secret: dto.webhook_secret ?? existing.webhook_secret,
        is_active: dto.is_active ?? existing.is_active,
      },
      include: {
        provider: {
          select: {
            provider_key: true,
            provider_name: true,
            provider_type: true,
          },
        },
      },
    });

    // Hide credentials in response
    const { credentials, ...rest } = updated;

    return {
      ...rest,
      credentials_configured: true,
    };
  }

  /**
   * Activate a platform email configuration (deactivates all others)
   */
  async activateConfiguration(configId: string, userId: string) {
    const config = await this.prisma.platform_email_config.findUnique({
      where: { id: configId },
      include: { provider: true },
    });

    if (!config) {
      throw new NotFoundException(`Platform email configuration not found: ${configId}`);
    }

    // Deactivate all others
    await this.prisma.platform_email_config.updateMany({
      where: { id: { not: configId } },
      data: { is_active: false },
    });

    // Activate this one
    const activated = await this.prisma.platform_email_config.update({
      where: { id: configId },
      data: { is_active: true },
      include: {
        provider: {
          select: {
            provider_key: true,
            provider_name: true,
            provider_type: true,
          },
        },
      },
    });

    const { credentials, ...rest } = activated;

    return {
      ...rest,
      credentials_configured: true,
    };
  }

  /**
   * Delete platform email configuration
   */
  async deleteConfiguration(configId: string, userId: string) {
    const config = await this.prisma.platform_email_config.findUnique({
      where: { id: configId },
    });

    if (!config) {
      throw new NotFoundException(`Platform email configuration not found: ${configId}`);
    }

    if (config.is_active) {
      throw new BadRequestException(
        'Cannot delete active configuration. Please activate another configuration first.',
      );
    }

    await this.prisma.platform_email_config.delete({
      where: { id: configId },
    });

    return {
      success: true,
      message: 'Platform email configuration deleted successfully',
    };
  }

  /**
   * Send test email using a specific configuration
   */
  async sendTestEmail(configId: string, toEmail: string, userId: string) {
    const config = await this.prisma.platform_email_config.findUnique({
      where: { id: configId },
      include: { provider: true },
    });

    if (!config) {
      throw new NotFoundException(`Platform email configuration not found: ${configId}`);
    }

    if (!config.provider) {
      throw new NotFoundException('Platform email configuration is missing provider');
    }

    try {
      const result = await this.emailSender.send(
        config.provider,
        config.credentials,
        config.provider_config,
        {
          to: toEmail,
          from_email: config.from_email,
          from_name: config.from_name,
          subject: 'Test Email from Lead360 Platform',
          html_body: `
            <h1>Test Email</h1>
            <p>This is a test email from Lead360 Platform.</p>
            <p>Provider: ${config.provider.provider_name}</p>
            <p>Sent at: ${new Date().toISOString()}</p>
          `,
          text_body: 'This is a test email from Lead360 Platform.',
        },
      );

      // Mark as verified
      await this.prisma.platform_email_config.update({
        where: { id: config.id },
        data: { is_verified: true },
      });

      return {
        success: true,
        message: 'Test email sent successfully',
        provider_response: { messageId: result.messageId },
      };
    } catch (error) {
      this.logger.error(`Test email failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get provider configuration for active platform config
   * Used internally by email sender
   */
  async getProviderConfig() {
    const config = await this.prisma.platform_email_config.findFirst({
      where: { is_active: true },
      include: { provider: true },
    });

    if (!config) {
      throw new NotFoundException('No active platform email configuration found');
    }

    // Decrypt credentials
    const decryptedCredentials = this.encryption.decrypt(
      config.credentials as string,
    );

    return {
      provider: config.provider,
      credentials: JSON.parse(decryptedCredentials),
      provider_config: config.provider_config,
      from_email: config.from_email,
      from_name: config.from_name,
      reply_to_email: config.reply_to_email,
    };
  }
}
