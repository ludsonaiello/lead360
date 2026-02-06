# Sprint 4: IVR & Office Bypass Systems

**Duration**: Week 5
**Goal**: Implement IVR menu system and office number bypass functionality
**Sprint Type**: Call Routing & IVR Logic
**Estimated Effort**: 4-5 days
**Dependencies**: Sprint 3 (Call Management)

---

## Overview

This sprint implements the Interactive Voice Response (IVR) menu system that routes incoming calls based on user input, and the office number bypass feature that allows whitelisted numbers to make outbound calls through the system.

> **⚠️ IMPORTANT: Endpoint Namespace Updated**
>
> As of Sprint 7 (Namespace Refactoring), all endpoints in this sprint now use the `/twilio/` namespace:
> - OLD: `/api/v1/communication/twilio/ivr`
> - NEW: `/api/v1/communication/twilio/ivr`
> - OLD: `/api/v1/communication/twilio/office-whitelist`
> - NEW: `/api/v1/communication/twilio/office-whitelist`
>
> All code examples, curl commands, and verification steps below have been updated to reflect the new paths.
> See `sprint_7_namespace_refactoring.md` for full details on the namespace strategy.

---

## Prerequisites

- [ ] Sprint 3 completed (Call Management working)
- [ ] Understanding of TwiML <Gather> and <Dial> verbs
- [ ] Understanding of DTMF input handling

---

## Task Breakdown

### Task 4.1: Create IvrConfigurationService

**File**: `/var/www/lead360.app/api/src/modules/communication/services/ivr-configuration.service.ts`

