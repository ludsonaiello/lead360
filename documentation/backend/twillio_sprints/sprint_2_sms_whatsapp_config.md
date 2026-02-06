# Sprint 2: SMS & WhatsApp Configuration Management

**Duration**: Week 2
**Goal**: Implement tenant SMS/WhatsApp configuration and wire existing processors
**Sprint Type**: Configuration Management & Integration
**Estimated Effort**: 3-4 days
**Dependencies**: Sprint 1 (Database schema complete)

---

## Overview

This sprint implements tenant-level SMS and WhatsApp configuration management, allowing tenants to configure their Twilio credentials. It also updates existing SMS/WhatsApp processors to load configuration from the database (resolving existing TODO comments).

> **⚠️ IMPORTANT: Endpoint Namespace Updated**
>
> As of Sprint 7 (Namespace Refactoring), all endpoints in this sprint now use the `/twilio/` namespace:
> - OLD: `/api/v1/communication/twilio/sms-config`
> - NEW: `/api/v1/communication/twilio/sms-config`
> - OLD: `/api/v1/communication/twilio/whatsapp-config`
> - NEW: `/api/v1/communication/twilio/whatsapp-config`
>
> All code examples, curl commands, and verification steps below have been updated to reflect the new paths.
> See `sprint_7_namespace_refactoring.md` for full details on the namespace strategy.

---

## Prerequisites

- [ ] Sprint 1 completed (database schema in place)
- [ ] Understand existing `/api/src/modules/communication/services/tenant-email-config.service.ts` pattern
- [ ] Review existing `/api/src/modules/communication/processors/send-sms.processor.ts`
- [ ] Understand EncryptionService usage for credential storage

---

## Task Breakdown

### Task 2.1: Create TenantSmsConfigService

**File**: `/var/www/lead360.app/api/src/modules/communication/services/tenant-sms-config.service.ts`

**Pattern**: Mirror `tenant-email-config.service.ts` structure

**Service Implementation**:

