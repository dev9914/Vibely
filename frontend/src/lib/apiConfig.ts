/**
 * Single source of truth for API + Socket URLs.
 *
 * Local dev (recommended):
 *   VITE_BACKEND_URL=http://localhost:5000
 *   VITE_API_URL=/api/v1
 *   (leave VITE_SOCKET_URL unset — Vite proxies /socket.io to the backend)
 *
 * Production / preview without Vite proxy:
 *   VITE_API_URL=https://your-api.example.com/api/v1
 *   VITE_SOCKET_URL=https://your-api.example.com
 */

const trim = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
};

export const getBackendUrl = (): string =>
  trim(import.meta.env.VITE_BACKEND_URL) || "http://localhost:5000";

export const getApiBaseUrl = (): string =>
  trim(import.meta.env.VITE_API_URL) ||
  (import.meta.env.DEV ? "/api/v1" : `${getBackendUrl()}/api/v1`);

export const getSocketUrl = (): string | undefined => {
  const configuredSocketUrl = trim(import.meta.env.VITE_SOCKET_URL);
  if (configuredSocketUrl) {
    return configuredSocketUrl;
  }

  // Dev: same-origin through Vite proxy (see vite.config.ts)
  if (import.meta.env.DEV) {
    return undefined;
  }

  return getBackendUrl();
};

export const isDevProxyMode = (): boolean =>
  import.meta.env.DEV &&
  !trim(import.meta.env.VITE_SOCKET_URL) &&
  (trim(import.meta.env.VITE_API_URL)?.startsWith("/") ?? true);
