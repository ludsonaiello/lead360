// Lead360 - Communication Module API Client
// All 41 endpoints from backend API documentation
// Base URL: /api/v1 (configured in axios.ts)

import { apiClient } from './axios';
import type {
  CommunicationProvider,
  ProviderReference,
  ProviderStats,
  CreateProviderDto,
  UpdateProviderDto,
  PlatformEmailConfig,
  UpdatePlatformEmailConfigDto,
  TestEmailDto,
  TenantEmailConfig,
  UpdateTenantEmailConfigDto,
  EmailTemplate,
  CreateTemplateDto,
  UpdateTemplateDto,
  CloneTemplateDto,
  PreviewTemplateDto,
  ValidateTemplateDto,
  TemplatePreview,
  VariableRegistry,
  TemplateValidationResult,
  SendTemplatedEmailDto,
  SendRawEmailDto,
  SendEmailResponse,
  CommunicationEvent,
  CommunicationEventDetail,
  Notification,
  UnreadCountResponse,
  MarkAllReadResponse,
  NotificationRule,
  CreateNotificationRuleDto,
  UpdateNotificationRuleDto,
  PaginatedResponse,
  GetProvidersParams,
  GetTemplatesParams,
  GetCommunicationHistoryParams,
  GetNotificationsParams,
  GetNotificationRulesParams,
} from '@/lib/types/communication';

// ==========================================
// PROVIDER MANAGEMENT (Admin) - 7 endpoints
// ==========================================

/**
 * Get list of all communication providers
 * @endpoint GET /admin/communication/providers
 * @permission Platform Admin only
 */
export const getProviders = async (params?: GetProvidersParams): Promise<CommunicationProvider[]> => {
  const { data } = await apiClient.get<CommunicationProvider[]>(
    '/admin/communication/providers',
    { params }
  );
  return data;
};

/**
 * Get provider details by key
 * @endpoint GET /admin/communication/providers/:key
 * @permission Platform Admin only
 */
export const getProvider = async (key: string): Promise<CommunicationProvider> => {
  const { data } = await apiClient.get<CommunicationProvider>(
    `/admin/communication/providers/${key}`
  );
  return data;
};

/**
 * Create custom communication provider
 * @endpoint POST /admin/communication/providers
 * @permission Platform Admin only
 * @throws 400 - Validation errors
 * @throws 409 - Provider key already exists
 */
export const createProvider = async (dto: CreateProviderDto): Promise<CommunicationProvider> => {
  const { data } = await apiClient.post<CommunicationProvider>(
    '/admin/communication/providers',
    dto
  );
  return data;
};

/**
 * Update provider configuration
 * @endpoint PATCH /admin/communication/providers/:key
 * @permission Platform Admin only
 * @throws 400 - Validation errors
 * @throws 403 - Cannot modify system providers
 */
export const updateProvider = async (
  key: string,
  dto: UpdateProviderDto
): Promise<CommunicationProvider> => {
  const { data } = await apiClient.patch<CommunicationProvider>(
    `/admin/communication/providers/${key}`,
    dto
  );
  return data;
};

/**
 * Toggle provider active status
 * @endpoint PATCH /admin/communication/providers/:key/toggle
 * @permission Platform Admin only
 */
export const toggleProvider = async (key: string): Promise<CommunicationProvider> => {
  const { data } = await apiClient.patch<CommunicationProvider>(
    `/admin/communication/providers/${key}/toggle`
  );
  return data;
};

/**
 * Delete custom provider
 * @endpoint DELETE /admin/communication/providers/:key
 * @permission Platform Admin only
 * @throws 403 - Cannot delete system providers
 * @throws 409 - Provider is in use by configs
 */
export const deleteProvider = async (key: string): Promise<void> => {
  await apiClient.delete(`/admin/communication/providers/${key}`);
};

/**
 * Get provider usage statistics
 * @endpoint GET /admin/communication/providers/:key/stats
 * @permission Platform Admin only
 */
