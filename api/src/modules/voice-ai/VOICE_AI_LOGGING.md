# Voice AI Call Logging - Debugging Guide

## Overview

Comprehensive real-time logging has been implemented for the Voice AI module to help debug calls step-by-step. All call events are logged to a dedicated file with detailed information about:

- What's being sent to the AI agent
- How the agent is responding
- What APIs we're calling
- Who we're calling/transferring to
- What data and settings are being used
- Request and response details for each step

## Log File Location

**Main Log File**: `/var/www/lead360.app/logs/voice-ai-calls.log`

This file contains:
- Structured, timestamped log entries
- Color-coded output (visible in terminal with ANSI support)
- Complete conversation flow from start to finish
- All tool calls, transfers, and errors

## Real-Time Monitoring

### Watch Logs During a Call

```bash
# Basic tail (last 50 lines, follow new entries)
tail -f -n 50 /var/www/lead360.app/logs/voice-ai-calls.log

# Filter for specific tenant
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "tenant:YOUR_TENANT_ID"

# Filter for specific call
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "call:CA_XXXXXXXX"

# Show only user speech (STT)
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "STT"

# Show only agent responses (LLM)
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "LLM"

# Show only transfers
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "TRANSFER"

# Show only tool calls
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "TOOL_CALL"

# Show only errors
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "ERROR"

# Multi-grep: Show STT and LLM only
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep -E "(STT|LLM)"
```

### Advanced Filtering

```bash
# Show everything for a specific call, excluding DEBUG level
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "call:CA_12345" | grep -v "DEBUG"

# Show only important events (INFO, WARN, ERROR, SUCCESS)
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep -E "(INFO|WARN|ERROR|SUCCESS)"

# Show conversation flow (STT user input + LLM responses)
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep -E "(User said|Agent response)"

# Show call lifecycle events
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep -E "(JOB_START|JOB_END|SESSION)"
```

## Log Entry Structure

Each log entry follows this format:

```
[TIMESTAMP] [LEVEL] [CATEGORY] [tenant:ID] [call:SID] MESSAGE
  Data: { structured JSON data }
```

### Example Log Entry

```
[2026-02-26T10:30:45.123Z] [INFO] [STT] [tenant:123] [call:CA_abc123] 🎤 User said: "I need help with my order"
  Data: {
    "is_final": true,
    "confidence": 0.95,
    "length": 28
  }
```

## Log Levels

| Level | Color | Purpose |
|-------|-------|---------|
| `INFO` | Blue | General information about call flow |
| `DEBUG` | Cyan | Detailed debugging information (verbose) |
| `WARN` | Yellow | Warnings that don't stop the call |
| `ERROR` | Red | Errors that affect call quality/functionality |
| `SUCCESS` | Green | Successful operations (call complete, transfer done) |

## Log Categories

| Category | What It Logs |
|----------|--------------|
| `JOB_START` | New call initiated, job metadata |
| `JOB_END` | Call completed or failed, duration, outcome |
| `CONTEXT_LOAD` | Tenant context loaded (quota, providers, settings) |
| `AGENT_INIT` | Agent initialized with providers and tools |
| `ROOM_CONNECTION` | LiveKit room connection established |
| `STT` | Speech-to-text events (what user said) |
| `LLM` | Language model requests and responses |
| `TTS` | Text-to-speech synthesis (what agent said) |
| `TOOL_CALL` | Function/tool executions (find_lead, create_lead, transfer_call) |
| `TRANSFER` | Call transfer requests and executions |
| `LEAD` | Lead creation or lookup events |
| `ERROR` | Error events with stack traces |
| `SESSION` | Session lifecycle events |
| `QUOTA` | Quota checks and overage warnings |
| `PROVIDER` | Provider initialization (STT, LLM, TTS) |

## What Gets Logged

### 1. Call Start
- Job ID and metadata
- Room name and participants
- Tenant ID and call SID extraction

### 2. Context Loading
- Tenant information
- Quota (minutes included, minutes used, overage allowed)
- Agent behavior (name, greeting, language, system prompt preview)
- Providers (STT, LLM, TTS configurations)
- Service count, service area count, transfer numbers count

### 3. Agent Initialization
- STT provider (name, config, language)
- LLM provider (name, model)
- TTS provider (name, voice ID, config)
- Available tools (list of function names)

### 4. Room Connection
- Room name
- Participant count
- Audio track subscription events

### 5. Speech-to-Text (STT)
- **Every transcript** (interim and final)
- User utterances
- Confidence scores
- Transcript length

### 6. Language Model (LLM)
- **Request sent to LLM**:
  - Model name
  - Message count
  - Message preview (first 200 chars)
