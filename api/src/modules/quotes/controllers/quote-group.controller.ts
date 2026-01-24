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
import { QuoteGroupService } from '../services/quote-group.service';
import { CreateGroupDto, UpdateGroupDto } from '../dto/group';

@ApiTags('Quotes - Groups')
@ApiBearerAuth()
@Controller('quotes/:quoteId/groups')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteGroupController {
  private readonly logger = new Logger(QuoteGroupController.name);

  constructor(private readonly quoteGroupService: QuoteGroupService) {}

  // ========== QUOTE GROUP CRUD ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Create quote group' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({ status: 201, description: 'Group created successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({ status: 400, description: 'Cannot add groups to approved quote' })
  async create(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: CreateGroupDto,
  ) {
    return this.quoteGroupService.create(
      req.user.tenant_id,
      quoteId,
      req.user.id,
      dto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List groups with items and subtotals' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'Groups retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async findAll(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.quoteGroupService.findAll(req.user.tenant_id, quoteId);
  }

  @Get(':groupId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get single group with items' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'groupId', description: 'Group UUID' })
  @ApiResponse({ status: 200, description: 'Group retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Quote or group not found' })
  async findOne(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.quoteGroupService.findOne(req.user.tenant_id, quoteId, groupId);
  }

  @Patch(':groupId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Update group name/description (creates version +0.1)' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'groupId', description: 'Group UUID' })
  @ApiResponse({ status: 200, description: 'Group updated successfully' })
  @ApiResponse({ status: 404, description: 'Quote or group not found' })
  @ApiResponse({ status: 400, description: 'Cannot edit groups in approved quote' })
  async update(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Body() dto: UpdateGroupDto,
  ) {
    return this.quoteGroupService.update(
      req.user.tenant_id,
      quoteId,
      groupId,
      req.user.id,
      dto,
    );
  }

  @Delete(':groupId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete group (options: delete items or move to ungrouped)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'groupId', description: 'Group UUID' })
  @ApiQuery({
    name: 'delete_items',
    required: false,
    type: Boolean,
    description: 'Delete items in group (default: false moves to ungrouped)',
  })
  @ApiResponse({ status: 204, description: 'Group deleted successfully' })
  @ApiResponse({ status: 404, description: 'Quote or group not found' })
  @ApiResponse({ status: 400, description: 'Cannot delete groups from approved quote' })
  async delete(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
    @Query('delete_items', new ParseBoolPipe({ optional: true }))
    deleteItems?: boolean,
  ) {
    await this.quoteGroupService.delete(
      req.user.tenant_id,
      quoteId,
      groupId,
      req.user.id,
      deleteItems ?? false,
    );
  }

  @Post(':groupId/duplicate')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Duplicate group with all items' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'groupId', description: 'Group UUID to duplicate' })
  @ApiResponse({ status: 201, description: 'Group duplicated successfully' })
  @ApiResponse({ status: 404, description: 'Quote or group not found' })
  @ApiResponse({ status: 400, description: 'Cannot duplicate groups in approved quote' })
  async duplicate(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('groupId', ParseUUIDPipe) groupId: string,
  ) {
    return this.quoteGroupService.duplicate(
      req.user.tenant_id,
      quoteId,
      groupId,
      req.user.id,
    );
  }
}
