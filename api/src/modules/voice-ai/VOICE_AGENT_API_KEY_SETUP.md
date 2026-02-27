# Voice Agent API Key Setup Guide

## Overview

The Voice Agent API Key is used to authenticate HTTP requests from voice agent **child processes** back to the Lead360 API. This key is required because the LiveKit agent sessions run in separate child processes that cannot access NestJS services directly.

## Architecture

```
NestJS Parent Process (voice-agent.service.ts)
  └─> Spawns Child Process for each call
        └─> voice-agent-entrypoint.ts
              └─> Makes HTTP calls to API
                    └─> Authenticated with X-Voice-Agent-Key header
```

## Security Design

The agent API key uses a **hash-only** storage approach (similar to password hashing):

1. **Generation**: A random UUID is generated as the plain key
2. **Hashing**: SHA-256 hash is computed and stored in DB (`agent_api_key_hash`)
3. **Preview**: Last 4 characters stored for UI display (`agent_api_key_preview`)
4. **Plain Key**: Returned ONCE to admin, **never stored anywhere**

### Why Not Encrypt Instead?

Unlike LiveKit credentials (which are encrypted and can be decrypted), the agent API key is designed as a **deployment secret** similar to JWT_SECRET:

- **LiveKit keys**: Need to be decrypted by NestJS to connect to LiveKit
- **Agent key**: Only needs to be verified (hash comparison is sufficient)
- **Design intent**: Set once during deployment, not frequently regenerated

## Current Limitation

**The agent API key cannot be seamlessly regenerated via UI.**

If you regenerate the key through the Admin UI:
1. ✅ DB hash is updated immediately
2. ❌ `.env` file is NOT updated automatically
3. ❌ NestJS server must be restarted manually
4. ❌ All existing agent sessions will fail authentication until restart

### Why This Happens

The child processes inherit environment variables from the parent NestJS process at startup. When the parent starts, it reads `VOICE_AGENT_API_KEY` from `.env`. Child processes then use this value to make HTTP requests.

If the key is regenerated while the server is running:
- Parent process still has old key in memory (from original .env read)
- Child processes inherit old key from parent
- API validates against new hash in DB
- **Result**: Authentication failures

## Setup Instructions

### Initial Setup

1. **Generate the key via Admin UI endpoint**:
   ```bash
   curl -X POST https://api.lead360.app/api/v1/system/voice-ai/config/regenerate-key \
     -H "Authorization: Bearer <admin-jwt-token>"
   ```

   Response:
   ```json
   {
     "plain_key": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
     "preview": "...xxxx",
     "warning": "Save this key now. It will not be shown again."
   }
   ```

2. **Copy the plain_key value** (you'll never see it again!)

3. **Add to .env file**:
   ```bash
   # In /var/www/lead360.app/api/.env
   VOICE_AGENT_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
   ```

4. **Restart NestJS**:
   ```bash
   # Development
   npm run start:dev

   # Production (if using PM2)
   pm2 restart lead360-api
   ```

5. **Verify** - Check logs for successful agent startup:
   ```
   [VoiceAgentService] Voice AI agent worker started successfully
   ```

### Regenerating the Key (Requires Manual Steps)

If you need to regenerate the key:

1. **Generate new key** via Admin UI (same endpoint as above)
2. **Copy the new plain_key**
3. **Update .env file** with new key
4. **Restart NestJS server** (otherwise child processes will use old key)
5. **All existing calls will be dropped** during restart

⚠️ **Production Warning**: Regenerating the key requires server downtime. Plan accordingly.

## Future Enhancement Proposal

To support seamless key rotation without server restart:

### Option 1: Encrypted Storage (Recommended)

Add encrypted storage field to database:

```prisma
model voice_ai_global_config {
  agent_api_key_hash      String?  @db.VarChar(128)  // For verification (existing)
  agent_api_key_encrypted String?  @db.LongText       // For decryption (NEW)
  agent_api_key_preview   String?  @db.VarChar(10)   // For UI display (existing)
}
```

Flow:
1. Admin regenerates key
2. Service encrypts plain key and stores in `agent_api_key_encrypted`
3. Also stores hash in `agent_api_key_hash` (for verification)
4. Parent process periodically refreshes config and decrypts key
5. Passes decrypted key to child processes when spawned
6. No .env update required, no server restart required

### Option 2: Dynamic Environment Injection

Parent process reads config from DB and dynamically sets environment variables for child processes:

```typescript
// In startWorker()
const plainKey = await this.decryptAgentKey(); // New method
process.env.VOICE_AGENT_API_KEY = plainKey;
// Spawn child process - inherits updated env var
```

## Verification

To verify the key is working:

1. **Check agent startup logs**:
   ```bash
   tail -f /var/www/lead360.app/logs/api_error.log | grep VoiceAgent
   ```

2. **Make a test call** - Agent should successfully authenticate HTTP requests

3. **Check for auth errors** in logs:
   ```
   [API Client] POST /api/v1/internal/voice-ai/lookup-tenant failed: 401
   ```
   If you see 401 errors, the key is incorrect.

## Troubleshooting

### Problem: "X-Voice-Agent-Key header required"
- **Cause**: `VOICE_AGENT_API_KEY` not set in .env
- **Fix**: Add the key to .env and restart

### Problem: "Invalid agent key"
- **Cause**: Key in .env doesn't match hash in DB
- **Fix**: Regenerate key and update .env, or restore correct key

### Problem: Agent works after restart, then fails
- **Cause**: Key was regenerated via UI without updating .env
- **Fix**: Update .env with current key (from original regenerate response) and restart

## Security Best Practices

1. **Never commit .env to version control** - Use .env.example as template
2. **Rotate key periodically** - Schedule maintenance window for rotation
3. **Store key securely** - Use secrets manager in production (AWS Secrets Manager, HashiCorp Vault)
4. **Monitor authentication failures** - Alert on 401 errors from voice agent
5. **Document key location** - Ensure ops team knows where to find it

## Related Files

- `/api/.env` - Environment variables (including VOICE_AGENT_API_KEY)
- `/api/src/modules/voice-ai/guards/voice-agent-key.guard.ts` - Validates key
- `/api/src/modules/voice-ai/services/voice-ai-global-config.service.ts` - Manages key generation
- `/api/src/modules/voice-ai/agent/utils/api-config.ts` - Reads key from env
- `/api/src/modules/voice-ai/agent/utils/api-client.ts` - Sends key in X-Voice-Agent-Key header

## Questions?

Contact the Lead360 development team or refer to:
- Sprint VAB-03 documentation
- Voice AI architecture documentation
- Platform security guidelines
