import {
  Controller,
  Get,
  Param,
  UseGuards,
  Request,
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
import { ProfitabilityAnalyzerService } from '../services/profitability-analyzer.service';

@ApiTags('Quotes - Profitability Analysis')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteProfitabilityController {
  private readonly logger = new Logger(QuoteProfitabilityController.name);

  constructor(
    private readonly profitabilityService: ProfitabilityAnalyzerService,
  ) {}

  // ========== PROFITABILITY VALIDATION ==========

  @Get('quotes/:quoteId/profitability/validate')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary:
      'Validate quote profitability (warns if margins too low, blocks if below hard floor)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Profitability validation with warning level (green/yellow/red/blocked)',
    schema: {
      example: {
        quote_id: '123e4567-e89b-12d3-a456-426614174000',
        is_valid: true,
        can_send: true,
        margin_percent: 22.5,
        warning_level: 'yellow',
        thresholds: {
          target: 25.0,
          minimum: 15.0,
          hard_floor: 10.0,
        },
        financial_summary: {
          total_cost: 50000.0,
          total_revenue: 64500.0,
          gross_profit: 14500.0,
          discount_amount: 0.0,
          tax_amount: 4500.0,
          subtotal_before_discount: 60000.0,
        },
        warnings: [
          'Margin (22.50%) is below target (25%). Consider increasing markup or reducing costs.',
        ],
        recommendations: [
          'Review markup settings',
          'Negotiate better vendor pricing',
          'Optimize labor estimates',
        ],
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async validateProfitability(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.profitabilityService.validateProfitability(
      quoteId,
      req.user.tenant_id,
    );
  }

  @Get('quotes/:quoteId/profitability/analysis')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary:
      'Analyze margins per item and group (identifies low/high margin items)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Detailed margin analysis with per-item/group breakdown',
    schema: {
      example: {
        quote_id: '123e4567-e89b-12d3-a456-426614174000',
        quote_total: 64500.0,
        overall_margin_percent: 22.5,
        markup_settings: {
          profit_percent: 15,
          overhead_percent: 10,
          contingency_percent: 5,
          total_markup_multiplier: 1.3388,
        },
        items_analysis: [
          {
            item_id: 'item-uuid-1',
            title: 'Concrete Foundation',
            group_name: 'Foundation',
            quantity: 100,
            unit: 'sqft',
            cost: 5000.0,
            price_before_discount: 6694.0,
            profit: 1694.0,
            margin_percent: 25.3,
            status: 'healthy',
          },
        ],
        groups_analysis: [
          {
            group_id: 'group-uuid-1',
            name: 'Foundation',
            item_count: 5,
            total_cost: 25000.0,
            total_price: 33470.0,
            margin_percent: 25.3,
          },
        ],
        low_margin_items: [
          {
            item_id: 'item-uuid-2',
            title: 'Excavation',
            margin_percent: 8.5,
            cost: 10000.0,
            price_before_discount: 10930.0,
            recommendation:
              'CRITICAL: Increase markup or reduce costs immediately',
          },
        ],
        high_margin_items: [],
        summary: {
          total_items: 15,
          healthy_items: 10,
          acceptable_items: 3,
          low_margin_items: 2,
          critical_items: 0,
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async analyzeMargins(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.profitabilityService.analyzeMargins(
      quoteId,
      req.user.tenant_id,
    );
  }
}
