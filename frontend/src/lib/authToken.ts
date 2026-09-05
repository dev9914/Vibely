/**
 * Access token management for Socket.IO auth and Authorization header fallback.
 * Tokens are also stored in httpOnly cookies for HTTP API calls.
 * Per project memory conventions: token is persisted to localStorage so the
 * Authorization Bearer header survives page reloads / cross-site cookie blocks.
 * localStorage.token is the authoritative source for RTK Query prepareHeaders.
 */

import { getApiBaseUrl } from "@/lib/apiConfig";

const API_URL = getApiBaseUrl();

const TOKEN_STORAGE_KEY = 'token';
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

// Hydrate from localStorage on module init (cross-tab / reload persistence)
let accessToken: string | null =
  typeof window !== 'undefined' ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;

let refreshToken: string | null =
  typeof window !== 'undefined' ? window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) : null;

export const getAccessToken = (): string | null => accessToken;
export const getRefreshToken = (): string | null => refreshToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    }
  }
};

export const setRefreshToken = (token: string | null): void => {
  refreshToken = token;
  if (typeof window !== 'undefined') {
    if (token) {
      window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
    }
  }
};

export const clearAccessToken = (): void => {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
  }
};

const extractAccessToken = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const token = (payload as { accessToken?: unknown }).accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
};

const extractRefreshToken = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const token = (payload as { refreshToken?: unknown }).refreshToken;
  return typeof token === "string" && token.length > 0 ? token : null;
};

export const storeAccessTokenFromAuthResponse = (payload: unknown): string | null => {
  const token = extractAccessToken(payload);
  if (token) {
    setAccessToken(token);
  }
  const rt = extractRefreshToken(payload);
  if (rt) {
    setRefreshToken(rt);
  }
  return token;
};

export const fetchSocketToken = async (): Promise<string | null> => {
  try {
    const headers: HeadersInit = {};
    const existingToken = getAccessToken();
    if (existingToken) {
      headers.Authorization = `Bearer ${existingToken}`;
    }

    const response = await fetch(`${API_URL}/users/socket-token`, {
      method: "GET",
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      return null;
    }

    const json = await response.json();
    const token = extractAccessToken(json?.data ?? json);
    if (token) {
      setAccessToken(token);
    }
    return token;
  } catch {
    return null;
  }
};

export const ensureAccessToken = async (): Promise<string | null> => {
  if (accessToken) {
    return accessToken;
  }
  return fetchSocketToken();
};

export const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const bodyRt = getRefreshToken();
    const response = await fetch(`${API_URL}/users/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: bodyRt ? JSON.stringify({ refreshToken: bodyRt }) : undefined,
    });

    if (!response.ok) {
      clearAccessToken();
      return null;
    }

    const json = await response.json();
    const data = json?.data ?? json;
    const token = extractAccessToken(data);
    const rt = extractRefreshToken(data);
    if (token) {
      setAccessToken(token);
      if (rt) setRefreshToken(rt);
      return token;
    }

    clearAccessToken();
    return null;
  } catch {
    clearAccessToken();
    return null;
  }
};
