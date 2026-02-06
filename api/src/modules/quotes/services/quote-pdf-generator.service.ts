import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuotePricingService } from './quote-pricing.service';
import { QuoteTemplateService } from './quote-template.service';
import { QrCodeGeneratorService } from './qr-code-generator.service';
import { FilesService } from '../../files/files.service';
import { FileCategory } from '../../files/dto/upload-file.dto';
import { PdfResponseDto } from '../dto/pdf/pdf-response.dto';
import * as puppeteer from 'puppeteer';
import * as Handlebars from 'handlebars';
import * as crypto from 'crypto';

/**
 * QuotePdfGeneratorService
 *
 * Generates professional PDF documents from quotes using Puppeteer.
 *
 * Key Features:
 * - HTML to PDF conversion via Puppeteer
 * - Handlebars template rendering
 * - Tenant branding application (colors, logo)
 * - Image embedding (base64)
 * - QR code generation for attachments
 * - File storage integration
 *
 * Performance:
 * - Singleton Puppeteer browser (reused)
 * - ~2-5 seconds per PDF
 * - 30s timeout
 * - Optional async queue for large PDFs
 *
 * @author Developer 5
 */
@Injectable()
export class QuotePdfGeneratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QuotePdfGeneratorService.name);
  private browser: puppeteer.Browser | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingService: QuotePricingService,
    private readonly templateService: QuoteTemplateService,
    private readonly qrCodeService: QrCodeGeneratorService,
    private readonly filesService: FilesService,
  ) {}

  /**
   * Initialize Puppeteer browser on module startup
   */
  async onModuleInit() {
    try {
      this.logger.log('Launching Puppeteer browser...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
      });
      this.logger.log('Puppeteer browser launched successfully');
    } catch (error) {
      this.logger.error(
        `Failed to launch Puppeteer browser: ${error.message}`,
        error.stack,
      );
      // Don't throw - allow app to start even if PDF generation is unavailable
    }
  }

  /**
   * Close Puppeteer browser on module shutdown
   */
  async onModuleDestroy() {
    if (this.browser) {
      this.logger.log('Closing Puppeteer browser...');
      await this.browser.close();
      this.logger.log('Puppeteer browser closed');
    }
  }

  /**
   * Generate PDF for a quote
   *
   * Implements intelligent caching to avoid regenerating PDFs unnecessarily.
   * Returns cached PDF if:
   * - Quote hasn't been modified since last generation
   * - Generation parameters (e.g., includeCostBreakdown) haven't changed
   * - Force regenerate flag is not set
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @param userId - User initiating generation
   * @param includeCostBreakdown - Whether to include cost breakdown in PDF
   * @param forceRegenerate - Force regeneration even if cached PDF exists
   * @returns PDF file metadata with download URL
   */
  async generatePdf(
    tenantId: string,
    quoteId: string,
    userId: string,
    includeCostBreakdown: boolean = false,
    forceRegenerate: boolean = false,
  ): Promise<PdfResponseDto> {
    if (!this.browser) {
      throw new Error(
        'PDF generation unavailable - Puppeteer browser not initialized',
      );
    }

    // 1. Fetch quote with PDF metadata and latest_pdf_file relation
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
      include: {
        tenant: true,
        lead: true,
        vendor: true,
        items: {
          include: {
            quote_group: true,
            unit_measurement: true,
          },
          orderBy: [
            { quote_group: { order_index: 'asc' } },
            { order_index: 'asc' },
          ],
        },
        groups: {
          orderBy: { order_index: 'asc' },
        },
        attachments: {
          include: {
            file: true,
            qr_code_file: true,
          },
          orderBy: [{ attachment_type: 'asc' }, { order_index: 'asc' }],
        },
        latest_pdf_file: true, // Include the PDF file relation
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // 2. Check if regeneration is needed
    const needsRegeneration = await this.shouldRegeneratePdf(
      quote,
      includeCostBreakdown,
      forceRegenerate,
    );

    // 3. Return existing PDF if still valid
    if (!needsRegeneration && quote.latest_pdf_file) {
      this.logger.log(
        `Using cached PDF for quote ${quoteId} (file: ${quote.latest_pdf_file.id})`,
      );

      // Get file with URL from FilesService
      const fileWithUrl = await this.filesService.findOne(
        tenantId,
        quote.latest_pdf_file.file_id,
      );

      if (!fileWithUrl.url) {
        this.logger.warn(
          `Cached PDF file ${quote.latest_pdf_file.file_id} has no URL, will regenerate`,
        );
        // Fall through to regeneration if URL is not available
      } else {
        return {
          file_id: quote.latest_pdf_file.file_id,
          download_url: fileWithUrl.url,
          filename: quote.latest_pdf_file.original_filename,
          file_size: quote.latest_pdf_file.size_bytes,
          generated_at:
            quote.pdf_last_generated_at?.toISOString() ||
            new Date().toISOString(),
          regenerated: false, // Indicates cached PDF
        };
      }
    }

    this.logger.log(
      `Generating new PDF for quote ${quoteId} (include_cost_breakdown: ${includeCostBreakdown}, force: ${forceRegenerate})...`,
    );

    // 4. Delete old PDF if exists (CRITICAL: Prevents accumulation)
    if (quote.latest_pdf_file_id && quote.latest_pdf_file) {
      try {
        await this.filesService.delete(
          tenantId,
          quote.latest_pdf_file.file_id,
          userId,
        );
        this.logger.log(
          `Deleted old PDF ${quote.latest_pdf_file.file_id} for quote ${quoteId}`,
        );
      } catch (error) {
        this.logger.warn(
          `Failed to delete old PDF ${quote.latest_pdf_file.file_id}: ${error.message}`,
        );
        // Continue even if deletion fails
      }
    }

    // 5. Calculate pricing
    await this.pricingService.calculateQuoteFinancials(quoteId);

    // 6. Generate simple HTML
    const html = this.generateSimpleHtml(quote, includeCostBreakdown);

    // 7. Convert to PDF
    const pdfBuffer = await this.htmlToPdf(html);

    // 8. Calculate content hash for future change detection
    const contentHash = crypto
      .createHash('sha256')
      .update(pdfBuffer)
      .digest('hex');

    // 9. Upload to file storage
    const filename = `${quote.quote_number}.pdf`;

    // Create fake Multer file object
    const fakeFile: Express.Multer.File = {
      fieldname: 'file',
      originalname: filename,
      encoding: '7bit',
      mimetype: 'application/pdf',
      buffer: pdfBuffer,
      size: pdfBuffer.length,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const uploadedFile = await this.filesService.uploadFile(
      tenantId,
      userId,
      fakeFile,
      {
        category: FileCategory.QUOTE,
        entity_type: 'quote',
        entity_id: quoteId,
      },
    );

    // 10. Update quote with new PDF metadata (CRITICAL: Links PDF to quote)
    await this.prisma.quote.update({
      where: { id: quoteId },
      data: {
        latest_pdf_file_id: uploadedFile.file.id, // Use internal database ID, not public file_id
        pdf_content_hash: contentHash,
        pdf_last_generated_at: new Date(),
        pdf_generation_params: { include_cost_breakdown: includeCostBreakdown },
      },
    });

    this.logger.log(
      `Generated new PDF ${uploadedFile.file_id} for quote ${quoteId} (${pdfBuffer.length} bytes, hash: ${contentHash.substring(0, 16)}...)`,
    );

    return {
      file_id: uploadedFile.file_id,
      download_url: uploadedFile.url,
      filename: filename,
      file_size: pdfBuffer.length,
      generated_at: new Date().toISOString(),
      regenerated: true, // Indicates new PDF
    };
  }

  /**
   * Determine if PDF needs to be regenerated
   *
   * PDF regeneration is needed if:
   * 1. No PDF exists yet (latest_pdf_file_id is null)
   * 2. Force regenerate flag is set
   * 3. Generation parameters changed (e.g., cost breakdown toggle)
   * 4. Quote content changed (updated_at > pdf_last_generated_at)
   * 5. Quote version changed after last PDF generation
   *
   * @param quote - Quote with PDF metadata and relations
   * @param includeCostBreakdown - Current cost breakdown parameter
   * @param forceRegenerate - Force regeneration flag
   * @returns True if PDF needs regeneration
   */
  private async shouldRegeneratePdf(
    quote: any,
    includeCostBreakdown: boolean,
    forceRegenerate: boolean,
  ): Promise<boolean> {
    // 1. No PDF exists yet
    if (!quote.latest_pdf_file_id) {
      this.logger.debug(
        `Regeneration needed: No PDF exists for quote ${quote.id}`,
      );
      return true;
    }

    // 2. Force regenerate flag was passed
    if (forceRegenerate) {
      this.logger.debug(
        `Regeneration needed: Force regenerate flag set for quote ${quote.id}`,
      );
      return true;
    }

    // 3. Generation params changed (e.g., cost breakdown toggle)
    const storedParams = quote.pdf_generation_params || {};
    if (storedParams.include_cost_breakdown !== includeCostBreakdown) {
      this.logger.debug(
        `Regeneration needed: Generation params changed for quote ${quote.id} (cost_breakdown: ${storedParams.include_cost_breakdown} -> ${includeCostBreakdown})`,
      );
      return true;
    }

    // 4. Quote content changed (detect via updated_at vs pdf_last_generated_at)
    if (
      quote.pdf_last_generated_at &&
      quote.updated_at > quote.pdf_last_generated_at
    ) {
      this.logger.debug(
        `Regeneration needed: Quote ${quote.id} modified after last PDF generation (updated: ${quote.updated_at.toISOString()}, pdf: ${quote.pdf_last_generated_at.toISOString()})`,
      );
      return true;
    }

    // 5. Check if new version was created after last PDF generation
    const latestVersion = await this.prisma.quote_version.findFirst({
      where: { quote_id: quote.id },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });

    if (
      latestVersion &&
      quote.pdf_last_generated_at &&
      latestVersion.created_at > quote.pdf_last_generated_at
    ) {
      this.logger.debug(
        `Regeneration needed: New version created for quote ${quote.id} after last PDF generation`,
      );
      return true;
    }

    // PDF is still valid, no regeneration needed
    this.logger.debug(
      `PDF cache valid for quote ${quote.id}, using existing PDF`,
    );
    return false;
  }

  /**
   * Render Handlebars template with quote data
   *
   * @param template - Template object
   * @param data - Quote data with all relationships
   * @returns Rendered HTML
   */
  private async renderTemplate(template: any, data: any): Promise<string> {
    try {
      // Register Handlebars helpers
      this.registerHandlebarsHelpers();

      // Compile template
      const compiledTemplate = Handlebars.compile(template.template_content);

      // Prepare data for template
      const templateData = {
        quote: data,
        company: data.tenant,
        customer: data.lead,
        items: data.items || [],
        groups: data.groups || [],
        totals: {
          subtotal: parseFloat(data.subtotal?.toString() || '0'),
          tax: parseFloat(data.tax_amount?.toString() || '0'),
          discount: parseFloat(data.discount_amount?.toString() || '0'),
          total: parseFloat(data.total?.toString() || '0'),
        },
        currentDate: new Date().toLocaleDateString(),
      };

      // Render template
      const html = compiledTemplate(templateData);

      this.logger.log(`Template rendered successfully: ${template.name}`);
      return html;
    } catch (error) {
      this.logger.error(
        `Template rendering failed: ${error.message}`,
        error.stack,
      );
      throw new Error(`Failed to render template: ${error.message}`);
    }
  }

  /**
   * Convert HTML to PDF using Puppeteer
   *
   * @param html - HTML string
   * @returns PDF buffer
   */
  private async htmlToPdf(html: string): Promise<Buffer> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();

    try {
      await page.setContent(html, {
        waitUntil: 'networkidle0',
        timeout: 30000,
      });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }

  /**
   * Register Handlebars helpers for templates
   */
  private registerHandlebarsHelpers() {
    // Currency formatter
    Handlebars.registerHelper('currency', (value: any) => {
      const num = parseFloat(value?.toString() || '0');
      return `$${num.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
    });

    // Date formatter
    Handlebars.registerHelper('date', (value: any, format?: string) => {
      if (!value) return '';
      const date = new Date(value);
      if (format === 'short') {
        return date.toLocaleDateString();
      }
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Percentage formatter
    Handlebars.registerHelper('percent', (value: any) => {
      const num = parseFloat(value?.toString() || '0');
      return `${num.toFixed(2)}%`;
    });

    // Conditional equal
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    // Math helpers
    Handlebars.registerHelper('multiply', (a: any, b: any) => {
      return (
        parseFloat(a?.toString() || '0') * parseFloat(b?.toString() || '0')
      ).toFixed(2);
    });
  }

  /**
   * Embed images in HTML as base64
   *
   * @param html - HTML string
   * @param images - Image URLs mapped to keys
   * @returns HTML with embedded images
   */
  private async embedImages(
    html: string,
    images: { [key: string]: string },
  ): Promise<string> {
    try {
      let processedHtml = html;

      for (const [key, imageUrl] of Object.entries(images)) {
        if (imageUrl.startsWith('data:')) {
          // Already base64, use as-is
          processedHtml = processedHtml.replace(
            new RegExp(`{{${key}}}`, 'g'),
            imageUrl,
          );
        } else if (
          imageUrl.startsWith('http://') ||
          imageUrl.startsWith('https://')
        ) {
          // Fetch image and convert to base64
          const response = await fetch(imageUrl);
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString('base64');
          const mimeType = response.headers.get('content-type') || 'image/png';
          const dataUrl = `data:${mimeType};base64,${base64}`;
          processedHtml = processedHtml.replace(
            new RegExp(`{{${key}}}`, 'g'),
            dataUrl,
          );
        }
      }

      return processedHtml;
    } catch (error) {
      this.logger.error(
        `Image embedding failed: ${error.message}`,
        error.stack,
      );
      // Return original HTML if embedding fails
      return html;
    }
  }

  /**
   * Fetch all images for PDF
   *
   * @param attachments - Quote attachments
   * @returns Image URLs mapped to keys
   */
  private async fetchImages(
    attachments: any[],
  ): Promise<{ [key: string]: string }> {
    const images: { [key: string]: string } = {};

    if (!attachments || attachments.length === 0) {
      return images;
    }

    try {
      for (let i = 0; i < attachments.length; i++) {
        const attachment = attachments[i];
        if (attachment.file && attachment.file.url) {
          // Map attachment to template variable (e.g., attachment_1, attachment_2)
          images[`attachment_${i + 1}`] = attachment.file.url;
        }
      }

      this.logger.debug(`Fetched ${Object.keys(images).length} images for PDF`);
      return images;
    } catch (error) {
      this.logger.error(
        `Failed to fetch images: ${error.message}`,
        error.stack,
      );
      return {};
    }
  }

  /**
   * Fetch tenant branding (colors, logo)
   *
   * @param tenantId - Tenant ID
   * @returns Branding data
   */
  private async fetchTenantBranding(tenantId: string) {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          company_name: true,
          primary_brand_color: true,
          secondary_brand_color: true,
          accent_color: true,
          logo_file_id: true,
        },
      });

      if (!tenant) {
        this.logger.warn(`Tenant not found for branding: ${tenantId}`);
        return {
          company_name: 'Company',
          primary_color: '#3498db',
          secondary_color: '#2c3e50',
          accent_color: '#e74c3c',
          logo_file_id: null,
        };
      }

      return {
        company_name: tenant.company_name,
        primary_color: tenant.primary_brand_color || '#3498db',
        secondary_color: tenant.secondary_brand_color || '#2c3e50',
        accent_color: tenant.accent_color || '#e74c3c',
        logo_file_id: tenant.logo_file_id || null,
      };
    } catch (error) {
      this.logger.error(
        `Failed to fetch tenant branding: ${error.message}`,
        error.stack,
      );
      // Return default branding on error
      return {
        company_name: 'Company',
        primary_color: '#3498db',
        secondary_color: '#2c3e50',
        accent_color: '#e74c3c',
        logo_file_id: null,
      };
    }
  }

  /**
   * Fetch complete quote data with all relationships
   *
   * @param tenantId - Tenant ID
   * @param quoteId - Quote UUID
   * @returns Complete quote data
   */
  private async fetchCompleteQuoteData(tenantId: string, quoteId: string) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
      include: {
        tenant: true,
        lead: true,
        vendor: true,
        items: {
          include: {
            quote_group: true,
            unit_measurement: true,
          },
          orderBy: [
            { quote_group: { order_index: 'asc' } },
            { order_index: 'asc' },
          ],
        },
        groups: {
          orderBy: { order_index: 'asc' },
        },
        attachments: {
          include: {
            file: true,
            qr_code_file: true,
          },
          orderBy: [{ attachment_type: 'asc' }, { order_index: 'asc' }],
        },
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    return quote;
  }

  /**
   * Generate simple HTML for the quote
   * TODO: Replace with proper template system in future iterations
   *
   * @param quote - Complete quote data
   * @param includeCostBreakdown - Whether to include cost breakdown (vendor costs, profit margins)
   * @returns HTML string
   */
  private generateSimpleHtml(
    quote: any,
    includeCostBreakdown: boolean = false,
  ): string {
    const items = quote.items || [];
    const itemsHtml = items
      .map(
        (item: any) => `
      <tr>
        <td>${item.title}</td>
        <td>${item.quantity}</td>
        <td>${item.unit_measurement?.name || 'unit'}</td>
        <td>$${parseFloat(item.total_cost?.toString() || '0').toFixed(2)}</td>
      </tr>
    `,
      )
      .join('');

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote ${quote.quote_number}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 20px;
      color: #333;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
    }
    .company-name {
      font-size: 24px;
      font-weight: bold;
      color: #2c3e50;
    }
    .quote-number {
      font-size: 20px;
      color: #7f8c8d;
      margin-top: 10px;
    }
    .section {
      margin-bottom: 20px;
    }
    .section-title {
      font-size: 16px;
      font-weight: bold;
      border-bottom: 2px solid #3498db;
      padding-bottom: 5px;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #ecf0f1;
    }
    th {
      background-color: #3498db;
      color: white;
      font-weight: bold;
    }
    .totals {
      margin-top: 20px;
      text-align: right;
    }
    .total-row {
      font-size: 18px;
      font-weight: bold;
      margin-top: 10px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company-name">${quote.tenant?.company_name || 'Company Name'}</div>
    <div class="quote-number">Quote #${quote.quote_number}</div>
  </div>

  <div class="section">
    <div class="section-title">Quote Information</div>
    <p><strong>Title:</strong> ${quote.title}</p>
    <p><strong>Status:</strong> ${quote.status}</p>
    <p><strong>Created:</strong> ${new Date(quote.created_at).toLocaleDateString()}</p>
    ${quote.expires_at ? `<p><strong>Valid Until:</strong> ${new Date(quote.expires_at).toLocaleDateString()}</p>` : ''}
  </div>

  ${
    quote.lead
      ? `
  <div class="section">
    <div class="section-title">Customer Information</div>
    <p><strong>Name:</strong> ${quote.lead.first_name} ${quote.lead.last_name}</p>
    ${quote.lead.email ? `<p><strong>Email:</strong> ${quote.lead.email}</p>` : ''}
    ${quote.lead.phone ? `<p><strong>Phone:</strong> ${quote.lead.phone}</p>` : ''}
  </div>
  `
      : ''
  }

  <div class="section">
    <div class="section-title">Items</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Quantity</th>
          <th>Unit</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  </div>

  <div class="totals">
    <div><strong>Subtotal:</strong> $${parseFloat(quote.subtotal?.toString() || '0').toFixed(2)}</div>
    <div><strong>Tax:</strong> $${parseFloat(quote.tax_amount?.toString() || '0').toFixed(2)}</div>
    <div class="total-row"><strong>Total:</strong> $${parseFloat(quote.total?.toString() || '0').toFixed(2)}</div>
  </div>
</body>
</html>
    `;
  }
}
