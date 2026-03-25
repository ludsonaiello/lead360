import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { DrawMilestoneService } from '../services/draw-milestone.service';
import { CreateDrawMilestoneDto } from '../dto/create-draw-milestone.dto';
import { UpdateDrawMilestoneDto } from '../dto/update-draw-milestone.dto';
import { GenerateMilestoneInvoiceDto } from '../dto/generate-milestone-invoice.dto';

/** Typed request shape after JwtAuthGuard populates req.user. */
interface AuthenticatedRequest {
  user: { tenant_id: string; id: string; role: string };
}

@ApiTags('Project Draw Milestones')
@ApiBearerAuth()
@Controller('projects/:projectId/milestones')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DrawMilestoneController {
  constructor(private readonly drawMilestoneService: DrawMilestoneService) {}

  // ───────────────────────────────────────────────────────────────────────────
  // GET /projects/:projectId/milestones
  // ───────────────────────────────────────────────────────────────────────────

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List milestones for a project' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiResponse({
    status: 200,
    description: 'List of draw milestones ordered by draw_number',
  })
  async findByProject(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.drawMilestoneService.findByProject(
      req.user.tenant_id,
      projectId,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/milestones
  // ───────────────────────────────────────────────────────────────────────────

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a milestone manually' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiBody({ type: CreateDrawMilestoneDto })
  @ApiResponse({ status: 201, description: 'Milestone created' })
  @ApiResponse({
    status: 409,
    description: 'Draw number already exists for this project',
  })
  @ApiResponse({ status: 400, description: 'Percentage value exceeds 100' })
  async create(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() dto: CreateDrawMilestoneDto,
  ) {
    return this.drawMilestoneService.create(
      req.user.tenant_id,
      projectId,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // PATCH /projects/:projectId/milestones/:id
  // ───────────────────────────────────────────────────────────────────────────

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update a milestone' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Milestone UUID' })
  @ApiBody({ type: UpdateDrawMilestoneDto })
  @ApiResponse({ status: 200, description: 'Milestone updated' })
  @ApiResponse({
    status: 400,
    description: 'Cannot modify calculated_amount on invoiced milestone',
  })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async update(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDrawMilestoneDto,
  ) {
    return this.drawMilestoneService.update(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // DELETE /projects/:projectId/milestones/:id
  // ───────────────────────────────────────────────────────────────────────────

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a pending milestone' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Milestone UUID' })
  @ApiResponse({ status: 204, description: 'Milestone deleted' })
  @ApiResponse({
    status: 400,
    description: 'Milestone is not in pending status',
  })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async delete(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.drawMilestoneService.delete(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // POST /projects/:projectId/milestones/:id/invoice
  // ───────────────────────────────────────────────────────────────────────────

  @Post(':id/invoice')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Generate invoice from milestone' })
  @ApiParam({ name: 'projectId', description: 'Project UUID' })
  @ApiParam({ name: 'id', description: 'Milestone UUID' })
  @ApiBody({ type: GenerateMilestoneInvoiceDto })
  @ApiResponse({
    status: 201,
    description: 'Invoice generated from milestone',
  })
  @ApiResponse({ status: 400, description: 'Milestone already invoiced' })
  @ApiResponse({ status: 404, description: 'Milestone not found' })
  async generateInvoice(
    @Request() req: AuthenticatedRequest,
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GenerateMilestoneInvoiceDto,
  ) {
    return this.drawMilestoneService.generateInvoice(
      req.user.tenant_id,
      projectId,
      id,
      req.user.id,
      dto,
    );
  }
}
