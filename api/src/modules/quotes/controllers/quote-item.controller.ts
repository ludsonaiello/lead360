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
import { QuoteItemService } from '../services/quote-item.service';
import {
  CreateItemDto,
  UpdateItemDto,
  ReorderItemsDto,
  MoveItemToGroupDto,
} from '../dto/item';

@ApiTags('Quotes - Items')
@ApiBearerAuth()
@Controller('quotes/:quoteId/items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteItemController {
  private readonly logger = new Logger(QuoteItemController.name);

  constructor(private readonly quoteItemService: QuoteItemService) {}

  // ========== QUOTE ITEM CRUD ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Add item to quote' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({ status: 201, description: 'Item added successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({
    status: 400,
    description: 'At least one cost must be > 0 / Cannot add items to approved quote',
  })
  async create(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.quoteItemService.create(
      req.user.tenant_id,
      quoteId,
      req.user.id,
      dto,
    );
  }

  @Post('from-library/:libraryItemId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Add item to quote from library (increments usage count)' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'libraryItemId', description: 'Library item UUID' })
  @ApiResponse({ status: 201, description: 'Item added from library successfully' })
  @ApiResponse({ status: 404, description: 'Quote or library item not found' })
  async createFromLibrary(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('libraryItemId', ParseUUIDPipe) libraryItemId: string,
  ) {
    return this.quoteItemService.createFromLibrary(
      req.user.tenant_id,
      quoteId,
      req.user.id,
      libraryItemId,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List items for quote' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiQuery({
    name: 'includeGrouped',
    required: false,
    type: Boolean,
    description: 'Include items that belong to groups (default: true)',
  })
  @ApiResponse({ status: 200, description: 'Items retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async findAll(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Query('includeGrouped', new ParseBoolPipe({ optional: true }))
    includeGrouped?: boolean,
  ) {
    return this.quoteItemService.findAll(
      req.user.tenant_id,
      quoteId,
      includeGrouped ?? true,
    );
  }

  @Get(':itemId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get single item with relationships' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'itemId', description: 'Item UUID' })
  @ApiResponse({ status: 200, description: 'Item retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Quote or item not found' })
  async findOne(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.quoteItemService.findOne(req.user.tenant_id, quoteId, itemId);
  }

  @Patch('reorder')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reorder items (no version created - cosmetic only)' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({ status: 204, description: 'Items reordered successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async reorder(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: ReorderItemsDto,
  ) {
    await this.quoteItemService.reorder(req.user.tenant_id, quoteId, dto);
  }

  @Patch(':itemId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Update item (creates version +0.1)' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'itemId', description: 'Item UUID' })
  @ApiResponse({ status: 200, description: 'Item updated successfully' })
  @ApiResponse({ status: 404, description: 'Quote or item not found' })
  @ApiResponse({ status: 400, description: 'Cannot edit items in approved quote' })
  async update(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.quoteItemService.update(
      req.user.tenant_id,
      quoteId,
      itemId,
      req.user.id,
      dto,
    );
  }

  @Delete(':itemId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete item (hard delete, reorders remaining)' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'itemId', description: 'Item UUID' })
  @ApiResponse({ status: 204, description: 'Item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Quote or item not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete items from approved quote' })
  async delete(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    await this.quoteItemService.delete(
      req.user.tenant_id,
      quoteId,
      itemId,
      req.user.id,
    );
  }

  @Post(':itemId/duplicate')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Duplicate item (inserts after original with " (Copy)")' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'itemId', description: 'Item UUID to duplicate' })
  @ApiResponse({ status: 201, description: 'Item duplicated successfully' })
  @ApiResponse({ status: 404, description: 'Quote or item not found' })
  @ApiResponse({ status: 400, description: 'Cannot duplicate items in approved quote' })
  async duplicate(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.quoteItemService.duplicate(
      req.user.tenant_id,
      quoteId,
      itemId,
      req.user.id,
    );
  }

  @Patch(':itemId/move-to-group')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Move item to group or ungrouped (creates version +0.1)' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'itemId', description: 'Item UUID' })
  @ApiResponse({ status: 200, description: 'Item moved successfully' })
  @ApiResponse({ status: 404, description: 'Quote, item, or target group not found' })
  @ApiResponse({ status: 400, description: 'Cannot move items in approved quote' })
  async moveToGroup(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: MoveItemToGroupDto,
  ) {
    return this.quoteItemService.moveToGroup(
      req.user.tenant_id,
      quoteId,
      itemId,
      req.user.id,
      dto,
    );
  }

  @Post(':itemId/save-to-library')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Save item to library for future reuse' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'itemId', description: 'Item UUID' })
  @ApiResponse({ status: 201, description: 'Item saved to library successfully' })
  @ApiResponse({ status: 404, description: 'Quote or item not found' })
  async saveToLibrary(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.quoteItemService.saveToLibrary(
      req.user.tenant_id,
      quoteId,
      itemId,
      req.user.id,
    );
  }
}
