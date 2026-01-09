import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function seedEmailTemplates() {
  const templates = [
    {
      id: randomBytes(16).toString('hex'),
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
  ];

  for (const template of templates) {
    await prisma.email_template.upsert({
      where: { template_key: template.template_key },
      update: template,
      create: template,
    });
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
