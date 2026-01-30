import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseBoolPipe,
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
import { QuoteTagService } from '../services/quote-tag.service';
import {
  CreateQuoteTagDto,
  UpdateQuoteTagDto,
  QuoteTagResponseDto,
  AssignTagDto,
} from '../dto/tag';

/**
 * QuoteTagController
 *
 * Manages quote tags for organizing and categorizing quotes
 *
 * Endpoints:
 * - POST   /tags                    - Create tag
 * - GET    /tags                    - List tags
 * - GET    /tags/:id                - Get tag
 * - PATCH  /tags/:id                - Update tag
 * - DELETE /tags/:id                - Delete tag (only if unused)
 * - POST   /quotes/:id/tags         - Assign tags to quote
 * - DELETE /quotes/:id/tags/:tagId  - Remove tag from quote
 * - GET    /quotes/:id/tags         - List quote tags
 *
 * @author Backend Developer
 */
@ApiTags('Quotes - Tags')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteTagController {
  private readonly logger = new Logger(QuoteTagController.name);

  constructor(private readonly tagService: QuoteTagService) {}

  // ========== TAG CRUD ==========

  @Post('tags')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Create quote tag',
    description: 'Creates a new tag for organizing quotes. Tag names must be unique per tenant (case-insensitive).',
  })
  @ApiResponse({
    status: 201,
    description: 'Tag created successfully',
    type: QuoteTagResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Tag name already exists' })
  async createTag(
    @Request() req,
    @Body() dto: CreateQuoteTagDto,
  ): Promise<QuoteTagResponseDto> {
    this.logger.log(`Creating tag "${dto.name}" (tenant: ${req.user.tenant_id})`);
    return this.tagService.createTag(req.user.tenant_id, dto, req.user.id);
  }

  @Get('tags')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'List all tags',
    description: 'Returns all tags for the tenant, ordered by name',
  })
  @ApiQuery({
    name: 'include_inactive',
    required: false,
    type: Boolean,
    description: 'Include inactive tags (default: false)',
  })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: [QuoteTagResponseDto],
  })
  async listTags(
    @Request() req,
    @Query('include_inactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
  ): Promise<QuoteTagResponseDto[]> {
    this.logger.log(`Listing tags (tenant: ${req.user.tenant_id})`);
    return this.tagService.listTags(req.user.tenant_id, includeInactive || false);
  }

  @Get('tags/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get tag by ID' })
  @ApiParam({ name: 'id', description: 'Tag UUID' })
  @ApiResponse({
    status: 200,
    description: 'Tag retrieved successfully',
    type: QuoteTagResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  async getTag(
    @Request() req,
    @Param('id', ParseUUIDPipe) tagId: string,
  ): Promise<QuoteTagResponseDto> {
    this.logger.log(`Getting tag ${tagId} (tenant: ${req.user.tenant_id})`);
    return this.tagService.getTag(req.user.tenant_id, tagId);
  }

  @Patch('tags/:id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Update tag',
    description: 'Updates tag name, color, or active status',
  })
  @ApiParam({ name: 'id', description: 'Tag UUID' })
  @ApiResponse({
    status: 200,
    description: 'Tag updated successfully',
    type: QuoteTagResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  @ApiResponse({ status: 409, description: 'Tag name already exists' })
  async updateTag(
    @Request() req,
    @Param('id', ParseUUIDPipe) tagId: string,
    @Body() dto: UpdateQuoteTagDto,
  ): Promise<QuoteTagResponseDto> {
    this.logger.log(`Updating tag ${tagId} (tenant: ${req.user.tenant_id})`);
    return this.tagService.updateTag(req.user.tenant_id, tagId, dto, req.user.id);
  }

  @Delete('tags/:id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete tag',
    description: 'Deletes tag only if not assigned to any quote. Otherwise, mark as inactive.',
  })
  @ApiParam({ name: 'id', description: 'Tag UUID' })
  @ApiResponse({ status: 204, description: 'Tag deleted successfully' })
  @ApiResponse({ status: 404, description: 'Tag not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete tag assigned to quotes (mark inactive instead)',
  })
  async deleteTag(
    @Request() req,
    @Param('id', ParseUUIDPipe) tagId: string,
  ): Promise<void> {
    this.logger.log(`Deleting tag ${tagId} (tenant: ${req.user.tenant_id})`);
    await this.tagService.deleteTag(req.user.tenant_id, tagId, req.user.id);
  }

  // ========== QUOTE TAG ASSIGNMENT ==========

  @Post('quotes/:id/tags')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Assign tags to quote',
    description: 'Assigns one or more tags to a quote. Replaces existing tag assignments.',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Tags assigned successfully',
    type: [QuoteTagResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Quote or tag not found' })
  async assignTagsToQuote(
    @Request() req,
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Body() dto: AssignTagDto,
  ): Promise<QuoteTagResponseDto[]> {
    this.logger.log(`Assigning tags to quote ${quoteId} (tenant: ${req.user.tenant_id})`);
    return this.tagService.assignTagsToQuote(
      req.user.tenant_id,
      quoteId,
      dto,
      req.user.id,
    );
  }

  @Delete('quotes/:id/tags/:tagId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove tag from quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiParam({ name: 'tagId', description: 'Tag UUID to remove' })
  @ApiResponse({ status: 204, description: 'Tag removed successfully' })
  @ApiResponse({ status: 404, description: 'Quote or assignment not found' })
  async removeTagFromQuote(
    @Request() req,
    @Param('id', ParseUUIDPipe) quoteId: string,
    @Param('tagId', ParseUUIDPipe) tagId: string,
  ): Promise<void> {
    this.logger.log(
      `Removing tag ${tagId} from quote ${quoteId} (tenant: ${req.user.tenant_id})`,
    );
    await this.tagService.removeTagFromQuote(
      req.user.tenant_id,
      quoteId,
      tagId,
      req.user.id,
    );
  }

  @Get('quotes/:id/tags')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get tags assigned to quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Tags retrieved successfully',
    type: [QuoteTagResponseDto],
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async getQuoteTags(
    @Request() req,
    @Param('id', ParseUUIDPipe) quoteId: string,
  ): Promise<QuoteTagResponseDto[]> {
    this.logger.log(`Getting tags for quote ${quoteId} (tenant: ${req.user.tenant_id})`);
    return this.tagService.getQuoteTags(req.user.tenant_id, quoteId);
  }
}
