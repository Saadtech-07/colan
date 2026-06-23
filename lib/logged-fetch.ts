type LoggedFetchInit = RequestInit & {
  /** Component or hook that initiated the request (shown in dev console). */
  source?: string;
};

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

/** Wraps fetch with a dev-only log identifying the caller. */
export function loggedFetch(
  input: RequestInfo | URL,
  init?: LoggedFetchInit,
): Promise<Response> {
  const { source, ...fetchInit } = init ?? {};
  const method = (fetchInit.method ?? "GET").toUpperCase();
  const url = resolveUrl(input);

  if (process.env.NODE_ENV === "development") {
    console.log(`[API] ${method} ${url} ← ${source ?? "unknown"}`);
  }

  return fetch(input, fetchInit);
}
