import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import type { AuthenticatedUser } from '../../auth/entities/jwt-payload.entity';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import {
  ApproveDisputeDto,
  CreateTimeDisputeDto,
  ListTimeDisputesDto,
  RejectDisputeDto,
} from '../dto/time-dispute.dto';
import { TimeDisputeService } from '../services/time-dispute.service';

/**
 * TimeDisputeController
 *
 * Exposes the seven endpoints that make up the Time Dispute lifecycle.
 *
 * Route structure:
 *   - `POST   /time-clock/sessions/:sessionId/disputes`     → submit
 *   - `GET    /time-clock/disputes`                         → admin list
 *   - `GET    /time-clock/disputes/mine`                    → my list
 *   - `GET    /time-clock/disputes/:id`                     → detail
 *   - `PATCH  /time-clock/disputes/:id/approve`             → approve
 *   - `PATCH  /time-clock/disputes/:id/reject`              → reject
 *   - `DELETE /time-clock/disputes/:id`                     → cancel
 *
 * IMPORTANT — route order matters. `disputes/mine` MUST be declared
 * before `disputes/:id`; NestJS's router walks declarations top-down
 * and would otherwise match `mine` as the `:id` parameter.
 */
@ApiTags('Time Clock - Disputes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-clock')
export class TimeDisputeController {
  constructor(private readonly timeDisputeService: TimeDisputeService) {}

  // ─── 1) SUBMIT — session-scoped ───────────────────────────────────

  @Post('sessions/:sessionId/disputes')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a dispute for a clock session' })
  @ApiParam({ name: 'sessionId', description: 'Clock session ID (UUID)' })
  @ApiResponse({ status: 201, description: 'Dispute submitted successfully' })
  @ApiResponse({
    status: 400,
    description:
      'Validation error — correction_request must include at least one proposed value',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Clock session not found' })
  @ApiResponse({
    status: 409,
    description: 'A pending dispute already exists for this session',
  })
  async submit(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: CreateTimeDisputeDto,
  ) {
    return this.timeDisputeService.submit(tenantId, user.id, sessionId, dto);
  }

  // ─── 2) LIST ALL — admin ──────────────────────────────────────────

  @Get('disputes')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List all time disputes (admin view, paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of disputes' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListTimeDisputesDto,
  ) {
    return this.timeDisputeService.findAll(tenantId, query);
  }

  // ─── 3) LIST MINE — self ──────────────────────────────────────────
  //
  // MUST be declared before `disputes/:id` so that `/disputes/mine` is
  // not interpreted as `/disputes/:id` with `id = "mine"`.

  @Get('disputes/mine')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'List my own disputes (paginated)' })
  @ApiResponse({
    status: 200,
    description: "Paginated list of the current user's disputes",
  })
  async findMine(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListTimeDisputesDto,
  ) {
    return this.timeDisputeService.findMine(tenantId, user.id, query);
  }

  // ─── 4) DETAIL ────────────────────────────────────────────────────

  @Get('disputes/:id')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'Get dispute detail' })
  @ApiParam({ name: 'id', description: 'Dispute ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Full dispute object' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  @ApiResponse({
    status: 403,
    description: 'Non-admin users may only view their own disputes',
  })
  async findOne(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.timeDisputeService.findOne(tenantId, user.id, id, user.roles);
  }

  // ─── 5) APPROVE ───────────────────────────────────────────────────

  @Patch('disputes/:id/approve')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Approve a time dispute' })
  @ApiParam({ name: 'id', description: 'Dispute ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Dispute approved' })
  @ApiResponse({
    status: 400,
    description: 'Only pending disputes can be approved',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async approve(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ApproveDisputeDto,
  ) {
    return this.timeDisputeService.approve(tenantId, user.id, id, dto);
  }

  // ─── 6) REJECT ────────────────────────────────────────────────────

  @Patch('disputes/:id/reject')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Reject a time dispute' })
  @ApiParam({ name: 'id', description: 'Dispute ID (UUID)' })
  @ApiResponse({ status: 200, description: 'Dispute rejected' })
  @ApiResponse({
    status: 400,
    description:
      'Only pending disputes can be rejected, or review notes are missing',
  })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async reject(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: RejectDisputeDto,
  ) {
    return this.timeDisputeService.reject(tenantId, user.id, id, dto);
  }

  // ─── 7) CANCEL ────────────────────────────────────────────────────

  @Delete('disputes/:id')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a pending dispute' })
  @ApiParam({ name: 'id', description: 'Dispute ID (UUID)' })
  @ApiResponse({
    status: 200,
    description: 'Dispute cancelled (status set to resolved)',
  })
  @ApiResponse({
    status: 400,
    description: 'Only pending disputes can be cancelled',
  })
  @ApiResponse({
    status: 403,
    description: 'Non-admin users may only cancel their own disputes',
  })
  @ApiResponse({ status: 404, description: 'Dispute not found' })
  async cancel(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.timeDisputeService.cancel(tenantId, user.id, id, user.roles);
  }
}
