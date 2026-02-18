YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint B15 — Voice AI Agent Service Management

**Module**: Voice AI
**Sprint**: B15
**Depends on**: B01, B02a, B06a (VoiceAgentKeyGuard for internal heartbeat endpoint)
**Next**: FSA09 (Agent Monitor UI)

---

## Objective

Enable the admin to **start, stop, restart, and monitor** the Python Voice AI agent process from the web UI — without SSH access. Also enable the Python agent to POST heartbeats so the admin UI knows if the agent is alive.

**Architecture**:
- Python agent → POSTs heartbeat to backend every 10 seconds (via agent API key)
- NestJS → stores heartbeat in `voice_ai_agent_heartbeat` table
- NestJS → exposes start/stop/restart via `sudo systemctl` shell commands
- NestJS → serves log file lines (paginated) and streams live via SSE
- Admin UI (FSA09) → reads status, sends commands, views live logs

---

## Pre-Coding Checklist

- [ ] B01 complete (schema migrations applied)
- [ ] B02a complete (VoiceAiModule exists)
- [ ] B06a complete (VoiceAgentKeyGuard exists for heartbeat auth)
- [ ] Read `/api/src/modules/voice-ai/` — understand existing module structure
- [ ] Read `/api/src/app.module.ts` — understand module registration
- [ ] Infrastructure setup completed (see Infrastructure Setup section below)
- [ ] **HIT EVERY ENDPOINT** after implementing (curl commands at bottom)

**DO NOT USE PM2** — API runs with: `cd /var/www/lead360.app/api && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- DB credentials: read from `/var/www/lead360.app/api/.env` — never hardcode
- Log file path: `/var/www/lead360.app/logs/voice-ai-agent.log`
- Systemd service name: `voice-ai-agent`

---

## Infrastructure Setup (Do This Before Coding)

### 1. Create the systemd service file

```bash
sudo nano /etc/systemd/system/voice-ai-agent.service
```

Content:
```ini
[Unit]
Description=Lead360 Voice AI Agent (LiveKit Worker)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/lead360.app/agent
EnvironmentFile=/var/www/lead360.app/agent/.env
ExecStart=/var/www/lead360.app/agent/venv/bin/python worker.py
Restart=on-failure
RestartSec=5
StandardOutput=append:/var/www/lead360.app/logs/voice-ai-agent.log
StandardError=append:/var/www/lead360.app/logs/voice-ai-agent.log

[Install]
WantedBy=multi-user.target
```

Enable and initialize:
```bash
sudo systemctl daemon-reload
sudo systemctl enable voice-ai-agent
sudo touch /var/www/lead360.app/logs/voice-ai-agent.log
sudo chown www-data:www-data /var/www/lead360.app/logs/voice-ai-agent.log
```

### 2. Configure sudoers — limited access for the API process

The NestJS API runs as `www-data`. It needs `sudo` access **only** for voice-ai-agent — nothing else.

```bash
sudo visudo -f /etc/sudoers.d/voice-ai-agent-control
```

Add exactly these lines:
```
www-data ALL=(ALL) NOPASSWD: /bin/systemctl start voice-ai-agent
www-data ALL=(ALL) NOPASSWD: /bin/systemctl stop voice-ai-agent
www-data ALL=(ALL) NOPASSWD: /bin/systemctl restart voice-ai-agent
www-data ALL=(ALL) NOPASSWD: /bin/systemctl status voice-ai-agent
```

Verify no syntax errors:
```bash
sudo chmod 440 /etc/sudoers.d/voice-ai-agent-control
sudo visudo -c
```

---

## Task 1: Schema — Heartbeat Table

Add to `api/prisma/schema.prisma`:

```prisma
model voice_ai_agent_heartbeat {
  id           String   @id @default(cuid())
  agent_id     String   @unique @db.VarChar(100)  // 'hostname:pid' — unique per agent instance
  status       String   @db.VarChar(20)            // 'running' | 'idle' | 'stopping'
  active_calls Int      @default(0)
  version      String?  @db.VarChar(50)
  metadata     String?  @db.Text                   // JSON — livekit_url, python_version, etc.
  last_seen    DateTime @default(now())
  created_at   DateTime @default(now())

  @@map("voice_ai_agent_heartbeat")
}
```

Create and apply migration:
```bash
cd /var/www/lead360.app/api
npx prisma migrate dev --name add_voice_ai_agent_heartbeat
```

---

## Task 2: Heartbeat DTO

Create `api/src/modules/voice-ai/dto/agent-heartbeat.dto.ts`:

```typescript
import { IsString, IsInt, IsOptional, IsIn, Min, Max } from 'class-validator';

