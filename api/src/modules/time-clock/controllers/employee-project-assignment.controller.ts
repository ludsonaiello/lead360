import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
  CreateEmployeeProjectAssignmentDto,
  ListEmployeeProjectAssignmentsDto,
} from '../dto/employee-project-assignment.dto';
import { EmployeeProjectAssignmentService } from '../services/employee-project-assignment.service';

@ApiTags('Time Clock')
@ApiBearerAuth()
@Controller('time-clock')
@UseGuards(JwtAuthGuard, RolesGuard)
export class EmployeeProjectAssignmentController {
  constructor(
    private readonly assignmentService: EmployeeProjectAssignmentService,
  ) {}

  @Get('employee-projects')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'List employee-project assignments' })
  @ApiResponse({ status: 200, description: 'Paginated list of assignments' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  async findAll(
    @Request() req,
    @Query() query: ListEmployeeProjectAssignmentsDto,
  ) {
    return this.assignmentService.findAll(req.user.tenant_id, query);
  }

  @Post('employee-projects')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Assign employee to project' })
  @ApiResponse({ status: 201, description: 'Assignment created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({
    status: 404,
    description: 'Employee profile or project not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Employee is already assigned to this project',
  })
  async create(
    @Request() req,
    @Body() dto: CreateEmployeeProjectAssignmentDto,
  ) {
    return this.assignmentService.create(req.user.tenant_id, req.user.id, dto);
  }

  @Delete('employee-projects/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Remove employee-project assignment' })
  @ApiResponse({ status: 200, description: 'Assignment removed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Assignment not found' })
  async remove(@Request() req, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.assignmentService.remove(req.user.tenant_id, req.user.id, id);
  }
}
