/**
 * ⚠️⚠️⚠️ DEPRECATED - NO LONGER USED IN PRODUCTION ⚠️⚠️⚠️
 *
 * This route is NO LONGER CALLED in production due to Nginx configuration changes.
 * As of 2026-02-12, Nginx routes /api/v1/* requests directly to the backend,
 * bypassing this Next.js proxy entirely.
 *
 * Reason for deprecation:
 * - Nginx path-based routing now handles /api/v1/public/leads/webhook → backend
 * - This eliminates the sanitizeWebhookData transformation step (line 161)
 * - Backend now receives raw webhook data directly from external sources
 * - See /etc/nginx/sites-available/tenants.lead360.app.conf (location /api/v1/)
 *
 * ⚠️ IMPORTANT: If lead webhook data format issues occur after this change,
 * the sanitization logic below (sanitizeWebhookData) may need to be moved to
 * the backend service layer. This proxy was transforming:
 * - Name fields (name/full_name → first_name/last_name)
 * - Email arrays → single email field
 * - Phone arrays → single phone field (with formatting stripped)
 * - Address arrays → flat address fields
 *
 * This file is kept for reference only. Safe to delete in future cleanup.
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ORIGINAL DOCUMENTATION (for reference):
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * Webhook Proxy Route
 * Proxies webhook requests from external sources to the backend NestJS API
 * This allows webhook URLs to use the frontend domain while routing to the backend
 */

import { NextRequest, NextResponse } from 'next/server';

/**
 * Sanitize webhook data to handle various input formats
 * Normalizes name fields, emails, and phones to backend-expected format
 */
function sanitizeWebhookData(data: any): any {
  const sanitized: any = { ...data };

  // ========== NAME SANITIZATION ==========
  // Handle various name field formats: name, full_name, first_name/last_name

  let firstName = sanitized.first_name?.trim() || '';
  let lastName = sanitized.last_name?.trim() || '';

  // If we have both first_name and last_name, use as-is
  if (firstName && lastName) {
    sanitized.first_name = firstName;
    sanitized.last_name = lastName;
  }
  // If we have first_name but no last_name, check if first_name contains a space
  else if (firstName && !lastName) {
    const nameParts = firstName.split(' ').filter((part: string) => part.trim());
    if (nameParts.length > 1) {
      // Use last word as last_name, rest as first_name
      sanitized.last_name = nameParts.pop() || '';
      sanitized.first_name = nameParts.join(' ');
    } else {
      // Keep single name as first_name, leave last_name empty
      sanitized.first_name = firstName;
      sanitized.last_name = '';
    }
  }
  // If we have last_name but no first_name, check for name or full_name
  else if (!firstName && lastName) {
    const fullName = sanitized.name?.trim() || sanitized.full_name?.trim() || lastName;
    const nameParts = fullName.split(' ').filter((part: string) => part.trim());
    if (nameParts.length > 1) {
      sanitized.last_name = nameParts.pop() || '';
      sanitized.first_name = nameParts.join(' ');
    } else {
      sanitized.first_name = fullName;
      sanitized.last_name = '';
    }
  }
  // If we have neither, check for name or full_name
  else if (!firstName && !lastName) {
    const fullName = sanitized.name?.trim() || sanitized.full_name?.trim() || '';
    if (fullName) {
      const nameParts = fullName.split(' ').filter((part: string) => part.trim());
      if (nameParts.length > 1) {
        sanitized.last_name = nameParts.pop() || '';
        sanitized.first_name = nameParts.join(' ');
      } else {
        sanitized.first_name = fullName;
        sanitized.last_name = '';
      }
    }
  }

  // Clean up - remove name and full_name fields as we've normalized to first_name/last_name
  delete sanitized.name;
  delete sanitized.full_name;

  // ========== EMAIL SANITIZATION ==========
  // Backend expects single 'email' field, not 'emails' array
  // If we receive emails array, extract first email
  if (sanitized.emails && Array.isArray(sanitized.emails) && sanitized.emails.length > 0) {
    sanitized.email = sanitized.emails[0].email || sanitized.emails[0];
    delete sanitized.emails;
  }
  // If email is already a string, keep it as-is

  // ========== PHONE SANITIZATION ==========
  // Backend expects single 'phone' field, not 'phones' array
  // If we receive phones array, extract first phone and strip formatting
  if (sanitized.phones && Array.isArray(sanitized.phones) && sanitized.phones.length > 0) {
    const firstPhone = sanitized.phones[0].phone || sanitized.phones[0];
    sanitized.phone = firstPhone.toString().replace(/\D/g, ''); // Strip formatting
    delete sanitized.phones;
  } else if (sanitized.phone) {
    // Strip formatting from single phone field
    sanitized.phone = sanitized.phone.toString().replace(/\D/g, '');
  }

  // ========== ADDRESS HANDLING ==========
  // Backend expects flat address fields, not 'addresses' array
  // If we receive addresses array, flatten to individual fields
  if (sanitized.addresses && Array.isArray(sanitized.addresses) && sanitized.addresses.length > 0) {
    const firstAddress = sanitized.addresses[0];
    sanitized.address_line1 = firstAddress.address_line1;
    sanitized.address_line2 = firstAddress.address_line2;
    sanitized.city = firstAddress.city;
    sanitized.state = firstAddress.state;
    sanitized.zip_code = firstAddress.zip_code;
    delete sanitized.addresses;
  }
  // If address fields are already flat, keep as-is

  return sanitized;
}

