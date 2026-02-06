/**
 * Variable Registry Service
 * Master registry of all available template variables with comprehensive documentation
 */

import { Injectable } from '@nestjs/common';
import {
  VariableSchema,
  VariableCategory,
  VariableDataType,
  VariableSchemaField,
} from '../types/variable-schema.types';

@Injectable()
export class VariableRegistryService {
  // Master registry of ALL available variables
  private readonly registry: VariableSchema = {
    // ==================== USER VARIABLES ====================
    user_id: {
      name: 'user_id',
      type: VariableDataType.STRING,
      category: VariableCategory.USER,
      description: 'Unique user identifier (UUID)',
      example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      required: false,
    },
    user_email: {
      name: 'user_email',
      type: VariableDataType.EMAIL,
      category: VariableCategory.USER,
      description: "User's email address",
      example: 'john.doe@example.com',
      required: false,
    },
    user_first_name: {
      name: 'user_first_name',
      type: VariableDataType.STRING,
      category: VariableCategory.USER,
      description: "User's first name",
      example: 'John',
      required: false,
    },
    user_last_name: {
      name: 'user_last_name',
      type: VariableDataType.STRING,
      category: VariableCategory.USER,
      description: "User's last name",
      example: 'Doe',
      required: false,
    },
    user_full_name: {
      name: 'user_full_name',
      type: VariableDataType.STRING,
      category: VariableCategory.USER,
      description: "User's full name (first + last)",
      example: 'John Doe',
      required: false,
    },
    user_name: {
      name: 'user_name',
      type: VariableDataType.STRING,
      category: VariableCategory.USER,
      description: "User's first name (commonly used in greetings)",
      example: 'John',
      required: false,
    },
    user_phone: {
      name: 'user_phone',
      type: VariableDataType.PHONE,
      category: VariableCategory.USER,
      description: "User's phone number",
      example: '+1-555-0123',
      required: false,
    },
    user_is_active: {
      name: 'user_is_active',
      type: VariableDataType.BOOLEAN,
      category: VariableCategory.USER,
      description: 'Whether user account is active',
      example: true,
      required: false,
    },
    user_is_platform_admin: {
      name: 'user_is_platform_admin',
      type: VariableDataType.BOOLEAN,
      category: VariableCategory.USER,
      description: 'Whether user has platform admin privileges',
      example: false,
      required: false,
    },
    user_role_name: {
      name: 'user_role_name',
      type: VariableDataType.STRING,
      category: VariableCategory.USER,
      description: "User's role name within their tenant",
      example: 'Admin',
      required: false,
    },
    last_login_at: {
      name: 'last_login_at',
      type: VariableDataType.DATE,
      category: VariableCategory.USER,
      description: "User's last login timestamp",
      example: '2026-01-08T14:30:00Z',
      required: false,
      format: 'ISO 8601',
    },

    // ==================== TENANT/COMPANY VARIABLES ====================
    company_name: {
      name: 'company_name',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Company/business name',
      example: 'Acme Roofing Co.',
      required: false,
    },
    company_legal_name: {
      name: 'company_legal_name',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Legal business name',
      example: 'Acme Roofing Corporation LLC',
      required: false,
    },
    company_phone: {
      name: 'company_phone',
      type: VariableDataType.PHONE,
      category: VariableCategory.TENANT,
      description: 'Company primary phone number',
      example: '+1-555-0123',
      required: false,
    },
    company_email: {
      name: 'company_email',
      type: VariableDataType.EMAIL,
      category: VariableCategory.TENANT,
      description: 'Company primary contact email',
      example: 'contact@acmeroofing.com',
      required: false,
    },
    company_website: {
      name: 'company_website',
      type: VariableDataType.URL,
      category: VariableCategory.TENANT,
      description: 'Company website URL',
      example: 'https://acmeroofing.com',
      required: false,
    },
    company_logo_url: {
      name: 'company_logo_url',
      type: VariableDataType.URL,
      category: VariableCategory.TENANT,
      description: 'URL to company logo image',
      example: 'https://cdn.lead360.app/logos/acme.png',
      required: false,
    },
    business_entity_type: {
      name: 'business_entity_type',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Type of business entity',
      example: 'LLC',
      required: false,
    },
    ein: {
      name: 'ein',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Employer Identification Number',
      example: '12-3456789',
      required: false,
    },
    state_of_registration: {
      name: 'state_of_registration',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'State where business is registered',
      example: 'CA',
      required: false,
    },
    date_of_incorporation: {
      name: 'date_of_incorporation',
      type: VariableDataType.DATE,
      category: VariableCategory.TENANT,
      description: 'Date business was incorporated',
      example: '2020-01-15',
      required: false,
      format: 'YYYY-MM-DD',
    },
    brand_primary_color: {
      name: 'brand_primary_color',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Primary brand color (hex code)',
      example: '#0066CC',
      required: false,
    },
    invoice_prefix: {
      name: 'invoice_prefix',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Prefix used for invoice numbers',
      example: 'INV',
      required: false,
    },
    quote_prefix: {
      name: 'quote_prefix',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Prefix used for quote numbers',
      example: 'QT',
      required: false,
    },

    // Address Variables
    address_line1: {
      name: 'address_line1',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Company street address (line 1)',
      example: '123 Main Street',
      required: false,
    },
    address_line2: {
      name: 'address_line2',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Company street address (line 2)',
      example: 'Suite 200',
      required: false,
    },
    address_city: {
      name: 'address_city',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Company city',
      example: 'San Francisco',
      required: false,
    },
    address_state: {
      name: 'address_state',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Company state (2-letter code)',
      example: 'CA',
      required: false,
    },
    address_zip_code: {
      name: 'address_zip_code',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Company ZIP/postal code',
      example: '94105',
      required: false,
    },
    address_country: {
      name: 'address_country',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Company country',
      example: 'United States',
      required: false,
    },

    // Banking Variables
    bank_name: {
      name: 'bank_name',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Name of banking institution',
      example: 'Bank of America',
      required: false,
    },
    routing_number: {
      name: 'routing_number',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Bank routing number (masked for security)',
      example: '****1234',
      required: false,
    },
    account_number: {
      name: 'account_number',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Bank account number (masked for security)',
      example: '****5678',
      required: false,
    },
    venmo_username: {
      name: 'venmo_username',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Venmo username for payments',
      example: '@acme-roofing',
      required: false,
    },

    // Insurance Variables
    gl_insurance_provider: {
      name: 'gl_insurance_provider',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'General Liability insurance provider',
      example: 'State Farm',
      required: false,
    },
    gl_policy_number: {
      name: 'gl_policy_number',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'General Liability policy number',
      example: 'GL-123456',
      required: false,
    },
    gl_expiry_date: {
      name: 'gl_expiry_date',
      type: VariableDataType.DATE,
      category: VariableCategory.TENANT,
      description: 'General Liability insurance expiry date',
      example: '2027-12-31',
      required: false,
      format: 'YYYY-MM-DD',
    },
    wc_insurance_provider: {
      name: 'wc_insurance_provider',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: "Workers' Compensation insurance provider",
      example: 'Liberty Mutual',
      required: false,
    },
    wc_policy_number: {
      name: 'wc_policy_number',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: "Workers' Compensation policy number",
      example: 'WC-789012',
      required: false,
    },
    wc_expiry_date: {
      name: 'wc_expiry_date',
      type: VariableDataType.DATE,
      category: VariableCategory.TENANT,
      description: "Workers' Compensation insurance expiry date",
      example: '2027-12-31',
      required: false,
      format: 'YYYY-MM-DD',
    },

    // License Variables
    license_type: {
      name: 'license_type',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'Type of license (e.g., General Contractor)',
      example: 'General Contractor',
      required: false,
    },
    license_number: {
      name: 'license_number',
      type: VariableDataType.STRING,
      category: VariableCategory.TENANT,
      description: 'License number',
      example: 'ABC123456',
      required: false,
    },
    expiry_date: {
      name: 'expiry_date',
      type: VariableDataType.DATE,
      category: VariableCategory.TENANT,
      description: 'License or insurance expiration date',
      example: '2027-12-31',
      required: false,
      format: 'YYYY-MM-DD',
    },
    days_until_expiry: {
      name: 'days_until_expiry',
      type: VariableDataType.NUMBER,
      category: VariableCategory.TENANT,
      description: 'Number of days until expiration',
      example: 30,
      required: false,
    },

    // Financial Variables
    default_contingency_rate: {
      name: 'default_contingency_rate',
      type: VariableDataType.NUMBER,
      category: VariableCategory.TENANT,
      description: 'Default contingency percentage for quotes',
      example: 10,
      required: false,
      format: 'Percentage (0-100)',
    },
    default_profit_margin: {
      name: 'default_profit_margin',
      type: VariableDataType.NUMBER,
      category: VariableCategory.TENANT,
      description: 'Default profit margin percentage',
      example: 15,
      required: false,
      format: 'Percentage (0-100)',
    },
    sales_tax_rate: {
      name: 'sales_tax_rate',
      type: VariableDataType.NUMBER,
      category: VariableCategory.TENANT,
      description: 'Sales tax rate percentage',
      example: 8.5,
      required: false,
      format: 'Percentage (0-100)',
    },

    // ==================== SUBSCRIPTION/BILLING VARIABLES ====================
    plan_name: {
      name: 'plan_name',
      type: VariableDataType.STRING,
      category: VariableCategory.SUBSCRIPTION,
      description: 'Subscription plan name',
      example: 'Professional',
      required: false,
    },
    subscription_status: {
      name: 'subscription_status',
      type: VariableDataType.STRING,
      category: VariableCategory.SUBSCRIPTION,
      description: 'Current subscription status',
      example: 'active',
      required: false,
    },
    trial_end_date: {
      name: 'trial_end_date',
      type: VariableDataType.DATE,
      category: VariableCategory.SUBSCRIPTION,
      description: 'Date when trial period ends',
      example: '2026-02-15',
      required: false,
      format: 'YYYY-MM-DD',
    },
    trial_days_remaining: {
      name: 'trial_days_remaining',
      type: VariableDataType.NUMBER,
      category: VariableCategory.SUBSCRIPTION,
      description: 'Number of days left in trial',
      example: 7,
      required: false,
    },
    is_in_trial: {
      name: 'is_in_trial',
      type: VariableDataType.BOOLEAN,
      category: VariableCategory.SUBSCRIPTION,
      description: 'Whether subscription is in trial period',
      example: true,
      required: false,
    },
    max_users: {
      name: 'max_users',
      type: VariableDataType.NUMBER,
      category: VariableCategory.SUBSCRIPTION,
      description: 'Maximum users allowed on plan',
      example: 10,
      required: false,
    },
    max_storage_gb: {
      name: 'max_storage_gb',
      type: VariableDataType.NUMBER,
      category: VariableCategory.SUBSCRIPTION,
      description: 'Maximum storage in gigabytes',
      example: 100,
      required: false,
    },

    // Billing Variables
    monthly_price: {
      name: 'monthly_price',
      type: VariableDataType.CURRENCY,
      category: VariableCategory.BILLING,
      description: 'Monthly subscription price',
      example: 99.99,
      required: false,
      format: '$0.00',
    },
    annual_price: {
      name: 'annual_price',
      type: VariableDataType.CURRENCY,
      category: VariableCategory.BILLING,
      description: 'Annual subscription price',
      example: 999.9,
      required: false,
      format: '$0.00',
    },
    billing_cycle: {
      name: 'billing_cycle',
      type: VariableDataType.STRING,
      category: VariableCategory.BILLING,
      description: 'Billing frequency (monthly, annual)',
      example: 'monthly',
      required: false,
    },
    next_billing_date: {
      name: 'next_billing_date',
      type: VariableDataType.DATE,
      category: VariableCategory.BILLING,
      description: 'Next billing/renewal date',
      example: '2026-02-01',
      required: false,
      format: 'YYYY-MM-DD',
    },
    amount_due: {
      name: 'amount_due',
      type: VariableDataType.CURRENCY,
      category: VariableCategory.BILLING,
      description: 'Total amount due on next billing',
      example: 99.99,
      required: false,
      format: '$0.00',
    },
    payment_method_last4: {
      name: 'payment_method_last4',
      type: VariableDataType.STRING,
      category: VariableCategory.BILLING,
      description: 'Last 4 digits of payment method',
      example: '4242',
      required: false,
    },

    // ==================== SYSTEM VARIABLES ====================
    platform_name: {
      name: 'platform_name',
      type: VariableDataType.STRING,
      category: VariableCategory.SYSTEM,
      description: 'Platform name',
      example: 'Lead360',
      required: false,
      default_value: 'Lead360',
    },
    platform_domain: {
      name: 'platform_domain',
      type: VariableDataType.STRING,
      category: VariableCategory.SYSTEM,
      description: 'Platform domain',
      example: 'lead360.app',
      required: false,
      default_value: 'lead360.app',
    },
    platform_support_email: {
      name: 'platform_support_email',
      type: VariableDataType.EMAIL,
      category: VariableCategory.SYSTEM,
      description: 'Platform support email address',
      example: 'support@lead360.com',
      required: false,
      default_value: 'support@lead360.com',
    },
    platform_logo_url: {
      name: 'platform_logo_url',
      type: VariableDataType.URL,
      category: VariableCategory.SYSTEM,
      description: 'URL to platform logo',
      example: 'https://lead360.app/logo.png',
      required: false,
    },
    app_base_url: {
      name: 'app_base_url',
      type: VariableDataType.URL,
      category: VariableCategory.SYSTEM,
      description: 'Base URL for the application',
      example: 'https://app.lead360.app',
      required: false,
      default_value: 'https://app.lead360.app',
    },
    tenant_dashboard_url: {
      name: 'tenant_dashboard_url',
      type: VariableDataType.URL,
      category: VariableCategory.SYSTEM,
      description: 'URL to tenant dashboard',
      example: 'https://acme.lead360.app/dashboard',
      required: false,
    },
    admin_panel_url: {
      name: 'admin_panel_url',
      type: VariableDataType.URL,
      category: VariableCategory.SYSTEM,
      description: 'URL to admin panel',
      example: 'https://app.lead360.app/admin',
      required: false,
    },
    generated_at: {
      name: 'generated_at',
      type: VariableDataType.DATE,
      category: VariableCategory.SYSTEM,
      description: 'Date/time when email was generated',
      example: '2026-01-08T14:30:00Z',
      required: false,
      format: 'ISO 8601',
    },
    current_year: {
      name: 'current_year',
      type: VariableDataType.NUMBER,
      category: VariableCategory.SYSTEM,
      description: 'Current year',
      example: 2026,
      required: false,
    },
    formatted_date: {
      name: 'formatted_date',
      type: VariableDataType.STRING,
      category: VariableCategory.SYSTEM,
      description: 'Current date in readable format',
      example: 'January 8, 2026',
      required: false,
    },
    formatted_time: {
      name: 'formatted_time',
      type: VariableDataType.STRING,
      category: VariableCategory.SYSTEM,
      description: 'Current time in readable format',
      example: '2:30 PM',
      required: false,
    },

    // Auth/Security Variables
    reset_link: {
      name: 'reset_link',
      type: VariableDataType.URL,
      category: VariableCategory.SYSTEM,
      description: 'Password reset URL with embedded token',
      example: 'https://app.lead360.com/reset?token=abc123',
      required: false,
    },
    activation_link: {
      name: 'activation_link',
      type: VariableDataType.URL,
      category: VariableCategory.SYSTEM,
      description: 'Account activation URL with embedded token',
      example: 'https://app.lead360.com/activate?token=xyz789',
      required: false,
    },
  };

