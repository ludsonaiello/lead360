import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Headers,
  Ip,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiHeader } from '@nestjs/swagger';
import { QuotePublicAccessService } from '../services/quote-public-access.service';
import { QuoteViewTrackingService } from '../services/quote-view-tracking.service';
import { ValidatePasswordDto } from '../dto/public/validate-password.dto';
import { LogViewDto, PublicQuoteResponseDto } from '../dto/public/public-quote-response.dto';
import { Throttle } from '@nestjs/throttler';

/**
 * QuotePublicController
 *
 * PUBLIC endpoints (NO AUTHENTICATION REQUIRED)
 * Customers access quotes via shareable URLs
 *
 * Security:
 * - Rate limiting: 10 req/min per IP
 * - Token validation via PublicAccessGuard (Phase 2)
 * - Password validation via X-Password header
 * - Status validation (sent/read only)
 *
 * @author Developer 5
 */
@ApiTags('Public - Quote Access')
@Controller('public/quotes')
@Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
export class QuotePublicController {
  private readonly logger = new Logger(QuotePublicController.name);

  constructor(
    private readonly publicAccessService: QuotePublicAccessService,
    private readonly viewTrackingService: QuoteViewTrackingService,
  ) {}

  @Get(':token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'View quote via public URL (NO AUTH)' })
  @ApiParam({ name: 'token', description: '32-char access token' })
  @ApiHeader({ name: 'X-Password', required: false, description: 'Password for protected quotes' })
  @ApiResponse({ status: 200, description: 'Quote data returned' })
  @ApiResponse({ status: 403, description: 'Invalid password' })
  @ApiResponse({ status: 404, description: 'Token not found or inactive' })
  @ApiResponse({ status: 410, description: 'Quote expired or no longer available' })
  @ApiResponse({ status: 429, description: 'Too many failed attempts (locked out)' })
  async getPublicQuote(
    @Param('token') token: string,
    @Headers('x-password') password: string | undefined,
    @Ip() ipAddress: string,
  ): Promise<PublicQuoteResponseDto> {
    this.logger.log(`Public quote access attempt for token: ${token} from IP: ${ipAddress}`);

    // 1. Check lockout status
    const lockoutStatus = await this.publicAccessService.checkLockout(token, ipAddress);
    if (lockoutStatus.is_locked) {
      this.logger.warn(`IP ${ipAddress} is locked out for token ${token}`);
      throw new ForbiddenException({
        message: 'Too many failed attempts. Please try again later.',
        lockout_expires_at: lockoutStatus.lockout_expires_at,
      });
    }

    // 2. Get public access record with quote data
    const publicAccess = await this.publicAccessService.getByToken(token);

    // 3. If password protected, validate password
    if (publicAccess.password_hash) {
      if (!password) {
        throw new ForbiddenException({
          message: 'This quote is password protected',
          password_hint: publicAccess.password_hint,
          requires_password: true,
        });
      }

      const validation = await this.publicAccessService.validatePassword(token, password, ipAddress);
      if (!validation.valid) {
        throw new ForbiddenException({
          message: validation.message,
          failed_attempts: validation.failed_attempts,
          is_locked: validation.is_locked,
          lockout_expires_at: validation.lockout_expires_at,
        });
      }
    }

    // 4. Transform quote data to public DTO (exclude private info)
    const publicQuote = this.transformToPublicDto(publicAccess.quote);

    this.logger.log(`Successfully served public quote ${publicAccess.quote.id} via token ${token}`);

    return publicQuote;
  }

  @Post(':token/validate-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Validate password before showing quote (NO AUTH)' })
  @ApiParam({ name: 'token', description: '32-char access token' })
  @ApiResponse({ status: 200, description: 'Password validation result' })
  async validatePassword(
    @Param('token') token: string,
    @Body() dto: ValidatePasswordDto,
    @Ip() ipAddress: string,
  ) {
    this.logger.log(`Password validation attempt for token: ${token} from IP: ${ipAddress}`);

    const result = await this.publicAccessService.validatePassword(token, dto.password, ipAddress);

    if (!result.valid) {
      this.logger.warn(
        `Failed password attempt for token ${token} from IP ${ipAddress} (attempt ${result.failed_attempts})`,
      );
    }

    return result;
  }

