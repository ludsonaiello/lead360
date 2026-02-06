import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

interface ComponentSeed {
  name: string;
  component_type: string;
  category: string;
  description: string;
  structure: any;
  default_props: any;
  html_template: string;
  css_template: string;
  usage_notes: string;
  tags: string[];
  sort_order: number;
}

// Component Library: 21 Professional Components
const COMPONENT_SEEDS: ComponentSeed[] = [
  // ========================================
  // HEADERS (4 components)
  // ========================================
  {
    name: 'Modern Header',
    component_type: 'header',
    category: 'layout',
    description:
      'Clean, modern header with logo and company details in a horizontal layout',
    structure: {
      sections: ['logo', 'company_info', 'quote_info'],
      layout: 'horizontal',
    },
    default_props: {
      show_logo: true,
      logo_width: 120,
      show_company_name: true,
      show_tagline: false,
      background_color: '#ffffff',
      text_color: '#1f2937',
    },
    html_template: `<div class="header-modern">
  {{#if show_logo}}
    <div class="logo">
      {{#if company.logo_url}}
        <img src="{{company.logo_url}}" alt="{{company.name}}" style="width: {{logo_width}}px;" />
      {{/if}}
    </div>
  {{/if}}
  <div class="company-info">
    {{#if show_company_name}}
      <h1 class="company-name">{{company.name}}</h1>
    {{/if}}
    {{#if show_tagline}}
      <p class="tagline">{{company.tagline}}</p>
    {{/if}}
    <div class="contact-details">
      <p>{{company.phone}} | {{company.email}}</p>
      <p>{{company.address}}</p>
    </div>
  </div>
  <div class="quote-info">
    <h2 class="quote-title">QUOTE</h2>
    <p class="quote-number">#{{quote.quote_number}}</p>
    <p class="quote-date">{{date quote.created_at}}</p>
  </div>
</div>`,
    css_template: `.header-modern {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 2px solid #e5e7eb;
  background-color: {{background_color}};
  color: {{text_color}};
}

.logo img {
  max-height: 80px;
}

.company-info {
  flex: 1;
  text-align: center;
  padding: 0 20px;
}

.company-name {
  font-size: 24px;
  font-weight: bold;
  margin: 0;
}

.tagline {
  font-size: 14px;
  color: #6b7280;
  margin: 5px 0;
}

.contact-details {
  font-size: 12px;
  color: #6b7280;
  margin-top: 10px;
}

.quote-info {
  text-align: right;
}

.quote-title {
  font-size: 20px;
  font-weight: bold;
  margin: 0;
  color: {{text_color}};
}

.quote-number {
  font-size: 16px;
  margin: 5px 0;
}

.quote-date {
  font-size: 12px;
  color: #6b7280;
}`,
    usage_notes:
      'Perfect for modern, professional quotes. Displays logo, company info, and quote details in a clean horizontal layout.',
    tags: ['modern', 'professional', 'horizontal'],
    sort_order: 1,
  },

  {
    name: 'Classic Header',
    component_type: 'header',
    category: 'layout',
    description:
      'Traditional business header with centered company information',
    structure: {
      sections: ['logo', 'company_info'],
      layout: 'centered',
    },
    default_props: {
      show_logo: true,
      logo_width: 150,
      show_border: true,
      border_color: '#1f2937',
    },
    html_template: `<div class="header-classic">
  <div class="centered-content">
    {{#if show_logo}}
      <div class="logo">
        {{#if company.logo_url}}
          <img src="{{company.logo_url}}" alt="{{company.name}}" style="width: {{logo_width}}px;" />
        {{/if}}
      </div>
    {{/if}}
    <h1 class="company-name">{{company.name}}</h1>
    <div class="company-details">
      <p>{{company.address}}</p>
      <p>{{company.phone}} | {{company.email}}</p>
      {{#if company.website}}
        <p>{{company.website}}</p>
      {{/if}}
    </div>
    <div class="quote-title-section">
      <h2>QUOTATION</h2>
      <p>Quote #{{quote.quote_number}} | Date: {{date quote.created_at}}</p>
    </div>
  </div>
</div>`,
    css_template: `.header-classic {
  text-align: center;
  padding: 30px 20px;
  {{#if show_border}}
  border-bottom: 3px double {{border_color}};
  {{/if}}
}

.centered-content {
  max-width: 600px;
  margin: 0 auto;
}

.logo {
  margin-bottom: 15px;
}

.logo img {
  max-height: 100px;
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
  line-height: 1.6;
}

.quote-title-section {
  margin-top: 25px;
}

.quote-title-section h2 {
  font-size: 22px;
  font-weight: bold;
  margin: 0;
  letter-spacing: 3px;
}

.quote-title-section p {
  font-size: 13px;
  color: #6b7280;
  margin: 5px 0;
}`,
    usage_notes:
      'Traditional centered header suitable for formal business quotes. Great for industries like law, accounting, consulting.',
    tags: ['classic', 'traditional', 'centered', 'formal'],
    sort_order: 2,
  },

  {
    name: 'Minimal Header',
    component_type: 'header',
    category: 'layout',
    description: 'Ultra-minimal header with essential information only',
    structure: {
      sections: ['company_name', 'quote_number'],
      layout: 'minimal',
    },
    default_props: {
      show_logo: false,
      accent_color: '#2563eb',
    },
    html_template: `<div class="header-minimal">
  <div class="left-section">
    <h1 class="company-name">{{company.name}}</h1>
    <p class="company-tagline">{{company.tagline}}</p>
  </div>
  <div class="right-section">
    <div class="quote-number">{{quote.quote_number}}</div>
    <div class="quote-date">{{date quote.created_at}}</div>
  </div>
</div>`,
    css_template: `.header-minimal {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding: 15px 0;
  border-bottom: 1px solid #e5e7eb;
}

.left-section {
  flex: 1;
}

.company-name {
  font-size: 22px;
  font-weight: 600;
  margin: 0;
  color: {{accent_color}};
}

.company-tagline {
  font-size: 12px;
  color: #9ca3af;
  margin: 2px 0 0 0;
}

.right-section {
  text-align: right;
}

.quote-number {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.quote-date {
  font-size: 11px;
  color: #9ca3af;
  margin-top: 2px;
}`,
    usage_notes:
      'Perfect for modern, clean quotes where simplicity is key. Great for tech companies, startups, or creative agencies.',
    tags: ['minimal', 'clean', 'modern', 'simple'],
    sort_order: 3,
  },

  {
    name: 'Split Header',
    component_type: 'header',
    category: 'layout',
    description:
      'Two-column header with company on left and quote details on right',
    structure: {
      sections: ['company_column', 'quote_column'],
      layout: 'split',
    },
    default_props: {
      show_logo: true,
      logo_width: 100,
      divider_style: 'solid',
      divider_color: '#d1d5db',
    },
    html_template: `<div class="header-split">
  <div class="company-column">
    {{#if show_logo}}
      {{#if company.logo_url}}
        <img src="{{company.logo_url}}" alt="{{company.name}}" class="logo" style="width: {{logo_width}}px;" />
      {{/if}}
    {{/if}}
    <h2 class="company-name">{{company.name}}</h2>
    <div class="company-contact">
      <p>{{company.address}}</p>
      <p>{{company.phone}}</p>
      <p>{{company.email}}</p>
    </div>
  </div>
  <div class="divider"></div>
  <div class="quote-column">
    <h1 class="quote-title">Quote</h1>
    <table class="quote-details-table">
      <tr>
        <td class="label">Quote Number:</td>
        <td class="value">{{quote.quote_number}}</td>
      </tr>
      <tr>
        <td class="label">Date:</td>
        <td class="value">{{date quote.created_at}}</td>
      </tr>
      <tr>
        <td class="label">Valid Until:</td>
        <td class="value">{{date quote.valid_until}}</td>
      </tr>
      <tr>
        <td class="label">Status:</td>
        <td class="value status-{{quote.status}}">{{quote.status}}</td>
      </tr>
    </table>
  </div>
</div>`,
    css_template: `.header-split {
  display: flex;
  gap: 30px;
  padding: 20px;
  border-bottom: 2px solid #e5e7eb;
}

.company-column {
  flex: 1;
}

.logo {
  margin-bottom: 15px;
}

.company-name {
  font-size: 20px;
  font-weight: bold;
  margin: 0 0 10px 0;
}

.company-contact {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
}

.company-contact p {
  margin: 3px 0;
}

.divider {
  width: 1px;
  background-color: {{divider_color}};
  {{#if (eq divider_style 'dashed')}}
  border-left: 1px dashed {{divider_color}};
  background: none;
  {{/if}}
}

.quote-column {
  flex: 1;
}

.quote-title {
  font-size: 24px;
  font-weight: bold;
  margin: 0 0 15px 0;
}

.quote-details-table {
  width: 100%;
  font-size: 13px;
}

.quote-details-table td {
  padding: 5px 0;
}

.quote-details-table .label {
  font-weight: 600;
  color: #6b7280;
  width: 40%;
}

.quote-details-table .value {
  color: #1f2937;
}

.status-draft {
  color: #f59e0b;
  text-transform: capitalize;
}

.status-sent {
  color: #2563eb;
  text-transform: capitalize;
}

.status-approved {
  color: #10b981;
  text-transform: capitalize;
}`,
    usage_notes:
      'Professional split-column header ideal for displaying detailed company and quote information side by side.',
    tags: ['split', 'professional', 'detailed', 'two-column'],
    sort_order: 4,
  },

  // ========================================
  // CUSTOMER INFO (4 components)
  // ========================================
  {
    name: 'Customer Card',
    component_type: 'customer_info',
    category: 'content',
    description: 'Card-style customer information with clean borders',
    structure: {
      layout: 'card',
      sections: ['name', 'contact', 'address'],
    },
    default_props: {
      card_background: '#f9fafb',
      card_border: '#e5e7eb',
      show_icon: true,
    },
    html_template: `<div class="customer-card">
  <div class="card-header">
    {{#if show_icon}}
      <span class="icon">👤</span>
    {{/if}}
    <h3>Customer Information</h3>
  </div>
  <div class="card-body">
    <div class="customer-name">{{customer.name}}</div>
    <div class="customer-details">
      {{#if customer.email}}
        <p><strong>Email:</strong> {{customer.email}}</p>
      {{/if}}
      {{#if customer.phone}}
        <p><strong>Phone:</strong> {{customer.phone}}</p>
      {{/if}}
      {{#if customer.address}}
        <p><strong>Address:</strong> {{customer.address}}</p>
      {{/if}}
      {{#if customer.city}}
        <p>{{customer.city}}, {{customer.state}} {{customer.zip}}</p>
      {{/if}}
    </div>
  </div>
</div>`,
    css_template: `.customer-card {
  background-color: {{card_background}};
  border: 1px solid {{card_border}};
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid {{card_border}};
}

.icon {
  font-size: 20px;
}

.card-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #374151;
}

.customer-name {
  font-size: 18px;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 10px;
}

.customer-details {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
}

.customer-details p {
  margin: 5px 0;
}

.customer-details strong {
  color: #374151;
  margin-right: 5px;
}`,
    usage_notes:
      'Card-style customer info that stands out visually. Great for modern, clean designs.',
    tags: ['card', 'modern', 'customer', 'bordered'],
    sort_order: 5,
  },

  {
    name: 'Customer List',
    component_type: 'customer_info',
    category: 'content',
    description: 'Simple list-based customer information',
    structure: {
      layout: 'list',
      sections: ['name', 'contact', 'address'],
    },
    default_props: {
      show_title: true,
      title_text: 'Bill To:',
    },
    html_template: `<div class="customer-list">
  {{#if show_title}}
    <h4 class="section-title">{{title_text}}</h4>
  {{/if}}
  <div class="customer-name">{{customer.name}}</div>
  <ul class="customer-details">
    {{#if customer.email}}
      <li>{{customer.email}}</li>
    {{/if}}
    {{#if customer.phone}}
      <li>{{customer.phone}}</li>
    {{/if}}
    {{#if customer.address}}
      <li>{{customer.address}}</li>
    {{/if}}
    {{#if customer.city}}
      <li>{{customer.city}}, {{customer.state}} {{customer.zip}}</li>
    {{/if}}
  </ul>
</div>`,
    css_template: `.customer-list {
  margin: 20px 0;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
}

.customer-name {
  font-size: 16px;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 8px;
}

.customer-details {
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
}

.customer-details li {
  margin: 3px 0;
}`,
    usage_notes:
      'Simple, clean list format for customer information. Minimal and easy to read.',
    tags: ['list', 'simple', 'minimal', 'customer'],
    sort_order: 6,
  },

  {
    name: 'Customer Two-Column',
    component_type: 'customer_info',
    category: 'content',
    description: 'Two-column layout for customer and service address',
    structure: {
      layout: 'two-column',
      sections: ['billing', 'service'],
    },
    default_props: {
      show_service_address: true,
      column_gap: 30,
    },
    html_template: `<div class="customer-two-column" style="gap: {{column_gap}}px;">
  <div class="billing-column">
    <h4 class="column-title">Bill To</h4>
    <div class="customer-name">{{customer.name}}</div>
    <div class="customer-details">
      {{#if customer.email}}
        <p>{{customer.email}}</p>
      {{/if}}
      {{#if customer.phone}}
        <p>{{customer.phone}}</p>
      {{/if}}
      {{#if customer.address}}
        <p>{{customer.address}}</p>
        <p>{{customer.city}}, {{customer.state}} {{customer.zip}}</p>
      {{/if}}
    </div>
  </div>
  {{#if show_service_address}}
    <div class="service-column">
      <h4 class="column-title">Service Address</h4>
      <div class="service-details">
        {{#if quote.service_address}}
          <p>{{quote.service_address}}</p>
          <p>{{quote.service_city}}, {{quote.service_state}} {{quote.service_zip}}</p>
        {{else}}
          <p class="same-as-billing">Same as billing address</p>
        {{/if}}
      </div>
    </div>
  {{/if}}
</div>`,
    css_template: `.customer-two-column {
  display: flex;
  margin: 20px 0;
}

.billing-column,
.service-column {
  flex: 1;
}

.column-title {
  font-size: 14px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0 0 10px 0;
}

.customer-name {
  font-size: 16px;
  font-weight: bold;
  color: #1f2937;
  margin-bottom: 8px;
}

.customer-details,
.service-details {
  font-size: 13px;
  color: #6b7280;
  line-height: 1.6;
}

.customer-details p,
.service-details p {
  margin: 3px 0;
}

.same-as-billing {
  font-style: italic;
  color: #9ca3af;
}`,
    usage_notes:
      'Perfect for service businesses where billing and service addresses may differ (HVAC, plumbing, landscaping).',
    tags: ['two-column', 'service', 'billing', 'address'],
    sort_order: 7,
  },

  {
    name: 'Customer Inline',
    component_type: 'customer_info',
    category: 'content',
    description: 'Compact inline customer information',
    structure: {
      layout: 'inline',
      sections: ['name', 'contact'],
    },
    default_props: {
      separator: '|',
    },
    html_template: `<div class="customer-inline">
  <span class="label">To:</span>
  <span class="customer-name">{{customer.name}}</span>
  <span class="separator">{{separator}}</span>
  <span class="customer-email">{{customer.email}}</span>
  <span class="separator">{{separator}}</span>
  <span class="customer-phone">{{customer.phone}}</span>
</div>`,
    css_template: `.customer-inline {
  font-size: 13px;
  padding: 10px 0;
  border-top: 1px solid #e5e7eb;
  border-bottom: 1px solid #e5e7eb;
  margin: 15px 0;
}

.label {
  font-weight: 600;
  color: #6b7280;
  margin-right: 8px;
}

.customer-name {
  font-weight: bold;
  color: #1f2937;
}

.customer-email,
.customer-phone {
  color: #6b7280;
}

.separator {
  margin: 0 10px;
  color: #d1d5db;
}`,
    usage_notes:
      'Ultra-compact customer info for quotes where space is limited. All details in one line.',
    tags: ['inline', 'compact', 'minimal', 'one-line'],
    sort_order: 8,
  },

  // ========================================
  // LINE ITEMS (4 components)
  // ========================================
  {
    name: 'Line Items Standard',
    component_type: 'line_items',
    category: 'content',
    description:
      'Standard line items table with quantity, description, unit price, and total',
    structure: {
      columns: ['description', 'quantity', 'unit_price', 'total'],
      layout: 'table',
    },
    default_props: {
      show_header: true,
      alternate_rows: true,
      row_color_odd: '#ffffff',
      row_color_even: '#f9fafb',
    },
    html_template: `<div class="line-items-standard">
  <table class="line-items-table">
    {{#if show_header}}
      <thead>
        <tr>
          <th class="col-description">Description</th>
          <th class="col-quantity">Qty</th>
          <th class="col-unit-price">Unit Price</th>
          <th class="col-total">Total</th>
        </tr>
      </thead>
    {{/if}}
    <tbody>
      {{#each quote.line_items}}
        <tr class="{{#if (isEven @index)}}row-even{{else}}row-odd{{/if}}">
          <td class="description">
            <div class="item-name">{{this.name}}</div>
            {{#if this.description}}
              <div class="item-description">{{this.description}}</div>
            {{/if}}
          </td>
          <td class="quantity">{{this.quantity}}</td>
          <td class="unit-price">{{currency this.unit_price}}</td>
          <td class="total">{{currency (multiply this.quantity this.unit_price)}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>
</div>`,
    css_template: `.line-items-standard {
  margin: 20px 0;
}

.line-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.line-items-table thead tr {
  background-color: #f3f4f6;
  border-bottom: 2px solid #d1d5db;
}

.line-items-table th {
  padding: 10px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.5px;
}

.line-items-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #e5e7eb;
}

.col-quantity,
.quantity {
  text-align: center;
  width: 80px;
}

.col-unit-price,
.unit-price {
  text-align: right;
  width: 120px;
}

.col-total,
.total {
  text-align: right;
  width: 120px;
  font-weight: 600;
}

.item-name {
  font-weight: 600;
  color: #1f2937;
}

.item-description {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

{{#if alternate_rows}}
.row-even {
  background-color: {{row_color_even}};
}

.row-odd {
  background-color: {{row_color_odd}};
}
{{/if}}`,
    usage_notes:
      'Standard line items table suitable for most quotes. Clean and professional.',
    tags: ['table', 'standard', 'line-items', 'professional'],
    sort_order: 9,
  },

  {
    name: 'Line Items Detailed',
    component_type: 'line_items',
    category: 'content',
    description: 'Detailed line items with SKU, tax, and discount columns',
    structure: {
      columns: [
        'sku',
        'description',
        'quantity',
        'unit_price',
        'discount',
        'tax',
        'total',
      ],
      layout: 'table',
    },
    default_props: {
      show_sku: true,
      show_discount: true,
      show_tax: true,
    },
    html_template: `<div class="line-items-detailed">
  <table class="line-items-table">
    <thead>
      <tr>
        {{#if show_sku}}
          <th class="col-sku">SKU</th>
        {{/if}}
        <th class="col-description">Description</th>
        <th class="col-quantity">Qty</th>
        <th class="col-unit-price">Unit Price</th>
        {{#if show_discount}}
          <th class="col-discount">Discount</th>
        {{/if}}
        {{#if show_tax}}
          <th class="col-tax">Tax</th>
        {{/if}}
        <th class="col-total">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each quote.line_items}}
        <tr>
          {{#if ../show_sku}}
            <td class="sku">{{this.sku}}</td>
          {{/if}}
          <td class="description">
            <div class="item-name">{{this.name}}</div>
            {{#if this.description}}
              <div class="item-description">{{this.description}}</div>
            {{/if}}
          </td>
          <td class="quantity">{{this.quantity}}</td>
          <td class="unit-price">{{currency this.unit_price}}</td>
          {{#if ../show_discount}}
            <td class="discount">
              {{#if this.discount_percent}}
                {{percent this.discount_percent}}
              {{else}}
                -
              {{/if}}
            </td>
          {{/if}}
          {{#if ../show_tax}}
            <td class="tax">
              {{#if this.tax_percent}}
                {{percent this.tax_percent}}
              {{else}}
                -
              {{/if}}
            </td>
          {{/if}}
          <td class="total">{{currency this.total}}</td>
        </tr>
      {{/each}}
    </tbody>
  </table>
</div>`,
    css_template: `.line-items-detailed {
  margin: 20px 0;
  overflow-x: auto;
}

.line-items-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.line-items-table thead tr {
  background-color: #1f2937;
  color: #ffffff;
}

.line-items-table th {
  padding: 10px 8px;
  text-align: left;
  font-weight: 600;
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.5px;
}

.line-items-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #e5e7eb;
}

.col-sku,
.sku {
  width: 80px;
  font-family: monospace;
  color: #6b7280;
}

.col-quantity,
.quantity {
  text-align: center;
  width: 60px;
}

.col-unit-price,
.unit-price,
.col-discount,
.discount,
.col-tax,
.tax {
  text-align: right;
  width: 100px;
}

.col-total,
.total {
  text-align: right;
  width: 120px;
  font-weight: 600;
  color: #1f2937;
}

.item-name {
  font-weight: 600;
  color: #1f2937;
}

.item-description {
  font-size: 11px;
  color: #6b7280;
  margin-top: 3px;
}`,
    usage_notes:
      'Comprehensive line items table with all details. Great for complex quotes with discounts and taxes.',
    tags: ['detailed', 'table', 'sku', 'discount', 'tax'],
    sort_order: 10,
  },

  {
    name: 'Line Items Grouped',
    component_type: 'line_items',
    category: 'content',
    description: 'Line items grouped by category with subtotals',
    structure: {
      columns: ['description', 'quantity', 'unit_price', 'total'],
      layout: 'grouped',
    },
    default_props: {
      show_category_subtotals: true,
      category_background: '#f3f4f6',
    },
    html_template: `<div class="line-items-grouped">
  {{#each (groupBy quote.line_items 'category')}}
    <div class="category-group">
      <div class="category-header">{{this.category}}</div>
      <table class="group-table">
        <tbody>
          {{#each this.items}}
            <tr>
              <td class="description">
                <div class="item-name">{{this.name}}</div>
                {{#if this.description}}
                  <div class="item-description">{{this.description}}</div>
                {{/if}}
              </td>
              <td class="quantity">{{this.quantity}}</td>
              <td class="unit-price">{{currency this.unit_price}}</td>
              <td class="total">{{currency (multiply this.quantity this.unit_price)}}</td>
            </tr>
          {{/each}}
        </tbody>
      </table>
      {{#if ../show_category_subtotals}}
        <div class="category-subtotal">
          <span class="subtotal-label">{{this.category}} Subtotal:</span>
          <span class="subtotal-amount">{{currency (sum this.items 'total')}}</span>
        </div>
      {{/if}}
    </div>
  {{/each}}
</div>`,
    css_template: `.line-items-grouped {
  margin: 20px 0;
}

.category-group {
  margin-bottom: 25px;
}

.category-header {
  background-color: {{category_background}};
  padding: 10px 15px;
  font-weight: 600;
  font-size: 14px;
  color: #1f2937;
  border-left: 4px solid #2563eb;
}

.group-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.group-table td {
  padding: 10px 15px;
  border-bottom: 1px solid #e5e7eb;
}

.quantity {
  text-align: center;
  width: 80px;
}

.unit-price {
  text-align: right;
  width: 120px;
}

.total {
  text-align: right;
  width: 120px;
  font-weight: 600;
}

.item-name {
  font-weight: 600;
  color: #1f2937;
}

.item-description {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}

.category-subtotal {
  display: flex;
  justify-content: flex-end;
  padding: 10px 15px;
  background-color: #f9fafb;
  border-top: 2px solid #d1d5db;
}

.subtotal-label {
  font-weight: 600;
  color: #374151;
  margin-right: 20px;
}

.subtotal-amount {
  font-weight: bold;
  color: #1f2937;
  min-width: 120px;
  text-align: right;
}`,
    usage_notes:
      'Perfect for complex quotes with multiple service categories. Shows subtotals for each category.',
    tags: ['grouped', 'categories', 'subtotals', 'organized'],
    sort_order: 11,
  },

  {
    name: 'Line Items Minimal',
    component_type: 'line_items',
    category: 'content',
    description: 'Minimal line items without borders',
    structure: {
      columns: ['description', 'total'],
      layout: 'minimal',
    },
    default_props: {
      show_quantity: false,
      show_unit_price: false,
    },
    html_template: `<div class="line-items-minimal">
  {{#each quote.line_items}}
    <div class="line-item">
      <div class="item-description">
        <div class="item-name">{{this.name}}</div>
        {{#if this.description}}
          <div class="item-note">{{this.description}}</div>
        {{/if}}
      </div>
      <div class="item-total">{{currency this.total}}</div>
    </div>
  {{/each}}
</div>`,
    css_template: `.line-items-minimal {
  margin: 20px 0;
}

.line-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
}

.line-item:last-child {
  border-bottom: none;
}

.item-description {
  flex: 1;
}

.item-name {
  font-size: 14px;
  font-weight: 500;
  color: #1f2937;
}

.item-note {
  font-size: 12px;
  color: #9ca3af;
  margin-top: 3px;
}

.item-total {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  min-width: 100px;
  text-align: right;
}`,
    usage_notes:
      'Ultra-minimal line items for simple quotes. Just description and total.',
    tags: ['minimal', 'simple', 'clean', 'borderless'],
    sort_order: 12,
  },

  // ========================================
  // TOTALS (4 components)
  // ========================================
  {
    name: 'Totals Right-Aligned',
    component_type: 'totals',
    category: 'content',
    description: 'Standard right-aligned totals section',
    structure: {
      sections: ['subtotal', 'discount', 'tax', 'total'],
      layout: 'right-aligned',
    },
    default_props: {
      show_discount: true,
      show_tax: true,
      total_background: '#1f2937',
      total_color: '#ffffff',
    },
    html_template: `<div class="totals-right">
  <table class="totals-table">
    <tr class="row-subtotal">
      <td class="label">Subtotal:</td>
      <td class="amount">{{currency quote.subtotal}}</td>
    </tr>
    {{#if show_discount}}
      {{#if quote.discount_amount}}
        <tr class="row-discount">
          <td class="label">Discount {{#if quote.discount_percent}}({{percent quote.discount_percent}}){{/if}}:</td>
          <td class="amount">-{{currency quote.discount_amount}}</td>
        </tr>
      {{/if}}
    {{/if}}
    {{#if show_tax}}
      {{#if quote.tax_amount}}
        <tr class="row-tax">
          <td class="label">Tax {{#if quote.tax_percent}}({{percent quote.tax_percent}}){{/if}}:</td>
          <td class="amount">{{currency quote.tax_amount}}</td>
        </tr>
      {{/if}}
    {{/if}}
    <tr class="row-total">
      <td class="label">Total:</td>
      <td class="amount">{{currency quote.total}}</td>
    </tr>
  </table>
</div>`,
    css_template: `.totals-right {
  margin: 30px 0 20px auto;
  max-width: 350px;
}

.totals-table {
  width: 100%;
  font-size: 14px;
}

.totals-table tr {
  border-bottom: 1px solid #e5e7eb;
}

.totals-table td {
  padding: 10px 15px;
}

.label {
  text-align: left;
  color: #6b7280;
  font-weight: 500;
}

.amount {
  text-align: right;
  color: #1f2937;
  font-weight: 600;
  min-width: 120px;
}

.row-discount .amount {
  color: #10b981;
}

.row-total {
  background-color: {{total_background}};
  border: none;
}

.row-total .label,
.row-total .amount {
  color: {{total_color}};
  font-size: 16px;
  font-weight: bold;
  padding: 15px;
}`,
    usage_notes:
      'Classic right-aligned totals section. Professional and clean.',
    tags: ['right-aligned', 'standard', 'totals', 'professional'],
    sort_order: 13,
  },

  {
    name: 'Totals Boxed',
    component_type: 'totals',
    category: 'content',
    description: 'Totals displayed in a bordered box',
    structure: {
      sections: ['subtotal', 'discount', 'tax', 'total'],
      layout: 'boxed',
    },
    default_props: {
      box_background: '#f9fafb',
      box_border: '#d1d5db',
      total_accent: '#2563eb',
    },
    html_template: `<div class="totals-boxed">
  <div class="totals-container">
    <div class="totals-row">
      <span class="label">Subtotal</span>
      <span class="amount">{{currency quote.subtotal}}</span>
    </div>
    {{#if quote.discount_amount}}
      <div class="totals-row discount-row">
        <span class="label">Discount {{#if quote.discount_percent}}({{percent quote.discount_percent}}){{/if}}</span>
        <span class="amount">-{{currency quote.discount_amount}}</span>
      </div>
    {{/if}}
    {{#if quote.tax_amount}}
      <div class="totals-row">
        <span class="label">Tax {{#if quote.tax_percent}}({{percent quote.tax_percent}}){{/if}}</span>
        <span class="amount">{{currency quote.tax_amount}}</span>
      </div>
    {{/if}}
    <div class="totals-row total-row">
      <span class="label">Total Amount</span>
      <span class="amount">{{currency quote.total}}</span>
    </div>
  </div>
</div>`,
    css_template: `.totals-boxed {
  margin: 30px 0 20px auto;
  max-width: 400px;
}

.totals-container {
  background-color: {{box_background}};
  border: 2px solid {{box_border}};
  border-radius: 8px;
  padding: 20px;
}

.totals-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid {{box_border}};
}

.totals-row:last-child {
  border-bottom: none;
}

.totals-row .label {
  font-size: 14px;
  color: #6b7280;
  font-weight: 500;
}

.totals-row .amount {
  font-size: 14px;
  color: #1f2937;
  font-weight: 600;
}

.discount-row .amount {
  color: #10b981;
}

.total-row {
  margin-top: 10px;
  padding-top: 15px;
  border-top: 2px solid {{box_border}};
}

.total-row .label {
  font-size: 16px;
  font-weight: 600;
  color: {{total_accent}};
}

.total-row .amount {
  font-size: 20px;
  font-weight: bold;
  color: {{total_accent}};
}`,
    usage_notes:
      'Totals in a boxed container that stands out visually. Great for highlighting the final amount.',
    tags: ['boxed', 'bordered', 'totals', 'highlighted'],
    sort_order: 14,
  },

  {
    name: 'Totals Detailed',
    component_type: 'totals',
    category: 'content',
    description: 'Detailed totals with payment terms and balance due',
    structure: {
      sections: ['subtotal', 'discount', 'tax', 'total', 'deposit', 'balance'],
      layout: 'detailed',
    },
    default_props: {
      show_deposit: true,
      show_balance: true,
    },
    html_template: `<div class="totals-detailed">
  <div class="calculation-section">
    <h4>Quote Summary</h4>
    <table class="calc-table">
      <tr>
        <td class="label">Subtotal:</td>
        <td class="amount">{{currency quote.subtotal}}</td>
      </tr>
      {{#if quote.discount_amount}}
        <tr class="discount-row">
          <td class="label">Discount {{#if quote.discount_percent}}({{percent quote.discount_percent}}){{/if}}:</td>
          <td class="amount">-{{currency quote.discount_amount}}</td>
        </tr>
      {{/if}}
      {{#if quote.tax_amount}}
        <tr>
          <td class="label">Tax {{#if quote.tax_percent}}({{percent quote.tax_percent}}){{/if}}:</td>
          <td class="amount">{{currency quote.tax_amount}}</td>
        </tr>
      {{/if}}
      <tr class="total-row">
        <td class="label">Total:</td>
        <td class="amount">{{currency quote.total}}</td>
      </tr>
    </table>
  </div>

  {{#if show_deposit}}
    <div class="payment-section">
      <h4>Payment Terms</h4>
      <table class="payment-table">
        <tr>
          <td class="label">Deposit Required:</td>
          <td class="amount">{{currency quote.deposit_amount}}</td>
        </tr>
        {{#if show_balance}}
          <tr class="balance-row">
            <td class="label">Balance Due:</td>
            <td class="amount">{{currency (subtract quote.total quote.deposit_amount)}}</td>
          </tr>
        {{/if}}
      </table>
    </div>
  {{/if}}
</div>`,
    css_template: `.totals-detailed {
  margin: 30px 0 20px auto;
  max-width: 400px;
}

.calculation-section,
.payment-section {
  margin-bottom: 20px;
}

.calculation-section h4,
.payment-section h4 {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.calc-table,
.payment-table {
  width: 100%;
  font-size: 13px;
}

.calc-table tr,
.payment-table tr {
  border-bottom: 1px solid #e5e7eb;
}

.calc-table td,
.payment-table td {
  padding: 8px 10px;
}

.label {
  text-align: left;
  color: #6b7280;
}

.amount {
  text-align: right;
  color: #1f2937;
  font-weight: 600;
}

.discount-row .amount {
  color: #10b981;
}

.total-row {
  background-color: #f3f4f6;
  font-weight: bold;
}

.total-row .label,
.total-row .amount {
  font-size: 15px;
  color: #1f2937;
}

.balance-row {
  background-color: #fef3c7;
}

.balance-row .label,
.balance-row .amount {
  font-size: 14px;
  font-weight: bold;
  color: #92400e;
}`,
    usage_notes:
      'Comprehensive totals section including payment terms, deposits, and balance due. Perfect for projects with payment schedules.',
    tags: ['detailed', 'payment-terms', 'deposit', 'balance'],
    sort_order: 15,
  },

  {
    name: 'Totals Simple',
    component_type: 'totals',
    category: 'content',
    description: 'Minimal totals section showing only the final amount',
    structure: {
      sections: ['total'],
      layout: 'simple',
    },
    default_props: {
      font_size: 24,
      accent_color: '#2563eb',
    },
    html_template: `<div class="totals-simple">
  <div class="total-amount" style="font-size: {{font_size}}px; color: {{accent_color}};">
    <span class="label">Total:</span>
    <span class="amount">{{currency quote.total}}</span>
  </div>
</div>`,
    css_template: `.totals-simple {
  margin: 30px 0;
  text-align: right;
}

.total-amount {
  display: inline-block;
  font-weight: bold;
}

.total-amount .label {
  margin-right: 15px;
}`,
    usage_notes:
      'Ultra-simple totals showing only the final amount. Perfect for minimal quote designs.',
    tags: ['simple', 'minimal', 'clean', 'one-line'],
    sort_order: 16,
  },

  // ========================================
  // FOOTERS (3 components)
  // ========================================
  {
    name: 'Footer Contact',
    component_type: 'footer',
    category: 'layout',
    description: 'Footer with contact information and business hours',
    structure: {
      sections: ['contact', 'hours', 'social'],
      layout: 'contact',
    },
    default_props: {
      show_hours: true,
      show_social: false,
      background_color: '#f9fafb',
      text_color: '#6b7280',
    },
    html_template: `<div class="footer-contact">
  <div class="footer-content">
    <div class="contact-section">
      <h4>Contact Us</h4>
      <p>{{company.phone}}</p>
      <p>{{company.email}}</p>
      <p>{{company.address}}</p>
    </div>

    {{#if show_hours}}
      <div class="hours-section">
        <h4>Business Hours</h4>
        <p>Monday - Friday: 8:00 AM - 6:00 PM</p>
        <p>Saturday: 9:00 AM - 4:00 PM</p>
        <p>Sunday: Closed</p>
      </div>
    {{/if}}

    {{#if show_social}}
      <div class="social-section">
        <h4>Follow Us</h4>
        {{#if company.facebook_url}}
          <p>Facebook: {{company.facebook_url}}</p>
        {{/if}}
        {{#if company.instagram_url}}
          <p>Instagram: {{company.instagram_url}}</p>
        {{/if}}
      </div>
    {{/if}}
  </div>
  <div class="footer-bottom">
    <p>&copy; {{year}} {{company.name}}. All rights reserved.</p>
  </div>
</div>`,
    css_template: `.footer-contact {
  background-color: {{background_color}};
  color: {{text_color}};
  padding: 30px 20px 15px;
  margin-top: 40px;
  border-top: 2px solid #e5e7eb;
}

.footer-content {
  display: flex;
  justify-content: space-between;
  gap: 30px;
  margin-bottom: 20px;
}

.contact-section,
.hours-section,
.social-section {
  flex: 1;
}

.footer-contact h4 {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 10px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.footer-contact p {
  font-size: 12px;
  margin: 3px 0;
  line-height: 1.5;
}

.footer-bottom {
  text-align: center;
  padding-top: 15px;
  border-top: 1px solid #e5e7eb;
  font-size: 11px;
  color: #9ca3af;
}`,
    usage_notes:
      'Comprehensive footer with contact information and business details. Great for building trust.',
    tags: ['footer', 'contact', 'hours', 'professional'],
    sort_order: 17,
  },

  {
    name: 'Footer Legal',
    component_type: 'footer',
    category: 'layout',
    description: 'Footer with terms, conditions, and legal disclaimers',
    structure: {
      sections: ['terms', 'payment', 'warranty'],
      layout: 'legal',
    },
    default_props: {
      show_payment_terms: true,
      show_warranty: true,
      font_size: 10,
    },
    html_template: `<div class="footer-legal" style="font-size: {{font_size}}px;">
  <div class="legal-section">
    <h4>Terms & Conditions</h4>
    <p>This quote is valid for 30 days from the date issued. Prices are subject to change based on material availability and market conditions.</p>
  </div>

  {{#if show_payment_terms}}
    <div class="legal-section">
      <h4>Payment Terms</h4>
      <p>A deposit of {{percent quote.deposit_percent}} is required to begin work. Final payment is due upon project completion. We accept cash, check, and major credit cards. Late payments may be subject to interest charges.</p>
    </div>
  {{/if}}

  {{#if show_warranty}}
    <div class="legal-section">
      <h4>Warranty</h4>
      <p>All work is guaranteed for one year from the date of completion. This warranty covers defects in materials and workmanship but does not cover damage caused by misuse, neglect, or normal wear and tear.</p>
    </div>
  {{/if}}

  <div class="footer-bottom">
    <p><strong>{{company.name}}</strong> | License #{{company.license_number}} | {{company.phone}} | {{company.email}}</p>
  </div>
</div>`,
    css_template: `.footer-legal {
  padding: 20px;
  margin-top: 40px;
  border-top: 2px solid #d1d5db;
  background-color: #ffffff;
  color: #6b7280;
}

.legal-section {
  margin-bottom: 15px;
}

.legal-section h4 {
  font-size: 11px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 5px 0;
  text-transform: uppercase;
}

.legal-section p {
  line-height: 1.6;
  margin: 0;
}

.footer-bottom {
  text-align: center;
  padding-top: 15px;
  margin-top: 15px;
  border-top: 1px solid #e5e7eb;
  font-size: 10px;
}

.footer-bottom strong {
  color: #1f2937;
}`,
    usage_notes:
      'Legal footer with terms, payment conditions, and warranties. Essential for protecting your business.',
    tags: ['footer', 'legal', 'terms', 'warranty'],
    sort_order: 18,
  },

  {
    name: 'Footer Minimal',
    component_type: 'footer',
    category: 'layout',
    description: 'Minimal footer with just company name and page number',
    structure: {
      sections: ['company', 'page'],
      layout: 'minimal',
    },
    default_props: {
      show_page_number: true,
      text_color: '#9ca3af',
    },
    html_template: `<div class="footer-minimal" style="color: {{text_color}};">
  <span class="company-name">{{company.name}}</span>
  {{#if show_page_number}}
    <span class="separator">|</span>
    <span class="page-number">Page {{page_number}}</span>
  {{/if}}
</div>`,
    css_template: `.footer-minimal {
  text-align: center;
  padding: 15px 20px;
  margin-top: 40px;
  border-top: 1px solid #e5e7eb;
  font-size: 11px;
}

.company-name {
  font-weight: 500;
}

.separator {
  margin: 0 10px;
}

.page-number {
  font-style: italic;
}`,
    usage_notes:
      'Ultra-minimal footer for clean, modern quotes. Just the essentials.',
    tags: ['footer', 'minimal', 'simple', 'clean'],
    sort_order: 19,
  },

  // ========================================
  // CUSTOM COMPONENTS (2 components)
  // ========================================
  {
    name: 'Signature Block',
    component_type: 'signature',
    category: 'custom',
    description: 'Signature lines for customer and contractor',
    structure: {
      sections: ['customer_signature', 'contractor_signature'],
      layout: 'two-column',
    },
    default_props: {
      show_date: true,
      show_print_name: true,
    },
    html_template: `<div class="signature-block">
  <h4 class="section-title">Acceptance & Authorization</h4>
  <p class="acceptance-text">By signing below, you authorize {{company.name}} to proceed with the work described in this quote and agree to the terms and payment schedule outlined above.</p>

  <div class="signature-lines">
    <div class="signature-column">
      <div class="signature-line"></div>
      <div class="signature-label">Customer Signature</div>
      {{#if show_print_name}}
        <div class="print-name-line"></div>
        <div class="signature-label">Print Name</div>
      {{/if}}
      {{#if show_date}}
        <div class="date-line"></div>
        <div class="signature-label">Date</div>
      {{/if}}
    </div>

    <div class="signature-column">
      <div class="signature-line"></div>
      <div class="signature-label">Contractor Signature</div>
      {{#if show_print_name}}
        <div class="print-name-line"></div>
        <div class="signature-label">Print Name</div>
      {{/if}}
      {{#if show_date}}
        <div class="date-line"></div>
        <div class="signature-label">Date</div>
      {{/if}}
    </div>
  </div>
</div>`,
    css_template: `.signature-block {
  margin: 40px 0 20px;
  padding: 20px;
  border: 1px solid #d1d5db;
  background-color: #fefce8;
}

.section-title {
  font-size: 14px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 10px 0;
  text-transform: uppercase;
}

.acceptance-text {
  font-size: 12px;
  color: #6b7280;
  line-height: 1.6;
  margin-bottom: 20px;
}

.signature-lines {
  display: flex;
  gap: 40px;
}

.signature-column {
  flex: 1;
}

.signature-line,
.print-name-line,
.date-line {
  border-bottom: 1px solid #1f2937;
  height: 40px;
  margin-bottom: 5px;
}

.date-line {
  height: 30px;
  max-width: 150px;
}

.signature-label {
  font-size: 11px;
  color: #6b7280;
  margin-bottom: 15px;
}`,
    usage_notes:
      'Professional signature block for customer acceptance. Essential for converting quotes to contracts.',
    tags: ['signature', 'acceptance', 'contract', 'legal'],
    sort_order: 20,
  },

  {
    name: 'Payment Schedule',
    component_type: 'payment_schedule',
    category: 'custom',
    description: 'Payment schedule table with milestones',
    structure: {
      sections: ['milestones', 'amounts', 'dates'],
      layout: 'table',
    },
    default_props: {
      show_percentage: true,
      highlight_due: true,
    },
    html_template: `<div class="payment-schedule">
  <h4 class="section-title">Payment Schedule</h4>
  <table class="schedule-table">
    <thead>
      <tr>
        <th>Milestone</th>
        <th>Description</th>
        {{#if show_percentage}}
          <th>Percentage</th>
        {{/if}}
        <th>Amount</th>
        <th>Due Date</th>
      </tr>
    </thead>
    <tbody>
      {{#each quote.payment_schedule}}
        <tr class="{{#if this.is_due}}highlight-due{{/if}}">
          <td class="milestone-name">{{this.milestone}}</td>
          <td class="milestone-description">{{this.description}}</td>
          {{#if ../show_percentage}}
            <td class="percentage">{{percent this.percentage}}</td>
          {{/if}}
          <td class="amount">{{currency this.amount}}</td>
          <td class="due-date">{{date this.due_date}}</td>
        </tr>
      {{/each}}
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="{{#if show_percentage}}3{{else}}2{{/if}}" class="total-label">Total Project Cost:</td>
        <td class="total-amount" colspan="2">{{currency quote.total}}</td>
      </tr>
    </tfoot>
  </table>
</div>`,
    css_template: `.payment-schedule {
  margin: 30px 0;
  padding: 20px;
  background-color: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
  margin: 0 0 15px 0;
}

.schedule-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  background-color: #ffffff;
}

.schedule-table thead {
  background-color: #f3f4f6;
}

.schedule-table th {
  padding: 10px;
  text-align: left;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #d1d5db;
}

.schedule-table td {
  padding: 10px;
  border-bottom: 1px solid #e5e7eb;
}

.milestone-name {
  font-weight: 600;
  color: #1f2937;
}

.milestone-description {
  color: #6b7280;
}

.percentage,
.amount {
  text-align: right;
  font-weight: 500;
}

.due-date {
  text-align: center;
  color: #6b7280;
}

{{#if highlight_due}}
.highlight-due {
  background-color: #fef3c7;
}

.highlight-due .due-date {
  font-weight: 600;
  color: #92400e;
}
{{/if}}

.total-row {
  background-color: #1f2937;
  color: #ffffff;
  font-weight: bold;
}

.total-row td {
  padding: 12px 10px;
  border: none;
}

.total-label {
  text-align: right;
  font-size: 14px;
}

.total-amount {
  font-size: 16px;
}`,
    usage_notes:
      'Professional payment schedule for multi-phase projects. Shows milestones, amounts, and due dates clearly.',
    tags: ['payment', 'schedule', 'milestones', 'multi-phase'],
    sort_order: 21,
  },
];

