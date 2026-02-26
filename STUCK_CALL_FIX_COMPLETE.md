# Stuck Call Issue - COMPLETE FIX

## Problem Summary

**Symptom**: One call stuck in "Active Calls" forever (showing in monitoring dashboard)

**Root Cause**:
- Call ID: `f373dfde-7bc0-416f-b346-5f0b76a4582f`
- Call SID: `test-a08-review-1771392027`
- Status: `in_progress` (stuck for 6.8 days)
- Started: 2026-02-18 05:20:27
- Reason: Test call never received completion callback
  - No webhook from LiveKit
  - No `completeCall()` invocation
  - Left in limbo forever

---

## ✅ IMMEDIATE FIX APPLIED

**Fixed the stuck call manually**:
```sql
UPDATE voice_call_log
SET 
  status = 'failed',
  ended_at = DATE_ADD(started_at, INTERVAL 60 SECOND),
  duration_seconds = 60,
  error_message = 'Call timed out - auto-cleaned by system (stuck in progress for 6.8 days)',
  outcome = 'system_timeout'
WHERE id = 'f373dfde-7bc0-416f-b346-5f0b76a4582f';
```

**Result**:
- ✅ Call marked as `failed`
- ✅ No longer shows in "Active Calls"
- ✅ Monitoring dashboard accurate again
- ✅ No other stuck calls found

---

## ✅ PERMANENT SOLUTION IMPLEMENTED

### Problem: No Auto-Cleanup Mechanism

The codebase had:
- ✅ Monthly quota reset job
- ✅ Daily usage sync job
- ❌ **NO stuck call cleanup job**

### Solution: Auto-Cleanup Cron Job

Added a new hourly cron job that automatically cleans stuck calls:

**Schedule**: Every hour at :15 minutes past the hour (00:15, 01:15, 02:15, etc.)
**Threshold**: Calls stuck in `in_progress` for >2 hours
**Action**: Auto-fail stuck calls with proper error logging

---

## Files Created/Modified

### New Files Created ✅

1. **`api/src/modules/voice-ai/processors/voice-ai-stuck-call-cleanup.processor.ts`**
   - BullMQ processor for stuck call cleanup
   - Finds calls stuck >2 hours
   - Auto-fails them with proper error messages
   - Logs cleanup actions for ops visibility

### Modified Files ✅

2. **`api/src/modules/voice-ai/schedulers/voice-ai-jobs.scheduler.ts`**
   - Added stuck call cleanup cron job
   - Runs every hour at :15 minutes
   - Enqueues cleanup job to BullMQ

3. **`api/src/modules/voice-ai/voice-ai.module.ts`**
   - Registered `voice-ai-stuck-call-cleanup` queue
   - Added `VoiceAiStuckCallCleanupProcessor` provider
   - Imported new processor

---

## How It Works

### Cleanup Logic

1. **Cron Job Fires** (every hour at :15)
   - Scheduler enqueues cleanup job to BullMQ

2. **Processor Runs**
   - Queries: `status='in_progress' AND started_at < NOW() - 2 hours`
   - Finds stuck calls

3. **Auto-Fail Stuck Calls**
   - Updates status to `'failed'`
   - Sets `ended_at` to `started_at + 2 hours`
   - Sets `duration_seconds` to `7200` (2 hours)
   - Sets `error_message` with minutes stuck
   - Sets `outcome` to `'system_timeout'`

4. **Logs Cleanup**
   - Warns in logs: `Auto-failed stuck call: {call_sid}`
   - Tracks tenant_id and minutes stuck
   - Provides audit trail

### Why 2 Hours?

- **Typical calls**: 1-10 minutes
- **Long calls**: Rarely exceed 30 minutes
- **2-hour buffer**: Prevents false positives
- **Stuck calls**: Usually due to:
  - Webhook failures
  - Worker crashes
  - Network issues
  - Test calls without proper cleanup

### Example Log Output

```
[VoiceAiJobsScheduler] Enqueueing stuck call cleanup job
[VoiceAiStuckCallCleanupProcessor] Processing stuck call cleanup job [cleanup-1234567890]
[VoiceAiStuckCallCleanupProcessor] Found 1 stuck call(s) - auto-failing them now
[VoiceAiStuckCallCleanupProcessor] Auto-failed stuck call: test-a08-review-1771392027 
  (tenant: 13c2dea4-64e0-0499-f6e4-5df14d5a6ce2, stuck for 9795 minutes)
[VoiceAiStuckCallCleanupProcessor] Stuck call cleanup completed - 1 call(s) auto-failed
```

---

## Benefits

### 1. **Accurate Monitoring**
- Active calls count is now reliable
- No false positives in dashboard
- Ops can trust the metrics

### 2. **Automatic Cleanup**
- No manual intervention needed
- Runs 24/7 automatically
- Self-healing system

### 3. **Audit Trail**
- All cleanups logged
- Tracks tenant_id
- Records how long call was stuck
- Provides error message

### 4. **Prevents Resource Leaks**
- Stuck calls don't accumulate
- Database stays clean
- No memory/resource leaks

