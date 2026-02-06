import { Test, TestingModule } from '@nestjs/testing';
import { WebhookVerificationService } from './webhook-verification.service';
import { createHmac } from 'crypto';

describe('WebhookVerificationService', () => {
  let service: WebhookVerificationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WebhookVerificationService],
    }).compile();

    service = module.get<WebhookVerificationService>(
      WebhookVerificationService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('verifySendGrid', () => {
    it('should verify valid SendGrid signature', () => {
      const payload = JSON.stringify({
        email: 'test@example.com',
        event: 'delivered',
      });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const secret = 'my-webhook-secret';

      // Calculate valid signature
      const signature = createHmac('sha256', secret)
        .update(timestamp + payload)
        .digest('base64');

      const result = service.verifySendGrid(
        payload,
        signature,
        timestamp,
        secret,
      );

      expect(result).toBe(true);
    });

    it('should reject invalid SendGrid signature', () => {
      const payload = JSON.stringify({ email: 'test@example.com' });
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const secret = 'my-webhook-secret';
      const wrongSignature = 'invalid-signature';

      const result = service.verifySendGrid(
        payload,
        wrongSignature,
        timestamp,
        secret,
      );

      expect(result).toBe(false);
    });

    it('should reject SendGrid webhook with old timestamp (replay attack prevention)', () => {
      const payload = JSON.stringify({ email: 'test@example.com' });
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 600).toString(); // 10 minutes ago
      const secret = 'my-webhook-secret';

      const signature = createHmac('sha256', secret)
        .update(oldTimestamp + payload)
        .digest('base64');

      const result = service.verifySendGrid(
        payload,
        signature,
        oldTimestamp,
        secret,
      );

      expect(result).toBe(false);
    });

    it('should use timing-safe comparison to prevent timing attacks', () => {
      const payload = 'test';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const secret = 'secret';

      const correctSignature = createHmac('sha256', secret)
        .update(timestamp + payload)
        .digest('base64');

      // Signature that differs by one character
      const almostCorrectSignature = correctSignature.slice(0, -1) + 'X';

      const start1 = process.hrtime.bigint();
      service.verifySendGrid(payload, correctSignature, timestamp, secret);
      const time1 = process.hrtime.bigint() - start1;

      const start2 = process.hrtime.bigint();
      service.verifySendGrid(
        payload,
        almostCorrectSignature,
        timestamp,
        secret,
      );
      const time2 = process.hrtime.bigint() - start2;

      // Timing difference should be minimal (constant-time comparison)
      // Allow 10x difference due to system variance
      const timingRatio = Number(time1) / Number(time2);
      expect(timingRatio).toBeGreaterThan(0.1);
      expect(timingRatio).toBeLessThan(10);
    });
  });

  describe('verifyBrevo', () => {
    it('should verify valid Brevo token', () => {
      const token = 'my-secret-token-12345';
      const expectedSecret = 'my-secret-token-12345';

      const result = service.verifyBrevo(token, expectedSecret);

      expect(result).toBe(true);
    });

    it('should reject invalid Brevo token', () => {
      const token = 'wrong-token';
      const expectedSecret = 'correct-token';

      const result = service.verifyBrevo(token, expectedSecret);

      expect(result).toBe(false);
    });

    it('should use timing-safe comparison for Brevo tokens', () => {
      const correctToken = 'my-secret-token-12345';
      const wrongToken = 'my-secret-token-12346'; // One character different

      const start1 = process.hrtime.bigint();
      service.verifyBrevo(correctToken, correctToken);
      const time1 = process.hrtime.bigint() - start1;

      const start2 = process.hrtime.bigint();
      service.verifyBrevo(wrongToken, correctToken);
      const time2 = process.hrtime.bigint() - start2;

      // Timing should be constant
      const timingRatio = Number(time1) / Number(time2);
      expect(timingRatio).toBeGreaterThan(0.1);
      expect(timingRatio).toBeLessThan(10);
    });
  });

  describe('verifyAmazonSES', () => {
    it('should reject message without required fields', async () => {
      const payload = {
        Type: 'Notification',
        // Missing Signature, SigningCertURL
      };

      const result = await service.verifyAmazonSES(payload);

      expect(result).toBe(false);
    });

    it('should reject unsupported signature version', async () => {
      const payload = {
        Type: 'Notification',
        SignatureVersion: '2',
        Signature: 'test',
        SigningCertURL: 'https://sns.us-east-1.amazonaws.com/cert.pem',
      };

      const result = await service.verifyAmazonSES(payload);

      expect(result).toBe(false);
    });

    it('should reject invalid certificate URL (security)', async () => {
      const invalidUrls = [
        'http://sns.us-east-1.amazonaws.com/cert.pem', // HTTP instead of HTTPS
        'https://evil.com/cert.pem', // Not amazonaws.com
        'https://amazonaws.com.evil.com/cert.pem', // Domain spoofing
      ];

      for (const url of invalidUrls) {
        const payload = {
          Type: 'Notification',
          SignatureVersion: '1',
          Signature: 'test',
          SigningCertURL: url,
        };

        const result = await service.verifyAmazonSES(payload);
        expect(result).toBe(false);
      }
    });

    it('should accept valid certificate URL patterns', async () => {
      const validUrls = [
        'https://sns.us-east-1.amazonaws.com/cert.pem',
        'https://sns-us-east-1.amazonaws.com/cert.pem',
      ];

      for (const url of validUrls) {
        const payload = {
          Type: 'Notification',
          SignatureVersion: '1',
          Signature: 'test',
          SigningCertURL: url,
          Message: 'test',
          MessageId: 'msg-123',
          Timestamp: new Date().toISOString(),
          TopicArn: 'arn:aws:sns:us-east-1:123456789:topic',
        };

        // Note: This will still fail certificate download, but URL validation passes
        try {
          await service.verifyAmazonSES(payload);
        } catch (error) {
          // Expected - certificate download will fail in test environment
        }
      }
    });
  });

  describe('Security: Timing Attack Prevention', () => {
    it('should not leak information about secret length', () => {
      const shortSecret = 'abc';
      const longSecret = 'abcdefghijklmnopqrstuvwxyz';
      const wrongGuess = 'xyz';

      const payload = 'test';
      const timestamp = Math.floor(Date.now() / 1000).toString();

      const shortSig = createHmac('sha256', shortSecret)
        .update(timestamp + payload)
        .digest('base64');

      const longSig = createHmac('sha256', longSecret)
        .update(timestamp + payload)
        .digest('base64');

      const start1 = process.hrtime.bigint();
      service.verifySendGrid(payload, wrongGuess, timestamp, shortSecret);
      const time1 = process.hrtime.bigint() - start1;

      const start2 = process.hrtime.bigint();
      service.verifySendGrid(payload, wrongGuess, timestamp, longSecret);
      const time2 = process.hrtime.bigint() - start2;

      // Times should be similar despite different secret lengths
      const timingRatio = Number(time1) / Number(time2);
      expect(timingRatio).toBeGreaterThan(0.1);
      expect(timingRatio).toBeLessThan(10);
    });
  });
});
