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

/** Workspace access role key (matches `company_roles.key` / app_users.appRole). */
export type AppRole = string;

/** Extra directory fields from `employee_details` (Atlas collection). */
export type EmployeeDirectoryInfo = {
  workEmail?: string;
  phone?: string;
  location?: string;
  joinedDate?: string;
  notes?: string;
};

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  team: TeamName;
  role: CompanyRole;
  bayNumber: string;
  imageUrl: string;
  directory?: EmployeeDirectoryInfo;
}

export type EmployeeDetail = Employee & {
  slug: string;
  assignedProjects: Project[];
};

export interface Project {
  id: string;
  slug: string;
  name: string;
  /** Squads this project is assigned to (one or more). */
  teams: TeamName[];
  assignedDate: string;
  lastDate: string;
  status: ProjectStatus;
  description?: string;
  /** Employee document ids assigned to this project. */
  memberIds: string[];
}

export type ProjectDetail = Project & {
  members: Employee[];
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
