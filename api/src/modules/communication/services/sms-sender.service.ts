import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { EncryptionService } from '../../../core/encryption/encryption.service';
import { Provider } from './communication-provider.service';

export interface SmsPayload {
  to_phone: string; // E.164 format
  text_body: string;
  media_urls?: string[]; // MMS support
}

export interface SmsSendResult {
  messageSid: string;
  status: string;
  metadata?: any;
}

/**
 * SMS Sender Service
 *
 * Production-ready SMS sending via Twilio
 */
@Injectable()
export class SmsSenderService {
  private readonly logger = new Logger(SmsSenderService.name);

  constructor(private readonly encryption: EncryptionService) {}

  /**
   * Send SMS via configured provider
   */
  async send(
    provider: Provider,
    encryptedCredentials: any,
    sms: SmsPayload,
  ): Promise<SmsSendResult> {
    try {
      const credentials = this.decryptCredentials(encryptedCredentials);

      switch (provider.provider_key) {
        case 'twilio_sms':
          return await this.sendViaTwilio(credentials, sms);

        default:
          throw new BadRequestException(
            `Unsupported SMS provider: ${provider.provider_key}`,
          );
      }
    } catch (error) {
      this.logger.error(
        `Failed to send SMS via ${provider.provider_key}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Send SMS via Twilio
   */
  private async sendViaTwilio(
    credentials: any,
    sms: SmsPayload,
  ): Promise<SmsSendResult> {
    const twilio = await import('twilio');

    const client = twilio.default(
      credentials.account_sid,
      credentials.auth_token,
    );

    const messageData: any = {
      body: sms.text_body,
      from: credentials.from_phone,
      to: sms.to_phone,
    };

    // Add media URLs for MMS if provided
    if (sms.media_urls && sms.media_urls.length > 0) {
      messageData.mediaUrl = sms.media_urls;
    }

    const message = await client.messages.create(messageData);

    this.logger.log(`SMS sent via Twilio: ${message.sid} to ${sms.to_phone}`);

    return {
      messageSid: message.sid,
      status: message.status,
      metadata: {
        numSegments: message.numSegments,
        price: message.price,
        priceUnit: message.priceUnit,
        direction: message.direction,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage,
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
   * Test SMS connection
   */
  async testConnection(
    provider: Provider,
    encryptedCredentials: any,
  ): Promise<boolean> {
    try {
      const credentials = this.decryptCredentials(encryptedCredentials);

      switch (provider.provider_key) {
        case 'twilio_sms': {
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
        `SMS connection test failed for ${provider.provider_key}: ${error.message}`,
      );
      return false;
    }
  }
}
