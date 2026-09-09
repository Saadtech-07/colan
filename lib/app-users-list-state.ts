export type AppUsersListState = {
  page: number;
  searchQuery: string;
  roleFilter: string;
  teamFilter: string;
};

const STORAGE_KEY = "colan.app-users.list-state";

const DEFAULT_STATE: AppUsersListState = {
  page: 1,
  searchQuery: "",
  roleFilter: "all",
  teamFilter: "all",
};

function canUseStorage(): boolean {
  return typeof window !== "undefined";
}

export function parseAppUsersPageParam(value: string | null | undefined): number {
  const parsed = value ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function readAppUsersListState(searchParams?: URLSearchParams): AppUsersListState {
  const fromUrl = searchParams
    ? {
        page: parseAppUsersPageParam(searchParams.get("page")),
        searchQuery: searchParams.get("q") ?? undefined,
        roleFilter: searchParams.get("role") ?? undefined,
        teamFilter: searchParams.get("team") ?? undefined,
      }
    : {};

  if (!canUseStorage()) {
    return {
      ...DEFAULT_STATE,
      page: fromUrl.page ?? DEFAULT_STATE.page,
      searchQuery: fromUrl.searchQuery ?? DEFAULT_STATE.searchQuery,
      roleFilter: fromUrl.roleFilter ?? DEFAULT_STATE.roleFilter,
      teamFilter: fromUrl.teamFilter ?? DEFAULT_STATE.teamFilter,
    };
  }

  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<AppUsersListState>) : {};
    return {
      page:
        fromUrl.page ??
        (typeof stored.page === "number" && stored.page > 0 ? stored.page : DEFAULT_STATE.page),
      searchQuery:
        fromUrl.searchQuery ??
        (typeof stored.searchQuery === "string" ? stored.searchQuery : DEFAULT_STATE.searchQuery),
      roleFilter:
        fromUrl.roleFilter ??
        (typeof stored.roleFilter === "string" ? stored.roleFilter : DEFAULT_STATE.roleFilter),
      teamFilter:
        fromUrl.teamFilter ??
        (typeof stored.teamFilter === "string" ? stored.teamFilter : DEFAULT_STATE.teamFilter),
    };
  } catch {
    return {
      ...DEFAULT_STATE,
      page: fromUrl.page ?? DEFAULT_STATE.page,
    };
  }
}

export function writeAppUsersListState(state: Partial<AppUsersListState>) {
  if (!canUseStorage()) return;

  const next = {
    ...readAppUsersListState(),
    ...state,
  };
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function buildAppUsersListHref(
  state: Partial<AppUsersListState> = {},
  pathname = "/app-users",
): string {
  const next = {
    ...readAppUsersListState(),
    ...state,
  };
  const params = new URLSearchParams();
  if (next.page > 1) params.set("page", String(next.page));
  if (next.searchQuery.trim()) params.set("q", next.searchQuery.trim());
  if (next.roleFilter !== "all") params.set("role", next.roleFilter);
  if (next.teamFilter !== "all") params.set("team", next.teamFilter);
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function appUsersListHref(
  state?: Partial<AppUsersListState>,
  searchParams?: URLSearchParams,
): string {
  if (state) {
    return buildAppUsersListHref(state);
  }
  if (searchParams) {
    return buildAppUsersListHref(readAppUsersListState(searchParams));
  }
  return buildAppUsersListHref();
}
