async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "include", cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export type PlatformDashboardStats = {
  totalCompanies: number;
  activeCompanies: number;
  inactiveCompanies: number;
  totalTenantAdmins: number;
  recentCompanies: Array<{
    id: string;
    name: string;
    slug: string;
    status: "active" | "inactive";
    createdAt?: string;
  }>;
  recentTenantAdmins: Array<{
    id: string;
    email: string;
    name: string;
    companyName: string;
    createdAt?: string;
  }>;
};

export function fetchPlatformDashboardStats() {
  return fetchJson<PlatformDashboardStats>("/api/platform/dashboard");
}

export function fetchPlatformCompanies(params?: { search?: string; status?: string }) {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return fetchJson<{ companies: PlatformDashboardStats["recentCompanies"] & { adminEmail?: string; userCount?: number }[] }>(
    `/api/platform/companies${suffix}`,
  );
}

export function createPlatformCompany(body: Record<string, unknown>) {
  return fetch("/api/platform/companies", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchPlatformCompany(id: string) {
  return fetchJson<{ company: Record<string, unknown> }>(`/api/platform/companies/${id}`);
}

export function updatePlatformCompany(id: string, body: Record<string, unknown>) {
  return fetch(`/api/platform/companies/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function fetchPlatformTenantAdmins(params?: { search?: string; companyId?: string }) {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.companyId) q.set("companyId", params.companyId);
  const suffix = q.toString() ? `?${q.toString()}` : "";
  return fetchJson<{ admins: Array<Record<string, unknown>> }>(`/api/platform/tenant-admins${suffix}`);
}

export function fetchPlatformAuditLogs() {
  return fetchJson<{ logs: Array<Record<string, unknown>> }>("/api/platform/audit-logs");
}

export function fetchPlatformSettings() {
  return fetchJson<{ settings: Record<string, unknown> }>("/api/platform/settings");
}
