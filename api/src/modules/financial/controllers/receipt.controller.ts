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
  UseInterceptors,
  UploadedFile,
  Request,
  ParseUUIDPipe,
  BadRequestException,
  HttpCode,
  HttpStatus,
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
import { CreateEntryFromReceiptDto } from '../dto/create-entry-from-receipt.dto';

/**
 * Receipt endpoints (all under /api/v1/financial/receipts)
 *
 * POST   /financial/receipts              — Upload a receipt file
 * GET    /financial/receipts              — List receipts (project or task scoped)
 * GET    /financial/receipts/:id/ocr-status    — Get OCR processing status
 * POST   /financial/receipts/:id/create-entry  — Create entry from OCR data
 * POST   /financial/receipts/:id/retry-ocr     — Retry failed OCR processing
 * GET    /financial/receipts/:id              — Get single receipt
 * PATCH  /financial/receipts/:id/link         — Link receipt to financial entry
 * PATCH  /financial/receipts/:id              — Update receipt metadata
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
      'After upload, OCR processing is automatically enqueued. ' +
      'The response returns ocr_status = processing. ' +
      'Poll GET /financial/receipts/:id/ocr-status to check completion.',
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
      'Returns paginated receipts. Optionally filter by project_id, task_id, or categorization status.',
  })
  @ApiQuery({ name: 'project_id', required: false, type: String, description: 'Filter by project UUID' })
  @ApiQuery({ name: 'task_id', required: false, type: String, description: 'Filter by task UUID' })
  @ApiQuery({ name: 'is_categorized', required: false, type: Boolean, description: 'Filter by categorization status' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Paginated list of receipts' })
  async listReceipts(@Request() req, @Query() query: ListReceiptsDto) {
    return this.receiptService.getProjectReceipts(req.user.tenant_id, query);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // GET /financial/receipts/:id/ocr-status
  // ─────────────────────────────────────────────────────────────────────────────

  @Get(':id/ocr-status')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field')
  @ApiOperation({
    summary: 'Get OCR processing status for a receipt',
    description:
      'Poll this endpoint after upload to check OCR completion. ' +
      'Frontend should poll at 2-second intervals, up to 30 seconds (15 attempts). ' +
      'If still processing after 30 seconds, display manual entry form as fallback. ' +
      'Employee (Field) role can only access their own receipts.',
  })
  @ApiParam({ name: 'id', description: 'Receipt UUID' })
  @ApiResponse({
    status: 200,
    description: 'OCR status and parsed fields',
    schema: {
      type: 'object',
      properties: {
        receipt_id: { type: 'string', format: 'uuid' },
        ocr_status: {
          type: 'string',
          enum: ['not_processed', 'processing', 'complete', 'failed'],
        },
        ocr_vendor: { type: 'string', nullable: true },
        ocr_amount: { type: 'number', nullable: true },
        ocr_date: { type: 'string', format: 'date', nullable: true },
        has_suggestions: {
          type: 'boolean',
          description: 'True if at least one OCR field was successfully parsed',
        },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async getOcrStatus(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptService.getOcrStatus(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /financial/receipts/:id/create-entry
  // ─────────────────────────────────────────────────────────────────────────────

  @Post(':id/create-entry')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Field')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create a financial entry from OCR-parsed receipt data',
    description:
      'Creates a financial entry pre-populated from OCR suggestions. ' +
      'The frontend pre-fills the form with OCR data; the user reviews, edits, and submits. ' +
      'OCR fields are used as fallback when request body fields are not provided. ' +
      'The receipt is automatically linked to the created entry (1:1). ' +
      'Returns 400 if the receipt is already linked to an entry.',
  })
  @ApiParam({ name: 'id', description: 'Receipt UUID' })
  @ApiResponse({
    status: 201,
    description: 'Financial entry created and receipt linked',
    schema: {
      type: 'object',
      properties: {
        entry: {
          type: 'object',
          description: 'The created financial entry (full enriched shape)',
        },
        receipt: {
          type: 'object',
          description: 'The linked receipt with updated status',
        },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Receipt already linked or validation error' })
  @ApiResponse({ status: 404, description: 'Receipt or category not found' })
  async createEntryFromReceipt(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateEntryFromReceiptDto,
  ) {
    return this.receiptService.createEntryFromReceipt(
      req.user.tenant_id,
      id,
      req.user.id,
      req.user.roles,
      dto,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // POST /financial/receipts/:id/retry-ocr
  // ─────────────────────────────────────────────────────────────────────────────

  @Post(':id/retry-ocr')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Retry OCR processing for a receipt',
    description:
      'Re-triggers OCR processing for a receipt that failed or was not processed. ' +
      'Resets all OCR fields and enqueues a new processing job. ' +
      'Only available for receipts with ocr_status = failed or not_processed. ' +
      'Returns 400 if receipt is currently processing or already complete. ' +
      'Not available to Employee (Field) role.',
  })
  @ApiParam({ name: 'id', description: 'Receipt UUID' })
  @ApiResponse({
    status: 200,
    description: 'OCR retry triggered — receipt returned with ocr_status = processing',
  })
  @ApiResponse({ status: 400, description: 'Receipt is currently processing or already complete' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async retryOcr(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptService.retryOcr(
      req.user.tenant_id,
      id,
      req.user.id,
    );
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

  @Patch(':id/unlink')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Unlink a receipt from its financial entry',
    description:
      'Removes the link between a receipt and its financial entry. ' +
      'Sets receipt.is_categorized=false and financial_entry.has_receipt=false.',
  })
  @ApiParam({ name: 'id', description: 'Receipt UUID' })
  @ApiResponse({ status: 200, description: 'Receipt unlinked' })
  @ApiResponse({ status: 400, description: 'Receipt is not linked to any entry' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async unlinkReceipt(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptService.unlinkReceiptFromEntry(
      req.user.tenant_id,
      id,
      req.user.id,
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

  @Delete(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Delete an unlinked receipt',
    description:
      'Deletes a receipt and its associated file. Only receipts NOT linked to a financial entry can be deleted.',
  })
  @ApiParam({ name: 'id', description: 'Receipt UUID' })
  @ApiResponse({ status: 200, description: 'Receipt and file deleted' })
  @ApiResponse({ status: 400, description: 'Receipt is linked to a financial entry' })
  @ApiResponse({ status: 404, description: 'Receipt not found' })
  async deleteReceipt(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.receiptService.deleteReceipt(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
