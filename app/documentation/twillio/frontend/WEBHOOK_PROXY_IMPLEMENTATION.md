# Twilio Webhook Proxy Implementation
**Sprint 11: Webhook Setup, Display & End-to-End Testing**
**Date**: February 2026

## Overview

This document describes the complete Twilio webhook proxy implementation that allows external Twilio services to send webhooks to tenant-specific subdomain URLs while properly routing them to the backend API.

---

## Architecture Pattern

Following the **exact same pattern** as the existing email webhook (`/api/v1/public/leads/webhook`), Twilio webhooks use a **proxy architecture**:

```
┌─────────┐     ┌──────────────────────────┐     ┌─────────────┐
│ Twilio  │────▶│ Next.js Proxy (Frontend) │────▶│   Backend   │
│         │     │ {tenant}.lead360.app     │     │ API Service │
└─────────┘     └──────────────────────────┘     └─────────────┘
                         │                              │
                         ├─ Extract subdomain           ├─ Verify signature
                         ├─ Forward request             ├─ Resolve tenant
                         └─ Send X-Tenant-Subdomain     └─ Process webhook
```

### Why Use a Proxy?

1. **Tenant Isolation**: Each tenant has their own webhook URL (`{tenant}.lead360.app`)
2. **Security**: Subdomain is extracted server-side, never client-controlled
3. **Consistency**: Same pattern as email webhooks (proven and working)
4. **Flexibility**: Backend receives tenant context without DNS/routing changes

---

## Implementation Details

### 1. Frontend: Next.js Webhook Proxy Routes

Created 8 webhook proxy routes in `/app/src/app/api/v1/twilio/`:

| Route | Purpose |
|-------|---------|
| `sms/inbound/route.ts` | Receives inbound SMS messages |
| `sms/status/route.ts` | Receives SMS delivery status updates |
| `call/inbound/route.ts` | Receives inbound phone calls |
| `call/status/route.ts` | Receives call status updates |
| `recording/ready/route.ts` | Receives recording ready notifications |
| `ivr/input/route.ts` | Receives IVR DTMF input |
| `whatsapp/inbound/route.ts` | Receives inbound WhatsApp messages |
| `whatsapp/status/route.ts` | Receives WhatsApp status updates |

#### Proxy Route Pattern (Example: SMS Inbound)

```typescript
export async function POST(request: NextRequest) {
  try {
    // STEP 1: Extract tenant subdomain from request host
    const host = request.headers.get('host') || '';
    const subdomain = host.split('.')[0]; // "tenant123" from "tenant123.lead360.app"

    if (!subdomain) {
      return NextResponse.json({ error: 'Invalid host - subdomain required' }, { status: 400 });
    }

    // STEP 2: Get Twilio signature for backend verification
    const twilioSignature = request.headers.get('x-twilio-signature');

    // STEP 3: Get raw request body (Twilio sends form-urlencoded)
    const bodyText = await request.text();

    // STEP 4: Forward to backend API (using environment variable, NOT hardcoded)
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL; // https://api.lead360.app/api/v1
    if (!apiBaseUrl) {
      throw new Error('NEXT_PUBLIC_API_URL environment variable is not set');
    }
    const backendUrl = `${apiBaseUrl}/twilio/sms/inbound`;

    // STEP 5: Forward request to backend with tenant context
    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/x-www-form-urlencoded',
        'X-Tenant-Subdomain': subdomain, // Backend uses this to resolve tenant_id
        ...(twilioSignature && { 'X-Twilio-Signature': twilioSignature }),
      },
      body: bodyText,
    });

    // STEP 6: Return backend response to Twilio
    const responseText = await backendResponse.text();
    return new NextResponse(responseText, {
      status: backendResponse.status,
      headers: {
        'Content-Type': backendResponse.headers.get('Content-Type') || 'text/plain',
      },
    });
  } catch (error: any) {
    console.error('Twilio webhook proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error processing webhook', message: error.message },
      { status: 500 }
    );
  }
}

export const dynamic = 'force-dynamic'; // Disable static optimization
```

---

### 2. Backend: Updated Tenant Resolution

Updated `/api/src/modules/communication/controllers/twilio-webhooks.controller.ts` to support the `X-Tenant-Subdomain` header sent by the Next.js proxy.