```typescript
import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { EncryptionService } from '@core/encryption/encryption.service';
import { CreateTenantSmsConfigDto } from '../dto/sms-config/create-tenant-sms-config.dto';
import { UpdateTenantSmsConfigDto } from '../dto/sms-config/update-tenant-sms-config.dto';
import twilio from 'twilio';

@Injectable()
export class TenantSmsConfigService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /**
   * Create SMS configuration for tenant
   * Validates Twilio credentials and encrypts before storage
   */
  async create(tenantId: string, dto: CreateTenantSmsConfigDto) {
    // 1. Check if active config already exists
    const existing = await this.prisma.tenantSmsConfig.findFirst({
      where: { tenant_id: tenantId, is_active: true },
    });

    if (existing) {
      throw new ConflictException('Active SMS configuration already exists. Deactivate existing config first.');
    }

    // 2. Validate Twilio credentials
    await this.validateTwilioCredentials(dto.account_sid, dto.auth_token, dto.from_phone);

    // 3. Encrypt credentials
    const encryptedCredentials = this.encryption.encrypt(
      JSON.stringify({
        account_sid: dto.account_sid,
        auth_token: dto.auth_token,
        from_phone: dto.from_phone,
      })
    );

    // 4. Create configuration
    return this.prisma.tenantSmsConfig.create({
      data: {
        tenant_id: tenantId,
        provider_id: dto.provider_id, // Should be 'twilio_sms' provider
        credentials: encryptedCredentials,
        from_phone: dto.from_phone,
        is_active: true,
        is_verified: true, // Set to true after validation
        webhook_secret: dto.webhook_secret,
      },
      include: {
        provider: true,
      },
    });
  }

  /**
   * Get active SMS configuration for tenant
   */
  async findByTenantId(tenantId: string) {
    const config = await this.prisma.tenantSmsConfig.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
      include: {
        provider: true,
      },
    });

    if (!config) {
      throw new NotFoundException('No active SMS configuration found for this tenant');
    }

    // DO NOT return decrypted credentials in API response
    return {
      ...config,
      credentials: undefined, // Never expose credentials
    };
  }

  /**
   * Get decrypted credentials (for internal use only)
   */
  async getDecryptedCredentials(tenantId: string) {
    const config = await this.prisma.tenantSmsConfig.findFirst({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!config) {
      throw new NotFoundException('No active SMS configuration found');
    }

    const decrypted = JSON.parse(this.encryption.decrypt(config.credentials));
    return decrypted;
  }

  /**
   * Update SMS configuration
   */
  async update(tenantId: string, configId: string, dto: UpdateTenantSmsConfigDto) {
    // Verify config belongs to tenant
    const config = await this.prisma.tenantSmsConfig.findFirst({
      where: {
        id: configId,
        tenant_id: tenantId,
      },
    });

    if (!config) {
      throw new NotFoundException('SMS configuration not found');
    }

    // If credentials are being updated, validate and encrypt
    let updatedCredentials = config.credentials;
    if (dto.account_sid || dto.auth_token || dto.from_phone) {
      // Merge with existing credentials
      const existing = JSON.parse(this.encryption.decrypt(config.credentials));
      const updated = {
        account_sid: dto.account_sid || existing.account_sid,
        auth_token: dto.auth_token || existing.auth_token,
        from_phone: dto.from_phone || existing.from_phone,
      };

      // Validate new credentials
      await this.validateTwilioCredentials(updated.account_sid, updated.auth_token, updated.from_phone);

      updatedCredentials = this.encryption.encrypt(JSON.stringify(updated));
    }

    return this.prisma.tenantSmsConfig.update({
      where: { id: configId },
      data: {
        credentials: updatedCredentials,
        from_phone: dto.from_phone || config.from_phone,
        webhook_secret: dto.webhook_secret !== undefined ? dto.webhook_secret : config.webhook_secret,
        is_active: dto.is_active !== undefined ? dto.is_active : config.is_active,
      },
      include: {
        provider: true,
      },
    });
  }

  /**
   * Delete (deactivate) SMS configuration
   */
  async delete(tenantId: string, configId: string) {
    const config = await this.prisma.tenantSmsConfig.findFirst({
      where: {
        id: configId,
        tenant_id: tenantId,
      },
    });

    if (!config) {
      throw new NotFoundException('SMS configuration not found');
    }

    // Soft delete (set is_active = false)
    return this.prisma.tenantSmsConfig.update({
      where: { id: configId },
      data: { is_active: false },
    });
  }

  /**
   * Test SMS configuration by sending test message
   */
  async testConnection(tenantId: string, configId: string) {
    const config = await this.prisma.tenantSmsConfig.findFirst({
      where: {
        id: configId,
        tenant_id: tenantId,
      },
    });

    if (!config) {
      throw new NotFoundException('SMS configuration not found');
    }

    const credentials = JSON.parse(this.encryption.decrypt(config.credentials));

    try {
      const client = twilio(credentials.account_sid, credentials.auth_token);

      // Send test SMS to the from_phone number (sends to self)
      const message = await client.messages.create({
        body: 'Test message from Lead360. Your SMS configuration is working correctly.',
        from: credentials.from_phone,
        to: credentials.from_phone, // Send to self for testing
      });

      return {
        success: true,
        message: 'Test SMS sent successfully',
        twilio_message_sid: message.sid,
      };
    } catch (error) {
      throw new BadRequestException(`SMS test failed: ${error.message}`);
    }
  }

  /**
   * Validate Twilio credentials
   */
  private async validateTwilioCredentials(accountSid: string, authToken: string, fromPhone: string): Promise<void> {
    // Validate format
    if (!accountSid.match(/^AC[a-z0-9]{32}$/)) {
      throw new BadRequestException('Invalid Twilio Account SID format');
    }

    if (!fromPhone.startsWith('+')) {
      throw new BadRequestException('Phone number must be in E.164 format (starting with +)');
    }

    // Test credentials by fetching account details
    try {
      const client = twilio(accountSid, authToken);
      await client.api.accounts(accountSid).fetch();
    } catch (error) {
      throw new BadRequestException('Invalid Twilio credentials. Please check Account SID and Auth Token.');
    }
  }
}
```

