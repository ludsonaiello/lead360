# Sprint 9: Health Check Endpoint - REST API Documentation

**Module:** Communication - Health Check
**Base URL:** `/api/v1/communication/health`
**Authentication:** Public (No authentication required)
**Version:** 1.0
**Sprint:** 9
**Date:** February 13, 2026

---

## Overview

The Communication Health Check API provides endpoints for monitoring the health and readiness of the communication module. These endpoints are designed for use by Kubernetes, load balancers, and monitoring systems.

**Key Features:**
- Database connectivity monitoring
- Redis queue health checks
- Encryption service verification
- Twilio API connectivity testing
- Liveness and readiness probes for Kubernetes
- Detailed latency metrics

**Important:** All health endpoints are **public** (no authentication required) to enable monitoring by external systems.

---

## Endpoints

### 1. Complete Health Check

**GET** `/api/v1/communication/health`

Comprehensive health check that tests all communication module dependencies.

#### Request

```bash
curl -X GET http://localhost:8000/api/v1/communication/health
```

**Headers:** None required (public endpoint)

**Authentication:** None

#### Response

**Success (200 OK):**

```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "up",
      "latency_ms": 13
    },
    "redis_queue": {
      "status": "up",
      "latency_ms": 8,
      "message": "Active: 0, Waiting: 0"
    },
    "encryption_service": {
      "status": "up"
    },
    "twilio_api": {
      "status": "up",
      "latency_ms": 477
    }
  },
  "timestamp": "2026-02-13T18:27:09.105Z"
}
```

**Degraded (200 OK):**

Twilio API is down but critical systems (database, Redis, encryption) are operational.

```json
{
  "status": "degraded",
  "checks": {
    "database": {
      "status": "up",
      "latency_ms": 5
    },
    "redis_queue": {
      "status": "up",
      "latency_ms": 3,
      "message": "Active: 2, Waiting: 5"
    },
    "encryption_service": {
      "status": "up"
    },
    "twilio_api": {
      "status": "down",
      "message": "Invalid credentials",
      "latency_ms": 250
    }
  },
  "timestamp": "2026-02-13T18:30:00.000Z"
}
```

**Unhealthy (200 OK):**

Critical systems (database, Redis, or encryption) are down.

