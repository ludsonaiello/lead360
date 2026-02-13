import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { QuoteVersionService } from './quote-version.service';
import {
  ApproveQuoteDto,
  RejectQuoteDto,
  BypassApprovalDto,
  UpdateApprovalThresholdsDto,
} from '../dto/approval';
import { v4 as uuid } from 'uuid';
import { Prisma } from '@prisma/client';

interface ApprovalThreshold {
  level: number;
  amount: number;
  approver_role: string;
}

@Injectable()
export class ApprovalWorkflowService {
  private readonly logger = new Logger(ApprovalWorkflowService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly versionService: QuoteVersionService,
  ) {}

  /**
   * Submit quote for approval
   * Determines required approval levels based on quote total
   * Creates approval records for each level
   * Changes quote status to 'pending_approval'
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @param userId - User UUID (submitter)
   * @returns Quote with approval records
   */
  async submitForApproval(
    quoteId: string,
    tenantId: string,
    userId: string,
  ): Promise<any> {
    // Fetch quote with relationships
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: {
        items: true,
        vendor: true,
        jobsite_address: true,
      },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Validate readiness
    if (quote.items.length === 0) {
      throw new BadRequestException('Quote must have items before submission');
    }
    if (!quote.vendor_id) {
      throw new BadRequestException('Quote must have vendor before submission');
    }
    if (!quote.jobsite_address_id) {
      throw new BadRequestException(
        'Quote must have jobsite address before submission',
      );
    }
    if (quote.status === 'approved' || quote.status === 'pending_approval') {
      throw new BadRequestException('Quote already submitted or approved');
    }

    // Determine required approval levels
    const requiredLevels = await this.determineRequiredLevels(
      Number(quote.total),
      tenantId,
    );

    if (requiredLevels.length === 0) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { approval_thresholds: true },
      });

      const hasThresholds =
        tenant?.approval_thresholds &&
        (tenant.approval_thresholds as any).length > 0;

      if (!hasThresholds) {
        // No approval thresholds configured = approval workflow disabled
        // Auto-approve all quotes
        this.logger.log(
          `No approval thresholds configured for tenant ${tenantId} - auto-approving quote ${quoteId}`,
        );

        return {
          message: 'Approval workflow disabled - automatically approved',
          quote_total: Number(quote.total),
          approval_workflow_enabled: false,
          auto_approved: true,
        };
      }

      // Quote is below minimum threshold - auto-approve it
      const minThreshold = (tenant.approval_thresholds as any)[0]?.amount || 0;

      this.logger.log(
        `Quote ${quoteId} total ($${quote.total}) is below approval threshold ($${minThreshold}) - auto-approving`,
      );

      return {
        message:
          'Quote total is below approval threshold - automatically approved',
        quote_total: Number(quote.total),
        minimum_threshold: minThreshold,
        auto_approved: true,
      };
    }

    // Transaction: Create approvals + update status
    return await this.prisma.$transaction(async (tx) => {
      // Generate new workflow_id for this submission
      const workflowId = uuid();

      // Create approval records
      const approvals = await Promise.all(
        requiredLevels.map(async (level) => {
          // Find approver user by role
          const approver = await this.findApproverByRole(
            level.approver_role,
            tenantId,
            tx,
          );

          return tx.quote_approval.create({
            data: {
              id: uuid(),
              quote_id: quoteId,
              workflow_id: workflowId,
              approval_level: level.level,
              approver_user_id: approver.id,
              status: 'pending',
            },
            include: {
              approver_user: {
                select: {
                  id: true,
                  first_name: true,
                  last_name: true,
                  email: true,
                },
              },
            },
          });
        }),
      );

      // Update quote status
      await tx.quote.update({
        where: { id: quoteId },
        data: { status: 'pending_approval' },
      });

      // Create version (+1.0 major status change)
      await this.versionService.createVersion(
        quoteId,
        1.0,
        'Quote submitted for approval',
        userId,
        tx,
      );

      this.logger.log(`Quote submitted for approval: ${quoteId}`);

      return {
        quote_id: quoteId,
        status: 'pending_approval',
        total_amount: Number(quote.total),
        required_approvals: approvals.map((approval) => ({
          id: approval.id,
          level: approval.approval_level,
          approver: {
            id: approval.approver_user.id,
            name: `${approval.approver_user.first_name} ${approval.approver_user.last_name}`,
            email: approval.approver_user.email,
          },
          status: approval.status,
          threshold: requiredLevels.find(
            (l) => l.level === approval.approval_level,
          )?.amount,
        })),
        submitted_at: new Date(),
      };
    });

    // TODO: Send notification to first level approver
  }

  /**
   * Approve quote
   * Validates user is assigned approver
   * Checks previous levels approved (sequential approval)
   * If all levels approved, sets quote status to 'ready'
   *
   * @param approvalId - Approval UUID
   * @param dto - Approve quote DTO
   * @param userId - User UUID (approver)
   * @param tenantId - Tenant UUID
   * @returns Updated approval
   */
  async approve(
    approvalId: string,
    dto: ApproveQuoteDto,
    userId: string,
    tenantId: string,
  ): Promise<any> {
    // Fetch approval with quote
    const approval = await this.prisma.quote_approval.findFirst({
      where: { id: approvalId },
      include: {
        quote: true,
        approver_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!approval) {
      throw new NotFoundException('Approval not found');
    }

    if (approval.quote.tenant_id !== tenantId) {
      throw new ForbiddenException('Approval does not belong to your tenant');
    }

    // Validate user is assigned approver
    if (approval.approver_user_id !== userId) {
      throw new ForbiddenException('You are not the assigned approver');
    }

    if (approval.status !== 'pending') {
      throw new BadRequestException('Approval already decided');
    }

    // Check previous levels approved (sequential approval within same workflow)
    if (approval.approval_level > 1) {
      const previousLevel = await this.prisma.quote_approval.findFirst({
        where: {
          workflow_id: approval.workflow_id, // Same workflow only
          approval_level: approval.approval_level - 1,
        },
      });

      if (previousLevel?.status !== 'approved') {
        throw new BadRequestException(
          'Previous approval level not approved yet',
        );
      }
    }

    // Transaction: Update approval + check completion
    return await this.prisma.$transaction(async (tx) => {
      // Update approval
      const updatedApproval = await tx.quote_approval.update({
        where: { id: approvalId },
        data: {
          status: 'approved',
          comments: dto.comments,
          decided_at: new Date(),
        },
        include: {
          approver_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });

      // Check if all approvals complete for this workflow
      const allApprovals = await tx.quote_approval.findMany({
        where: {
          quote_id: approval.quote_id,
          workflow_id: approval.workflow_id, // Only check current workflow
        },
      });

      const allApproved = allApprovals.every((a) => a.status === 'approved');

      if (allApproved) {
        // All approvals complete - set quote to ready
        await tx.quote.update({
          where: { id: approval.quote_id },
          data: { status: 'ready' },
        });

        await this.versionService.createVersion(
          approval.quote_id,
          1.0,
          'All approvals complete - quote ready',
          userId,
          tx,
        );

        this.logger.log(`Quote fully approved: ${approval.quote_id}`);

        // TODO: Notify quote creator
      } else {
        // More approvals needed
        await this.versionService.createVersion(
          approval.quote_id,
          0.1,
          `Approval level ${approval.approval_level} approved`,
          userId,
          tx,
        );

        this.logger.log(
          `Quote approval level ${approval.approval_level} approved: ${approval.quote_id}`,
        );

        // TODO: Notify next level approver
      }

      return {
        id: updatedApproval.id,
        quote_id: updatedApproval.quote_id,
        approval_level: updatedApproval.approval_level,
        approver: {
          id: updatedApproval.approver_user.id,
          name: `${updatedApproval.approver_user.first_name} ${updatedApproval.approver_user.last_name}`,
          email: updatedApproval.approver_user.email,
        },
        status: updatedApproval.status,
        comments: updatedApproval.comments,
        decided_at: updatedApproval.decided_at,
        all_approved: allApproved,
      };
    });
  }

  /**
   * Reject quote
   * Requires comments explaining rejection
   * Marks all approvals as rejected (workflow terminated)
   * Sets quote status back to 'draft'
   *
   * @param approvalId - Approval UUID
   * @param dto - Reject quote DTO
   * @param userId - User UUID (rejector)
   * @param tenantId - Tenant UUID
   * @returns Updated approval with rejection reason
   */
  async reject(
    approvalId: string,
    dto: RejectQuoteDto,
    userId: string,
    tenantId: string,
  ): Promise<any> {
    // Fetch approval with quote
    const approval = await this.prisma.quote_approval.findFirst({
      where: { id: approvalId },
      include: {
        quote: true,
        approver_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
          },
        },
      },
    });

    if (!approval) {
      throw new NotFoundException('Approval not found');
    }

    if (approval.quote.tenant_id !== tenantId) {
      throw new ForbiddenException('Approval does not belong to your tenant');
    }

    // Validate user is assigned approver
    if (approval.approver_user_id !== userId) {
      throw new ForbiddenException('You are not the assigned approver');
    }

    if (approval.status !== 'pending') {
      throw new BadRequestException('Approval already decided');
    }

    // Transaction: Reject all approvals + update quote status
    return await this.prisma.$transaction(async (tx) => {
      // Update this approval
      const updatedApproval = await tx.quote_approval.update({
        where: { id: approvalId },
        data: {
          status: 'rejected',
          comments: dto.comments,
          decided_at: new Date(),
        },
        include: {
          approver_user: {
            select: {
              id: true,
              first_name: true,
              last_name: true,
              email: true,
            },
          },
        },
      });

      // Mark all other approvals in this workflow as rejected (workflow terminated)
      await tx.quote_approval.updateMany({
        where: {
          quote_id: approval.quote_id,
          workflow_id: approval.workflow_id, // Only affect current workflow
          id: { not: approvalId },
          status: 'pending',
        },
        data: {
          status: 'rejected',
          comments: 'Workflow terminated by rejection',
          decided_at: new Date(),
        },
      });

      // Update quote status to draft
      await tx.quote.update({
        where: { id: approval.quote_id },
        data: { status: 'draft' },
      });

      // Create version (+1.0 major status change)
      await this.versionService.createVersion(
        approval.quote_id,
        1.0,
        `Quote rejected: ${dto.comments}`,
        userId,
        tx,
      );

      this.logger.log(`Quote rejected: ${approval.quote_id}`);

      // TODO: Notify quote creator with rejection reason

      return {
        id: updatedApproval.id,
        quote_id: updatedApproval.quote_id,
        approval_level: updatedApproval.approval_level,
        approver: {
          id: updatedApproval.approver_user.id,
          name: `${updatedApproval.approver_user.first_name} ${updatedApproval.approver_user.last_name}`,
          email: updatedApproval.approver_user.email,
        },
        status: updatedApproval.status,
        comments: updatedApproval.comments,
        decided_at: updatedApproval.decided_at,
      };
    });
  }

  /**
   * Get approval status for quote
   * Returns current workflow approvals with progress
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @returns Approval status with progress for current workflow
   */
  async getApprovals(quoteId: string, tenantId: string): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Get current workflow_id (most recent approval)
    const latestApproval = await this.prisma.quote_approval.findFirst({
      where: { quote_id: quoteId },
      orderBy: { created_at: 'desc' },
      select: { workflow_id: true },
    });

    if (!latestApproval) {
      // No approvals yet
      return {
        quote_id: quoteId,
        status: quote.status,
        workflow_id: null,
        approvals: [],
        progress: {
          completed: 0,
          total: 0,
          percentage: 0,
        },
      };
    }

    // Get all approvals for current workflow
    const approvals = await this.prisma.quote_approval.findMany({
      where: {
        quote_id: quoteId,
        workflow_id: latestApproval.workflow_id,
      },
      include: {
        approver_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: { approval_level: 'asc' },
    });

    const completedCount = approvals.filter(
      (a) => a.status === 'approved',
    ).length;
    const totalCount = approvals.length;

    return {
      quote_id: quoteId,
      status: quote.status,
      workflow_id: latestApproval.workflow_id,
      approvals: approvals.map((approval) => ({
        id: approval.id,
        workflow_id: approval.workflow_id,
        level: approval.approval_level,
        approver: {
          id: approval.approver_user.id,
          name: `${approval.approver_user.first_name} ${approval.approver_user.last_name}`,
          email: approval.approver_user.email,
        },
        status: approval.status,
        comments: approval.comments,
        decided_at: approval.decided_at,
        created_at: approval.created_at,
      })),
      progress: {
        completed: completedCount,
        total: totalCount,
        percentage: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
      },
    };
  }

  /**
   * Get approval history for quote
   * Returns ALL workflows with complete audit trail
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @returns Complete approval history grouped by workflow
   */
  async getApprovalHistory(quoteId: string, tenantId: string): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    // Get all approvals for this quote, grouped by workflow
    const allApprovals = await this.prisma.quote_approval.findMany({
      where: { quote_id: quoteId },
      include: {
        approver_user: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: [{ created_at: 'asc' }, { approval_level: 'asc' }],
    });

    if (allApprovals.length === 0) {
      return {
        quote_id: quoteId,
        workflows: [],
        total_workflows: 0,
        current_workflow_id: null,
      };
    }

    // Group approvals by workflow_id
    const workflowMap = new Map<string, any[]>();
    allApprovals.forEach((approval) => {
      if (!workflowMap.has(approval.workflow_id)) {
        workflowMap.set(approval.workflow_id, []);
      }
      workflowMap.get(approval.workflow_id)!.push(approval);
    });

    // Get current workflow_id (most recent)
    const currentWorkflowId = allApprovals[allApprovals.length - 1].workflow_id;

    // Transform into workflow objects
    const workflows = Array.from(workflowMap.entries()).map(
      ([workflowId, approvals]) => {
        const submittedAt = approvals[0].created_at;

        // Determine overall workflow status
        let workflowStatus: 'pending' | 'approved' | 'rejected';
        if (approvals.some((a) => a.status === 'rejected')) {
          workflowStatus = 'rejected';
        } else if (approvals.every((a) => a.status === 'approved')) {
          workflowStatus = 'approved';
        } else {
          workflowStatus = 'pending';
        }

        return {
          workflow_id: workflowId,
          submitted_at: submittedAt,
          status: workflowStatus,
          is_current: workflowId === currentWorkflowId,
          approvals: approvals.map((approval) => ({
            id: approval.id,
            level: approval.approval_level,
            approver: {
              id: approval.approver_user.id,
              name: `${approval.approver_user.first_name} ${approval.approver_user.last_name}`,
              email: approval.approver_user.email,
            },
            status: approval.status,
            comments: approval.comments,
            decided_at: approval.decided_at,
            created_at: approval.created_at,
          })),
          progress: {
            completed: approvals.filter((a) => a.status === 'approved').length,
            total: approvals.length,
            percentage:
              (approvals.filter((a) => a.status === 'approved').length /
                approvals.length) *
              100,
          },
        };
      },
    );

    // Sort workflows by submission date (newest first)
    workflows.sort(
      (a, b) => b.submitted_at.getTime() - a.submitted_at.getTime(),
    );

    return {
      quote_id: quoteId,
      workflows,
      total_workflows: workflows.length,
      current_workflow_id: currentWorkflowId,
    };
  }

  /**
   * Get pending approvals for current user
   * Returns quotes awaiting user's approval
   *
   * @param userId - User UUID
   * @param tenantId - Tenant UUID
   * @returns List of pending approvals
   */
  async getPendingForUser(userId: string, tenantId: string): Promise<any> {
    const approvals = await this.prisma.quote_approval.findMany({
      where: {
        approver_user_id: userId,
        status: 'pending',
        // Only filter by tenant_id if provided (system admins have no tenant)
        ...(tenantId && {
          quote: {
            tenant_id: tenantId,
          },
        }),
      },
      include: {
        quote: {
          select: {
            id: true,
            quote_number: true,
            title: true,
            total: true,
            created_at: true,
            created_by_user: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
            lead: {
              select: {
                id: true,
                first_name: true,
                last_name: true,
              },
            },
          },
        },
      },
      orderBy: { approval_level: 'asc' },
    });

    return {
      pending_approvals: approvals.map((approval) => ({
        approval_id: approval.id,
        workflow_id: approval.workflow_id,
        quote_id: approval.quote.id,
        quote_number: approval.quote.quote_number,
        quote_title: approval.quote.title,
        quote_total: Number(approval.quote.total),
        level: approval.approval_level,
        submitted_at: approval.created_at.toISOString(),
        submitted_by: {
          id: approval.quote.created_by_user?.id || 'unknown',
          name: approval.quote.created_by_user
            ? `${approval.quote.created_by_user.first_name} ${approval.quote.created_by_user.last_name}`
            : 'Unknown User',
        },
      })),
      count: approvals.length,
    };
  }

  /**
   * Bypass approval (owner override)
   * Marks all pending approvals as approved
   * Sets quote status to 'ready'
   * Only owners can bypass
   *
   * @param quoteId - Quote UUID
   * @param dto - Bypass approval DTO
   * @param userId - User UUID (owner)
   * @param tenantId - Tenant UUID
   * @returns Updated quote
   */
  async bypassApproval(
    quoteId: string,
    dto: BypassApprovalDto,
    userId: string,
    tenantId: string,
  ): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status !== 'pending_approval') {
      throw new BadRequestException('Quote is not pending approval');
    }

    // Get current workflow_id
    const latestApproval = await this.prisma.quote_approval.findFirst({
      where: { quote_id: quoteId },
      orderBy: { created_at: 'desc' },
      select: { workflow_id: true },
    });

    if (!latestApproval) {
      throw new BadRequestException('No approval workflow found');
    }

    // Transaction: Mark all approvals as approved
    return await this.prisma.$transaction(async (tx) => {
      // Mark all pending approvals in current workflow as approved
      await tx.quote_approval.updateMany({
        where: {
          quote_id: quoteId,
          workflow_id: latestApproval.workflow_id, // Only current workflow
          status: 'pending',
        },
        data: {
          status: 'approved',
          approver_user_id: userId,
          comments: `Bypassed by owner: ${dto.reason}`,
          decided_at: new Date(),
        },
      });

      // Update quote status
      await tx.quote.update({
        where: { id: quoteId },
        data: { status: 'ready' },
      });

      // Create version (+1.0)
      await this.versionService.createVersion(
        quoteId,
        1.0,
        `Approval bypassed by owner: ${dto.reason}`,
        userId,
        tx,
      );

      this.logger.log(`Quote approval bypassed: ${quoteId}`);

      return {
        quote_id: quoteId,
        status: 'ready',
        bypassed_by: userId,
        reason: dto.reason,
        bypassed_at: new Date(),
      };
    });
  }

  /**
   * Configure approval thresholds for tenant
   * Updates tenant.approval_thresholds JSON field
   *
   * @param dto - Update approval thresholds DTO
   * @param tenantId - Tenant UUID
   * @returns Updated thresholds
   */
  async configureThresholds(
    dto: UpdateApprovalThresholdsDto,
    tenantId: string,
  ): Promise<any> {
    // If empty array, disable approval workflow (set to null)
    if (dto.thresholds.length === 0) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          approval_thresholds: Prisma.JsonNull,
        },
      });

      this.logger.log(
        `Approval workflow disabled for tenant: ${tenantId} (empty thresholds)`,
      );

      return {
        message:
          'Approval workflow disabled - all quotes will be auto-approved',
        thresholds: [],
        approval_workflow_enabled: false,
        updated_at: new Date(),
      };
    }

    // Validate amounts are ascending
    const sortedThresholds = [...dto.thresholds].sort(
      (a, b) => a.amount - b.amount,
    );
    for (let i = 0; i < sortedThresholds.length; i++) {
      if (sortedThresholds[i].level !== i + 1) {
        throw new BadRequestException(
          'Threshold levels must be sequential (1, 2, 3...)',
        );
      }
    }

    // Update tenant
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        approval_thresholds: dto.thresholds as any,
      },
    });

    this.logger.log(`Approval thresholds updated for tenant: ${tenantId}`);

    return {
      message: 'Approval thresholds configured successfully',
      thresholds: dto.thresholds,
      approval_workflow_enabled: true,
      updated_at: new Date(),
    };
  }

  /**
   * Reset approvals (auto-trigger when quote modified)
   * Deletes or marks approvals as obsolete
   * Changes quote status back to draft
   *
   * @param quoteId - Quote UUID
   * @param tenantId - Tenant UUID
   * @returns Success message
   */
  async resetApprovals(quoteId: string, tenantId: string): Promise<any> {
    const quote = await this.prisma.quote.findFirst({
      where: { id: quoteId, tenant_id: tenantId },
      include: { approvals: true },
    });

    if (!quote) {
      throw new NotFoundException('Quote not found');
    }

    if (quote.status !== 'pending_approval' && quote.status !== 'ready') {
      // Quote not in approval process, nothing to reset
      return { message: 'No approvals to reset' };
    }

    // Transaction: Delete approvals + update status
    await this.prisma.$transaction(async (tx) => {
      // Delete all approval records
      await tx.quote_approval.deleteMany({
        where: { quote_id: quoteId },
      });

      // Update quote status to draft
      await tx.quote.update({
        where: { id: quoteId },
        data: { status: 'draft' },
      });

      this.logger.log(`Approvals reset for quote: ${quoteId}`);
    });

    // TODO: Notify previous approvers that quote changed

    return {
      message: 'Approvals reset - quote returned to draft',
      quote_id: quoteId,
    };
  }

  /**
   * Determine required approval levels based on quote total
   * Fetches tenant approval thresholds
   * Returns all levels where quote total >= threshold amount
   *
   * @param quoteTotal - Quote total amount
   * @param tenantId - Tenant UUID
   * @returns Required approval levels
   */
  private async determineRequiredLevels(
    quoteTotal: number,
    tenantId: string,
  ): Promise<ApprovalThreshold[]> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { approval_thresholds: true },
    });

    // Default thresholds if not configured
    const thresholds: ApprovalThreshold[] =
      (tenant?.approval_thresholds as any as ApprovalThreshold[]) || [
        { level: 1, amount: 10000, approver_role: 'Manager' },
        { level: 2, amount: 50000, approver_role: 'Owner' },
      ];

    // Find all thresholds that quote total exceeds
    return thresholds.filter((t) => quoteTotal >= t.amount);
  }

  /**
   * Find approver user by role
   * Returns first active user with specified role in tenant
   *
   * @param role - User role
   * @param tenantId - Tenant UUID
   * @param tx - Transaction client
   * @returns User
   */
  private async findApproverByRole(
    role: string,
    tenantId: string,
    tx: Prisma.TransactionClient,
  ): Promise<any> {
    // Find user with role in tenant
    const userRole = await tx.user_role.findFirst({
      where: {
        tenant_id: tenantId,
        role: {
          name: role,
        },
        user_user_role_user_idTouser: {
          is_active: true,
        },
      },
      include: {
        user_user_role_user_idTouser: {
          select: {
            id: true,
            first_name: true,
            last_name: true,
            email: true,
          },
        },
      },
      orderBy: { created_at: 'asc' }, // First user with role
    });

    if (!userRole) {
      throw new BadRequestException(
        `No active user with role ${role} found in tenant`,
      );
    }

    return userRole.user_user_role_user_idTouser;
  }
}
