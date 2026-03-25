// Lead360 - Projects Module Type Definitions
// Based on verified API responses from:
//   - project_REST_API.md
//   - project_dashboard_REST_API.md
//   - gantt_data_REST_API.md

// ========== PROJECT ENTITY ==========

export type ProjectStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'canceled';

export interface ProjectAssignedPM {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ProjectQuote {
  id: string;
  quote_number: string;
  title: string;
}

export interface ProjectLead {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ProjectCreatedByUser {
  id: string;
  first_name: string;
  last_name: string;
}

export interface Project {
  id: string;
  tenant_id: string;
  quote_id: string | null;
  lead_id: string | null;
  project_number: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  start_date: string | null;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  permit_required: boolean;
  assigned_pm_user_id: string | null;
  contract_value: number | null;
  estimated_cost: number | null;
  progress_percent: number;
  is_standalone: boolean;
  portal_enabled: boolean;
  deletion_locked: boolean;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  assigned_pm: ProjectAssignedPM | null;
  quote: ProjectQuote | null;
  lead: ProjectLead | null;
  created_by_user?: ProjectCreatedByUser;
  task_count: number;
  completed_task_count: number;
}

// ========== LIST PROJECTS ==========

export interface ListProjectsParams {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  assigned_pm_user_id?: string;
  search?: string;
  quote_id?: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListProjectsResponse {
  data: Project[];
  meta: PaginationMeta;
}

// ========== DASHBOARD ==========

export interface StatusDistribution {
  planned: number;
  in_progress: number;
  on_hold: number;
  completed: number;
  canceled: number;
}

export interface UpcomingDeadline {
  project_id: string;
  project_name: string;
  target_completion_date: string;
  days_remaining: number;
}

export interface RecentActivity {
  activity_type: string;
  project_id: string;
  project_name: string | null;
  description: string;
  user_id: string | null;
  user_name: string | null;
  created_at: string;
}

export interface ProjectDashboardData {
  total_projects: number;
  status_distribution: StatusDistribution;
  active_projects: number;
  delayed_tasks_count: number;
  projects_with_delays: number;
  overdue_tasks_count: number;
  upcoming_deadlines: UpcomingDeadline[];
  recent_activity: RecentActivity[];
}

export interface DashboardFilters {
  status?: ProjectStatus;
  assigned_pm_user_id?: string;
  date_from?: string;
  date_to?: string;
}

// ========== DASHBOARD GANTT (Project List with Task Counts) ==========

export interface ProjectGanttListItem {
  id: string;
  project_number: string;
  name: string;
  status: ProjectStatus;
  start_date: string | null;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  contract_value: number | null;
  progress_percent: number;
  assigned_pm: ProjectAssignedPM | null;
  customer: { id: string; first_name: string; last_name: string } | null;
  task_count: number;
  completed_task_count: number;
  delayed_task_count: number;
}

export interface ListProjectGanttResponse {
  data: ProjectGanttListItem[];
  meta: PaginationMeta;
}

export interface ProjectGanttListParams {
  status?: ProjectStatus;
  assigned_pm_user_id?: string;
  search?: string;
  page?: number;
  limit?: number;
}

// ========== PROJECT FINANCIAL SUMMARY ==========

export interface CostByCategory {
  labor: number;
  material: number;
  subcontractor: number;
  equipment: number;
  other: number;
}

export interface ProjectFinancialSummary {
  project_id: string;
  project_number: string;
  contract_value: number | null;
  estimated_cost: number | null;
  progress_percent: number;
  task_count: number;
  completed_task_count: number;
  total_actual_cost: number;
  cost_by_category: CostByCategory;
  entry_count: number;
  // Extra fields returned by API (not in docs)
  receipt_count?: number;
  margin_estimated?: number | null;
  margin_actual?: number | null;
}

// ========== GANTT DATA (Single Project) ==========

export interface GanttTaskAssignee {
  type: 'crew_member' | 'subcontractor' | 'user';
  name: string;
}

export interface GanttTaskDependency {
  depends_on_task_id: string;
  type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish';
}

export interface GanttTaskDependent {
  task_id: string;
  type: 'finish_to_start' | 'start_to_start' | 'finish_to_finish';
}

export type GanttTaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done';

export interface GanttTask {
  id: string;
  title: string;
  status: GanttTaskStatus;
  estimated_start_date: string | null;
  estimated_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  is_delayed: boolean;
  order_index: number;
  assignees: GanttTaskAssignee[];
  dependencies: GanttTaskDependency[];
  dependents: GanttTaskDependent[];
}

export interface ProjectGanttData {
  project: {
    id: string;
    name: string;
    start_date: string | null;
    target_completion_date: string | null;
    progress_percent: number;
  };
  tasks: GanttTask[];
}

// ========== CREATE / UPDATE DTOs ==========

export interface CreateProjectDto {
  name: string;
  description?: string;
  start_date?: string;
  target_completion_date?: string;
  permit_required?: boolean;
  assigned_pm_user_id?: string;
  estimated_cost?: number;
  notes?: string;
  template_id?: string;
}

export interface CreateProjectFromQuoteDto {
  name?: string;
  description?: string;
  start_date?: string;
  target_completion_date?: string;
  permit_required?: boolean;
  assigned_pm_user_id?: string;
  notes?: string;
  template_id?: string;
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: ProjectStatus;
  start_date?: string;
  target_completion_date?: string;
  permit_required?: boolean;
  assigned_pm_user_id?: string | null;
  portal_enabled?: boolean;
  notes?: string;
}

// ========== PROJECT TASKS ==========

export type TaskStatus = 'not_started' | 'in_progress' | 'blocked' | 'done';
export type TaskCategory = 'labor' | 'material' | 'subcontractor' | 'equipment' | 'other';
export type AssigneeType = 'crew_member' | 'subcontractor' | 'user';
export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish';

export interface TaskAssignee {
  id: string;
  assignee_type: AssigneeType;
  crew_member: { id: string; first_name: string; last_name: string } | null;
  subcontractor: { id: string; business_name: string } | null;
  user: { id: string; first_name: string; last_name: string } | null;
  assigned_at: string;
}

export interface TaskDependency {
  id: string;
  depends_on_task_id: string;
  depends_on_task_title: string;
  dependency_type: DependencyType;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  tenant_id: string;
  project_id: string;
  quote_item_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  estimated_duration_days: number | null;
  estimated_start_date: string | null;
  estimated_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  is_delayed: boolean;
  order_index: number;
  category: TaskCategory | null;
  notes: string | null;
  assignees: TaskAssignee[];
  dependencies: TaskDependency[];
  created_by_user_id: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListTasksParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
}

export interface ListTasksResponse {
  data: ProjectTask[];
  meta: PaginationMeta;
}

export interface CreateTaskDto {
  title: string;
  description?: string;
  estimated_duration_days?: number;
  estimated_start_date?: string;
  estimated_end_date?: string;
  category?: TaskCategory;
  order_index: number;
  notes?: string;
}

export interface UpdateTaskDto {
  title?: string;
  description?: string;
  estimated_duration_days?: number;
  estimated_start_date?: string;
  estimated_end_date?: string;
  status?: TaskStatus;
  actual_start_date?: string;
  actual_end_date?: string;
  category?: TaskCategory;
  order_index?: number;
  notes?: string;
}

export interface CreateDependencyDto {
  depends_on_task_id: string;
  dependency_type: DependencyType;
}

export interface CreateAssigneeDto {
  assignee_type: AssigneeType;
  crew_member_id?: string;
  subcontractor_id?: string;
  user_id?: string;
}

export interface TaskCalendarEvent {
  id: string;
  tenant_id: string;
  task_id: string;
  project_id: string;
  title: string;
  description: string | null;
  start_datetime: string;
  end_datetime: string;
  google_event_id: string | null;
  sync_status: string;
  created_by_user_id: string;
  created_at: string;
}

export interface CreateCalendarEventDto {
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime: string;
}

export interface SendTaskSmsDto {
  to_phone?: string;
  text_body: string;
  lead_id?: string;
}

// ========== PROJECT LOGS ==========

export interface LogAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: 'photo' | 'pdf' | 'document';
  file_size_bytes?: number;
  created_at?: string;
}

export interface LogAuthor {
  id: string;
  first_name: string;
  last_name: string;
}

export interface ProjectLog {
  id: string;
  project_id: string;
  task_id: string | null;
  author: LogAuthor;
  log_date: string;
  content: string;
  is_public: boolean;
  weather_delay: boolean;
  attachments: LogAttachment[];
  created_at: string;
}

export interface ListLogsParams {
  is_public?: boolean;
  has_attachments?: boolean;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface ListLogsResponse {
  data: ProjectLog[];
  meta: PaginationMeta;
}

// ========== PROJECT DOCUMENTS ==========

export type DocumentType = 'contract' | 'permit' | 'blueprint' | 'agreement' | 'photo' | 'other';

export interface ProjectDocument {
  id: string;
  project_id: string;
  file_id: string;
  file_url: string;
  file_name: string;
  document_type: DocumentType;
  description: string | null;
  is_public: boolean;
  uploaded_by_user_id: string;
  created_at: string;
}

// ========== PERMITS ==========

export type PermitStatus =
  | 'not_required'
  | 'pending_application'
  | 'submitted'
  | 'approved'
  | 'active'
  | 'failed'
  | 'closed';

export type InspectionResult = 'pass' | 'fail' | 'conditional' | 'pending';

export interface Inspection {
  id: string;
  permit_id: string;
  project_id: string;
  inspection_type: string;
  scheduled_date: string | null;
  inspector_name: string | null;
  result: InspectionResult | null;
  reinspection_required: boolean;
  reinspection_date: string | null;
  notes: string | null;
  inspected_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Permit {
  id: string;
  project_id: string;
  permit_number: string | null;
  permit_type: string;
  status: PermitStatus;
  submitted_date: string | null;
  approved_date: string | null;
  expiry_date: string | null;
  issuing_authority: string | null;
  notes: string | null;
  inspections: Inspection[];
  created_at: string;
  updated_at: string;
}

export interface CreatePermitDto {
  permit_type: string;
  permit_number?: string;
  status?: PermitStatus;
  submitted_date?: string;
  approved_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  notes?: string;
}

export interface UpdatePermitDto {
  permit_type?: string;
  permit_number?: string;
  status?: PermitStatus;
  submitted_date?: string;
  approved_date?: string;
  expiry_date?: string;
  issuing_authority?: string;
  notes?: string;
}

export interface CreateInspectionDto {
  inspection_type: string;
  scheduled_date?: string;
  inspector_name?: string;
  result?: InspectionResult;
  reinspection_required?: boolean;
  reinspection_date?: string;
  notes?: string;
  inspected_by_user_id?: string;
}

export interface UpdateInspectionDto {
  inspection_type?: string;
  scheduled_date?: string;
  inspector_name?: string;
  result?: InspectionResult;
  reinspection_required?: boolean;
  reinspection_date?: string;
  notes?: string;
  inspected_by_user_id?: string;
}

// ========== PROJECT PHOTOS ==========

export interface ProjectPhoto {
  id: string;
  project_id: string;
  task_id: string | null;
  file_id: string;
  file_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  is_public: boolean;
  taken_at: string | null;
  uploaded_by_user_id: string;
  created_at: string;
}

export interface TimelinePhoto {
  id: string;
  file_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  is_public: boolean;
  task: { id: string; title: string } | null;
  log: { id: string } | null;
  uploaded_by: { first_name: string; last_name: string } | null;
  created_at: string;
}

export interface TimelineDateGroup {
  date: string;
  photos: TimelinePhoto[];
}

export interface PhotoTimelineResponse {
  data: TimelineDateGroup[];
  meta: PaginationMeta;
}

export interface UpdatePhotoDto {
  caption?: string;
  is_public?: boolean;
}

// ========== COMPLETION CHECKLIST ==========

export interface CompletionChecklistItem {
  id: string;
  title: string;
  is_required: boolean;
  is_completed: boolean;
  completed_at: string | null;
  completed_by_user_id: string | null;
  notes: string | null;
  order_index: number;
  template_item_id: string | null;
}

export interface PunchListAssignedCrew {
  id: string;
  first_name: string;
  last_name: string;
}

export type PunchListStatus = 'open' | 'in_progress' | 'resolved';

export interface PunchListItem {
  id: string;
  title: string;
  description: string | null;
  status: PunchListStatus;
  assigned_to_crew: PunchListAssignedCrew | null;
  resolved_at: string | null;
  reported_by_user_id: string | null;
  resolved_by_user_id: string | null;
  created_at: string;
}

export interface CompletionChecklist {
  id: string;
  project_id: string;
  template_id: string | null;
  completed_at: string | null;
  created_at: string;
  items: CompletionChecklistItem[];
  punch_list: PunchListItem[];
}

export interface StartCompletionDto {
  template_id?: string;
}

export interface CompleteItemDto {
  notes?: string;
}

export interface AddManualItemDto {
  title: string;
  is_required?: boolean;
  order_index: number;
}

export interface AddPunchListItemDto {
  title: string;
  description?: string;
  assigned_to_crew_id?: string;
}

export interface UpdatePunchListItemDto {
  status?: PunchListStatus;
  description?: string;
  assigned_to_crew_id?: string;
}

export interface CompleteProjectResponse {
  project_id: string;
  status: string;
  actual_completion_date: string;
  checklist_completed_at: string;
}

export interface CompleteProjectError {
  message: string;
  incomplete_checklist_items: { id: string; title: string }[];
  unresolved_punch_list_items: { id: string; title: string; status: string }[];
}

// ========== CHECKLIST TEMPLATES (for dropdown) ==========

export interface ChecklistTemplateItem {
  id: string;
  title: string;
  description: string | null;
  is_required: boolean;
  order_index: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  items: ChecklistTemplateItem[];
  created_at: string;
}

export interface ListChecklistTemplatesResponse {
  data: ChecklistTemplate[];
  meta: PaginationMeta;
}

export interface CreateChecklistTemplateItemDto {
  title: string;
  description?: string | null;
  is_required?: boolean;
  order_index: number;
}

export interface CreateChecklistTemplateDto {
  name: string;
  description?: string | null;
  items: CreateChecklistTemplateItemDto[];
}

export interface UpdateChecklistTemplateDto {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  items?: CreateChecklistTemplateItemDto[];
}
