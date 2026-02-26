import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Pause,
  Play,
  Download,
  Copy,
  CheckCircle,
  Search,
  Filter,
  AlertCircle,
  Info,
  XCircle,
  AlertTriangle,
} from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import type { LogEntry } from '@/lib/types/voice-ai';

interface LogStreamViewerProps {
  apiUrl: string;
  authToken: string;
}

/**
 * Log Stream Viewer Component
 * Real-time SSE log stream display with filtering and export
 */
export default function LogStreamViewer({ apiUrl, authToken }: LogStreamViewerProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const [copied, setCopied] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Connect to SSE endpoint using fetch (since EventSource doesn't support custom headers)
  useEffect(() => {
    if (isPaused || !authToken) return;

    const connectSSE = async () => {
      try {
        // Create abort controller for cleanup
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        console.log('[LogStream] Connecting to SSE endpoint...');
        setIsConnected(false);

        const response = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Accept': 'text/event-stream',
          },
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        console.log('[LogStream] SSE connection established');
        setIsConnected(true);

        // Read the stream
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              console.log('[LogStream] Stream ended');
              break;
            }

            // Decode chunk and add to buffer
            buffer += decoder.decode(value, { stream: true });

            // Split buffer by newlines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer

            // Process complete lines
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = line.slice(6); // Remove 'data: ' prefix
                  const logEntry: LogEntry = JSON.parse(data);
                  setLogs((prev) => [...prev, logEntry]);
                } catch (error) {
                  console.error('[LogStream] Failed to parse log entry:', line, error);
                }
              }
            }
          }
        }

        setIsConnected(false);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[LogStream] Connection aborted');
          return;
        }

        console.error('[LogStream] SSE connection error:', error);
        setIsConnected(false);

        // Retry connection after 5 seconds
        if (!isPaused) {
          setTimeout(() => {
            connectSSE();
          }, 5000);
        }
      }
    };

    connectSSE();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [apiUrl, authToken, isPaused]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    const matchesLevel = levelFilter === 'all' || log.level === levelFilter;
    const matchesSearch =
      searchTerm === '' ||
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      JSON.stringify(log.data || {})
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
    return matchesLevel && matchesSearch;
  });

  const handleTogglePause = () => {
    setIsPaused(!isPaused);
  };

  const handleExportLogs = () => {
    const logsText = filteredLogs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        const dataStr = log.data ? `\n${JSON.stringify(log.data, null, 2)}` : '';
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}${dataStr}`;
      })
      .join('\n\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voice-ai-logs-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyLogs = async () => {
    const logsText = filteredLogs
      .map((log) => {
        const timestamp = new Date(log.timestamp).toLocaleString();
        return `[${timestamp}] [${log.level.toUpperCase()}] ${log.message}`;
      })
      .join('\n');

    try {
      await navigator.clipboard.writeText(logsText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy logs:', error);
    }
  };

  const getLevelIcon = (level: string) => {
    switch (level) {
      case 'info':
        return <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />;
      case 'warn':
        return <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      case 'debug':
        return <Terminal className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
      default:
        return <Info className="h-4 w-4 text-gray-600 dark:text-gray-400" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'info':
        return 'text-blue-600 dark:text-blue-400';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'warn':
        return 'text-amber-600 dark:text-amber-400';
      case 'debug':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      {/* Header with Controls */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Terminal className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Agent Logs (Real-time)
            </h3>
            <div className="flex items-center gap-2">
              {isConnected ? (
                <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                  <span className="h-2 w-2 bg-green-600 dark:bg-green-400 rounded-full animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
                  <span className="h-2 w-2 bg-red-600 dark:bg-red-400 rounded-full" />
                  Disconnected
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleTogglePause}
              title={isPaused ? 'Resume stream' : 'Pause stream'}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyLogs}
              title="Copy logs to clipboard"
            >
              {copied ? (
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportLogs}
              title="Download logs as text file"
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search logs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Select
              value={levelFilter}
              onChange={(value) => setLevelFilter(value)}
              options={[
                { value: 'all', label: 'All Levels' },
                { value: 'info', label: 'Info' },
                { value: 'warn', label: 'Warning' },
                { value: 'error', label: 'Error' },
                { value: 'debug', label: 'Debug' },
              ]}
            />
          </div>
        </div>

        {/* Auto-scroll toggle */}
        <div className="flex items-center gap-2 mt-3">
          <input
            type="checkbox"
            id="auto-scroll"
            checked={autoScroll}
            onChange={(e) => setAutoScroll(e.target.checked)}
            className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
          />
          <label
            htmlFor="auto-scroll"
            className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"
          >
            Auto-scroll to bottom
          </label>
        </div>
      </div>

      {/* Logs Display */}
      <div className="h-96 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 font-mono text-xs">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
            {logs.length === 0 ? 'Waiting for logs...' : 'No logs match current filters'}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredLogs.map((log, index) => (
              <div
                key={index}
                className="flex items-start gap-3 p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <div className="flex-shrink-0 mt-0.5">{getLevelIcon(log.level)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-gray-500 dark:text-gray-400">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    <span className={`font-bold uppercase ${getLevelColor(log.level)}`}>
                      [{log.level}]
                    </span>
                    <span className="text-gray-900 dark:text-gray-100 break-all">
                      {log.message}
                    </span>
                  </div>
                  {log.data && Object.keys(log.data).length > 0 && (
                    <pre className="mt-1 text-xs text-gray-600 dark:text-gray-400 overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-750">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
          <span>
            Showing {filteredLogs.length} of {logs.length} logs
          </span>
          {isPaused && <span className="text-amber-600 dark:text-amber-400">⏸ Stream paused</span>}
        </div>
      </div>
    </div>
  );
}
