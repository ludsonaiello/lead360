import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { SendEmailService } from '../services/send-email.service';
import { SendTemplatedEmailDto, SendRawEmailDto } from '../dto/send-email.dto';

/**
 * Send Email Controller
 *
 * Endpoints for sending emails (templated and raw).
 * Queues emails via BullMQ for async processing.
 *
 * RBAC: Owner, Admin, Manager, Sales
 */
@ApiTags('Communication - Send Email')
@Controller('communication/send-email')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SendEmailController {
  constructor(private readonly sendEmailService: SendEmailService) {}

  @Post('templated')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Send templated email',
    description:
      'Send email using a template with variable substitution. Queued for async processing.',
  })
  @ApiResponse({
    status: 202,
    description: 'Email queued successfully',
    schema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', example: 'job-12345' },
        communication_event_id: {
          type: 'string',
          example: 'comm-event-001',
        },
        status: { type: 'string', example: 'queued' },
        message: {
          type: 'string',
          example: 'Email queued for sending',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or template not found',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Template not found or email config not set up',
  })
  async sendTemplated(@Request() req, @Body() dto: SendTemplatedEmailDto) {
    return this.sendEmailService.sendTemplated(
      req.user.tenant_id,
      dto,
      req.user.id,
    );
  }

  @Post('raw')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Send raw email',
    description:
      'Send email without template (raw HTML/text). Queued for async processing.',
  })
  @ApiResponse({
    status: 202,
    description: 'Email queued successfully',
    schema: {
      type: 'object',
      properties: {
        job_id: { type: 'string', example: 'job-12345' },
        communication_event_id: {
          type: 'string',
          example: 'comm-event-001',
        },
        status: { type: 'string', example: 'queued' },
        message: {
          type: 'string',
          example: 'Email queued for sending',
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation error',
  })
  @ApiResponse({
    status: 403,
    description: 'Insufficient permissions',
  })
  @ApiResponse({
    status: 404,
    description: 'Email config not set up',
  })
  async sendRaw(@Request() req, @Body() dto: SendRawEmailDto) {
    return this.sendEmailService.sendRaw(req.user.tenant_id, dto, req.user.id);
  }
}
