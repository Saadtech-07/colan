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

export type AppRole = "admin" | "employee";

export interface Employee {
  id: string;
  employeeId: string;
  name: string;
  team: TeamName;
  role: CompanyRole;
  bayNumber: string;
  imageUrl: string;
}

export interface Project {
  id: string;
  name: string;
  team: TeamName;
  assignedDate: string;
  lastDate: string;
  status: ProjectStatus;
}

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

export interface Notification {
  id: string;
  projectId: string;
  projectName: string;
  team: TeamName;
  assignedDate: string;
  status: ProjectStatus;
  isRead: boolean;
  createdAt: string;
}