export class AgentHeartbeatDto {
  @IsString()
  agent_id: string;  // 'hostname:pid'

  @IsString()
  @IsIn(['running', 'idle', 'stopping'])
  status: string;

  @IsInt()
  @Min(0)
  @Max(1000)
  active_calls: number;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsString()
  metadata?: string;  // JSON string
}
```

---

## Task 3: Agent Manager Service

Create `api/src/modules/voice-ai/services/voice-ai-agent-manager.service.ts`:

```typescript
import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as readline from 'readline';

const execAsync = promisify(exec);

const SERVICE_NAME = 'voice-ai-agent';
export const LOG_FILE_PATH = '/var/www/lead360.app/logs/voice-ai-agent.log';
export const HEARTBEAT_STALE_SECONDS = 30;  // agent considered offline after 30s without heartbeat

export type ServiceAction = 'start' | 'stop' | 'restart';

export interface SystemctlStatus {
  active: string;       // 'active' | 'inactive' | 'failed' | 'activating' | 'unknown'
  sub: string;          // 'running' | 'dead' | 'exited' | 'unknown'
  main_pid: number | null;
  raw: string;          // truncated raw output
}

@Injectable()
export class VoiceAiAgentManagerService {
  private readonly logger = new Logger(VoiceAiAgentManagerService.name);

  async executeServiceCommand(action: ServiceAction): Promise<{ success: boolean; message: string }> {
    const command = `sudo systemctl ${action} ${SERVICE_NAME}`;
    this.logger.log(`Executing: ${command}`);

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 15000 });
      if (stderr) this.logger.warn(`systemctl ${action} stderr: ${stderr}`);
      return { success: true, message: `Service ${action} executed successfully` };
    } catch (error: any) {
      this.logger.error(`systemctl ${action} failed: ${error.message}`);
      // systemctl stop returns exit code 5 if service is not loaded — treat as success
      if (action === 'stop' && (error.code === 5 || (error.stderr as string)?.includes('not loaded'))) {
        return { success: true, message: 'Service was already stopped' };
      }
      throw new InternalServerErrorException(
        `Failed to ${action} service: ${(error.stderr as string) || error.message}`,
      );
    }
  }

  async getSystemctlStatus(): Promise<SystemctlStatus> {
    try {
      const { stdout } = await execAsync(`sudo systemctl status ${SERVICE_NAME}`, { timeout: 5000 });
      return this.parseSystemctlOutput(stdout);
    } catch (error: any) {
      // systemctl status exits with code 3 when inactive — stdout still has info
      if (error.stdout) return this.parseSystemctlOutput(error.stdout as string);
      return { active: 'unknown', sub: 'unknown', main_pid: null, raw: error.message };
    }
  }

  private parseSystemctlOutput(output: string): SystemctlStatus {
    const activeMatch = output.match(/Active:\s+(\S+)\s+\((\S+)\)/);
    const pidMatch = output.match(/Main PID:\s+(\d+)/);
    return {
      active: activeMatch?.[1] ?? 'unknown',
      sub: activeMatch?.[2] ?? 'unknown',
      main_pid: pidMatch ? parseInt(pidMatch[1], 10) : null,
      raw: output.substring(0, 500),
    };
  }

  async getRecentLogs(lines = 200): Promise<string[]> {
    if (!fs.existsSync(LOG_FILE_PATH)) {
      return ['[Log file not found. Agent may not have started yet.]'];
    }

    return new Promise((resolve) => {
      const results: string[] = [];
      const fileStream = fs.createReadStream(LOG_FILE_PATH);
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      rl.on('line', (line) => results.push(line));
      rl.on('close', () => resolve(results.slice(-lines)));
      fileStream.on('error', () => resolve(['[Error reading log file]']));
    });
  }
}
```

---

## Task 4: Agent Status Service

Create `api/src/modules/voice-ai/services/voice-ai-agent-status.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentHeartbeatDto } from '../dto/agent-heartbeat.dto';
import { HEARTBEAT_STALE_SECONDS } from './voice-ai-agent-manager.service';

