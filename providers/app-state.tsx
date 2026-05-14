"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type { AuthUser, Employee, GalleryImage, Project } from "@/types";

type AppStateContextValue = {
  user: AuthUser | null;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  logout: () => Promise<void>;
  isAdmin: boolean;
  employees: Employee[];
  projects: Project[];
  gallery: GalleryImage[];
  dataLoading: boolean;
  dataError: string | null;
  refreshData: () => Promise<void>;
  addEmployee: (input: Omit<Employee, "id">) => Promise<void>;
  addProject: (input: Omit<Project, "id">) => Promise<void>;
  addGalleryItem: (input: Omit<GalleryImage, "id">) => Promise<void>;
  assignEmployeeToBay: (bayId: string, employeeId: string | null) => Promise<void>;
};

const AppStateContext = React.createContext<AppStateContextValue | null>(null);

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status: sessionStatus } = useSession();

  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [gallery, setGallery] = React.useState<GalleryImage[]>([]);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);

  const user = React.useMemo<AuthUser | null>(() => {
    if (!session?.user) return null;
    const u = session.user;
    return {
      id: u.id ?? u.email ?? "",
      name: u.name ?? "",
      email: u.email ?? "",
      appRole: u.appRole,
      team: u.team,
      avatarUrl: u.image ?? undefined,
    };
  }, [session?.user]);

  const isAdmin = user?.appRole === "admin";

  const refreshData = React.useCallback(async () => {
    if (sessionStatus !== "authenticated") return;
    setDataLoading(true);
    setDataError(null);
    try {
      const [emRes, prRes, gaRes] = await Promise.all([
        fetch("/api/employees", { credentials: "include" }),
        fetch("/api/projects", { credentials: "include" }),
        fetch("/api/gallery", { credentials: "include" }),
      ]);
      if (!emRes.ok) throw new Error(await parseError(emRes));
      if (!prRes.ok) throw new Error(await parseError(prRes));
      if (!gaRes.ok) throw new Error(await parseError(gaRes));
      const [em, pr, ga] = await Promise.all([
        emRes.json() as Promise<Employee[]>,
        prRes.json() as Promise<Project[]>,
        gaRes.json() as Promise<GalleryImage[]>,
      ]);
      setEmployees(em);
      setProjects(pr);
      setGallery(ga);
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setDataLoading(false);
    }
  }, [sessionStatus]);

  React.useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const logout = React.useCallback(async () => {
    await signOut({ callbackUrl: "/login" });
  }, []);

  const addEmployee = React.useCallback(
    async (input: Omit<Employee, "id">) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const created = (await res.json()) as Employee;
      setEmployees((prev) => [...prev, created]);
    },
    [],
  );

  const addProject = React.useCallback(async (input: Omit<Project, "id">) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const created = (await res.json()) as Project;
    setProjects((prev) => [...prev, created]);
  }, []);

  const addGalleryItem = React.useCallback(
    async (input: Omit<GalleryImage, "id">) => {
      const res = await fetch("/api/gallery", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const created = (await res.json()) as GalleryImage;
      setGallery((prev) => [created, ...prev]);
    },
    [],
  );

  const assignEmployeeToBay = React.useCallback(
    async (bayId: string, employeeId: string | null) => {
      const res = await fetch("/api/employees", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bayId, employeeId }),
      });
      if (!res.ok) throw new Error(await parseError(res));
      const next = (await res.json()) as Employee[];
      setEmployees(next);
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      user,
      sessionStatus,
      logout,
      isAdmin,
      employees,
      projects,
      gallery,
      dataLoading,
      dataError,
      refreshData,
      addEmployee,
      addProject,
      addGalleryItem,
      assignEmployeeToBay,
    }),
    [
      user,
      sessionStatus,
      logout,
      isAdmin,
      employees,
      projects,
      gallery,
      dataLoading,
      dataError,
      refreshData,
      addEmployee,
      addProject,
      addGalleryItem,
      assignEmployeeToBay,
    ],
  );

  return (
    <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = React.useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within AppStateProvider");
  }
  return ctx;
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { sessionStatus } = useAppState();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (sessionStatus === "unauthenticated" && pathname !== "/login") {
      router.replace("/login");
    }
  }, [sessionStatus, pathname, router]);

  if (sessionStatus === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (sessionStatus === "unauthenticated") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return <>{children}</>;
}
