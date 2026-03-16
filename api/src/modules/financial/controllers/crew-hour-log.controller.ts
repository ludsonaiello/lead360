import {
  Controller,
  Get,
  Post,
  Patch,
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
import { CrewHourLogService } from '../services/crew-hour-log.service';
import { CreateCrewHourLogDto } from '../dto/create-crew-hour-log.dto';
import { UpdateCrewHourLogDto } from '../dto/update-crew-hour-log.dto';
import { ListCrewHoursDto } from '../dto/list-crew-hours.dto';

@ApiTags('Crew Hours')
@ApiBearerAuth()
@Controller('financial')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrewHourLogController {
  constructor(private readonly crewHourLogService: CrewHourLogService) {}

  @Post('crew-hours')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Log hours for a crew member' })
  @ApiResponse({ status: 201, description: 'Hour log created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 404, description: 'Crew member or project not found' })
  async create(@Request() req, @Body() dto: CreateCrewHourLogDto) {
    return this.crewHourLogService.logHours(
      req.user.tenant_id,
      req.user.id,
      dto,
    );
  }

  @Get('crew-hours')
  @Roles('Owner', 'Admin', 'Manager', 'Bookkeeper')
  @ApiOperation({ summary: 'List crew hours (paginated)' })
  @ApiResponse({ status: 200, description: 'Paginated list of crew hour logs' })
  async findAll(@Request() req, @Query() query: ListCrewHoursDto) {
    return this.crewHourLogService.listHours(req.user.tenant_id, query);
  }

  @Patch('crew-hours/:id')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Update a crew hour log entry' })
  @ApiParam({ name: 'id', description: 'Hour log UUID' })
  @ApiResponse({ status: 200, description: 'Hour log updated' })
  @ApiResponse({ status: 404, description: 'Hour log not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrewHourLogDto,
  ) {
    return this.crewHourLogService.updateHours(
      req.user.tenant_id,
      id,
      req.user.id,
      dto,
    );
  }
}
