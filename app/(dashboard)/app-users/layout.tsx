"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CreateAppUserSheet } from "@/components/features/create-app-user-sheet";
import { EditAppUserSheet } from "@/components/features/edit-app-user-sheet";
import { appUsersListHref } from "@/lib/app-users-list-state";
import { useAppState } from "@/providers/app-state";

const EDIT_APP_USER_PATH = /^\/app-users\/([^/]+)\/edit$/;

export default function AppUsersLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAdmin } = useAppState();
  const isCreateRoute = pathname === "/app-users/new";
  const editUserId = pathname.match(EDIT_APP_USER_PATH)?.[1] ?? null;

  React.useEffect(() => {
    if (!isAdmin && (isCreateRoute || editUserId)) {
      router.replace("/app-users");
    }
  }, [editUserId, isAdmin, isCreateRoute, router]);

  const closePanel = React.useCallback(() => {
    router.replace(appUsersListHref(undefined, searchParams));
  }, [router, searchParams]);

  const handleCreateOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && isCreateRoute) closePanel();
    },
    [closePanel, isCreateRoute],
  );

  const handleEditOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open && editUserId) closePanel();
    },
    [closePanel, editUserId],
  );

  return (
    <>
      {children}
      {isAdmin ? (
        <>
          <CreateAppUserSheet open={isCreateRoute} onOpenChange={handleCreateOpenChange} />
          {editUserId ? (
            <EditAppUserSheet
              userId={editUserId}
              open={!!editUserId}
              onOpenChange={handleEditOpenChange}
            />
          ) : null}
        </>
      ) : null}
    </>
  );
}
