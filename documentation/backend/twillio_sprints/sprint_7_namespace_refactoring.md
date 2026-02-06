# Sprint 7: Endpoint Namespace Refactoring & Route Conflict Prevention

**Duration**: Week 8
**Goal**: Refactor all Twilio endpoints to use consistent namespacing and prevent route conflicts
**Sprint Type**: Code Refactoring & API Consistency
**Estimated Effort**: 2-3 days
**Dependencies**: Sprint 2, 3, 4, 5 completed

---

## Overview

This sprint refactors all Twilio-related endpoints to use consistent provider namespacing (`/api/v1/communication/twilio/*`) and reviews endpoint ordering to prevent route conflicts. This ensures the API is scalable for future providers (Vonage, Bandwidth, etc.) and prevents issues where dynamic routes (`:id`) catch requests meant for static routes.

**Why This Sprint is Critical**:
- **Multi-Provider Support**: Proper namespacing allows adding Vonage, Bandwidth, etc. without conflicts
- **Route Conflicts**: Dynamic routes like `/communication/call/:id` can catch `/communication/call-history`
- **API Consistency**: All Twilio features grouped under `/twilio/` namespace
- **Frontend Clarity**: Clear provider boundaries for API integration

---

## Current vs. Target Endpoint Structure

### **Sprint 2 Endpoints (SMS/WhatsApp Config)**

**Current (Inconsistent)**:
```
POST   /api/v1/communication/sms-config
GET    /api/v1/communication/sms-config
PATCH  /api/v1/communication/sms-config/:id
DELETE /api/v1/communication/sms-config/:id
POST   /api/v1/communication/sms-config/:id/test

POST   /api/v1/communication/whatsapp-config
GET    /api/v1/communication/whatsapp-config
PATCH  /api/v1/communication/whatsapp-config/:id
DELETE /api/v1/communication/whatsapp-config/:id
POST   /api/v1/communication/whatsapp-config/:id/test

GET    /api/v1/communication/twilio/webhook-urls  ✅ Already namespaced
```

**Target (Consistent)**:
```
POST   /api/v1/communication/twilio/sms-config
GET    /api/v1/communication/twilio/sms-config
PATCH  /api/v1/communication/twilio/sms-config/:id
DELETE /api/v1/communication/twilio/sms-config/:id
POST   /api/v1/communication/twilio/sms-config/:id/test

POST   /api/v1/communication/twilio/whatsapp-config
GET    /api/v1/communication/twilio/whatsapp-config
PATCH  /api/v1/communication/twilio/whatsapp-config/:id
DELETE /api/v1/communication/twilio/whatsapp-config/:id
POST   /api/v1/communication/twilio/whatsapp-config/:id/test

GET    /api/v1/communication/twilio/webhook-urls  ✅ No change
```

---

### **Sprint 3 Endpoints (Call Management)**

**Current (Inconsistent)**:
```
POST   /api/v1/communication/call/initiate
GET    /api/v1/communication/call/:id
GET    /api/v1/communication/call/:id/recording
GET    /api/v1/communication/call/:id/recording/download
GET    /api/v1/communication/call-history
```

**Target (Consistent)**:
```
POST   /api/v1/communication/twilio/calls/initiate
GET    /api/v1/communication/twilio/calls/:id
GET    /api/v1/communication/twilio/calls/:id/recording
GET    /api/v1/communication/twilio/calls/:id/recording/download
GET    /api/v1/communication/twilio/call-history
```

**Route Conflict Fix**: Changed `/call/:id` to `/calls/:id` to prevent collision with `/call-history`

---

### **Sprint 4 Endpoints (IVR & Office Bypass)**

**Current (Inconsistent)**:
```
POST   /api/v1/communication/ivr
GET    /api/v1/communication/ivr
DELETE /api/v1/communication/ivr

POST   /api/v1/communication/office-whitelist
GET    /api/v1/communication/office-whitelist
DELETE /api/v1/communication/office-whitelist/:id
```

