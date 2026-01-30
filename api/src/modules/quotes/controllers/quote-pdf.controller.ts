import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseBoolPipe,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { QuotePdfGeneratorService } from '../services/quote-pdf-generator.service';
import { GeneratePdfDto } from '../dto/pdf/generate-pdf.dto';
import { PdfResponseDto } from '../dto/pdf/pdf-response.dto';

/**
 * QuotePdfController
 *
 * PDF generation and download endpoints
 *
 * @author Developer 5
 */
@ApiTags('Quotes - PDF Generation')
@ApiBearerAuth()
@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuotePdfController {
  private readonly logger = new Logger(QuotePdfController.name);

  constructor(private readonly pdfService: QuotePdfGeneratorService) {}

  @Post(':id/generate-pdf')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generate PDF for quote',
    description: 'Generates PDF with optional cost breakdown. Returns cached PDF if available and unchanged, or regenerates if force_regenerate=true or quote content changed.',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'PDF generated successfully (or cached PDF returned)', type: PdfResponseDto })
  @ApiResponse({ status: 400, description: 'Quote not ready (missing data)' })
  @ApiResponse({ status: 500, description: 'PDF generation failed' })
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GeneratePdfDto,
    @Request() req,
  ): Promise<PdfResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    this.logger.log(`Generating PDF for quote ${id} (tenant: ${tenantId}, user: ${userId}, include_cost_breakdown: ${dto.include_cost_breakdown || false}, force: ${dto.force_regenerate || false})`);

    const result = await this.pdfService.generatePdf(
      tenantId,
      id,
      userId,
      dto.include_cost_breakdown || false,
      dto.force_regenerate || false, // Pass force_regenerate flag
    );

    if (result.regenerated) {
      this.logger.log(`PDF generated successfully for quote ${id} (file: ${result.file_id})`);
    } else {
      this.logger.log(`Returned cached PDF for quote ${id} (file: ${result.file_id})`);
    }

    return result;
  }

  @Get(':id/download-pdf')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get PDF download URL for quote',
    description: 'Returns existing PDF if available and up-to-date. Generates new PDF only if needed. Fast response time for cached PDFs.',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'PDF download URL returned', type: PdfResponseDto })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ): Promise<PdfResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    this.logger.log(`Getting PDF download URL for quote ${id} (tenant: ${tenantId})`);

    // Returns cached PDF if available and up-to-date, regenerates only if needed
    const result = await this.pdfService.generatePdf(tenantId, id, userId, false, false);

    if (result.regenerated) {
      this.logger.log(`Generated new PDF for download: ${result.file_id}`);
    } else {
      this.logger.log(`Returned cached PDF for download: ${result.file_id}`);
    }

    return result;
  }

  @Get(':id/preview-pdf')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview PDF without regeneration',
    description: 'Returns existing PDF if available, generates only if missing or stale. Optimized for fast response time (<100ms for cached PDFs). Never forces regeneration.',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'PDF preview URL returned', type: PdfResponseDto })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async previewPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
    @Query('include_cost_breakdown', new ParseBoolPipe({ optional: true })) includeCostBreakdown?: boolean,
  ): Promise<PdfResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.id;

    this.logger.log(`Previewing PDF for quote ${id} (tenant: ${tenantId}, include_cost_breakdown: ${includeCostBreakdown || false})`);

    // ALWAYS returns cached PDF if valid, generates only if needed, NEVER forces regeneration
    const result = await this.pdfService.generatePdf(
      tenantId,
      id,
      userId,
      includeCostBreakdown || false,
      false, // Never force regenerate on preview
    );

    if (result.regenerated) {
      this.logger.log(`Generated new PDF for preview: ${result.file_id}`);
    } else {
      this.logger.log(`Returned cached PDF for preview: ${result.file_id} (instant)`);
    }

    return result;
  }
}
