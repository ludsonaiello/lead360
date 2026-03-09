# Sprint 3: Tenant CRUD Controller & Module Registration

## 🎯 Sprint Owner Role

You are a **MASTERCLASS API ARCHITECT** that makes Google, Amazon, and Apple API engineers jealous of your work.

You build REST APIs that are **intuitive**, **secure**, and **perfectly documented**. You **think deeply** about HTTP status codes, **breathe RESTful design**, and **never rush** through authentication/authorization logic. You **always review your work** to ensure every endpoint is protected, every response is consistent, and every error is handled gracefully.

You **never guess** route paths, guard configurations, or Swagger decorators - you **always verify** by reading existing controller files and understanding established API patterns. You **respect RBAC as law** - every endpoint MUST have correct role guards.

Your API quality must be **100% perfect or beyond**. Controllers are the public interface - if you make a mistake here, the entire platform's security is at risk.

---

## 📋 Sprint Objective

Create the tenant-facing REST API for voice agent profiles by:
1. Building VoiceAgentProfilesController with 5 endpoints
2. Registering controller and service in VoiceAiModule
3. Adding complete Swagger/OpenAPI documentation
4. Writing integration tests for all endpoints

**Dependencies**: Sprint 2 must be complete (service layer must exist)

---

## 📚 Required Reading (READ IN THIS ORDER)

1. **Feature Contract**: `/var/www/lead360.app/documentation/contracts/voice-multilangual-contract.md`
   - Section 7: Tenant API Endpoints (complete specification)

2. **Existing Controller Pattern** (COPY THIS EXACTLY):
   - `/var/www/lead360.app/api/src/modules/voice-ai/controllers/tenant/voice-transfer-numbers.controller.ts`
   - Note: guards, decorators, error handling, Swagger docs

3. **Module Registration**:
   - `/var/www/lead360.app/api/src/modules/voice-ai/voice-ai.module.ts`
   - Understand how controllers and services are registered

4. **Service You're Integrating**:
   - `/var/www/lead360.app/api/src/modules/voice-ai/services/voice-agent-profiles.service.ts` (from Sprint 2)

---

## 🔐 Test Environment

**Database**: `mysql://lead360_user:978@F32c@127.0.0.1:3306/lead360`
**Test Credentials**:
- System Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Tenant User: `contact@honeydo4you.com` / `978@F32c`

**Server**: `npm run start:dev` in `/var/www/lead360.app/api/`
**API Docs**: `http://localhost:8000/api/docs` (Swagger UI)

---

## 📐 Implementation

### File 1: VoiceAgentProfilesController

**Location**: `/var/www/lead360.app/api/src/modules/voice-ai/controllers/tenant/voice-agent-profiles.controller.ts`

