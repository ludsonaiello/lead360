# Backend Module Instructions: Leads/Customer Management

**Module**: Leads/Customer  
**Sprint**: 1  
**Estimated Effort**: 2 weeks  
**Priority**: High  
**Version**: 1.0

---

## Module Overview

You are implementing the Leads/Customer management module, which is the core CRM functionality of Lead360. This module handles lead capture from multiple sources, contact information management, Google Maps integration, service request tracking, and activity logging.

**Critical Requirements:**
- Multi-tenant data isolation (tenant_id on all queries)
- Phone uniqueness PER TENANT (not globally)
- **Google Maps API address validation (MANDATORY)**
- Comprehensive activity logging
- Webhook authentication with API keys

**🚨 CRITICAL: Address Validation Behavior**

**Backend MUST ALWAYS validate addresses and fetch lat/lng:**

1. **Frontend (Manual Entry)**:
   - Frontend uses Google Maps autocomplete
   - Sends: `{ address, city, state, zip, lat, lng }`
   - Backend: Validates components, uses provided lat/lng
   - Result: Fast save, no extra API call

2. **Webhook (External Forms)**:
   - Webhook sends: `{ address_line1, zip_code }` (minimal data)
   - Backend: Calls Google Maps to fetch city, state, lat, lng
   - Result: Complete address with coordinates

3. **AI Agent (Future)**:
   - AI sends: `{ address_line1, city, state }` (partial data)
   - Backend: Calls Google Maps to fetch lat, lng
   - Result: Geocoded address

**Why Lat/Lng Are REQUIRED:**
- Routing optimization for service calls
- Service area validation
- Distance calculations
- Territory assignment
- Map display

**Validation Rules:**
- ✅ If lat/lng provided → Use them (frontend optimization)
- ✅ If lat/lng missing → Geocode address via Google Maps
- ✅ If city/state missing → Fetch from Google Maps
- ❌ Cannot save address without lat/lng (throws 422 error)
- ❌ Invalid address → Returns error (no silent failures)

---

## Prerequisites

Before starting, ensure you have read:

1. ✅ Feature Contract: `/documentation/contracts/leads-contract.md`
2. ✅ Multi-Tenant Rules: `/documentation/shared/multi-tenant-rules.md`
3. ✅ API Conventions: `/documentation/shared/api-conventions.md`
4. ✅ Security Rules: `/documentation/shared/security-rules.md`
5. ✅ Naming Conventions: `/documentation/shared/naming-conventions.md`
6. ✅ Testing Requirements: `/documentation/shared/testing-requirements.md`

---

## Database Schema Implementation

### Step 1: Create Prisma Schema

**File**: `api/prisma/schema.prisma`

Add the following models:

