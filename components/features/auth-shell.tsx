"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import colanlogo2 from "@/app/image/colanlogo2.png";

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#020617] px-4 py-10 dark:bg-[#020617]">
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggle className="text-white/80 hover:bg-white/10 hover:text-white" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#2563eb25,transparent_30%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,#9333ea20,transparent_30%)]" />
      <div className="absolute -top-40 left-0 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-[400px] w-[400px] rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative z-10 w-full max-w-md">
        <Card className="border-white/10 bg-white/90 shadow-2xl backdrop-blur-xl">
          <CardContent className="p-8">
            <div className="mb-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-50 items-center justify-center">
                <img
                  src={colanlogo2.src}
                  alt="Colan Logo"
                  className="h-16 w-16 object-contain"
                />
              </div>
              <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            </div>
            {children}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function AuthBackLink({ href, label }: { href: string; label: string }) {
  return (
    <div className="mt-8 text-center">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {label}
      </Link>
    </div>
  );
}

export function AuthSubmitButton({
  pending,
  idleLabel,
  pendingLabel,
}: {
  pending: boolean;
  idleLabel: string;
  pendingLabel: string;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      className="h-12 w-full rounded-xl text-sm font-semibold shadow-lg transition-transform hover:scale-[1.01]"
    >
      {pending ? pendingLabel : idleLabel}
      {!pending && <ArrowRight className="ml-2 h-4 w-4" />}
    </Button>
  );
}