export const getProviderStats = async (key: string): Promise<ProviderStats> => {
  const { data } = await apiClient.get<ProviderStats>(
    `/admin/communication/providers/${key}/stats`
  );
  return data;
};

// ==========================================
// PLATFORM EMAIL CONFIG (Admin) - 3 endpoints
// ==========================================

/**
 * Get platform email configuration
 * @endpoint GET /admin/communication/platform-email-config
 * @permission Platform Admin only
 * @throws 404 - Platform email config not found
 */
export const getPlatformEmailConfig = async (): Promise<PlatformEmailConfig> => {
  const { data } = await apiClient.get<PlatformEmailConfig>(
    '/admin/communication/platform-email-config'
  );
  return data;
};

/**
 * Create or update platform email configuration
 * @endpoint POST /admin/communication/platform-email-config
 * @permission Platform Admin only
 * @throws 400 - Validation errors (credentials, config schema mismatch)
 * @throws 404 - Provider not found
 */
export const updatePlatformEmailConfig = async (
  dto: UpdatePlatformEmailConfigDto
): Promise<PlatformEmailConfig> => {
  const { data } = await apiClient.post<PlatformEmailConfig>(
    '/admin/communication/platform-email-config',
    dto
  );
  return data;
};

/**
 * Send test email using platform configuration
 * @endpoint POST /admin/communication/platform-email-config/test
 * @permission Platform Admin only
 * @throws 400 - Platform email not configured
 * @throws 500 - Email send failed
 */
export const testPlatformEmail = async (dto: TestEmailDto): Promise<SendEmailResponse> => {
  const { data } = await apiClient.post<SendEmailResponse>(
    '/admin/communication/platform-email-config/test',
    dto
  );
  return data;
};

// ==========================================
// TENANT EMAIL CONFIGURATION - Multi-Provider Support
// ==========================================

/**
 * Get list of available email providers
 * @endpoint GET /communication/tenant-email-config/providers
 * @permission All roles
 */
export const getAvailableProviders = async (params?: { type?: string }): Promise<CommunicationProvider[]> => {
  const { data } = await apiClient.get<CommunicationProvider[]>(
    '/communication/tenant-email-config/providers',
    { params }
  );
  return data;
};

// ==========================================
// NEW: Multi-Provider Endpoints
// ==========================================

/**
 * Get all provider configurations for tenant (active first)
 * @endpoint GET /communication/tenant-email-config/configurations
 * @permission All roles
 */
export const listProviderConfigs = async (): Promise<TenantEmailConfig[]> => {
  const { data } = await apiClient.get<TenantEmailConfig[]>(
    '/communication/tenant-email-config/configurations'
  );
  return data;
};

/**
 * Get active provider configuration
 * @endpoint GET /communication/tenant-email-config/configurations/active
 * @permission All roles
 * @throws 404 - No active provider configuration found
 */
export const getActiveProviderConfig = async (): Promise<TenantEmailConfig> => {
  const { data } = await apiClient.get<TenantEmailConfig>(
    '/communication/tenant-email-config/configurations/active'
  );
  return data;
};

/**
 * Get specific provider configuration with decrypted credentials
 * @endpoint GET /communication/tenant-email-config/configurations/:configId
 * @permission All roles
 * @throws 404 - Configuration not found
 */
export const getProviderConfig = async (configId: string): Promise<TenantEmailConfig> => {
  const { data } = await apiClient.get<TenantEmailConfig>(
    `/communication/tenant-email-config/configurations/${configId}`
  );
  return data;
};

/**
 * Create new provider configuration
 * @endpoint POST /communication/tenant-email-config/configurations
 * @permission Owner, Admin only
 * @throws 400 - Validation errors
 * @throws 409 - Provider already configured
 */
export const createProviderConfig = async (
  dto: UpdateTenantEmailConfigDto
): Promise<TenantEmailConfig> => {
  const { data } = await apiClient.post<TenantEmailConfig>(
    '/communication/tenant-email-config/configurations',
    dto
  );
  return data;
};

