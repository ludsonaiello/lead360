import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { ProjectCompletionService } from '../services/project-completion.service';
import { StartCompletionDto } from '../dto/start-completion.dto';
import { CompleteChecklistItemDto } from '../dto/complete-checklist-item.dto';
import { AddManualChecklistItemDto } from '../dto/add-manual-checklist-item.dto';
import { AddPunchListItemDto } from '../dto/add-punch-list-item.dto';
import { UpdatePunchListItemDto } from '../dto/update-punch-list-item.dto';

@ApiTags('Project Completion')
@ApiBearerAuth()
@Controller('projects/:projectId')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProjectCompletionController {
  constructor(
    private readonly projectCompletionService: ProjectCompletionService,
  ) {}

  // -------------------------------------------------------------------------
  // GET /projects/:projectId/completion
  // -------------------------------------------------------------------------

  @Get('completion')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get completion checklist with items and punch list' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Completion checklist with items and punch list' })
  @ApiResponse({ status: 404, description: 'Project or checklist not found' })
  async getCompletion(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.projectCompletionService.getCompletion(tenantId, projectId);
  }

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/completion
  // -------------------------------------------------------------------------

  @Post('completion')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start completion checklist (optionally from template)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Completion checklist created' })
  @ApiResponse({ status: 404, description: 'Project or template not found' })
  @ApiResponse({ status: 409, description: 'Checklist already exists for this project' })
  async startCompletion(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req,
    @Body() dto: StartCompletionDto,
  ) {
    return this.projectCompletionService.startCompletion(
      tenantId,
      projectId,
      req.user.id,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // PATCH /projects/:projectId/completion/items/:itemId
  // -------------------------------------------------------------------------

  @Patch('completion/items/:itemId')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Mark a checklist item as completed' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'itemId', description: 'Checklist item UUID' })
  @ApiResponse({ status: 200, description: 'Item completed, full checklist returned' })
  @ApiResponse({ status: 404, description: 'Project, checklist, or item not found' })
  async completeItem(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Request() req,
    @Body() dto: CompleteChecklistItemDto,
  ) {
    return this.projectCompletionService.completeItem(
      tenantId,
      projectId,
      itemId,
      req.user.id,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/completion/items
  // -------------------------------------------------------------------------

  @Post('completion/items')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a manual checklist item (not from template)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Manual item added, full checklist returned' })
  @ApiResponse({ status: 404, description: 'Project or checklist not found' })
  async addManualItem(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req,
    @Body() dto: AddManualChecklistItemDto,
  ) {
    return this.projectCompletionService.addManualItem(
      tenantId,
      projectId,
      req.user.id,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/completion/punch-list
  // -------------------------------------------------------------------------

  @Post('completion/punch-list')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a punch list item (deficiency to resolve)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 201, description: 'Punch list item created, full checklist returned' })
  @ApiResponse({ status: 404, description: 'Project or checklist not found' })
  async addPunchListItem(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req,
    @Body() dto: AddPunchListItemDto,
  ) {
    return this.projectCompletionService.addPunchListItem(
      tenantId,
      projectId,
      req.user.id,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // PATCH /projects/:projectId/completion/punch-list/:itemId
  // -------------------------------------------------------------------------

  @Patch('completion/punch-list/:itemId')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a punch list item (status, description, assignment)' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'itemId', description: 'Punch list item UUID' })
  @ApiResponse({ status: 200, description: 'Punch list item updated, full checklist returned' })
  @ApiResponse({ status: 404, description: 'Project, checklist, or punch list item not found' })
  async updatePunchListItem(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Request() req,
    @Body() dto: UpdatePunchListItemDto,
  ) {
    return this.projectCompletionService.updatePunchListItem(
      tenantId,
      projectId,
      itemId,
      req.user.id,
      dto,
    );
  }

  // -------------------------------------------------------------------------
  // POST /projects/:projectId/complete
  // -------------------------------------------------------------------------

  @Post('complete')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Complete the project (validates all checklist items + punch list)',
  })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({ status: 200, description: 'Project marked as completed' })
  @ApiResponse({
    status: 409,
    description: 'Cannot complete — incomplete checklist items or unresolved punch list items',
  })
  async completeProject(
    @TenantId() tenantId: string,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Request() req,
  ) {
    return this.projectCompletionService.completeProject(
      tenantId,
      projectId,
      req.user.id,
    );
  }
}
