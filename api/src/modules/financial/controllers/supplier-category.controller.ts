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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SupplierCategoryService } from '../services/supplier-category.service';
import { CreateSupplierCategoryDto } from '../dto/create-supplier-category.dto';
import { UpdateSupplierCategoryDto } from '../dto/update-supplier-category.dto';

@ApiTags('Financial - Supplier Categories')
@ApiBearerAuth()
@Controller('financial/supplier-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SupplierCategoryController {
  constructor(
    private readonly supplierCategoryService: SupplierCategoryService,
  ) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List all supplier categories for tenant' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Filter by active status' })
  @ApiResponse({ status: 200, description: 'List of supplier categories with supplier counts' })
  async findAll(
    @Request() req,
    @Query('is_active') isActive?: string,
  ) {
    const isActiveBool = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.supplierCategoryService.findAll(req.user.tenant_id, isActiveBool);
  }

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Create a new supplier category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or 50-category limit reached' })
  @ApiResponse({ status: 409, description: 'Category name already exists for this tenant' })
  async create(
    @Request() req,
    @Body() dto: CreateSupplierCategoryDto,
  ) {
    return this.supplierCategoryService.create(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a supplier category' })
  @ApiParam({ name: 'id', description: 'Supplier category UUID' })
  @ApiResponse({ status: 200, description: 'Category updated successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category name already exists' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSupplierCategoryDto,
  ) {
    return this.supplierCategoryService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Delete a supplier category (blocked if assigned to suppliers)' })
  @ApiParam({ name: 'id', description: 'Supplier category UUID' })
  @ApiResponse({ status: 200, description: 'Category deleted successfully' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  @ApiResponse({ status: 409, description: 'Category is assigned to one or more suppliers' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supplierCategoryService.delete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