```prisma
// ============================================================================
// Lead Management Models
// ============================================================================

model lead {
  id                   String              @id @default(uuid()) @db.VarChar(36)
  tenant_id            String              @db.VarChar(36)
  first_name           String              @db.VarChar(100)
  last_name            String              @db.VarChar(100)
  language_spoken      String              @default("EN") @db.VarChar(10)
  accept_sms           Boolean             @default(false)
  preferred_communication String           @default("email") @db.VarChar(20) // email, phone, sms
  status               String              @default("lead") @db.VarChar(20) // lead, prospect, customer, lost
  source               String              @db.VarChar(20) // manual, webhook, ai_phone, ai_sms
  external_source_id   String?             @db.VarChar(255)
  created_at           DateTime            @default(now())
  updated_at           DateTime            @updatedAt
  created_by_user_id   String?             @db.VarChar(36)
  lost_reason          String?             @db.Text
  lost_at              DateTime?
  
  // Relations
  tenant               tenant              @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  created_by_user      user?               @relation(fields: [created_by_user_id], references: [id], onDelete: SetNull)
  emails               lead_email[]
  phones               lead_phone[]
  addresses            lead_address[]
  service_requests     service_request[]
  notes                lead_note[]
  activities           lead_activity[]

  @@index([tenant_id, status])
  @@index([tenant_id, created_at(sort: Desc)])
  @@index([tenant_id, external_source_id])
  @@index([tenant_id, updated_at(sort: Desc)])
  @@map("lead")
}

model lead_email {
  id         String   @id @default(uuid()) @db.VarChar(36)
  lead_id    String   @db.VarChar(36)
  email      String   @db.VarChar(255)
  is_primary Boolean  @default(false)
  created_at DateTime @default(now())
  
  lead       lead     @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  
  @@index([lead_id])
  @@index([lead_id, is_primary])
  @@map("lead_email")
}

model lead_phone {
  id         String   @id @default(uuid()) @db.VarChar(36)
  lead_id    String   @db.VarChar(36)
  phone      String   @db.VarChar(20) // Digits only, no formatting
  phone_type String   @default("mobile") @db.VarChar(20) // mobile, home, work
  is_primary Boolean  @default(false)
  created_at DateTime @default(now())
  
  lead       lead     @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  
  @@index([lead_id])
  @@index([lead_id, is_primary])
  @@map("lead_phone")
}

// CRITICAL: Add database-level unique constraint on phone per tenant
// This requires a virtual column or trigger to enforce
// For MySQL 8.0+, use a generated column
// ALTER TABLE lead_phone ADD COLUMN tenant_id_virtual VARCHAR(36) 
//   GENERATED ALWAYS AS (
//     (SELECT tenant_id FROM lead WHERE lead.id = lead_phone.lead_id)
//   ) STORED;
// ALTER TABLE lead_phone ADD UNIQUE KEY unique_phone_per_tenant (tenant_id_virtual, phone);

model lead_address {
  id              String            @id @default(uuid()) @db.VarChar(36)
  lead_id         String            @db.VarChar(36)
  address_line1   String            @db.VarChar(255)
  address_line2   String?           @db.VarChar(255)
  city            String            @db.VarChar(100)
  state           String            @db.VarChar(2) // US state code
  zip_code        String            @db.VarChar(10)
  country         String            @default("US") @db.VarChar(2)
  latitude        Decimal?          @db.Decimal(10, 8)
  longitude       Decimal?          @db.Decimal(11, 8)
  google_place_id String?           @db.VarChar(255)
  is_primary      Boolean           @default(false)
  address_type    String            @default("service") @db.VarChar(20) // service, billing, mailing
  created_at      DateTime          @default(now())
  
  lead            lead              @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  service_requests service_request[]
  
  @@index([lead_id])
  @@index([lead_id, is_primary])
  @@index([lead_id, address_type])
  @@map("lead_address")
}

model service_request {
  id              String        @id @default(uuid()) @db.VarChar(36)
  tenant_id       String        @db.VarChar(36)
  lead_id         String        @db.VarChar(36)
  lead_address_id String?       @db.VarChar(36)
  service_name    String        @db.VarChar(100)
  service_type    String?       @db.VarChar(100)
  time_demand     String        @default("flexible") @db.VarChar(20) // now, week, month, flexible
  description     String?       @db.Text
  extra_data      Json?
  status          String        @default("new") @db.VarChar(20) // new, quoted, approved, declined, completed
  created_at      DateTime      @default(now())
  updated_at      DateTime      @updatedAt
  
  tenant          tenant        @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  lead            lead          @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  lead_address    lead_address? @relation(fields: [lead_address_id], references: [id], onDelete: SetNull)
  
  @@index([tenant_id, lead_id])
  @@index([tenant_id, status])
  @@index([tenant_id, created_at(sort: Desc)])
  @@map("service_request")
}

model lead_note {
  id         String   @id @default(uuid()) @db.VarChar(36)
  lead_id    String   @db.VarChar(36)
  user_id    String   @db.VarChar(36)
  note_text  String   @db.Text
  is_pinned  Boolean  @default(false)
  created_at DateTime @default(now())
  updated_at DateTime @updatedAt
  
  lead       lead     @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  user       user     @relation(fields: [user_id], references: [id], onDelete: SetNull)
  
  @@index([lead_id, created_at(sort: Desc)])
  @@index([lead_id, is_pinned(sort: Desc), created_at(sort: Desc)])
  @@map("lead_note")
}

model lead_activity {
  id            String   @id @default(uuid()) @db.VarChar(36)
  lead_id       String   @db.VarChar(36)
  user_id       String?  @db.VarChar(36)
  activity_type String   @db.VarChar(50) // status_change, email_sent, call_made, sms_sent, note_added, created, updated
  description   String   @db.VarChar(500)
  metadata      Json?
  created_at    DateTime @default(now())
  
  lead          lead     @relation(fields: [lead_id], references: [id], onDelete: Cascade)
  user          user?    @relation(fields: [user_id], references: [id], onDelete: SetNull)
  
  @@index([lead_id, created_at(sort: Desc)])
  @@map("lead_activity")
}

model webhook_api_key {
  id                  String    @id @default(uuid()) @db.VarChar(36)
  tenant_id           String    @db.VarChar(36)
  key_name            String    @db.VarChar(100)
  api_key             String    @unique @db.VarChar(64) // bcrypt hashed
  api_secret          String    @db.VarChar(128) // bcrypt hashed
  is_active           Boolean   @default(true)
  allowed_sources     Json?
  rate_limit          Int       @default(100) // requests per hour
  last_used_at        DateTime?
  created_at          DateTime  @default(now())
  created_by_user_id  String    @db.VarChar(36)
  
  tenant              tenant    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  created_by_user     user      @relation(fields: [created_by_user_id], references: [id])
  
  @@index([api_key])
  @@index([tenant_id, is_active])
  @@map("webhook_api_key")
}
```

### Step 2: Create Migration

```bash
npx prisma migrate dev --name add_leads_module
```

### Step 3: Phone Uniqueness Enforcement

**CRITICAL**: Phone must be unique per tenant, not globally.

**Option A: Application-Level Check** (Recommended for MVP)
```typescript
async checkPhoneUniqueness(tenantId: string, phone: string, excludeLeadId?: string): Promise<boolean> {
  const existingPhone = await this.prisma.lead_phone.findFirst({
    where: {
      phone,
      lead: {
        tenant_id: tenantId,
        ...(excludeLeadId && { id: { not: excludeLeadId } })
      }
    }
  });
  
  return existingPhone === null;
}
```

**Option B: Database Constraint** (For production)
Requires generated column (MySQL 8.0+) or trigger to denormalize tenant_id into lead_phone table.

---

## NestJS Module Structure