/**
 * Update existing provider configuration
 * @endpoint PATCH /communication/tenant-email-config/configurations/:configId
 * @permission Owner, Admin only
 * @throws 400 - Validation errors
 * @throws 404 - Configuration not found
 */
export const updateProviderConfig = async (
  configId: string,
  dto: UpdateTenantEmailConfigDto
): Promise<TenantEmailConfig> => {
  const { data } = await apiClient.patch<TenantEmailConfig>(
    `/communication/tenant-email-config/configurations/${configId}`,
    dto
  );
  return data;
};

/**
 * Activate a provider configuration (deactivates all others)
 * @endpoint PATCH /communication/tenant-email-config/configurations/:configId/activate
 * @permission Owner, Admin only
 * @throws 404 - Configuration not found
 */
export const activateProviderConfig = async (configId: string): Promise<TenantEmailConfig> => {
  const { data } = await apiClient.patch<TenantEmailConfig>(
    `/communication/tenant-email-config/configurations/${configId}/activate`
  );
  return data;
};

/**
 * Delete provider configuration
 * @endpoint DELETE /communication/tenant-email-config/configurations/:configId
 * @permission Owner, Admin only
 * @throws 404 - Configuration not found
 * @throws 400 - Cannot delete active provider (deactivate first)
 */
export const deleteProviderConfig = async (configId: string): Promise<void> => {
  await apiClient.delete(`/communication/tenant-email-config/configurations/${configId}`);
};

// ==========================================
// DEPRECATED: Old Single-Provider Endpoints (Backward Compatibility)
// Use new multi-provider endpoints above instead
// ==========================================

/**
 * @deprecated Use getActiveProviderConfig() instead
 * Get tenant's email configuration (returns active provider only)
 * @endpoint GET /communication/tenant-email-config
 * @permission All roles
 * @throws 404 - Email configuration not found for tenant
 */
export const getTenantEmailConfig = async (): Promise<TenantEmailConfig> => {
  const { data } = await apiClient.get<TenantEmailConfig>(
    '/communication/tenant-email-config'
  );
  return data;
};

/**
 * @deprecated Use createProviderConfig() or updateProviderConfig() instead
 * Create or update tenant email configuration
 * @endpoint POST /communication/tenant-email-config
 * @permission Owner, Admin only
 * @throws 400 - Validation errors (credentials, config schema mismatch)
 * @throws 404 - Provider not found
 */
export const updateTenantEmailConfig = async (
  dto: UpdateTenantEmailConfigDto
): Promise<TenantEmailConfig> => {
  const { data } = await apiClient.post<TenantEmailConfig>(
    '/communication/tenant-email-config',
    dto
  );
  return data;
};

/**
 * Send test email using tenant configuration
 * @endpoint POST /communication/tenant-email-config/test
 * @permission Owner, Admin only
 * @throws 400 - Tenant email not configured
 * @throws 500 - Email send failed
 */
export const testTenantEmail = async (dto: TestEmailDto): Promise<SendEmailResponse> => {
  const { data } = await apiClient.post<SendEmailResponse>(
    '/communication/tenant-email-config/test',
    dto
  );
  return data;
};

// ==========================================
// EMAIL TEMPLATES - 8 endpoints
// ==========================================

/**
 * Get paginated list of email templates (admin + tenant)
 * @endpoint GET /communication/templates
 * @permission All roles
 */
export const getTemplates = async (
  params?: GetTemplatesParams
): Promise<PaginatedResponse<EmailTemplate>> => {
  const { data } = await apiClient.get<any>(
    '/communication/templates',
    { params }
  );

  // Transform backend response to frontend format
  // Backend: { templates, total, page, limit, totalPages }
  // Frontend: { data, meta: { total_count, total_pages } }
  return {
    data: data.templates || [],
    meta: {
      page: data.page || 1,
      limit: data.limit || 20,
      total_count: data.total || 0,
      total_pages: data.totalPages || 1,
    },
  };
};

