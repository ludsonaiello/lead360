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
