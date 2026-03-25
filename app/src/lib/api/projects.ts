// Lead360 - Projects Module API Client
// Endpoints from: project_REST_API.md, project_dashboard_REST_API.md, gantt_data_REST_API.md

import { apiClient } from './axios';
import { buildFileUrl } from './files';
import type {
  Project,
  ListProjectsParams,
  ListProjectsResponse,
  ProjectDashboardData,
  DashboardFilters,
  ProjectGanttListParams,
  ListProjectGanttResponse,
  ProjectFinancialSummary,
  ProjectGanttData,
  CreateProjectDto,
  CreateProjectFromQuoteDto,
  UpdateProjectDto,
  ProjectTask,
  ListTasksParams,
  ListTasksResponse,
  CreateTaskDto,
  UpdateTaskDto,
  TaskDependency,
  CreateDependencyDto,
  TaskAssignee,
  CreateAssigneeDto,
  TaskCalendarEvent,
  CreateCalendarEventDto,
  SendTaskSmsDto,
  ProjectLog,
  ListLogsParams,
  ListLogsResponse,
  ProjectPhoto,
  PhotoTimelineResponse,
  UpdatePhotoDto,
  CompletionChecklist,
  StartCompletionDto,
  CompleteItemDto,
  AddManualItemDto,
  AddPunchListItemDto,
  UpdatePunchListItemDto,
  CompleteProjectResponse,
  ListChecklistTemplatesResponse,
  ChecklistTemplate,
  CreateChecklistTemplateDto,
  UpdateChecklistTemplateDto,
  ProjectDocument,
  DocumentType,
  Permit,
  PermitStatus,
  CreatePermitDto,
  UpdatePermitDto,
  Inspection,
  CreateInspectionDto,
  UpdateInspectionDto,
} from '@/lib/types/projects';

// ========== DASHBOARD ==========

/**
 * Get aggregated dashboard data
 * @endpoint GET /projects/dashboard
 * @roles Owner, Admin, Manager
 */
export const getProjectDashboard = async (filters?: DashboardFilters): Promise<ProjectDashboardData> => {
  const params: Record<string, string> = {};
  if (filters?.status) params.status = filters.status;
  if (filters?.assigned_pm_user_id) params.assigned_pm_user_id = filters.assigned_pm_user_id;
  if (filters?.date_from) params.date_from = filters.date_from;
  if (filters?.date_to) params.date_to = filters.date_to;

  const { data } = await apiClient.get<ProjectDashboardData>('/projects/dashboard', { params });
  return data;
};

/**
 * Get projects with summary for gantt/list view (paginated)
 * @endpoint GET /projects/dashboard/gantt
 * @roles Owner, Admin, Manager
 */
export const getProjectGanttList = async (params?: ProjectGanttListParams): Promise<ListProjectGanttResponse> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.status) queryParams.status = params.status;
  if (params?.assigned_pm_user_id) queryParams.assigned_pm_user_id = params.assigned_pm_user_id;
  if (params?.search) queryParams.search = params.search;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<ListProjectGanttResponse>('/projects/dashboard/gantt', { params: queryParams });
  return data;
};

// ========== PROJECTS CRUD ==========

/**
 * Create standalone project
 * @endpoint POST /projects
 * @roles Owner, Admin, Manager
 */
export const createProject = async (dto: CreateProjectDto): Promise<Project> => {
  const { data } = await apiClient.post<Project>('/projects', dto);
  return data;
};

/**
 * Create project from an accepted quote
 * @endpoint POST /projects/from-quote/:quoteId
 * @roles Owner, Admin, Manager
 * @param quoteId - UUID of the quote to convert
 * @param dto - Optional overrides (name, dates, PM, template)
 * @returns Created project with tasks seeded from quote items
 * @throws 400 - Quote status is not approved/started/concluded
 * @throws 404 - Quote not found
 * @throws 409 - A project already exists for this quote
 */
export const createProjectFromQuote = async (
  quoteId: string,
  dto?: CreateProjectFromQuoteDto,
): Promise<Project> => {
  const { data } = await apiClient.post<Project>(`/projects/from-quote/${quoteId}`, dto || {});
  return data;
};

/**
 * List projects (paginated)
 * @endpoint GET /projects
 * @roles Owner, Admin, Manager, Field
 */
