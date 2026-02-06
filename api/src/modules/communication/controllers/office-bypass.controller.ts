import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Body,
  Param,
  Request,
  UseGuards,
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
import { JwtAuthGuard } from '../../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../../modules/auth/guards/roles.guard';
import { Roles } from '../../../modules/auth/decorators/roles.decorator';
import { OfficeBypassService } from '../services/office-bypass.service';
import {
  AddWhitelistDto,
  UpdateWhitelistDto,
  OfficeWhitelistResponseDto,
} from '../dto/office-bypass/add-whitelist.dto';

/**
 * OfficeBypassController
 *
 * REST API for managing office phone number whitelist (bypass IVR).
 *
 * Purpose:
 * Allows authorized office staff to bypass IVR and make outbound calls
 * using the company's Twilio phone number.
 *
 * Endpoints:
 * - POST   /communication/twilio/office-whitelist        Add number to whitelist
 * - GET    /communication/twilio/office-whitelist        List all whitelisted numbers
 * - PATCH  /communication/twilio/office-whitelist/:id    Update whitelist entry label
 * - DELETE /communication/twilio/office-whitelist/:id    Remove number from whitelist
 *
 * Access Control:
 * - Add/Remove: Owner, Admin only
 * - Update: Owner, Admin only
 * - List: Owner, Admin, Manager
 *
 * Security:
 * - JWT authentication required (via JwtAuthGuard)
 * - Role-based authorization (via RolesGuard)
 * - Tenant isolation enforced (tenantId from JWT token)
 * - Phone numbers must be E.164 format
 * - All inputs validated via DTOs
 *
 * Best Practices:
 * - Soft delete for audit trail (status = 'inactive')
 * - Duplicate detection (reactivates if exists)
 * - Comprehensive API documentation (Swagger)
 * - Proper HTTP status codes
 *
 * @see OfficeBypassService
 */
