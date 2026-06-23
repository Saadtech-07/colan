"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  buildAccessContext,
  normalizeAppRole,
  roleNeedsTeam,
  type AccessContext,
} from "@/lib/permissions";
import { hydrateRoleRegistry } from "@/lib/role-registry";
import { resolveProfileImageSrc } from "@/lib/profile-image";
import { sanitizeSessionImageUrl } from "@/lib/session-token";
import { loggedFetch } from "@/lib/logged-fetch";
import type { TeamDTO, TeamUpsertInput, WorkspaceRole } from "@/models";
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
  /** Apply profile fields already loaded elsewhere (no network). */
  applyProfileSnapshot: (profile: ProfileSessionSync & { imageUrl?: string }) => Promise<void>;
  /** Load profile image from the server (session omits large data URLs). */
  refreshProfileAvatar: () => Promise<void>;
  addEmployee: (input: Omit<Employee, "id">) => Promise<void>;
  addProject: (input: Omit<Project, "id" | "slug">) => Promise<Project>;
  addWorkspaceTeam: (input: TeamUpsertInput) => Promise<void>;
  updateWorkspaceTeam: (id: string, input: TeamUpsertInput) => Promise<TeamDTO>;
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
    const fe = j.issues?.fieldErrors;
    if (fe && typeof fe === "object") {
      const parts = Object.entries(fe).flatMap(([k, arr]) =>
        (Array.isArray(arr) ? arr : []).map((msg) => `${k}: ${msg}`),
      );
      if (parts.length) return parts.join("; ");
    }
    const form = j.issues?.formErrors;
    if (Array.isArray(form) && form.length) return form.join("; ");
    if (j.error) return j.error;
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
  const workspaceLoadIdRef = React.useRef(0);
  const lastKnownUserRef = React.useRef<AuthUser | null>(null);
  const sessionUserRef = React.useRef(session?.user);
  const profileRefreshInFlightRef = React.useRef(false);
  const lastSessionSyncKeyRef = React.useRef<string | null>(null);

  sessionUserRef.current = session?.user;

  const sessionTeamForRole = React.useCallback(
    (appRole: string, team?: string | null) =>
      roleNeedsTeam(appRole) && team ? team : undefined,
    [],
  );

  const syncSessionFromProfile = React.useCallback(
    async (profile: ProfileSessionSync) => {
      const current = sessionUserRef.current;
      if (!current?.email) return;

      const nextRole = normalizeAppRole(profile.appRole);
      const currentRole = normalizeAppRole(current.appRole);
      const nextTeam = sessionTeamForRole(profile.appRole, profile.team);
      const currentTeam = sessionTeamForRole(current.appRole, current.team);
      const profileComplete = profile.isProfileCompleted !== false;
      const sessionComplete = current.isProfileCompleted !== false;
      const syncKey = JSON.stringify({
        name: profile.name.trim(),
        role: nextRole,
        team: nextTeam ?? "",
        profileComplete,
      });

      if (
        profile.name.trim() === (current.name ?? "").trim() &&
        nextRole === currentRole &&
        nextTeam === currentTeam &&
        profileComplete === sessionComplete
      ) {
        lastSessionSyncKeyRef.current = syncKey;
        return;
      }

      if (lastSessionSyncKeyRef.current === syncKey) return;
      lastSessionSyncKeyRef.current = syncKey;

      await updateSession({
        name: profile.name,
        appRole: profile.appRole,
        team: nextTeam,
        isProfileCompleted: profile.isProfileCompleted,
      });
    },
    [sessionTeamForRole, updateSession],
  );

  const applyProfileSnapshot = React.useCallback(
    async (profile: ProfileSessionSync & { imageUrl?: string }) => {
      const nextAvatar = resolveProfileImageSrc(profile?.imageUrl);
      setProfileAvatarUrl((prev) => (prev === nextAvatar ? prev : nextAvatar));
      await syncSessionFromProfile(profile);
    },
    [syncSessionFromProfile],
  );

  const refreshProfileAvatar = React.useCallback(async () => {
    if (sessionStatus !== "authenticated") {
      setProfileAvatarUrl(undefined);
      return;
    }
    if (profileRefreshInFlightRef.current) return;

    profileRefreshInFlightRef.current = true;
    try {
      const res = await loggedFetch(
        "/api/profile-settings",
        {
          credentials: "include",
          cache: "no-store",
          source: "AppStateProvider.refreshProfileAvatar (explicit)",
        },
      );
      if (!res.ok) {
        setProfileAvatarUrl(undefined);
        return;
      }
      const profile = (await res.json()) as ProfileSessionSync & { imageUrl?: string };
      await applyProfileSnapshot(profile);
    } catch {
      setProfileAvatarUrl(undefined);
    } finally {
      profileRefreshInFlightRef.current = false;
    }
  }, [applyProfileSnapshot, sessionStatus]);

  const profileSessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";

  React.useEffect(() => {
    if (sessionStatus !== "authenticated" || !profileSessionEmail) {
      setProfileAvatarUrl(undefined);
      lastSessionSyncKeyRef.current = null;
      return;
    }

    void refreshProfileAvatar();
  }, [profileSessionEmail, refreshProfileAvatar, sessionStatus]);

  const linkedEmployeeAvatar = React.useMemo(() => {
    if (!session?.user?.email) return undefined;
    const normalized = session.user.email.toLowerCase();
    const employee = employees.find(
      (item) =>
        item.email?.toLowerCase() === normalized ||
        item.directory?.workEmail?.toLowerCase() === normalized,
    );
    return resolveProfileImageSrc(employee?.imageUrl);
  }, [employees, session?.user?.email]);

  const user = React.useMemo<AuthUser | null>(() => {
    if (!session?.user) {
      if (sessionStatus === "loading" && lastKnownUserRef.current) {
        return lastKnownUserRef.current;
      }
      lastKnownUserRef.current = null;
      return null;
    }
    const u = session.user;
    const email = u.email ?? "";
    const sessionAvatar = sanitizeSessionImageUrl(u.image);
    const next: AuthUser = {
      id: u.id ?? email,
      name: u.name ?? "",
      email,
      appRole: normalizeAppRole(u.appRole),
      team: u.team,
      avatarUrl: profileAvatarUrl ?? sessionAvatar ?? linkedEmployeeAvatar,
      isProfileCompleted: u.isProfileCompleted !== false,
    };
    lastKnownUserRef.current = next;
    return next;
  }, [linkedEmployeeAvatar, profileAvatarUrl, session?.user, sessionStatus]);

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

  const applyWorkspacePayload = React.useCallback(
    (
      em: Employee[],
      pr: Project[],
      ga: GalleryImage[],
      te: TeamDTO[],
      ro: WorkspaceRole[],
      email: string,
    ) => {
      setEmployees(em);
      setProjects(pr);
      setGallery(ga);
      setWorkspaceTeams(te);
      setWorkspaceRoles(ro);
      hydrateRoleRegistry(ro);
      hydratedForEmailRef.current = email;
      setDataLoading(false);
    },
    [],
  );

  const fetchWorkspaceData = React.useCallback(async () => {
    // Load roles before projects so server permission checks are not racing
    // with /api/roles clearing the in-memory role registry.
    const roRes = await fetch("/api/roles", { credentials: "include" });
    let ro: WorkspaceRole[] = [];
    if (roRes.ok) {
      ro = (await roRes.json()) as WorkspaceRole[];
      hydrateRoleRegistry(ro);
    } else if (roRes.status !== 403) {
      throw new Error(await parseApiError(roRes));
    }

    const [emRes, prRes, gaRes, teRes, sumRes] = await Promise.all([
      fetch("/api/employees", { credentials: "include" }),
      fetch("/api/projects", { credentials: "include" }),
      fetch("/api/gallery", { credentials: "include" }),
      fetch("/api/teams", { credentials: "include" }),
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

    const [em, pr, ga, te] = await Promise.all([
      emRes.json() as Promise<Employee[]>,
      prRes.json() as Promise<Project[]>,
      gaRes.json() as Promise<GalleryImage[]>,
      teRes.json() as Promise<TeamDTO[]>,
    ]);
    return { em, pr, ga, te, ro };
  }, []);

  const refreshData = React.useCallback(async () => {
    if (sessionStatus !== "authenticated") return;
    const email = session?.user?.email?.trim().toLowerCase() ?? "";
    if (!email) return;

    const isInitialHydration = hydratedForEmailRef.current !== email;
    const loadId = ++workspaceLoadIdRef.current;
    if (isInitialHydration) {
      setDataLoading(true);
    }
    setDataError(null);
    try {
      const { em, pr, ga, te, ro } = await fetchWorkspaceData();
      if (workspaceLoadIdRef.current !== loadId) return;
      applyWorkspacePayload(em, pr, ga, te, ro, email);
    } catch (e) {
      if (workspaceLoadIdRef.current !== loadId) return;
      setDataError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      if (workspaceLoadIdRef.current === loadId && isInitialHydration) {
        setDataLoading(false);
      }
    }
  }, [
    applyWorkspacePayload,
    fetchWorkspaceData,
    session?.user?.email,
    sessionStatus,
  ]);

  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";

  React.useEffect(() => {
    if (!sessionEmail) {
      workspaceLoadIdRef.current += 1;
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

    const loadId = ++workspaceLoadIdRef.current;
    setDataLoading(true);
    setDataError(null);
    void (async () => {
      try {
        const { em, pr, ga, te, ro } = await fetchWorkspaceData();
        if (workspaceLoadIdRef.current !== loadId) return;
        applyWorkspacePayload(em, pr, ga, te, ro, sessionEmail);
        if (
          pr.length === 0 &&
          normalizeAppRole(sessionUserRef.current?.appRole).toLowerCase() === "admin"
        ) {
          const retryRes = await fetch("/api/projects", { credentials: "include" });
          if (retryRes.ok && workspaceLoadIdRef.current === loadId) {
            const retryProjects = (await retryRes.json()) as Project[];
            if (retryProjects.length > 0) {
              setProjects(retryProjects);
            }
          }
        }
      } catch (e) {
        if (workspaceLoadIdRef.current !== loadId) return;
        setDataError(e instanceof Error ? e.message : "Failed to load data");
      } finally {
        if (workspaceLoadIdRef.current === loadId) {
          setDataLoading(false);
        }
      }
    })();
  }, [applyWorkspacePayload, fetchWorkspaceData, sessionEmail]);

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

  const addWorkspaceTeam = React.useCallback(async (input: TeamUpsertInput) => {
    const res = await fetch("/api/teams", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const created = (await res.json()) as TeamDTO;
    setWorkspaceTeams((prev) =>
      [...prev, created].sort((a, b) => a.displayOrder - b.displayOrder),
    );
  }, []);

  const updateWorkspaceTeam = React.useCallback(async (id: string, input: TeamUpsertInput) => {
    const res = await fetch(`/api/teams/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
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
      applyProfileSnapshot,
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
      applyProfileSnapshot,
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