---

### Task 2.2: Create TenantWhatsAppConfigService

**File**: `/var/www/lead360.app/api/src/modules/communication/services/tenant-whatsapp-config.service.ts`

**Implementation**: Nearly identical to `TenantSmsConfigService`, with these changes:

1. Use `tenantWhatsappConfig` table instead of `tenantSmsConfig`
2. Phone number format: Prefix with `whatsapp:` (e.g., `whatsapp:+19781234567`)
3. Test message body: "Test WhatsApp message from Lead360..."
4. Provider ID: `twilio_whatsapp` instead of `twilio_sms`

**Copy `TenantSmsConfigService` and adapt accordingly.**

---

### Task 2.3: Create DTOs

#### Create SMS Configuration DTO

**File**: `/var/www/lead360.app/api/src/modules/communication/dto/sms-config/create-tenant-sms-config.dto.ts`

```typescript
import { IsString, IsUUID, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantSmsConfigDto {
  @ApiProperty({
    description: 'Communication provider ID (twilio_sms)',
    example: 'provider-uuid-123',
  })
  @IsUUID()
  provider_id: string;

  @ApiProperty({
    description: 'Twilio Account SID',
    example: 'ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    pattern: '^AC[a-z0-9]{32}$',
  })
  @IsString()
  @Matches(/^AC[a-z0-9]{32}$/, { message: 'Invalid Twilio Account SID format' })
  account_sid: string;

  @ApiProperty({
    description: 'Twilio Auth Token',
    example: 'your_auth_token_here',
  })
  @IsString()
  auth_token: string;

  @ApiProperty({
    description: 'Twilio phone number in E.164 format',
    example: '+19781234567',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format' })
  from_phone: string;

  @ApiProperty({
    description: 'Optional webhook secret for signature verification',
    required: false,
  })
  @IsOptional()
  @IsString()
  webhook_secret?: string;
}
```

#### Update SMS Configuration DTO

**File**: `/var/www/lead360.app/api/src/modules/communication/dto/sms-config/update-tenant-sms-config.dto.ts`

```typescript
import { IsString, IsBoolean, IsOptional, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateTenantSmsConfigDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^AC[a-z0-9]{32}$/)
  account_sid?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  auth_token?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/)
  from_phone?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  webhook_secret?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
```

#### Response DTO

**File**: `/var/www/lead360.app/api/src/modules/communication/dto/sms-config/tenant-sms-config-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class TenantSmsConfigResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  tenant_id: string;

  @ApiProperty()
  provider_id: string;

  @ApiProperty()
  from_phone: string;

  @ApiProperty()
  is_active: boolean;

  @ApiProperty()
  is_verified: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  // NEVER include credentials in response
}
```

**Repeat for WhatsApp**: Create similar DTOs in `dto/whatsapp-config/` folder.

---

### Task 2.4: Create Controllers

#### SMS Configuration Controller

**File**: `/var/www/lead360.app/api/src/modules/communication/controllers/tenant-sms-config.controller.ts`

```typescript
import { Controller, Get, Post, Patch, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { TenantSmsConfigService } from '../services/tenant-sms-config.service';
import { CreateTenantSmsConfigDto } from '../dto/sms-config/create-tenant-sms-config.dto';
import { UpdateTenantSmsConfigDto } from '../dto/sms-config/update-tenant-sms-config.dto';

@ApiTags('Communication - SMS Configuration')
@Controller('api/v1/communication/twilio/sms-config')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TenantSmsConfigController {
  constructor(private readonly smsConfigService: TenantSmsConfigService) {}

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Create SMS configuration for tenant' })
  @ApiResponse({ status: 201, description: 'Configuration created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  @ApiResponse({ status: 409, description: 'Active configuration already exists' })
  async create(@Request() req, @Body() dto: CreateTenantSmsConfigDto) {
    return this.smsConfigService.create(req.user.tenant_id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get active SMS configuration' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved' })
  @ApiResponse({ status: 404, description: 'No active configuration found' })
  async findActive(@Request() req) {
    return this.smsConfigService.findByTenantId(req.user.tenant_id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update SMS configuration' })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async update(
    @Request() req,
    @Param('id') configId: string,
    @Body() dto: UpdateTenantSmsConfigDto,
  ) {
    return this.smsConfigService.update(req.user.tenant_id, configId, dto);
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Deactivate SMS configuration' })
  @ApiResponse({ status: 200, description: 'Configuration deactivated' })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async delete(@Request() req, @Param('id') configId: string) {
    return this.smsConfigService.delete(req.user.tenant_id, configId);
  }

  @Post(':id/test')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Test SMS configuration by sending test message' })
  @ApiResponse({ status: 200, description: 'Test message sent successfully' })
  @ApiResponse({ status: 400, description: 'Test failed' })
  async testConnection(@Request() req, @Param('id') configId: string) {
    return this.smsConfigService.testConnection(req.user.tenant_id, configId);
  }
}
```

