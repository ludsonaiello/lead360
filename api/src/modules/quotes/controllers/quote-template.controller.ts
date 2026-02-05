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
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Throttle } from '@nestjs/throttler';
import { QuoteTemplateService } from '../services/quote-template.service';
import { AdminTemplateTestingService } from '../services/admin-template-testing.service';
import { VisualTemplateBuilderService } from '../services/template-builder/visual-template-builder.service';
import { CodeTemplateBuilderService } from '../services/template-builder/code-template-builder.service';
import { TemplateComponentService } from '../services/template-builder/template-component.service';
import { TemplateMigrationService } from '../services/template-builder/template-migration.service';
import {
  CreateTemplateDto,
  UpdateTemplateDto,
  ListTemplatesDto,
  PreviewTemplateDto,
  TestPdfDto,
  TestEmailDto,
  RestoreTemplateVersionDto,
  CreateVisualTemplateDto,
  AddComponentDto,
  UpdateComponentDto,
  ReorderComponentsDto,
  ApplyThemeDto,
  CreateCodeTemplateDto,
  UpdateCodeDto,
  ValidateHandlebarsDto,
  CreateComponentDto,
  UpdateComponentLibraryDto,
  ListComponentsDto,
  PreviewComponentDto,
  // Response DTOs
  TemplateResponseDto,
  TemplateDetailResponseDto,
  TemplateVersionResponseDto,
  ComponentResponseDto,
  ComponentDetailResponseDto,
  ComponentUsageResponseDto,
  ExportCodeResponseDto,
  ValidateHandlebarsResponseDto,
  PaginatedResponseDto,
} from '../dto/template';

// ========== ADMIN CONTROLLER (Template Management) ==========