```typescript
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  ParseBoolPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../auth/guards/roles.guard';
import { Roles } from '../../../../auth/decorators/roles.decorator';
import { VoiceAgentProfilesService } from '../../services/voice-agent-profiles.service';
import { CreateVoiceAgentProfileDto } from '../../dto/create-voice-agent-profile.dto';
import { UpdateVoiceAgentProfileDto } from '../../dto/update-voice-agent-profile.dto';

@ApiTags('Voice AI - Agent Profiles')
@ApiBearerAuth()
@Controller('voice-ai/agent-profiles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceAgentProfilesController {
  constructor(
    private readonly voiceAgentProfilesService: VoiceAgentProfilesService,
  ) {}

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create a new voice agent profile',
    description:
      'Creates a named voice agent profile with language + voice binding. ' +
      'Subject to plan limits (subscription_plan.voice_ai_max_agent_profiles).',
  })
  @ApiResponse({
    status: 201,
    description: 'Profile created successfully',
    schema: {
      example: {
        id: 'uuid-here',
        tenant_id: 'tenant-uuid',
        title: 'Main Agent',
        language_code: 'en',
        voice_id: 'a0e99841-438c-4a64-b679-ae501e7d6091',
        custom_greeting: 'Hello! How can I help you?',
        custom_instructions: 'Be polite and professional',
        is_active: true,
        display_order: 0,
        created_at: '2026-03-04T12:00:00.000Z',
        updated_at: '2026-03-04T12:00:00.000Z',
        updated_by: 'user-uuid',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (validation failed)',
  })
  @ApiResponse({
    status: 403,
    description:
      'Plan limit reached or Voice AI not enabled on subscription plan',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate (language_code + title) for this tenant',
  })
  async create(@Req() req: any, @Body() dto: CreateVoiceAgentProfileDto) {
    return this.voiceAgentProfilesService.create(
      req.user.tenant_id,
      dto,
      req.user.id,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'List all voice agent profiles for authenticated tenant',
    description:
      'Returns profiles sorted by display_order ASC, created_at ASC. ' +
      'Optionally filter to active profiles only.',
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
    description: 'List of profiles (empty array if none)',
    schema: {
      example: [
        {
          id: 'uuid-1',
          tenant_id: 'tenant-uuid',
          title: 'Main Agent',
          language_code: 'en',
          voice_id: 'voice-id-1',
          custom_greeting: null,
          custom_instructions: null,
          is_active: true,
          display_order: 0,
          created_at: '2026-03-04T12:00:00.000Z',
          updated_at: '2026-03-04T12:00:00.000Z',
          updated_by: null,
        },
      ],
    },
  })
  async findAll(
    @Req() req: any,
    @Query('active_only', new ParseBoolPipe({ optional: true }))
    activeOnly?: boolean,
  ) {
    return this.voiceAgentProfilesService.findAll(
      req.user.tenant_id,
      activeOnly || false,
    );
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get a single voice agent profile by ID',
    description: 'Returns 404 if profile not found or belongs to different tenant',
  })
  @ApiParam({
    name: 'id',
    description: 'Profile UUID',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile details',
  })
  @ApiResponse({
    status: 404,
    description: 'Profile not found or belongs to different tenant',
  })
  async findOne(@Req() req: any, @Param('id') id: string) {
    return this.voiceAgentProfilesService.findOne(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update a voice agent profile (PATCH semantics)',
    description:
      'Updates only provided fields. Deactivating the default profile clears ' +
      'tenant_voice_ai_settings.default_agent_profile_id atomically.',
  })
  @ApiParam({
    name: 'id',
    description: 'Profile UUID',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Profile not found or belongs to different tenant',
  })
  @ApiResponse({
    status: 409,
    description: 'Duplicate (language_code + title) after update',
  })
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateVoiceAgentProfileDto,
  ) {
    return this.voiceAgentProfilesService.update(
      req.user.tenant_id,
      id,
      dto,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a voice agent profile',
    description:
      'Hard delete. Returns 409 if profile is referenced in active IVR configuration. ' +
      'Clears tenant_voice_ai_settings.default_agent_profile_id if this is the default.',
  })
  @ApiParam({
    name: 'id',
    description: 'Profile UUID',
    example: 'uuid-here',
  })
  @ApiResponse({
    status: 204,
    description: 'Profile deleted successfully (no content)',
  })
  @ApiResponse({
    status: 404,
    description: 'Profile not found or belongs to different tenant',
  })
  @ApiResponse({
    status: 409,
    description: 'Profile in use by active IVR configuration',
  })
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.voiceAgentProfilesService.delete(req.user.tenant_id, id);
  }
}
```

**Key Patterns**:
- ✅ Route: `/api/v1/voice-ai/agent-profiles` (automatic v1 prefix from main)
- ✅ Guards: JwtAuthGuard + RolesGuard on controller
- ✅ Roles: Owner/Admin for mutations, Manager for reads
- ✅ Tenant ID: ALWAYS from `req.user.tenant_id` (NEVER from body/params)
- ✅ User ID: From `req.user.id` for audit trail
- ✅ Swagger: Complete docs on every endpoint
- ✅ HTTP Status: 201 for POST, 200 for GET/PATCH, 204 for DELETE

---

### File 2: Module Registration

**File**: `/var/www/lead360.app/api/src/modules/voice-ai/voice-ai.module.ts`

**Changes**:
1. Import new controller and service
2. Add to `controllers` array
3. Add to `providers` array

