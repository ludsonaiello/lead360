# Sprint 17: Tenant Override Controller Refactor
## Voice Multilingual Architecture Fix

**Sprint Number**: 17 of 21
**Sprint Owner**: Backend Specialist - Tenant API
**Estimated Effort**: 5-6 hours
**Prerequisites**: Sprint 16 complete (admin endpoints working)

---

## Sprint Owner Role Definition

You are a **masterclass Backend Specialist** that makes Google, Amazon, and Apple jealous of your API design, refactoring skills, and backward compatibility handling.

**Your Principles**:
- You **NEVER GUESS** - You read existing controller/service code before refactoring
- You **PRESERVE DATA** - You never break existing data or references during refactors
- You **THINK MIGRATION-FIRST** - You understand the transition from old to new architecture
- You **TEST THOROUGHLY** - You test both new endpoints AND ensure old data still works
- You **RESPECT PATTERNS** - You follow existing NestJS patterns exactly

**You are NOT RUSHING**. Refactoring requires careful planning to avoid breaking changes.

---

## Context & Background

### Current State (INCORRECT)

**Endpoints** (Sprint 1-12):
```
POST   /api/v1/voice-ai/agent-profiles        - Creates tenant profile
GET    /api/v1/voice-ai/agent-profiles        - Lists tenant profiles
GET    /api/v1/voice-ai/agent-profiles/:id    - Gets tenant profile
PATCH  /api/v1/voice-ai/agent-profiles/:id    - Updates tenant profile
DELETE /api/v1/voice-ai/agent-profiles/:id    - Deletes tenant profile
```

**Problem**: Tenants create profiles (full control), no global templates.

### Target State (CORRECT)

**New Endpoints** (This Sprint):
```
GET    /api/v1/voice-ai/available-profiles              - List global profiles (read-only)
POST   /api/v1/voice-ai/agent-profile-overrides         - Create override for global profile
GET    /api/v1/voice-ai/agent-profile-overrides         - List tenant's overrides
GET    /api/v1/voice-ai/agent-profile-overrides/:id     - Get single override
PATCH  /api/v1/voice-ai/agent-profile-overrides/:id     - Update override
DELETE /api/v1/voice-ai/agent-profile-overrides/:id     - Delete override
```

**Solution**: Tenants **select** global profiles and **override** specific fields.

---

## Task 1: Review Existing Code

### 1.1 Read Existing Controller

**File**: `/api/src/modules/voice-ai/controllers/tenant/voice-agent-profiles.controller.ts`

**Understand**:
- Current CRUD structure
- How `req.user.tenant_id` is extracted from JWT
- How roles are enforced: `@Roles('Owner', 'Admin')`
- How validation errors are handled

### 1.2 Read Existing Service

**File**: `/api/src/modules/voice-ai/services/voice-agent-profiles.service.ts`

**Understand**:
- Current business logic
- Plan limit enforcement logic
- Tenant isolation checks
- Validation patterns

### 1.3 Read Existing DTOs

**Files**:
- `/api/src/modules/voice-ai/dto/create-voice-agent-profile.dto.ts`
- `/api/src/modules/voice-ai/dto/update-voice-agent-profile.dto.ts`

**Understand**: Current validation rules, field requirements

---

## Task 2: Create New DTOs for Overrides

### 2.1 Create Override DTOs

**File**: `/api/src/modules/voice-ai/dto/create-agent-profile-override.dto.ts`

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsUUID,
  IsOptional,
  MaxLength,
} from 'class-validator';

/**
 * CreateAgentProfileOverrideDto
 *
 * DTO for creating a tenant override for a global voice agent profile.
 * Tenants select a global profile and optionally customize greeting/instructions.
 *
 * Required: agent_profile_id (global profile UUID)
 * Optional: custom_greeting, custom_instructions, is_active (default true)
 */
export class CreateAgentProfileOverrideDto {
  @ApiProperty({
    description:
      'Global voice agent profile UUID to override. ' +
      'Must be an active global profile created by system admin.',
    example: '00000000-0000-0000-0000-000000000001',
  })
  @IsUUID('4')
  agent_profile_id: string;