**Target (Consistent)**:
```
POST   /api/v1/communication/twilio/ivr
GET    /api/v1/communication/twilio/ivr
DELETE /api/v1/communication/twilio/ivr

POST   /api/v1/communication/twilio/office-whitelist
GET    /api/v1/communication/twilio/office-whitelist
DELETE /api/v1/communication/twilio/office-whitelist/:id
```

---

### **Sprint 5 Endpoints (Public Webhooks)**

**Current (Correct - No Changes)**:
```
POST   /api/twilio/sms/inbound          ✅ Correct (public, no auth)
POST   /api/twilio/sms/status           ✅ Correct
POST   /api/twilio/call/inbound         ✅ Correct
POST   /api/twilio/call/status          ✅ Correct
POST   /api/twilio/recording/ready      ✅ Correct
POST   /api/twilio/whatsapp/inbound     ✅ Correct
```

**No changes needed** - these are public webhook handlers called BY Twilio, not tenant-facing authenticated endpoints.

---

## Route Conflict Analysis

### **Potential Conflicts Identified**

1. **`/call/:id` vs. `/call-history`**
   - **Problem**: `/call/:id` catches requests to `/call-history` if registered first
   - **Solution**: Rename to `/calls/:id` (plural) and register static routes first

2. **`/sms-config/:id` vs. `/sms-config/:id/test`**
   - **Problem**: If `:id/test` isn't explicit, `:id` catches everything
   - **Solution**: Register nested routes (`:id/test`) before dynamic routes (`:id`)

3. **`/twilio/ivr` vs. `/twilio/ivr/:id`**
   - **Problem**: Future expansion may add `GET /ivr/:id`
   - **Solution**: Ensure static routes registered before parameterized routes

### **Route Registration Order (Critical)**

NestJS registers routes in controller definition order. **Static routes MUST come before dynamic routes**:

```typescript
// ✅ CORRECT ORDER
@Get('call-history')        // Static route first
@Get('calls/:id')           // Dynamic route second

// ❌ WRONG ORDER
@Get('calls/:id')           // Dynamic catches everything!
@Get('call-history')        // Never reached
```

---

## Task Breakdown

### Task 7.1: Update Sprint 2 Controllers (SMS/WhatsApp Config)

**File**: `/api/src/modules/communication/controllers/tenant-sms-config.controller.ts`

**Changes**:

```typescript
// BEFORE
@Controller('api/v1/communication/sms-config')
export class TenantSmsConfigController {
  // endpoints...
}

// AFTER
@Controller('api/v1/communication/twilio/sms-config')
export class TenantSmsConfigController {
  // Same endpoints, but now under /twilio/ namespace
}
```

**File**: `/api/src/modules/communication/controllers/tenant-whatsapp-config.controller.ts`

```typescript
// BEFORE
@Controller('api/v1/communication/whatsapp-config')
export class TenantWhatsAppConfigController {
  // endpoints...
}

// AFTER
@Controller('api/v1/communication/twilio/whatsapp-config')
export class TenantWhatsAppConfigController {
  // Same endpoints, but now under /twilio/ namespace
}
```

**No other code changes needed** - service logic remains identical.

---

### Task 7.2: Update Sprint 3 Controller (Call Management)

**File**: `/api/src/modules/communication/controllers/call-management.controller.ts`

**Changes**:

```typescript
// BEFORE
@Controller('api/v1/communication/call')
export class CallManagementController {
  @Post('initiate')
  async initiateCall() { }

  @Get(':id')
  async getCallDetails() { }

  @Get(':id/recording')
  async getRecording() { }

  @Get(':id/recording/download')
  async downloadRecording() { }
}

// Separate endpoint for history
@Get('call-history')  // Route conflict! This gets caught by ':id'
async getCallHistory() { }


// AFTER (Fixed)
@Controller('api/v1/communication/twilio')
export class CallManagementController {
  // Static routes FIRST (critical for route resolution)
  @Get('call-history')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Get paginated call history' })
  async getCallHistory(@Request() req, @Query() query: CallHistoryQueryDto) {
    return this.callService.getCallHistory(req.user.tenant_id, query);
  }

  // Dynamic routes SECOND
  @Post('calls/initiate')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Initiate outbound call to lead' })
  async initiateCall(@Request() req, @Body() dto: InitiateCallDto) {
    return this.callService.initiateOutboundCall(req.user.tenant_id, req.user.id, dto);
  }

  @Get('calls/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Get call details by ID' })
  async getCallDetails(@Request() req, @Param('id') callId: string) {
    return this.callService.getCallById(req.user.tenant_id, callId);
  }

  @Get('calls/:id/recording')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Get signed URL for call recording playback' })
  async getRecording(@Request() req, @Param('id') callId: string) {
    return this.callService.getRecordingUrl(req.user.tenant_id, callId);
  }

  @Get('calls/:id/recording/download')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Download call recording file' })
  async downloadRecording(@Request() req, @Param('id') callId: string, @Res() res: Response) {
    return this.callService.downloadRecording(req.user.tenant_id, callId, res);
  }
}
```

