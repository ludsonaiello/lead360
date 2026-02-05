/**
 * Quote Admin Template Management API Client
 * Template CRUD, versioning, testing, and tenant assignment endpoints
 * Source: /var/www/lead360.app/api/documentation/quote_admin_REST_API.md
 */

import apiClient from './axios';
import type {
  TemplateListParams,
  PaginatedResponse,
  QuoteTemplate,
  CreateTemplateDto,
  UpdateTemplateDto,
  CloneTemplateDto,
  AssignTenantsDto,
  AssignTenantsResponse,
  TemplateVersion,
  PreviewTemplateDto,
  PreviewTemplateResponse,
  TestPdfDto,
  TestPdfResponse,
  TestEmailDto,
  TestEmailResponse,
  ValidateTemplateDto,
  ValidateTemplateResponse,
} from '../types/quote-admin';

// ==========================================
// TEMPLATE MANAGEMENT ENDPOINTS
// ==========================================

/**
 * List all quote templates with filtering and pagination
 * @endpoint GET /admin/quotes/templates
 * @permission platform_admin:manage_templates
 * @param params Filters and pagination
 * @returns Paginated list of quote templates
 * @throws 403 - Platform Admin privileges required
 */
export async function listTemplates(
  params?: TemplateListParams
): Promise<PaginatedResponse<QuoteTemplate>> {
  const queryParams = new URLSearchParams();
  if (params?.is_active !== undefined) queryParams.append('is_active', params.is_active.toString());
  if (params?.search) queryParams.append('search', params.search);
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());

  const url = `/admin/quotes/templates${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
  const response = await apiClient.get<PaginatedResponse<QuoteTemplate>>(url);
  return response.data;
}

/**
 * Create a new quote template
 * @endpoint POST /admin/quotes/templates
 * @permission platform_admin:manage_templates
 * @param dto Template creation data
 * @returns Created template
 * @throws 400 - Validation errors (name required, invalid content structure)
 * @throws 403 - Platform Admin privileges required
 */
export async function createTemplate(
  dto: CreateTemplateDto
): Promise<QuoteTemplate> {
  const response = await apiClient.post<QuoteTemplate>(
    '/admin/quotes/templates',
    dto
  );
  return response.data;
}

/**
 * Get template details by ID
 * @endpoint GET /admin/quotes/templates/:id
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @returns Template details
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template not found
 */
export async function getTemplate(templateId: string): Promise<QuoteTemplate> {
  const response = await apiClient.get<QuoteTemplate>(
    `/admin/quotes/templates/${templateId}`
  );
  return response.data;
}

/**
 * Update template details
 * @endpoint PATCH /admin/quotes/templates/:id
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @param dto Template update data
 * @returns Updated template
 * @throws 400 - Validation errors
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template not found
 * @note Creates a new version if content is modified
 */
export async function updateTemplate(
  templateId: string,
  dto: UpdateTemplateDto
): Promise<QuoteTemplate> {
  const response = await apiClient.patch<QuoteTemplate>(
    `/admin/quotes/templates/${templateId}`,
    dto
  );
  return response.data;
}

/**
 * Delete a template (soft delete)
 * @endpoint DELETE /admin/quotes/templates/:id
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @returns Deletion confirmation
 * @throws 400 - Template is in use by active quotes
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template not found
 * @note Template is soft deleted and can be restored
 */
export async function deleteTemplate(
  templateId: string
): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(
    `/admin/quotes/templates/${templateId}`
  );
  return response.data;
}

/**
 * Clone an existing template
 * @endpoint POST /admin/quotes/templates/:id/clone
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID to clone
 * @param dto Clone configuration
 * @returns Cloned template
 * @throws 400 - Validation errors (new_name required)
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Source template not found
 */
export async function cloneTemplate(
  templateId: string,
  dto: CloneTemplateDto
): Promise<QuoteTemplate> {
  const response = await apiClient.post<QuoteTemplate>(
    `/admin/quotes/templates/${templateId}/clone`,
    dto
  );
  return response.data;
}

/**
 * Assign template to multiple tenants
 * @endpoint POST /admin/quotes/templates/:id/assign-tenants
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @param dto Tenant IDs to assign
 * @returns Assignment results
 * @throws 400 - Validation errors (tenant_ids required)
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template not found or invalid tenant IDs
 */
export async function assignTenantsToTemplate(
  templateId: string,
  dto: AssignTenantsDto
): Promise<AssignTenantsResponse> {
  const response = await apiClient.post<AssignTenantsResponse>(
    `/admin/quotes/templates/${templateId}/assign-tenants`,
    dto
  );
  return response.data;
}

/**
 * Remove template assignment from a specific tenant
 * @endpoint DELETE /admin/quotes/templates/:id/remove-tenant/:tenantId
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @param tenantId Tenant UUID
 * @returns Removal confirmation
 * @throws 400 - Template not assigned to tenant
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template or tenant not found
 */
export async function removeTenantFromTemplate(
  templateId: string,
  tenantId: string
): Promise<{ message: string }> {
  const response = await apiClient.delete<{ message: string }>(
    `/admin/quotes/templates/${templateId}/remove-tenant/${tenantId}`
  );
  return response.data;
}

/**
 * Get template version history
 * @endpoint GET /admin/quotes/templates/:id/versions
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @returns List of template versions (newest first)
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template not found
 */
export async function getTemplateVersions(
  templateId: string
): Promise<TemplateVersion[]> {
  const response = await apiClient.get<TemplateVersion[]>(
    `/admin/quotes/templates/${templateId}/versions`
  );
  return response.data;
}

/**
 * Restore a specific template version
 * @endpoint POST /admin/quotes/templates/:id/versions/:versionNumber/restore
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @param versionNumber Version number to restore
 * @returns Restored template
 * @throws 400 - Version not found
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template not found
 * @note Creates a new version with restored content
 */
export async function restoreTemplateVersion(
  templateId: string,
  versionNumber: number
): Promise<QuoteTemplate> {
  const response = await apiClient.post<QuoteTemplate>(
    `/admin/quotes/templates/${templateId}/versions/${versionNumber}/restore`
  );
  return response.data;
}

/**
 * Preview template with sample data
 * @endpoint POST /admin/quotes/templates/:id/preview
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @param dto Preview configuration with sample data
 * @returns HTML preview and optional preview URL
 * @throws 400 - Invalid sample data format
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template not found
 */
export async function previewTemplate(
  templateId: string,
  dto: PreviewTemplateDto
): Promise<PreviewTemplateResponse> {
  const response = await apiClient.post<PreviewTemplateResponse>(
    `/admin/quotes/templates/${templateId}/preview`,
    dto
  );
  return response.data;
}

/**
 * Generate test PDF from template
 * @endpoint POST /admin/quotes/templates/:id/test-pdf
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @param dto Test PDF configuration with sample data
 * @returns PDF URL and expiration info
 * @throws 400 - Invalid sample data or PDF generation failed
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template not found
 * @note PDF URL expires after 1 hour
 */
export async function testTemplatePdf(
  templateId: string,
  dto: TestPdfDto
): Promise<TestPdfResponse> {
  const response = await apiClient.post<TestPdfResponse>(
    `/admin/quotes/templates/${templateId}/test-pdf`,
    dto
  );
  return response.data;
}

/**
 * Send test email with template
 * @endpoint POST /admin/quotes/templates/:id/test-email
 * @permission platform_admin:manage_templates
 * @param templateId Template UUID
 * @param dto Test email configuration
 * @returns Email sending confirmation
 * @throws 400 - Invalid email address or sample data
 * @throws 403 - Platform Admin privileges required
 * @throws 404 - Template not found
 * @throws 500 - Email sending failed
 */
export async function testTemplateEmail(
  templateId: string,
  dto: TestEmailDto
): Promise<TestEmailResponse> {
  const response = await apiClient.post<TestEmailResponse>(
    `/admin/quotes/templates/${templateId}/test-email`,
    dto
  );
  return response.data;
}

/**
 * Validate template content structure
 * @endpoint POST /admin/quotes/templates/validate
 * @permission platform_admin:manage_templates
 * @param dto Template content to validate
 * @returns Validation results with errors and warnings
 * @throws 403 - Platform Admin privileges required
 * @note Does not save the template, only validates structure
 */
export async function validateTemplate(
  dto: ValidateTemplateDto
): Promise<ValidateTemplateResponse> {
  const response = await apiClient.post<ValidateTemplateResponse>(
    '/admin/quotes/templates/validate',
    dto
  );
  return response.data;
}
