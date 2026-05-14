"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { Building2, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AppRole, TeamName } from "@/types";
import { TEAMS } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const { status } = useSession();
  const [name, setName] = React.useState("Alex Morgan");
  const [email, setEmail] = React.useState("alex.morgan@colan.io");
  const [role, setRole] = React.useState<AppRole>("admin");
  const [team, setTeam] = React.useState<TeamName>("React Team");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        name,
        appRole: role,
        team: role === "employee" ? team : "",
      });
      if (result?.error) {
        setError("Could not sign in. Check your details and try again.");
        return;
      }
      router.refresh();
      router.push("/dashboard");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-sidebar via-[#1e293b] to-slate-900 p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center text-white">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/10 shadow-lg ring-1 ring-white/20 backdrop-blur">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Colan</h1>
          <p className="mt-1 text-sm text-slate-300">
            Sign in to the employee &amp; project workspace
          </p>
        </div>
        <Card className="border-white/10 bg-white/95 shadow-2xl backdrop-blur">
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Auth.js credentials session — MongoDB stores directory, projects, and
              gallery when <code className="text-xs">MONGODB_URI</code> is set; otherwise
              an in-memory store is used for this process.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <div className="space-y-2">
                <Label htmlFor="name">Display name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div className="space-y-2">
                <Label>Access role</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={role === "admin" ? "default" : "outline"}
                    className="h-auto flex-col gap-1 py-3"
                    onClick={() => setRole("admin")}
                  >
                    <Shield className="h-4 w-4" />
                    <span className="text-xs font-semibold">Admin</span>
                  </Button>
                  <Button
                    type="button"
                    variant={role === "employee" ? "default" : "outline"}
                    className="h-auto flex-col gap-1 py-3"
                    onClick={() => setRole("employee")}
                  >
                    <User className="h-4 w-4" />
                    <span className="text-xs font-semibold">Employee</span>
                  </Button>
                </div>
              </div>
              {role === "employee" && (
                <div className="space-y-2">
                  <Label>Your team</Label>
                  <Select
                    value={team}
                    onValueChange={(v) => setTeam(v as TeamName)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAMS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Employees only see projects for this team.
                  </p>
                </div>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={pending}>
                {pending ? "Signing in…" : "Continue to dashboard"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs text-slate-400">
          Internal use only.{" "}
          <Link href="/login" className="underline underline-offset-2 hover:text-white">
            Security policy
          </Link>
        </p>
      </div>
    </div>
  );
}
