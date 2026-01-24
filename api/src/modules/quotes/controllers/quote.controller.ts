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
import { QuoteService } from '../services/quote.service';
import {
  CreateQuoteFromLeadDto,
  CreateQuoteWithCustomerDto,
  CreateQuoteDto,
  UpdateQuoteDto,
  UpdateQuoteStatusDto,
  UpdateJobsiteAddressDto,
  ListQuotesDto,
} from '../dto/quote';

@ApiTags('Quotes - Main')
@ApiBearerAuth()
@Controller('quotes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteController {
  private readonly logger = new Logger(QuoteController.name);

  constructor(private readonly quoteService: QuoteService) {}

  // ========== QUOTE CRUD ==========

  @Post('from-lead/:leadId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Create quote from existing lead' })
  @ApiParam({ name: 'leadId', description: 'Lead UUID' })
  @ApiResponse({ status: 201, description: 'Quote created successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  @ApiResponse({ status: 422, description: 'Address validation failed' })
  async createFromLead(
    @Request() req,
    @Param('leadId', ParseUUIDPipe) leadId: string,
    @Body() dto: CreateQuoteFromLeadDto,
  ) {
    return this.quoteService.createFromLead(
      req.user.tenant_id,
      req.user.id,
      leadId,
      dto,
    );
  }

  @Post('with-new-customer')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Create quote with new customer (creates lead in transaction)',
  })
  @ApiResponse({ status: 201, description: 'Quote and lead created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or validation error' })
  @ApiResponse({ status: 422, description: 'Address validation failed' })
  async createWithNewCustomer(
    @Request() req,
    @Body() dto: CreateQuoteWithCustomerDto,
  ) {
    return this.quoteService.createWithNewCustomer(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Create quote manually (requires existing lead)' })
  @ApiResponse({ status: 201, description: 'Quote created successfully' })
  @ApiResponse({ status: 404, description: 'Lead or vendor not found' })
  @ApiResponse({ status: 422, description: 'Address validation failed' })
  async create(@Request() req, @Body() dto: CreateQuoteDto) {
    return this.quoteService.create(req.user.tenant_id, req.user.id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List quotes with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Quotes retrieved successfully' })
  async findAll(@Request() req, @Query() listDto: ListQuotesDto) {
    return this.quoteService.findAll(req.user.tenant_id, listDto);
  }

  @Get('search')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Search quotes by quote number, title, customer, or items',
  })
  @ApiResponse({ status: 200, description: 'Search results' })
  async search(@Request() req, @Query('q') searchTerm: string) {
    return this.quoteService.search(req.user.tenant_id, searchTerm);
  }

  @Get('statistics')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get quote statistics (counts, revenue, conversion rate)',
  })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  async getStatistics(@Request() req) {
    return this.quoteService.getStatistics(req.user.tenant_id);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get single quote with all relationships' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'Quote retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.quoteService.findOne(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Update quote basic information (creates version +0.1)',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'Quote updated successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({ status: 400, description: 'Cannot edit approved quote' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteDto,
  ) {
    return this.quoteService.update(req.user.tenant_id, id, req.user.id, dto);
  }

  @Patch(':id/status')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Update quote status with validation (creates version +1.0)',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'Quote status updated successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({ status: 400, description: 'Invalid status transition' })
  async updateStatus(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateQuoteStatusDto,
  ) {
    return this.quoteService.updateStatus(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  @Patch(':id/jobsite-address')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Update jobsite address with re-validation (creates version +0.1)',
  })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 200, description: 'Jobsite address updated successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  @ApiResponse({ status: 422, description: 'Address validation failed' })
  async updateJobsiteAddress(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateJobsiteAddressDto,
  ) {
    return this.quoteService.updateJobsiteAddress(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  @Post(':id/clone')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary:
      'Deep clone quote (copies all items, groups, discounts, draw schedule)',
  })
  @ApiParam({ name: 'id', description: 'Source quote UUID' })
  @ApiResponse({ status: 201, description: 'Quote cloned successfully' })
  @ApiResponse({ status: 404, description: 'Source quote not found' })
  async clone(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.quoteService.clone(req.user.tenant_id, id, req.user.id);
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft delete quote (archive)' })
  @ApiParam({ name: 'id', description: 'Quote UUID' })
  @ApiResponse({ status: 204, description: 'Quote archived successfully' })
  @ApiResponse({ status: 404, description: 'Quote not found' })
  async delete(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.quoteService.delete(req.user.tenant_id, id, req.user.id);
  }
}
