import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
  ParseUUIDPipe,
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
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ReceiptService } from '../services/receipt.service';
import { UploadReceiptDto } from '../dto/upload-receipt.dto';
import { UpdateReceiptDto } from '../dto/update-receipt.dto';
import { LinkReceiptDto } from '../dto/link-receipt.dto';
import { ListReceiptsDto } from '../dto/list-receipts.dto';

/**
 * Receipt endpoints (all under /api/v1/financial/receipts)
 *
 * POST   /financial/receipts          — Upload a receipt file
 * GET    /financial/receipts          — List receipts (project or task scoped)
 * GET    /financial/receipts/:id      — Get single receipt
 * PATCH  /financial/receipts/:id/link — Link receipt to financial entry
 * PATCH  /financial/receipts/:id      — Update receipt metadata
 */
@ApiTags('Financial Receipts')
@ApiBearerAuth()
@Controller('financial/receipts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReceiptController {
  constructor(private readonly receiptService: ReceiptService) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /financial/receipts
  // ─────────────────────────────────────────────────────────────────────────────

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload a receipt',
    description:
      'Upload a receipt image (jpg/png/webp) or PDF (max 25 MB). ' +
      'Optionally associate with a project and/or task at upload time. ' +
      'OCR is reserved for Phase 2 — ocr_status is always not_processed.',
  })
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
        project_id: { type: 'string', format: 'uuid' },
        task_id: { type: 'string', format: 'uuid' },
        vendor_name: { type: 'string', maxLength: 200 },
        amount: { type: 'number', example: 125.5 },
        receipt_date: { type: 'string', format: 'date', example: '2026-03-10' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Receipt uploaded successfully' })
  @ApiResponse({ status: 400, description: 'Invalid file type/size or validation error' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async uploadReceipt(
    @Request() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadReceiptDto,
  ) {
    if (!file) {
      throw new BadRequestException(
        'No file uploaded. Include a file field in multipart/form-data.',
      );
    }
    return this.receiptService.uploadReceipt(
      req.user.tenant_id,
      req.user.id,
      file,
      dto,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /financial/receipts
  // ─────────────────────────────────────────────────────────────────────────────

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'List receipts',
    description:
      'Returns paginated receipts filtered by project_id and/or task_id. ' +
      'At least one of project_id or task_id is required.',
  })
  @ApiQuery({ name: 'project_id', required: false, type: String, description: 'Filter by project UUID' })
  @ApiQuery({ name: 'task_id', required: false, type: String, description: 'Filter by task UUID' })
  @ApiQuery({ name: 'is_categorized', required: false, type: Boolean, description: 'Filter by categorization status' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated list of receipts' })
  @ApiResponse({ status: 400, description: 'project_id or task_id is required' })
  async listReceipts(@Request() req, @Query() query: ListReceiptsDto) {
    return this.receiptService.getProjectReceipts(req.user.tenant_id, query);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /financial/receipts/:id
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Get a single receipt by ID' })
  @ApiParam({ name: 'id', description: 'Receipt UUID' })
  @ApiResponse({ status: 200, description: 'Receipt details' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async getReceipt(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptService.getReceiptById(req.user.tenant_id, id);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /financial/receipts/:id/link
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch(':id/link')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Link a receipt to a financial entry',
    description:
      'Links this receipt to a financial entry (1:1). ' +
      'Sets receipt.is_categorized=true and financial_entry.has_receipt=true. ' +
      'Both the receipt and the entry must belong to the same tenant.',
  })
  @ApiParam({ name: 'id', description: 'Receipt UUID' })
  @ApiResponse({ status: 200, description: 'Receipt linked to financial entry' })
  @ApiResponse({ status: 400, description: 'Already linked or entry already has a receipt' })
  @ApiResponse({ status: 404, description: 'Receipt or financial entry not found' })
  async linkReceipt(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkReceiptDto,
  ) {
    return this.receiptService.linkReceiptToEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PATCH /financial/receipts/:id
  // ─────────────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Update receipt metadata',
    description:
      'Update manually-entered fields: vendor_name, amount, receipt_date. ' +
      'File data and OCR fields cannot be updated. All fields are optional.',
  })
  @ApiParam({ name: 'id', description: 'Receipt UUID' })
  @ApiResponse({ status: 200, description: 'Receipt metadata updated' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async updateReceipt(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReceiptDto,
  ) {
    return this.receiptService.updateReceipt(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }
}