```
api/src/modules/leads/
├── leads.module.ts
├── leads.controller.ts
├── webhook.controller.ts
├── services/
│   ├── leads.service.ts
│   ├── lead-emails.service.ts
│   ├── lead-phones.service.ts
│   ├── lead-addresses.service.ts
│   ├── service-requests.service.ts
│   ├── lead-notes.service.ts
│   ├── lead-activities.service.ts
│   ├── google-maps.service.ts
│   └── webhook-auth.service.ts
├── dto/
│   ├── create-lead.dto.ts
│   ├── update-lead.dto.ts
│   ├── update-lead-status.dto.ts
│   ├── create-email.dto.ts
│   ├── create-phone.dto.ts
│   ├── create-address.dto.ts
│   ├── create-service-request.dto.ts
│   ├── create-note.dto.ts
│   ├── list-leads.dto.ts
│   └── webhook-lead.dto.ts
├── guards/
│   └── webhook-auth.guard.ts
└── decorators/
    └── webhook-tenant.decorator.ts
```

---

## Implementation Guide

### Module Registration

**File**: `api/src/modules/leads/leads.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@/core/database';
import { LeadsController } from './leads.controller';
import { WebhookController } from './webhook.controller';
import { LeadsService } from './services/leads.service';
import { LeadEmailsService } from './services/lead-emails.service';
import { LeadPhonesService } from './services/lead-phones.service';
import { LeadAddressesService } from './services/lead-addresses.service';
import { ServiceRequestsService } from './services/service-requests.service';
import { LeadNotesService } from './services/lead-notes.service';
import { LeadActivitiesService } from './services/lead-activities.service';
import { GoogleMapsService } from './services/google-maps.service';
import { WebhookAuthService } from './services/webhook-auth.service';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [LeadsController, WebhookController],
  providers: [
    LeadsService,
    LeadEmailsService,
    LeadPhonesService,
    LeadAddressesService,
    ServiceRequestsService,
    LeadNotesService,
    LeadActivitiesService,
    GoogleMapsService,
    WebhookAuthService,
  ],
  exports: [LeadsService], // For future modules
})
export class LeadsModule {}
```

---

### DTOs (Data Transfer Objects)

#### Create Lead DTO

**File**: `api/src/modules/leads/dto/create-lead.dto.ts`

```typescript
import { IsString, IsBoolean, IsEnum, IsOptional, IsArray, ValidateNested, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

class CreateEmailDto {
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

class CreatePhoneDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(10)
  @MaxLength(10)
  phone: string; // Digits only

  @IsEnum(['mobile', 'home', 'work'])
  @IsOptional()
  phone_type?: string;

  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

class CreateAddressDto {
  @IsString()
  @IsNotEmpty()
  address_line1: string;

  @IsString()
  @IsOptional()
  address_line2?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(2)
  state: string;

  @IsString()
  @IsNotEmpty()
  zip_code: string;

  @IsEnum(['service', 'billing', 'mailing'])
  @IsOptional()
  address_type?: string;

  @IsBoolean()
  @IsOptional()
  is_primary?: boolean;
}

class CreateServiceRequestDto {
  @IsString()
  @IsNotEmpty()
  service_name: string;

  @IsString()
  @IsOptional()
  service_type?: string;

  @IsEnum(['now', 'week', 'month', 'flexible'])
  @IsOptional()
  time_demand?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  extra_data?: any; // JSON
}

export class CreateLeadDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  first_name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  last_name: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  language_spoken?: string = 'EN';

  @IsBoolean()
  @IsOptional()
  accept_sms?: boolean = false;

  @IsEnum(['email', 'phone', 'sms'])
  @IsOptional()
  preferred_communication?: string = 'email';

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEmailDto)
  @IsOptional()
  emails?: CreateEmailDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreatePhoneDto)
  @IsOptional()
  phones?: CreatePhoneDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateAddressDto)
  @IsOptional()
  addresses?: CreateAddressDto[];

  @ValidateNested()
  @Type(() => CreateServiceRequestDto)
  @IsOptional()
  service_request?: CreateServiceRequestDto;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  initial_note?: string;
}
```

---

### Google Maps Service

**File**: `api/src/modules/leads/services/google-maps.service.ts`

**CRITICAL**: This service is MANDATORY for all address operations. Lat/lng are REQUIRED for routing, service area validation, and distance calculations.

