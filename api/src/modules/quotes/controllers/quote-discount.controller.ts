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
import { DiscountRuleService } from '../services/discount-rule.service';
import {
  CreateDiscountRuleDto,
  UpdateDiscountRuleDto,
  ReorderDiscountRulesDto,
  PreviewDiscountImpactDto,
} from '../dto/discount-rule';

@ApiTags('Quotes - Discount Rules')
@ApiBearerAuth()
@Controller('quotes/:quoteId/discount-rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteDiscountController {
  private readonly logger = new Logger(QuoteDiscountController.name);

  constructor(private readonly discountRuleService: DiscountRuleService) {}

  // ========== DISCOUNT RULE CRUD ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Create discount rule for quote' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 201,
    description: 'Discount rule created successfully',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({
    status: 400,
    description:
      'Cannot modify approved quote / Invalid discount value / Discount exceeds subtotal',
  })
  async create(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: CreateDiscountRuleDto,
  ) {
    return this.discountRuleService.create(
      quoteId,
      dto,
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({ summary: 'List all discount rules for quote' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of discount rules with summary',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async findAll(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.discountRuleService.findAll(quoteId, req.user.tenant_id);
  }

  @Get(':ruleId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({ summary: 'Get single discount rule' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'ruleId', description: 'Discount rule UUID' })
  @ApiResponse({ status: 200, description: 'Discount rule details' })
  @ApiResponse({ status: 404, description: 'Quote or discount rule not found' })
  async findOne(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    return this.discountRuleService.findOne(
      quoteId,
      ruleId,
      req.user.tenant_id,
    );
  }

  @Patch(':ruleId')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update discount rule' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'ruleId', description: 'Discount rule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Discount rule updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Quote or discount rule not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot modify approved quote / Invalid discount value',
  })
  async update(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
    @Body() dto: UpdateDiscountRuleDto,
  ) {
    return this.discountRuleService.update(
      quoteId,
      ruleId,
      dto,
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Delete(':ruleId')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete discount rule (hard delete)' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'ruleId', description: 'Discount rule UUID' })
  @ApiResponse({
    status: 204,
    description: 'Discount rule deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Quote or discount rule not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot modify approved quote',
  })
  async delete(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('ruleId', ParseUUIDPipe) ruleId: string,
  ) {
    await this.discountRuleService.delete(
      quoteId,
      ruleId,
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Patch('reorder')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary:
      'Reorder discount rules (order affects totals - percentage discounts compound)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Discount rules reordered successfully',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({
    status: 400,
    description: 'Cannot modify approved quote',
  })
  async reorder(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: ReorderDiscountRulesDto,
  ) {
    return this.discountRuleService.reorder(
      quoteId,
      dto,
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Post('preview')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary:
      'Preview discount impact without saving (before/after comparison)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Discount impact preview with margin analysis',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async previewImpact(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: PreviewDiscountImpactDto,
  ) {
    return this.discountRuleService.previewImpact(
      quoteId,
      dto,
      req.user.tenant_id,
    );
  }
}
