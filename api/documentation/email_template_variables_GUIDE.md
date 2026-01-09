# Email Template Variables - Complete Guide

**Version**: 1.0
**Last Updated**: January 8, 2026
**Module**: Background Jobs - Email Templates

---

## Overview

The email template system now includes a comprehensive variable registry with **65+ documented variables** across multiple categories. This guide explains how to use variables in templates and what variables are available.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Available Variable Categories](#available-variable-categories)
3. [Complete Variable Reference](#complete-variable-reference)
4. [Using Variables in Templates](#using-variables-in-templates)
5. [System Template Editing](#system-template-editing)
6. [API Endpoints](#api-endpoints)
7. [Variable Validation](#variable-validation)

---

## Quick Start

### Basic Template Syntax

Variables use Handlebars syntax with double curly braces:

```handlebars
Hello {{user_name}},

Your company {{company_name}} has {{max_users}} user licenses.

Best regards,
{{platform_name}} Team
```

### Example: Password Reset Email

```handlebars
Subject: Reset Your Password - {{platform_name}}

Body:
<h1>Password Reset Request</h1>
<p>Hello {{user_name}},</p>
<p>Click the link below to reset your password:</p>
<a href="{{reset_link}}">Reset Password</a>
<p>This link expires in 1 hour.</p>
```

**Variables used**: `user_name`, `reset_link`, `platform_name`

---

## Available Variable Categories

### 1. **User Variables** (11 variables)
User profile and authentication information

- `user_id` - Unique user identifier (UUID)
- `user_email` - User's email address
- `user_first_name` - User's first name
- `user_last_name` - User's last name
- `user_full_name` - User's full name (first + last)
- `user_name` - User's first name (commonly used in greetings)
- `user_phone` - User's phone number
- `user_is_active` - Whether user account is active
- `user_is_platform_admin` - Whether user has platform admin privileges
- `user_role_name` - User's role name within their tenant
- `last_login_at` - User's last login timestamp

### 2. **Tenant/Company Variables** (40+ variables)
Business information, addresses, banking, insurance, licenses

**Core Company Info**:
- `company_name` - Company/business name
- `company_legal_name` - Legal business name
- `company_phone` - Company primary phone number
- `company_email` - Company primary contact email
- `company_website` - Company website URL
- `company_logo_url` - URL to company logo image
- `business_entity_type` - Type of business entity (LLC, Corp, etc.)
- `ein` - Employer Identification Number
- `state_of_registration` - State where business is registered
- `date_of_incorporation` - Date business was incorporated

**Address Variables**:
- `address_line1` - Street address (line 1)
- `address_line2` - Street address (line 2)
- `address_city` - City
- `address_state` - State (2-letter code)
- `address_zip_code` - ZIP/postal code
- `address_country` - Country

**Banking Variables**:
- `bank_name` - Name of banking institution
- `routing_number` - Bank routing number (masked for security)
- `account_number` - Bank account number (masked for security)
- `venmo_username` - Venmo username for payments

**Insurance Variables**:
- `gl_insurance_provider` - General Liability insurance provider
- `gl_policy_number` - General Liability policy number
- `gl_expiry_date` - General Liability insurance expiry date
- `wc_insurance_provider` - Workers' Compensation insurance provider
- `wc_policy_number` - Workers' Compensation policy number
- `wc_expiry_date` - Workers' Compensation insurance expiry date

**License Variables**:
- `license_type` - Type of license (e.g., General Contractor)
- `license_number` - License number
- `expiry_date` - License or insurance expiration date
- `days_until_expiry` - Number of days until expiration

**Financial Variables**:
- `default_contingency_rate` - Default contingency percentage for quotes
- `default_profit_margin` - Default profit margin percentage
- `sales_tax_rate` - Sales tax rate percentage

**Branding Variables**:
- `brand_primary_color` - Primary brand color (hex code)
- `invoice_prefix` - Prefix used for invoice numbers
- `quote_prefix` - Prefix used for quote numbers

### 3. **Subscription Variables** (7 variables)
Plan and subscription status information

- `plan_name` - Subscription plan name (e.g., "Professional")
- `subscription_status` - Current subscription status (active, trial, etc.)
- `trial_end_date` - Date when trial period ends
- `trial_days_remaining` - Number of days left in trial
- `is_in_trial` - Whether subscription is in trial period
- `max_users` - Maximum users allowed on plan
- `max_storage_gb` - Maximum storage in gigabytes

### 4. **Billing Variables** (6 variables)
Pricing and payment information

- `monthly_price` - Monthly subscription price
- `annual_price` - Annual subscription price
- `billing_cycle` - Billing frequency (monthly, annual)
- `next_billing_date` - Next billing/renewal date
- `amount_due` - Total amount due on next billing
- `payment_method_last4` - Last 4 digits of payment method

### 5. **System Variables** (12 variables)
Platform information and system-generated data

**Platform Info**:
- `platform_name` - Platform name (default: "Lead360")
- `platform_domain` - Platform domain (e.g., "lead360.app")
- `platform_support_email` - Platform support email address
- `platform_logo_url` - URL to platform logo

**URLs**:
- `app_base_url` - Base URL for the application
- `tenant_dashboard_url` - URL to tenant dashboard
- `admin_panel_url` - URL to admin panel

**Timestamps**:
- `generated_at` - Date/time when email was generated
- `current_year` - Current year
- `formatted_date` - Current date in readable format
- `formatted_time` - Current time in readable format

**Auth/Security**:
- `reset_link` - Password reset URL with embedded token
- `activation_link` - Account activation URL with embedded token

---

## Complete Variable Reference

### Variable Data Types

Each variable has a specific data type that determines how it's formatted:

- **string** - Text values
- **number** - Numeric values
- **boolean** - true/false values
- **date** - Date values (usually formatted as YYYY-MM-DD)
- **url** - Full URL strings (https://...)
- **email** - Email addresses
- **phone** - Phone numbers (formatted with country code)
- **currency** - Monetary values (formatted with currency symbol)

### Example Variable Usage by Use Case

#### Welcome Email
```handlebars
Subject: Welcome to {{platform_name}}, {{user_name}}!

Hello {{user_name}},

Welcome to {{platform_name}}! Your company {{company_name}} is all set up.

You're currently on the {{plan_name}} plan with {{max_users}} user licenses.

Get started: {{tenant_dashboard_url}}

Best regards,
{{platform_name}} Support
```

#### Invoice/Billing Email
```handlebars
Subject: Upcoming Payment - {{company_name}}

Dear {{user_name}},

Your next billing date is {{next_billing_date}}.
Amount due: {{amount_due}}
Plan: {{plan_name}} ({{billing_cycle}})

Payment method: ****{{payment_method_last4}}

Questions? Contact {{platform_support_email}}
```

#### License Expiry Warning
```handlebars
Subject: License Expiring Soon - {{company_name}}

Dear {{user_name}},

Your {{license_type}} license ({{license_number}}) will expire in {{days_until_expiry}} days.

Expiration date: {{expiry_date}}

Please renew to avoid service interruption.

Company: {{company_name}}
Address: {{address_line1}}, {{address_city}}, {{address_state}} {{address_zip_code}}
```

---

## Using Variables in Templates

### Step 1: Choose Your Variables

Determine what information you need to include in the email. Browse the [Variable Categories](#available-variable-categories) above.

### Step 2: Add Variables to Template

When creating or editing a template, you must:

1. **Declare variables** - Add variable names to the `variables` array
2. **Use variables in template** - Use `{{variable_name}}` syntax in subject, HTML body, and text body

**Example**:

```typescript
{
  template_key: 'trial-expiry-warning',
  subject: 'Your Trial Ends Soon - {{company_name}}',
  html_body: `
    <h1>Trial Ending Soon</h1>
    <p>Hello {{user_name}},</p>
    <p>Your {{plan_name}} trial ends in {{trial_days_remaining}} days.</p>
    <p>Trial end date: {{trial_end_date}}</p>
  `,
  variables: ['user_name', 'company_name', 'plan_name', 'trial_days_remaining', 'trial_end_date'],
}
```

### Step 3: Validate Your Template

Use the validation endpoint to check for errors:

```bash
POST /api/v1/admin/jobs/email-templates/validate
{
  "html_body": "<p>Hello {{user_name}}, your {{plan_name}} trial ends soon.</p>",
  "variables": ["user_name", "plan_name", "trial_days_remaining"]
}
```

**Response**:
```json
{
  "valid": false,
  "htmlValidation": {
    "valid": false,
    "unusedVariables": ["trial_days_remaining"],
    "undefinedVariables": []
  }
}
```

This shows you declared `trial_days_remaining` but didn't use it in the template.

---

## System Template Editing

### What Are System Templates?

System templates are pre-configured templates used for critical platform functions:

1. **password-reset** - Password reset emails
2. **account-activation** - Account activation emails
3. **license-expiry-warning** - License/insurance expiration warnings
4. **test-email** - SMTP configuration testing

### Can I Edit System Templates?

**YES!** As of January 2026, platform admins can edit system templates.

**Important Notes**:
- ⚠️ Changes affect **all instances** where the template is used
- ✅ Edits are **audit logged** with before/after snapshots
- ❌ System templates **cannot be deleted**
- 🔒 Only platform admins can edit system templates

### Warning When Editing

When you edit a system template in the UI, you'll see a warning:

> **Warning: Editing System Template**
> You are editing a system template that is used for critical platform functions. Changes will affect all instances where this template is used. Please ensure your modifications maintain the required functionality.

### Best Practices for Editing System Templates

1. **Test changes** - Use the preview feature before saving
2. **Maintain required variables** - Don't remove critical variables (e.g., `reset_link` in password-reset)
3. **Keep functionality** - Ensure links and buttons work correctly
4. **Document changes** - Note why you made changes for future reference
5. **Review audit logs** - Check `/admin/audit-log` for system template modifications

---

## API Endpoints

### 1. Get All Available Variables

**Endpoint**: `GET /api/v1/admin/jobs/email-templates/variables/registry`

**Query Parameters**:
- `category` (optional) - Filter by category: `user`, `tenant`, `subscription`, `billing`, `system`

**Example Request**:
```bash
GET /api/v1/admin/jobs/email-templates/variables/registry?category=user
```

**Example Response**:
```json
{
  "user_name": {
    "name": "user_name",
    "type": "string",
    "category": "user",
    "description": "User's first name (commonly used in greetings)",
    "example": "John",
    "required": false
  },
  "user_email": {
    "name": "user_email",
    "type": "email",
    "category": "user",
    "description": "User's email address",
    "example": "john.doe@example.com",
    "required": false
  }
}
```

### 2. Get Sample Data for Variables

**Endpoint**: `GET /api/v1/admin/jobs/email-templates/variables/sample`

**Query Parameters**:
- `variables` (required) - Comma-separated list of variable names

**Example Request**:
```bash
GET /api/v1/admin/jobs/email-templates/variables/sample?variables=user_name,company_name,plan_name
```

**Example Response**:
```json
{
  "user_name": "John",
  "company_name": "Acme Roofing Co.",
  "plan_name": "Professional"
}
```

**Use Case**: Use this to pre-fill the preview feature with realistic sample data.

### 3. Validate Template

**Endpoint**: `POST /api/v1/admin/jobs/email-templates/validate`

**Request Body**:
```json
{
  "html_body": "<p>Hello {{user_name}}, your trial ends {{trial_end_date}}.</p>",
  "text_body": "Hello {{user_name}}, your trial ends {{trial_end_date}}.",
  "variables": ["user_name", "trial_end_date", "company_name"]
}
```

**Response**:
```json
{
  "valid": false,
  "htmlValidation": {
    "valid": false,
    "unusedVariables": ["company_name"],
    "undefinedVariables": []
  },
  "textValidation": {
    "valid": false,
    "unusedVariables": ["company_name"],
    "undefinedVariables": []
  }
}
```

**What It Checks**:
- **Unused variables**: Declared in `variables` array but not used in template
- **Undefined variables**: Used in template (e.g., `{{unknown_var}}`) but not declared

### 4. Preview Template (Existing Endpoint - Enhanced)

**Endpoint**: `POST /api/v1/admin/jobs/email-templates/:templateKey/preview`

**Request Body**:
```json
{
  "variables": {
    "user_name": "John",
    "company_name": "Acme Roofing Co.",
    "plan_name": "Professional"
  }
}
```

**Tip**: Use the `/variables/sample` endpoint to get realistic example values!

---

## Variable Validation

### Why Validate?

Variable validation helps you:
- ✅ Catch typos in variable names
- ✅ Ensure all declared variables are used
- ✅ Prevent runtime errors when sending emails
- ✅ Maintain template quality

### Validation Rules

1. **No Undefined Variables**
   - ❌ Bad: Using `{{usre_name}}` (typo) when you meant `{{user_name}}`
   - ✅ Good: All variables in template are declared in `variables` array

2. **No Unused Variables**
   - ⚠️ Warning: Declaring `company_name` but never using it in template
   - While not an error, it indicates the template might be incomplete

### Frontend Integration (Coming Soon)

The Variable Browser UI component will provide:
- 📋 Browse all 65+ available variables by category
- 🔍 Search variables by name or description
- 📝 Click to insert `{{variable_name}}` into template
- ✅ Highlight which variables are already in use
- ⚠️ Show warnings for undefined variables in real-time

---

## Troubleshooting

### Common Issues

#### Issue: Variable not rendering in email

**Cause**: Variable name typo or variable not passed when queueing email

**Solution**:
1. Check variable name spelling (case-sensitive)
2. Ensure backend code passes the variable when calling `emailService.queueEmail()`

#### Issue: "Unknown variable" validation error

**Cause**: Variable used in template but not declared in `variables` array

**Solution**: Add the variable to the `variables` array in template definition

#### Issue: "Unused variable" warning

**Cause**: Variable declared but not used in template body

**Solution**: Either use the variable or remove it from the `variables` array

---

## Developer Reference

### Adding New Variables to Registry

If you need to add new variables to the system:

1. **Edit the Variable Registry Service**:
   File: `/api/src/modules/jobs/services/variable-registry.service.ts`

2. **Add your variable to the registry**:
```typescript
my_new_variable: {
  name: 'my_new_variable',
  type: VariableDataType.STRING,
  category: VariableCategory.CUSTOM,
  description: 'Description of what this variable contains',
  example: 'Example value',
  required: false,
},
```

3. **Restart the backend** to load the new variable into the registry

4. **Update this documentation** with the new variable information

### Backend Email Service Integration

When sending emails, pass variables as an object:

```typescript
await this.emailService.queueEmail({
  to: user.email,
  templateKey: 'trial-expiry-warning',
  variables: {
    user_name: user.first_name,
    company_name: tenant.company_name,
    plan_name: subscription.plan.name,
    trial_days_remaining: daysRemaining,
    trial_end_date: subscription.trial_end_date.toISOString().split('T')[0],
  },
  tenantId: tenant.id,
});
```

**Important**: Only pass variables that are declared in the template's `variables` array.

---

## Changelog

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| Jan 8, 2026 | 1.0 | Initial comprehensive variable system documentation | System |

---

## See Also

- [Email Template REST API](./email_templates_REST_API.md)
- [Background Jobs Module Documentation](./module-background_jobs.md)
- [SMTP Configuration Guide](./smtp_configuration.md)
