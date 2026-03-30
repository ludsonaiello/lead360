import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { PaymentMethodRegistryService } from '../services/payment-method-registry.service';
import { CreatePaymentMethodRegistryDto } from '../dto/create-payment-method-registry.dto';
import { UpdatePaymentMethodRegistryDto } from '../dto/update-payment-method-registry.dto';
import { ListPaymentMethodsDto } from '../dto/list-payment-methods.dto';

@ApiTags('Payment Method Registry')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PaymentMethodRegistryController {
  constructor(
    private readonly paymentMethodRegistryService: PaymentMethodRegistryService,
  ) {}

  // ---------------------------------------------------------------------------
  // LIST — GET /financial/payment-methods
  // ---------------------------------------------------------------------------

  @Get('payment-methods')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
  @ApiOperation({ summary: 'List payment methods for tenant' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean, description: 'Filter by active status (default: true)' })
  @ApiQuery({ name: 'type', required: false, enum: ['cash', 'check', 'bank_transfer', 'venmo', 'zelle', 'credit_card', 'debit_card', 'ACH'], description: 'Filter by payment type' })
  @ApiResponse({ status: 200, description: 'Array of payment methods with usage data' })
  async findAll(@Request() req, @Query() query: ListPaymentMethodsDto) {
    return this.paymentMethodRegistryService.findAll(req.user.tenant_id, query);
  }

  // ---------------------------------------------------------------------------
  // CREATE — POST /financial/payment-methods
  // ---------------------------------------------------------------------------

  @Post('payment-methods')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a payment method' })
  @ApiResponse({ status: 201, description: 'Payment method created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error (invalid last_four, limit reached, invalid type)' })
  @ApiResponse({ status: 409, description: 'Nickname already exists for this tenant' })
  async create(@Request() req, @Body() dto: CreatePaymentMethodRegistryDto) {
    return this.paymentMethodRegistryService.create(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  // ---------------------------------------------------------------------------
  // GET ONE — GET /financial/payment-methods/:id
  // ---------------------------------------------------------------------------

  @Get('payment-methods/:id')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get a single payment method' })
  @ApiParam({ name: 'id', description: 'Payment method UUID' })
  @ApiResponse({ status: 200, description: 'Payment method with usage data' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentMethodRegistryService.findOne(req.user.tenant_id, id);
  }

  // ---------------------------------------------------------------------------
  // UPDATE — PATCH /financial/payment-methods/:id
  // ---------------------------------------------------------------------------

  @Patch('payment-methods/:id')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Update a payment method' })
  @ApiParam({ name: 'id', description: 'Payment method UUID' })
  @ApiResponse({ status: 200, description: 'Payment method updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error (invalid last_four)' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  @ApiResponse({ status: 409, description: 'Nickname already exists for this tenant' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePaymentMethodRegistryDto,
  ) {
    return this.paymentMethodRegistryService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }

  // ---------------------------------------------------------------------------
  // DELETE — DELETE /financial/payment-methods/:id
  // ---------------------------------------------------------------------------

  @Delete('payment-methods/:id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a payment method (soft by default, permanent with ?permanent=true)' })
  @ApiParam({ name: 'id', description: 'Payment method UUID' })
  @ApiQuery({ name: 'permanent', required: false, type: Boolean, description: 'Set to true to permanently delete (only works if payment method has zero usage)' })
  @ApiResponse({ status: 200, description: 'Payment method deactivated or permanently deleted.' })
  @ApiResponse({ status: 400, description: 'Cannot permanently delete — payment method is in use' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async remove(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Query('permanent') permanent?: string,
  ) {
    if (permanent === 'true') {
      return this.paymentMethodRegistryService.hardDelete(
        req.user.tenant_id,
        id,
        req.user.id,
      );
    }
    return this.paymentMethodRegistryService.softDelete(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }

  // ---------------------------------------------------------------------------
  // SET DEFAULT — POST /financial/payment-methods/:id/set-default
  // ---------------------------------------------------------------------------

  @Post('payment-methods/:id/set-default')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Set a payment method as the tenant default' })
  @ApiParam({ name: 'id', description: 'Payment method UUID' })
  @ApiResponse({ status: 200, description: 'Payment method set as default successfully' })
  @ApiResponse({ status: 400, description: 'Payment method is inactive' })
  @ApiResponse({ status: 404, description: 'Payment method not found' })
  async setDefault(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.paymentMethodRegistryService.setDefault(
      req.user.tenant_id,
      id,
      req.user.id,
    );
  }
}
