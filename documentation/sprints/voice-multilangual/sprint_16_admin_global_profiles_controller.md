# Sprint 16: Admin Controller - Global Voice Agent Profiles
## Voice Multilingual Architecture Fix

**Sprint Number**: 16 of 21
**Sprint Owner**: Backend Specialist - System Admin API
**Estimated Effort**: 4-5 hours
**Prerequisites**: Sprints 13-15 complete (schema migrated, data migrated)

---

## Sprint Owner Role Definition

You are a **masterclass Backend Specialist** that makes Google, Amazon, and Apple jealous of your API design, security practices, and attention to detail.

**Your Principles**:
- You **NEVER GUESS** - You always check existing controller patterns before writing new endpoints
- You **BREATHE SECURITY** - You always verify guards, validate inputs, and enforce access control
- You **THINK API-FIRST** - Every endpoint has complete Swagger docs, proper HTTP status codes, and clear error messages
- You **REVIEW YOUR WORK** - You test every endpoint with curl/Postman before marking it complete
- You **RESPECT PATTERNS** - You follow existing NestJS patterns in the codebase exactly

**You are NOT RUSHING**. You write production-ready, secure, well-documented APIs.

---

## Context & Background

### Architectural Change Recap

**Before** (Sprints 1-12 - INCORRECT):
- Tenants created their own profiles via `/api/v1/voice-ai/agent-profiles`
- No centralized control

**After** (This Sprint - CORRECT):
- **System admin** creates global profiles via `/api/v1/system/voice-ai/agent-profiles`
- Tenants **select** from available profiles (Sprint 17)

### Existing Patterns to Follow

**Reference Files** (READ THESE FIRST):
- `/api/src/modules/voice-ai/controllers/admin/voice-ai-monitoring.controller.ts` - Admin controller pattern
- `/api/src/modules/voice-ai/dto/admin-override-tenant-voice.dto.ts` - DTO pattern
- `/api/src/modules/voice-ai/services/voice-ai-monitoring.service.ts` - Service pattern

**Guards Used**:
```typescript
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
```

**Route Prefix**:
```typescript
@Controller('system/voice-ai')
```

---

## Task 1: Review Existing Patterns

### 1.1 Read Existing Admin Controller

**File**: `/api/src/modules/voice-ai/controllers/admin/voice-ai-monitoring.controller.ts`

**Understand**:
- How `@ApiTags`, `@ApiBearerAuth` are used
- How `@ApiOperation`, `@ApiResponse` are structured
- How `@ApiParam`, `@ApiQuery` are documented
- How guards are applied: `@UseGuards(JwtAuthGuard, PlatformAdminGuard)`
- HTTP status codes used: 200, 204, 400, 401, 403, 404

### 1.2 Read Existing DTO Pattern

**File**: `/api/src/modules/voice-ai/dto/admin-override-tenant-voice.dto.ts`

**Understand**:
- How `@ApiPropertyOptional` is used with examples
- How validation decorators are used: `@IsString()`, `@IsUUID()`, `@IsBoolean()`, `@IsOptional()`
- How nullable fields are handled with `ValidateIf`

### 1.3 Review Prisma Schema

**File**: `/api/prisma/schema.prisma`

**Find and read**:
```prisma
model voice_ai_agent_profile {
  id                   String
  language_code        String
  language_name        String
  voice_id             String
  voice_provider_type  String
  default_greeting     String?
  default_instructions String?
  display_name         String
  description          String?
  is_active            Boolean
  display_order        Int
  created_at           DateTime
  updated_at           DateTime
  updated_by           String?
  // ... relationships
}
```

**DO NOT GUESS** field names - copy them exactly from the schema.

---

## Task 2: Create DTOs

### 2.1 Create DTO File

