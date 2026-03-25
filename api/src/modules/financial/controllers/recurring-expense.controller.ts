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
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { RecurringExpenseService } from '../services/recurring-expense.service';
import { CreateRecurringRuleDto } from '../dto/create-recurring-rule.dto';
import { UpdateRecurringRuleDto } from '../dto/update-recurring-rule.dto';
import { ListRecurringRulesDto } from '../dto/list-recurring-rules.dto';
import { SkipRecurringRuleDto } from '../dto/skip-recurring-rule.dto';
import { RecurringRuleHistoryDto } from '../dto/recurring-rule-history.dto';
import { PreviewRecurringRulesDto } from '../dto/preview-recurring-rules.dto';

@ApiTags('Recurring Expense Rules')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecurringExpenseController {
  constructor(
    private readonly recurringExpenseService: RecurringExpenseService,
  ) {}

  // ===========================================================================
  // Route 1 — GET /financial/recurring-rules/preview
  // CRITICAL: Must appear BEFORE GET /financial/recurring-rules/:id
  // ===========================================================================

  @Get('recurring-rules/preview')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Preview upcoming expense obligations' })
  @ApiResponse({ status: 200, description: 'Upcoming obligations preview' })
  async getPreview(
    @Request() req,
    @Query() query: PreviewRecurringRulesDto,
  ) {
    return this.recurringExpenseService.getPreview(
      req.user.tenant_id,
      query.days,
    );
  }

  // ===========================================================================
  // Route 2 — GET /financial/recurring-rules (List)
  // ===========================================================================

  @Get('recurring-rules')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List all recurring expense rules' })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of rules with monthly obligation summary',
  })
  async findAll(
    @Request() req,
    @Query() query: ListRecurringRulesDto,
  ) {
    return this.recurringExpenseService.findAll(req.user.tenant_id, query);
  }

  // ===========================================================================
  // Route 3 — POST /financial/recurring-rules (Create)
  // ===========================================================================

  @Post('recurring-rules')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new recurring expense rule' })
  @ApiResponse({ status: 201, description: 'Rule created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(
    @Request() req,
    @Body() dto: CreateRecurringRuleDto,
  ) {
    return this.recurringExpenseService.create(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  // ===========================================================================
  // Route 4 — GET /financial/recurring-rules/:id (Get Single)
  // ===========================================================================

  @Get('recurring-rules/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get a single recurring expense rule with preview',
  })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Rule details with last entry and next 3 dates',
  })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringExpenseService.findOne(req.user.tenant_id, id);
  }

  // ===========================================================================
  // Route 5 — PATCH /financial/recurring-rules/:id (Update)
  // ===========================================================================

  @Patch('recurring-rules/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a recurring expense rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation error or rule is cancelled/completed',
  })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateRecurringRuleDto,
  ) {
    return this.recurringExpenseService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ===========================================================================
  // Route 6 — DELETE /financial/recurring-rules/:id (Cancel — soft delete)
  // ===========================================================================

  @Delete('recurring-rules/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Cancel a recurring expense rule (soft delete)' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule cancelled successfully' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async cancel(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringExpenseService.cancel(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  // ===========================================================================
  // Route 7 — POST /financial/recurring-rules/:id/pause
  // ===========================================================================

  @Post('recurring-rules/:id/pause')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pause a recurring expense rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule paused successfully' })
  @ApiResponse({ status: 400, description: 'Rule is not active' })
  async pause(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringExpenseService.pause(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  // ===========================================================================
  // Route 8 — POST /financial/recurring-rules/:id/resume
  // ===========================================================================

  @Post('recurring-rules/:id/resume')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resume a paused recurring expense rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Rule resumed successfully' })
  @ApiResponse({ status: 400, description: 'Rule is not paused' })
  async resume(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringExpenseService.resume(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  // ===========================================================================
  // Route 9 — POST /financial/recurring-rules/:id/trigger
  // ===========================================================================

  @Post('recurring-rules/:id/trigger')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Manually trigger entry generation for a rule',
  })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 202, description: 'Entry generation triggered' })
  @ApiResponse({
    status: 400,
    description: 'Rule is cancelled or completed',
  })
  async trigger(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.recurringExpenseService.triggerNow(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  // ===========================================================================
  // Route 10 — POST /financial/recurring-rules/:id/skip
  // ===========================================================================

  @Post('recurring-rules/:id/skip')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Skip the next occurrence of a rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({
    status: 200,
    description: 'Occurrence skipped, next_due_date advanced',
  })
  @ApiResponse({ status: 400, description: 'Rule is not active' })
  async skip(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SkipRecurringRuleDto,
  ) {
    return this.recurringExpenseService.skipNext(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ===========================================================================
  // Route 11 — GET /financial/recurring-rules/:id/history
  // ===========================================================================

  @Get('recurring-rules/:id/history')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List entries generated by this rule' })
  @ApiParam({ name: 'id', description: 'Rule UUID' })
  @ApiResponse({ status: 200, description: 'Paginated entry history' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async getHistory(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: RecurringRuleHistoryDto,
  ) {
    return this.recurringExpenseService.getHistory(
      req.user.tenant_id,
      id,
      query,
    );
  }
}
