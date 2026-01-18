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
import { UpdateTenantEmailConfigDto } from '../dto/email-config.dto';
import { randomUUID } from 'crypto';

/**
 * Tenant Email Config Service
 *
 * Manages tenant-specific email configuration.
 * Each tenant can configure their own email provider for outbound emails.
 *
 * Features:
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
   * Get tenant email configuration (credentials hidden)
   */
  async get(tenantId: string) {
    const config = await this.prisma.tenant_email_config.findUnique({
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
    });

    if (!config) {
      throw new NotFoundException(
        'Email configuration not found for this tenant',
      );
    }

    // Hide encrypted credentials from response
    const { credentials, ...safeConfig } = config;

    return safeConfig;
  }

  /**
   * Create or update tenant email configuration
   */
  async createOrUpdate(
    tenantId: string,
    dto: UpdateTenantEmailConfigDto,
    userId: string,
  ) {
    // 1. Validate provider exists and is active
    const provider = await this.providerService.getProvider(dto.provider_id);

    if (!provider.is_active) {
      throw new BadRequestException(`Provider ${provider.provider_name} is not active`);
    }

    if (provider.provider_type !== 'email') {
      throw new BadRequestException(
        `Provider ${provider.provider_name} is not an email provider`,
      );
    }

    // 2. Validate credentials against provider's JSON Schema
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

    // 3. Encrypt credentials
    const encryptedCredentials = this.encryption.encrypt(
      JSON.stringify(dto.credentials),
    );

    // 4. Check if config exists for this tenant
    const existing = await this.prisma.tenant_email_config.findUnique({
      where: { tenant_id: tenantId },
    });

    let config;

    if (existing) {
      // Update existing configuration
      config = await this.prisma.tenant_email_config.update({
        where: { tenant_id: tenantId },
        data: {
          provider_id: dto.provider_id,
          credentials: encryptedCredentials,
          provider_config: dto.provider_config || {},
          from_email: dto.from_email,
          from_name: dto.from_name,
          reply_to_email: dto.reply_to_email,
          webhook_secret: dto.webhook_secret,
          is_verified: false, // Reset verification on update
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
        `Tenant email config updated for tenant ${tenantId} by user ${userId}`,
      );
    } else {
      // Create new configuration
      config = await this.prisma.tenant_email_config.create({
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
          is_verified: false,
          is_active: true,
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
        `Tenant email config created for tenant ${tenantId} by user ${userId}`,
      );
    }

    // Hide credentials from response
    const { credentials, ...safeConfig } = config;

    return safeConfig;
  }

  /**
   * Send test email to verify configuration
   */
  async sendTestEmail(tenantId: string, toEmail: string, userId: string) {
    const config = await this.prisma.tenant_email_config.findUnique({
      where: { tenant_id: tenantId },
      include: {
        provider: true,
        tenant: true,
      },
    });

    if (!config) {
      throw new NotFoundException(
        'Email configuration not found for this tenant',
      );
    }

    if (!config.is_active) {
      throw new BadRequestException('Email configuration is not active');
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
        where: { tenant_id: tenantId },
        data: { is_verified: true },
      });

      this.logger.log(
        `Test email sent successfully for tenant ${tenantId} to ${toEmail}`,
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
        where: { tenant_id: tenantId },
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
   * Get active provider for tenant (used internally by send services)
   */
  async getActiveProvider(tenantId: string) {
    const config = await this.prisma.tenant_email_config.findUnique({
      where: { tenant_id: tenantId },
      include: { provider: true },
    });

    if (!config) {
      throw new NotFoundException(
        `No email configuration found for tenant ${tenantId}`,
      );
    }

    if (!config.is_active) {
      throw new BadRequestException(
        `Email configuration is inactive for tenant ${tenantId}`,
      );
    }

    return config;
  }
}
