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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { QuotePublicAccessService } from '../services/quote-public-access.service';
import { QuoteViewTrackingService } from '../services/quote-view-tracking.service';
import { ValidatePasswordDto } from '../dto/public/validate-password.dto';
import {
  LogViewDto,
  LogDownloadDto,
  PublicQuoteResponseDto,
} from '../dto/public/public-quote-response.dto';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../auth/decorators/public.decorator';

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
@Public() // Skip global JWT authentication for all endpoints in this controller
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
  @ApiHeader({
    name: 'X-Password',
    required: false,
    description: 'Password for protected quotes',
  })
  @ApiResponse({ status: 200, description: 'Quote data returned' })
  @ApiResponse({ status: 403, description: 'Invalid password' })
  @ApiResponse({ status: 404, description: 'Token not found or inactive' })
  @ApiResponse({
    status: 410,
    description: 'Quote expired or no longer available',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many failed attempts (locked out)',
  })
  async getPublicQuote(
    @Param('token') token: string,
    @Headers('x-password') password: string | undefined,
    @Ip() ipAddress: string,
  ): Promise<PublicQuoteResponseDto> {
    this.logger.log(
      `Public quote access attempt for token: ${token} from IP: ${ipAddress}`,
    );

    // 1. Check lockout status
    const lockoutStatus = await this.publicAccessService.checkLockout(
      token,
      ipAddress,
    );
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

      const validation = await this.publicAccessService.validatePassword(
        token,
        password,
        ipAddress,
      );
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

    this.logger.log(
      `Successfully served public quote ${publicAccess.quote.id} via token ${token}`,
    );

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
    this.logger.log(
      `Password validation attempt for token: ${token} from IP: ${ipAddress}`,
    );

    const result = await this.publicAccessService.validatePassword(
      token,
      dto.password,
      ipAddress,
    );

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

  @Post(':token/download')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log quote PDF download (NO AUTH)' })
  @ApiParam({ name: 'token', description: '32-char access token' })
  @ApiResponse({ status: 204, description: 'Download logged successfully' })
  async logDownload(
    @Param('token') token: string,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
    @Body() dto: LogDownloadDto,
  ) {
    this.logger.log(
      `Logging PDF download for token: ${token} from IP: ${ipAddress}`,
    );

    await this.viewTrackingService.logDownload(
      token,
      ipAddress,
      userAgent,
      dto.file_id,
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
            id: quote.lead.id,
            first_name: quote.lead.first_name,
            last_name: quote.lead.last_name,
            emails:
              quote.lead.emails?.map((e: any) => ({
                id: e.id,
                email: e.email,
                is_primary: e.is_primary,
              })) || [],
            phones:
              quote.lead.phones?.map((p: any) => ({
                id: p.id,
                phone: p.phone,
                phone_type: p.phone_type,
                is_primary: p.is_primary,
              })) || [],
          }
        : undefined,
      jobsite_address: quote.jobsite_address
        ? {
            id: quote.jobsite_address.id,
            address_line1: quote.jobsite_address.address_line1,
            address_line2: quote.jobsite_address.address_line2,
            city: quote.jobsite_address.city,
            state: quote.jobsite_address.state,
            zip_code: quote.jobsite_address.zip_code,
            latitude: parseFloat(quote.jobsite_address.latitude.toString()),
            longitude: parseFloat(quote.jobsite_address.longitude.toString()),
            google_place_id: quote.jobsite_address.google_place_id,
          }
        : undefined,
      vendor: quote.vendor
        ? {
            name: quote.vendor.name,
            phone: quote.vendor.phone,
            email: quote.vendor.email,
            website: quote.vendor.website,
            address_line1: quote.vendor.address_line1,
            address_line2: quote.vendor.address_line2,
            city: quote.vendor.city,
            state: quote.vendor.state,
            zip_code: quote.vendor.zip_code,
            signature_file_id: quote.vendor.signature_file?.file_id, // Storage file ID
            signature_url: quote.vendor.signature_file?.url,
          }
        : undefined,
      items:
        quote.items?.map((item: any) => ({
          id: item.id,
          title: item.title,
          description: item.description,
          quantity: parseFloat(item.quantity.toString()),
          unit: item.unit_measurement?.name || 'unit',
          material_cost_per_unit: parseFloat(
            item.material_cost_per_unit?.toString() || '0',
          ),
          labor_cost_per_unit: parseFloat(
            item.labor_cost_per_unit?.toString() || '0',
          ),
          equipment_cost_per_unit: parseFloat(
            item.equipment_cost_per_unit?.toString() || '0',
          ),
          subcontract_cost_per_unit: parseFloat(
            item.subcontract_cost_per_unit?.toString() || '0',
          ),
          other_cost_per_unit: parseFloat(
            item.other_cost_per_unit?.toString() || '0',
          ),
          total_cost: parseFloat(item.total_cost?.toString() || '0'),
          custom_markup_percent: item.custom_markup_percent
            ? parseFloat(item.custom_markup_percent.toString())
            : undefined,
          custom_discount_amount: item.custom_discount_amount
            ? parseFloat(item.custom_discount_amount.toString())
            : undefined,
          custom_tax_rate: item.custom_tax_rate
            ? parseFloat(item.custom_tax_rate.toString())
            : undefined,
          group: item.quote_group
            ? {
                id: item.quote_group.id,
                name: item.quote_group.name,
                description: item.quote_group.description,
                display_order: item.quote_group.order_index,
              }
            : undefined,
          display_order: item.order_index,
          is_optional: item.is_optional,
        })) || [],
      branding: {
        company_name: quote.tenant.company_name,
        logo_file_id: quote.tenant.file_tenant_logo_file_idTofile?.file_id, // Storage file ID
        logo_url: quote.tenant.file_tenant_logo_file_idTofile?.url,
        primary_color: quote.tenant.primary_brand_color,
        secondary_color: quote.tenant.secondary_brand_color,
        accent_color: quote.tenant.accent_color,
        phone: quote.tenant.primary_contact_phone,
        email: quote.tenant.primary_contact_email,
        website: quote.tenant.website_url,
        address: quote.tenant.tenant_address?.[0]
          ? {
              line1: quote.tenant.tenant_address[0].line1,
              line2: quote.tenant.tenant_address[0].line2,
              city: quote.tenant.tenant_address[0].city,
              state: quote.tenant.tenant_address[0].state,
              zip_code: quote.tenant.tenant_address[0].zip_code,
              country: quote.tenant.tenant_address[0].country,
            }
          : undefined,
        social_media: {
          instagram: quote.tenant.instagram_url,
          facebook: quote.tenant.facebook_url,
          tiktok: quote.tenant.tiktok_url,
          youtube: quote.tenant.youtube_url,
        },
      },
      cover_page_image_url: quote.cover_page_image_url,
      attachments: quote.attachments?.map((att: any) => {
        // Build file URL from storage_path (same logic as quote-attachment.service.ts)
        let fileUrl: string | undefined;
        if (att.file?.storage_path) {
          const appUrl = process.env.APP_URL || 'https://app.lead360.app';
          let relativePath = att.file.storage_path;

          // Extract the relative path from storage_path
          if (relativePath.includes('/uploads/public/')) {
            const parts = relativePath.split('/uploads/public/');
            relativePath = `/public/${parts[1]}`;
          }

          // If it starts with /public/, prepend /uploads
          if (relativePath.startsWith('/public/')) {
            relativePath = `/uploads${relativePath}`;
          }

          fileUrl = `${appUrl}${relativePath}`;
        }

        return {
          id: att.id,
          file_id: att.file_id, // Storage file ID
          title: att.title,
          attachment_type: att.attachment_type,
          filename: att.file?.original_filename,
          url: att.url || fileUrl, // Use url field if it's a url_attachment, otherwise use constructed file URL
          mime_type: att.file?.mime_type,
          file_size: att.file?.size_bytes,
          order_index: att.order_index,
        };
      }),
      public_notes: undefined, // No public_notes field in schema
      terms_and_conditions:
        quote.custom_terms || quote.tenant.default_quote_terms,
      payment_instructions:
        quote.custom_payment_instructions ||
        quote.tenant.default_payment_instructions,
      po_number: quote.po_number,
      discount_rules: quote.discount_rules?.map((rule: any) => ({
        id: rule.id,
        name: rule.name,
        discount_type: rule.discount_type,
        discount_value: parseFloat(rule.discount_value?.toString() || '0'),
        applies_to_item_id: rule.applies_to_item_id,
        order_index: rule.order_index,
      })),
      draw_schedule: quote.draw_schedule?.map((entry: any) => {
        const value = parseFloat(entry.value?.toString() || '0');
        const total = parseFloat(quote.total?.toString() || '0');

        // Calculate both percentage and amount based on calculation_type
        let percentage: number;
        let amount: number;

        if (entry.calculation_type === 'percentage') {
          percentage = value;
          amount = (total * value) / 100;
        } else {
          // fixed_amount
          amount = value;
          percentage = total > 0 ? (value / total) * 100 : 0;
        }

        return {
          id: entry.id,
          draw_number: entry.draw_number,
          name: entry.description, // Schema has 'description', not 'name'
          description: entry.description,
          calculation_type: entry.calculation_type,
          value: value,
          percentage: percentage,
          amount: amount,
          order_index: entry.order_index,
        };
      }),
      pdf: quote.latest_pdf_file
        ? {
            file_id: quote.latest_pdf_file.file_id, // Storage file ID, not database ID
            url: quote.latest_pdf_file.url,
            content_hash: quote.pdf_content_hash,
            last_generated_at: quote.pdf_last_generated_at?.toISOString(),
            generation_params: quote.pdf_generation_params,
            filename: quote.latest_pdf_file.original_filename,
            mime_type: quote.latest_pdf_file.mime_type,
            file_size: quote.latest_pdf_file.file_size,
          }
        : undefined,
    };
  }
}
