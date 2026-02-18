YOU ARE A MASTER CLASS DEVELOPER THAT MAKES GOOGLE, AMAZON and APPLE DEVELOPER JEALOUS BUILDING A PRODUCTION-READY TOP CLASS SYSTEM.

# Sprint FSA09 — Voice AI Agent Service Monitor (Admin UI)

**Module**: Voice AI — Admin Panel
**Sprint**: FSA09
**Depends on**: B15 (agent management endpoints), FSA07 (sidebar + layout)
**Next**: N/A — final admin sprint

---

## Objective

Build the **Agent Service Monitor** page in the admin Voice AI section. The admin can:

1. See real-time agent status (online/offline, active calls, last heartbeat, systemd state)
2. Start, Stop, and Restart the agent with confirmation dialogs
3. Browse the last 200 lines of the agent log file
4. Stream live logs in real-time (auto-scroll, pause/resume)
5. Filter logs by level: ALL / INFO / WARNING / ERROR / CRITICAL

**This replaces SSH access for day-to-day agent health monitoring.**

---

## Pre-Coding Checklist

- [ ] B15 is complete — verify all endpoints with curl before starting UI
- [ ] FSA07 sidebar layout exists — read the sidebar file before editing it
- [ ] Read `app/src/app/(dashboard)/admin/voice-ai/` — understand existing page structure
- [ ] Read `app/src/lib/api/voice-ai-admin.ts` — understand existing API client pattern
- [ ] Read `app/src/lib/types/voice-ai-admin.ts` — understand existing types
- [ ] Install `@microsoft/fetch-event-source` (see Task 3)
- [ ] **Test in browser** after each component is built

**DO NOT USE PM2** — frontend runs with: `cd /var/www/lead360.app/app && npm run dev`

---

## Development Credentials

- Admin: `ludsonaiello@gmail.com` / `978@F32c`
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8000/api/v1`

---

## Task 1: Install SSE Package

Browser `EventSource` does not support custom headers (required for Bearer token auth). Use `@microsoft/fetch-event-source` instead, which supports full header control:

```bash
cd /var/www/lead360.app/app
npm install @microsoft/fetch-event-source
```

---

## Task 2: Types

Add to `app/src/lib/types/voice-ai-admin.ts`:

```typescript
// ── Agent Monitor Types ──────────────────────────────────────────────────────

export interface AgentHeartbeatStatus {
  is_online: boolean;
  is_stale: boolean;
  last_heartbeat: string | null;
  seconds_since_heartbeat: number | null;
  active_calls: number;
  agent_id: string | null;
  version: string | null;
  status: string | null;  // 'running' | 'idle' | 'stopping' | 'offline' | null
}

export interface AgentSystemctlStatus {
  active: string;       // 'active' | 'inactive' | 'failed' | 'activating' | 'unknown'
  sub: string;          // 'running' | 'dead' | 'exited' | 'unknown'
  main_pid: number | null;
  raw: string;
}

export interface AgentStatus {
  heartbeat: AgentHeartbeatStatus;
  systemctl: AgentSystemctlStatus;
}

export interface AgentLogsResponse {
  lines: string[];
  count: number;
  log_file: string;
}

export interface AgentActionResult {
  success: boolean;
  message: string;
}

export interface ParsedLogLine {
  raw: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' | 'UNKNOWN';
  timestamp: string | null;
  message: string;
}
```

---

## Task 3: API Client Functions

Add to `app/src/lib/api/voice-ai-admin.ts`:

```typescript
import type {
  AgentStatus,
  AgentLogsResponse,
  AgentActionResult,
} from '@/lib/types/voice-ai-admin';

// ── Agent Management ─────────────────────────────────────────────────────────

export async function getAgentStatus(): Promise<AgentStatus> {
  return apiGet<AgentStatus>('/system/voice-ai/agent/status');
}

export async function startAgent(): Promise<AgentActionResult> {
  return apiPost<AgentActionResult>('/system/voice-ai/agent/start', {});
}

export async function stopAgent(): Promise<AgentActionResult> {
  return apiPost<AgentActionResult>('/system/voice-ai/agent/stop', {});
}

