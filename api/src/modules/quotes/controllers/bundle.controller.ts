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
import { BundleService } from '../services/bundle.service';
import {
  CreateBundleDto,
  UpdateBundleDto,
  UpdateBundleItemDto,
  BundleItemDto,
  ListBundlesDto,
} from '../dto/bundle';

@ApiTags('Quotes - Bundles')
@ApiBearerAuth()
@Controller('bundles')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BundleController {
  private readonly logger = new Logger(BundleController.name);

  constructor(private readonly bundleService: BundleService) {}

  // ========== BUNDLE CRUD ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Create a new bundle with items' })
  @ApiResponse({ status: 201, description: 'Bundle created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or validation error' })
  async create(@Request() req, @Body() createBundleDto: CreateBundleDto) {
    return this.bundleService.create(
      req.user.tenant_id,
      req.user.id,
      createBundleDto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get all bundles with item counts' })
  @ApiResponse({ status: 200, description: 'Bundles retrieved successfully' })
  async findAll(@Request() req, @Query() listBundlesDto: ListBundlesDto) {
    return this.bundleService.findAll(req.user.tenant_id, listBundlesDto);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get a single bundle with all items' })
  @ApiParam({ name: 'id', description: 'Bundle UUID' })
  @ApiResponse({ status: 200, description: 'Bundle retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bundleService.findOne(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Update bundle metadata',
    description: 'Updates bundle name, description, discount. Use item endpoints to modify items.',
  })
  @ApiParam({ name: 'id', description: 'Bundle UUID' })
  @ApiResponse({ status: 200, description: 'Bundle updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or validation error' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateBundleDto: UpdateBundleDto,
  ) {
    return this.bundleService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      updateBundleDto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete bundle and all its items',
    description: 'Cascades to delete all associated items',
  })
  @ApiParam({ name: 'id', description: 'Bundle UUID' })
  @ApiResponse({ status: 204, description: 'Bundle deleted successfully' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bundleService.delete(req.user.tenant_id, id, req.user.id);
  }

  // ========== BUNDLE ITEM OPERATIONS ==========

  @Post(':id/items')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Add item to bundle' })
  @ApiParam({ name: 'id', description: 'Bundle UUID' })
  @ApiResponse({ status: 201, description: 'Item added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or validation error' })
  @ApiResponse({ status: 404, description: 'Bundle not found' })
  async addItem(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() bundleItemDto: BundleItemDto,
  ) {
    return this.bundleService.addItem(
      req.user.tenant_id,
      id,
      req.user.id,
      bundleItemDto,
    );
  }

  @Patch(':bundleId/items/:itemId')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update bundle item' })
  @ApiParam({ name: 'bundleId', description: 'Bundle UUID' })
  @ApiParam({ name: 'itemId', description: 'Item UUID' })
  @ApiResponse({ status: 200, description: 'Item updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or validation error' })
  @ApiResponse({ status: 404, description: 'Bundle or item not found' })
  async updateItem(
    @Request() req,
    @Param('bundleId', ParseUUIDPipe) bundleId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() updateBundleItemDto: UpdateBundleItemDto,
  ) {
    return this.bundleService.updateItem(
      req.user.tenant_id,
      bundleId,
      itemId,
      req.user.id,
      updateBundleItemDto,
    );
  }

  @Delete(':bundleId/items/:itemId')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete bundle item',
    description: 'Cannot delete last item - bundle must have at least one item',
  })
  @ApiParam({ name: 'bundleId', description: 'Bundle UUID' })
  @ApiParam({ name: 'itemId', description: 'Item UUID' })
  @ApiResponse({ status: 204, description: 'Item deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete last item' })
  @ApiResponse({ status: 404, description: 'Bundle or item not found' })
  async deleteItem(
    @Request() req,
    @Param('bundleId', ParseUUIDPipe) bundleId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.bundleService.deleteItem(
      req.user.tenant_id,
      bundleId,
      itemId,
      req.user.id,
    );
  }
}
