import {
  Controller,
  Get,
  Param,
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

@ApiTags('Project Financial Summary')
@ApiBearerAuth()
@Controller('projects')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectFinancialSummaryController {
  constructor(
    private readonly financialEntryService: FinancialEntryService,
  ) {}

  @Get(':projectId/financial-summary')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get project cost summary by category type' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project cost summary' })
  async getProjectFinancialSummary(
    @Request() req,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.financialEntryService.getProjectCostSummary(
      req.user.tenant_id,
      projectId,
    );
  }
}