/**
 * Get template by key
 * @endpoint GET /communication/templates/:key
 * @permission All roles
 * @throws 404 - Template not found
 */
export const getTemplate = async (key: string): Promise<EmailTemplate> => {
  const { data } = await apiClient.get<EmailTemplate>(`/communication/templates/${key}`);
  return data;
};

/**
 * Create new email template
 * @endpoint POST /communication/templates
 * @permission Owner, Admin only
 * @throws 400 - Validation errors (Handlebars syntax, schema)
 * @throws 409 - Template key already exists for tenant
 */
export const createTemplate = async (dto: CreateTemplateDto): Promise<EmailTemplate> => {
  const { data } = await apiClient.post<EmailTemplate>('/communication/templates', dto);
  return data;
};

/**
 * Update email template
 * @endpoint PATCH /communication/templates/:key
 * @permission Owner, Admin only
 * @throws 400 - Validation errors
 * @throws 403 - Cannot modify system templates
 * @throws 404 - Template not found
 */
export const updateTemplate = async (
  key: string,
  dto: UpdateTemplateDto
): Promise<EmailTemplate> => {
  const { data } = await apiClient.patch<EmailTemplate>(
    `/communication/templates/${key}`,
    dto
  );
  return data;
};

/**
 * Delete email template
 * @endpoint DELETE /communication/templates/:key
 * @permission Owner, Admin only
 * @throws 403 - Cannot delete system templates
 * @throws 404 - Template not found
 */
export const deleteTemplate = async (key: string): Promise<void> => {
  await apiClient.delete(`/communication/templates/${key}`);
};

/**
 * Clone shared template to tenant template
 * @endpoint POST /communication/templates/:key/clone
 * @permission Tenant users (clones shared templates to their tenant)
 * @throws 400 - Validation errors
 * @throws 403 - Cannot clone platform templates or other tenants' templates
 * @throws 404 - Template not found
 * @throws 409 - new_template_key already exists
 */
export const cloneTemplate = async (
  key: string,
  dto: CloneTemplateDto
): Promise<EmailTemplate> => {
  const { data } = await apiClient.post<EmailTemplate>(
    `/communication/templates/${key}/clone`,
    dto
  );
  return data;
};

/**
 * Preview rendered template with variables
 * @endpoint POST /communication/templates/:key/preview
 * @permission All roles
 * @throws 400 - Validation errors (missing variables)
 * @throws 404 - Template not found
 */
export const previewTemplate = async (
  key: string,
  dto: PreviewTemplateDto
): Promise<TemplatePreview> => {
  const { data } = await apiClient.post<TemplatePreview>(
    `/communication/templates/${key}/preview`,
    {
      ...dto,
      template_key: key, // Include template_key in body (required by backend)
    }
  );
  return data;
};

/**
 * Get variable registry (available variables by context)
 * @endpoint GET /communication/templates/variables/registry
 * @permission All roles
 */
export const getVariableRegistry = async (): Promise<VariableRegistry> => {
  const { data } = await apiClient.get<VariableRegistry>(
    '/communication/templates/variables/registry'
  );
  return data;
};

/**
 * Validate template syntax
 * @endpoint POST /communication/templates/validate
 * @permission All roles
 */
export const validateTemplate = async (
  dto: ValidateTemplateDto
): Promise<TemplateValidationResult> => {
  const { data } = await apiClient.post<TemplateValidationResult>(
    '/communication/templates/validate',
    dto
  );
  return data;
};

// ==========================================
// SEND EMAIL - 2 endpoints
// ==========================================

/**
 * Send email using template
 * @endpoint POST /communication/send-email/templated
 * @permission Owner, Admin, Manager, Sales
 * @throws 400 - Tenant email not configured, validation errors
 * @throws 404 - Template not found
 * @throws 500 - Email send failed
 */
