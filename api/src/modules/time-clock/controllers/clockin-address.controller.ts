import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { ClockinAddressService } from '../services/clockin-address.service';
import {
  CreateClockinAddressDto,
  UpdateClockinAddressDto,
  ListClockinAddressesDto,
  ImportAddressFromQuoteDto,
  ImportAddressFromLeadDto,
} from '../dto/clockin-address.dto';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClockinAddressController {
  constructor(private readonly clockinAddressService: ClockinAddressService) {}

  @Get('addresses')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List clock-in addresses' })
  @ApiResponse({ status: 200, description: 'Paginated list of addresses' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async list(@Request() req, @Query() query: ListClockinAddressesDto) {
    return this.clockinAddressService.list(req.user.tenant_id, query);
  }

  @Post('addresses')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create clock-in address' })
  @ApiResponse({ status: 201, description: 'Address created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  async create(@Request() req, @Body() dto: CreateClockinAddressDto) {
    return this.clockinAddressService.create(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Post('addresses/import-from-quote')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Import address from quote jobsite' })
  @ApiResponse({ status: 201, description: 'Address imported from quote' })
  @ApiResponse({
    status: 400,
    description: 'Quote does not have a jobsite address',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Quote or project not found' })
  async importFromQuote(
    @Request() req,
    @Body() dto: ImportAddressFromQuoteDto,
  ) {
    return this.clockinAddressService.importFromQuote(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Post('addresses/import-from-lead')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Import address from lead address' })
  @ApiResponse({ status: 201, description: 'Address imported from lead' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({
    status: 404,
    description: 'Lead address or project not found',
  })
  async importFromLead(@Request() req, @Body() dto: ImportAddressFromLeadDto) {
    return this.clockinAddressService.importFromLead(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get('addresses/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get clock-in address by ID' })
  @ApiResponse({ status: 200, description: 'Address retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async findOne(@Request() req, @Param('id') id: string) {
    return this.clockinAddressService.findOne(req.user.tenant_id, id);
  }

  @Patch('addresses/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update clock-in address' })
  @ApiResponse({ status: 200, description: 'Address updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Address or project not found' })
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateClockinAddressDto,
  ) {
    return this.clockinAddressService.update(
      req.user.tenant_id,
      req.user.id,
      id,
      dto,
    );
  }

  @Delete('addresses/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Deactivate clock-in address (soft delete)',
  })
  @ApiResponse({ status: 200, description: 'Address deactivated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async remove(@Request() req, @Param('id') id: string) {
    return this.clockinAddressService.softDelete(
      req.user.tenant_id,
      req.user.id,
      id,
    );
  }
}
