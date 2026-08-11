"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/auth-session-provider";
import {
  buildAccessContext,
  normalizeAppRole,
  roleNeedsTeam,
  type AccessContext,
} from "@/lib/permissions";
import { hydrateRoleRegistry } from "@/lib/role-registry";
import { resolveProfileImageSrc } from "@/lib/profile-image";
import { sanitizeSessionImageUrl } from "@/lib/session-token";
import { workspaceSlicesForPath, pathsThatWantBackgroundDbStatus } from "@/lib/workspace-route-data";
import { scheduleIdle } from "@/lib/schedule-idle";
import type { WorkspaceSlice } from "@/lib/workspace-slices";
import { fetchProfileSettings } from "@/lib/profile-settings-client";
import {
  fetchDbStatusOnce,
  fetchEmployeesOnce,
  fetchGalleryOnce,
  fetchProjectsOnce,
  fetchRolesOnce,
  fetchTeamsOnce,
  invalidateWorkspaceApiCache,
} from "@/lib/workspace-api-client";
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
  refreshWorkspaceRoles: () => Promise<WorkspaceRole[]>;
  removeWorkspaceRole: (id: string) => void;
  dataLoading: boolean;
  dataError: string | null;
  /** Where workspace data is stored (MongoDB vs in-memory) and Atlas ping result. */
  dataSummary: DataLayerSummary | null;
  refreshData: () => Promise<void>;
  /** Ensure specific workspace slices are loaded (deduped / cached per session). */
  ensureWorkspaceData: (
    slices: WorkspaceSlice[],
    opts?: { force?: boolean; silent?: boolean },
  ) => Promise<void>;
  /** Apply a project mutation result locally (no workspace re-sync overlay). */
  applyProjectUpdate: (project: Project) => void;
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
  assignEmployeeToBay: (
    bayId: string,
    employeeId: string | null,
    officeSlug?: string,
  ) => Promise<void>;
  /** Swap (or move) two seating bays on the same office plan. */
  swapEmployeeBays: (
    fromBayId: string,
    toBayId: string,
    officeSlug?: string,
  ) => Promise<void>;
  assignEmployeeToCabin: (
    cabinId: string,
    employeeId: string | null,
    officeSlug?: string,
  ) => Promise<void>;
  assignEmployeesToCabin: (
    cabinId: string,
    employeeIds: string[],
    officeSlug?: string,
  ) => Promise<void>;
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

