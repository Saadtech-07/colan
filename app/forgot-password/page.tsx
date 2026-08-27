"use client";

import * as React from "react";
import {
  AuthBackLink,
  AuthShell,
  AuthSubmitButton,
} from "@/components/features/auth-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not send reset email.");
        return;
      }
      setSuccess(
        data.message ??
          "If an account exists for that email, a password reset link has been sent.",
      );
    } catch {
      setError("Could not send reset email. Please try again.");
    } finally {
      setPending(false);
    }
  };

  return (
    <AuthShell
      title="Reset password"
      description="Enter your work email and we will send you a secure reset link."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-500">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
            {success}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
            disabled={pending}
            className="h-12 rounded-xl border-slate-200 bg-white/80"
          />
        </div>

        <AuthSubmitButton
          pending={pending}
          idleLabel="Send reset link"
          pendingLabel="Sending..."
        />
      </form>

      <AuthBackLink href="/login" label="Back to sign in" />

      <p className="mt-6 text-center text-xs text-muted-foreground">
        The reset link expires in 3 hours. Check your inbox and spam folder.
      </p>
    </AuthShell>
  );
}