#### Before (Host-Only Resolution):
```typescript
private async resolveTenantFromSubdomain(request: Request): Promise<string> {
  const host = request.get('host') || ''; // "api.lead360.app" when proxied
  const subdomain = host.split('.')[0]; // Extracts "api" (WRONG!)
  // ... lookup tenant
}
```

#### After (Header-First Resolution):
```typescript
private async resolveTenantFromSubdomain(request: Request): Promise<string> {
  // PRIORITY 1: Check for X-Tenant-Subdomain header (sent by Next.js proxy)
  const headerSubdomain = request.get('x-tenant-subdomain');

  if (headerSubdomain) {
    this.logger.debug(`Resolving tenant from X-Tenant-Subdomain header: ${headerSubdomain}`);
    const tenant = await this.prisma.tenant.findFirst({
      where: { subdomain: headerSubdomain },
    });
    if (!tenant) {
      throw new BadRequestException(`Tenant not found for subdomain: ${headerSubdomain}`);
    }
    return tenant.id;
  }

  // PRIORITY 2: Fall back to parsing host header (direct calls)
  const host = request.get('host') || '';
  // ... rest of original logic
}
```

**Why This Works**:
- When Next.js proxies the request, `X-Tenant-Subdomain` header is present → backend uses that
- When Twilio calls backend directly (development/testing), no header → backend parses host
- Backwards compatible with direct backend calls

---

### 3. Frontend: Webhook Setup Card Component

Created `/app/src/components/twilio/WebhookSetupCard.tsx` to display webhook URLs to users.

#### Features:
- Generates webhook URLs dynamically from tenant subdomain (obtained via API)
- Copy-to-clipboard functionality for each URL
- Collapsible Twilio Console setup instructions
- Type-specific filtering (SMS, WhatsApp, Calls, IVR, or All)
- Mobile responsive design
- Dark mode support

#### Environment Variables Used:
```typescript
const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN || 'lead360.app';
const protocol = process.env.NEXT_PUBLIC_WEBHOOK_PROTOCOL || 'https';
const baseUrl = `${protocol}://${tenantSubdomain}.${appDomain}/api/v1/twilio`;
```

#### Generated Webhook URLs (Example for tenant "acmeplumbing"):
```
https://acmeplumbing.lead360.app/api/v1/twilio/sms/inbound
https://acmeplumbing.lead360.app/api/v1/twilio/call/inbound
https://acmeplumbing.lead360.app/api/v1/twilio/call/status
https://acmeplumbing.lead360.app/api/v1/twilio/recording/ready
https://acmeplumbing.lead360.app/api/v1/twilio/ivr/input
https://acmeplumbing.lead360.app/api/v1/twilio/whatsapp/inbound
https://acmeplumbing.lead360.app/api/v1/twilio/whatsapp/status
```

#### Integration Points:
- SMS Configuration Page: `/communications/twilio/sms`
- WhatsApp Configuration Page: `/communications/twilio/whatsapp`
- Dashboard Page: `/communications/twilio` (shows all webhook types)

---

## Complete Request Flow

### Example: Inbound SMS Webhook

1. **Twilio sends POST request**:
   ```
   POST https://acmeplumbing.lead360.app/api/v1/twilio/sms/inbound
   Headers:
     - Content-Type: application/x-www-form-urlencoded
     - X-Twilio-Signature: ABC123...
   Body:
     MessageSid=SM123&From=+15551234567&To=+15559876543&Body=Hello
   ```

2. **Next.js proxy receives request** (`/app/src/app/api/v1/twilio/sms/inbound/route.ts`):
   - Extracts subdomain: `"acmeplumbing"`
   - Forwards to backend: `https://api.lead360.app/api/v1/twilio/sms/inbound`
   - Adds header: `X-Tenant-Subdomain: acmeplumbing`
   - Forwards Twilio signature: `X-Twilio-Signature: ABC123...`

3. **Backend API receives proxied request** (`/api/src/modules/communication/controllers/twilio-webhooks.controller.ts`):
   - Reads `X-Tenant-Subdomain` header: `"acmeplumbing"`
   - Looks up tenant by subdomain → resolves `tenant_id`
   - Verifies Twilio signature using tenant's auth token
   - Processes webhook (creates Lead, logs event, etc.)
   - Returns response: `200 OK {}`

4. **Next.js proxy returns response to Twilio**:
   ```
   200 OK
   Content-Type: application/json
   Body: {}
   ```

5. **Twilio receives 200 OK** → marks webhook as successful

---

## Security Considerations

