import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
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
import { ApprovalWorkflowService } from '../services/approval-workflow.service';
import {
  ApproveQuoteDto,
  RejectQuoteDto,
  BypassApprovalDto,
  UpdateApprovalThresholdsDto,
} from '../dto/approval';

@ApiTags('Quotes - Approval Workflow')
@ApiBearerAuth()
@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteApprovalController {
  private readonly logger = new Logger(QuoteApprovalController.name);

  constructor(
    private readonly approvalWorkflowService: ApprovalWorkflowService,
  ) {}

  // ========== QUOTE APPROVAL WORKFLOW ==========

  @Post('quotes/:quoteId/submit-for-approval')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary:
      'Submit quote for approval (determines required levels based on total)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 201,
    description: 'Quote submitted for approval successfully',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({
    status: 400,
    description:
      'Quote must have items/vendor/address / Already submitted / No approval thresholds configured',
  })
  async submitForApproval(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.approvalWorkflowService.submitForApproval(
      quoteId,
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Post('quotes/:quoteId/approvals/:approvalId/approve')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary:
      'Approve quote (validates user is assigned approver, checks sequential approval)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'approvalId', description: 'Approval UUID' })
  @ApiResponse({
    status: 201,
    description:
      'Quote approval successful (may trigger next level or mark quote ready)',
  })
  @ApiResponse({ status: 404, description: 'Approval not found' })
  @ApiResponse({
    status: 403,
    description: 'You are not the assigned approver',
  })
  @ApiResponse({
    status: 400,
    description:
      'Approval already decided / Previous level not approved yet',
  })
  async approve(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() dto: ApproveQuoteDto,
  ) {
    return this.approvalWorkflowService.approve(
      approvalId,
      dto,
      req.user.id,
      req.user.tenant_id,
    );
  }

  @Post('quotes/:quoteId/approvals/:approvalId/reject')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary:
      'Reject quote (requires comments, terminates workflow, sets quote to draft)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiParam({ name: 'approvalId', description: 'Approval UUID' })
  @ApiResponse({
    status: 201,
    description:
      'Quote rejected successfully (all approvals marked rejected, quote returned to draft)',
  })
  @ApiResponse({ status: 404, description: 'Approval not found' })
  @ApiResponse({
    status: 403,
    description: 'You are not the assigned approver',
  })
  @ApiResponse({
    status: 400,
    description: 'Approval already decided / Comments required',
  })
  async reject(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Param('approvalId', ParseUUIDPipe) approvalId: string,
    @Body() dto: RejectQuoteDto,
  ) {
    return this.approvalWorkflowService.reject(
      approvalId,
      dto,
      req.user.id,
      req.user.tenant_id,
    );
  }

  @Get('quotes/:quoteId/approvals')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({
    summary: 'Get approval status for quote (list all approvals with progress)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Approval status with progress percentage',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async getApprovals(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.approvalWorkflowService.getApprovals(
      quoteId,
      req.user.tenant_id,
    );
  }

  @Get('users/me/pending-approvals')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get pending approvals for current user (quotes awaiting approval)',
  })
  @ApiResponse({
    status: 200,
    description: 'List of quotes awaiting current user approval',
  })
  async getPendingForUser(@Request() req) {
    return this.approvalWorkflowService.getPendingForUser(
      req.user.id,
      req.user.tenant_id,
    );
  }

  @Post('quotes/:quoteId/approvals/bypass')
  @Roles('Owner')
  @ApiOperation({
    summary:
      'Bypass approval (owner override - marks all approvals approved and sets quote ready)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 201,
    description: 'Approval bypassed successfully (quote marked ready)',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({
    status: 403,
    description: 'Only owners can bypass approval',
  })
  @ApiResponse({
    status: 400,
    description: 'Quote is not pending approval',
  })
  async bypassApproval(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: BypassApprovalDto,
  ) {
    return this.approvalWorkflowService.bypassApproval(
      quoteId,
      dto,
      req.user.id,
      req.user.tenant_id,
    );
  }

  @Patch('quotes/settings/approval-thresholds')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary:
      'Configure approval thresholds for tenant (defines approval levels and amounts)',
  })
  @ApiResponse({
    status: 200,
    description: 'Approval thresholds updated successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Amounts must be ascending / Levels must be sequential',
  })
  async configureThresholds(
    @Request() req,
    @Body() dto: UpdateApprovalThresholdsDto,
  ) {
    return this.approvalWorkflowService.configureThresholds(
      dto,
      req.user.tenant_id,
    );
  }

  @Post('quotes/:quoteId/approvals/reset')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary:
      'Reset approvals (deletes approvals, returns quote to draft - used when quote modified after submission)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 201,
    description: 'Approvals reset successfully (quote returned to draft)',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async resetApprovals(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.approvalWorkflowService.resetApprovals(
      quoteId,
      req.user.tenant_id,
    );
  }
}