```json
{
  "status": "unhealthy",
  "checks": {
    "database": {
      "status": "down",
      "message": "Connection refused",
      "latency_ms": 5000
    },
    "redis_queue": {
      "status": "up",
      "latency_ms": 3,
      "message": "Active: 0, Waiting: 0"
    },
    "encryption_service": {
      "status": "up"
    },
    "twilio_api": {
      "status": "up",
      "latency_ms": 120
    }
  },
  "timestamp": "2026-02-13T18:35:00.000Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Overall health status: `healthy`, `degraded`, or `unhealthy` |
| `checks` | object | Detailed status for each dependency check |
| `checks.database` | object | Database connectivity check |
| `checks.redis_queue` | object | Redis/BullMQ queue check |
| `checks.encryption_service` | object | Encryption service check |
| `checks.twilio_api` | object | Twilio API connectivity check (optional) |
| `timestamp` | string | ISO 8601 timestamp of the health check |

**Check Status Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `status` | string | Check result: `up` or `down` |
| `latency_ms` | number | Response time in milliseconds (optional) |
| `message` | string | Additional information or error message (optional) |

#### Status Determination

- **healthy**: All checks return `status: "up"`
- **degraded**: Twilio API is down, but critical systems are up
- **unhealthy**: Database, Redis, or encryption service is down

---

### 2. Liveness Probe

**GET** `/api/v1/communication/health/live`

Simple endpoint that returns 200 OK if the server process is running. Does NOT check dependencies.

**Use Case:** Kubernetes liveness probes to determine if the pod should be restarted.

#### Request

```bash
curl -X GET http://localhost:8000/api/v1/communication/health/live
```

**Headers:** None required (public endpoint)

**Authentication:** None

#### Response

**Success (200 OK):**

```json
{
  "status": "ok"
}
```

This endpoint **always** returns 200 OK as long as the server process is running.

---

### 3. Readiness Probe

**GET** `/api/v1/communication/health/ready`

Full health check that returns HTTP 500 if the system is unhealthy (critical systems down).

**Use Case:** Kubernetes readiness probes and load balancers to determine if the service is ready to accept traffic.

#### Request

```bash
curl -X GET http://localhost:8000/api/v1/communication/health/ready
```

**Headers:** None required (public endpoint)

**Authentication:** None

#### Response

**Success (200 OK) - System Healthy:**

```json
{
  "status": "healthy",
  "checks": {
    "database": {
      "status": "up",
      "latency_ms": 3
    },
    "redis_queue": {
      "status": "up",
      "latency_ms": 3,
      "message": "Active: 0, Waiting: 0"
    },
    "encryption_service": {
      "status": "up"
    },
    "twilio_api": {
      "status": "up",
      "latency_ms": 78
    }
  },
  "timestamp": "2026-02-13T18:27:09.268Z"
}
```

**Success (200 OK) - System Degraded:**

Twilio API is down, but critical systems are operational. Service can still accept traffic.

```json
{
  "status": "degraded",
  "checks": {
    "database": {
      "status": "up",
      "latency_ms": 5
    },
    "redis_queue": {
      "status": "up",
      "latency_ms": 3,
      "message": "Active: 0, Waiting: 0"
    },
    "encryption_service": {
      "status": "up"
    },
    "twilio_api": {
      "status": "down",
      "message": "Connection timeout",
      "latency_ms": 5000
    }
  },
  "timestamp": "2026-02-13T18:40:00.000Z"
}
```

**Error (500 Internal Server Error) - System Unhealthy:**

Critical systems (database, Redis, or encryption) are down. Service should NOT accept traffic.

```json
{
  "statusCode": 500,
  "message": "System unhealthy",
  "error": "Internal Server Error"
}
```

#### HTTP Status Codes

| Status Code | Condition | Meaning |
|-------------|-----------|---------|
| 200 OK | `status: "healthy"` or `"degraded"` | Service is ready to accept traffic |
| 500 Internal Server Error | `status: "unhealthy"` | Service is NOT ready (critical systems down) |

---

## Health Check Details

### Database Check

**Check:** Executes simple query `SELECT 1` via Prisma

**Critical:** Yes (system cannot operate without database)

**Metrics:**
- Latency in milliseconds
- Status: `up` or `down`
- Error message on failure

**Example Response:**

```json
"database": {
  "status": "up",
  "latency_ms": 13
}
```

**Failure Example:**

```json
"database": {
  "status": "down",
  "message": "Connection refused",
  "latency_ms": 5000
}
```

---

### Redis Queue Check

**Check:** Retrieves job counts from `communication-sms` BullMQ queue

**Critical:** Yes (async job processing depends on Redis)

**Metrics:**
- Latency in milliseconds
- Status: `up` or `down`
- Job counts (active, waiting)
- Error message on failure

**Example Response:**

```json
"redis_queue": {
  "status": "up",
  "latency_ms": 8,
  "message": "Active: 0, Waiting: 0"
}
```

**Failure Example:**

```json
"redis_queue": {
  "status": "down",
  "message": "ECONNREFUSED",
  "latency_ms": 100
}
```

---

### Encryption Service Check

**Check:** Performs encryption/decryption roundtrip test

**Critical:** Yes (credential storage depends on encryption)

**Metrics:**
- Status: `up` or `down`
- Error message on failure

**Example Response:**

```json
"encryption_service": {
  "status": "up"
}
```

**Failure Example:**

```json
"encryption_service": {
  "status": "down",
  "message": "Encryption/decryption mismatch"
}
```

---

### Twilio API Check

**Check:** Fetches Twilio account info using first active SMS config

**Critical:** No (system can operate in degraded mode without Twilio)

**Metrics:**
- Latency in milliseconds
- Status: `up` or `down`
- Skip message if no config exists
- Error message on failure

**Example Response (Success):**

```json
"twilio_api": {
  "status": "up",
  "latency_ms": 477
}
```

**Example Response (No Config):**

```json
"twilio_api": {
  "status": "up",
  "message": "No active SMS config (skipped)",
  "latency_ms": 5
}
```

**Failure Example:**

```json
"twilio_api": {
  "status": "down",
  "message": "Invalid credentials",
  "latency_ms": 250
}
```

---

## Kubernetes Integration

### Example Deployment Configuration

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: lead360-api
spec:
  containers:
  - name: api
    image: lead360/api:latest
    ports:
    - containerPort: 8000

    # Liveness probe - determines if pod should be restarted
    livenessProbe:
      httpGet:
        path: /api/v1/communication/health/live
        port: 8000
      initialDelaySeconds: 30
      periodSeconds: 10
      timeoutSeconds: 5
      failureThreshold: 3

    # Readiness probe - determines if pod should receive traffic
    readinessProbe:
      httpGet:
        path: /api/v1/communication/health/ready
        port: 8000
      initialDelaySeconds: 10
      periodSeconds: 5
      timeoutSeconds: 5
      failureThreshold: 2
      successThreshold: 1
```

