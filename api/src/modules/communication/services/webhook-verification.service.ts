import { Injectable, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { EventWebhook, EventWebhookHeader } from '@sendgrid/eventwebhook';

/**
 * Webhook Verification Service
 *
 * Verifies webhook signatures from various providers
 * to prevent webhook spoofing attacks
 */
@Injectable()
export class WebhookVerificationService {
  private readonly logger = new Logger(WebhookVerificationService.name);

  /**
   * Verify SendGrid webhook signature using official SendGrid library
   *
   * SendGrid uses ECDSA (Elliptic Curve Digital Signature Algorithm) with public key verification
   * Reference: https://docs.sendgrid.com/for-developers/tracking-events/getting-started-event-webhook-security-features
   * Library: https://github.com/sendgrid/sendgrid-nodejs/tree/main/packages/eventwebhook
   */
  verifySendGrid(
    payload: Buffer,
    signature: string,
    timestamp: string,
    publicKeyBase64: string,
  ): boolean {
    try {
      this.logger.debug(
        `[SENDGRID VERIFY] Starting verification with official library`,
      );
      this.logger.debug(`[SENDGRID VERIFY] Signature: ${signature}`);
      this.logger.debug(`[SENDGRID VERIFY] Timestamp: ${timestamp}`);
      this.logger.debug(
        `[SENDGRID VERIFY] Public key (base64): ${publicKeyBase64}`,
      );
      this.logger.debug(
        `[SENDGRID VERIFY] Payload type: ${Buffer.isBuffer(payload) ? 'Buffer' : typeof payload}`,
      );
      this.logger.debug(
        `[SENDGRID VERIFY] Payload length: ${payload.length} bytes`,
      );

      // Initialize SendGrid EventWebhook
      const eventWebhook = new EventWebhook();

      // Convert base64 public key to PEM format (required by SendGrid library)
      // The library expects PEM format: -----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----
      const publicKeyPEM = `-----BEGIN PUBLIC KEY-----\n${publicKeyBase64}\n-----END PUBLIC KEY-----`;
      this.logger.debug(
        `[SENDGRID VERIFY] Public key PEM format:\n${publicKeyPEM}`,
      );

      // Convert public key to ECDSA format
      let ecPublicKey;
      try {
        ecPublicKey = eventWebhook.convertPublicKeyToECDSA(publicKeyPEM);
        this.logger.debug(
          `[SENDGRID VERIFY] Public key converted to ECDSA format successfully`,
        );
        this.logger.debug(
          `[SENDGRID VERIFY] ECDSA key type: ${typeof ecPublicKey}`,
        );
        this.logger.debug(
          `[SENDGRID VERIFY] ECDSA key object keys: ${Object.keys(ecPublicKey).join(', ')}`,
        );
      } catch (keyError) {
        this.logger.error(
          `[SENDGRID VERIFY] Failed to convert public key: ${keyError.message}`,
        );
        throw keyError;
      }

      // ✅ CORRECT APPROACH: Verify the raw Buffer directly
      // SendGrid signs the EXACT raw bytes sent over HTTP
      // Do NOT convert to string - that breaks verification for batched webhooks
      // The verifySignature method accepts Buffer even though types say string
      this.logger.debug(
        `[SENDGRID VERIFY] Verifying raw Buffer (${payload.length} bytes)`,
      );
      this.logger.debug(
        `[SENDGRID VERIFY] First 20 bytes (hex): ${payload.slice(0, 20).toString('hex')}`,
      );

      const verified = eventWebhook.verifySignature(
        ecPublicKey,
        payload as any, // Pass Buffer directly (types say string, but Buffer is correct)
        signature,
        timestamp,
      );

      if (!verified) {
        this.logger.warn('SendGrid webhook signature verification failed');
        this.logger.warn(`Payload length: ${payload.length} bytes`);
        this.logger.warn(`Signature: ${signature}`);
        this.logger.warn(`Timestamp: ${timestamp}`);
        this.logger.warn(
          `First 50 bytes of payload: ${payload.toString('utf8').substring(0, 50)}`,
        );
        return false;
      }

      this.logger.debug(
        `[SENDGRID VERIFY] ✅ Signature verified successfully (raw Buffer)`,
      );

      // Prevent replay attacks (5 minute window)
      const now = Math.floor(Date.now() / 1000);
      const webhookTimestamp = parseInt(timestamp, 10);

      this.logger.debug(`[SENDGRID VERIFY] Current timestamp: ${now}`);
      this.logger.debug(
        `[SENDGRID VERIFY] Webhook timestamp: ${webhookTimestamp}`,
      );
      this.logger.debug(
        `[SENDGRID VERIFY] Time difference: ${Math.abs(now - webhookTimestamp)}s`,
      );

      if (Math.abs(now - webhookTimestamp) > 300) {
        this.logger.warn(
          `SendGrid webhook rejected: timestamp too old (${Math.abs(now - webhookTimestamp)}s)`,
        );
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(
        `SendGrid signature verification error: ${error.message}`,
      );
      this.logger.error(`Stack: ${error.stack}`);
      return false;
    }
  }

  /**
   * Verify Amazon SES/SNS webhook signature
   *
   * SNS signs messages with SHA256withRSA
   * Full implementation with certificate validation
   */
  async verifyAmazonSES(payload: any): Promise<boolean> {
    try {
      const {
        Type,
        SignatureVersion,
        Signature,
        SigningCertURL,
        Message,
        MessageId,
        Timestamp,
        TopicArn,
        Subject,
        SubscribeURL,
        Token,
      } = payload;

      // Basic validation
      if (!Type || !Signature || !SigningCertURL) {
        this.logger.warn('Amazon SES webhook missing required fields');
        return false;
      }

      // Signature version must be '1'
      if (SignatureVersion !== '1') {
        this.logger.warn(
          `Amazon SES unsupported signature version: ${SignatureVersion}`,
        );
        return false;
      }

      // Verify certificate URL is from AWS (security critical)
      const certUrl = new URL(SigningCertURL);
      if (
        !certUrl.protocol.startsWith('https') ||
        !certUrl.hostname.endsWith('.amazonaws.com') ||
        (!certUrl.hostname.startsWith('sns.') &&
          !certUrl.hostname.startsWith('sns-'))
      ) {
        this.logger.warn(
          `Amazon SES invalid certificate URL: ${SigningCertURL}`,
        );
        return false;
      }

      // Download and cache certificate
      const certificate =
        await this.downloadAndCacheCertificate(SigningCertURL);

      // Build canonical signing string based on message type
      let signingString: string;

      if (
        Type === 'SubscriptionConfirmation' ||
        Type === 'UnsubscribeConfirmation'
      ) {
        signingString =
          [
            'Message',
            Message,
            'MessageId',
            MessageId,
            'SubscribeURL',
            SubscribeURL,
            'Timestamp',
            Timestamp,
            'Token',
            Token,
            'TopicArn',
            TopicArn,
            'Type',
            Type,
          ].join('\n') + '\n';
      } else if (Type === 'Notification') {
        const parts = ['Message', Message, 'MessageId', MessageId];

        if (Subject) {
          parts.push('Subject', Subject);
        }

        parts.push('Timestamp', Timestamp, 'TopicArn', TopicArn, 'Type', Type);

        signingString = parts.join('\n') + '\n';
      } else {
        this.logger.warn(`Amazon SES unknown message type: ${Type}`);
        return false;
      }

      // Verify signature using certificate's public key
      const crypto = require('crypto');
      const verifier = crypto.createVerify('SHA256WithRSA');
      verifier.update(signingString, 'utf8');

      const verified = verifier.verify(certificate, Signature, 'base64');

      if (!verified) {
        this.logger.warn('Amazon SES signature verification failed');
      }

      return verified;
    } catch (error) {
      this.logger.error(
        `Amazon SES signature verification error: ${error.message}`,
        error.stack,
      );
      return false;
    }
  }

  /**
   * Download and cache SNS certificate
   * Certificates are cached for 24 hours to avoid repeated downloads
   */
  private certificateCache = new Map<
    string,
    { cert: string; expires: number }
  >();

  private async downloadAndCacheCertificate(url: string): Promise<string> {
    const now = Date.now();

    // Check cache
    const cached = this.certificateCache.get(url);
    if (cached && cached.expires > now) {
      return cached.cert;
    }

    // Download certificate
    const https = require('https');
    const cert = await new Promise<string>((resolve, reject) => {
      https
        .get(url, (res: any) => {
          let data = '';
          res.on('data', (chunk: any) => (data += chunk));
          res.on('end', () => resolve(data));
        })
        .on('error', reject);
    });

    // Cache for 24 hours
    this.certificateCache.set(url, {
      cert,
      expires: now + 24 * 60 * 60 * 1000,
    });

    // Clean old cache entries (keep cache size manageable)
    for (const [key, value] of this.certificateCache.entries()) {
      if (value.expires <= now) {
        this.certificateCache.delete(key);
      }
    }

    return cert;
  }

  /**
   * Verify Brevo webhook signature
   *
   * Brevo uses a simple token-based authentication
   */
  verifyBrevo(token: string, expectedSecret: string): boolean {
    try {
      const verified = this.timingSafeEqual(token, expectedSecret);

      if (!verified) {
        this.logger.warn('Brevo webhook token verification failed');
      }

      return verified;
    } catch (error) {
      this.logger.error(`Brevo token verification error: ${error.message}`);
      return false;
    }
  }

  /**
   * Verify Twilio webhook signature
   *
   * Twilio uses HMAC-SHA1 with URL and parameters
   */
  verifyTwilio(
    url: string,
    params: Record<string, string>,
    signature: string,
    authToken: string,
  ): boolean {
    try {
      const twilio = require('twilio');

      // Use Twilio's official validation
      const verified = twilio.validateRequest(
        authToken,
        signature,
        url,
        params,
      );

      if (!verified) {
        this.logger.warn('Twilio webhook signature verification failed');
      }

      return verified;
    } catch (error) {
      this.logger.error(
        `Twilio signature verification error: ${error.message}`,
      );
      return false;
    }
  }

  /**
   * Timing-safe string comparison to prevent timing attacks
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
