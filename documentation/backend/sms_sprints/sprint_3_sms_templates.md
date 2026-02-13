# Sprint 3: SMS Templates System

**Priority:** 🟡 HIGH
**Estimated Effort:** 2-3 days
**Developer:** AI Developer #3
**Dependencies:** Sprint 2 (SMS sending endpoint)
**Assigned Date:** February 13, 2026

---

## ⚠️ CRITICAL INSTRUCTIONS - READ CAREFULLY

### Before You Write ANY Code:

1. **REVIEW EXISTING PATTERNS**
   - Study `prisma/schema.prisma` for table patterns
   - Review existing DTOs for validation patterns
   - Check existing services for CRUD patterns
   - Understand multi-tenant data isolation
   - Review RBAC implementation in other modules

2. **DO NOT BREAK EXISTING FUNCTIONALITY**
   - This adds NEW functionality only
   - DO NOT modify existing SMS sending logic
   - DO NOT change communication_event structure
   - All existing tests MUST pass

3. **USE EXACT NAMING CONVENTIONS**
   - Review Prisma naming: snake_case for DB fields
   - Review DTO naming: camelCase for TypeScript
   - Check existing template-like systems (email templates?)
   - Follow exact same patterns

4. **MULTI-TENANT MANDATORY**
   - Templates belong to specific tenants
   - Never show templates across tenants
   - Filter all queries by tenant_id
   - Test with multiple tenants

5. **MERGE FIELDS IMPLEMENTATION**
   - Study how other systems do variable replacement
   - Support syntax: `{lead.first_name}`, `{tenant.company_name}`, etc.
   - Escape special characters properly
   - Handle missing fields gracefully

6. **YOUR DOCUMENTATION**
   - MUST BE SAVED AT documentation/backend/sms_sprints/

---

## Sprint Objective

Create an SMS template system allowing tenants to save and reuse common SMS messages with dynamic merge fields for personalization.

### Business Value

- **Consistency:** Standardized messages across team
- **Efficiency:** No need to retype common messages
- **Personalization:** Dynamic fields like `{first_name}`, `{company_name}`
- **Compliance:** Pre-approved messaging templates

---

## Requirements

### 1. Database Schema

**Add `sms_template` table:**

```prisma
model sms_template {
  id                String    @id @default(uuid()) @db.Char(36)
  tenant_id         String    @db.Char(36)
  name              String    @db.VarChar(100)   // Template name
  description       String?   @db.VarChar(255)   // Optional description
  template_body     String    @db.Text           // Template text with {merge_fields}
  category          String?   @db.VarChar(50)    // e.g., "quote", "appointment", "follow_up"
  is_active         Boolean   @default(true)
  is_default        Boolean   @default(false)    // One default per category per tenant
  usage_count       Int       @default(0)        // Track usage
  created_by        String    @db.Char(36)
  created_at        DateTime  @default(now())
  updated_at        DateTime  @updatedAt

  // Relations
  tenant            tenant    @relation(fields: [tenant_id], references: [id], onDelete: Cascade)
  creator           user      @relation(fields: [created_by], references: [id])

  @@index([tenant_id, is_active])
  @@index([tenant_id, category])
  @@map("sms_template")
}
```

**Migration:**
```bash
npx prisma migrate dev --name add_sms_template_table
```

---

### 2. Supported Merge Fields

**Lead Fields:**
- `{lead.first_name}`
- `{lead.last_name}`
- `{lead.phone}`
- `{lead.email}`
- `{lead.address}`

**Tenant Fields:**
- `{tenant.company_name}`
- `{tenant.phone}`
- `{tenant.address}`

**User Fields (sender):**
- `{user.first_name}`
- `{user.last_name}`
- `{user.phone}`
- `{user.email}`

**Date/Time:**
- `{today}` - Current date
- `{time}` - Current time

**Custom Fields:**
- `{custom.field_name}` - For dynamic data passed in

---

### 3. Template Merge Service

**File:** `api/src/modules/communication/services/template-merge.service.ts` (NEW)

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface MergeData {
  lead?: any;
  tenant?: any;
  user?: any;
  custom?: Record<string, any>;
}