**Key Changes**:
1. Controller base path: `/communication/call` → `/communication/twilio`
2. Renamed `/call/:id` → `/calls/:id` (plural)
3. Moved `/call-history` to same controller
4. **Static route (`call-history`) registered BEFORE dynamic routes (`calls/:id`)**

---

### Task 7.3: Update Sprint 4 Controllers (IVR & Office Bypass)

**File**: `/api/src/modules/communication/controllers/ivr-configuration.controller.ts`

```typescript
// BEFORE
@Controller('api/v1/communication/ivr')
export class IvrConfigurationController {
  // endpoints...
}

// AFTER
@Controller('api/v1/communication/twilio/ivr')
export class IvrConfigurationController {
  // Same endpoints, but now under /twilio/ namespace
}
```

**File**: `/api/src/modules/communication/controllers/office-bypass.controller.ts`

```typescript
// BEFORE
@Controller('api/v1/communication/office-whitelist')
export class OfficeBypassController {
  // endpoints...
}

// AFTER
@Controller('api/v1/communication/twilio/office-whitelist')
export class OfficeBypassController {
  // Same endpoints, but now under /twilio/ namespace
}
```

---

### Task 7.4: Update Sprint 6 API Documentation

**File**: `/api/documentation/twilio_REST_API.md`

**Updates Required**:
1. Update ALL endpoint paths to include `/twilio/` namespace
2. Update example curl commands
3. Update Swagger tags (already should say "Communication - Twilio ...")
4. Add note about provider namespacing strategy

**Add Section**:

```markdown
## API Endpoint Structure

All Twilio-related endpoints are namespaced under `/api/v1/communication/twilio/` for clear provider separation.

### Namespace Pattern
```
/api/v1/communication/twilio/sms-config        (Twilio SMS configuration)
/api/v1/communication/twilio/whatsapp-config   (Twilio WhatsApp configuration)
/api/v1/communication/twilio/calls             (Twilio call management)
/api/v1/communication/twilio/ivr               (Twilio IVR configuration)
/api/v1/communication/twilio/office-whitelist  (Twilio office bypass)
/api/v1/communication/twilio/webhook-urls      (Twilio webhook helper)
```

### Future Provider Support
When adding new providers (e.g., Vonage, Bandwidth), follow the same pattern:
```
/api/v1/communication/vonage/sms-config
/api/v1/communication/bandwidth/calls
```

### Public Webhooks (No Namespace)
Public webhook handlers called BY providers use a different pattern:
```
/api/twilio/sms/inbound        (Called by Twilio)
/api/twilio/call/inbound       (Called by Twilio)
```
```

**Update Every Endpoint Documentation**:
- Find/Replace: `/api/v1/communication/sms-config` → `/api/v1/communication/twilio/sms-config`
- Find/Replace: `/api/v1/communication/whatsapp-config` → `/api/v1/communication/twilio/whatsapp-config`
- Find/Replace: `/api/v1/communication/call/` → `/api/v1/communication/twilio/calls/`
- Find/Replace: `/api/v1/communication/call-history` → `/api/v1/communication/twilio/call-history`
- Find/Replace: `/api/v1/communication/ivr` → `/api/v1/communication/twilio/ivr`
- Find/Replace: `/api/v1/communication/office-whitelist` → `/api/v1/communication/twilio/office-whitelist`

---

### Task 7.5: Update All Sprint Files (2, 3, 4)