export async function restartAgent(): Promise<AgentActionResult> {
  return apiPost<AgentActionResult>('/system/voice-ai/agent/restart', {});
}

export async function getAgentLogs(lines = 200): Promise<AgentLogsResponse> {
  return apiGet<AgentLogsResponse>(`/system/voice-ai/agent/logs?lines=${lines}`);
}

// SSE stream URL — used by fetch-event-source, not raw EventSource
export function getAgentLogStreamUrl(): string {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
  return `${baseUrl}/system/voice-ai/agent/logs/stream`;
}
```

**Note on `apiGet` / `apiPost`**: Use the same helper functions already present in `voice-ai-admin.ts`. Read the file first to understand the existing pattern (fetch with Authorization: Bearer header from session/localStorage).

---

## Task 4: Log Parser Utility

Create `app/src/lib/utils/parse-log-line.ts`:

```typescript
import type { ParsedLogLine } from '@/lib/types/voice-ai-admin';

const LEVEL_PATTERNS: Array<{ level: ParsedLogLine['level']; regex: RegExp }> = [
  { level: 'CRITICAL', regex: /\bCRITICAL\b/i },
  { level: 'ERROR',    regex: /\bERROR\b/i },
  { level: 'WARNING',  regex: /\b(WARNING|WARN)\b/i },
  { level: 'DEBUG',    regex: /\bDEBUG\b/i },
  { level: 'INFO',     regex: /\bINFO\b/i },
];

const TIMESTAMP_REGEX = /(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2})/;

export function parseLogLine(raw: string): ParsedLogLine {
  const level = LEVEL_PATTERNS.find((p) => p.regex.test(raw))?.level ?? 'UNKNOWN';
  const timestampMatch = raw.match(TIMESTAMP_REGEX);
  return {
    raw,
    level,
    timestamp: timestampMatch?.[1] ?? null,
    message: raw,
  };
}

export const LOG_LEVEL_COLORS: Record<ParsedLogLine['level'], string> = {
  DEBUG:    'text-gray-400',
  INFO:     'text-green-400',
  WARNING:  'text-yellow-300',
  ERROR:    'text-red-400',
  CRITICAL: 'text-red-500 font-bold',
  UNKNOWN:  'text-gray-300',
};
```

---

## Task 5: AgentStatusCard Component

Create `app/src/components/voice-ai/admin/AgentStatusCard.tsx`:

```tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { getAgentStatus } from '@/lib/api/voice-ai-admin';
import type { AgentStatus } from '@/lib/types/voice-ai-admin';

interface Props {
  onStatusLoaded?: (status: AgentStatus) => void;
  refreshIntervalMs?: number;
}

type OverallStatus = 'online' | 'offline' | 'starting' | 'stale';

const STATUS_CONFIG: Record<OverallStatus, {
  dot: string; label: string; badge: string; pulse: boolean;
}> = {
  online:   { dot: 'bg-green-500',  label: 'Online',   badge: 'bg-green-100 text-green-800',  pulse: true  },
  offline:  { dot: 'bg-gray-400',   label: 'Offline',  badge: 'bg-gray-100 text-gray-600',    pulse: false },
  starting: { dot: 'bg-yellow-500', label: 'Starting', badge: 'bg-yellow-100 text-yellow-800', pulse: true  },
  stale:    { dot: 'bg-red-500',    label: 'Stale',    badge: 'bg-red-100 text-red-700',      pulse: false },
};

