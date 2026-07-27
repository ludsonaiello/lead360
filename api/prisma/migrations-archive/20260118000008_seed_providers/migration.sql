-- Seed: communication_provider
-- Purpose: Seed 6 production-ready providers with complete JSON Schemas
-- Migration: 20260118000008_seed_providers

-- ============================================================================
-- PROVIDER 1: SMTP (Generic SMTP Support)
-- ============================================================================
INSERT INTO communication_provider (
  id,
  provider_key,
  provider_name,
  provider_type,
  credentials_schema,
  config_schema,
  default_config,
  supports_webhooks,
  webhook_events,
  webhook_verification_method,
  documentation_url,
  is_active,
  is_system
) VALUES (
  UUID(),
  'smtp',
  'SMTP',
  'email',
  JSON_OBJECT(
    'type', 'object',
    'required', JSON_ARRAY('smtp_username', 'smtp_password'),
    'properties', JSON_OBJECT(
      'smtp_username', JSON_OBJECT(
        'type', 'string',
        'description', 'SMTP username',
        'minLength', 1
      ),
      'smtp_password', JSON_OBJECT(
        'type', 'string',
        'format', 'password',
        'description', 'SMTP password',
        'minLength', 1
      )
    )
  ),
  JSON_OBJECT(
    'type', 'object',
    'required', JSON_ARRAY('smtp_host', 'smtp_port', 'smtp_encryption'),
    'properties', JSON_OBJECT(
      'smtp_host', JSON_OBJECT(
        'type', 'string',
        'description', 'SMTP server hostname',
        'examples', JSON_ARRAY('smtp.gmail.com', 'smtp.office365.com')
      ),
      'smtp_port', JSON_OBJECT(
        'type', 'integer',
        'description', 'SMTP server port',
        'enum', JSON_ARRAY(25, 465, 587, 2525)
      ),
      'smtp_encryption', JSON_OBJECT(
        'type', 'string',
        'description', 'Encryption method',
        'enum', JSON_ARRAY('none', 'ssl', 'tls'),
        'default', 'tls'
      )
    )
  ),
  JSON_OBJECT(
    'smtp_encryption', 'tls',
    'smtp_port', 587
  ),
  false,
  NULL,
  NULL,
  'https://nodemailer.com/smtp/',
  true,
  true
);

-- ============================================================================
-- PROVIDER 2: SendGrid
-- ============================================================================
INSERT INTO communication_provider (
  id,
  provider_key,
  provider_name,
  provider_type,
  credentials_schema,
  config_schema,
  default_config,
  supports_webhooks,
  webhook_events,
  webhook_verification_method,
  documentation_url,
  is_active,
  is_system
) VALUES (
  UUID(),
  'sendgrid',
  'SendGrid',
  'email',
  JSON_OBJECT(
    'type', 'object',
    'required', JSON_ARRAY('api_key'),
    'properties', JSON_OBJECT(
      'api_key', JSON_OBJECT(
        'type', 'string',
        'description', 'SendGrid API Key',
        'pattern', '^SG\\.',
        'minLength', 69,
        'examples', JSON_ARRAY('SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
      )
    )
  ),
  JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT(
      'click_tracking', JSON_OBJECT(
        'type', 'boolean',
        'description', 'Enable click tracking',
        'default', false
      ),
      'open_tracking', JSON_OBJECT(
        'type', 'boolean',
        'description', 'Enable open tracking',
        'default', false
      ),
      'sandbox_mode', JSON_OBJECT(
        'type', 'boolean',
        'description', 'Enable sandbox mode (testing)',
        'default', false
      )
    )
  ),
  JSON_OBJECT(
    'click_tracking', false,
    'open_tracking', false,
    'sandbox_mode', false
  ),
  true,
  JSON_ARRAY('delivered', 'processed', 'dropped', 'deferred', 'bounce', 'open', 'click', 'spamreport', 'unsubscribe'),
  'signature',
  'https://docs.sendgrid.com/api-reference',
  true,
  true
);

-- ============================================================================
-- PROVIDER 3: Amazon SES
-- ============================================================================
INSERT INTO communication_provider (
  id,
  provider_key,
  provider_name,
  provider_type,
  credentials_schema,
  config_schema,
  default_config,
  supports_webhooks,
  webhook_events,
  webhook_verification_method,
  documentation_url,
  is_active,
  is_system
) VALUES (
  UUID(),
  'amazon_ses',
  'Amazon SES',
  'email',
  JSON_OBJECT(
    'type', 'object',
    'required', JSON_ARRAY('access_key_id', 'secret_access_key', 'region'),
    'properties', JSON_OBJECT(
      'access_key_id', JSON_OBJECT(
        'type', 'string',
        'description', 'AWS Access Key ID',
        'pattern', '^AKIA[A-Z0-9]{16}$',
        'examples', JSON_ARRAY('AKIAIOSFODNN7EXAMPLE')
      ),
      'secret_access_key', JSON_OBJECT(
        'type', 'string',
        'format', 'password',
        'description', 'AWS Secret Access Key',
        'minLength', 40
      ),
      'region', JSON_OBJECT(
        'type', 'string',
        'description', 'AWS Region',
        'enum', JSON_ARRAY('us-east-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1', 'ap-northeast-1'),
        'default', 'us-east-1'
      )
    )
  ),
  JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT(
      'configuration_set', JSON_OBJECT(
        'type', 'string',
        'description', 'SES Configuration Set name for tracking'
      )
    )
  ),
  JSON_OBJECT(),
  true,
  JSON_ARRAY('send', 'delivery', 'bounce', 'complaint', 'reject', 'open', 'click'),
  'sns_signature',
  'https://docs.aws.amazon.com/ses/',
  true,
  true
);