**Files to Update**:
- `/api/documentation/backend/twillio_sprints/sprint_2_sms_whatsapp_config.md`
- `/api/documentation/backend/twillio_sprints/sprint_3_call_management.md`
- `/api/documentation/backend/twillio_sprints/sprint_4_ivr_office_bypass.md`

**Changes**:
1. Update controller `@Controller()` decorator paths in code examples
2. Update verification curl commands
3. Update acceptance criteria with new paths
4. Add note: "See Sprint 7 for namespace refactoring details"

---

### Task 7.6: Update Swagger Tags

**All Controllers Should Use Consistent Tags**:

```typescript
// Sprint 2
@ApiTags('Communication - Twilio SMS')
export class TenantSmsConfigController {}

@ApiTags('Communication - Twilio WhatsApp')
export class TenantWhatsAppConfigController {}

@ApiTags('Communication - Twilio Configuration')
export class TwilioConfigController {}

// Sprint 3
@ApiTags('Communication - Twilio Calls')
export class CallManagementController {}

// Sprint 4
@ApiTags('Communication - Twilio IVR')
export class IvrConfigurationController {}

@ApiTags('Communication - Twilio Office Bypass')
export class OfficeBypassController {}

// Sprint 5 (Public Webhooks)
@ApiTags('Communication - Twilio Webhooks (Public)')
export class TwilioWebhooksController {}
```

---

### Task 7.7: Update Integration Tests

**Files to Update**:
- `/api/src/modules/communication/controllers/tenant-sms-config.controller.spec.ts`
- `/api/src/modules/communication/controllers/tenant-whatsapp-config.controller.spec.ts`
- `/api/src/modules/communication/controllers/call-management.controller.spec.ts`
- `/api/src/modules/communication/controllers/ivr-configuration.controller.spec.ts`
- `/api/src/modules/communication/controllers/office-bypass.controller.spec.ts`

**Update Request Paths**:

```typescript
// BEFORE
it('should create SMS config', async () => {
  return request(app.getHttpServer())
    .post('/api/v1/communication/sms-config')
    .send(createDto)
    .expect(201);
});

// AFTER
it('should create SMS config', async () => {
  return request(app.getHttpServer())
    .post('/api/v1/communication/twilio/sms-config')
    .send(createDto)
    .expect(201);
});
```

**Apply to all test files** - update every request path.

---

### Task 7.8: Verify Route Registration Order

**File**: `/api/src/modules/communication/communication.module.ts`

