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

export interface Project {
  id: string;
  slug: string;
  name: string;
  /** Client or account this project is delivered for. */
  clientName?: string;
  /** App user document id of the assigned project manager. */
  projectManagerId?: string;
  /** Squads this project is assigned to (one or more). */
  teams: TeamName[];
  assignedDate: string;
  lastDate: string;
  status: ProjectStatus;
  description?: string;
  /** Employee document ids assigned to this project. */
  memberIds: string[];
}

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
