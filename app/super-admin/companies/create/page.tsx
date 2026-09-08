"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createPlatformCompany } from "@/lib/platform/platform-client";
import { parseApiError } from "@/providers/app-state";

export default function CreateCompanyPage() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    companyName: "",
    slug: "",
    city: "",
    adminName: "",
    adminEmail: "",
    adminPassword: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await createPlatformCompany({
        companyName: form.companyName,
        slug: form.slug || undefined,
        city: form.city || undefined,
        adminName: form.adminName,
        adminEmail: form.adminEmail,
        adminPassword: form.adminPassword,
      });
      if (!res.ok) throw new Error(await parseApiError(res));
      const json = (await res.json()) as { company: { id: string } };
      router.push(`/super-admin/companies/${json.company.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create company.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Button asChild variant="ghost" className="rounded-xl px-0 hover:bg-transparent">
        <Link href="/super-admin/companies">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to companies
        </Link>
      </Button>

      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Create Company</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Provision a new tenant workspace and its primary admin account.
        </p>
      </div>

      <form onSubmit={(e) => void submit(e)} className="space-y-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Company Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                required
                value={form.companyName}
                onChange={(e) => setForm((f) => ({ ...f, companyName: e.target.value }))}
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="slug">Company Slug</Label>
              <Input
                id="slug"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="auto-generated if empty"
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="mt-1.5 rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Primary Tenant Admin</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="adminName">Admin Name</Label>
              <Input
                id="adminName"
                required
                value={form.adminName}
                onChange={(e) => setForm((f) => ({ ...f, adminName: e.target.value }))}
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="adminEmail">Admin Email</Label>
              <Input
                id="adminEmail"
                type="email"
                required
                value={form.adminEmail}
                onChange={(e) => setForm((f) => ({ ...f, adminEmail: e.target.value }))}
                className="mt-1.5 rounded-xl"
              />
            </div>
            <div>
              <Label htmlFor="adminPassword">Temporary Password</Label>
              <Input
                id="adminPassword"
                type="password"
                required
                minLength={8}
                value={form.adminPassword}
                onChange={(e) => setForm((f) => ({ ...f, adminPassword: e.target.value }))}
                className="mt-1.5 rounded-xl"
              />
            </div>
          </CardContent>
        </Card>

        {error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" className="rounded-xl" asChild>
            <Link href="/super-admin/companies">Cancel</Link>
          </Button>
          <Button type="submit" className="rounded-xl" disabled={pending}>
            {pending ? "Creating…" : "Create Company"}
          </Button>
        </div>
      </form>
    </div>
  );
}
