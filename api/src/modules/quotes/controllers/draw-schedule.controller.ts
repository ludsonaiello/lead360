import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
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
import { DrawScheduleService } from '../services/draw-schedule.service';
import { CreateDrawScheduleDto } from '../dto/draw-schedule';

@ApiTags('Quotes - Draw Schedule')
@ApiBearerAuth()
@Controller('quotes/:quoteId/draw-schedule')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DrawScheduleController {
  private readonly logger = new Logger(DrawScheduleController.name);

  constructor(private readonly drawScheduleService: DrawScheduleService) {}

  // ========== DRAW SCHEDULE MANAGEMENT ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Create draw schedule (payment schedule throughout project)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 201,
    description: 'Draw schedule created successfully',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({
    status: 400,
    description:
      'Percentage entries must sum to 100% / Draw numbers must be sequential',
  })
  async create(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: CreateDrawScheduleDto,
  ) {
    return this.drawScheduleService.create(
      quoteId,
      dto,
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Field')
  @ApiOperation({
    summary: 'Get draw schedule with calculated amounts and validation',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description:
      'Draw schedule with calculated amounts, running totals, and validation',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async findByQuote(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    return this.drawScheduleService.findByQuote(quoteId, req.user.tenant_id);
  }

  @Patch()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Update draw schedule (replaces entire schedule)',
  })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 200,
    description: 'Draw schedule updated successfully',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({
    status: 400,
    description:
      'Percentage entries must sum to 100% / Draw numbers must be sequential',
  })
  async update(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
    @Body() dto: CreateDrawScheduleDto,
  ) {
    return this.drawScheduleService.update(
      quoteId,
      dto,
      req.user.tenant_id,
      req.user.id,
    );
  }

  @Delete()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete draw schedule (removes all entries)' })
  @ApiParam({ name: 'quoteId', description: 'Quote UUID' })
  @ApiResponse({
    status: 204,
    description: 'Draw schedule deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async delete(
    @Request() req,
    @Param('quoteId', ParseUUIDPipe) quoteId: string,
  ) {
    await this.drawScheduleService.delete(
      quoteId,
      req.user.tenant_id,
      req.user.id,
    );
  }
}
