import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { Provider } from './communication-provider.service';

export interface EmailPayload {
  to: string | string[];
  cc?: string[];
  bcc?: string[];
  from_email: string;
  from_name: string;
  reply_to?: string;
  subject: string;
  html_body: string;
  text_body?: string;
  attachments?: Array<{
    content: string; // Base64
    filename: string;
    mime_type: string;
  }>;
}

export interface SendResult {
  messageId: string;
  metadata?: any;
}

/**
 * Email Sender Service
 *
 * Multi-provider email sending service with support for:
 * - SMTP (generic)
 * - SendGrid
 * - Amazon SES
 * - Brevo
 *
 * All provider integrations are production-ready
 */
@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);

  constructor(private readonly encryption: EncryptionService) {}

  /**
   * Send email via configured provider
   */
  async send(
    provider: Provider,
    encryptedCredentials: any,
    providerConfig: any,
    email: EmailPayload,
  ): Promise<SendResult> {
    try {
      // Decrypt credentials
      const credentials = this.decryptCredentials(encryptedCredentials);

      // Route to appropriate sender
      switch (provider.provider_key) {
        case 'smtp':
          return await this.sendViaSMTP(credentials, providerConfig, email);

        case 'sendgrid':
          return await this.sendViaSendGrid(credentials, providerConfig, email);

        case 'amazon_ses':
          return await this.sendViaAmazonSES(
            credentials,
            providerConfig,
            email,
          );

        case 'brevo':
          return await this.sendViaBrevo(credentials, providerConfig, email);

        default:
          throw new BadRequestException(
            `Unsupported email provider: ${provider.provider_key}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send email via ${provider.provider_key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send via SMTP (Nodemailer)
   */
  private async sendViaSMTP(
    credentials: any,
    config: any,
    email: EmailPayload,
  ): Promise<SendResult> {
    const nodemailer = await import('nodemailer');

    const transporter = nodemailer.createTransport({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_encryption === 'ssl', // true for SSL, false for TLS
      auth: {
        user: credentials.smtp_username,
        pass: credentials.smtp_password,
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    // Verify connection
    try {
      await transporter.verify();
    } catch (error) {
      throw new InternalServerErrorException(
        `SMTP connection failed: ${error.message}`,
      );
    }

    const mailOptions = {
      from: `"${email.from_name}" <${email.from_email}>`,
      to: Array.isArray(email.to) ? email.to.join(', ') : email.to,
      cc: email.cc?.join(', '),
      bcc: email.bcc?.join(', '),
      replyTo: email.reply_to,
      subject: email.subject,
      html: email.html_body,
      text: email.text_body,
      attachments: email.attachments?.map((att) => ({
        content: Buffer.from(att.content, 'base64'),
        filename: att.filename,
        contentType: att.mime_type,
      })),
    };

    const info = await transporter.sendMail(mailOptions);

    this.logger.log(`Email sent via SMTP: ${info.messageId}`);

    return {
      messageId: info.messageId,
      metadata: {
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      },
    };
  }

  /**
   * Send via SendGrid
   */
  private async sendViaSendGrid(
    credentials: any,
    config: any,
    email: EmailPayload,
  ): Promise<SendResult> {
    const sgMail = await import('@sendgrid/mail');
    sgMail.default.setApiKey(credentials.api_key);

    const msg: any = {
      to: email.to,
      cc: email.cc,
      bcc: email.bcc,
      from: {
        email: email.from_email,
        name: email.from_name,
      },
      replyTo: email.reply_to,
      subject: email.subject,
      html: email.html_body,
      text: email.text_body,
      trackingSettings: {
        clickTracking: {
          enable: config?.click_tracking || false,
        },
        openTracking: {
          enable: config?.open_tracking || false,
        },
      },
      mailSettings: {
        sandboxMode: {
          enable: config?.sandbox_mode || false,
        },
      },
      attachments: email.attachments?.map((att) => ({
        content: att.content, // Base64
        filename: att.filename,
        type: att.mime_type,
        disposition: 'attachment',
      })),
    };

    const [response] = await sgMail.default.send(msg);

    const messageId = response.headers['x-message-id'] as string;

    this.logger.log(`Email sent via SendGrid: ${messageId}`);

    return {
      messageId,
      metadata: {
        statusCode: response.statusCode,
        headers: response.headers,
      },
    };
  }

  /**
   * Send via Amazon SES
   */
  private async sendViaAmazonSES(
    credentials: any,
    config: any,
    email: EmailPayload,
  ): Promise<SendResult> {
    const awsModule = await import('aws-sdk');
    const AWS = awsModule.default || awsModule;

    // 🔍 DEBUG: Log all Amazon SES configuration details (FULL CREDENTIALS FOR DEBUGGING)
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log('🔍 AMAZON SES DEBUG - FULL Configuration Details');
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    this.logger.log(`📍 Region: ${credentials.region || 'NOT SET'}`);
    this.logger.log(
      `🔑 Access Key ID (FULL): ${credentials.access_key_id || 'NOT SET'}`,
    );
    this.logger.log(
      `🔐 Secret Access Key (FULL): ${credentials.secret_access_key || 'NOT SET'}`,
    );
    this.logger.log(`📧 From: "${email.from_name}" <${email.from_email}>`);
    this.logger.log(
      `📬 To: ${Array.isArray(email.to) ? email.to.join(', ') : email.to}`,
    );
    this.logger.log(`📝 Subject: ${email.subject}`);
    this.logger.log(
      `⚙️  Configuration Set: ${config?.configuration_set || 'NONE'}`,
    );
    this.logger.log(
      `📎 Has Attachments: ${email.attachments && email.attachments.length > 0 ? 'YES (' + email.attachments.length + ')' : 'NO'}`,
    );
    this.logger.log(
      `🔧 Provider Config (full): ${JSON.stringify(config, null, 2)}`,
    );
    this.logger.log(
      `🔧 Credentials Object (full): ${JSON.stringify(credentials, null, 2)}`,
    );
    this.logger.log(
      `🔌 Using SES API (not SMTP) - Endpoint will be: https://email.${credentials.region || 'us-east-1'}.amazonaws.com`,
    );
    this.logger.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const ses = new AWS.SES({
      accessKeyId: credentials.access_key_id,
      secretAccessKey: credentials.secret_access_key,
      region: credentials.region,
    });

    // For simple emails without attachments
    if (!email.attachments || email.attachments.length === 0) {
      const params: AWS.SES.SendEmailRequest = {
        Source: `"${email.from_name}" <${email.from_email}>`,
        Destination: {
          ToAddresses: Array.isArray(email.to) ? email.to : [email.to],
          CcAddresses: email.cc || [],
          BccAddresses: email.bcc || [],
        },
        Message: {
          Subject: {
            Data: email.subject,
            Charset: 'UTF-8',
          },
          Body: {
            Html: {
              Data: email.html_body,
              Charset: 'UTF-8',
            },
            Text: email.text_body
              ? {
                  Data: email.text_body,
                  Charset: 'UTF-8',
                }
              : undefined,
          },
        },
        ReplyToAddresses: email.reply_to ? [email.reply_to] : undefined,
        ConfigurationSetName: config?.configuration_set,
      };

      const result = await ses.sendEmail(params).promise();

      this.logger.log(`Email sent via Amazon SES: ${result.MessageId}`);

      return {
        messageId: result.MessageId,
        metadata: result,
      };
    } else {
      // For emails with attachments, use SendRawEmail with MIME construction
      const nodemailer = await import('nodemailer');

      const rawMessage = await nodemailer
        .createTransport({
          streamTransport: true,
        })
        .sendMail({
          from: `"${email.from_name}" <${email.from_email}>`,
          to: Array.isArray(email.to) ? email.to : [email.to],
          cc: email.cc,
          bcc: email.bcc,
          replyTo: email.reply_to,
          subject: email.subject,
          html: email.html_body,
          text: email.text_body,
          attachments: email.attachments.map((att) => ({
            content: Buffer.from(att.content, 'base64'),
            filename: att.filename,
            contentType: att.mime_type,
          })),
        });

      const params: AWS.SES.SendRawEmailRequest = {
        RawMessage: {
          Data: rawMessage.message,
        },
        ConfigurationSetName: config?.configuration_set,
      };

      const result = await ses.sendRawEmail(params).promise();

      this.logger.log(`Email sent via Amazon SES (raw): ${result.MessageId}`);

      return {
        messageId: result.MessageId,
        metadata: result,
      };
    }
  }

  /**
   * Send via Brevo (formerly Sendinblue)
   */
  private async sendViaBrevo(
    credentials: any,
    config: any,
    email: EmailPayload,
  ): Promise<SendResult> {
    const axios = await import('axios');

    const payload = {
      sender: {
        name: email.from_name,
        email: email.from_email,
      },
      to: Array.isArray(email.to)
        ? email.to.map((e) => ({ email: e }))
        : [{ email: email.to }],
      cc: email.cc?.map((e) => ({ email: e })),
      bcc: email.bcc?.map((e) => ({ email: e })),
      replyTo: email.reply_to ? { email: email.reply_to } : undefined,
      subject: email.subject,
      htmlContent: email.html_body,
      textContent: email.text_body,
      attachment: email.attachments?.map((att) => ({
        content: att.content, // Base64
        name: att.filename,
      })),
      params: {
        enableTracking: config?.enable_tracking || false,
      },
    };

    const response = await axios.default.post(
      'https://api.brevo.com/v3/smtp/email',
      payload,
      {
        headers: {
          'api-key': credentials.api_key,
          'Content-Type': 'application/json',
        },
      },
    );

    const messageId = response.data.messageId;

    this.logger.log(`Email sent via Brevo: ${messageId}`);

    return {
      messageId,
      metadata: response.data,
    };
  }

  /**
   * Decrypt credentials stored in database
   */
  private decryptCredentials(encryptedData: any): any {
    if (typeof encryptedData === 'string') {
      // Encrypted as JSON string
      return JSON.parse(this.encryption.decrypt(encryptedData));
    } else if (typeof encryptedData === 'object') {
      // Each field is encrypted separately
      const decrypted: any = {};
      for (const [key, value] of Object.entries(encryptedData)) {
        if (typeof value === 'string' && value.startsWith('{')) {
          // Looks like encrypted data
          try {
            decrypted[key] = this.encryption.decrypt(value);
          } catch {
            // Not encrypted, use as-is
            decrypted[key] = value;
          }
        } else {
          decrypted[key] = value;
        }
      }
      return decrypted;
    }

    return encryptedData;
  }

  /**
   * Test email connection (used in config testing)
   */
  async testConnection(
    provider: Provider,
    encryptedCredentials: any,
    providerConfig: any,
  ): Promise<boolean> {
    try {
      const credentials = this.decryptCredentials(encryptedCredentials);

      switch (provider.provider_key) {
        case 'smtp': {
          const nodemailer = await import('nodemailer');
          const transporter = nodemailer.createTransport({
            host: providerConfig.smtp_host,
            port: providerConfig.smtp_port,
            secure: providerConfig.smtp_encryption === 'ssl',
            auth: {
              user: credentials.smtp_username,
              pass: credentials.smtp_password,
            },
          });
          await transporter.verify();
          return true;
        }

        case 'sendgrid': {
          // SendGrid doesn't have a verify endpoint, just check API key format
          return credentials.api_key?.startsWith('SG.');
        }

        case 'amazon_ses': {
          const AWS = await import('aws-sdk');
          const ses = new AWS.SES({
            accessKeyId: credentials.access_key_id,
            secretAccessKey: credentials.secret_access_key,
            region: credentials.region,
          });
          // Test with getSendQuota
          await ses.getSendQuota().promise();
          return true;
        }

        case 'brevo': {
          const axios = await import('axios');
          // Test with account endpoint
          await axios.default.get('https://api.brevo.com/v3/account', {
            headers: { 'api-key': credentials.api_key },
          });
          return true;
        }

        default:
          return false;
      }
    } catch (error) {
      this.logger.warn(
        `Connection test failed for ${provider.provider_key}: ${error.message}`,
      );
      return false;
    }
  }
}
