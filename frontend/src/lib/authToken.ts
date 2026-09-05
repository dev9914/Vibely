/**
 * In-memory access token for Socket.IO auth.
 * Tokens are also stored in httpOnly cookies for HTTP API calls.
 * Never persist to localStorage/sessionStorage.
 */

import { getApiBaseUrl } from "@/lib/apiConfig";

const API_URL = getApiBaseUrl();

let accessToken: string | null = null;

export const getAccessToken = (): string | null => accessToken;

export const setAccessToken = (token: string | null): void => {
  accessToken = token;
};

export const clearAccessToken = (): void => {
  accessToken = null;
};

const extractAccessToken = (payload: unknown): string | null => {
  if (!payload || typeof payload !== "object") return null;
  const token = (payload as { accessToken?: unknown }).accessToken;
  return typeof token === "string" && token.length > 0 ? token : null;
};

export const storeAccessTokenFromAuthResponse = (payload: unknown): string | null => {
  const token = extractAccessToken(payload);
  if (token) {
    setAccessToken(token);
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
    const response = await fetch(`${API_URL}/users/refresh-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
    });

    if (!response.ok) {
      clearAccessToken();
      return null;
    }

    const json = await response.json();
    const token = extractAccessToken(json?.data ?? json);
    if (token) {
      setAccessToken(token);
      return token;
    }

    clearAccessToken();
    return null;
  } catch {
    clearAccessToken();
    return null;
  }
};