@ApiTags('Communication - Twilio Office Bypass')
@Controller('communication/twilio/office-whitelist')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OfficeBypassController {
  constructor(private readonly bypassService: OfficeBypassService) {}

  /**
   * Add phone number to office whitelist
   *
   * Whitelisted numbers bypass IVR and can make outbound calls
   * using the company's phone number.
   *
   * Security Notes:
   * - Verify phone number ownership before whitelisting
   * - Use descriptive labels (e.g., "John Doe - Sales Manager")
   * - Regularly audit whitelist entries
   *
   * Duplicate Handling:
   * - If phone number already whitelisted (active), returns 409 Conflict
   * - If phone number was previously removed (inactive), reactivates it
   *
   * Access: Owner, Admin only
   *
   * @param req - Express request (contains user with tenant_id)
   * @param dto - Phone number and label
   * @returns Created or reactivated whitelist entry
   */
  @Post()
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Add phone number to office whitelist',
    description:
      'Adds a phone number to the office whitelist, allowing it to bypass IVR and make outbound calls using the company phone number. Only accessible by Owner or Admin roles.',
  })
  @ApiBody({ type: AddWhitelistDto })
  @ApiResponse({
    status: 201,
    description: 'Phone number added to whitelist successfully',
    type: OfficeWhitelistResponseDto,
    schema: {
      example: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        tenant_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        phone_number: '+19781234567',
        label: "John Doe - Sales Manager's Mobile",
        status: 'active',
        created_at: '2026-01-15T10:30:00.000Z',
        updated_at: '2026-01-15T10:30:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (validation failed)',
    schema: {
      example: {
        statusCode: 400,
        message:
          'Phone number must be in E.164 format (e.g., +12025551234). Start with + followed by country code and number, no spaces or formatting.',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number already whitelisted (active)',
    schema: {
      example: {
        statusCode: 409,
        message: 'This phone number is already whitelisted',
        error: 'Conflict',
      },
    },
  })
  async addToWhitelist(@Request() req, @Body() dto: AddWhitelistDto) {
    return this.bypassService.addToWhitelist(req.user.tenant_id, dto);
  }

  /**
   * List all whitelisted office numbers
   *
   * Returns all whitelist entries (both active and inactive) for audit purposes.
   * Frontend can filter by status if needed.
   *
   * Sorted by most recent first (created_at DESC).
   *
   * Access: Owner, Admin, Manager
   *
   * @param req - Express request (contains user with tenant_id)
   * @returns Array of whitelist entries
   */
  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all whitelisted office numbers',
    description:
      'Retrieves all office whitelist entries for the tenant (both active and inactive). Sorted by most recent first. Accessible by Owner, Admin, or Manager roles.',
  })
  @ApiResponse({
    status: 200,
    description: 'Whitelist retrieved successfully',
    type: [OfficeWhitelistResponseDto],
    schema: {
      example: [
        {
          id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
          tenant_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          phone_number: '+19781234567',
          label: "John Doe - Sales Manager's Mobile",
          status: 'active',
          created_at: '2026-01-15T10:30:00.000Z',
          updated_at: '2026-01-15T10:30:00.000Z',
        },
        {
          id: 'b2c3d4e5-f6a7-8901-bcde-f12345678902',
          tenant_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
          phone_number: '+19781234568',
          label: 'Jane Smith - Operations Manager',
          status: 'inactive',
          created_at: '2026-01-14T09:00:00.000Z',
          updated_at: '2026-01-15T09:30:00.000Z',
        },
      ],
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  async findAll(@Request() req) {
    return this.bypassService.findAll(req.user.tenant_id);
  }

  /**
   * Update whitelist entry label
   *
   * Updates the human-readable label for a whitelist entry.
   * Phone number itself is immutable (delete and re-add to change).
   *
   * Access: Owner, Admin only
   *
   * @param req - Express request (contains user with tenant_id)
   * @param id - Whitelist entry UUID
   * @param dto - New label
   * @returns Updated whitelist entry
   */
  @Patch(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update whitelist entry label',
    description:
      'Updates the label for a whitelist entry. Phone number itself cannot be changed (delete and re-add to change number). Only accessible by Owner or Admin roles.',
  })
  @ApiParam({
    name: 'id',
    description: 'Whitelist entry UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiBody({ type: UpdateWhitelistDto })
  @ApiResponse({
    status: 200,
    description: 'Whitelist entry updated successfully',
    type: OfficeWhitelistResponseDto,
    schema: {
      example: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        tenant_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        phone_number: '+19781234567',
        label: 'John Doe - VP of Sales',
        status: 'active',
        created_at: '2026-01-15T10:30:00.000Z',
        updated_at: '2026-01-15T11:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input (validation failed)',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  @ApiResponse({
    status: 404,
    description: 'Whitelist entry not found or does not belong to this tenant',
  })
  async updateLabel(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateWhitelistDto,
  ) {
    return this.bypassService.updateLabel(req.user.tenant_id, id, dto.label);
  }

  /**
   * Remove phone number from whitelist
   *
   * Soft deletes the whitelist entry (sets status to 'inactive').
   * Does not physically delete data for audit trail purposes.
   *
   * Access: Owner, Admin only
   *
   * @param req - Express request (contains user with tenant_id)
   * @param id - Whitelist entry UUID
   * @returns Updated entry with status = 'inactive'
   */
  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Remove phone number from whitelist',
    description:
      'Removes a phone number from the office whitelist (soft delete). Sets status to inactive. Data is retained for audit purposes. Only accessible by Owner or Admin roles.',
  })
  @ApiParam({
    name: 'id',
    description: 'Whitelist entry UUID',
    example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Phone number removed from whitelist successfully',
    type: OfficeWhitelistResponseDto,
    schema: {
      example: {
        id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
        tenant_id: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
        phone_number: '+19781234567',
        label: "John Doe - Sales Manager's Mobile",
        status: 'inactive',
        created_at: '2026-01-15T10:30:00.000Z',
        updated_at: '2026-01-15T11:00:00.000Z',
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized (invalid or missing JWT token)',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden (insufficient permissions)',
  })
  @ApiResponse({
    status: 404,
    description: 'Whitelist entry not found or does not belong to this tenant',
  })
  async remove(@Request() req, @Param('id') id: string) {
    return this.bypassService.removeFromWhitelist(req.user.tenant_id, id);
  }
}
