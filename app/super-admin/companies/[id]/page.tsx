"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InlinePageLoader } from "@/components/ui/inline-page-loader";
import { fetchPlatformCompany, updatePlatformCompany } from "@/lib/platform/platform-client";
import { parseApiError } from "@/providers/app-state";

type CompanyDetail = {
  id: string;
  name: string;
  slug: string;
  city?: string;
  status: "active" | "inactive";
  adminEmail?: string;
  adminName?: string;
  userCount: number;
  employeeCount: number;
  roleCount: number;
  admins: Array<{ id: string; email: string; name: string; isActive: boolean }>;
  createdAt?: string;
  updatedAt?: string;
};

export default function CompanyDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [company, setCompany] = React.useState<CompanyDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({ name: "", slug: "", city: "" });

  React.useEffect(() => {
    void fetchPlatformCompany(params.id)
      .then((data) => {
        const c = data.company as CompanyDetail;
        setCompany(c);
        setForm({ name: c.name, slug: c.slug, city: c.city ?? "" });
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Unable to load company."))
      .finally(() => setLoading(false));
  }, [params.id]);

  const toggleStatus = async () => {
    if (!company) return;
    setSaving(true);
    setError(null);
    try {
      const nextStatus = company.status === "active" ? "inactive" : "active";
      const res = await updatePlatformCompany(company.id, { status: nextStatus });
      if (!res.ok) throw new Error(await parseApiError(res));
      const json = (await res.json()) as { company: CompanyDetail };
      setCompany((prev) => (prev ? { ...prev, ...json.company } : json.company));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to update status.");
    } finally {
      setSaving(false);
    }
  };

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setSaving(true);
    setError(null);
    try {
      const res = await updatePlatformCompany(company.id, form);
      if (!res.ok) throw new Error(await parseApiError(res));
      const json = (await res.json()) as { company: CompanyDetail };
      setCompany((prev) => (prev ? { ...prev, ...json.company } : json.company));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save company.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlinePageLoader title="Loading company…" />;
  if (!company) {
    return <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">{error ?? "Company not found."}</div>;
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" className="rounded-xl px-0 hover:bg-transparent">
        <Link href="/super-admin/companies">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to companies
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-semibold tracking-tight">{company.name}</h2>
            <Badge variant={company.status === "active" ? "default" : "secondary"}>{company.status}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{company.slug}</p>
        </div>
        <Button
          type="button"
          variant={company.status === "active" ? "destructive" : "default"}
          className="rounded-xl"
          disabled={saving}
          onClick={() => void toggleStatus()}
        >
          {company.status === "active" ? "Deactivate Company" : "Activate Company"}
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="rounded-2xl"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Users</p><p className="text-2xl font-bold">{company.userCount}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Employees</p><p className="text-2xl font-bold">{company.employeeCount}</p></CardContent></Card>
        <Card className="rounded-2xl"><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Roles</p><p className="text-2xl font-bold">{company.roleCount}</p></CardContent></Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Primary Admin</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p><span className="text-muted-foreground">Name:</span> {company.adminName ?? "—"}</p>
            <p><span className="text-muted-foreground">Email:</span> {company.adminEmail ?? "—"}</p>
            <Button asChild variant="outline" size="sm" className="mt-3 rounded-xl">
              <Link href={`/super-admin/tenant-admins?companyId=${company.id}`}>Manage tenant admins</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader><CardTitle className="text-base">Edit Company</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={(e) => void saveDetails(e)} className="space-y-4">
              <div>
                <Label htmlFor="name">Company Name</Label>
                <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} className="mt-1.5 rounded-xl" />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} className="mt-1.5 rounded-xl" />
              </div>
              <Button type="submit" className="rounded-xl" disabled={saving}>{saving ? "Saving…" : "Save Changes"}</Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {error ? <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}
    </div>
  );
}
