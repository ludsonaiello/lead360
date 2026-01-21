/**
 * Communication Provider Webhook Proxy Route
 *
 * Proxies webhook requests from tenant subdomains to the backend API.
 * Pattern: https://{subdomain}.lead360.app/api/v1/webhooks/communication/{provider}
 *
 * Flow:
 * 1. External provider (Brevo, SendGrid, SNS, Twilio) sends webhook to tenant subdomain
 * 2. This route extracts subdomain from Host header
 * 3. Forwards to backend with X-Tenant-Subdomain header
 * 4. Backend resolves tenant and processes webhook
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST handler for communication webhooks
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    // Await params (Next.js 15+ requirement)
    const { provider } = await params;

    // Extract tenant subdomain from Host header
    // Example: "honeydo4you.lead360.app" -> "honeydo4you"
    const host = request.headers.get('host') || '';
    const subdomain = host.split('.')[0];

    if (!subdomain) {
      return NextResponse.json(
        { error: 'Invalid subdomain' },
        { status: 400 }
      );
    }

    // Provider already extracted from params above

    // Get webhook payload
    const bodyText = await request.text();
    let bodyJson: any;

    try {
      bodyJson = bodyText ? JSON.parse(bodyText) : {};
    } catch {
      // Some providers send non-JSON payloads
      bodyJson = { raw: bodyText };
    }

    // Prepare headers to forward to backend
    const forwardHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Tenant-Subdomain': subdomain, // Critical: tenant resolution
    };

    // Forward provider-specific signature headers for verification
    // Brevo: x-sib-signature
    const sibSignature = request.headers.get('x-sib-signature');
    if (sibSignature) {
      forwardHeaders['x-sib-signature'] = sibSignature;
    }

    // SendGrid: x-twilio-email-event-webhook-signature, x-twilio-email-event-webhook-timestamp
    const sendgridSignature = request.headers.get('x-twilio-email-event-webhook-signature');
    const sendgridTimestamp = request.headers.get('x-twilio-email-event-webhook-timestamp');
    if (sendgridSignature) {
      forwardHeaders['x-twilio-email-event-webhook-signature'] = sendgridSignature;
    }
    if (sendgridTimestamp) {
      forwardHeaders['x-twilio-email-event-webhook-timestamp'] = sendgridTimestamp;
    }

    // SNS: x-amz-sns-message-type, x-amz-sns-subscription-arn, etc.
    const snsMessageType = request.headers.get('x-amz-sns-message-type');
    if (snsMessageType) {
      forwardHeaders['x-amz-sns-message-type'] = snsMessageType;
    }

    // Twilio (SMS/WhatsApp): x-twilio-signature
    const twilioSignature = request.headers.get('x-twilio-signature');
    if (twilioSignature) {
      forwardHeaders['x-twilio-signature'] = twilioSignature;
    }

    // Forward to backend API
    const backendUrl = `https://api.lead360.app/api/v1/webhooks/communication/${provider}`;

    console.log(`[Webhook Proxy] Forwarding ${provider} webhook from ${subdomain} to backend`);

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(bodyJson),
    });

    // Get backend response
    const backendData = await backendResponse.text();
    let responseJson: any;

    try {
      responseJson = backendData ? JSON.parse(backendData) : {};
    } catch {
      responseJson = { message: backendData || 'OK' };
    }

    // Return backend response to external provider
    return NextResponse.json(
      responseJson,
      { status: backendResponse.status }
    );

  } catch (error: any) {
    console.error('[Webhook Proxy] Error:', error);
    return NextResponse.json(
      {
        error: 'Webhook processing failed',
        message: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler - for webhook verification endpoints
 * Some providers (like Facebook/WhatsApp) use GET requests to verify webhook endpoints
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  try {
    // Await params (Next.js 15+ requirement)
    const { provider } = await params;

    const host = request.headers.get('host') || '';
    const subdomain = host.split('.')[0];

    // Forward verification requests to backend
    const backendUrl = `https://api.lead360.app/api/v1/webhooks/communication/${provider}`;
    const searchParams = request.nextUrl.searchParams;

    const backendResponse = await fetch(
      `${backendUrl}?${searchParams.toString()}`,
      {
        method: 'GET',
        headers: {
          'X-Tenant-Subdomain': subdomain,
        },
      }
    );

    const backendData = await backendResponse.text();

    return new NextResponse(backendData, {
      status: backendResponse.status,
      headers: {
        'Content-Type': backendResponse.headers.get('Content-Type') || 'text/plain',
      },
    });

  } catch (error: any) {
    console.error('[Webhook Proxy GET] Error:', error);
    return new NextResponse('Verification failed', { status: 500 });
  }
}
