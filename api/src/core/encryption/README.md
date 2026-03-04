# EncryptionService - AES-256-GCM Encryption

## Overview

The `EncryptionService` provides secure encryption and decryption of sensitive data using AES-256-GCM (Galois/Counter Mode) encryption. This service is primarily used for encrypting OAuth tokens and other sensitive credentials stored in the database.

## Features

- **Algorithm**: AES-256-GCM (FIPS 140-2 compliant)
- **Key Size**: 256 bits (32 bytes)
- **Authenticated Encryption**: GCM mode provides both confidentiality and authenticity
- **Random IV**: Each encryption operation uses a unique, randomly generated initialization vector
- **Tamper Detection**: Authentication tag verifies data integrity during decryption

## Setup

### 1. Environment Configuration

The encryption key must be configured in your `.env` file:

```env
ENCRYPTION_KEY=1d238a1a9dd10e8b30c93b9631758e89e299c58c4c3e1279e0f4241b01b98c0e
```

**Key Requirements**:
- Must be exactly **64 hexadecimal characters** (32 bytes = 256 bits)
- Should be cryptographically secure random data
- Must never be committed to version control
- Should be unique per environment (dev, staging, production)

### 2. Generate a New Key

To generate a secure encryption key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Module Import

Import the `EncryptionModule` in your feature module:

```typescript
import { EncryptionModule } from '../../core/encryption/encryption.module';

@Module({
  imports: [EncryptionModule],
  // ...
})
export class YourModule {}
```

## Usage

### Basic Usage

```typescript
import { Injectable } from '@nestjs/common';
import { EncryptionService } from '../../core/encryption/encryption.service';

@Injectable()
export class CalendarProviderService {
  constructor(private readonly encryptionService: EncryptionService) {}

  async saveOAuthTokens(accessToken: string, refreshToken: string) {
    // Encrypt tokens before storing in database
    const encryptedAccess = this.encryptionService.encrypt(accessToken);
    const encryptedRefresh = this.encryptionService.encrypt(refreshToken);

    // Store encrypted tokens in database
    await this.prisma.calendar_provider_connection.create({
      data: {
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
        // ... other fields
      },
    });
  }

  async getOAuthTokens(connectionId: string) {
    // Retrieve encrypted tokens from database
    const connection = await this.prisma.calendar_provider_connection.findUnique({
      where: { id: connectionId },
    });

    // Decrypt tokens before use
    const accessToken = this.encryptionService.decrypt(connection.access_token);
    const refreshToken = this.encryptionService.decrypt(connection.refresh_token);

    return { accessToken, refreshToken };
  }
}
```

### OAuth Token Encryption Example

For the `calendar_provider_connection` table (Google Calendar OAuth):

```typescript
@Injectable()
export class GoogleCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {}

  async storeGoogleConnection(
    tenantId: string,
    accessToken: string,
    refreshToken: string,
    expiresAt: Date,
    calendarId: string,
  ) {
    // Encrypt OAuth tokens
    const encryptedAccessToken = this.encryptionService.encrypt(accessToken);
    const encryptedRefreshToken = this.encryptionService.encrypt(refreshToken);

    // Store in database
    return this.prisma.calendar_provider_connection.create({
      data: {
        tenant_id: tenantId,
        provider_type: 'google_calendar',
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: expiresAt,
        connected_calendar_id: calendarId,
        sync_status: 'active',
      },
    });
  }

  async refreshGoogleToken(connectionId: string) {
    // Retrieve connection with encrypted tokens
    const connection = await this.prisma.calendar_provider_connection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error('Connection not found');
    }

    // Decrypt refresh token to use with Google API
    const refreshToken = this.encryptionService.decrypt(connection.refresh_token);

    // Call Google API to refresh token
    const { access_token, expires_in } = await this.googleApi.refreshToken(
      refreshToken,
    );

    // Encrypt new access token
    const encryptedAccessToken = this.encryptionService.encrypt(access_token);

    // Update database with new encrypted token
    return this.prisma.calendar_provider_connection.update({
      where: { id: connectionId },
      data: {
        access_token: encryptedAccessToken,
        token_expires_at: new Date(Date.now() + expires_in * 1000),
      },
    });
  }
}
```

## Security Best Practices

### 1. Never Log Encrypted Data

```typescript
// ❌ BAD - Don't log encrypted tokens
console.log('Encrypted token:', encryptedToken);

// ✅ GOOD - Log only metadata
console.log('Token encrypted successfully');
```

### 2. Never Return Encrypted Data in API Responses

```typescript
// ❌ BAD - Exposing encrypted token
return {
  connection: {
    id: connection.id,
    access_token: connection.access_token, // Encrypted token exposed
  },
};

// ✅ GOOD - Never expose tokens in responses
return {
  connection: {
    id: connection.id,
    provider_type: connection.provider_type,
    sync_status: connection.sync_status,
    // Tokens are never included
  },
};
```

### 3. Decrypt Only When Needed

```typescript
// ✅ GOOD - Decrypt just before use
async makeGoogleApiCall(connectionId: string) {
  const connection = await this.getConnection(connectionId);

  // Decrypt only when needed for API call
  const accessToken = this.encryptionService.decrypt(connection.access_token);

  try {
    return await this.googleApi.listEvents(accessToken);
  } finally {
    // Token goes out of scope immediately
  }
}
```

### 4. Handle Decryption Errors Gracefully

