import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { TenantId } from '../../auth/decorators/tenant-id.decorator';
import { CrewMemberService } from '../services/crew-member.service';
import { CreateCrewMemberDto } from '../dto/create-crew-member.dto';
import { UpdateCrewMemberDto } from '../dto/update-crew-member.dto';

@ApiTags('Crew Members')
@ApiBearerAuth()
@Controller('crew')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrewMemberController {
  constructor(private readonly crewMemberService: CrewMemberService) {}

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a crew member' })
  @ApiResponse({ status: 201, description: 'Crew member created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @TenantId() tenantId: string,
    @Request() req,
    @Body() dto: CreateCrewMemberDto,
  ) {
    return this.crewMemberService.create(tenantId, req.user.id, dto);
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List crew members (paginated)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated crew member list' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('is_active') isActive?: string,
    @Query('search') search?: string,
  ) {
    return this.crewMemberService.findAll(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      is_active:
        isActive !== undefined ? isActive === 'true' : undefined,
      search: search || undefined,
    });
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get crew member detail (masked)' })
  @ApiParam({ name: 'id', description: 'Crew member UUID' })
  @ApiResponse({ status: 200, description: 'Crew member with masked fields' })
  @ApiResponse({ status: 404, description: 'Crew member not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.crewMemberService.findOne(tenantId, id);
  }

  @Get(':id/reveal/:field')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Reveal a sensitive field (audit logged)' })
  @ApiParam({ name: 'id', description: 'Crew member UUID' })
  @ApiParam({
    name: 'field',
    description: 'Field to reveal',
    enum: ['ssn', 'itin', 'drivers_license_number', 'bank_routing', 'bank_account'],
  })
  @ApiResponse({ status: 200, description: 'Decrypted field value' })
  @ApiResponse({ status: 400, description: 'Invalid field name' })
  @ApiResponse({ status: 404, description: 'Crew member or field not found' })
  async revealField(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('field') field: string,
  ) {
    return this.crewMemberService.revealField(tenantId, id, req.user.id, field);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update crew member' })
  @ApiParam({ name: 'id', description: 'Crew member UUID' })
  @ApiResponse({ status: 200, description: 'Updated crew member' })
  @ApiResponse({ status: 404, description: 'Crew member not found' })
  async update(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCrewMemberDto,
  ) {
    return this.crewMemberService.update(tenantId, id, req.user.id, dto);
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete crew member (set is_active = false)' })
  @ApiParam({ name: 'id', description: 'Crew member UUID' })
  @ApiResponse({ status: 200, description: 'Crew member deactivated' })
  @ApiResponse({ status: 404, description: 'Crew member not found' })
  async softDelete(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.crewMemberService.softDelete(tenantId, id, req.user.id);
    return { message: 'Crew member deactivated' };
  }

  @Post(':id/photo')
  @Roles('Owner', 'Admin', 'Manager')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload profile photo' })
  @ApiParam({ name: 'id', description: 'Crew member UUID' })
  @ApiResponse({ status: 201, description: 'Photo uploaded' })
  @ApiResponse({ status: 404, description: 'Crew member not found' })
  @HttpCode(HttpStatus.CREATED)
  async uploadPhoto(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.crewMemberService.uploadProfilePhoto(
      tenantId,
      id,
      req.user.id,
      file,
    );
  }

  @Delete(':id/photo')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete profile photo (hard delete)' })
  @ApiParam({ name: 'id', description: 'Crew member UUID' })
  @ApiResponse({ status: 200, description: 'Photo deleted' })
  @ApiResponse({ status: 404, description: 'Crew member or photo not found' })
  async deletePhoto(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.crewMemberService.deleteProfilePhoto(
      tenantId,
      id,
      req.user.id,
    );
    return { message: 'Profile photo deleted' };
  }
}