  @Post(':token/view')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log quote view (NO AUTH)' })
  @ApiParam({ name: 'token', description: '32-char access token' })
  @ApiResponse({ status: 204, description: 'View logged successfully' })
  async logView(
    @Param('token') token: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Headers('referer') referrer: string | undefined,
    @Body() dto: LogViewDto,
  ) {
    this.logger.log(`Logging view for token: ${token} from IP: ${ipAddress}`);

    await this.viewTrackingService.logView(
      token,
      ipAddress,
      userAgent,
      dto.referrer_url || referrer,
      dto.duration_seconds,
    );

    // No response body for 204
  }

  /**
   * Transform full quote data to public DTO
   * Excludes sensitive information (private notes, costs, approval history)
   */
  private transformToPublicDto(quote: any): PublicQuoteResponseDto {
    return {
      id: quote.id,
      quote_number: quote.quote_number,
      title: quote.title,
      description: quote.description || undefined,
      status: quote.status,
      total_price: parseFloat(quote.total.toString()),
      subtotal: parseFloat(quote.subtotal.toString()),
      total_tax: parseFloat(quote.tax_amount.toString()),
      total_discount: parseFloat(quote.discount_amount.toString()),
      currency: 'USD', // TODO: Get from tenant settings
      valid_until: quote.expires_at?.toISOString(),
      created_at: quote.created_at.toISOString(),
      updated_at: quote.updated_at.toISOString(),
      customer: quote.lead
        ? {
            first_name: quote.lead.first_name,
            last_name: quote.lead.last_name,
            email: quote.lead.email,
            phone: quote.lead.phone,
            company_name: quote.lead.company_name,
          }
        : undefined,
      jobsite_address: quote.jobsite_address
        ? {
            street_address: quote.jobsite_address.street_address,
            city: quote.jobsite_address.city,
            state: quote.jobsite_address.state,
            zip_code: quote.jobsite_address.zip_code,
            country: quote.jobsite_address.country,
          }
        : undefined,
      vendor: quote.vendor
        ? {
            name: quote.vendor.name,
            phone: quote.vendor.phone,
            email: quote.vendor.email,
            website: quote.vendor.website,
          }
        : undefined,
      items: quote.items?.map((item: any) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        quantity: parseFloat(item.quantity.toString()),
        unit: item.unit_measurement?.name || 'unit',
        unit_price: parseFloat(item.unit_price?.toString() || '0'),
        total_price: parseFloat(item.total_price?.toString() || '0'),
        tax_amount: parseFloat(item.tax_amount?.toString() || '0'),
        discount_amount: parseFloat(item.discount_amount?.toString() || '0'),
        group: item.quote_group
          ? {
              id: item.quote_group.id,
              name: item.quote_group.name,
              display_order: item.quote_group.order_index,
            }
          : undefined,
        display_order: item.order_index,
        is_optional: item.is_optional,
        images: item.images?.map((img: any) => ({
          id: img.id,
          url: img.url,
          caption: img.caption,
        })),
      })) || [],
      branding: {
        company_name: quote.tenant.company_name,
        logo_url: quote.tenant.logo_url,
        primary_color: quote.tenant.primary_color,
        secondary_color: quote.tenant.secondary_color,
      },
      cover_page_image_url: quote.cover_page_image_url,
      attachments: quote.attachments?.map((att: any) => ({
        id: att.id,
        filename: att.filename,
        url: att.url,
        mime_type: att.mime_type,
        file_size: att.file_size,
      })),
      public_notes: quote.public_notes,
      terms_and_conditions: quote.terms_and_conditions,
    };
  }
}
