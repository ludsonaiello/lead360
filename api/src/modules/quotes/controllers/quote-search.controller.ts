import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuoteSearchService } from '../services/quote-search.service';
import {
  AdvancedSearchDto,
  AdvancedSearchResponseDto,
  GetSuggestionsDto,
  SuggestionsResponseDto,
  SaveSearchDto,
  SavedSearchDto,
  SavedSearchesResponseDto,
} from '../dto/search';

/**
 * QuoteSearchController
 *
 * Advanced search functionality (4 endpoints)
 *
 * @author Developer 5
 */
@ApiTags('Quotes - Search')
@ApiBearerAuth()
@Controller('quotes/search')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteSearchController {
  private readonly logger = new Logger(QuoteSearchController.name);

  constructor(private readonly searchService: QuoteSearchService) {}

  @Get('advanced')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Advanced multi-field search' })
  @ApiResponse({
    status: 200,
    description: 'Search results returned',
    type: AdvancedSearchResponseDto,
  })
  async advancedSearch(
    @Query() dto: AdvancedSearchDto,
    @Request() req,
  ): Promise<AdvancedSearchResponseDto> {
    const tenantId = req.user.tenant_id;

    this.logger.log(
      `Advanced search for tenant ${tenantId}: ${JSON.stringify(dto)}`,
    );

    return await this.searchService.advancedSearch(tenantId, dto);
  }

  @Get('suggestions')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get autocomplete suggestions' })
  @ApiResponse({
    status: 200,
    description: 'Suggestions returned',
    type: SuggestionsResponseDto,
  })
  async getSuggestions(
    @Query() query: GetSuggestionsDto,
    @Request() req,
  ): Promise<SuggestionsResponseDto> {
    const tenantId = req.user.tenant_id;

    return await this.searchService.getSuggestions(
      tenantId,
      query.query,
      query.field || 'all',
      query.limit || 10,
    );
  }

  @Post('save')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Save search for reuse' })
  @ApiResponse({
    status: 201,
    description: 'Search saved',
    type: SavedSearchDto,
  })
  async saveSearch(
    @Body() dto: SaveSearchDto,
    @Request() req,
  ): Promise<SavedSearchDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    return await this.searchService.saveSearch(tenantId, userId, dto);
  }

  @Get('saved')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get saved searches' })
  @ApiResponse({
    status: 200,
    description: 'Saved searches returned',
    type: SavedSearchesResponseDto,
  })
  async getSavedSearches(@Request() req): Promise<SavedSearchesResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    return await this.searchService.getSavedSearches(tenantId, userId);
  }
}
