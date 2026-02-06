# Cron Schedule Management Guide

**Sprint 8 Enhancement**: Dynamic, configurable cron schedules (no more hardcoded values!)

---

## Overview

All cron schedules are now stored in the `system_settings` table and can be updated at runtime without code changes or deployments.

---

## Current Settings (Defaults)

| Setting Key | Default Value | Description |
|------------|---------------|-------------|
| `twilio_usage_sync_cron` | `0 2 * * *` | Daily at 2:00 AM |
| `twilio_health_check_cron` | `*/15 * * * *` | Every 15 minutes |
| `cron_timezone` | `America/New_York` | Timezone for all jobs |
| `twilio_usage_sync_enabled` | `true` | Enable/disable usage sync |
| `twilio_health_check_enabled` | `true` | Enable/disable health checks |

---

## How to Update Schedules

### Step 1: View current cron status

```bash
curl -X GET https://api.lead360.app/admin/communication/cron/status \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "usage_sync": {
    "enabled": true,
    "schedule": "0 2 * * *",
    "timezone": "America/New_York",
    "status": "running"
  },
  "health_check": {
    "enabled": true,
    "schedule": "*/15 * * * *",
    "timezone": "America/New_York",
    "status": "running"
  }
}
```

---

### Step 2: Update a setting

Use the system settings endpoint to update:

```bash
# Change usage sync to run at 3:00 AM instead of 2:00 AM
curl -X PATCH https://api.lead360.app/admin/settings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "twilio_usage_sync_cron",
    "value": "0 3 * * *"
  }'
```

```bash
# Change timezone to UTC
curl -X PATCH https://api.lead360.app/admin/settings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "cron_timezone",
    "value": "UTC"
  }'
```

```bash
# Disable health checks temporarily
curl -X PATCH https://api.lead360.app/admin/settings \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "twilio_health_check_enabled",
    "value": "false"
  }'
```

---

### Step 3: Reload cron schedules

**IMPORTANT:** After updating settings, you must reload the cron schedules:

```bash
curl -X POST https://api.lead360.app/admin/communication/cron/reload \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

**Response:**
```json
{
  "message": "Cron schedules reloaded successfully",
  "status": {
    "usage_sync": {
      "enabled": true,
      "schedule": "0 3 * * *",
      "timezone": "UTC",
      "status": "running"
    },
    "health_check": {
      "enabled": false,
      "schedule": "*/15 * * * *",
      "timezone": "UTC",
      "status": "stopped"
    }
  }
}
```

---

## Cron Expression Examples

| Expression | Description | Example Use Case |
|-----------|-------------|------------------|
| `0 2 * * *` | Daily at 2:00 AM | Nightly data sync |
| `0 3 * * *` | Daily at 3:00 AM | Late-night processing |
| `*/15 * * * *` | Every 15 minutes | Frequent monitoring |
| `*/30 * * * *` | Every 30 minutes | Regular health checks |
| `0 */2 * * *` | Every 2 hours | Periodic updates |
| `0 0 * * 0` | Weekly on Sunday at midnight | Weekly reports |
| `0 0 1 * *` | Monthly on the 1st at midnight | Monthly billing |

**Format:** `minute hour day month dayOfWeek`

---

## Common Timezone Values

| Region | IANA Timezone |
|--------|---------------|
| US Eastern | `America/New_York` |
| US Central | `America/Chicago` |
| US Mountain | `America/Denver` |
| US Pacific | `America/Los_Angeles` |
| UTC | `UTC` |
| London | `Europe/London` |
| Paris | `Europe/Paris` |
| Tokyo | `Asia/Tokyo` |

Full list: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones

---

## Troubleshooting

### Jobs not running after update
1. Verify settings were updated: `GET /admin/settings?key=twilio_usage_sync_cron`
2. Reload schedules: `POST /admin/communication/cron/reload`
3. Check status: `GET /admin/communication/cron/status`

### Invalid cron expression
- Ensure format is: `minute hour day month dayOfWeek`
- Use https://crontab.guru/ to validate expressions
- Check server logs for validation errors

### Job disabled but still running
- Reload schedules to apply changes: `POST /admin/communication/cron/reload`
- Verify enabled flag: `GET /admin/communication/cron/status`

---

## Technical Details

### How It Works
1. Settings are stored in `system_settings` table
2. `DynamicCronManagerService` loads settings on startup
3. Cron jobs are registered using `SchedulerRegistry` (NestJS)
4. Jobs can be stopped/restarted at runtime
5. No code changes or deployments needed

### Architecture
- **Old approach:** Hardcoded `@Cron('0 2 * * *')` decorators
- **New approach:** Dynamic registration from database settings
- **Benefits:** Configurable, no deployments, admin-controlled

---

## Security Notes

⚠️ **Only SystemAdmin role can:**
- View cron status
- Update cron settings
- Reload cron schedules

🔒 **All changes are audit-logged** in the `audit_log` table

---

**Last Updated:** Sprint 8 Enhancement
**Status:** ✅ Production Ready