export const sendTemplatedEmail = async (
  dto: SendTemplatedEmailDto
): Promise<SendEmailResponse> => {
  const { data } = await apiClient.post<SendEmailResponse>(
    '/communication/send-email/templated',
    dto
  );
  return data;
};

/**
 * Send raw email (no template)
 * @endpoint POST /communication/send-email/raw
 * @permission Owner, Admin, Manager, Sales
 * @throws 400 - Tenant email not configured, validation errors
 * @throws 500 - Email send failed
 */
export const sendRawEmail = async (dto: SendRawEmailDto): Promise<SendEmailResponse> => {
  const { data } = await apiClient.post<SendEmailResponse>(
    '/communication/send-email/raw',
    dto
  );
  return data;
};

// ==========================================
// COMMUNICATION HISTORY - 3 endpoints
// ==========================================

/**
 * Get paginated list of communication events
 * @endpoint GET /communication/history
 * @permission All roles
 */
export const getCommunicationHistory = async (
  params?: GetCommunicationHistoryParams
): Promise<PaginatedResponse<CommunicationEvent>> => {
  const { data } = await apiClient.get<any>(
    '/communication/history',
    { params }
  );

  // Transform backend response to frontend format
  // Check if data has 'data' property (new format) or direct array (old format)
  if (data.data) {
    // Already in correct format
    return data;
  }

  // Transform from backend format: { events/data, total, page, limit, totalPages }
  return {
    data: data.events || data.data || [],
    meta: {
      page: data.page || 1,
      limit: data.limit || 20,
      total_count: data.total || 0,
      total_pages: data.totalPages || 1,
    },
  };
};

/**
 * Get communication event details
 * @endpoint GET /communication/history/:id
 * @permission All roles
 * @throws 404 - Event not found
 */
export const getCommunicationEvent = async (id: string): Promise<CommunicationEventDetail> => {
  const { data } = await apiClient.get<CommunicationEventDetail>(
    `/communication/history/${id}`
  );
  return data;
};

/**
 * Resend failed email
 * @endpoint POST /communication/history/:id/resend
 * @permission Owner, Admin only
 * @throws 400 - Event not eligible for resend
 * @throws 404 - Event not found
 * @throws 500 - Email send failed
 */
export const resendEmail = async (id: string): Promise<SendEmailResponse> => {
  const { data } = await apiClient.post<SendEmailResponse>(
    `/communication/history/${id}/resend`
  );
  return data;
};

// ==========================================
// NOTIFICATIONS - 5 endpoints
// ==========================================

/**
 * Get user notifications (paginated)
 * @endpoint GET /communication/notifications
 * @permission All roles
 */
export const getNotifications = async (
  params?: GetNotificationsParams
): Promise<PaginatedResponse<Notification>> => {
  const { data } = await apiClient.get<any>(
    '/communication/notifications',
    { params }
  );

  // Transform backend response to frontend format
  // Check if data has 'data' property (new format) or direct array (old format)
  if (data.data) {
    // Already in correct format
    return data;
  }

  // Transform from backend format: { notifications/data, total, page, limit, totalPages }
  return {
    data: data.notifications || data.data || [],
    meta: {
      page: data.page || 1,
      limit: data.limit || 20,
      total_count: data.total || 0,
      total_pages: data.totalPages || 1,
    },
  };
};

/**
 * Get unread notification count
 * @endpoint GET /communication/notifications/unread-count
 * @permission All roles
 */
export const getUnreadCount = async (): Promise<number> => {
  const { data } = await apiClient.get<UnreadCountResponse>(
    '/communication/notifications/unread-count'
  );
  return data.unread_count;
};

/**
 * Mark notification as read
 * @endpoint PATCH /communication/notifications/:id/read
 * @permission All roles
 * @throws 404 - Notification not found
 */