### Probe Configuration Recommendations

**Liveness Probe:**
- `initialDelaySeconds: 30` - Wait for application startup
- `periodSeconds: 10` - Check every 10 seconds
- `timeoutSeconds: 5` - Max 5 seconds for response
- `failureThreshold: 3` - Restart after 3 consecutive failures (30 seconds)

**Readiness Probe:**
- `initialDelaySeconds: 10` - Start checking early
- `periodSeconds: 5` - Check frequently (every 5 seconds)
- `timeoutSeconds: 5` - Max 5 seconds for response
- `failureThreshold: 2` - Mark unready after 2 consecutive failures (10 seconds)
- `successThreshold: 1` - Mark ready after 1 success

---

## Load Balancer Integration

### Nginx Health Check

```nginx
upstream api_backend {
  server 127.0.0.1:8000;

  # Health check configuration
  health_check interval=10s
               fails=2
               passes=1
               uri=/api/v1/communication/health/ready
               match=health_ok;
}

match health_ok {
  status 200;
  header Content-Type = "application/json";
}
```

### HAProxy Health Check

```
backend api_servers
  mode http
  option httpchk GET /api/v1/communication/health/ready
  http-check expect status 200
  server api1 127.0.0.1:8000 check inter 5s fall 2 rise 1
```

---

## Monitoring & Alerting

### Prometheus Metrics (Future Enhancement)

The health check system can be integrated with Prometheus for advanced monitoring:

```yaml
# Example Prometheus scrape config
- job_name: 'lead360-health'
  scrape_interval: 30s
  metrics_path: /api/v1/communication/health
  static_configs:
    - targets: ['api.lead360.app:8000']
```

### Recommended Alerts

**Critical Alert - Database Down:**
```yaml
alert: DatabaseDown
expr: communication_health_database_status == 0
for: 1m
severity: critical
```

**Warning Alert - Twilio API Degraded:**
```yaml
alert: TwilioApiDegraded
expr: communication_health_twilio_api_status == 0
for: 5m
severity: warning
```

**Warning Alert - High Latency:**
```yaml
alert: HealthCheckHighLatency
expr: communication_health_database_latency_ms > 1000
for: 5m
severity: warning
```

---

## Performance Considerations

### Response Time Targets

| Check | Target | Acceptable | Critical |
|-------|--------|------------|----------|
| Database | < 10ms | < 50ms | > 100ms |
| Redis Queue | < 5ms | < 20ms | > 50ms |
| Encryption | < 1ms | < 5ms | > 10ms |
| Twilio API | < 500ms | < 2000ms | > 5000ms |
| **Total Health Check** | < 600ms | < 2500ms | > 5000ms |

### Timeout Configuration

All health checks have built-in timeout protection:
- Database query: 5 seconds max
- Redis queue check: 5 seconds max
- Twilio API call: 10 seconds max (external API)

If any check exceeds timeout, it returns `status: "down"`.

---

## Error Handling

All health check endpoints handle errors gracefully:

1. **Database Connection Error:**
   - Returns `status: "down"` for database check
   - Overall status: `unhealthy`
   - Readiness probe returns HTTP 500

2. **Redis Connection Error:**
   - Returns `status: "down"` for Redis check
   - Overall status: `unhealthy`
   - Readiness probe returns HTTP 500

3. **Encryption Service Error:**
   - Returns `status: "down"` for encryption check
   - Overall status: `unhealthy`
   - Readiness probe returns HTTP 500

