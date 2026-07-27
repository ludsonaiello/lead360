import {
  Body,
  Controller,
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
  ClockInDto,
  ClockOutDto,
  ListClockSessionsDto,
  ListMyClockSessionsDto,
} from '../dto/clock-session.dto';
import { EditClockSessionDto } from '../dto/clock-session-edit.dto';
import { ClockSessionEditService } from '../services/clock-session-edit.service';
import { ClockSessionService } from '../services/clock-session.service';

@ApiTags('Time Clock - Sessions')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-clock/sessions')
export class ClockSessionController {
  constructor(
    private readonly clockSessionService: ClockSessionService,
    private readonly clockSessionEditService: ClockSessionEditService,
  ) {}

  // ──── STATIC ROUTES FIRST — route order matters ────

  @Post('clock-in')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Clock in — start a new work session' })
  @ApiResponse({ status: 201, description: 'Session created successfully' })
  @ApiResponse({
    status: 400,
    description: 'Validation error or missing required project/task',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'GPS or geofence enforcement blocked clock-in',
  })
  @ApiResponse({
    status: 404,
    description: 'Employee profile not found or inactive',
  })
  @ApiResponse({
    status: 409,
    description: 'Employee already has an active session',
  })
  async clockIn(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClockInDto,
  ) {
    return this.clockSessionService.clockIn(tenantId, user.id, dto);
  }

  @Post('clock-out')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clock out — end the active session' })
  @ApiResponse({ status: 200, description: 'Session completed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'No active clock session found',
  })
  async clockOut(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ClockOutDto,
  ) {
    return this.clockSessionService.clockOut(tenantId, user.id, dto);
  }

  @Get('me/active')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'Get my current active session (or null)' })
  @ApiResponse({ status: 200, description: 'Current active session or null' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Employee profile not found or inactive',
  })
  async findMyActive(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clockSessionService.findMyActive(tenantId, user.id);
  }

  @Get('me/available-projects')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'Get projects available for clock-in (BR-015)' })
  @ApiResponse({
    status: 200,
    description:
      'List of projects the employee may clock in to, each with its active clock-in addresses (lat/long) for client-side distance sorting',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Employee profile not found or inactive',
  })
  async findAvailableProjects(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clockSessionService.findAvailableProjects(tenantId, user.id);
  }

  @Get('mine')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'Get my clock session history (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of my sessions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'Employee profile not found or inactive',
  })
  async findMine(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListMyClockSessionsDto,
  ) {
    return this.clockSessionService.findMine(tenantId, user.id, query);
  }

  @Get('active/all')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({
    summary: 'Get all currently active sessions across the tenant',
  })
  @ApiResponse({ status: 200, description: 'List of active sessions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAllActive(@TenantId() tenantId: string) {
    return this.clockSessionService.findAllActive(tenantId);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Project Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List all clock sessions (paginated, filtered)' })
  @ApiResponse({ status: 200, description: 'Paginated list of sessions' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll(
    @TenantId() tenantId: string,
    @Query() query: ListClockSessionsDto,
  ) {
    return this.clockSessionService.findAll(tenantId, query);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Project Manager', 'Bookkeeper')
  @ApiOperation({
    summary: 'Get clock session full detail with breaks, edits, disputes',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Clock session ID' })
  @ApiResponse({ status: 200, description: 'Full session detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Clock session not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.clockSessionService.findOne(tenantId, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Manually edit a clock session (creates immutable edit log)',
  })
  @ApiParam({ name: 'id', type: 'string', description: 'Clock session ID' })
  @ApiResponse({
    status: 200,
    description:
      'Session updated. Response includes the full detail payload with the new immutable edit-log entries.',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error (missing or empty reason)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions — only Owner / Admin may edit',
  })
  @ApiResponse({ status: 404, description: 'Clock session not found' })
  async editSession(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: EditClockSessionDto,
  ) {
    return this.clockSessionEditService.editSession(
      tenantId,
      user.id,
      sessionId,
      dto,
    );
  }
}