export const markNotificationAsRead = async (id: string): Promise<Notification> => {
  const { data } = await apiClient.patch<Notification>(
    `/communication/notifications/${id}/read`
  );
  return data;
};

/**
 * Mark all notifications as read
 * @endpoint POST /communication/notifications/mark-all-read
 * @permission All roles
 */
export const markAllNotificationsAsRead = async (): Promise<number> => {
  const { data } = await apiClient.post<MarkAllReadResponse>(
    '/communication/notifications/mark-all-read'
  );
  return data.marked_count;
};

/**
 * Delete notification
 * @endpoint DELETE /communication/notifications/:id
 * @permission All roles
 * @throws 404 - Notification not found
 */
export const deleteNotification = async (id: string): Promise<void> => {
  await apiClient.delete(`/communication/notifications/${id}`);
};

// ==========================================
// NOTIFICATION RULES - 4 endpoints
// ==========================================

/**
 * Get list of notification rules
 * @endpoint GET /communication/notification-rules
 * @permission Owner, Admin only
 */
export const getNotificationRules = async (
  params?: GetNotificationRulesParams
): Promise<NotificationRule[]> => {
  const { data } = await apiClient.get<NotificationRule[]>(
    '/communication/notification-rules',
    { params }
  );
  return data;
};

/**
 * Create notification rule
 * @endpoint POST /communication/notification-rules
 * @permission Owner, Admin only
 * @throws 400 - Validation errors
 */
export const createNotificationRule = async (
  dto: CreateNotificationRuleDto
): Promise<NotificationRule> => {
  const { data } = await apiClient.post<NotificationRule>(
    '/communication/notification-rules',
    dto
  );
  return data;
};

/**
 * Update notification rule
 * @endpoint PATCH /communication/notification-rules/:id
 * @permission Owner, Admin only
 * @throws 400 - Validation errors
 * @throws 404 - Rule not found
 */
export const updateNotificationRule = async (
  id: string,
  dto: UpdateNotificationRuleDto
): Promise<NotificationRule> => {
  const { data } = await apiClient.patch<NotificationRule>(
    `/communication/notification-rules/${id}`,
    dto
  );
  return data;
};

/**
 * Delete notification rule
 * @endpoint DELETE /communication/notification-rules/:id
 * @permission Owner, Admin only
 * @throws 404 - Rule not found
 */
export const deleteNotificationRule = async (id: string): Promise<void> => {
  await apiClient.delete(`/communication/notification-rules/${id}`);
};

// ==========================================
// WEBHOOKS (Public) - 5 endpoints
// ==========================================
// Note: Webhooks are public endpoints called by providers,
// not used by frontend. Included here for completeness.

/**
 * SendGrid webhook handler
 * @endpoint POST /webhooks/communication/sendgrid
 * @permission Public (signature verified)
 */
// Not implemented in frontend - backend only

/**
 * Amazon SES webhook handler
 * @endpoint POST /webhooks/communication/amazon-ses
 * @permission Public (signature verified)
 */
// Not implemented in frontend - backend only

/**
 * Brevo webhook handler
 * @endpoint POST /webhooks/communication/brevo
 * @permission Public (signature verified)
 */
// Not implemented in frontend - backend only

/**
 * Twilio SMS webhook handler
 * @endpoint POST /webhooks/communication/twilio-sms
 * @permission Public (signature verified)
 */
// Not implemented in frontend - backend only

/**
 * Twilio WhatsApp webhook handler
 * @endpoint POST /webhooks/communication/twilio-whatsapp
 * @permission Public (signature verified)
 */
// Not implemented in frontend - backend only

// ==========================================
// TOTAL: 41 ENDPOINTS
// ==========================================
// Provider Management (Admin): 7
// Platform Email Config (Admin): 3
// Tenant Email Configuration: 4
// Email Templates: 8
// Send Email: 2
// Communication History: 3
// Notifications: 5
// Notification Rules: 4
// Webhooks (Public): 5 (backend only, not called from frontend)
