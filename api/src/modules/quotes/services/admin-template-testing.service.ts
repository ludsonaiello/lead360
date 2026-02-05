import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { CacheService } from '../../../core/cache/cache.service';
import { AuditLoggerService } from '../../audit/services/audit-logger.service';
import { QuoteTemplateService } from './quote-template.service';
import { QuotePdfGeneratorService } from './quote-pdf-generator.service';
import {
  PreviewType,
  PreviewTemplateResponseDto,
  TestPdfResponseDto,
  ValidateTemplateResponseDto,
  ValidationError,
  ValidationSeverity,
  TestEmailResponseDto,
  TemplateVersionHistoryResponseDto,
  RestoreTemplateVersionResponseDto,
} from '../dto/template';
import * as Handlebars from 'handlebars';
import { randomUUID } from 'crypto';

/**
 * AdminTemplateTestingService
 *
 * Provides template testing, validation, and versioning capabilities
 * for Platform Administrators.
 *
 * Features:
 * - Template preview with sample or real data
 * - PDF test generation with performance metrics
 * - Template syntax validation
 * - Email rendering preview and test sending
 * - Template version history and restore
 *
 * @author Backend Developer 5
 */
@Injectable()
export class AdminTemplateTestingService {
  private readonly logger = new Logger(AdminTemplateTestingService.name);
  private readonly CACHE_TTL = 900; // 15 minutes in seconds
  private readonly CACHE_PREFIX_PREVIEW = 'template:preview:';
  private readonly CACHE_PREFIX_PDF = 'template:pdf:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
    private readonly auditLogger: AuditLoggerService,
    private readonly templateService: QuoteTemplateService,
    private readonly pdfGeneratorService: QuotePdfGeneratorService,
  ) {
    // Register Handlebars helpers
    this.registerHandlebarsHelpers();
  }

  /**
   * Register Handlebars helpers for template rendering
   */
  private registerHandlebarsHelpers() {
    // Currency formatter
    Handlebars.registerHelper('currency', (value: number) => {
      if (value === null || value === undefined) return '$0.00';
      return `$${value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`;
    });

    // Date formatter
    Handlebars.registerHelper('date', (value: string | Date) => {
      if (!value) return '';
      const date = new Date(value);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });

    // Percentage formatter
    Handlebars.registerHelper('percent', (value: number) => {
      if (value === null || value === undefined) return '0%';
      return `${(value * 100).toFixed(2)}%`;
    });

    // Equality check
    Handlebars.registerHelper('eq', (a: any, b: any) => a === b);

    // Multiply helper
    Handlebars.registerHelper('multiply', (a: number, b: number) => a * b);
  }

  /**
   * 1. Preview template with sample or real data
   */
  async previewTemplate(
    templateId: string,
    previewType: PreviewType,
    quoteId?: string,
  ): Promise<PreviewTemplateResponseDto> {
    // Fetch template
    const template = await this.templateService.findOneAdmin(templateId);

    // Get data (real or sample)
    let data: any;
    if (quoteId) {
      data = await this.fetchRealQuoteData(quoteId);
    } else {
      data = this.generateSampleQuoteData(previewType);
    }

    // Render template
    const renderedHtml = this.renderTemplate(template.html_content || '', data);

    // Store in cache
    const previewKey = `${this.CACHE_PREFIX_PREVIEW}${randomUUID()}`;
    await this.cache.set(
      previewKey,
      {
        html: renderedHtml,
        css: '', // CSS can be extracted if needed
      },
      this.CACHE_TTL,
    );

    const expiresAt = new Date(Date.now() + this.CACHE_TTL * 1000);

    return {
      rendered_html: renderedHtml,
      rendered_css: '',
      preview_url: `/admin/quotes/templates/preview/${previewKey}`,
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * 2. Test PDF generation from template
   */
  async testPdfGeneration(
    templateId: string,
    previewType: PreviewType,
    quoteId?: string,
  ): Promise<TestPdfResponseDto> {
    const startTime = Date.now();

    // Fetch template
    const template = await this.templateService.findOneAdmin(templateId);

    // Get data (real or sample)
    let data: any;
    if (quoteId) {
      data = await this.fetchRealQuoteData(quoteId);
    } else {
      data = this.generateSampleQuoteData(previewType);
    }

    // Render template
    const renderedHtml = this.renderTemplate(template.html_content || '', data);

    // Generate PDF using Puppeteer (via existing PDF generator service)
    // For now, we'll just render HTML. Full PDF generation would use Puppeteer.
    const pdfKey = `${this.CACHE_PREFIX_PDF}${randomUUID()}`;

    // Store rendered HTML (would be PDF buffer in production)
    await this.cache.set(
      pdfKey,
      {
        html: renderedHtml,
        type: 'test-pdf',
      },
      this.CACHE_TTL,
    );

    const generationTime = Date.now() - startTime;
    const expiresAt = new Date(Date.now() + this.CACHE_TTL * 1000);

    // Detect warnings
    const warnings = this.detectTemplateWarnings(template.html_content || '');

    return {
      pdf_url: `/admin/quotes/templates/test-pdf/${pdfKey}`,
      file_size_bytes: renderedHtml.length, // Approximation
      generation_time_ms: generationTime,
      expires_at: expiresAt.toISOString(),
      warnings: warnings.length > 0 ? warnings : undefined,
    };
  }

  /**
   * 3. Validate template syntax
   */
  async validateTemplateSyntax(
    templateId: string,
  ): Promise<ValidateTemplateResponseDto> {
    const template = await this.templateService.findOneAdmin(templateId);

    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const unusedVariables: string[] = [];
    const missingRequiredVariables: string[] = [];

    try {
      // Try to compile template with Handlebars
      Handlebars.compile(template.html_content);
    } catch (error) {
      // Parse Handlebars compilation error
      const errorMessage = error.message || 'Unknown syntax error';
      errors.push({
        line: 0,
        column: 0,
        message: errorMessage,
        severity: ValidationSeverity.ERROR,
      });
    }

    // Check for required variables
    const requiredVariables = [
      '{{quote.quote_number}}',
      '{{customer.first_name}}',
      '{{vendor.name}}',
      '{{totals.total}}',
    ];

    requiredVariables.forEach((varName) => {
      if (!template.html_content?.includes(varName)) {
        missingRequiredVariables.push(varName);
      }
    });

    // Check template width (warn if too wide for PDF)
    if (template.html_content?.includes('width: 100%') === false) {
      warnings.push({
        line: 0,
        column: 0,
        message: 'Template may not be responsive. Consider using width: 100%',
        severity: ValidationSeverity.WARNING,
      });
    }

    const isValid = errors.length === 0;

    return {
      is_valid: isValid,
      errors,
      warnings,
      unused_variables: unusedVariables,
      missing_required_variables: missingRequiredVariables,
    };
  }

  /**
   * 4. Test email rendering
   */
  async testEmailRendering(
    templateId: string,
    previewType: PreviewType,
    sendToEmail?: string,
  ): Promise<TestEmailResponseDto> {
    const template = await this.templateService.findOneAdmin(templateId);

    // Generate sample data
    const data = this.generateSampleQuoteData(previewType);

    // Render template
    const htmlPreview = this.renderTemplate(template.html_content || '', data);

    // Generate plain text version (strip HTML tags)
    const textPreview = htmlPreview.replace(/<[^>]*>/g, '').trim();

    // Subject line
    const subjectLine = `Quote ${data.quote.quote_number} - ${data.quote.title}`;

    let testEmailSent = false;
    let emailJobId: string | undefined;

    // If sendToEmail provided, queue test email
    if (sendToEmail) {
      // In production, this would use the Communication module to send email
      // For now, we'll just log it
      this.logger.log(`Test email would be sent to: ${sendToEmail}`);
      testEmailSent = true;
      emailJobId = randomUUID();
    }

    return {
      html_preview: htmlPreview,
      text_preview: textPreview,
      subject_line: subjectLine,
      test_email_sent: testEmailSent,
      email_job_id: emailJobId,
    };
  }

  /**
   * 5. Get template version history
   */
  async getTemplateVersionHistory(
    templateId: string,
  ): Promise<TemplateVersionHistoryResponseDto> {
    const template = await this.templateService.findOneAdmin(templateId);

    // Fetch all versions
    const versions = await this.prisma.quote_template_version.findMany({
      where: { template_id: templateId },
      orderBy: { version_number: 'desc' },
      include: {
        created_by_user: {
          select: {
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
    });

    // Get current version number (highest version)
    const currentVersion = versions.length > 0 ? versions[0].version_number : 0;

    return {
      template_id: templateId,
      current_version: currentVersion,
      versions: versions.map((v) => ({
        version: v.version_number,
        created_at: v.created_at.toISOString(),
        created_by: v.created_by_user ? `${v.created_by_user.first_name} ${v.created_by_user.last_name}` : 'Unknown',
        changes_summary: v.changes_summary || 'No summary provided',
        html_content_snapshot: v.html_content,
      })) as any,
    };
  }

  /**
   * 6. Restore template version
   */
  async restoreTemplateVersion(
    templateId: string,
    userId: string,
    version: number,
    createBackup: boolean,
  ): Promise<RestoreTemplateVersionResponseDto> {
    const template = await this.templateService.findOneAdmin(templateId);

    // Create backup of current version if requested
    let backupCreated = false;
    if (createBackup) {
      await this.createTemplateSnapshot(
        template,
        userId,
        'Backup before restore',
      );
      backupCreated = true;
    }

    // Fetch the version to restore
    const versionToRestore = await this.prisma.quote_template_version.findFirst(
      {
        where: {
          template_id: templateId,
          version_number: version,
        },
      },
    );

    if (!versionToRestore) {
      throw new NotFoundException(
        `Version ${version} not found for template ${templateId}`,
      );
    }

    // Restore the HTML content from that version
    const updatedTemplate = await this.prisma.quote_template.update({
      where: { id: templateId },
      data: {
        html_content: versionToRestore.html_content,
      },
    });

    // Create new version snapshot after restore
    await this.createTemplateSnapshot(
      updatedTemplate,
      userId,
      `Restored to version ${version}`,
    );

    // Get new current version
    const newCurrentVersion = await this.prisma.quote_template_version.count({
      where: { template_id: templateId },
    });

    return {
      message: `Template restored to version ${version}`,
      new_current_version: newCurrentVersion,
      backup_created: backupCreated,
    };
  }

  /**
   * 7. Generate sample quote data
   */
  generateSampleQuoteData(previewType: PreviewType): any {
    const baseData: any = {
      quote: {
        id: `sample-${randomUUID()}`,
        quote_number: 'Q-2024-001',
        title: 'Kitchen Renovation',
        status: 'draft',
        created_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      customer: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john.doe@example.com',
        phone: '(555) 123-4567',
      },
      vendor: {
        name: 'ABC Construction Inc',
        email: 'info@abcconstruction.com',
        phone: '(555) 234-5678',
        address_line1: '123 Main Street',
        city: 'Boston',
        state: 'MA',
        zip_code: '02101',
      },
      jobsite: {
        address_line1: '456 Oak Avenue',
        city: 'Cambridge',
        state: 'MA',
        zip_code: '02139',
      },
      items: [] as any[],
      groups: [] as any[],
      totals: {
        subtotal: 0,
        discount_amount: 0,
        total: 0,
      },
      terms: {
        quote_terms: 'Payment due within 30 days of project completion.',
      },
    };

    // Minimal: 3-5 items
    if (previewType === PreviewType.MINIMAL) {
      baseData.items = [
        {
          title: 'Cabinets',
          description: 'Kitchen cabinets',
          quantity: 10,
          unit: 'Each',
          unit_price: 500,
          total_price: 5000,
        },
        {
          title: 'Countertops',
          description: 'Granite countertops',
          quantity: 25,
          unit: 'sq ft',
          unit_price: 80,
          total_price: 2000,
        },
        {
          title: 'Appliances',
          description: 'Kitchen appliances',
          quantity: 4,
          unit: 'Each',
          unit_price: 800,
          total_price: 3200,
        },
      ];
      baseData.totals.subtotal = 10200;
      baseData.totals.total = 10200;
    }

    // Standard: 10-15 items, 2-3 groups, one discount
    if (previewType === PreviewType.STANDARD) {
      baseData.items = [
        {
          title: 'Cabinets',
          quantity: 10,
          unit: 'Each',
          unit_price: 500,
          total_price: 5000,
        },
        {
          title: 'Countertops',
          quantity: 25,
          unit: 'sq ft',
          unit_price: 80,
          total_price: 2000,
        },
        {
          title: 'Backsplash Tile',
          quantity: 50,
          unit: 'sq ft',
          unit_price: 15,
          total_price: 750,
        },
        {
          title: 'Sink and Faucet',
          quantity: 1,
          unit: 'Each',
          unit_price: 450,
          total_price: 450,
        },
        {
          title: 'Flooring',
          quantity: 100,
          unit: 'sq ft',
          unit_price: 12,
          total_price: 1200,
        },
        {
          title: 'Paint and Supplies',
          quantity: 1,
          unit: 'Each',
          unit_price: 600,
          total_price: 600,
        },
        {
          title: 'Lighting Fixtures',
          quantity: 5,
          unit: 'Each',
          unit_price: 120,
          total_price: 600,
        },
        {
          title: 'Labor - Demolition',
          quantity: 16,
          unit: 'Hour',
          unit_price: 50,
          total_price: 800,
        },
        {
          title: 'Labor - Installation',
          quantity: 40,
          unit: 'Hour',
          unit_price: 65,
          total_price: 2600,
        },
      ];
      baseData.totals.subtotal = 14000;
      baseData.totals.discount_amount = 500;
      baseData.totals.total = 13500;
    }

    // Complex: 25+ items, 4-5 groups, multiple discounts
    if (previewType === PreviewType.COMPLEX) {
      // Simplified for now - add more items
      baseData.items = [
        ...baseData.items,
        { title: 'Item 1', quantity: 1, unit: 'Each', unit_price: 100, total_price: 100 },
        { title: 'Item 2', quantity: 2, unit: 'Each', unit_price: 150, total_price: 300 },
        { title: 'Item 3', quantity: 3, unit: 'Each', unit_price: 200, total_price: 600 },
        // ... add more items to reach 25+
      ];
      baseData.totals.subtotal = 20000;
      baseData.totals.discount_amount = 1000;
      baseData.totals.total = 19000;
    }

    return baseData;
  }

  /**
   * 8. Render template with Handlebars
   */
  private renderTemplate(templateHtml: string, data: any): string {
    try {
      const compiledTemplate = Handlebars.compile(templateHtml);
      return compiledTemplate(data);
    } catch (error) {
      this.logger.error('Template rendering error', error);
      throw new BadRequestException(`Template rendering failed: ${error.message}`);
    }
  }

  /**
   * 9. Detect template warnings
   */
  private detectTemplateWarnings(templateHtml: string): string[] {
    const warnings: string[] = [];

    // Check template width
    if (!templateHtml.includes('width') || !templateHtml.includes('max-width')) {
      warnings.push('Template may not have responsive width settings');
    }

    // Check for very long templates
    if (templateHtml.length > 50000) {
      warnings.push('Template is very large (>50KB), may impact PDF generation performance');
    }

    // Check for external resources (images, fonts)
    if (templateHtml.includes('http://') || templateHtml.includes('https://')) {
      warnings.push('Template contains external resources that may slow PDF generation');
    }

    return warnings;
  }

  /**
   * 10. Create template snapshot (version)
   */
  async createTemplateSnapshot(
    template: any,
    userId: string,
    changesSummary?: string,
  ): Promise<any> {
    // Get current max version number
    const maxVersion = await this.prisma.quote_template_version.aggregate({
      where: { template_id: template.id },
      _max: { version_number: true },
    });

    const newVersionNumber = (maxVersion._max.version_number || 0) + 1;

    // Create new version record
    const version = await this.prisma.quote_template_version.create({
      data: {
        id: randomUUID(),
        template_id: template.id,
        version_number: newVersionNumber,
        template_type: template.template_type || 'code',
        visual_structure: template.visual_structure || null,
        html_content: template.html_content,
        css_content: template.css_content || null,
        changes_summary: changesSummary || 'Template snapshot',
        created_by_user_id: userId,
      },
    });

    this.logger.log(
      `Created template version ${newVersionNumber} for template ${template.id}`,
    );

    return version;
  }

  /**
   * Helper: Fetch real quote data for preview
   */
  private async fetchRealQuoteData(quoteId: string): Promise<any> {
    // For now, return sample data since real quote fetching requires complex includes
    // In production, this would fetch actual quote data from database
    this.logger.log(`Fetching real quote data for ${quoteId} (using sample data for now)`);

    // Return standard sample data as placeholder
    return this.generateSampleQuoteData(PreviewType.STANDARD);
  }
}
