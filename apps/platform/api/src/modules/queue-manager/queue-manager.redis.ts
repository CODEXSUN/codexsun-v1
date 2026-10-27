export function queueRedisConnection(address: string, consumer = false) {
  const url = new URL(address);
  if (url.protocol !== "redis:" && url.protocol !== "rediss:")
    throw new Error("Queue Redis requires redis:// or rediss://.");
  const db = Number(url.pathname.slice(1) || 0);
  if (!Number.isSafeInteger(db) || db < 0)
    throw new Error("Queue Redis requires a nonnegative database number.");
  return {
    db,
    host: url.hostname.replace(/^\[|\]$/g, ""),
    port: Number(url.port || 6379),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    connectTimeout: 3000,
    maxRetriesPerRequest: consumer ? null : 1,
    ...(consumer
      ? {}
      : { commandTimeout: 3000, retryStrategy: (attempt: number) => (attempt <= 1 ? 250 : null) }),
    ...(url.protocol === "rediss:" ? { tls: {} } : {})
  };
}