export interface AgentHeartbeatStatus {
  is_online: boolean;
  is_stale: boolean;
  last_heartbeat: string | null;
  seconds_since_heartbeat: number | null;
  active_calls: number;
  agent_id: string | null;
  version: string | null;
  status: string | null;  // 'running' | 'idle' | 'stopping' | 'offline'
}

@Injectable()
export class VoiceAiAgentStatusService {
  private readonly logger = new Logger(VoiceAiAgentStatusService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordHeartbeat(dto: AgentHeartbeatDto): Promise<void> {
    await this.prisma.voice_ai_agent_heartbeat.upsert({
      where: { agent_id: dto.agent_id },
      update: {
        status: dto.status,
        active_calls: dto.active_calls,
        version: dto.version ?? null,
        metadata: dto.metadata ?? null,
        last_seen: new Date(),
      },
      create: {
        agent_id: dto.agent_id,
        status: dto.status,
        active_calls: dto.active_calls,
        version: dto.version ?? null,
        metadata: dto.metadata ?? null,
        last_seen: new Date(),
      },
    });
  }

  async getStatus(): Promise<AgentHeartbeatStatus> {
    const heartbeat = await this.prisma.voice_ai_agent_heartbeat.findFirst({
      orderBy: { last_seen: 'desc' },
    });

    if (!heartbeat) {
      return {
        is_online: false,
        is_stale: true,
        last_heartbeat: null,
        seconds_since_heartbeat: null,
        active_calls: 0,
        agent_id: null,
        version: null,
        status: null,
      };
    }

    const secondsSince = Math.floor((Date.now() - heartbeat.last_seen.getTime()) / 1000);
    const isStale = secondsSince > HEARTBEAT_STALE_SECONDS;

    return {
      is_online: !isStale,
      is_stale: isStale,
      last_heartbeat: heartbeat.last_seen.toISOString(),
      seconds_since_heartbeat: secondsSince,
      active_calls: heartbeat.active_calls,
      agent_id: heartbeat.agent_id,
      version: heartbeat.version,
      status: isStale ? 'offline' : heartbeat.status,
    };
  }
}
```

---

## Task 5: Admin Agent Controller

Create `api/src/modules/voice-ai/controllers/admin/voice-ai-agent.controller.ts`:

```typescript
import {
  Controller, Get, Post, Query, UseGuards, HttpCode,
  ParseIntPipe, DefaultValuePipe, Sse, MessageEvent,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import {
  VoiceAiAgentManagerService,
  ServiceAction,
  LOG_FILE_PATH,
} from '../../services/voice-ai-agent-manager.service';
import { VoiceAiAgentStatusService } from '../../services/voice-ai-agent-status.service';

@ApiTags('Voice AI - System Admin Agent Management')
@Controller('system/voice-ai/agent')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('platform_admin')
@ApiBearerAuth()
export class VoiceAiAgentController {
  constructor(
    private readonly managerService: VoiceAiAgentManagerService,
    private readonly statusService: VoiceAiAgentStatusService,
  ) {}

  /**
   * GET /api/v1/system/voice-ai/agent/status
   * Returns combined heartbeat status + systemctl process status
   */
  @Get('status')
  async getStatus() {
    const [heartbeat, systemctl] = await Promise.all([
      this.statusService.getStatus(),
      this.managerService.getSystemctlStatus(),
    ]);
    return { heartbeat, systemctl };
  }

  /**
   * POST /api/v1/system/voice-ai/agent/start
   */
  @Post('start')
  @HttpCode(200)
  start() {
    return this.managerService.executeServiceCommand('start');
  }

  /**
   * POST /api/v1/system/voice-ai/agent/stop
   */
  @Post('stop')
  @HttpCode(200)
  stop() {
    return this.managerService.executeServiceCommand('stop');
  }

  /**
   * POST /api/v1/system/voice-ai/agent/restart
   */
  @Post('restart')
  @HttpCode(200)
  restart() {
    return this.managerService.executeServiceCommand('restart');
  }

  /**
   * GET /api/v1/system/voice-ai/agent/logs
   * Returns last N lines of the agent log file (default 200, max 1000)
   */
  @Get('logs')
  @ApiQuery({ name: 'lines', required: false, type: Number, description: 'Lines to return (default 200, max 1000)' })
  async getLogs(
    @Query('lines', new DefaultValuePipe(200), ParseIntPipe) lines: number,
  ) {
    const safeLines = Math.min(lines, 1000);
    const logLines = await this.managerService.getRecentLogs(safeLines);
    return { lines: logLines, count: logLines.length, log_file: LOG_FILE_PATH };
  }

  /**
   * GET /api/v1/system/voice-ai/agent/logs/stream
   * Server-Sent Events: streams new log lines in real-time.
   *
   * NOTE: Browser EventSource does not support custom headers.
   * The frontend must pass ?token=<jwt> as a query param.
   * Update JwtAuthGuard to also accept token from query string on this route,
   * OR use @microsoft/fetch-event-source on the frontend (which supports headers).
   *
   * SSE connections are long-lived. The Observable cleanup (unwatch) runs on client disconnect.
   */
  @Sse('logs/stream')
  streamLogs(): Observable<MessageEvent> {
    return new Observable((observer) => {
      if (!fs.existsSync(LOG_FILE_PATH)) {
        observer.next({
          data: JSON.stringify({
            line: '[Log file not found. Agent may not have started yet.]',
            timestamp: new Date().toISOString(),
          }),
        } as MessageEvent);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Tail } = require('tail');
      const fileTail = new Tail(LOG_FILE_PATH, {
        useWatchFile: true,
        fsWatchOptions: { interval: 500 },
      });

      fileTail.on('line', (line: string) => {
        observer.next({
          data: JSON.stringify({ line, timestamp: new Date().toISOString() }),
        } as MessageEvent);
      });

      fileTail.on('error', (err: Error) => {
        observer.next({ data: JSON.stringify({ error: err.message }) } as MessageEvent);
      });

      // Cleanup when client disconnects
      return () => fileTail.unwatch();
    });
  }
}
```

Install the `tail` package:
```bash
cd /var/www/lead360.app/api
npm install tail
npm install --save-dev @types/tail
```

---

## Task 6: Internal Heartbeat Controller

Create `api/src/modules/voice-ai/controllers/internal/voice-ai-heartbeat.controller.ts`:

```typescript
import { Controller, Post, Body, UseGuards, HttpCode } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { VoiceAgentKeyGuard } from '../../guards/voice-agent-key.guard';
import { VoiceAiAgentStatusService } from '../../services/voice-ai-agent-status.service';
import { AgentHeartbeatDto } from '../../dto/agent-heartbeat.dto';

@ApiTags('Voice AI - Internal Agent Heartbeat')
@Controller('internal/voice-ai/agent')
@UseGuards(VoiceAgentKeyGuard)
export class VoiceAiHeartbeatController {
  constructor(private readonly statusService: VoiceAiAgentStatusService) {}

  /**
   * POST /api/v1/internal/voice-ai/agent/heartbeat
   * Called by the Python agent every 10 seconds.
   * Authenticated via X-Agent-Key header (hashed agent API key — B06a pattern).
   * Returns 204 No Content.
   */
  @Post('heartbeat')
  @HttpCode(204)
  async heartbeat(@Body() dto: AgentHeartbeatDto): Promise<void> {
    await this.statusService.recordHeartbeat(dto);
  }
}
```

---

## Task 7: Register in VoiceAiModule

Update `api/src/modules/voice-ai/voice-ai.module.ts` — add all new controllers and services:

```typescript
// ADD these imports at the top:
import { VoiceAiAgentController } from './controllers/admin/voice-ai-agent.controller';
import { VoiceAiHeartbeatController } from './controllers/internal/voice-ai-heartbeat.controller';
import { VoiceAiAgentManagerService } from './services/voice-ai-agent-manager.service';
import { VoiceAiAgentStatusService } from './services/voice-ai-agent-status.service';

@Module({
  imports: [PrismaModule],
  controllers: [
    VoiceAiProvidersController,
    VoiceAiAgentController,       // ADD
    VoiceAiHeartbeatController,   // ADD
    // ... other existing controllers
  ],
  providers: [
    VoiceAiProvidersService,
    VoiceAiAgentManagerService,   // ADD
    VoiceAiAgentStatusService,    // ADD
    // ... other existing providers
  ],
  exports: [
    VoiceAiProvidersService,
    VoiceAiAgentStatusService,    // ADD — other modules may need it
  ],
})
export class VoiceAiModule {}
```

---

## Task 8: Python Agent — Heartbeat Updates

When implementing sprint A01a (or updating if already started), add a background heartbeat task to the Python agent:

```python
import asyncio
import socket
import os
import platform
import json
import httpx

AGENT_ID = f"{socket.gethostname()}:{os.getpid()}"
HEARTBEAT_INTERVAL_SECONDS = 10

async def send_heartbeat(
    http_client: httpx.AsyncClient,
    backend_url: str,
    agent_api_key: str,
    active_calls: list,  # pass by reference — list of active call session IDs
    version: str = "1.0.0",
) -> None:
    """Background task: POST heartbeat to backend every 10 seconds."""
    while True:
        try:
            payload = {
                "agent_id": AGENT_ID,
                "status": "running" if active_calls else "idle",
                "active_calls": len(active_calls),
                "version": version,
                "metadata": json.dumps({
                    "python_version": platform.python_version(),
                }),
            }
            response = await http_client.post(
                f"{backend_url}/internal/voice-ai/agent/heartbeat",
                json=payload,
                headers={"X-Agent-Key": agent_api_key},
                timeout=5.0,
            )
            if response.status_code not in (200, 204):
                logger.warning("Heartbeat rejected: %s %s", response.status_code, response.text)
        except Exception as e:
            logger.warning("Heartbeat failed (will retry in %ds): %s", HEARTBEAT_INTERVAL_SECONDS, e)

        await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)


async def send_stopping_heartbeat(
    http_client: httpx.AsyncClient,
    backend_url: str,
    agent_api_key: str,
) -> None:
    """Called on SIGTERM to mark agent as stopping before shutdown."""
    try:
        await http_client.post(
            f"{backend_url}/internal/voice-ai/agent/heartbeat",
            json={"agent_id": AGENT_ID, "status": "stopping", "active_calls": 0},
            headers={"X-Agent-Key": agent_api_key},
            timeout=3.0,
        )
    except Exception:
        pass  # best effort — we're shutting down


# In your main() worker entrypoint:
async def main():
    cfg = VoiceAiConfig()
    active_calls: list = []  # track active call session IDs

