import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { Provider } from './communication-provider.service';

export interface WhatsAppPayload {
  to_phone: string; // E.164 format
  text_body: string;
  media_urls?: string[];
}

export interface WhatsAppSendResult {
  messageSid: string;
  status: string;
  metadata?: any;
}

/**
 * WhatsApp Sender Service
 *
 * Production-ready WhatsApp messaging via Twilio
 */
@Injectable()
export class WhatsAppSenderService {
  private readonly logger = new Logger(WhatsAppSenderService.name);

  constructor(private readonly encryption: EncryptionService) {}

  /**
   * Send WhatsApp message via configured provider
   */
  async send(
    provider: Provider,
    encryptedCredentials: any,
    message: WhatsAppPayload,
  ): Promise<WhatsAppSendResult> {
    try {
      const credentials = this.decryptCredentials(encryptedCredentials);

      switch (provider.provider_key) {
        case 'twilio_whatsapp':
          return await this.sendViaTwilio(credentials, message);

        default:
          throw new BadRequestException(
            `Unsupported WhatsApp provider: ${provider.provider_key}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send WhatsApp message via ${provider.provider_key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send WhatsApp message via Twilio
   */
  private async sendViaTwilio(
    credentials: any,
    message: WhatsAppPayload,
  ): Promise<WhatsAppSendResult> {
    const twilio = await import('twilio');

    const client = twilio.default(
      credentials.account_sid,
      credentials.auth_token,
    );

    const messageData: any = {
      body: message.text_body,
      from: `whatsapp:${credentials.from_phone}`,
      to: `whatsapp:${message.to_phone}`,
    };

    // Add media URLs if provided
    if (message.media_urls && message.media_urls.length > 0) {
      messageData.mediaUrl = message.media_urls;
    }

    const msg = await client.messages.create(messageData);

    this.logger.log(
      `WhatsApp message sent via Twilio: ${msg.sid} to ${message.to_phone}`,
    );

    return {
      messageSid: msg.sid,
      status: msg.status,
      metadata: {
        numSegments: msg.numSegments,
        price: msg.price,
        priceUnit: msg.priceUnit,
        direction: msg.direction,
        errorCode: msg.errorCode,
        errorMessage: msg.errorMessage,
      },
    };
  }

  /**
   * Decrypt credentials
   */
  private decryptCredentials(encryptedData: any): any {
    if (typeof encryptedData === 'string') {
      return JSON.parse(this.encryption.decrypt(encryptedData));
    } else if (typeof encryptedData === 'object') {
      const decrypted: any = {};
      for (const [key, value] of Object.entries(encryptedData)) {
        if (typeof value === 'string' && value.startsWith('{')) {
          try {
            decrypted[key] = this.encryption.decrypt(value);
          } catch {
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
   * Test WhatsApp connection
   */
  async testConnection(
    provider: Provider,
    encryptedCredentials: any,
  ): Promise<boolean> {
    try {
      const credentials = this.decryptCredentials(encryptedCredentials);

      switch (provider.provider_key) {
        case 'twilio_whatsapp': {
          const twilio = await import('twilio');
          const client = twilio.default(
            credentials.account_sid,
            credentials.auth_token,
          );

          // Verify credentials by fetching account info
          await client.api.accounts(credentials.account_sid).fetch();
          return true;
        }

        default:
          return false;
      }
    } catch (error) {
      this.logger.warn(
        `WhatsApp connection test failed for ${provider.provider_key}: ${error.message}`,
      );
      return false;
    }
  }
}