```typescript
import { Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@googlemaps/google-maps-services-js';

interface PartialAddress {
  address_line1: string;
  address_line2?: string;
  city?: string;          // Optional - will be fetched from Google
  state?: string;         // Optional - will be fetched from Google
  zip_code: string;       // Required minimum
  latitude?: number;      // Optional - will be fetched if not provided
  longitude?: number;     // Optional - will be fetched if not provided
}

interface ValidatedAddress {
  address_line1: string;
  address_line2?: string;
  city: string;           // Always returned (from Google if missing)
  state: string;          // Always returned (from Google if missing)
  zip_code: string;
  country: string;
  latitude: number;       // REQUIRED - must exist
  longitude: number;      // REQUIRED - must exist
  google_place_id: string;
}

@Injectable()
export class GoogleMapsService {
  private readonly logger = new Logger(GoogleMapsService.name);
  private readonly client: Client;
  private readonly apiKey: string;

  constructor(private configService: ConfigService) {
    this.client = new Client({});
    this.apiKey = this.configService.get<string>('GOOGLE_MAPS_API_KEY');
    
    if (!this.apiKey) {
      this.logger.error('GOOGLE_MAPS_API_KEY not configured!');
      throw new Error('Google Maps API key is required for address validation');
    }
  }

  /**
   * Validate and geocode address using Google Maps Geocoding API
   * 
   * CRITICAL BEHAVIOR:
   * 1. If lat/lng provided: Use them, but still validate address components
   * 2. If lat/lng NOT provided: MUST fetch from Google Maps API
   * 3. If city/state missing: MUST fetch from Google Maps API
   * 4. ALWAYS returns complete address with lat/lng or throws error
   * 
   * This ensures all addresses have coordinates for routing and service area checks.
   */
  async validateAddress(address: PartialAddress): Promise<ValidatedAddress> {
    // If lat/lng already provided, validate they're reasonable
    if (address.latitude && address.longitude) {
      // Lat/lng provided by frontend - still validate address components
      if (!address.city || !address.state) {
        // Missing city/state - use reverse geocoding to get them
        return this.reverseGeocode(address.latitude, address.longitude, address);
      }
      
      // All components provided - just return validated
      this.logger.log('Address provided with lat/lng, skipping API call');
      return {
        address_line1: address.address_line1,
        address_line2: address.address_line2,
        city: address.city,
        state: address.state,
        zip_code: address.zip_code,
        country: 'US',
        latitude: address.latitude,
        longitude: address.longitude,
        google_place_id: '', // Frontend didn't provide, but not critical
      };
    }

    // No lat/lng provided - MUST call Google Maps API
    return this.geocodeAddress(address);
  }

  /**
   * Forward geocoding: Address → Lat/Lng
   * Used when lat/lng not provided (webhook, AI agent, manual entry without frontend)
   */
  private async geocodeAddress(address: PartialAddress): Promise<ValidatedAddress> {
    try {
      // Build address string from available components
      const addressParts = [
        address.address_line1,
        address.address_line2,
        address.city,
        address.state,
        address.zip_code,
        'USA'
      ].filter(Boolean);

      const fullAddress = addressParts.join(', ');

      this.logger.log(`Geocoding address: ${fullAddress}`);

      const response = await this.client.geocode({
        params: {
          address: fullAddress,
          key: this.apiKey,
          components: {
            country: 'US', // Restrict to US addresses
          },
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const location = result.geometry.location;
        const components = result.address_components;

        // Extract city and state from address components
        const city = this.extractComponent(components, 'locality') 
          || this.extractComponent(components, 'sublocality')
          || address.city;
        
        const state = this.extractComponent(components, 'administrative_area_level_1', true);
        const zipCode = this.extractComponent(components, 'postal_code') || address.zip_code;

        if (!city || !state) {
          throw new Error('Could not determine city and state from address');
        }

        this.logger.log(`Address geocoded successfully: ${city}, ${state} (${location.lat}, ${location.lng})`);

        return {
          address_line1: address.address_line1,
          address_line2: address.address_line2,
          city,
          state,
          zip_code: zipCode,
          country: 'US',
          latitude: location.lat,
          longitude: location.lng,
          google_place_id: result.place_id,
        };
      } else {
        throw new Error(`Geocoding failed: ${response.data.status}`);
      }
    } catch (error) {
      this.logger.error(`Google Maps geocoding failed: ${error.message}`);
      
      // DO NOT allow save without lat/lng - this is CRITICAL for service businesses
      throw new UnprocessableEntityException(
        `Address validation failed: ${error.message}. ` +
        'Please verify the address and try again. Lat/lng are required for routing and service areas.'
      );
    }
  }

  /**
   * Reverse geocoding: Lat/Lng → Address components
   * Used when frontend provides lat/lng but missing city/state
   */
  private async reverseGeocode(
    latitude: number,
    longitude: number,
    originalAddress: PartialAddress
  ): Promise<ValidatedAddress> {
    try {
      this.logger.log(`Reverse geocoding: ${latitude}, ${longitude}`);

      const response = await this.client.reverseGeocode({
        params: {
          latlng: { lat: latitude, lng: longitude },
          key: this.apiKey,
        },
      });

      if (response.data.status === 'OK' && response.data.results.length > 0) {
        const result = response.data.results[0];
        const components = result.address_components;

        const city = this.extractComponent(components, 'locality')
          || this.extractComponent(components, 'sublocality')
          || originalAddress.city;
        
        const state = this.extractComponent(components, 'administrative_area_level_1', true);
        const zipCode = this.extractComponent(components, 'postal_code') || originalAddress.zip_code;

        if (!city || !state) {
          throw new Error('Could not determine city and state from coordinates');
        }

        return {
          address_line1: originalAddress.address_line1,
          address_line2: originalAddress.address_line2,
          city,
          state,
          zip_code: zipCode,
          country: 'US',
          latitude,
          longitude,
          google_place_id: result.place_id,
        };
      } else {
        throw new Error(`Reverse geocoding failed: ${response.data.status}`);
      }
    } catch (error) {
      this.logger.error(`Reverse geocoding failed: ${error.message}`);
      throw new UnprocessableEntityException(
        'Could not validate address from coordinates. Please provide complete address details.'
      );
    }
  }

  /**
   * Extract address component from Google Maps response
   */
  private extractComponent(
    components: any[],
    type: string,
    shortName: boolean = false
  ): string | undefined {
    const component = components.find(c => c.types.includes(type));
    return component ? (shortName ? component.short_name : component.long_name) : undefined;
  }

  /**
   * Validate that coordinates are within reasonable US bounds
   */
  validateCoordinates(latitude: number, longitude: number): boolean {
    // US approximate bounds: lat 24-50, lng -125 to -66
    return (
      latitude >= 24 && latitude <= 50 &&
      longitude >= -125 && longitude <= -66
    );
  }
}
```

