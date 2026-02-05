/**
 * Template Builder System API Client
 * Comprehensive API for creating, managing, and rendering quote templates
 * Supports both Visual (component-based) and Code (Handlebars) templates
 * Source: /var/www/lead360.app/api/documentation/quote_template_builder_REST_API.md
 */

import apiClient from './axios';
import type {
  BuilderTemplate,
  BuilderTemplateListParams,
  CreateVisualTemplateDto,
  CreateCodeTemplateDto,
  UpdateBuilderTemplateDto,
  CloneBuilderTemplateDto,
  AddComponentDto,
  UpdateComponentDto,
  ReorderComponentsDto,
  ApplyThemeDto,
  UpdateCodeTemplateDto,
  PreviewBuilderTemplateDto,
  PreviewBuilderTemplateResponse,
  TestBuilderPdfDto,
  TestBuilderPdfResponse,
  TestBuilderEmailDto,
  TestBuilderEmailResponse,
  ValidateBuilderTemplateResponse,
  ValidateHandlebarsDto,
  TemplateVariableSchema,
  BuilderTemplateVersion,
  RestoreTemplateVersionDto,
  TemplateComponent,
  ComponentListParams,
  CreateComponentDto,
  UpdateComponentDto,
  PreviewComponentDto,
  PreviewComponentResponse,
  ExportCodeResponse,
  PrebuiltTemplateListParams,
  ClonePrebuiltTemplateDto,
  RunMigrationDto,
  MigrationResponse,
  MigrationStatsResponse,
  SetActiveTemplateDto,
  SetActiveTemplateResponse,
  PaginatedResponse,
} from '../types/quote-admin';

// ==========================================
// TEMPLATE MANAGEMENT ENDPOINTS
// ==========================================

/**
 * List all quote templates with filtering and pagination
 * @endpoint GET /admin/quotes/templates
 * @permission platform_admin:manage_templates
 */
export async function listBuilderTemplates(
  params?: BuilderTemplateListParams
): Promise<PaginatedResponse<BuilderTemplate>> {
  const queryParams = new URLSearchParams();
  if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
  if (params?.is_global !== undefined) queryParams.append('is_global', params.is_global.toString());
  if (params?.tenant_id) queryParams.append('tenant_id', params.tenant_id);
  if (params?.template_type) queryParams.append('template_type', params.template_type);
  if (params?.category_id) queryParams.append('category_id', params.category_id);
  if (params?.tags) queryParams.append('tags', params.tags.join(','));
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/admin/quotes/templates${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<PaginatedResponse<BuilderTemplate>>(url);
  return response.data;
}

/**
 * Get template details by ID
 * @endpoint GET /admin/quotes/templates/:id
 * @permission platform_admin:manage_templates
 */
export async function getBuilderTemplate(templateId: string): Promise<BuilderTemplate> {
  const response = await apiClient.get<BuilderTemplate>(`/admin/quotes/templates/${templateId}`);
  return response.data;
}

/**
 * Update template metadata
 * @endpoint PATCH /admin/quotes/templates/:id
 * @permission platform_admin:manage_templates
 */
export async function updateBuilderTemplate(
  templateId: string,
  dto: UpdateBuilderTemplateDto
): Promise<BuilderTemplate> {
  const response = await apiClient.patch<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}`,
    dto
  );
  return response.data;
}

/**
 * Delete a template
 * @endpoint DELETE /admin/quotes/templates/:id
 * @permission platform_admin:manage_templates
 */
export async function deleteBuilderTemplate(templateId: string): Promise<void> {
  await apiClient.delete(`/admin/quotes/templates/${templateId}`);
}

/**
 * Clone an existing template
 * @endpoint POST /admin/quotes/templates/:id/clone
 * @permission platform_admin:manage_templates
 */
export async function cloneBuilderTemplate(
  templateId: string,
  dto: CloneBuilderTemplateDto
): Promise<BuilderTemplate> {
  const response = await apiClient.post<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}/clone`,
    dto
  );
  return response.data;
}

/**
 * Set template as platform default
 * @endpoint PATCH /admin/quotes/templates/:id/set-default
 * @permission platform_admin:manage_templates
 */