export function AgentStatusCard({ onStatusLoaded, refreshIntervalMs = 10000 }: Props) {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await getAgentStatus();
      setStatus(data);
      setError(null);
      onStatusLoaded?.(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to fetch agent status');
    } finally {
      setLoading(false);
    }
  }, [onStatusLoaded]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, refreshIntervalMs);
    return () => clearInterval(interval);
  }, [fetchStatus, refreshIntervalMs]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-6" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
        </div>
      </div>
    );
  }

  const hb = status?.heartbeat;
  const sc = status?.systemctl;
  const isOnline = hb?.is_online ?? false;
  const isActive = sc?.active === 'active';

  const overallStatus: OverallStatus = (() => {
    if (isOnline && isActive) return 'online';
    if (!isOnline && !isActive) return 'offline';
    if (isActive && !isOnline) return 'starting';
    return 'stale';
  })();

  const cfg = STATUS_CONFIG[overallStatus];
  const lastSeen = hb?.last_heartbeat
    ? new Date(hb.last_heartbeat).toLocaleString()
    : 'Never';

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Agent Service</h3>
          <p className="text-xs text-gray-500 mt-0.5">Voice AI Python Worker</p>
        </div>
        <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${cfg.badge}`}>
          <span className={`w-2 h-2 rounded-full ${cfg.dot} ${cfg.pulse ? 'animate-pulse' : ''}`} />
          {cfg.label}
        </span>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat
          label="Active Calls"
          value={String(hb?.active_calls ?? 0)}
          highlight={(hb?.active_calls ?? 0) > 0}
        />
        <Stat label="Process" value={sc?.sub ?? '—'} />
        <Stat label="Agent ID" value={hb?.agent_id ?? '—'} mono truncate />
        <Stat label="Version" value={hb?.version ?? '—'} />
      </div>

      {/* Footer */}
      <div className="mt-5 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
        <span>Last heartbeat: {lastSeen}</span>
        {hb?.seconds_since_heartbeat != null && (
          <span className={hb.seconds_since_heartbeat > 20 ? 'text-yellow-600' : ''}>
            {hb.seconds_since_heartbeat}s ago
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  mono = false,
  truncate = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={[
        'font-semibold',
        highlight ? 'text-blue-600' : 'text-gray-900',
        mono ? 'font-mono text-xs' : 'text-sm',
        truncate ? 'truncate' : '',
      ].join(' ')}>
        {value}
      </p>
    </div>
  );
}
```

---

## Task 6: AgentControlPanel Component