### 1. Twilio Signature Verification
- **Where**: Backend controller verifies signature using tenant's Twilio auth token
- **How**: `WebhookVerificationService.verifyTwilio(url, body, signature, authToken)`
- **Why**: Ensures request actually came from Twilio, not a spoofed source

### 2. Tenant Isolation
- **Server-Side Extraction**: Subdomain extracted from `Host` header server-side (Next.js API route)
- **Never Client-Controlled**: Frontend cannot manipulate tenant context
- **Header Transmission**: `X-Tenant-Subdomain` sent in internal request (not user-facing)
- **Database Scoping**: Backend enforces `tenant_id` filter on all queries

### 3. Environment Variables (No Hardcoded Values)
- `NEXT_PUBLIC_API_URL`: Backend API base URL
- `NEXT_PUBLIC_APP_DOMAIN`: Application domain (e.g., "lead360.app")
- `NEXT_PUBLIC_WEBHOOK_PROTOCOL`: Protocol (http/https)

**Critical**: All proxy routes validate environment variables before use:
```typescript
const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiBaseUrl) {
  throw new Error('NEXT_PUBLIC_API_URL environment variable is not set');
}
```

---

## Testing the Implementation

### 1. Local Development Testing

**Prerequisites**:
- Backend running: `http://127.0.0.1:8000`
- Frontend running: `http://127.0.0.1:7000`
- Environment variables set in `/app/.env.local`:
  ```bash
  NEXT_PUBLIC_API_URL=https://api.lead360.app/api/v1
  NEXT_PUBLIC_APP_DOMAIN=lead360.app
  NEXT_PUBLIC_WEBHOOK_PROTOCOL=https
  ```

**Test SMS Inbound Webhook**:
```bash
curl -X POST https://acmeplumbing.lead360.app/api/v1/twilio/sms/inbound \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "X-Twilio-Signature: test_signature_here" \
  -d "MessageSid=SM123&From=+15551234567&To=+15559876543&Body=Test"
```

**Expected Flow**:
1. Request hits Next.js at `/api/v1/twilio/sms/inbound`
2. Next.js extracts subdomain: `"acmeplumbing"`
3. Next.js forwards to: `https://api.lead360.app/api/v1/twilio/sms/inbound`
4. Backend processes webhook with `tenant_id` from subdomain lookup
5. Backend returns `200 OK`
6. Next.js returns `200 OK` to curl

### 2. Twilio Console Testing

**Configure Webhook in Twilio**:
1. Log into Twilio Console
2. Navigate to: Phone Numbers → Active Numbers → [Your SMS Number]
3. Scroll to "Messaging" section
4. Under "A MESSAGE COMES IN", select "Webhook"
5. Paste webhook URL from WebhookSetupCard: `https://{tenant}.lead360.app/api/v1/twilio/sms/inbound`
6. Select HTTP POST
7. Click "Save"

**Send Test SMS**:
- Send SMS to your Twilio number
- Check backend logs for webhook processing
- Verify Lead created in database

---

## Files Modified/Created

### Frontend (Next.js)

**New Files**:
- `/app/src/app/api/v1/twilio/sms/inbound/route.ts`
- `/app/src/app/api/v1/twilio/sms/status/route.ts`
- `/app/src/app/api/v1/twilio/call/inbound/route.ts`
- `/app/src/app/api/v1/twilio/call/status/route.ts`
- `/app/src/app/api/v1/twilio/recording/ready/route.ts`
- `/app/src/app/api/v1/twilio/ivr/input/route.ts`
- `/app/src/app/api/v1/twilio/whatsapp/inbound/route.ts`
- `/app/src/app/api/v1/twilio/whatsapp/status/route.ts`
- `/app/src/components/twilio/WebhookSetupCard.tsx`

**Modified Files**:
- `/app/src/app/(dashboard)/communications/twilio/sms/page.tsx` (added WebhookSetupCard)
- `/app/src/app/(dashboard)/communications/twilio/whatsapp/page.tsx` (added WebhookSetupCard)
- `/app/src/app/(dashboard)/communications/twilio/page.tsx` (added WebhookSetupCard)

**Environment Variables** (`.env.local`):
- `NEXT_PUBLIC_API_URL=https://api.lead360.app/api/v1` (existing)
- `NEXT_PUBLIC_APP_DOMAIN=lead360.app` (new)
- `NEXT_PUBLIC_WEBHOOK_PROTOCOL=https` (new)