-- ============================================================================
-- PROVIDER 4: Brevo (formerly Sendinblue)
-- ============================================================================
INSERT INTO communication_provider (
  id,
  provider_key,
  provider_name,
  provider_type,
  credentials_schema,
  config_schema,
  default_config,
  supports_webhooks,
  webhook_events,
  webhook_verification_method,
  documentation_url,
  is_active,
  is_system
) VALUES (
  UUID(),
  'brevo',
  'Brevo',
  'email',
  JSON_OBJECT(
    'type', 'object',
    'required', JSON_ARRAY('api_key'),
    'properties', JSON_OBJECT(
      'api_key', JSON_OBJECT(
        'type', 'string',
        'description', 'Brevo API Key (v3)',
        'minLength', 40,
        'examples', JSON_ARRAY('xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-xxxxxxxxxxxx')
      )
    )
  ),
  JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT(
      'enable_tracking', JSON_OBJECT(
        'type', 'boolean',
        'description', 'Enable email tracking',
        'default', false
      )
    )
  ),
  JSON_OBJECT(
    'enable_tracking', false
  ),
  true,
  JSON_ARRAY('delivered', 'hard_bounce', 'soft_bounce', 'blocked', 'spam', 'invalid_email', 'deferred', 'opened', 'clicked', 'unsubscribed'),
  'token',
  'https://developers.brevo.com/docs',
  true,
  true
);

-- ============================================================================
-- PROVIDER 5: Twilio SMS
-- ============================================================================
INSERT INTO communication_provider (
  id,
  provider_key,
  provider_name,
  provider_type,
  credentials_schema,
  config_schema,
  default_config,
  supports_webhooks,
  webhook_events,
  webhook_verification_method,
  documentation_url,
  is_active,
  is_system
) VALUES (
  UUID(),
  'twilio_sms',
  'Twilio SMS',
  'sms',
  JSON_OBJECT(
    'type', 'object',
    'required', JSON_ARRAY('account_sid', 'auth_token', 'from_phone'),
    'properties', JSON_OBJECT(
      'account_sid', JSON_OBJECT(
        'type', 'string',
        'description', 'Twilio Account SID',
        'pattern', '^AC[a-z0-9]{32}$',
        'examples', JSON_ARRAY('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
      ),
      'auth_token', JSON_OBJECT(
        'type', 'string',
        'format', 'password',
        'description', 'Twilio Auth Token',
        'minLength', 32
      ),
      'from_phone', JSON_OBJECT(
        'type', 'string',
        'description', 'Twilio phone number (E.164 format)',
        'pattern', '^\\+[1-9]\\d{1,14}$',
        'examples', JSON_ARRAY('+15551234567')
      )
    )
  ),
  JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT(
      'messaging_service_sid', JSON_OBJECT(
        'type', 'string',
        'description', 'Optional Messaging Service SID'
      )
    )
  ),
  JSON_OBJECT(),
  true,
  JSON_ARRAY('queued', 'sent', 'delivered', 'undelivered', 'failed'),
  'signature',
  'https://www.twilio.com/docs/sms',
  true,
  true
);

-- ============================================================================
-- PROVIDER 6: Twilio WhatsApp
-- ============================================================================
INSERT INTO communication_provider (
  id,
  provider_key,
  provider_name,
  provider_type,
  credentials_schema,
  config_schema,
  default_config,
  supports_webhooks,
  webhook_events,
  webhook_verification_method,
  documentation_url,
  is_active,
  is_system
) VALUES (
  UUID(),
  'twilio_whatsapp',
  'Twilio WhatsApp',
  'whatsapp',
  JSON_OBJECT(
    'type', 'object',
    'required', JSON_ARRAY('account_sid', 'auth_token', 'from_phone'),
    'properties', JSON_OBJECT(
      'account_sid', JSON_OBJECT(
        'type', 'string',
        'description', 'Twilio Account SID',
        'pattern', '^AC[a-z0-9]{32}$',
        'examples', JSON_ARRAY('ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx')
      ),
      'auth_token', JSON_OBJECT(
        'type', 'string',
        'format', 'password',
        'description', 'Twilio Auth Token',
        'minLength', 32
      ),
      'from_phone', JSON_OBJECT(
        'type', 'string',
        'description', 'WhatsApp-enabled Twilio number (E.164 format)',
        'pattern', '^\\+[1-9]\\d{1,14}$',
        'examples', JSON_ARRAY('+15551234567')
      )
    )
  ),
  JSON_OBJECT(
    'type', 'object',
    'properties', JSON_OBJECT()
  ),
  JSON_OBJECT(),
  true,
  JSON_ARRAY('queued', 'sent', 'delivered', 'read', 'undelivered', 'failed'),
  'signature',
  'https://www.twilio.com/docs/whatsapp',
  true,
  true
);
