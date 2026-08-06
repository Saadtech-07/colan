import { dedupeAsync, invalidateDedupeCache } from "@/lib/dedupe-async";
import type { Employee, GalleryImage, Project } from "@/types";
import type { TeamDTO, WorkspaceRole } from "@/models";
import type { DataLayerSummary } from "@/types/data-layer";
import { hydrateRoleRegistry } from "@/lib/role-registry";

/**
 * Single-flight GET loaders for workspace bootstrap endpoints.
 * Concurrent callers (Strict Mode, overlapping effects) share one network request.
 * Short TTL absorbs remounts after the first response lands.
 */

const BOOTSTRAP_TTL_MS = 8_000;

export function fetchRolesOnce(opts?: { force?: boolean }): Promise<WorkspaceRole[]> {
  return dedupeAsync(
    "workspace:GET:/api/roles",
    async () => {
      const res = await fetch("/api/roles", {
        credentials: "include",
        cache: "no-store",
      });
      if (res.status === 403) return [];
      if (!res.ok) {
        throw new Error(`Failed to load roles (${res.status})`);
      }
      const roles = (await res.json()) as WorkspaceRole[];
      hydrateRoleRegistry(roles);
      return roles;
    },
    { ttlMs: BOOTSTRAP_TTL_MS, force: opts?.force },
  );
}

export function fetchEmployeesOnce(opts?: { force?: boolean }): Promise<Employee[]> {
  return dedupeAsync(
    "workspace:GET:/api/employees",
    async () => {
      const res = await fetch("/api/employees", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load employees (${res.status})`);
      return (await res.json()) as Employee[];
    },
    { ttlMs: BOOTSTRAP_TTL_MS, force: opts?.force },
  );
}

export function fetchProjectsOnce(opts?: { force?: boolean }): Promise<Project[]> {
  return dedupeAsync(
    "workspace:GET:/api/projects",
    async () => {
      const res = await fetch("/api/projects", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load projects (${res.status})`);
      return (await res.json()) as Project[];
    },
    { ttlMs: BOOTSTRAP_TTL_MS, force: opts?.force },
  );
}

export function fetchGalleryOnce(opts?: { force?: boolean }): Promise<GalleryImage[]> {
  return dedupeAsync(
    "workspace:GET:/api/gallery",
    async () => {
      const res = await fetch("/api/gallery", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load gallery (${res.status})`);
      return (await res.json()) as GalleryImage[];
    },
    { ttlMs: BOOTSTRAP_TTL_MS, force: opts?.force },
  );
}

export function fetchTeamsOnce(opts?: { force?: boolean }): Promise<TeamDTO[]> {
  return dedupeAsync(
    "workspace:GET:/api/teams",
    async () => {
      const res = await fetch("/api/teams", { credentials: "include" });
      if (!res.ok) throw new Error(`Failed to load teams (${res.status})`);
      return (await res.json()) as TeamDTO[];
    },
    { ttlMs: BOOTSTRAP_TTL_MS, force: opts?.force },
  );
}

export function fetchDbStatusOnce(opts?: { force?: boolean }): Promise<DataLayerSummary | null> {
  return dedupeAsync(
    "workspace:GET:/api/db-status",
    async () => {
      const res = await fetch("/api/db-status", { credentials: "include" });
      if (!res.ok) return null;
      return (await res.json()) as DataLayerSummary;
    },
    { ttlMs: BOOTSTRAP_TTL_MS, force: opts?.force },
  );
}

export function fetchProjectManagersOnce<T = unknown>(opts?: {
  force?: boolean;
}): Promise<T> {
  return dedupeAsync(
    "workspace:GET:/api/projects/project-managers",
    async () => {
      const res = await fetch("/api/projects/project-managers", {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`Failed to load project managers (${res.status})`);
      return (await res.json()) as T;
    },
    { ttlMs: BOOTSTRAP_TTL_MS, force: opts?.force },
  );
}

export function fetchProjectBySlugOnce<T = unknown>(
  slug: string,
  opts?: { force?: boolean },
): Promise<T> {
  const key = slug.trim().toLowerCase();
  return dedupeAsync(
    `workspace:GET:/api/projects/${key}`,
    async () => {
      const res = await fetch(`/api/projects/${encodeURIComponent(slug)}`, {
        credentials: "include",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? res.statusText);
      }
      return (await res.json()) as T;
    },
    { ttlMs: BOOTSTRAP_TTL_MS, force: opts?.force },
  );
}

/** Call after mutations that invalidate list/detail GET caches. */
export function invalidateWorkspaceApiCache(prefix = "workspace:") {
  invalidateDedupeCache(prefix);
}