type SliceLoadedMap = Partial<Record<WorkspaceSlice, string>>;

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session, status: sessionStatus, update: updateSession, signOut } =
    useSession();

  const [employees, setEmployees] = React.useState<Employee[]>([]);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [gallery, setGallery] = React.useState<GalleryImage[]>([]);
  const [workspaceTeams, setWorkspaceTeams] = React.useState<TeamDTO[]>([]);
  const [workspaceRoles, setWorkspaceRoles] = React.useState<WorkspaceRole[]>([]);
  const [dataLoading, setDataLoading] = React.useState(false);
  const [dataError, setDataError] = React.useState<string | null>(null);
  const [dataSummary, setDataSummary] = React.useState<DataLayerSummary | null>(null);
  const [profileAvatarUrl, setProfileAvatarUrl] = React.useState<string | undefined>();

  const sliceLoadedRef = React.useRef<SliceLoadedMap>({});
  const sliceInFlightRef = React.useRef<Partial<Record<WorkspaceSlice, Promise<void>>>>({});
  const pendingRouteLoadsRef = React.useRef(0);
  const lastKnownUserRef = React.useRef<AuthUser | null>(null);
  const sessionUserRef = React.useRef(session?.user);
  const sessionEmailRef = React.useRef("");
  const profileRefreshInFlightRef = React.useRef(false);
  const lastSessionSyncKeyRef = React.useRef<string | null>(null);
  const loadedSlicesForRefreshRef = React.useRef<Set<WorkspaceSlice>>(new Set());

  sessionUserRef.current = session?.user;
  sessionEmailRef.current = session?.user?.email?.trim().toLowerCase() ?? "";

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

    const email = sessionEmailRef.current;
    if (!email) return;

    profileRefreshInFlightRef.current = true;
    try {
      const profile = await fetchProfileSettings(email);
      await applyProfileSnapshot(profile);
    } catch {
      setProfileAvatarUrl(undefined);
    } finally {
      profileRefreshInFlightRef.current = false;
    }
  }, [applyProfileSnapshot, sessionStatus]);

  const profileSessionEmail = session?.user?.email?.trim().toLowerCase() ?? "";

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

  const markSliceLoaded = React.useCallback((slice: WorkspaceSlice, email: string) => {
    sliceLoadedRef.current[slice] = email;
    loadedSlicesForRefreshRef.current.add(slice);
  }, []);

  const loadSlice = React.useCallback(
    async (slice: WorkspaceSlice, email: string, force = false) => {
      if (!force && sliceLoadedRef.current[slice] === email) return;

      const existing = sliceInFlightRef.current[slice];
      if (existing && !force) {
        await existing;
        return;
      }

      const run = (async () => {
        switch (slice) {
          case "roles": {
            const ro = await fetchRolesOnce({ force });
            setWorkspaceRoles(ro);
            break;
          }
          case "employees": {
            setEmployees(await fetchEmployeesOnce({ force }));
            break;
          }
          case "projects": {
            let pr = await fetchProjectsOnce({ force });
            if (
              pr.length === 0 &&
              normalizeAppRole(sessionUserRef.current?.appRole).toLowerCase() === "admin"
            ) {
              // Intentional second attempt after empty result (seed race), not a duplicate init.
              const retryRes = await fetch("/api/projects", {
                credentials: "include",
              });
              if (retryRes.ok) {
                const retryProjects = (await retryRes.json()) as Project[];
                if (retryProjects.length > 0) pr = retryProjects;
              }
            }
            setProjects(pr);
            break;
          }
          case "gallery": {
            setGallery(await fetchGalleryOnce({ force }));
            break;
          }
          case "teams": {
            setWorkspaceTeams(await fetchTeamsOnce({ force }));
            break;
          }
          case "dbStatus": {
            setDataSummary(await fetchDbStatusOnce({ force }));
            break;
          }
          default:
            break;
        }
        markSliceLoaded(slice, email);
      })();

      sliceInFlightRef.current[slice] = run;
      try {
        await run;
      } finally {
        if (sliceInFlightRef.current[slice] === run) {
          delete sliceInFlightRef.current[slice];
        }
      }
    },
    [markSliceLoaded],
  );

  const ensureWorkspaceData = React.useCallback(
    async (slices: WorkspaceSlice[], opts?: { force?: boolean; silent?: boolean }) => {
      if (sessionStatus !== "authenticated") return;
      const email = sessionEmailRef.current;
      if (!email) return;

      const unique = Array.from(new Set(slices));
      const needed = opts?.force
        ? unique
        : unique.filter((slice) => sliceLoadedRef.current[slice] !== email);

      if (needed.length === 0) return;

      const ordered: WorkspaceSlice[] = needed.includes("roles")
        ? ["roles", ...needed.filter((s) => s !== "roles")]
        : needed;

      const silent = opts?.silent === true;
      if (!silent) {
        pendingRouteLoadsRef.current += 1;
        setDataLoading(true);
        setDataError(null);
      }
      try {
        for (const slice of ordered.filter((s) => s === "roles")) {
          await loadSlice(slice, email, opts?.force);
        }
        await Promise.all(
          ordered.filter((s) => s !== "roles").map((slice) => loadSlice(slice, email, opts?.force)),
        );
      } catch (e) {
        if (!silent) {
          setDataError(e instanceof Error ? e.message : "Failed to load data");
        }
      } finally {
        if (!silent) {
          pendingRouteLoadsRef.current = Math.max(0, pendingRouteLoadsRef.current - 1);
          if (pendingRouteLoadsRef.current === 0) {
            setDataLoading(false);
          }
        }
      }
    },
    [loadSlice, sessionStatus],
  );

  const refreshData = React.useCallback(async () => {
    if (sessionStatus !== "authenticated") return;
    const email = sessionEmailRef.current;
    if (!email) return;

    const routeSlices = workspaceSlicesForPath(pathname);
    const loaded = Array.from(loadedSlicesForRefreshRef.current);
    const slices = Array.from(new Set([...routeSlices, ...loaded]));
    await ensureWorkspaceData(slices, { force: true });
  }, [ensureWorkspaceData, pathname, sessionStatus]);

  const sessionEmail = sessionEmailRef.current;

  React.useEffect(() => {
    const email = session?.user?.email?.trim().toLowerCase() ?? "";
    sessionEmailRef.current = email;

    if (!email) {
      sliceLoadedRef.current = {};
      sliceInFlightRef.current = {};
      loadedSlicesForRefreshRef.current = new Set();
      pendingRouteLoadsRef.current = 0;
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

    const slices = workspaceSlicesForPath(pathname);
    void (async () => {
      await ensureWorkspaceData(slices);
      if (pathsThatWantBackgroundDbStatus(pathname)) {
        void ensureWorkspaceData(["dbStatus"], { silent: true });
      }
    })();
  }, [ensureWorkspaceData, pathname, session?.user?.email]);

  React.useEffect(() => {
    if (sessionStatus !== "authenticated" || !profileSessionEmail) {
      setProfileAvatarUrl(undefined);
      lastSessionSyncKeyRef.current = null;
      return;
    }

    // Defer avatar fetch so roles/employees/projects can win the first network wave.
    return scheduleIdle(() => {
      void refreshProfileAvatar();
    }, 2_000);
  }, [profileSessionEmail, refreshProfileAvatar, sessionStatus]);

  const logout = React.useCallback(async () => {
    await signOut({ callbackUrl: "/login" });
  }, [signOut]);

  const addEmployee = React.useCallback(async (input: Omit<Employee, "id">) => {
    const res = await fetch("/api/employees", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const created = (await res.json()) as Employee;
    setEmployees((prev) => [...prev, created]);
  }, []);

  const refreshWorkspaceRoles = React.useCallback(async () => {
    const roles = await fetchRolesOnce({ force: true });
    setWorkspaceRoles(roles);
    const email = sessionEmailRef.current;
    if (email) markSliceLoaded("roles", email);
    return roles;
  }, [markSliceLoaded]);

  const removeWorkspaceRole = React.useCallback((id: string) => {
    setWorkspaceRoles((prev) => {
      const next = prev.filter((role) => role.id !== id);
      hydrateRoleRegistry(next);
      return next;
    });
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

  const applyProjectUpdate = React.useCallback((project: Project) => {
    invalidateWorkspaceApiCache("workspace:GET:/api/projects");
    setProjects((prev) => {
      const index = prev.findIndex((entry) => entry.id === project.id);
      if (index === -1) return [...prev, project];
      const next = [...prev];
      next[index] = { ...next[index], ...project };
      return next;
    });
  }, []);

  const addGalleryItem = React.useCallback(async (input: Omit<GalleryImage, "id">) => {
    const res = await fetch("/api/gallery", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(await parseApiError(res));
    const created = (await res.json()) as GalleryImage;
    setGallery((prev) => [created, ...prev]);
  }, []);

  const assignEmployeeToBay = React.useCallback(
    async (bayId: string, employeeId: string | null, officeSlug?: string) => {
      const res = await fetch("/api/employees", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bayId, employeeId, officeSlug }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const next = (await res.json()) as Employee[];
      setEmployees(next);
    },
    [],
  );

  const swapEmployeeBays = React.useCallback(
    async (fromBayId: string, toBayId: string, officeSlug?: string) => {
      const res = await fetch("/api/employees", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          swapBayIds: [fromBayId, toBayId],
          officeSlug,
        }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const next = (await res.json()) as Employee[];
      setEmployees(next);
    },
    [],
  );

  const assignEmployeeToCabin = React.useCallback(
    async (cabinId: string, employeeId: string | null, officeSlug?: string) => {
      const res = await fetch("/api/employees", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cabinId, employeeId, officeSlug }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const next = (await res.json()) as Employee[];
      setEmployees(next);
    },
    [],
  );

  const assignEmployeesToCabin = React.useCallback(
    async (cabinId: string, employeeIds: string[], officeSlug?: string) => {
      const res = await fetch("/api/employees", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cabinId, employeeIds, officeSlug }),
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
      removeWorkspaceRole,
      dataLoading,
      dataError,
      dataSummary,
      refreshData,
      ensureWorkspaceData,
      applyProjectUpdate,
      applyProfileSnapshot,
      refreshProfileAvatar,
      addEmployee,
      addProject,
      addWorkspaceTeam,
      updateWorkspaceTeam,
      deleteWorkspaceTeam,
      addGalleryItem,
      assignEmployeeToBay,
      swapEmployeeBays,
      assignEmployeeToCabin,
      assignEmployeesToCabin,
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
      removeWorkspaceRole,
      dataLoading,
      dataError,
      dataSummary,
      refreshData,
      ensureWorkspaceData,
      applyProjectUpdate,
      applyProfileSnapshot,
      refreshProfileAvatar,
      addEmployee,
      addProject,
      addWorkspaceTeam,
      updateWorkspaceTeam,
      deleteWorkspaceTeam,
      addGalleryItem,
      assignEmployeeToBay,
      swapEmployeeBays,
      assignEmployeeToCabin,
      assignEmployeesToCabin,
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

/** Ensure workspace slices for the current feature (deduped by AppState). */
export function useEnsureWorkspaceData(slices: WorkspaceSlice[]) {
  const { ensureWorkspaceData } = useAppState();
  const key = slices.slice().sort().join(",");
  React.useEffect(() => {
    void ensureWorkspaceData(slices);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- key encodes slices
  }, [ensureWorkspaceData, key]);
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

  if (sessionStatus === "loading" && !user) {
    return null;
  }

  return <>{children}</>;
}