- **Response from LLM**:
  - Agent response text
  - Tool calls requested (if any)
  - Tool parameters

### 7. Text-to-Speech (TTS)
- Text being synthesized
- Voice ID used
- Audio bytes generated
- Frame count and duration

### 8. Tool Calls
- Tool name
- Parameters passed
- Result returned
- Errors (if any)

**Specific tools logged**:
- `find_lead` - Lead lookup
- `create_lead` - New lead creation
- `transfer_call` - Call transfer request
- `check_service_area` - Service area validation

### 9. Transfers
- **Transfer Request**:
  - Reason for transfer
  - Department (if specified)
- **Transfer Execution**:
  - Target phone number
  - From number
  - SIP participant details
  - LiveKit room settings

### 10. Lead Actions
- Lead found (ID, data)
- Lead created (ID, data)

### 11. Errors
- Error message
- Error context (where it occurred)
- Stack trace
- Error name

### 12. Call End
- Success or failure
- Call duration (milliseconds)
- Outcome (completed, transferred, error, etc.)
- Actions taken during call

## Debugging Common Issues

### Issue: Transfer Not Working

**What to look for**:
```bash
# Watch transfer-related logs
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "TRANSFER"
```

**What you should see**:
1. `[TOOL_CALL]` - Transfer tool executed with reason
2. `[TRANSFER]` - Transfer requested
3. `[TRANSFER]` - Transfer execution with phone number
4. `[SESSION]` - Transfer completed

**Missing steps indicate where the issue is**.

### Issue: Agent Not Responding

**What to look for**:
```bash
# Watch STT and LLM logs
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep -E "(STT|LLM)"
```

**Expected flow**:
1. `[STT]` - User said: "..."
2. `[LLM]` - Sending request to LLM
3. `[LLM]` - Agent response: "..."
4. `[TTS]` - Generating speech: "..."

**If STT not showing**: Audio pipeline issue
**If LLM not responding**: API key or quota issue
**If TTS failing**: Voice provider issue

### Issue: Wrong Data Being Sent

**What to look for**:
```bash
# Check context loading
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "CONTEXT_LOAD"
```

**Check**:
- Tenant info correct?
- Providers configured?
- System prompt loaded?
- Transfer numbers available?

### Issue: Call Crashing

**What to look for**:
```bash
# Find errors
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "ERROR"
```

**Check**:
- Error message and context
- Stack trace for code location
- What operation failed

## Log Rotation

The log file can grow large over time. Consider implementing log rotation:

```bash
# Manual rotation
mv /var/www/lead360.app/logs/voice-ai-calls.log /var/www/lead360.app/logs/voice-ai-calls.log.$(date +%Y%m%d)
touch /var/www/lead360.app/logs/voice-ai-calls.log
```

**Recommended**: Use `logrotate` for automatic rotation:

```bash
# /etc/logrotate.d/voice-ai-calls
/var/www/lead360.app/logs/voice-ai-calls.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 www-data www-data
    sharedscripts
    postrotate
        # Signal PM2 to reopen log files if needed
    endscript
}
```

## Testing the Logging

### Make a Test Call

1. Start tailing the log:
```bash
tail -f -n 100 /var/www/lead360.app/logs/voice-ai-calls.log
```

2. Initiate a voice AI call through Twilio

3. You should see:
   - `🆕 NEW CALL STARTING` separator
   - Job start with metadata
   - Context loading
   - Provider initialization
   - Room connection
   - Greeting TTS
   - STT session starting
   - Real-time user speech transcription
   - LLM requests and responses
   - TTS synthesis
   - Any tool calls
   - Transfer events (if applicable)
   - `✅ CALL COMPLETED` or `❌ CALL FAILED` separator

### Sample Complete Call Flow

