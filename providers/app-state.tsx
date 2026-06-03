"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { buildAccessContext, normalizeAppRole, type AccessContext } from "@/lib/permissions";
import { hydrateRoleRegistry } from "@/lib/role-registry";
import { sanitizeSessionImageUrl } from "@/lib/session-token";
import type { TeamDTO, WorkspaceRole } from "@/models";
import type { AuthUser, Employee, GalleryImage, Project } from "@/types";
import type { DataLayerSummary } from "@/types/data-layer";

type AppStateContextValue = {
  user: AuthUser | null;
  access: AccessContext | null;
  sessionStatus: "loading" | "authenticated" | "unauthenticated";
  logout: () => Promise<void>;
  isAdmin: boolean;
  employees: Employee[];
  projects: Project[];
  gallery: GalleryImage[];
  workspaceTeams: TeamDTO[];
  workspaceRoles: WorkspaceRole[];
  /** Squad names sorted for tabs and selects. */
  teamNames: string[];
  canManageRoles: boolean;
  refreshWorkspaceRoles: () => Promise<void>;
  dataLoading: boolean;
  dataError: string | null;
  /** Where workspace data is stored (MongoDB vs in-memory) and Atlas ping result. */
  dataSummary: DataLayerSummary | null;
  refreshData: () => Promise<void>;
  refreshProfileAvatar: () => Promise<void>;
  addEmployee: (input: Omit<Employee, "id">) => Promise<void>;
  addProject: (input: Omit<Project, "id" | "slug">) => Promise<Project>;
  addWorkspaceTeam: (name: string) => Promise<void>;
  updateWorkspaceTeam: (id: string, name: string) => Promise<TeamDTO>;
  deleteWorkspaceTeam: (id: string) => Promise<void>;
  addGalleryItem: (input: Omit<GalleryImage, "id">) => Promise<void>;
  assignEmployeeToBay: (bayId: string, employeeId: string | null) => Promise<void>;
};

const AppStateContext = React.createContext<AppStateContextValue | null>(null);

export async function parseApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as {
      error?: string;
      issues?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
    };
    if (j.error) return j.error;
    const fe = j.issues?.fieldErrors;
    if (fe && typeof fe === "object") {
      const parts = Object.entries(fe).flatMap(([k, arr]) =>
        (Array.isArray(arr) ? arr : []).map((msg) => `${k}: ${msg}`),
      );
      if (parts.length) return parts.join("; ");
    }
    const form = j.issues?.formErrors;
    if (Array.isArray(form) && form.length) return form.join("; ");
    return res.statusText;
  } catch {
    return res.statusText;
  }
}

