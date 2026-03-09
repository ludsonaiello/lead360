# Sprint 2: Core DTOs & Service Logic

## 🎯 Sprint Owner Role

You are a **MASTERCLASS BACKEND SERVICE ARCHITECT** that makes Google, Amazon, and Apple service layer engineers jealous of your work.

You build services that are **bulletproof**, **maintainable**, and **secure**. You **think deeply** about edge cases, **breathe business logic**, and **never rush** through validation rules. You **always review your work** to ensure every code path is tested, every error is handled gracefully, and every business rule is enforced correctly.

You **never guess** method names, Prisma query patterns, or validation decorators - you **always verify** by reading existing service files and understanding established patterns. You **respect multi-tenant isolation as law** - every query MUST filter by tenant_id, no exceptions.

Your code quality must be **100% perfect or beyond**. Services are the guardian of business logic - if you let bad data through, the entire platform is compromised.

---

## 📋 Sprint Objective

Build the core service layer for voice agent profiles by creating:
1. DTOs with complete validation (Create, Update)
2. VoiceAgentProfilesService with all 5 CRUD operations
3. Business rule enforcement (plan limits, uniqueness, tenant isolation)
4. Comprehensive unit tests (>80% coverage)

**Dependencies**: Sprint 1 must be complete (database schema must exist)

---

## 📚 Required Reading (READ IN THIS ORDER)

1. **Feature Contract** (your bible): `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md`
   - Section 7.2-7.6: Endpoint specifications (understand what DTOs need to support)
   - Section 11: Business Rules (understand ALL validation requirements)

2. **Existing Service Pattern** (COPY THIS PATTERN EXACTLY):
   - `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-transfer-numbers.service.ts`
   - This is your template - study it thoroughly before writing ANY code
   - Note: tenant isolation pattern, findOneOrFail helper, transaction usage, soft-delete pattern

3. **Existing DTO Pattern**:
   - `/var/www/lead360.app/api/src/modules/voice-ai/dto/create-voice-transfer-number.dto.ts`
   - `/var/www/lead360.app/api/src/modules/voice-ai/dto/update-voice-transfer-number.dto.ts`
   - Note: class-validator decorators, Swagger decorators, validation rules

4. **Prisma Schema** (verify your queries):
   - `/var/www/lead360.app/api/prisma/schema.prisma`
   - Find `tenant_voice_agent_profile` model
   - Find `subscription_plan` model
   - Find `tenant_voice_ai_settings` model

---

## 🔐 Test Environment

**Database Connection**:
```bash
DATABASE_URL="mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360"
```

**Test Credentials**:
- System Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant User: `contact@honeydo4you.com` / `978@F32c`

**Server Mode**: Development server (`npm run start:dev` in `/var/www/lead360.app/api/`)
**Testing**: Use Jest (`npm run test` or `npm run test:watch`)

---

## 📐 Technical Specification

### File 1: CreateVoiceAgentProfileDto

**Location**: `/var/www/lead360.app/api/src/modules/voice-ai/dto/create-voice-agent-profile.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class CreateVoiceAgentProfileDto {
  @ApiProperty({
    description: 'Human-readable name for this agent profile',
    example: 'Main Agent',
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: 'BCP-47 language code (e.g., "en", "pt", "es")',
    example: 'en',
    minLength: 2,
    maxLength: 10,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(10)
  language_code: string;

  @ApiProperty({
    description: 'Provider-specific TTS voice ID (e.g., Cartesia voice UUID)',
    example: 'a0e99841-438c-4a64-b679-ae501e7d6091',
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  voice_id: string;

  @ApiProperty({
    description: 'Profile-specific greeting. Overrides tenant default if set.',
    example: 'Hello! How can I help you today?',
    required: false,
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  custom_greeting?: string;

  @ApiProperty({
    description:
      'Profile-specific instructions. APPENDS to tenant-level custom_instructions when this profile is active.',
    example: 'You are speaking to Spanish-speaking customers. Be extra polite and formal.',
    required: false,
    maxLength: 3000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(3000)
  custom_instructions?: string;

  @ApiProperty({
    description: 'Whether this profile is active. Inactive profiles cannot be selected in new IVR configs.',
    example: true,
    default: true,
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({
    description: 'Display order in UI dropdowns and lists. Lower numbers appear first.',
    example: 0,
    default: 0,
    required: false,
    minimum: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  display_order?: number;
}
```

