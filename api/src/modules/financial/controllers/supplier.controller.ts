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
import { SupplierService } from '../services/supplier.service';
import { CreateSupplierDto } from '../dto/create-supplier.dto';
import { UpdateSupplierDto } from '../dto/update-supplier.dto';
import { ListSuppliersDto } from '../dto/list-suppliers.dto';

@ApiTags('Financial - Suppliers')
@ApiBearerAuth()
@Controller('financial/suppliers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierController {
  constructor(private readonly supplierService: SupplierService) {}

  // ========== LIST ==========

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List suppliers with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of suppliers' })
  async findAll(
    @Request() req,
    @Query() query: ListSuppliersDto,
  ) {
    return this.supplierService.findAll(req.user.tenant_id, query);
  }

  // ========== CREATE ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Create a new supplier' })
  @ApiResponse({ status: 201, description: 'Supplier created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid category IDs' })
  @ApiResponse({ status: 409, description: 'Supplier name already exists for this tenant' })
  @ApiResponse({ status: 422, description: 'Google Places address resolution failed' })
  async create(
    @Request() req,
    @Body() dto: CreateSupplierDto,
  ) {
    return this.supplierService.create(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  // ========== MAP (MUST be before :id route) ==========

  @Get('map')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get all active suppliers with lat/lng for map rendering' })
  @ApiResponse({ status: 200, description: 'Array of suppliers with coordinates' })
  async findForMap(@Request() req) {
    return this.supplierService.findForMap(req.user.tenant_id);
  }

  // ========== SINGLE SUPPLIER (after map route) ==========

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get a single supplier with full details' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({ status: 200, description: 'Full supplier details with categories and products' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplierService.findOne(req.user.tenant_id, id);
  }

  // ========== UPDATE ==========

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a supplier (partial update)' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({ status: 200, description: 'Supplier updated successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  @ApiResponse({ status: 409, description: 'Supplier name already exists' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierDto,
  ) {
    return this.supplierService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ========== SOFT DELETE ==========

  @Delete(':id')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Soft-delete a supplier (set is_active = false)' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({ status: 200, description: 'Supplier deactivated successfully' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async softDelete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplierService.softDelete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  // ========== STATISTICS ==========

  @Get(':id/statistics')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get supplier spend statistics' })
  @ApiParam({ name: 'id', description: 'Supplier UUID' })
  @ApiResponse({ status: 200, description: 'Supplier statistics with spend breakdown' })
  @ApiResponse({ status: 404, description: 'Supplier not found' })
  async getStatistics(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplierService.getStatistics(req.user.tenant_id, id);
  }
}
