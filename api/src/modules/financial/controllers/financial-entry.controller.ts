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
  ParseUUIDPipe,
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
import { FinancialEntryService } from '../services/financial-entry.service';
import { CreateFinancialEntryDto } from '../dto/create-financial-entry.dto';
import { UpdateFinancialEntryDto } from '../dto/update-financial-entry.dto';
import { ListFinancialEntriesDto } from '../dto/list-financial-entries.dto';

@ApiTags('Financial Entries')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FinancialEntryController {
  constructor(
    private readonly financialEntryService: FinancialEntryService,
  ) {}

  @Post('entries')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Create a financial entry' })
  @ApiResponse({ status: 201, description: 'Entry created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async create(@Request() req, @Body() dto: CreateFinancialEntryDto) {
    return this.financialEntryService.createEntry(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get('entries')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List financial entries for a project (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of entries' })
  async findAll(@Request() req, @Query() query: ListFinancialEntriesDto) {
    return this.financialEntryService.getProjectEntries(
      req.user.tenant_id,
      query,
    );
  }

  @Get('entries/:id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get a single financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry details' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financialEntryService.getEntryById(
      req.user.tenant_id,
      id,
    );
  }

  @Patch('entries/:id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry updated' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateFinancialEntryDto,
  ) {
    return this.financialEntryService.updateEntry(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  @Delete('entries/:id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Delete a financial entry' })
  @ApiParam({ name: 'id', description: 'Entry UUID' })
  @ApiResponse({ status: 200, description: 'Entry deleted' })
  @ApiResponse({ status: 404, description: 'Entry not found' })
  async delete(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.financialEntryService.deleteEntry(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