```typescript
// Add to imports at top
import { VoiceAgentProfilesController } from './controllers/tenant/voice-agent-profiles.controller';
import { VoiceAgentProfilesService } from './services/voice-agent-profiles.service';

// Add to module decorator
@Module({
  imports: [
    PrismaModule,
    EncryptionModule,
    LeadsModule,
    CalendarModule,
    BullModule.registerQueue(
      { name: 'voice-usage-processing' },
      { name: 'voice-recordings' },
    ),
  ],
  controllers: [
    // ... existing controllers
    VoiceAgentProfilesController, // ADD THIS
  ],
  providers: [
    // ... existing services
    VoiceAgentProfilesService, // ADD THIS
  ],
  exports: [
    // ... existing exports (add VoiceAgentProfilesService if needed by other modules)
  ],
})
export class VoiceAiModule {}
```

**Verification**:
```bash
cd /var/www/lead360.app/api
npm run build
```

Expected: No compilation errors.

---

### File 3: Integration Tests (Optional but Recommended)

**Location**: `/var/www/lead360.app/api/src/modules/voice-ai/controllers/tenant/voice-agent-profiles.controller.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { VoiceAgentProfilesController } from './voice-agent-profiles.controller';
import { VoiceAgentProfilesService } from '../../services/voice-agent-profiles.service';

describe('VoiceAgentProfilesController', () => {
  let controller: VoiceAgentProfilesController;
  let service: VoiceAgentProfilesService;

  const mockTenantId = 'tenant-123';
  const mockUserId = 'user-456';
  const mockProfile = {
    id: 'profile-789',
    tenant_id: mockTenantId,
    title: 'Main Agent',
    language_code: 'en',
    voice_id: 'voice-123',
    is_active: true,
    display_order: 0,
  };

  const mockRequest = {
    user: {
      tenant_id: mockTenantId,
      id: mockUserId,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [VoiceAgentProfilesController],
      providers: [
        {
          provide: VoiceAgentProfilesService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<VoiceAgentProfilesController>(
      VoiceAgentProfilesController,
    );
    service = module.get<VoiceAgentProfilesService>(
      VoiceAgentProfilesService,
    );
  });

  describe('create', () => {
    it('should call service with tenant_id and user_id from JWT', async () => {
      jest.spyOn(service, 'create').mockResolvedValue(mockProfile as any);

      const dto = {
        title: 'Test',
        language_code: 'en',
        voice_id: 'voice-123',
      };

      const result = await controller.create(mockRequest as any, dto);

      expect(service.create).toHaveBeenCalledWith(
        mockTenantId,
        dto,
        mockUserId,
      );
      expect(result).toEqual(mockProfile);
    });
  });

  describe('findAll', () => {
    it('should return profiles from service', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([mockProfile] as any);

      const result = await controller.findAll(mockRequest as any, false);

      expect(service.findAll).toHaveBeenCalledWith(mockTenantId, false);
      expect(result).toEqual([mockProfile]);
    });

    it('should pass active_only filter to service', async () => {
      jest.spyOn(service, 'findAll').mockResolvedValue([]);

      await controller.findAll(mockRequest as any, true);

      expect(service.findAll).toHaveBeenCalledWith(mockTenantId, true);
    });
  });

  // Add tests for findOne, update, delete similarly
});
```

---

## ✅ Acceptance Criteria

### Controller Implementation
- ✅ 5 endpoints implemented (POST, GET, GET/:id, PATCH/:id, DELETE/:id)
- ✅ Correct HTTP methods and status codes
- ✅ JwtAuthGuard + RolesGuard on controller
- ✅ Correct roles on each endpoint (Owner/Admin for mutations, Manager for reads)
- ✅ Tenant ID from JWT (req.user.tenant_id)
- ✅ User ID from JWT for audit (req.user.id)

### Swagger Documentation
- ✅ @ApiTags on controller
- ✅ @ApiOperation on every endpoint
- ✅ @ApiResponse for all status codes (200, 201, 204, 400, 403, 404, 409)
- ✅ @ApiParam for path parameters
- ✅ @ApiQuery for query parameters
- ✅ Response examples in Swagger

