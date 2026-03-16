import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Public } from '../../auth/decorators';
import { PortalAuthGuard } from '../guards';
import { CurrentPortalUser } from '../decorators';
import { PortalProjectService } from '../services/portal-project.service';
import { PortalPaginationQueryDto } from '../dto';
import type { AuthenticatedPortalUser } from '../entities/portal-jwt-payload.entity';

/**
 * PortalProjectController — Sprint 32
 *
 * Portal-facing API endpoints for project list, project detail,
 * public logs, and public photos. All scoped to the authenticated
 * customer and returning only public data.
 *
 * Security:
 *   - @Public() bypasses global JwtAuthGuard (staff auth)
 *   - @UseGuards(PortalAuthGuard) enforces portal JWT auth
 *   - Every request validates customerSlug matches the token's customer_slug
 *   - Data is sanitized at the service layer (hand-picked SELECT fields)
 */
@ApiTags('Portal — Projects')
@Controller('portal')
@Public() // Bypass global JwtAuthGuard — PortalAuthGuard handles auth
@UseGuards(PortalAuthGuard)
@ApiBearerAuth()
export class PortalProjectController {
  constructor(
    private readonly portalProjectService: PortalProjectService,
  ) {}

  // ---------------------------------------------------------------------------
  // GET /portal/:customerSlug/projects
  // ---------------------------------------------------------------------------

  @Get(':customerSlug/projects')
  @ApiOperation({
    summary: 'List portal-enabled projects for the authenticated customer',
  })
  @ApiParam({
    name: 'customerSlug',
    description: 'Customer slug from portal account (must match token)',
    example: 'john-smith',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of portal-enabled projects',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing portal token' })
  @ApiResponse({ status: 403, description: 'Forbidden — customerSlug does not match token' })
  async listProjects(
    @Param('customerSlug') customerSlug: string,
    @Query() query: PortalPaginationQueryDto,
    @CurrentPortalUser() user: AuthenticatedPortalUser,
  ) {
    this.validateSlug(customerSlug, user.customer_slug);

    return this.portalProjectService.listProjects(
      user.tenant_id,
      user.lead_id,
      { page: query.page, limit: query.limit },
    );
  }

  // ---------------------------------------------------------------------------
  // GET /portal/:customerSlug/projects/:id
  // ---------------------------------------------------------------------------

  @Get(':customerSlug/projects/:id')
  @ApiOperation({
    summary: 'Get portal project detail with tasks and permits (sanitized)',
  })
  @ApiParam({
    name: 'customerSlug',
    description: 'Customer slug from portal account (must match token)',
    example: 'john-smith',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiResponse({
    status: 200,
    description: 'Project detail with tasks and permits (no costs/crew/notes)',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing portal token' })
  @ApiResponse({ status: 403, description: 'Forbidden — customerSlug does not match token' })
  @ApiResponse({ status: 404, description: 'Project not found or not portal-enabled' })
  async getProjectDetail(
    @Param('customerSlug') customerSlug: string,
    @Param('id') projectId: string,
    @CurrentPortalUser() user: AuthenticatedPortalUser,
  ) {
    this.validateSlug(customerSlug, user.customer_slug);

    return this.portalProjectService.getProjectDetail(
      user.tenant_id,
      user.lead_id,
      projectId,
    );
  }

  // ---------------------------------------------------------------------------
  // GET /portal/:customerSlug/projects/:id/logs
  // ---------------------------------------------------------------------------

  @Get(':customerSlug/projects/:id/logs')
  @ApiOperation({
    summary: 'Get public project logs (is_public=true only)',
  })
  @ApiParam({
    name: 'customerSlug',
    description: 'Customer slug from portal account (must match token)',
    example: 'john-smith',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of public project logs with attachments',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing portal token' })
  @ApiResponse({ status: 403, description: 'Forbidden — customerSlug does not match token' })
  @ApiResponse({ status: 404, description: 'Project not found or not portal-enabled' })
  async getPublicLogs(
    @Param('customerSlug') customerSlug: string,
    @Param('id') projectId: string,
    @Query() query: PortalPaginationQueryDto,
    @CurrentPortalUser() user: AuthenticatedPortalUser,
  ) {
    this.validateSlug(customerSlug, user.customer_slug);

    return this.portalProjectService.getPublicLogs(
      user.tenant_id,
      projectId,
      user.lead_id,
      { page: query.page, limit: query.limit },
    );
  }

  // ---------------------------------------------------------------------------
  // GET /portal/:customerSlug/projects/:id/photos
  // ---------------------------------------------------------------------------

  @Get(':customerSlug/projects/:id/photos')
  @ApiOperation({
    summary: 'Get public project photos (is_public=true only)',
  })
  @ApiParam({
    name: 'customerSlug',
    description: 'Customer slug from portal account (must match token)',
    example: 'john-smith',
  })
  @ApiParam({
    name: 'id',
    description: 'Project UUID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({
    status: 200,
    description: 'Paginated list of public project photos',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — invalid or missing portal token' })
  @ApiResponse({ status: 403, description: 'Forbidden — customerSlug does not match token' })
  @ApiResponse({ status: 404, description: 'Project not found or not portal-enabled' })
  async getPublicPhotos(
    @Param('customerSlug') customerSlug: string,
    @Param('id') projectId: string,
    @Query() query: PortalPaginationQueryDto,
    @CurrentPortalUser() user: AuthenticatedPortalUser,
  ) {
    this.validateSlug(customerSlug, user.customer_slug);

    return this.portalProjectService.getPublicPhotos(
      user.tenant_id,
      projectId,
      user.lead_id,
      { page: query.page, limit: query.limit },
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Validate that the customerSlug in the URL matches the one from
   * the portal JWT token. If mismatch → 403 Forbidden.
   *
   * This prevents a customer from accessing another customer's portal
   * data by manipulating the URL slug.
   */
  private validateSlug(urlSlug: string, tokenSlug: string): void {
    if (urlSlug !== tokenSlug) {
      throw new ForbiddenException(
        'Access denied: customer slug does not match your account',
      );
    }
  }
}
