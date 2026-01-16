import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  ParseUUIDPipe,
  Request,
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
import { PlatformAdminGuard } from '../guards/platform-admin.guard';
import { ImpersonationService } from '../services/impersonation.service';

@ApiTags('Admin - Impersonation')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class ImpersonationController {
  constructor(private readonly impersonationService: ImpersonationService) {}

  /**
   * POST /admin/tenants/:tenantId/impersonate
   * Start impersonation session
   */
  @Post('tenants/:tenantId/impersonate')
  @ApiOperation({
    summary: 'Start impersonating a user',
    description: 'Create impersonation session with 1-hour expiry. Returns session token to use in X-Impersonation-Token header.',
  })
  @ApiParam({ name: 'tenantId', description: 'Tenant ID (UUID)' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['user_id'],
      properties: {
        user_id: { type: 'string', format: 'uuid', example: 'abc123', description: 'ID of user to impersonate' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Impersonation session created',
    schema: {
      properties: {
        session_token: { type: 'string', example: '64charhextoken...' },
        expires_at: { type: 'string', format: 'date-time' },
        impersonated_user: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            email: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            tenant_id: { type: 'string' },
            tenant: { type: 'object' },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 403, description: 'Only Platform Admins can impersonate' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async startImpersonation(
    @Request() req,
    @Param('tenantId', ParseUUIDPipe) tenantId: string,
    @Body() body: { user_id: string },
  ) {
    return this.impersonationService.startImpersonation(req.user.id, body.user_id);
  }

  /**
   * POST /admin/impersonation/exit
   * End impersonation session
   */
  @Post('impersonation/exit')
  @ApiOperation({
    summary: 'Exit impersonation',
    description: 'End active impersonation session',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['session_token'],
      properties: {
        session_token: { type: 'string', example: '64charhextoken...' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Impersonation ended successfully' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async exitImpersonation(@Body() body: { session_token: string }) {
    return this.impersonationService.endImpersonation(body.session_token);
  }
}
