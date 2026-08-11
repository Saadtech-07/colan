/**
 * Run work after the browser is idle so critical route data can paint first.
 * Falls back to setTimeout when requestIdleCallback is unavailable.
 */
export function scheduleIdle(task: () => void, timeoutMs = 1_500): () => void {
  if (typeof window === "undefined") {
    task();
    return () => undefined;
  }

  const ric = window.requestIdleCallback?.bind(window);
  if (ric) {
    const id = ric(() => task(), { timeout: timeoutMs });
    return () => window.cancelIdleCallback?.(id);
  }

  const timer = window.setTimeout(task, Math.min(200, timeoutMs));
  return () => window.clearTimeout(timer);
}