type ProfileSessionSync = {
  name: string;
  appRole: string;
  team?: string;
  isProfileCompleted: boolean;
};

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status: sessionStatus, update: updateSession } = useSession();

  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [gallery, setGallery] = React.useState<GalleryImage[]>([]);
  const [workspaceTeams, setWorkspaceTeams] = React.useState<TeamDTO[]>([]);
  const [workspaceRoles, setWorkspaceRoles] = React.useState<WorkspaceRole[]>([]);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);
  const [dataSummary, setDataSummary] = React.useState<DataLayerSummary | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState<string | undefined>();
  const hydratedForEmailRef = React.useRef<string | null>(null);

  const syncSessionFromProfile = React.useCallback(
    async (profile: ProfileSessionSync) => {
      const current = session?.user;
      if (!current?.email) return;

      const nextRole = normalizeAppRole(profile.appRole);
      const currentRole = normalizeAppRole(current.appRole);
      const profileComplete = profile.isProfileCompleted !== false;
      const sessionComplete = current.isProfileCompleted !== false;

      if (
        profile.name === (current.name ?? "") &&
        nextRole === currentRole &&
        (profile.team ?? undefined) === (current.team ?? undefined) &&
        profileComplete === sessionComplete
      ) {
        return;
      }

      await updateSession({
        name: profile.name,
        appRole: profile.appRole,
        team: profile.team,
        isProfileCompleted: profile.isProfileCompleted,
      });
    },
    [session?.user, updateSession],
  );

  const refreshProfileAvatar = React.useCallback(async () => {
    if (sessionStatus !== "authenticated") {
      setProfileAvatarUrl(undefined);
      return;
    }

    try {
      const res = await fetch("/api/profile-settings", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setProfileAvatarUrl(undefined);
        return;
      }
      const profile = (await res.json()) as ProfileSessionSync & { imageUrl?: string };
      setProfileAvatarUrl(profile?.imageUrl?.trim() || undefined);
      await syncSessionFromProfile(profile);
    } catch {
      setProfileAvatarUrl(undefined);
    }
  }, [sessionStatus, syncSessionFromProfile]);

  React.useEffect(() => {
    if (sessionStatus !== "authenticated" || !session?.user?.email) {
      setProfileAvatarUrl(undefined);
      return;
    }

    void refreshProfileAvatar();

    const refresh = () => {
      void refreshProfileAvatar();
    };
    window.addEventListener("focus", refresh);
    const interval = window.setInterval(refresh, 30_000);

    return () => {
      window.removeEventListener("focus", refresh);
      window.clearInterval(interval);
    };
  }, [refreshProfileAvatar, session?.user?.email, sessionStatus]);

  const user = React.useMemo<AuthUser | null>(() => {
    if (!session?.user) return null;
    const u = session.user;
    const email = u.email ?? "";
    const sessionAvatar = sanitizeSessionImageUrl(u.image);
    return {
      id: u.id ?? email,
      name: u.name ?? "",
      email,
      appRole: normalizeAppRole(u.appRole),
      team: u.team,
      avatarUrl: profileAvatarUrl ?? sessionAvatar,
      isProfileCompleted: u.isProfileCompleted !== false,
    };
  }, [profileAvatarUrl, session?.user]);

  const access = React.useMemo(
    () => (user ? buildAccessContext(user.appRole, user.team) : null),
    [user, workspaceRoles],
  );

  const isAdmin = access?.canManage("appUsers") ?? false;
  const canManageRoles = access?.canManage("roles") ?? false;

  const teamNames = React.useMemo(
    () => workspaceTeams.map((t) => t.name),
    [workspaceTeams],
  );

  const refreshData = React.useCallback(async () => {
    if (sessionStatus !== "authenticated") return;
    setDataLoading(true);
    setDataError(null);
    try {
      const [emRes, prRes, gaRes, teRes, roRes, sumRes] = await Promise.all([
        fetch("/api/employees", { credentials: "include" }),
        fetch("/api/projects", { credentials: "include" }),
        fetch("/api/gallery", { credentials: "include" }),
        fetch("/api/teams", { credentials: "include" }),
        fetch("/api/roles", { credentials: "include" }),
        fetch("/api/db-status", { credentials: "include" }),
      ]);
      if (sumRes.ok) {
        setDataSummary((await sumRes.json()) as DataLayerSummary);
      } else {
        setDataSummary(null);
      }
      if (!emRes.ok) throw new Error(await parseApiError(emRes));
      if (!prRes.ok) throw new Error(await parseApiError(prRes));
      if (!gaRes.ok) throw new Error(await parseApiError(gaRes));
      if (!teRes.ok) throw new Error(await parseApiError(teRes));
      if (!roRes.ok) throw new Error(await parseApiError(roRes));
      const [em, pr, ga, te, ro] = await Promise.all([
        emRes.json() as Promise<Employee[]>,
        prRes.json() as Promise<Project[]>,
        gaRes.json() as Promise<GalleryImage[]>,
        teRes.json() as Promise<TeamDTO[]>,
        roRes.json() as Promise<WorkspaceRole[]>,
      ]);
      setEmployees(em);
      setProjects(pr);
      setGallery(ga);
      setWorkspaceTeams(te);
      setWorkspaceRoles(ro);
      hydrateRoleRegistry(ro);
      hydratedForEmailRef.current = session?.user?.email?.trim().toLowerCase() ?? null;
    } catch (e) {
      setDataError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setDataLoading(false);
    }
  }, [session?.user?.email, sessionStatus]);

  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";

  React.useEffect(() => {
    if (!sessionEmail) {
      hydratedForEmailRef.current = null;
      setEmployees([]);
      setProjects([]);
      setGallery([]);
      setWorkspaceTeams([]);
      setWorkspaceRoles([]);
      setDataSummary(null);
      setDataError(null);
      setDataLoading(false);
      return;
    }
    if (hydratedForEmailRef.current === sessionEmail) return;

    let cancelled = false;
    void (async () => {
      setDataLoading(true);
      setDataError(null);
      try {
        const [emRes, prRes, gaRes, teRes, roRes, sumRes] = await Promise.all([
          fetch("/api/employees", { credentials: "include" }),
          fetch("/api/projects", { credentials: "include" }),
          fetch("/api/gallery", { credentials: "include" }),
          fetch("/api/teams", { credentials: "include" }),
          fetch("/api/roles", { credentials: "include" }),
          fetch("/api/db-status", { credentials: "include" }),
        ]);
        if (cancelled) return;
        if (sumRes.ok) {
          setDataSummary((await sumRes.json()) as DataLayerSummary);
        } else {
          setDataSummary(null);
        }
        if (!emRes.ok) throw new Error(await parseApiError(emRes));
        if (!prRes.ok) throw new Error(await parseApiError(prRes));
        if (!gaRes.ok) throw new Error(await parseApiError(gaRes));
        if (!teRes.ok) throw new Error(await parseApiError(teRes));
        if (!roRes.ok) throw new Error(await parseApiError(roRes));
        const [em, pr, ga, te, ro] = await Promise.all([
          emRes.json() as Promise<Employee[]>,
          prRes.json() as Promise<Project[]>,
          gaRes.json() as Promise<GalleryImage[]>,
          teRes.json() as Promise<TeamDTO[]>,
          roRes.json() as Promise<WorkspaceRole[]>,
        ]);
        if (cancelled) return;
        setEmployees(em);
        setProjects(pr);
        setGallery(ga);
        setWorkspaceTeams(te);
        setWorkspaceRoles(ro);
        hydrateRoleRegistry(ro);
        hydratedForEmailRef.current = sessionEmail;
      } catch (e) {
        if (cancelled) return;
        setDataError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionEmail]);

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
      if (!res.ok) throw new Error(await parseApiError(res));
      const created = (await res.json()) as Employee;
      setEmployees((prev) => [...prev, created]);
    },
    [],
  );

  const refreshWorkspaceRoles = React.useCallback(async () => {
    const res = await fetch("/api/roles", { credentials: "include" });
    if (!res.ok) throw new Error(await parseApiError(res));
    const roles = (await res.json()) as WorkspaceRole[];
    setWorkspaceRoles(roles);
    hydrateRoleRegistry(roles);
  }, []);

  const addWorkspaceTeam = React.useCallback(async (name: string) => {
    const res = await fetch("/api/teams", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const created = (await res.json()) as TeamDTO;
    setWorkspaceTeams((prev) =>
      [...prev, created].sort((a, b) => a.displayOrder - b.displayOrder),
    );
  }, []);

  const updateWorkspaceTeam = React.useCallback(async (id: string, name: string) => {
    const res = await fetch(`/api/teams/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const updated = (await res.json()) as TeamDTO;
    setWorkspaceTeams((prev) =>
      prev
        .map((team) => (team.id === id ? updated : team))
        .sort((a, b) => a.displayOrder - b.displayOrder),
    );
    return updated;
  }, []);

  const deleteWorkspaceTeam = React.useCallback(async (id: string) => {
    const res = await fetch(`/api/teams/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    setWorkspaceTeams((prev) => prev.filter((team) => team.id !== id));
  }, []);

  const addProject = React.useCallback(async (input: Omit<Project, "id" | "slug">) => {
    const res = await fetch("/api/projects", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const created = (await res.json()) as Project;
    setProjects((prev) => [...prev, created]);
    return created;
  }, []);

  const addGalleryItem = React.useCallback(
    async (input: Omit<GalleryImage, "id">) => {
      const res = await fetch("/api/gallery", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
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
      if (!res.ok) throw new Error(await parseApiError(res));
      const next = (await res.json()) as Employee[];
      setEmployees(next);
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      user,
      access,
      sessionStatus,
      logout,
      isAdmin,
      employees,
      projects,
      gallery,
      workspaceTeams,
      workspaceRoles,
      teamNames,
      canManageRoles,
      refreshWorkspaceRoles,
      dataLoading,
      dataError,
      dataSummary,
      refreshData,
      refreshProfileAvatar,
      addEmployee,
      addProject,
      addWorkspaceTeam,
      updateWorkspaceTeam,
      deleteWorkspaceTeam,
      addGalleryItem,
      assignEmployeeToBay,
    }),
    [
      user,
      access,
      sessionStatus,
      logout,
      isAdmin,
      employees,
      projects,
      gallery,
      workspaceTeams,
      workspaceRoles,
      teamNames,
      canManageRoles,
      refreshWorkspaceRoles,
      dataLoading,
      dataError,
      dataSummary,
      refreshData,
      refreshProfileAvatar,
      addEmployee,
      addProject,
      addWorkspaceTeam,
      updateWorkspaceTeam,
      deleteWorkspaceTeam,
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
  const { sessionStatus, user } = useAppState();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (sessionStatus === "unauthenticated" && pathname !== "/login") {
      router.replace("/login");
    }
  }, [sessionStatus, pathname, router]);

  if (sessionStatus === "unauthenticated") {
    return null;
  }

  // NextAuth sets status to "loading" during session updates; keep the shell visible.
  if (sessionStatus === "loading" && !user) {
    return null;
  }

  return <>{children}</>;
}
