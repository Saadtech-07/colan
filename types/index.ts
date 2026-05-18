export type TeamName =
  | "React Team"
  | "Next.js Team"
  | "Node Team"
  | "UI/UX Team"
  | "Testing Team"
  | "DevOps Team";

export type ProjectStatus = "Yet To Start" | "In Progress" | "Completed";

export type CompanyRole =
  | "Admin"
  | "Manager"
  | "Team Lead"
  | "Employee"
  | "Intern";

/** Workspace access role (Auth.js / app_users), not directory CompanyRole. */
export type AppRole = "admin" | "manager" | "lead" | "employee";

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

export interface Project {
  id: string;
  slug: string;
  name: string;
  team: TeamName;
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
}
