import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { VoiceTransferNumbersService } from '../../services/voice-transfer-numbers.service';
import { CreateTransferNumberDto } from '../../dto/create-transfer-number.dto';
import { UpdateTransferNumberDto } from '../../dto/update-transfer-number.dto';
import { ReorderTransferNumbersDto } from '../../dto/reorder-transfer-numbers.dto';

/**
 * VoiceTransferNumbersController — Tenant
 *
 * CRUD endpoints for managing call transfer destinations.
 * These are the phone numbers the AI agent transfers calls to when needed.
 *
 * Route prefix: /api/v1/voice-ai/transfer-numbers
 * Auth: JwtAuthGuard + RolesGuard — role-based access control enforced on endpoints
 * Tenant ID: extracted from JWT (req.user.tenant_id) — NEVER from the request body
 *
 * ⚠️ ROUTE ORDER: The PATCH /reorder static route MUST be declared BEFORE the
 *    PATCH /:id route. NestJS resolves routes in declaration order — if /:id
 *    appears first, PATCH /reorder would match with id = "reorder" and throw.
 */
@ApiTags('Voice AI - Transfer Numbers')
@ApiBearerAuth()
@Controller('voice-ai/transfer-numbers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VoiceTransferNumbersController {
  constructor(
    private readonly transferNumbersService: VoiceTransferNumbersService,
  ) {}

  /**
   * GET /api/v1/voice-ai/transfer-numbers
   *
   * Returns all transfer numbers for the authenticated tenant,
   * ordered by display_order ASC then created_at ASC.
   */
  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'List transfer numbers',
    description:
      'Returns all call transfer destinations for the authenticated tenant, ' +
      'ordered by display_order ASC. Up to 10 per tenant.',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfer numbers returned successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — valid JWT required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  findAll(@Request() req: { user: { tenant_id: string } }) {
    return this.transferNumbersService.findAll(req.user.tenant_id);
  }

  /**
   * POST /api/v1/voice-ai/transfer-numbers
   *
   * Create a new transfer number for the tenant.
   * Enforces maximum of 10 per tenant.
   * Setting is_default: true unsets any existing default.
   */
  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create a transfer number',
    description:
      'Adds a new call transfer destination. Maximum 10 per tenant. ' +
      'If is_default: true, any previously set default is unset automatically.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transfer number created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation error or maximum of 10 transfer numbers reached',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — valid JWT required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  create(
    @Request() req: { user: { tenant_id: string } },
    @Body() dto: CreateTransferNumberDto,
  ) {
    return this.transferNumbersService.create(req.user.tenant_id, dto);
  }

  /**
   * GET /api/v1/voice-ai/transfer-numbers/:id
   *
   * Returns a single transfer number by ID.
   * Throws 404 if the ID does not exist or belongs to a different tenant.
   */
  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get a transfer number by ID',
    description:
      'Returns a single call transfer destination by ID. ' +
      'Returns 404 if the ID does not exist or belongs to a different tenant.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the transfer number to retrieve',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfer number returned successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — valid JWT required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({
    status: 404,
    description: 'Transfer number not found or belongs to a different tenant',
  })
  findOne(
    @Request() req: { user: { tenant_id: string } },
    @Param('id') id: string,
  ) {
    return this.transferNumbersService.findById(req.user.tenant_id, id);
  }

  /**
   * PATCH /api/v1/voice-ai/transfer-numbers/reorder
   *
   * Bulk-update display_order for multiple transfer numbers in one transaction.
   * All supplied IDs must belong to the authenticated tenant.
   * Returns the full updated list ordered by display_order ASC.
   *
   * ⚠️ This route MUST be declared BEFORE PATCH /:id to avoid NestJS matching
   *    PATCH /reorder as PATCH /:id with id = "reorder".
   */
  @Patch('reorder')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reorder transfer numbers',
    description:
      'Bulk-updates display_order for multiple transfer numbers in a single transaction. ' +
      'All supplied IDs must belong to the authenticated tenant. ' +
      'Returns the full updated list ordered by display_order ASC.',
  })
  @ApiResponse({
    status: 200,
    description: 'Reorder applied — full updated list returned',
  })
  @ApiResponse({
    status: 400,
    description:
      'Validation error or one or more IDs do not belong to the tenant',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — valid JWT required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  reorder(
    @Request() req: { user: { tenant_id: string } },
    @Body() dto: ReorderTransferNumbersDto,
  ) {
    return this.transferNumbersService.reorder(req.user.tenant_id, dto.items);
  }

  /**
   * PATCH /api/v1/voice-ai/transfer-numbers/:id
   *
   * Update one or more fields of a transfer number.
   * Throws 404 if the ID does not exist or belongs to a different tenant.
   * Setting is_default: true unsets any existing default.
   */
  @Patch(':id')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Update a transfer number',
    description:
      'Partially update a transfer number. All fields are optional. ' +
      'If is_default: true, any previously set default is unset automatically. ' +
      'Returns 404 if the ID does not exist or belongs to a different tenant.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the transfer number to update',
  })
  @ApiResponse({
    status: 200,
    description: 'Transfer number updated successfully',
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — valid JWT required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({
    status: 404,
    description: 'Transfer number not found or belongs to a different tenant',
  })
  update(
    @Request() req: { user: { tenant_id: string } },
    @Param('id') id: string,
    @Body() dto: UpdateTransferNumberDto,
  ) {
    return this.transferNumbersService.update(req.user.tenant_id, id, dto);
  }

  /**
   * DELETE /api/v1/voice-ai/transfer-numbers/:id
   *
   * Soft-delete a transfer number by setting is_active = false.
   * Throws 404 if the ID does not exist or belongs to a different tenant.
   */
  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a transfer number',
    description:
      'Soft-deletes a transfer number by setting is_active = false. ' +
      'Returns 404 if the ID does not exist or belongs to a different tenant.',
  })
  @ApiParam({
    name: 'id',
    description: 'UUID of the transfer number to delete',
  })
  @ApiResponse({ status: 204, description: 'Transfer number deactivated' })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized — valid JWT required',
  })
  @ApiResponse({ status: 403, description: 'Forbidden — insufficient role' })
  @ApiResponse({
    status: 404,
    description: 'Transfer number not found or belongs to a different tenant',
  })
  delete(
    @Request() req: { user: { tenant_id: string } },
    @Param('id') id: string,
  ) {
    return this.transferNumbersService.deactivate(req.user.tenant_id, id);
  }
}