4. **Twilio API Error (Non-Critical):**
   - Returns `status: "down"` for Twilio check
   - Overall status: `degraded` (not `unhealthy`)
   - Readiness probe still returns HTTP 200 (service can accept traffic)

5. **No Twilio Config:**
   - Returns `status: "up"` with message "No active SMS config (skipped)"
   - Overall status remains `healthy`

---

## Testing

### Manual Testing

**Test 1: Liveness Probe**
```bash
curl -X GET http://localhost:8000/api/v1/communication/health/live
# Expected: {"status":"ok"}
```

**Test 2: Complete Health Check**
```bash
curl -X GET http://localhost:8000/api/v1/communication/health | jq .
# Expected: Full health report with all checks
```

**Test 3: Readiness Probe**
```bash
curl -X GET http://localhost:8000/api/v1/communication/health/ready | jq .
# Expected: Same as complete health check, or HTTP 500 if unhealthy
```

**Test 4: Check Response Time**
```bash
curl -w "\nTime: %{time_total}s\n" \
  -X GET http://localhost:8000/api/v1/communication/health
# Expected: Total time < 1 second
```

### Automated Testing

**Test Database Down:**
```bash
# Stop database
docker stop mysql
# Test health check
curl http://localhost:8000/api/v1/communication/health/ready
# Expected: HTTP 500
# Restart database
docker start mysql
```

**Test Redis Down:**
```bash
# Stop Redis
docker stop redis
# Test health check
curl http://localhost:8000/api/v1/communication/health/ready
# Expected: HTTP 500
# Restart Redis
docker start redis
```

---

## Security Considerations

### Public Endpoints

All health check endpoints are **public** (no authentication required). This is intentional for monitoring systems.

**Why?**
- Kubernetes liveness/readiness probes don't support authentication
- Load balancers need unauthenticated health checks
- Monitoring systems (Prometheus, Datadog) need direct access

**What's Safe?**
- ✅ Health check status (up/down)
- ✅ Latency metrics
- ✅ Job queue counts

**What's Protected?**
- ❌ Twilio account SIDs (not exposed)
- ❌ API credentials (not exposed)
- ❌ Database connection strings (not exposed)
- ❌ Encryption keys (not exposed)

Health checks return **minimal information** - only status and latency, no sensitive data.

### Rate Limiting

Health check endpoints are excluded from rate limiting to prevent monitoring systems from being blocked.

---

## Troubleshooting

### Common Issues

**Issue: Health check returns 404 Not Found**

**Cause:** Server not started or routes not registered

**Solution:**
```bash
# Restart the API server
npm run start:dev
# Wait 30 seconds for compilation
# Test again
curl http://localhost:8000/api/v1/communication/health/live
```

---

**Issue: Database check always fails**

**Cause:** Database connection issue

**Solution:**
```bash
# Check database is running
docker ps | grep mysql
# Check connection string
cat .env | grep DATABASE_URL
# Test database connection
npx prisma db pull
```

---

**Issue: Redis queue check always fails**

**Cause:** Redis not running or BullMQ misconfigured

**Solution:**
```bash
# Check Redis is running
docker ps | grep redis
# Check Redis connection
redis-cli ping
# Expected: PONG
```

---

**Issue: Encryption check fails**

**Cause:** Missing or invalid ENCRYPTION_KEY

**Solution:**
```bash
# Generate new encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Update .env file
echo "ENCRYPTION_KEY=<generated-key>" >> .env
# Restart server
```

---

**Issue: Twilio API check always fails**

**Cause:** Invalid Twilio credentials in database

**Solution:**
- This is non-critical (system status will be `degraded`, not `unhealthy`)
- Update Twilio credentials via admin panel
- Or ignore if no SMS config is needed yet

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| Feb 13, 2026 | 1.0 | Initial health check API implementation (Sprint 9) |

---

## Support

For issues or questions:
- Review server logs: `tail -f /tmp/api-server.log`
- Check Swagger docs: `http://localhost:8000/api/docs`
- Review Sprint 9 documentation: `documentation/backend/sms_sprints/sprint_9_health_check_endpoint.md`

---

**END OF SPRINT 9 REST API DOCUMENTATION**