  @ApiPropertyOptional({
    description:
      'Optional custom greeting to override the global profile default. ' +
      'Use {business_name} placeholder. If not provided, uses global default.',
    nullable: true,
    maxLength: 65535, // TEXT column limit
    example: 'Welcome to our business! How can we assist you today?',
  })
  @IsOptional()
  @IsString()
  @MaxLength(65535)
  custom_greeting?: string;

  @ApiPropertyOptional({
    description:
      'Optional custom instructions to override the global profile default. ' +
      'If not provided, uses global default instructions.',
    nullable: true,
    example:
      'You are a friendly assistant for our plumbing business. ' +
      'Always mention our 24/7 emergency service availability.',
  })
  @IsOptional()
  @IsString()
  custom_instructions?: string;

  @ApiPropertyOptional({
    description:
      'Active status for this override. Default: true. ' +
      'Set to false to temporarily disable without deleting.',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
```

**File**: `/api/src/modules/voice-ai/dto/update-agent-profile-override.dto.ts`

```typescript
import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateAgentProfileOverrideDto } from './create-agent-profile-override.dto';

/**
 * UpdateAgentProfileOverrideDto
 *
 * DTO for updating a tenant override.
 * All fields optional except agent_profile_id cannot be changed after creation.
 */
export class UpdateAgentProfileOverrideDto extends PartialType(
  OmitType(CreateAgentProfileOverrideDto, ['agent_profile_id'] as const),
) {}
```

---

## Task 3: Refactor Service

### 3.1 Update Service to Support Overrides

**File**: `/api/src/modules/voice-ai/services/voice-agent-profiles.service.ts`

**Add new methods** (KEEP existing methods for now - backward compatibility):

```typescript
/**
 * List available global profiles (read-only for tenants)
 *
 * @param activeOnly - Filter to active profiles only
 * @returns Array of global profiles sorted by display_order
 */
async listAvailableGlobalProfiles(activeOnly: boolean = true) {
  return this.prisma.voice_ai_agent_profile.findMany({
    where: activeOnly ? { is_active: true } : undefined,
    orderBy: [{ display_order: 'asc' }, { language_name: 'asc' }],
    select: {
      id: true,
      language_code: true,
      language_name: true,
      voice_id: true,
      display_name: true,
      description: true,
      default_greeting: true, // Show default so tenants can decide if override needed
      default_instructions: true,
      is_active: true,
      display_order: true,
    },
  });
}

/**
 * Create a tenant override for a global profile
 *
 * Validation:
 * - Global profile must exist and be active
 * - Tenant cannot exceed plan limit (voice_ai_max_agent_profiles)
 * - Tenant cannot create duplicate override for same global profile
 *
 * @param tenantId - Tenant UUID (from JWT)
 * @param dto - Override data
 * @param userId - User UUID (for audit trail)
 * @returns Created override
 */
async createOverride(
  tenantId: string,
  dto: CreateAgentProfileOverrideDto,
  userId: string,
) {
  // 1. Validate global profile exists and is active
  const globalProfile = await this.prisma.voice_ai_agent_profile.findUnique({
    where: { id: dto.agent_profile_id },
  });

  if (!globalProfile) {
    throw new NotFoundException(
      `Global voice agent profile not found: ${dto.agent_profile_id}`,
    );
  }

  if (!globalProfile.is_active) {
    throw new BadRequestException(
      `Cannot create override for inactive global profile: ${globalProfile.display_name}`,
    );
  }

  // 2. Check for duplicate override (tenant already has override for this global profile)
  const existingOverride = await this.prisma.tenant_voice_ai_agent_profile_override.findFirst({
    where: {
      tenant_id: tenantId,
      agent_profile_id: dto.agent_profile_id,
    },
  });

  if (existingOverride) {
    throw new ConflictException(
      `You already have an override for profile "${globalProfile.display_name}". ` +
        `Update the existing override (ID: ${existingOverride.id}) instead of creating a new one.`,
    );
  }

  // 3. Enforce plan limit
  await this.validatePlanLimit(tenantId);

  // 4. Create override
  return this.prisma.tenant_voice_ai_agent_profile_override.create({
    data: {
      tenant_id: tenantId,
      agent_profile_id: dto.agent_profile_id,
      custom_greeting: dto.custom_greeting,
      custom_instructions: dto.custom_instructions,
      is_active: dto.is_active ?? true,
      updated_by: userId,
      // Copy display fields from global profile for convenience (denormalized)
      title: globalProfile.display_name, // For backward compatibility
      language_code: globalProfile.language_code,
      voice_id: globalProfile.voice_id,
      display_order: globalProfile.display_order,
    },
    include: {
      agent_profile: {
        select: {
          id: true,
          display_name: true,
          language_name: true,
          default_greeting: true,
          default_instructions: true,
        },
      },
    },
  });
}

/**
 * List tenant's overrides (with global profile details)
 *
 * @param tenantId - Tenant UUID (from JWT)
 * @param activeOnly - Filter to active overrides only
 * @returns Array of overrides with global profile details
 */
async listOverrides(tenantId: string, activeOnly: boolean = false) {
  return this.prisma.tenant_voice_ai_agent_profile_override.findMany({
    where: {
      tenant_id: tenantId,
      ...(activeOnly ? { is_active: true } : {}),
    },
    include: {
      agent_profile: {
        select: {
          id: true,
          language_code: true,
          language_name: true,
          voice_id: true,
          display_name: true,
          description: true,
          default_greeting: true,
          default_instructions: true,
          is_active: true,
        },
      },
    },
    orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
  });
}

/**
 * Get single override by ID
 *
 * @param tenantId - Tenant UUID (tenant isolation)
 * @param overrideId - Override UUID
 * @returns Override with global profile details
 * @throws NotFoundException if not found or belongs to different tenant
 */
async findOverride(tenantId: string, overrideId: string) {
  const override = await this.prisma.tenant_voice_ai_agent_profile_override.findFirst({
    where: {
      id: overrideId,
      tenant_id: tenantId,
    },
    include: {
      agent_profile: true,
    },
  });

  if (!override) {
    throw new NotFoundException(
      `Override not found or does not belong to your tenant: ${overrideId}`,
    );
  }

  return override;
}

/**
 * Update an existing override
 *
 * Can update: custom_greeting, custom_instructions, is_active
 * Cannot update: agent_profile_id (immutable after creation)
 *
 * @param tenantId - Tenant UUID (tenant isolation)
 * @param overrideId - Override UUID
 * @param dto - Fields to update
 * @param userId - User UUID (for audit trail)
 * @returns Updated override
 */
async updateOverride(
  tenantId: string,
  overrideId: string,
  dto: UpdateAgentProfileOverrideDto,
  userId: string,
) {
  // Validate override exists and belongs to tenant
  await this.findOverride(tenantId, overrideId);

  return this.prisma.tenant_voice_ai_agent_profile_override.update({
    where: {
      id: overrideId,
      tenant_id: tenantId,
    },
    data: {
      ...dto,
      updated_by: userId,
    },
    include: {
      agent_profile: true,
    },
  });
}

/**
 * Delete an override
 *
 * Hard delete (not soft delete, since tenant can recreate if needed).
 * Clears tenant_voice_ai_settings.default_agent_profile_id if this is the default.
 *
 * @param tenantId - Tenant UUID (tenant isolation)
 * @param overrideId - Override UUID
 */
async deleteOverride(tenantId: string, overrideId: string) {
  // Validate override exists
  await this.findOverride(tenantId, overrideId);

  // Check if this is the default profile
  const settings = await this.prisma.tenant_voice_ai_settings.findUnique({
    where: { tenant_id: tenantId },
    select: { default_agent_profile_id: true },
  });

  if (settings?.default_agent_profile_id === overrideId) {
    // Clear default before deleting
    await this.prisma.tenant_voice_ai_settings.update({
      where: { tenant_id: tenantId },
      data: { default_agent_profile_id: null },
    });
  }

  // Hard delete
  await this.prisma.tenant_voice_ai_agent_profile_override.delete({
    where: {
      id: overrideId,
      tenant_id: tenantId,
    },
  });
}

/**
 * Validate tenant plan limit
 *
 * Checks subscription_plan.voice_ai_max_agent_profiles.
 * Counts active overrides (is_active=true).
 *
 * @param tenantId - Tenant UUID
 * @throws ForbiddenException if limit exceeded
 */
private async validatePlanLimit(tenantId: string) {
  const tenant = await this.prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      subscription_plan: {
        select: {
          name: true,
          voice_ai_enabled: true,
          voice_ai_max_agent_profiles: true,
        },
      },
    },
  });

  if (!tenant) {
    throw new NotFoundException(`Tenant not found: ${tenantId}`);
  }

  if (!tenant.subscription_plan.voice_ai_enabled) {
    throw new ForbiddenException(
      `Voice AI is not enabled on your subscription plan (${tenant.subscription_plan.name}). ` +
        `Please upgrade to access this feature.`,
    );
  }

  const activeOverrideCount = await this.prisma.tenant_voice_ai_agent_profile_override.count({
    where: {
      tenant_id: tenantId,
      is_active: true,
    },
  });

  const limit = tenant.subscription_plan.voice_ai_max_agent_profiles || 1;

  if (activeOverrideCount >= limit) {
    throw new ForbiddenException(
      `Your plan allows a maximum of ${limit} active voice agent profile(s). ` +
        `You currently have ${activeOverrideCount} active. ` +
        `Deactivate or delete an existing profile, or upgrade your plan.`,
    );
  }
}
```

---

## Task 4: Update Controller

### 4.1 Refactor Controller

**File**: `/api/src/modules/voice-ai/controllers/tenant/voice-agent-profiles.controller.ts`

**Update imports**:
```typescript
import { CreateAgentProfileOverrideDto } from '../../dto/create-agent-profile-override.dto';
import { UpdateAgentProfileOverrideDto } from '../../dto/update-agent-profile-override.dto';
```

**Update ApiTags**:
```typescript
@ApiTags('Voice AI - Agent Profile Overrides')
```

**Add NEW endpoints** (keep old ones for now with deprecation notice):

```typescript
// ─── NEW: List Available Global Profiles (Read-Only) ───────────────────────
/**
 * GET /api/v1/voice-ai/available-profiles
 *
 * Lists all global profiles available for selection.
 * Read-only: tenants cannot modify global profiles.
 * Used to show available languages/voices in UI before creating override.
 */