// Seed execution
export async function seedTemplateComponents(): Promise<void> {
  console.log('🌱 Starting template component seeding...');

  try {
    for (const component of COMPONENT_SEEDS) {
      const componentId = uuidv4();

      // Check if component already exists (idempotent)
      const existing = await prisma.template_component.findFirst({
        where: {
          name: component.name,
          component_type: component.component_type,
        },
      });

      if (existing) {
        console.log(
          `⏭️  Component "${component.name}" already exists, skipping...`,
        );
        continue;
      }

      // Create component
      await prisma.template_component.create({
        data: {
          id: componentId,
          tenant_id: null, // Platform component (global)
          name: component.name,
          component_type: component.component_type,
          category: component.category,
          description: component.description,
          structure: component.structure,
          default_props: component.default_props,
          html_template: component.html_template,
          css_template: component.css_template,
          thumbnail_url: null, // TODO: Generate thumbnails in future
          usage_notes: component.usage_notes,
          tags: component.tags,
          is_active: true,
          is_global: true,
          sort_order: component.sort_order,
        },
      });

      console.log(
        `✅ Created component: ${component.name} (${component.component_type})`,
      );
    }

    console.log(
      `\n🎉 Component library seeding complete! Created ${COMPONENT_SEEDS.length} components.`,
    );
  } catch (error) {
    console.error('❌ Error seeding components:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if executed directly
if (require.main === module) {
  seedTemplateComponents()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
