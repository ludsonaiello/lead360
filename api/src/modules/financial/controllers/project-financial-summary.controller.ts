import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
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
import { ProjectFinancialSummaryService } from '../services/project-financial-summary.service';
import {
  ProjectDateFilterDto,
  ProjectTaskBreakdownQueryDto,
  ProjectReceiptsQueryDto,
} from '../dto/project-financial-query.dto';

/** Typed request shape after JwtAuthGuard populates req.user. */
interface AuthenticatedRequest {
  user: { tenant_id: string; id: string; role: string };
}

@ApiTags('Project Financial Intelligence')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectFinancialSummaryController {
  constructor(
    private readonly summaryService: ProjectFinancialSummaryService,
  ) {}

  // ─── 1. Full Financial Summary ───────────────────────────────────────

  @Get(':projectId/financial/summary')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get full project financial summary',
    description:
      'Returns a complete financial picture of a project: cost breakdown by category and classification, ' +
      'subcontractor invoices and payments, crew hours and payments, receipt counts, and margin analysis. ' +
      'Revenue data is not yet available (deferred to Invoicing Module).',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({
    name: 'date_from',
    required: false,
    type: String,
    description: 'Filter entry_date >= this date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    type: String,
    description: 'Filter entry_date <= this date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Full project financial summary' })
  @ApiResponse({
    status: 404,
    description: 'Project not found or does not belong to tenant',
  })
  async getFullSummary(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectDateFilterDto,
  ) {
    return this.summaryService.getFullSummary(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ─── 2. Per-Task Cost Breakdown ──────────────────────────────────────

  @Get(':projectId/financial/tasks')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get per-task cost breakdown',
    description:
      'Returns cost breakdown at the task level. Includes expenses, subcontractor invoices, ' +
      'and crew hours per task. Tasks with zero financial activity are included with zero values.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({
    name: 'date_from',
    required: false,
    type: String,
    description: 'Filter entry_date >= this date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    type: String,
    description: 'Filter entry_date <= this date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'sort_by',
    required: false,
    enum: ['total_cost', 'task_title'],
    description: 'Sort field (default: total_cost)',
  })
  @ApiQuery({
    name: 'sort_order',
    required: false,
    enum: ['asc', 'desc'],
    description: 'Sort direction (default: desc)',
  })
  @ApiResponse({ status: 200, description: 'Per-task cost breakdown' })
  @ApiResponse({
    status: 404,
    description: 'Project not found or does not belong to tenant',
  })
  async getTaskBreakdown(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectTaskBreakdownQueryDto,
  ) {
    return this.summaryService.getTaskBreakdown(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ─── 3. Monthly Cost Timeline ────────────────────────────────────────

  @Get(':projectId/financial/timeline')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get monthly cost timeline',
    description:
      'Returns expenses grouped by month with category breakdown. Months with zero expenses ' +
      'within the project date range are included for chart continuity.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({
    name: 'date_from',
    required: false,
    type: String,
    description: 'Filter start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    type: String,
    description: 'Filter end date (YYYY-MM-DD)',
  })
  @ApiResponse({ status: 200, description: 'Monthly cost timeline' })
  @ApiResponse({
    status: 404,
    description: 'Project not found or does not belong to tenant',
  })
  async getTimeline(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectDateFilterDto,
  ) {
    return this.summaryService.getTimeline(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ─── 4. Project Receipts ─────────────────────────────────────────────

  @Get(':projectId/financial/receipts')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field')
  @ApiOperation({
    summary: 'Get all project receipts',
    description:
      'Returns paginated list of all receipts attached to this project or any of its tasks. ' +
      'Field workers (role: Field) can access this endpoint to see their uploaded receipts.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({
    name: 'is_categorized',
    required: false,
    type: Boolean,
    description: 'Filter by categorization status',
  })
  @ApiQuery({
    name: 'ocr_status',
    required: false,
    enum: ['not_processed', 'processing', 'complete', 'failed'],
    description: 'Filter by OCR status',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiResponse({ status: 200, description: 'Paginated receipt list' })
  @ApiResponse({
    status: 404,
    description: 'Project not found or does not belong to tenant',
  })
  async getReceipts(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectReceiptsQueryDto,
  ) {
    return this.summaryService.getReceipts(
      req.user.tenant_id,
      projectId,
      query,
    );
  }

  // ─── 5. Workforce Summary ───────────────────────────────────────────

  @Get(':projectId/financial/workforce')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get project workforce summary',
    description:
      'Returns consolidated workforce financial view: crew hours by member, crew payments by member, ' +
      'and subcontractor invoice/payment activity by subcontractor.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID', type: String })
  @ApiQuery({
    name: 'date_from',
    required: false,
    type: String,
    description: 'Filter start date (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'date_to',
    required: false,
    type: String,
    description: 'Filter end date (YYYY-MM-DD)',
  })
  @ApiResponse({
    status: 200,
    description: 'Workforce summary with crew and subcontractor details',
  })
  @ApiResponse({
    status: 404,
    description: 'Project not found or does not belong to tenant',
  })
  async getWorkforceSummary(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query() query: ProjectDateFilterDto,
  ) {
    return this.summaryService.getWorkforceSummary(
      req.user.tenant_id,
      projectId,
      query,
    );
  }
}