@Get('available-profiles')
@Roles('Owner', 'Admin', 'Manager')
@ApiOperation({
  summary: 'List available global voice agent profiles',
  description:
    'Returns all global profiles available for selection and customization. ' +
    'Read-only: tenants cannot modify global profiles (system admin managed). ' +
    'Optionally filter to active profiles only.',
})
@ApiQuery({
  name: 'active_only',
  required: false,
  type: Boolean,
  description: 'If true, returns only is_active=true profiles',
  example: true,
})
@ApiResponse({
  status: 200,
  description: 'List of available global profiles',
  schema: {
    example: [
      {
        id: '00000000-0000-0000-0000-000000000001',
        language_code: 'en',
        language_name: 'English',
        voice_id: 'cartesia-voice-id',
        display_name: 'English - Professional',
        description: 'Professional English voice',
        default_greeting: 'Hello, thank you for calling {business_name}!',
        default_instructions: 'You are a professional assistant...',
        is_active: true,
        display_order: 1,
      },
    ],
  },
})
@ApiResponse({ status: 401, description: 'Unauthorized' })
@ApiResponse({ status: 403, description: 'Insufficient role' })
async listAvailableProfiles(
  @Query('active_only', new ParseBoolPipe({ optional: true }))
  activeOnly?: boolean,
) {
  return this.voiceAgentProfilesService.listAvailableGlobalProfiles(
    activeOnly ?? true,
  );
}