export async function setTemplateAsDefault(templateId: string): Promise<BuilderTemplate> {
  const response = await apiClient.patch<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}/set-default`
  );
  return response.data;
}

/**
 * Get template variables schema
 * @endpoint GET /admin/quotes/templates/variables/schema
 * @permission platform_admin:manage_templates
 */
export async function getTemplateVariablesSchema(): Promise<TemplateVariableSchema> {
  const response = await apiClient.get<TemplateVariableSchema>(
    '/admin/quotes/templates/variables/schema'
  );
  return response.data;
}

// ==========================================
// TEMPLATE TESTING & PREVIEW ENDPOINTS
// ==========================================

/**
 * Preview template with sample or real quote data
 * @endpoint POST /admin/quotes/templates/:id/preview
 * @permission platform_admin:manage_templates
 * @rateLimit 10 requests per minute
 */
export async function previewBuilderTemplate(
  templateId: string,
  dto: PreviewBuilderTemplateDto
): Promise<PreviewBuilderTemplateResponse> {
  const response = await apiClient.post<PreviewBuilderTemplateResponse>(
    `/admin/quotes/templates/${templateId}/preview`,
    dto
  );
  return response.data;
}

/**
 * Test PDF generation from template
 * @endpoint POST /admin/quotes/templates/:id/test-pdf
 * @permission platform_admin:manage_templates
 * @rateLimit 10 requests per minute
 */
export async function testBuilderTemplatePdf(
  templateId: string,
  dto: TestBuilderPdfDto
): Promise<TestBuilderPdfResponse> {
  const response = await apiClient.post<TestBuilderPdfResponse>(
    `/admin/quotes/templates/${templateId}/test-pdf`,
    dto
  );
  return response.data;
}

/**
 * Validate template syntax and security
 * @endpoint POST /admin/quotes/templates/:id/validate
 * @permission platform_admin:manage_templates
 */
export async function validateBuilderTemplate(
  templateId: string
): Promise<ValidateBuilderTemplateResponse> {
  const response = await apiClient.post<ValidateBuilderTemplateResponse>(
    `/admin/quotes/templates/${templateId}/validate`
  );
  return response.data;
}

/**
 * Test email rendering
 * @endpoint POST /admin/quotes/templates/:id/test-email
 * @permission platform_admin:manage_templates
 */
export async function testBuilderTemplateEmail(
  templateId: string,
  dto: TestBuilderEmailDto
): Promise<TestBuilderEmailResponse> {
  const response = await apiClient.post<TestBuilderEmailResponse>(
    `/admin/quotes/templates/${templateId}/test-email`,
    dto
  );
  return response.data;
}

/**
 * Get template version history
 * @endpoint GET /admin/quotes/templates/:id/versions
 * @permission platform_admin:manage_templates
 */
export async function getTemplateVersions(
  templateId: string
): Promise<BuilderTemplateVersion[]> {
  const response = await apiClient.get<BuilderTemplateVersion[]>(
    `/admin/quotes/templates/${templateId}/versions`
  );
  return response.data;
}

/**
 * Restore template to a previous version
 * @endpoint POST /admin/quotes/templates/:id/restore-version
 * @permission platform_admin:manage_templates
 */
export async function restoreTemplateVersion(
  templateId: string,
  dto: RestoreTemplateVersionDto
): Promise<BuilderTemplate> {
  const response = await apiClient.post<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}/restore-version`,
    dto
  );
  return response.data;
}

// ==========================================
// VISUAL TEMPLATE BUILDER ENDPOINTS
// ==========================================

/**
 * Create a new visual template
 * @endpoint POST /admin/quotes/templates/visual
 * @permission platform_admin:manage_templates
 */
export async function createVisualTemplate(
  dto: CreateVisualTemplateDto
): Promise<BuilderTemplate> {
  const response = await apiClient.post<BuilderTemplate>(
    '/admin/quotes/templates/visual',
    dto
  );
  return response.data;
}

/**
 * Add component to visual template
 * @endpoint POST /admin/quotes/templates/:id/visual/components
 * @permission platform_admin:manage_templates
 */
export async function addComponentToTemplate(
  templateId: string,
  dto: AddComponentDto
): Promise<BuilderTemplate> {
  const response = await apiClient.post<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}/visual/components`,
    dto
  );
  return response.data;
}

/**
 * Update component in visual template
 * @endpoint PATCH /admin/quotes/templates/:id/visual/components/:componentId
 * @permission platform_admin:manage_templates
 */
export async function updateComponentInTemplate(
  templateId: string,
  componentId: string,
  dto: UpdateComponentDto
): Promise<BuilderTemplate> {
  const response = await apiClient.patch<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}/visual/components/${componentId}`,
    dto
  );
  return response.data;
}

/**
 * Remove component from visual template
 * @endpoint DELETE /admin/quotes/templates/:id/visual/components/:componentId
 * @permission platform_admin:manage_templates
 */