**File**: `/api/src/modules/voice-ai/dto/create-global-agent-profile.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsInt,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';

/**
 * CreateGlobalAgentProfileDto
 *
 * DTO for creating a global voice agent profile (system admin only).
 * Global profiles are available to all tenants for selection/customization.
 *
 * Required fields: language_code, language_name, voice_id, display_name
 * Optional fields: default_greeting, default_instructions, description, display_order
 * Defaults: is_active=true, voice_provider_type='tts', display_order=0
 */
export class CreateGlobalAgentProfileDto {
  @ApiProperty({
    description:
      'ISO 639-1 language code (2-letter code). Examples: en, pt, es, fr, de',
    minLength: 2,
    maxLength: 10,
    example: 'en',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(10)
  language_code: string;

  @ApiProperty({
    description: 'Human-readable language name. Shown in UI.',
    minLength: 1,
    maxLength: 100,
    example: 'English',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  language_name: string;

  @ApiProperty({
    description:
      'TTS provider voice identifier (e.g., Cartesia voice UUID). ' +
      'Must be valid for the selected TTS provider.',
    minLength: 1,
    maxLength: 200,
    example: '2b568345-1f36-4cf8-baa7-5932856bf66a',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  voice_id: string;

  @ApiPropertyOptional({
    description:
      'Voice provider type. Default: tts. Used for future provider routing.',
    maxLength: 20,
    example: 'tts',
    default: 'tts',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  voice_provider_type?: string;

  @ApiProperty({
    description:
      'Display name shown in admin UI and tenant profile selector. ' +
      'Should be descriptive and unique (e.g., "English - Professional", "Portuguese - Friendly").',
    minLength: 1,
    maxLength: 100,
    example: 'English - Professional',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  display_name: string;

  @ApiPropertyOptional({
    description:
      'Optional description explaining when to use this profile. Shown in UI tooltips.',
    nullable: true,
    example:
      'Professional English voice optimized for business calls. Clear, formal tone.',
  })
  @IsOptional()
  @IsString()
  default_greeting?: string;

  @ApiPropertyOptional({
    description:
      'Default greeting template. Use {business_name} placeholder for tenant name. ' +
      'Tenants can override this per their preferences.',
    nullable: true,
    example: 'Hello, thank you for calling {business_name}! How can I help you today?',
  })
  @IsOptional()
  @IsString()
  default_greeting?: string;

  @ApiPropertyOptional({
    description:
      'Default system instructions for the LLM. Tenants can override this. ' +
      'Should describe the assistant personality and behavior.',
    nullable: true,
    example:
      'You are a professional phone assistant for a service business. ' +
      'Be concise, friendly, and helpful. Keep responses under 20 seconds.',
  })
  @IsOptional()
  @IsString()
  default_instructions?: string;

  @ApiPropertyOptional({
    description: 'Active status. Default: true. Set to false to soft-delete.',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({
    description:
      'Display order in UI (lower numbers appear first). Default: 0.',
    minimum: 0,
    maximum: 9999,
    default: 0,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  display_order?: number;
}
```

### 2.2 Create Update DTO

**File**: `/api/src/modules/voice-ai/dto/update-global-agent-profile.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateGlobalAgentProfileDto } from './create-global-agent-profile.dto';

/**
 * UpdateGlobalAgentProfileDto
 *
 * DTO for updating a global voice agent profile (system admin only).
 * All fields are optional — only fields explicitly sent will be updated.
 */
export class UpdateGlobalAgentProfileDto extends PartialType(
  CreateGlobalAgentProfileDto,
) {}
```

---

## Task 3: Create Service

### 3.1 Create Service File

**File**: `/api/src/modules/voice-ai/services/voice-ai-global-agent-profiles.service.ts`