// ─── NEW: Create Override ───────────────────────────────────────────────────
/**
 * POST /api/v1/voice-ai/agent-profile-overrides
 *
 * Creates a tenant override for a global voice agent profile.
 * Allows customization of greeting/instructions per tenant.
 * Subject to plan limits.
 */
@Post('agent-profile-overrides')
@Roles('Owner', 'Admin')
@ApiOperation({
  summary: 'Create tenant override for a global profile',
  description:
    'Creates an override allowing you to customize a global profile. ' +
    'Subject to plan limits (subscription_plan.voice_ai_max_agent_profiles). ' +
    'Cannot create duplicate override for the same global profile.',
})
@ApiResponse({
  status: 201,
  description: 'Override created successfully',
  schema: {
    example: {
      id: 'override-uuid',
      tenant_id: 'tenant-uuid',
      agent_profile_id: '00000000-0000-0000-0000-000000000001',
      custom_greeting: 'Welcome to our business!',
      custom_instructions: 'Be extra friendly...',
      is_active: true,
      created_at: '2026-03-04T12:00:00.000Z',
      agent_profile: {
        id: '00000000-0000-0000-0000-000000000001',
        display_name: 'English - Professional',
        language_name: 'English',
        default_greeting: 'Hello...',
      },
    },
  },
})
@ApiResponse({ status: 400, description: 'Invalid input / Global profile inactive' })
@ApiResponse({ status: 403, description: 'Plan limit reached' })
@ApiResponse({ status: 404, description: 'Global profile not found' })
@ApiResponse({ status: 409, description: 'Override already exists for this profile' })
async createOverride(
  @Request() req: { user: { tenant_id: string; id: string } },
  @Body() dto: CreateAgentProfileOverrideDto,
) {
  return this.voiceAgentProfilesService.createOverride(
    req.user.tenant_id,
    dto,
    req.user.id,
  );
}