```typescript
import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import twilio from 'twilio';
import { CreateIvrConfigDto } from '../dto/ivr/create-ivr-config.dto';
import { UpdateIvrConfigDto } from '../dto/ivr/update-ivr-config.dto';

@Injectable()
export class IvrConfigurationService {
  private readonly logger = new Logger(IvrConfigurationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or update IVR configuration for tenant
   */
  async createOrUpdate(tenantId: string, dto: CreateIvrConfigDto) {
    // Validate menu options
    this.validateMenuOptions(dto.menu_options);

    // Check if config exists
    const existing = await this.prisma.ivrConfiguration.findUnique({
      where: { tenant_id: tenantId },
    });

    if (existing) {
      // Update existing
      return this.prisma.ivrConfiguration.update({
        where: { tenant_id: tenantId },
        data: {
          ivr_enabled: dto.ivr_enabled,
          greeting_message: dto.greeting_message,
          menu_options: dto.menu_options,
          default_action: dto.default_action,
          timeout_seconds: dto.timeout_seconds || 10,
          max_retries: dto.max_retries || 3,
        },
      });
    }

    // Create new
    return this.prisma.ivrConfiguration.create({
      data: {
        tenant_id: tenantId,
        ivr_enabled: dto.ivr_enabled,
        greeting_message: dto.greeting_message,
        menu_options: dto.menu_options,
        default_action: dto.default_action,
        timeout_seconds: dto.timeout_seconds || 10,
        max_retries: dto.max_retries || 3,
        status: 'active',
      },
    });
  }

  /**
   * Get IVR configuration for tenant
   */
  async findByTenantId(tenantId: string) {
    const config = await this.prisma.ivrConfiguration.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!config) {
      throw new NotFoundException('IVR configuration not found');
    }

    return config;
  }

  /**
   * Delete (disable) IVR configuration
   */
  async delete(tenantId: string) {
    const config = await this.prisma.ivrConfiguration.findUnique({
      where: { tenant_id: tenantId },
    });

    if (!config) {
      throw new NotFoundException('IVR configuration not found');
    }

    return this.prisma.ivrConfiguration.update({
      where: { tenant_id: tenantId },
      data: {
        ivr_enabled: false,
        status: 'inactive',
      },
    });
  }

  /**
   * Generate IVR menu TwiML
   */
  async generateIvrMenuTwiML(tenantId: string): Promise<string> {
    const config = await this.findByTenantId(tenantId);

    if (!config.ivr_enabled) {
      throw new BadRequestException('IVR is not enabled for this tenant');
    }

    const twiml = new twilio.twiml.VoiceResponse();

    // Consent message
    twiml.say('This call will be recorded for training purposes.');

    // Greeting
    twiml.say(config.greeting_message);

    // Menu options
    const menuOptions = config.menu_options as any[];
    const menuText = menuOptions
      .map(opt => `Press ${opt.digit} for ${opt.label}.`)
      .join(' ');

    // Gather digit input
    const gather = twiml.gather({
      numDigits: 1,
      timeout: config.timeout_seconds,
      action: `https://api.lead360.app/api/twilio/ivr/input`,
      method: 'POST',
    });

    gather.say(menuText);

    // If no input, redirect to default action
    this.executeActionTwiML(twiml, config.default_action as any);

    return twiml.toString();
  }

  /**
   * Execute IVR action based on digit pressed
   */
  async executeIvrAction(tenantId: string, digit: string): Promise<string> {
    const config = await this.findByTenantId(tenantId);

    const menuOptions = config.menu_options as any[];
    const selectedOption = menuOptions.find(opt => opt.digit === digit);

    const twiml = new twilio.twiml.VoiceResponse();

    if (!selectedOption) {
      // Invalid input, replay menu
      twiml.say('Invalid option. Please try again.');
      twiml.redirect(`https://api.lead360.app/api/twilio/ivr/menu`);
      return twiml.toString();
    }

    // Execute action
    this.executeActionTwiML(twiml, selectedOption);

    return twiml.toString();
  }

  /**
   * Execute action and append to TwiML
   */
  private executeActionTwiML(twiml: any, action: any) {
    switch (action.action) {
      case 'route_to_number':
        twiml.dial({
          callerId: action.config.phone_number,
        }, action.config.phone_number);
        break;

      case 'route_to_default':
        twiml.say('Please hold while we transfer your call.');
        // Could implement queue logic here
        twiml.dial({}, action.config.phone_number);
        break;

      case 'trigger_webhook':
        // Make HTTP request to webhook (not directly in TwiML)
        // Log action for async processing
        twiml.say('Thank you. Your request has been received.');
        twiml.hangup();
        break;

      case 'voicemail':
        twiml.say('Please leave a message after the beep.');
        twiml.record({
          maxLength: action.config.max_duration_seconds || 180,
          action: `https://api.lead360.app/api/twilio/voicemail/ready`,
        });
        break;

      default:
        twiml.say('Sorry, that option is not available.');
        twiml.hangup();
    }
  }

  /**
   * Validate menu options
   */
  private validateMenuOptions(menuOptions: any[]) {
    if (!Array.isArray(menuOptions)) {
      throw new BadRequestException('menu_options must be an array');
    }

    if (menuOptions.length === 0 || menuOptions.length > 10) {
      throw new BadRequestException('menu_options must have 1-10 entries');
    }

    const digits = menuOptions.map(opt => opt.digit);
    const uniqueDigits = new Set(digits);

    if (digits.length !== uniqueDigits.size) {
      throw new BadRequestException('Each digit must be unique');
    }

    // Validate each option
    for (const option of menuOptions) {
      if (!option.digit || !option.action || !option.label || !option.config) {
        throw new BadRequestException('Each menu option must have digit, action, label, and config');
      }

      if (!['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].includes(option.digit)) {
        throw new BadRequestException('Digit must be 0-9');
      }

      if (!['route_to_number', 'route_to_default', 'trigger_webhook', 'voicemail'].includes(option.action)) {
        throw new BadRequestException('Invalid action type');
      }

      // Validate phone numbers
      if (option.action === 'route_to_number' && !option.config.phone_number) {
        throw new BadRequestException('route_to_number action requires phone_number in config');
      }

      if (option.config.phone_number && !option.config.phone_number.startsWith('+')) {
        throw new BadRequestException('Phone numbers must be in E.164 format');
      }

      // Validate webhook URLs
      if (option.action === 'trigger_webhook' && !option.config.webhook_url) {
        throw new BadRequestException('trigger_webhook action requires webhook_url in config');
      }

      if (option.config.webhook_url && !option.config.webhook_url.startsWith('https://')) {
        throw new BadRequestException('Webhook URLs must use HTTPS');
      }
    }
  }
}
```

---

### Task 4.2: Create OfficeBypassService

**File**: `/var/www/lead360.app/api/src/modules/communication/services/office-bypass.service.ts`

```typescript
import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import twilio from 'twilio';
import { AddWhitelistDto } from '../dto/office-bypass/add-whitelist.dto';

