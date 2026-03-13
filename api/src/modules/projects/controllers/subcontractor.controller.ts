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
import { SubcontractorService } from '../services/subcontractor.service';
import { CreateSubcontractorDto } from '../dto/create-subcontractor.dto';
import { UpdateSubcontractorDto } from '../dto/update-subcontractor.dto';
import { CreateSubcontractorContactDto } from '../dto/create-subcontractor-contact.dto';
import { UploadSubcontractorDocumentDto } from '../dto/upload-subcontractor-document.dto';

@ApiTags('Subcontractors')
@ApiBearerAuth()
@Controller('subcontractors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubcontractorController {
  constructor(
    private readonly subcontractorService: SubcontractorService,
  ) {}

  // ---------------------------------------------------------------------------
  // POST /subcontractors
  // ---------------------------------------------------------------------------

  @Post()
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a subcontractor' })
  @ApiResponse({ status: 201, description: 'Subcontractor created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async create(
    @TenantId() tenantId: string,
    @Request() req,
    @Body() dto: CreateSubcontractorDto,
  ) {
    return this.subcontractorService.create(tenantId, req.user.id, dto);
  }

  // ---------------------------------------------------------------------------
  // GET /subcontractors
  // ---------------------------------------------------------------------------

  @Get()
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List subcontractors (paginated, with filters)' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @ApiQuery({
    name: 'compliance_status',
    required: false,
    type: String,
    enum: ['valid', 'expiring_soon', 'expired', 'unknown'],
  })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated subcontractor list' })
  async findAll(
    @TenantId() tenantId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('is_active') isActive?: string,
    @Query('compliance_status') complianceStatus?: string,
    @Query('search') search?: string,
  ) {
    return this.subcontractorService.findAll(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      is_active:
        isActive !== undefined ? isActive === 'true' : undefined,
      compliance_status: complianceStatus || undefined,
      search: search || undefined,
    });
  }

  // ---------------------------------------------------------------------------
  // GET /subcontractors/:id
  // ---------------------------------------------------------------------------

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({
    summary: 'Get subcontractor detail (contacts, documents, compliance)',
  })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiResponse({
    status: 200,
    description: 'Subcontractor with contacts, documents, compliance status',
  })
  @ApiResponse({ status: 404, description: 'Subcontractor not found' })
  async findOne(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subcontractorService.findOne(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // PATCH /subcontractors/:id
  // ---------------------------------------------------------------------------

  @Patch(':id')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'Update subcontractor' })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiResponse({ status: 200, description: 'Updated subcontractor' })
  @ApiResponse({ status: 404, description: 'Subcontractor not found' })
  async update(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSubcontractorDto,
  ) {
    return this.subcontractorService.update(tenantId, id, req.user.id, dto);
  }

  // ---------------------------------------------------------------------------
  // DELETE /subcontractors/:id
  // ---------------------------------------------------------------------------

  @Delete(':id')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Soft delete subcontractor (set is_active=false)' })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiResponse({ status: 200, description: 'Subcontractor deactivated' })
  @ApiResponse({ status: 404, description: 'Subcontractor not found' })
  async softDelete(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.subcontractorService.softDelete(tenantId, id, req.user.id);
    return { message: 'Subcontractor deactivated' };
  }

  // ---------------------------------------------------------------------------
  // GET /subcontractors/:id/reveal/:field
  // ---------------------------------------------------------------------------

  @Get(':id/reveal/:field')
  @Roles('Owner', 'Admin')
  @ApiOperation({ summary: 'Reveal an encrypted bank field (audit logged)' })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiParam({
    name: 'field',
    description: 'Field to reveal',
    enum: ['bank_routing', 'bank_account'],
  })
  @ApiResponse({ status: 200, description: 'Decrypted field value' })
  @ApiResponse({ status: 400, description: 'Invalid field name' })
  @ApiResponse({
    status: 404,
    description: 'Subcontractor or field not found',
  })
  async revealField(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('field') field: string,
  ) {
    return this.subcontractorService.revealField(
      tenantId,
      id,
      req.user.id,
      field,
    );
  }

  // ---------------------------------------------------------------------------
  // POST /subcontractors/:id/contacts
  // ---------------------------------------------------------------------------

  @Post(':id/contacts')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a contact to subcontractor' })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiResponse({ status: 201, description: 'Contact created' })
  @ApiResponse({ status: 404, description: 'Subcontractor not found' })
  async addContact(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateSubcontractorContactDto,
  ) {
    return this.subcontractorService.addContact(tenantId, id, dto);
  }

  // ---------------------------------------------------------------------------
  // GET /subcontractors/:id/contacts
  // ---------------------------------------------------------------------------

  @Get(':id/contacts')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List contacts for subcontractor' })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiResponse({ status: 200, description: 'List of contacts' })
  @ApiResponse({ status: 404, description: 'Subcontractor not found' })
  async listContacts(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subcontractorService.listContacts(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // DELETE /subcontractors/:id/contacts/:contactId
  // ---------------------------------------------------------------------------

  @Delete(':id/contacts/:contactId')
  @Roles('Owner', 'Admin', 'Manager')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove a contact from subcontractor' })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiParam({ name: 'contactId', description: 'Contact UUID' })
  @ApiResponse({ status: 200, description: 'Contact removed' })
  @ApiResponse({ status: 404, description: 'Contact not found' })
  async removeContact(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('contactId', ParseUUIDPipe) contactId: string,
  ) {
    await this.subcontractorService.removeContact(tenantId, id, contactId);
    return { message: 'Contact removed' };
  }

  // ---------------------------------------------------------------------------
  // POST /subcontractors/:id/documents
  // ---------------------------------------------------------------------------

  @Post(':id/documents')
  @Roles('Owner', 'Admin', 'Manager')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Upload a document for subcontractor' })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiResponse({ status: 201, description: 'Document uploaded' })
  @ApiResponse({ status: 404, description: 'Subcontractor not found' })
  async uploadDocument(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadSubcontractorDocumentDto,
  ) {
    return this.subcontractorService.uploadDocument(
      tenantId,
      id,
      req.user.id,
      file,
      dto,
    );
  }

  // ---------------------------------------------------------------------------
  // GET /subcontractors/:id/documents
  // ---------------------------------------------------------------------------

  @Get(':id/documents')
  @Roles('Owner', 'Admin', 'Manager')
  @ApiOperation({ summary: 'List documents for subcontractor' })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiResponse({ status: 200, description: 'List of documents' })
  @ApiResponse({ status: 404, description: 'Subcontractor not found' })
  async listDocuments(
    @TenantId() tenantId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.subcontractorService.listDocuments(tenantId, id);
  }

  // ---------------------------------------------------------------------------
  // DELETE /subcontractors/:id/documents/:documentId
  // ---------------------------------------------------------------------------

  @Delete(':id/documents/:documentId')
  @Roles('Owner', 'Admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a document from subcontractor' })
  @ApiParam({ name: 'id', description: 'Subcontractor UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiResponse({ status: 200, description: 'Document deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async removeDocument(
    @TenantId() tenantId: string,
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    await this.subcontractorService.removeDocument(
      tenantId,
      id,
      documentId,
      req.user.id,
    );
    return { message: 'Document deleted' };
  }
}
