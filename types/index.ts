/** Squad name from the `teams` collection (e.g. "React Team"). */
export type TeamName = string;

export type WorkspaceTeam = {
  id: string;
  name: TeamName;
  slug: string;
  displayOrder: number;
  description?: string;
  accentColor?: string;
};

export type ProjectStatus = "Yet To Start" | "In Progress" | "Completed";

export type CompanyRole =
  | "Admin"
  | "Manager"
  | "Team Lead"
  | "Employee"
  | "Intern";

export type PersonStatus = "Active" | "On Leave" | "Inactive";

export type PermissionAccessLevel = "none" | "view" | "edit" | "full";

export type Gender = "male" | "female" | "other";

/** Workspace access role key (matches `company_roles.key` / app_users.appRole). */
export type AppRole = string;

/** Extra directory fields from `employee_details` (Atlas collection). */
export type EmployeeDirectoryInfo = {
  workEmail?: string;
  personalEmail?: string;
  phone?: string;
  /** Legacy office label; kept in sync with fullAddress when possible. */
  location?: string;
  fullAddress?: string;
  currentAddress?: string;
  permanentAddress?: string;
  joinedDate?: string;
  notes?: string;
  resumeUrl?: string;
  resumeFileName?: string;
  resumeMimeType?: string;
  resumeUploadedAt?: string;
  department?: string;
  designation?: string;
  status?: PersonStatus;
  reportsToEmployeeId?: string;
};

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  team: TeamName;
  role: CompanyRole;
  gender: Gender;
  bayNumber: string;
  imageUrl: string;
  /** Login email from the linked app user account. */
  email?: string;
  directory?: EmployeeDirectoryInfo;
}

export type EmployeeDetail = Employee & {
  slug: string;
  assignedProjects: Project[];
};

export type PersonActivityEntry = {
  id: string;
  action: string;
  details?: string;
  createdAt: string;
};

export type Person = Employee & {
  slug: string;
  department: string;
  designation: string;
  status: PersonStatus;
  reportingManagerId?: string;
  reportingManagerName?: string;
};

export type PersonDetail = Person & {
  assignedProjects: Project[];
  directReports: Person[];
  recentActivity: PersonActivityEntry[];
  taskSummary: {
    total: number;
    completed: number;
    completionPercentage: number;
  };
};

export type OrgChartNode = Person & {
  children: OrgChartNode[];
};

export interface Project {
  id: string;
  slug: string;
  name: string;
  /** Client or account this project is delivered for. */
  clientName?: string;
  /** App user document id of the assigned project manager. */
  projectManagerId?: string;
  /** Employee document id of the team lead for this project. */
  teamLeadId?: string;
  /** Squads this project is assigned to (one or more). */
  teams: TeamName[];
  assignedDate: string;
  lastDate: string;
  status: ProjectStatus;
  description?: string;
  /** Employee document ids assigned to this project. */
  memberIds: string[];
  /** Aggregated from linked tasks. */
  totalTasks?: number;
  completedTasks?: number;
  progressPercentage?: number;
}

export type TaskStatus = "Todo" | "In Progress" | "Review" | "Done";
export type TaskPriority = "Low" | "Medium" | "High" | "Critical";

export type Task = {
  id: string;
  title: string;
  description?: string;
  projectId: string;
  projectName?: string;
  assigneeId?: string;
  assigneeName?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  createdById: string;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
};

export type TaskComment = {
  id: string;
  taskId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type TaskActivityEntry = {
  id: string;
  taskId: string;
  action: string;
  actorId: string;
  actorName: string;
  details?: string;
  createdAt: string;
};

export type TaskDetail = Task & {
  comments: TaskComment[];
  activity: TaskActivityEntry[];
};

export type DailyUpdate = {
  id: string;
  employeeId: string;
  employeeName: string;
  projectId: string;
  projectName?: string;
  date: string;
  workDone: string;
  blockers: string;
  tomorrowPlan: string;
  createdAt: string;
};

export type ProjectAnalytics = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  projects: Array<{
    id: string;
    name: string;
    slug: string;
    progressPercentage: number;
    totalTasks: number;
    completedTasks: number;
    status: ProjectStatus;
  }>;
};

export type TaskAnalytics = {
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  statusDistribution: Array<{ status: TaskStatus; count: number }>;
};

export type WorkloadAnalytics = {
  assignees: Array<{
    employeeId: string;
    employeeName: string;
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    pendingTasks: number;
  }>;
};

export type ProjectManagerSummary = {
  id: string;
  name: string;
  email: string;
  imageUrl: string;
  appRole: AppRole;
};

export type ProjectDetail = Project & {
  members: Employee[];
  projectManager?: ProjectManagerSummary | null;
};

export interface GalleryImage {
  id: string;
  url: string;
  title: string;
  caption?: string;
  uploadedAt: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  appRole: AppRole;
  team?: TeamName;
  avatarUrl?: string;
  isProfileCompleted: boolean;
}