@Injectable()
export class OfficeBypassService {
  private readonly logger = new Logger(OfficeBypassService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Check if phone number is whitelisted for tenant
   */
  async isWhitelisted(tenantId: string, phoneNumber: string): Promise<boolean> {
    const whitelist = await this.prisma.officeNumberWhitelist.findFirst({
      where: {
        tenant_id: tenantId,
        phone_number: phoneNumber,
        status: 'active',
      },
    });

    return !!whitelist;
  }

  /**
   * Add phone number to whitelist
   */
  async addToWhitelist(tenantId: string, dto: AddWhitelistDto) {
    // Check if already exists
    const existing = await this.prisma.officeNumberWhitelist.findFirst({
      where: {
        tenant_id: tenantId,
        phone_number: dto.phone_number,
      },
    });

    if (existing) {
      throw new ConflictException('This phone number is already whitelisted');
    }

    return this.prisma.officeNumberWhitelist.create({
      data: {
        tenant_id: tenantId,
        phone_number: dto.phone_number,
        label: dto.label,
        status: 'active',
      },
    });
  }

  /**
   * List all whitelisted numbers for tenant
   */
  async findAll(tenantId: string) {
    return this.prisma.officeNumberWhitelist.findMany({
      where: { tenant_id: tenantId },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * Remove phone number from whitelist
   */
  async removeFromWhitelist(tenantId: string, whitelistId: string) {
    const whitelist = await this.prisma.officeNumberWhitelist.findFirst({
      where: {
        id: whitelistId,
        tenant_id: tenantId,
      },
    });

    if (!whitelist) {
      throw new NotFoundException('Whitelist entry not found');
    }

    return this.prisma.officeNumberWhitelist.update({
      where: { id: whitelistId },
      data: { status: 'inactive' },
    });
  }

  /**
   * Handle bypass call - prompt for target number
   */
  async handleBypassCall(tenantId: string, callerNumber: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    const twiml = new twilio.twiml.VoiceResponse();

    twiml.say(`You've reached ${tenant?.name || 'Lead360'}. Please enter the phone number you'd like to call, including area code.`);

    twiml.gather({
      numDigits: 10,
      action: `https://api.lead360.app/api/twilio/call/bypass-dial`,
      method: 'POST',
      timeout: 10,
    });

    twiml.say('We did not receive any input. Goodbye.');
    twiml.hangup();

    return twiml.toString();
  }

  /**
   * Initiate bypass outbound call to target
   */
  async initiateBypassOutboundCall(
    tenantId: string,
    callerCallSid: string,
    targetNumber: string,
  ): Promise<string> {
    // Validate and format target number
    let formattedNumber = targetNumber;
    if (targetNumber.length === 10) {
      // Assume US number, prepend +1
      formattedNumber = `+1${targetNumber}`;
    }

    if (!formattedNumber.startsWith('+')) {
      const twiml = new twilio.twiml.VoiceResponse();
      twiml.say('Invalid phone number format. Please try again.');
      twiml.redirect(`https://api.lead360.app/api/twilio/call/bypass-prompt`);
      return twiml.toString();
    }

    // Generate TwiML to dial target
    const twiml = new twilio.twiml.VoiceResponse();

    twiml.say('Please hold while we connect your call.');

    // Consent message
    twiml.say('This call will be recorded for training purposes.');

    // Dial target number
    twiml.dial({
      record: 'record-from-ringing',
      recordingStatusCallback: `https://api.lead360.app/api/twilio/recording/ready`,
    }, formattedNumber);

    twiml.say('The call could not be completed. Please try again.');

    return twiml.toString();
  }
}
```

---

### Task 4.3: Create DTOs

#### IVR Configuration DTOs

**File**: `/var/www/lead360.app/api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts`

```typescript
import { IsBoolean, IsString, IsArray, IsInt, Min, Max, IsObject } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class IvrMenuOptionDto {
  @ApiProperty({ example: '1' })
  @IsString()
  digit: string;

  @ApiProperty({ example: 'route_to_number' })
  @IsString()
  action: string;

  @ApiProperty({ example: 'Request a quote' })
  @IsString()
  label: string;

  @ApiProperty({
    example: { phone_number: '+19781234567' },
  })
  @IsObject()
  config: any;
}

export class CreateIvrConfigDto {
  @ApiProperty()
  @IsBoolean()
  ivr_enabled: boolean;

  @ApiProperty({
    description: 'IVR greeting message',
    example: 'Thank you for calling ABC Company.',
  })
  @IsString()
  greeting_message: string;

  @ApiProperty({
    description: 'Array of menu options (max 10)',
    type: [IvrMenuOptionDto],
  })
  @IsArray()
  menu_options: IvrMenuOptionDto[];

  @ApiProperty({
    description: 'Default action if no input',
    example: { action: 'voicemail', config: { max_duration_seconds: 180 } },
  })
  @IsObject()
  default_action: any;

  @ApiProperty({ default: 10 })
  @IsInt()
  @Min(5)
  @Max(60)
  timeout_seconds: number;

  @ApiProperty({ default: 3 })
  @IsInt()
  @Min(1)
  @Max(5)
  max_retries: number;
}
```

#### Office Bypass DTOs

**File**: `/var/www/lead360.app/api/src/modules/communication/dto/office-bypass/add-whitelist.dto.ts`

```typescript
import { IsString, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddWhitelistDto {
  @ApiProperty({
    description: 'Phone number in E.164 format',
    example: '+19781234567',
  })
  @IsString()
  @Matches(/^\+[1-9]\d{1,14}$/, { message: 'Phone number must be in E.164 format' })
  phone_number: string;

  @ApiProperty({
    description: 'Label for this number',
    example: 'John\'s Mobile',
  })
  @IsString()
  label: string;
}
```

---

### Task 4.4: Create Controllers

#### IVR Configuration Controller

**File**: `/var/www/lead360.app/api/src/modules/communication/controllers/ivr-configuration.controller.ts`

```typescript
import { Controller, Get, Post, Delete, Body, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { IvrConfigurationService } from '../services/ivr-configuration.service';
import { CreateIvrConfigDto } from '../dto/ivr/create-ivr-config.dto';

@ApiTags('Communication - IVR Configuration')
@Controller('api/v1/communication/twilio/ivr')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class IvrConfigurationController {
  constructor(private readonly ivrService: IvrConfigurationService) {}

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Create or update IVR configuration' })
  @ApiResponse({ status: 201, description: 'IVR configuration saved' })
  async createOrUpdate(@Request() req, @Body() dto: CreateIvrConfigDto) {
    return this.ivrService.createOrUpdate(req.user.tenant_id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get IVR configuration' })
  @ApiResponse({ status: 200, description: 'IVR configuration retrieved' })
  async findOne(@Request() req) {
    return this.ivrService.findByTenantId(req.user.tenant_id);
  }

  @Delete()
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Disable IVR configuration' })
  @ApiResponse({ status: 200, description: 'IVR disabled' })
  async delete(@Request() req) {
    return this.ivrService.delete(req.user.tenant_id);
  }
}
```

#### Office Bypass Controller

**File**: `/var/www/lead360.app/api/src/modules/communication/controllers/office-bypass.controller.ts`

```typescript
import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '@core/auth/guards/roles.guard';
import { Roles } from '@core/auth/decorators/roles.decorator';
import { OfficeBypassService } from '../services/office-bypass.service';
import { AddWhitelistDto } from '../dto/office-bypass/add-whitelist.dto';

@ApiTags('Communication - Office Bypass')
@Controller('api/v1/communication/twilio/office-whitelist')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OfficeBypassController {
  constructor(private readonly bypassService: OfficeBypassService) {}

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Add phone number to office whitelist' })
  @ApiResponse({ status: 201, description: 'Number added to whitelist' })
  @ApiResponse({ status: 409, description: 'Number already whitelisted' })
  async addToWhitelist(@Request() req, @Body() dto: AddWhitelistDto) {
    return this.bypassService.addToWhitelist(req.user.tenant_id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List all whitelisted office numbers' })
  @ApiResponse({ status: 200, description: 'Whitelist retrieved' })
  async findAll(@Request() req) {
    return this.bypassService.findAll(req.user.tenant_id);
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Remove phone number from whitelist' })
  @ApiResponse({ status: 200, description: 'Number removed from whitelist' })
  async remove(@Request() req, @Param('id') whitelistId: string) {
    return this.bypassService.removeFromWhitelist(req.user.tenant_id, whitelistId);
  }
}
```

---

### Task 4.5: Update CallManagementService

**File**: `/var/www/lead360.app/api/src/modules/communication/services/call-management.service.ts`

**Update `handleInboundCall` method** to integrate IVR and office bypass:

```typescript
async handleInboundCall(tenantId: string, twilioPayload: any) {
  const { CallSid, From, To } = twilioPayload;

  // ... create CallRecord ...

  // Check whitelist first
  if (await this.officeBypassService.isWhitelisted(tenantId, From)) {
    this.logger.log(`Office bypass detected for ${From}`);
    await this.prisma.callRecord.update({
      where: { id: callRecord.id },
      data: { call_type: 'office_bypass_call' },
    });
    return this.officeBypassService.handleBypassCall(tenantId, From);
  }

  // Check IVR enabled
  try {
    const ivrConfig = await this.ivrConfigurationService.findByTenantId(tenantId);
    if (ivrConfig.ivr_enabled) {
      this.logger.log(`IVR enabled, generating menu TwiML`);
      await this.prisma.callRecord.update({
        where: { id: callRecord.id },
        data: { call_type: 'ivr_routed_call' },
      });
      return this.ivrConfigurationService.generateIvrMenuTwiML(tenantId);
    }
  } catch (error) {
    this.logger.warn(`IVR not configured for tenant ${tenantId}`);
  }

  // Default routing (no IVR, no bypass)
  return this.generateDefaultRoutingTwiML();
}
```

---

### Task 4.6: Register Services and Controllers

**File**: `/var/www/lead360.app/api/src/modules/communication/communication.module.ts`

**Add**:
```typescript
providers: [
  // ... existing
  IvrConfigurationService,
  OfficeBypassService,
],
controllers: [
  // ... existing
  IvrConfigurationController,
  OfficeBypassController,
],
```

---

## Acceptance Criteria

- [ ] IVR configuration CRUD endpoints working
- [ ] IVR menu TwiML generated correctly with consent message
- [ ] Menu options validated (max 10, unique digits, valid actions)
- [ ] IVR actions execute correctly (route to number, voicemail, webhook, default)
- [ ] Office whitelist CRUD endpoints working
- [ ] Whitelisted numbers bypass IVR and prompt for target
- [ ] Bypass calls validate and format target numbers (E.164)
- [ ] Bypass calls create CallRecords with correct call_type
- [ ] IVR action taken stored in CallRecord.ivr_action_taken
- [ ] Unit tests for services (>80% coverage)
- [ ] Integration tests for IVR flow
- [ ] RBAC enforced (only Owner/Admin can configure)

---

## Verification Steps

### 1. Create IVR Configuration
```bash
curl -X POST "http://localhost:3000/api/v1/communication/twilio/ivr" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "ivr_enabled": true,
    "greeting_message": "Thank you for calling ABC Company.",
    "menu_options": [
      {
        "digit": "1",
        "action": "route_to_number",
        "label": "Sales",
        "config": { "phone_number": "+19781234567" }
      },
      {
        "digit": "2",
        "action": "voicemail",
        "label": "Leave a message",
        "config": { "max_duration_seconds": 180 }
      }
    ],
    "default_action": {
      "action": "voicemail",
      "config": { "max_duration_seconds": 180 }
    },
    "timeout_seconds": 10,
    "max_retries": 3
  }'
```

### 2. Add Office Whitelist Number
```bash
curl -X POST "http://localhost:3000/api/v1/communication/twilio/office-whitelist" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "phone_number": "+19781234567",
    "label": "Office Main Line"
  }'
```

### 3. Test Inbound Call with IVR
- Call tenant's Twilio number
- Verify IVR greeting plays
- Press digit
- Verify action executes

---

## Files Created

- `/api/src/modules/communication/services/ivr-configuration.service.ts`
- `/api/src/modules/communication/services/office-bypass.service.ts`
- `/api/src/modules/communication/controllers/ivr-configuration.controller.ts`
- `/api/src/modules/communication/controllers/office-bypass.controller.ts`
- `/api/src/modules/communication/dto/ivr/create-ivr-config.dto.ts`
- `/api/src/modules/communication/dto/office-bypass/add-whitelist.dto.ts`

---

## Files Modified

- `/api/src/modules/communication/services/call-management.service.ts` (integrated IVR/bypass)
- `/api/src/modules/communication/communication.module.ts`

---

## Next Steps

After Sprint 4 completion:
- ✅ IVR system functional
- ✅ Office bypass working
- ➡️ Proceed to **Sprint 5: Transcription & Webhooks**

---

**Sprint 4 Complete**: Calls intelligently routed via IVR or bypass
