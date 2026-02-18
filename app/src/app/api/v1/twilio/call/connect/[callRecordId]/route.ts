import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ callRecordId: string }> }
) {
  try {
    const { callRecordId } = await params;
    const host = request.headers.get('host') || '';
    const subdomain = host.split('.')[0];
    const twilioSignature = request.headers.get('x-twilio-signature');
    const bodyText = await request.text();

    const protocol = request.headers.get('x-forwarded-proto') || 'https';
    const originalUrl = `${protocol}://${host}${request.nextUrl.pathname}`;

    const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiBaseUrl) {
      throw new Error('NEXT_PUBLIC_API_URL not set');
    }

    const backendResponse = await fetch(`${apiBaseUrl}/twilio/call/connect/${callRecordId}`, {
      method: 'POST',
      headers: {
        'Content-Type': request.headers.get('content-type') || 'application/x-www-form-urlencoded',
        'X-Tenant-Subdomain': subdomain,
        'X-Original-Url': originalUrl,
        ...(twilioSignature && { 'X-Twilio-Signature': twilioSignature }),
      },
      body: bodyText,
    });

    const responseText = await backendResponse.text();
    return new NextResponse(responseText, {
      status: backendResponse.status,
      headers: { 'Content-Type': backendResponse.headers.get('Content-Type') || 'text/plain' },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export const dynamic = 'force-dynamic';
