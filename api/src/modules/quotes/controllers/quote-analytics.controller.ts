import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuotePublicAccessService } from '../services/quote-public-access.service';
import { QuoteViewTrackingService } from '../services/quote-view-tracking.service';
import { GeneratePublicUrlDto, PublicUrlResponseDto } from '../dto/public/generate-public-url.dto';
import { ViewAnalyticsDto, ViewHistoryResponseDto, GetViewHistoryDto, AnonymizeViewsResponseDto } from '../dto/analytics';

/**
 * QuoteAnalyticsController
 *
 * Public URL management and view tracking analytics
 *
 * @author Developer 5
 */
@ApiTags('Quotes - Analytics & Public Access')
@ApiBearerAuth()
@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteAnalyticsController {
  private readonly logger = new Logger(QuoteAnalyticsController.name);

  constructor(
    private readonly publicAccessService: QuotePublicAccessService,
    private readonly viewTrackingService: QuoteViewTrackingService,
  ) {}

  // ========== PUBLIC URL MANAGEMENT ==========

  @Post(':id/public-access')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate public URL for quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 201, description: 'Public URL generated', type: PublicUrlResponseDto })
  async generatePublicUrl(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GeneratePublicUrlDto,
    @Request() req,
  ): Promise<PublicUrlResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    this.logger.log(`Generating public URL for quote ${id} (tenant: ${tenantId})`);

    return await this.publicAccessService.generatePublicUrl(tenantId, id, dto, userId);
  }

  @Delete(':id/public-access')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate public URL' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'Public URL deactivated' })
  async deactivatePublicUrl(@Param('id', ParseUUIDPipe) id: string, @Request() req) {
    const tenantId = req.user.tenant_id;

    this.logger.log(`Deactivating public URL for quote ${id} (tenant: ${tenantId})`);

    return await this.publicAccessService.deactivatePublicUrl(tenantId, id);
  }

  // ========== VIEW TRACKING ==========

  @Get(':id/views/analytics')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get view analytics for quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'Analytics data returned', type: ViewAnalyticsDto })
  async getViewAnalytics(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ): Promise<ViewAnalyticsDto> {
    const tenantId = req.user.tenant_id;

    this.logger.log(`Getting view analytics for quote ${id} (tenant: ${tenantId})`);

    return await this.viewTrackingService.getAnalytics(tenantId, id);
  }

  @Get(':id/views/history')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get view history with pagination' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'View history returned', type: ViewHistoryResponseDto })
  async getViewHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: GetViewHistoryDto,
    @Request() req,
  ): Promise<ViewHistoryResponseDto> {
    const tenantId = req.user.tenant_id;
    const page = query.page || 1;
    const limit = query.limit || 20;

    this.logger.log(
      `Getting view history for quote ${id} (tenant: ${tenantId}, page: ${page}, limit: ${limit})`,
    );

    return await this.viewTrackingService.getViewHistory(tenantId, id, page, limit);
  }

  // ========== ADMIN: GDPR ANONYMIZATION ==========

  @Post('admin/anonymize-views')
  @Roles('PlatformAdmin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Anonymize view logs older than 90 days (GDPR)' })
  @ApiResponse({ status: 200, description: 'Views anonymized', type: AnonymizeViewsResponseDto })
  async anonymizeViews(@Request() req): Promise<AnonymizeViewsResponseDto> {
    this.logger.log('Anonymizing old view logs (GDPR compliance)');

    const count = await this.viewTrackingService.anonymizeOldViews();

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    return {
      anonymized_count: count,
      anonymized_at: new Date().toISOString(),
      cutoff_date: cutoffDate.toISOString(),
    };
  }
}