export async function POST(request: NextRequest) {
  try {
    // Extract the API key from headers
    const apiKey = request.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing x-api-key header' },
        { status: 401 }
      );
    }

    // Extract tenant subdomain from the request host
    // Backend will resolve the tenant_id from the subdomain
    const host = request.headers.get('host') || '';
    const subdomain = host.split('.')[0];

    if (!subdomain) {
      return NextResponse.json(
        { error: 'Invalid host - subdomain required' },
        { status: 400 }
      );
    }

    // Get the raw request body as text first, then validate it's JSON
    const bodyText = await request.text();

    // Check if body is empty
    if (!bodyText || bodyText.trim().length === 0) {
      console.error('Empty request body');
      return NextResponse.json(
        { error: 'Request body is required' },
        { status: 400 }
      );
    }

    // Validate it's valid JSON
    let bodyJson: any;
    try {
      bodyJson = JSON.parse(bodyText);
    } catch (parseError) {
      console.error('Invalid JSON in webhook request:', parseError);
      return NextResponse.json(
        {
          error: 'Invalid JSON in request body',
          details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        },
        { status: 400 }
      );
    }

    // Sanitize the webhook data
    const sanitizedData = sanitizeWebhookData(bodyJson);

    // Forward the request to the backend NestJS API
    // Backend is at api.lead360.app (NOT tenant subdomain)
    // Send tenant subdomain in custom header for backend to resolve tenant_id
    const backendUrl = `https://api.lead360.app/api/v1/public/leads/webhook`;

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Tenant-Subdomain': subdomain, // Backend uses this to resolve tenant_id
      },
      body: JSON.stringify(sanitizedData),
    });

    // Get the response from the backend
    const responseText = await backendResponse.text();

    // Try to parse backend response as JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // If backend response is not JSON, return it as-is
      return new NextResponse(responseText, {
        status: backendResponse.status,
        headers: {
          'Content-Type': backendResponse.headers.get('Content-Type') || 'text/plain',
        },
      });
    }

    // Return the backend response with the same status code
    return NextResponse.json(responseData, {
      status: backendResponse.status,
    });
  } catch (error: any) {
    console.error('Webhook proxy error:', error);

    // Generic error response
    return NextResponse.json(
      { error: 'Internal server error processing webhook', message: error.message },
      { status: 500 }
    );
  }
}

// Disable body parsing and enable dynamic rendering
export const dynamic = 'force-dynamic';
