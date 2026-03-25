import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { FinancialEntryService } from '../../financial/services/financial-entry.service';
import { ReceiptService } from '../../financial/services/receipt.service';
import { CreateTaskCostEntryDto } from '../dto/create-task-cost-entry.dto';

@Injectable()
export class TaskFinancialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financialEntryService: FinancialEntryService,
    private readonly receiptService: ReceiptService,
  ) {}

  // ---------------------------------------------------------------------------
  // 1. createTaskCostEntry
  // ---------------------------------------------------------------------------

  /**
   * Create a cost entry pre-filled with project_id and task_id from URL params.
   * Validates that the task belongs to the project and both belong to the tenant.
   */
  async createTaskCostEntry(
    tenantId: string,
    userId: string,
    userRoles: string[],
    projectId: string,
    taskId: string,
    dto: CreateTaskCostEntryDto,
  ) {
    await this.validateTaskBelongsToProject(tenantId, projectId, taskId);

    return this.financialEntryService.createEntry(tenantId, userId, userRoles, {
      project_id: projectId,
      task_id: taskId,
      category_id: dto.category_id,
      entry_type: 'expense',
      amount: dto.amount,
      entry_date: dto.entry_date,
      vendor_name: dto.vendor_name,
      purchased_by_crew_member_id: dto.crew_member_id,
      notes: dto.notes,
    });
  }

  // ---------------------------------------------------------------------------
  // 2. getTaskCostEntries
  // ---------------------------------------------------------------------------

  /**
   * List all cost entries for a specific task within a project.
   * Validates task ownership first.
   */
  async getTaskCostEntries(
    tenantId: string,
    projectId: string,
    taskId: string,
  ) {
    await this.validateTaskBelongsToProject(tenantId, projectId, taskId);

    return this.financialEntryService.getTaskEntries(tenantId, taskId);
  }

  // ---------------------------------------------------------------------------
  // 3. uploadTaskReceipt
  // ---------------------------------------------------------------------------

  /**
   * Upload a receipt pre-filled with project_id and task_id from URL params.
   * Validates task ownership first, then delegates to ReceiptService.
   */
  async uploadTaskReceipt(
    tenantId: string,
    userId: string,
    projectId: string,
    taskId: string,
    file: Express.Multer.File,
    dto: { vendor_name?: string; amount?: number; receipt_date?: string },
  ) {
    await this.validateTaskBelongsToProject(tenantId, projectId, taskId);

    return this.receiptService.uploadReceipt(tenantId, userId, file, {
      project_id: projectId,
      task_id: taskId,
      vendor_name: dto.vendor_name,
      amount: dto.amount,
      receipt_date: dto.receipt_date,
    });
  }

  // ---------------------------------------------------------------------------
  // 4. getTaskReceipts
  // ---------------------------------------------------------------------------

  /**
   * List all receipts for a specific task within a project.
   * Validates task ownership first.
   */
  async getTaskReceipts(
    tenantId: string,
    projectId: string,
    taskId: string,
  ) {
    await this.validateTaskBelongsToProject(tenantId, projectId, taskId);

    return this.receiptService.getTaskReceipts(tenantId, taskId);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Validate that a task exists, belongs to the specified project,
   * and both belong to the tenant. Throws if not.
   */
  private async validateTaskBelongsToProject(
    tenantId: string,
    projectId: string,
    taskId: string,
  ) {
    // First verify project exists for this tenant
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, tenant_id: tenantId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Then verify task belongs to this project and tenant
    const task = await this.prisma.project_task.findFirst({
      where: {
        id: taskId,
        project_id: projectId,
        tenant_id: tenantId,
        deleted_at: null,
      },
      select: { id: true },
    });

    if (!task) {
      throw new NotFoundException('Task not found in this project');
    }
  }
}
