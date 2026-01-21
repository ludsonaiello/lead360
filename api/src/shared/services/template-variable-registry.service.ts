/**
 * Centralized Template Variable Registry Service
 *
 * Single source of truth for ALL template variables across the platform.
 * Used by:
 * - Communication Module (emails, SMS, notifications)
 * - Jobs Module (scheduled email campaigns)
 * - Any future module that needs template variables
 *
 * Features:
 * - System-wide default variables
 * - Tenant-specific custom variables
 * - Dynamic data from Leads, Customers, Quotes, Invoices, etc.
 * - Admin-manageable variable registry
 */

import { Injectable } from '@nestjs/common';
import {
  VariableCategory,
  VariableDataType,
  VariableDefinition,
  VariableRegistry,
  VariablesByCategory,
} from '../types/template-variable.types';

@Injectable()
export class TemplateVariableRegistryService {
  /**
   * Master registry of ALL system-wide default variables
   * These are available to all tenants
   */
  private getSystemVariables(): VariableRegistry {
    const currentYear = new Date().getFullYear();
    const currentDate = new Date().toISOString().split('T')[0];

    return {
      // ==================== USER VARIABLES ====================
      user_id: {
        name: 'user_id',
        type: VariableDataType.STRING,
        category: VariableCategory.USER,
        description: 'User unique identifier (UUID)',
        example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      },
      user_email: {
        name: 'user_email',
        type: VariableDataType.EMAIL,
        category: VariableCategory.USER,
        description: 'User email address',
        example: 'john.doe@example.com',
      },
      user_first_name: {
        name: 'user_first_name',
        type: VariableDataType.STRING,
        category: VariableCategory.USER,
        description: 'User first name',
        example: 'John',
      },
      user_last_name: {
        name: 'user_last_name',
        type: VariableDataType.STRING,
        category: VariableCategory.USER,
        description: 'User last name',
        example: 'Doe',
      },
      user_full_name: {
        name: 'user_full_name',
        type: VariableDataType.STRING,
        category: VariableCategory.USER,
        description: 'User full name (first + last)',
        example: 'John Doe',
      },
      user_name: {
        name: 'user_name',
        type: VariableDataType.STRING,
        category: VariableCategory.USER,
        description: 'User first name (commonly used in greetings)',
        example: 'John',
      },
      user_phone: {
        name: 'user_phone',
        type: VariableDataType.PHONE,
        category: VariableCategory.USER,
        description: 'User phone number',
        example: '+1-555-0123',
      },
      user_role_name: {
        name: 'user_role_name',
        type: VariableDataType.STRING,
        category: VariableCategory.USER,
        description: 'User role within their tenant',
        example: 'Admin',
      },
      last_login_at: {
        name: 'last_login_at',
        type: VariableDataType.DATE,
        category: VariableCategory.USER,
        description: 'User last login timestamp',
        example: '2026-01-08T14:30:00Z',
        format: 'ISO 8601',
      },

      // ==================== TENANT/COMPANY VARIABLES ====================
      company_name: {
        name: 'company_name',
        type: VariableDataType.STRING,
        category: VariableCategory.TENANT,
        description: 'Company/business name',
        example: 'Acme Roofing Co.',
      },
      company_legal_name: {
        name: 'company_legal_name',
        type: VariableDataType.STRING,
        category: VariableCategory.TENANT,
        description: 'Legal business name',
        example: 'Acme Roofing Corporation LLC',
      },
      company_phone: {
        name: 'company_phone',
        type: VariableDataType.PHONE,
        category: VariableCategory.TENANT,
        description: 'Company primary phone number',
        example: '+1-555-0123',
      },
      company_email: {
        name: 'company_email',
        type: VariableDataType.EMAIL,
        category: VariableCategory.TENANT,
        description: 'Company primary contact email',
        example: 'contact@acmeroofing.com',
      },
      company_website: {
        name: 'company_website',
        type: VariableDataType.URL,
        category: VariableCategory.TENANT,
        description: 'Company website URL',
        example: 'https://acmeroofing.com',
      },
      company_logo_url: {
        name: 'company_logo_url',
        type: VariableDataType.URL,
        category: VariableCategory.TENANT,
        description: 'URL to company logo image',
        example: 'https://cdn.lead360.app/logos/acme.png',
      },
      company_address: {
        name: 'company_address',
        type: VariableDataType.STRING,
        category: VariableCategory.TENANT,
        description: 'Company physical address',
        example: '123 Main St, City, ST 12345',
      },
      business_entity_type: {
        name: 'business_entity_type',
        type: VariableDataType.STRING,
        category: VariableCategory.TENANT,
        description: 'Type of business entity',
        example: 'LLC',
      },
      ein: {
        name: 'ein',
        type: VariableDataType.STRING,
        category: VariableCategory.TENANT,
        description: 'Employer Identification Number',
        example: '12-3456789',
      },
      state_of_registration: {
        name: 'state_of_registration',
        type: VariableDataType.STRING,
        category: VariableCategory.TENANT,
        description: 'State where business is registered',
        example: 'CA',
      },
      brand_primary_color: {
        name: 'brand_primary_color',
        type: VariableDataType.STRING,
        category: VariableCategory.TENANT,
        description: 'Primary brand color (hex code)',
        example: '#0066CC',
      },

      // ==================== LEAD VARIABLES ====================
      lead_id: {
        name: 'lead_id',
        type: VariableDataType.STRING,
        category: VariableCategory.LEAD,
        description: 'Lead unique identifier',
        example: 'lead-abc123',
      },
      lead_name: {
        name: 'lead_name',
        type: VariableDataType.STRING,
        category: VariableCategory.LEAD,
        description: 'Lead full name',
        example: 'Jane Smith',
      },
      lead_first_name: {
        name: 'lead_first_name',
        type: VariableDataType.STRING,
        category: VariableCategory.LEAD,
        description: 'Lead first name',
        example: 'Jane',
      },
      lead_last_name: {
        name: 'lead_last_name',
        type: VariableDataType.STRING,
        category: VariableCategory.LEAD,
        description: 'Lead last name',
        example: 'Smith',
      },
      lead_email: {
        name: 'lead_email',
        type: VariableDataType.EMAIL,
        category: VariableCategory.LEAD,
        description: 'Lead email address',
        example: 'jane.smith@example.com',
      },
      lead_phone: {
        name: 'lead_phone',
        type: VariableDataType.PHONE,
        category: VariableCategory.LEAD,
        description: 'Lead phone number',
        example: '(555) 987-6543',
      },
      lead_source: {
        name: 'lead_source',
        type: VariableDataType.STRING,
        category: VariableCategory.LEAD,
        description: 'Source where lead came from',
        example: 'Google Ads',
      },
      lead_status: {
        name: 'lead_status',
        type: VariableDataType.STRING,
        category: VariableCategory.LEAD,
        description: 'Current lead status',
        example: 'New',
      },
      service_requested: {
        name: 'service_requested',
        type: VariableDataType.STRING,
        category: VariableCategory.LEAD,
        description: 'Service requested by lead',
        example: 'Roof Replacement',
      },
      lead_notes: {
        name: 'lead_notes',
        type: VariableDataType.STRING,
        category: VariableCategory.LEAD,
        description: 'Internal notes about lead',
        example: 'Customer wants urgent service',
      },

      // ==================== CUSTOMER VARIABLES ====================
      customer_id: {
        name: 'customer_id',
        type: VariableDataType.STRING,
        category: VariableCategory.CUSTOMER,
        description: 'Customer unique identifier',
        example: 'cust-abc123',
      },
      customer_name: {
        name: 'customer_name',
        type: VariableDataType.STRING,
        category: VariableCategory.CUSTOMER,
        description: 'Customer full name',
        example: 'John Doe',
      },
      customer_first_name: {
        name: 'customer_first_name',
        type: VariableDataType.STRING,
        category: VariableCategory.CUSTOMER,
        description: 'Customer first name',
        example: 'John',
      },
      customer_last_name: {
        name: 'customer_last_name',
        type: VariableDataType.STRING,
        category: VariableCategory.CUSTOMER,
        description: 'Customer last name',
        example: 'Doe',
      },
      customer_email: {
        name: 'customer_email',
        type: VariableDataType.EMAIL,
        category: VariableCategory.CUSTOMER,
        description: 'Customer email address',
        example: 'john@example.com',
      },
      customer_phone: {
        name: 'customer_phone',
        type: VariableDataType.PHONE,
        category: VariableCategory.CUSTOMER,
        description: 'Customer phone number',
        example: '(555) 987-6543',
      },
      customer_address: {
        name: 'customer_address',
        type: VariableDataType.STRING,
        category: VariableCategory.CUSTOMER,
        description: 'Customer address',
        example: '456 Oak Ave, City, ST 54321',
      },
      customer_type: {
        name: 'customer_type',
        type: VariableDataType.STRING,
        category: VariableCategory.CUSTOMER,
        description: 'Customer type',
        example: 'Residential',
      },

      // ==================== QUOTE VARIABLES ====================
      quote_id: {
        name: 'quote_id',
        type: VariableDataType.STRING,
        category: VariableCategory.QUOTE,
        description: 'Quote unique identifier',
        example: 'quote-xyz789',
      },
      quote_number: {
        name: 'quote_number',
        type: VariableDataType.STRING,
        category: VariableCategory.QUOTE,
        description: 'Quote number',
        example: 'Q-12345',
      },
      quote_date: {
        name: 'quote_date',
        type: VariableDataType.DATE,
        category: VariableCategory.QUOTE,
        description: 'Quote creation date',
        example: '2026-01-18',
        format: 'YYYY-MM-DD',
      },
      quote_valid_until: {
        name: 'quote_valid_until',
        type: VariableDataType.DATE,
        category: VariableCategory.QUOTE,
        description: 'Quote expiration date',
        example: '2026-02-18',
        format: 'YYYY-MM-DD',
      },
      quote_subtotal: {
        name: 'quote_subtotal',
        type: VariableDataType.CURRENCY,
        category: VariableCategory.QUOTE,
        description: 'Quote subtotal (formatted)',
        example: '$1,150.00',
      },
      quote_tax: {
        name: 'quote_tax',
        type: VariableDataType.CURRENCY,
        category: VariableCategory.QUOTE,
        description: 'Quote tax amount (formatted)',
        example: '$100.00',
      },
      quote_total: {
        name: 'quote_total',
        type: VariableDataType.CURRENCY,
        category: VariableCategory.QUOTE,
        description: 'Quote total amount (formatted)',
        example: '$1,250.00',
      },
      quote_status: {
        name: 'quote_status',
        type: VariableDataType.STRING,
        category: VariableCategory.QUOTE,
        description: 'Quote status',
        example: 'Sent',
      },
      quote_link: {
        name: 'quote_link',
        type: VariableDataType.URL,
        category: VariableCategory.QUOTE,
        description: 'Link to view quote online',
        example: 'https://app.lead360.app/quotes/abc123',
      },
      quote_pdf_url: {
        name: 'quote_pdf_url',
        type: VariableDataType.URL,
        category: VariableCategory.QUOTE,
        description: 'Link to download quote PDF',
        example: 'https://cdn.lead360.app/quotes/Q-12345.pdf',
      },

      // ==================== INVOICE VARIABLES ====================
      invoice_id: {
        name: 'invoice_id',
        type: VariableDataType.STRING,
        category: VariableCategory.INVOICE,
        description: 'Invoice unique identifier',
        example: 'inv-abc123',
      },
      invoice_number: {
        name: 'invoice_number',
        type: VariableDataType.STRING,
        category: VariableCategory.INVOICE,
        description: 'Invoice number',
        example: 'INV-12345',
      },
      invoice_date: {
        name: 'invoice_date',
        type: VariableDataType.DATE,
        category: VariableCategory.INVOICE,
        description: 'Invoice date',
        example: '2026-01-18',
        format: 'YYYY-MM-DD',
      },
      invoice_due_date: {
        name: 'invoice_due_date',
        type: VariableDataType.DATE,
        category: VariableCategory.INVOICE,
        description: 'Invoice due date',
        example: '2026-02-01',
        format: 'YYYY-MM-DD',
      },
      invoice_subtotal: {
        name: 'invoice_subtotal',
        type: VariableDataType.CURRENCY,
        category: VariableCategory.INVOICE,
        description: 'Invoice subtotal (formatted)',
        example: '$1,150.00',
      },
      invoice_tax: {
        name: 'invoice_tax',
        type: VariableDataType.CURRENCY,
        category: VariableCategory.INVOICE,
        description: 'Invoice tax amount (formatted)',
        example: '$100.00',
      },
      invoice_total: {
        name: 'invoice_total',
        type: VariableDataType.CURRENCY,
        category: VariableCategory.INVOICE,
        description: 'Invoice total amount (formatted)',
        example: '$1,250.00',
      },
      amount_paid: {
        name: 'amount_paid',
        type: VariableDataType.CURRENCY,
        category: VariableCategory.INVOICE,
        description: 'Amount already paid (formatted)',
        example: '$500.00',
      },
      amount_due: {
        name: 'amount_due',
        type: VariableDataType.CURRENCY,
        category: VariableCategory.INVOICE,
        description: 'Amount still due (formatted)',
        example: '$750.00',
      },
      invoice_status: {
        name: 'invoice_status',
        type: VariableDataType.STRING,
        category: VariableCategory.INVOICE,
        description: 'Invoice payment status',
        example: 'Unpaid',
      },
      invoice_link: {
        name: 'invoice_link',
        type: VariableDataType.URL,
        category: VariableCategory.INVOICE,
        description: 'Link to view invoice online',
        example: 'https://app.lead360.app/invoices/abc123',
      },
      invoice_pdf_url: {
        name: 'invoice_pdf_url',
        type: VariableDataType.URL,
        category: VariableCategory.INVOICE,
        description: 'Link to download invoice PDF',
        example: 'https://cdn.lead360.app/invoices/INV-12345.pdf',
      },
      payment_link: {
        name: 'payment_link',
        type: VariableDataType.URL,
        category: VariableCategory.INVOICE,
        description: 'Link to pay invoice online',
        example: 'https://app.lead360.app/pay/abc123',
      },

      // ==================== APPOINTMENT/JOB VARIABLES ====================
      appointment_id: {
        name: 'appointment_id',
        type: VariableDataType.STRING,
        category: VariableCategory.APPOINTMENT,
        description: 'Appointment unique identifier',
        example: 'appt-abc123',
      },
      appointment_date: {
        name: 'appointment_date',
        type: VariableDataType.DATE,
        category: VariableCategory.APPOINTMENT,
        description: 'Appointment date',
        example: '2026-01-20',
        format: 'YYYY-MM-DD',
      },
      appointment_time: {
        name: 'appointment_time',
        type: VariableDataType.STRING,
        category: VariableCategory.APPOINTMENT,
        description: 'Appointment time',
        example: '10:00 AM',
      },
      appointment_duration: {
        name: 'appointment_duration',
        type: VariableDataType.STRING,
        category: VariableCategory.APPOINTMENT,
        description: 'Expected duration of appointment',
        example: '2 hours',
      },
      appointment_type: {
        name: 'appointment_type',
        type: VariableDataType.STRING,
        category: VariableCategory.APPOINTMENT,
        description: 'Type of appointment',
        example: 'Inspection',
      },
      appointment_status: {
        name: 'appointment_status',
        type: VariableDataType.STRING,
        category: VariableCategory.APPOINTMENT,
        description: 'Appointment status',
        example: 'Confirmed',
      },
      job_address: {
        name: 'job_address',
        type: VariableDataType.STRING,
        category: VariableCategory.APPOINTMENT,
        description: 'Job site address',
        example: '789 Elm St, City, ST 12345',
      },
      technician_name: {
        name: 'technician_name',
        type: VariableDataType.STRING,
        category: VariableCategory.APPOINTMENT,
        description: 'Assigned technician name',
        example: 'Mike Smith',
      },
      technician_phone: {
        name: 'technician_phone',
        type: VariableDataType.PHONE,
        category: VariableCategory.APPOINTMENT,
        description: 'Technician phone number',
        example: '(555) 111-2222',
      },
      service_description: {
        name: 'service_description',
        type: VariableDataType.STRING,
        category: VariableCategory.APPOINTMENT,
        description: 'Description of service to be performed',
        example: 'Roof inspection and estimate',
      },

      // ==================== PAYMENT VARIABLES ====================
      payment_id: {
        name: 'payment_id',
        type: VariableDataType.STRING,
        category: VariableCategory.PAYMENT,
        description: 'Payment unique identifier',
        example: 'pay-abc123',
      },
      payment_amount: {
        name: 'payment_amount',
        type: VariableDataType.CURRENCY,
        category: VariableCategory.PAYMENT,
        description: 'Payment amount (formatted)',
        example: '$500.00',
      },
      payment_date: {
        name: 'payment_date',
        type: VariableDataType.DATE,
        category: VariableCategory.PAYMENT,
        description: 'Payment date',
        example: '2026-01-18',
        format: 'YYYY-MM-DD',
      },
      payment_method: {
        name: 'payment_method',
        type: VariableDataType.STRING,
        category: VariableCategory.PAYMENT,
        description: 'Payment method used',
        example: 'Credit Card',
      },
      payment_status: {
        name: 'payment_status',
        type: VariableDataType.STRING,
        category: VariableCategory.PAYMENT,
        description: 'Payment status',
        example: 'Completed',
      },
      transaction_id: {
        name: 'transaction_id',
        type: VariableDataType.STRING,
        category: VariableCategory.PAYMENT,
        description: 'Payment transaction ID',
        example: 'txn-xyz789',
      },

      // ==================== SYSTEM VARIABLES ====================
      platform_name: {
        name: 'platform_name',
        type: VariableDataType.STRING,
        category: VariableCategory.SYSTEM,
        description: 'Platform name',
        example: 'Lead360',
      },
      platform_url: {
        name: 'platform_url',
        type: VariableDataType.URL,
        category: VariableCategory.SYSTEM,
        description: 'Platform URL',
        example: 'https://lead360.app',
      },
      support_email: {
        name: 'support_email',
        type: VariableDataType.EMAIL,
        category: VariableCategory.SYSTEM,
        description: 'Platform support email',
        example: 'support@lead360.app',
      },
      current_year: {
        name: 'current_year',
        type: VariableDataType.NUMBER,
        category: VariableCategory.SYSTEM,
        description: 'Current year',
        example: currentYear,
      },
      current_date: {
        name: 'current_date',
        type: VariableDataType.DATE,
        category: VariableCategory.SYSTEM,
        description: 'Current date',
        example: currentDate,
        format: 'YYYY-MM-DD',
      },
      activation_link: {
        name: 'activation_link',
        type: VariableDataType.URL,
        category: VariableCategory.SYSTEM,
        description: 'Account activation link',
        example: 'https://app.lead360.app/activate?token=abc123',
      },
      reset_link: {
        name: 'reset_link',
        type: VariableDataType.URL,
        category: VariableCategory.SYSTEM,
        description: 'Password reset link',
        example: 'https://app.lead360.app/reset?token=xyz789',
      },
      unsubscribe_link: {
        name: 'unsubscribe_link',
        type: VariableDataType.URL,
        category: VariableCategory.SYSTEM,
        description: 'Unsubscribe from emails link',
        example: 'https://app.lead360.app/unsubscribe?token=def456',
      },
    };
  }

