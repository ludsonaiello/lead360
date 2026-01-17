import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Logger,
  ConflictException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiExcludeEndpoint,
} from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { WebhookAuthGuard } from '../guards/webhook-auth.guard';
import { LeadsService } from '../services/leads.service';
import { WebhookLeadDto, CreateLeadDto } from '../dto';

@ApiTags('Webhooks (Public)')
@Controller('public/leads/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly leadsService: LeadsService) {}

  /**
   * PUBLIC WEBHOOK ENDPOINT
   * Each tenant has unique URL: https://{subdomain}.lead360.app/api/v1/public/leads/webhook
   * Example: https://acme-plumbing.lead360.app/api/v1/public/leads/webhook
   */
  @Post()
  @Public() // Bypass global JWT auth - WebhookAuthGuard handles both JWT and API key
  @UseGuards(WebhookAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Receive lead from external webhook (PUBLIC endpoint)',
    description: `
      **Subdomain-Based Tenant Resolution:**
      - Each tenant has a unique webhook URL using their subdomain
      - Example: https://acme-plumbing.lead360.app/api/v1/public/leads/webhook
      - The subdomain identifies the tenant automatically

      **Authentication:**
      - Provide your API key in X-API-Key header or Authorization: Bearer {key}
      - The API key MUST belong to the tenant identified by the subdomain

      **Address Auto-Geocoding:**
      - Google Maps will auto-fill city/state if not provided
      - Lat/lng will be fetched automatically if not provided
      - Minimum required: address_line1 + zip_code

      **Deduplication:**
      - If external_source_id is provided, duplicate leads will be prevented
      - If phone is provided, existing leads with same phone (per tenant) will be rejected (409)
    `,
  })
  @ApiHeader({
    name: 'X-API-Key',
    description: 'Webhook API key (or use Authorization: Bearer {key})',
    required: true,
    example: 'lead360_webhook_abc123...',
  })
  @ApiResponse({
    status: 201,
    description: 'Lead created successfully from webhook',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid data or validation error',
  })
  @ApiResponse({
    status: 401,
    description: 'Invalid or missing API key',
  })
  @ApiResponse({
    status: 409,
    description: 'Phone number or external_source_id already exists',
  })
  @ApiResponse({
    status: 422,
    description: 'Address validation failed (Google Maps)',
  })
  async receiveWebhookLead(
    @Request() req,
    @Body() webhookLeadDto: WebhookLeadDto,
  ) {
    // Log the entire request for debugging
    this.logger.log(`=== WEBHOOK REQUEST DEBUG ===`);
    this.logger.log(`Host: ${req.headers.host}`);
    this.logger.log(`Headers: ${JSON.stringify(req.headers)}`);
    this.logger.log(`Body: ${JSON.stringify(webhookLeadDto)}`);
    this.logger.log(`req.tenant exists: ${!!req.tenant}`);
    this.logger.log(`=== END DEBUG ===`);

    const tenantId = req.tenant.id;
    const tenantName = req.tenant.company_name;

    this.logger.log(
      `Webhook lead received for tenant ${tenantId} (${tenantName})`,
    );
    this.logger.log(`Webhook data: ${JSON.stringify(webhookLeadDto)}`);

    // Check for duplicate by external_source_id
    if (webhookLeadDto.external_source_id) {
      const existingLead = await this.leadsService.findByExternalSourceId(
        tenantId,
        webhookLeadDto.external_source_id,
      );
      if (existingLead) {
        this.logger.warn(
          `Duplicate lead detected: external_source_id ${webhookLeadDto.external_source_id} already exists for tenant ${tenantId}`,
        );
        throw new ConflictException(
          `Lead with external_source_id ${webhookLeadDto.external_source_id} already exists`,
        );
      }
    }

    // Check for duplicate by phone (if provided)
    if (webhookLeadDto.phone) {
      const sanitizedPhone = webhookLeadDto.phone.replace(/\D/g, '');
      const phoneExists = await this.leadsService.checkPhoneExists(
        tenantId,
        sanitizedPhone,
      );
      if (phoneExists) {
        this.logger.warn(
          `Duplicate lead detected: phone ${webhookLeadDto.phone} already exists for tenant ${tenantId}`,
        );
        throw new ConflictException(
          `Lead with phone number ${webhookLeadDto.phone} already exists`,
        );
      }
    }

    // Transform webhook DTO to CreateLeadDto
    const createLeadDto: CreateLeadDto = {
      first_name: webhookLeadDto.first_name,
      last_name: webhookLeadDto.last_name,
      source: 'webhook' as any, // Override to webhook source
      external_source_id: webhookLeadDto.external_source_id,
      emails: webhookLeadDto.email
        ? [
            {
              email: webhookLeadDto.email,
              email_type: 'personal' as any,
              is_primary: true,
            },
          ]
        : [],
      phones: webhookLeadDto.phone
        ? [
            {
              phone: webhookLeadDto.phone,
              phone_type: 'mobile' as any,
              is_primary: true,
            },
          ]
        : [],
      addresses: [
        {
          address_line1: webhookLeadDto.address_line1,
          address_line2: webhookLeadDto.address_line2,
          city: webhookLeadDto.city,
          state: webhookLeadDto.state,
          zip_code: webhookLeadDto.zip_code,
          address_type: 'service' as any,
          is_primary: true,
        },
      ],
      service_request:
        webhookLeadDto.service_type && webhookLeadDto.service_description
          ? {
              service_name: webhookLeadDto.service_type,
              service_type: webhookLeadDto.service_type,
              service_description: webhookLeadDto.service_description,
              urgency: 'medium' as any,
            }
          : undefined,
    };

    // Validate: At least 1 email OR 1 phone
    if (createLeadDto.emails.length === 0 && createLeadDto.phones.length === 0) {
      throw new ConflictException(
        'Lead must have at least one email or phone number',
      );
    }

    // Create lead (uses LeadsService.createFromWebhook)
    const lead = await this.leadsService.createFromWebhook(
      tenantId,
      createLeadDto,
    );

    this.logger.log(
      `Webhook lead created successfully: ${lead.id} for tenant ${tenantId}`,
    );

    return {
      success: true,
      lead_id: lead.id,
      message: 'Lead created successfully from webhook',
    };
  }
}