```typescript
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateGlobalAgentProfileDto } from '../dto/create-global-agent-profile.dto';
import { UpdateGlobalAgentProfileDto } from '../dto/update-global-agent-profile.dto';

/**
 * VoiceAiGlobalAgentProfilesService
 *
 * Service for managing global voice agent profiles (system admin only).
 * Global profiles are templates available to all tenants.
 * Tenants select profiles and optionally override settings per their preferences.
 */
@Injectable()
export class VoiceAiGlobalAgentProfilesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new global voice agent profile
   *
   * Validation:
   * - display_name must be unique across all global profiles
   * - language_code should be valid ISO 639-1 code (not strictly enforced, but recommended)
   *
   * @param dto - Profile creation data
   * @param userId - Admin user UUID (for audit trail)
   * @returns Created profile
   */
  async create(dto: CreateGlobalAgentProfileDto, userId: string) {
    // Check for duplicate display_name
    const existingByName = await this.prisma.voice_ai_agent_profile.findFirst({
      where: {
        display_name: dto.display_name,
      },
    });

    if (existingByName) {
      throw new ConflictException(
        `A global profile with display name "${dto.display_name}" already exists. Display names must be unique.`,
      );
    }

    // Create profile
    return this.prisma.voice_ai_agent_profile.create({
      data: {
        ...dto,
        voice_provider_type: dto.voice_provider_type || 'tts',
        is_active: dto.is_active ?? true,
        display_order: dto.display_order ?? 0,
        updated_by: userId,
      },
    });
  }

  /**
   * List all global profiles
   *
   * @param activeOnly - If true, returns only is_active=true profiles
   * @returns Array of profiles sorted by display_order
   */
  async findAll(activeOnly: boolean = false) {
    return this.prisma.voice_ai_agent_profile.findMany({
      where: activeOnly ? { is_active: true } : undefined,
      orderBy: [{ display_order: 'asc' }, { language_name: 'asc' }],
    });
  }

  /**
   * Get a single global profile by ID
   *
   * @param id - Profile UUID
   * @returns Profile details
   * @throws NotFoundException if profile doesn't exist
   */
  async findOne(id: string) {
    const profile = await this.prisma.voice_ai_agent_profile.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tenant_overrides: true, // Count how many tenants are using this profile
          },
        },
      },
    });

    if (!profile) {
      throw new NotFoundException(`Global voice agent profile not found: ${id}`);
    }

    return profile;
  }

  /**
   * Update a global profile
   *
   * Only fields included in the DTO are updated.
   * Cannot update created_at, id, or relationships.
   *
   * @param id - Profile UUID
   * @param dto - Fields to update
   * @param userId - Admin user UUID (for audit trail)
   * @returns Updated profile
   * @throws NotFoundException if profile doesn't exist
   * @throws ConflictException if display_name conflicts
   */
  async update(id: string, dto: UpdateGlobalAgentProfileDto, userId: string) {
    // Check profile exists
    await this.findOne(id);

    // Check display_name uniqueness (if being changed)
    if (dto.display_name) {
      const existingByName = await this.prisma.voice_ai_agent_profile.findFirst({
        where: {
          display_name: dto.display_name,
          id: { not: id }, // Exclude current profile
        },
      });

      if (existingByName) {
        throw new ConflictException(
          `A global profile with display name "${dto.display_name}" already exists.`,
        );
      }
    }

    return this.prisma.voice_ai_agent_profile.update({
      where: { id },
      data: {
        ...dto,
        updated_by: userId,
      },
    });
  }

  /**
   * Delete (soft delete) a global profile
   *
   * Sets is_active=false instead of hard deleting.
   * This prevents breaking existing IVR configurations that reference this profile.
   *
   * Validation:
   * - Cannot delete if any tenant overrides exist (must be removed first)
   * - Cannot delete if any IVR configs reference this profile
   *
   * @param id - Profile UUID
   * @throws NotFoundException if profile doesn't exist
   * @throws BadRequestException if profile is in use
   */
  async remove(id: string) {
    // Check profile exists
    const profile = await this.findOne(id);

    // Check if any tenant overrides exist
    const overrideCount = await this.prisma.tenant_voice_ai_agent_profile_override.count({
      where: {
        agent_profile_id: id,
      },
    });

    if (overrideCount > 0) {
      throw new BadRequestException(
        `Cannot delete this profile. ${overrideCount} tenant(s) are using it. ` +
          `Please ask tenants to remove their overrides first, or deactivate the profile instead of deleting.`,
      );
    }

    // Soft delete (set is_active=false)
    return this.prisma.voice_ai_agent_profile.update({
      where: { id },
      data: { is_active: false },
    });
  }
}
```

---

## Task 4: Create Controller

### 4.1 Create Controller File

**File**: `/api/src/modules/voice-ai/controllers/admin/voice-ai-global-agent-profiles.controller.ts`