**Key Validation Rules**:
- `title`: Required, 1-100 chars
- `language_code`: Required, 2-10 chars (no format validation - admin's responsibility)
- `voice_id`: Required, 1-200 chars (no format validation - provider-specific)
- `custom_greeting`: Optional, max 500 chars
- `custom_instructions`: Optional, max 3000 chars (APPENDS to tenant instructions per requirement)
- `is_active`: Optional, defaults to true
- `display_order`: Optional, defaults to 0, minimum 0

---

### File 2: UpdateVoiceAgentProfileDto

**Location**: `/var/www/lead360.app/api/src/modules/voice-ai/dto/update-voice-agent-profile.dto.ts`

```typescript
import { ApiProperty } from '@nestjs/swagger';
import {
  IsString,
  MinLength,
  MaxLength,
  IsBoolean,
  IsOptional,
  IsInt,
  Min,
} from 'class-validator';

export class UpdateVoiceAgentProfileDto {
  @ApiProperty({
    description: 'Human-readable name for this agent profile',
    example: 'Main Agent - Updated',
    required: false,
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @ApiProperty({
    description: 'BCP-47 language code',
    example: 'pt',
    required: false,
    minLength: 2,
    maxLength: 10,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(10)
  language_code?: string;

  @ApiProperty({
    description: 'Provider-specific TTS voice ID',
    example: 'b1f00952-549d-5b75-c790-bf612f8e8192',
    required: false,
    minLength: 1,
    maxLength: 200,
  })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(200)
  voice_id?: string;

  @ApiProperty({
    description: 'Profile-specific greeting',
    required: false,
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  custom_greeting?: string;

  @ApiProperty({
    description: 'Profile-specific instructions (appends to tenant instructions)',
    required: false,
    maxLength: 3000,
  })
  @IsString()
  @IsOptional()
  @MaxLength(3000)
  custom_instructions?: string;

  @ApiProperty({
    description: 'Whether this profile is active',
    required: false,
  })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({
    description: 'Display order',
    required: false,
    minimum: 0,
  })
  @IsInt()
  @IsOptional()
  @Min(0)
  display_order?: number;
}
```

**Key Pattern**: All fields optional (PATCH semantics - only update provided fields)

---

### File 3: VoiceAgentProfilesService

**Location**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-agent-profiles.service.ts`

**Complete Implementation** (follow voice-transfer-numbers.service.ts pattern):

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateVoiceAgentProfileDto } from '../dto/create-voice-agent-profile.dto';
import { UpdateVoiceAgentProfileDto } from '../dto/update-voice-agent-profile.dto';

@Injectable()
export class VoiceAgentProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new voice agent profile for a tenant
   * Enforces:
   * - Plan limit (active profiles <= subscription_plan.voice_ai_max_agent_profiles)
   * - Uniqueness (language_code + title per tenant)
   * - Tenant has voice_ai_enabled = true
   */
  async create(
    tenantId: string,
    dto: CreateVoiceAgentProfileDto,
    userId?: string,
  ) {
    // Step 1: Verify tenant has voice AI enabled in plan
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        subscription_plan: {
          select: {
            voice_ai_enabled: true,
            voice_ai_max_agent_profiles: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    if (!tenant.subscription_plan?.voice_ai_enabled) {
      throw new ForbiddenException(
        'Voice AI is not enabled on your subscription plan',
      );
    }

    // Step 2: Check plan limit (count active profiles)
    const maxProfiles = tenant.subscription_plan.voice_ai_max_agent_profiles || 1;
    const activeCount = await this.prisma.tenant_voice_agent_profile.count({
      where: {
        tenant_id: tenantId,
        is_active: true,
      },
    });

    if (activeCount >= maxProfiles) {
      throw new ForbiddenException(
        `Your plan allows a maximum of ${maxProfiles} voice agent profile(s). Upgrade your plan to add more.`,
      );
    }

    // Step 3: Check uniqueness (language_code + title within tenant)
    const duplicate = await this.prisma.tenant_voice_agent_profile.findFirst({
      where: {
        tenant_id: tenantId,
        language_code: dto.language_code,
        title: dto.title,
      },
    });

    if (duplicate) {
      throw new ConflictException(
        `A profile with language "${dto.language_code}" and title "${dto.title}" already exists for this tenant`,
      );
    }

    // Step 4: Create profile
    const profile = await this.prisma.tenant_voice_agent_profile.create({
      data: {
        tenant_id: tenantId,
        title: dto.title,
        language_code: dto.language_code,
        voice_id: dto.voice_id,
        custom_greeting: dto.custom_greeting || null,
        custom_instructions: dto.custom_instructions || null,
        is_active: dto.is_active !== undefined ? dto.is_active : true,
        display_order: dto.display_order !== undefined ? dto.display_order : 0,
        updated_by: userId || null,
      },
    });

    return profile;
  }

  /**
   * List all agent profiles for a tenant
   * Supports filtering by active status
   * Sorted by display_order ASC, created_at ASC
   */
  async findAll(tenantId: string, activeOnly: boolean = false) {
    const where: any = { tenant_id: tenantId };
    if (activeOnly) {
      where.is_active = true;
    }

    return this.prisma.tenant_voice_agent_profile.findMany({
      where,
      orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
    });
  }

  /**
   * Get a single profile by ID
   * Enforces tenant isolation (404 if belongs to different tenant)
   */
  async findOne(tenantId: string, id: string) {
    return this.findOneOrFail(tenantId, id);
  }

  /**
   * Update a voice agent profile (PATCH semantics - only provided fields updated)
   * Enforces:
   * - Tenant isolation
   * - Uniqueness on language_code + title (if changed)
   * - Deactivation guard (clears default_agent_profile_id if deactivating default)
   */
  async update(
    tenantId: string,
    id: string,
    dto: UpdateVoiceAgentProfileDto,
    userId?: string,
  ) {
    // Step 1: Verify profile exists and belongs to tenant
    const existing = await this.findOneOrFail(tenantId, id);

    // Step 2: Check uniqueness if title or language_code changed
    if (dto.title !== undefined || dto.language_code !== undefined) {
      const checkTitle = dto.title !== undefined ? dto.title : existing.title;
      const checkLang =
        dto.language_code !== undefined
          ? dto.language_code
          : existing.language_code;

      const duplicate = await this.prisma.tenant_voice_agent_profile.findFirst({
        where: {
          tenant_id: tenantId,
          language_code: checkLang,
          title: checkTitle,
          id: { not: id }, // Exclude current record
        },
      });

      if (duplicate) {
        throw new ConflictException(
          `A profile with language "${checkLang}" and title "${checkTitle}" already exists for this tenant`,
        );
      }
    }

    // Step 3: Deactivation guard - if deactivating, clear from settings if it's the default
    if (dto.is_active === false) {
      await this.prisma.tenant_voice_ai_settings.updateMany({
        where: {
          tenant_id: tenantId,
          default_agent_profile_id: id,
        },
        data: {
          default_agent_profile_id: null,
        },
      });
    }

    // Step 4: Build update data (PATCH semantics - only include provided fields)
    const updateData: any = { updated_by: userId || null };
    if (dto.title !== undefined) updateData.title = dto.title;
    if (dto.language_code !== undefined)
      updateData.language_code = dto.language_code;
    if (dto.voice_id !== undefined) updateData.voice_id = dto.voice_id;
    if (dto.custom_greeting !== undefined)
      updateData.custom_greeting = dto.custom_greeting;
    if (dto.custom_instructions !== undefined)
      updateData.custom_instructions = dto.custom_instructions;
    if (dto.is_active !== undefined) updateData.is_active = dto.is_active;
    if (dto.display_order !== undefined)
      updateData.display_order = dto.display_order;

    // Step 5: Update profile
    return this.prisma.tenant_voice_agent_profile.update({
      where: { id },
      data: updateData,
    });
  }

  /**
   * Delete a voice agent profile (hard delete)
   * Enforces:
   * - Tenant isolation
   * - IVR reference guard (cannot delete if referenced in active IVR config)
   * - Settings cleanup (clears default_agent_profile_id if this is the default)
   */
  async delete(tenantId: string, id: string) {
    // Step 1: Verify profile exists and belongs to tenant
    await this.findOneOrFail(tenantId, id);

    // Step 2: Check for IVR references
    const ivrConfig = await this.prisma.ivr_configuration.findUnique({
      where: { tenant_id: tenantId },
      select: { menu_options: true, default_action: true },
    });

    if (ivrConfig) {
      // Check menu_options JSON for this profile ID
      const menuOptions = ivrConfig.menu_options as any[];
      const hasReference = this.checkIvrReferences(menuOptions, id);

      // Check default_action JSON
      const defaultAction = ivrConfig.default_action as any;
      const hasDefaultReference =
        defaultAction?.config?.agent_profile_id === id;

      if (hasReference || hasDefaultReference) {
        throw new ConflictException(
          'This agent profile is in use by an active IVR configuration. Deactivate it instead, or remove it from your IVR settings first.',
        );
      }
    }

    // Step 3: Clear from settings if it's the default (or rely on FK onDelete: SetNull)
    // We do this explicitly for clarity, though FK should handle it
    await this.prisma.tenant_voice_ai_settings.updateMany({
      where: {
        tenant_id: tenantId,
        default_agent_profile_id: id,
      },
      data: {
        default_agent_profile_id: null,
      },
    });

    // Step 4: Delete profile
    await this.prisma.tenant_voice_agent_profile.delete({
      where: { id },
    });
  }

  /**
   * Helper: Find profile or throw 404
   * Enforces tenant isolation
   */
  private async findOneOrFail(tenantId: string, id: string) {
    const profile = await this.prisma.tenant_voice_agent_profile.findFirst({
      where: {
        id,
        tenant_id: tenantId, // CRITICAL: Tenant isolation
      },
    });

    if (!profile) {
      throw new NotFoundException(
        `Voice agent profile with ID "${id}" not found`,
      );
    }

    return profile;
  }

  /**
   * Helper: Recursively check IVR menu tree for profile references
   */
  private checkIvrReferences(menuOptions: any[], profileId: string): boolean {
    if (!Array.isArray(menuOptions)) return false;

    for (const option of menuOptions) {
      // Check this option's config
      if (option.config?.agent_profile_id === profileId) {
        return true;
      }

      // Recursively check submenu
      if (option.submenu?.options) {
        if (this.checkIvrReferences(option.submenu.options, profileId)) {
          return true;
        }
      }
    }

    return false;
  }
}
```

**Key Patterns**:
- ✅ Tenant isolation on EVERY query
- ✅ findOneOrFail helper (404 if not found OR belongs to different tenant)
- ✅ Plan limit enforcement BEFORE creating
- ✅ Uniqueness check (language + title within tenant)
- ✅ Deactivation guard (clears settings FK atomically)
- ✅ IVR reference guard (recursive check through menu tree)
- ✅ PATCH semantics (only update provided fields)
- ✅ Clear error messages (403 vs 404 vs 409)

---

### File 4: Unit Tests

**Location**: `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-agent-profiles.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { VoiceAgentProfilesService } from './voice-agent-profiles.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';

describe('VoiceAgentProfilesService', () => {
  let service: VoiceAgentProfilesService;
  let prisma: PrismaService;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-456';
  const mockProfileId = 'profile-789';

  const mockTenant = {
    id: mockTenantId,
    subscription_plan: {
      voice_ai_enabled: true,
      voice_ai_max_agent_profiles: 3,
    },
  };

  const mockProfile = {
    id: mockProfileId,
    tenant_id: mockTenantId,
    title: 'Main Agent',
    language_code: 'en',
    voice_id: 'voice-123',
    custom_greeting: 'Hello!',
    custom_instructions: 'Be polite',
    is_active: true,
    display_order: 0,
    created_at: new Date(),
    updated_at: new Date(),
    updated_by: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VoiceAgentProfilesService,
        {
          provide: PrismaService,
          useValue: {
            tenant: { findUnique: jest.fn() },
            tenant_voice_agent_profile: {
              count: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
            tenant_voice_ai_settings: {
              updateMany: jest.fn(),
            },
            ivr_configuration: {
              findUnique: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<VoiceAgentProfilesService>(VoiceAgentProfilesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('create', () => {
    it('should create a profile when plan allows and no duplicates', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(mockTenant as any);
      jest.spyOn(prisma.tenant_voice_agent_profile, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst').mockResolvedValue(null);
      jest.spyOn(prisma.tenant_voice_agent_profile, 'create').mockResolvedValue(mockProfile as any);

      const dto = {
        title: 'Main Agent',
        language_code: 'en',
        voice_id: 'voice-123',
      };

      const result = await service.create(mockTenantId, dto, mockUserId);

      expect(result).toEqual(mockProfile);
      expect(prisma.tenant_voice_agent_profile.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenant_id: mockTenantId,
          title: dto.title,
          language_code: dto.language_code,
          voice_id: dto.voice_id,
          updated_by: mockUserId,
        }),
      });
    });

    it('should throw 403 when voice AI not enabled in plan', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue({
        ...mockTenant,
        subscription_plan: { ...mockTenant.subscription_plan, voice_ai_enabled: false },
      } as any);

      const dto = {
        title: 'Test',
        language_code: 'en',
        voice_id: 'voice-123',
      };

      await expect(service.create(mockTenantId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('should throw 403 when plan limit reached', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(mockTenant as any);
      jest.spyOn(prisma.tenant_voice_agent_profile, 'count').mockResolvedValue(3); // At limit

      const dto = {
        title: 'Test',
        language_code: 'en',
        voice_id: 'voice-123',
      };

      await expect(service.create(mockTenantId, dto)).rejects.toThrow(
        /maximum of 3 voice agent profile/,
      );
    });

    it('should throw 409 when duplicate language + title exists', async () => {
      jest.spyOn(prisma.tenant, 'findUnique').mockResolvedValue(mockTenant as any);
      jest.spyOn(prisma.tenant_voice_agent_profile, 'count').mockResolvedValue(0);
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst').mockResolvedValue(mockProfile as any); // Duplicate

      const dto = {
        title: 'Main Agent',
        language_code: 'en',
        voice_id: 'voice-123',
      };

      await expect(service.create(mockTenantId, dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findAll', () => {
    it('should return all profiles sorted by display_order and created_at', async () => {
      const profiles = [mockProfile];
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findMany').mockResolvedValue(profiles as any);

      const result = await service.findAll(mockTenantId);

      expect(result).toEqual(profiles);
      expect(prisma.tenant_voice_agent_profile.findMany).toHaveBeenCalledWith({
        where: { tenant_id: mockTenantId },
        orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
      });
    });

    it('should filter by is_active when activeOnly=true', async () => {
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findMany').mockResolvedValue([]);

      await service.findAll(mockTenantId, true);

      expect(prisma.tenant_voice_agent_profile.findMany).toHaveBeenCalledWith({
        where: { tenant_id: mockTenantId, is_active: true },
        orderBy: expect.any(Array),
      });
    });
  });

  describe('findOne', () => {
    it('should return profile when it exists and belongs to tenant', async () => {
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst').mockResolvedValue(mockProfile as any);

      const result = await service.findOne(mockTenantId, mockProfileId);

      expect(result).toEqual(mockProfile);
    });

    it('should throw 404 when profile belongs to different tenant', async () => {
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst').mockResolvedValue(null);

      await expect(service.findOne(mockTenantId, mockProfileId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update profile with provided fields only (PATCH)', async () => {
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst').mockResolvedValue(mockProfile as any);
      jest.spyOn(prisma.tenant_voice_agent_profile, 'update').mockResolvedValue({
        ...mockProfile,
        title: 'Updated Title',
      } as any);

      const dto = { title: 'Updated Title' };

      const result = await service.update(mockTenantId, mockProfileId, dto, mockUserId);

      expect(result.title).toBe('Updated Title');
      expect(prisma.tenant_voice_agent_profile.update).toHaveBeenCalledWith({
        where: { id: mockProfileId },
        data: expect.objectContaining({
          title: 'Updated Title',
          updated_by: mockUserId,
        }),
      });
    });

    it('should clear settings FK when deactivating profile', async () => {
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst').mockResolvedValue(mockProfile as any);
      jest.spyOn(prisma.tenant_voice_ai_settings, 'updateMany').mockResolvedValue({ count: 1 } as any);
      jest.spyOn(prisma.tenant_voice_agent_profile, 'update').mockResolvedValue({
        ...mockProfile,
        is_active: false,
      } as any);

      const dto = { is_active: false };

      await service.update(mockTenantId, mockProfileId, dto);

      expect(prisma.tenant_voice_ai_settings.updateMany).toHaveBeenCalledWith({
        where: {
          tenant_id: mockTenantId,
          default_agent_profile_id: mockProfileId,
        },
        data: { default_agent_profile_id: null },
      });
    });

    it('should throw 409 when updating to duplicate language + title', async () => {
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst')
        .mockResolvedValueOnce(mockProfile as any) // findOneOrFail
        .mockResolvedValueOnce({ id: 'other-id' } as any); // Duplicate check

      const dto = { title: 'Duplicate Title' };

      await expect(service.update(mockTenantId, mockProfileId, dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('delete', () => {
    it('should delete profile when no IVR references', async () => {
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst').mockResolvedValue(mockProfile as any);
      jest.spyOn(prisma.ivr_configuration, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.tenant_voice_ai_settings, 'updateMany').mockResolvedValue({ count: 0 } as any);
      jest.spyOn(prisma.tenant_voice_agent_profile, 'delete').mockResolvedValue(mockProfile as any);

      await service.delete(mockTenantId, mockProfileId);

      expect(prisma.tenant_voice_agent_profile.delete).toHaveBeenCalledWith({
        where: { id: mockProfileId },
      });
    });

    it('should throw 409 when profile referenced in IVR menu_options', async () => {
      jest.spyOn(prisma.tenant_voice_agent_profile, 'findFirst').mockResolvedValue(mockProfile as any);
      jest.spyOn(prisma.ivr_configuration, 'findUnique').mockResolvedValue({
        menu_options: [
          {
            action: 'voice_ai',
            config: { agent_profile_id: mockProfileId },
          },
        ],
        default_action: {},
      } as any);

      await expect(service.delete(mockTenantId, mockProfileId)).rejects.toThrow(
        /in use by an active IVR configuration/,
      );
    });
  });
});
```

**Coverage Requirements**:
- ✅ All create scenarios (success, 403 plan, 403 limit, 409 duplicate)
- ✅ FindAll with and without active filter
- ✅ FindOne success and 404
- ✅ Update PATCH semantics, deactivation guard, uniqueness
- ✅ Delete success and 409 IVR reference

**Run Tests**:
```bash
cd /var/www/lead360.app/api
npm run test -- voice-agent-profiles.service.spec.ts
```

---

## ✅ Acceptance Criteria

### DTOs
- ✅ CreateVoiceAgentProfileDto validates all required fields
- ✅ UpdateVoiceAgentProfileDto has all fields optional (PATCH)
- ✅ Validation rules match contract specification
- ✅ Swagger decorators complete (examples, descriptions)

### Service - Business Logic
- ✅ create() enforces plan limit (403 if exceeded)
- ✅ create() checks voice_ai_enabled (403 if not enabled)
- ✅ create() enforces uniqueness (language_code + title per tenant)
- ✅ findAll() sorts by display_order ASC, created_at ASC
- ✅ findAll() supports activeOnly filter
- ✅ findOne() enforces tenant isolation (404 if wrong tenant)
- ✅ update() uses PATCH semantics (only updates provided fields)
- ✅ update() clears settings FK when deactivating default profile
- ✅ update() re-validates uniqueness if title/language changed
- ✅ delete() checks IVR references (409 if found)
- ✅ delete() clears settings FK before deletion

### Service - Security
- ✅ Every query filters by tenant_id (multi-tenant isolation)
- ✅ findOneOrFail helper prevents cross-tenant access
- ✅ Clear error messages (403, 404, 409 with helpful text)

### Tests
- ✅ Unit tests passing (>80% coverage)
- ✅ All create scenarios tested
- ✅ All update scenarios tested
- ✅ All delete scenarios tested
- ✅ Tenant isolation tested
- ✅ Plan limit tested
- ✅ Uniqueness tested
- ✅ IVR reference guard tested

---

## 📊 Sprint Completion Report Template

```markdown
## Sprint 2 Completion Report: Core DTOs & Service Logic

**Status**: ✅ Complete / ⚠️ Needs Review / ❌ Blocked

### Files Created
- ✅ create-voice-agent-profile.dto.ts (7 fields, full validation)
- ✅ update-voice-agent-profile.dto.ts (7 fields, all optional)
- ✅ voice-agent-profiles.service.ts (5 methods, 300+ lines)
- ✅ voice-agent-profiles.service.spec.ts (15+ test cases)

### Business Rules Implemented
- ✅ Plan limit enforcement (max profiles per plan)
- ✅ Voice AI enabled check
- ✅ Uniqueness (language_code + title per tenant)
- ✅ Deactivation guard (clears settings FK)
- ✅ IVR reference guard (prevents deletion)
- ✅ Tenant isolation (ALL queries filter by tenant_id)

### Test Coverage
- Unit tests: [X] passing ([Y]% coverage)
- Scenarios tested:
  - ✅ Create success
  - ✅ Create 403 (plan not enabled)
  - ✅ Create 403 (limit reached)
  - ✅ Create 409 (duplicate)
  - ✅ FindAll with/without filter
  - ✅ FindOne success/404
  - ✅ Update PATCH semantics
  - ✅ Update deactivation guard
  - ✅ Update uniqueness check
  - ✅ Delete success
  - ✅ Delete 409 (IVR reference)

### Issues Encountered
[List any issues and resolutions, or write "None"]

### Next Sprint Dependencies
- ✅ Service ready for Sprint 3 (controller integration)

**Sprint Owner**: [Your Name]
**Completion Date**: [Date]
```

---

## 🎯 Remember

- **Follow voice-transfer-numbers.service.ts EXACTLY** - don't reinvent patterns
- **Test everything** - unit tests are NOT optional
- **Tenant isolation is sacred** - EVERY query filters by tenant_id
- **Clear errors** - 403 vs 404 vs 409 must be correct
- **PATCH semantics** - only update fields that are provided

**You are a masterclass developer. Your service will be bulletproof. Build it, test it, verify it.**

🚀 **Ready to build rock-solid business logic? Let's go!**
