# Voice AI Log Viewer Tools

Two tools for viewing Voice AI logs during development:

## 🎯 Quick Access: `va-logs`

Fast one-liner commands from anywhere in the terminal.

### Usage

```bash
va-logs [option]
```

### Common Commands

```bash
# View all logs
va-logs
va-logs all

# View conversation only (what user said + agent responses)
va-logs conv

# View speech-to-text transcriptions
va-logs stt

# View LLM requests/responses
va-logs llm

# View text-to-speech synthesis
va-logs tts

# View tool executions (check_service_area, find_lead, etc.)
va-logs tools

# View errors only
va-logs errors

# View clean conversation flow (production-like)
va-logs clean

# View last 50 lines
va-logs last

# View last 100 lines
va-logs last 100

# Search for a term
va-logs search "transfer"
va-logs search "error"
va-logs search "01453"

# Show help
va-logs help
```

### Examples

**During development, watching a live call:**
```bash
va-logs conv
```

**Debugging STT issues:**
```bash
va-logs stt
```

**Debugging tool execution:**
```bash
va-logs tools
```

**Quick error check:**
```bash
va-logs errors
```

---

## 📊 Interactive Menu: `voice-ai-logs.sh`

Full-featured interactive menu with 15+ viewing options.

### Usage

```bash
cd /var/www/lead360.app
./scripts/voice-ai-logs.sh
```

### Features

**Real-Time Views:**
1. All Voice AI logs
2. Conversation only (user + agent)
3. STT (Speech-to-Text) only
4. LLM requests/responses only
5. TTS (Text-to-Speech) only
6. Tool executions only
7. Errors only
8. Call lifecycle (start/end/transfer)
9. Session events (audio tracks, etc.)
10. Clean conversation flow

**Special Views:**
11. View last N lines
12. View specific call (by SID)
13. Multi-terminal view (3 panels)
14. Search logs

**Utilities:**
15. Clear logs

### Screenshots

```
╔════════════════════════════════════════════════════════════════════╗
║              Voice AI Log Viewer - Lead360                         ║
╚════════════════════════════════════════════════════════════════════╝

┌─ Real-Time Views
│
  1) 📊 All Voice AI logs
  2) 💬 Conversation only (user + agent)
  3) 🎤 STT (Speech-to-Text) only
  4) 🧠 LLM requests/responses only
  5) 🔊 TTS (Text-to-Speech) only
  6) 🔧 Tool executions only
  7) ❌ Errors only
  8) 📞 Call lifecycle (start/end/transfer)
  9) 📡 Session events (audio tracks, etc.)
 10) ✨ Clean conversation flow

┌─ Special Views
│
 11) 📜 View last N lines
 12) 🔍 View specific call (by SID)
 13) 🖥️  Multi-terminal view (3 panels)
 14) 🔎 Search logs

┌─ Utilities
│
 15) 🗑️  Clear logs
  q) Quit

Select an option:
```

---

## 🔥 Recommended Workflows

### Development Workflow 1: Single Terminal

**Watch conversation in real-time:**
```bash
va-logs conv
```

Then make a test call and watch the conversation flow.

---

### Development Workflow 2: Split Terminal

**Terminal 1 - Conversation:**
```bash
va-logs conv
```

**Terminal 2 - Errors:**
```bash
va-logs errors
```

---

### Development Workflow 3: Multi-Panel (tmux/screen)

**Use the interactive menu:**
```bash
./scripts/voice-ai-logs.sh
# Select option 13: Multi-terminal view
```

This opens 3 panels:
- Panel 1: Full logs
- Panel 2: Conversation only
- Panel 3: Errors & warnings

---

### Development Workflow 4: Server + Voice AI Logs

**Terminal 1 - NestJS Server:**
```bash
cd /var/www/lead360.app/api
npm run start:dev
```

**Terminal 2 - Voice AI Logs:**
```bash
va-logs conv
```

---

## 📋 Log Format

Voice AI logs are structured with:

