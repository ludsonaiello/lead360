import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface TemplateSeed {
  name: string;
  description: string;
  template_type: 'visual' | 'code';
  category_name: string;
  tags: string[];
  visual_structure?: any;
  html_content?: string;
  css_content?: string;
}

// Pre-built Template Library: 18 Professional Templates
const TEMPLATE_SEEDS: TemplateSeed[] = [
  // ========================================
  // MODERN TEMPLATES (Visual)
  // ========================================
  {
    name: 'Modern Professional',
    description:
      'Clean, contemporary template with horizontal header and card-style customer info. Perfect for tech, consulting, and professional services.',
    template_type: 'visual',
    category_name: 'Modern',
    tags: ['modern', 'professional', 'clean', 'minimal'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'header-1',
              component_id: 'MODERN_HEADER',
              props: {
                show_logo: true,
                logo_width: 120,
                show_company_name: true,
                background_color: '#ffffff',
                text_color: '#1f2937',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_CARD',
              props: {
                card_background: '#f9fafb',
                card_border: '#e5e7eb',
                show_icon: true,
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_STANDARD',
              props: {
                show_header: true,
                alternate_rows: true,
                row_color_even: '#f9fafb',
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_RIGHT_ALIGNED',
              props: {
                show_discount: true,
                show_tax: true,
                total_background: '#2563eb',
                total_color: '#ffffff',
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 80,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_MINIMAL',
              props: {
                show_page_number: true,
                text_color: '#9ca3af',
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  {
    name: 'Modern Minimal',
    description:
      'Ultra-clean minimal template with essential information only. Great for startups and creative agencies.',
    template_type: 'visual',
    category_name: 'Modern',
    tags: ['modern', 'minimal', 'clean', 'simple'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
        header: {
          enabled: true,
          height: 80,
          components: [
            {
              id: 'header-1',
              component_id: 'MINIMAL_HEADER',
              props: {
                show_logo: false,
                accent_color: '#2563eb',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_LIST',
              props: {
                show_title: true,
                title_text: 'Client:',
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_MINIMAL',
              props: {
                show_quantity: false,
                show_unit_price: false,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_SIMPLE',
              props: {
                font_size: 24,
                accent_color: '#2563eb',
              },
            },
          ],
        },
        footer: {
          enabled: false,
        },
      },
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#9ca3af',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.6,
      },
    },
  },

  {
    name: 'Modern Bold',
    description:
      'Bold, high-contrast template with strong visual hierarchy. Perfect for making quotes stand out.',
    template_type: 'visual',
    category_name: 'Modern',
    tags: ['modern', 'bold', 'high-contrast', 'standout'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 140,
          components: [
            {
              id: 'header-1',
              component_id: 'SPLIT_HEADER',
              props: {
                show_logo: true,
                logo_width: 100,
                divider_style: 'solid',
                divider_color: '#2563eb',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_TWO_COLUMN',
              props: {
                show_service_address: true,
                column_gap: 30,
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_DETAILED',
              props: {
                show_sku: true,
                show_discount: true,
                show_tax: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_BOXED',
              props: {
                box_background: '#eff6ff',
                box_border: '#2563eb',
                total_accent: '#2563eb',
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 60,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_MINIMAL',
              props: {
                show_page_number: true,
                text_color: '#6b7280',
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#1e40af',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  // ========================================
  // CLASSIC TEMPLATES (Code & Visual)
  // ========================================
  {
    name: 'Classic Business',
    description:
      'Traditional business template with centered layout. Formal and professional for established companies.',
    template_type: 'code',
    category_name: 'Classic',
    tags: ['classic', 'traditional', 'formal', 'centered'],
    html_content: `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote #{{quote.quote_number}}</title>
</head>
<body>
  <div class="quote-container">
    <!-- Header -->
    <div class="header">
      {{#if company.logo_url}}
        <img src="{{company.logo_url}}" alt="{{company.name}}" class="logo" />
      {{/if}}
      <h1 class="company-name">{{company.name}}</h1>
      <div class="company-details">
        <p>{{company.address}}</p>
        <p>{{company.phone}} | {{company.email}}</p>
        {{#if company.website}}
          <p>{{company.website}}</p>
        {{/if}}
      </div>
      <div class="quote-title">
        <h2>QUOTATION</h2>
        <p>Quote #{{quote.quote_number}} | Date: {{date quote.created_at}}</p>
      </div>
    </div>

    <!-- Customer Information -->
    <div class="customer-section">
      <h3>Bill To:</h3>
      <p class="customer-name">{{customer.name}}</p>
      <p>{{customer.email}}</p>
      <p>{{customer.phone}}</p>
      <p>{{customer.address}}</p>
      <p>{{customer.city}}, {{customer.state}} {{customer.zip}}</p>
    </div>

    <!-- Line Items -->
    <table class="line-items">
      <thead>
        <tr>
          <th>Description</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {{#each quote.line_items}}
          <tr>
            <td>
              <strong>{{this.name}}</strong>
              {{#if this.description}}
                <br><small>{{this.description}}</small>
              {{/if}}
            </td>
            <td class="center">{{this.quantity}}</td>
            <td class="right">{{currency this.unit_price}}</td>
            <td class="right">{{currency (multiply this.quantity this.unit_price)}}</td>
          </tr>
        {{/each}}
      </tbody>
    </table>

    <!-- Totals -->
    <div class="totals-section">
      <table class="totals">
        <tr>
          <td>Subtotal:</td>
          <td>{{currency quote.subtotal}}</td>
        </tr>
        {{#if quote.discount_amount}}
          <tr class="discount">
            <td>Discount {{#if quote.discount_percent}}({{percent quote.discount_percent}}){{/if}}:</td>
            <td>-{{currency quote.discount_amount}}</td>
          </tr>
        {{/if}}
        {{#if quote.tax_amount}}
          <tr>
            <td>Tax {{#if quote.tax_percent}}({{percent quote.tax_percent}}){{/if}}:</td>
            <td>{{currency quote.tax_amount}}</td>
          </tr>
        {{/if}}
        <tr class="total">
          <td>Total:</td>
          <td>{{currency quote.total}}</td>
        </tr>
      </table>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p class="terms">This quote is valid for 30 days. Payment is due upon completion of work.</p>
      <p class="copyright">&copy; {{year}} {{company.name}}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`,
    css_content: `body {
  font-family: Georgia, serif;
  color: #1f2937;
  margin: 0;
  padding: 20px;
}

.quote-container {
  max-width: 800px;
  margin: 0 auto;
}

.header {
  text-align: center;
  padding: 30px 20px;
  border-bottom: 3px double #1f2937;
  margin-bottom: 30px;
}

.logo {
  max-height: 100px;
  margin-bottom: 15px;
}

.company-name {
  font-size: 28px;
  font-weight: bold;
  margin: 10px 0;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.company-details {
  font-size: 13px;
  color: #4b5563;
  margin: 15px 0;
}

.quote-title {
  margin-top: 25px;
}

.quote-title h2 {
  font-size: 22px;
  font-weight: bold;
  margin: 0;
  letter-spacing: 3px;
}

.quote-title p {
  font-size: 13px;
  color: #6b7280;
  margin: 5px 0;
}

.customer-section {
  margin: 30px 0;
}

.customer-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  margin: 0 0 10px 0;
}

.customer-name {
  font-weight: bold;
  font-size: 16px;
}

.line-items {
  width: 100%;
  border-collapse: collapse;
  margin: 30px 0;
}

.line-items thead {
  background-color: #f3f4f6;
  border-bottom: 2px solid #d1d5db;
}

.line-items th {
  padding: 12px;
  text-align: left;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.5px;
}

.line-items td {
  padding: 12px;
  border-bottom: 1px solid #e5e7eb;
}

.center {
  text-align: center;
}

.right {
  text-align: right;
}

.totals-section {
  margin: 30px 0;
  display: flex;
  justify-content: flex-end;
}

.totals {
  width: 300px;
  font-size: 14px;
}

.totals td {
  padding: 10px;
  border-bottom: 1px solid #e5e7eb;
}

.totals td:first-child {
  text-align: left;
  color: #6b7280;
}

.totals td:last-child {
  text-align: right;
  font-weight: 600;
}

.totals .discount td:last-child {
  color: #10b981;
}

.totals .total {
  background-color: #1f2937;
  color: #ffffff;
  font-weight: bold;
  border: none;
}

.totals .total td {
  padding: 15px;
}

.footer {
  margin-top: 50px;
  padding-top: 20px;
  border-top: 2px solid #d1d5db;
  text-align: center;
  font-size: 11px;
  color: #6b7280;
}

.terms {
  margin-bottom: 15px;
}

.copyright {
  color: #9ca3af;
}`,
  },

  {
    name: 'Classic Formal',
    description:
      'Highly formal template for law firms, accounting, and professional services requiring traditional aesthetics.',
    template_type: 'visual',
    category_name: 'Classic',
    tags: ['classic', 'formal', 'traditional', 'professional'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 60, right: 60, bottom: 60, left: 60 },
        header: {
          enabled: true,
          height: 150,
          components: [
            {
              id: 'header-1',
              component_id: 'CLASSIC_HEADER',
              props: {
                show_logo: true,
                logo_width: 150,
                show_border: true,
                border_color: '#1f2937',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_LIST',
              props: {
                show_title: true,
                title_text: 'Bill To:',
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_STANDARD',
              props: {
                show_header: true,
                alternate_rows: false,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_RIGHT_ALIGNED',
              props: {
                show_discount: true,
                show_tax: true,
                total_background: '#1f2937',
                total_color: '#ffffff',
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 100,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_LEGAL',
              props: {
                show_payment_terms: true,
                show_warranty: true,
                font_size: 10,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#1f2937',
        secondaryColor: '#4b5563',
        fontFamily: 'Georgia, serif',
        fontSize: 13,
        lineHeight: 1.6,
      },
    },
  },

  // ========================================
  // INDUSTRY-SPECIFIC: HVAC
  // ========================================
  {
    name: 'HVAC Service Quote',
    description:
      'Specialized template for HVAC companies with service address and detailed payment terms.',
    template_type: 'visual',
    category_name: 'Industry',
    tags: ['hvac', 'service', 'industry', 'two-address'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 130,
          components: [
            {
              id: 'header-1',
              component_id: 'MODERN_HEADER',
              props: {
                show_logo: true,
                logo_width: 110,
                background_color: '#ffffff',
                text_color: '#1f2937',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_TWO_COLUMN',
              props: {
                show_service_address: true,
                column_gap: 30,
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_GROUPED',
              props: {
                show_category_subtotals: true,
                category_background: '#f3f4f6',
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_DETAILED',
              props: {
                show_deposit: true,
                show_balance: true,
              },
            },
            {
              id: 'signature-1',
              component_id: 'SIGNATURE_BLOCK',
              props: {
                show_date: true,
                show_print_name: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_CONTACT',
              props: {
                show_hours: true,
                show_social: false,
                background_color: '#f9fafb',
                text_color: '#6b7280',
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#dc2626',
        secondaryColor: '#991b1b',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  {
    name: 'HVAC Maintenance Agreement',
    description:
      'Template for HVAC maintenance contracts with payment schedule.',
    template_type: 'visual',
    category_name: 'Industry',
    tags: ['hvac', 'maintenance', 'contract', 'schedule'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'header-1',
              component_id: 'SPLIT_HEADER',
              props: {
                show_logo: true,
                logo_width: 100,
                divider_color: '#dc2626',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_CARD',
              props: {
                card_background: '#fef2f2',
                card_border: '#fca5a5',
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_STANDARD',
              props: {
                show_header: true,
                alternate_rows: true,
              },
            },
            {
              id: 'payment-schedule-1',
              component_id: 'PAYMENT_SCHEDULE',
              props: {
                show_percentage: true,
                highlight_due: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_BOXED',
              props: {
                box_background: '#fef2f2',
                box_border: '#dc2626',
                total_accent: '#dc2626',
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 80,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_LEGAL',
              props: {
                show_payment_terms: true,
                show_warranty: true,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#dc2626',
        secondaryColor: '#991b1b',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  // ========================================
  // INDUSTRY-SPECIFIC: PLUMBING
  // ========================================
  {
    name: 'Plumbing Service Estimate',
    description:
      'Professional plumbing quote template with detailed line items and emergency service options.',
    template_type: 'visual',
    category_name: 'Industry',
    tags: ['plumbing', 'service', 'industry', 'emergency'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'header-1',
              component_id: 'MODERN_HEADER',
              props: {
                show_logo: true,
                logo_width: 120,
                background_color: '#eff6ff',
                text_color: '#1e40af',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_TWO_COLUMN',
              props: {
                show_service_address: true,
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_DETAILED',
              props: {
                show_sku: true,
                show_discount: true,
                show_tax: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_DETAILED',
              props: {
                show_deposit: true,
                show_balance: true,
              },
            },
            {
              id: 'signature-1',
              component_id: 'SIGNATURE_BLOCK',
              props: {
                show_date: true,
                show_print_name: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_CONTACT',
              props: {
                show_hours: true,
                background_color: '#eff6ff',
                text_color: '#1e40af',
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#1e40af',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  // ========================================
  // INDUSTRY-SPECIFIC: ELECTRICAL
  // ========================================
  {
    name: 'Electrical Service Quote',
    description:
      'Electrical contractor template with detailed SKU tracking and safety compliance.',
    template_type: 'visual',
    category_name: 'Industry',
    tags: ['electrical', 'service', 'industry', 'compliance'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 130,
          components: [
            {
              id: 'header-1',
              component_id: 'SPLIT_HEADER',
              props: {
                show_logo: true,
                logo_width: 100,
                divider_color: '#f59e0b',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_CARD',
              props: {
                card_background: '#fffbeb',
                card_border: '#fcd34d',
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_DETAILED',
              props: {
                show_sku: true,
                show_discount: true,
                show_tax: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_BOXED',
              props: {
                box_background: '#fffbeb',
                box_border: '#f59e0b',
                total_accent: '#d97706',
              },
            },
            {
              id: 'signature-1',
              component_id: 'SIGNATURE_BLOCK',
              props: {
                show_date: true,
                show_print_name: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 100,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_LEGAL',
              props: {
                show_payment_terms: true,
                show_warranty: true,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#f59e0b',
        secondaryColor: '#d97706',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  // ========================================
  // INDUSTRY-SPECIFIC: LANDSCAPING
  // ========================================
  {
    name: 'Landscaping Project Proposal',
    description:
      'Comprehensive landscaping template with grouped services and payment milestones.',
    template_type: 'visual',
    category_name: 'Industry',
    tags: ['landscaping', 'project', 'industry', 'milestones'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'header-1',
              component_id: 'MODERN_HEADER',
              props: {
                show_logo: true,
                logo_width: 120,
                background_color: '#f0fdf4',
                text_color: '#166534',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_TWO_COLUMN',
              props: {
                show_service_address: true,
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_GROUPED',
              props: {
                show_category_subtotals: true,
                category_background: '#f0fdf4',
              },
            },
            {
              id: 'payment-schedule-1',
              component_id: 'PAYMENT_SCHEDULE',
              props: {
                show_percentage: true,
                highlight_due: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_DETAILED',
              props: {
                show_deposit: true,
                show_balance: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_CONTACT',
              props: {
                show_hours: true,
                background_color: '#f0fdf4',
                text_color: '#166534',
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#16a34a',
        secondaryColor: '#166534',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  // ========================================
  // INDUSTRY-SPECIFIC: ROOFING
  // ========================================
  {
    name: 'Roofing Estimate',
    description:
      'Roofing contractor template with material breakdown and warranty information.',
    template_type: 'visual',
    category_name: 'Industry',
    tags: ['roofing', 'contractor', 'industry', 'warranty'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 130,
          components: [
            {
              id: 'header-1',
              component_id: 'SPLIT_HEADER',
              props: {
                show_logo: true,
                logo_width: 100,
                divider_color: '#7c2d12',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_CARD',
              props: {
                card_background: '#fef2f2',
                card_border: '#fca5a5',
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_GROUPED',
              props: {
                show_category_subtotals: true,
                category_background: '#fef2f2',
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_DETAILED',
              props: {
                show_deposit: true,
                show_balance: true,
              },
            },
            {
              id: 'signature-1',
              component_id: 'SIGNATURE_BLOCK',
              props: {
                show_date: true,
                show_print_name: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 100,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_LEGAL',
              props: {
                show_payment_terms: true,
                show_warranty: true,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#b91c1c',
        secondaryColor: '#7c2d12',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  // ========================================
  // INDUSTRY-SPECIFIC: GENERAL CONTRACTOR
  // ========================================
  {
    name: 'General Contractor Proposal',
    description:
      'Comprehensive construction proposal with payment schedule and detailed breakdown.',
    template_type: 'visual',
    category_name: 'Industry',
    tags: ['contractor', 'construction', 'industry', 'comprehensive'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 130,
          components: [
            {
              id: 'header-1',
              component_id: 'SPLIT_HEADER',
              props: {
                show_logo: true,
                logo_width: 100,
                divider_color: '#f97316',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_TWO_COLUMN',
              props: {
                show_service_address: true,
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_GROUPED',
              props: {
                show_category_subtotals: true,
                category_background: '#fff7ed',
              },
            },
            {
              id: 'payment-schedule-1',
              component_id: 'PAYMENT_SCHEDULE',
              props: {
                show_percentage: true,
                highlight_due: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_DETAILED',
              props: {
                show_deposit: true,
                show_balance: true,
              },
            },
            {
              id: 'signature-1',
              component_id: 'SIGNATURE_BLOCK',
              props: {
                show_date: true,
                show_print_name: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 100,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_LEGAL',
              props: {
                show_payment_terms: true,
                show_warranty: true,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#f97316',
        secondaryColor: '#ea580c',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  // ========================================
  // ADDITIONAL VARIATIONS
  // ========================================
  {
    name: 'Compact Single Page',
    description:
      'Ultra-compact template that fits everything on one page. Perfect for simple quotes.',
    template_type: 'visual',
    category_name: 'Minimal',
    tags: ['compact', 'single-page', 'minimal', 'simple'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 30, right: 30, bottom: 30, left: 30 },
        header: {
          enabled: true,
          height: 70,
          components: [
            {
              id: 'header-1',
              component_id: 'MINIMAL_HEADER',
              props: {
                show_logo: false,
                accent_color: '#2563eb',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_INLINE',
              props: {
                separator: '|',
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_MINIMAL',
              props: {},
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_SIMPLE',
              props: {
                font_size: 20,
                accent_color: '#2563eb',
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 50,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_MINIMAL',
              props: {
                show_page_number: false,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#2563eb',
        secondaryColor: '#64748b',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 13,
        lineHeight: 1.5,
      },
    },
  },

  {
    name: 'Photo Gallery Quote',
    description:
      'Template with space for before/after photos. Great for remodeling and restoration projects.',
    template_type: 'visual',
    category_name: 'Creative',
    tags: ['photo', 'gallery', 'visual', 'remodeling'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'header-1',
              component_id: 'MODERN_HEADER',
              props: {
                show_logo: true,
                logo_width: 120,
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_CARD',
              props: {},
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_GROUPED',
              props: {
                show_category_subtotals: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_BOXED',
              props: {},
            },
          ],
        },
        footer: {
          enabled: true,
          height: 80,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_CONTACT',
              props: {
                show_hours: true,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#6d28d9',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  {
    name: 'Service Agreement Annual',
    description:
      'Template for annual service agreements with recurring billing schedule.',
    template_type: 'visual',
    category_name: 'Contract',
    tags: ['agreement', 'annual', 'recurring', 'contract'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'header-1',
              component_id: 'CLASSIC_HEADER',
              props: {
                show_logo: true,
                show_border: true,
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_CARD',
              props: {},
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_STANDARD',
              props: {
                show_header: true,
              },
            },
            {
              id: 'payment-schedule-1',
              component_id: 'PAYMENT_SCHEDULE',
              props: {
                show_percentage: true,
                highlight_due: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_DETAILED',
              props: {
                show_deposit: true,
                show_balance: true,
              },
            },
            {
              id: 'signature-1',
              component_id: 'SIGNATURE_BLOCK',
              props: {
                show_date: true,
                show_print_name: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 100,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_LEGAL',
              props: {
                show_payment_terms: true,
                show_warranty: true,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#1f2937',
        secondaryColor: '#4b5563',
        fontFamily: 'Georgia, serif',
        fontSize: 13,
        lineHeight: 1.6,
      },
    },
  },

  {
    name: 'Emergency Service Quote',
    description:
      'Quick-turnaround template for emergency services with priority pricing.',
    template_type: 'visual',
    category_name: 'Service',
    tags: ['emergency', 'urgent', 'service', 'priority'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
        header: {
          enabled: true,
          height: 100,
          components: [
            {
              id: 'header-1',
              component_id: 'MODERN_HEADER',
              props: {
                show_logo: true,
                logo_width: 110,
                background_color: '#fef2f2',
                text_color: '#991b1b',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_TWO_COLUMN',
              props: {
                show_service_address: true,
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_DETAILED',
              props: {
                show_sku: true,
                show_discount: true,
                show_tax: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_BOXED',
              props: {
                box_background: '#fef2f2',
                box_border: '#dc2626',
                total_accent: '#dc2626',
              },
            },
            {
              id: 'signature-1',
              component_id: 'SIGNATURE_BLOCK',
              props: {
                show_date: true,
                show_print_name: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 100,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_CONTACT',
              props: {
                show_hours: true,
                background_color: '#fef2f2',
                text_color: '#991b1b',
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#dc2626',
        secondaryColor: '#991b1b',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },

  {
    name: 'Premium Luxury Service',
    description:
      'High-end template for luxury services with elegant design and attention to detail.',
    template_type: 'visual',
    category_name: 'Premium',
    tags: ['luxury', 'premium', 'elegant', 'high-end'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 60, right: 60, bottom: 60, left: 60 },
        header: {
          enabled: true,
          height: 150,
          components: [
            {
              id: 'header-1',
              component_id: 'CLASSIC_HEADER',
              props: {
                show_logo: true,
                logo_width: 150,
                show_border: true,
                border_color: '#92400e',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_CARD',
              props: {
                card_background: '#fef3c7',
                card_border: '#f59e0b',
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_DETAILED',
              props: {
                show_sku: false,
                show_discount: true,
                show_tax: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_BOXED',
              props: {
                box_background: '#fef3c7',
                box_border: '#92400e',
                total_accent: '#92400e',
              },
            },
            {
              id: 'signature-1',
              component_id: 'SIGNATURE_BLOCK',
              props: {
                show_date: true,
                show_print_name: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 100,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_LEGAL',
              props: {
                show_payment_terms: true,
                show_warranty: true,
                font_size: 10,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#92400e',
        secondaryColor: '#78350f',
        fontFamily: 'Georgia, serif',
        fontSize: 13,
        lineHeight: 1.6,
      },
    },
  },

  {
    name: 'Tech Startup Modern',
    description:
      'Ultra-modern template for tech companies with clean lines and bold typography.',
    template_type: 'visual',
    category_name: 'Modern',
    tags: ['tech', 'startup', 'modern', 'bold'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 40, right: 40, bottom: 40, left: 40 },
        header: {
          enabled: true,
          height: 80,
          components: [
            {
              id: 'header-1',
              component_id: 'MINIMAL_HEADER',
              props: {
                show_logo: false,
                accent_color: '#8b5cf6',
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_LIST',
              props: {
                show_title: true,
                title_text: 'For:',
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_MINIMAL',
              props: {},
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_SIMPLE',
              props: {
                font_size: 28,
                accent_color: '#8b5cf6',
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 50,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_MINIMAL',
              props: {
                show_page_number: false,
                text_color: '#9ca3af',
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#8b5cf6',
        secondaryColor: '#6d28d9',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 15,
        lineHeight: 1.6,
      },
    },
  },

  {
    name: 'Consulting Services Proposal',
    description:
      'Professional services template with hourly rates and project phases.',
    template_type: 'visual',
    category_name: 'Professional',
    tags: ['consulting', 'professional', 'hourly', 'phases'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 120,
          components: [
            {
              id: 'header-1',
              component_id: 'MODERN_HEADER',
              props: {
                show_logo: true,
                logo_width: 120,
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_CARD',
              props: {},
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_GROUPED',
              props: {
                show_category_subtotals: true,
              },
            },
            {
              id: 'payment-schedule-1',
              component_id: 'PAYMENT_SCHEDULE',
              props: {
                show_percentage: true,
                highlight_due: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_DETAILED',
              props: {
                show_deposit: true,
                show_balance: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 80,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_CONTACT',
              props: {
                show_hours: true,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#0f172a',
        secondaryColor: '#334155',
        fontFamily: 'Inter, Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.6,
      },
    },
  },

  {
    name: 'Multi-Phase Construction',
    description:
      'Detailed construction template with multiple project phases and material breakdown.',
    template_type: 'visual',
    category_name: 'Industry',
    tags: ['construction', 'multi-phase', 'detailed', 'materials'],
    visual_structure: {
      version: '1.0',
      layout: {
        pageSize: 'letter',
        orientation: 'portrait',
        margins: { top: 50, right: 50, bottom: 50, left: 50 },
        header: {
          enabled: true,
          height: 130,
          components: [
            {
              id: 'header-1',
              component_id: 'SPLIT_HEADER',
              props: {
                show_logo: true,
                logo_width: 100,
              },
            },
          ],
        },
        body: {
          components: [
            {
              id: 'customer-1',
              component_id: 'CUSTOMER_TWO_COLUMN',
              props: {
                show_service_address: true,
              },
            },
            {
              id: 'lineitems-1',
              component_id: 'LINE_ITEMS_GROUPED',
              props: {
                show_category_subtotals: true,
              },
            },
            {
              id: 'payment-schedule-1',
              component_id: 'PAYMENT_SCHEDULE',
              props: {
                show_percentage: true,
                highlight_due: true,
              },
            },
            {
              id: 'totals-1',
              component_id: 'TOTALS_DETAILED',
              props: {
                show_deposit: true,
                show_balance: true,
              },
            },
            {
              id: 'signature-1',
              component_id: 'SIGNATURE_BLOCK',
              props: {
                show_date: true,
                show_print_name: true,
              },
            },
          ],
        },
        footer: {
          enabled: true,
          height: 100,
          components: [
            {
              id: 'footer-1',
              component_id: 'FOOTER_LEGAL',
              props: {
                show_payment_terms: true,
                show_warranty: true,
              },
            },
          ],
        },
      },
      theme: {
        primaryColor: '#f97316',
        secondaryColor: '#ea580c',
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        lineHeight: 1.5,
      },
    },
  },
];

// Category seeds
const CATEGORY_SEEDS = [
  {
    name: 'Modern',
    description: 'Clean, contemporary templates for modern businesses',
    sort_order: 1,
  },
  {
    name: 'Classic',
    description: 'Traditional, formal templates for established companies',
    sort_order: 2,
  },
  {
    name: 'Minimal',
    description: 'Simple, streamlined templates with essential information',
    sort_order: 3,
  },
  {
    name: 'Industry',
    description: 'Industry-specific templates optimized for trade businesses',
    sort_order: 4,
  },
  {
    name: 'Professional',
    description:
      'Professional services templates for consulting and specialized services',
    sort_order: 5,
  },
  {
    name: 'Contract',
    description: 'Agreement and contract templates with legal provisions',
    sort_order: 6,
  },
  {
    name: 'Service',
    description: 'Service-oriented templates with customer focus',
    sort_order: 7,
  },
  {
    name: 'Premium',
    description: 'High-end luxury templates for premium services',
    sort_order: 8,
  },
  {
    name: 'Creative',
    description: 'Creative templates with unique layouts',
    sort_order: 9,
  },
];

// Seed execution
export async function seedPrebuiltTemplates(): Promise<void> {
  console.log('🌱 Starting pre-built template seeding...');

  try {
    // Step 1: Create categories
    console.log('\n📁 Creating template categories...');
    const categoryMap = new Map<string, string>();

    for (const category of CATEGORY_SEEDS) {
      const categoryId = uuidv4();

      const existing = await prisma.template_category.findFirst({
        where: { name: category.name },
      });

      if (existing) {
        console.log(
          `⏭️  Category "${category.name}" already exists, skipping...`,
        );
        categoryMap.set(category.name, existing.id);
        continue;
      }

      await prisma.template_category.create({
        data: {
          id: categoryId,
          name: category.name,
          description: category.description,
          is_active: true,
          sort_order: category.sort_order,
        },
      });

      categoryMap.set(category.name, categoryId);
      console.log(`✅ Created category: ${category.name}`);
    }

    // Step 2: Get component ID mapping (for visual templates)
    console.log('\n🔍 Loading component library...');
    const components = await prisma.template_component.findMany({
      where: { is_global: true },
      select: { id: true, name: true, component_type: true },
    });

    const componentMap = new Map<string, string>();
    components.forEach((comp) => {
      const key = comp.name.toUpperCase().replace(/\s+/g, '_');
      componentMap.set(key, comp.id);
    });

    console.log(`Found ${components.length} platform components`);

    // Step 3: Create templates
    console.log('\n📄 Creating pre-built templates...');

    for (const template of TEMPLATE_SEEDS) {
      const templateId = uuidv4();
      const versionId = uuidv4();

      // Check if template already exists
      const existing = await prisma.quote_template.findFirst({
        where: {
          name: template.name,
          is_prebuilt: true,
        },
      });

      if (existing) {
        console.log(
          `⏭️  Template "${template.name}" already exists, skipping...`,
        );
        continue;
      }

      // Replace component placeholders with actual IDs (for visual templates)
      let visualStructure = template.visual_structure;
      if (template.template_type === 'visual' && visualStructure) {
        visualStructure = JSON.parse(
          JSON.stringify(visualStructure).replace(
            /"component_id":\s*"([A-Z_]+)"/g,
            (match, key) => {
              const componentId = componentMap.get(key);
              return componentId ? `"component_id": "${componentId}"` : match;
            },
          ),
        );
      }

      const categoryId = categoryMap.get(template.category_name);

      // Create template
      await prisma.quote_template.create({
        data: {
          id: templateId,
          tenant_id: null, // Platform template (global)
          name: template.name,
          description: template.description,
          template_type: template.template_type,
          visual_structure: visualStructure,
          html_content: template.html_content || undefined,
          css_content: template.css_content || undefined,
          category_id: categoryId,
          tags: template.tags,
          is_active: true,
          is_default: false,
          is_prebuilt: true,
          source_template_id: null,
        },
      });

      // Create version 1
      await prisma.quote_template_version.create({
        data: {
          id: versionId,
          template_id: templateId,
          version_number: 1,
          template_type: template.template_type,
          visual_structure: visualStructure,
          html_content: template.html_content || undefined,
          css_content: template.css_content || undefined,
          changes_summary: 'Initial version (pre-built template)',
          created_by_user_id: 'system', // System-generated seed data
        },
      });

      console.log(
        `✅ Created template: ${template.name} (${template.template_type})`,
      );
    }

    console.log(
      `\n🎉 Pre-built template seeding complete! Created ${TEMPLATE_SEEDS.length} templates across ${CATEGORY_SEEDS.length} categories.`,
    );
  } catch (error) {
    console.error('❌ Error seeding templates:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  seedPrebuiltTemplates()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
