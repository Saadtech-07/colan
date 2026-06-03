import type { Employee, GalleryImage, Project } from "@/types";

/** PNG works reliably in img and avatars; remote SVG often fails to paint. */
export function dicebearAvatarPng(seed: string) {
  return `https://api.dicebear.com/7.x/avataaars/png?seed=${encodeURIComponent(seed)}&size=128`;
}

export const MOCK_EMPLOYEES: Employee[] = [
  {
    id: "1",
    employeeId: "COL-1001",
    name: "Priya Sharma",
    team: "React Team",
    role: "Team Lead",
    bayNumber: "A5",
    imageUrl: dicebearAvatarPng("priya"),
  },
  {
    id: "2",
    employeeId: "COL-1002",
    name: "James Chen",
    team: "Next.js Team",
    role: "Employee",
    bayNumber: "B7",
    imageUrl: dicebearAvatarPng("james"),
  },
  {
    id: "3",
    employeeId: "COL-1003",
    name: "Maria Garcia",
    team: "Node Team",
    role: "Manager",
    bayNumber: "C10",
    imageUrl: dicebearAvatarPng("maria"),
  },
  {
    id: "4",
    employeeId: "COL-1004",
    name: "Alex Thompson",
    team: "UI/UX Team",
    role: "Team Lead",
    bayNumber: "D3",
    imageUrl: dicebearAvatarPng("alex"),
  },
  {
    id: "5",
    employeeId: "COL-1005",
    name: "Sofia Nielsen",
    team: "Testing Team",
    role: "Employee",
    bayNumber: "F8",
    imageUrl: dicebearAvatarPng("sofia"),
  },
  {
    id: "6",
    employeeId: "COL-1006",
    name: "David Okonkwo",
    team: "DevOps Team",
    role: "Employee",
    bayNumber: "G12",
    imageUrl: dicebearAvatarPng("david"),
  },
  {
    id: "7",
    employeeId: "COL-1007",
    name: "Emily Watson",
    team: "React Team",
    role: "Intern",
    bayNumber: "A20",
    imageUrl: dicebearAvatarPng("emily"),
  },
  {
    id: "8",
    employeeId: "COL-1008",
    name: "Ryan Park",
    team: "Next.js Team",
    role: "Team Lead",
    bayNumber: "E6",
    imageUrl: dicebearAvatarPng("ryan"),
  },
];

export const MOCK_PROJECTS: Project[] = [
  {
    id: "p1",
    slug: "customer-portal-revamp",
    name: "Customer Portal Revamp",
    clientName: "Acme Retail Group",
    teams: ["React Team"],
    assignedDate: "2026-04-01",
    lastDate: "2026-06-30",
    status: "In Progress",
    description: "Modernize the customer-facing portal with React 19 and improved UX.",
    memberIds: ["1", "7"],
  },
  {
    id: "p2",
    slug: "design-system-2-0",
    name: "Design System 2.0",
    clientName: "Colan Internal",
    teams: ["UI/UX Team"],
    assignedDate: "2026-03-15",
    lastDate: "2026-05-20",
    status: "In Progress",
    description: "Unified tokens, components, and documentation for all product teams.",
    memberIds: ["4"],
  },
  {
    id: "p3",
    slug: "api-gateway-migration",
    name: "API Gateway Migration",
    clientName: "Northwind Logistics",
    teams: ["Node Team"],
    assignedDate: "2026-01-10",
    lastDate: "2026-04-28",
    status: "Completed",
    description: "Migrate legacy gateways to the new Node-based edge layer.",
    memberIds: ["3"],
  },
  {
    id: "p4",
    slug: "observability-stack",
    name: "Observability Stack",
    teams: ["DevOps Team"],
    assignedDate: "2026-02-01",
    lastDate: "2026-07-15",
    status: "Yet To Start",
    description: "Metrics, logs, and tracing rollout for production services.",
    memberIds: ["6"],
  },
  {
    id: "p5",
    slug: "e2e-automation-suite",
    name: "E2E Automation Suite",
    teams: ["Testing Team"],
    assignedDate: "2026-04-20",
    lastDate: "2026-08-01",
    status: "In Progress",
    description: "Playwright-based regression suite for critical user journeys.",
    memberIds: ["5"],
  },
  {
    id: "p6",
    slug: "app-router-migration",
    name: "App Router Migration",
    teams: ["Next.js Team", "DevOps Team"],
    assignedDate: "2025-11-01",
    lastDate: "2026-03-01",
    status: "Completed",
    description: "Complete migration from Pages Router to App Router.",
    memberIds: ["2", "8"],
  },
];

const gallery = (id: number, title: string) =>
  `https://picsum.photos/seed/colan${id}/800/${500 + (id % 3) * 100}`;

export const MOCK_GALLERY: GalleryImage[] = [
  {
    id: "g1",
    url: gallery(1, "Town hall"),
    title: "Q1 Town Hall",
    caption: "Leadership keynote",
    uploadedAt: "2026-04-02",
  },
  {
    id: "g2",
    url: gallery(2, "Hackathon"),
    title: "Internal Hackathon",
    uploadedAt: "2026-03-18",
  },
  {
    id: "g3",
    url: gallery(3, "Team lunch"),
    title: "Engineering Lunch",
    caption: "Next.js Team",
    uploadedAt: "2026-03-05",
  },
  {
    id: "g4",
    url: gallery(4, "Workshop"),
    title: "Design Workshop",
    uploadedAt: "2026-02-22",
  },
  {
    id: "g5",
    url: gallery(5, "Offsite"),
    title: "Leadership Offsite",
    uploadedAt: "2026-01-12",
  },
  {
    id: "g6",
    url: gallery(6, "Celebration"),
    title: "Ship Week Celebration",
    uploadedAt: "2025-12-20",
  },
];

export function projectStats(projects: Project[]) {
  const inProgress = projects.filter((p) => p.status === "In Progress").length;
  const completed = projects.filter((p) => p.status === "Completed").length;
  const yetToStart = projects.filter((p) => p.status === "Yet To Start").length;
  return { inProgress, completed, yetToStart, total: projects.length };
}

export function monthlyProjectTrend() {
  return [
    { month: "Jan", started: 2, completed: 1 },
    { month: "Feb", started: 3, completed: 2 },
    { month: "Mar", started: 4, completed: 3 },
    { month: "Apr", started: 5, completed: 2 },
    { month: "May", started: 3, completed: 4 },
  ];
}