```
[timestamp] [level] [category] [tenant:ID] [call:SID] message
  Data: { json details }
```

**Example:**
```
[2026-02-27T14:49:23.456Z] [INFO] [JOB_START] [tenant:123] [call:CA_abc] 📞 New Voice AI job received
  Data: {
    "job_id": "JB_xyz",
    "metadata": { ... }
  }

[2026-02-27T14:49:24.123Z] [DEBUG] [STT] [tenant:123] [call:CA_abc] 🎤 User said: "Hello"
  Data: {
    "is_final": true,
    "confidence": 0.98,
    "length": 5
  }

[2026-02-27T14:49:24.789Z] [DEBUG] [LLM] [tenant:123] [call:CA_abc] 🧠 Agent response: "Hi! How can I help?"
  Data: {
    "response_length": 21,
    "has_tool_calls": false
  }
```

---

## 🎨 Log Categories

| Category | Icon | Description |
|----------|------|-------------|
| **JOB_START** | 📞 | New call job received |
| **JOB_END** | ✅/❌ | Call completed/failed |
| **CONTEXT_LOAD** | 📋 | Tenant context loaded |
| **AGENT_INIT** | 🤖 | Agent initialized |
| **ROOM_CONNECTION** | 🔗 | Connected to LiveKit |
| **STT** | 🎤 | Speech-to-text transcription |
| **LLM** | 🧠 | Language model request/response |
| **TTS** | 🔊 | Text-to-speech synthesis |
| **TOOL_CALL** | 🔧 | Tool execution |
| **TRANSFER** | 📞 | Call transfer |
| **LEAD** | 👤 | Lead lookup/creation |
| **ERROR** | ❌ | Error occurred |
| **SESSION** | 📡 | Session events |
| **QUOTA** | 💳 | Quota check |
| **PROVIDER** | 🔌 | Provider initialization |

---

## 🔍 Filtering Examples

### Manual grep filtering

```bash
# View only final transcripts (skip interim results)
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "is_final.*true"

# View only tool calls for a specific tool
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "check_service_area"

# View all events for tenant 123
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep "tenant:123"

# View conversation + tool calls (clean flow)
tail -f /var/www/lead360.app/logs/voice-ai-calls.log | grep -E "User said|Agent response|Tool executed"
```

---

## 💡 Tips

1. **Color output works best in modern terminals** (supports ANSI colors)
2. **Use Ctrl+C to exit any real-time view**
3. **Logs persist across server restarts** (useful for debugging)
4. **Clear logs before testing** to avoid confusion: `va-logs` → option 15
5. **Multi-terminal view requires tmux or gnome-terminal** - install with `sudo apt install tmux`

---

## 📦 Log File Locations

```
/var/www/lead360.app/logs/
├── voice-ai-calls.log        # 🎯 Structured Voice AI logs (use va-logs to view)
├── api_access.log            # HTTP access logs
├── api_error.log             # API errors
├── app_access.log            # Next.js access logs
├── app_error.log             # Next.js errors
├── tenants_access.log        # Tenant subdomain logs
└── tenants_error.log         # Tenant subdomain errors
```

---

## 🚀 Quick Start

**Option A: Quick one-liner (recommended for most cases)**
```bash
va-logs conv
```

**Option B: Interactive menu (for advanced filtering)**
```bash
./scripts/voice-ai-logs.sh
```

**Option C: Manual tail (classic approach)**
```bash
tail -f /var/www/lead360.app/logs/voice-ai-calls.log
```

---

## 🆘 Troubleshooting

**Log file doesn't exist?**
- Make a test call first - the log file is created on first call

**No color output?**
- Your terminal may not support ANSI colors
- Use a modern terminal like gnome-terminal, iTerm2, or Alacritty

**Script not found?**
- Ensure you're in `/var/www/lead360.app` directory
- Or use the global command: `va-logs`

**Multi-terminal view doesn't work?**
- Install tmux: `sudo apt install tmux`
- Or use `va-logs conv` in separate terminal windows manually

---

**Happy debugging! 🎉**
