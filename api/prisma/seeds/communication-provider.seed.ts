import {
  Prisma,
  PrismaClient,
  communication_provider_type,
} from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

/**
 * Seed the built-in communication provider catalog (is_system = true).
 *
 * These rows are provider *definitions*, not configured accounts: the JSON in
 * credentials_schema / config_schema describes which fields a tenant must supply
 * when connecting the provider, and carries no secrets. Real credentials live in
 * platform_email_config / tenant_email_config / tenant_sms_config, are encrypted
 * with ENCRYPTION_KEY, and are never seeded.
 *
 * Upserted by provider_key. update: {} so an operator toggling is_active off is
 * not silently re-enabled on the next run.
 */
const providers = [
  {
    provider_key: 'smtp',
    provider_name: 'SMTP',
    provider_type: communication_provider_type.email,
    credentials_schema: {
      type: 'object',
      required: ['smtp_username', 'smtp_password'],
      properties: {
        smtp_username: {
          type: 'string',
          description: 'SMTP username',
          minLength: 1,
        },
        smtp_password: {
          type: 'string',
          format: 'password',
          description: 'SMTP password',
          minLength: 1,
        },
      },
    },
    config_schema: {
      type: 'object',
      required: ['smtp_host', 'smtp_port', 'smtp_encryption'],
      properties: {
        smtp_host: {
          type: 'string',
          description: 'SMTP server hostname',
          examples: ['smtp.gmail.com', 'smtp.office365.com'],
        },
        smtp_port: {
          type: 'integer',
          description: 'SMTP server port',
          enum: [25, 465, 587, 2525],
        },
        smtp_encryption: {
          type: 'string',
          description: 'Encryption method',
          enum: ['none', 'ssl', 'tls'],
          default: 'tls',
        },
      },
    },
    default_config: {
      smtp_encryption: 'tls',
      smtp_port: 587,
    },
    supports_webhooks: false,
    webhook_events: Prisma.DbNull,
    webhook_verification_method: null,
    documentation_url: 'https://nodemailer.com/smtp/',
    logo_url: null,
    is_active: true,
  },
  {
    provider_key: 'sendgrid',
    provider_name: 'SendGrid',
    provider_type: communication_provider_type.email,
    credentials_schema: {
      type: 'object',
      required: ['api_key'],
      properties: {
        api_key: {
          type: 'string',
          description: 'SendGrid API Key',
          pattern: '^SG\\.',
          minLength: 69,
          examples: [
            'SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
          ],
        },
      },
    },
    config_schema: {
      type: 'object',
      properties: {
        click_tracking: {
          type: 'boolean',
          description: 'Enable click tracking',
          default: false,
        },
        open_tracking: {
          type: 'boolean',
          description: 'Enable open tracking',
          default: false,
        },
        sandbox_mode: {
          type: 'boolean',
          description: 'Enable sandbox mode (testing)',
          default: false,
        },
      },
    },
    default_config: {
      click_tracking: false,
      open_tracking: false,
      sandbox_mode: false,
    },
    supports_webhooks: true,
    webhook_events: [
      'delivered',
      'processed',
      'dropped',
      'deferred',
      'bounce',
      'open',
      'click',
      'spamreport',
      'unsubscribe',
    ],
    webhook_verification_method: 'signature',
    documentation_url: 'https://docs.sendgrid.com/api-reference',
    logo_url: null,
    is_active: true,
  },
  {
    provider_key: 'amazon_ses',
    provider_name: 'Amazon SES',
    provider_type: communication_provider_type.email,
    credentials_schema: {
      type: 'object',
      required: ['access_key_id', 'secret_access_key', 'region'],
      properties: {
        access_key_id: {
          type: 'string',
          description: 'AWS Access Key ID',
          pattern: '^AKIA[A-Z0-9]{16}$',
          examples: ['AKIAIOSFODNN7EXAMPLE'],
        },
        secret_access_key: {
          type: 'string',
          format: 'password',
          description: 'AWS Secret Access Key',
          minLength: 40,
        },
        region: {
          type: 'string',
          description: 'AWS Region',
          enum: [
            'us-east-1',
            'us-west-2',
            'eu-west-1',
            'eu-central-1',
            'ap-southeast-1',
            'ap-northeast-1',
          ],
          default: 'us-east-1',
        },
      },
    },
    config_schema: {
      type: 'object',
      properties: {
        configuration_set: {
          type: 'string',
          description: 'SES Configuration Set name for tracking',
        },
      },
    },
    default_config: {},
    supports_webhooks: true,
    webhook_events: [
      'send',
      'delivery',
      'bounce',
      'complaint',
      'reject',
      'open',
      'click',
    ],
    webhook_verification_method: 'sns_signature',
    documentation_url: 'https://docs.aws.amazon.com/ses/',
    logo_url: null,
    is_active: true,
  },
  {
    provider_key: 'brevo',
    provider_name: 'Brevo',
    provider_type: communication_provider_type.email,
    credentials_schema: {
      type: 'object',
      required: ['api_key'],
      properties: {
        api_key: {
          type: 'string',
          description: 'Brevo API Key (v3)',
          minLength: 40,
          examples: [
            'xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxx',
          ],
        },
      },
    },
    config_schema: {
      type: 'object',
      properties: {
        enable_tracking: {
          type: 'boolean',
          description: 'Enable email tracking',
          default: false,
        },
      },
    },
    default_config: {
      enable_tracking: false,
    },
    supports_webhooks: true,
    webhook_events: [
      'delivered',
      'hard_bounce',
      'soft_bounce',
      'blocked',
      'spam',
      'invalid_email',
      'deferred',
      'opened',
      'clicked',
      'unsubscribed',
    ],
    webhook_verification_method: 'token',
    documentation_url: 'https://developers.brevo.com/docs',
    logo_url: null,
    is_active: true,
  },
  {
    provider_key: 'twilio_sms',
    provider_name: 'Twilio SMS',
    provider_type: communication_provider_type.sms,
    credentials_schema: {
      type: 'object',
      required: ['account_sid', 'auth_token', 'from_phone'],
      properties: {
        account_sid: {
          type: 'string',
          description: 'Twilio Account SID',
          pattern: '^AC[a-z0-9]{32}$',
          examples: ['ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
        },
        auth_token: {
          type: 'string',
          format: 'password',
          description: 'Twilio Auth Token',
          minLength: 32,
        },
        from_phone: {
          type: 'string',
          description: 'Twilio phone number (E.164 format)',
          pattern: '^\\+[1-9]\\d{1,14}$',
          examples: ['+15551234567'],
        },
      },
    },
    config_schema: {
      type: 'object',
      properties: {
        messaging_service_sid: {
          type: 'string',
          description: 'Optional Messaging Service SID',
        },
      },
    },
    default_config: {},
    supports_webhooks: true,
    webhook_events: ['queued', 'sent', 'delivered', 'undelivered', 'failed'],
    webhook_verification_method: 'signature',
    documentation_url: 'https://www.twilio.com/docs/sms',
    logo_url: null,
    is_active: true,
  },
  {
    provider_key: 'twilio_whatsapp',
    provider_name: 'Twilio WhatsApp',
    provider_type: communication_provider_type.whatsapp,
    credentials_schema: {
      type: 'object',
      required: ['account_sid', 'auth_token', 'from_phone'],
      properties: {
        account_sid: {
          type: 'string',
          description: 'Twilio Account SID',
          pattern: '^AC[a-z0-9]{32}$',
          examples: ['ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'],
        },
        auth_token: {
          type: 'string',
          format: 'password',
          description: 'Twilio Auth Token',
          minLength: 32,
        },
        from_phone: {
          type: 'string',
          description: 'WhatsApp-enabled Twilio number (E.164 format)',
          pattern: '^\\+[1-9]\\d{1,14}$',
          examples: ['+15551234567'],
        },
      },
    },
    config_schema: {
      type: 'object',
      properties: {},
    },
    default_config: {},
    supports_webhooks: true,
    webhook_events: [
      'queued',
      'sent',
      'delivered',
      'read',
      'undelivered',
      'failed',
    ],
    webhook_verification_method: 'signature',
    documentation_url: 'https://www.twilio.com/docs/whatsapp',
    logo_url: null,
    is_active: true,
  },
];

async function seedCommunicationProviders() {
  console.log('Seeding communication provider catalog...');

  for (const provider of providers) {
    await prisma.communication_provider.upsert({
      where: { provider_key: provider.provider_key },
      update: {},
      create: { id: uuidv4(), is_system: true, ...provider },
    });
    console.log(`  ✓ ${provider.provider_key} (${provider.provider_type})`);
  }

  console.log(
    `✅ Communication providers seeded successfully (${providers.length} entries)`,
  );
}

seedCommunicationProviders()
  .catch((error) => {
    console.error('❌ Communication provider seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
