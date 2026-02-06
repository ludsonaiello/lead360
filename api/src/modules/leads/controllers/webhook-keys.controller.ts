import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiProperty,
} from '@nestjs/swagger';
import { IsString, IsOptional, Length } from 'class-validator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { WebhookAuthService } from '../services/webhook-auth.service';

class CreateWebhookKeyDto {
  @ApiProperty({
    description: 'Name/description for this API key',
    example: 'Website contact form integration',
  })
  @IsString()
  @IsOptional()
  @Length(1, 100)
  key_name?: string;
}

@ApiTags('Webhook API Keys')
@ApiBearerAuth()
@Controller('webhook-keys')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WebhookKeysController {
  private readonly logger = new Logger(WebhookKeysController.name);

  constructor(private readonly webhookAuthService: WebhookAuthService) {}

  @Post()
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Create a new webhook API key',
    description: `
      **IMPORTANT:** The plain text API key is returned ONLY ONCE.
      You must save it immediately - it cannot be retrieved later.

      **Your webhook URL will be:**
      https://{your-subdomain}.lead360.app/api/v1/public/leads/webhook
    `,
  })
  @ApiResponse({
    status: 201,
    description:
      'API key created successfully (SAVE THE KEY - shown only once)',
  })
  async create(
    @Request() req,
    @Body() createWebhookKeyDto: CreateWebhookKeyDto,
  ) {
    const { key, record } = await this.webhookAuthService.createApiKey(
      req.user.tenant_id,
      req.user.id,
      createWebhookKeyDto.key_name,
    );

    const webhookUrl = `https://${record.tenant.subdomain}.lead360.app/api/v1/public/leads/webhook`;

    return {
      success: true,
      api_key: key, // PLAIN TEXT KEY - ONLY TIME IT'S VISIBLE
      key_id: record.id,
      key_name: record.key_name,
      webhook_url: webhookUrl,
      created_at: record.created_at,
      warning:
        'SAVE THIS KEY NOW - It will never be shown again. Store it securely.',
    };
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'List all webhook API keys for current tenant',
    description:
      'Returns metadata only - API keys themselves are hashed and not retrievable',
  })
  @ApiResponse({ status: 200, description: 'API keys retrieved successfully' })
  async list(@Request() req) {
    const keys = await this.webhookAuthService.listApiKeys(req.user.tenant_id);

    const tenantSubdomain =
      keys[0]?.tenant?.subdomain || req.user.tenant?.subdomain;
    const webhookUrl = tenantSubdomain
      ? `https://${tenantSubdomain}.lead360.app/api/v1/public/leads/webhook`
      : null;

    return {
      webhook_url: webhookUrl,
      api_keys: keys.map((k) => ({
        id: k.id,
        key_name: k.key_name,
        is_active: k.is_active,
        created_at: k.created_at,
        last_used_at: k.last_used_at,
        created_by: k.created_by_user
          ? {
              id: k.created_by_user.id,
              name: `${k.created_by_user.first_name} ${k.created_by_user.last_name}`,
              email: k.created_by_user.email,
            }
          : null,
      })),
    };
  }

  @Patch(':id/toggle')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Toggle webhook API key active/inactive status',
    description: 'Activate or deactivate an API key',
  })
  @ApiParam({ name: 'id', description: 'Webhook API key UUID' })
  @ApiResponse({
    status: 200,
    description: 'API key status toggled successfully',
  })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async toggle(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    const updated = await this.webhookAuthService.toggleApiKey(
      req.user.tenant_id,
      id,
    );

    return {
      id: updated.id,
      key_name: updated.key_name,
      is_active: updated.is_active,
      created_at: updated.created_at,
      last_used_at: updated.last_used_at,
      created_by: updated.created_by_user
        ? {
            id: updated.created_by_user.id,
            name: `${updated.created_by_user.first_name} ${updated.created_by_user.last_name}`,
            email: updated.created_by_user.email,
          }
        : null,
    };
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Deactivate (delete) a webhook API key',
    description: 'The key will no longer work for webhook authentication',
  })
  @ApiParam({ name: 'id', description: 'Webhook API key UUID' })
  @ApiResponse({ status: 204, description: 'API key deactivated successfully' })
  @ApiResponse({ status: 404, description: 'API key not found' })
  async delete(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.webhookAuthService.deactivateApiKey(req.user.tenant_id, id);
  }
}
