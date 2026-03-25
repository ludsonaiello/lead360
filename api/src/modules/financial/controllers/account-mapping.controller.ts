import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AccountMappingService } from '../services/account-mapping.service';
import { CreateAccountMappingDto } from '../dto/create-account-mapping.dto';
import { AccountMappingQueryDto, AccountMappingDefaultsQueryDto } from '../dto/account-mapping-query.dto';

@ApiTags('Financial Export — Account Mappings')
@ApiBearerAuth()
@Controller('financial/export/account-mappings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AccountMappingController {
  constructor(
    private readonly accountMappingService: AccountMappingService,
  ) {}

  // IMPORTANT: Static routes (defaults) MUST be registered BEFORE parameterized routes (:id)
  // NestJS matches routes in registration order — if :id comes first, "defaults" is treated as an ID

  @Get('defaults')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Preview default account mappings for all categories' })
  @ApiResponse({ status: 200, description: 'List of categories with resolved account names' })
  @ApiQuery({ name: 'platform', required: true, enum: ['quickbooks', 'xero'] })
  async getDefaults(
    @Request() req,
    @Query() query: AccountMappingDefaultsQueryDto,
  ) {
    return this.accountMappingService.getDefaults(
      req.user.tenant_id,
      query.platform,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'List all account mappings' })
  @ApiResponse({ status: 200, description: 'List of account mappings' })
  @ApiQuery({ name: 'platform', required: false, enum: ['quickbooks', 'xero'] })
  async findAll(
    @Request() req,
    @Query() query: AccountMappingQueryDto,
  ) {
    return this.accountMappingService.findAll(
      req.user.tenant_id,
      query.platform,
    );
  }

  @Post()
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Create or update an account mapping (upsert)' })
  @ApiResponse({ status: 200, description: 'Mapping updated' })
  @ApiResponse({ status: 201, description: 'Mapping created' })
  @ApiResponse({ status: 404, description: 'Category not found' })
  async upsert(
    @Request() req,
    @Body() dto: CreateAccountMappingDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.accountMappingService.upsert(
      req.user.tenant_id,
      req.user.id,
      dto,
    );

    // Set correct HTTP status based on upsert result
    const statusCode = result.statusCode;
    res.status(statusCode);

    // Remove statusCode from response payload
    const { statusCode: _, ...responseData } = result;
    return responseData;
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an account mapping' })
  @ApiParam({ name: 'id', description: 'Mapping UUID' })
  @ApiResponse({ status: 204, description: 'Mapping deleted' })
  @ApiResponse({ status: 404, description: 'Mapping not found' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.accountMappingService.delete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
