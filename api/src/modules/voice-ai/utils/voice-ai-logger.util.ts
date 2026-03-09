import * as fs from 'fs';
import * as path from 'path';

/**
 * Voice AI Call Logger
 *
 * Provides comprehensive, real-time logging for voice AI calls.
 * Logs are written to a dedicated file that can be tailed during calls.
 *
 * Log file location: /var/www/lead360.app/logs/voice-ai-calls.log
 */

const LOG_FILE_PATH = '/var/www/lead360.app/logs/voice-ai-calls.log';

// Ensure log directory exists
const logDir = path.dirname(LOG_FILE_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Ensure log file exists
if (!fs.existsSync(LOG_FILE_PATH)) {
  fs.writeFileSync(LOG_FILE_PATH, '', 'utf-8');
}

export enum VoiceAILogLevel {
  INFO = 'INFO',
  DEBUG = 'DEBUG',
  WARN = 'WARN',
  ERROR = 'ERROR',
  SUCCESS = 'SUCCESS',
}

export enum VoiceAILogCategory {
  JOB_START = 'JOB_START',
  JOB_END = 'JOB_END',
  CONTEXT_LOAD = 'CONTEXT_LOAD',
  AGENT_INIT = 'AGENT_INIT',
  ROOM_CONNECTION = 'ROOM_CONNECTION',
  STT = 'STT',
  LLM = 'LLM',
  TTS = 'TTS',
  TOOL_CALL = 'TOOL_CALL',
  TRANSFER = 'TRANSFER',
  LEAD = 'LEAD',
  ERROR = 'ERROR',
  SESSION = 'SESSION',
  QUOTA = 'QUOTA',
  PROVIDER = 'PROVIDER',
  SIP_DIAL = 'SIP_DIAL',
}

interface VoiceAILogEntry {
  timestamp: string;
  level: VoiceAILogLevel;
  category: VoiceAILogCategory;
  tenant_id?: string;
  call_sid?: string;
  message: string;
  data?: any;
}

/**
 * Format and write a log entry to the voice AI log file
 */
function writeLog(entry: VoiceAILogEntry): void {
  const logLine = formatLogEntry(entry);

  // Write to file (synchronous for reliability)
  fs.appendFileSync(LOG_FILE_PATH, logLine + '\n', 'utf-8');

  // Also log to console for PM2 logs
  console.log(logLine);
}

/**
 * Format log entry as human-readable string with structured data
 */
function formatLogEntry(entry: VoiceAILogEntry): string {
  const parts: string[] = [];

  // Timestamp
  parts.push(`[${entry.timestamp}]`);

  // Level (color-coded with ANSI, visible in console)
  const levelColor = getLevelColor(entry.level);
  parts.push(`[${levelColor}${entry.level}${ANSI_RESET}]`);

  // Category
  parts.push(`[${entry.category}]`);

  // Tenant ID
  if (entry.tenant_id) {
    parts.push(`[tenant:${entry.tenant_id}]`);
  }

  // Call SID
  if (entry.call_sid) {
    parts.push(`[call:${entry.call_sid}]`);
  }

  // Message
  parts.push(entry.message);

  // Data (pretty-printed JSON)
  if (entry.data) {
    parts.push(
      '\n  Data: ' +
        JSON.stringify(entry.data, null, 2).split('\n').join('\n  '),
    );
  }

  return parts.join(' ');
}

// ANSI color codes
const ANSI_RESET = '\x1b[0m';
const ANSI_RED = '\x1b[31m';
const ANSI_YELLOW = '\x1b[33m';
const ANSI_GREEN = '\x1b[32m';
const ANSI_BLUE = '\x1b[34m';
const ANSI_CYAN = '\x1b[36m';

function getLevelColor(level: VoiceAILogLevel): string {
  switch (level) {
    case VoiceAILogLevel.ERROR:
      return ANSI_RED;
    case VoiceAILogLevel.WARN:
      return ANSI_YELLOW;
    case VoiceAILogLevel.SUCCESS:
      return ANSI_GREEN;
    case VoiceAILogLevel.DEBUG:
      return ANSI_CYAN;
    case VoiceAILogLevel.INFO:
    default:
      return ANSI_BLUE;
  }
}

/**
 * Voice AI Logger Class
 * Provides convenience methods for logging at different stages of a call
 */
export class VoiceAILogger {
  constructor(
    private readonly tenantId?: string,
    private readonly callSid?: string,
  ) {}

  /**
   * Log when a new job is received from LiveKit
   */
  logJobStart(jobId: string, metadata: any): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.INFO,
      category: VoiceAILogCategory.JOB_START,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `📞 New Voice AI job received`,
      data: {
        job_id: jobId,
        metadata,
      },
    });
  }

  /**
   * Log when job completes
   */
  logJobEnd(success: boolean, duration_ms: number, outcome?: string): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: success ? VoiceAILogLevel.SUCCESS : VoiceAILogLevel.ERROR,
      category: VoiceAILogCategory.JOB_END,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: success ? `✅ Call completed successfully` : `❌ Call failed`,
      data: {
        duration_ms,
        outcome,
      },
    });
  }

  /**
   * Log context loading
   */
  logContextLoad(context: any): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.INFO,
      category: VoiceAILogCategory.CONTEXT_LOAD,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `📋 Context loaded for tenant`,
      data: {
        tenant_name: context.tenant?.name,
        business_name: context.tenant?.business_name,
        quota: {
          minutes_included: context.quota?.minutes_included,
          minutes_used: context.quota?.minutes_used,
          overage_allowed: context.quota?.overage_allowed,
        },
        agent_behavior: {
          name: context.agent_behavior?.agent_name,
          greeting: context.agent_behavior?.greeting_message,
          language: context.agent_behavior?.primary_language,
        },
        providers: {
          stt: context.providers?.stt?.provider,
          llm: context.providers?.llm?.provider,
          tts: context.providers?.tts?.provider,
        },
        services_count: context.services?.length || 0,
        service_areas_count: context.service_areas?.length || 0,
        transfer_numbers_count: context.transfer_numbers?.length || 0,
      },
    });
  }

  /**
   * Log agent initialization
   */
  logAgentInit(
    providers: { stt: string; llm: string; tts: string },
    tools: string[],
  ): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.INFO,
      category: VoiceAILogCategory.AGENT_INIT,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `🤖 Agent initialized`,
      data: {
        providers,
        tools,
      },
    });
  }

  /**
   * Log room connection
   */
  logRoomConnection(roomName: string, participantCount: number): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.INFO,
      category: VoiceAILogCategory.ROOM_CONNECTION,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `🔗 Connected to LiveKit room`,
      data: {
        room_name: roomName,
        participant_count: participantCount,
      },
    });
  }

  /**
   * Log speech-to-text events
   */
  logSTT(transcript: string, isFinal: boolean, confidence?: number): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.DEBUG,
      category: VoiceAILogCategory.STT,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `🎤 User said: "${transcript}"`,
      data: {
        is_final: isFinal,
        confidence,
        length: transcript.length,
      },
    });
  }

  /**
   * Log LLM requests and responses
   */
  logLLMRequest(messages: any[], model: string): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.DEBUG,
      category: VoiceAILogCategory.LLM,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `🧠 Sending request to LLM`,
      data: {
        model,
        message_count: messages.length,
        messages: messages.map((m) => ({
          role: m.role,
          content:
            typeof m.content === 'string'
              ? m.content.substring(0, 200) +
                (m.content.length > 200 ? '...' : '')
              : '[complex content]',
        })),
      },
    });
  }

  logLLMResponse(response: string, toolCalls?: any[]): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.DEBUG,
      category: VoiceAILogCategory.LLM,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `🧠 Agent response: "${response}"`,
      data: {
        response_length: response.length,
        has_tool_calls: !!toolCalls && toolCalls.length > 0,
        tool_calls: toolCalls?.map((tc) => ({
          name: tc.function?.name,
          arguments: tc.function?.arguments,
        })),
      },
    });
  }

  /**
   * Log text-to-speech events
   */
  logTTS(text: string, voice: string): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.DEBUG,
      category: VoiceAILogCategory.TTS,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `🔊 Generating speech: "${text}"`,
      data: {
        text_length: text.length,
        voice,
      },
    });
  }

  /**
   * Log tool calls (functions the agent executes)
   */
  logToolCall(
    toolName: string,
    parameters: any,
    result?: any,
    error?: any,
  ): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: error ? VoiceAILogLevel.ERROR : VoiceAILogLevel.INFO,
      category: VoiceAILogCategory.TOOL_CALL,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `🔧 Tool executed: ${toolName}`,
      data: {
        tool: toolName,
        parameters,
        result,
        error,
      },
    });
  }

  /**
   * Log transfer events
   */
  logTransferRequest(reason: string, department?: string): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.INFO,
      category: VoiceAILogCategory.TRANSFER,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `📞 Transfer requested`,
      data: {
        reason,
        department,
      },
    });
  }

  logTransferExecution(
    toNumber: string,
    fromNumber: string,
    settings: any,
  ): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.SUCCESS,
      category: VoiceAILogCategory.TRANSFER,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `📲 Transferring call to ${toNumber}`,
      data: {
        to_number: toNumber,
        from_number: fromNumber,
        settings,
      },
    });
  }

  /**
   * Log lead creation/lookup
   */
  logLeadFound(leadId: string, leadData: any): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.INFO,
      category: VoiceAILogCategory.LEAD,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `👤 Lead found`,
      data: {
        lead_id: leadId,
        lead: leadData,
      },
    });
  }

  logLeadCreated(leadId: string, leadData: any): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.SUCCESS,
      category: VoiceAILogCategory.LEAD,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `👤 New lead created`,
      data: {
        lead_id: leadId,
        lead: leadData,
      },
    });
  }

  /**
   * Log errors
   */
  logError(error: Error, context?: string): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.ERROR,
      category: VoiceAILogCategory.ERROR,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `❌ Error: ${error.message}`,
      data: {
        context,
        error_name: error.name,
        error_message: error.message,
        error_stack: error.stack,
      },
    });
  }

  /**
   * Log session events
   */
  logSessionEvent(event: string, data?: any): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.DEBUG,
      category: VoiceAILogCategory.SESSION,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `📡 Session event: ${event}`,
      data,
    });
  }

  /**
   * Log quota checks
   */
  logQuotaCheck(allowed: boolean, quotaInfo: any): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: allowed ? VoiceAILogLevel.SUCCESS : VoiceAILogLevel.WARN,
      category: VoiceAILogCategory.QUOTA,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: allowed ? `✅ Quota check passed` : `⚠️ Quota exceeded`,
      data: quotaInfo,
    });
  }

  /**
   * Log provider initialization
   */
  logProviderInit(
    providerType: 'STT' | 'LLM' | 'TTS',
    providerName: string,
    config: any,
  ): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level: VoiceAILogLevel.DEBUG,
      category: VoiceAILogCategory.PROVIDER,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message: `🔌 ${providerType} provider initialized: ${providerName}`,
      data: {
        provider_type: providerType,
        provider_name: providerName,
        config,
      },
    });
  }

  /**
   * Generic log method
   */
  log(
    level: VoiceAILogLevel,
    category: VoiceAILogCategory,
    message: string,
    data?: any,
  ): void {
    writeLog({
      timestamp: new Date().toISOString(),
      level,
      category,
      tenant_id: this.tenantId,
      call_sid: this.callSid,
      message,
      data,
    });
  }
}

/**
 * Create a logger instance for a specific call
 */
export function createVoiceAILogger(
  tenantId?: string,
  callSid?: string,
): VoiceAILogger {
  return new VoiceAILogger(tenantId, callSid);
}

/**
 * Log a separator line (useful for visual clarity when tailing logs)
 */
export function logSeparator(label?: string): void {
  const line = '='.repeat(100);
  const logLine = label ? `\n${line}\n  ${label}\n${line}\n` : `\n${line}\n`;

  fs.appendFileSync(LOG_FILE_PATH, logLine, 'utf-8');
  console.log(logLine);
}
