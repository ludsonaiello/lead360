import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuoteEmailService } from '../services/quote-email.service';
import {
  SendQuoteEmailDto,
  SendQuoteEmailResponseDto,
} from '../dto/email/send-quote-email.dto';

/**
 * QuoteEmailController
 *
 * Handles quote email delivery to customers
 *
 * Features:
 * - Sends quote via email with PDF attachment
 * - Generates public URL for online viewing
 * - Queues email via BullMQ for async delivery
 * - Tracks communication events
 * - Automatically changes quote status to 'sent'
 *
 * @author Backend Developer
 */
@ApiTags('Quotes - Email Delivery')
@ApiBearerAuth()
@Controller('quotes/:id')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteEmailController {
  private readonly logger = new Logger(QuoteEmailController.name);

  constructor(private readonly quoteEmailService: QuoteEmailService) {}

  @Post('send')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Send quote via email',
    description: `
Send quote to customer via email with PDF attachment and public viewing URL.

**Process:**
1. Validates quote status is 'ready'
2. Generates PDF if needed (or uses existing)
3. Generates public URL for online viewing
4. Sends email via Communication Module with PDF attached
5. Changes quote status from 'ready' to 'sent'
6. Creates communication event for tracking

**Email Template:**
- Uses 'send-quote' template
- Includes company branding
- Contains public URL button
- PDF attached automatically
- Optional custom message from sender

**Side Effects:**
- Quote status: ready → sent
- PDF generated and stored
- Public URL created
- Communication event logged
- Email queued via BullMQ
    `,
  })
  @ApiParam({
    name: 'id',
    description: 'Quote UUID',
    type: 'string',
    example: 'abc123-def456-789',
  })
  @ApiResponse({
    status: 200,
    description: 'Email sent successfully',
    type: SendQuoteEmailResponseDto,
    schema: {
      example: {
        success: true,
        message: 'Quote email sent successfully',
        public_url: 'https://acme.lead360.app/quotes/abc123token',
        pdf_file_id: 'pdf-file-abc-123',
        email_id: 'event-abc-123',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Quote must be in ready status / No recipient email found',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async sendQuote(
    @Request() req,
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Body() dto: SendQuoteEmailDto,
  ): Promise<SendQuoteEmailResponseDto> {
    this.logger.log(
      `Sending quote ${quoteId} to ${dto.recipient_email || 'lead primary email'} (tenant: ${req.user.tenant_id})`,
    );

    return this.quoteEmailService.sendQuoteEmail(
      req.user.tenant_id,
      req.user.id,
      quoteId,
      dto,
    );
  }
}
