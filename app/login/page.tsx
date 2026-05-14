"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";

import {
  ArrowRight,
  Building2,
  ShieldCheck,
  Sparkles,
  User2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  Card,
  CardContent,
} from "@/components/ui/card";

import { Input } from "@/components/ui/input";

import { Label } from "@/components/ui/label";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Badge } from "@/components/ui/badge";

import type { AppRole, TeamName } from "@/types";

import { TEAMS } from "@/lib/constants";
import colanlogo from '../image/colanlogo.png'
export default function LoginPage() {
  const router = useRouter();

  const { status } = useSession();

  const [name, setName] = React.useState("Alex Morgan");

  const [email, setEmail] = React.useState(
    "alex.morgan@colan.io"
  );

  const [role, setRole] =
    React.useState<AppRole>("admin");

  const [team, setTeam] =
    React.useState<TeamName>("React Team");

  const [error, setError] =
    React.useState<string | null>(null);

  const [pending, setPending] =
    React.useState(false);

  React.useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError(null);

    setPending(true);

    try {
      const result = await signIn(
        "credentials",
        {
          redirect: false,
          email,
          name,
          appRole: role,
          team:
            role === "employee"
              ? team
              : "",
        }
      );

      if (result?.error) {
        setError(
          "Could not sign in. Please verify your details."
        );

        return;
      }

      router.refresh();

      router.push("/dashboard");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4 py-10">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#2563eb25,transparent_30%)]" />

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#9333ea20,transparent_30%)]" />

      <div className="absolute -top-40 left-0 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />

      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-fuchsia-500/10 blur-3xl" />

      {/* Main Content */}
      <div className="relative z-10 grid w-full max-w-6xl overflow-hidden rounded-[32px] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl lg:grid-cols-2">
        
        {/* Left Side */}
        <div className="hidden flex-col justify-between bg-gradient-to-br from-primary/20 via-blue-500/10 to-fuchsia-500/10 p-10 text-white lg:flex">
          <div>
            <div className="mb-6 flex h-20 w-50 items-center justify-center ">
              <img src="https://colaninfotech.com/wp-content/uploads/2020/09/colan-logo.png" alt="" />
            </div>

            

            <h1 className="mt-6 text-5xl font-bold leading-tight">
              Manage your <br />
              company workflow.
            </h1>

            <p className="mt-5 max-w-md text-base leading-relaxed text-slate-300">
              Securely manage employees,
              projects, teams, and company
              collaboration from a modern
              dashboard experience.
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/20 p-3">
                <Sparkles className="h-5 w-5 text-emerald-400" />
              </div>

              <div>
                <p className="font-semibold">
                  Fast & Secure Access
                </p>

                <p className="text-sm text-slate-300">
                  Auth.js powered login system
                  with protected routes.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side */}
        <div className="flex items-center justify-center p-6 sm:p-10">
          <Card className="w-full max-w-md border-white/10 bg-white/90 shadow-none backdrop-blur-xl">
            <CardContent className="p-8">
              
              {/* Header */}
              <div className="mb-8 text-center">
                <div className="mx-auto mb-4 flex h-16 w-50 items-center justify-center ">
                 <img
  src={colanlogo.src}
  alt="Colan Logo"
  className="h-16 w-16 object-contain"
/>
                </div>

                <h2 className="text-3xl font-bold tracking-tight">
                  Welcome Back
                </h2>

                <p className="mt-2 text-sm text-muted-foreground">
                  Login to continue to your
                  workspace dashboard
                </p>
              </div>

              {/* Form */}
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {error && (
                  <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
                    {error}
                  </div>
                )}

                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Display Name
                  </Label>

                  <Input
                    id="name"
                    value={name}
                    onChange={(e) =>
                      setName(e.target.value)
                    }
                    autoComplete="name"
                    className="h-12 rounded-xl border-slate-200 bg-white/80"
                  />
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email">
                    Work Email
                  </Label>

                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(e.target.value)
                    }
                    autoComplete="email"
                    className="h-12 rounded-xl border-slate-200 bg-white/80"
                  />
                </div>

                {/* Role */}
                <div className="space-y-3">
                  <Label>
                    Select Access Role
                  </Label>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setRole("admin")
                      }
                      className={`group rounded-2xl border p-4 transition-all ${
                        role === "admin"
                          ? "border-primary bg-primary text-white shadow-lg"
                          : "border-slate-200 bg-white hover:border-primary/40"
                      }`}
                    >
                      <ShieldCheck className="mx-auto mb-2 h-5 w-5" />

                      <p className="text-sm font-semibold">
                        Admin
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setRole("employee")
                      }
                      className={`group rounded-2xl border p-4 transition-all ${
                        role === "employee"
                          ? "border-primary bg-primary text-white shadow-lg"
                          : "border-slate-200 bg-white hover:border-primary/40"
                      }`}
                    >
                      <User2 className="mx-auto mb-2 h-5 w-5" />

                      <p className="text-sm font-semibold">
                        Employee
                      </p>
                    </button>
                  </div>
                </div>

                {/* Team */}
                {role === "employee" && (
                  <div className="space-y-2">
                    <Label>
                      Choose Team
                    </Label>

                    <Select
                      value={team}
                      onValueChange={(v) =>
                        setTeam(
                          v as TeamName
                        )
                      }
                    >
                      <SelectTrigger className="h-12 rounded-xl">
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>

                      <SelectContent>
                        {TEAMS.map((t) => (
                          <SelectItem
                            key={t}
                            value={t}
                          >
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <p className="text-xs text-muted-foreground">
                      Employees can only
                      access their assigned
                      team projects.
                    </p>
                  </div>
                )}

                {/* Button */}
                <Button
                  type="submit"
                  size="lg"
                  disabled={pending}
                  className="h-12 w-full rounded-xl text-sm font-semibold shadow-lg transition-transform hover:scale-[1.01]"
                >
                  {pending
                    ? "Signing In..."
                    : "Continue To Dashboard"}

                  {!pending && (
                    <ArrowRight className="ml-2 h-4 w-4" />
                  )}
                </Button>
              </form>

              {/* Footer */}
              <div className="mt-8 text-center text-xs text-muted-foreground">
                Internal company access only.{" "}
                <Link
                  href="/login"
                  className="font-medium text-primary hover:underline"
                >
                  Security Policy
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}