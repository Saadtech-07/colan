"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthBackLink,
  AuthShell,
  AuthSubmitButton,
} from "@/components/features/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingIndicator } from "@/components/ui/loading-indicator";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [accountName, setAccountName] = React.useState("");
  const [accountEmail, setAccountEmail] = React.useState("");
  const [tokenValid, setTokenValid] = React.useState<boolean | null>(null);
  const [tokenError, setTokenError] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  React.useEffect(() => {
    if (!token) {
      setTokenValid(false);
      setTokenError("Reset link is invalid.");
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/auth/reset-password?token=${encodeURIComponent(token)}`);
        const data = (await res.json()) as {
          valid?: boolean;
          name?: string;
          email?: string;
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok || !data.valid) {
          setTokenValid(false);
          setTokenError(data.error ?? "This reset link is invalid or has expired.");
          return;
        }
        setAccountName(data.name ?? "");
        setAccountEmail(data.email ?? "");
        setTokenValid(true);
      } catch {
        if (cancelled) return;
        setTokenValid(false);
        setTokenError("Could not validate reset link.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not update password.");
        return;
      }

      router.push("/login?reset=success");
    } catch {
      setError("Could not update password. Please try again.");
    } finally {
      setPending(false);
    }
  };

  if (tokenValid === null) {
    return (
      <AuthShell title="Change password" description="Checking your reset link...">
        <LoadingIndicator title="Validating reset link" className="min-h-[220px]" />
      </AuthShell>
    );
  }

  if (!tokenValid) {
    return (
      <AuthShell
        title="Reset link expired"
        description="This password reset link is no longer valid."
      >
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {tokenError}
        </div>
        <AuthBackLink href="/forgot-password" label="Request a new reset link" />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={`Change password${accountName ? ` for ${accountName}` : ""}`}
      description="Choose a new password with at least 6 characters."
    >
      {accountEmail ? (
        <p className="mb-5 rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Account: <span className="font-medium text-foreground">{accountEmail}</span>
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
            disabled={pending}
            className="h-12 rounded-xl border-slate-200 bg-white/80"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            required
            minLength={6}
            disabled={pending}
            className="h-12 rounded-xl border-slate-200 bg-white/80"
          />
        </div>

        <AuthSubmitButton
          pending={pending}
          idleLabel="Change password"
          pendingLabel="Saving..."
        />
      </form>

      <AuthBackLink href="/login" label="Back to sign in" />
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <React.Suspense
      fallback={
        <AuthShell title="Change password" description="Loading reset form...">
          <LoadingIndicator title="Loading" className="min-h-[220px]" />
        </AuthShell>
      }
    >
      <ResetPasswordForm />
    </React.Suspense>
  );
}
