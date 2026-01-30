import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuotePdfGeneratorService } from './quote-pdf-generator.service';
import { QuotePublicAccessService } from './quote-public-access.service';
import { QuoteVersionService } from './quote-version.service';
import { SendQuoteEmailDto, SendQuoteEmailResponseDto } from '../dto/email/send-quote-email.dto';
import { SendQuoteSmsDto, SendQuoteSmsResponseDto } from '../dto/email/send-quote-sms.dto';
import { SendEmailService } from '../../communication/services/send-email.service';
import { EmailTemplatesService } from '../../communication/services/email-templates.service';

/**
 * QuoteEmailService
 *
 * Orchestrates email sending for quotes using Communication Module.
 *
 * Key Features:
 * - PDF attachment preparation
 * - Public URL generation
 * - Communication Module integration (SendEmailService)
 * - Status automation (ready → sent)
 * - Audit logging
 *
 * @author Developer 5
 */
@Injectable()
export class QuoteEmailService {
  private readonly logger = new Logger(QuoteEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly pdfService: QuotePdfGeneratorService,
    private readonly publicAccessService: QuotePublicAccessService,
    private readonly versionService: QuoteVersionService,
    private readonly sendEmailService: SendEmailService,
    private readonly emailTemplatesService: EmailTemplatesService,
  ) {}

  /**
   * Send quote via email
   *
   * @param tenantId - Tenant ID
   * @param userId - User sending email
   * @param quoteId - Quote UUID
   * @param dto - Email options (recipient, cc, custom message)
   * @returns Email sent confirmation
   */
  async sendQuoteEmail(
    tenantId: string,
    userId: string,
    quoteId: string,
    dto: SendQuoteEmailDto,
  ): Promise<SendQuoteEmailResponseDto> {
    this.logger.log(`Sending quote ${quoteId} via email (tenant: ${tenantId})`);

    // 1. Validate quote exists and status is 'ready'
    const quote = await this.prisma.quote.findFirst({
      where: {
        id: quoteId,
        tenant_id: tenantId,
      },
      include: {
        lead: {
          include: {
            emails: {
              where: { is_primary: true },
              take: 1,
            },
          },
        },
        tenant: true,
        vendor: true,
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    // Allow sending quotes in ready, sent, delivered, read, opened, or email_failed status (resending is allowed)
    const allowedStatuses = ['ready', 'sent', 'delivered', 'read', 'opened', 'email_failed'];
    if (!allowedStatuses.includes(quote.status)) {
      throw new BadRequestException(
        `Quote must be in 'ready', 'sent', 'delivered', 'read', 'opened', or 'email_failed' status to send. Current status: ${quote.status}`,
      );
    }

    // 2. Determine recipient email
    const leadPrimaryEmail = quote.lead?.emails?.[0]?.email;
    const recipientEmail = dto.recipient_email || leadPrimaryEmail;
    if (!recipientEmail) {
      throw new BadRequestException('No recipient email found. Please provide recipient_email.');
    }

    // 3. Generate PDF for backend storage (NOT attached to email - public URL used instead)
    this.logger.log(`Generating PDF for quote ${quoteId}...`);
    const pdfResult = await this.pdfService.generatePdf(tenantId, quoteId, userId);

    // 4. Generate public URL if needed (skip status change - will be done after email is sent)
    this.logger.log(`Generating public URL for quote ${quoteId}...`);
    const publicUrlResult = await this.publicAccessService.generatePublicUrl(
      tenantId,
      quoteId,
      {},
      userId,
      true, // skipStatusChange = true (status will be updated after successful email send)
    );

    // 5. Send email via Communication Module
    this.logger.log(`Sending quote email to ${recipientEmail}...`);

    // Format quote total as currency
    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(amount);
    };

    // Render email template
    const customerName = quote.lead
      ? `${quote.lead.first_name} ${quote.lead.last_name}`.trim()
      : 'Customer';

    const rendered = await this.emailTemplatesService.renderTemplate(
      tenantId,
      'send-quote',
      {
        quote_number: quote.quote_number,
        customer_name: customerName,
        company_name: quote.tenant.company_name,
        quote_title: quote.title,
        quote_total: formatCurrency(parseFloat(quote.total.toString())),
        public_url: publicUrlResult.public_url,
        vendor_name: quote.vendor?.name || '',
        vendor_email: quote.vendor?.email || '',
        vendor_phone: quote.vendor?.phone || '',
        custom_message: dto.custom_message || '',
      },
    );

    // Send raw email WITHOUT PDF attachment (only public URL in email body)
    const emailResult = await this.sendEmailService.sendRaw(
      tenantId,
      {
        to: recipientEmail,
        cc: dto.cc_emails,
        subject: dto.custom_subject || rendered.subject, // Use custom subject if provided
        html_body: rendered.html_body,
        text_body: rendered.text_body ?? undefined,
        // No attachments - public URL is in email body instead
        related_entity_type: 'quote',
        related_entity_id: quoteId,
      },
      userId,
    );

    this.logger.log(`Quote email queued successfully (communication event ID: ${emailResult.communication_event_id})`);

    // 6. Update quote status to 'sent' if currently 'ready'
    if (quote.status === 'ready') {
      await this.prisma.quote.update({
        where: { id: quoteId },
        data: { status: 'sent' },
      });
      this.logger.log(`Quote ${quoteId} status changed from 'ready' to 'sent' (email sent)`);
    }

    // 7. Return success response
    return {
      success: true,
      message: 'Quote email sent successfully',
      public_url: publicUrlResult.public_url,
      pdf_file_id: pdfResult.file_id,
      email_id: emailResult.communication_event_id,
    };
  }

  /**
   * Send quote via SMS (placeholder for Phase 2)
   *
   * @param tenantId - Tenant ID
   * @param userId - User sending SMS
   * @param quoteId - Quote UUID
   * @param dto - SMS options
   * @returns Not available message
   */
  async sendQuoteSms(
    tenantId: string,
    userId: string,
    quoteId: string,
    dto: SendQuoteSmsDto,
  ): Promise<SendQuoteSmsResponseDto> {
    return {
      error: 'SMS sending not yet available',
      planned_for: 'Phase 2',
    };
  }
}