export const getProjects = async (params?: ListProjectsParams): Promise<ListProjectsResponse> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.status) queryParams.status = params.status;
  if (params?.assigned_pm_user_id) queryParams.assigned_pm_user_id = params.assigned_pm_user_id;
  if (params?.search) queryParams.search = params.search;
  if (params?.quote_id) queryParams.quote_id = params.quote_id;

  const { data } = await apiClient.get<ListProjectsResponse>('/projects', { params: queryParams });
  return data;
};

/**
 * Get project detail
 * @endpoint GET /projects/:id
 * @roles Owner, Admin, Manager, Field
 */
export const getProjectById = async (id: string): Promise<Project> => {
  const { data } = await apiClient.get<Project>(`/projects/${id}`);
  return data;
};

/**
 * Update project
 * @endpoint PATCH /projects/:id
 * @roles Owner, Admin, Manager
 */
export const updateProject = async (id: string, dto: UpdateProjectDto): Promise<Project> => {
  const { data } = await apiClient.patch<Project>(`/projects/${id}`, dto);
  return data;
};

/**
 * Soft delete project
 * @endpoint DELETE /projects/:id
 * @roles Owner, Admin
 */
export const deleteProject = async (id: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${id}`);
  return data;
};

/**
 * List active project templates (for dropdown selection)
 * @endpoint GET /project-templates
 * @roles Owner, Admin, Manager
 */
export const getProjectTemplates = async (): Promise<{
  data: Array<{ id: string; name: string; description: string | null; is_active: boolean }>;
  meta: { total: number; page: number; limit: number; totalPages: number };
}> => {
  const { data } = await apiClient.get('/project-templates', {
    params: { is_active: true, limit: 100 },
  });
  return data;
};

// ========== FINANCIAL SUMMARY ==========

/**
 * Get project financial summary
 * @endpoint GET /projects/:id/summary
 * @roles Owner, Admin, Manager, Bookkeeper
 */
export const getProjectSummary = async (id: string): Promise<ProjectFinancialSummary> => {
  const { data } = await apiClient.get<ProjectFinancialSummary>(`/projects/${id}/summary`);
  return data;
};

// ========== GANTT DATA ==========

/**
 * Get single project Gantt data (tasks with dependencies)
 * @endpoint GET /projects/:id/gantt
 * @roles Owner, Admin, Manager
 */
export const getProjectGanttData = async (id: string): Promise<ProjectGanttData> => {
  const { data } = await apiClient.get<ProjectGanttData>(`/projects/${id}/gantt`);
  return data;
};

// ========== CHANGE ORDERS ==========

/**
 * Get change orders redirect URL
 * @endpoint GET /projects/:id/change-orders-redirect
 * @roles Owner, Admin, Manager
 */
export const getChangeOrdersRedirect = async (id: string): Promise<{ redirect_url: string }> => {
  const { data } = await apiClient.get<{ redirect_url: string }>(`/projects/${id}/change-orders-redirect`);
  return data;
};

// ========== PROJECT DOCUMENTS ==========

/**
 * List documents for a project, optionally filtered by type
 * @endpoint GET /projects/:projectId/documents
 * @roles Owner, Admin, Manager
 */
export const getProjectDocuments = async (
  projectId: string,
  params?: { document_type?: DocumentType },
): Promise<ProjectDocument[]> => {
  const queryParams: Record<string, string> = {};
  if (params?.document_type) queryParams.document_type = params.document_type;

  const { data } = await apiClient.get<ProjectDocument[]>(
    `/projects/${projectId}/documents`,
    { params: queryParams },
  );
  return data;
};

/**
 * Upload a document to a project (multipart/form-data)
 * @endpoint POST /projects/:projectId/documents
 * @roles Owner, Admin, Manager
 */
export const uploadProjectDocument = async (
  projectId: string,
  formData: FormData,
): Promise<ProjectDocument> => {
  const { data } = await apiClient.post<ProjectDocument>(
    `/projects/${projectId}/documents`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
  return data;
};

/**
 * Delete a document from a project
 * @endpoint DELETE /projects/:projectId/documents/:id
 * @roles Owner, Admin
 */
export const deleteProjectDocument = async (
  projectId: string,
  documentId: string,
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(
    `/projects/${projectId}/documents/${documentId}`,
  );
  return data;
};

// ========== PERMITS ==========

/**
 * List permits for a project
 * @endpoint GET /projects/:projectId/permits
 * @roles Owner, Admin, Manager
 */
export const getProjectPermits = async (
  projectId: string,
  params?: { status?: PermitStatus },
): Promise<Permit[]> => {
  const queryParams: Record<string, string> = {};
  if (params?.status) queryParams.status = params.status;

  const { data } = await apiClient.get<Permit[]>(
    `/projects/${projectId}/permits`,
    { params: queryParams },
  );
  return data;
};

/**
 * Get a single permit by ID
 * @endpoint GET /projects/:projectId/permits/:id
 * @roles Owner, Admin, Manager
 */
export const getProjectPermitById = async (
  projectId: string,
  permitId: string,
): Promise<Permit> => {
  const { data } = await apiClient.get<Permit>(
    `/projects/${projectId}/permits/${permitId}`,
  );
  return data;
};

/**
 * Create a permit for a project
 * @endpoint POST /projects/:projectId/permits
 * @roles Owner, Admin, Manager
 */
export const createProjectPermit = async (
  projectId: string,
  dto: CreatePermitDto,
): Promise<Permit> => {
  const { data } = await apiClient.post<Permit>(
    `/projects/${projectId}/permits`,
    dto,
  );
  return data;
};

/**
 * Update a permit
 * @endpoint PATCH /projects/:projectId/permits/:id
 * @roles Owner, Admin, Manager
 */
export const updateProjectPermit = async (
  projectId: string,
  permitId: string,
  dto: UpdatePermitDto,
): Promise<Permit> => {
  const { data } = await apiClient.patch<Permit>(
    `/projects/${projectId}/permits/${permitId}`,
    dto,
  );
  return data;
};

/**
 * Delete a permit (hard delete)
 * @endpoint DELETE /projects/:projectId/permits/:id
 * @roles Owner, Admin
 */
export const deleteProjectPermit = async (
  projectId: string,
  permitId: string,
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(
    `/projects/${projectId}/permits/${permitId}`,
  );
  return data;
};

// ========== INSPECTIONS ==========

/**
 * List inspections for a permit
 * @endpoint GET /projects/:projectId/permits/:permitId/inspections
 * @roles Owner, Admin, Manager
 */
export const getPermitInspections = async (
  projectId: string,
  permitId: string,
): Promise<Inspection[]> => {
  const { data } = await apiClient.get<Inspection[]>(
    `/projects/${projectId}/permits/${permitId}/inspections`,
  );
  return data;
};

/**
 * Create an inspection for a permit
 * @endpoint POST /projects/:projectId/permits/:permitId/inspections
 * @roles Owner, Admin, Manager
 */
export const createPermitInspection = async (
  projectId: string,
  permitId: string,
  dto: CreateInspectionDto,
): Promise<Inspection> => {
  const { data } = await apiClient.post<Inspection>(
    `/projects/${projectId}/permits/${permitId}/inspections`,
    dto,
  );
  return data;
};

/**
 * Update an inspection
 * @endpoint PATCH /projects/:projectId/permits/:permitId/inspections/:id
 * @roles Owner, Admin, Manager
 */
export const updatePermitInspection = async (
  projectId: string,
  permitId: string,
  inspectionId: string,
  dto: UpdateInspectionDto,
): Promise<Inspection> => {
  const { data } = await apiClient.patch<Inspection>(
    `/projects/${projectId}/permits/${permitId}/inspections/${inspectionId}`,
    dto,
  );
  return data;
};

/**
 * Delete an inspection (hard delete)
 * @endpoint DELETE /projects/:projectId/permits/:permitId/inspections/:id
 * @roles Owner, Admin
 */
export const deletePermitInspection = async (
  projectId: string,
  permitId: string,
  inspectionId: string,
): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(
    `/projects/${projectId}/permits/${permitId}/inspections/${inspectionId}`,
  );
  return data;
};

// ========== UTILITY FUNCTIONS ==========

/**
 * Format project status for display
 */
export const formatProjectStatus = (status: string): string => {
  const labels: Record<string, string> = {
    planned: 'Planned',
    in_progress: 'In Progress',
    on_hold: 'On Hold',
    completed: 'Completed',
    canceled: 'Canceled',
  };
  return labels[status] || status;
};

/**
 * Get badge variant for project status
 */
export const getStatusBadgeVariant = (status: string): 'info' | 'blue' | 'warning' | 'success' | 'neutral' | 'danger' => {
  const variants: Record<string, 'info' | 'blue' | 'warning' | 'success' | 'neutral' | 'danger'> = {
    planned: 'info',
    in_progress: 'blue',
    on_hold: 'warning',
    completed: 'success',
    canceled: 'neutral',
  };
  return variants[status] || 'neutral';
};

/**
 * Format currency value for display
 */
export const formatCurrency = (value: number | null | undefined): string => {
  if (value === null || value === undefined) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
};

/**
 * Format date for display
 */
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/**
 * Format PM name for display
 */
export const formatPMName = (pm: { first_name: string; last_name: string } | null): string => {
  if (!pm) return 'Unassigned';
  return `${pm.first_name} ${pm.last_name}`.trim();
};

// ========== PROJECT TASKS ==========

export const getProjectTasks = async (projectId: string, params?: ListTasksParams): Promise<ListTasksResponse> => {
  const queryParams: Record<string, string | number> = {};
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;
  if (params?.status) queryParams.status = params.status;

  const { data } = await apiClient.get<ListTasksResponse>(`/projects/${projectId}/tasks`, { params: queryParams });
  return data;
};

export const getProjectTaskById = async (projectId: string, taskId: string): Promise<ProjectTask> => {
  const { data } = await apiClient.get<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`);
  return data;
};