### Backend (NestJS)

**Modified Files**:
- `/api/src/modules/communication/controllers/twilio-webhooks.controller.ts`
  - Updated `resolveTenantFromSubdomain()` to check `X-Tenant-Subdomain` header first

**No New Files**: Backend webhook endpoints already existed

---

## Comparison with Email Webhook Pattern

| Aspect | Email Webhook | Twilio Webhook |
|--------|--------------|----------------|
| **Frontend Route** | `/api/v1/public/leads/webhook` | `/api/v1/twilio/{endpoint}` |
| **Subdomain Extraction** | From `host` header | From `host` header |
| **Header Sent to Backend** | `X-Tenant-Subdomain` | `X-Tenant-Subdomain` |
| **Backend Header Check** | ❌ Not implemented (uses host) | ✅ Implemented |
| **Environment Variables** | ❌ Hardcoded URL | ✅ Uses `NEXT_PUBLIC_API_URL` |
| **Content Type** | JSON | Form-urlencoded |
| **Signature Verification** | API Key | Twilio Signature |

**Key Improvement**: Twilio webhooks follow the same proxy pattern but with proper environment variable usage and backend header support.

---

## Future Enhancements

### 1. Nginx Routing (Production Optimization)
Currently, webhook requests go through Next.js proxy. For production, Nginx could route `/api/v1/twilio/*` directly to backend:

```nginx
# In tenant subdomain server block
location /api/v1/twilio/ {
    proxy_pass http://127.0.0.1:8000/api/v1/twilio/;
    proxy_set_header X-Tenant-Subdomain $subdomain;
    proxy_set_header Host $host;
}
```

**Benefits**:
- Reduced latency (skip Next.js hop)
- Lower resource usage
- Simpler debugging

**Trade-off**: Requires Nginx configuration changes per environment

### 2. Webhook Event Logging
Add middleware to log all webhook events for debugging:
- Request timestamp
- Tenant ID
- Webhook type
- Response status
- Processing time

### 3. Webhook Testing UI
Add "Test Webhook" button in WebhookSetupCard:
- Sends simulated webhook to backend
- Displays response in modal
- Useful for verifying configuration without sending real SMS/calls

---

## Troubleshooting

### Issue: 404 on Webhook Endpoint

**Symptoms**:
```
POST /api/v1/twilio/call/inbound 404 in 123ms (compile: 61ms, render: 62ms)
```

**Cause**: Next.js not finding the route file

**Solutions**:
1. Verify route file exists at correct path: `/app/src/app/api/v1/twilio/call/inbound/route.ts`
2. Restart Next.js dev server: `npm run dev -- -p 7000 -H 127.0.0.1`
3. Check for syntax errors in route file

---

### Issue: Backend Returns "Tenant not found"

**Symptoms**:
```json
{ "error": "Tenant not found for subdomain: undefined" }
```

**Cause**: Backend not receiving `X-Tenant-Subdomain` header

**Solutions**:
1. Verify Next.js proxy sends header:
   ```typescript
   'X-Tenant-Subdomain': subdomain,
   ```
2. Check backend reads header:
   ```typescript
   const headerSubdomain = request.get('x-tenant-subdomain');
   ```
3. Verify tenant exists in database with matching subdomain

---

### Issue: Twilio Signature Verification Failed

**Symptoms**:
```
❌ Invalid Twilio signature for SMS webhook (tenant: abc123)
```

**Cause**: Signature verification failing

**Solutions**:
1. Verify Twilio auth token is correct in tenant SMS config
2. Check webhook URL matches exactly (protocol, domain, path)
3. Ensure body is forwarded as-is (don't parse/modify)
4. Verify `X-Twilio-Signature` header is forwarded from Next.js proxy

---

## Conclusion

The Twilio webhook proxy implementation follows the proven email webhook pattern while adding improvements:

✅ **Consistent Architecture**: Same proxy pattern as email webhooks
✅ **Environment Variables**: No hardcoded values
✅ **Backend Header Support**: Reads `X-Tenant-Subdomain` header
✅ **Security**: Server-side tenant extraction, Twilio signature verification
✅ **User-Friendly**: WebhookSetupCard with copy-to-clipboard and instructions
✅ **Complete Coverage**: All 8 Twilio webhook types supported

This implementation is production-ready and follows Lead360 platform conventions.

---

**Documentation Version**: 1.0
**Last Updated**: February 2026
**Status**: ✅ Complete
