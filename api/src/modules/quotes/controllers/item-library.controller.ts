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
import { ItemLibraryService } from '../services/item-library.service';
import {
  CreateLibraryItemDto,
  UpdateLibraryItemDto,
  ListLibraryItemsDto,
  BulkImportLibraryDto,
} from '../dto/library';

@ApiTags('Quotes - Item Library')
@ApiBearerAuth()
@Controller('item-library')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ItemLibraryController {
  private readonly logger = new Logger(ItemLibraryController.name);

  constructor(private readonly itemLibraryService: ItemLibraryService) {}

  // ========== ITEM LIBRARY CRUD ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Create library item' })
  @ApiResponse({ status: 201, description: 'Library item created successfully' })
  @ApiResponse({
    status: 400,
    description: 'At least one cost must be > 0',
  })
  @ApiResponse({ status: 404, description: 'Unit measurement not found' })
  async create(@Request() req, @Body() dto: CreateLibraryItemDto) {
    return this.itemLibraryService.create(req.user.tenant_id, req.user.id, dto);
  }

  @Post('bulk-import')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Bulk import library items (transaction: all or nothing)',
  })
  @ApiResponse({
    status: 201,
    description: 'Library items imported successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed for one or more items',
  })
  async bulkImport(@Request() req, @Body() dto: BulkImportLibraryDto) {
    return this.itemLibraryService.bulkImport(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'List library items with filters (sorted by usage_count by default)',
  })
  @ApiResponse({ status: 200, description: 'Library items retrieved successfully' })
  async findAll(@Request() req, @Query() listDto: ListLibraryItemsDto) {
    return this.itemLibraryService.findAll(req.user.tenant_id, listDto);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get single library item' })
  @ApiParam({ name: 'id', description: 'Library item UUID' })
  @ApiResponse({ status: 200, description: 'Library item retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Library item not found' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.itemLibraryService.findOne(req.user.tenant_id, id);
  }

  @Get(':id/statistics')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get library item statistics (usage count, quotes, revenue)',
  })
  @ApiParam({ name: 'id', description: 'Library item UUID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Library item not found' })
  async getStatistics(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.itemLibraryService.getStatistics(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Update library item (only affects future uses, not existing quotes)',
  })
  @ApiParam({ name: 'id', description: 'Library item UUID' })
  @ApiResponse({ status: 200, description: 'Library item updated successfully' })
  @ApiResponse({ status: 404, description: 'Library item not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLibraryItemDto,
  ) {
    return this.itemLibraryService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  @Patch(':id/mark-inactive')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Mark library item as inactive (soft delete alternative)',
  })
  @ApiParam({ name: 'id', description: 'Library item UUID' })
  @ApiResponse({
    status: 200,
    description: 'Library item marked inactive successfully',
  })
  @ApiResponse({ status: 404, description: 'Library item not found' })
  async markInactive(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.itemLibraryService.markInactive(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete library item (only if usage_count = 0)',
  })
  @ApiParam({ name: 'id', description: 'Library item UUID' })
  @ApiResponse({ status: 204, description: 'Library item deleted successfully' })
  @ApiResponse({ status: 404, description: 'Library item not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot delete item with usage_count > 0',
  })
  async delete(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.itemLibraryService.delete(req.user.tenant_id, id, req.user.id);
  }
}
