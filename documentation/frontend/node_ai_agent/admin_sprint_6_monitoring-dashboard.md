# Voice AI Frontend - Sprint 6: Monitoring Dashboard (ADMIN)

**Sprint Type**: Admin Interface
**Route**: `/admin/voice-ai/monitoring`
**Permission**: Platform Admin
**API Documentation**: `api/documentation/voice_ai_REST_API.md` (Lines 731-831)

---

## 🎯 MASTERPIECE DEVELOPER

### ⚠️ CRITICAL RULES

1-7: NO GUESSING | VERIFY ENDPOINTS | SERVER: localhost:8000 | ASK HUMAN | NO BACKEND EDITS | ALL FIELDS | ERROR HANDLING

---

## 📋 Test Credentials

Admin: `ludsonaiello@gmail.com` / `978@F32c`

---

## 🔍 Endpoint Verification

```bash
# GET agent status
curl -X GET http://localhost:8000/api/v1/system/voice-ai/agent/status \
  -H "Authorization: Bearer <token>"

# GET active calls
curl -X GET http://localhost:8000/api/v1/system/voice-ai/rooms \
  -H "Authorization: Bearer <token>"

# POST force end call
curl -X POST http://localhost:8000/api/v1/system/voice-ai/rooms/<room_name>/end \
  -H "Authorization: Bearer <token>"

# GET agent logs (SSE stream)
curl -X GET http://localhost:8000/api/v1/system/voice-ai/agent/logs \
  -H "Authorization: Bearer <token>" \
  -H "Accept: text/event-stream"
```

---

## 📦 Data Models

```typescript
interface AgentStatus {
  is_running: boolean;
  agent_enabled: boolean;
  livekit_connected: boolean;
  active_calls: number;
  today_calls: number;
  this_month_calls: number;
}

interface ActiveRoom {
  id: string;
  tenant_id: string;
  company_name: string;
  call_sid: string;
  room_name: string | null;
  from_number: string;
  to_number: string;
  direction: 'inbound' | 'outbound';
  duration_seconds: number;
  started_at: Date;
}
```

---

## 🏗️ Implementation

### Files

```
admin/voice-ai/
├── monitoring/
│   └── page.tsx                    # Real-time monitoring dashboard
```

### Components

```
voice-ai/admin/
├── monitoring/
│   ├── AgentStatusCard.tsx         # KPI cards
│   ├── ActiveCallsList.tsx         # Real-time calls table
│   ├── LogStreamViewer.tsx         # SSE log stream
│   ├── ForceEndCallModal.tsx       # Confirmation modal
│   └── StatusBadge.tsx             # Status indicators
```

---

## 📋 Implementation Tasks

### 1. Agent Status Dashboard

**KPI Cards** (top row):

```
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Agent Status     │ │ Active Calls     │ │ Today's Calls    │
│ 🟢 Running       │ │      3           │ │      47          │
│ ✅ Connected     │ │                  │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘

┌──────────────────┐ ┌──────────────────┐
│ This Month       │ │ Max Concurrent   │
│     1,234        │ │      10          │
└──────────────────┘ └──────────────────┘
```

**Features**:
- [ ] Fetch agent status on mount (GET /agent/status)
- [ ] Auto-refresh every 10 seconds
- [ ] Display:
  - [ ] is_running status (🟢 Running / 🔴 Stopped)
  - [ ] agent_enabled status
  - [ ] livekit_connected status
  - [ ] active_calls count (highlighted if > 0)
  - [ ] today_calls count
  - [ ] this_month_calls count

---

### 2. Active Calls List

**Features**:
- [ ] Fetch active rooms (GET /rooms)
- [ ] Auto-refresh every 5 seconds
- [ ] Real-time duration counter (increment client-side)
- [ ] "Force End Call" button per call
- [ ] Confirmation modal before ending

**Table Columns**:
| Tenant | Caller | To | Direction | Duration | Actions |
|--------|--------|----|-----------| ---------|---------|
| Mr Patch Asphalt | +15551234567 | +19789988778 | Inbound | 5m 51s | [Force End] |

**Duration Display**:
```typescript
// Calculate duration dynamically
const duration = Math.floor((Date.now() - new Date(call.started_at).getTime()) / 1000);
const minutes = Math.floor(duration / 60);
const seconds = duration % 60;
return `${minutes}m ${seconds}s`;
```

---

### 3. Force End Call Modal

**Confirmation**:
```
Force End Active Call?
──────────────────────────────────────

Tenant: Mr Patch Asphalt
Caller: +15551234567
Duration: 6m 12s

⚠️ This will immediately disconnect the call and mark it as 'failed'.
   This action cannot be undone.

                              [Cancel] [Force End Call]
```

**Logic**:
```typescript
const handleForceEnd = async (roomName: string) => {
  setEnding(true);
  try {
    const response = await fetch(`/api/v1/system/voice-ai/rooms/${roomName}/end`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) throw new Error('Failed to end call');

    // Success - refresh active calls list
  } catch (error) {
    // Show error modal
  } finally {
    setEnding(false);
  }
};
```

---

### 4. Log Stream Viewer (SSE)

**Features**:
- [ ] Connect to SSE endpoint (GET /agent/logs)
- [ ] Display log entries in real-time
- [ ] Auto-scroll to bottom on new log
- [ ] Filter by log level (INFO, ERROR, DEBUG)
- [ ] Search/grep within logs (client-side)
- [ ] Pause/resume auto-scroll
- [ ] Export logs button (copy to clipboard or download)

**SSE Implementation**:

```typescript
useEffect(() => {
  const eventSource = new EventSource('/api/v1/system/voice-ai/agent/logs', {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  eventSource.onmessage = (event) => {
    const logEntry = JSON.parse(event.data);
    setLogs((prev) => [...prev, logEntry]);
  };

  eventSource.onerror = () => {
    eventSource.close();
    // Retry connection after delay
  };

  return () => eventSource.close();
}, []);
```

**Log Display**:
```
Agent Logs (Real-time)
──────────────────────────────────────────────────

[Filter: All ▼] [☐ Auto-scroll] [Export]

2026-02-22 12:30:45 [INFO] Agent heartbeat
2026-02-22 12:30:50 [INFO] Call started: room_abc123
2026-02-22 12:30:52 [DEBUG] STT: Deepgram connected
2026-02-22 12:31:00 [ERROR] LLM timeout: retry attempt 1
```

---

## 🔄 Auto-Refresh Implementation

```typescript
// Agent status - refresh every 10s
useEffect(() => {
  const interval = setInterval(() => {
    fetchAgentStatus();
  }, 10000);

  return () => clearInterval(interval);
}, []);

// Active calls - refresh every 5s
useEffect(() => {
  const interval = setInterval(() => {
    fetchActiveCalls();
  }, 5000);

  return () => clearInterval(interval);
}, []);
```

---

## ⚠️ Error Handling

- Network errors (show retry button)
- 401/403 (redirect to login)
- SSE connection lost (retry with backoff)

---

## ✅ Acceptance Criteria

- ✅ Endpoints verified
- ✅ Agent status displays correctly
- ✅ KPI cards auto-refresh
- ✅ Active calls table shows real-time data
- ✅ Duration counter increments client-side
- ✅ Force end call works with confirmation
- ✅ SSE log stream connects and displays
- ✅ Log filtering works
- ✅ Auto-scroll works
- ✅ Export logs works
- ✅ RBAC protection
- ✅ Mobile responsive

---

**If backend issues: STOP + ASK HUMAN.**

---

**End of Sprint 6**
