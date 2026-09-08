"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InlinePageLoader } from "@/components/ui/inline-page-loader";
import { fetchPlatformCompanies } from "@/lib/platform/platform-client";

type CompanyRow = {
  id: string;
  name: string;
  slug: string;
  city?: string;
  status: "active" | "inactive";
  adminEmail?: string;
  userCount?: number;
  createdAt?: string;
};

export default function SuperAdminCompaniesPage() {
  const [companies, setCompanies] = React.useState<CompanyRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState("all");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPlatformCompanies({ search, status });
      setCompanies(data.companies as CompanyRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load companies.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Companies</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage tenant workspaces on the Colan platform.</p>
        </div>
        <Button asChild className="rounded-xl">
          <Link href="/super-admin/companies/create">
            <Plus className="mr-2 h-4 w-4" />
            Create Company
          </Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies…"
            className="rounded-xl pl-9"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px] rounded-xl">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <InlinePageLoader title="Loading companies…" />
      ) : error ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">{error}</div>
      ) : companies.length === 0 ? (
        <Card className="rounded-2xl border-dashed">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No companies match your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {companies.map((company) => (
            <Link key={company.id} href={`/super-admin/companies/${company.id}`}>
              <Card className="rounded-2xl transition-shadow hover:shadow-md">
                <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-semibold">{company.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {company.slug}
                      {company.city ? ` · ${company.city}` : ""}
                    </p>
                    {company.adminEmail ? (
                      <p className="mt-1 text-xs text-muted-foreground">Admin: {company.adminEmail}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{company.userCount ?? 0} users</span>
                    <Badge variant={company.status === "active" ? "default" : "secondary"}>
                      {company.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