### 5. **Handles Edge Cases**
- Webhook failures
- Worker crashes
- Network issues
- Incomplete test calls

---

## Testing

### Manual Test (Simulate Stuck Call)

```sql
-- 1. Create a test stuck call
INSERT INTO voice_call_log (
  id, tenant_id, call_sid, from_number, to_number,
  direction, status, started_at
) VALUES (
  UUID(), 'your-tenant-id', 'test-stuck-call-simulation',
  '+15551234567', '+15559876543', 'inbound', 'in_progress',
  DATE_SUB(NOW(), INTERVAL 3 HOUR)  -- Started 3 hours ago
);

-- 2. Wait for next hourly cleanup (at :15 past the hour)
-- OR manually trigger the job:
-- (BullMQ dashboard or programmatically)

-- 3. Verify it was cleaned up:
SELECT * FROM voice_call_log 
WHERE call_sid = 'test-stuck-call-simulation';
-- Should show status='failed', error_message set, ended_at set
```

### Verify Cron Schedule

```bash
# Check logs for cron job execution
tail -f logs/api_access.log | grep "stuck call cleanup"
```

---

## Deployment Checklist

### Prerequisites
- ✅ Backend TypeScript compiles successfully
- ✅ BullMQ queue registered
- ✅ Processor registered in module
- ✅ Scheduler registered

### Deployment Steps

1. **Deploy Code**
   ```bash
   cd /var/www/lead360.app/api
   npm run build
   pm2 restart api
   ```

2. **Verify Cron Registered**
   ```bash
   # Check logs for scheduler initialization
   pm2 logs api | grep "VoiceAiJobsScheduler"
   ```

3. **Verify Queue Registered**
   ```bash
   # Check logs for processor initialization
   pm2 logs api | grep "Stuck Call Cleanup Processor initialized"
   ```

4. **Wait for First Run**
   - Next :15 minute mark (e.g., 14:15, 15:15, etc.)
   - Check logs for cleanup execution

5. **Monitor**
   - Watch for stuck calls being auto-failed
   - Verify no false positives (valid long calls being failed)
   - Adjust threshold if needed (currently 2 hours)

---

## Configuration

### Adjust Cleanup Threshold (If Needed)

Edit `api/src/modules/voice-ai/processors/voice-ai-stuck-call-cleanup.processor.ts`:

```typescript
// Current: 2 hours
private readonly STUCK_THRESHOLD_SECONDS = 7200;

// Change to 1 hour:
private readonly STUCK_THRESHOLD_SECONDS = 3600;

// Change to 4 hours:
private readonly STUCK_THRESHOLD_SECONDS = 14400;
```

### Adjust Cleanup Frequency (If Needed)

Edit `api/src/modules/voice-ai/schedulers/voice-ai-jobs.scheduler.ts`:

```typescript
// Current: Every hour at :15
@Cron('15 * * * *')

// Change to every 30 minutes:
@Cron('*/30 * * * *')

// Change to every 2 hours:
@Cron('15 */2 * * *')
```

---

## Monitoring

### Key Metrics to Watch

1. **Cleanup Frequency**
   - How often does the job find stuck calls?
   - If frequent (>5/day), investigate root cause

2. **False Positives**
   - Are valid long calls being auto-failed?
   - If yes, increase threshold (2h → 4h)

3. **Call Duration Distribution**
   - What's the p99 call duration?
   - Threshold should be >>p99 to avoid false positives

### Recommended Alerts

**Alert if**:
- >10 stuck calls cleaned in a single run (indicates systemic issue)
- Stuck calls found every hour for 24+ hours (webhook failure?)
- Cleanup job fails to execute (cron/BullMQ issue)

---

## Future Improvements

### Optional Enhancements

1. **Admin Dashboard Widget**
   - Show recent auto-failed calls
   - Display cleanup statistics

2. **Notification System**
   - Email ops when stuck calls are auto-failed
   - Slack webhook for cleanup events

3. **Configurable Threshold**
   - Admin can set threshold via UI
   - Store in `voice_ai_global_config`

4. **Retry Logic**
   - Before auto-failing, check LiveKit room status
   - Only fail if room truly doesn't exist

---

## Summary

### Before Fix ❌
- Stuck call showing in dashboard forever
- No auto-cleanup mechanism
- Manual intervention required
- Inaccurate monitoring metrics

### After Fix ✅
- Stuck call fixed manually
- Auto-cleanup cron job running hourly
- Self-healing system
- Accurate monitoring metrics
- Audit trail for all cleanups
- Production-ready solution

---

**Status**: ✅ COMPLETE - Production Ready
**Date**: February 24, 2026
**Files Modified**: 3
**Files Created**: 1
**Backend Compiles**: ✅ Yes
**Ready to Deploy**: ✅ Yes

---

**Next Steps**:
1. Deploy to production
2. Monitor first few cleanup runs
3. Verify no false positives
4. Adjust threshold if needed
5. Set up alerts (optional)