// ─── NEW: List Tenant Overrides ────────────────────────────────────────────
/**
 * GET /api/v1/voice-ai/agent-profile-overrides
 *
 * Lists all tenant's overrides with global profile details.
 */
@Get('agent-profile-overrides')
@Roles('Owner', 'Admin', 'Manager')
@ApiOperation({
  summary: 'List tenant overrides',
  description:
    'Returns all overrides for authenticated tenant with global profile details. ' +
    'Shows which global profiles you have customized.',
})
@ApiQuery({
  name: 'active_only',
  required: false,
  type: Boolean,
  description: 'If true, returns only is_active=true overrides',
  example: false,
})
@ApiResponse({
  status: 200,
  description: 'List of tenant overrides',
})
async listOverrides(
  @Request() req: { user: { tenant_id: string } },
  @Query('active_only', new ParseBoolPipe({ optional: true }))
  activeOnly?: boolean,
) {
  return this.voiceAgentProfilesService.listOverrides(
    req.user.tenant_id,
    activeOnly || false,
  );
}

// ─── NEW: Get Single Override ───────────────────────────────────────────────
/**
 * GET /api/v1/voice-ai/agent-profile-overrides/:id
 */
@Get('agent-profile-overrides/:id')
@Roles('Owner', 'Admin', 'Manager')
@ApiOperation({
  summary: 'Get a single tenant override',
  description: 'Returns details of a specific override with global profile details.',
})
@ApiParam({
  name: 'id',
  description: 'Override UUID',
  example: 'override-uuid',
})
@ApiResponse({ status: 200, description: 'Override details' })
@ApiResponse({ status: 404, description: 'Override not found or different tenant' })
async findOverride(
  @Request() req: { user: { tenant_id: string } },
  @Param('id') id: string,
) {
  return this.voiceAgentProfilesService.findOverride(req.user.tenant_id, id);
}

// ─── NEW: Update Override ───────────────────────────────────────────────────
/**
 * PATCH /api/v1/voice-ai/agent-profile-overrides/:id
 */
