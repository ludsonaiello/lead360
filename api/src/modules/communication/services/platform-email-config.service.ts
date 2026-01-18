import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { CommunicationProviderService } from './communication-provider.service';
import { EmailSenderService } from './email-sender.service';
import { UpdatePlatformEmailConfigDto } from '../dto/email-config.dto';
import { randomUUID } from 'crypto';

/**
 * Platform Email Config Service
 *
 * Manages platform-wide email configuration for system emails
 * (password reset, welcome emails, etc.)
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

  async get() {
    const config = await this.prisma.platform_email_config.findFirst({
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

    if (!config) {
      throw new NotFoundException('Platform email configuration not found');
    }

    // Hide credentials
    const { credentials, ...rest } = config;

    return rest;
  }

  async createOrUpdate(dto: UpdatePlatformEmailConfigDto, userId: string) {
    // Validate provider exists and is active
    const provider = await this.providerService.getProvider(dto.provider_id);

    if (!provider.is_active) {
      throw new Error('Provider is not active');
    }

    // Validate credentials against provider schema
    const validation = await this.providerService.validateProviderSettings(
      provider,
      dto.credentials,
      dto.provider_config,
    );

    if (!validation.valid) {
      throw new Error(`Invalid credentials: ${JSON.stringify(validation.errors)}`);
    }

    // Encrypt credentials
    const encryptedCredentials = this.encryption.encrypt(
      JSON.stringify(dto.credentials),
    );

    // Check if config exists
    const existing = await this.prisma.platform_email_config.findFirst();

    if (existing) {
      // Update
      return this.prisma.platform_email_config.update({
        where: { id: existing.id },
        data: {
          provider_id: dto.provider_id,
          credentials: encryptedCredentials,
          provider_config: dto.provider_config || {},
          from_email: dto.from_email,
          from_name: dto.from_name,
          webhook_secret: dto.webhook_secret,
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
    } else {
      // Create
      return this.prisma.platform_email_config.create({
        data: {
          id: randomUUID(),
          provider_id: dto.provider_id,
          credentials: encryptedCredentials,
          provider_config: dto.provider_config || {},
          from_email: dto.from_email,
          from_name: dto.from_name,
          webhook_secret: dto.webhook_secret,
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
    }
  }

  async sendTestEmail(toEmail: string, userId: string) {
    const config = await this.prisma.platform_email_config.findFirst({
      include: { provider: true },
    });

    if (!config) {
      throw new NotFoundException('Platform email configuration not found');
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
}