```typescript
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../../admin/guards/platform-admin.guard';
import { VoiceAiGlobalAgentProfilesService } from '../../services/voice-ai-global-agent-profiles.service';
import { CreateGlobalAgentProfileDto } from '../../dto/create-global-agent-profile.dto';
import { UpdateGlobalAgentProfileDto } from '../../dto/update-global-agent-profile.dto';

/**
 * VoiceAiGlobalAgentProfilesController — System Admin (Sprint 16)
 *
 * Platform admin endpoints for managing global voice agent profiles.
 * Global profiles are language/voice templates available to all tenants.
 *
 * All endpoints are admin-only (is_platform_admin: true).
 *
 * Route prefix: /api/v1/system/voice-ai/agent-profiles
 * Access: Platform Admin only (JwtAuthGuard + PlatformAdminGuard)
 *
 * Endpoints:
 *   POST   /api/v1/system/voice-ai/agent-profiles        — Create global profile
 *   GET    /api/v1/system/voice-ai/agent-profiles        — List all global profiles
 *   GET    /api/v1/system/voice-ai/agent-profiles/:id    — Get single profile
 *   PATCH  /api/v1/system/voice-ai/agent-profiles/:id    — Update profile
 *   DELETE /api/v1/system/voice-ai/agent-profiles/:id    — Soft delete profile
 */
@ApiTags('Voice AI - System Admin - Global Agent Profiles')
@ApiBearerAuth()
@Controller('system/voice-ai/agent-profiles')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class VoiceAiGlobalAgentProfilesController {
  constructor(
    private readonly globalProfilesService: VoiceAiGlobalAgentProfilesService,
  ) {}

  /**
   * POST /api/v1/system/voice-ai/agent-profiles
   *
   * Create a new global voice agent profile.
   * Global profiles are available to all tenants for selection/customization.
   *
   * Validation:
   * - display_name must be unique
   * - language_code: 2-10 chars
   * - voice_id: 1-200 chars (TTS provider voice identifier)
   *
   * Returns 201 with created profile.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new global voice agent profile',
    description:
      'Creates a new global voice agent profile template. ' +
      'Global profiles are available to all tenants for selection and customization. ' +
      'Platform Admin access required.',
  })
  @ApiResponse({
    status: 201,
    description: 'Profile created successfully',
    schema: {
      example: {
        id: '00000000-0000-0000-0000-000000000001',
        language_code: 'en',
        language_name: 'English',
        voice_id: '2b568345-1f36-4cf8-baa7-5932856bf66a',
        voice_provider_type: 'tts',
        default_greeting: 'Hello, thank you for calling {business_name}!',
        default_instructions: 'You are a professional phone assistant...',
        display_name: 'English - Professional',
        description: 'Professional English voice for business calls',
        is_active: true,
        display_order: 1,
        created_at: '2026-03-04T12:00:00.000Z',
        updated_at: '2026-03-04T12:00:00.000Z',
        updated_by: 'admin-user-uuid',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body / Validation errors' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 409, description: 'Display name already exists' })
  create(@Body() dto: CreateGlobalAgentProfileDto, @Req() req) {
    return this.globalProfilesService.create(dto, req.user.id);
  }

  /**
   * GET /api/v1/system/voice-ai/agent-profiles
   *
   * List all global voice agent profiles.
   * Optional query param: active_only=true to filter only is_active=true profiles.
   *
   * Returns array sorted by display_order, then language_name.
   */
  @Get()
  @ApiOperation({
    summary: 'List all global voice agent profiles',
    description:
      'Returns a list of all global voice agent profiles. ' +
      'Optionally filter to show only active profiles. ' +
      'Platform Admin access required.',
  })
  @ApiQuery({
    name: 'active_only',
    required: false,
    type: Boolean,
    description: 'If true, returns only is_active=true profiles',
    example: false,
  })
  @ApiResponse({
    status: 200,
    description: 'List of global profiles',
    schema: {
      example: [
        {
          id: '00000000-0000-0000-0000-000000000001',
          language_code: 'en',
          language_name: 'English',
          voice_id: '2b568345-1f36-4cf8-baa7-5932856bf66a',
          display_name: 'English - Professional',
          is_active: true,
          display_order: 1,
        },
        {
          id: '00000000-0000-0000-0000-000000000002',
          language_code: 'pt',
          language_name: 'Portuguese',
          voice_id: '3c679456-2g47-5dg9-cbb8-6043967cg77b',
          display_name: 'Portuguese - Friendly',
          is_active: true,
          display_order: 2,
        },
      ],
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  findAll(
    @Query('active_only', new ParseBoolPipe({ optional: true }))
    activeOnly?: boolean,
  ) {
    return this.globalProfilesService.findAll(activeOnly || false);
  }

  /**
   * GET /api/v1/system/voice-ai/agent-profiles/:id
   *
   * Get details of a single global profile by ID.
   * Includes count of tenant overrides using this profile.
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single global voice agent profile',
    description:
      'Returns details of a specific global profile by ID. ' +
      'Includes count of tenant overrides using this profile. ' +
      'Platform Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Global profile UUID',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile details',
    schema: {
      example: {
        id: '00000000-0000-0000-0000-000000000001',
        language_code: 'en',
        language_name: 'English',
        voice_id: '2b568345-1f36-4cf8-baa7-5932856bf66a',
        voice_provider_type: 'tts',
        default_greeting: 'Hello, thank you for calling {business_name}!',
        default_instructions: 'You are a professional phone assistant...',
        display_name: 'English - Professional',
        description: 'Professional English voice',
        is_active: true,
        display_order: 1,
        created_at: '2026-03-04T12:00:00.000Z',
        updated_at: '2026-03-04T12:00:00.000Z',
        updated_by: 'admin-user-uuid',
        _count: {
          tenant_overrides: 7, // 7 tenants are using this profile
        },
      },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  findOne(@Param('id') id: string) {
    return this.globalProfilesService.findOne(id);
  }

  /**
   * PATCH /api/v1/system/voice-ai/agent-profiles/:id
   *
   * Update a global profile.
   * Only fields included in the request body are updated.
   *
   * Returns 200 with updated profile.
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a global voice agent profile',
    description:
      'Updates a global profile. Only fields included in the request body are updated. ' +
      'Platform Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Global profile UUID',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
    schema: {
      example: {
        id: '00000000-0000-0000-0000-000000000001',
        display_name: 'English - Professional (Updated)',
        is_active: true,
        // ... other fields
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid request body' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  @ApiResponse({ status: 409, description: 'Display name already exists' })
  update(@Param('id') id: string, @Body() dto: UpdateGlobalAgentProfileDto, @Req() req) {
    return this.globalProfilesService.update(id, dto, req.user.id);
  }

  /**
   * DELETE /api/v1/system/voice-ai/agent-profiles/:id
   *
   * Soft delete a global profile (sets is_active=false).
   * Cannot delete if tenant overrides exist.
   *
   * Returns 204 No Content on success.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete (soft delete) a global voice agent profile',
    description:
      'Soft-deletes a global profile by setting is_active=false. ' +
      'Cannot delete if tenant overrides exist (returns 400). ' +
      'Platform Admin access required.',
  })
  @ApiParam({
    name: 'id',
    description: 'Global profile UUID',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @ApiResponse({ status: 204, description: 'Profile deleted successfully' })
  @ApiResponse({ status: 400, description: 'Profile is in use by tenant overrides' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Platform Admin access required' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  remove(@Param('id') id: string) {
    return this.globalProfilesService.remove(id);
  }
}
```