**Repeat for WhatsApp**: Create similar controller in `tenant-whatsapp-config.controller.ts`.

---

### Task 2.5: Update Existing SMS Processor

**File**: `/var/www/lead360.app/api/src/modules/communication/processors/send-sms.processor.ts`

**Find this section** (around line 30):
```typescript
// 2. Load tenant SMS config (TODO: Create tenant_sms_config table in future)
const encryptedCredentials = {}; // TODO: Load from tenant_sms_config
```

**Replace with**:
```typescript
// 2. Load tenant SMS config
const config = await this.prisma.tenant_sms_config.findFirst({
  where: {
    tenant_id: event.tenant_id,
    is_active: true,
  },
});

if (!config) {
  this.logger.error(`No active SMS configuration found for tenant ${event.tenant_id}`);
  await this.prisma.communication_event.update({
    where: { id: communicationEventId },
    data: {
      status: 'failed',
      error_message: 'No active SMS configuration found for tenant',
      failed_at: new Date(),
    },
  });
  return;
}

const encryptedCredentials = config.credentials;
```

---

### Task 2.6: Update Existing WhatsApp Processor

**File**: `/var/www/lead360.app/api/src/modules/communication/processors/send-whatsapp.processor.ts`

**Apply same pattern as Task 2.5**, but use `tenant_whatsapp_config` table.

---

### Task 2.7: Create Webhook URL Helper Endpoint

**Purpose**: Provide tenant-facing endpoint that returns formatted webhook URLs for easy copy-paste into Twilio console.

**Why This Matters**: Tenants using Model A (their own Twilio account) need to configure webhook URLs in their Twilio console. This endpoint provides the exact URLs with step-by-step setup instructions, improving UX and reducing support burden.

**Path Design**: `/api/v1/communication/twilio/webhook-urls`
- Namespaced under `twilio` to avoid conflicts with other providers (Vonage, Bandwidth, etc.)
- Clear separation for future multi-provider support
- Follows pattern: `/api/v1/communication/{provider}/webhook-urls`

**Implementation Option 1 (Recommended): Create Dedicated Controller**

**File**: `/var/www/lead360.app/api/src/modules/communication/controllers/twilio-config.controller.ts`

```typescript
import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { TenantSmsConfigService } from '../services/tenant-sms-config.service';

@ApiTags('Communication - Twilio Configuration')
@Controller('api/v1/communication/twilio')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class TwilioConfigController {
  constructor(private readonly smsConfigService: TenantSmsConfigService) {}

  @Get('webhook-urls')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get Twilio webhook URLs for configuration',
    description: 'Returns formatted webhook URLs specific to tenant subdomain for copy-paste into Twilio console. Includes SMS, Voice, and WhatsApp webhooks with setup instructions.'
  })
  @ApiResponse({ status: 200, description: 'Webhook URLs retrieved', type: WebhookUrlsResponseDto })
  async getWebhookUrls(@Request() req) {
    return this.smsConfigService.getWebhookUrls(req.user.tenant_id);
  }
}
```

**Implementation Option 2 (Alternative): Add to Existing SMS Config Controller**

