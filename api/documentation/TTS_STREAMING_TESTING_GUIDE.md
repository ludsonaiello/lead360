# TTS Streaming Testing Guide

**Quick Reference for Testing WebSocket-based Streaming TTS**

---

## Quick Test (30 seconds)

1. **Make a test call** to your Voice AI phone number

2. **Listen for greeting**:
   - Should start playing within **500ms** of call connecting
   - Check logs for: `🎙️  Playing greeting via streaming TTS`

3. **Ask a simple question**: "What are your business hours?"
   - Agent should start responding within **500ms**
   - Check logs for: `🎙️  Streaming response to TTS`

4. **Test barge-in**: Interrupt the agent mid-sentence
   - Agent should stop talking within **200ms**
   - Check logs for: `🛑 Barge-in detected`

---

## Log Monitoring Commands

### Watch Live Logs
```bash
# API logs (includes WebSocket TTS events)
tail -f /var/www/lead360.app/logs/api_error.log | grep -E "(WebSocket|TTS|Streaming|Barge-in)"

# VoiceAI structured logs
tail -f /var/www/lead360.app/logs/api_error.log | grep "voiceai_session"
```

### Search for WebSocket Events
```bash
# Check if WebSocket TTS is initializing
grep "Connecting to Cartesia WebSocket" /var/www/lead360.app/logs/api_error.log | tail -20

# Check for successful connections
grep "WebSocket TTS connection established" /var/www/lead360.app/logs/api_error.log | tail -20

# Check for errors
grep "WebSocket error" /var/www/lead360.app/logs/api_error.log | tail -20

# Check for reconnections
grep "Attempting reconnect" /var/www/lead360.app/logs/api_error.log | tail -20
```

### Verify Streaming is Working
```bash
# Should see these messages during a call
grep "Streaming response to TTS" /var/www/lead360.app/logs/api_error.log | tail -20
grep "Streaming follow-up response to TTS" /var/www/lead360.app/logs/api_error.log | tail -20
```

---

## Expected Log Sequence (Normal Call)

```
# Session Start
✅ Published audio track to room
🚀 Initializing WebSocket streaming TTS...
🔌 Connecting to Cartesia WebSocket TTS...
  Model: sonic-3
  Voice ID: [voice-id]
  Language: en
  Sample Rate: 16000Hz
✅ WebSocket TTS connection established
✅ WebSocket streaming TTS initialized

# Greeting
🎙️  Playing greeting via streaming TTS (context: greeting-123456789)
📤 Streaming text: "Hello! How can I help you today?", context: greeting-123456789, final: true
📨 Received message type: chunk, context: greeting-123456789
🔊 Audio chunk: 4096 bytes, context: greeting-123456789, done: false
[more audio chunks...]
✅ TTS complete for context: greeting-123456789
✅ Greeting playback complete

# User speaks
User said: What are your business hours?

# Agent responds (streaming)
🎙️  Streaming response to TTS (context: turn-123456790)
📤 Streaming text: "We're", context: turn-123456790, final: false
📨 Received message type: chunk, context: turn-123456790
🔊 Audio chunk: 2048 bytes, context: turn-123456790, done: false
📤 Streaming text: " open", context: turn-123456790, final: false
📨 Received message type: chunk, context: turn-123456790
[streaming continues...]
📤 Streaming text: "", context: turn-123456790, final: true
✅ TTS complete for context: turn-123456790
Assistant: We're open Monday to Friday, 9 AM to 5 PM.
```

---

## Latency Measurement

### Manual Timing
1. **Record call audio** using LiveKit recording or phone recording
2. **Use Audacity or similar tool** to analyze waveform
3. **Measure time gaps**:
   - User finishes speaking → Agent starts speaking
   - Should be **300-500ms** (vs old 2-10 seconds)

### Log-Based Timing
```bash
# Extract timestamps from logs
grep -E "(User said|Streaming response to TTS|TTS complete)" /var/www/lead360.app/logs/api_error.log | tail -50
```

Look for patterns like:
```
[2026-02-27 10:15:30.123] User said: What are your hours?
[2026-02-27 10:15:30.456] 🎙️  Streaming response to TTS (context: turn-123)
[2026-02-27 10:15:32.789] ✅ TTS complete for context: turn-123
```

Time between "User said" and "Streaming response" should be **<500ms**.

---

## Barge-In Testing

### Test Scenario
1. Ask agent a question that generates a long response
   - Example: "Tell me about all your services"
2. Let agent start speaking (1-2 seconds)
3. Interrupt with: "Stop" or "Wait"
4. Agent should stop immediately

### Expected Logs
```
[Time 1] 🎙️  Streaming response to TTS (context: turn-123)
[Time 2] 🛑 Barge-in detected: User interrupted with "Stop"
[Time 2] 🛑 Cancelling TTS generation for context: turn-123
[Time 2] User said: Stop
```

Time between barge-in detection and cancellation should be **<10ms**.

---

## Common Issues & Troubleshooting

### Issue: No audio playback (silence)

