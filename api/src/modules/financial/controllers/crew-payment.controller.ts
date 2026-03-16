import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CrewPaymentService } from '../services/crew-payment.service';
import { CreateCrewPaymentDto } from '../dto/create-crew-payment.dto';
import { ListCrewPaymentsDto } from '../dto/list-crew-payments.dto';

@ApiTags('Crew Payments')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrewPaymentController {
  constructor(private readonly crewPaymentService: CrewPaymentService) {}

  @Post('crew-payments')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'Create a crew payment record' })
  @ApiResponse({ status: 201, description: 'Payment created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Crew member not found' })
  async create(@Request() req, @Body() dto: CreateCrewPaymentDto) {
    return this.crewPaymentService.createPayment(
      req.user.tenant_id,
      req.user.id,
      dto.crew_member_id,
      dto,
    );
  }

  @Get('crew-payments')
  @Roles('Owner', 'Admin', 'Bookkeeper')
  @ApiOperation({ summary: 'List crew payments (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of crew payments' })
  async findAll(@Request() req, @Query() query: ListCrewPaymentsDto) {
    return this.crewPaymentService.listPayments(req.user.tenant_id, query);
  }
}

@ApiTags('Crew Payment History')
@ApiBearerAuth()
@Controller('crew')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrewPaymentHistoryController {
  constructor(private readonly crewPaymentService: CrewPaymentService) {}

  @Get(':crewMemberId/payment-history')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'Get payment history for a crew member' })
  @ApiParam({ name: 'crewMemberId', description: 'Crew member UUID' })
  @ApiResponse({ status: 200, description: 'Paginated payment history' })
  async getPaymentHistory(
    @Request() req,
    @Param('crewMemberId', ParseUUIDPipe) crewMemberId: string,
    @Query() query: ListCrewPaymentsDto,
  ) {
    return this.crewPaymentService.getPaymentHistory(
      req.user.tenant_id,
      crewMemberId,
      query,
    );
  }
}
