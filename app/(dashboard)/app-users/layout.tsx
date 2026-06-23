"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CreateAppUserSheet } from "@/components/features/create-app-user-sheet";
import { useAppState } from "@/providers/app-state";

export default function AppUsersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useAppState();
  const isCreateRoute = pathname === "/app-users/new";

  React.useEffect(() => {
    if (!isAdmin && isCreateRoute) {
      router.replace("/app-users");
    }
  }, [isAdmin, isCreateRoute, router]);

  const handleCreateOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && isCreateRoute) {
        router.push("/app-users");
      }
    },
    [isCreateRoute, router],
  );

  return (
    <>
      {children}
      {isAdmin ? (
        <CreateAppUserSheet open={isCreateRoute} onOpenChange={handleCreateOpenChange} />
      ) : null}
    </>
  );
}
