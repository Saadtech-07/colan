"use client";

import * as React from "react";
import { GlobalLoadingOverlay } from "@/components/ui/global-loading-overlay";
import {
  LOADING_KEY_PRIORITY,
  type LoadingPreset,
} from "@/lib/loading-presets";
import { useAppState } from "@/providers/app-state";

type LoadingConfig = LoadingPreset;

type GlobalLoadingContextValue = {
  syncing: boolean;
  loadingMessage: string;
  title: string;
  description: string;
  isLoadingKey: (key: string) => boolean;
  showLoading: (key: string, config: LoadingConfig) => void;
  hideLoading: (key: string) => void;
  withLoading: <T>(key: string, config: LoadingConfig, fn: () => Promise<T>) => Promise<T>;
};

const GlobalLoadingContext = React.createContext<GlobalLoadingContextValue | null>(
  null,
);

function pickActiveConfig(
  active: Map<string, LoadingConfig>,
): LoadingConfig | null {
  if (active.size === 0) return null;
  for (const key of LOADING_KEY_PRIORITY) {
    const config = active.get(key);
    if (config) return config;
  }
  return active.values().next().value ?? null;
}

function GlobalLoadingProviderInner({ children }: { children: React.ReactNode }) {
  const [active, setActive] = React.useState<Map<string, LoadingConfig>>(
    () => new Map(),
  );

  const showLoading = React.useCallback((key: string, config: LoadingConfig) => {
    setActive((prev) => {
      const next = new Map(prev);
      next.set(key, config);
      return next;
    });
  }, []);

  const hideLoading = React.useCallback((key: string) => {
    setActive((prev) => {
      if (!prev.has(key)) return prev;
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
  }, []);

  const withLoading = React.useCallback(
    async <T,>(key: string, config: LoadingConfig, fn: () => Promise<T>) => {
      showLoading(key, config);
      try {
        return await fn();
      } finally {
        hideLoading(key);
      }
    },
    [hideLoading, showLoading],
  );

  const visible = pickActiveConfig(active);
  const syncing = active.size > 0;
  const title = visible?.title ?? "Loading";
  const description = visible?.description ?? "Please wait...";
  const loadingMessage = title;

  const isLoadingKey = React.useCallback(
    (key: string) => active.has(key),
    [active],
  );

  const value = React.useMemo(
    () => ({
      syncing,
      loadingMessage,
      title,
      description,
      isLoadingKey,
      showLoading,
      hideLoading,
      withLoading,
    }),
    [
      syncing,
      loadingMessage,
      title,
      description,
      isLoadingKey,
      showLoading,
      hideLoading,
      withLoading,
    ],
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      <GlobalLoadingOverlay open={syncing} title={title} description={description} />
      {children}
    </GlobalLoadingContext.Provider>
  );
}

function WorkspaceSyncBridge() {
  const { dataLoading } = useAppState();
  const { showLoading, hideLoading } = useGlobalLoading();

  React.useEffect(() => {
    if (dataLoading) {
      showLoading("workspace-sync", {
        title: "Syncing Workspace",
        description:
          "Updating employees, projects, seating and workspace data...",
      });
    } else {
      hideLoading("workspace-sync");
    }
  }, [dataLoading, hideLoading, showLoading]);

  return null;
}

function SessionLoadingBridge() {
  const { sessionStatus } = useAppState();
  const { showLoading, hideLoading } = useGlobalLoading();

  React.useEffect(() => {
    if (sessionStatus === "loading") {
      showLoading("session", {
        title: "Loading Workspace",
        description: "Preparing your admin dashboard session...",
      });
    } else {
      hideLoading("session");
    }
  }, [sessionStatus, hideLoading, showLoading]);

  return null;
}

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  return (
    <GlobalLoadingProviderInner>
      <WorkspaceSyncBridge />
      <SessionLoadingBridge />
      {children}
    </GlobalLoadingProviderInner>
  );
}

export function useGlobalLoading() {
  const ctx = React.useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }
  return ctx;
}