export const createProjectTask = async (projectId: string, dto: CreateTaskDto): Promise<ProjectTask> => {
  const { data } = await apiClient.post<ProjectTask>(`/projects/${projectId}/tasks`, dto);
  return data;
};

export const updateProjectTask = async (projectId: string, taskId: string, dto: UpdateTaskDto): Promise<ProjectTask> => {
  const { data } = await apiClient.patch<ProjectTask>(`/projects/${projectId}/tasks/${taskId}`, dto);
  return data;
};

export const deleteProjectTask = async (projectId: string, taskId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${projectId}/tasks/${taskId}`);
  return data;
};

// Task Dependencies
export const addTaskDependency = async (projectId: string, taskId: string, dto: CreateDependencyDto): Promise<TaskDependency> => {
  const { data } = await apiClient.post<TaskDependency>(`/projects/${projectId}/tasks/${taskId}/dependencies`, dto);
  return data;
};

export const removeTaskDependency = async (projectId: string, taskId: string, depId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${projectId}/tasks/${taskId}/dependencies/${depId}`);
  return data;
};

// Task Assignments
export const addTaskAssignee = async (projectId: string, taskId: string, dto: CreateAssigneeDto): Promise<TaskAssignee> => {
  const { data } = await apiClient.post<TaskAssignee>(`/projects/${projectId}/tasks/${taskId}/assignees`, dto);
  return data;
};