**Controller Registration Order** (doesn't matter for different controllers, but document for clarity):

```typescript
@Module({
  controllers: [
    // Existing non-Twilio controllers
    SendEmailController,
    NotificationsController,

    // Twilio controllers (grouped together)
    TwilioConfigController,           // /twilio/webhook-urls
    TenantSmsConfigController,        // /twilio/sms-config
    TenantWhatsAppConfigController,   // /twilio/whatsapp-config
    CallManagementController,         // /twilio/calls, /twilio/call-history
    IvrConfigurationController,       // /twilio/ivr
    OfficeBypassController,           // /twilio/office-whitelist

    // Public webhooks (no auth)
    TwilioWebhooksController,         // /api/twilio/* (public)
  ],
})
export class CommunicationModule {}
```

**Within Each Controller**: Ensure static routes before dynamic routes (done in Task 7.2).

---

## Acceptance Criteria

### Route Namespacing
- [ ] All SMS config endpoints under `/api/v1/communication/twilio/sms-config`
- [ ] All WhatsApp config endpoints under `/api/v1/communication/twilio/whatsapp-config`
- [ ] All call management endpoints under `/api/v1/communication/twilio/calls` or `/twilio/call-history`
- [ ] All IVR endpoints under `/api/v1/communication/twilio/ivr`
- [ ] All office bypass endpoints under `/api/v1/communication/twilio/office-whitelist`
- [ ] Webhook URL helper remains at `/api/v1/communication/twilio/webhook-urls`
- [ ] Public webhooks remain at `/api/twilio/*` (no changes)

### Route Conflict Prevention
- [ ] Static route `/call-history` registered before dynamic `/calls/:id`
- [ ] Renamed `/call/:id` to `/calls/:id` to avoid collision
- [ ] All nested routes (`:id/test`, `:id/recording`) registered before parent dynamic routes
- [ ] Manual testing confirms no 404 errors on static routes

### Documentation Updates
- [ ] API documentation (`twilio_REST_API.md`) updated with new paths
- [ ] All curl examples use new paths
- [ ] Sprint 2, 3, 4 files updated with namespace notes
- [ ] Namespace strategy documented in API docs

### Code Updates
- [ ] All controller `@Controller()` paths updated
- [ ] All Swagger `@ApiTags()` use consistent naming
- [ ] Integration test paths updated
- [ ] No breaking changes to service logic (controllers only)

### Testing
- [ ] All integration tests pass with new paths
- [ ] Manual API testing confirms all endpoints reachable
- [ ] Postman collection updated (if exists)
- [ ] Frontend team notified of endpoint path changes

---

## Verification Steps

### 1. Test All Endpoints Manually

```bash
# SMS Config
curl -X POST "http://localhost:3000/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"provider_id":"...","account_sid":"AC...","auth_token":"...","from_phone":"+1..."}'

curl -X GET "http://localhost:3000/api/v1/communication/twilio/sms-config" \
  -H "Authorization: Bearer {token}"

# WhatsApp Config
curl -X POST "http://localhost:3000/api/v1/communication/twilio/whatsapp-config" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"provider_id":"...","account_sid":"AC...","auth_token":"...","from_phone":"+1..."}'

# Webhook URLs
curl -X GET "http://localhost:3000/api/v1/communication/twilio/webhook-urls" \
  -H "Authorization: Bearer {token}"

# Call History (STATIC ROUTE - Test this catches correctly)
curl -X GET "http://localhost:3000/api/v1/communication/twilio/call-history?page=1&limit=10" \
  -H "Authorization: Bearer {token}"

# Initiate Call
curl -X POST "http://localhost:3000/api/v1/communication/twilio/calls/initiate" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"lead_id":"...","notes":"..."}'

# Get Call Details (DYNAMIC ROUTE - Should not catch call-history)
curl -X GET "http://localhost:3000/api/v1/communication/twilio/calls/{call_id}" \
  -H "Authorization: Bearer {token}"

# IVR Config
curl -X POST "http://localhost:3000/api/v1/communication/twilio/ivr" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"greeting":"...","menu_options":[...]}'

curl -X GET "http://localhost:3000/api/v1/communication/twilio/ivr" \
  -H "Authorization: Bearer {token}"

# Office Whitelist
curl -X POST "http://localhost:3000/api/v1/communication/twilio/office-whitelist" \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"phone_number":"+1...","description":"..."}'

curl -X GET "http://localhost:3000/api/v1/communication/twilio/office-whitelist" \
  -H "Authorization: Bearer {token}"
```

**Expected**: All return 200/201, no 404 errors, no route conflicts.

---

### 2. Verify Route Conflict Prevention

```bash
# This should return call history list, NOT "Call ID not found" error
curl -X GET "http://localhost:3000/api/v1/communication/twilio/call-history" \
  -H "Authorization: Bearer {token}"

# This should return specific call details
curl -X GET "http://localhost:3000/api/v1/communication/twilio/calls/abc-123-def-456" \
  -H "Authorization: Bearer {token}"
```

**Expected**: Both work correctly without conflicts.

---

### 3. Run Integration Tests

```bash
cd /var/www/lead360.app/api

# Run all communication module tests
npm test -- --testPathPattern=communication

# Expected: All tests pass
```

---

### 4. Verify Swagger Documentation

```bash
# Access Swagger UI
open http://localhost:3000/api/docs

# Verify:
# - All endpoints grouped under "Communication - Twilio *" tags
# - All paths show /api/v1/communication/twilio/*
# - No duplicate routes
# - Try out sample requests from Swagger UI
```

---

### 5. Check for Breaking Changes

**Frontend Impact**:
```typescript
// OLD API CALLS (Will break after Sprint 7)
fetch('/api/v1/communication/sms-config')
fetch('/api/v1/communication/call/123')
fetch('/api/v1/communication/ivr')

// NEW API CALLS (Required after Sprint 7)
fetch('/api/v1/communication/twilio/sms-config')
fetch('/api/v1/communication/twilio/calls/123')
fetch('/api/v1/communication/twilio/ivr')
```

**Communication Required**:
- [ ] Notify frontend team of endpoint changes
- [ ] Provide migration guide with old → new mappings
- [ ] Coordinate deployment (backend first, then frontend)

---

## Files Modified

**Controllers**:
- `/api/src/modules/communication/controllers/tenant-sms-config.controller.ts`
- `/api/src/modules/communication/controllers/tenant-whatsapp-config.controller.ts`
- `/api/src/modules/communication/controllers/call-management.controller.ts`
- `/api/src/modules/communication/controllers/ivr-configuration.controller.ts`
- `/api/src/modules/communication/controllers/office-bypass.controller.ts`

**Documentation**:
- `/api/documentation/twilio_REST_API.md`
- `/api/documentation/backend/twillio_sprints/sprint_2_sms_whatsapp_config.md`
- `/api/documentation/backend/twillio_sprints/sprint_3_call_management.md`
- `/api/documentation/backend/twillio_sprints/sprint_4_ivr_office_bypass.md`

**Tests**:
- `/api/src/modules/communication/controllers/*.spec.ts` (all controller tests)

**No Changes Required**:
- Services (business logic unchanged)
- DTOs (data structures unchanged)
- Database schema (no migration needed)
- Public webhook endpoints (already correct)

---

## Migration Guide for Frontend

**Endpoint Mapping Table**:

| Old Path | New Path | Notes |
|----------|----------|-------|
| `/api/v1/communication/sms-config` | `/api/v1/communication/twilio/sms-config` | SMS configuration |
| `/api/v1/communication/whatsapp-config` | `/api/v1/communication/twilio/whatsapp-config` | WhatsApp configuration |
| `/api/v1/communication/call/initiate` | `/api/v1/communication/twilio/calls/initiate` | Initiate call |
| `/api/v1/communication/call/:id` | `/api/v1/communication/twilio/calls/:id` | Get call details (note: plural) |
| `/api/v1/communication/call-history` | `/api/v1/communication/twilio/call-history` | Call history |
| `/api/v1/communication/ivr` | `/api/v1/communication/twilio/ivr` | IVR configuration |
| `/api/v1/communication/office-whitelist` | `/api/v1/communication/twilio/office-whitelist` | Office bypass |
| `/api/v1/communication/twilio/webhook-urls` | *(no change)* | Already correct |

**Frontend Migration Steps**:
1. Update API client base paths
2. Update all API call paths
3. Update tests
4. Coordinate deployment with backend

---

## Risk Assessment

### Low Risk
- **No Service Logic Changes**: Only controller paths changed
- **No Database Changes**: No migrations needed
- **No Breaking Changes to Webhooks**: Public webhooks unchanged

### Medium Risk
- **Frontend Coordination**: Frontend must update API paths
- **Route Testing**: Must thoroughly test for conflicts

### Mitigation
- **Comprehensive Testing**: Manual + automated tests
- **Documentation**: Clear migration guide for frontend
- **Phased Deployment**: Backend first (with warnings), then frontend
- **Rollback Plan**: Git revert if issues found

---

## Success Criteria

- [ ] All endpoints accessible under `/twilio/` namespace
- [ ] No route conflicts (static vs dynamic routes)
- [ ] All tests pass
- [ ] Swagger documentation accurate
- [ ] Frontend team has migration guide
- [ ] API documentation updated (100% accuracy)
- [ ] No breaking changes to public webhooks
- [ ] Clean git diff (only controller paths changed, no logic changes)

---

## Next Steps

After Sprint 7 completion:
- ✅ Consistent Twilio endpoint namespacing
- ✅ Route conflicts prevented
- ✅ API ready for multi-provider support
- ➡️ Proceed to **Sprint 8: Admin Control Panel** (Critical for contract)

---

**Sprint 7 Complete**: All Twilio endpoints use consistent provider namespacing and route conflicts are prevented.