**Environment Variable**: Add to `.env`
```
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

**CRITICAL NOTES:**
1. **Lat/lng are REQUIRED** - Addresses cannot be saved without coordinates
2. **Frontend provides lat/lng** - Google Maps autocomplete gives coordinates
3. **Webhook/AI must geocode** - Backend auto-fetches lat/lng for raw addresses
4. **City/State auto-fill** - If missing, fetched from Google Maps
5. **Error handling** - Throws 422 if address cannot be validated (no graceful degradation for coordinates)

---

### Lead Addresses Service

**File**: `api/src/modules/leads/services/lead-addresses.service.ts`

**CRITICAL**: All address creation/updates MUST go through Google Maps validation.

```typescript
import { Injectable, BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@/core/database';
import { GoogleMapsService } from './google-maps.service';

@Injectable()
export class LeadAddressesService {
  constructor(
    private prisma: PrismaService,
    private googleMapsService: GoogleMapsService,
  ) {}

  /**
   * Create multiple addresses for a lead
   * CRITICAL: Validates ALL addresses with Google Maps API
   */
  async createMultiple(
    leadId: string,
    addresses: Array<{
      address_line1: string;
      address_line2?: string;
      city?: string;
      state?: string;
      zip_code: string;
      latitude?: number;
      longitude?: number;
      address_type?: string;
      is_primary?: boolean;
    }>
  ) {
    // Validate each address with Google Maps
    const validatedAddresses = await Promise.all(
      addresses.map(async (addr, index) => {
        try {
          // CRITICAL: GoogleMapsService handles all scenarios:
          // 1. If lat/lng provided (frontend) → validates components
          // 2. If lat/lng NOT provided (webhook/AI) → geocodes address
          // 3. If city/state missing → fetches from Google Maps
          const validated = await this.googleMapsService.validateAddress({
            address_line1: addr.address_line1,
            address_line2: addr.address_line2,
            city: addr.city,
            state: addr.state,
            zip_code: addr.zip_code,
            latitude: addr.latitude,
            longitude: addr.longitude,
          });

          return {
            ...validated,
            address_type: addr.address_type || 'service',
            is_primary: index === 0 || addr.is_primary || false,
          };
        } catch (error) {
          throw new UnprocessableEntityException(
            `Address validation failed for "${addr.address_line1}": ${error.message}`
          );
        }
      })
    );

    // Ensure only one address is primary per type
    const primaryCounts: Record<string, number> = {};
    validatedAddresses.forEach(addr => {
      if (addr.is_primary) {
        primaryCounts[addr.address_type] = (primaryCounts[addr.address_type] || 0) + 1;
      }
    });

    Object.entries(primaryCounts).forEach(([type, count]) => {
      if (count > 1) {
        throw new BadRequestException(
          `Only one primary address allowed per type. Found ${count} primary addresses for type "${type}"`
        );
      }
    });

    // Create addresses in database
    const created = await Promise.all(
      validatedAddresses.map(addr =>
        this.prisma.lead_address.create({
          data: {
            lead_id: leadId,
            address_line1: addr.address_line1,
            address_line2: addr.address_line2,
            city: addr.city,
            state: addr.state,
            zip_code: addr.zip_code,
            country: addr.country,
            latitude: addr.latitude,
            longitude: addr.longitude,
            google_place_id: addr.google_place_id,
            address_type: addr.address_type,
            is_primary: addr.is_primary,
          },
        })
      )
    );

    return created;
  }

  /**
   * Create single address
   * Used when adding address to existing lead
   */
  async create(
    leadId: string,
    address: {
      address_line1: string;
      address_line2?: string;
      city?: string;
      state?: string;
      zip_code: string;
      latitude?: number;
      longitude?: number;
      address_type?: string;
      is_primary?: boolean;
    }
  ) {
    // Validate with Google Maps
    const validated = await this.googleMapsService.validateAddress({
      address_line1: address.address_line1,
      address_line2: address.address_line2,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      latitude: address.latitude,
      longitude: address.longitude,
    });

    // If marking as primary, unset other primary addresses of same type
    if (address.is_primary) {
      await this.prisma.lead_address.updateMany({
        where: {
          lead_id: leadId,
          address_type: address.address_type || 'service',
        },
        data: { is_primary: false },
      });
    }

    // Create address
    return this.prisma.lead_address.create({
      data: {
        lead_id: leadId,
        address_line1: validated.address_line1,
        address_line2: validated.address_line2,
        city: validated.city,
        state: validated.state,
        zip_code: validated.zip_code,
        country: validated.country,
        latitude: validated.latitude,
        longitude: validated.longitude,
        google_place_id: validated.google_place_id,
        address_type: address.address_type || 'service',
        is_primary: address.is_primary || false,
      },
    });
  }

  /**
   * Update address
   * Re-validates with Google Maps if address components change
   */
  async update(
    leadId: string,
    addressId: string,
    updates: {
      address_line1?: string;
      address_line2?: string;
      city?: string;
      state?: string;
      zip_code?: string;
      address_type?: string;
      is_primary?: boolean;
    }
  ) {
    // Get existing address
    const existing = await this.prisma.lead_address.findFirst({
      where: { id: addressId, lead_id: leadId },
    });

    if (!existing) {
      throw new BadRequestException('Address not found');
    }

    // Check if address components changed
    const addressChanged =
      (updates.address_line1 && updates.address_line1 !== existing.address_line1) ||
      (updates.zip_code && updates.zip_code !== existing.zip_code);

    let validated = existing;

    if (addressChanged) {
      // Re-validate with Google Maps
      validated = await this.googleMapsService.validateAddress({
        address_line1: updates.address_line1 || existing.address_line1,
        address_line2: updates.address_line2 ?? existing.address_line2,
        city: updates.city || existing.city,
        state: updates.state || existing.state,
        zip_code: updates.zip_code || existing.zip_code,
        latitude: undefined, // Force re-geocoding
        longitude: undefined,
      });
    }

    // Update address
    return this.prisma.lead_address.update({
      where: { id: addressId },
      data: {
        ...(addressChanged && {
          address_line1: validated.address_line1,
          address_line2: validated.address_line2,
          city: validated.city,
          state: validated.state,
          zip_code: validated.zip_code,
          latitude: validated.latitude,
          longitude: validated.longitude,
          google_place_id: validated.google_place_id,
        }),
        ...(updates.address_type && { address_type: updates.address_type }),
        ...(updates.is_primary !== undefined && { is_primary: updates.is_primary }),
      },
    });
  }

  /**
   * Delete address
   */
  async delete(leadId: string, addressId: string) {
    const address = await this.prisma.lead_address.findFirst({
      where: { id: addressId, lead_id: leadId },
    });

    if (!address) {
      throw new BadRequestException('Address not found');
    }

    await this.prisma.lead_address.delete({
      where: { id: addressId },
    });
  }
}
```

**Key Features:**
1. ✅ **Always validates** with Google Maps API
2. ✅ **Handles partial data** - auto-fills city/state if missing
3. ✅ **Auto-geocodes** if lat/lng not provided (webhook/AI use case)
4. ✅ **Frontend optimization** - skips API call if lat/lng provided
5. ✅ **Throws error** if validation fails (lat/lng are REQUIRED)
6. ✅ **Primary flag** enforcement per address type

---

### Leads Service (Core Business Logic)

**File**: `api/src/modules/leads/services/leads.service.ts`

```typescript
import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@/core/database';
import { CreateLeadDto, UpdateLeadDto, UpdateLeadStatusDto, ListLeadsDto } from '../dto';
import { LeadEmailsService } from './lead-emails.service';
import { LeadPhonesService } from './lead-phones.service';
import { LeadAddressesService } from './lead-addresses.service';
import { ServiceRequestsService } from './service-requests.service';
import { LeadActivitiesService } from './lead-activities.service';

@Injectable()
export class LeadsService {
  constructor(
    private prisma: PrismaService,
    private emailsService: LeadEmailsService,
    private phonesService: LeadPhonesService,
    private addressesService: LeadAddressesService,
    private serviceRequestsService: ServiceRequestsService,
    private activitiesService: LeadActivitiesService,
  ) {}

  /**
   * Create new lead (manual entry)
   * CRITICAL: Check phone uniqueness per tenant
   */
  async create(tenantId: string, userId: string, dto: CreateLeadDto) {
    // Validate at least one contact method
    if ((!dto.emails || dto.emails.length === 0) && (!dto.phones || dto.phones.length === 0)) {
      throw new BadRequestException('At least one email or phone is required');
    }

    // Check phone uniqueness per tenant
    if (dto.phones && dto.phones.length > 0) {
      for (const phoneDto of dto.phones) {
        const isUnique = await this.phonesService.checkPhoneUniqueness(tenantId, phoneDto.phone);
        if (!isUnique) {
          throw new ConflictException(`Phone ${phoneDto.phone} already exists for another lead in this tenant`);
        }
      }
    }

    // Validate addresses with Google Maps
    if (dto.addresses && dto.addresses.length > 0) {
      // Addresses validated in addressesService
    }

    // Create lead
    const lead = await this.prisma.lead.create({
      data: {
        tenant_id: tenantId,
        first_name: dto.first_name,
        last_name: dto.last_name,
        language_spoken: dto.language_spoken || 'EN',
        accept_sms: dto.accept_sms || false,
        preferred_communication: dto.preferred_communication || 'email',
        status: 'lead',
        source: 'manual',
        created_by_user_id: userId,
      },
    });

    // Add emails
    if (dto.emails && dto.emails.length > 0) {
      await this.emailsService.createMultiple(lead.id, dto.emails);
    }

    // Add phones
    if (dto.phones && dto.phones.length > 0) {
      await this.phonesService.createMultiple(lead.id, dto.phones);
    }

    // Add addresses (with Google Maps validation)
    if (dto.addresses && dto.addresses.length > 0) {
      // CRITICAL: LeadAddressesService validates ALL addresses via GoogleMapsService
      // - If frontend provided lat/lng: validates and uses them
      // - If lat/lng missing (webhook/AI): geocodes address to get coordinates
      // - If city/state missing: fetches from Google Maps
      // - Throws 422 if validation fails (coordinates are REQUIRED)
      await this.addressesService.createMultiple(lead.id, dto.addresses);
    }

    // Add service request
    if (dto.service_request) {
      await this.serviceRequestsService.create(
        tenantId,
        lead.id,
        null, // No specific address yet
        dto.service_request
      );
    }

    // Add initial note
    if (dto.initial_note) {
      // Add note via notes service
    }

    // Log activity
    await this.activitiesService.logActivity(lead.id, userId, 'created', 'Lead created', {
      source: 'manual',
    });

    // Return full lead with relations
    return this.findOne(tenantId, lead.id);
  }

  /**
   * List leads with filters and pagination
   * CRITICAL: Always filter by tenant_id
   */
  async findAll(tenantId: string, dto: ListLeadsDto) {
    const where: any = { tenant_id: tenantId };

    // Status filter
    if (dto.status) {
      where.status = { in: dto.status.split(',') };
    }

    // Source filter
    if (dto.source) {
      where.source = { in: dto.source.split(',') };
    }

    // Date filters
    if (dto.created_after) {
      where.created_at = { ...where.created_at, gte: new Date(dto.created_after) };
    }
    if (dto.created_before) {
      where.created_at = { ...where.created_at, lte: new Date(dto.created_before) };
    }

    // Search filter (name, email, phone)
    if (dto.search) {
      where.OR = [
        { first_name: { contains: dto.search, mode: 'insensitive' } },
        { last_name: { contains: dto.search, mode: 'insensitive' } },
        { emails: { some: { email: { contains: dto.search, mode: 'insensitive' } } } },
        { phones: { some: { phone: { contains: dto.search } } } },
      ];
    }

    const [leads, total] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        include: {
          emails: { where: { is_primary: true } },
          phones: { where: { is_primary: true } },
          addresses: { where: { is_primary: true } },
          _count: {
            select: {
              service_requests: true,
              // quotes: true, // Future
            },
          },
        },
        orderBy: { [dto.sort_by || 'created_at']: dto.sort_order || 'desc' },
        skip: (dto.page - 1) * dto.limit,
        take: dto.limit,
      }),
      this.prisma.lead.count({ where }),
    ]);

    // Transform for list view
    const transformedLeads = leads.map(lead => ({
      id: lead.id,
      first_name: lead.first_name,
      last_name: lead.last_name,
      status: lead.status,
      source: lead.source,
      primary_email: lead.emails[0]?.email || null,
      primary_phone: lead.phones[0]?.phone || null,
      primary_address: lead.addresses[0] 
        ? `${lead.addresses[0].address_line1}, ${lead.addresses[0].city}, ${lead.addresses[0].state} ${lead.addresses[0].zip_code}`
        : null,
      service_requests_count: lead._count.service_requests,
      quotes_count: 0, // Future
      created_at: lead.created_at,
      updated_at: lead.updated_at,
    }));

    return {
      data: transformedLeads,
      meta: {
        total,
        page: dto.page,
        limit: dto.limit,
        pages: Math.ceil(total / dto.limit),
      },
    };
  }

  /**
   * Get single lead with all relations
   * CRITICAL: Always filter by tenant_id
   */
  async findOne(tenantId: string, leadId: string) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenant_id: tenantId },
      include: {
        emails: { orderBy: { is_primary: 'desc' } },
        phones: { orderBy: { is_primary: 'desc' } },
        addresses: { orderBy: { is_primary: 'desc' } },
        service_requests: { orderBy: { created_at: 'desc' } },
        notes: {
          include: { user: { select: { first_name: true, last_name: true } } },
          orderBy: [{ is_pinned: 'desc' }, { created_at: 'desc' }],
        },
        activities: {
          include: { user: { select: { first_name: true, last_name: true } } },
          orderBy: { created_at: 'desc' },
          take: 50,
        },
      },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Transform activities for response
    const transformedActivities = lead.activities.map(activity => ({
      ...activity,
      user_name: activity.user 
        ? `${activity.user.first_name} ${activity.user.last_name}`
        : 'System',
    }));

    return {
      ...lead,
      activities: transformedActivities,
    };
  }

  /**
   * Update lead status with validation
   * CRITICAL: Validate status transitions
   */
  async updateStatus(tenantId: string, leadId: string, userId: string, dto: UpdateLeadStatusDto) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, tenant_id: tenantId },
    });

    if (!lead) {
      throw new NotFoundException('Lead not found');
    }

    // Validate status transition
    const validTransitions = {
      lead: ['prospect', 'lost'],
      prospect: ['customer', 'lost'],
      customer: [], // Cannot change from customer
      lost: ['lead'], // Can re-activate
    };

    if (!validTransitions[lead.status].includes(dto.status)) {
      throw new BadRequestException(`Cannot transition from ${lead.status} to ${dto.status}`);
    }

    // If marking as lost, require reason
    if (dto.status === 'lost' && !dto.reason) {
      throw new BadRequestException('Reason required when marking lead as lost');
    }

    // Update status
    const updated = await this.prisma.lead.update({
      where: { id: leadId },
      data: {
        status: dto.status,
        ...(dto.status === 'lost' && {
          lost_reason: dto.reason,
          lost_at: new Date(),
        }),
      },
    });

    // Log activity
    await this.activitiesService.logActivity(
      leadId,
      userId,
      'status_change',
      `Status changed from ${lead.status} to ${dto.status}`,
      {
        old_status: lead.status,
        new_status: dto.status,
        reason: dto.reason,
      }
    );

    return updated;
  }
}
```

---

### Webhook Controller (Public Endpoint)

**File**: `api/src/modules/leads/webhook.controller.ts`

```typescript
import { Controller, Post, Body, Headers, BadRequestException, UseGuards } from '@nestjs/common';
import { Public } from '@/modules/auth/decorators/public.decorator';
import { WebhookAuthGuard } from './guards/webhook-auth.guard';
import { WebhookTenant } from './decorators/webhook-tenant.decorator';
import { LeadsService } from './services/leads.service';
import { WebhookLeadDto } from './dto/webhook-lead.dto';