  /**
   * Get all available variables
   */
  getAllVariables(): VariableSchema {
    return this.registry;
  }

  /**
   * Get variables by category
   */
  getVariablesByCategory(category: VariableCategory): VariableSchema {
    return Object.fromEntries(
      Object.entries(this.registry).filter(
        ([_, field]) => field.category === category,
      ),
    );
  }

  /**
   * Get variable schema for specific variables
   */
  getVariablesSchema(variableNames: string[]): VariableSchema {
    return Object.fromEntries(
      variableNames
        .map((name) => [name, this.registry[name]])
        .filter(([_, field]) => field !== undefined),
    );
  }

  /**
   * Validate that all variables exist in registry
   */
  validateVariables(variableNames: string[]): {
    valid: boolean;
    unknown: string[];
  } {
    const unknown = variableNames.filter((name) => !this.registry[name]);
    return {
      valid: unknown.length === 0,
      unknown,
    };
  }

  /**
   * Get sample data for all variables
   */
  getSampleData(variableNames: string[]): Record<string, any> {
    return Object.fromEntries(
      variableNames
        .filter((name) => this.registry[name])
        .map((name) => [name, this.registry[name].example]),
    );
  }

  /**
   * Get variable by name
   */
  getVariable(name: string): VariableSchemaField | undefined {
    return this.registry[name];
  }

  /**
   * Get all categories
   */
  getCategories(): VariableCategory[] {
    return Object.values(VariableCategory);
  }

  /**
   * Get count of variables per category
   */
  getVariableCountByCategory(): Record<VariableCategory, number> {
    const counts: Record<string, number> = {};
    for (const category of this.getCategories()) {
      counts[category] = Object.values(this.registry).filter(
        (v) => v.category === category,
      ).length;
    }
    return counts as Record<VariableCategory, number>;
  }

  /**
   * Search variables by name or description
   */
  searchVariables(query: string): VariableSchema {
    const lowercaseQuery = query.toLowerCase();
    return Object.fromEntries(
      Object.entries(this.registry).filter(
        ([name, field]) =>
          name.toLowerCase().includes(lowercaseQuery) ||
          field.description.toLowerCase().includes(lowercaseQuery),
      ),
    );
  }
}