@ApiTags('Quotes - Templates (Admin)')
@ApiBearerAuth()
@Controller('admin/quotes/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteTemplateAdminController {
  private readonly logger = new Logger(QuoteTemplateAdminController.name);

  constructor(
    private readonly templateService: QuoteTemplateService,
    private readonly templateTestingService: AdminTemplateTestingService,
    private readonly visualBuilder: VisualTemplateBuilderService,
    private readonly codeBuilder: CodeTemplateBuilderService,
    private readonly componentService: TemplateComponentService,
    private readonly migrationService: TemplateMigrationService,
  ) {}

  @Post()
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Create template (admin only)',
    description: 'Create global or tenant-specific template',
  })
  @ApiResponse({ status: 201, description: 'Template created successfully', type: TemplateDetailResponseDto })
  async createTemplate(@Request() req, @Body() createTemplateDto: CreateTemplateDto): Promise<TemplateDetailResponseDto> {
    return this.templateService.createTemplate(req.user.id, createTemplateDto) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Get()
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Get all templates (admin only)',
    description: 'View all templates with usage statistics',
  })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully', type: PaginatedResponseDto })
  async findAllAdmin(@Query() listTemplatesDto: ListTemplatesDto): Promise<PaginatedResponseDto<TemplateResponseDto>> {
    return this.templateService.findAllAdmin(listTemplatesDto) as unknown as Promise<PaginatedResponseDto<TemplateResponseDto>>;
  }

  
  @Get('variables/schema')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Get template variables schema',
    description: 'Returns complete Handlebars variable schema for template development',
  })
  @ApiResponse({ status: 200, description: 'Variable schema retrieved successfully' })
  async getTemplateVariables() {
    return this.templateService.getTemplateVariables();
  }

  @Get('prebuilt')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'List pre-built templates',
    description: 'Get platform-provided starter templates',
  })
  @ApiResponse({ status: 200, description: 'Pre-built templates retrieved successfully', type: PaginatedResponseDto })
  async listPrebuiltTemplates(@Query() dto: ListTemplatesDto): Promise<PaginatedResponseDto<TemplateResponseDto>> {
    return this.templateService.findAllAdmin({ ...dto, is_prebuilt: true }) as unknown as Promise<PaginatedResponseDto<TemplateResponseDto>>;
  }

  @Get('migration/stats')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Get migration statistics',
    description: 'Check how many templates have been migrated',
  })
  @ApiResponse({ status: 200, description: 'Migration stats retrieved' })
  async getMigrationStats(): Promise<any> {
    return this.migrationService.getMigrationStats();
  }

  // ========== COMPONENT LIBRARY ENDPOINTS ==========

  @Get('components')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'List template components',
    description: 'Get all available components from the library',
  })
  @ApiResponse({ status: 200, description: 'Components retrieved successfully', type: PaginatedResponseDto })
  async listComponents(@Request() req, @Query() dto: ListComponentsDto): Promise<PaginatedResponseDto<ComponentResponseDto>> {
    return this.componentService.listComponents(dto) as unknown as Promise<PaginatedResponseDto<ComponentResponseDto>>;
  }

  @Get('components/:componentId')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Get component details',
    description: 'Retrieve component definition, props, and usage information',
  })
  @ApiParam({ name: 'componentId', description: 'Component UUID' })
  @ApiResponse({ status: 200, description: 'Component retrieved successfully', type: ComponentDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async getComponent(@Param('componentId', ParseUUIDPipe) componentId: string): Promise<ComponentDetailResponseDto> {
    return this.componentService.getComponent(componentId) as unknown as Promise<ComponentDetailResponseDto>;
  }

  @Post('components')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Create custom component',
    description: 'Add new reusable component to the library',
  })
  @ApiResponse({ status: 201, description: 'Component created successfully', type: ComponentDetailResponseDto })
  async createComponent(
    @Request() req,
    @Body() dto: CreateComponentDto,
  ): Promise<ComponentDetailResponseDto> {
    return this.componentService.createComponent(req.user.id, dto) as unknown as Promise<ComponentDetailResponseDto>;
  }

  @Patch('components/:componentId')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Update component',
    description: 'Modify component definition, props, or templates',
  })
  @ApiParam({ name: 'componentId', description: 'Component UUID' })
  @ApiResponse({ status: 200, description: 'Component updated successfully', type: ComponentDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async updateComponentLibrary(
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @Body() dto: UpdateComponentLibraryDto,
  ): Promise<ComponentDetailResponseDto> {
    return this.componentService.updateComponent(componentId, dto) as unknown as Promise<ComponentDetailResponseDto>;
  }

  @Delete('components/:componentId')
  @Roles('Platform Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete component',
    description: 'Remove component from library (only if not in use)',
  })
  @ApiParam({ name: 'componentId', description: 'Component UUID' })
  @ApiResponse({ status: 204, description: 'Component deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete component (in use)' })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async deleteComponent(@Param('componentId', ParseUUIDPipe) componentId: string) {
    return this.componentService.deleteComponent(componentId);
  }

  @Post('components/:componentId/preview')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Preview component',
    description: 'Render component with sample data for preview',
  })
  @ApiParam({ name: 'componentId', description: 'Component UUID' })
  @ApiResponse({ status: 200, description: 'Component preview generated successfully' })
  @ApiResponse({ status: 404, description: 'Component not found' })
  async previewComponent(
    @Param('componentId', ParseUUIDPipe) componentId: string,
    @Body() dto: PreviewComponentDto,
  ) {
    const html = await this.componentService.renderComponent(componentId, dto.props);
    return { rendered_html: html, props: dto.props };
  }

  @Get(':id')
  @Roles('Platform Admin')
  @ApiOperation({ summary: 'Get template details (admin only)' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOneAdmin(@Param('id', ParseUUIDPipe) id: string): Promise<TemplateDetailResponseDto> {
    return this.templateService.findOneAdmin(id) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Patch(':id')
  @Roles('Platform Admin')
  @ApiOperation({ summary: 'Update template (admin only)' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template updated successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateTemplate(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ): Promise<TemplateDetailResponseDto> {
    return this.templateService.updateTemplate(id, req.user.id, updateTemplateDto) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Delete(':id')
  @Roles('Platform Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete template (admin only)',
    description: 'Cannot delete if template is in use or is default',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 204, description: 'Template deleted successfully' })
  @ApiResponse({ status: 400, description: 'Cannot delete template (in use or is default)' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async deleteTemplate(@Request() req, @Param('id', ParseUUIDPipe) id: string) {
    return this.templateService.deleteTemplate(id, req.user.id);
  }

  @Post(':id/clone')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Clone template (admin only)',
    description: 'Create a copy of existing template',
  })
  @ApiParam({ name: 'id', description: 'Template UUID to clone' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        new_name: { type: 'string', example: 'Modern Professional Quote V2' },
      },
    },
    required: false,
  })
  @ApiResponse({ status: 201, description: 'Template cloned successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async cloneTemplate(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('new_name') newName?: string,
  ): Promise<TemplateDetailResponseDto> {
    return this.templateService.cloneTemplate(id, req.user.id, newName) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Patch(':id/set-default')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Set template as platform default (admin only)',
    description: 'Only global templates can be set as platform default',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template set as default successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 403, description: 'Only global templates can be set as default' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async setDefaultTemplate(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TemplateDetailResponseDto> {
    return this.templateService.setDefaultTemplate(id, req.user.id) as unknown as Promise<TemplateDetailResponseDto>;
  }

  // ========== TEMPLATE TESTING ENDPOINTS ==========

  @Post(':id/preview')
  @Roles('Platform Admin')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({
    summary: 'Preview template with sample or real data',
    description: 'Render template with sample data or real quote data for preview',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Preview generated successfully' })
  @ApiResponse({ status: 404, description: 'Template or quote not found' })
  async previewTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PreviewTemplateDto,
  ) {
    return this.templateTestingService.previewTemplate(
      id,
      dto.preview_type,
      dto.quote_id,
    );
  }

  @Post(':id/test-pdf')
  @Roles('Platform Admin')
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute
  @ApiOperation({
    summary: 'Test PDF generation from template',
    description: 'Generate test PDF with sample data and measure performance',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Test PDF generated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async testPdfGeneration(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestPdfDto,
  ) {
    return this.templateTestingService.testPdfGeneration(
      id,
      dto.preview_type,
      dto.quote_id,
    );
  }

  @Post(':id/validate')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Validate template syntax',
    description: 'Check template for Handlebars syntax errors and missing variables',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Validation completed', type: ValidateHandlebarsResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async validateTemplate(@Param('id', ParseUUIDPipe) id: string): Promise<ValidateHandlebarsResponseDto> {
    return this.templateTestingService.validateTemplateSyntax(id) as unknown as Promise<ValidateHandlebarsResponseDto>;
  }

  @Post(':id/test-email')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Test email rendering',
    description: 'Preview email rendering and optionally send test email',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Email preview generated' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async testEmailRendering(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestEmailDto,
  ) {
    return this.templateTestingService.testEmailRendering(
      id,
      dto.preview_type,
      dto.send_to_email,
    );
  }

  @Get(':id/versions')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Get template version history',
    description: 'Retrieve all versions of a template',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Version history retrieved', type: [TemplateVersionResponseDto] })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async getTemplateVersionHistory(@Param('id', ParseUUIDPipe) id: string): Promise<TemplateVersionResponseDto[]> {
    return this.templateTestingService.getTemplateVersionHistory(id) as unknown as Promise<TemplateVersionResponseDto[]>;
  }

  @Post(':id/restore-version')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Restore template to previous version',
    description: 'Restore template HTML content from a specific version',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template restored successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template or version not found' })
  async restoreTemplateVersion(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RestoreTemplateVersionDto,
  ): Promise<TemplateDetailResponseDto> {
    return this.templateTestingService.restoreTemplateVersion(
      id,
      req.user.id,
      dto.version,
      dto.create_backup,
    ) as unknown as Promise<TemplateDetailResponseDto>;
  }

  // ========== VISUAL TEMPLATE BUILDER ENDPOINTS ==========

  @Post('visual')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Create visual template',
    description: 'Create new component-based visual template',
  })
  @ApiResponse({ status: 201, description: 'Visual template created successfully', type: TemplateDetailResponseDto })
  async createVisualTemplate(
    @Request() req,
    @Body() dto: CreateVisualTemplateDto,
  ): Promise<TemplateDetailResponseDto> {
    return this.visualBuilder.createVisualTemplate(req.user.id, dto) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Post(':id/visual/components')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Add component to visual template',
    description: 'Add a component instance to the template layout',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Component added successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async addComponent(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddComponentDto,
  ): Promise<TemplateDetailResponseDto> {
    return this.visualBuilder.addComponent(id, req.user.id, dto) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Patch(':id/visual/components/:componentId')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Update component in visual template',
    description: 'Update component position, props, styles, or bindings',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiParam({ name: 'componentId', description: 'Component instance UUID' })
  @ApiResponse({ status: 200, description: 'Component updated successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template or component not found' })
  async updateComponent(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('componentId') componentId: string,
    @Body() dto: UpdateComponentDto,
  ): Promise<TemplateDetailResponseDto> {
    return this.visualBuilder.updateComponent(id, componentId, req.user.id, dto) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Delete(':id/visual/components/:componentId')
  @Roles('Platform Admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove component from visual template',
    description: 'Delete a component instance from the template',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiParam({ name: 'componentId', description: 'Component instance UUID' })
  @ApiResponse({ status: 204, description: 'Component removed successfully' })
  @ApiResponse({ status: 404, description: 'Template or component not found' })
  async removeComponent(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('componentId') componentId: string,
  ) {
    return this.visualBuilder.removeComponent(id, componentId, req.user.id);
  }

  @Post(':id/visual/reorder')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Reorder components',
    description: 'Change the order of components in a section (drag-and-drop)',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Components reordered successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async reorderComponents(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReorderComponentsDto,
  ): Promise<TemplateDetailResponseDto> {
    return this.visualBuilder.reorderComponents(id, req.user.id, dto) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Post(':id/visual/theme')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Apply theme to visual template',
    description: 'Update colors, fonts, and styling for the template',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Theme applied successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async applyTheme(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyThemeDto,
  ): Promise<TemplateDetailResponseDto> {
    return this.visualBuilder.applyTheme(id, req.user.id, dto) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Get(':id/visual/export-code')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Export visual template to code',
    description: 'Convert visual template to Handlebars HTML/CSS for advanced editing',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template exported to code successfully', type: ExportCodeResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async exportToCode(@Param('id', ParseUUIDPipe) id: string): Promise<ExportCodeResponseDto> {
    return this.visualBuilder.exportToCode(id) as unknown as Promise<ExportCodeResponseDto>;
  }

  // ========== CODE TEMPLATE BUILDER ENDPOINTS ==========

  @Post('code')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Create code template',
    description: 'Create new Handlebars-based code template',
  })
  @ApiResponse({ status: 201, description: 'Code template created successfully', type: TemplateDetailResponseDto })
  async createCodeTemplate(
    @Request() req,
    @Body() dto: CreateCodeTemplateDto,
  ): Promise<TemplateDetailResponseDto> {
    return this.codeBuilder.createCodeTemplate(req.user.id, dto) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Patch(':id/code')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Update code template',
    description: 'Update Handlebars HTML/CSS in code template',
  })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Code template updated successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async updateCodeTemplate(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCodeDto,
  ): Promise<TemplateDetailResponseDto> {
    return this.codeBuilder.updateTemplateCode(id, req.user.id, dto) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Post('code/validate')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Validate Handlebars syntax',
    description: 'Check Handlebars template for syntax errors and security issues',
  })
  @ApiResponse({ status: 200, description: 'Validation completed', type: ValidateHandlebarsResponseDto })
  async validateHandlebars(@Body() dto: ValidateHandlebarsDto): Promise<ValidateHandlebarsResponseDto> {
    return this.codeBuilder.validateHandlebars(dto) as unknown as Promise<ValidateHandlebarsResponseDto>;
  }

  @Get('code/variables')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Get available template variables',
    description: 'Returns complete schema of available Handlebars variables and helpers',
  })
  @ApiResponse({ status: 200, description: 'Variable schema retrieved successfully' })
  async getVariableSchema() {
    return this.codeBuilder.getVariableSuggestions();
  }

    // ========== PRE-BUILT TEMPLATES & MIGRATION ==========

  @Post('prebuilt/:id/clone')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Clone pre-built template',
    description: 'Create a customizable copy of a pre-built template',
  })
  @ApiParam({ name: 'id', description: 'Pre-built template UUID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        new_name: { type: 'string', example: 'My Custom Template' },
        tenant_id: { type: 'string', format: 'uuid', example: 'uuid-here' },
      },
      required: ['new_name'],
    },
  })
  @ApiResponse({ status: 201, description: 'Template cloned successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Pre-built template not found' })
  async clonePrebuiltTemplate(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('new_name') newName: string,
    @Body('tenant_id') tenantId?: string,
  ): Promise<TemplateDetailResponseDto> {
    return this.templateService.cloneTemplate(id, req.user.id, newName) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Post('migration/run')
  @Roles('Platform Admin')
  @ApiOperation({
    summary: 'Migrate existing templates',
    description: 'Run migration to update legacy templates to new system',
  })
  @ApiResponse({ status: 200, description: 'Migration completed' })
  async runMigration(): Promise<any> {
    return this.migrationService.migrateAllTemplates();
  }

}

