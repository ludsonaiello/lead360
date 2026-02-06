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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { LeadsService } from '../services/leads.service';
import { LeadEmailsService } from '../services/lead-emails.service';
import { LeadPhonesService } from '../services/lead-phones.service';
import { LeadAddressesService } from '../services/lead-addresses.service';
import { LeadNotesService } from '../services/lead-notes.service';
import { LeadActivitiesService } from '../services/lead-activities.service';
import {
  CreateLeadDto,
  UpdateLeadDto,
  UpdateStatusDto,
  ListLeadsDto,
  CreateEmailDto,
  UpdateEmailDto,
  CreatePhoneDto,
  UpdatePhoneDto,
  CreateAddressDto,
  UpdateAddressDto,
  CreateNoteDto,
  UpdateNoteDto,
} from '../dto';

@ApiTags('Leads')
@ApiBearerAuth()
@Controller('leads')
@UseGuards(JwtAuthGuard, RolesGuard)
export class LeadsController {
  private readonly logger = new Logger(LeadsController.name);

  constructor(
    private readonly leadsService: LeadsService,
    private readonly emailsService: LeadEmailsService,
    private readonly phonesService: LeadPhonesService,
    private readonly addressesService: LeadAddressesService,
    private readonly notesService: LeadNotesService,
    private readonly activitiesService: LeadActivitiesService,
  ) {}

  // ========== LEAD CRUD ==========

  @Post()
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Create a new lead with nested entities' })
  @ApiResponse({ status: 201, description: 'Lead created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid data or validation error' })
  @ApiResponse({ status: 409, description: 'Phone number already exists' })
  @ApiResponse({
    status: 422,
    description: 'Address validation failed (Google Maps)',
  })
  async create(@Request() req, @Body() createLeadDto: CreateLeadDto) {
    return this.leadsService.create(
      req.user.tenant_id,
      req.user.id,
      createLeadDto,
    );
  }

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get all leads with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Leads retrieved successfully' })
  async findAll(@Request() req, @Query() listLeadsDto: ListLeadsDto) {
    return this.leadsService.findAll(req.user.tenant_id, listLeadsDto);
  }

