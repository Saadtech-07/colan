/** Pre-connect MongoDB and run one-time index/seed setup before the first API request. */
export async function warmWorkspaceOnStartup(): Promise<void> {
  try {
    const { getDb } = await import("@/lib/mongodb");
    const { ensureWorkspaceReady } = await import("@/lib/workspace-ready");
    const db = await getDb();
    if (db) await ensureWorkspaceReady(db);
  } catch {
    /* non-fatal — first request will retry */
  }
}
