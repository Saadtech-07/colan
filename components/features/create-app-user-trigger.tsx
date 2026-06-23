"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateAppUserTrigger() {
  return (
    <Button
      asChild
      className="h-10 shrink-0 gap-2 rounded-xl px-4 shadow-sm"
    >
      <Link href="/app-users/new">
        <Plus className="h-4 w-4" />
        Create account
      </Link>
    </Button>
  );
}
