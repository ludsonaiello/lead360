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
import { UnitMeasurementService } from '../services/unit-measurement.service';
import {
  CreateUnitDto,
  CreateGlobalUnitDto,
  UpdateUnitDto,
  ListUnitsDto,
} from '../dto/unit-measurement';

// ========== ADMIN CONTROLLER (Global Units) ==========

@ApiTags('Quotes - Unit Measurements (Admin)')
@ApiBearerAuth()
@Controller('admin/units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnitMeasurementAdminController {
  private readonly logger = new Logger(UnitMeasurementAdminController.name);

  constructor(private readonly unitService: UnitMeasurementService) {}

  @Post()
  @Roles('Platform Admin')
  @ApiOperation({ summary: 'Create global unit measurement (admin only)' })
  @ApiResponse({ status: 201, description: 'Global unit created successfully' })
  @ApiResponse({ status: 409, description: 'Global unit with this name already exists' })
  async createGlobal(@Request() req, @Body() createUnitDto: CreateGlobalUnitDto) {
    return this.unitService.createGlobal(req.user.id, createUnitDto);
  }

  @Get()
  @Roles('Platform Admin')
  @ApiOperation({ summary: 'Get all global units (admin only)' })
  @ApiResponse({ status: 200, description: 'Global units retrieved successfully' })
  async findAllGlobal(@Query() listUnitsDto: ListUnitsDto) {
    return this.unitService.findAllGlobal(listUnitsDto);
  }

  @Patch(':id')
  @Roles('Platform Admin')
  @ApiOperation({ summary: 'Update global unit (admin only)' })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 200, description: 'Global unit updated successfully' })
  @ApiResponse({ status: 404, description: 'Global unit not found' })
  @ApiResponse({ status: 409, description: 'Global unit with this name already exists' })
  async updateGlobal(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUnitDto: UpdateUnitDto,
  ) {
    return this.unitService.updateGlobal(id, req.user.id, updateUnitDto);
  }

  @Post('seed-defaults')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Seed default global units (idempotent)',
    description: 'Creates 10 standard units: Each, Square Foot, Linear Foot, Hour, Cubic Yard, Ton, Gallon, Pound, Box, Bundle',
  })
  @ApiResponse({ status: 200, description: 'Default units seeded successfully' })
  async seedDefaults(@Request() req) {
    return this.unitService.seedDefaultUnits(req.user.id);
  }
}

// ========== TENANT CONTROLLER (Available Units) ==========

@ApiTags('Quotes - Unit Measurements')
@ApiBearerAuth()
@Controller('units')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UnitMeasurementController {
  private readonly logger = new Logger(UnitMeasurementController.name);

  constructor(private readonly unitService: UnitMeasurementService) {}

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Create tenant custom unit' })
  @ApiResponse({ status: 201, description: 'Tenant unit created successfully' })
  @ApiResponse({ status: 409, description: 'Unit with this name already exists for your tenant' })
  async createTenantUnit(@Request() req, @Body() createUnitDto: CreateUnitDto) {
    return this.unitService.createTenantUnit(
      req.user.tenant_id,
      req.user.id,
      createUnitDto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get all available units (global + tenant custom)',
    description: 'Returns global units created by admin plus tenant-specific custom units',
  })
  @ApiResponse({ status: 200, description: 'Units retrieved successfully' })
  async findAll(@Request() req, @Query() listUnitsDto: ListUnitsDto) {
    return this.unitService.findAllForTenant(req.user.tenant_id, listUnitsDto);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get a single unit by ID' })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 200, description: 'Unit retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.unitService.findOne(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Update tenant custom unit',
    description: 'Can only update tenant-specific units, not global units',
  })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 200, description: 'Tenant unit updated successfully' })
  @ApiResponse({ status: 403, description: 'Cannot edit global units' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  @ApiResponse({ status: 409, description: 'Unit with this name already exists for your tenant' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUnitDto: UpdateUnitDto,
  ) {
    return this.unitService.updateTenantUnit(
      req.user.tenant_id,
      id,
      req.user.id,
      updateUnitDto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete tenant custom unit',
    description: 'Can only delete tenant-specific units that are not in use',
  })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 204, description: 'Unit deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete unit (in use)' })
  @ApiResponse({ status: 403, description: 'Cannot delete global units' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  async delete(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.unitService.delete(req.user.tenant_id, id, req.user.id);
  }

  @Get(':id/stats')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get unit usage statistics' })
  @ApiParam({ name: 'id', description: 'Unit UUID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Unit not found' })
  async getStatistics(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.unitService.getUsageStatistics(req.user.tenant_id, id);
  }
}