  /**
   * Get all variables organized by category
   */
  getAllVariables(): VariablesByCategory {
    const registry = this.getSystemVariables();
    const byCategory: VariablesByCategory = {};

    for (const [varName, varDef] of Object.entries(registry)) {
      const category = varDef.category;
      if (!byCategory[category]) {
        byCategory[category] = {};
      }
      const { category: _, ...defWithoutCategory } = varDef;
      byCategory[category][varName] = defWithoutCategory;
    }

    return byCategory;
  }

  /**
   * Get variables for a specific category
   */
  getVariablesByCategory(category: VariableCategory): Record<string, Omit<VariableDefinition, 'category'>> {
    const registry = this.getSystemVariables();
    const filtered: Record<string, Omit<VariableDefinition, 'category'>> = {};

    for (const [varName, varDef] of Object.entries(registry)) {
      if (varDef.category === category) {
        const { category: _, ...defWithoutCategory } = varDef;
        filtered[varName] = defWithoutCategory;
      }
    }

    return filtered;
  }

  /**
   * Get flat list of all variable names
   */
  getAllVariableNames(): string[] {
    return Object.keys(this.getSystemVariables());
  }

  /**
   * Get all categories
   */
  getCategories(): VariableCategory[] {
    return Object.values(VariableCategory);
  }