**Check**:
```bash
# Verify WebSocket connected
grep "WebSocket TTS connection established" /var/www/lead360.app/logs/api_error.log | tail -5

# Check for audio chunks
grep "Audio chunk" /var/www/lead360.app/logs/api_error.log | tail -20

# Check for errors
grep -i "error" /var/www/lead360.app/logs/api_error.log | tail -50
```

**Possible Causes**:
- WebSocket failed to connect (check API key)
- Cartesia API is down (check status page)
- Audio source not initialized

---

### Issue: High latency (still slow)

**Check**:
```bash
# Verify streaming is being used (not old HTTP TTS)
grep "Streaming response to TTS" /var/www/lead360.app/logs/api_error.log | tail -10

# If no results, WebSocket TTS might not be initializing
grep "WebSocket streaming TTS initialized" /var/www/lead360.app/logs/api_error.log | tail -5
```

**Possible Causes**:
- WebSocket TTS failed to initialize (check logs for errors during startup)
- Falling back to old HTTP TTS (check for "TTS Request Configuration" logs)
- Network latency between server and Cartesia API

---

### Issue: Barge-in not working

**Check**:
```bash
# Verify barge-in detection
grep "Barge-in detected" /var/www/lead360.app/logs/api_error.log | tail -10

# Check if isAgentSpeaking state is set
grep "🎙️  Streaming" /var/www/lead360.app/logs/api_error.log | tail -20
```

**Possible Causes**:
- `isAgentSpeaking` not set correctly
- STT not delivering final transcripts during agent speech
- WebSocket cancel not working (check Cartesia API docs)

---

### Issue: WebSocket disconnects frequently

**Check**:
```bash
# Count disconnects
grep "WebSocket closed" /var/www/lead360.app/logs/api_error.log | wc -l

# Check reconnection attempts
grep "Attempting reconnect" /var/www/lead360.app/logs/api_error.log | tail -20
```

**Possible Causes**:
- Network instability
- Cartesia rate limiting
- 5-minute inactivity timeout (for long silent calls)

**Solution**:
- Automatic reconnection should handle this
- If reconnects fail, check API key validity

---

## Performance Benchmarks

### Expected Metrics (Healthy System)

| Metric | Target | Measured |
|--------|--------|----------|
| WebSocket connection time | <1s | _____ |
| Greeting first audio | <500ms | _____ |
| Response first audio | <500ms | _____ |
| Barge-in response time | <200ms | _____ |
| WebSocket disconnects/hour | <1 | _____ |
| Audio chunk size (average) | 2-8KB | _____ |

Fill in "Measured" column during testing.

---

## Debug Mode

To enable detailed WebSocket message logging:

1. Edit `cartesia-websocket-tts.provider.ts`
2. Change all `this.logger.debug()` to `this.logger.log()`
3. Rebuild: `npm run build`
4. Restart: `pm2 restart api`

You'll now see every WebSocket message:
```
📨 Received message type: chunk, context: turn-123
📤 Streaming text: "Hello", context: turn-123, final: false
```

**Warning**: This generates a LOT of logs. Revert after debugging.

---

## Production Monitoring

### Daily Health Check
```bash
# Run this daily to check for issues
cd /var/www/lead360.app

# Count successful WebSocket connections today
grep "$(date +%Y-%m-%d)" logs/api_error.log | grep "WebSocket TTS connection established" | wc -l

# Count errors today
grep "$(date +%Y-%m-%d)" logs/api_error.log | grep -i "websocket error" | wc -l

# Count reconnections today
grep "$(date +%Y-%m-%d)" logs/api_error.log | grep "Attempting reconnect" | wc -l
```

### Alert Thresholds
- **WebSocket errors > 10/day**: Investigate API connectivity
- **Reconnections > 20/day**: Check network stability
- **No streaming logs for 1 hour**: WebSocket TTS might not be initializing

---

## Rollback Procedure (Emergency)

If issues arise and you need to revert to old HTTP TTS:

```bash
cd /var/www/lead360.app/api

# Option 1: Git revert (recommended)
git revert HEAD  # Reverts last commit
npm run build
pm2 restart api

# Option 2: Quick disable (temporary)
# Edit src/modules/voice-ai/agent/voice-agent.session.ts
# Comment out lines 260-293 (WebSocket TTS initialization)
# Comment out streaming in handleUtterance() (lines 434-478, 498-527)
npm run build
pm2 restart api
```

Calls will use old HTTP TTS (slower but stable).

---

## Support Resources

**Cartesia API Documentation**: https://docs.cartesia.ai/
**WebSocket TTS API**: https://docs.cartesia.ai/websocket-api

**Implementation Files**:
- Provider: `api/src/modules/voice-ai/agent/providers/cartesia-websocket-tts.provider.ts`
- Session: `api/src/modules/voice-ai/agent/voice-agent.session.ts`
- Interface: `api/src/modules/voice-ai/agent/providers/tts.interface.ts`

**Documentation**:
- Implementation Summary: `api/documentation/TTS_LATENCY_OPTIMIZATION_IMPLEMENTATION.md`
- Sprint Plan: `TTS_LATENCY_OPTIMIZATION_SPRINTS.md` (provided document)

---

**End of Testing Guide**