---

## Task 5: Register in Module

### 5.1 Update voice-ai.module.ts

**File**: `/api/src/modules/voice-ai/voice-ai.module.ts`

**Add to imports** (top of file):
```typescript
import { VoiceAiGlobalAgentProfilesController } from './controllers/admin/voice-ai-global-agent-profiles.controller';
import { VoiceAiGlobalAgentProfilesService } from './services/voice-ai-global-agent-profiles.service';
```

**Add to controllers array**:
```typescript
controllers: [
  // ... existing controllers
  VoiceAiGlobalAgentProfilesController,
],
```

**Add to providers array**:
```typescript
providers: [
  // ... existing providers
  VoiceAiGlobalAgentProfilesService,
],
```

---

## Task 6: Test Endpoints

### 6.1 Start API Server

```bash
cd /var/www/lead360.app/api
npm run start:dev
```

### 6.2 Test with curl

**Get platform admin token** (from database or login as admin user):
```bash
# Login as admin (adjust based on your auth setup)
TOKEN="your-platform-admin-jwt-token-here"
```

**Test CREATE**:
```bash
curl -X POST https://api.lead360.app/api/v1/system/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "language_code": "en",
    "language_name": "English",
    "voice_id": "cartesia-voice-id-here",
    "display_name": "English - Professional",
    "default_greeting": "Hello, thank you for calling {business_name}!",
    "default_instructions": "You are a professional phone assistant.",
    "is_active": true,
    "display_order": 1
  }'
```