  /**
   * Get sample data for specific variables
   */
  getSampleData(variableNames: string[]): Record<string, any> {
    const registry = this.getSystemVariables();
    const sampleData: Record<string, any> = {};

    for (const varName of variableNames) {
      if (registry[varName]) {
        sampleData[varName] = registry[varName].example;
      }
    }

    return sampleData;
  }

  /**
   * Validate that variables exist in registry
   */
  validateVariables(variableNames: string[]): { valid: boolean; unknown: string[] } {
    const registry = this.getSystemVariables();
    const unknown = variableNames.filter((name) => !registry[name]);

    return {
      valid: unknown.length === 0,
      unknown,
    };
  }

  /**
   * Search variables by name or description
   */
  searchVariables(query: string): VariableRegistry {
    const registry = this.getSystemVariables();
    const lowercaseQuery = query.toLowerCase();
    const filtered: VariableRegistry = {};

    for (const [varName, varDef] of Object.entries(registry)) {
      if (
        varName.toLowerCase().includes(lowercaseQuery) ||
        varDef.description.toLowerCase().includes(lowercaseQuery)
      ) {
        filtered[varName] = varDef;
      }
    }

    return filtered;
  }

  /**
   * Get variable count by category
   */
  getVariableCountByCategory(): Record<VariableCategory, number> {
    const registry = this.getSystemVariables();
    const counts: Record<string, number> = {};

    for (const category of this.getCategories()) {
      counts[category] = 0;
    }

    for (const varDef of Object.values(registry)) {
      counts[varDef.category]++;
    }

    return counts as Record<VariableCategory, number>;
  }
}
