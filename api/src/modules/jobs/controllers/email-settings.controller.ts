import {
  Controller,
  Get,
  Patch,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../rbac/guards/platform-admin.guard';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { SmtpService } from '../services/smtp.service';
import { EmailService } from '../services/email.service';
import { UpdateEmailConfigDto, SendTestEmailDto } from '../dto/email-settings.dto';
import { randomBytes } from 'crypto';

@ApiTags('Background Jobs - Email Settings')
@ApiBearerAuth()
@Controller('admin/jobs/email-settings')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class EmailSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
    private readonly smtpService: SmtpService,
    private readonly emailService: EmailService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Get current SMTP configuration (password masked)' })
  @ApiResponse({ status: 200, description: 'SMTP config retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async getEmailConfig() {
    const config = await this.prisma.platform_email_config.findFirst();

    if (!config) {
      return null;
    }

    return {
      ...config,
      smtp_password: '********', // Mask password
    };
  }

  @Patch()
  @ApiOperation({ summary: 'Update SMTP configuration' })
  @ApiResponse({ status: 200, description: 'SMTP config updated' })
  @ApiResponse({ status: 400, description: 'Invalid SMTP configuration' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async updateEmailConfig(@Body() dto: UpdateEmailConfigDto) {
    // Encrypt password
    const encryptedPassword = this.encryption.encrypt(dto.smtp_password);

    // Try to find existing config
    const existing = await this.prisma.platform_email_config.findFirst();

    let config;
    if (existing) {
      config = await this.prisma.platform_email_config.update({
        where: { id: existing.id },
        data: {
          smtp_host: dto.smtp_host,
          smtp_port: dto.smtp_port,
          smtp_encryption: dto.smtp_encryption,
          smtp_username: dto.smtp_username,
          smtp_password: encryptedPassword,
          from_email: dto.from_email,
          from_name: dto.from_name,
          is_verified: false, // Reset verification
        },
      });
    } else {
      config = await this.prisma.platform_email_config.create({
        data: {
          id: randomBytes(16).toString('hex'),
          smtp_host: dto.smtp_host,
          smtp_port: dto.smtp_port,
          smtp_encryption: dto.smtp_encryption,
          smtp_username: dto.smtp_username,
          smtp_password: encryptedPassword,
          from_email: dto.from_email,
          from_name: dto.from_name,
          is_verified: false,
        },
      });
    }

    // Reinitialize SMTP transporter
    await this.smtpService.initializeTransporter();

    return {
      ...config,
      smtp_password: '********',
    };
  }

  @Post('test')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send test email to verify SMTP configuration' })
  @ApiResponse({ status: 200, description: 'Test email sent successfully' })
  @ApiResponse({ status: 400, description: 'SMTP configuration error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Platform Admin only' })
  async sendTestEmail(@Body() dto: SendTestEmailDto) {
    try {
      const result = await this.emailService.sendTemplatedEmail({
        to: dto.to_email,
        templateKey: 'test-email',
        variables: {
          current_year: new Date().getFullYear(),
          platform_domain: process.env.PLATFORM_DOMAIN || 'lead360.app',
          platform_support_email: process.env.PLATFORM_SUPPORT_EMAIL || 'support@lead360.app',
          tenant_dashboard_url: process.env.APP_BASE_URL || 'https://app.lead360.app',
        },
      });

      // Mark config as verified
      const config = await this.prisma.platform_email_config.findFirst();
      if (config) {
        await this.prisma.platform_email_config.update({
          where: { id: config.id },
          data: { is_verified: true },
        });
      }

      return {
        message: 'Test email sent successfully',
        messageId: result.messageId,
      };
    } catch (error) {
      throw new BadRequestException(`SMTP test failed: ${error.message}`);
    }
  }
}
