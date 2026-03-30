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
  HttpCode,
  HttpStatus,
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
import { FinancialEntryLineItemService } from '../services/financial-entry-line-item.service';
import { CreateLineItemDto } from '../dto/create-line-item.dto';
import { UpdateLineItemDto } from '../dto/update-line-item.dto';

@ApiTags('Financial Entry Line Items')
@ApiBearerAuth()
@Controller('financial/entries/:entryId/line-items')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialEntryLineItemController {
  constructor(
    private readonly lineItemService: FinancialEntryLineItemService,
  ) {}

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a line item to a financial entry' })
  @ApiParam({ name: 'entryId', description: 'Financial Entry UUID' })
  @ApiResponse({ status: 201, description: 'Line item created' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async create(
    @Request() req,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Body() dto: CreateLineItemDto,
  ) {
    return this.lineItemService.create(
      req.user.tenant_id,
      entryId,
      req.user.id,
      req.user.roles || [],
      dto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'List line items for a financial entry' })
  @ApiParam({ name: 'entryId', description: 'Financial Entry UUID' })
  @ApiResponse({ status: 200, description: 'Array of line items' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async findAll(
    @Request() req,
    @Param('entryId', ParseUUIDPipe) entryId: string,
  ) {
    return this.lineItemService.findAll(
      req.user.tenant_id,
      entryId,
      req.user.id,
      req.user.roles || [],
    );
  }

  @Patch(':itemId')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Update a line item' })
  @ApiParam({ name: 'entryId', description: 'Financial Entry UUID' })
  @ApiParam({ name: 'itemId', description: 'Line Item UUID' })
  @ApiResponse({ status: 200, description: 'Line item updated' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry or line item not found' })
  async update(
    @Request() req,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateLineItemDto,
  ) {
    return this.lineItemService.update(
      req.user.tenant_id,
      entryId,
      itemId,
      req.user.id,
      req.user.roles || [],
      dto,
    );
  }

  @Delete(':itemId')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Employee')
  @ApiOperation({ summary: 'Delete a line item' })
  @ApiParam({ name: 'entryId', description: 'Financial Entry UUID' })
  @ApiParam({ name: 'itemId', description: 'Line Item UUID' })
  @ApiResponse({ status: 200, description: 'Line item deleted' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Entry or line item not found' })
  async delete(
    @Request() req,
    @Param('entryId', ParseUUIDPipe) entryId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.lineItemService.delete(
      req.user.tenant_id,
      entryId,
      itemId,
      req.user.id,
      req.user.roles || [],
    );
  }
}