// ========== TENANT CONTROLLER (Template Selection) ==========

@ApiTags('Quotes - Templates')
@ApiBearerAuth()
@Controller('quotes/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class QuoteTemplateController {
  private readonly logger = new Logger(QuoteTemplateController.name);

  constructor(private readonly templateService: QuoteTemplateService) {}

  @Get()
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({
    summary: 'Get available templates',
    description: 'Returns global templates plus tenant-specific templates',
  })
  @ApiResponse({ status: 200, description: 'Templates retrieved successfully', type: PaginatedResponseDto })
  async findAll(@Request() req, @Query() listTemplatesDto: ListTemplatesDto): Promise<PaginatedResponseDto<TemplateResponseDto>> {
    return this.templateService.findAllForTenant(req.user.tenant_id, listTemplatesDto) as unknown as Promise<PaginatedResponseDto<TemplateResponseDto>>;
  }

  @Get(':id')
  @Roles('Owner', 'Admin', 'Manager', 'Sales', 'Employee')
  @ApiOperation({ summary: 'Get template details' })
  @ApiParam({ name: 'id', description: 'Template UUID' })
  @ApiResponse({ status: 200, description: 'Template retrieved successfully', type: TemplateDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async findOne(
    @Request() req,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<TemplateDetailResponseDto> {
    return this.templateService.findOne(req.user.tenant_id, id) as unknown as Promise<TemplateDetailResponseDto>;
  }

  @Patch('active')
  @Roles('Owner', 'Admin')
  @ApiOperation({
    summary: 'Set active template for tenant',
    description: 'Select which template to use for new quotes',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716' },
      },
      required: ['template_id'],
    },
  })
  @ApiResponse({ status: 200, description: 'Active template updated successfully' })
  @ApiResponse({ status: 404, description: 'Template not found' })
  async setActiveTemplate(
    @Request() req,
    @Body('template_id') templateId: string,
  ) {
    return this.templateService.setTenantActiveTemplate(
      req.user.tenant_id,
      req.user.id,
      templateId,
    );
  }
}