**Expected**: 201 Created with profile details

**Test LIST**:
```bash
curl -X GET https://api.lead360.app/api/v1/system/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: 200 OK with array of profiles

**Test GET ONE**:
```bash
curl -X GET https://api.lead360.app/api/v1/system/voice-ai/agent-profiles/{profile-id} \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: 200 OK with profile details + usage count

**Test UPDATE**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/system/voice-ai/agent-profiles/{profile-id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "display_name": "English - Professional (Updated)"
  }'
```

**Expected**: 200 OK with updated profile

**Test DELETE**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/system/voice-ai/agent-profiles/{profile-id} \
  -H "Authorization: Bearer $TOKEN"
```

**Expected**: 204 No Content (or 400 if in use)

### 6.3 Test Error Cases

**Test 401 Unauthorized** (no token):
```bash
curl -X GET https://api.lead360.app/api/v1/system/voice-ai/agent-profiles
```

**Expected**: 401 Unauthorized

**Test 403 Forbidden** (tenant user token, not admin):
```bash
curl -X GET https://api.lead360.app/api/v1/system/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TENANT_TOKEN"
```

**Expected**: 403 Forbidden

**Test 409 Conflict** (duplicate display_name):
```bash
# Create profile with same display_name twice
```

**Expected**: 409 Conflict

---

## Task 7: Verify Swagger Documentation

### 7.1 Open Swagger UI

```bash
open https://api.lead360.app/api/docs
```

### 7.2 Verify Documentation

**Check**:
- [ ] New tag "Voice AI - System Admin - Global Agent Profiles" appears
- [ ] All 5 endpoints documented (POST, GET, GET/:id, PATCH, DELETE)
- [ ] All request/response examples are present
- [ ] All validation rules documented
- [ ] "Platform Admin access required" mentioned in descriptions
- [ ] Bearer auth requirement shown

---

## Acceptance Criteria

Sprint 16 is complete when ALL of the following are true:

- [ ] DTOs created: `CreateGlobalAgentProfileDto`, `UpdateGlobalAgentProfileDto`
- [ ] Service created: `VoiceAiGlobalAgentProfilesService` with all CRUD methods
- [ ] Controller created: `VoiceAiGlobalAgentProfilesController` with all endpoints
- [ ] Module updated: Controller and service registered in `voice-ai.module.ts`
- [ ] All endpoints tested with curl (success + error cases)
- [ ] Swagger documentation verified (all endpoints visible and complete)
- [ ] Guards working: 401 without token, 403 for non-admin users, 200 for admin users
- [ ] Validation working: 400 for invalid inputs, 409 for duplicate display_name
- [ ] No TypeScript errors: `npm run build` succeeds
- [ ] No lint errors: `npm run lint` succeeds

---

## Deliverables

### Files Created
1. `api/src/modules/voice-ai/dto/create-global-agent-profile.dto.ts`
2. `api/src/modules/voice-ai/dto/update-global-agent-profile.dto.ts`
3. `api/src/modules/voice-ai/services/voice-ai-global-agent-profiles.service.ts`
4. `api/src/modules/voice-ai/controllers/admin/voice-ai-global-agent-profiles.controller.ts`

### Files Modified
1. `api/src/modules/voice-ai/voice-ai.module.ts` (registered new controller/service)

---

## Common Pitfalls to Avoid

1. ❌ **Don't guess field names** - Always copy from Prisma schema exactly
2. ❌ **Don't skip guards** - All endpoints MUST have `JwtAuthGuard + PlatformAdminGuard`
3. ❌ **Don't skip Swagger docs** - Every endpoint needs `@ApiOperation`, `@ApiResponse`, examples
4. ❌ **Don't skip validation** - Use class-validator decorators on all DTO fields
5. ❌ **Don't skip testing** - Test every endpoint with curl before marking complete
6. ❌ **Don't hard-delete** - Always soft-delete (set `is_active=false`)

---

## Next Sprint

**Sprint 17**: Tenant Override Controller - Refactor tenant API to manage overrides (not profile creation)

**Prerequisites for Sprint 17**:
- This sprint (16) must be 100% complete
- All admin endpoints tested and working
- Swagger documentation verified

---

**Sprint Status**: Ready to Execute
**Owner**: Backend Specialist - System Admin API