Create `app/src/components/voice-ai/admin/AgentControlPanel.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { startAgent, stopAgent, restartAgent } from '@/lib/api/voice-ai-admin';

type Action = 'start' | 'stop' | 'restart';

const ACTION_CONFIG: Record<Action, {
  label: string;
  description: string;
  warning?: string;
  buttonClass: string;
  confirmClass: string;
  icon: string;
}> = {
  start: {
    label: 'Start',
    description: 'Start the Voice AI agent service. The agent will begin accepting incoming calls.',
    buttonClass: 'bg-green-600 hover:bg-green-700 text-white border-green-600',
    confirmClass: 'bg-green-600 hover:bg-green-700 text-white',
    icon: '▶',
  },
  stop: {
    label: 'Stop',
    description: 'Stop the Voice AI agent service.',
    warning: '⚠ Active calls will be terminated immediately.',
    buttonClass: 'bg-red-600 hover:bg-red-700 text-white border-red-600',
    confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
    icon: '■',
  },
  restart: {
    label: 'Restart',
    description: 'Restart the Voice AI agent service. There will be a brief interruption.',
    warning: 'Active calls may be dropped during restart.',
    buttonClass: 'bg-yellow-500 hover:bg-yellow-600 text-white border-yellow-500',
    confirmClass: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    icon: '↺',
  },
};

interface Props {
  onAction?: () => void;  // called after successful action (e.g., to refresh status card)
}

export function AgentControlPanel({ onAction }: Props) {
  const [pendingAction, setPendingAction] = useState<Action | null>(null);
  const [loadingAction, setLoadingAction] = useState<Action | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const executeAction = async (action: Action) => {
    setLoadingAction(action);
    setResult(null);
    try {
      const handlers = { start: startAgent, stop: stopAgent, restart: restartAgent };
      const res = await handlers[action]();
      setResult(res);
      // Refresh status after a short delay to let systemd catch up
      setTimeout(() => onAction?.(), 2000);
    } catch (err: any) {
      setResult({ success: false, message: err?.message ?? 'Action failed' });
    } finally {
      setLoadingAction(null);
      setPendingAction(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Service Control</h3>
        <p className="text-xs text-gray-500 mt-0.5">Manage the agent process via systemd</p>
      </div>

      {/* Result banner */}
      {result && (
        <div className={`mb-4 p-3 rounded-lg text-sm border ${
          result.success
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          {result.message}
        </div>
      )}

      {/* Control buttons */}
      <div className="flex flex-wrap gap-3">
        {(['start', 'stop', 'restart'] as Action[]).map((action) => {
          const cfg = ACTION_CONFIG[action];
          const isLoading = loadingAction === action;
          return (
            <button
              key={action}
              onClick={() => setPendingAction(action)}
              disabled={!!loadingAction}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm
                transition-colors border disabled:opacity-50 disabled:cursor-not-allowed
                ${cfg.buttonClass}`}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  {cfg.label}ing...
                </>
              ) : (
                <>
                  <span className="text-base leading-none">{cfg.icon}</span>
                  {cfg.label}
                </>
              )}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Changes take effect via systemd. The status card refreshes every 10 seconds.
      </p>

      {/* Confirmation Modal */}
      {pendingAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-sm w-full">
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              {ACTION_CONFIG[pendingAction].label} Agent?
            </h4>
            <p className="text-sm text-gray-600 mb-2">
              {ACTION_CONFIG[pendingAction].description}
            </p>
            {ACTION_CONFIG[pendingAction].warning && (
              <p className="text-sm text-orange-600 font-medium mb-4">
                {ACTION_CONFIG[pendingAction].warning}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setPendingAction(null)}
                disabled={!!loadingAction}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => executeAction(pendingAction)}
                disabled={!!loadingAction}
                className={`px-4 py-2 text-sm rounded-lg font-medium disabled:opacity-50 ${ACTION_CONFIG[pendingAction].confirmClass}`}
              >
                {loadingAction ? 'Working...' : `Confirm ${ACTION_CONFIG[pendingAction].label}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## Task 7: AgentLogViewer Component

Create `app/src/components/voice-ai/admin/AgentLogViewer.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { fetchEventSource } from '@microsoft/fetch-event-source';
import { getAgentLogs, getAgentLogStreamUrl } from '@/lib/api/voice-ai-admin';
import { parseLogLine, LOG_LEVEL_COLORS } from '@/lib/utils/parse-log-line';
import type { ParsedLogLine } from '@/lib/types/voice-ai-admin';

type FilterLevel = 'ALL' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
const LEVEL_FILTERS: FilterLevel[] = ['ALL', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];
const MAX_LINES_IN_MEMORY = 2000;

export function AgentLogViewer() {
  const [lines, setLines] = useState<ParsedLogLine[]>([]);
  const [filter, setFilter] = useState<FilterLevel>('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load historical logs on mount
  const loadHistoricalLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getAgentLogs(200);
      setLines(data.lines.map(parseLogLine));
      setError(null);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistoricalLogs();
  }, [loadHistoricalLogs]);

  // Auto-scroll when lines change
  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [lines, autoScroll]);

  // Get auth token — read from wherever your app stores it
  const getAuthToken = (): string => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('auth_token')
      ?? sessionStorage.getItem('auth_token')
      ?? '';
  };

  const startStream = useCallback(() => {
    if (abortControllerRef.current) return; // already streaming

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setIsStreaming(true);

    fetchEventSource(getAgentLogStreamUrl(), {
      headers: {
        Authorization: `Bearer ${getAuthToken()}`,
        Accept: 'text/event-stream',
      },
      signal: controller.signal,
      onmessage(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.line) {
            setLines((prev) => {
              const updated = [...prev, parseLogLine(data.line as string)];
              // Keep max 2000 lines in memory to prevent browser slowdown
              return updated.length > MAX_LINES_IN_MEMORY
                ? updated.slice(-MAX_LINES_IN_MEMORY)
                : updated;
            });
          }
        } catch {
          // ignore malformed messages
        }
      },
      onerror(err) {
        console.error('SSE stream error:', err);
        setIsStreaming(false);
        abortControllerRef.current = null;
        throw err; // rethrow to stop reconnect loop on persistent errors
      },
      onclose() {
        setIsStreaming(false);
        abortControllerRef.current = null;
      },
    }).catch(() => {
      setIsStreaming(false);
      abortControllerRef.current = null;
    });
  }, []);

  const stopStream = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsStreaming(false);
  }, []);

  // Stop stream on unmount
  useEffect(() => {
    return () => stopStream();
  }, [stopStream]);

  // Detect manual scroll to pause auto-scroll
  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const isAtBottom = el.scrollHeight - el.scrollTop <= el.clientHeight + 60;
    setAutoScroll(isAtBottom);
  };

  // Filtered lines
  const filteredLines = filter === 'ALL' ? lines : lines.filter((l) => l.level === filter);

  // Level counts for filter badges
  const levelCounts = lines.reduce<Record<string, number>>((acc, l) => {
    acc[l.level] = (acc[l.level] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-gray-200 flex flex-col" style={{ height: '640px' }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-900">Agent Logs</h3>
          {isStreaming && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadHistoricalLogs}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh logs"
          >
            {/* Refresh icon */}
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={isStreaming ? stopStream : startStream}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
              isStreaming
                ? 'bg-red-100 text-red-700 hover:bg-red-200'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isStreaming ? 'Stop Stream' : 'Live Stream'}
          </button>
        </div>
      </div>

      {/* ── Level filters ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 px-5 py-2 border-b border-gray-100 flex-shrink-0 overflow-x-auto">
        {LEVEL_FILTERS.map((level) => (
          <button
            key={level}
            onClick={() => setFilter(level)}
            className={`px-3 py-1 text-xs rounded-full font-medium whitespace-nowrap transition-colors ${
              filter === level
                ? 'bg-gray-900 text-white'
                : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            {level}
            {level !== 'ALL' && levelCounts[level] ? (
              <span className="ml-1 opacity-60">({levelCounts[level]})</span>
            ) : null}
          </button>
        ))}
        <span className="ml-auto text-xs text-gray-400 whitespace-nowrap pl-2">
          {filteredLines.length.toLocaleString()} lines
        </span>
      </div>

      {/* ── Log output (dark terminal) ───────────────────────────────────── */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto bg-gray-950 font-mono text-xs p-4 leading-relaxed"
      >
        {loading && (
          <p className="text-gray-500 italic">Loading logs...</p>
        )}
        {error && (
          <p className="text-red-400">[Error] {error}</p>
        )}
        {!loading && !error && filteredLines.length === 0 && (
          <p className="text-gray-500 italic">
            No logs found{filter !== 'ALL' ? ` matching level: ${filter}` : '.'}{' '}
            {filter !== 'ALL' && 'Try changing the filter or refresh.'}
          </p>
        )}
        {filteredLines.map((line, i) => (
          <div
            key={i}
            className={`py-0.5 ${LOG_LEVEL_COLORS[line.level]}`}
          >
            {line.raw}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-gray-200 text-xs text-gray-500 flex-shrink-0 bg-gray-50 rounded-b-xl">
        <span>
          {autoScroll
            ? '↓ Auto-scroll active'
            : 'Auto-scroll paused — scroll to bottom to resume'}
        </span>
        <button
          onClick={() => {
            setAutoScroll(true);
            bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="text-blue-600 hover:text-blue-800 hover:underline"
        >
          Jump to bottom
        </button>
      </div>
    </div>
  );
}
```

---

## Task 8: Agent Monitor Page

Create `app/src/app/(dashboard)/admin/voice-ai/agent/page.tsx`:

```tsx
import { AgentPageClient } from './_components/AgentPageClient';

export const metadata = { title: 'Agent Monitor | Voice AI Admin' };

export default function AgentMonitorPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Agent Service Monitor</h1>
        <p className="text-sm text-gray-500 mt-1">
          Monitor and control the Voice AI agent process. Start, stop, restart, and view live logs.
        </p>
      </div>

      <AgentPageClient />
    </div>
  );
}
```

Create `app/src/app/(dashboard)/admin/voice-ai/agent/_components/AgentPageClient.tsx`:

```tsx
'use client';

import { useCallback, useRef } from 'react';
import { AgentStatusCard } from '@/components/voice-ai/admin/AgentStatusCard';
import { AgentControlPanel } from '@/components/voice-ai/admin/AgentControlPanel';
import { AgentLogViewer } from '@/components/voice-ai/admin/AgentLogViewer';

/**
 * Client wrapper that:
 * 1. Holds the "force refresh" callback between status card and control panel
 * 2. Passes onAction → status card re-polls after a control command
 */
export function AgentPageClient() {
  // refreshTrigger: control panel calls this, status card listens via key or callback
  const refreshCallbackRef = useRef<(() => void) | null>(null);

  const handleAction = useCallback(() => {
    // Wait 2s for systemd to update, then refresh status card
    setTimeout(() => refreshCallbackRef.current?.(), 2000);
  }, []);

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgentStatusCard
          refreshIntervalMs={10000}
          onStatusLoaded={() => {
            // store the fetch callback so control panel can trigger a refresh
            // AgentStatusCard already polls on interval — the onStatusLoaded is just for future use
          }}
        />
        <AgentControlPanel onAction={handleAction} />
      </div>

      <AgentLogViewer />
    </>
  );
}
```

---

## Task 9: Add to Sidebar

Read the sidebar file (likely `app/src/components/dashboard/DashboardSidebar.tsx` — confirmed in git status). Find the Voice AI admin nav section and add the Agent Monitor link.

**Read the file first**, then find the Voice AI nav items array and append:

```typescript
// Add to the Voice AI admin section nav items:
{
  label: 'Agent Monitor',
  href: '/admin/voice-ai/agent',
  icon: ServerIcon,   // import from @heroicons/react/24/outline if not already imported
}
```

**Sidebar order for Voice AI Admin section**:
1. Providers
2. Credentials
3. Configuration
4. Tenants & Plans
5. Call Logs
6. Usage Analytics
7. **Agent Monitor** ← NEW

Import `ServerIcon` if not already imported:
```typescript
import { ServerIcon } from '@heroicons/react/24/outline';
```

---

## Task 10: End-to-End Verification

```bash
# Both services must be running:
# cd /var/www/lead360.app/api && npm run dev
# cd /var/www/lead360.app/app && npm run dev

# 1. Login as admin at http://localhost:3000
# 2. Navigate: Voice AI → Agent Monitor (sidebar)

# Manual checklist:
# ✓ Status card loads — shows online/offline badge with correct color
# ✓ Status card auto-refreshes every 10 seconds (watch active_calls update)
# ✓ Start button → confirmation modal with description → click Confirm → loading spinner
#     → success banner → status updates to green after ~2s
# ✓ Stop button → modal warns about active calls → Confirm → service stops
# ✓ Restart button → modal → Confirm → brief starting state → back to online
# ✓ Log viewer loads last 200 lines on mount
# ✓ "Live Stream" button → logs start streaming in real-time (write to log file to test)
# ✓ Filter: click ERROR → shows only error lines (count in badge updates)
# ✓ Auto-scroll pauses when you scroll up, resumes at bottom
# ✓ "Jump to bottom" scrolls to last line
# ✓ "Agent Monitor" link appears in sidebar under Voice AI section
# ✓ Navigating to /admin/voice-ai/agent works directly
# ✓ Non-admin user cannot access this page (RBAC redirect)
```

---

## Acceptance Criteria

- [ ] `/admin/voice-ai/agent` page accessible and renders correctly
- [ ] Status card shows: is_online badge, active_calls, agent_id, version, systemd sub-state, last heartbeat timestamp
- [ ] Status card auto-refreshes every 10 seconds without full page reload
- [ ] Status badge color: green (online), gray (offline), yellow (starting), red (stale)
- [ ] Start button: confirmation modal → executes → success/error banner
- [ ] Stop button: confirmation modal with active-calls warning → executes → success/error banner
- [ ] Restart button: confirmation modal → executes → success/error banner
- [ ] All control buttons show loading spinner during execution
- [ ] Log viewer loads last 200 historical lines on mount
- [ ] "Live Stream" button activates SSE via `fetchEventSource` with Bearer auth header
- [ ] New log lines appear in real-time without page refresh
- [ ] Level filter (ALL / INFO / WARNING / ERROR / CRITICAL) filters displayed lines
- [ ] Auto-scroll follows new lines; pauses on manual scroll; resumes at bottom
- [ ] "Jump to bottom" button always works
- [ ] Memory capped at 2000 lines (oldest pruned automatically)
- [ ] Log output styled with dark terminal background, monospace font, colored by level
- [ ] Agent Monitor link added to sidebar in correct position
- [ ] `npm run build` passes without TypeScript errors
