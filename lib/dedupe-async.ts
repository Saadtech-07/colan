/**
 * In-flight request coalescing — identical concurrent fetches share one Promise.
 * Optional short TTL caches completed results to absorb Strict Mode remounts
 * that finish the first request before the second effect runs.
 */
const inflight = new Map<string, Promise<unknown>>();
const completed = new Map<string, { at: number; value: unknown }>();

export function dedupeAsync<T>(
  key: string,
  factory: () => Promise<T>,
  opts?: { ttlMs?: number; force?: boolean },
): Promise<T> {
  const ttlMs = opts?.ttlMs ?? 0;

  if (!opts?.force && ttlMs > 0) {
    const hit = completed.get(key);
    if (hit && Date.now() - hit.at < ttlMs) {
      return Promise.resolve(hit.value as T);
    }
  }

  const existing = inflight.get(key);
  if (existing && !opts?.force) return existing as Promise<T>;

  const pending = factory()
    .then((value) => {
      if (ttlMs > 0) {
        completed.set(key, { at: Date.now(), value });
      }
      return value;
    })
    .finally(() => {
      if (inflight.get(key) === pending) {
        inflight.delete(key);
      }
    });

  inflight.set(key, pending);
  return pending;
}

export function invalidateDedupeCache(keyPrefix?: string) {
  if (!keyPrefix) {
    completed.clear();
    return;
  }
  for (const key of completed.keys()) {
    if (key.startsWith(keyPrefix) || key === keyPrefix) {
      completed.delete(key);
    }
  }
}