export async function removeComponentFromTemplate(
  templateId: string,
  componentId: string
): Promise<BuilderTemplate> {
  const response = await apiClient.delete<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}/visual/components/${componentId}`
  );
  return response.data;
}

/**
 * Reorder components in visual template
 * @endpoint POST /admin/quotes/templates/:id/visual/reorder
 * @permission platform_admin:manage_templates
 */
export async function reorderComponents(
  templateId: string,
  dto: ReorderComponentsDto
): Promise<BuilderTemplate> {
  const response = await apiClient.post<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}/visual/reorder`,
    dto
  );
  return response.data;
}

/**
 * Apply theme to visual template
 * @endpoint POST /admin/quotes/templates/:id/visual/theme
 * @permission platform_admin:manage_templates
 */
export async function applyThemeToTemplate(
  templateId: string,
  dto: ApplyThemeDto
): Promise<BuilderTemplate> {
  const response = await apiClient.post<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}/visual/theme`,
    dto
  );
  return response.data;
}

/**
 * Export visual template to code
 * @endpoint GET /admin/quotes/templates/:id/visual/export-code
 * @permission platform_admin:manage_templates
 */
export async function exportVisualTemplateToCode(
  templateId: string
): Promise<ExportCodeResponse> {
  const response = await apiClient.get<ExportCodeResponse>(
    `/admin/quotes/templates/${templateId}/visual/export-code`
  );
  return response.data;
}

// ==========================================
// CODE TEMPLATE BUILDER ENDPOINTS
// ==========================================

/**
 * Create a new code template
 * @endpoint POST /admin/quotes/templates/code
 * @permission platform_admin:manage_templates
 */
export async function createCodeTemplate(
  dto: CreateCodeTemplateDto
): Promise<BuilderTemplate> {
  const response = await apiClient.post<BuilderTemplate>(
    '/admin/quotes/templates/code',
    dto
  );
  return response.data;
}

/**
 * Update code template
 * @endpoint PATCH /admin/quotes/templates/:id/code
 * @permission platform_admin:manage_templates
 */
export async function updateCodeTemplate(
  templateId: string,
  dto: UpdateCodeTemplateDto
): Promise<BuilderTemplate> {
  const response = await apiClient.patch<BuilderTemplate>(
    `/admin/quotes/templates/${templateId}/code`,
    dto
  );
  return response.data;
}

/**
 * Validate Handlebars code
 * @endpoint POST /admin/quotes/templates/code/validate
 * @permission platform_admin:manage_templates
 */
export async function validateHandlebarsCode(
  dto: ValidateHandlebarsDto
): Promise<ValidateBuilderTemplateResponse> {
  const response = await apiClient.post<ValidateBuilderTemplateResponse>(
    '/admin/quotes/templates/code/validate',
    dto
  );
  return response.data;
}

/**
 * Get Handlebars variable schema
 * @endpoint GET /admin/quotes/templates/code/variables
 * @permission platform_admin:manage_templates
 */
export async function getHandlebarsVariables(): Promise<TemplateVariableSchema> {
  const response = await apiClient.get<TemplateVariableSchema>(
    '/admin/quotes/templates/code/variables'
  );
  return response.data;
}

// ==========================================
// COMPONENT LIBRARY ENDPOINTS
// ==========================================

/**
 * List all components from the library
 * @endpoint GET /admin/quotes/templates/components
 * @permission platform_admin:manage_templates
 */
export async function listComponents(
  params?: ComponentListParams
): Promise<PaginatedResponse<TemplateComponent>> {
  const queryParams = new URLSearchParams();
  if (params?.component_type) queryParams.append('component_type', params.component_type);
  if (params?.category) queryParams.append('category', params.category);
  if (params?.tags) queryParams.append('tags', params.tags.join(','));
  if (params?.is_global !== undefined) queryParams.append('is_global', params.is_global.toString());
  if (params?.tenant_id) queryParams.append('tenant_id', params.tenant_id);
  if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/admin/quotes/templates/components${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<PaginatedResponse<TemplateComponent>>(url);
  return response.data;
}

/**
 * Get component details
 * @endpoint GET /admin/quotes/templates/components/:id
 * @permission platform_admin:manage_templates
 */
export async function getComponent(componentId: string): Promise<TemplateComponent> {
  const response = await apiClient.get<TemplateComponent>(
    `/admin/quotes/templates/components/${componentId}`
  );
  return response.data;
}

/**
 * Create a custom component
 * @endpoint POST /admin/quotes/templates/components
 * @permission platform_admin:manage_templates
 */
export async function createComponent(dto: CreateComponentDto): Promise<TemplateComponent> {
  const response = await apiClient.post<TemplateComponent>(
    '/admin/quotes/templates/components',
    dto
  );
  return response.data;
}

/**
 * Update a component
 * @endpoint PATCH /admin/quotes/templates/components/:id
 * @permission platform_admin:manage_templates
 */
export async function updateComponent(
  componentId: string,
  dto: UpdateComponentDto
): Promise<TemplateComponent> {
  const response = await apiClient.patch<TemplateComponent>(
    `/admin/quotes/templates/components/${componentId}`,
    dto
  );
  return response.data;
}

/**
 * Delete a component
 * @endpoint DELETE /admin/quotes/templates/components/:id
 * @permission platform_admin:manage_templates
 */
export async function deleteComponent(componentId: string): Promise<void> {
  await apiClient.delete(`/admin/quotes/templates/components/${componentId}`);
}

/**
 * Preview component rendering
 * @endpoint POST /admin/quotes/templates/components/:id/preview
 * @permission platform_admin:manage_templates
 */
export async function previewComponent(
  componentId: string,
  dto: PreviewComponentDto
): Promise<PreviewComponentResponse> {
  const response = await apiClient.post<PreviewComponentResponse>(
    `/admin/quotes/templates/components/${componentId}/preview`,
    dto
  );
  return response.data;
}

// ==========================================
// PRE-BUILT TEMPLATES & MIGRATION ENDPOINTS
// ==========================================

/**
 * List pre-built templates
 * @endpoint GET /admin/quotes/templates/prebuilt
 * @permission platform_admin:manage_templates
 */
export async function listPrebuiltTemplates(
  params?: PrebuiltTemplateListParams
): Promise<PaginatedResponse<BuilderTemplate>> {
  const queryParams = new URLSearchParams();
  if (params?.category_id) queryParams.append('category_id', params.category_id);
  if (params?.tags) queryParams.append('tags', params.tags.join(','));
  if (params?.template_type) queryParams.append('template_type', params.template_type);
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/admin/quotes/templates/prebuilt${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<PaginatedResponse<BuilderTemplate>>(url);
  return response.data;
}

/**
 * Clone a pre-built template
 * @endpoint POST /admin/quotes/templates/prebuilt/:id/clone
 * @permission platform_admin:manage_templates
 */
export async function clonePrebuiltTemplate(
  templateId: string,
  dto: ClonePrebuiltTemplateDto
): Promise<BuilderTemplate> {
  const response = await apiClient.post<BuilderTemplate>(
    `/admin/quotes/templates/prebuilt/${templateId}/clone`,
    dto
  );
  return response.data;
}

/**
 * Run template migration
 * @endpoint POST /admin/quotes/templates/migration/run
 * @permission platform_admin:manage_templates
 */
export async function runTemplateMigration(dto: RunMigrationDto): Promise<MigrationResponse> {
  const response = await apiClient.post<MigrationResponse>(
    '/admin/quotes/templates/migration/run',
    dto
  );
  return response.data;
}

/**
 * Get migration statistics
 * @endpoint GET /admin/quotes/templates/migration/stats
 * @permission platform_admin:manage_templates
 */
export async function getMigrationStats(): Promise<MigrationStatsResponse> {
  const response = await apiClient.get<MigrationStatsResponse>(
    '/admin/quotes/templates/migration/stats'
  );
  return response.data;
}

// ==========================================
// TENANT TEMPLATES ENDPOINTS
// ==========================================

/**
 * Get available templates for current tenant
 * @endpoint GET /quotes/templates
 * @permission Any authenticated user
 */
export async function getTenantTemplates(params?: {
  is_active?: boolean;
  page?: number;
  limit?: number;
}): Promise<PaginatedResponse<BuilderTemplate>> {
  const queryParams = new URLSearchParams();
  if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/quotes/templates${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<PaginatedResponse<BuilderTemplate>>(url);
  return response.data;
}

/**
 * Get template details for tenant
 * @endpoint GET /quotes/templates/:id
 * @permission Any authenticated user
 */
export async function getTenantTemplate(templateId: string): Promise<BuilderTemplate> {
  const response = await apiClient.get<BuilderTemplate>(`/quotes/templates/${templateId}`);
  return response.data;
}

/**
 * Set active template for tenant
 * @endpoint PATCH /quotes/templates/active
 * @permission Owner, Admin
 */
export async function setTenantActiveTemplate(
  dto: SetActiveTemplateDto
): Promise<SetActiveTemplateResponse> {
  const response = await apiClient.patch<SetActiveTemplateResponse>(
    '/quotes/templates/active',
    dto
  );
  return response.data;
}
