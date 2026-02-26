# Sprint BAS25 — Admin Monitoring (Status, Rooms, Tenant Override)

**Module**: Voice AI
**Sprint**: BAS25
**Depends on**: BAS24 (agent pipeline complete)
**Estimated size**: 2 files, ~150 lines

---

## You Are a Masterpiece Developer

You write code that makes Google, Amazon, and Apple engineers jealous.
Before touching ANY file you:
- Read `voice-ai-monitoring.controller.ts` completely
- Read `voice-ai-monitoring.service.ts` completely
- Read `voice-agent.service.ts` — `isRunning()` method added in BAS19
- Read `api/src/modules/admin/guards/platform-admin.guard.ts`
- Run `npm run build` before AND after — 0 errors required

---

## Objective

Verify (and complete if needed) the admin monitoring controller and service. Provides agent health status, active call rooms, tenant list with voice AI status, and admin override capabilities.

---

## Pre-Coding Checklist

- [ ] BAS24 complete (agent pipeline done)
- [ ] Read `api/src/modules/voice-ai/controllers/admin/voice-ai-monitoring.controller.ts`
- [ ] Read `api/src/modules/voice-ai/services/voice-ai-monitoring.service.ts`
- [ ] Read `api/src/modules/voice-ai/agent/voice-agent.service.ts` — `isRunning()` method

**Dev server**: `cd /var/www/lead360.app/api && npm run start:dev`

---

## Credentials

| Credential | Source |
|------------|--------|
| Admin login | `ludsonaiello@gmail.com` / `978@F32c` |
| Database URL | Read `DATABASE_URL` from `/var/www/lead360.app/api/.env` |
| DB credentials | Parse from `DATABASE_URL` in `/var/www/lead360.app/api/.env` — format: `mysql://user:password@host:port/database` |

**NEVER hardcode credentials. Always read from .env.**

---

## Files to Read First (mandatory)

| File | Why |
|------|-----|
| `api/src/modules/voice-ai/controllers/admin/voice-ai-monitoring.controller.ts` | Existing controller |
| `api/src/modules/voice-ai/services/voice-ai-monitoring.service.ts` | Existing service |
| `api/src/modules/voice-ai/agent/voice-agent.service.ts` | `isRunning()` method |
| `api/src/modules/admin/guards/platform-admin.guard.ts` | Guard class name |

---

## Task 1: Verify Monitoring Service Methods

```typescript
@Injectable()
export class VoiceAiMonitoringService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly voiceAgentService: VoiceAgentService,
  ) {}

  // Get agent health status
  async getAgentStatus(): Promise<AgentStatusDto>

  // List active calls — query voice_call_log WHERE status = 'in_progress'
  async getActiveRooms(): Promise<ActiveRoomDto[]>

  // Force end a call — update voice_call_log status, attempt LiveKit room deletion
  // Step 1: Find voice_call_log by room_name — throw NotFoundException if not found
  // Step 2: Update status to 'failed', ended_at = new Date(), error_message = 'Force terminated by admin'
  // Step 3: Try to delete LiveKit room via RoomServiceClient.deleteRoom(roomName) — do not throw if fails
  async forceEndRoom(roomName: string): Promise<void>

  // List tenants with voice AI settings
  // Includes: is_enabled, minutes_used this month, is_agent_active for their plan
  async listTenantsWithVoiceAi(filters: TenantsVoiceAiFiltersDto): Promise<PaginatedTenantsVoiceDto>

  // Admin override: update tenant settings (force enable, add minutes, etc.)
  async adminOverrideTenantSettings(tenantId: string, dto: AdminOverrideDto, adminId: string): Promise<TenantVoiceAiStatusDto>
}
```

**AgentStatusDto**:
```typescript
{
  is_running: boolean;          // VoiceAgentService.isRunning()
  agent_enabled: boolean;       // From voice_ai_global_config
  livekit_connected: boolean;   // Actually connected to LiveKit
  active_calls: number;         // Count of voice_call_log WHERE status='in_progress'
  today_calls: number;          // Count today
  this_month_calls: number;     // Count this month
}
```