  @Get('stats')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Get dashboard statistics for leads' })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
  })
  async getStats(@Request() req) {
    return this.leadsService.getStats(req.user.tenant_id);
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get a single lead by ID with all relations' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'Lead retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async findOne(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findOne(req.user.tenant_id, id);
  }

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Update lead basic information' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'Lead updated successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async update(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateLeadDto: UpdateLeadDto,
  ) {
    return this.leadsService.update(
      req.user.tenant_id,
      id,
      req.user.id,
      updateLeadDto,
    );
  }

  @Patch(':id/status')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Update lead status with validation' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Invalid status transition or missing lost_reason',
  })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async updateStatus(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ) {
    return this.leadsService.updateStatus(
      req.user.tenant_id,
      id,
      req.user.id,
      updateStatusDto,
    );
  }

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead (hard delete with cascade)' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 204, description: 'Lead deleted successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async delete(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    await this.leadsService.delete(req.user.tenant_id, id, req.user.id);
  }

  // ========== EMAIL MANAGEMENT ==========

  @Post(':id/emails')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Add an email to a lead' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 201, description: 'Email added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid email format' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async createEmail(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() createEmailDto: CreateEmailDto,
  ) {
    return this.emailsService.create(
      req.user.tenant_id,
      leadId,
      req.user.id,
      createEmailDto,
    );
  }

  @Patch(':id/emails/:emailId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Update a lead email' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiParam({ name: 'emailId', description: 'Email UUID' })
  @ApiResponse({ status: 200, description: 'Email updated successfully' })
  @ApiResponse({ status: 404, description: 'Email not found' })
  async updateEmail(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Param('emailId', ParseUUIDPipe) emailId: string,
    @Body() updateEmailDto: UpdateEmailDto,
  ) {
    return this.emailsService.update(
      req.user.tenant_id,
      leadId,
      emailId,
      req.user.id,
      updateEmailDto,
    );
  }

  @Delete(':id/emails/:emailId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead email' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiParam({ name: 'emailId', description: 'Email UUID' })
  @ApiResponse({ status: 204, description: 'Email deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete last contact method',
  })
  @ApiResponse({ status: 404, description: 'Email not found' })
  async deleteEmail(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Param('emailId', ParseUUIDPipe) emailId: string,
  ) {
    await this.emailsService.delete(
      req.user.tenant_id,
      leadId,
      emailId,
      req.user.id,
    );
  }

  // ========== PHONE MANAGEMENT ==========

  @Post(':id/phones')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Add a phone number to a lead' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 201, description: 'Phone added successfully' })
  @ApiResponse({ status: 400, description: 'Invalid phone format' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  @ApiResponse({
    status: 409,
    description: 'Phone number already exists in this account',
  })
  async createPhone(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() createPhoneDto: CreatePhoneDto,
  ) {
    return this.phonesService.create(
      req.user.tenant_id,
      leadId,
      req.user.id,
      createPhoneDto,
    );
  }

  @Patch(':id/phones/:phoneId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Update a lead phone number' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiParam({ name: 'phoneId', description: 'Phone UUID' })
  @ApiResponse({ status: 200, description: 'Phone updated successfully' })
  @ApiResponse({ status: 404, description: 'Phone not found' })
  @ApiResponse({
    status: 409,
    description: 'Phone number already exists in this account',
  })
  async updatePhone(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Param('phoneId', ParseUUIDPipe) phoneId: string,
    @Body() updatePhoneDto: UpdatePhoneDto,
  ) {
    return this.phonesService.update(
      req.user.tenant_id,
      leadId,
      phoneId,
      req.user.id,
      updatePhoneDto,
    );
  }

  @Delete(':id/phones/:phoneId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead phone number' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiParam({ name: 'phoneId', description: 'Phone UUID' })
  @ApiResponse({ status: 204, description: 'Phone deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete last contact method',
  })
  @ApiResponse({ status: 404, description: 'Phone not found' })
  async deletePhone(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Param('phoneId', ParseUUIDPipe) phoneId: string,
  ) {
    await this.phonesService.delete(
      req.user.tenant_id,
      leadId,
      phoneId,
      req.user.id,
    );
  }

  // ========== ADDRESS MANAGEMENT ==========

  @Post(':id/addresses')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({ summary: 'Add an address to a lead (Google Maps validated)' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 201, description: 'Address added successfully' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  @ApiResponse({
    status: 422,
    description: 'Address validation failed (Google Maps)',
  })
  async createAddress(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() createAddressDto: CreateAddressDto,
  ) {
    return this.addressesService.create(
      req.user.tenant_id,
      leadId,
      req.user.id,
      createAddressDto,
    );
  }

  @Patch(':id/addresses/:addressId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @ApiOperation({
    summary: 'Update a lead address (Google Maps re-validated if changed)',
  })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiParam({ name: 'addressId', description: 'Address UUID' })
  @ApiResponse({ status: 200, description: 'Address updated successfully' })
  @ApiResponse({ status: 404, description: 'Address not found' })
  @ApiResponse({
    status: 422,
    description: 'Address validation failed (Google Maps)',
  })
  async updateAddress(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
    @Body() updateAddressDto: UpdateAddressDto,
  ) {
    return this.addressesService.update(
      req.user.tenant_id,
      leadId,
      addressId,
      req.user.id,
      updateAddressDto,
    );
  }

  @Delete(':id/addresses/:addressId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead address' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiParam({ name: 'addressId', description: 'Address UUID' })
  @ApiResponse({ status: 204, description: 'Address deleted successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot delete address linked to service requests',
  })
  @ApiResponse({ status: 404, description: 'Address not found' })
  async deleteAddress(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Param('addressId', ParseUUIDPipe) addressId: string,
  ) {
    await this.addressesService.delete(
      req.user.tenant_id,
      leadId,
      addressId,
      req.user.id,
    );
  }

  // ========== NOTES MANAGEMENT ==========

  @Post(':id/notes')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Add a note to a lead' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 201, description: 'Note added successfully' })
  @ApiResponse({ status: 400, description: 'Note text is empty or too long' })
  @ApiResponse({ status: 404, description: 'Lead not found' })
  async createNote(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Body() createNoteDto: CreateNoteDto,
  ) {
    return this.notesService.create(
      req.user.tenant_id,
      leadId,
      req.user.id,
      createNoteDto,
    );
  }

  @Patch(':id/notes/:noteId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Update a lead note' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiParam({ name: 'noteId', description: 'Note UUID' })
  @ApiResponse({ status: 200, description: 'Note updated successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async updateNote(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() updateNoteDto: UpdateNoteDto,
  ) {
    return this.notesService.update(
      req.user.tenant_id,
      leadId,
      noteId,
      req.user.id,
      updateNoteDto,
    );
  }

  @Delete(':id/notes/:noteId')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a lead note' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiParam({ name: 'noteId', description: 'Note UUID' })
  @ApiResponse({ status: 204, description: 'Note deleted successfully' })
  @ApiResponse({ status: 404, description: 'Note not found' })
  async deleteNote(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    await this.notesService.delete(
      req.user.tenant_id,
      leadId,
      noteId,
      req.user.id,
    );
  }

  @Get(':id/notes')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get all notes for a lead (pinned first)' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({ status: 200, description: 'Notes retrieved successfully' })
  async getNotes(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.notesService.findAllByLead(
      req.user.tenant_id,
      leadId,
      page,
      limit,
    );
  }

  // ========== ACTIVITIES ==========

  @Get(':id/activities')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get activity timeline for a lead' })
  @ApiParam({ name: 'id', description: 'Lead UUID' })
  @ApiResponse({
    status: 200,
    description: 'Activities retrieved successfully',
  })
  async getActivities(
    @Request() req,
    @Param('id', ParseUUIDPipe) leadId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.activitiesService.findAllByLead(
      req.user.tenant_id,
      leadId,
      page,
      limit,
    );
  }
}
