import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { EmailSenderService } from '../../communication/services/email-sender.service';
import { EmailTemplateService } from './email-template.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSender: EmailSenderService,
    private readonly templates: EmailTemplateService,
  ) {}

  /**
   * Load active email provider config from database
   */
  private async getActiveConfig() {
    const config = await this.prisma.platform_email_config.findFirst({
      where: { is_active: true },
      include: { provider: true },
    });

    if (!config) {
      throw new Error('No active email configuration found');
    }

    return config;
  }

  async sendTemplatedEmail(options: {
    to: string;
    cc?: string[];
    bcc?: string[];
    templateKey: string;
    variables: Record<string, any>;
  }): Promise<{ messageId: string }> {
    const template = await this.templates.getTemplate(options.templateKey);

    const subject = this.templates.renderTemplate(
      template.subject,
      options.variables,
    );
    const html = this.templates.renderTemplate(
      template.html_body,
      options.variables,
    );
    const text = template.text_body
      ? this.templates.renderTemplate(template.text_body, options.variables)
      : undefined;

    const config = await this.getActiveConfig();

    const result = await this.emailSender.send(
      config.provider,
      config.credentials,
      config.provider_config,
      {
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        from_email: config.from_email,
        from_name: config.from_name,
        reply_to: config.reply_to_email || undefined,
        subject,
        html_body: html,
        text_body: text,
      },
    );

    this.logger.log(
      `Email sent to ${options.to} using template ${options.templateKey} via ${config.provider.provider_key}`,
    );

    return result;
  }

  async sendRawEmail(options: {
    to: string;
    cc?: string[];
    bcc?: string[];
    subject: string;
    html: string;
    text?: string;
  }): Promise<{ messageId: string }> {
    const config = await this.getActiveConfig();

    return this.emailSender.send(
      config.provider,
      config.credentials,
      config.provider_config,
      {
        to: options.to,
        cc: options.cc,
        bcc: options.bcc,
        from_email: config.from_email,
        from_name: config.from_name,
        reply_to: config.reply_to_email || undefined,
        subject: options.subject,
        html_body: options.html,
        text_body: options.text,
      },
    );
  }
}