---

## Task 2: Verify Monitoring Controller

```typescript
@Controller('system/voice-ai')
@UseGuards(PlatformAdminGuard)
export class VoiceAiMonitoringController {

  // GET /api/v1/system/voice-ai/agent/status
  @Get('agent/status') getAgentStatus()

  // GET /api/v1/system/voice-ai/rooms
  // Active calls (calls with status=in_progress) — list voice_call_log WHERE status='in_progress'
  @Get('rooms') getActiveRooms()

  // POST /api/v1/system/voice-ai/rooms/:roomName/end
  // Force end a specific call — update voice_call_log status to 'failed', set ended_at = now()
  // Also attempt to disconnect the LiveKit room via livekit-server-sdk RoomServiceClient.deleteRoom()
  @Post('rooms/:roomName/end') forceEndRoom(@Param('roomName') roomName: string)

  // GET /api/v1/system/voice-ai/agent/logs
  // Stream agent logs via SSE (Server-Sent Events)
  // Returns: EventSource stream of log entries { timestamp, level, message, data }
  // Implementation: use NestJS @Sse() decorator + Observable from a log buffer
  // Note: Read api/src/modules/admin/controllers/exports.controller.ts if SSE is already used in project
  @Sse('agent/logs') streamLogs(@Req() req): Observable<MessageEvent>

  // GET /api/v1/system/voice-ai/tenants
  // List all tenants with voice AI status
  @Get('tenants') listTenants(@Query() filters: TenantsVoiceAiFiltersDto)

  // PATCH /api/v1/system/voice-ai/tenants/:tenantId/override
  // Admin override tenant voice AI settings
  @Patch('tenants/:tenantId/override') overrideTenantSettings(
    @Param('tenantId') tenantId: string,
    @Body() dto: AdminOverrideDto,
    @Req() req
  )
}
```

---

## Task 3: AdminOverrideDto

```typescript
export class AdminOverrideDto {
  @IsOptional() @IsBoolean() is_enabled?: boolean;
  @IsOptional() @IsInt() @Min(0) monthly_minutes_override?: number;
  @IsOptional() @IsString() admin_notes?: string;
}
```

---

## Task 4: Verify Build

```bash
cd /var/www/lead360.app/api
npm run build
```

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `api/src/modules/voice-ai/controllers/admin/voice-ai-monitoring.controller.ts` | VERIFY/MODIFY | All monitoring endpoints |
| `api/src/modules/voice-ai/services/voice-ai-monitoring.service.ts` | VERIFY/MODIFY | Status, tenant list, override |
| `api/src/modules/voice-ai/dto/admin-override.dto.ts` | VERIFY/CREATE | Admin override DTO |

---

## Acceptance Criteria

- [ ] `GET /api/v1/system/voice-ai/agent/status` returns agent status with `is_running`, `active_calls` (200)
- [ ] `GET /api/v1/system/voice-ai/rooms` returns list of calls with `status='in_progress'` (200)
- [ ] `POST /api/v1/system/voice-ai/rooms/:roomName/end` marks call as failed and attempts LiveKit room deletion (200)
- [ ] `GET /api/v1/system/voice-ai/agent/logs` returns SSE stream of log entries (200)
- [ ] `GET /api/v1/system/voice-ai/tenants` lists tenants with voice AI info paginated (200)
- [ ] `PATCH /api/v1/system/voice-ai/tenants/:tenantId/override` updates override settings (200)
- [ ] All return 403 for non-admin users
- [ ] `npm run build` passes with 0 errors

---

## Testing

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' | jq -r '.access_token')

# Check agent status
curl http://localhost:3000/api/v1/system/voice-ai/agent/status \
  -H "Authorization: Bearer $TOKEN"

# Expected: { is_running: true, agent_enabled: true, active_calls: 0, ... }

# List tenants
curl "http://localhost:3000/api/v1/system/voice-ai/tenants?page=1&limit=20" \
  -H "Authorization: Bearer $TOKEN"
```
