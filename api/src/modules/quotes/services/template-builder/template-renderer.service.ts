import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../../../core/database/prisma.service';
import { VisualTemplateBuilderService } from './visual-template-builder.service';
import Handlebars from 'handlebars';
// import { Cache } from 'cache-manager';
// import { CACHE_MANAGER } from '@nestjs/cache-manager';
import puppeteer from 'puppeteer';

interface RenderOptions {
  include_cost_breakdown?: boolean;
  watermark?: string;
}

@Injectable()
export class TemplateRendererService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => VisualTemplateBuilderService))
    private readonly visualBuilder: VisualTemplateBuilderService,
    // @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {
    this.registerHandlebarsHelpers();
  }

  /**
   * Render template to HTML (both visual and code types)
   */
  async renderToHtml(
    templateId: string,
    quoteId: string,
    options: RenderOptions = {},
  ): Promise<string> {
    // Check cache first
    // const cacheKey = `template:rendered:${templateId}:${quoteId}`;
    // const cached = await this.cacheManager.get<string>(cacheKey);
    // if (cached) {
    //   return cached;
    // }

    // Load template
    const template = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new BadRequestException(`Template with ID ${templateId} not found`);
    }

    // Load quote data with all relations
    const quoteData = await this.loadQuoteData(quoteId);

    // Prepare Handlebars context
    const context = this.prepareContext(quoteData, options);

    // Compile and render based on template type
    let html: string;
    let css: string;

    if (template.template_type === 'visual') {
      // Visual template: compile structure to Handlebars first
      const compiled = await this.visualBuilder.compileToHandlebars(
        template.visual_structure,
      );
      html = compiled.html;
      css = compiled.css;
    } else {
      // Code template: use existing HTML/CSS
      html = template.html_content || '';
      css = template.css_content || '';
    }

    // Compile and execute Handlebars template
    const handlebarsTemplate = Handlebars.compile(html);
    const renderedHtml = handlebarsTemplate(context);

    // Combine HTML with CSS
    const fullHtml = this.inlineCSS(renderedHtml, css);

    // Cache result for 5 minutes
    // await this.cacheManager.set(cacheKey, fullHtml, 300000);

    return fullHtml;
  }

  /**
   * Render template to PDF (using Puppeteer)
   */
  async renderToPdf(
    templateId: string,
    quoteId: string,
    options: RenderOptions = {},
  ): Promise<Buffer> {
    // Check PDF cache first
    // const pdfCacheKey = `template:pdf:${templateId}:${quoteId}`;
    // const cachedPdf = await this.cacheManager.get<Buffer>(pdfCacheKey);
    // if (cachedPdf) {
    //   return cachedPdf;
    // }

    // Render to HTML first
    const html = await this.renderToHtml(templateId, quoteId, options);

    // Generate PDF using Puppeteer
    const pdfBuffer = await this.generatePdfFromHtml(html);

    // Cache PDF for 1 hour
    // await this.cacheManager.set(pdfCacheKey, pdfBuffer, 3600000);

    return pdfBuffer;
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(
    templateId: string,
    sampleData?: any,
  ): Promise<{ html: string; css: string }> {
    // Load template
    const template = await this.prisma.quote_template.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new BadRequestException(`Template with ID ${templateId} not found`);
    }

    // Use sample data if provided, otherwise generate default sample
    const context = sampleData || this.getDefaultSampleData();

    let html: string;
    let css: string;

    if (template.template_type === 'visual') {
      const compiled = await this.visualBuilder.compileToHandlebars(
        template.visual_structure,
      );
      html = compiled.html;
      css = compiled.css;
    } else {
      html = template.html_content || '';
      css = template.css_content || '';
    }

    // Compile Handlebars
    const handlebarsTemplate = Handlebars.compile(html);
    const renderedHtml = handlebarsTemplate(context);

    return {
      html: renderedHtml,
      css,
    };
  }

  /**
   * Invalidate cache for template
   */
  async invalidateTemplateCache(templateId: string): Promise<void> {
    // Delete all cache keys starting with template:*:templateId
    // Note: cache-manager doesn't support pattern deletion by default
    // This would require a custom implementation or using Redis directly
    // For now, we'll document that cache will expire naturally
    console.log(`Cache invalidation requested for template ${templateId}`);
  }

  // ==================== PRIVATE HELPER METHODS ====================

  private async loadQuoteData(quoteId: string) {
    const quote = await this.prisma.quote.findUnique({
      where: { id: quoteId },
      include: {
        lead: true,
        vendor: true,
        jobsite_address: true,
        tenant: {
          select: {
            company_name: true,
            primary_contact_phone: true,
            primary_contact_email: true,
            website_url: true,
            logo_file_id: true,
          },
        },
        items: {
          include: {
            unit_measurement: true,
          },
          orderBy: { order_index: 'asc' },
        },
        groups: {
          include: {
            items: true,
          },
          orderBy: { order_index: 'asc' },
        },
      },
    });

    if (!quote) {
      throw new BadRequestException(`Quote with ID ${quoteId} not found`);
    }

    return quote;
  }

  private prepareContext(quoteData: any, options: RenderOptions): any {
    // Build comprehensive context for Handlebars
    const context = {
      quote: {
        quote_number: quoteData.quote_number,
        title: quoteData.title,
        status: quoteData.status,
        po_number: quoteData.po_number,
        subtotal: Number(quoteData.subtotal),
        tax_amount: Number(quoteData.tax_amount),
        discount_amount: Number(quoteData.discount_amount),
        total: Number(quoteData.total),
        expires_at: quoteData.expires_at,
        custom_terms: quoteData.custom_terms,
        custom_payment_instructions: quoteData.custom_payment_instructions,
        created_at: quoteData.created_at,
        updated_at: quoteData.updated_at,

        // Lead/Customer
        lead: quoteData.lead
          ? {
              full_name: quoteData.lead.full_name,
              email: quoteData.lead.email,
              phone: quoteData.lead.phone,
              company_name: quoteData.lead.company_name,
            }
          : null,

        // Jobsite Address
        jobsite_address: quoteData.jobsite_address
          ? {
              line1: quoteData.jobsite_address.line1,
              line2: quoteData.jobsite_address.line2,
              city: quoteData.jobsite_address.city,
              state: quoteData.jobsite_address.state,
              zip_code: quoteData.jobsite_address.zip_code,
            }
          : null,

        // Vendor
        vendor: quoteData.vendor
          ? {
              name: quoteData.vendor.name,
              email: quoteData.vendor.email,
              phone: quoteData.vendor.phone,
              address_line1: quoteData.vendor.address_line1,
              address_line2: quoteData.vendor.address_line2,
              city: quoteData.vendor.city,
              state: quoteData.vendor.state,
              zip_code: quoteData.vendor.zip_code,
            }
          : null,

        // Line Items
        items: quoteData.items.map((item: any) => ({
          title: item.title,
          description: item.description,
          quantity: Number(item.quantity),
          unit_measurement: item.unit_measurement?.name || 'each',
          material_cost: Number(item.material_cost_per_unit),
          labor_cost: Number(item.labor_cost_per_unit),
          total_cost: Number(item.total_cost),
        })),

        // Groups (if using grouped layout)
        groups: quoteData.groups.map((group: any) => ({
          name: group.name,
          description: group.description,
          items: group.items,
        })),
      },

      // Tenant/Company info
      tenant: {
        company_name: quoteData.tenant.company_name,
        phone: quoteData.tenant.primary_contact_phone,
        email: quoteData.tenant.primary_contact_email,
        website: quoteData.tenant.website_url,
        logo_url: quoteData.tenant.logo_file_id
          ? `/files/${quoteData.tenant.logo_file_id}`
          : null,
      },

      // System variables
      current_date: new Date().toLocaleDateString(),
      current_year: new Date().getFullYear(),

      // Options
      show_cost_breakdown: options.include_cost_breakdown || false,
      watermark: options.watermark || null,
    };

    return context;
  }

  private getDefaultSampleData(): any {
    return {
      quote: {
        quote_number: 'Q-0001',
        title: 'Sample Quote',
        status: 'draft',
        subtotal: 5000.0,
        tax_amount: 500.0,
        discount_amount: 250.0,
        total: 5250.0,
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        custom_terms: 'Payment due within 30 days of invoice date.',
        lead: {
          full_name: 'John Smith',
          email: 'john.smith@example.com',
          phone: '(555) 123-4567',
          company_name: 'Smith Corp',
        },
        jobsite_address: {
          line1: '123 Main Street',
          line2: 'Suite 200',
          city: 'Springfield',
          state: 'IL',
          zip_code: '62701',
        },
        vendor: {
          name: 'ABC Contractors',
          email: 'info@abccontractors.com',
          phone: '(555) 987-6543',
          address_line1: '456 Business Blvd',
          city: 'Springfield',
          state: 'IL',
          zip_code: '62702',
        },
        items: [
          {
            title: 'Cabinet Installation',
            description: 'Install 10 premium kitchen cabinets',
            quantity: 10,
            unit_measurement: 'each',
            total_cost: 2500.0,
          },
          {
            title: 'Countertop Installation',
            description: 'Granite countertop installation',
            quantity: 25,
            unit_measurement: 'sq ft',
            total_cost: 2500.0,
          },
        ],
        groups: [],
      },
      tenant: {
        company_name: 'Sample Business LLC',
        phone: '(555) 111-2222',
        email: 'contact@samplebusiness.com',
        website: 'https://samplebusiness.com',
        logo_url: null,
      },
      current_date: new Date().toLocaleDateString(),
      current_year: new Date().getFullYear(),
    };
  }

  private inlineCSS(html: string, css: string): string {
    // Simple CSS inlining - wrap CSS in style tag
    // For production, consider using a library like 'juice' for proper CSS inlining
    if (!css) return html;

    // Check if HTML already has a <head> section
    if (html.includes('<head>')) {
      return html.replace('</head>', `<style>${css}</style>\n</head>`);
    }

    // If no head, add one
    return html.replace(
      '<html>',
      `<html>\n<head>\n<style>${css}</style>\n</head>`,
    );
  }

  private async generatePdfFromHtml(html: string): Promise<Buffer> {
    // Launch Puppeteer browser
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu',
      ],
    });

    try {
      const page = await browser.newPage();

      // Set content with proper wait for resources
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      // Generate PDF with professional settings
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
        },
        preferCSSPageSize: false,
      });

      return Buffer.from(pdfBuffer);
    } catch (error) {
      throw new BadRequestException(`Failed to generate PDF: ${error.message}`);
    } finally {
      await browser.close();
    }
  }

  private registerHandlebarsHelpers(): void {
    // Currency helper
    Handlebars.registerHelper('currency', function (value: any) {
      if (typeof value !== 'number') {
        value = parseFloat(value) || 0;
      }
      return '$' + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    });

    // Date helper
    Handlebars.registerHelper('date', function (value: any) {
      if (!value) return '';
      const date = new Date(value);
      return date.toLocaleDateString('en-US');
    });

    // Percent helper
    Handlebars.registerHelper('percent', function (value: any) {
      if (typeof value !== 'number') {
        value = parseFloat(value) || 0;
      }
      return (value * 100).toFixed(1) + '%';
    });

    // Comparison helpers
    Handlebars.registerHelper('eq', function (a: any, b: any) {
      return a === b;
    });

    Handlebars.registerHelper('ne', function (a: any, b: any) {
      return a !== b;
    });

    Handlebars.registerHelper('lt', function (a: any, b: any) {
      return a < b;
    });

    Handlebars.registerHelper('gt', function (a: any, b: any) {
      return a > b;
    });

    Handlebars.registerHelper('lte', function (a: any, b: any) {
      return a <= b;
    });

    Handlebars.registerHelper('gte', function (a: any, b: any) {
      return a >= b;
    });

    // Logic helpers
    Handlebars.registerHelper('and', function (...args: any[]) {
      args.pop(); // Remove options object
      return args.every(Boolean);
    });

    Handlebars.registerHelper('or', function (...args: any[]) {
      args.pop(); // Remove options object
      return args.some(Boolean);
    });

    Handlebars.registerHelper('not', function (value: any) {
      return !value;
    });

    // Math helpers
    Handlebars.registerHelper('multiply', function (a: any, b: any) {
      return (parseFloat(a) || 0) * (parseFloat(b) || 0);
    });

    Handlebars.registerHelper('divide', function (a: any, b: any) {
      const divisor = parseFloat(b) || 1;
      return (parseFloat(a) || 0) / divisor;
    });

    Handlebars.registerHelper('add', function (a: any, b: any) {
      return (parseFloat(a) || 0) + (parseFloat(b) || 0);
    });

    Handlebars.registerHelper('subtract', function (a: any, b: any) {
      return (parseFloat(a) || 0) - (parseFloat(b) || 0);
    });
  }
}
