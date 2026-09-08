"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlinePageLoader } from "@/components/ui/inline-page-loader";
import { fetchPlatformCompanies, fetchPlatformTenantAdmins } from "@/lib/platform/platform-client";
import { parseApiError } from "@/providers/app-state";

type TenantAdminRow = {
  id: string;
  email: string;
  name: string;
  companyId: string;
  companyName: string;
  isActive: boolean;
  createdAt?: string;
};

type CompanyOption = { id: string; name: string };

export function TenantAdminsPageContent() {
  const searchParams = useSearchParams();
  const companyId = searchParams.get("companyId") ?? undefined;
  const [admins, setAdmins] = React.useState<TenantAdminRow[]>([]);
  const [companies, setCompanies] = React.useState<CompanyOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pendingId, setPendingId] = React.useState<string | null>(null);
  const [showCreate, setShowCreate] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    companyId: companyId ?? "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  React.useEffect(() => {
    void fetchPlatformCompanies()
      .then((data) =>
        setCompanies(
          (data.companies as Array<{ id: string; name: string }>).map((c) => ({
            id: c.id,
            name: c.name,
          })),
        ),
      )
      .catch(() => undefined);
  }, []);

  React.useEffect(() => {
    if (companyId) {
      setCreateForm((f) => ({ ...f, companyId }));
    }
  }, [companyId]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformTenantAdmins({ search, companyId });
      setAdmins(data.admins as TenantAdminRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load tenant admins.");
    } finally {
      setLoading(false);
    }
  }, [companyId, search]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  const toggleActive = async (admin: TenantAdminRow) => {
    setPendingId(admin.id);
    setError(null);
    try {
      const res = await fetch("/api/platform/tenant-admins", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: admin.id, isActive: !admin.isActive }),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update tenant admin.");
    } finally {
      setPendingId(null);
    }
  };

  const createAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/platform/tenant-admins", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      setShowCreate(false);
      setCreateForm({
        companyId: companyId ?? "",
        adminName: "",
        adminEmail: "",
        adminPassword: "",
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create tenant admin.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tenant Admins</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage primary admin accounts across tenant workspaces.
          </p>
        </div>
        <Button type="button" className="rounded-xl" onClick={() => setShowCreate((v) => !v)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Tenant Admin
        </Button>
      </div>

      {showCreate ? (
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Create Tenant Admin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void createAdmin(e)} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="createCompany">Company</Label>
                <Select
                  value={createForm.companyId}
                  onValueChange={(value) => setCreateForm((f) => ({ ...f, companyId: value }))}
                >
                  <SelectTrigger id="createCompany" className="mt-1.5 rounded-xl">
                    <SelectValue placeholder="Select company" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="createName">Admin Name</Label>
                <Input
                  id="createName"
                  required
                  value={createForm.adminName}
                  onChange={(e) => setCreateForm((f) => ({ ...f, adminName: e.target.value }))}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div>
                <Label htmlFor="createEmail">Admin Email</Label>
                <Input
                  id="createEmail"
                  type="email"
                  required
                  value={createForm.adminEmail}
                  onChange={(e) => setCreateForm((f) => ({ ...f, adminEmail: e.target.value }))}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="createPassword">Temporary Password</Label>
                <Input
                  id="createPassword"
                  type="password"
                  required
                  minLength={8}
                  value={createForm.adminPassword}
                  onChange={(e) => setCreateForm((f) => ({ ...f, adminPassword: e.target.value }))}
                  className="mt-1.5 rounded-xl"
                />
              </div>
              <div className="flex gap-3 sm:col-span-2">
                <Button type="submit" className="rounded-xl" disabled={creating || !createForm.companyId}>
                  {creating ? "Creating…" : "Create Admin"}
                </Button>
                <Button type="button" variant="outline" className="rounded-xl" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <div className="relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, or company…"
          className="rounded-xl pl-9"
        />
      </div>

      {loading ? (
        <InlinePageLoader title="Loading tenant admins…" />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">{error}</div>
      ) : admins.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">No tenant admins found.</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {admins.map((admin) => (
            <Card key={admin.id} className="rounded-2xl">
              <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div>
                  <p className="font-semibold">{admin.name}</p>
                  <p className="text-sm text-muted-foreground">{admin.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{admin.companyName}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={admin.isActive ? "default" : "secondary"}>
                    {admin.isActive ? "Active" : "Disabled"}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="rounded-xl"
                    disabled={pendingId === admin.id}
                    onClick={() => void toggleActive(admin)}
                  >
                    {admin.isActive ? "Disable" : "Enable"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
