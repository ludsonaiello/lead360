import { Injectable, BadRequestException, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuotePdfGeneratorService } from './quote-pdf-generator.service';
import { QuotePublicAccessService } from './quote-public-access.service';
import { QuoteVersionService } from './quote-version.service';
import { SendQuoteEmailDto, SendQuoteEmailResponseDto } from '../dto/email/send-quote-email.dto';
import { SendQuoteSmsDto, SendQuoteSmsResponseDto } from '../dto/email/send-quote-sms.dto';

/**
 * QuoteEmailService
 *
 * Orchestrates email sending for quotes using Communication Module.
 *
 * Key Features:
 * - PDF attachment preparation
 * - Public URL generation
 * - Communication Module integration
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
    // TODO: Inject SendEmailService when ready
    // private readonly sendEmailService: SendEmailService, // From Communication Module
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
      },
    });

    if (!quote) {
      throw new NotFoundException(`Quote ${quoteId} not found`);
    }

    if (quote.status !== 'ready') {
      throw new BadRequestException(
        `Quote must be in 'ready' status to send. Current status: ${quote.status}`,
      );
    }

    // 2. Determine recipient email
    const leadPrimaryEmail = quote.lead?.emails?.[0]?.email;
    const recipientEmail = dto.recipient_email || leadPrimaryEmail;
    if (!recipientEmail) {
      throw new BadRequestException('No recipient email found. Please provide recipient_email.');
    }

    // 3. Generate PDF if needed
    this.logger.log(`Generating PDF for quote ${quoteId}...`);
    const pdfResult = await this.pdfService.generatePdf(tenantId, quoteId, userId);

    // 4. Generate public URL if needed
    this.logger.log(`Generating public URL for quote ${quoteId}...`);
    const publicUrlResult = await this.publicAccessService.generatePublicUrl(
      tenantId,
      quoteId,
      {},
      userId,
    );

    // 5. TODO: Send email via Communication Module
    // For now, we just log that email would be sent
    this.logger.log(
      `Email would be sent to ${recipientEmail} with PDF ${pdfResult.file_id} and public URL ${publicUrlResult.public_url}`,
    );

    // 6. Update quote status to 'sent' (already done by public URL generation)
    // Status automation happens in publicAccessService.generatePublicUrl

    // 7. Return success response
    return {
      success: true,
      message: `Quote email prepared successfully (email integration pending)`,
      public_url: publicUrlResult.public_url,
      pdf_file_id: pdfResult.file_id,
      email_id: 'pending-integration',
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