export const removeTaskAssignee = async (projectId: string, taskId: string, assigneeId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${projectId}/tasks/${taskId}/assignees/${assigneeId}`);
  return data;
};

// Task SMS
export const sendTaskSms = async (projectId: string, taskId: string, dto: SendTaskSmsDto): Promise<{ message: string; sms_id: string }> => {
  const { data } = await apiClient.post<{ message: string; sms_id: string }>(`/projects/${projectId}/tasks/${taskId}/sms`, dto);
  return data;
};

// Task Calendar Events
export const getTaskCalendarEvents = async (projectId: string, taskId: string): Promise<TaskCalendarEvent[]> => {
  const { data } = await apiClient.get<TaskCalendarEvent[]>(`/projects/${projectId}/tasks/${taskId}/calendar-events`);
  return data;
};

export const createTaskCalendarEvent = async (projectId: string, taskId: string, dto: CreateCalendarEventDto): Promise<TaskCalendarEvent> => {
  const { data } = await apiClient.post<TaskCalendarEvent>(`/projects/${projectId}/tasks/${taskId}/calendar-events`, dto);
  return data;
};

export const deleteTaskCalendarEvent = async (projectId: string, taskId: string, eventId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${projectId}/tasks/${taskId}/calendar-events/${eventId}`);
  return data;
};

// ========== TASK STATUS UTILITIES ==========

