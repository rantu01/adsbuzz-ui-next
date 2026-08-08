// Lightweight in-memory TTL cache for read-heavy list endpoints.
// All writes (POST/PATCH/DELETE) invalidate the affected keys so stale data
// is never served after a mutation within the same process.

const store = new Map();

export const DEFAULT_TTL = 30_000;

const MAX_ENTRIES = 100;

export function cacheGet(key, ttl = DEFAULT_TTL) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.createdAt > ttl) {
    store.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet(key, value, ttl = DEFAULT_TTL) {
  if (store.size >= MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) store.delete(oldestKey);
  }
  store.set(key, { createdAt: Date.now(), value });
  return value;
}

export function cacheInvalidate(keyPrefix) {
  for (const key of [...store.keys()]) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}

export function clearCache() {
  store.clear();
}

export default { cacheGet, cacheSet, cacheInvalidate, clearCache };