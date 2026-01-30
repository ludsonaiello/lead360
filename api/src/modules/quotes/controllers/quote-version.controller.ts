import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuoteVersionService } from '../services/quote-version.service';
import { QuoteVersionComparisonService } from '../services/quote-version-comparison.service';
import { RestoreVersionDto } from '../dto/version';

@ApiTags('Quotes - Version History')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteVersionController {
  private readonly logger = new Logger(QuoteVersionController.name);

  constructor(
    private readonly versionService: QuoteVersionService,
    private readonly comparisonService: QuoteVersionComparisonService,
  ) {}

  // ========== VERSION HISTORY ENDPOINTS ==========

  @Get('quotes/:quoteId/versions')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({
    summary: 'List all versions for quote (ordered by date descending)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of all versions with snapshots',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async listVersions(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.versionService.getVersionHistory(quoteId);
  }

  @Get('quotes/:quoteId/versions/compare')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({
    summary:
      'Compare two versions (shows detailed diff of items, groups, settings, totals)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiQuery({
    name: 'from',
    description: 'Source version number (e.g., "1.0")',
    example: '1.0',
  })
  @ApiQuery({
    name: 'to',
    description: 'Target version number (e.g., "1.5")',
    example: '1.5',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed comparison with added/removed/modified items',
  })
  @ApiResponse({ status: 404, description: 'Quote or version not found' })
  @ApiResponse({
    status: 400,
    description: 'Invalid version numbers',
  })
  async compareVersions(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Query('from') fromVersion: string,
    @Query('to') toVersion: string,
  ) {
    return this.comparisonService.compareVersions(
      quoteId,
      fromVersion,
      toVersion,
      req.user.tenant_id,
    );
  }

  @Get('quotes/:quoteId/versions/:versionId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({
    summary: 'Get specific version by UUID (includes full snapshot)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'versionId', description: 'Version UUID' })
  @ApiResponse({
    status: 200,
    description: 'Version details with parsed snapshot',
  })
  @ApiResponse({ status: 404, description: 'Version not found' })
  async getVersion(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('versionId', ParseUUIDPipe) versionId: string,
  ) {
    return this.versionService.getVersion(versionId);
  }

  @Post('quotes/:quoteId/versions/:versionNumber/restore')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary:
      'Restore quote to previous version (creates backup first, then recreates from snapshot)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({
    name: 'versionNumber',
    description: 'Version number to restore (e.g., "1.0")',
    example: '1.0',
  })
  @ApiResponse({
    status: 201,
    description: 'Quote restored successfully',
  })
  @ApiResponse({ status: 404, description: 'Quote or version not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot restore approved quote',
  })
  async restoreVersion(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('versionNumber') versionNumber: string,
    @Body() dto: RestoreVersionDto,
  ) {
    return this.comparisonService.restoreVersion(
      quoteId,
      versionNumber,
      req.user.tenant_id,
      req.user.id,
      dto.reason,
    );
  }

  @Get('quotes/:quoteId/versions/timeline')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({
    summary: 'Get version history timeline grouped by date (for UI display)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Timeline with versions grouped by date',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async getTimeline(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.comparisonService.getVersionTimeline(
      quoteId,
      req.user.tenant_id,
    );
  }

  @Get('quotes/:quoteId/versions/:versionNumber/summary')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({
    summary:
      'Get human-readable change summary for version (compares to previous version)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({
    name: 'versionNumber',
    description: 'Version number (e.g., "1.5")',
    example: '1.5',
  })
  @ApiResponse({
    status: 200,
    description: 'Change summary with bullet points',
  })
  @ApiResponse({ status: 404, description: 'Quote or version not found' })
  async getChangeSummary(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('versionNumber') versionNumber: string,
  ) {
    return this.comparisonService.getChangeSummary(
      quoteId,
      versionNumber,
      req.user.tenant_id,
    );
  }
}