export const formatTaskStatus = (status: string): string => {
  const labels: Record<string, string> = {
    not_started: 'Not Started',
    in_progress: 'In Progress',
    blocked: 'Blocked',
    done: 'Done',
  };
  return labels[status] || status;
};

export const getTaskStatusBadgeVariant = (status: string): 'neutral' | 'blue' | 'warning' | 'success' => {
  const variants: Record<string, 'neutral' | 'blue' | 'warning' | 'success'> = {
    not_started: 'neutral',
    in_progress: 'blue',
    blocked: 'warning',
    done: 'success',
  };
  return variants[status] || 'neutral';
};

export const getValidStatusTransitions = (current: string): string[] => {
  const transitions: Record<string, string[]> = {
    not_started: ['in_progress', 'blocked'],
    in_progress: ['blocked', 'done'],
    blocked: ['in_progress'],
    done: [],
  };
  return transitions[current] || [];
};

export const formatTaskCategory = (category: string | null): string => {
  if (!category) return '-';
  const labels: Record<string, string> = {
    labor: 'Labor',
    material: 'Material',
    subcontractor: 'Subcontractor',
    equipment: 'Equipment',
    other: 'Other',
  };
  return labels[category] || category;
};

// ========== PROJECT LOGS ==========

export const getProjectLogs = async (projectId: string, params?: ListLogsParams): Promise<ListLogsResponse> => {
  const queryParams: Record<string, string | number | boolean> = {};
  if (params?.is_public !== undefined) queryParams.is_public = params.is_public;
  if (params?.has_attachments !== undefined) queryParams.has_attachments = params.has_attachments;
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<ListLogsResponse>(`/projects/${projectId}/logs`, { params: queryParams });
  return data;
};