@Patch('agent-profile-overrides/:id')
@Roles('Owner', 'Admin')
@ApiOperation({
  summary: 'Update a tenant override',
  description:
    'Updates override fields (custom_greeting, custom_instructions, is_active). ' +
    'Cannot change agent_profile_id (immutable).',
})
@ApiParam({
  name: 'id',
  description: 'Override UUID',
  example: 'override-uuid',
})
@ApiResponse({ status: 200, description: 'Override updated successfully' })
@ApiResponse({ status: 404, description: 'Override not found' })
async updateOverride(
  @Request() req: { user: { tenant_id: string; id: string } },
  @Param('id') id: string,
  @Body() dto: UpdateAgentProfileOverrideDto,
) {
  return this.voiceAgentProfilesService.updateOverride(
    req.user.tenant_id,
    id,
    dto,
    req.user.id,
  );
}

// ─── NEW: Delete Override ───────────────────────────────────────────────────
/**
 * DELETE /api/v1/voice-ai/agent-profile-overrides/:id
 */
@Delete('agent-profile-overrides/:id')
@Roles('Owner', 'Admin')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({
  summary: 'Delete a tenant override',
  description:
    'Deletes an override. Clears default_agent_profile_id if this is the default.',
})
@ApiParam({
  name: 'id',
  description: 'Override UUID',
  example: 'override-uuid',
})
@ApiResponse({ status: 204, description: 'Override deleted successfully' })
@ApiResponse({ status: 404, description: 'Override not found' })
async deleteOverride(
  @Request() req: { user: { tenant_id: string } },
  @Param('id') id: string,
) {
  await this.voiceAgentProfilesService.deleteOverride(req.user.tenant_id, id);
}
```

**KEEP old endpoints** (mark as deprecated):
```typescript
// Mark old endpoints with @ApiOperation({ deprecated: true })
// This maintains backward compatibility during transition
```

---

## Task 5: Test All Endpoints

### 5.1 Test New Override Endpoints

**Get tenant JWT token**:
```bash
TENANT_TOKEN="your-tenant-jwt-token-here"
```

**Test: List Available Global Profiles** (read-only):
```bash
curl -X GET https://api.lead360.app/api/v1/voice-ai/available-profiles?active_only=true \
  -H "Authorization: Bearer $TENANT_TOKEN"
```

**Expected**: 200 OK with array of global profiles

**Test: Create Override**:
```bash
curl -X POST https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_profile_id": "00000000-0000-0000-0000-000000000001",
    "custom_greeting": "Welcome to our plumbing business!",
    "custom_instructions": "Mention our 24/7 emergency service.",
    "is_active": true
  }'
```

**Expected**: 201 Created with override details

**Test: List Tenant Overrides**:
```bash
curl -X GET https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides \
  -H "Authorization: Bearer $TENANT_TOKEN"
```

**Expected**: 200 OK with array of overrides (includes global profile details)

**Test: Update Override**:
```bash
curl -X PATCH https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides/{override-id} \
  -H "Authorization: Bearer $TENANT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "custom_greeting": "Updated greeting!"
  }'
```

**Expected**: 200 OK with updated override

**Test: Delete Override**:
```bash
curl -X DELETE https://api.lead360.app/api/v1/voice-ai/agent-profile-overrides/{override-id} \
  -H "Authorization: Bearer $TENANT_TOKEN"
```

**Expected**: 204 No Content

### 5.2 Test Plan Limit Enforcement

**Create overrides until limit reached**:
```bash
# If plan limit is 1, second override should fail with 403
```

**Expected**: 403 Forbidden with clear error message about plan limit

---

## Acceptance Criteria

- [ ] New DTOs created: `CreateAgentProfileOverrideDto`, `UpdateAgentProfileOverrideDto`
- [ ] Service methods added: `listAvailableGlobalProfiles`, `createOverride`, `listOverrides`, `findOverride`, `updateOverride`, `deleteOverride`
- [ ] Controller endpoints added: 6 new override endpoints
- [ ] Plan limit validation working (403 when limit exceeded)
- [ ] All new endpoints tested with curl
- [ ] Swagger documentation updated (all new endpoints visible)
- [ ] Tenant isolation verified (tenant A cannot access tenant B's overrides)
- [ ] Old endpoints still working (backward compatibility)
- [ ] No TypeScript/lint errors

---

## Next Sprint

**Sprint 18**: Context Builder + IVR Update - Merge global profiles with tenant overrides

---

**Sprint Status**: Ready to Execute