    async with httpx.AsyncClient() as http_client:
        # Start heartbeat background task
        asyncio.create_task(
            send_heartbeat(http_client, cfg.BACKEND_URL, cfg.AGENT_API_KEY, active_calls)
        )
        # ... rest of worker startup (LiveKit agent connection, etc.)
```

---

## Task 9: Verify — Hit Every Endpoint

```bash
# Get admin token
TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"ludsonaiello@gmail.com","password":"978@F32c"}' \
  | jq -r '.access_token')

# ── Status ──────────────────────────────────────────────────────────────────
curl http://localhost:8000/api/v1/system/voice-ai/agent/status \
  -H "Authorization: Bearer $TOKEN" | jq .

# Expected: { heartbeat: {...}, systemctl: {...} }

# ── Start ────────────────────────────────────────────────────────────────────
curl -X POST http://localhost:8000/api/v1/system/voice-ai/agent/start \
  -H "Authorization: Bearer $TOKEN" | jq .

# ── Stop ─────────────────────────────────────────────────────────────────────
curl -X POST http://localhost:8000/api/v1/system/voice-ai/agent/stop \
  -H "Authorization: Bearer $TOKEN" | jq .

# ── Restart ──────────────────────────────────────────────────────────────────
curl -X POST http://localhost:8000/api/v1/system/voice-ai/agent/restart \
  -H "Authorization: Bearer $TOKEN" | jq .