@Controller('public/leads')
@Public() // No JWT required
export class WebhookController {
  constructor(private leadsService: LeadsService) {}

  /**
   * Public webhook endpoint for external lead capture
   * Authentication: X-API-Key and X-API-Secret headers
   * Tenant resolution: Subdomain or API key mapping
   * 
   * CRITICAL: Validates addresses via Google Maps API
   * - Webhook sends raw data (address + zipcode)
   * - Backend auto-fetches city, state, lat, lng
   * - Coordinates are REQUIRED for routing/service areas
   */
  @Post('webhook')
  @UseGuards(WebhookAuthGuard)
  async createLeadFromWebhook(
    @WebhookTenant() tenantId: string,
    @Body() dto: WebhookLeadDto,
  ) {
    try {
      // Check for duplicate by external_source_id
      if (dto.external_source_id) {
        const existing = await this.leadsService.findByExternalSourceId(
          tenantId,
          dto.external_source_id
        );
        
        if (existing) {
          return {
            success: true,
            lead_id: existing.id,
            message: 'Lead already exists (duplicate external_source_id)',
          };
        }
      }

      // Check phone uniqueness
      if (dto.phone) {
        const phoneExists = await this.leadsService.checkPhoneExists(tenantId, dto.phone);
        if (phoneExists) {
          return {
            success: false,
            error: 'Phone number already exists for another lead',
            code: 'PHONE_DUPLICATE',
          };
        }
      }

      // Create lead via webhook
      // IMPORTANT: Address validation happens in LeadAddressesService
      // - Webhook sends: { address_line1, zip_code }
      // - Backend fetches: city, state, lat, lng from Google Maps
      // - If validation fails: Returns 422 error
      const lead = await this.leadsService.createFromWebhook(tenantId, dto);

      return {
        success: true,
        lead_id: lead.id,
        message: 'Lead created successfully',
      };
    } catch (error) {
      // Address validation errors
      if (error instanceof UnprocessableEntityException) {
        return {
          success: false,
          error: error.message,
          code: 'ADDRESS_VALIDATION_FAILED',
        };
      }
      
      throw new BadRequestException(error.message);
    }
  }
}
```

---

## API Documentation Requirements

**CRITICAL**: You MUST create 100% complete API documentation.

**File**: `api/documentation/leads_REST_API.md`

**Requirements:**
- Document ALL 23 endpoints (no skipping)
- Every request field with type, validation, examples
- Every response field with type, examples
- All query parameters
- All path parameters
- All error responses with status codes
- Authentication requirements
- RBAC permissions
- Example requests/responses for every endpoint

**Format**: Follow the format in `api/documentation/admin_panel_REST_API.md`

---

## Testing Requirements

### Unit Tests

**File**: `api/src/modules/leads/services/leads.service.spec.ts`

Test cases:
- Phone uniqueness per tenant (not globally)
- Lead creation with validation
- Status transition validation
- Email/phone format validation
- At least one contact method required

### Integration Tests

**File**: `api/test/leads.e2e-spec.ts`

Test cases:
- Create lead via API
- Create lead via webhook
- Phone uniqueness per tenant (same phone in 2 tenants OK)
- **Google Maps address validation scenarios:**
  - ✅ Frontend provides full address + lat/lng → Skips API call, validates
  - ✅ Frontend provides address without lat/lng → Geocodes, returns lat/lng
  - ✅ Webhook provides only address + zipcode → Auto-fetches city/state/lat/lng
  - ✅ Invalid address provided → Returns 422 error
  - ✅ Address without city/state → Auto-fetches from Google Maps
  - ✅ Address update with changed components → Re-validates
  - ✅ Multiple addresses validated in parallel → All succeed
- Status transitions
- Multi-tenant isolation

---

## Completion Checklist

Before marking this module complete:

- [ ] All database tables created with indexes
- [ ] Phone uniqueness enforcement implemented
- [ ] All 23 API endpoints implemented
- [ ] **Google Maps integration working (CRITICAL)**
- [ ] **Address validation ALWAYS happens (frontend AND webhook)**
- [ ] **Lat/lng REQUIRED - addresses fail without coordinates**
- [ ] **Partial address data handled (zipcode → auto-fetch city/state/lat/lng)**
- [ ] Webhook authentication implemented
- [ ] Activity logging on all changes
- [ ] Multi-tenant isolation verified
- [ ] All DTOs with validation
- [ ] All services implemented
- [ ] Unit tests written (>80% coverage)
- [ ] Integration tests passing
- [ ] API documentation 100% complete
- [ ] Swagger docs generated
- [ ] Migration applied to database
- [ ] Environment variables documented
- [ ] **Google Maps API key configured and tested**

---

## Success Criteria

**Backend is ready for frontend when:**

✅ All endpoints working and tested  
✅ Phone uniqueness per tenant verified  
✅ Google Maps validation working  
✅ Webhook accepts external leads  
✅ API documentation 100% complete  
✅ Multi-tenant isolation tests pass  
✅ Same phone in 2 tenants works correctly  
✅ All validation working  
✅ Activity logs created correctly  
✅ No TypeScript errors  
✅ Build successful  
✅ All tests passing  

---

**Good luck! Follow the patterns established in other modules.**