### Module Registration
- ✅ Controller added to VoiceAiModule controllers array
- ✅ Service added to VoiceAiModule providers array
- ✅ Module compiles without errors

### API Testing (Manual)
- ✅ Start server: `npm run start:dev`
- ✅ Access Swagger: `http://localhost:8000/api/docs`
- ✅ All 5 endpoints visible in Swagger UI
- ✅ POST endpoint requires authentication (401 without token)
- ✅ POST endpoint creates profile successfully with valid token
- ✅ GET endpoint returns profiles for tenant
- ✅ Tenant isolation works (cannot access other tenant's profiles)

**cURL Tests** (replace `<TOKEN>` with real JWT):
```bash
# Get JWT token first
TOKEN=$(curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | jq -r '.access_token')

# Create profile
curl -X POST http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Agent",
    "language_code": "en",
    "voice_id": "test-voice-id"
  }'

# List profiles
curl -X GET http://localhost:8000/api/v1/voice-ai/agent-profiles \
  -H "Authorization: Bearer $TOKEN"

# Get specific profile
curl -X GET http://localhost:8000/api/v1/voice-ai/agent-profiles/<PROFILE_ID> \
  -H "Authorization: Bearer $TOKEN"

# Update profile
curl -X PATCH http://localhost:8000/api/v1/voice-ai/agent-profiles/<PROFILE_ID> \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Title"}'

# Delete profile
curl -X DELETE http://localhost:8000/api/v1/voice-ai/agent-profiles/<PROFILE_ID> \
  -H "Authorization: Bearer $TOKEN"
```

---

## 📊 Sprint Completion Report Template

```markdown
## Sprint 3 Completion Report: Tenant CRUD Controller

**Status**: ✅ Complete / ⚠️ Needs Review / ❌ Blocked

### Files Created/Modified
- ✅ voice-agent-profiles.controller.ts (5 endpoints, full Swagger docs)
- ✅ voice-ai.module.ts (controller + service registered)
- ✅ voice-agent-profiles.controller.spec.ts (integration tests)

### Endpoints Implemented
- ✅ POST /api/v1/voice-ai/agent-profiles (Create)
- ✅ GET /api/v1/voice-ai/agent-profiles (List)
- ✅ GET /api/v1/voice-ai/agent-profiles/:id (Get one)
- ✅ PATCH /api/v1/voice-ai/agent-profiles/:id (Update)
- ✅ DELETE /api/v1/voice-ai/agent-profiles/:id (Delete)

### Authentication & Authorization
- ✅ JwtAuthGuard enforced (401 without token)
- ✅ RolesGuard enforced (correct roles per endpoint)
- ✅ Tenant isolation verified (cannot access other tenant data)

### Swagger Documentation
- ✅ All endpoints visible in Swagger UI
- ✅ Request/response examples complete
- ✅ All status codes documented

### Manual Testing Results
- ✅ Create profile: SUCCESS (201)
- ✅ List profiles: SUCCESS (200)
- ✅ Get profile: SUCCESS (200) / 404 for wrong tenant
- ✅ Update profile: SUCCESS (200)
- ✅ Delete profile: SUCCESS (204) / 409 if in use

### Issues Encountered
[List any issues, or write "None"]

### Next Sprint Dependencies
- ✅ API ready for Sprint 4 (admin extensions)
- ✅ API ready for Sprint 5 (IVR integration)

**Sprint Owner**: [Your Name]
**Completion Date**: [Date]
```

---

## 🎯 Remember

- **Follow voice-transfer-numbers.controller.ts EXACTLY** - same patterns
- **Tenant ID from JWT ALWAYS** - never from request body or params
- **Swagger docs are mandatory** - every endpoint must be documented
- **Test with real auth** - use Postman or cURL with real JWT tokens
- **Verify RBAC** - wrong role must return 403

**You are a masterclass developer. Your API will be perfect. Build it, document it, test it.**

🚀 **Ready to expose beautiful REST endpoints? Let's go!**