If you prefer not to create a new controller, add to `TenantSmsConfigController`:

```typescript
// In TenantSmsConfigController, change base path to include nested route:
@Controller('api/v1/communication')
export class TenantSmsConfigController {
  // ... existing endpoints at /api/v1/communication/twilio/sms-config/*

  @Get('twilio/webhook-urls')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get Twilio webhook URLs for configuration' })
  async getWebhookUrls(@Request() req) {
    return this.smsConfigService.getWebhookUrls(req.user.tenant_id);
  }
}
```

**Recommendation**: Use **Option 1** (dedicated `TwilioConfigController`) for:
- Better organization as Twilio features grow
- Clear separation from SMS-specific config
- Easier to add provider-level endpoints later (test connectivity, validate credentials, etc.)

**Add Method to TenantSmsConfigService**:

**File**: `/var/www/lead360.app/api/src/modules/communication/services/tenant-sms-config.service.ts`

```typescript
/**
 * Get webhook URLs for Twilio configuration
 * Returns tenant-specific webhook URLs with setup instructions
 */
async getWebhookUrls(tenantId: string) {
  // Get tenant details for subdomain
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { subdomain: true, name: true },
  });

  if (!tenant) {
    throw new NotFoundException('Tenant not found');
  }

  const baseUrl = `https://${tenant.subdomain}.lead360.app`;

  // Check if tenant has active SMS config (Model A vs Model B detection)
  const smsConfig = await this.prisma.tenantSmsConfig.findFirst({
    where: { tenant_id: tenantId, is_active: true },
  });

  const whatsappConfig = await this.prisma.tenantWhatsAppConfig.findFirst({
    where: { tenant_id: tenantId, is_active: true },
  });

  // Build webhook URLs
  const webhookUrls = {
    tenant_name: tenant.name,
    tenant_subdomain: tenant.subdomain,
    configuration_model: smsConfig ? 'Model A (Your Twilio Account)' : 'Model B (System-Managed)',

    sms_webhooks: {
      inbound_sms: {
        url: `${baseUrl}/api/twilio/sms/inbound`,
        description: 'Receives incoming SMS messages',
        twilio_setting_path: 'Phone Numbers → Active Numbers → {Your Number} → Messaging Configuration → A MESSAGE COMES IN',
        http_method: 'POST',
        required: true,
      },
      status_callback: {
        url: `${baseUrl}/api/twilio/sms/status`,
        description: 'Receives SMS delivery status updates',
        twilio_setting_path: 'Phone Numbers → Active Numbers → {Your Number} → Messaging Configuration → STATUS CALLBACK URL',
        http_method: 'POST',
        required: false,
      },
    },

    voice_webhooks: {
      inbound_call: {
        url: `${baseUrl}/api/twilio/call/inbound`,
        description: 'Receives incoming voice calls',
        twilio_setting_path: 'Phone Numbers → Active Numbers → {Your Number} → Voice Configuration → A CALL COMES IN',
        http_method: 'POST',
        required: true,
      },
      status_callback: {
        url: `${baseUrl}/api/twilio/call/status`,
        description: 'Receives call status updates',
        twilio_setting_path: 'Phone Numbers → Active Numbers → {Your Number} → Voice Configuration → STATUS CALLBACK URL',
        http_method: 'POST',
        required: true,
      },
      recording_status_callback: {
        url: `${baseUrl}/api/twilio/recording/ready`,
        description: 'Notified when call recording is ready',
        twilio_setting_path: 'TwiML Apps or programmable voice → Recording Status Callback',
        http_method: 'POST',
        required: true,
      },
    },

    whatsapp_webhooks: whatsappConfig ? {
      inbound_message: {
        url: `${baseUrl}/api/twilio/whatsapp/inbound`,
        description: 'Receives incoming WhatsApp messages',
        twilio_setting_path: 'Messaging → Settings → WhatsApp Sandbox (or Phone Numbers for approved senders) → WHEN A MESSAGE COMES IN',
        http_method: 'POST',
        required: true,
      },
    } : null,

    setup_instructions: smsConfig ? {
      step_1: 'Log in to your Twilio console at https://www.twilio.com/console',
      step_2: 'Navigate to Phone Numbers → Manage → Active numbers',
      step_3: 'Click on your Lead360 phone number',
      step_4: 'Scroll to "Messaging Configuration" section',
      step_5: 'In "A MESSAGE COMES IN" webhook field, paste the SMS Inbound URL above',
      step_6: 'Set HTTP method to POST',
      step_7: 'Scroll to "Voice Configuration" section',
      step_8: 'In "A CALL COMES IN" webhook field, paste the Voice Inbound URL above',
      step_9: 'In "STATUS CALLBACK URL" field, paste the Voice Status Callback URL above',
      step_10: 'Click "Save" at the bottom of the page',
      step_11: 'Test by sending an SMS or making a call to your Twilio number',
    } : {
      message: 'No action needed. Your webhooks are pre-configured by the system administrator.',
    },

    testing_guide: {
      test_sms: `Send an SMS to your Twilio number. You should see it appear in Lead360 within seconds.`,
      test_call: `Call your Twilio number. It should route through the IVR menu or bypass system as configured.`,
      troubleshooting: `If webhooks don't work: 1) Verify URLs are correct, 2) Check Twilio debugger at https://www.twilio.com/console/debugger, 3) Ensure your firewall allows Twilio's IP ranges`,
    },
  };

  return webhookUrls;
}
```

**Create Response DTO**:

**File**: `/var/www/lead360.app/api/src/modules/communication/dto/sms-config/webhook-urls-response.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';

