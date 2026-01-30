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
import { WarrantyTierService } from '../services/warranty-tier.service';
import {
  CreateWarrantyTierDto,
  UpdateWarrantyTierDto,
  WarrantyTierResponseDto,
} from '../dto/warranty';

/**
 * WarrantyTierController
 *
 * Manages warranty tiers for quote items
 *
 * Endpoints:
 * - POST   /warranty-tiers       - Create warranty tier
 * - GET    /warranty-tiers       - List warranty tiers
 * - GET    /warranty-tiers/:id   - Get warranty tier
 * - PATCH  /warranty-tiers/:id   - Update warranty tier
 * - DELETE /warranty-tiers/:id   - Delete warranty tier (only if unused)
 *
 * @author Backend Developer
 */
@ApiTags('Quotes - Warranty Tiers')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class WarrantyTierController {
  private readonly logger = new Logger(WarrantyTierController.name);

  constructor(private readonly tierService: WarrantyTierService) {}

  @Post('warranty-tiers')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Create warranty tier',
    description:
      'Creates a new warranty tier for quote items. Price can be fixed amount or percentage of item price.',
  })
  @ApiResponse({
    status: 201,
    description: 'Warranty tier created successfully',
    type: WarrantyTierResponseDto,
  })
  async createTier(
    @Request() req,
    @Body() dto: CreateWarrantyTierDto,
  ): Promise<WarrantyTierResponseDto> {
    this.logger.log(
      `Creating warranty tier "${dto.tier_name}" (tenant: ${req.user.tenant_id})`,
    );
    return this.tierService.createTier(req.user.tenant_id, dto, req.user.id);
  }

  @Get('warranty-tiers')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'List all warranty tiers',
    description: 'Returns all warranty tiers for the tenant, ordered by name',
  })
  @ApiQuery({
    name: 'include_inactive',
    required: false,
    type: Boolean,
    description: 'Include inactive warranty tiers (default: false)',
  })
  @ApiResponse({
    status: 200,
    description: 'Warranty tiers retrieved successfully',
    type: [WarrantyTierResponseDto],
  })
  async listTiers(
    @Request() req,
    @Query('include_inactive', new ParseBoolPipe({ optional: true }))
    includeInactive?: boolean,
  ): Promise<WarrantyTierResponseDto[]> {
    this.logger.log(`Listing warranty tiers (tenant: ${req.user.tenant_id})`);
    return this.tierService.listTiers(
      req.user.tenant_id,
      includeInactive || false,
    );
  }

  @Get('warranty-tiers/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get warranty tier by ID' })
  @ApiParam({ name: 'id', description: 'Warranty tier UUID' })
  @ApiResponse({
    status: 200,
    description: 'Warranty tier retrieved successfully',
    type: WarrantyTierResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Warranty tier not found' })
  async getTier(
    @Request() req,
    @Param('id', ParseUUIDPipe) tierId: string,
  ): Promise<WarrantyTierResponseDto> {
    this.logger.log(
      `Getting warranty tier ${tierId} (tenant: ${req.user.tenant_id})`,
    );
    return this.tierService.getTier(req.user.tenant_id, tierId);
  }

  @Patch('warranty-tiers/:id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Update warranty tier',
    description:
      'Updates warranty tier name, description, price, duration, or active status',
  })
  @ApiParam({ name: 'id', description: 'Warranty tier UUID' })
  @ApiResponse({
    status: 200,
    description: 'Warranty tier updated successfully',
    type: WarrantyTierResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Warranty tier not found' })
  async updateTier(
    @Request() req,
    @Param('id', ParseUUIDPipe) tierId: string,
    @Body() dto: UpdateWarrantyTierDto,
  ): Promise<WarrantyTierResponseDto> {
    this.logger.log(
      `Updating warranty tier ${tierId} (tenant: ${req.user.tenant_id})`,
    );
    return this.tierService.updateTier(
      req.user.tenant_id,
      tierId,
      dto,
      req.user.id,
    );
  }

  @Delete('warranty-tiers/:id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete warranty tier',
    description:
      'Deletes warranty tier only if not assigned to any quote item. Otherwise, mark as inactive.',
  })
  @ApiParam({ name: 'id', description: 'Warranty tier UUID' })
  @ApiResponse({
    status: 204,
    description: 'Warranty tier deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Warranty tier not found' })
  @ApiResponse({
    status: 400,
    description:
      'Cannot delete warranty tier assigned to quote items (mark inactive instead)',
  })
  async deleteTier(
    @Request() req,
    @Param('id', ParseUUIDPipe) tierId: string,
  ): Promise<void> {
    this.logger.log(
      `Deleting warranty tier ${tierId} (tenant: ${req.user.tenant_id})`,
    );
    await this.tierService.deleteTier(req.user.tenant_id, tierId, req.user.id);
  }
}
