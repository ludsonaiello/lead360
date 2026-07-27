import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { KioskClockInDto, KioskClockOutDto } from '../dto/kiosk.dto';
import {
  KioskAuthenticatedRequest,
  KioskTokenGuard,
} from '../guards/kiosk-token.guard';
import { KioskService } from '../services/kiosk.service';

@ApiTags('Time Clock - Kiosk')
@Controller('time-clock/kiosk')
@Public()
@UseGuards(KioskTokenGuard)
@ApiHeader({
  name: 'X-Kiosk-Token',
  required: true,
  description: 'Kiosk authentication token',
})
export class KioskController {
  constructor(private readonly kioskService: KioskService) {}

  @Get('employees')
  @ApiOperation({ summary: 'List kiosk-eligible employees' })
  @ApiResponse({ status: 200, description: 'List of kiosk-eligible employees' })
  @ApiResponse({ status: 401, description: 'Missing or invalid kiosk token' })
  async getEmployees(@Req() req: KioskAuthenticatedRequest) {
    return this.kioskService.getEmployees(req.kioskTenantId as string);
  }

  @Post('clock-in')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clock in via kiosk' })
  @ApiResponse({ status: 200, description: 'Clock session created' })
  @ApiResponse({ status: 401, description: 'Invalid kiosk token or PIN' })
  @ApiResponse({ status: 404, description: 'Employee not found' })
  @ApiResponse({ status: 409, description: 'Already clocked in' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  @ApiResponse({ status: 429, description: 'Too many PIN attempts' })
  async clockIn(
    @Req() req: KioskAuthenticatedRequest,
    @Body() dto: KioskClockInDto,
  ) {
    return this.kioskService.clockIn(
      req.kioskTenantId as string,
      dto,
      req.kioskTokenHash as string,
    );
  }

  @Post('clock-out')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clock out via kiosk' })
  @ApiResponse({ status: 200, description: 'Clock session completed' })
  @ApiResponse({ status: 401, description: 'Invalid kiosk token or PIN' })
  @ApiResponse({ status: 404, description: 'Employee or session not found' })
  @ApiResponse({ status: 423, description: 'Account locked' })
  @ApiResponse({ status: 429, description: 'Too many PIN attempts' })
  async clockOut(
    @Req() req: KioskAuthenticatedRequest,
    @Body() dto: KioskClockOutDto,
  ) {
    return this.kioskService.clockOut(
      req.kioskTenantId as string,
      dto,
      req.kioskTokenHash as string,
    );
  }
}
