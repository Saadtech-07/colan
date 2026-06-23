"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CreateTeamTrigger() {
  return (
    <Button
      asChild
      variant="outline"
      className="h-11 gap-2 rounded-2xl border-border/70 bg-background/80 px-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <Link href="/projects/teams/new">
        <Plus className="h-4 w-4" />
        Create team
      </Link>
    </Button>
  );
}
