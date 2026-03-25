import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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
import { FinancialCategoryService } from '../services/financial-category.service';
import { CreateFinancialCategoryDto } from '../dto/create-financial-category.dto';
import { UpdateFinancialCategoryDto } from '../dto/update-financial-category.dto';

@ApiTags('Financial Categories')
@ApiBearerAuth()
@Controller('settings/financial-categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialCategoryController {
  constructor(
    private readonly financialCategoryService: FinancialCategoryService,
  ) {}

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Create a custom financial category' })
  @ApiResponse({ status: 201, description: 'Category created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data' })
  async create(@Request() req, @Body() dto: CreateFinancialCategoryDto) {
    return this.financialCategoryService.createCategory(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List all active financial categories' })
  @ApiResponse({ status: 200, description: 'List of categories' })
  async findAll(@Request() req) {
    return this.financialCategoryService.findAllForTenant(req.user.tenant_id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a financial category (type cannot be changed)' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiResponse({ status: 200, description: 'Category updated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialCategoryDto,
  ) {
    return this.financialCategoryService.updateCategory(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Deactivate a financial category (system defaults cannot be deactivated)' })
  @ApiParam({ name: 'id', description: 'Category UUID' })
  @ApiResponse({ status: 200, description: 'Category deactivated' })
  @ApiResponse({ status: 400, description: 'System default cannot be deactivated' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async deactivate(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financialCategoryService.deactivateCategory(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