class WebhookUrlDetail {
  @ApiProperty()
  url: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  twilio_setting_path: string;

  @ApiProperty()
  http_method: string;

  @ApiProperty()
  required: boolean;
}

class SmsWebhooks {
  @ApiProperty({ type: WebhookUrlDetail })
  inbound_sms: WebhookUrlDetail;

  @ApiProperty({ type: WebhookUrlDetail })
  status_callback: WebhookUrlDetail;
}

class VoiceWebhooks {
  @ApiProperty({ type: WebhookUrlDetail })
  inbound_call: WebhookUrlDetail;

  @ApiProperty({ type: WebhookUrlDetail })
  status_callback: WebhookUrlDetail;

  @ApiProperty({ type: WebhookUrlDetail })
  recording_status_callback: WebhookUrlDetail;
}

class WhatsAppWebhooks {
  @ApiProperty({ type: WebhookUrlDetail })
  inbound_message: WebhookUrlDetail;
}

export class WebhookUrlsResponseDto {
  @ApiProperty()
  tenant_name: string;

  @ApiProperty()
  tenant_subdomain: string;

  @ApiProperty()
  configuration_model: string;

  @ApiProperty({ type: SmsWebhooks })
  sms_webhooks: SmsWebhooks;

  @ApiProperty({ type: VoiceWebhooks })
  voice_webhooks: VoiceWebhooks;

  @ApiProperty({ type: WhatsAppWebhooks, nullable: true })
  whatsapp_webhooks: WhatsAppWebhooks | null;

  @ApiProperty({ type: 'object' })
  setup_instructions: Record<string, string>;

