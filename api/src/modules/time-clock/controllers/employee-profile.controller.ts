import {
  Body,
  Controller,
  Delete,
  Get,
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
  CreateEmployeeProfileDto,
  ListEmployeeProfilesDto,
  SavePushSubscriptionDto,
  SetEmployeePinDto,
  UpdateEmployeeProfileDto,
} from '../dto/employee-profile.dto';
import { EmployeeProfileService } from '../services/employee-profile.service';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeProfileController {
  constructor(
    private readonly employeeProfileService: EmployeeProfileService,
  ) {}

  // /employees/me/* routes MUST be declared BEFORE /:id routes.
  @Post('employees/me/push-subscription')
  @Roles('Owner', 'Admin', 'Project Manager', 'Employee')
  @ApiOperation({ summary: 'Save web push subscription for current user' })
  @ApiResponse({ status: 201, description: 'Push subscription saved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({
    status: 404,
    description: 'No employee profile found for current user',
  })
  async savePushSubscription(
    @Request() req,
    @Body() dto: SavePushSubscriptionDto,
  ) {
    return this.employeeProfileService.savePushSubscription(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get('employees')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List employee profiles' })
  @ApiResponse({ status: 200, description: 'Paginated employee profiles' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll(@Request() req, @Query() query: ListEmployeeProfilesDto) {
    return this.employeeProfileService.findAll(req.user.tenant_id, query);
  }

  @Post('employees')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Create employee profile' })
  @ApiResponse({ status: 201, description: 'Employee profile created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({
    status: 404,
    description: 'User or crew member not found in tenant',
  })
  @ApiResponse({
    status: 409,
    description: 'Profile already exists for this user',
  })
  async create(@Request() req, @Body() dto: CreateEmployeeProfileDto) {
    return this.employeeProfileService.create(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get('employees/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Get employee profile detail' })
  @ApiResponse({ status: 200, description: 'Employee profile detail' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  async findOne(@Request() req, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.employeeProfileService.findOne(req.user.tenant_id, id);
  }

  @Patch('employees/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update employee profile' })
  @ApiResponse({ status: 200, description: 'Employee profile updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  async update(
    @Request() req,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmployeeProfileDto,
  ) {
    return this.employeeProfileService.update(
      req.user.tenant_id,
      req.user.id,
      id,
      dto,
    );
  }

  @Post('employees/:id/pin')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Set employee kiosk PIN' })
  @ApiResponse({ status: 201, description: 'PIN updated successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  async setPin(
    @Request() req,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: SetEmployeePinDto,
  ) {
    return this.employeeProfileService.setPin(
      req.user.tenant_id,
      req.user.id,
      id,
      dto,
    );
  }

  @Delete('employees/:id/pin')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Remove employee kiosk PIN' })
  @ApiResponse({ status: 200, description: 'PIN removed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Employee profile not found' })
  async removePin(
    @Request() req,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.employeeProfileService.removePin(
      req.user.tenant_id,
      req.user.id,
      id,
    );
  }
}