export const createProjectLog = async (projectId: string, formData: FormData): Promise<ProjectLog> => {
  const { data } = await apiClient.post<ProjectLog>(`/projects/${projectId}/logs`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const deleteProjectLog = async (projectId: string, logId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${projectId}/logs/${logId}`);
  return data;
};

// ========== PROJECT PHOTOS ==========

export const getProjectPhotos = async (projectId: string, params?: {
  task_id?: string;
  is_public?: boolean;
  date_from?: string;
  date_to?: string;
}): Promise<ProjectPhoto[]> => {
  const queryParams: Record<string, string | boolean> = {};
  if (params?.task_id) queryParams.task_id = params.task_id;
  if (params?.is_public !== undefined) queryParams.is_public = params.is_public;
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;

  const { data } = await apiClient.get<ProjectPhoto[]>(`/projects/${projectId}/photos`, { params: queryParams });
  return data;
};

export const getPhotoTimeline = async (projectId: string, params?: {
  task_id?: string;
  is_public?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}): Promise<PhotoTimelineResponse> => {
  const queryParams: Record<string, string | number | boolean> = {};
  if (params?.task_id) queryParams.task_id = params.task_id;
  if (params?.is_public !== undefined) queryParams.is_public = params.is_public;
  if (params?.date_from) queryParams.date_from = params.date_from;
  if (params?.date_to) queryParams.date_to = params.date_to;
  if (params?.page) queryParams.page = params.page;
  if (params?.limit) queryParams.limit = params.limit;

  const { data } = await apiClient.get<PhotoTimelineResponse>(`/projects/${projectId}/photos/timeline`, { params: queryParams });
  return data;
};

export const uploadProjectPhoto = async (projectId: string, formData: FormData): Promise<ProjectPhoto> => {
  const { data } = await apiClient.post<ProjectPhoto>(`/projects/${projectId}/photos`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const batchUploadPhotos = async (projectId: string, formData: FormData): Promise<ProjectPhoto[]> => {
  const { data } = await apiClient.post<ProjectPhoto[]>(`/projects/${projectId}/photos/batch`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export const updateProjectPhoto = async (projectId: string, photoId: string, dto: UpdatePhotoDto): Promise<ProjectPhoto> => {
  const { data } = await apiClient.patch<ProjectPhoto>(`/projects/${projectId}/photos/${photoId}`, dto);
  return data;
};

export const deleteProjectPhoto = async (projectId: string, photoId: string): Promise<{ message: string }> => {
  const { data } = await apiClient.delete<{ message: string }>(`/projects/${projectId}/photos/${photoId}`);
  return data;
};

/**
 * Get the full URL for a file/photo served by Nginx
 * API returns /public/{tenant_id}/... paths
 * Nginx serves from /uploads/public/... on app domain
 */
export const getFileUrl = (relativePath: string | null): string | null => {
  if (!relativePath) return null;
  return buildFileUrl(relativePath);
};

// ========== COMPLETION CHECKLIST ==========

/** Get completion checklist for a project */
export const getCompletionChecklist = async (projectId: string): Promise<CompletionChecklist> => {
  const { data } = await apiClient.get<CompletionChecklist>(`/projects/${projectId}/completion`);
  return data;
};

/** Start a completion checklist (optionally from template) */
export const startCompletionChecklist = async (
  projectId: string,
  dto?: StartCompletionDto,
): Promise<CompletionChecklist> => {
  const { data } = await apiClient.post<CompletionChecklist>(`/projects/${projectId}/completion`, dto || {});
  return data;
};

/** Mark a checklist item as completed */
export const completeChecklistItem = async (
  projectId: string,
  itemId: string,
  dto?: CompleteItemDto,
): Promise<CompletionChecklist> => {
  const { data } = await apiClient.patch<CompletionChecklist>(
    `/projects/${projectId}/completion/items/${itemId}`,
    dto || {},
  );
  return data;
};

/** Add a manual checklist item */
export const addManualChecklistItem = async (
  projectId: string,
  dto: AddManualItemDto,
): Promise<CompletionChecklist> => {
  const { data } = await apiClient.post<CompletionChecklist>(
    `/projects/${projectId}/completion/items`,
    dto,
  );
  return data;
};

/** Add a punch list item */
export const addPunchListItem = async (
  projectId: string,
  dto: AddPunchListItemDto,
): Promise<CompletionChecklist> => {
  const { data } = await apiClient.post<CompletionChecklist>(
    `/projects/${projectId}/completion/punch-list`,
    dto,
  );
  return data;
};

/** Update a punch list item (status, description, assignment) */
export const updatePunchListItem = async (
  projectId: string,
  itemId: string,
  dto: UpdatePunchListItemDto,
): Promise<CompletionChecklist> => {
  const { data } = await apiClient.patch<CompletionChecklist>(
    `/projects/${projectId}/completion/punch-list/${itemId}`,
    dto,
  );
  return data;
};

/** Finalize project completion */
export const completeProject = async (projectId: string): Promise<CompleteProjectResponse> => {
  const { data } = await apiClient.post<CompleteProjectResponse>(`/projects/${projectId}/complete`);
  return data;
};

/** List active checklist templates (for dropdown when starting completion) */
export const listChecklistTemplates = async (): Promise<ListChecklistTemplatesResponse> => {
  const { data } = await apiClient.get<ListChecklistTemplatesResponse>(
    '/settings/checklist-templates',
    { params: { is_active: true, limit: 100 } },
  );
  return data;
};

// ========== CHECKLIST TEMPLATE SETTINGS (CRUD) ==========

/** List all checklist templates (paginated, for settings page) */
export const listAllChecklistTemplates = async (
  params?: { page?: number; limit?: number; is_active?: boolean },
): Promise<ListChecklistTemplatesResponse> => {
  const { data } = await apiClient.get<ListChecklistTemplatesResponse>(
    '/settings/checklist-templates',
    { params },
  );
  return data;
};

/** Get a single checklist template by ID */
export const getChecklistTemplate = async (id: string): Promise<ChecklistTemplate> => {
  const { data } = await apiClient.get<ChecklistTemplate>(`/settings/checklist-templates/${id}`);
  return data;
};

/** Create a new checklist template */
export const createChecklistTemplate = async (
  dto: CreateChecklistTemplateDto,
): Promise<ChecklistTemplate> => {
  const { data } = await apiClient.post<ChecklistTemplate>('/settings/checklist-templates', dto);
  return data;
};

/** Update a checklist template */
export const updateChecklistTemplate = async (
  id: string,
  dto: UpdateChecklistTemplateDto,
): Promise<ChecklistTemplate> => {
  const { data } = await apiClient.patch<ChecklistTemplate>(`/settings/checklist-templates/${id}`, dto);
  return data;
};

/** Delete a checklist template */
export const deleteChecklistTemplate = async (id: string): Promise<void> => {
  await apiClient.delete(`/settings/checklist-templates/${id}`);
};