  @ApiProperty({ type: 'object' })
  testing_guide: {
    test_sms: string;
    test_call: string;
    troubleshooting: string;
  };
}
```

**Integration Notes**:

1. **Frontend Usage**: Frontend should display webhook URLs in a copy-paste friendly format (e.g., click-to-copy buttons)
2. **Model Detection**: Service automatically detects Model A vs Model B based on presence of tenant SMS config
3. **Security**: Endpoint requires authentication but no special admin role (any tenant user can view their own webhook URLs)
4. **Multi-Tenant**: URLs are always tenant-specific using subdomain routing
5. **Future-Proof**: Includes WhatsApp webhooks only if tenant has WhatsApp config

**Acceptance Criteria for Task 2.7**:
- [ ] GET /api/v1/communication/twilio/webhook-urls endpoint returns formatted URLs
- [ ] Endpoint namespaced under `twilio` to prevent conflicts with other providers
- [ ] URLs use tenant-specific subdomain (e.g., `contractor123.lead360.app`)
- [ ] Response includes all 5 webhook endpoints (SMS, Voice x3, WhatsApp if applicable)
- [ ] Setup instructions differentiate Model A (manual) vs Model B (automatic)
- [ ] Response includes Twilio console navigation paths
- [ ] Frontend can easily parse and display URLs for copy-paste
- [ ] Endpoint requires authentication but allows all roles (Owner, Admin, Manager)
- [ ] Response DTO fully documented in Swagger
- [ ] TwilioConfigController registered in communication module

---

### Task 2.8: Register Services and Controllers

**File**: `/var/www/lead360.app/api/src/modules/communication/communication.module.ts`

**Add to `providers` array**:
```typescript
providers: [
  // ... existing providers
  TenantSmsConfigService,
  TenantWhatsAppConfigService,
],
```

**Add to `controllers` array**:
```typescript
controllers: [
  // ... existing controllers
  TenantSmsConfigController,
  TenantWhatsAppConfigController,
  TwilioConfigController, // NEW - handles /api/v1/communication/twilio/* endpoints
],
```

**Import statements to add**:
```typescript
import { TenantSmsConfigService } from './services/tenant-sms-config.service';
import { TenantWhatsAppConfigService } from './services/tenant-whatsapp-config.service';
import { TenantSmsConfigController } from './controllers/tenant-sms-config.controller';
import { TenantWhatsAppConfigController } from './controllers/tenant-whatsapp-config.controller';
import { TwilioConfigController } from './controllers/twilio-config.controller';
```

---

### Task 2.9: Provider Registration (Seed Data)

**Ensure Twilio providers exist** in `communication_provider` table.

**Option 1: Check if seed file exists**:
- Look in `/api/prisma/seeds/` for provider seeds
- If exists, verify `twilio_sms` and `twilio_whatsapp` providers are seeded

**Option 2: Create migration to insert providers**:

```sql
-- Insert Twilio SMS provider if not exists
INSERT INTO communication_provider (id, provider_key, provider_name, provider_type, credentials_schema, supports_webhooks, webhook_verification_method, is_active, is_system, created_at, updated_at)
VALUES (
  UUID(),
  'twilio_sms',
  'Twilio SMS',
  'sms',
  '{"type":"object","required":["account_sid","auth_token","from_phone"],"properties":{"account_sid":{"type":"string","pattern":"^AC[a-z0-9]{32}$"},"auth_token":{"type":"string"},"from_phone":{"type":"string"}}}',
  true,
  'signature',
  true,
  true,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE provider_name = 'Twilio SMS';

-- Insert Twilio WhatsApp provider if not exists
INSERT INTO communication_provider (id, provider_key, provider_name, provider_type, credentials_schema, supports_webhooks, webhook_verification_method, is_active, is_system, created_at, updated_at)
VALUES (
  UUID(),
  'twilio_whatsapp',
  'Twilio WhatsApp',
  'whatsapp',
  '{"type":"object","required":["account_sid","auth_token","from_phone"],"properties":{"account_sid":{"type":"string","pattern":"^AC[a-z0-9]{32}$"},"auth_token":{"type":"string"},"from_phone":{"type":"string"}}}',
  true,
  'signature',
  true,
  true,
  NOW(),
  NOW()
)
ON DUPLICATE KEY UPDATE provider_name = 'Twilio WhatsApp';
```

---

## Acceptance Criteria

- [ ] TenantSmsConfigService fully implemented with all CRUD methods
- [ ] TenantWhatsAppConfigService fully implemented with all CRUD methods
- [ ] All credentials encrypted before storage using EncryptionService
- [ ] Credentials NEVER returned in API responses
- [ ] Twilio credentials validated before storage (test API call)
- [ ] All DTOs created with proper validation decorators
- [ ] Controllers implement all endpoints with proper RBAC guards
- [ ] Test connection endpoints send actual test SMS/WhatsApp
- [ ] **Webhook URL helper endpoint at /api/v1/communication/twilio/webhook-urls returns formatted URLs**
- [ ] **Webhook URLs namespaced under `twilio` to prevent provider conflicts**
- [ ] **Webhook URLs use tenant-specific subdomain and include step-by-step setup instructions**
- [ ] **Model A vs Model B detection working correctly in webhook URL response**
- [ ] **TwilioConfigController registered and functional**
- [ ] Existing SMS processor loads config from database (TODO resolved)
- [ ] Existing WhatsApp processor loads config from database (TODO resolved)
- [ ] Services and controllers registered in module
- [ ] Twilio SMS/WhatsApp providers exist in database
- [ ] Unit tests for services (>80% coverage)
- [ ] Integration tests for controllers
- [ ] No breaking changes to existing functionality

---

## Verification Steps

### 1. API Testing with curl

```bash
# 1. Create SMS configuration
curl -X POST "http://localhost:3000/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer {tenant_admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "provider_id": "{twilio_sms_provider_id}",
    "account_sid": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    "auth_token": "your_auth_token",
    "from_phone": "+19781234567"
  }'

