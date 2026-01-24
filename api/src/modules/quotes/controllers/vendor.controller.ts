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
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { VendorService } from '../services/vendor.service';
import {
  CreateVendorDto,
  UpdateVendorDto,
  ListVendorsDto,
} from '../dto/vendor';

@ApiTags('Quotes - Vendors')
@ApiBearerAuth()
@Controller('vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorController {
  private readonly logger = new Logger(VendorController.name);

  constructor(private readonly vendorService: VendorService) {}

  // ========== VENDOR CRUD ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Create a new vendor' })
  @ApiResponse({ status: 201, description: 'Vendor created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or validation error' })
  @ApiResponse({ status: 409, description: 'Email already exists for this tenant' })
  @ApiResponse({ status: 422, description: 'Address validation failed (Google Maps)' })
  async create(@Request() req, @Body() createVendorDto: CreateVendorDto) {
    return this.vendorService.create(
      req.user.tenant_id,
      req.user.id,
      createVendorDto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get all vendors with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Vendors retrieved successfully' })
  async findAll(@Request() req, @Query() listVendorsDto: ListVendorsDto) {
    return this.vendorService.findAll(req.user.tenant_id, listVendorsDto);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get a single vendor by ID' })
  @ApiParam({ name: 'id', description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Vendor retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vendorService.findOne(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a vendor' })
  @ApiParam({ name: 'id', description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Vendor updated successfully' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  @ApiResponse({ status: 409, description: 'Email already exists for this tenant' })
  @ApiResponse({ status: 422, description: 'Address validation failed (Google Maps)' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVendorDto: UpdateVendorDto,
  ) {
    return this.vendorService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      updateVendorDto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a vendor' })
  @ApiParam({ name: 'id', description: 'Vendor UUID' })
  @ApiResponse({ status: 204, description: 'Vendor deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete vendor (used in quotes)' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vendorService.delete(req.user.tenant_id, id, req.user.id);
  }

  // ========== VENDOR OPERATIONS ==========

  @Patch(':id/set-default')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Set a vendor as default' })
  @ApiParam({ name: 'id', description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Vendor set as default successfully' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async setDefault(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vendorService.setDefault(req.user.tenant_id, id, req.user.id);
  }

  @Post(':id/signature')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Update vendor signature file',
    description: 'Upload signature file via /files endpoint first, then provide file_id here'
  })
  @ApiParam({ name: 'id', description: 'Vendor UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' }
      },
      required: ['file_id']
    }
  })
  @ApiResponse({ status: 200, description: 'Signature updated successfully' })
  @ApiResponse({ status: 404, description: 'Vendor or file not found' })
  async uploadSignature(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('file_id') fileId: string,
  ) {
    return this.vendorService.uploadSignature(
      req.user.tenant_id,
      id,
      req.user.id,
      fileId,
    );
  }

  @Get(':id/stats')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get vendor statistics (quote counts by status)' })
  @ApiParam({ name: 'id', description: 'Vendor UUID' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Vendor not found' })
  async getStatistics(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.vendorService.getStatistics(req.user.tenant_id, id);
  }
}
