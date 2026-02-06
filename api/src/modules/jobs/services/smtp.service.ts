import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class SmtpService {
  private readonly logger = new Logger(SmtpService.name);
  private transporter: Transporter;
  private lastConfigUpdate: Date;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  async initializeTransporter(): Promise<void> {
    const config = await this.prisma.platform_email_config.findFirst({
      where: { is_active: true },
      include: { provider: true },
    });

    if (!config) {
      throw new Error('Active SMTP configuration not found');
    }

    // Check if the provider is SMTP
    if (config.provider?.provider_key !== 'smtp') {
      throw new Error(
        `Active provider is not SMTP, it is: ${config.provider?.provider_key}`,
      );
    }

    // Decrypt credentials (now stored in JSON format)
    const decryptedCredentials = this.encryption.decrypt(
      config.credentials as string,
    );
    const credentials = JSON.parse(decryptedCredentials);

    this.transporter = nodemailer.createTransport({
      host: credentials.host ?? '',
      port: credentials.port ?? 587,
      secure: credentials.encryption === 'ssl',
      auth: {
        user: credentials.username ?? '',
        pass: credentials.password ?? '',
      },
      pool: true,
      maxConnections: 5,
    } as any);

    this.lastConfigUpdate = config.updated_at;
    this.logger.log('SMTP transporter initialized');
  }

  async sendEmail(options: {
    to: string;
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ messageId: string }> {
    if (!this.transporter || (await this.configChanged())) {
      await this.initializeTransporter();
    }

    const config = await this.prisma.platform_email_config.findFirst({
      where: { is_active: true },
    });

    if (!config) {
      throw new Error('Active SMTP configuration not found');
    }

    const info = await this.transporter.sendMail({
      from: `"${config.from_name}" <${config.from_email}>`,
      to: options.to,
      cc: options.cc?.join(', '),
      bcc: options.bcc?.join(', '),
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    return { messageId: info.messageId };
  }

  async verifyConnection(): Promise<boolean> {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }
      await this.transporter.verify();
      return true;
    } catch (error) {
      this.logger.error(`SMTP verification failed: ${error.message}`);
      return false;
    }
  }

  private async configChanged(): Promise<boolean> {
    const config = await this.prisma.platform_email_config.findFirst({
      where: { is_active: true },
    });
    return !!(config && config.updated_at > this.lastConfigUpdate);
  }
}