```typescript
async getDecryptedToken(connectionId: string): Promise<string | null> {
  try {
    const connection = await this.getConnection(connectionId);
    return this.encryptionService.decrypt(connection.access_token);
  } catch (error) {
    // Log the error (but not the encrypted data)
    this.logger.error('Failed to decrypt token', {
      connectionId,
      error: error.message,
    });

    // Set connection status to error
    await this.prisma.calendar_provider_connection.update({
      where: { id: connectionId },
      data: {
        sync_status: 'error',
        error_message: 'Token decryption failed',
      },
    });

    return null;
  }
}
```

## Encrypted Data Format

The encryption service returns a JSON string containing three components:

```json
{
  "iv": "32-character hex string (16 bytes)",
  "encrypted": "hex-encoded ciphertext",
  "authTag": "32-character hex string (16 bytes)"
}
```

**Important**: Store the entire JSON string in the database. All three components are required for decryption.

### Database Schema

For encrypted fields, use `TEXT` type to accommodate the JSON structure:

```prisma
model calendar_provider_connection {
  id            String @id @default(uuid()) @db.VarChar(36)
  tenant_id     String @db.VarChar(36)

  // OAuth Tokens (MUST BE ENCRYPTED)
  access_token     String @db.Text  // Stores encrypted JSON
  refresh_token    String @db.Text  // Stores encrypted JSON
  token_expires_at DateTime

  // ...
}
```

## Testing

Run the comprehensive test suite:

```bash
npm test -- encryption.service.spec.ts
```

The test suite covers:
- ✅ Basic encryption/decryption
- ✅ OAuth token handling
- ✅ Tamper detection (GCM authentication)
- ✅ Random IV generation
- ✅ Error handling
- ✅ Special characters and unicode
- ✅ Large data encryption
- ✅ Data integrity verification

## Common Use Cases

### 1. Google Calendar OAuth Tokens
```typescript
const encrypted = this.encryptionService.encrypt(googleAccessToken);
```

### 2. SMTP Passwords
```typescript
const encrypted = this.encryptionService.encrypt(smtpPassword);
```

### 3. API Keys
```typescript
const encrypted = this.encryptionService.encrypt(thirdPartyApiKey);
```

### 4. Webhook Secrets
```typescript
const encrypted = this.encryptionService.encrypt(webhookSecret);
```

## Troubleshooting

### Error: "ENCRYPTION_KEY must be a 64-character hex string"

**Cause**: Invalid or missing encryption key in environment variables.

**Solution**:
1. Verify `.env` file contains `ENCRYPTION_KEY`
2. Ensure the key is exactly 64 hexadecimal characters
3. Generate a new key if needed: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### Error: Decryption fails with "Unsupported state or unable to authenticate data"

**Cause**: Data has been tampered with, or wrong encryption key is being used.

**Solution**:
1. Verify the encryption key hasn't changed between encryption and decryption
2. Check that the encrypted data hasn't been modified in the database
3. Ensure you're using the correct environment's encryption key

### Error: "Cannot read property 'iv' of undefined"

**Cause**: Attempting to decrypt malformed data.

**Solution**:
1. Verify the data stored in the database is the complete JSON string from encryption
2. Ensure the database column type is `TEXT` (not `VARCHAR` which may truncate)
3. Check that the data hasn't been accidentally modified or corrupted

## Performance Considerations

- **Encryption**: ~0.1ms per operation (negligible overhead)
- **Decryption**: ~0.1ms per operation (negligible overhead)
- **Memory**: Minimal - only the plaintext and ciphertext are held in memory during operation
- **Concurrency**: Thread-safe - can be used concurrently by multiple requests

## Migration Guide

### Migrating Existing Unencrypted Data

If you have existing OAuth tokens in plaintext:

```typescript
async migrateUnencryptedTokens() {
  const connections = await this.prisma.calendar_provider_connection.findMany({
    where: {
      // Identify unencrypted tokens (they won't be valid JSON)
      access_token: { not: { startsWith: '{"iv":' } },
    },
  });

  for (const connection of connections) {
    const encryptedAccess = this.encryptionService.encrypt(
      connection.access_token,
    );
    const encryptedRefresh = this.encryptionService.encrypt(
      connection.refresh_token,
    );

    await this.prisma.calendar_provider_connection.update({
      where: { id: connection.id },
      data: {
        access_token: encryptedAccess,
        refresh_token: encryptedRefresh,
      },
    });
  }

  this.logger.log(`Migrated ${connections.length} connections to encrypted storage`);
}
```

## Security Audit Checklist

When implementing encryption for sensitive data:

- [ ] Encryption key is stored in environment variables (not code)
- [ ] Encryption key is unique per environment
- [ ] Encryption key is never logged or exposed in responses
- [ ] All sensitive data is encrypted before database storage
- [ ] Decryption only happens when data is needed
- [ ] Decrypted data is not logged
- [ ] API responses never include encrypted or decrypted tokens
- [ ] Error messages don't leak sensitive information
- [ ] Tests verify encryption/decryption roundtrip
- [ ] Tests verify tamper detection works

## References

- [NIST SP 800-38D: GCM Mode](https://csrc.nist.gov/publications/detail/sp/800-38d/final)
- [Node.js Crypto Documentation](https://nodejs.org/api/crypto.html)
- [AES-GCM Best Practices](https://cryptosense.com/blog/why-use-gcm-encryption/)

## Support

For questions or issues with the EncryptionService:
1. Check this documentation
2. Review the test suite for examples
3. Contact the backend team lead

---

**Last Updated**: Sprint 09 (CAL-09)
**Author**: Lead360 Platform Team
**Security Classification**: Internal - Encryption Implementation Guide
