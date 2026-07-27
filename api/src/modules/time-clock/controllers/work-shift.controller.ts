import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Roles } from '../../rbac/decorators/roles.decorator';
import { RolesGuard } from '../../rbac/guards/roles.guard';
import {
  BulkCreateWorkShiftDto,
  CreateWorkShiftDto,
  ListMyShiftsDto,
  ListWorkShiftsDto,
  UpdateWorkShiftDto,
} from '../dto/work-shift.dto';
import { WorkShiftService } from '../services/work-shift.service';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkShiftController {
  constructor(private readonly workShiftService: WorkShiftService) {}

  // ──── STATIC ROUTES FIRST (before /:id) ────────────────────────

  @Get('shifts/mine')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'Get my scheduled shifts' })
  @ApiResponse({ status: 200, description: 'List of current user shifts' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 404,
    description: 'No employee profile found for current user',
  })
  async findMine(@Request() req, @Query() query: ListMyShiftsDto) {
    return this.workShiftService.findMine(
      req.user.tenant_id,
      req.user.id,
      query,
    );
  }

  @Post('shifts/bulk')
  @Roles('Owner', 'Admin', 'Project Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Bulk create work shifts' })
  @ApiResponse({ status: 201, description: 'Shifts created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 404,
    description: 'Employee profile, project or task not found',
  })
  async bulkCreate(@Request() req, @Body() dto: BulkCreateWorkShiftDto) {
    return this.workShiftService.bulkCreate(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  // ──── COLLECTION ROUTES ────────────────────────────────────────

  @Get('shifts')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'List work shifts' })
  @ApiResponse({ status: 200, description: 'Paginated list of work shifts' })
  async findAll(@Request() req, @Query() query: ListWorkShiftsDto) {
    return this.workShiftService.findAll(req.user.tenant_id, query);
  }

  @Post('shifts')
  @Roles('Owner', 'Admin', 'Project Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create work shift' })
  @ApiResponse({ status: 201, description: 'Work shift created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({
    status: 404,
    description: 'Employee profile, project or task not found',
  })
  async create(@Request() req, @Body() dto: CreateWorkShiftDto) {
    return this.workShiftService.create(req.user.tenant_id, req.user.id, dto);
  }

  // ──── PARAMETERIZED ROUTES LAST ────────────────────────────────

  @Get('shifts/:id')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Get work shift by ID' })
  @ApiResponse({ status: 200, description: 'Work shift detail' })
  @ApiResponse({ status: 404, description: 'Work shift not found' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.workShiftService.findOne(req.user.tenant_id, id);
  }

  @Patch('shifts/:id')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Update work shift' })
  @ApiResponse({ status: 200, description: 'Work shift updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Work shift not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkShiftDto,
  ) {
    return this.workShiftService.update(
      req.user.tenant_id,
      req.user.id,
      id,
      dto,
    );
  }

  @Delete('shifts/:id')
  @Roles('Owner', 'Admin', 'Project Manager')
  @ApiOperation({ summary: 'Delete work shift' })
  @ApiResponse({ status: 200, description: 'Work shift deleted' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete shift in current status',
  })
  @ApiResponse({ status: 404, description: 'Work shift not found' })
  async remove(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.workShiftService.remove(req.user.tenant_id, req.user.id, id);
  }
}
