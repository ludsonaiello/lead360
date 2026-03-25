import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function seedEmailTemplates() {
  const templates = [
    {
      id: randomBytes(16).toString('hex'),
      tenant_id: null,
      template_key: 'password-reset',
      subject: 'Reset Your Password - Lead360',
      html_body: `
        <h1>Password Reset Request</h1>
        <p>Hello {{user_name}},</p>
        <p>Click the link below to reset your password:</p>
        <a href="{{reset_link}}">Reset Password</a>
        <p>This link expires in 1 hour.</p>
      `,
      text_body: 'Hello {{user_name}}, Reset your password: {{reset_link}}',
      variables: ['user_name', 'reset_link'],
      variable_schema: {
        user_name: {
          name: 'user_name',
          type: 'string',
          category: 'user',
          description: "User's first name (commonly used in greetings)",
          example: 'John',
          required: true,
        },
        reset_link: {
          name: 'reset_link',
          type: 'url',
          category: 'system',
          description: 'Password reset URL with embedded token (expires in 1 hour)',
          example: 'https://app.lead360.com/reset?token=abc123',
          required: true,
        },
      },
      description: 'Password reset email',
      is_system: true,
    },
    {
      id: randomBytes(16).toString('hex'),
      tenant_id: null,
      template_key: 'account-activation',
      subject: 'Activate Your Account - Lead360',
      html_body: `
        <h1>Welcome to Lead360!</h1>
        <p>Hello {{user_name}},</p>
        <p>Click the link below to activate your account:</p>
        <a href="{{activation_link}}">Activate Account</a>
      `,
      text_body: 'Welcome {{user_name}}! Activate: {{activation_link}}',
      variables: ['user_name', 'activation_link'],
      variable_schema: {
        user_name: {
          name: 'user_name',
          type: 'string',
          category: 'user',
          description: "User's first name",
          example: 'John',
          required: true,
        },
        activation_link: {
          name: 'activation_link',
          type: 'url',
          category: 'system',
          description: 'Account activation URL with embedded token',
          example: 'https://app.lead360.com/activate?token=xyz789',
          required: true,
        },
      },
      description: 'Account activation email',
      is_system: true,
    },
    {
      id: randomBytes(16).toString('hex'),
      tenant_id: null,
      template_key: 'license-expiry-warning',
      subject: 'License Expiring Soon - {{company_name}}',
      html_body: `
        <h1>License Expiry Warning</h1>
        <p>Your {{license_type}} license will expire on {{expiry_date}}.</p>
        <p>Please renew to avoid service interruption.</p>
      `,
      text_body: 'License expiry: {{license_type}} expires {{expiry_date}}',
      variables: ['company_name', 'license_type', 'expiry_date'],
      variable_schema: {
        company_name: {
          name: 'company_name',
          type: 'string',
          category: 'tenant',
          description: 'Company/business name',
          example: 'Acme Roofing Co.',
          required: true,
        },
        license_type: {
          name: 'license_type',
          type: 'string',
          category: 'tenant',
          description: 'Type of license (e.g., General Contractor)',
          example: 'General Contractor',
          required: true,
        },
        expiry_date: {
          name: 'expiry_date',
          type: 'date',
          category: 'tenant',
          description: 'License expiration date',
          example: '2027-12-31',
          required: true,
          format: 'YYYY-MM-DD',
        },
      },
      description: 'License expiry warning email',
      is_system: true,
    },
    {
      id: randomBytes(16).toString('hex'),
      tenant_id: null,
      template_key: 'test-email',
      subject: 'Test Email - Lead360',
      html_body: `<h1>SMTP Configuration Test</h1><p>If you receive this, your SMTP settings are correct.</p>

<p>
Ano atual: {{current_year}}<br />
Acesse a plataforma: {{platform_domain}}<br />
Email de suporte: {{platform_support_email}}<br />
Dashboard URL: {{tenant_dashboard_url}}
</p>`,
      text_body: 'SMTP test successful',
      variables: ['current_year', 'platform_domain', 'platform_support_email', 'tenant_dashboard_url'],
      variable_schema: {
        current_year: {
          name: 'current_year',
          type: 'number',
          category: 'system',
          description: 'Current year',
          example: 2026,
          required: true,
        },
        platform_domain: {
          name: 'platform_domain',
          type: 'string',
          category: 'system',
          description: 'Platform domain',
          example: 'lead360.app',
          required: true,
        },
        platform_support_email: {
          name: 'platform_support_email',
          type: 'email',
          category: 'system',
          description: 'Platform support email address',
          example: 'support@lead360.app',
          required: true,
        },
        tenant_dashboard_url: {
          name: 'tenant_dashboard_url',
          type: 'url',
          category: 'system',
          description: 'URL to tenant dashboard',
          example: 'https://app.lead360.app',
          required: true,
        },
      },
      description: 'SMTP test email with system variables',
      is_system: true,
    },
    {
      id: randomBytes(16).toString('hex'),
      tenant_id: null,
      template_key: 'send-quote',
      subject: 'Quote {{quote_number}} from {{company_name}}',
      html_body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .quote-details { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #0066cc; }
    .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
    .custom-message { background-color: #fffbcc; padding: 15px; margin: 15px 0; border-left: 4px solid #ffcc00; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Quote Ready for Review</h1>
    </div>

    <div class="content">
      <p>Hello {{customer_name}},</p>

      <p>Thank you for your interest in our services. We have prepared a detailed quote for your project:</p>

      <div class="quote-details">
        <h2>{{quote_title}}</h2>
        <p><strong>Quote Number:</strong> {{quote_number}}</p>
        <p><strong>Total Amount:</strong> {{quote_total}}</p>
      </div>

      {{#if custom_message}}
      <div class="custom-message">
        <p><strong>Message from {{vendor_name}}:</strong></p>
        <p style="white-space: pre-line;">{{custom_message}}</p>
      </div>
      {{/if}}

      <p>You can view and review your quote online by clicking the button below:</p>

      <div style="text-align: center;">
        <a href="{{public_url}}" class="button">View Quote Online</a>
      </div>

      <p style="background-color: #e6f3ff; padding: 12px; border-radius: 4px; font-size: 14px;">
        <strong>📱 View Anytime:</strong> Your quote is available online 24/7. Click the link above to view, download, or share it on any device.
      </p>

      <p>If you have any questions or would like to discuss this quote, please don't hesitate to contact us:</p>

      <p>
        <strong>{{vendor_name}}</strong><br>
        Email: {{vendor_email}}<br>
        Phone: {{vendor_phone}}
      </p>

      <p>We look forward to working with you!</p>

      <p>Best regards,<br>
      {{company_name}}</p>
    </div>

    <div class="footer">
      <p>This is an automated message from {{company_name}}. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
      `,
      text_body: `
Quote {{quote_number}} from {{company_name}}

Hello {{customer_name}},

Thank you for your interest in our services. We have prepared a detailed quote for your project:

{{quote_title}}
Quote Number: {{quote_number}}
Total Amount: {{quote_total}}

{{#if custom_message}}
Message from {{vendor_name}}:
{{custom_message}}
{{/if}}

View your quote online: {{public_url}}

Your quote is available online 24/7. Click the link above to view, download, or share it on any device.

If you have any questions, please contact:
{{vendor_name}}
Email: {{vendor_email}}
Phone: {{vendor_phone}}

Best regards,
{{company_name}}
      `,
      variables: ['quote_number', 'customer_name', 'company_name', 'quote_title', 'quote_total', 'public_url', 'vendor_name', 'vendor_email', 'vendor_phone', 'custom_message'],
      variable_schema: {
        quote_number: {
          name: 'quote_number',
          type: 'string',
          category: 'quote',
          description: 'Unique quote number',
          example: 'Q-2026-001',
          required: true,
        },
        customer_name: {
          name: 'customer_name',
          type: 'string',
          category: 'customer',
          description: 'Customer full name',
          example: 'John Smith',
          required: true,
        },
        company_name: {
          name: 'company_name',
          type: 'string',
          category: 'tenant',
          description: 'Company/business name',
          example: 'Acme Roofing Co.',
          required: true,
        },
        quote_title: {
          name: 'quote_title',
          type: 'string',
          category: 'quote',
          description: 'Quote title/description',
          example: 'Roof Replacement - Main Building',
          required: true,
        },
        quote_total: {
          name: 'quote_total',
          type: 'string',
          category: 'quote',
          description: 'Formatted quote total amount',
          example: '$15,250.00',
          required: true,
        },
        public_url: {
          name: 'public_url',
          type: 'url',
          category: 'quote',
          description: 'Public URL to view quote online',
          example: 'https://acme.lead360.app/quotes/abc123token',
          required: true,
        },
        vendor_name: {
          name: 'vendor_name',
          type: 'string',
          category: 'vendor',
          description: 'Vendor/estimator name',
          example: 'Mike Johnson',
          required: false,
        },
        vendor_email: {
          name: 'vendor_email',
          type: 'email',
          category: 'vendor',
          description: 'Vendor email address',
          example: 'mike@acmeroofing.com',
          required: false,
        },
        vendor_phone: {
          name: 'vendor_phone',
          type: 'string',
          category: 'vendor',
          description: 'Vendor phone number',
          example: '(555) 123-4567',
          required: false,
        },
        custom_message: {
          name: 'custom_message',
          type: 'string',
          category: 'quote',
          description: 'Optional custom message from user',
          example: 'Looking forward to working with you on this project!',
          required: false,
        },
      },
      description: 'Send quote to customer with PDF attachment',
      is_system: true,
    },
    {
      id: randomBytes(16).toString('hex'),
      tenant_id: null,
      template_key: 'portal-welcome',
      subject: 'Your Project Portal Access - {{company_name}}',
      html_body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .credentials { background-color: white; padding: 15px; margin: 15px 0; border-left: 4px solid #0066cc; }
    .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .warning { background-color: #fff3cd; padding: 12px; border-radius: 4px; font-size: 14px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Welcome to Your Project Portal</h1>
    </div>

    <div class="content">
      <p>Hello {{customer_name}},</p>

      <p>{{company_name}} has set up a project portal for you. You can use it to track your project progress, view updates, photos, and documents at any time.</p>

      <div class="credentials">
        <h3>Your Login Credentials</h3>
        <p><strong>Email:</strong> {{email}}</p>
        <p><strong>Temporary Password:</strong> {{temporary_password}}</p>
      </div>

      <div class="warning">
        <strong>Important:</strong> You will be asked to change your password when you first log in.
      </div>

      <div style="text-align: center;">
        <a href="{{portal_url}}" class="button">Access Your Portal</a>
      </div>

      <p>If you have any questions about your project, please contact {{company_name}} directly.</p>
    </div>

    <div class="footer">
      <p>This is an automated message from {{company_name}}.</p>
    </div>
  </div>
</body>
</html>
      `,
      text_body: `Welcome to Your Project Portal

Hello {{customer_name}},

{{company_name}} has set up a project portal for you. You can use it to track your project progress, view updates, photos, and documents at any time.

Your Login Credentials:
Email: {{email}}
Temporary Password: {{temporary_password}}

IMPORTANT: You will be asked to change your password when you first log in.

Access your portal: {{portal_url}}

If you have any questions about your project, please contact {{company_name}} directly.`,
      variables: ['customer_name', 'company_name', 'portal_url', 'email', 'temporary_password'],
      variable_schema: {
        customer_name: {
          name: 'customer_name',
          type: 'string',
          category: 'customer',
          description: 'Customer full name',
          example: 'John Smith',
          required: true,
        },
        company_name: {
          name: 'company_name',
          type: 'string',
          category: 'tenant',
          description: 'Company/business name',
          example: 'Acme Roofing Co.',
          required: true,
        },
        portal_url: {
          name: 'portal_url',
          type: 'url',
          category: 'system',
          description: 'Direct link to the customer portal projects page',
          example: 'https://acme.lead360.app/public/john-smith/projects/',
          required: true,
        },
        email: {
          name: 'email',
          type: 'email',
          category: 'customer',
          description: 'Customer login email address',
          example: 'john@example.com',
          required: true,
        },
        temporary_password: {
          name: 'temporary_password',
          type: 'string',
          category: 'system',
          description: 'Auto-generated temporary password (must be changed on first login)',
          example: 'Tmp!x9Kz4mQw',
          required: true,
        },
      },
      description: 'Welcome email sent when a portal account is created for a customer',
      is_system: true,
    },
    {
      id: randomBytes(16).toString('hex'),
      tenant_id: null,
      template_key: 'portal-password-reset',
      subject: 'Reset Your Portal Password - {{company_name}}',
      html_body: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9f9f9; }
    .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
    .warning { background-color: #fff3cd; padding: 12px; border-radius: 4px; font-size: 14px; margin: 15px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Password Reset Request</h1>
    </div>

    <div class="content">
      <p>Hello {{customer_name}},</p>

      <p>We received a request to reset your portal password for {{company_name}}. Click the button below to set a new password:</p>

      <div style="text-align: center;">
        <a href="{{reset_link}}" class="button">Reset Your Password</a>
      </div>

      <div class="warning">
        <strong>This link expires in 1 hour.</strong> If you did not request a password reset, you can safely ignore this email — your password will not be changed.
      </div>

      <p>If the button above doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; font-size: 13px; color: #666;">{{reset_link}}</p>
    </div>

    <div class="footer">
      <p>This is an automated message from {{company_name}}.</p>
    </div>
  </div>
</body>
</html>
      `,
      text_body: `Password Reset Request

Hello {{customer_name}},

We received a request to reset your portal password for {{company_name}}.

Reset your password: {{reset_link}}

This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.`,
      variables: ['customer_name', 'company_name', 'reset_link'],
      variable_schema: {
        customer_name: {
          name: 'customer_name',
          type: 'string',
          category: 'customer',
          description: 'Customer full name',
          example: 'John Smith',
          required: true,
        },
        company_name: {
          name: 'company_name',
          type: 'string',
          category: 'tenant',
          description: 'Company/business name',
          example: 'Acme Roofing Co.',
          required: true,
        },
        reset_link: {
          name: 'reset_link',
          type: 'url',
          category: 'system',
          description: 'Password reset URL with embedded token (expires in 1 hour)',
          example: 'https://acme.lead360.app/public/reset-password?token=abc123def456',
          required: true,
        },
      },
      description: 'Password reset email for customer portal accounts',
      is_system: true,
    },
  ];

  for (const template of templates) {
    // For system templates, check if exists and update/create accordingly
    const existing = await prisma.email_template.findFirst({
      where: {
        template_key: template.template_key,
        tenant_id: null,
      },
    });

    if (existing) {
      await prisma.email_template.update({
        where: { id: existing.id },
        data: template,
      });
    } else {
      await prisma.email_template.create({
        data: template,
      });
    }
  }

  console.log('✅ Email templates seeded successfully');
}

seedEmailTemplates()
  .catch((e) => {
    console.error('❌ Error seeding email templates:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
