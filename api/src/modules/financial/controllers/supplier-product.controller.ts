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
  ParseUUIDPipe,
  ForbiddenException,
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
import { SupplierProductService } from '../services/supplier-product.service';
import { CreateSupplierProductDto } from '../dto/create-supplier-product.dto';
import { UpdateSupplierProductDto } from '../dto/update-supplier-product.dto';

@ApiTags('Financial - Supplier Products')
@ApiBearerAuth()
@Controller('financial/suppliers/:supplierId/products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierProductController {
  constructor(
    private readonly supplierProductService: SupplierProductService,
  ) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List products for a supplier' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Filter by active status (default: true)' })
  @ApiResponse({ status: 200, description: 'Array of supplier products' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async findAll(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Query('is_active') isActive?: string,
  ) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.supplierProductService.findAll(
      req.user.tenant_id,
      supplierId,
      isActiveBool,
    );
  }

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Add a product to a supplier' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 409, description: 'Product name already exists for this supplier' })
  async create(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Body() dto: CreateSupplierProductDto,
  ) {
    return this.supplierProductService.create(
      req.user.tenant_id,
      supplierId,
      req.user.id,
      dto,
    );
  }

  @Patch(':productId')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a supplier product (price change triggers history)' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Product updated successfully' })
  @ApiResponse({ status: 404, description: 'Supplier or product not found' })
  @ApiResponse({ status: 409, description: 'Product name already exists for this supplier' })
  async update(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpdateSupplierProductDto,
  ) {
    return this.supplierProductService.update(
      req.user.tenant_id,
      supplierId,
      productId,
      req.user.id,
      dto,
    );
  }

  @Delete(':productId')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Delete a supplier product (soft by default, permanent with ?permanent=true — Owner/Admin only)' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiQuery({ name: 'permanent', required: false, type: Boolean, description: 'Set to true to permanently delete product and its price history (Owner/Admin only)' })
  @ApiResponse({ status: 200, description: 'Product deactivated or permanently deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions for permanent delete' })
  @ApiResponse({ status: 404, description: 'Supplier or product not found' })
  async delete(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('permanent') permanent?: string,
  ) {
    if (permanent === 'true') {
      // Hard delete restricted to Owner/Admin only
      const roles: string[] = req.user.roles || [];
      if (!roles.includes('Owner') && !roles.includes('Admin')) {
        throw new ForbiddenException(
          'Only Owner or Admin can permanently delete products.',
        );
      }
      return this.supplierProductService.hardDelete(
        req.user.tenant_id,
        supplierId,
        productId,
        req.user.id,
      );
    }
    return this.supplierProductService.softDelete(
      req.user.tenant_id,
      supplierId,
      productId,
      req.user.id,
    );
  }

  @Get(':productId/price-history')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get price change history for a product' })
  @ApiParam({ name: 'supplierId', description: 'Supplier UUID' })
  @ApiParam({ name: 'productId', description: 'Product UUID' })
  @ApiResponse({ status: 200, description: 'Price history ordered by most recent first' })
  @ApiResponse({ status: 404, description: 'Supplier or product not found' })
  async getPriceHistory(
    @Request() req,
    @Param('supplierId', ParseUUIDPipe) supplierId: string,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.supplierProductService.getPriceHistory(
      req.user.tenant_id,
      supplierId,
      productId,
    );
  }
}
