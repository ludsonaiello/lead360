import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
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
import { StartBreakDto } from '../dto/break-entry.dto';
import { BreakEntryService } from '../services/break-entry.service';

@ApiTags('Time Clock - Breaks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('time-clock/sessions')
export class BreakEntryController {
  constructor(private readonly breakEntryService: BreakEntryService) {}

  @Post(':id/breaks/start')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Start a break on an active clock session' })
  @ApiParam({ name: 'id', type: 'string', description: 'Clock session ID' })
  @ApiResponse({ status: 201, description: 'Break started successfully' })
  @ApiResponse({
    status: 400,
    description: 'Session is not active — cannot start a break',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description:
      'Caller does not own this session and lacks Owner/Admin permission',
  })
  @ApiResponse({ status: 404, description: 'Clock session not found' })
  @ApiResponse({
    status: 409,
    description: 'A break is already active on this session',
  })
  async startBreak(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @Body() dto: StartBreakDto,
  ) {
    return this.breakEntryService.startBreak(
      tenantId,
      user.id,
      sessionId,
      dto,
      user.roles,
    );
  }

  @Post(':id/breaks/end')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'End the active break on a clock session' })
  @ApiParam({ name: 'id', type: 'string', description: 'Clock session ID' })
  @ApiResponse({ status: 200, description: 'Break ended successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description:
      'Caller does not own this session and lacks Owner/Admin permission',
  })
  @ApiResponse({
    status: 404,
    description: 'Clock session not found, or no active break to end',
  })
  async endBreak(
    @TenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.breakEntryService.endBreak(
      tenantId,
      user.id,
      sessionId,
      user.roles,
    );
  }

  @Get(':id/breaks')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'List all breaks for a clock session' })
  @ApiParam({ name: 'id', type: 'string', description: 'Clock session ID' })
  @ApiResponse({ status: 200, description: 'List of breaks for the session' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Clock session not found' })
  async listBreaks(
    @TenantId() tenantId: string,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
  ) {
    return this.breakEntryService.getBreaks(tenantId, sessionId);
  }
}
