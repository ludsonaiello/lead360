import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { SmtpService } from './smtp.service';
import { EmailTemplateService } from './email-template.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly smtp: SmtpService,
    private readonly templates: EmailTemplateService,
  ) {}

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

    const result = await this.smtp.sendEmail({
      to: options.to,
      cc: options.cc,
      bcc: options.bcc,
      subject,
      html,
      text,
    });

    this.logger.log(
      `Email sent to ${options.to} using template ${options.templateKey}`,
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
    return this.smtp.sendEmail(options);
  }
}