# Expected: 201 Created with configuration object

# 2. Get active configuration
curl -X GET "http://localhost:3000/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer {tenant_admin_token}"

# Expected: 200 OK, credentials field should be undefined

# 3. Get Twilio webhook URLs for console setup
curl -X GET "http://localhost:3000/api/v1/communication/twilio/webhook-urls" \
  -H "Authorization: Bearer {tenant_admin_token}"

# Expected: 200 OK with formatted webhook URLs
# Response should include:
# - tenant-specific subdomain URLs (e.g., https://contractor123.lead360.app/api/twilio/*)
# - setup instructions for Model A (or "no action needed" for Model B)
# - all 5 webhook endpoints (SMS x2, Voice x3, WhatsApp if configured)
# - Twilio console paths for each webhook
# - Testing guide

# 4. Test connection
curl -X POST "http://localhost:3000/api/v1/communication/twilio/sms-config/{config_id}/test" \
  -H "Authorization: Bearer {tenant_admin_token}"

# Expected: 200 OK, test SMS sent
```

### 2. Database Verification

```sql
-- Check configuration stored with encrypted credentials
SELECT id, tenant_id, from_phone, is_active, LENGTH(credentials) as cred_length
FROM tenant_sms_config;

-- Credentials should be long encrypted string, not plain text
```

### 3. Processor Testing

```bash
# Queue an SMS job manually
# Verify processor loads config from database
# Check logs for "No active SMS configuration found" error if config missing
```

---

## Files Created

**Services**:
- `/api/src/modules/communication/services/tenant-sms-config.service.ts`
- `/api/src/modules/communication/services/tenant-whatsapp-config.service.ts`

**Controllers**:
- `/api/src/modules/communication/controllers/tenant-sms-config.controller.ts`
- `/api/src/modules/communication/controllers/tenant-whatsapp-config.controller.ts`
- `/api/src/modules/communication/controllers/twilio-config.controller.ts` **← NEW (Task 2.7)**

**DTOs**:
- `/api/src/modules/communication/dto/sms-config/create-tenant-sms-config.dto.ts`
- `/api/src/modules/communication/dto/sms-config/update-tenant-sms-config.dto.ts`
- `/api/src/modules/communication/dto/sms-config/tenant-sms-config-response.dto.ts`
- `/api/src/modules/communication/dto/sms-config/webhook-urls-response.dto.ts` **← NEW (Task 2.7)**
- Similar files for `whatsapp-config/`

---

## Files Modified

- `/api/src/modules/communication/processors/send-sms.processor.ts` (resolved TODO)
- `/api/src/modules/communication/processors/send-whatsapp.processor.ts` (resolved TODO)
- `/api/src/modules/communication/communication.module.ts` (registered services/controllers)

---

## Next Steps

After Sprint 2 completion:
- ✅ SMS/WhatsApp configuration management complete
- ✅ Existing processors wired to database
- ➡️ Proceed to **Sprint 3: Call Management & Recording**

---

**Sprint 2 Complete**: Tenant can configure SMS/WhatsApp and send messages
