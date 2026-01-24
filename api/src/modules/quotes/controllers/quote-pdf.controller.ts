import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
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
  @ApiOperation({ summary: 'Generate PDF for quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'PDF generated successfully', type: PdfResponseDto })
  @ApiResponse({ status: 400, description: 'Quote not ready (missing data)' })
  @ApiResponse({ status: 500, description: 'PDF generation failed' })
  async generatePdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GeneratePdfDto,
    @Request() req,
  ): Promise<PdfResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    this.logger.log(`Generating PDF for quote ${id} (tenant: ${tenantId}, user: ${userId})`);

    const result = await this.pdfService.generatePdf(tenantId, id, userId);

    this.logger.log(`PDF generated successfully for quote ${id} (file: ${result.file_id})`);

    return result;
  }

  @Get(':id/download-pdf')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get PDF download URL for quote' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'PDF download URL returned', type: PdfResponseDto })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Request() req,
  ): Promise<PdfResponseDto> {
    const tenantId = req.user.tenant_id;
    const userId = req.user.user_id;

    this.logger.log(`Getting PDF download URL for quote ${id} (tenant: ${tenantId})`);

    // For now, just regenerate the PDF
    // TODO: In future, check if PDF exists and return cached version
    const result = await this.pdfService.generatePdf(tenantId, id, userId);

    return result;
  }
}