@Injectable()
export class TemplateMergeService {
  private readonly logger = new Logger(TemplateMergeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Merge template with data
   * CRITICAL: Review existing variable replacement patterns
   */
  async mergeTemplate(
    templateBody: string,
    mergeData: MergeData,
  ): Promise<string> {
    let result = templateBody;

    // Replace lead fields
    if (mergeData.lead) {
      result = result.replace(/{lead\.first_name}/g, mergeData.lead.first_name || '');
      result = result.replace(/{lead\.last_name}/g, mergeData.lead.last_name || '');
      result = result.replace(/{lead\.phone}/g, mergeData.lead.phone || '');
      result = result.replace(/{lead\.email}/g, mergeData.lead.email || '');
      result = result.replace(/{lead\.address}/g, mergeData.lead.address || '');
    }

    // Replace tenant fields
    if (mergeData.tenant) {
      result = result.replace(/{tenant\.company_name}/g, mergeData.tenant.company_name || '');
      result = result.replace(/{tenant\.phone}/g, mergeData.tenant.phone || '');
      result = result.replace(/{tenant\.address}/g, mergeData.tenant.address || '');
    }

    // Replace user fields
    if (mergeData.user) {
      result = result.replace(/{user\.first_name}/g, mergeData.user.first_name || '');
      result = result.replace(/{user\.last_name}/g, mergeData.user.last_name || '');
      result = result.replace(/{user\.phone}/g, mergeData.user.phone || '');
      result = result.replace(/{user\.email}/g, mergeData.user.email || '');
    }

    // Replace date/time
    const today = new Date().toLocaleDateString();
    const time = new Date().toLocaleTimeString();
    result = result.replace(/{today}/g, today);
    result = result.replace(/{time}/g, time);

    // Replace custom fields
    if (mergeData.custom) {
      Object.entries(mergeData.custom).forEach(([key, value]) => {
        const regex = new RegExp(`{custom\.${key}}`, 'g');
        result = result.replace(regex, String(value));
      });
    }

    return result;
  }

  /**
   * Load merge data from database
   */
  async loadMergeData(
    tenantId: string,
    userId: string,
    leadId?: string,
  ): Promise<MergeData> {
    const [tenant, user, lead] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          company_name: true,
          phone: true,
          address: true,
        },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          first_name: true,
          last_name: true,
          phone: true,
          email: true,
        },
      }),
      leadId
        ? this.prisma.lead.findFirst({
            where: { id: leadId, tenant_id: tenantId },
            select: {
              first_name: true,
              last_name: true,
              phone: true,
              email: true,
              address: true,
            },
          })
        : null,
    ]);

    return { tenant, user, lead };
  }
}
```

---

### 4. Template DTOs

**File:** `api/src/modules/communication/dto/template/create-sms-template.dto.ts`

```typescript
import { IsNotEmpty, IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreateSmsTemplateDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(1600)
  template_body: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}

export class UpdateSmsTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1600)
  template_body?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsBoolean()
  is_default?: boolean;
}
```

---

### 5. Template Service (CRUD)

**File:** `api/src/modules/communication/services/sms-template.service.ts`

```typescript
@Injectable()
export class SmsTemplateService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, userId: string, dto: CreateSmsTemplateDto) {
    // If setting as default, unset other defaults in same category
    if (dto.is_default && dto.category) {
      await this.prisma.sms_template.updateMany({
        where: {
          tenant_id: tenantId,
          category: dto.category,
          is_default: true,
        },
        data: { is_default: false },
      });
    }

    return await this.prisma.sms_template.create({
      data: {
        tenant_id: tenantId,
        created_by: userId,
        ...dto,
      },
    });
  }

  async findAll(tenantId: string, category?: string) {
    return await this.prisma.sms_template.findMany({
      where: {
        tenant_id: tenantId,
        is_active: true,
        ...(category && { category }),
      },
      orderBy: { created_at: 'desc' },
    });
  }

  async update(id: string, tenantId: string, dto: UpdateSmsTemplateDto) {
    // Similar logic for is_default handling
    return await this.prisma.sms_template.update({
      where: { id, tenant_id: tenantId },
      data: dto,
    });
  }

  async delete(id: string, tenantId: string) {
    return await this.prisma.sms_template.update({
      where: { id, tenant_id: tenantId },
      data: { is_active: false },
    });
  }
}
```

---

### 6. Modify SMS Sending to Support Templates

**Update Sprint 2's SendSmsDto:**

```typescript
@IsOptional()
@IsUUID('4')
template_id?: string;
```

**Update SmsSendingService:**

```typescript
async sendSms(tenantId: string, userId: string, dto: SendSmsDto) {
  let messageBody = dto.text_body;

  // If template_id provided, load and merge template
  if (dto.template_id) {
    const template = await this.prisma.sms_template.findFirst({
      where: {
        id: dto.template_id,
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Load merge data
    const mergeData = await this.templateMerge.loadMergeData(
      tenantId,
      userId,
      dto.lead_id,
    );

    // Merge template
    messageBody = await this.templateMerge.mergeTemplate(
      template.template_body,
      mergeData,
    );

    // Increment usage count
    await this.prisma.sms_template.update({
      where: { id: template.id },
      data: { usage_count: { increment: 1 } },
    });
  }

  // Continue with existing SMS sending logic...
}
```

---

## Testing Requirements

**Test 1: Create Template**
- Create template with merge fields
- Verify saved correctly

**Test 2: Merge Fields**
- Send SMS with template_id
- Verify `{lead.first_name}` replaced with actual name

**Test 3: Default Template**
- Set template as default in category
- Verify other defaults unset

**Test 4: Multi-Tenant Isolation**
- Create template in Tenant A
- Verify Tenant B cannot see it

---

## Deliverables

- [ ] Database migration
- [ ] TemplateMergeService
- [ ] SmsTemplateService (CRUD)
- [ ] Template DTOs
- [ ] Controller endpoints
- [ ] Updated SMS sending to support templates
- [ ] API documentation updated
- [ ] All tests pass

---

**END OF SPRINT 3**
