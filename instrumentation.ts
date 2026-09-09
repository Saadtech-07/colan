export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmWorkspaceOnStartup } = await import("@/lib/workspace-warmup");
    void warmWorkspaceOnStartup();
  }
}
