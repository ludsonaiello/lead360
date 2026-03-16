import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TaskFinancialService } from '../services/task-financial.service';
import { CreateTaskCostEntryDto } from '../dto/create-task-cost-entry.dto';
import { UploadReceiptDto } from '../../financial/dto/upload-receipt.dto';

/**
 * Task-level financial endpoints — Sprint 28
 *
 * POST   /projects/:projectId/tasks/:taskId/costs     — Create cost entry
 * GET    /projects/:projectId/tasks/:taskId/costs     — List cost entries
 * POST   /projects/:projectId/tasks/:taskId/receipts  — Upload receipt
 * GET    /projects/:projectId/tasks/:taskId/receipts  — List receipts
 */
@ApiTags('Task Financial')
@ApiBearerAuth()
@Controller('projects/:projectId/tasks/:taskId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TaskFinancialController {
  constructor(
    private readonly taskFinancialService: TaskFinancialService,
  ) {}

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/tasks/:taskId/costs — Create cost entry
  // -------------------------------------------------------------------------
  @Post('costs')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a cost entry for a task',
    description:
      'Creates a financial entry pre-filled with project_id and task_id from the URL. ' +
      'Delegates to FinancialEntryService.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 201, description: 'Cost entry created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error or invalid category' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project or task not found' })
  async createCostEntry(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body() dto: CreateTaskCostEntryDto,
  ) {
    return this.taskFinancialService.createTaskCostEntry(
      tenantId,
      userId,
      projectId,
      taskId,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/tasks/:taskId/costs — List cost entries
  // -------------------------------------------------------------------------
  @Get('costs')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'List cost entries for a task',
    description:
      'Returns all financial entries linked to the specified task. ' +
      'Ordered by entry_date descending.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'List of cost entries for the task' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project or task not found' })
  async listCostEntries(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.taskFinancialService.getTaskCostEntries(
      tenantId,
      projectId,
      taskId,
    );
  }

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/tasks/:taskId/receipts — Upload receipt
  // -------------------------------------------------------------------------
  @Post('receipts')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload a receipt for a task',
    description:
      'Upload a receipt image (jpg/png/webp) or PDF (max 25 MB) pre-filled with ' +
      'project_id and task_id from the URL. Delegates to ReceiptService.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Receipt file (jpg, png, webp, pdf — max 25 MB)',
        },
        vendor_name: { type: 'string', maxLength: 200 },
        amount: { type: 'number', example: 125.5 },
        receipt_date: { type: 'string', format: 'date', example: '2026-03-10' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Receipt uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type/size or validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project or task not found' })
  async uploadReceipt(
    @TenantId() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadReceiptDto,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Include a file field in multipart/form-data.',
      );
    }
    return this.taskFinancialService.uploadTaskReceipt(
      tenantId,
      userId,
      projectId,
      taskId,
      file,
      {
        vendor_name: dto.vendor_name,
        amount: dto.amount,
        receipt_date: dto.receipt_date,
      },
    );
  }

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/tasks/:taskId/receipts — List receipts
  // -------------------------------------------------------------------------
  @Get('receipts')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'List receipts for a task',
    description:
      'Returns all receipts linked to the specified task. ' +
      'Ordered by created_at descending.',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'taskId', description: 'Task UUID' })
  @ApiResponse({ status: 200, description: 'List of receipts for the task' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({ status: 404, description: 'Project or task not found' })
  async listReceipts(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ) {
    return this.taskFinancialService.getTaskReceipts(
      tenantId,
      projectId,
      taskId,
    );
  }
}