# ── Logs (last 50 lines) ─────────────────────────────────────────────────────
curl "http://localhost:8000/api/v1/system/voice-ai/agent/logs?lines=50" \
  -H "Authorization: Bearer $TOKEN" | jq .

# ── SSE log stream (Ctrl+C to stop) ─────────────────────────────────────────
curl -N "http://localhost:8000/api/v1/system/voice-ai/agent/logs/stream" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Accept: text/event-stream"

# ── Heartbeat (as Python agent would call) ───────────────────────────────────
# First, get the agent API key from the database or B03 setup
AGENT_KEY="your-plain-agent-api-key"
curl -X POST http://localhost:8000/api/v1/internal/voice-ai/agent/heartbeat \
  -H "X-Agent-Key: $AGENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"agent_id":"server01:12345","status":"running","active_calls":2,"version":"1.0.0"}' \
  -w "\nHTTP %{http_code}\n"
# Expected: HTTP 204

# ── Non-admin gets 403 ───────────────────────────────────────────────────────
TENANT_TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"contact@honeydo4you.com","password":"978@F32c"}' \
  | jq -r '.access_token')

curl http://localhost:8000/api/v1/system/voice-ai/agent/status \
  -H "Authorization: Bearer $TENANT_TOKEN" | jq .
# Expected: { statusCode: 403 }
```

---

## Acceptance Criteria

- [ ] `GET /system/voice-ai/agent/status` returns heartbeat + systemctl status
- [ ] `POST /system/voice-ai/agent/start` starts the systemd service
- [ ] `POST /system/voice-ai/agent/stop` stops the systemd service
- [ ] `POST /system/voice-ai/agent/restart` restarts the systemd service
- [ ] `GET /system/voice-ai/agent/logs?lines=200` returns last N log lines (max 1000)
- [ ] `GET /system/voice-ai/agent/logs/stream` streams live log lines via SSE
- [ ] `POST /internal/voice-ai/agent/heartbeat` accepts heartbeat (VoiceAgentKeyGuard auth), returns 204
- [ ] Heartbeat upserted to `voice_ai_agent_heartbeat` table (unique per agent_id)
- [ ] Agent considered offline if no heartbeat in 30 seconds (`is_online: false`)
- [ ] Non-admin gets 403 on all `/system/voice-ai/agent/*` endpoints
- [ ] `npm run build` passes without errors
- [ ] Systemd service file created at `/etc/systemd/system/voice-ai-agent.service`
- [ ] Sudoers configured (`www-data` can manage `voice-ai-agent` only)
- [ ] `tail` npm package installed