```
================================================================================
  🆕 NEW CALL STARTING - Job ID: job_abc123
================================================================================

[2026-02-26T10:30:00.000Z] [INFO] [JOB_START] [tenant:t123] [call:CA_abc] 📞 New Voice AI job received
  Data: { job_id: "job_abc123", room_name: "room_xyz", ... }

[2026-02-26T10:30:00.100Z] [INFO] [ROOM_CONNECTION] [tenant:t123] [call:CA_abc] 🔗 Connecting to LiveKit room...

[2026-02-26T10:30:00.500Z] [INFO] [ROOM_CONNECTION] [tenant:t123] [call:CA_abc] 🔗 Connected to LiveKit room
  Data: { room_name: "room_xyz", participant_count: 1 }

[2026-02-26T10:30:00.600Z] [INFO] [CONTEXT_LOAD] [tenant:t123] [call:CA_abc] 📋 Loading tenant context...

[2026-02-26T10:30:01.000Z] [INFO] [CONTEXT_LOAD] [tenant:t123] [call:CA_abc] 📋 Context loaded for tenant
  Data: { tenant_name: "Acme Corp", quota: {...}, providers: {...}, ... }

[2026-02-26T10:30:01.100Z] [DEBUG] [PROVIDER] [tenant:t123] [call:CA_abc] 🔌 STT provider initialized: deepgram
  Data: { provider_type: "STT", provider_name: "deepgram", config: {...} }

[2026-02-26T10:30:01.200Z] [DEBUG] [PROVIDER] [tenant:t123] [call:CA_abc] 🔌 LLM provider initialized: openai
  Data: { provider_type: "LLM", provider_name: "openai", config: {...} }

[2026-02-26T10:30:01.300Z] [DEBUG] [PROVIDER] [tenant:t123] [call:CA_abc] 🔌 TTS provider initialized: cartesia
  Data: { provider_type: "TTS", provider_name: "cartesia", config: {...} }

[2026-02-26T10:30:01.400Z] [DEBUG] [TTS] [tenant:t123] [call:CA_abc] 🔊 Generating speech: "Hello! How can I help you today?"

[2026-02-26T10:30:02.000Z] [DEBUG] [STT] [tenant:t123] [call:CA_abc] 🎤 User said: "I need help"
  Data: { is_final: true, confidence: 0.95 }

[2026-02-26T10:30:02.100Z] [DEBUG] [LLM] [tenant:t123] [call:CA_abc] 🧠 Sending request to LLM
  Data: { model: "gpt-4o", message_count: 2 }

[2026-02-26T10:30:02.500Z] [DEBUG] [LLM] [tenant:t123] [call:CA_abc] 🧠 Agent response: "I'd be happy to help! What do you need assistance with?"

[2026-02-26T10:30:02.600Z] [DEBUG] [TTS] [tenant:t123] [call:CA_abc] 🔊 Generating speech: "I'd be happy to help!..."

... more conversation ...

[2026-02-26T10:30:45.000Z] [INFO] [TOOL_CALL] [tenant:t123] [call:CA_abc] 🔧 Tool executed: transfer_call
  Data: { tool: "transfer_call", parameters: { reason: "Customer wants to speak to sales" }, result: {...} }

[2026-02-26T10:30:45.100Z] [INFO] [TRANSFER] [tenant:t123] [call:CA_abc] 📞 Transfer requested
  Data: { reason: "Customer wants to speak to sales" }

[2026-02-26T10:30:45.500Z] [SUCCESS] [TRANSFER] [tenant:t123] [call:CA_abc] 📲 Transferring call to +15551234567
  Data: { to_number: "+15551234567", settings: {...} }

[2026-02-26T10:30:46.000Z] [SUCCESS] [JOB_END] [tenant:t123] [call:CA_abc] ✅ Call completed successfully
  Data: { duration_ms: 46000, outcome: "transferred" }

================================================================================
  ✅ CALL COMPLETED - Duration: 46.00s
================================================================================
```

## Troubleshooting

### Logs Not Appearing

**Check**:
1. Log file exists: `ls -la /var/www/lead360.app/logs/voice-ai-calls.log`
2. File permissions: `chmod 644 /var/www/lead360.app/logs/voice-ai-calls.log`
3. Directory permissions: `chmod 755 /var/www/lead360.app/logs`
4. PM2 logs: `pm2 logs api`

### Colors Not Showing

Colors require ANSI support. Use:
```bash
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | cat
```

Or view raw file:
```bash
less -R /var/www/lead360.app/logs/voice-ai-calls.log
```

### Too Much Output

Reduce verbosity by filtering out DEBUG:
```bash
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep -v "DEBUG"
```

Or only show errors and warnings:
```bash
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep -E "(ERROR|WARN)"
```

## Performance Notes

- Logging is **synchronous** to ensure reliability during crashes
- Log writes are **append-only** for performance
- Each log entry is ~200-500 bytes (varies with data)
- Expect ~10-50 KB per minute-long call
- For high-volume production, consider async logging or separate log workers

## Additional PM2 Logs

Voice AI also logs to PM2's console:
```bash
# View all API logs
pm2 logs api

# Filter for voice AI
pm2 logs api | grep "VoiceAgent"

# Filter for specific log level
pm2 logs api --err  # Errors only
```

## Next Steps

1. **Start monitoring**: Run the tail command before making a test call
2. **Make a test call**: Dial your Twilio number that routes to Voice AI
3. **Watch the logs**: See every step of the conversation in real-time
4. **Debug issues**: Use category filters to narrow down problems
5. **Share logs**: Copy relevant log sections when reporting issues

---

**Happy Debugging! 🚀**
